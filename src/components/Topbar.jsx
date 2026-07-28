import React, { useState } from "react";
import { Badge, Button, Progress } from "./UI";
import ModelManager from "./ModelManager";
import { isWebGpuAvailable } from "../lib/localModel";

const pageTitles = {
  dashboard: ["AI 연구 대시보드", "직접 실험하며 언어 모델의 원리를 익혀보세요."],
  chat: ["채팅 연구실", "생성 설정과 시스템 프롬프트가 답변을 어떻게 바꾸는지 확인합니다."],
  vision: ["이미지 인식 연구실", "사진을 브라우저에서 직접 분류하고 AI의 확률 판단을 분석합니다."],
  dataset: ["데이터 공장", "좋은 질문과 답변, 선호 쌍을 만들어 학습 데이터를 축적합니다."],
  games: ["AI 게임 센터", "토큰·환각·프롬프트 개념을 게임으로 학습합니다."],
  arena: ["모델 경기장", "기본 모델과 개인화 모델을 블라인드 방식으로 비교합니다."],
  training: ["학습 연구실", "브라우저 개인화와 실제 LoRA 학습을 준비하고 평가합니다."],
};

export default function Topbar({
  activePage,
  modelState,
  modelSelection,
  modelMeta,
  onLoadModel,
  onModelChange,
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [title, subtitle] = pageTitles[activePage] ?? pageTitles.dashboard;
  const webGpu = isWebGpuAvailable();

  async function saveModel(nextSelection) {
    await onModelChange(nextSelection);
    setManagerOpen(false);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">LOCAL-FIRST AI LEARNING</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="topbar-actions">
          <Badge tone={webGpu ? "success" : "danger"}>
            {webGpu ? "WebGPU 사용 가능" : "WebGPU 미지원"}
          </Badge>
          <button
            type="button"
            className="model-select-button"
            onClick={() => setManagerOpen(true)}
            disabled={modelState.status === "loading"}
            title={modelMeta.modelId}
          >
            <span>사용 모델</span>
            <strong>{modelMeta.displayName}</strong>
            <small>{modelMeta.tier}</small>
          </button>
          {modelState.status === "loading" ? (
            <div className="load-progress">
              <Progress value={modelState.progress * 100} />
              <small>{modelState.text}</small>
            </div>
          ) : (
            <Button
              variant={modelState.status === "ready" ? "secondary" : "primary"}
              icon="cpu"
              onClick={onLoadModel}
              disabled={modelState.status === "ready" || !webGpu}
              title={modelMeta.modelId}
            >
              {modelState.status === "ready" ? "모델 준비 완료" : "선택 모델 불러오기"}
            </Button>
          )}
        </div>
      </header>

      {managerOpen ? (
        <ModelManager
          selection={modelSelection}
          modelState={modelState}
          onSave={saveModel}
          onClose={() => setManagerOpen(false)}
        />
      ) : null}
    </>
  );
}
