import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Empty, Progress } from "./UI";
import {
  VISION_MODEL_ID,
  VISION_MODEL_NAME,
  interruptVisionGeneration,
  loadVisionModel,
  streamVisionChat,
  unloadVisionModel,
} from "../lib/visionModel";
import { unloadLocalModel } from "../lib/localModel";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fileToDataUrl(file, maxSize = 1280) {
  const raw = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = raw;
  });
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export default function ImageLab({ setState }) {
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState({ state: "idle", progress: 0, text: "이미지 모델 대기" });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const hasImage = Boolean(imageUrl);

  useEffect(() => () => void unloadVisionModel(), []);

  async function chooseFile(nextFile) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      setError("JPG, PNG, WEBP 등 이미지 파일을 선택해주세요.");
      return;
    }
    if (nextFile.size > 15 * 1024 * 1024) {
      setError("이미지는 15MB 이하로 선택해주세요.");
      return;
    }
    setError("");
    setFile(nextFile);
    setImageUrl(await fileToDataUrl(nextFile));
    setMessages([]);
  }

  async function prepareVision() {
    if (status.state === "loading" || status.state === "ready") return;
    setError("");
    setStatus({ state: "loading", progress: 0, text: "기존 텍스트 모델을 정리하는 중" });
    try {
      await unloadLocalModel();
      await loadVisionModel((report) =>
        setStatus({ state: "loading", progress: report.progress, text: report.text }),
      );
      setStatus({ state: "ready", progress: 1, text: `${VISION_MODEL_NAME} 준비 완료` });
    } catch (caught) {
      setStatus({ state: "error", progress: 0, text: "이미지 모델 로드 실패" });
      setError(caught?.message || String(caught));
    }
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const prompt = input.trim();
    if (!prompt || generating) return;
    if (!hasImage) {
      setError("먼저 질문할 이미지를 첨부해주세요.");
      return;
    }
    if (status.state !== "ready") {
      setError("먼저 이미지 채팅 모델을 불러와주세요.");
      return;
    }

    const userId = uid("vision-user");
    const assistantId = uid("vision-assistant");
    const firstQuestion = messages.length === 0;
    const userVisible = { id: userId, role: "user", content: prompt };
    const history = messages.map(({ role, content }) => ({ role, content }));
    const apiUser = firstQuestion
      ? {
          role: "user",
          content: [
            { type: "text", text: `${prompt}\n한국어로 답하고, 이미지에서 직접 확인한 내용과 추측을 구분해줘.` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }
      : { role: "user", content: prompt };

    setInput("");
    setError("");
    setMessages((prev) => [...prev, userVisible, { id: assistantId, role: "assistant", content: "" }]);
    setGenerating(true);
    try {
      const result = await streamVisionChat({
        messages: [...history, apiUser],
        onToken: (text) =>
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m))),
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: result.text, meta: `${result.tokensPerSecond.toFixed(1)} tok/s` }
            : m,
        ),
      );
      setState((prev) => ({ ...prev, game: { ...prev.game, xp: prev.game.xp + 8 } }));
    } catch (caught) {
      setError(caught?.message || "이미지 답변 생성 중 오류가 발생했습니다.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setGenerating(false);
      inputRef.current?.focus();
    }
  }

  const subtitle = useMemo(
    () => (file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)}MB` : "이미지는 브라우저 안에서 처리됩니다."),
    [file],
  );

  return (
    <div className="page vision-chat-page">
      <div className="vision-chat-grid">
        <Card className="vision-image-card">
          <div className="section-heading">
            <div><span className="eyebrow">IMAGE INPUT</span><h3>질문할 이미지</h3></div>
            <Badge tone={hasImage ? "success" : "neutral"}>{hasImage ? "첨부됨" : "미첨부"}</Badge>
          </div>
          <label className="vision-chat-dropzone">
            <input type="file" accept="image/*" onChange={(e) => chooseFile(e.target.files?.[0])} />
            {imageUrl ? <img src={imageUrl} alt="질문할 이미지" /> : <div><strong>이미지를 클릭하거나 끌어놓으세요</strong><span>JPG · PNG · WEBP · 최대 15MB</span></div>}
          </label>
          <p className="vision-file-info">{subtitle}</p>
          <div className="vision-model-box">
            <div><span>이미지 채팅 모델</span><strong>{VISION_MODEL_NAME}</strong><small>{VISION_MODEL_ID}</small></div>
            {status.state === "loading" ? (
              <div className="vision-load-progress"><Progress value={status.progress * 100} /><small>{status.text}</small></div>
            ) : (
              <Button icon="cpu" onClick={prepareVision} disabled={status.state === "ready"}>
                {status.state === "ready" ? "이미지 모델 준비 완료" : "이미지 모델 불러오기"}
              </Button>
            )}
          </div>
          <div className="vision-note">이미지 모델을 불러올 때 GPU 메모리 충돌을 막기 위해 기존 Qwen 텍스트 모델은 자동으로 해제됩니다. 채팅 연구실로 돌아가면 Qwen을 다시 불러오면 됩니다.</div>
        </Card>

        <Card className="vision-conversation-card">
          <div className="chat-toolbar">
            <div><Badge tone={status.state === "ready" ? "success" : "neutral"}>{status.state === "ready" ? "VISION MODEL ONLINE" : "VISION MODEL OFFLINE"}</Badge><strong>이미지와 대화하기</strong></div>
            <button className="text-button" onClick={() => setMessages([])}>대화 지우기</button>
          </div>
          <div className="messages vision-messages">
            {messages.length === 0 ? <Empty title="이미지에 대해 자유롭게 질문하세요" description="예: 이 사진의 상황을 설명해줘 / 그래프의 핵심을 분석해줘 / 회로에서 잘못된 부분을 찾아줘" /> : messages.map((m) => (
              <article key={m.id} className={`message ${m.role}`}><div className="message-avatar">{m.role === "assistant" ? "VI" : "YOU"}</div><div className="message-body"><div className="message-header"><strong>{m.role === "assistant" ? VISION_MODEL_NAME : "사용자"}</strong>{m.meta ? <small>{m.meta}</small> : null}</div><div className="message-content">{m.content}</div></div></article>
            ))}
            {generating ? <div className="typing-indicator"><i /><i /><i /></div> : null}
          </div>
          {error ? <div className="inline-error">{error}</div> : null}
          <form className="composer" onSubmit={sendMessage}>
            <textarea ref={inputRef} rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="첨부한 이미지에 대해 질문하세요..." disabled={generating} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <div className="composer-footer"><span>첫 질문에는 이미지가 함께 전달되고 이후 질문은 같은 대화 문맥을 이어갑니다.</span>{generating ? <Button type="button" variant="danger" icon="stop" onClick={async () => { await interruptVisionGeneration(); setGenerating(false); }}>중지</Button> : <Button type="submit" icon="send" disabled={!input.trim() || !hasImage}>전송</Button>}</div>
          </form>
        </Card>
      </div>
    </div>
  );
}
