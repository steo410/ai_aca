import React, { useMemo, useState } from "react";
import { Badge, Button, Modal } from "./UI";
import {
  MODEL_PRESETS,
  getModelMeta,
  getPrebuiltModelIds,
  normalizeModelSelection,
  validateModelSelection,
} from "../lib/models";

function mbToText(value) {
  if (!value) return "모델별 상이";
  if (value >= 1024) return `약 ${(value / 1024).toFixed(1)}GB`;
  return `약 ${value}MB`;
}

export default function ModelManager({ selection, modelState, onSave, onClose }) {
  const initial = normalizeModelSelection(selection);
  const [draft, setDraft] = useState(initial);
  const [customSearch, setCustomSearch] = useState(initial.mode === "custom" ? initial.modelId : "");
  const [error, setError] = useState("");
  const allIds = useMemo(() => getPrebuiltModelIds(), []);
  const filteredIds = useMemo(() => {
    const query = customSearch.trim().toLowerCase();
    if (!query) return allIds.slice(0, 80);
    return allIds.filter((id) => id.toLowerCase().includes(query)).slice(0, 80);
  }, [allIds, customSearch]);
  const meta = getModelMeta(draft);

  function choosePreset(preset) {
    setDraft({
      mode: "preset",
      presetKey: preset.key,
      modelId: preset.modelId,
      displayName: preset.displayName,
      hfModelId: preset.hfModelId,
      modelUrl: preset.modelUrl,
      modelLibUrl: preset.modelLibUrl,
      contextWindow: preset.contextWindow,
    });
    setError("");
  }

  function enterCustom() {
    setDraft((previous) => ({
      ...previous,
      mode: "custom",
      presetKey: "custom",
      modelId: previous.mode === "custom" ? previous.modelId : "",
      displayName: previous.mode === "custom" ? previous.displayName : "",
      hfModelId: previous.mode === "custom" ? previous.hfModelId : "",
      modelUrl: previous.mode === "custom" ? previous.modelUrl : "",
      modelLibUrl: previous.mode === "custom" ? previous.modelLibUrl : "",
      contextWindow: previous.mode === "custom" ? previous.contextWindow : 2048,
    }));
  }

  function save() {
    const normalized = normalizeModelSelection(draft);
    const validation = validateModelSelection(normalized);
    if (validation) {
      setError(validation);
      return;
    }
    onSave(normalized);
  }

  const isBusy = modelState.status === "loading";

  return (
    <Modal title="로컬 모델 설정" onClose={onClose}>
      <p className="modal-description model-manager-intro">
        프리셋은 속도와 메모리 사용량에 따라 구성되어 있습니다. 모델을 변경하면 현재 모델을 해제한 뒤
        새 모델을 다시 불러와야 합니다.
      </p>

      <div className="model-preset-grid">
        {MODEL_PRESETS.map((preset) => {
          const active = draft.mode === "preset" && draft.presetKey === preset.key;
          return (
            <button
              type="button"
              key={preset.key}
              className={`model-preset-card ${active ? "active" : ""}`}
              onClick={() => choosePreset(preset)}
            >
              <div className="model-preset-head">
                <Badge tone={preset.key === "medium" ? "accent" : "neutral"}>{preset.tier}</Badge>
                {preset.key === "medium" ? <span className="recommended-mark">추천</span> : null}
              </div>
              <strong>{preset.displayName}</strong>
              <p>{preset.description}</p>
              <dl>
                <div><dt>예상 GPU 메모리</dt><dd>{mbToText(preset.estimatedVramMb)}</dd></div>
                <div><dt>컨텍스트</dt><dd>{preset.contextWindow.toLocaleString()} tokens</dd></div>
                <div><dt>권장 환경</dt><dd>{preset.recommendation}</dd></div>
              </dl>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={`custom-model-toggle ${draft.mode === "custom" ? "active" : ""}`}
        onClick={enterCustom}
      >
        <span>사용자 지정 모델</span>
        <small>WebLLM 내장 모델 ID 또는 직접 변환한 MLC 모델 사용</small>
      </button>

      {draft.mode === "custom" ? (
        <div className="custom-model-form">
          <label className="field">
            <span>WebLLM 모델 ID</span>
            <input
              list="webllm-model-ids"
              value={draft.modelId}
              onChange={(event) => {
                const value = event.target.value;
                setCustomSearch(value);
                setDraft((previous) => ({ ...previous, modelId: value, displayName: previous.displayName || value }));
              }}
              placeholder="예: Phi-3.5-mini-instruct-q4f16_1-MLC"
            />
            <datalist id="webllm-model-ids">
              {filteredIds.map((id) => <option key={id} value={id} />)}
            </datalist>
          </label>
          <div className="two-field-grid">
            <label className="field">
              <span>화면 표시 이름</span>
              <input
                value={draft.displayName}
                onChange={(event) => setDraft((previous) => ({ ...previous, displayName: event.target.value }))}
                placeholder="나의 로컬 모델"
              />
            </label>
            <label className="field">
              <span>Hugging Face 원본 ID <small>LoRA 학습용, 선택</small></span>
              <input
                value={draft.hfModelId}
                onChange={(event) => setDraft((previous) => ({ ...previous, hfModelId: event.target.value }))}
                placeholder="예: microsoft/Phi-3.5-mini-instruct"
              />
            </label>
          </div>
          <label className="field">
            <span>MLC 모델 URL <small>내장 모델 ID라면 비워두기</small></span>
            <input
              value={draft.modelUrl}
              onChange={(event) => setDraft((previous) => ({ ...previous, modelUrl: event.target.value }))}
              placeholder="https://huggingface.co/...-MLC"
            />
          </label>
          <label className="field">
            <span>Model library URL <small>직접 변환 모델에서 필수</small></span>
            <input
              value={draft.modelLibUrl}
              onChange={(event) => setDraft((previous) => ({ ...previous, modelLibUrl: event.target.value }))}
              placeholder="https://.../model-webgpu.wasm"
            />
          </label>
          <label className="field">
            <span>컨텍스트 길이</span>
            <input
              type="number"
              min="512"
              max="8192"
              step="256"
              value={draft.contextWindow}
              onChange={(event) => setDraft((previous) => ({ ...previous, contextWindow: Number(event.target.value) }))}
            />
          </label>
          <div className="custom-model-note">
            <strong>중요</strong>
            <span>일반 Hugging Face 모델 주소를 그대로 넣을 수는 없습니다. WebLLM용 MLC 변환 파일과 호환되는 WASM model library가 필요합니다.</span>
          </div>
        </div>
      ) : null}

      <div className="selected-model-summary">
        <div>
          <span>선택 모델</span>
          <strong>{meta.displayName}</strong>
          <small>{meta.modelId}</small>
        </div>
        <Badge tone={draft.mode === "preset" ? "success" : "warning"}>{meta.tier}</Badge>
      </div>

      {error ? <div className="inline-error">{error}</div> : null}
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button onClick={save} disabled={isBusy}>선택 저장</Button>
      </div>
    </Modal>
  );
}
