# Aurora — 마스터 명세서 v1.0
> 세 AI(Claude · ChatGPT · Gemini)의 명세서를 하나로 통합한 공식 문서입니다.
> 새 AI에게 Aurora 작업을 넘길 때 이 파일 하나만 붙여넣으면 됩니다.

---

## 0. 새 AI에게 바로 붙여넣을 시작 문장

```
나는 Aurora 크롬 확장 프로그램을 만들고 있다.
이 문서(Aurora_마스터_명세서_v1.md)를 먼저 전부 읽어줘.

절대 원칙:
1. Aurora는 모든 사이트에서 읽기 모드 / 쓰기 모드 기능이 정상 작동해야 한다.
2. 쓰기 모드에서는 입력/커서/포커스를 절대 방해하면 안 된다.
3. 명세서는 작은 단위로 쪼개서 하나씩 점검하는 방식으로 진행한다.
4. 특정 사이트만 되고 다른 사이트에서 안 되면 실패로 본다.

진행 방식:
1. 내 요청을 어떻게 이해했는지 먼저 요약해줘.
2. 수정 범위 / 제외 범위를 정리해줘.
3. 진행 방향을 제안해줘.
4. 내가 확인한 뒤에만 실제 구현을 시작해줘.
```

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 이름 | Aurora (오로라) |
| 종류 | 개인 전용 크롬 확장 프로그램 |
| 핵심 가치 | 웹 서핑·문서 작성·영상 시청 등 모든 브라우저 경험을 돕는 올인원 개인 AI 비서 |
| 플랫폼 | Google Chrome Extension — Manifest V3 (MV3) |
| 기술 스택 | TypeScript + Vite + @crxjs/vite-plugin |
| UI 원칙 | No React. 순수 DOM 조작(Vanilla TS)만 사용 |
| 스타일 | `css()` 헬퍼 함수로 `Object.assign(el.style, styles)` 처리 |
| AI 엔진 | Chrome 내장 Gemini Nano — `LanguageModel.create()` API |

---

## 2. 폴더 구조 (현재 기준)

```
aurora/
├── manifest.json               ← MV3 설정, 권한, 단축키
├── vite.config.ts              ← ENTRIES 객체로 빌드 진입점 관리
├── package.json
├── tsconfig.json
├── dist/                       ← 빌드 결과물 (크롬에 로드하는 폴더)
└── src/
    ├── background/
    │   └── index.ts            ← 메시지 라우터 + 외부 API 중계
    ├── content/
    │   ├── index.ts            ← 텍스트 선택 감지 진입점
    │   ├── selection/
    │   │   ├── selection-observer.ts   ← mouseup 이벤트 감지
    │   │   └── selection-toolbar.ts   ← 드래그 툴바 UI (SVG 아이콘)
    │   └── ui/
    │       └── floating-shell.ts      ← AI 팝업 카드
    ├── sidepanel/
    │   ├── sidepanel.html             ← Aurora Chat UI (채팅 말풍선)
    │   ├── main.ts                    ← 사이드패널 진입점
    │   └── sidepanel-app.ts           ← 사이드패널 로직
    └── shared/
        └── types/
            └── index.ts               ← 공용 타입 정의 (ToolbarAction 등)
```

---

## 3. 절대 규칙 (반드시 지켜야 함)

### 규칙 1 — LanguageModel API 방식

구버전 `window.ai.createTextSession()`은 작동하지 않습니다. 아래 방식만 사용합니다.

```typescript
// ✅ 올바른 방식 (2026 Chrome 표준)
let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
try {
  session = await LanguageModel.create({
    systemPrompt: `
      당신은 번역가입니다.
      반드시 한국어로만 답하세요. 절대 일본어를 섞지 마세요.
      ${STRICT_LANGUAGE_RULE}
    `,
    outputLanguage: 'ja'   // ← 아래 언어 설정 규칙 참고
  })
  const result = await session.prompt('번역할 텍스트')
} catch (err) {
  // 오류 처리
} finally {
  session?.destroy()  // 반드시 호출! try/finally 필수
}
```

