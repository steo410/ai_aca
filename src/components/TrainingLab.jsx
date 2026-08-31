import React, { useMemo, useState } from "react";
import { Badge, Button, Card, Empty, Progress } from "./UI";
import { datasetQuality } from "../lib/personalization";
import { exportBundle, exportPreferenceJsonl, exportSftJsonl } from "../lib/exporters";

export default function TrainingLab({ state, setState, modelMeta }) {
  const [copied, setCopied] = useState("");
  const quality = useMemo(() => datasetQuality(state.sftExamples), [state.sftExamples]);
  const personalizedWins = state.arenaVotes.filter((vote) => vote.winner === "personalized").length;
  const baseWins = state.arenaVotes.filter((vote) => vote.winner === "base").length;
  const totalVotes = state.arenaVotes.length;
  const personalizedWinRate = totalVotes ? Math.round((personalizedWins / totalVotes) * 100) : 0;
  const readiness = Math.min(
    100,
    Math.round(
      Math.min(1, state.sftExamples.length / 30) * 55 +
        Math.min(1, state.preferences.length / 20) * 25 +
        (quality.score / 100) * 20,
    ),
  );

  const installCommand = "Set-ExecutionPolicy -Scope Process Bypass; .\\setup_windows.ps1";
  const hfModelId = modelMeta.hfModelId || "<Hugging-Face-원본-모델-ID>";
  const outputDir = `outputs\\academy-${String(modelMeta.params || "custom").toLowerCase()}-lora`;
  const trainCommand = `python train_lora.py --data ..\\exports\\sft_train.jsonl --model "${hfModelId}" --output ${outputDir}`;
  const evalCommand = `python evaluate_lora.py --data ..\\exports\\sft_train.jsonl --model "${hfModelId}" --adapter ${outputDir}`;

  async function copy(label, text) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="page training-page">
      <Card className="readiness-card">
        <div className="readiness-copy">
          <Badge tone={readiness >= 70 ? "success" : "warning"}>LORA</Badge>
          <h2>학습 데이터 준비도 {readiness}%</h2>
          <p>
            현재 저장된 SFT 데이터와 선호 데이터의 양을 기준으로 표시한 값입니다.
            실제 LoRA 학습은 아래 명령을 로컬 PC에서 실행합니다.
          </p>
          <Progress value={readiness} />
        </div>
        <div className="readiness-factors">
          <Factor label="SFT 데이터" current={state.sftExamples.length} target={30} />
          <Factor label="선호 데이터" current={state.preferences.length} target={20} />
          <Factor label="데이터 상태" current={quality.score} target={80} suffix="점" />
        </div>
      </Card>

      <div className="training-grid">
        <Card>
          <div className="section-heading">
            <div><span className="eyebrow">PERSONALIZATION</span><h3>브라우저 개인화</h3></div>
            <Badge tone={state.settings.personalization ? "success" : "neutral"}>{state.settings.personalization ? "켜짐" : "꺼짐"}</Badge>
          </div>
          <p className="section-description">
            질문과 관련된 SFT 예시와 최근 선호 데이터를 시스템 문맥에 추가합니다.
            모델 가중치를 바꾸는 방식은 아니며, 저장된 데이터를 채팅에 함께 넣는 방식입니다.
          </p>
          <div className="compare-diagram">
            <div><span>입력</span><strong>사용자 질문</strong></div>
            <span>+</span>
            <div><span>문맥</span><strong>SFT · 선호</strong></div>
            <span>→</span>
            <div><span>모델</span><strong>{modelMeta.displayName}</strong></div>
          </div>
          <label className="switch-row emphasized">
            <div><strong>개인화 사용</strong><small>채팅과 답변 비교에 적용</small></div>
            <input
              type="checkbox"
              checked={state.settings.personalization}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  settings: { ...previous.settings, personalization: event.target.checked },
                }))
              }
            />
          </label>
        </Card>

        <Card>
          <div className="section-heading">
            <div><span className="eyebrow">A / B RESULT</span><h3>답변 비교 기록</h3></div>
            <Badge tone="accent">{totalVotes}회</Badge>
          </div>
          {totalVotes ? (
            <>
              <div className="win-rate-number"><strong>{personalizedWinRate}%</strong><span>개인화 응답 선택률</span></div>
              <div className="bar-chart">
                <ChartBar label="기본 응답" value={baseWins} max={Math.max(baseWins, personalizedWins, 1)} />
                <ChartBar label="개인화 응답" value={personalizedWins} max={Math.max(baseWins, personalizedWins, 1)} accent />
              </div>
              <p className="evaluation-note">질문 종류를 바꿔가며 여러 번 비교하면 개인화 효과를 확인하기 쉽습니다.</p>
            </>
          ) : (
            <Empty title="비교 기록이 없습니다" description="답변 비교에서 두 응답을 확인하고 하나를 선택해보세요." />
          )}
        </Card>
      </div>

      {!modelMeta.hfModelId ? (
        <div className="global-error training-model-warning">
          <strong>Hugging Face 원본 모델 ID가 필요합니다.</strong>
          <span>모델 설정에 원본 모델 ID를 입력하면 아래 학습 명령에 반영됩니다.</span>
        </div>
      ) : null}

      <Card className="lora-workflow">
        <div className="section-heading">
          <div><span className="eyebrow">LOCAL TRAINING</span><h3>LoRA 학습 실행</h3></div>
          <Badge tone="accent">{modelMeta.displayName}</Badge>
        </div>
        <div className="workflow-steps">
          <WorkflowStep number="1" title="데이터 내보내기" description="웹에서 만든 데이터를 파일로 저장합니다.">
            <div className="inline-buttons">
              <Button size="sm" variant="secondary" icon="download" onClick={() => exportSftJsonl(state.sftExamples)} disabled={!state.sftExamples.length}>SFT JSONL</Button>
              <Button size="sm" variant="secondary" icon="download" onClick={() => exportPreferenceJsonl(state.preferences)} disabled={!state.preferences.length}>선호 JSONL</Button>
              <Button size="sm" variant="ghost" icon="download" onClick={() => exportBundle(state)}>전체 백업</Button>
            </div>
          </WorkflowStep>
          <WorkflowStep number="2" title="Python 환경 준비" description="trainer 폴더에서 아래 PowerShell 명령을 실행합니다.">
            <CommandBox text={installCommand} copied={copied === "install"} onCopy={() => copy("install", installCommand)} />
          </WorkflowStep>
          <WorkflowStep number="3" title="LoRA 학습" description={`현재 선택 모델은 ${modelMeta.params}입니다. 모델이 클수록 더 많은 GPU 메모리가 필요합니다.`}>
            <CommandBox text={trainCommand} copied={copied === "train"} onCopy={() => copy("train", trainCommand)} />
          </WorkflowStep>
          <WorkflowStep number="4" title="결과 확인" description="기본 모델과 LoRA 적용 모델의 답변을 비교합니다.">
            <CommandBox text={evalCommand} copied={copied === "eval"} onCopy={() => copy("eval", evalCommand)} />
          </WorkflowStep>
        </div>
      </Card>

      <div className="training-notes">
        <Card>
          <span className="eyebrow">MODEL</span>
          <h3>{modelMeta.displayName}</h3>
          <ul>
            <li>웹 채팅은 4비트 WebLLM 모델을 사용합니다.</li>
            <li>0.5B, 1.5B, 3B 프리셋 중 하나를 선택할 수 있습니다.</li>
            <li>LoRA 학습에는 Hugging Face 원본 모델 ID를 사용합니다.</li>
            <li>사용자 지정 모델은 LoRA 지원 여부를 따로 확인해야 합니다.</li>
          </ul>
        </Card>
        <Card>
          <span className="eyebrow">NOTE</span>
          <h3>웹 실행과 LoRA 학습</h3>
          <p>
            웹사이트의 Qwen은 브라우저에서 실행됩니다. LoRA 학습은 Python과 CUDA가 필요한 작업이라
            웹사이트가 아니라 사용자의 PC에서 실행합니다.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Factor({ label, current, target, suffix = "개" }) {
  const value = Math.min(100, Math.round((current / target) * 100));
  return <div className="factor-row"><div><span>{label}</span><strong>{current}{suffix} / 기준 {target}{suffix}</strong></div><Progress value={value} /></div>;
}

function ChartBar({ label, value, max, accent = false }) {
  return <div className={`chart-bar-row ${accent ? "accent" : ""}`}><span>{label}</span><div><i style={{ width: `${(value / max) * 100}%` }} /></div><strong>{value}회</strong></div>;
}

function WorkflowStep({ number, title, description, children }) {
  return <div className="workflow-step"><span className="workflow-number">{number}</span><div><strong>{title}</strong><p>{description}</p>{children}</div></div>;
}

function CommandBox({ text, onCopy, copied }) {
  return <div className="command-box"><code>{text}</code><button onClick={onCopy}>{copied ? "복사됨" : "복사"}</button></div>;
}
