import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";
import {
  getModelMeta,
  isPrebuiltModel,
  normalizeModelSelection,
  validateModelSelection,
} from "./models";

let engine = null;
let loadingPromise = null;
let worker = null;
let loadedSignature = "";
let loadedSelection = null;

function selectionSignature(selection) {
  const normalized = normalizeModelSelection(selection);
  return JSON.stringify({
    modelId: normalized.modelId,
    modelUrl: normalized.modelUrl,
    modelLibUrl: normalized.modelLibUrl,
    contextWindow: normalized.contextWindow,
  });
}

export function isWebGpuAvailable() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export async function getWebGpuInfo() {
  if (!isWebGpuAvailable()) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const info = adapter.info ?? {};
    return {
      vendor: info.vendor || "",
      architecture: info.architecture || "",
      device: info.device || "",
      description: info.description || "",
      maxBufferSize: Number(adapter.limits?.maxBufferSize || 0),
    };
  } catch {
    return null;
  }
}

export async function loadLocalModel(selection, onProgress = () => {}) {
  const normalized = normalizeModelSelection(selection);
  const validationError = validateModelSelection(normalized);
  if (validationError) throw new Error(validationError);

  const signature = selectionSignature(normalized);
  if (engine && signature === loadedSignature) return engine;
  if (loadingPromise && signature === loadedSignature) return loadingPromise;
  if (!isWebGpuAvailable()) {
    throw new Error(
      "이 브라우저에서 WebGPU를 사용할 수 없습니다. 최신 Chrome 또는 Edge를 이용해주세요.",
    );
  }

  if (engine || worker || loadingPromise) await unloadLocalModel();

  worker = new Worker(new URL("./llmWorker.js", import.meta.url), {
    type: "module",
  });
  loadedSignature = signature;
  loadedSelection = normalized;

  const engineConfig = {
    initProgressCallback: (report) => {
      onProgress({
        text: report.text ?? "모델을 준비하는 중입니다.",
        progress: Number.isFinite(report.progress) ? report.progress : 0,
      });
    },
  };

  if (!isPrebuiltModel(normalized.modelId)) {
    engineConfig.appConfig = {
      cacheBackend: "indexeddb",
      model_list: [
        {
          model: normalized.modelUrl,
          model_id: normalized.modelId,
          model_lib: normalized.modelLibUrl,
          overrides: { context_window_size: normalized.contextWindow },
        },
      ],
    };
  }

  loadingPromise = CreateWebWorkerMLCEngine(
    worker,
    normalized.modelId,
    engineConfig,
    { context_window_size: normalized.contextWindow },
  )
    .then((created) => {
      engine = created;
      loadingPromise = null;
      return engine;
    })
    .catch((error) => {
      worker?.terminate();
      worker = null;
      engine = null;
      loadingPromise = null;
      loadedSignature = "";
      loadedSelection = null;
      throw error;
    });

  return loadingPromise;
}

export function getEngine() {
  return engine;
}

export function getLoadedModel() {
  return loadedSelection ? getModelMeta(loadedSelection) : null;
}

export async function unloadLocalModel() {
  if (engine) {
    try {
      await engine.unload();
    } catch (error) {
      console.warn("모델 해제 중 경고", error);
    }
  }
  worker?.terminate();
  worker = null;
  engine = null;
  loadingPromise = null;
  loadedSignature = "";
  loadedSelection = null;
}

export async function interruptGeneration() {
  if (!engine) return;
  await engine.interruptGenerate();
}

export async function streamChat({
  messages,
  temperature = 0.7,
  topP = 0.9,
  maxTokens = 320,
  onToken,
}) {
  if (!engine) throw new Error("먼저 로컬 모델을 불러와주세요.");
  const startedAt = performance.now();
  let output = "";
  let usage = null;

  const chunks = await engine.chat.completions.create({
    messages,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  });

  for await (const chunk of chunks) {
    const delta = chunk.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      output += delta;
      onToken?.(output, delta);
    }
    if (chunk.usage) usage = chunk.usage;
  }

  const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
  const completionTokens = usage?.completion_tokens ?? Math.max(1, Math.round(output.length / 2.5));
  return {
    text: output,
    elapsedSeconds,
    completionTokens,
    tokensPerSecond: completionTokens / elapsedSeconds,
    usage,
  };
}