**언어 설정 규칙 (중요 업데이트)**

| 환경 | outputLanguage 값 | 비고 |
|---|---|---|
| 일반 Chrome (기본) | `'ja'` | `'ko'` 쓰면 오류 탭에 경고 누적 |
| Chrome Canary (Multilingual 플래그 활성화) | `'ko'` | 경고만 뜨고 정상 작동 |

한국어 출력은 `outputLanguage` 설정과 별개로, `systemPrompt` 안에 반드시 한국어 강제 지시를 포함해야 합니다.

```typescript
const STRICT_LANGUAGE_RULE = `
  [언어 규칙]
  - 반드시 한국어로만 답할 것
  - 절대 일본어(ひらがな, カタカナ, 漢字)를 섞지 말 것
  - 영어 전문 용어는 한국어 번역 후 괄호 안에 원어 표기 가능
`
```

### 규칙 2 — [RESULT] 태그 추출

AI 응답에서 서론/결론을 제거하고 핵심만 출력합니다.

```typescript
// 시스템 프롬프트에 포함
"반드시 [RESULT]와 [/RESULT] 태그 사이에만 최종 답변을 작성하세요."

// 추출 함수
function extractResult(text: string): string {
  const match = text.match(/\[RESULT\]([\s\S]*?)\[\/RESULT\]/)
  return match ? match[1].trim() : text
}

// sanitize (showResult 진입 시 최종 제거 보강)
function sanitizeResult(text: string): string {
  return text
    .replace(/\[RESULT\]/g, '')
    .replace(/\[\/RESULT\]/g, '')
    .trim()
}
```

### 규칙 3 — 인칭 보존 (Identity Guard)

한국어 답변 시 AI가 '나/너'를 '저/당신'으로 임의 수정하는 것을 방지합니다.

```typescript
// 시스템 프롬프트에 포함
"원문의 인칭(나, 너, 우리 등)을 절대 바꾸지 마세요."
```

### 규칙 4 — innerHTML 보안

```typescript
// ✅ 사용자 데이터 → textContent
resultEl.textContent = aiResult

// ✅ 정적 SVG만 → innerHTML 허용
btn.innerHTML = `<svg viewBox="0 0 24 24">...</svg>`

// ❌ 금지
resultEl.innerHTML = aiResult
```

### 규칙 5 — content script에서 외부 fetch 금지

```typescript
// ✅ background를 통한 중계
const response = await chrome.runtime.sendMessage({
  type: 'NOTION_SAVE',
  payload: { title, content }
})

// ❌ 금지 (MV3 보안 정책으로 차단됨)
const res = await fetch('https://api.notion.com/v1/pages', ...)
```

### 규칙 6 — storage area 체크

```typescript
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return  // 이 줄 필수!
  // 처리...
})
```

### 규칙 7 — TypeScript 전용, React 없음

모든 코드는 TypeScript로 작성합니다. React, Vue 등 프레임워크 사용 금지.
UI는 `document.createElement()`와 DOM 조작으로 직접 만듭니다.

### 규칙 8 — 공용 타입은 shared/types에서만 정의

`ToolbarAction` 등 공통 타입은 `src/shared/types/index.ts` 한 곳에만 정의하고 import해서 씁니다.

---

## 4. 읽기 모드 / 쓰기 모드 정의

Aurora의 핵심 기준은 **사이트별 분기가 아니라 모드 기준 분기**입니다.

### 읽기 모드 (Read Mode)

사용자가 "읽을 텍스트"를 보고 있거나 드래그한 상태.

**해당 상황:** 기사 본문, 블로그 글, 일반 웹페이지 본문, AI 답변 본문, 코드블록 출력 영역

