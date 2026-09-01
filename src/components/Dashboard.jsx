import React from "react";
import { Badge, Button, Card, Icon, Progress } from "./UI";
import { datasetQuality } from "../lib/personalization";

export default function Dashboard({ state, modelState, modelMeta, onNavigate, onLoadModel }) {
  const quality = datasetQuality(state.sftExamples);
  const practiceDone = Object.keys(state.game.dungeonScores ?? {}).length;
  const personalizedWins = state.arenaVotes.filter((vote) => vote.winner === "personalized").length;
  const winRate = state.arenaVotes.length
    ? Math.round((personalizedWins / state.arenaVotes.length) * 100)
    : 0;

  const cards = [
    {
      label: "SFT 데이터",
      value: state.sftExamples.length,
      unit: "개",
      detail: `완성도 ${quality.completeness}%`,
      icon: "data",
    },
    {
      label: "선호 데이터",
      value: state.preferences.length,
      unit: "쌍",
      detail: "좋은 답변 / 아쉬운 답변",
      icon: "arena",
    },
    {
      label: "개인화 선택률",
      value: winRate,
      unit: "%",
      detail: "답변 비교 결과",
      icon: "spark",
    },
    {
      label: "활동 점수",
      value: state.game.xp,
      unit: "XP",
      detail: `개념 연습 ${practiceDone}/3`,
      icon: "game",
    },
  ];

  return (
    <div className="page dashboard-page">
      <Card className="hero-card">
        <div className="hero-grid-overlay" />
        <div className="hero-content">
          <Badge tone="accent">브라우저에서 실행되는 로컬 AI</Badge>
          <h2>
            Qwen을 직접 실행하고,
            <br />답변과 학습 데이터를 비교해보세요.
          </h2>
          <div className="hero-actions">
            <Button
              icon={modelState.status === "ready" ? "chat" : "cpu"}
              onClick={modelState.status === "ready" ? () => onNavigate("chat") : onLoadModel}
            >
              {modelState.status === "ready" ? "채팅 열기" : "Qwen 불러오기"}
            </Button>
            <Button variant="ghost" icon="data" onClick={() => onNavigate("dataset")}>
              학습 데이터 보기
            </Button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="core-node">{modelMeta.params}</div>
          <span className="satellite sat-a">Qwen</span>
          <span className="satellite sat-b">WebGPU</span>
          <span className="satellite sat-c">LoRA</span>
        </div>
      </Card>

      <div className="stats-grid">
        {cards.map((item) => (
          <Card key={item.label} className="stat-card">
            <div className="stat-icon">
              <Icon name={item.icon} />
            </div>
            <div>
              <span>{item.label}</span>
              <strong>
                {item.value.toLocaleString()}
                <small>{item.unit}</small>
              </strong>
              <p>{item.detail}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="dashboard-columns">
        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">QUICK START</span>
              <h3>바로 시작하기</h3>
            </div>
            <Badge tone={modelState.status === "ready" ? "success" : "neutral"}>
              {modelState.status === "ready" ? "모델 준비됨" : "모델 미로드"}
            </Badge>
          </div>
          <div className="learning-path">
            <PathItem
              number="01"
              title="Qwen과 대화하기"
              description="모델 크기와 생성 설정을 바꿔가며 응답 차이를 확인합니다."
              progress={modelState.status === "ready" ? 100 : 20}
              onClick={() => onNavigate("chat")}
            />
            <PathItem
              number="02"
              title="학습 데이터 만들기"
              description="직접 만든 질문·답변과 선호 쌍을 저장하고 내보낼 수 있습니다."
              progress={Math.min(100, state.sftExamples.length * 10 + state.preferences.length * 5)}
              onClick={() => onNavigate("dataset")}
            />
            <PathItem
              number="03"
              title="답변 비교하기"
              description="기본 응답과 개인화 응답을 같은 질문으로 비교합니다."
              progress={state.arenaVotes.length ? Math.min(100, state.arenaVotes.length * 10) : 0}
              onClick={() => onNavigate("arena")}
            />
          </div>
        </Card>

        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">DATA</span>
              <h3>학습 데이터 상태</h3>
            </div>
            <div className="score-ring" style={{ "--score": `${quality.score * 3.6}deg` }}>
              <span>{quality.score}</span>
            </div>
          </div>
          <div className="quality-list">
            <QualityRow label="필수 항목 채움" value={quality.completeness} />
            <QualityRow label="답변 길이" value={Math.min(100, Math.round((quality.avgOutput / 120) * 100))} />
            <QualityRow
              label="질문 중복"
              value={state.sftExamples.length ? Math.round((1 - quality.duplicates / state.sftExamples.length) * 100) : 0}
            />
          </div>
          <div className="quality-summary">
            <div><span>평균 질문</span><strong>{quality.avgInstruction}자</strong></div>
            <div><span>평균 답변</span><strong>{quality.avgOutput}자</strong></div>
            <div><span>중복</span><strong>{quality.duplicates}개</strong></div>
          </div>
          <Button variant="secondary" className="full" onClick={() => onNavigate("dataset")}>
            학습 데이터 열기
          </Button>
        </Card>
      </div>
    </div>
  );
}

function PathItem({ number, title, description, progress, onClick }) {
  return (
    <button className="path-item" onClick={onClick}>
      <span className="path-number">{number}</span>
      <div className="path-copy">
        <strong>{title}</strong>
        <p>{description}</p>
        <Progress value={progress} label={`${progress}%`} />
      </div>
      <span className="path-arrow">→</span>
    </button>
  );
}

function QualityRow({ label, value }) {
  return (
    <div className="quality-row">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <Progress value={value} />
    </div>
  );
}
