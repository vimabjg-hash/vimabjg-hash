# Aurora 뼈대 확장 가이드
# 새 기능 추가 시 이 문서만 보면 됩니다.

## 이 문서의 목적

Aurora의 뼈대 파일 3개(manifest.json, vite.config.ts, background/index.ts)를
언제, 어떻게 수정해야 하는지 정리한 참조 문서입니다.
Gemini, ChatGPT, Claude 어느 AI에서도 이 문서를 보여주면
뼈대 수정 방법을 정확히 알 수 있습니다.

---

## 뼈대를 건드려야 하는 3가지 경우

### 경우 1 — 새로운 권한이 필요할 때 → manifest.json 수정

크롬 확장 프로그램은 사용할 기능을 미리 manifest.json에 "신고"해야 합니다.
신고하지 않은 기능을 쓰면 크롬이 차단합니다.

아래는 기능별로 manifest.json에 추가해야 할 내용입니다.
해당 기능 구현 시 아래 코드를 복사해서 manifest.json의 해당 배열에 붙여넣으세요.

#### Notion API 연동 시
"permissions" 배열에는 변경 없음.
"host_permissions" 배열에 아래 추가:
```json
"https://api.notion.com/*"
```

#### OpenAI(ChatGPT) API 직접 연동 시
"host_permissions" 배열에 아래 추가:
```json
"https://api.openai.com/*"
```

#### YouTube 자막 가져오기 시
"host_permissions" 배열에 아래 추가:
```json
"https://www.youtube.com/*"
```
content_scripts 배열에 아래 항목 추가:
```json
{
  "matches": ["https://www.youtube.com/*"],
  "js": ["src/content/youtube-enhancer.ts"],
  "run_at": "document_idle"
}
```

#### Google/Naver 검색 결과 강화 시
"host_permissions" 배열에 아래 추가:
```json
"https://www.google.com/*",
"https://search.naver.com/*"
```
content_scripts 배열에 아래 항목 추가:
```json
{
  "matches": [
    "https://www.google.com/search*",
    "https://search.naver.com/*"
  ],
  "js": ["src/content/search-enhancer.ts"],
  "run_at": "document_idle"
}
```

#### 우클릭 메뉴(컨텍스트 메뉴)에 Aurora 추가 시
"permissions" 배열에 아래 추가:
```json
"contextMenus"
```

#### 데스크탑 알림 기능 추가 시
"permissions" 배열에 아래 추가:
```json
"notifications"
```

#### 크롬 툴바 아이콘 클릭 시 팝업창 띄우기
"action" 항목을 아래처럼 수정:
```json
"action": {
  "default_title": "Aurora",
  "default_popup": "src/popup/popup.html"
}
```
주의: vite.config.ts의 ENTRIES에도 popup 항목 추가 필요 (경우 2 참고)

---

### 경우 2 — 새로운 UI 페이지가 생길 때 → vite.config.ts 수정

사이드패널 외에 새로운 HTML 페이지(팝업창, 설정 페이지 등)가 생기면
Vite가 그 파일도 빌드하도록 알려줘야 합니다.
수정 위치는 vite.config.ts의 ENTRIES 객체 딱 한 곳입니다.

현재 ENTRIES:
```typescript
const ENTRIES: Record<string, string> = {
  sidepanel: 'src/sidepanel/sidepanel.html',
}
```

팝업 페이지 추가 시 아래처럼 한 줄 추가:
```typescript
const ENTRIES: Record<string, string> = {
  sidepanel: 'src/sidepanel/sidepanel.html',
  popup:     'src/popup/popup.html',       // ← 이 줄 추가
}
```

설정(옵션) 페이지 추가 시:
```typescript
const ENTRIES: Record<string, string> = {
  sidepanel: 'src/sidepanel/sidepanel.html',
  popup:     'src/popup/popup.html',
  options:   'src/options/options.html',   // ← 이 줄 추가
}
```

새 사이트 전용 content script 추가 시:
```typescript
const ENTRIES: Record<string, string> = {
  sidepanel: 'src/sidepanel/sidepanel.html',
  youtube:   'src/content/youtube-enhancer.ts',  // ← 이 줄 추가
}
```

---

### 경우 3 — background 서비스 워커에 새 역할 추가 시 → background/index.ts 수정

Notion API 호출, YouTube 자막 fetch, 탭 동시 열기처럼
"Aurora 내부에서 외부 서비스와 통신하는 기능"은
반드시 background/index.ts를 통해야 합니다.
(MV3 보안 정책: content script에서 외부 도메인 직접 fetch 불가)

새 기능 추가 시 background/index.ts에서 수정할 위치는 딱 2곳입니다.

#### 수정 위치 1 — MessageType에 새 타입 추가

```typescript
export type MessageType =
  | 'OPEN_SIDEPANEL'
  | 'NOTION_SAVE'          // ← 이 줄 추가
  | 'FETCH_YOUTUBE_TRANSCRIPT'  // ← 이 줄 추가
```