**기대 동작:** 드래그 툴바 표시 → 번역 / 요약 / 질문 / 저장 / 팝업 결과 표시 / 패널에서 계속

### 쓰기 모드 (Write Mode)

사용자가 실제 입력 가능한 영역에서 글을 쓰거나 선택한 상태.

**해당 상황:** `input`, `textarea`, `contenteditable`, `role="textbox"`, 검색창, ChatGPT/Gemini/Claude 입력창, 댓글 작성창, 문서 에디터

**기대 동작:** 입력/커서/포커스 절대 방해 금지 → 다듬기 / 질문 / 바꾸기 / 복사 / 선택 문장 기반 재작성

**실패 판정:** 특정 사이트만 되고 다른 사이트에서 안 되면 실패로 봄.

---

## 5. 핵심 메시지 흐름

```
텍스트 선택
  → content/index.ts (mouseup 감지)
  → selection-toolbar.ts (툴바 표시)
  → 버튼 클릭
  → floating-shell.ts (팝업 생성 + LanguageModel 호출)
  → "패널에서 계속" 클릭
  → chrome.storage.local에 panelContinue 저장
  → chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' })
  → background/index.ts → chrome.sidePanel.open()
  → sidepanel-app.ts → storage.onChanged 감지 → 말풍선 표시
```

---

## 6. 뼈대 파일 수정 규칙

뼈대 파일(`manifest.json`, `vite.config.ts`, `background/index.ts`)은 아래 3가지 경우에만 수정합니다.

### 경우 A — 새 권한이 필요할 때 → manifest.json

```json
"host_permissions": ["https://api.notion.com/*"]

// 새 사이트 전용 스크립트
{
  "matches": ["https://www.youtube.com/*"],
  "js": ["src/content/youtube-enhancer.ts"],
  "run_at": "document_idle"
}
```

### 경우 B — 새 UI 페이지가 생길 때 → vite.config.ts

```typescript
const ENTRIES: Record<string, string> = {
  sidepanel: 'src/sidepanel/sidepanel.html',
  popup:     'src/popup/popup.html',  // 새 페이지는 여기에만 추가
}
```

팝업 추가 시 `manifest.json`의 `"action"`에도 추가 필요:

```json
"action": { "default_title": "Aurora", "default_popup": "src/popup/popup.html" }
```

### 경우 C — 외부 API 연동이 필요할 때 → background/index.ts

수정 위치 딱 2곳:

```typescript
// 1. MessageType 유니온에 추가
export type MessageType = 'OPEN_SIDEPANEL' | 'NOTION_SAVE'

// 2. HANDLERS 객체에 등록
const HANDLERS: Partial<Record<MessageType, HandlerFn>> = {
  OPEN_SIDEPANEL: handleOpenSidepanel,
  NOTION_SAVE:    handleNotionSave,
}

async function handleNotionSave(payload: unknown): Promise<AuroraResponse> {
  // 구현
}
```

---

## 7. 디자인 시스템 (색상 팔레트)

| 역할 | 색상값 |
|---|---|
| 배경 (최외곽) | `#0f111a` |
| 카드 배경 | `#1a1c2e` |
| 진한 카드 | `#141625` |
| 테두리 | `#2d2f45` / `#3d3f58` |
| 기본 텍스트 | `#cdd6f4` |
| 보조 텍스트 | `#bac2de` |
| 비활성 텍스트 | `#6c7086` |
| 네온 퍼플 (주) | `#8b5cf6` |
| 네온 핑크 (주) | `#ec4899` |
| 성공 | `#a6e3a1` |
| 오류 | `#f38ba8` |
| 그라데이션 | `linear-gradient(135deg, #8b5cf6, #ec4899)` |

---

## 8. 빌드 및 확인 절차

```bash
npm run build
# "✓ 12 modules transformed" + "built in ~ms" → 성공
# 아래 경고는 무시 (동작 무관)
# "The CJS build of Vite's Node API is deprecated"
```

