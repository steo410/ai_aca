import React from "react";
import { Icon } from "./UI";

const pages = [
  ["dashboard", "홈", "home"],
  ["chat", "채팅", "chat"],
  ["vision", "이미지 질문", "spark"],
  ["dataset", "학습 데이터", "data"],
  ["games", "개념 연습", "game"],
  ["arena", "답변 비교", "arena"],
  ["training", "LoRA 학습", "train"],
];

export default function Sidebar({ activePage, onChange, modelState, modelMeta, xp }) {
  const visionPage = activePage === "vision";
  return (
    <aside className="sidebar">
      <div className="brand">
        <div><strong>Local AI</strong><span>TOOLS</span></div>
      </div>
      <nav className="nav-list">
        {pages.map(([id, label, icon]) => (
          <button key={id} className={`nav-item ${activePage === id ? "active" : ""}`} onClick={() => onChange(id)}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="mini-stat"><span>활동 점수</span><strong>{xp.toLocaleString()} XP</strong></div>
        <div className={`model-pill ${visionPage ? "idle" : modelState.status}`} title={visionPage ? "Phi-3.5-vision-instruct-q4f16_1-MLC" : modelMeta.modelId}>
          <span className="status-dot" />
          <div>
            <strong>{visionPage ? "이미지 모델" : modelState.status === "ready" ? "Qwen 준비됨" : modelState.status === "loading" ? "모델 불러오는 중" : modelState.status === "error" ? "모델 오류" : "모델 대기"}</strong>
            <small>{visionPage ? "Phi-3.5 Vision" : `${modelMeta.displayName} · ${modelMeta.tier}`}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
