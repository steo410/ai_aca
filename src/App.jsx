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

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

  function markTextModelUnloaded(text = "이미지 모델 사용을 위해 Qwen이 해제되었습니다.") {
    setModelState({ status: "idle", progress: 0, text, error: "", loadedModelId: "" });
  }

  async function handleLoadModel() {
    if (modelState.status === "loading") return;
    if (modelState.status === "ready" && modelState.loadedModelId === modelSelection.modelId) return;

    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      setModelState({
        status: "loading",
        progress: 0,
        text:
          attempt === 1
            ? `${modelMeta.displayName} · 최초 로딩을 준비하는 중입니다. 잠시 기다려주세요.`
            : `${modelMeta.displayName} · 자동 재시도 ${attempt}/${maxAttempts}`,
        error: "",
        loadedModelId: "",
      });

      try {
        await loadLocalModel(modelSelection, (progress) => {
          const percent = Math.max(0, Math.min(100, Math.round((progress.progress || 0) * 100)));
          setModelState({
            status: "loading",
            progress: progress.progress,
            text: `${progress.text || "모델을 준비하는 중입니다."} · ${percent}% · 창을 닫지 말고 기다려주세요.`,
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
        return;
      } catch (error) {
        lastError = error;
        await unloadLocalModel();
        if (attempt < maxAttempts) {
          setModelState({
            status: "loading",
            progress: 0,
            text: `연결이 잠시 끊겼습니다. ${4 * attempt}초 후 자동으로 다시 불러옵니다.`,
            error: "",
            loadedModelId: "",
          });
          await wait(4000 * attempt);
        }
      }
    }

    setModelState({
      status: "error",
      progress: 0,
      text: "자동 재시도 후에도 모델을 불러오지 못했습니다.",
      error: lastError?.message || String(lastError || "알 수 없는 모델 로딩 오류"),
      loadedModelId: "",
    });
  }

  async function handleModelChange(nextSelection) {
    await unloadLocalModel();
    setState((previous) => ({
      ...previous,
      settings: { ...previous.settings, modelSelection: normalizeModelSelection(nextSelection) },
    }));
    setModelState({ status: "idle", progress: 0, text: "새 모델을 불러와주세요.", error: "", loadedModelId: "" });
  }

  let page = null;
  const commonProps = { state, setState, modelState, modelSelection, modelMeta, onLoadModel: handleLoadModel };

  switch (activePage) {
    case "chat":
      page = <ChatLab {...commonProps} />;
      break;
    case "vision":
      page = <ImageLab setState={setState} onTextModelUnloaded={markTextModelUnloaded} />;
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
      page = <Dashboard state={state} modelState={modelState} modelMeta={modelMeta} onNavigate={setActivePage} onLoadModel={handleLoadModel} />;
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onChange={setActivePage} modelState={modelState} modelMeta={modelMeta} xp={state.game.xp} />
      <main className="main-shell">
        <Topbar
          activePage={activePage}
          modelState={modelState}
          modelSelection={modelSelection}
          modelMeta={modelMeta}
          onLoadModel={handleLoadModel}
          onModelChange={handleModelChange}
        />
        {modelState.error ? <div className="global-error"><strong>모델 로드 오류</strong><span>{modelState.error}</span></div> : null}
        {page}
      </main>
    </div>
  );
}
