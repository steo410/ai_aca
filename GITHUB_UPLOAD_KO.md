# GitHub 웹 업로드 방법

1. 이 ZIP을 압축 해제합니다.
2. `local-ai-academy` 폴더 안으로 들어갑니다.
3. GitHub 저장소에서 **Add file → Upload files**를 누릅니다.
4. 이 폴더 안의 파일과 폴더를 모두 선택해 끌어놓습니다.
5. `Commit changes`를 누릅니다.

## 절대 올리지 않을 폴더

- `node_modules`
- `dist`
- `.venv`
- `outputs`

이 배포판에는 위 폴더가 포함되어 있지 않습니다.

## Vercel 설정

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
