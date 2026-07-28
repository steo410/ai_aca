import React from "react";
import { Icon } from "./UI";

const pages = [
  ["dashboard", "홈", "home"],
  ["chat", "채팅 연구실", "chat"],
  ["dataset", "데이터 공장", "data"],
  ["games", "AI 게임", "game"],
  ["arena", "모델 경기장", "arena"],
  ["training", "학습 연구실", "train"],
];

export default function Sidebar({ activePage, onChange, modelState, modelMeta, xp }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">LA</div>
        <div>
          <strong>Local AI</strong>
          <span>ACADEMY</span>
        </div>
      </div>

      <nav className="nav-list">
        {pages.map(([id, label, icon]) => (
          <button
            key={id}
            className={`nav-item ${activePage === id ? "active" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="mini-stat">
          <span>연구 경험치</span>
          <strong>{xp.toLocaleString()} XP</strong>
        </div>
        <div className={`model-pill ${modelState.status}`} title={modelMeta.modelId}>
          <span className="status-dot" />
          <div>
            <strong>
              {modelState.status === "ready"
                ? "로컬 모델 준비됨"
                : modelState.status === "loading"
                  ? "모델 불러오는 중"
                  : modelState.status === "error"
                    ? "모델 오류"
                    : "모델 대기"}
            </strong>
            <small>{modelMeta.displayName} · {modelMeta.tier}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
