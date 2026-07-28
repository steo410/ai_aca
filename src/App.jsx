import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./components/Dashboard";
import ChatLab from "./components/ChatLab";
import DatasetLab from "./components/DatasetLab";
import Games from "./components/Games";
import Arena from "./components/Arena";
import TrainingLab from "./components/TrainingLab";
import ImageLab from "./components/ImageLab";
import { loadLocalModel, unloadLocalModel } from "./lib/localModel";
import { getModelMeta, normalizeModelSelection } from "./lib/models";
import { loadState, saveState } from "./lib/storage";

export default function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [state, setState] = useState(() => loadState());
  const [modelState, setModelState] = useState({
    status: "idle",
    progress: 0,
    text: "모델 대기",
    error: "",
    loadedModelId: "",
  });

  const modelSelection = normalizeModelSelection(state.settings.modelSelection);
  const modelMeta = getModelMeta(modelSelection);

  useEffect(() => {
    saveState(state);
  }, [state]);

  async function handleLoadModel() {
    if (modelState.status === "loading") return;
    if (modelState.status === "ready" && modelState.loadedModelId === modelSelection.modelId) return;
    setModelState({
      status: "loading",
      progress: 0,
      text: `${modelMeta.displayName} · WebGPU 확인 중`,
      error: "",
      loadedModelId: "",
    });
    try {
      await loadLocalModel(modelSelection, (progress) => {
        setModelState({
          status: "loading",
          progress: progress.progress,
          text: progress.text,
          error: "",
          loadedModelId: "",
        });
      });
      setModelState({
        status: "ready",
        progress: 1,
        text: `${modelMeta.displayName} 준비 완료`,
        error: "",
        loadedModelId: modelSelection.modelId,
      });
    } catch (error) {
      setModelState({
        status: "error",
        progress: 0,
        text: "모델을 불러오지 못했습니다.",
        error: error?.message || String(error),
        loadedModelId: "",
      });
    }
  }

  async function handleModelChange(nextSelection) {
    await unloadLocalModel();
    setState((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        modelSelection: normalizeModelSelection(nextSelection),
      },
    }));
    setModelState({
      status: "idle",
      progress: 0,
      text: "새 모델을 불러와주세요.",
      error: "",
      loadedModelId: "",
    });
  }

  let page = null;
  const commonProps = {
    state,
    setState,
    modelState,
    modelSelection,
    modelMeta,
    onLoadModel: handleLoadModel,
  };

  switch (activePage) {
    case "chat":
      page = <ChatLab {...commonProps} />;
      break;
    case "vision":
      page = <ImageLab {...commonProps} />;
      break;
    case "dataset":
      page = <DatasetLab state={state} setState={setState} />;
      break;
    case "games":
      page = <Games state={state} setState={setState} />;
      break;
    case "arena":
      page = <Arena {...commonProps} />;
      break;
    case "training":
      page = <TrainingLab {...commonProps} />;
      break;
    default:
      page = (
        <Dashboard
          state={state}
          modelState={modelState}
          modelMeta={modelMeta}
          onNavigate={setActivePage}
          onLoadModel={handleLoadModel}
        />
      );
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onChange={setActivePage}
        modelState={modelState}
        modelMeta={modelMeta}
        xp={state.game.xp}
      />
      <main className="main-shell">
        <Topbar
          activePage={activePage}
          modelState={modelState}
          modelSelection={modelSelection}
          modelMeta={modelMeta}
          onLoadModel={handleLoadModel}
          onModelChange={handleModelChange}
        />
        {modelState.error ? (
          <div className="global-error">
            <strong>모델 로드 오류</strong>
            <span>{modelState.error}</span>
          </div>
        ) : null}
        {page}
      </main>
    </div>
  );
}
