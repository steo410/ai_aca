const MODEL_ID = "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k";

let worker = null;
let sequence = 0;
let loaded = false;
let loadedDevice = "";
const pending = new Map();

function preferredDevice() {
  return typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";
}

function ensureWorker() {
  if (worker) return worker;

  worker = new Worker(new URL("./visionWorker.js", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event) => {
    const message = event.data || {};
    const request = pending.get(message.requestId);
    if (!request) return;

    if (message.type === "progress") {
      request.onProgress?.(message);
      return;
    }

    if (message.type === "ready") {
      loaded = true;
      loadedDevice = message.device || preferredDevice();
      pending.delete(message.requestId);
      request.resolve({ device: loadedDevice, modelId: MODEL_ID });
      return;
    }

    if (message.type === "result") {
      loaded = true;
      loadedDevice = message.device || loadedDevice || preferredDevice();
      pending.delete(message.requestId);
      request.resolve({
        results: message.results || [],
        device: loadedDevice,
        elapsedSeconds: Number(message.elapsedSeconds || 0),
      });
      return;
    }

    if (message.type === "disposed") {
      pending.delete(message.requestId);
      request.resolve();
      return;
    }

    if (message.type === "error") {
      pending.delete(message.requestId);
      request.reject(new Error(message.message || "이미지 모델 실행 중 오류가 발생했습니다."));
    }
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || "이미지 모델 워커에 오류가 발생했습니다.");
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    worker?.terminate();
    worker = null;
    loaded = false;
    loadedDevice = "";
  };

  return worker;
}

function send(type, payload = {}, onProgress) {
  const activeWorker = ensureWorker();
  const requestId = `vision-${Date.now()}-${sequence += 1}`;

  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject, onProgress });
    const message = {
      type,
      requestId,
      device: preferredDevice(),
      ...payload,
    };
    const transfer = payload.buffer instanceof ArrayBuffer ? [payload.buffer] : [];
    activeWorker.postMessage(message, transfer);
  });
}

export function getVisionModelMeta() {
  return {
    modelId: MODEL_ID,
    displayName: "MobileNetV4 Small",
    classes: 1000,
    inputSize: "224 × 224",
    approximateDownload: "약 65MB",
    loaded,
    device: loadedDevice || preferredDevice(),
  };
}

export function isVisionWebGpuAvailable() {
  return preferredDevice() === "webgpu";
}

export async function loadVisionModel(onProgress = () => {}) {
  if (loaded) return { device: loadedDevice, modelId: MODEL_ID };
  return send("load", {}, onProgress);
}

export async function classifyImage(file, onProgress = () => {}) {
  if (!(file instanceof Blob)) throw new Error("분석할 이미지 파일을 선택해주세요.");
  const buffer = await file.arrayBuffer();
  return send(
    "classify",
    {
      buffer,
      mimeType: file.type || "image/jpeg",
    },
    onProgress,
  );
}

export async function unloadVisionModel() {
  if (!worker) return;
  try {
    await send("dispose");
  } finally {
    worker?.terminate();
    worker = null;
    loaded = false;
    loadedDevice = "";
  }
}
