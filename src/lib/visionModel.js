import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";

export const VISION_MODEL_ID = "Phi-3.5-vision-instruct-q4f16_1-MLC";
export const VISION_MODEL_NAME = "Phi-3.5 Vision";

let engine = null;
let worker = null;
let loadingPromise = null;

export function isVisionReady() {
  return Boolean(engine);
}

export async function loadVisionModel(onProgress = () => {}) {
  if (engine) return engine;
  if (loadingPromise) return loadingPromise;
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    throw new Error("이미지 채팅 모델은 WebGPU가 필요합니다. 최신 Chrome 또는 Edge를 사용해주세요.");
  }

  worker = new Worker(new URL("./llmWorker.js", import.meta.url), { type: "module" });
  loadingPromise = CreateWebWorkerMLCEngine(
    worker,
    VISION_MODEL_ID,
    {
      initProgressCallback: (report) =>
        onProgress({
          text: report.text ?? "이미지 모델을 준비하는 중입니다.",
          progress: Number.isFinite(report.progress) ? report.progress : 0,
        }),
    },
    { context_window_size: 6144 },
  )
    .then((created) => {
      engine = created;
      loadingPromise = null;
      return engine;
    })
    .catch((error) => {
      worker?.terminate();
      worker = null;
      loadingPromise = null;
      throw error;
    });

  return loadingPromise;
}

export async function unloadVisionModel() {
  if (engine) {
    try {
      await engine.unload();
    } catch (error) {
      console.warn("이미지 모델 해제 중 경고", error);
    }
  }
  worker?.terminate();
  engine = null;
  worker = null;
  loadingPromise = null;
}

export async function interruptVisionGeneration() {
  if (engine) await engine.interruptGenerate();
}

export async function streamVisionChat({ messages, maxTokens = 384, onToken }) {
  if (!engine) throw new Error("먼저 이미지 채팅 모델을 불러와주세요.");
  const startedAt = performance.now();
  let output = "";
  let usage = null;
  const chunks = await engine.chat.completions.create({
    messages,
    temperature: 0.2,
    top_p: 0.9,
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
  return { text: output, elapsedSeconds, completionTokens, tokensPerSecond: completionTokens / elapsedSeconds };
}
