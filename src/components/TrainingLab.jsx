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
          <Badge tone={readiness >= 70 ? "success" : "warning"}>LORA READINESS</Badge>
          <h2>실제 가중치 학습 준비도 {readiness}%</h2>
          <p>
            브라우저 개인화는 즉시 비교할 수 있지만 모델 가중치를 바꾸지는 않습니다. 아래 로컬 훈련기는
            내보낸 SFT 데이터로 실제 LoRA 어댑터를 학습합니다.
          </p>
          <Progress value={readiness} />
        </div>
        <div className="readiness-factors">
          <Factor label="SFT 예시" current={state.sftExamples.length} target={30} />
          <Factor label="선호 쌍" current={state.preferences.length} target={20} />
          <Factor label="데이터 품질" current={quality.score} target={80} suffix="점" />
        </div>
      </Card>

      <div className="training-grid">
        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">LIGHTWEIGHT LEARNING</span>
              <h3>브라우저 개인화</h3>
            </div>
            <Badge tone={state.settings.personalization ? "success" : "neutral"}>
              {state.settings.personalization ? "활성" : "비활성"}
            </Badge>
          </div>
          <p className="section-description">
            질문과 가장 관련 있는 SFT 예시 최대 3개와 최근 선호 쌍을 시스템 문맥에 넣습니다. 학습을
            기다릴 필요 없이 데이터 효과를 확인할 수 있지만, 이는 가중치 미세조정이 아닌 few-shot
            개인화입니다.
          </p>
          <div className="compare-diagram">
            <div><span>질문</span><strong>사용자 입력</strong></div>
            <span>+</span>
            <div><span>관련 데이터</span><strong>SFT · 선호</strong></div>
            <span>→</span>
            <div><span>로컬 모델</span><strong>{modelMeta.displayName}</strong></div>
          </div>
          <label className="switch-row emphasized">
            <div><strong>채팅 개인화 사용</strong><small>채팅 연구실과 모델 경기장에 적용</small></div>
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
            <div>
              <span className="eyebrow">EVALUATION</span>
              <h3>블라인드 경기 결과</h3>
            </div>
            <Badge tone="accent">{totalVotes} TESTS</Badge>
          </div>
          {totalVotes ? (
            <>
              <div className="win-rate-number">
                <strong>{personalizedWinRate}%</strong>
                <span>개인화 모델 선택률</span>
              </div>
              <div className="bar-chart">
                <ChartBar label="기본 모델" value={baseWins} max={Math.max(baseWins, personalizedWins, 1)} />
                <ChartBar label="개인화 모델" value={personalizedWins} max={Math.max(baseWins, personalizedWins, 1)} accent />
              </div>
              <p className="evaluation-note">
                데이터 효과를 판단하려면 서로 다른 주제에서 최소 10회 이상 블라인드 비교하는 것이 좋습니다.
              </p>
            </>
          ) : (
            <Empty title="평가 기록이 없습니다" description="모델 경기장에서 기본 모델과 개인화 모델을 비교하세요." />
          )}
        </Card>
      </div>

      {!modelMeta.hfModelId ? (
        <div className="global-error training-model-warning">
          <strong>LoRA 원본 모델 ID가 필요합니다.</strong>
          <span>상단 모델 설정에서 Hugging Face 원본 ID를 입력하면 학습 명령에 자동으로 반영됩니다.</span>
        </div>
      ) : null}

      <Card className="lora-workflow">
        <div className="section-heading">
          <div>
            <span className="eyebrow">REAL LORA TRAINING</span>
            <h3>RTX GPU에서 실제 LoRA 어댑터 학습</h3>
          </div>
          <Badge tone="accent">{modelMeta.displayName}</Badge>
        </div>
        <div className="workflow-steps">
          <WorkflowStep number="1" title="데이터 내보내기" description="웹앱에서 만든 SFT 데이터를 JSONL로 저장합니다.">
            <div className="inline-buttons">
              <Button size="sm" variant="secondary" icon="download" onClick={() => exportSftJsonl(state.sftExamples)} disabled={!state.sftExamples.length}>SFT JSONL</Button>
              <Button size="sm" variant="secondary" icon="download" onClick={() => exportPreferenceJsonl(state.preferences)} disabled={!state.preferences.length}>선호 JSONL</Button>
              <Button size="sm" variant="ghost" icon="download" onClick={() => exportBundle(state)}>전체 백업</Button>
            </div>
          </WorkflowStep>
          <WorkflowStep number="2" title="Python 환경 설치" description="프로젝트의 trainer 폴더에서 PowerShell 명령을 실행합니다.">
            <CommandBox text={installCommand} copied={copied === "install"} onCopy={() => copy("install", installCommand)} />
          </WorkflowStep>
          <WorkflowStep number="3" title="LoRA 학습" description={`기본값은 r=8, 3 epoch입니다. ${modelMeta.params} 모델은 클수록 더 많은 GPU 메모리와 시간이 필요합니다.`}>
            <CommandBox text={trainCommand} copied={copied === "train"} onCopy={() => copy("train", trainCommand)} />
          </WorkflowStep>
          <WorkflowStep number="4" title="기본 모델과 비교 평가" description="학습 데이터 일부를 테스트 프롬프트로 사용해 결과 파일을 만듭니다.">
            <CommandBox text={evalCommand} copied={copied === "eval"} onCopy={() => copy("eval", evalCommand)} />
          </WorkflowStep>
        </div>
      </Card>

      <div className="training-notes">
        <Card>
          <span className="eyebrow">WHY THIS MODEL?</span>
          <h3>현재 선택: {modelMeta.displayName}</h3>
          <ul>
            <li>브라우저에서는 4비트 WebLLM 모델을 사용해 서버 없이 추론합니다.</li>
            <li>프리셋은 0.5B·1.5B·3B 중 속도와 품질에 맞게 교체할 수 있습니다.</li>
            <li>LoRA 학습은 화면에 설정된 Hugging Face 원본 모델 ID를 명령에 자동 반영합니다.</li>
            <li>사용자 지정 모델은 해당 모델의 라이선스와 LoRA 호환성을 별도로 확인해야 합니다.</li>
          </ul>
        </Card>
        <Card>
          <span className="eyebrow">IMPORTANT LIMIT</span>
          <h3>웹 배포와 LoRA의 경계</h3>
          <p>
            Vercel에 배포된 웹사이트는 브라우저 안에서 추론하지만 LoRA 훈련은 사용자의 Python 환경에서
            실행됩니다. 학습된 어댑터를 브라우저 모델로 배포하려면 기본 모델과 병합한 뒤 MLC 형식으로
            변환해야 하므로, 이 프로젝트에서는 로컬 Python 평가까지 자동화했습니다.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Factor({ label, current, target, suffix = "개" }) {
  const value = Math.min(100, Math.round((current / target) * 100));
  return (
    <div className="factor-row">
      <div><span>{label}</span><strong>{current}{suffix} / 권장 {target}{suffix}</strong></div>
      <Progress value={value} />
    </div>
  );
}

function ChartBar({ label, value, max, accent = false }) {
  return (
    <div className={`chart-bar-row ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <div><i style={{ width: `${(value / max) * 100}%` }} /></div>
      <strong>{value}승</strong>
    </div>
  );
}

function WorkflowStep({ number, title, description, children }) {
  return (
    <div className="workflow-step">
      <span className="workflow-number">{number}</span>
      <div><strong>{title}</strong><p>{description}</p>{children}</div>
    </div>
  );
}

function CommandBox({ text, onCopy, copied }) {
  return (
    <div className="command-box">
      <code>{text}</code>
      <button onClick={onCopy}>{copied ? "복사됨" : "복사"}</button>
    </div>
  );
}