빌드 후 `chrome://extensions`에서 Aurora를 새로고침합니다.

---

## 9. 자주 발생하는 실수 패턴 (작업 전 필독)

| # | 패턴 | 내용 |
|---|---|---|
| 1 | outputLanguage 누락 | `LanguageModel.create()` 새로 추가 시 `outputLanguage` 빠뜨리면 오류 탭에 경고 누적 |
| 2 | 버튼 opacity 미복원 | `disabled + opacity: '0.4'` 설정 시 활성화 때 `opacity: '1'` 함께 복원 필수 |
| 3 | storage area 체크 누락 | `onChanged` 리스너에 `if (area !== 'local') return` 빠지면 오작동 |
| 4 | return true 누락 | 비동기 `onMessage` 핸들러에서 `return true` 빠뜨리면 `sendResponse` 작동 안 함 |
| 5 | content script 직접 fetch | Notion/YouTube 등 외부 fetch를 content script에서 직접 호출하면 MV3 정책으로 차단 |
| 6 | 공용 타입 중복 정의 | `ToolbarAction` 등을 각 파일에 새로 정의하지 말고 `shared/types`에서 import |

---

## 10. 현재 구현 완료 기능

| 기능 | 상태 |
|---|---|
| 텍스트 드래그 → SVG 아이콘 툴바 (번역/요약/다듬기/질문) | ✅ 완료 |
| 페르소나 선택 2행 (미니멀/비판/정의/마스터) | ✅ 완료 |
| AI 팝업 카드 (원문 + 점 애니메이션 + 결과 + 추가 질문 입력창) | ✅ 완료 |
| 팝업 560px 대형 패널 + 우하단 리사이즈 핸들 + 크기 기억 | ✅ 완료 |
| followUpInput 자동 높이 확장 | ✅ 완료 |
| 사이드패널 Aurora Chat (채팅 말풍선 + 슬림 사이드바) | ✅ 완료 |
| "패널에서 계속" — 팝업 결과를 사이드패널 말풍선으로 전달 | ✅ 완료 |
| background 메시지 라우터 (HANDLERS 패턴) | ✅ 완료 |
| 공용 타입 분리 (`src/shared/types/index.ts`) | ✅ 완료 |
| 입력 안정성 P1 해결 (ChatGPT/Gemini/Google/네이버 입력창 정상) | ✅ 완료 |
| [RESULT] 태그 sanitize + 최종 제거 보강 | ✅ 완료 |
| STRICT_LANGUAGE_RULE 한국어 강제 주입 | ✅ 완료 |

---

## 11. 현재 남아있는 이슈

| 이슈 | 내용 |
|---|---|
| ChatGPT 코드블록 모드 오분류 | 코드블록 영역이 쓰기 모드로 잘못 분류되던 문제 → 보정 진행 중, 최종 확인 필요 |
| 쓰기 모드 전체 사이트 안정화 | ProseMirror, Slate, Lexical, Monaco, CodeMirror 등 에디터 계열 점검 필요 |
| 바꾸기(replace) 신뢰성 | 원문 영역 미발견 / source metadata 손실 가능성. 실패 시 버튼 라벨 변경 금지, 실패 이유를 status 문구로 표시 |
| 드래그 후 우클릭 | 우클릭 시 selection snapshot이 사라질 수 있음 → Aurora 내부 snapshot은 유지해야 함 |

---

## 12. 다음 구현 예정 기능 (PHASE별)

### PHASE 1 — 뼈대 파일 수정 없음

- 저장소 기능 (하이라이트 저장)
- 입력창 감지 (MaxAI 방식)
- 프롬프트 라이브러리 (슬래시 명령어: `/요약` `/번역` `/코드` `/메일`)
- 텍스트 하이라이트 저장

### PHASE 2 — manifest.json 권한 추가 필요

