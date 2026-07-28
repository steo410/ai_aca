import { CreateWebWorkerMLCEngine, prebuiltAppConfig } from "@mlc-ai/web-llm";

export const VISION_MODEL_ID = "Phi-3.5-vision-instruct-q4f16_1-MLC";
export const VISION_MODEL_NAME = "Phi-3.5 Vision";
export const VISION_MODEL_VRAM = "약 4GB";

let engine = null;
let worker = null;
let loadingPromise = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVisionModelRecord() {
  return prebuiltAppConfig.model_list.find((item) => item.model_id === VISION_MODEL_ID) ?? null;
}

function normalizeVisionError(error) {
  const message = error?.message || String(error || "알 수 없는 오류");
  if (/out of memory|oom|device lost|device was lost|allocation/i.test(message)) {
    return new Error(
      "GPU 메모리가 부족하거나 WebGPU 장치 연결이 끊어졌습니다. 다른 모델 탭을 닫고 브라우저를 새로고침한 뒤, 더 작은 이미지로 다시 시도해주세요.",
    );
  }
  if (/model record|modelnotfound|cannot find model/i.test(message)) {
    return new Error(
      "현재 WebLLM에서 이미지 모델 설정을 찾지 못했습니다. 사이트를 새로고침해 최신 배포를 적용한 뒤 다시 시도해주세요.",
    );
  }
  if (/context|token|sequence length/i.test(message)) {
    return new Error(
      "이미지나 대화 문맥이 너무 큽니다. 대화를 지우거나 더 작은 이미지를 첨부한 뒤 다시 질문해주세요.",
    );
  }
  return new Error(message);
}

export function isVisionReady() {
  return Boolean(engine);
}

async function createVisionEngine(onProgress) {
  const record = getVisionModelRecord();
  if (!record) {
    throw new Error(`${VISION_MODEL_ID} 모델이 현재 WebLLM 내장 목록에 없습니다.`);
  }

  worker = new Worker(new URL("./llmWorker.js", import.meta.url), { type: "module" });
  const appConfig = {
    cacheBackend: "cache",
    model_list: [
      {
        ...record,
        overrides: {
          ...(record.overrides ?? {}),
          context_window_size: 4096,
        },
      },
    ],
  };

  return CreateWebWorkerMLCEngine(
    worker,
    VISION_MODEL_ID,
    {
      appConfig,
      initProgressCallback: (report) =>
        onProgress({
          text: report.text ?? "이미지 모델을 준비하는 중입니다.",
          progress: Number.isFinite(report.progress) ? report.progress : 0,
        }),
    },
    { context_window_size: 4096 },
  );
}

export async function loadVisionModel(onProgress = () => {}) {
  if (engine) return engine;
  if (loadingPromise) return loadingPromise;
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    throw new Error("이미지 채팅 모델은 WebGPU가 필요합니다. 최신 Chrome 또는 Edge를 사용해주세요.");
  }

  loadingPromise = (async () => {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        onProgress({
          progress: 0,
          text: attempt === 1 ? "이미지 모델 연결을 준비하는 중" : "연결을 정리한 뒤 다시 시도하는 중",
        });
        const created = await createVisionEngine(onProgress);
        engine = created;
        return engine;
      } catch (error) {
        lastError = error;
        worker?.terminate();
        worker = null;
        engine = null;
        if (attempt < 2) await wait(5000);
      }
    }
    throw normalizeVisionError(lastError);
  })().finally(() => {
    loadingPromise = null;
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

export async function streamVisionChat({ messages, maxTokens = 256, onToken }) {
  if (!engine) throw new Error("먼저 이미지 채팅 모델을 불러와주세요.");
  const startedAt = performance.now();

  try {
    const response = await engine.chat.completions.create({
      messages,
      temperature: 0.15,
      top_p: 0.9,
      max_tokens: Math.min(320, Math.max(64, maxTokens)),
      stream: false,
    });

    let text = response?.choices?.[0]?.message?.content ?? "";
    if (Array.isArray(text)) {
      text = text.map((item) => item?.text ?? "").join("");
    }
    if (!text && typeof engine.getMessage === "function") {
      text = await engine.getMessage();
    }
    text = String(text ?? "").trim();
    if (!text) throw new Error("이미지 모델이 빈 답변을 반환했습니다.");
    onToken?.(text, text);

    const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
    const completionTokens =
      response?.usage?.completion_tokens ?? Math.max(1, Math.round(text.length / 2.5));
    return {
      text,
      elapsedSeconds,
      completionTokens,
      tokensPerSecond: completionTokens / elapsedSeconds,
    };
  } catch (error) {
    throw normalizeVisionError(error);
  }
}
