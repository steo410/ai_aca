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

function messageText(message) {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((item) => item?.type === "text")
      .map((item) => item.text ?? "")
      .join(" ");
  }
  return "";
}

function shouldAutoSearch(messages) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const prompt = messageText(lastUser).trim();
  if (!prompt) return false;

  const explicit = /(인터넷|웹|검색|찾아봐|찾아줘|검색해|조사해|근거|출처)/i;
  const freshness = /(오늘|어제|내일|이번\s*(주|달|달|학기|년도|시즌)|최근|최신|현재|지금|실시간|뉴스|속보|발표|출시|업데이트|버전|가격|시세|주가|환율|날씨|기온|예보|경기|점수|순위|일정|스케줄|경쟁률|입시|전형|정책|법|규정|대통령|총리|CEO|대표|202[5-9]|203\d)/i;
  const recommendation = /(추천해|추천해줘|어디가 좋아|뭐가 좋아|살만한|구매|제품|여행|맛집|호텔|대학|학과)/i;

  return explicit.test(prompt) || freshness.test(prompt) || recommendation.test(prompt);
}

function buildWebContext(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  if (!results.length) return "";

  const lines = [
    "[자동 웹 검색 결과]",
    `검색어: ${payload.query ?? ""}`,
    `검색 시각: ${payload.searchedAt ?? new Date().toISOString()}`,
    "아래 결과는 외부 웹 검색에서 가져왔다. 최신 정보에 관한 답변은 모델의 기억보다 이 결과를 우선한다.",
    "검색 결과에 없는 사실은 단정하지 말고, 출처가 충돌하면 그 차이를 설명한다.",
    "답변에서 검색 결과를 사용한 문장에는 [1], [2]처럼 번호를 붙이고 마지막에 출처 목록을 적는다.",
  ];

  results.forEach((item, index) => {
    lines.push(
      `\n[${index + 1}] ${item.title ?? "제목 없음"}`,
      `출처: ${item.source ?? "Web"}`,
      `URL: ${item.url ?? ""}`,
      item.snippet ? `내용: ${item.snippet}` : "",
    );
  });

  return lines.filter(Boolean).join("\n");
}

async function addAutomaticWebSearch(messages) {
  if (!shouldAutoSearch(messages)) return { messages, searched: false, resultCount: 0 };

  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const query = messageText(lastUser).trim();
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { messages, searched: false, resultCount: 0 };
    const payload = await response.json();
    const context = buildWebContext(payload);
    if (!context) return { messages, searched: false, resultCount: 0 };

    const augmented = messages.map((message) => ({ ...message }));
    const systemIndex = augmented.findIndex((message) => message.role === "system");
    if (systemIndex >= 0) {
      augmented[systemIndex] = {
        ...augmented[systemIndex],
        content: `${messageText(augmented[systemIndex])}\n\n${context}`,
      };
    } else {
      augmented.unshift({ role: "system", content: context });
    }

    return {
      messages: augmented,
      searched: true,
      resultCount: Array.isArray(payload?.results) ? payload.results.length : 0,
    };
  } catch (error) {
    console.warn("자동 웹 검색 실패, 로컬 답변으로 계속합니다.", error);
    return { messages, searched: false, resultCount: 0 };
  }
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

  const web = await addAutomaticWebSearch(messages);
  const chunks = await engine.chat.completions.create({
    messages: web.messages,
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
    webSearch: web.searched,
    webResultCount: web.resultCount,
  };
}
