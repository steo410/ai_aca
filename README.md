# Local AI Academy v2

브라우저에서 로컬 언어 모델을 실행하고, AI 개념을 게임으로 학습하며, SFT·선호 데이터를 만들어 실제 LoRA 학습까지 연결하는 React/Vite 프로젝트입니다.

## v2에서 추가된 기능

- 저성능·중간·고성능 모델 프리셋
- 기본 모델을 1.5B 중간 모델로 변경
- 모델 전환 시 기존 Web Worker와 엔진 자동 해제
- WebLLM 내장 모델 ID 직접 선택
- 직접 변환한 MLC 모델 URL과 WASM library 입력
- 사용자 지정 모델의 Hugging Face 원본 ID 저장
- LoRA 학습 명령에 현재 선택 모델 자동 반영
- GitHub–Vercel 배포 문서와 자동 배포 배치 파일

## 모델 프리셋

| 등급 | 브라우저 모델 ID | Hugging Face 원본 | 예상 GPU 메모리 |
|---|---|---|---:|
| 저성능 | `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | `Qwen/Qwen2.5-0.5B-Instruct` | 약 0.95GB |
| 중간 | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | `Qwen/Qwen2.5-1.5B-Instruct` | 약 1.63GB |
| 고성능 | `Qwen2.5-3B-Instruct-q4f16_1-MLC` | `Qwen/Qwen2.5-3B-Instruct` | 약 2.50GB |

기본 선택은 **중간 Qwen2.5 1.5B**입니다. RTX 5070 Laptop GPU에서는 고성능 3B 프리셋도 충분히 실험할 수 있지만, 사이트를 방문하는 다른 사용자의 기기까지 고려하면 중간 프리셋이 가장 균형적입니다.

세 Qwen 프리셋은 WebLLM 내장 목록 존재 여부에 의존하지 않도록 공식 MLC 가중치 URL과 `@mlc-ai/web-llm` 0.2.84에 맞는 WebGPU WASM library URL을 프로젝트에 함께 정의했습니다. 패키지 버전도 정확히 `0.2.84`로 고정되어 있습니다.

## 주요 기능

### 1단계: 로컬 AI 실험

- WebGPU 기반 브라우저 로컬 추론
- 시스템 프롬프트 설정
- Temperature, Top-p, 최대 출력 토큰 조절
- 스트리밍 답변
- 생성 시간, 출력 토큰, 토큰 속도 표시
- 모델 답변을 SFT 예시로 저장
- 답변을 교정해 chosen/rejected 선호 쌍 생성

### 2단계: 게임형 학습

- 다음 토큰 연구소
- 환각 탐정
- 프롬프트 던전
- XP와 미션 점수
- 기본 문맥과 개인화 문맥의 블라인드 A/B 테스트

### 3단계: 데이터와 LoRA

- SFT 데이터 작성·수정·삭제
- 선호 데이터 관리
- JSONL 내보내기
- 데이터 품질 점수
- 브라우저 few-shot 개인화
- 실제 PEFT LoRA 학습기
- 기본 모델과 LoRA 모델 비교 평가
- 학습 어댑터 터미널 채팅

## 로컬 실행

Windows에서는 다음 파일을 실행합니다.

```text
start_windows.bat
```

또는 프로젝트 폴더에서 직접 실행합니다.

```powershell
npm install
npm run dev
```

빌드 확인:

```powershell
npm run build
npm run preview
```

## 모델 변경

1. 화면 상단의 **사용 모델**을 누릅니다.
2. 저성능·중간·고성능 프리셋 중 하나를 선택합니다.
3. **선택 저장**을 누릅니다.
4. **선택 모델 불러오기**를 누릅니다.

사용자 지정 모델에서는 다음 두 방식을 지원합니다.

- WebLLM 내장 모델: 모델 ID만 입력
- 직접 변환한 모델: 모델 ID, MLC 모델 URL, model library WASM URL 입력

일반 Hugging Face 모델을 브라우저에서 바로 실행하는 것은 불가능합니다. 사용자 모델은 WebLLM과 호환되는 MLC 형식이어야 합니다.

## LoRA 학습

웹앱에서 SFT JSONL을 내보내 `exports/sft_train.jsonl`에 넣습니다.

```powershell
cd trainer
Set-ExecutionPolicy -Scope Process Bypass
.\setup_windows.ps1
```

0.5B 예시:

```powershell
python train_lora.py --data ..\exports\sft_train.jsonl --model "Qwen/Qwen2.5-0.5B-Instruct" --output outputs\academy-0.5b-lora
```

1.5B 예시:

```powershell
python train_lora.py --data ..\exports\sft_train.jsonl --model "Qwen/Qwen2.5-1.5B-Instruct" --output outputs\academy-1.5b-lora
```

3B 예시:

```powershell
python train_lora.py --data ..\exports\sft_train.jsonl --model "Qwen/Qwen2.5-3B-Instruct" --output outputs\academy-3b-lora
```

훈련기는 `target_modules="all-linear"`를 사용하므로 여러 Transformer causal language model에 적용하기 쉬운 구조입니다. 다만 모든 사용자 지정 모델이 동일한 채팅 템플릿이나 PEFT 구조를 지원하는 것은 아니므로 모델 설명서를 확인해야 합니다.

## 배포

자세한 과정은 다음 문서를 참고합니다.

- [`DEPLOY_KO.md`](./DEPLOY_KO.md)
- [`MODEL_GUIDE_KO.md`](./MODEL_GUIDE_KO.md)

가장 간단한 방법:

1. GitHub 저장소에 프로젝트 업로드
2. Vercel에서 저장소 Import
3. Framework `Vite`
4. Build Command `npm run build`
5. Output Directory `dist`
6. Deploy

CLI 방식:

```powershell
npm install -g vercel
vercel login
vercel --prod
```

또는 `deploy_vercel.bat`을 실행합니다.

## 중요한 배포 특성

- Vercel은 모델을 실행하지 않습니다.
- 모델은 각 방문자의 브라우저가 내려받습니다.
- 추론은 방문자의 GPU에서 처리됩니다.
- 별도 AI API 키가 필요하지 않습니다.
- 실제 LoRA 학습은 사용자의 Python 환경에서 실행됩니다.
- 사용자 지정 모델의 라이선스와 배포 허용 조건은 직접 확인해야 합니다.

## 프로젝트 구조

```text
local-ai-academy/
├─ src/
│  ├─ components/
│  │  ├─ ModelManager.jsx
│  │  ├─ ChatLab.jsx
│  │  ├─ DatasetLab.jsx
│  │  ├─ Games.jsx
│  │  ├─ Arena.jsx
│  │  └─ TrainingLab.jsx
│  └─ lib/
│     ├─ models.js
│     ├─ localModel.js
│     ├─ llmWorker.js
│     ├─ personalization.js
│     └─ storage.js
├─ trainer/
├─ exports/
├─ DEPLOY_KO.md
├─ deploy_vercel.bat
├─ start_windows.bat
├─ vercel.json
└─ package.json
```
