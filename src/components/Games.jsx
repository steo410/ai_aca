import React, { useState } from "react";
import { Badge, Button, Card, Progress } from "./UI";
import { dungeonMissions, hallucinationMissions, tokenMissions } from "../data/missions";

export default function Games({ state, setState }) {
  const [tab, setTab] = useState("token");
  const [tokenResult, setTokenResult] = useState(null);
  const [hallucinationResult, setHallucinationResult] = useState(null);
  const [dungeonPrompt, setDungeonPrompt] = useState("");
  const [selectedDungeon, setSelectedDungeon] = useState(dungeonMissions[0].id);
  const [dungeonFeedback, setDungeonFeedback] = useState(null);

  const tokenMission = tokenMissions[state.game.tokenIndex % tokenMissions.length];
  const hallucinationMission = hallucinationMissions[state.game.hallucinationIndex % hallucinationMissions.length];
  const dungeon = dungeonMissions.find((item) => item.id === selectedDungeon);

  function answerToken(option) {
    if (tokenResult) return;
    const correct = option === tokenMission.answer;
    setTokenResult({ option, correct });
    setState((previous) => ({
      ...previous,
      game: { ...previous.game, xp: previous.game.xp + (correct ? 20 : 5) },
    }));
  }

  function nextToken() {
    setTokenResult(null);
    setState((previous) => ({
      ...previous,
      game: { ...previous.game, tokenIndex: (previous.game.tokenIndex + 1) % tokenMissions.length },
    }));
  }

  function answerHallucination(answer) {
    if (hallucinationResult) return;
    const correct = answer === hallucinationMission.answer;
    setHallucinationResult({ answer, correct });
    setState((previous) => ({
      ...previous,
      game: { ...previous.game, xp: previous.game.xp + (correct ? 20 : 5) },
    }));
  }

  function nextHallucination() {
    setHallucinationResult(null);
    setState((previous) => ({
      ...previous,
      game: {
        ...previous.game,
        hallucinationIndex: (previous.game.hallucinationIndex + 1) % hallucinationMissions.length,
      },
    }));
  }

  function gradeDungeon() {
    const normalized = dungeonPrompt.toLowerCase();
    const matched = dungeon.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
    const structureBonus = /역할|너는|당신은/.test(normalized) ? 10 : 0;
    const formatBonus = /형식|출력|작성/.test(normalized) ? 10 : 0;
    const base = Math.round((matched.length / dungeon.keywords.length) * 80);
    const score = Math.min(100, base + structureBonus + formatBonus);
    const missing = dungeon.keywords.filter((keyword) => !matched.includes(keyword));
    setDungeonFeedback({ score, matched, missing });
    setState((previous) => {
      const oldScore = previous.game.dungeonScores?.[dungeon.id] ?? 0;
      const gain = Math.max(0, score - oldScore);
      return {
        ...previous,
        game: {
          ...previous.game,
          xp: previous.game.xp + gain,
          dungeonScores: {
            ...previous.game.dungeonScores,
            [dungeon.id]: Math.max(oldScore, score),
          },
        },
      };
    });
  }

  return (
    <div className="page games-page">
      <div className="game-summary">
        <Card>
          <span>활동 점수</span>
          <strong>{state.game.xp.toLocaleString()} XP</strong>
          <Progress value={state.game.xp % 100} label={`다음 100점까지 ${100 - (state.game.xp % 100)} XP`} />
        </Card>
        <Card>
          <span>프롬프트 연습</span>
          <strong>{Object.keys(state.game.dungeonScores ?? {}).length}/3 완료</strong>
          <p>세 가지 유형의 프롬프트를 직접 작성해볼 수 있습니다.</p>
        </Card>
        <Card>
          <span>연습 항목</span>
          <strong>토큰 · 사실 확인 · 프롬프트</strong>
          <p>언어 모델을 사용할 때 자주 접하는 기본 개념입니다.</p>
        </Card>
      </div>

      <Card className="game-center-card">
        <div className="tabs game-tabs">
          <button className={tab === "token" ? "active" : ""} onClick={() => setTab("token")}>다음 토큰</button>
          <button className={tab === "hallucination" ? "active" : ""} onClick={() => setTab("hallucination")}>사실 확인</button>
          <button className={tab === "dungeon" ? "active" : ""} onClick={() => setTab("dungeon")}>프롬프트 작성</button>
        </div>

        {tab === "token" ? (
          <div className="game-stage token-stage">
            <div className="game-stage-header">
              <Badge tone="accent">문제 {state.game.tokenIndex + 1}</Badge>
              <span>문장의 다음에 올 가능성이 높은 토큰을 골라보세요.</span>
            </div>
            <div className="token-sentence">{tokenMission.sentence}</div>
            <div className="option-grid">
              {tokenMission.options.map((option) => {
                let className = "game-option";
                if (tokenResult) {
                  if (option === tokenMission.answer) className += " correct";
                  else if (option === tokenResult.option) className += " wrong";
                }
                return <button key={option} className={className} onClick={() => answerToken(option)}>{option}</button>;
              })}
            </div>
            {tokenResult ? (
              <div className={`game-feedback ${tokenResult.correct ? "success" : "failure"}`}>
                <strong>{tokenResult.correct ? "정답입니다." : `정답은 ‘${tokenMission.answer}’입니다.`}</strong>
                <p>{tokenMission.explanation}</p>
                <Button onClick={nextToken}>다음 문제</Button>
              </div>
            ) : (
              <div className="concept-strip">
                <div><span>낮은 Temperature</span><strong>높은 확률의 후보에 집중</strong></div>
                <div className="concept-arrow">→</div>
                <div><span>높은 Temperature</span><strong>더 다양한 후보를 선택</strong></div>
              </div>
            )}
          </div>
        ) : null}

        {tab === "hallucination" ? (
          <div className="game-stage hallucination-stage">
            <div className="game-stage-header">
              <Badge tone="warning">FACT CHECK</Badge>
              <span>아래 내용이 사실인지 판단해보세요.</span>
            </div>
            <blockquote>{hallucinationMission.claim}</blockquote>
            <div className="truth-buttons">
              <button className={hallucinationResult?.answer === true ? "selected" : ""} onClick={() => answerHallucination(true)}><span>O</span><strong>사실이다</strong></button>
              <button className={hallucinationResult?.answer === false ? "selected" : ""} onClick={() => answerHallucination(false)}><span>X</span><strong>사실이 아니다</strong></button>
            </div>
            {hallucinationResult ? (
              <div className={`game-feedback ${hallucinationResult.correct ? "success" : "failure"}`}>
                <strong>{hallucinationResult.correct ? "맞았습니다." : "정답과 다릅니다."}</strong>
                <p>{hallucinationMission.explanation}</p>
                <Button onClick={nextHallucination}>다음 내용</Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "dungeon" ? (
          <div className="dungeon-layout">
            <aside className="dungeon-list">
              {dungeonMissions.map((mission) => {
                const score = state.game.dungeonScores?.[mission.id] ?? 0;
                return (
                  <button key={mission.id} className={selectedDungeon === mission.id ? "active" : ""} onClick={() => { setSelectedDungeon(mission.id); setDungeonPrompt(""); setDungeonFeedback(null); }}>
                    <span>{score >= 70 ? "✓" : "◇"}</span>
                    <div><strong>{mission.title}</strong><small>최고 {score}점</small></div>
                  </button>
                );
              })}
            </aside>
            <div className="dungeon-stage">
              <Badge tone="accent">PROMPT</Badge>
              <h3>{dungeon.title}</h3>
              <p className="dungeon-story">{dungeon.story}</p>
              <div className="mission-goal"><span>포함할 내용</span><strong>{dungeon.goal}</strong></div>
              <label className="field">
                <span>프롬프트</span>
                <textarea rows={10} value={dungeonPrompt} onChange={(event) => setDungeonPrompt(event.target.value)} placeholder="역할, 작업 내용, 출력 형식, 제한 조건 등을 포함해 작성하세요." />
              </label>
              <div className="dungeon-actions">
                <p>참고: {dungeon.hint}</p>
                <Button onClick={gradeDungeon} disabled={!dungeonPrompt.trim()}>확인하기</Button>
              </div>
              {dungeonFeedback ? (
                <div className={`dungeon-score ${dungeonFeedback.score >= 70 ? "passed" : ""}`}>
                  <div className="score-ring" style={{ "--score": `${dungeonFeedback.score * 3.6}deg` }}><span>{dungeonFeedback.score}</span></div>
                  <div>
                    <strong>{dungeonFeedback.score >= 70 ? "필요한 요소가 충분히 포함되었습니다." : "몇 가지 요소를 더 넣어보세요."}</strong>
                    <p>포함된 요소: {dungeonFeedback.matched.join(", ") || "없음"}</p>
                    {dungeonFeedback.missing.length ? <p>추가할 수 있는 요소: {dungeonFeedback.missing.join(", ")}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
