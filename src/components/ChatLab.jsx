import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Icon, Modal } from "./UI";
import { buildPersonalizedSystem } from "../lib/personalization";
import { interruptGeneration, streamChat } from "../lib/localModel";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function removeCjkIdeographs(text) {
  return String(text ?? "")
    .replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trimStart();
}

function detectConversationInstruction(text, currentInstruction) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return currentInstruction;

  const resetRequested =
    /(평범한|일반적인|보통|기본|원래)\s*(말투|방식|스타일)|말투\s*(그만|중지|해제)|설정\s*(취소|해제)|원래대로/.test(value);
  if (resetRequested) return "";

  const looksLikeStyleRequest =
    /(말투|어조|문장\s*끝|답변\s*끝|존댓말|반말|형식|스타일|붙여서|붙여\s*줘)/.test(value) &&
    /(말해|답해|답변해|써|작성해|사용해|해줘|해\s*줘)/.test(value);
  const explicitlyTemporary =
    /(이번\s*대화|앞으로|이제부터|계속)/.test(value) &&
    /(말해|답해|답변해|써|작성해|사용해|해줘|해\s*줘)/.test(value);

  return looksLikeStyleRequest || explicitlyTemporary ? value : currentInstruction;
}

function buildCustomInstructionBlock(custom, conversationInstruction) {
  const lines = [
    "[사용자 맞춤 설정]",
    custom?.aboutUser ? `사용자 정보: ${custom.aboutUser}` : "사용자 정보: 별도 입력 없음",
    custom?.responsePreferences
      ? `평소 응답 선호: ${custom.responsePreferences}`
      : "평소 응답 선호: 자연스럽고 평범한 한국어 존댓말",
    custom?.avoid ? `피해야 할 표현과 행동: ${custom.avoid}` : "피해야 할 표현과 행동: 없음",
    "한자 및 중국어 문자를 답변에 섞지 않는다. 필요한 용어는 한글 또는 영어로 쓴다.",
  ];

  if (custom?.allowConversationStyleOverrides !== false && conversationInstruction) {
    lines.push(
      `현재 대화에서 사용자가 요청한 임시 응답 방식: ${conversationInstruction}`,
      "이 요청은 현재 대화에서만 유지한다. 사용자가 취소하거나 기본 방식으로 돌아가라고 하면 즉시 해제한다.",
    );
  } else {
    lines.push("현재 대화에 별도로 적용할 임시 응답 방식은 없다.");
  }
  return lines.join("\n");
}

