# Aurora — Claude Code 작업 명세서
# 다른 AI가 Claude Code를 통해 Aurora 작업을 진행할 때 사용하는 공식 가이드

---

## 이 문서의 목적

Gemini나 ChatGPT와 함께 Aurora 기능을 설계/기획한 후,
실제 파일 구현과 점검을 Claude Code에게 넘길 때 사용합니다.
이 문서를 Claude Code 새 세션에 붙여넣으면
Aurora의 전체 구조와 규칙을 즉시 파악하고 작업을 시작할 수 있습니다.

---

## 1. 프로젝트 기본 정보 (변경 없이 유지)

Aurora는 개인 전용 크롬 확장 프로그램입니다.

기술 스택은 TypeScript + Vite + @crxjs/vite-plugin + Manifest V3입니다.
React를 사용하지 않습니다. 모든 UI는 순수 DOM 조작 방식으로 만듭니다.
스타일은 css() 헬퍼 함수로 Object.assign(el.style, styles)를 처리합니다.
AI는 Chrome 내장 Gemini Nano를 사용하며 API는 LanguageModel.create()입니다.

---

## 2. 프로젝트 폴더 구조 (현재 기준)

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
    │   ├── sidepanel.html             ← Aurora Chat UI (채팅 말풍선 방식)
    │   ├── main.ts                    ← 사이드패널 진입점
    │   └── sidepanel-app.ts           ← 사이드패널 로직
    └── shared/
        └── types/
            └── index.ts               ← 공용 타입 정의 (ToolbarAction 등)
```

---

## 3. 절대 규칙 (반드시 지켜야 함)

### 규칙 1 — LanguageModel API 방식

아래 방식만 사용합니다. 구버전 window.ai.createTextSession()은 작동하지 않습니다.

```typescript
// ✅ 올바른 방식 (2026 Chrome 표준)
let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
try {
  session = await LanguageModel.create({
    systemPrompt: '당신은 번역가입니다...',
    outputLanguage: 'ja'   // 반드시 'en', 'es', 'ja' 중 하나. 'ko' 불가!
  })
  const result = await session.prompt('번역할 텍스트')
  // 결과 처리...
} catch (err) {
  // 오류 처리...
} finally {
  session?.destroy()  // 반드시 호출! try/finally 패턴 필수
}
```

outputLanguage는 Gemini Nano가 지원하는 값만 허용됩니다.
지원 값: 'en', 'es', 'ja' — 'ko'를 쓰면 크롬 확장 오류 탭에 경고가 쌓입니다.
한국어 출력은 systemPrompt 안의 "반드시 한국어로 답하세요" 지시로 제어합니다.

### 규칙 2 — innerHTML 보안

사용자 입력값이나 AI 결과는 반드시 textContent로 삽입합니다.
innerHTML은 하드코딩된 정적 SVG 문자열에만 허용됩니다.

```typescript
// ✅ 올바름 — 사용자 데이터
resultEl.textContent = aiResult

// ✅ 올바름 — 정적 SVG
btn.innerHTML = `<svg viewBox="0 0 24 24">...</svg>`

// ❌ 금지 — 사용자 데이터를 innerHTML에 직접 삽입
resultEl.innerHTML = aiResult
```

### 규칙 3 — content script에서 외부 fetch 금지

MV3 보안 정책으로 content script(floating-shell.ts, sidepanel-app.ts 등)에서
외부 도메인을 직접 fetch할 수 없습니다.
Notion API, YouTube API 등 외부 요청은 반드시
chrome.runtime.sendMessage()로 background/index.ts에 위임해야 합니다.

```typescript
// ✅ 올바름 — background를 통한 중계
const response = await chrome.runtime.sendMessage({
  type: 'NOTION_SAVE',
  payload: { title, content }
})

