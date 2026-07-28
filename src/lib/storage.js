const KEYS = {
  state: "local-ai-academy-state-v2",
  legacyState: "local-ai-academy-state-v1",
};

export const defaultState = {
  sftExamples: [
    {
      id: "seed-sft-1",
      instruction: "대규모 언어 모델이 다음 토큰을 예측한다는 뜻을 중학생도 이해하게 설명해줘.",
      output:
        "언어 모델은 문장을 한 번에 완성하는 것이 아니라, 지금까지 나온 단어를 보고 다음에 올 가능성이 높은 단어 조각을 하나씩 고릅니다. 이 과정을 빠르게 반복하면 자연스러운 문장이 만들어집니다.",
      system: "정확하고 친절한 AI 교사로 답한다.",
      tags: ["AI기초", "토큰"],
      createdAt: Date.now(),
    },
  ],
  preferences: [],
  arenaVotes: [],
  evaluations: [],
  game: {
    xp: 0,
    tokenIndex: 0,
    hallucinationIndex: 0,
    dungeonScores: {},
  },
  settings: {
    systemPrompt:
      "너는 Local AI Academy의 친절한 AI 튜터다. 사실과 추측을 구분하고, 한국어로 이해하기 쉽게 설명한다.",
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 320,
    personalization: true,
    customInstructions: {
      enabled: true,
      aboutUser: "",
      responsePreferences: "기본적으로 자연스럽고 평범한 한국어 존댓말로 답한다.",
      avoid: "답변에 한자 또는 중국어 문자를 섞지 않는다.",
      allowConversationStyleOverrides: true,
      blockCjkIdeographs: true,
    },
    modelSelection: {
      mode: "preset",
      presetKey: "medium",
      modelId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      displayName: "Qwen2.5 1.5B",
      hfModelId: "Qwen/Qwen2.5-1.5B-Instruct",
      modelUrl: "https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      modelLibUrl: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
      contextWindow: 4096,
    },
  },
};

function mergeState(saved) {
  return {
    ...defaultState,
    ...saved,
    game: { ...defaultState.game, ...(saved?.game ?? {}) },
    settings: {
      ...defaultState.settings,
      ...(saved?.settings ?? {}),
      customInstructions: {
        ...defaultState.settings.customInstructions,
        ...(saved?.settings?.customInstructions ?? {}),
      },
      modelSelection: {
        ...defaultState.settings.modelSelection,
        ...(saved?.settings?.modelSelection ?? {}),
      },
    },
    sftExamples: Array.isArray(saved?.sftExamples)
      ? saved.sftExamples
      : defaultState.sftExamples,
    preferences: Array.isArray(saved?.preferences) ? saved.preferences : [],
    arenaVotes: Array.isArray(saved?.arenaVotes) ? saved.arenaVotes : [],
    evaluations: Array.isArray(saved?.evaluations) ? saved.evaluations : [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEYS.state) ?? localStorage.getItem(KEYS.legacyState);
    if (!raw) return structuredClone(defaultState);
    return mergeState(JSON.parse(raw));
  } catch (error) {
    console.warn("저장 데이터를 불러오지 못했습니다.", error);
    return structuredClone(defaultState);
  }
}

export function saveState(state) {
  localStorage.setItem(KEYS.state, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(KEYS.state);
  localStorage.removeItem(KEYS.legacyState);
  return structuredClone(defaultState);
}
