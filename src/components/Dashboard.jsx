import React from "react";
import { Badge, Button, Card, Icon, Progress } from "./UI";
import { datasetQuality } from "../lib/personalization";

export default function Dashboard({ state, modelState, modelMeta, onNavigate, onLoadModel }) {
  const quality = datasetQuality(state.sftExamples);
  const completedGames = Object.keys(state.game.dungeonScores ?? {}).length;
  const personalizedWins = state.arenaVotes.filter((vote) => vote.winner === "personalized").length;
  const winRate = state.arenaVotes.length
    ? Math.round((personalizedWins / state.arenaVotes.length) * 100)
    : 0;

  const cards = [
    {
      label: "SFT 예시",
      value: state.sftExamples.length,
      unit: "개",
      detail: `완성도 ${quality.completeness}%`,
      icon: "data",
    },
    {
      label: "선호 데이터",
      value: state.preferences.length,
      unit: "쌍",
      detail: "chosen / rejected",
      icon: "arena",
    },
    {
      label: "경기장 승률",
      value: winRate,
      unit: "%",
      detail: "개인화 모델 기준",
      icon: "spark",
    },
    {
      label: "연구 경험치",
      value: state.game.xp,
      unit: "XP",
      detail: `던전 ${completedGames}/3 완료`,
      icon: "game",
    },
  ];

  return (
    <div className="page dashboard-page">
      <Card className="hero-card">
        <div className="hero-grid-overlay" />
        <div className="hero-content">
          <Badge tone="accent">STEP 1–3 통합 실습</Badge>
          <h2>
            AI를 사용하는 데서 끝나지 않고,
            <br />직접 가르치고 비교해보세요.
          </h2>
          <p>
            모든 대화와 학습 데이터는 브라우저 안에 저장됩니다. 저성능·중간·고성능 또는
            사용자 지정 모델을 선택해 인터넷 서버 없이 채팅과 모델 대결을 진행할 수 있습니다.
          </p>
          <div className="hero-actions">
            <Button
              icon={modelState.status === "ready" ? "chat" : "cpu"}
              onClick={modelState.status === "ready" ? () => onNavigate("chat") : onLoadModel}
            >
              {modelState.status === "ready" ? "채팅 실험 시작" : "로컬 모델 준비"}
            </Button>
            <Button variant="ghost" icon="data" onClick={() => onNavigate("dataset")}>
              데이터 만들기
            </Button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="core-node">{modelMeta.params}</div>
          <span className="satellite sat-a">TOKEN</span>
          <span className="satellite sat-b">LoRA</span>
          <span className="satellite sat-c">RLHF</span>
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
              <span className="eyebrow">LEARNING PATH</span>
              <h3>3단계 연구 과정</h3>
            </div>
            <Badge tone={modelState.status === "ready" ? "success" : "neutral"}>
              {modelState.status === "ready" ? "모델 연결됨" : "모델 미연결"}
            </Badge>
          </div>
          <div className="learning-path">
            <PathItem
              number="01"
              title="로컬 AI 이해"
              description="프롬프트, 온도, Top-p를 바꾸며 결과 차이를 관찰합니다."
              progress={modelState.status === "ready" ? 100 : 25}
              onClick={() => onNavigate("chat")}
            />
            <PathItem
              number="02"
              title="게임으로 개념 학습"
              description="토큰 예측, 환각 탐정, 프롬프트 던전을 해결합니다."
              progress={Math.round((completedGames / 3) * 100)}
              onClick={() => onNavigate("games")}
            />
            <PathItem
              number="03"
              title="데이터와 LoRA"
              description="학습 예시를 만들고 기본 모델과 개인화 모델을 평가합니다."
              progress={Math.min(100, state.sftExamples.length * 10 + state.preferences.length * 5)}
              onClick={() => onNavigate("training")}
            />
          </div>
        </Card>

        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">DATA HEALTH</span>
              <h3>학습 데이터 품질</h3>
            </div>
            <div className="score-ring" style={{ "--score": `${quality.score * 3.6}deg` }}>
              <span>{quality.score}</span>
            </div>
          </div>
          <div className="quality-list">
            <QualityRow label="형식 완성도" value={quality.completeness} />
            <QualityRow label="답변 길이 균형" value={Math.min(100, Math.round((quality.avgOutput / 120) * 100))} />
            <QualityRow
              label="중복 질문 방지"
              value={state.sftExamples.length ? Math.round((1 - quality.duplicates / state.sftExamples.length) * 100) : 0}
            />
          </div>
          <div className="quality-summary">
            <div><span>평균 질문</span><strong>{quality.avgInstruction}자</strong></div>
            <div><span>평균 답변</span><strong>{quality.avgOutput}자</strong></div>
            <div><span>중복</span><strong>{quality.duplicates}개</strong></div>
          </div>
          <Button variant="secondary" className="full" onClick={() => onNavigate("dataset")}>
            데이터 품질 개선하기
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