// ❌ 금지 — content script에서 직접 외부 호출
const res = await fetch('https://api.notion.com/v1/pages', ...)
```

### 규칙 4 — TypeScript 전용, React 없음

모든 코드는 TypeScript로 작성합니다.
React, Vue 등 프레임워크를 사용하지 않습니다.
UI는 document.createElement()와 DOM 조작으로 직접 만듭니다.

### 규칙 5 — storage area 체크

chrome.storage.onChanged 리스너에서 반드시 area를 체크합니다.

```typescript
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return  // 이 줄 필수!
  // 처리...
})
```

### 규칙 6 — 공용 타입은 shared/types에서만 정의

ToolbarAction 등 여러 파일에서 공통으로 쓰는 타입은
src/shared/types/index.ts 한 곳에만 정의하고 import해서 씁니다.
각 파일에 중복 정의하지 않습니다.

---

## 4. 핵심 메시지 흐름

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

## 5. 뼈대 파일 수정 규칙

뼈대 파일(manifest.json, vite.config.ts, background/index.ts)은
아래 3가지 경우에만 수정합니다.

### 경우 A — 새 권한이 필요할 때 → manifest.json 수정

외부 API 연동, 새 크롬 기능 사용 시 permissions 또는 host_permissions에 추가합니다.

```json
"host_permissions": [
  "https://api.notion.com/*"
]
```

content_scripts에 새 사이트 전용 스크립트가 필요한 경우도 여기에 추가합니다.

```json
{
  "matches": ["https://www.youtube.com/*"],
  "js": ["src/content/youtube-enhancer.ts"],
  "run_at": "document_idle"
}
```

### 경우 B — 새 UI 페이지가 생길 때 → vite.config.ts 수정

vite.config.ts의 ENTRIES 객체에 한 줄만 추가하면 됩니다.

```typescript
const ENTRIES: Record<string, string> = {
  sidepanel: 'src/sidepanel/sidepanel.html',
  popup:     'src/popup/popup.html',       // 새 페이지 추가 시 여기에만 추가
}
```

팝업 페이지를 추가하는 경우 manifest.json의 "action"에도 아래 추가가 필요합니다.

```json
"action": {
  "default_title": "Aurora",
  "default_popup": "src/popup/popup.html"
}
```

### 경우 C — 외부 API 연동이 필요할 때 → background/index.ts 수정

수정 위치는 딱 2곳입니다.

첫 번째로 MessageType 유니온에 새 타입을 추가합니다.

```typescript
export type MessageType =
  | 'OPEN_SIDEPANEL'
  | 'NOTION_SAVE'        // ← 추가
```

두 번째로 HANDLERS 객체에 핸들러를 등록하고 함수를 구현합니다.

```typescript
const HANDLERS: Partial<Record<MessageType, HandlerFn>> = {
  OPEN_SIDEPANEL: handleOpenSidepanel,
  NOTION_SAVE:    handleNotionSave,   // ← 추가
}

async function handleNotionSave(payload: unknown): Promise<AuroraResponse> {
  // 구현
}
```

---

## 6. 스타일 작성 규칙

모든 인라인 스타일은 css() 헬퍼 함수를 사용합니다.

```typescript
// css() 헬퍼 정의 (각 파일 하단에 있음)
function css(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles)
}

// 사용 예시
css(btn, {
  background:   '#313244',
  borderRadius: '6px',
  cursor:       'pointer',
})
```

Aurora 디자인 시스템 색상값은 아래를 참조합니다.
배경색(최외곽)은 #0f111a, 카드 배경은 #1a1c2e, 진한 카드는 #141625입니다.
테두리는 #2d2f45 또는 #3d3f58, 기본 텍스트는 #cdd6f4입니다.
주요 색상인 네온 퍼플은 #8b5cf6이고 네온 핑크는 #ec4899입니다.
비활성 텍스트는 #6c7086, 보조 텍스트는 #bac2de입니다.
성공 색상은 #a6e3a1, 오류 색상은 #f38ba8입니다.
그라데이션은 linear-gradient(135deg, #8b5cf6, #ec4899) 또는
linear-gradient(135deg, #7c3aed, #db2777)를 사용합니다.

---

## 7. 빌드 및 확인 절차

모든 작업 완료 후 반드시 아래 순서로 확인합니다.

1단계로 npm run build를 실행합니다.
2단계로 "✓ 12 modules transformed"와 "built in ~ms"가 출력되면 성공입니다.
3단계로 경고나 에러가 없는지 확인합니다.
4단계로 크롬 확장 프로그램 페이지(chrome://extensions)에서 Aurora를 새로고침합니다.

아래 경고는 무시해도 됩니다. 동작에 영향이 없습니다.
"The CJS build of Vite's Node API is deprecated"

---

## 8. 자주 발생하는 실수 패턴

다른 AI가 코드를 작성할 때 반복적으로 발생하는 실수들입니다.
작업 전 이 패턴들을 숙지하고 의도적으로 피해야 합니다.

패턴 1은 outputLanguage 누락입니다. LanguageModel.create()를 새로 추가할 때
outputLanguage: 'ja'를 빠뜨리는 경우가 많습니다.
빠뜨리면 크롬 확장 오류 탭에 경고가 지속적으로 쌓입니다.

패턴 2는 버튼 opacity 미복원입니다. 버튼을 처음 만들 때 disabled + opacity: '0.4'로
설정했다면, 활성화할 때 disabled = false와 함께 반드시 opacity: '1'도 복원해야 합니다.

패턴 3은 storage area 체크 누락입니다. chrome.storage.onChanged 리스너에서
if (area !== 'local') return을 빠뜨리면 다른 저장소 변경에도 반응하여 오작동합니다.

패턴 4는 background 비동기 응답 return true 누락입니다.
chrome.runtime.onMessage.addListener에서 비동기 처리를 할 때
return true를 빠뜨리면 sendResponse가 작동하지 않습니다.
Aurora의 background/index.ts 메인 라우터는 자동 처리하지만,
새 리스너를 별도로 추가할 때 이 패턴을 빠뜨리는 경우가 있습니다.

패턴 5는 content script에서 외부 fetch 직접 호출입니다.
Notion, YouTube 등 외부 도메인 fetch를 floating-shell.ts나
sidepanel-app.ts에서 직접 호출하면 MV3 정책으로 차단됩니다.
반드시 chrome.runtime.sendMessage()로 background/index.ts에 위임해야 합니다.

패턴 6은 공용 타입 중복 정의입니다. ToolbarAction 같은 공용 타입을
각 파일에 새로 정의하지 말고, src/shared/types/index.ts에서 import해야 합니다.

---

## 9. Claude Code 세션 시작 프롬프트 템플릿

### 새 기능 구현 요청 시

```
이 문서(Aurora_ClaudeCode_작업명세서.md)를 먼저 읽어줘.
그다음 src/ 폴더 전체 구조를 파악해줘.

