import React, { useState } from "react";
import { Badge, Button, Card, Empty } from "./UI";
import { buildPersonalizedSystem } from "../lib/personalization";
import { streamChat } from "../lib/localModel";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Arena({ state, setState, modelState, onLoadModel }) {
  const [prompt, setPrompt] = useState("인공지능의 환각 현상을 예시와 함께 설명해줘.");
  const [answers, setAnswers] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);

  const personalizedWins = state.arenaVotes.filter((vote) => vote.winner === "personalized").length;
  const baseWins = state.arenaVotes.filter((vote) => vote.winner === "base").length;

  async function runArena() {
    const question = prompt.trim();
    if (!question) return;
    if (modelState.status !== "ready") {
      setError("먼저 Qwen 모델을 불러와주세요.");
      return;
    }
    setError("");
    setAnswers({ A: { text: "", type: "" }, B: { text: "", type: "" } });
    setRevealed(false);
    setPhase("base");

    try {
      const baseResult = await streamChat({
        messages: [
          { role: "system", content: state.settings.systemPrompt },
          { role: "user", content: question },
        ],
        temperature: state.settings.temperature,
        topP: state.settings.topP,
        maxTokens: state.settings.maxTokens,
      });

      setPhase("personalized");
      const personalizedSystem = buildPersonalizedSystem(
        state.settings.systemPrompt,
        question,
        state.sftExamples,
        state.preferences,
      );
      const personalizedResult = await streamChat({
        messages: [
          { role: "system", content: personalizedSystem },
          { role: "user", content: question },
        ],
        temperature: state.settings.temperature,
        topP: state.settings.topP,
        maxTokens: state.settings.maxTokens,
      });

      const base = { text: baseResult.text, type: "base", meta: baseResult };
      const personalized = { text: personalizedResult.text, type: "personalized", meta: personalizedResult };
      const shuffled = Math.random() > 0.5 ? { A: base, B: personalized } : { A: personalized, B: base };
      setAnswers(shuffled);
      setPhase("vote");
    } catch (caught) {
      setError(caught?.message || "답변을 만들지 못했습니다.");
      setPhase("idle");
    }
  }

  function vote(label) {
    if (!answers || phase !== "vote") return;
    const winner = answers[label];
    const loser = answers[label === "A" ? "B" : "A"];
    const voteRecord = {
      id: uid("vote"),
      prompt: prompt.trim(),
      selectedLabel: label,
      winner: winner.type,
      createdAt: Date.now(),
    };
    setState((previous) => ({
      ...previous,
      arenaVotes: [...previous.arenaVotes, voteRecord],
      preferences: [
        ...previous.preferences,
        {
          id: uid("pref"),
          prompt: prompt.trim(),
          chosen: winner.text,
          rejected: loser.text,
          source: "arena",
          createdAt: Date.now(),
        },
      ],
      game: { ...previous.game, xp: previous.game.xp + 25 },
    }));
    setRevealed(true);
    setPhase("done");
  }

  return (
    <div className="page arena-page">
      <div className="arena-stats">
        <Card><span>비교 횟수</span><strong>{state.arenaVotes.length}</strong><p>저장된 선택 기록</p></Card>
        <Card><span>기본 응답 선택</span><strong>{baseWins}</strong><p>기본 시스템 프롬프트 사용</p></Card>
        <Card><span>개인화 응답 선택</span><strong>{personalizedWins}</strong><p>저장된 데이터 문맥 사용</p></Card>
        <Card><span>개인화 선택률</span><strong>{state.arenaVotes.length ? Math.round((personalizedWins / state.arenaVotes.length) * 100) : 0}%</strong><p>전체 선택 중 비율</p></Card>
      </div>

      <Card className="arena-control">
        <div>
          <span className="eyebrow">A / B 비교</span>
          <h3>같은 질문에 대한 두 답변을 비교합니다.</h3>
          <p>선택하기 전에는 어떤 답변이 개인화 문맥을 사용했는지 표시하지 않습니다.</p>
        </div>
        <div className="arena-prompt-row">
          <textarea rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={phase === "base" || phase === "personalized"} />
          <Button onClick={runArena} disabled={!prompt.trim() || phase === "base" || phase === "personalized"}>
            {phase === "base" ? "첫 번째 답변 생성 중" : phase === "personalized" ? "두 번째 답변 생성 중" : "두 답변 만들기"}
          </Button>
        </div>
        {error ? <div className="inline-error">{error}</div> : null}
        {modelState.status !== "ready" ? (
          <div className="offline-callout compact-callout">
            <p>답변 비교를 하려면 Qwen 모델을 먼저 불러와야 합니다.</p>
            <Button size="sm" icon="cpu" onClick={onLoadModel}>모델 불러오기</Button>
          </div>
        ) : null}
      </Card>

      {answers ? (
        <div className="answer-arena">
          {(["A", "B"]).map((label) => {
            const answer = answers[label];
            return (
              <Card key={label} className={`arena-answer ${revealed ? answer.type : "hidden-model"}`}>
                <div className="arena-answer-header">
                  <div className="answer-label">{label}</div>
                  <div>
                    <strong>{revealed ? (answer.type === "personalized" ? "개인화 응답" : "기본 응답") : `답변 ${label}`}</strong>
                    {answer.meta ? <span>{answer.meta.tokensPerSecond.toFixed(1)} tok/s · {answer.meta.elapsedSeconds.toFixed(1)}초</span> : null}
                  </div>
                  {revealed ? <Badge tone={answer.type === "personalized" ? "accent" : "neutral"}>{answer.type === "personalized" ? "개인화" : "기본"}</Badge> : null}
                </div>
                <div className="arena-answer-body">{answer.text || "답변을 만드는 중입니다..."}</div>
                {phase === "vote" ? (
                  <Button variant="secondary" className="full" onClick={() => vote(label)}>이 답변 선택</Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><Empty title="비교할 답변이 없습니다" description="질문을 입력한 뒤 두 답변 만들기를 눌러주세요." /></Card>
      )}

      {revealed ? (
        <Card className="arena-result-callout">
          <div>
            <Badge tone="success">선택 저장됨</Badge>
            <h3>선택한 답변과 선택하지 않은 답변을 선호 데이터로 저장했습니다.</h3>
            <p>같은 방식으로 여러 질문을 비교하면 개인화가 실제로 도움이 되는지 확인할 수 있습니다.</p>
          </div>
          <Button onClick={() => { setAnswers(null); setPhase("idle"); setRevealed(false); }}>새로 비교</Button>
        </Card>
      ) : null}
    </div>
  );
}
