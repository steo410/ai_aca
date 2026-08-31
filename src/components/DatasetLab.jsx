import React, { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Empty, Icon, Modal, Progress } from "./UI";
import { datasetQuality } from "../lib/personalization";
import { exportBundle, exportPreferenceJsonl, exportSftJsonl, importBundle } from "../lib/exporters";

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DatasetLab({ state, setState }) {
  const [tab, setTab] = useState("sft");
  const [sftForm, setSftForm] = useState({ instruction: "", output: "", system: state.settings.systemPrompt, tags: "" });
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
          tags: sftForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
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
    setState((previous) => ({ ...previous, [type]: previous[type].filter((item) => item.id !== id) }));
  }

  function saveEdit() {
    if (!editing) return;
    setState((previous) => ({
      ...previous,
      [editing.collection]: previous[editing.collection].map((item) => item.id === editing.item.id ? editing.item : item),
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
            <div><span className="eyebrow">SFT DATA</span><h3>데이터 상태</h3></div>
            <div className="big-score">{quality.score}<small>/100</small></div>
          </div>
          <div className="quality-bars-grid">
            <Metric label="필수 항목 채움" value={quality.completeness} />
            <Metric label="질문 중복 방지" value={state.sftExamples.length ? Math.round((1 - quality.duplicates / state.sftExamples.length) * 100) : 0} />
            <Metric label="답변 길이" value={Math.min(100, Math.round((quality.avgOutput / 120) * 100))} />
          </div>
          <div className="quality-tip"><Icon name="spark" /><p>질문과 답변이 비어 있지 않은지, 같은 질문이 반복되지 않는지 확인하면 됩니다.</p></div>
        </Card>

        <Card className="export-card">
          <div className="section-heading compact"><div><span className="eyebrow">FILES</span><h3>내보내기 / 가져오기</h3></div></div>
          <div className="export-buttons">
            <Button variant="secondary" icon="download" onClick={() => exportSftJsonl(state.sftExamples)} disabled={!state.sftExamples.length}>SFT JSONL</Button>
            <Button variant="secondary" icon="download" onClick={() => exportPreferenceJsonl(state.preferences)} disabled={!state.preferences.length}>선호 JSONL</Button>
            <Button variant="secondary" icon="download" onClick={() => exportBundle(state)}>전체 백업</Button>
            <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => handleImport(event.target.files?.[0])} />
            <Button variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>백업 불러오기</Button>
          </div>
          {importError ? <div className="inline-error">{importError}</div> : null}
          <p className="privacy-note">저장한 데이터는 현재 브라우저의 로컬 저장소에 보관됩니다.</p>
        </Card>
      </div>

      <Card className="dataset-workbench">
        <div className="tabs">
          <button className={tab === "sft" ? "active" : ""} onClick={() => setTab("sft")}>SFT <Badge tone="neutral">{state.sftExamples.length}</Badge></button>
          <button className={tab === "preference" ? "active" : ""} onClick={() => setTab("preference")}>선호 데이터 <Badge tone="neutral">{state.preferences.length}</Badge></button>
        </div>

        {tab === "sft" ? (
          <div className="dataset-columns">
            <form className="data-form" onSubmit={addSft}>
              <div className="form-title"><div><span>+</span></div><div><strong>SFT 항목 추가</strong><p>질문과 원하는 답변을 한 쌍으로 저장합니다.</p></div></div>
              <label className="field"><span>질문</span><textarea rows={4} value={sftForm.instruction} onChange={(event) => setSftForm({ ...sftForm, instruction: event.target.value })} placeholder="예: temperature가 무엇인지 설명해줘." /></label>
              <label className="field"><span>원하는 답변</span><textarea rows={9} value={sftForm.output} onChange={(event) => setSftForm({ ...sftForm, output: event.target.value })} placeholder="이 질문에 모델이 답했으면 하는 내용을 입력하세요." /></label>
              <label className="field"><span>시스템 프롬프트</span><textarea rows={3} value={sftForm.system} onChange={(event) => setSftForm({ ...sftForm, system: event.target.value })} /></label>
              <label className="field"><span>태그 <small>쉼표로 구분</small></span><input value={sftForm.tags} onChange={(event) => setSftForm({ ...sftForm, tags: event.target.value })} placeholder="AI기초, 토큰, 과학" /></label>
              <Button type="submit" className="full" disabled={!sftForm.instruction.trim() || !sftForm.output.trim()}>추가</Button>
            </form>

            <div className="dataset-list-panel">
              <div className="list-heading"><div><strong>저장된 SFT 데이터</strong><p>JSONL로 내보내 LoRA 학습에 사용할 수 있습니다.</p></div><Badge tone="accent">평균 답변 {quality.avgOutput}자</Badge></div>
              {state.sftExamples.length ? (
                <div className="dataset-list">
                  {[...state.sftExamples].reverse().map((item, reverseIndex) => (
                    <DatasetItem key={item.id} number={state.sftExamples.length - reverseIndex} title={item.instruction} body={item.output} tags={item.tags} onEdit={() => setEditing({ collection: "sftExamples", item: { ...item } })} onDelete={() => removeItem("sftExamples", item.id)} />
                  ))}
                </div>
              ) : <Empty title="저장된 SFT 데이터가 없습니다" description="왼쪽에서 첫 항목을 추가해보세요." />}
            </div>
          </div>
        ) : (
          <div className="dataset-columns">
            <form className="data-form" onSubmit={addPreference}>
              <div className="form-title"><div><span>±</span></div><div><strong>선호 데이터 추가</strong><p>같은 질문에 대한 두 답변을 저장합니다.</p></div></div>
              <label className="field"><span>질문</span><textarea rows={3} value={prefForm.prompt} onChange={(event) => setPrefForm({ ...prefForm, prompt: event.target.value })} /></label>
              <label className="field chosen-field"><span>더 좋은 답변</span><textarea rows={6} value={prefForm.chosen} onChange={(event) => setPrefForm({ ...prefForm, chosen: event.target.value })} /></label>
              <label className="field rejected-field"><span>비교할 답변</span><textarea rows={6} value={prefForm.rejected} onChange={(event) => setPrefForm({ ...prefForm, rejected: event.target.value })} /></label>
              <Button type="submit" className="full" disabled={!prefForm.prompt.trim() || !prefForm.chosen.trim() || !prefForm.rejected.trim()}>추가</Button>
            </form>

            <div className="dataset-list-panel">
              <div className="list-heading"><div><strong>저장된 선호 데이터</strong><p>직접 입력한 항목과 답변 비교에서 선택한 기록이 함께 저장됩니다.</p></div></div>
              {state.preferences.length ? (
                <div className="dataset-list">
                  {[...state.preferences].reverse().map((item, reverseIndex) => (
                    <PreferenceItem key={item.id} number={state.preferences.length - reverseIndex} item={item} onEdit={() => setEditing({ collection: "preferences", item: { ...item } })} onDelete={() => removeItem("preferences", item.id)} />
                  ))}
                </div>
              ) : <Empty title="저장된 선호 데이터가 없습니다" description="직접 추가하거나 답변 비교에서 하나를 선택하면 저장됩니다." />}
            </div>
          </div>
        )}
      </Card>

      {editing ? <EditModal editing={editing} setEditing={setEditing} onSave={saveEdit} /> : null}
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="metric-block"><div><span>{label}</span><strong>{value}%</strong></div><Progress value={value} /></div>;
}

function DatasetItem({ number, title, body, tags, onEdit, onDelete }) {
  return (
    <article className="dataset-item">
      <div className="dataset-index">#{String(number).padStart(3, "0")}</div>
      <div className="dataset-copy"><strong>{title}</strong><p>{body}</p><div className="tag-row">{(tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}</div></div>
      <div className="dataset-actions"><button onClick={onEdit} aria-label="수정"><Icon name="edit" size={17} /></button><button onClick={onDelete} aria-label="삭제"><Icon name="trash" size={17} /></button></div>
    </article>
  );
}

function PreferenceItem({ number, item, onEdit, onDelete }) {
  return (
    <article className="preference-item">
      <div className="preference-top"><span>#{String(number).padStart(3, "0")}</span><strong>{item.prompt}</strong><div className="dataset-actions"><button onClick={onEdit} aria-label="수정"><Icon name="edit" size={17} /></button><button onClick={onDelete} aria-label="삭제"><Icon name="trash" size={17} /></button></div></div>
      <div className="preference-pair"><div className="chosen-box"><span>선택</span><p>{item.chosen}</p></div><div className="rejected-box"><span>비교</span><p>{item.rejected}</p></div></div>
    </article>
  );
}

function EditModal({ editing, setEditing, onSave }) {
  const item = editing.item;
  const isSft = editing.collection === "sftExamples";
  function update(patch) { setEditing({ ...editing, item: { ...item, ...patch } }); }
  return (
    <Modal title="데이터 수정" onClose={() => setEditing(null)}>
      {isSft ? (
        <><label className="field"><span>질문</span><textarea rows={4} value={item.instruction} onChange={(event) => update({ instruction: event.target.value })} /></label><label className="field"><span>답변</span><textarea rows={8} value={item.output} onChange={(event) => update({ output: event.target.value })} /></label></>
      ) : (
        <><label className="field"><span>질문</span><textarea rows={3} value={item.prompt} onChange={(event) => update({ prompt: event.target.value })} /></label><label className="field"><span>선택한 답변</span><textarea rows={6} value={item.chosen} onChange={(event) => update({ chosen: event.target.value })} /></label><label className="field"><span>비교한 답변</span><textarea rows={6} value={item.rejected} onChange={(event) => update({ rejected: event.target.value })} /></label></>
      )}
      <div className="modal-actions"><Button variant="ghost" onClick={() => setEditing(null)}>취소</Button><Button onClick={onSave}>저장</Button></div>
    </Modal>
  );
}
