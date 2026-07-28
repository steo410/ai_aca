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
  const hallucinationMission =
    hallucinationMissions[state.game.hallucinationIndex % hallucinationMissions.length];
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
      game: {
        ...previous.game,
        tokenIndex: (previous.game.tokenIndex + 1) % tokenMissions.length,
      },
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
        hallucinationIndex:
          (previous.game.hallucinationIndex + 1) % hallucinationMissions.length,
      },
    }));
  }

  function gradeDungeon() {
    const normalized = dungeonPrompt.toLowerCase();
    const matched = dungeon.keywords.filter((keyword) =>
      normalized.includes(keyword.toLowerCase()),
    );
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
          <span>현재 경험치</span>
          <strong>{state.game.xp.toLocaleString()} XP</strong>
          <Progress value={state.game.xp % 100} label={`다음 레벨까지 ${100 - (state.game.xp % 100)} XP`} />
        </Card>
        <Card>
          <span>프롬프트 던전</span>
          <strong>{Object.keys(state.game.dungeonScores ?? {}).length}/3 완료</strong>
          <p>각 던전에서 70점 이상을 달성해보세요.</p>
        </Card>
        <Card>
          <span>학습 핵심</span>
          <strong>예측 · 검증 · 지시</strong>
          <p>언어 모델을 안전하고 정확하게 사용하는 세 가지 습관입니다.</p>
        </Card>
      </div>

      <Card className="game-center-card">
        <div className="tabs game-tabs">
          <button className={tab === "token" ? "active" : ""} onClick={() => setTab("token")}>다음 토큰 연구소</button>
          <button className={tab === "hallucination" ? "active" : ""} onClick={() => setTab("hallucination")}>환각 탐정</button>
          <button className={tab === "dungeon" ? "active" : ""} onClick={() => setTab("dungeon")}>프롬프트 던전</button>
        </div>

        {tab === "token" ? (
          <div className="game-stage token-stage">
            <div className="game-stage-header">
              <Badge tone="accent">MISSION {state.game.tokenIndex + 1}</Badge>
              <span>언어 모델의 다음 토큰 예측을 단순화한 문제입니다.</span>
            </div>
            <div className="token-sentence">{tokenMission.sentence}</div>
            <div className="option-grid">
              {tokenMission.options.map((option) => {
                let className = "game-option";
                if (tokenResult) {
                  if (option === tokenMission.answer) className += " correct";
                  else if (option === tokenResult.option) className += " wrong";
                }
                return (
                  <button key={option} className={className} onClick={() => answerToken(option)}>
                    {option}
                  </button>
                );
              })}
            </div>
            {tokenResult ? (
              <div className={`game-feedback ${tokenResult.correct ? "success" : "failure"}`}>
                <strong>{tokenResult.correct ? "정답입니다! +20 XP" : `정답은 ‘${tokenMission.answer}’입니다.`}</strong>
                <p>{tokenMission.explanation}</p>
                <Button onClick={nextToken}>다음 문제</Button>
              </div>
            ) : (
              <div className="concept-strip">
                <div><span>낮은 온도</span><strong>높은 확률 후보 집중</strong></div>
                <div className="concept-arrow">→</div>
                <div><span>높은 온도</span><strong>후보 확률이 평탄해짐</strong></div>
              </div>
            )}
          </div>
        ) : null}

        {tab === "hallucination" ? (
          <div className="game-stage hallucination-stage">
            <div className="game-stage-header">
              <Badge tone="warning">FACT CHECK</Badge>
              <span>아래 주장이 AI에 관한 사실인지 판단하세요.</span>
            </div>
            <blockquote>{hallucinationMission.claim}</blockquote>
            <div className="truth-buttons">
              <button className={hallucinationResult?.answer === true ? "selected" : ""} onClick={() => answerHallucination(true)}>
                <span>O</span><strong>사실이다</strong>
              </button>
              <button className={hallucinationResult?.answer === false ? "selected" : ""} onClick={() => answerHallucination(false)}>
                <span>X</span><strong>사실이 아니다</strong>
              </button>
            </div>
            {hallucinationResult ? (
              <div className={`game-feedback ${hallucinationResult.correct ? "success" : "failure"}`}>
                <strong>{hallucinationResult.correct ? "판단이 정확합니다! +20 XP" : "다시 검증해볼 필요가 있습니다."}</strong>
                <p>{hallucinationMission.explanation}</p>
                <Button onClick={nextHallucination}>다음 주장</Button>
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
                  <button
                    key={mission.id}
                    className={selectedDungeon === mission.id ? "active" : ""}
                    onClick={() => {
                      setSelectedDungeon(mission.id);
                      setDungeonPrompt("");
                      setDungeonFeedback(null);
                    }}
                  >
                    <span>{score >= 70 ? "✓" : "◇"}</span>
                    <div><strong>{mission.title}</strong><small>최고 {score}점</small></div>
                  </button>
                );
              })}
            </aside>
            <div className="dungeon-stage">
              <Badge tone="accent">PROMPT QUEST</Badge>
              <h3>{dungeon.title}</h3>
              <p className="dungeon-story">{dungeon.story}</p>
              <div className="mission-goal"><span>성공 조건</span><strong>{dungeon.goal}</strong></div>
              <label className="field">
                <span>AI에게 보낼 프롬프트</span>
                <textarea
                  rows={10}
                  value={dungeonPrompt}
                  onChange={(event) => setDungeonPrompt(event.target.value)}
                  placeholder="역할, 수행할 작업, 출력 형식, 제한 조건을 포함해 작성하세요."
                />
              </label>
              <div className="dungeon-actions">
                <p>힌트: {dungeon.hint}</p>
                <Button onClick={gradeDungeon} disabled={!dungeonPrompt.trim()}>프롬프트 분석</Button>
              </div>
              {dungeonFeedback ? (
                <div className={`dungeon-score ${dungeonFeedback.score >= 70 ? "passed" : ""}`}>
                  <div className="score-ring" style={{ "--score": `${dungeonFeedback.score * 3.6}deg` }}><span>{dungeonFeedback.score}</span></div>
                  <div>
                    <strong>{dungeonFeedback.score >= 70 ? "던전 통과!" : "조건을 더 구체화하세요."}</strong>
                    <p>포함한 핵심 요소: {dungeonFeedback.matched.join(", ") || "없음"}</p>
                    {dungeonFeedback.missing.length ? <p>추가하면 좋은 요소: {dungeonFeedback.missing.join(", ")}</p> : null}
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
