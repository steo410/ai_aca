import { pipeline, RawImage } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k";

let classifier = null;
let classifierPromise = null;
let loadedDevice = "";

function normalizeProgress(report = {}) {
  const total = Number(report.total || 0);
  const loaded = Number(report.loaded || 0);
  const progress = Number.isFinite(report.progress)
    ? Number(report.progress) / (Number(report.progress) > 1 ? 100 : 1)
    : total > 0
      ? loaded / total
      : 0;

  const file = report.file ? String(report.file).split("/").pop() : "";
  const status = report.status || "loading";
  let text = "이미지 모델을 준비하는 중입니다.";

  if (status === "download") text = file ? `${file} 다운로드 중` : "모델 파일 다운로드 중";
  if (status === "progress") text = file ? `${file} 불러오는 중` : "모델 파일 불러오는 중";
  if (status === "done") text = file ? `${file} 준비 완료` : "파일 준비 완료";
  if (status === "ready") text = "이미지 모델 준비 완료";

  return {
    progress: Math.max(0, Math.min(1, progress || 0)),
    text,
    status,
    file,
  };
}

async function createClassifier(requestId, requestedDevice) {
  const progress_callback = (report) => {
    self.postMessage({
      type: "progress",
      requestId,
      ...normalizeProgress(report),
    });
  };

  if (requestedDevice === "webgpu") {
    try {
      const pipe = await pipeline("image-classification", MODEL_ID, {
        device: "webgpu",
        progress_callback,
      });
      return { pipe, device: "webgpu" };
    } catch (error) {
      self.postMessage({
        type: "progress",
        requestId,
        progress: 0,
        status: "fallback",
        text: "WebGPU 로드에 실패해 CPU(WASM) 모드로 다시 시도합니다.",
        detail: error?.message || String(error),
      });
    }
  }

  const pipe = await pipeline("image-classification", MODEL_ID, {
    dtype: "q8",
    progress_callback,
  });
  return { pipe, device: "wasm" };
}

async function ensureClassifier(requestId, requestedDevice) {
  if (classifier) return { classifier, device: loadedDevice };
  if (!classifierPromise) {
    classifierPromise = createClassifier(requestId, requestedDevice)
      .then(({ pipe, device }) => {
        classifier = pipe;
        loadedDevice = device;
        return { classifier, device };
      })
      .catch((error) => {
        classifierPromise = null;
        classifier = null;
        loadedDevice = "";
        throw error;
      });
  }
  return classifierPromise;
}

self.onmessage = async (event) => {
  const message = event.data || {};
  const { requestId, type } = message;

  try {
    if (type === "load") {
      const { device } = await ensureClassifier(requestId, message.device);
      self.postMessage({ type: "ready", requestId, device, modelId: MODEL_ID });
      return;
    }

    if (type === "classify") {
      const { classifier: activeClassifier, device } = await ensureClassifier(
        requestId,
        message.device,
      );
      const blob = new Blob([message.buffer], {
        type: message.mimeType || "image/jpeg",
      });
      const image = await RawImage.fromBlob(blob);
      const startedAt = performance.now();
      const output = await activeClassifier(image, { top_k: 5 });
      const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);

      self.postMessage({
        type: "result",
        requestId,
        device,
        elapsedSeconds,
        results: output.map((item) => ({
          label: String(item.label || "unknown"),
          score: Number(item.score || 0),
        })),
      });
      return;
    }

    if (type === "dispose") {
      await classifier?.dispose?.();
      classifier = null;
      classifierPromise = null;
      loadedDevice = "";
      self.postMessage({ type: "disposed", requestId });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId,
      message: error?.message || String(error),
    });
  }
};