[이번 작업 내용]
(여기에 추가할 기능 설명)

[작업 요청]
1. 어느 파일을 수정하고 어느 파일을 새로 만들어야 하는지 먼저 계획을 세워줘.
2. 명세서의 절대 규칙을 지키면서 구현해줘.
3. 구현 완료 후 npm run build 실행해서 빌드 성공 확인해줘.
```

### 최종 점검 요청 시

```
이 문서(Aurora_ClaudeCode_작업명세서.md)를 먼저 읽어줘.
그다음 src/ 폴더 전체 파일을 읽고 아래 항목을 점검해줘.

1. LanguageModel 세션 누수 — session.destroy()가 try/finally 안에 있는지
2. outputLanguage 누락 — 'ko' 또는 누락된 곳이 있는지
3. innerHTML에 사용자 입력값이 들어가는 곳이 있는지
4. storage.onChanged에서 area !== 'local' 체크가 빠진 곳이 있는지
5. content script에서 외부 fetch를 직접 호출하는 곳이 있는지
6. 공용 타입(ToolbarAction 등)이 shared/types 외에 중복 정의된 곳이 있는지
7. 버튼 disabled 상태와 opacity 시각 표현이 일치하는지

결과를 🔴 즉시 수정 필요 / 🟡 권장 수정 / 🟢 양호 형식으로 정리하고
문제 발견 시 파일명과 줄 번호를 명시한 다음 바로 수정해줘.
수정 완료 후 npm run build 실행해서 빌드 성공 확인해줘.
```

### 뼈대 파일 수정 요청 시

```
이 문서(Aurora_ClaudeCode_작업명세서.md)의 5번 항목을 참고해줘.
(뼈대 파일 수정 요청 내용)

수정 전 반드시:
- 다른 파일에서 이 파일을 참조하는 곳이 있는지 확인해줘.
- 수정이 다른 파일에 영향을 미치는지 체크해줘.

수정 후 npm run build 실행해서 빌드 성공 확인해줘.
```

---

## 10. 현재 구현 완료 기능 (참고용)

텍스트 드래그 → SVG 아이콘 툴바 (번역/요약/다듬기/질문) — 완료
페르소나 선택 2행 (미니멀/비판/정의/마스터) — 완료
AI 팝업 카드 — 원문 표시 + 점 애니메이션 + 결과 + 추가 질문 입력창 — 완료
사이드패널 Aurora Chat — 채팅 말풍선 UI + 슬림 사이드바 — 완료
"패널에서 계속" — 팝업 결과를 사이드패널 말풍선으로 전달 — 완료
background 메시지 라우터 — HANDLERS 패턴으로 확장 준비 완료 — 완료
공용 타입 분리 — src/shared/types/index.ts — 완료

---

## 11. 다음 구현 예정 기능 (PHASE별)

PHASE 1(뼈대 수정 없음)은 저장소 기능, 입력창 감지(MaxAI 방식),
프롬프트 라이브러리, 텍스트 하이라이트 저장입니다.

PHASE 2(manifest.json 권한 추가 필요)는 Notion 연동, Obsidian 연동,
검색 결과 강화(Merlin 방식), YouTube 요약입니다.

PHASE 3(아키텍처 설계 필요)는 여러 AI 동시 팝업, 페이지 전체 컨텍스트 분석입니다.
