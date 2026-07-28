import {
  modelLibURLPrefix,
  modelVersion,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";

const MODEL_LIBRARY_ROOT = `${modelLibURLPrefix}${modelVersion}/`;

export const MODEL_PRESETS = [
  {
    key: "low",
    tier: "저성능",
    modelId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    displayName: "Qwen2.5 0.5B",
    params: "0.5B",
    estimatedVramMb: 945,
    contextWindow: 4096,
    hfModelId: "Qwen/Qwen2.5-0.5B-Instruct",
    modelUrl: "https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    modelLibUrl: `${MODEL_LIBRARY_ROOT}Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    description: "가장 빠르고 가벼운 교육·실험용 모델",
    recommendation: "내장 그래픽 또는 빠른 첫 실행",
  },
  {
    key: "medium",
    tier: "중간",
    modelId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    displayName: "Qwen2.5 1.5B",
    params: "1.5B",
    estimatedVramMb: 1630,
    contextWindow: 4096,
    hfModelId: "Qwen/Qwen2.5-1.5B-Instruct",
    modelUrl: "https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    modelLibUrl: `${MODEL_LIBRARY_ROOT}Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    description: "속도와 답변 품질의 균형이 좋은 기본 추천",
    recommendation: "대부분의 외장 GPU 노트북",
  },
  {
    key: "high",
    tier: "고성능",
    modelId: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    displayName: "Qwen2.5 3B",
    params: "3B",
    estimatedVramMb: 2505,
    contextWindow: 4096,
    hfModelId: "Qwen/Qwen2.5-3B-Instruct",
    modelUrl: "https://huggingface.co/mlc-ai/Qwen2.5-3B-Instruct-q4f16_1-MLC",
    modelLibUrl: `${MODEL_LIBRARY_ROOT}Qwen2.5-3B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    description: "더 안정적인 설명과 추론을 위한 고품질 모델",
    recommendation: "RTX급 외장 GPU 권장",
  },
];

const defaultPreset = MODEL_PRESETS[1];

export const DEFAULT_MODEL_SELECTION = {
  mode: "preset",
  presetKey: defaultPreset.key,
  modelId: defaultPreset.modelId,
  displayName: defaultPreset.displayName,
  hfModelId: defaultPreset.hfModelId,
  modelUrl: defaultPreset.modelUrl,
  modelLibUrl: defaultPreset.modelLibUrl,
  contextWindow: defaultPreset.contextWindow,
};

export function getPreset(key) {
  return MODEL_PRESETS.find((item) => item.key === key) ?? defaultPreset;
}

export function getPrebuiltModelIds() {
  return (prebuiltAppConfig?.model_list ?? [])
    .map((record) => record.model_id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function isPrebuiltModel(modelId) {
  return getPrebuiltModelIds().includes(modelId);
}

export function normalizeModelSelection(selection) {
  const merged = { ...DEFAULT_MODEL_SELECTION, ...(selection ?? {}) };
  if (merged.mode === "preset") {
    const preset = getPreset(merged.presetKey);
    return {
      mode: "preset",
      presetKey: preset.key,
      modelId: preset.modelId,
      displayName: preset.displayName,
      hfModelId: preset.hfModelId,
      modelUrl: preset.modelUrl,
      modelLibUrl: preset.modelLibUrl,
      contextWindow: preset.contextWindow,
    };
  }

  return {
    mode: "custom",
    presetKey: "custom",
    modelId: String(merged.modelId || "").trim(),
    displayName: String(merged.displayName || merged.modelId || "사용자 모델").trim(),
    hfModelId: String(merged.hfModelId || "").trim(),
    modelUrl: String(merged.modelUrl || "").trim(),
    modelLibUrl: String(merged.modelLibUrl || "").trim(),
    contextWindow: Math.max(512, Math.min(8192, Number(merged.contextWindow) || 2048)),
  };
}

export function getModelMeta(selection) {
  const normalized = normalizeModelSelection(selection);
  const preset = MODEL_PRESETS.find((item) => item.modelId === normalized.modelId);
  if (preset) return { ...preset, ...normalized };
  return {
    key: "custom",
    tier: "사용자 지정",
    params: "CUSTOM",
    estimatedVramMb: null,
    description: normalized.modelUrl
      ? "직접 지정한 MLC/WebLLM 모델"
      : "WebLLM 내장 모델 ID",
    recommendation: "모델 제작자가 안내한 GPU 요구량 확인",
    ...normalized,
  };
}

export function validateModelSelection(selection) {
  const normalized = normalizeModelSelection(selection);
  if (!normalized.modelId) return "모델 ID를 입력해주세요.";
  const hasOneCustomUrl = Boolean(normalized.modelUrl) !== Boolean(normalized.modelLibUrl);
  if (hasOneCustomUrl) {
    return "직접 MLC 모델을 사용할 때는 모델 URL과 model library URL을 모두 입력해야 합니다.";
  }
  if (!normalized.modelUrl && !isPrebuiltModel(normalized.modelId)) {
    return "이 모델 ID는 현재 WebLLM 내장 목록에 없습니다. 직접 변환한 모델이라면 두 URL도 입력해주세요.";
  }
  return "";
}
