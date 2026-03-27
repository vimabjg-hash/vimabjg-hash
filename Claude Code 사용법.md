디렉터, STAGE 3 시작합니다.

Claude Code는 터미널에서 실행하는 도구입니다. 순서대로 따라오세요.

---

## STEP 1 — Claude Code 설치 (최초 1회)

터미널(PowerShell) 열고 아래 입력:

```powershell
npm install -g @anthropic-ai/claude-code
```

설치 확인:

```powershell
claude --version
```

---

## STEP 2 — Aurora 폴더로 이동

```powershell
cd aurora
claude
```

🟢 `claude` 입력하면 Claude Code가 실행됩니다.

---

## STEP 3 — Claude Code에 붙여넣을 첫 프롬프트

아래를 **통째로 복사**해서 Claude Code에 붙여넣으세요:

```
[Aurora 프로젝트 초기 세팅]

나는 크롬 확장 프로그램 Aurora를 만들고 있어.
아래 조건으로 프로젝트를 세팅해줘.

환경:
- MV3 + TypeScript + Vite
- Side Panel 중심 구조
- 2026년 크롬 표준 API인 LanguageModel.create() 방식 사용
- 나 혼자만 사용, 로컬 로드 전용 (스토어 배포 없음)

지금 폴더 구조가 이미 있어. 파일들은 비어있는 상태야.

아래 순서로 하나씩 진행해줘.
각 단계 완료 후 반드시 나한테 확인 받고 다음으로 넘어가.

1단계: package.json 작성
   - vite, vite-plugin-web-extension, typescript 포함
   - marked (마크다운 렌더링용) 포함
   - build 스크립트 포함

2단계: vite.config.ts 작성
   - 멀티 엔트리 설정 (background, content, sidepanel 각각 별도 번들)
   - vite-plugin-web-extension 사용

3단계: tsconfig.json 작성
   - chrome 타입 포함
   - strict 모드

4단계: manifest.json 작성
   - side_panel 권한
   - commands에 Alt+A 단축키
   - outputLanguage 이슈 때문에 한국어 로케일 설정

5단계: npm install 실행하고 결과 알려줘

각 단계마다 "이렇게 작성했습니다. 진행할까요?" 물어봐줘.
```

---

## STEP 4 — 각 단계별 확인 방법

|단계|확인 방법|
|---|---|
|1~4|파일 내용 눈으로 확인|
|5 (npm install)|오류 없으면 `node_modules` 폴더 생김|
|빌드 테스트|`npm run build` → `dist/` 폴더 생기면 성공|

---

## 🚨 막히면 이렇게

**오류 메시지 뜨면** → 오류 내용 그대로 Claude Code에 붙여넣기

**"permission denied" 뜨면:**

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

Claude Code 실행 후 **1단계 완료 메시지** 캡처해서 여기 올려주시면 2단계부터 이어서 도와드릴게요. 🟢