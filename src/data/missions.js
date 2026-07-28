export const tokenMissions = [
  {
    sentence: "인공지능 모델은 학습 데이터에서 반복되는 ___을 찾는다.",
    options: ["패턴", "전압", "온도", "좌표"],
    answer: "패턴",
    explanation:
      "언어 모델은 데이터 속 단어와 문장 구조의 통계적 패턴을 학습합니다. 실제 생성에서는 단어 전체가 아니라 토큰 단위의 확률을 계산합니다.",
  },
  {
    sentence: "생성 온도를 낮추면 보통 답변이 더 ___해진다.",
    options: ["일관적", "무작위", "느리게", "길게"],
    answer: "일관적",
    explanation:
      "낮은 temperature는 확률이 높은 토큰에 선택을 집중시켜 결과를 더 결정적이고 반복 가능하게 만듭니다.",
  },
  {
    sentence: "훈련 데이터에 한쪽 사례만 많으면 모델에 ___이 생길 수 있다.",
    options: ["편향", "냉각", "압축", "암호화"],
    answer: "편향",
    explanation:
      "모델은 제공된 분포를 학습하므로 데이터 구성이 한쪽으로 치우치면 출력도 치우칠 수 있습니다.",
  },
  {
    sentence: "LoRA는 전체 가중치 대신 작은 추가 행렬을 ___한다.",
    options: ["학습", "삭제", "암호화", "복제"],
    answer: "학습",
    explanation:
      "LoRA는 저랭크 어댑터만 훈련해 저장 공간과 학습 비용을 줄입니다.",
  },
];

export const hallucinationMissions = [
  {
    claim: "언어 모델은 답변을 생성할 때 항상 인터넷에서 사실을 검색한다.",
    answer: false,
    explanation:
      "기본 언어 모델은 학습된 가중치와 현재 입력을 이용해 다음 토큰을 예측합니다. 검색 도구나 RAG가 별도로 연결된 경우에만 외부 자료를 조회합니다.",
  },
  {
    claim: "자연스럽고 자신감 있는 문장도 사실과 다를 수 있다.",
    answer: true,
    explanation:
      "문장 자연스러움과 사실 정확성은 같은 지표가 아닙니다. 이를 환각 문제라고 부릅니다.",
  },
  {
    claim: "검증되지 않은 논문 제목과 저자를 모델이 만들어낼 수 있다.",
    answer: true,
    explanation:
      "존재할 법한 표현을 조합해 가짜 출처를 생성할 수 있으므로 원문과 공식 데이터베이스 확인이 필요합니다.",
  },
  {
    claim: "모델 크기가 커지면 모든 편향과 오류가 자동으로 사라진다.",
    answer: false,
    explanation:
      "큰 모델도 데이터와 목표 함수의 영향을 받으며, 오류와 편향을 완전히 제거하지 못합니다.",
  },
];

export const dungeonMissions = [
  {
    id: "summary",
    title: "요약 드론 조종",
    story: "연구 보고서를 3문장으로 요약해야 문이 열립니다.",
    goal: "정확히 3문장, 핵심 결과 포함, 과장 금지",
    keywords: ["3문장", "핵심", "결과", "과장"],
    hint: "역할, 입력, 출력 형식, 금지 조건을 순서대로 명시해보세요.",
  },
  {
    id: "json",
    title: "JSON 금고",
    story: "AI가 설명 없이 JSON만 출력해야 잠금 장치가 작동합니다.",
    goal: "name, score, reason 키를 가진 JSON, 추가 문장 금지",
    keywords: ["JSON", "name", "score", "reason", "추가"],
    hint: "출력 스키마와 JSON 외 텍스트 금지를 명확히 적어보세요.",
  },
  {
    id: "evidence",
    title: "환각 방어막",
    story: "자료에 없는 내용은 모른다고 답하는 연구 AI가 필요합니다.",
    goal: "제공 자료만 사용, 근거 표시, 없으면 모른다고 답하기",
    keywords: ["제공", "자료", "근거", "모른"],
    hint: "사용 가능한 정보 범위와 정보가 없을 때의 행동을 정하세요.",
  },
];
