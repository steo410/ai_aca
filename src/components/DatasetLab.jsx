import React, { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Empty, Icon, Modal, Progress } from "./UI";
import { datasetQuality } from "../lib/personalization";
import {
  exportBundle,
  exportPreferenceJsonl,
  exportSftJsonl,
  importBundle,
} from "../lib/exporters";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DatasetLab({ state, setState }) {
  const [tab, setTab] = useState("sft");
  const [sftForm, setSftForm] = useState({
    instruction: "",
    output: "",
    system: state.settings.systemPrompt,
    tags: "",
  });
  const [prefForm, setPrefForm] = useState({ prompt: "", chosen: "", rejected: "" });
  const [editing, setEditing] = useState(null);
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);
  const quality = useMemo(() => datasetQuality(state.sftExamples), [state.sftExamples]);

  function addSft(event) {
    event.preventDefault();
    if (!sftForm.instruction.trim() || !sftForm.output.trim()) return;
    setState((previous) => ({
      ...previous,
      sftExamples: [
        ...previous.sftExamples,
        {
          id: uid("sft"),
          instruction: sftForm.instruction.trim(),
          output: sftForm.output.trim(),
          system: sftForm.system.trim(),
          tags: sftForm.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          createdAt: Date.now(),
        },
      ],
      game: { ...previous.game, xp: previous.game.xp + 10 },
    }));
    setSftForm({ ...sftForm, instruction: "", output: "", tags: "" });
  }

  function addPreference(event) {
    event.preventDefault();
    if (!prefForm.prompt.trim() || !prefForm.chosen.trim() || !prefForm.rejected.trim()) return;
    setState((previous) => ({
      ...previous,
      preferences: [
        ...previous.preferences,
        {
          id: uid("pref"),
          prompt: prefForm.prompt.trim(),
          chosen: prefForm.chosen.trim(),
          rejected: prefForm.rejected.trim(),
          createdAt: Date.now(),
          source: "manual",
        },
      ],
      game: { ...previous.game, xp: previous.game.xp + 15 },
    }));
    setPrefForm({ prompt: "", chosen: "", rejected: "" });
  }

  function removeItem(type, id) {
    setState((previous) => ({
      ...previous,
      [type]: previous[type].filter((item) => item.id !== id),
    }));
  }

  function saveEdit() {
    if (!editing) return;
    setState((previous) => ({
      ...previous,
      [editing.collection]: previous[editing.collection].map((item) =>
        item.id === editing.item.id ? editing.item : item,
      ),
    }));
    setEditing(null);
  }

  async function handleImport(file) {
    if (!file) return;
    setImportError("");
    try {
      const imported = await importBundle(file);
      setState((previous) => ({
        ...previous,
        sftExamples: Array.isArray(imported.sftExamples) ? imported.sftExamples : previous.sftExamples,
        preferences: Array.isArray(imported.preferences) ? imported.preferences : previous.preferences,
        arenaVotes: Array.isArray(imported.arenaVotes) ? imported.arenaVotes : previous.arenaVotes,
        evaluations: Array.isArray(imported.evaluations) ? imported.evaluations : previous.evaluations,
        game: imported.game ? { ...previous.game, ...imported.game } : previous.game,
        settings: imported.settings ? { ...previous.settings, ...imported.settings } : previous.settings,
      }));
    } catch (error) {
      setImportError(error?.message || "파일을 읽지 못했습니다.");
    } finally {
      fileRef.current.value = "";
    }
  }

  return (
    <div className="page dataset-page">
      <div className="dataset-top-grid">
        <Card className="quality-card-large">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DATA QUALITY</span>
              <h3>현재 데이터 건강도</h3>
            </div>
            <div className="big-score">{quality.score}<small>/100</small></div>
          </div>
          <div className="quality-bars-grid">
            <Metric label="형식 완성도" value={quality.completeness} />
            <Metric
              label="질문 다양성"
              value={state.sftExamples.length ? Math.round((1 - quality.duplicates / state.sftExamples.length) * 100) : 0}
            />
            <Metric label="답변 충분성" value={Math.min(100, Math.round((quality.avgOutput / 120) * 100))} />
          </div>
          <div className="quality-tip">
            <Icon name="spark" />
            <p>
              질문은 구체적으로, 답변은 사실·과정·결론이 드러나게 작성하세요. 비슷한 질문만 반복되면
              모델이 특정 표현에 과적합될 수 있습니다.
            </p>
          </div>
        </Card>

        <Card className="export-card">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">PORTABLE DATA</span>
              <h3>내보내기와 백업</h3>
            </div>
          </div>
          <div className="export-buttons">
            <Button variant="secondary" icon="download" onClick={() => exportSftJsonl(state.sftExamples)} disabled={!state.sftExamples.length}>
              SFT JSONL
            </Button>
            <Button variant="secondary" icon="download" onClick={() => exportPreferenceJsonl(state.preferences)} disabled={!state.preferences.length}>
              선호 JSONL
            </Button>
            <Button variant="secondary" icon="download" onClick={() => exportBundle(state)}>
              전체 백업
            </Button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => handleImport(event.target.files?.[0])}
            />
            <Button variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>
              백업 불러오기
            </Button>
          </div>
          {importError ? <div className="inline-error">{importError}</div> : null}
          <p className="privacy-note">데이터는 서버로 전송되지 않고 현재 브라우저 저장소에 보관됩니다.</p>
        </Card>
      </div>

      <Card className="dataset-workbench">
        <div className="tabs">
          <button className={tab === "sft" ? "active" : ""} onClick={() => setTab("sft")}>
            SFT 질문·답변 <Badge tone="neutral">{state.sftExamples.length}</Badge>
          </button>
          <button className={tab === "preference" ? "active" : ""} onClick={() => setTab("preference")}>
            선호 쌍 <Badge tone="neutral">{state.preferences.length}</Badge>
          </button>
        </div>

        {tab === "sft" ? (
          <div className="dataset-columns">
            <form className="data-form" onSubmit={addSft}>
              <div className="form-title">
                <div><span>+</span></div>
                <div><strong>새 SFT 예시</strong><p>질문에 대한 모범 답변을 만들어주세요.</p></div>
              </div>
              <label className="field">
                <span>사용자 질문</span>
                <textarea
                  rows={4}
                  value={sftForm.instruction}
                  onChange={(event) => setSftForm({ ...sftForm, instruction: event.target.value })}
                  placeholder="예: 언어 모델의 temperature가 무엇인지 설명해줘."
                />
              </label>
              <label className="field">
                <span>모범 답변</span>
                <textarea
                  rows={9}
                  value={sftForm.output}
                  onChange={(event) => setSftForm({ ...sftForm, output: event.target.value })}
                  placeholder="정확하고 이해하기 쉬운 답변을 작성하세요."
                />
              </label>
              <label className="field">
                <span>시스템 역할</span>
                <textarea
                  rows={3}
                  value={sftForm.system}
                  onChange={(event) => setSftForm({ ...sftForm, system: event.target.value })}
                />
              </label>
              <label className="field">
                <span>태그 <small>쉼표로 구분</small></span>
                <input
                  value={sftForm.tags}
                  onChange={(event) => setSftForm({ ...sftForm, tags: event.target.value })}
                  placeholder="AI기초, 토큰, 과학"
                />
              </label>
              <Button type="submit" className="full" disabled={!sftForm.instruction.trim() || !sftForm.output.trim()}>
                학습 예시 추가
              </Button>
            </form>

            <div className="dataset-list-panel">
              <div className="list-heading">
                <div><strong>저장된 SFT 데이터</strong><p>LoRA 훈련에서는 질문과 모범 답변으로 사용됩니다.</p></div>
                <Badge tone="accent">평균 답변 {quality.avgOutput}자</Badge>
              </div>
              {state.sftExamples.length ? (
                <div className="dataset-list">
                  {[...state.sftExamples].reverse().map((item, reverseIndex) => (
                    <DatasetItem
                      key={item.id}
                      number={state.sftExamples.length - reverseIndex}
                      title={item.instruction}
                      body={item.output}
                      tags={item.tags}
                      onEdit={() => setEditing({ collection: "sftExamples", item: { ...item } })}
                      onDelete={() => removeItem("sftExamples", item.id)}
                    />
                  ))}
                </div>
              ) : (
                <Empty title="아직 학습 예시가 없습니다" description="왼쪽 양식에서 첫 질문과 모범 답변을 작성하세요." />
              )}
            </div>
          </div>
        ) : (
          <div className="dataset-columns">
            <form className="data-form" onSubmit={addPreference}>
              <div className="form-title">
                <div><span>±</span></div>
                <div><strong>새 선호 쌍</strong><p>같은 질문에 대한 좋은 답변과 나쁜 답변을 비교합니다.</p></div>
              </div>
              <label className="field">
                <span>질문</span>
                <textarea rows={3} value={prefForm.prompt} onChange={(event) => setPrefForm({ ...prefForm, prompt: event.target.value })} />
              </label>
              <label className="field chosen-field">
                <span>선호 답변 · chosen</span>
                <textarea rows={6} value={prefForm.chosen} onChange={(event) => setPrefForm({ ...prefForm, chosen: event.target.value })} />
              </label>
              <label className="field rejected-field">
                <span>비선호 답변 · rejected</span>
                <textarea rows={6} value={prefForm.rejected} onChange={(event) => setPrefForm({ ...prefForm, rejected: event.target.value })} />
              </label>
              <Button type="submit" className="full" disabled={!prefForm.prompt.trim() || !prefForm.chosen.trim() || !prefForm.rejected.trim()}>
                선호 데이터 추가
              </Button>
            </form>

            <div className="dataset-list-panel">
              <div className="list-heading">
                <div><strong>저장된 선호 데이터</strong><p>경기장 투표와 직접 입력한 비교 결과가 함께 저장됩니다.</p></div>
              </div>
              {state.preferences.length ? (
                <div className="dataset-list">
                  {[...state.preferences].reverse().map((item, reverseIndex) => (
                    <PreferenceItem
                      key={item.id}
                      number={state.preferences.length - reverseIndex}
                      item={item}
                      onEdit={() => setEditing({ collection: "preferences", item: { ...item } })}
                      onDelete={() => removeItem("preferences", item.id)}
                    />
                  ))}
                </div>
              ) : (
                <Empty title="아직 선호 쌍이 없습니다" description="모델 경기장에서 투표하거나 직접 chosen/rejected 답변을 입력하세요." />
              )}
            </div>
          </div>
        )}
      </Card>

      {editing ? (
        <EditModal editing={editing} setEditing={setEditing} onSave={saveEdit} />
      ) : null}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-block">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <Progress value={value} />
    </div>
  );
}