#### 수정 위치 2 — HANDLERS 객체에 핸들러 함수 등록

```typescript
const HANDLERS: Partial<Record<MessageType, HandlerFn>> = {
  OPEN_SIDEPANEL:              handleOpenSidepanel,
  NOTION_SAVE:                 handleNotionSave,          // ← 이 줄 추가
  FETCH_YOUTUBE_TRANSCRIPT:    handleYoutubeTranscript,   // ← 이 줄 추가
}
```

그 다음 파일 아래에 해당 함수를 구현하면 끝입니다.
다른 파일은 전혀 건드릴 필요 없습니다.

#### content script에서 background로 메시지 보내는 방법

새 기능에서 background에 요청을 보낼 때는 아래 패턴을 씁니다:

```typescript
// 어떤 .ts 파일에서든 동일한 방식
const response = await chrome.runtime.sendMessage({
  type: 'NOTION_SAVE',
  payload: {
    apiKey: '사용자_노션_키',
    pageId: '페이지_아이디',
    title: '저장할 제목',
    content: '저장할 내용'
  }
})

if (response.success) {
  console.log('Notion 저장 완료:', response.data)
} else {
  console.error('오류:', response.error)
}
```

---

## 다른 AI에게 뼈대 수정 작업을 맡길 때 프롬프트 템플릿

아래 프롬프트를 복사해서 해당 파일과 함께 ChatGPT나 Gemini에 붙여넣으세요.

### Notion 저장 기능 추가 요청 시 (ChatGPT 권장)

```
나는 Aurora 크롬 확장 프로그램을 개발 중이야.
TypeScript + Vite + Manifest V3 구조야. React는 사용하지 않아.

[첨부 파일]
- manifest.json (현재 뼈대)
- vite.config.ts (현재 빌드 설정)
- background/index.ts (현재 메시지 라우터)
- sidepanel-app.ts (사이드패널 로직)

[요청]
Notion 저장 기능을 추가해줘.

1. manifest.json의 host_permissions 배열에 "https://api.notion.com/*" 추가
2. background/index.ts의 MessageType에 'NOTION_SAVE' 추가
3. background/index.ts의 HANDLERS에 handleNotionSave 등록
4. background/index.ts에 handleNotionSave 함수 구현
   - payload: { apiKey, pageId, title, content }
   - Notion API v2022-06-28 사용
5. sidepanel-app.ts에 "Notion에 저장" 버튼 추가
   - 버튼 클릭 시 chrome.runtime.sendMessage({ type: 'NOTION_SAVE', payload: {...} }) 호출

기존 코드 스타일(메시지 라우터 패턴, TypeScript 타입 정의)을 유지해줘.
수정된 파일 전체를 출력해줘.
```

### YouTube 요약 기능 추가 요청 시 (ChatGPT 권장)

```
나는 Aurora 크롬 확장 프로그램을 개발 중이야.
TypeScript + Vite + Manifest V3 구조야. React는 사용하지 않아.
Chrome 2026 Built-in AI API를 사용해.
LanguageModel.create({ systemPrompt, outputLanguage: 'ja' }) 방식이야.
window.ai.createTextSession()은 구버전이라 사용하지 않아.

[첨부 파일]
- manifest.json
- vite.config.ts
- background/index.ts
- src/content/index.ts

[요청]
YouTube 영상 요약 기능을 추가해줘.

1. manifest.json에 YouTube host_permission 추가
2. manifest.json content_scripts에 YouTube 전용 스크립트 추가
3. vite.config.ts ENTRIES에 youtube-enhancer 항목 추가
4. background/index.ts에 FETCH_YOUTUBE_TRANSCRIPT 핸들러 추가
5. src/content/youtube-enhancer.ts 신규 파일 생성
   - YouTube 영상 페이지에서 자막 데이터 추출
   - Aurora 사이드패널 버튼 삽입 (영상 제목 아래)
   - 버튼 클릭 시 LanguageModel로 자막 요약

기존 Aurora 코드 스타일을 유지해줘.
수정/신규 파일 전체를 출력해줘.
```

---

## 현재 뼈대 파일 상태 요약 (최종 확인용)

manifest.json 핵심 내용:
- permissions: sidePanel, storage, activeTab, scripting, tabs
- host_permissions: [] (비어있음, 외부 API 연동 시 여기에 추가)
- content_scripts: <all_urls> 에 src/content/index.ts
- web_accessible_resources: [] (비어있음)
- action: default_title만 있음 (팝업 없음)

vite.config.ts 핵심 내용:
- ENTRIES 객체에 sidepanel 하나만 있음
- 새 UI 페이지 추가 시 ENTRIES에 한 줄 추가

background/index.ts 핵심 내용:
- MessageType 유니온 타입으로 모든 메시지 타입 관리
- HANDLERS 객체가 메시지 라우터 역할
- 현재 활성 핸들러: OPEN_SIDEPANEL 하나
- 나머지 핸들러 함수들은 주석으로 미리 작성되어 있음
