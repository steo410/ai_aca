import React, { useState } from "react";
import { Badge, Button, Progress } from "./UI";
import ModelManager from "./ModelManager";
import { isWebGpuAvailable } from "../lib/localModel";

const pageTitles = {
  dashboard: ["Local AI", "브라우저에서 Qwen을 실행하고, 데이터를 만들고, 결과를 비교할 수 있습니다."],
  chat: ["채팅", "선택한 Qwen 모델로 대화합니다. 최신 정보가 필요한 질문은 자동으로 웹 검색을 사용합니다."],
  vision: ["이미지 질문", "이미지를 올리고 내용, 장면, 그래프 등에 대해 질문할 수 있습니다."],
  dataset: ["학습 데이터", "SFT 예시와 선호 데이터를 직접 만들고 관리합니다."],
  games: ["개념 연습", "토큰 예측, 사실 검증, 프롬프트 작성 방식을 간단한 문제로 확인합니다."],
  arena: ["답변 비교", "같은 질문에 대한 기본 응답과 개인화 응답을 나란히 비교합니다."],
  training: ["LoRA 학습", "웹에서 만든 데이터를 내보내 로컬 GPU에서 LoRA 학습을 진행합니다."],
};

export default function Topbar({ activePage, modelState, modelSelection, modelMeta, onLoadModel, onModelChange }) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [title, subtitle] = pageTitles[activePage] ?? pageTitles.dashboard;
  const webGpu = isWebGpuAvailable();
  const visionPage = activePage === "vision";

  async function saveModel(nextSelection) {
    await onModelChange(nextSelection);
    setManagerOpen(false);
  }

  return (
    <>
      <header className="topbar">
        <div><div className="eyebrow">LOCAL AI</div><h1>{title}</h1><p>{subtitle}</p></div>
        <div className="topbar-actions">
          <Badge tone={webGpu ? "success" : "danger"}>{webGpu ? "WebGPU 사용 가능" : "WebGPU 미지원"}</Badge>
          {visionPage ? (
            <div className="model-select-button"><span>이미지 모델</span><strong>Phi-3.5 Vision</strong><small>이미지 질문 화면에서 로드</small></div>
          ) : (
            <>
              <button type="button" className="model-select-button" onClick={() => setManagerOpen(true)} disabled={modelState.status === "loading"} title={modelMeta.modelId}>
                <span>사용 모델</span><strong>{modelMeta.displayName}</strong><small>{modelMeta.tier}</small>
              </button>
              {modelState.status === "loading" ? (
                <div className="load-progress"><Progress value={modelState.progress * 100} /><small>{modelState.text}</small></div>
              ) : (
                <Button variant={modelState.status === "ready" ? "secondary" : "primary"} icon="cpu" onClick={onLoadModel} disabled={modelState.status === "ready" || !webGpu} title={modelMeta.modelId}>
                  {modelState.status === "ready" ? "모델 준비 완료" : "모델 불러오기"}
                </Button>
              )}
            </>
          )}
        </div>
      </header>
      {managerOpen ? <ModelManager selection={modelSelection} modelState={modelState} onSave={saveModel} onClose={() => setManagerOpen(false)} /> : null}
    </>
  );
}