function DatasetItem({ number, title, body, tags, onEdit, onDelete }) {
  return (
    <article className="dataset-item">
      <div className="dataset-index">#{String(number).padStart(3, "0")}</div>
      <div className="dataset-copy">
        <strong>{title}</strong>
        <p>{body}</p>
        <div className="tag-row">
          {(tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
        </div>
      </div>
      <div className="dataset-actions">
        <button onClick={onEdit} aria-label="수정"><Icon name="edit" size={17} /></button>
        <button onClick={onDelete} aria-label="삭제"><Icon name="trash" size={17} /></button>
      </div>
    </article>
  );
}

function PreferenceItem({ number, item, onEdit, onDelete }) {
  return (
    <article className="preference-item">
      <div className="preference-top">
        <span>#{String(number).padStart(3, "0")}</span>
        <strong>{item.prompt}</strong>
        <div className="dataset-actions">
          <button onClick={onEdit} aria-label="수정"><Icon name="edit" size={17} /></button>
          <button onClick={onDelete} aria-label="삭제"><Icon name="trash" size={17} /></button>
        </div>
      </div>
      <div className="preference-pair">
        <div className="chosen-box"><span>CHOSEN</span><p>{item.chosen}</p></div>
        <div className="rejected-box"><span>REJECTED</span><p>{item.rejected}</p></div>
      </div>
    </article>
  );
}

function EditModal({ editing, setEditing, onSave }) {
  const item = editing.item;
  const isSft = editing.collection === "sftExamples";
  function update(patch) {
    setEditing({ ...editing, item: { ...item, ...patch } });
  }
  return (
    <Modal title={isSft ? "SFT 예시 수정" : "선호 데이터 수정"} onClose={() => setEditing(null)}>
      {isSft ? (
        <>
          <label className="field"><span>질문</span><textarea rows={4} value={item.instruction} onChange={(event) => update({ instruction: event.target.value })} /></label>
          <label className="field"><span>모범 답변</span><textarea rows={8} value={item.output} onChange={(event) => update({ output: event.target.value })} /></label>
          <label className="field"><span>시스템 역할</span><textarea rows={3} value={item.system ?? ""} onChange={(event) => update({ system: event.target.value })} /></label>
          <label className="field"><span>태그</span><input value={(item.tags ?? []).join(", ")} onChange={(event) => update({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></label>
        </>
      ) : (
        <>
          <label className="field"><span>질문</span><textarea rows={3} value={item.prompt} onChange={(event) => update({ prompt: event.target.value })} /></label>
          <label className="field"><span>선호 답변</span><textarea rows={6} value={item.chosen} onChange={(event) => update({ chosen: event.target.value })} /></label>
          <label className="field"><span>비선호 답변</span><textarea rows={6} value={item.rejected} onChange={(event) => update({ rejected: event.target.value })} /></label>
        </>
      )}
      <div className="modal-actions">
        <Button variant="ghost" onClick={() => setEditing(null)}>취소</Button>
        <Button onClick={onSave}>수정 저장</Button>
      </div>
    </Modal>
  );
}
