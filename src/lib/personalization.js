function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function overlapScore(query, candidate) {
  const queryTokens = new Set(normalize(query));
  const candidateTokens = normalize(candidate);
  if (!queryTokens.size || !candidateTokens.length) return 0;
  const hits = candidateTokens.filter((token) => queryTokens.has(token)).length;
  return hits / Math.sqrt(queryTokens.size * candidateTokens.length);
}

export function selectExamples(query, examples, limit = 3) {
  return [...examples]
    .map((item) => ({
      ...item,
      score: overlapScore(query, `${item.instruction} ${item.tags?.join(" ") ?? ""}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildPersonalizedSystem(baseSystem, query, examples, preferences) {
  const selected = selectExamples(query, examples, 3);
  const preferenceHints = preferences
    .slice(-5)
    .map(
      (item, index) =>
        `${index + 1}. 선호 답변의 특징을 따르고 비선호 답변의 문제를 피한다.\n선호: ${item.chosen}\n비선호: ${item.rejected}`,
    )
    .join("\n\n");

  const examplesText = selected
    .map(
      (item, index) =>
        `예시 ${index + 1}\n질문: ${item.instruction}\n좋은 답변: ${item.output}`,
    )
    .join("\n\n");

  return [
    baseSystem,
    "아래 데이터는 사용자가 직접 만든 학습 예시다. 질문과 관련될 때 답변의 정확도, 구조, 설명 수준을 참고하되 그대로 복사하지 않는다.",
    examplesText || "아직 관련 학습 예시가 없다.",
    preferenceHints ? `사용자 선호 기록:\n${preferenceHints}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function datasetQuality(examples) {
  if (!examples.length) {
    return {
      score: 0,
      duplicates: 0,
      avgInstruction: 0,
      avgOutput: 0,
      completeness: 0,
    };
  }
  const seen = new Set();
  let duplicates = 0;
  let complete = 0;
  let instructionLength = 0;
  let outputLength = 0;

  for (const item of examples) {
    const key = item.instruction.trim().toLowerCase();
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
    instructionLength += item.instruction.trim().length;
    outputLength += item.output.trim().length;
    if (item.instruction.trim().length >= 8 && item.output.trim().length >= 20) {
      complete += 1;
    }
  }

  const completeness = complete / examples.length;
  const diversity = Math.max(0, 1 - duplicates / examples.length);
  const lengthBalance = Math.min(1, outputLength / examples.length / 120);
  const score = Math.round((completeness * 0.45 + diversity * 0.35 + lengthBalance * 0.2) * 100);

  return {
    score,
    duplicates,
    avgInstruction: Math.round(instructionLength / examples.length),
    avgOutput: Math.round(outputLength / examples.length),
    completeness: Math.round(completeness * 100),
  };
}