export default function ChatLab({ state, setState, modelState, modelMeta, onLoadModel }) {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요. 이곳에서는 로컬 모델의 답변 방식과 개인 맞춤 설정을 실험할 수 있습니다. 모델을 불러온 뒤 질문을 입력해보세요.",
      meta: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [correction, setCorrection] = useState(null);
  const [conversationInstruction, setConversationInstruction] = useState("");
  const textareaRef = useRef(null);
  const messageEndRef = useRef(null);

  const settings = state.settings;
  const customInstructions = settings.customInstructions ?? {};

  const personalizedPreview = useMemo(() => {
    const detectedInstruction = detectConversationInstruction(input, conversationInstruction);
    const base = settings.personalization
      ? buildPersonalizedSystem(
          settings.systemPrompt,
          input || "일반 질문",
          state.sftExamples,
          state.preferences,
        )
      : settings.systemPrompt;
    return `${base}\n\n${buildCustomInstructionBlock(customInstructions, detectedInstruction)}`;
  }, [
    settings.systemPrompt,
    settings.personalization,
    customInstructions,
    input,
    conversationInstruction,
    state.sftExamples,
    state.preferences,
  ]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: generating ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, generating]);

  function updateSettings(patch) {
    setState((previous) => ({
      ...previous,
      settings: { ...previous.settings, ...patch },
    }));
  }

  function updateCustomInstructions(patch) {
    setState((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        customInstructions: {
          ...previous.settings.customInstructions,
          ...patch,
        },
      },
    }));
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || generating) return;
    if (modelState.status !== "ready") {
      setError("먼저 상단의 로컬 모델 불러오기를 눌러주세요.");
      return;
    }

    const nextInstruction =
      customInstructions.allowConversationStyleOverrides === false
        ? ""
        : detectConversationInstruction(prompt, conversationInstruction);
    setConversationInstruction(nextInstruction);
    setError("");
    setInput("");

    const userMessage = { id: uid("user"), role: "user", content: prompt };
    const assistantId = uid("assistant");
    const visibleHistory = messages.filter((item) => item.id !== "welcome");
    const baseSystem = settings.personalization
      ? buildPersonalizedSystem(
          settings.systemPrompt,
          prompt,
          state.sftExamples,
          state.preferences,
        )
      : settings.systemPrompt;
    const systemContent = `${baseSystem}\n\n${buildCustomInstructionBlock(
      customInstructions,
      nextInstruction,
    )}`;

    const apiMessages = [
      { role: "system", content: systemContent },
      ...visibleHistory.slice(-12).map(({ role, content }) => ({ role, content })),
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
          const displayed =
            customInstructions.blockCjkIdeographs === false
              ? fullText
              : removeCjkIdeographs(fullText);
          setMessages((previous) =>
            previous.map((item) =>
              item.id === assistantId ? { ...item, content: displayed } : item,
            ),
          );
        },
      });
      const finalText =
        customInstructions.blockCjkIdeographs === false
          ? result.text
          : removeCjkIdeographs(result.text);
      setMessages((previous) =>
        previous.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content: finalText,
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

  function clearConversation() {
    setConversationInstruction("");
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "대화가 초기화되었습니다. 현재 대화에만 적용되던 설정도 초기화되었습니다.",
      },
    ]);
  }

  function saveAsSft(messageId) {
    const index = messages.findIndex((message) => message.id === messageId);
    const assistant = messages[index];
    const user = [...messages.slice(0, index)]
      .reverse()
      .find((message) => message.role === "user");
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
    const user = [...messages.slice(0, index)]
      .reverse()
      .find((message) => message.role === "user");
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
              <span className={`personalization-label ${customInstructions.enabled ? "on" : ""}`}>
                맞춤 설정 {customInstructions.enabled ? "ON" : "OFF"}
              </span>
              {conversationInstruction ? (
                <span className="personalization-label on">대화별 설정 적용 중</span>
              ) : null}
              <button className="text-button" onClick={clearConversation}>대화 지우기</button>
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
            <div ref={messageEndRef} aria-hidden="true" />
          </div>

          {error ? <div className="inline-error">{error}</div> : null}
          {modelState.status !== "ready" ? (
            <div className="offline-callout">
              <div>
                <strong>브라우저 로컬 모델이 아직 준비되지 않았습니다.</strong>
                <p>최초 로딩은 모델 크기와 네트워크에 따라 오래 걸릴 수 있으며 자동으로 재시도합니다.</p>
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
              placeholder="AI에게 질문하거나 현재 대화에 적용할 답변 방식을 요청하세요..."
              rows={3}
              disabled={generating}
            />
            <div className="composer-footer">
              <span>Enter 전송 · Shift+Enter 줄바꿈 · 대화 중 요청은 현재 대화에만 적용</span>
              {generating ? (
                <Button type="button" variant="danger" icon="stop" onClick={stop}>중지</Button>
              ) : (
                <Button type="submit" icon="send" disabled={!input.trim()}>전송</Button>
              )}
            </div>
          </form>
        </Card>

        <aside className="settings-panel compact-settings-panel">
          <AccordionCard eyebrow="GENERATION" title="생성 파라미터" defaultOpen>
            <RangeField label="Temperature" value={settings.temperature} min={0.1} max={1.5} step={0.1} description="낮을수록 일관적, 높을수록 다양" onChange={(value) => updateSettings({ temperature: value })} />
            <RangeField label="Top-p" value={settings.topP} min={0.1} max={1} step={0.05} description="선택 후보 토큰의 누적 확률 범위" onChange={(value) => updateSettings({ topP: value })} />
            <RangeField label="최대 출력 토큰" value={settings.maxTokens} min={64} max={768} step={32} description="답변 최대 길이" onChange={(value) => updateSettings({ maxTokens: value })} />
          </AccordionCard>

          <AccordionCard eyebrow="CUSTOM INSTRUCTIONS" title="개인 맞춤 설정">
            <label className="switch-row">
              <div><strong>맞춤 설정 사용</strong><small>브라우저에 저장되어 다음 방문에도 유지</small></div>
              <input type="checkbox" checked={customInstructions.enabled !== false} onChange={(event) => updateCustomInstructions({ enabled: event.target.checked })} />
            </label>
            <label className="field">
              <span>AI가 알아야 할 사용자 정보</span>
              <textarea rows={4} value={customInstructions.aboutUser ?? ""} onChange={(event) => updateCustomInstructions({ aboutUser: event.target.value })} placeholder="관심 분야, 학년, 목표, 자주 하는 작업 등을 입력하세요." />
            </label>
            <label className="field">
              <span>평소 답변 방식</span>
              <textarea rows={4} value={customInstructions.responsePreferences ?? ""} onChange={(event) => updateCustomInstructions({ responsePreferences: event.target.value })} placeholder="예: 자연스러운 존댓말, 단계별 설명, 전체 코드 제공" />
            </label>
            <label className="field">
              <span>피해야 할 표현과 행동</span>
              <textarea rows={3} value={customInstructions.avoid ?? ""} onChange={(event) => updateCustomInstructions({ avoid: event.target.value })} placeholder="예: 한자 사용 금지, 불필요한 반복 금지" />
            </label>
            <label className="switch-row">
              <div><strong>대화별 답변 방식 허용</strong><small>대화 중 요청한 형식은 해당 대화에서만 적용</small></div>
              <input type="checkbox" checked={customInstructions.allowConversationStyleOverrides !== false} onChange={(event) => updateCustomInstructions({ allowConversationStyleOverrides: event.target.checked })} />
            </label>
            <label className="switch-row">
              <div><strong>한자·중국어 문자 차단</strong><small>생성 결과에서도 자동 제거</small></div>
              <input type="checkbox" checked={customInstructions.blockCjkIdeographs !== false} onChange={(event) => updateCustomInstructions({ blockCjkIdeographs: event.target.checked })} />
            </label>
          </AccordionCard>

          <AccordionCard eyebrow="SYSTEM" title="AI 역할 설정">
            <label className="field">
              <span>시스템 프롬프트</span>
              <textarea rows={6} value={settings.systemPrompt} onChange={(event) => updateSettings({ systemPrompt: event.target.value })} />
            </label>
            <label className="switch-row">
              <div><strong>데이터 기반 개인화</strong><small>관련 SFT 예시와 선호 기록을 문맥에 추가</small></div>
              <input type="checkbox" checked={settings.personalization} onChange={(event) => updateSettings({ personalization: event.target.checked })} />
            </label>
          </AccordionCard>

          <AccordionCard eyebrow="CONTEXT PREVIEW" title="실제 적용 문맥">
            <div className="prompt-preview-card-inline"><pre>{personalizedPreview}</pre></div>
          </AccordionCard>
        </aside>
      </div>

      {correction ? (
        <Modal title="더 좋은 답변으로 수정" onClose={() => setCorrection(null)}>
          <p className="modal-description">수정한 답변은 chosen, 기존 모델 답변은 rejected로 저장되어 선호 학습 데이터가 됩니다.</p>
          <textarea className="modal-textarea" rows={10} value={correction.text} onChange={(event) => setCorrection({ ...correction, text: event.target.value })} placeholder="정확하고 더 좋은 답변을 입력하세요." />
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setCorrection(null)}>취소</Button>
            <Button onClick={saveCorrection} disabled={!correction.text.trim()}>선호 데이터로 저장</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AccordionCard({ eyebrow, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={`settings-accordion ${open ? "open" : "closed"}`}>
      <button type="button" className="settings-accordion-trigger" onClick={() => setOpen((previous) => !previous)} aria-expanded={open}>
        <div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div>
        <span className="settings-accordion-chevron" aria-hidden="true">⌄</span>
      </button>
      {open ? <div className="settings-accordion-content">{children}</div> : null}
    </Card>
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
          {message.meta ? <span>{message.meta.seconds.toFixed(1)}초 · {message.meta.tokens} tokens · {message.meta.speed.toFixed(1)} tok/s</span> : null}
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
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small>{description}</small>
    </label>
  );
}