- Notion 연동
- Obsidian 연동
- YouTube 영상 요약 (메타데이터 추출 → 사이드패널 자동 요약)
- 검색 결과 강화 (Merlin 방식)
- 우클릭 컨텍스트 메뉴 (요약하기 / 번역하기)

### PHASE 3 — 아키텍처 설계 필요

- 여러 AI 동시 팝업
- 페이지 전체 컨텍스트 분석 (최대 3만 자 추출 → AI 전달)
- Cloud AI 연동 (Gemini 2.5 Flash)

---

## 13. Claude Code 세션 시작 프롬프트 템플릿

### 새 기능 구현 요청 시

```
Aurora_마스터_명세서_v1.md를 먼저 읽어줘.
그다음 src/ 폴더 전체 구조를 파악해줘.

[이번 작업 내용]
(여기에 추가할 기능 설명)

[작업 요청]
1. 어느 파일을 수정하고 어느 파일을 새로 만들어야 하는지 계획을 먼저 세워줘.
2. 명세서의 절대 규칙(특히 규칙 1~8)을 지키면서 구현해줘.
3. 구현 완료 후 npm run build 실행해서 빌드 성공 확인해줘.
```

### 최종 점검 요청 시

```
Aurora_마스터_명세서_v1.md를 먼저 읽어줘.
그다음 src/ 폴더 전체 파일을 읽고 아래 항목을 점검해줘.

1. LanguageModel 세션 누수 — session.destroy()가 try/finally 안에 있는지
2. outputLanguage 누락 또는 잘못된 값 ('ko' 일반 환경에서 사용 금지)
3. 한국어 강제 지시(STRICT_LANGUAGE_RULE)가 systemPrompt에 포함되어 있는지
4. [RESULT] 태그 추출 + sanitize가 모든 경로에 적용되어 있는지
5. innerHTML에 사용자 입력값이 들어가는 곳이 있는지
6. storage.onChanged에서 area !== 'local' 체크가 빠진 곳이 있는지
7. content script에서 외부 fetch를 직접 호출하는 곳이 있는지
8. 공용 타입(ToolbarAction 등)이 shared/types 외에 중복 정의된 곳이 있는지
9. 버튼 disabled 상태와 opacity 시각 표현이 일치하는지

결과를 🔴 즉시 수정 필요 / 🟡 권장 수정 / 🟢 양호 형식으로 정리하고
문제 발견 시 파일명과 줄 번호를 명시한 다음 바로 수정해줘.
수정 완료 후 npm run build 실행해서 빌드 성공 확인해줘.
```

### 뼈대 파일 수정 요청 시

```
Aurora_마스터_명세서_v1.md의 6번 항목(뼈대 파일 수정 규칙)을 참고해줘.
(뼈대 파일 수정 요청 내용)

수정 전 반드시:
- 다른 파일에서 이 파일을 참조하는 곳이 있는지 확인해줘.
- 수정이 다른 파일에 영향을 미치는지 체크해줘.

수정 후 npm run build 실행해서 빌드 성공 확인해줘.
```

---

## 14. 다음 작업 우선순위 추천 순서

```
1순위 — 쓰기 모드 전체 사이트 안정화
        (sourceMeta 안정화, replace 신뢰성, 에디터 계열 점검)

2순위 — ChatGPT/Claude 등 AI 사이트 경계 정리
        (본문/코드블록/입력 composer 오분류 완전 제거)

3순위 — 팝업 하단 composer UI 개선
        (Sider/Monica 스타일, 상태 문구 / 결과 / 추가 질문 입력 분리)

4순위 — 툴바 고도화
        (읽기/쓰기 버튼 세트 확장, shorter/longer/tone 구현)
```

---

## 15. 빌드 상태 (최신 기준)

| 항목 | 상태 |
|---|---|
| 빌드 | ✅ 성공 |
| 에러 | ✅ 없음 |
| 경고 | ✅ 없음 (Vite CJS 경고는 무시) |
