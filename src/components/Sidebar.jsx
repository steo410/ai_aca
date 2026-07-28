import React from "react";
import { Icon } from "./UI";

const pages = [
  ["dashboard", "홈", "home"],
  ["chat", "Qwen 채팅", "chat"],
  ["vision", "이미지 채팅", "spark"],
  ["dataset", "데이터 공장", "data"],
  ["games", "AI 게임", "game"],
  ["arena", "모델 경기장", "arena"],
  ["training", "학습 연구실", "train"],
];

export default function Sidebar({ activePage, onChange, modelState, modelMeta, xp }) {
  const visionPage = activePage === "vision";
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">LA</div>
        <div><strong>Local AI</strong><span>ACADEMY</span></div>
      </div>
      <nav className="nav-list">
        {pages.map(([id, label, icon]) => (
          <button key={id} className={`nav-item ${activePage === id ? "active" : ""}`} onClick={() => onChange(id)}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="mini-stat"><span>연구 경험치</span><strong>{xp.toLocaleString()} XP</strong></div>
        <div className={`model-pill ${visionPage ? "idle" : modelState.status}`} title={visionPage ? "Phi-3.5-vision-instruct-q4f16_1-MLC" : modelMeta.modelId}>
          <span className="status-dot" />
          <div>
            <strong>{visionPage ? "이미지 채팅 모드" : modelState.status === "ready" ? "로컬 모델 준비됨" : modelState.status === "loading" ? "모델 불러오는 중" : modelState.status === "error" ? "모델 오류" : "모델 대기"}</strong>
            <small>{visionPage ? "Phi-3.5 Vision · 멀티모달" : `${modelMeta.displayName} · ${modelMeta.tier}`}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
