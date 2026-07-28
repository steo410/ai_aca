import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Empty, Progress } from "./UI";
import {
  classifyImage,
  getVisionModelMeta,
  isVisionWebGpuAvailable,
  loadVisionModel,
} from "../lib/visionModel";
import { streamChat } from "../lib/localModel";
import "../vision.css";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 12 * 1024 * 1024;

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function labelText(label) {
  return String(label || "unknown")
    .replaceAll("_", " ")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

function percentage(score) {
  return Math.round(Math.max(0, Math.min(1, Number(score) || 0)) * 1000) / 10;
}

export default function ImageLab({ state, setState, modelState, modelMeta, onLoadModel }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [visionState, setVisionState] = useState({
    status: "idle",
    progress: 0,
    text: "이미지 모델 대기",
    device: "",
  });
  const [results, setResults] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [correctLabel, setCorrectLabel] = useState("");

  const meta = getVisionModelMeta();
  const topResult = results[0] ?? null;
  const savedExamples = state.visionExamples ?? [];
  const resultText = useMemo(
    () =>
      results
        .map((item, index) => `${index + 1}. ${labelText(item.label)}: ${percentage(item.score)}%`)
        .join("\n"),
    [results],
  );

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function selectFile(nextFile) {
    setError("");
    setResults([]);
    setExplanation("");
    setCorrectLabel("");
    if (!nextFile) return;
    if (!ACCEPTED.includes(nextFile.type)) {
      setError("JPG, PNG, WEBP 이미지 파일만 사용할 수 있습니다.");
      return;
    }
    if (nextFile.size > MAX_SIZE) {
      setError("이미지는 12MB 이하로 선택해주세요.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  function onProgress(progress) {
    setVisionState((previous) => ({
      ...previous,
      status: "loading",
      progress: Number(progress.progress || 0),
      text: progress.text || "이미지 모델을 준비하는 중입니다.",
    }));
  }

  async function prepareModel() {
    setError("");
    setVisionState({ status: "loading", progress: 0, text: "이미지 모델 확인 중", device: "" });
    try {
      const loaded = await loadVisionModel(onProgress);
      setVisionState({
        status: "ready",
        progress: 1,
        text: "이미지 모델 준비 완료",
        device: loaded.device,
      });
    } catch (caught) {
      setVisionState({ status: "error", progress: 0, text: "이미지 모델 오류", device: "" });
      setError(caught?.message || "이미지 모델을 불러오지 못했습니다.");
    }
  }

  async function analyze() {
    if (!file) {
      setError("먼저 분석할 이미지를 선택해주세요.");
      return;
    }
    setError("");
    setResults([]);
    setExplanation("");
    setVisionState((previous) => ({ ...previous, status: "analyzing", text: "이미지 분석 중" }));
    try {
      const output = await classifyImage(file, onProgress);
      setResults(output.results);
      setElapsed(output.elapsedSeconds);
      setVisionState({
        status: "ready",
        progress: 1,
        text: "분석 완료",
        device: output.device,
      });
      setState((previous) => ({
        ...previous,
        visionHistory: [
          {
            id: uid("vision-history"),
            fileName: file.name,
            topLabel: output.results?.[0]?.label || "unknown",
            confidence: output.results?.[0]?.score || 0,
            device: output.device,
            createdAt: Date.now(),
          },
          ...(previous.visionHistory ?? []),
        ].slice(0, 30),
        game: { ...previous.game, xp: previous.game.xp + 8 },
      }));
    } catch (caught) {
      setVisionState((previous) => ({ ...previous, status: "error", text: "분석 실패" }));
      setError(caught?.message || "이미지 분석 중 오류가 발생했습니다.");
    }
  }

  async function explain() {
    if (!results.length || explaining) return;
    if (modelState.status !== "ready") {
      setError("한국어 설명을 만들려면 텍스트 모델을 먼저 불러와주세요.");
      return;
    }
    setError("");
    setExplanation("");
    setExplaining(true);
    try {
      const result = await streamChat({
        messages: [
          {
            role: "system",
            content:
              "너는 이미지 분류 결과를 해석하는 AI 교사다. 제공된 분류 후보와 확률만 근거로 한국어로 설명하고, 이미지 자체를 직접 본 것처럼 말하지 않는다.",
          },
          {
            role: "user",
            content: `MobileNetV4 상위 분류 결과:\n${resultText}\n\n가장 가능성 높은 대상과 다른 후보가 함께 나온 이유를 4~6문장으로 설명해줘.`,
          },
        ],
        temperature: 0.4,
        topP: 0.85,
        maxTokens: 280,
        onToken: (text) => setExplanation(text),
      });
      setExplanation(result.text);
    } catch (caught) {
      setError(caught?.message || "설명을 생성하지 못했습니다.");
    } finally {
      setExplaining(false);
    }
  }

  function saveCorrection() {
    const corrected = correctLabel.trim();
    if (!topResult || !corrected) return;
    setState((previous) => ({
      ...previous,
      visionExamples: [
        {
          id: uid("vision-example"),
          fileName: file?.name || "image",
          predictedLabel: topResult.label,
          predictedScore: topResult.score,
          correctLabel: corrected,
          createdAt: Date.now(),
        },
        ...(previous.visionExamples ?? []),
      ],
      game: { ...previous.game, xp: previous.game.xp + 12 },
    }));
    setCorrectLabel("");
  }

  const busy = visionState.status === "loading" || visionState.status === "analyzing";

  return (
    <div className="page vision-page">
      <Card className="vision-intro">
        <div>
          <Badge tone="accent">BROWSER VISION LAB</Badge>
          <h2>이미지를 올리고 AI가 무엇으로 판단하는지 확인하세요.</h2>
          <p>
            MobileNetV4 Small이 ImageNet의 1,000개 범주 가운데 가장 가까운 대상을 찾습니다.
            이미지와 추론은 브라우저 안에서 처리됩니다.
          </p>
        </div>
        <div className="vision-meta">
          <Meta label="모델" value={meta.displayName} />
          <Meta label="초기 다운로드" value={meta.approximateDownload} />
          <Meta label="입력" value={meta.inputSize} />
          <Meta label="장치" value={visionState.device || (isVisionWebGpuAvailable() ? "WebGPU 우선" : "CPU(WASM)")} />
        </div>
      </Card>

      <div className="vision-grid">
        <Card className="vision-panel">
          <div className="section-heading">
            <div><span className="eyebrow">IMAGE INPUT</span><h3>분석 이미지</h3></div>
            <Badge tone={file ? "success" : "neutral"}>{file ? "선택됨" : "대기"}</Badge>
          </div>
          <input
            ref={inputRef}
            className="vision-hidden-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className={`vision-dropzone ${dragging ? "dragging" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFile(event.dataTransfer.files?.[0]);
            }}
          >
            {preview ? <img src={preview} alt="분석 이미지 미리보기" /> : (
              <div><strong>클릭하거나 이미지를 끌어놓으세요.</strong><small>JPG · PNG · WEBP · 최대 12MB</small></div>
            )}
          </button>
          {file ? (
            <div className="vision-file-row">
              <div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)}MB</small></div>
              <Button onClick={analyze} disabled={busy}>{busy ? "처리 중..." : "이미지 분석"}</Button>
            </div>
          ) : null}
          {error ? <div className="inline-error">{error}</div> : null}
        </Card>

        <Card className="vision-panel vision-output">
          <div className="section-heading">
            <div><span className="eyebrow">MODEL OUTPUT</span><h3>인식 결과</h3></div>
            <Badge tone={visionState.status === "ready" ? "success" : visionState.status === "error" ? "danger" : busy ? "warning" : "neutral"}>
              {visionState.status.toUpperCase()}
            </Badge>
          </div>
          {visionState.status === "loading" ? (
            <div className="vision-loading"><Progress value={visionState.progress * 100} label={`${Math.round(visionState.progress * 100)}%`} /><p>{visionState.text}</p></div>
          ) : null}
          {!results.length && visionState.status !== "loading" ? (
            <Empty title="아직 분석 결과가 없습니다." description="이미지를 선택하고 분석 버튼을 누르면 상위 5개 후보가 표시됩니다." />
          ) : null}
          {results.length ? (
            <>
              <div className="vision-top-result">
                <span>가장 높은 예측</span>
                <strong>{labelText(topResult.label)}</strong>
                <small>신뢰도 {percentage(topResult.score)}% · {elapsed.toFixed(2)}초 · {visionState.device.toUpperCase()}</small>
              </div>
              <div className="vision-list">
                {results.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="vision-item">
                    <div><span>{index + 1}</span><strong>{labelText(item.label)}</strong><em>{percentage(item.score)}%</em></div>
                    <i><b style={{ width: `${percentage(item.score)}%` }} /></i>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {(visionState.status === "idle" || visionState.status === "error") ? (
            <Button variant="secondary" className="full" onClick={prepareModel}>이미지 모델 미리 불러오기</Button>
          ) : null}
        </Card>
      </div>

      {results.length ? (
        <div className="vision-grid vision-secondary">
          <Card className="vision-panel">
            <div className="section-heading"><div><span className="eyebrow">TEXT INTERPRETATION</span><h3>텍스트 AI 해석</h3></div><Badge tone={modelState.status === "ready" ? "success" : "neutral"}>{modelState.status === "ready" ? modelMeta.displayName : "미연결"}</Badge></div>
            {explanation ? <div className="vision-explanation">{explanation}</div> : <p className="vision-description">영문 분류 후보와 확률을 현재 텍스트 모델이 한국어로 해석합니다.</p>}
            {modelState.status === "ready" ? <Button variant="secondary" onClick={explain} disabled={explaining}>{explaining ? "설명 생성 중..." : "한국어로 설명하기"}</Button> : <Button variant="secondary" onClick={onLoadModel}>텍스트 모델 불러오기</Button>}
          </Card>
          <Card className="vision-panel">
            <div className="section-heading"><div><span className="eyebrow">HUMAN FEEDBACK</span><h3>AI 판단 교정</h3></div><Badge tone="accent">{savedExamples.length}개</Badge></div>
            <p className="vision-description">예측이 틀렸다면 사람이 판단한 정답을 저장해 이미지 학습 데이터의 기초로 활용합니다.</p>
            <label className="field"><span>사람이 판단한 정답</span><input value={correctLabel} onChange={(event) => setCorrectLabel(event.target.value)} placeholder="예: 골든 리트리버, 태양광 패널" /></label>
            <Button className="full" onClick={saveCorrection} disabled={!correctLabel.trim()}>교정 데이터 저장 +12 XP</Button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Meta({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
