import React, { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Empty, Icon, Modal } from "./UI";
import { buildPersonalizedSystem } from "../lib/personalization";
import { interruptGeneration, streamChat } from "../lib/localModel";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatLab({ state, setState, modelState, modelMeta, onLoadModel }) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요. 이곳에서는 시스템 프롬프트와 생성 설정을 바꾸며 로컬 모델의 행동을 실험할 수 있습니다. 모델을 불러온 뒤 질문을 입력해보세요.",
      meta: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [correction, setCorrection] = useState(null);
  const textareaRef = useRef(null);

  const settings = state.settings;
  const personalizedPreview = useMemo(
    () =>
      buildPersonalizedSystem(
        settings.systemPrompt,
        input || "일반 질문",
        state.sftExamples,
        state.preferences,
      ),
    [settings.systemPrompt, input, state.sftExamples, state.preferences],
  );

  function updateSettings(patch) {
    setState((previous) => ({
      ...previous,
      settings: { ...previous.settings, ...patch },
    }));
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || generating) return;
    if (modelState.status !== "ready") {
      setError("먼저 상단의 ‘로컬 모델 불러오기’를 눌러주세요.");
      return;
    }

    setError("");
    setInput("");
    const userMessage = { id: uid("user"), role: "user", content: prompt };
    const assistantId = uid("assistant");
    const visibleHistory = messages.filter((item) => item.id !== "welcome");
    const systemContent = settings.personalization
      ? buildPersonalizedSystem(
          settings.systemPrompt,
          prompt,
          state.sftExamples,
          state.preferences,
        )
      : settings.systemPrompt;

    const apiMessages = [
      { role: "system", content: systemContent },
      ...visibleHistory.slice(-8).map(({ role, content }) => ({ role, content })),
      { role: "user", content: prompt },
    ];

    setMessages((previous) => [
      ...previous,
      userMessage,
      { id: assistantId, role: "assistant", content: "", meta: null },
    ]);
    setGenerating(true);

    try {
      const result = await streamChat({
        messages: apiMessages,
        temperature: settings.temperature,
        topP: settings.topP,
        maxTokens: settings.maxTokens,
        onToken: (fullText) => {
          setMessages((previous) =>
            previous.map((item) =>
              item.id === assistantId ? { ...item, content: fullText } : item,
            ),
          );
        },
      });
      setMessages((previous) =>
        previous.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: result.text,
                meta: {
                  seconds: result.elapsedSeconds,
                  tokens: result.completionTokens,
                  speed: result.tokensPerSecond,
                  personalized: settings.personalization,
                },
              }
            : item,
        ),
      );
      setState((previous) => ({
        ...previous,
        game: { ...previous.game, xp: previous.game.xp + 5 },
      }));
    } catch (caught) {
      setError(caught?.message || "답변 생성 중 오류가 발생했습니다.");
      setMessages((previous) => previous.filter((item) => item.id !== assistantId));
    } finally {
      setGenerating(false);
      textareaRef.current?.focus();
    }
  }

  async function stop() {
    await interruptGeneration();
    setGenerating(false);
  }

  function saveAsSft(messageId) {
    const index = messages.findIndex((message) => message.id === messageId);
    const assistant = messages[index];
    const user = [...messages.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!assistant || !user) return;
    setState((previous) => ({
      ...previous,
      sftExamples: [
        ...previous.sftExamples,
        {
          id: uid("sft"),
          instruction: user.content,
          output: assistant.content,
          system: previous.settings.systemPrompt,
          tags: ["채팅저장"],
          createdAt: Date.now(),
        },
      ],
      game: { ...previous.game, xp: previous.game.xp + 10 },
    }));
  }

  function saveCorrection() {
    const index = messages.findIndex((message) => message.id === correction.messageId);
    const rejected = messages[index];
    const user = [...messages.slice(0, index)].reverse().find((message) => message.role === "user");
    const chosen = correction.text.trim();
    if (!chosen || !rejected || !user) return;
    setState((previous) => ({
      ...previous,
      preferences: [
        ...previous.preferences,
        {
          id: uid("pref"),
          prompt: user.content,
          chosen,
          rejected: rejected.content,
          createdAt: Date.now(),
          source: "correction",
        },
      ],
      game: { ...previous.game, xp: previous.game.xp + 15 },
    }));
    setCorrection(null);
  }

  return (
    <div className="page chat-page">
      <div className="chat-layout">
        <Card className="chat-card">
          <div className="chat-toolbar">
            <div>
              <Badge tone={modelState.status === "ready" ? "success" : "neutral"}>
                {modelState.status === "ready" ? "LOCAL MODEL ONLINE" : "MODEL OFFLINE"}
              </Badge>
              <strong>{modelMeta.displayName}</strong>
            </div>
            <div className="toolbar-actions">
              <span className={`personalization-label ${settings.personalization ? "on" : ""}`}>
                개인화 {settings.personalization ? "ON" : "OFF"}
              </span>
              <button
                className="text-button"
                onClick={() =>
                  setMessages([
                    {
                      id: "welcome",
                      role: "assistant",
                      content: "대화가 초기화되었습니다. 새로운 실험을 시작해보세요.",
                    },
                  ])
                }
              >
                대화 지우기
              </button>
            </div>
          </div>

          <div className="messages">
            {messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                modelName={modelMeta.displayName}
                onSave={() => saveAsSft(message.id)}
                onCorrect={() => setCorrection({ messageId: message.id, text: "" })}
              />
            ))}
            {generating ? <div className="typing-indicator"><i /><i /><i /></div> : null}
          </div>

          {error ? <div className="inline-error">{error}</div> : null}
          {modelState.status !== "ready" ? (
            <div className="offline-callout">
              <div>
                <strong>브라우저 로컬 모델이 아직 준비되지 않았습니다.</strong>
                <p>최초 1회 모델 파일을 내려받은 뒤에는 브라우저 캐시에서 빠르게 실행됩니다.</p>
              </div>
              <Button size="sm" icon="cpu" onClick={onLoadModel}>모델 불러오기</Button>
            </div>
          ) : null}

          <form className="composer" onSubmit={sendMessage}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="AI에게 질문하거나 실험할 프롬프트를 입력하세요..."
              rows={3}
              disabled={generating}
            />
            <div className="composer-footer">
              <span>Enter 전송 · Shift+Enter 줄바꿈</span>
              {generating ? (
                <Button type="button" variant="danger" icon="stop" onClick={stop}>중지</Button>
              ) : (
                <Button type="submit" icon="send" disabled={!input.trim()}>전송</Button>
              )}
            </div>
          </form>
        </Card>

        <aside className="settings-panel">
          <Card>
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">SYSTEM</span>
                <h3>AI 역할 설정</h3>
              </div>
            </div>
            <label className="field">
              <span>시스템 프롬프트</span>
              <textarea
                rows={7}
                value={settings.systemPrompt}
                onChange={(event) => updateSettings({ systemPrompt: event.target.value })}
              />
            </label>
            <label className="switch-row">
              <div><strong>데이터 기반 개인화</strong><small>관련 SFT 예시와 선호 기록을 문맥에 추가</small></div>
              <input
                type="checkbox"
                checked={settings.personalization}
                onChange={(event) => updateSettings({ personalization: event.target.checked })}
              />
            </label>
          </Card>

          <Card>
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">GENERATION</span>
                <h3>생성 파라미터</h3>
              </div>
            </div>
            <RangeField
              label="Temperature"
              value={settings.temperature}
              min={0.1}
              max={1.5}
              step={0.1}
              description="낮을수록 일관적, 높을수록 다양"
              onChange={(value) => updateSettings({ temperature: value })}
            />
            <RangeField
              label="Top-p"
              value={settings.topP}
              min={0.1}
              max={1}
              step={0.05}
              description="선택 후보 토큰의 누적 확률 범위"
              onChange={(value) => updateSettings({ topP: value })}
            />
            <RangeField
              label="최대 출력 토큰"
              value={settings.maxTokens}
              min={64}
              max={768}
              step={32}
              description="답변 최대 길이"
              onChange={(value) => updateSettings({ maxTokens: value })}
            />
          </Card>

          <Card className="prompt-preview-card">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">CONTEXT PREVIEW</span>
                <h3>개인화 문맥 미리보기</h3>
              </div>
            </div>
            <pre>{settings.personalization ? personalizedPreview : settings.systemPrompt}</pre>
          </Card>
        </aside>
      </div>

      {correction ? (
        <Modal title="더 좋은 답변으로 수정" onClose={() => setCorrection(null)}>
          <p className="modal-description">
            수정한 답변은 chosen, 기존 모델 답변은 rejected로 저장되어 선호 학습 데이터가 됩니다.
          </p>
          <textarea
            className="modal-textarea"
            rows={10}
            value={correction.text}
            onChange={(event) => setCorrection({ ...correction, text: event.target.value })}
            placeholder="정확하고 더 좋은 답변을 입력하세요."
          />
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setCorrection(null)}>취소</Button>
            <Button onClick={saveCorrection} disabled={!correction.text.trim()}>선호 데이터로 저장</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Message({ message, modelName, onSave, onCorrect }) {
  const isAssistant = message.role === "assistant";
  return (
    <article className={`message ${message.role}`}>
      <div className="message-avatar">{isAssistant ? "AI" : "YOU"}</div>
      <div className="message-body">
        <div className="message-header">
          <strong>{isAssistant ? modelName : "사용자"}</strong>
          {message.meta ? (
            <span>
              {message.meta.seconds.toFixed(1)}초 · {message.meta.tokens} tokens · {message.meta.speed.toFixed(1)} tok/s
            </span>
          ) : null}
        </div>
        <div className="message-content">{message.content || "생성 중..."}</div>
        {isAssistant && message.id !== "welcome" && message.content ? (
          <div className="message-actions">
            <button onClick={onSave}><Icon name="data" size={15} /> SFT 예시 저장</button>
            <button onClick={onCorrect}><Icon name="edit" size={15} /> 답변 수정</button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RangeField({ label, value, min, max, step, description, onChange }) {
  return (
    <label className="range-field">
      <div><span>{label}</span><strong>{value}</strong></div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>{description}</small>
    </label>
  );
}
