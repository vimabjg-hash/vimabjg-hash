# Aurora 인계서 — 기능 분석 및 구현 가이드

> **이 문서의 목적:**  
> Aurora 크롬 확장 프로그램의 현재 상태를 파악하고,  
> Sider / Monica / MaxAI / Merlin의 핵심 기능을 분석하여  
> Aurora에 단계적으로 구현하기 위한 완전한 인계서입니다.  
> Gemini, ChatGPT, Claude 어느 AI에서도 이 문서 하나로 작업을 이어받을 수 있습니다.

---

## 1. Aurora 현재 상태 (2026년 3월 기준)

### 기술 스택
- **언어:** TypeScript
- **빌드:** Vite + vite-plugin-web-extension
- **AI:** Chrome 내장 Gemini Nano (`LanguageModel.create()` API, 2026 표준)
- **크롬 확장 규격:** Manifest V3 (MV3)

### 현재 폴더 구조
```
aurora/
├── manifest.json          ← MV3, side_panel 권한, Alt+A 단축키
├── package.json
├── vite.config.ts         ← 멀티 엔트리 빌드 설정
├── dist/                  ← 빌드 결과물 (크롬에 로드하는 폴더)
└── src/
   ├── background/
   │  └── index.ts         ← 패널 열기 (OPEN_SIDEPANEL 메시지 처리)
   ├── content/
   │  ├── index.ts         ← 텍스트 선택 감지 진입점
   │  ├── selection/
   │  │  ├── selection-observer.ts   ← mouseup 이벤트 감지
   │  │  └── selection-toolbar.ts   ← 드래그 툴바 UI
   │  └── ui/
   │     └── floating-shell.ts      ← AI 팝업 카드 + LanguageModel 호출
   ├── sidepanel/
   │  ├── sidepanel.html            ← Aurora Chat UI (채팅 말풍선 방식)
   │  ├── main.ts
   │  └── sidepanel-app.ts          ← 사이드패널 로직
   └── shared/
      └── types/
```

### 현재 구현된 기능 (완성)
- 웹페이지 텍스트 드래그 → 플로팅 툴바 표시
- 툴바 버튼: 번역 / 요약 / 다듬기 / 질문 (SVG 아이콘)
- 페르소나 2행: 미니멀 / 비판 / 정의 / 마스터
- AI 팝업 카드 (floating-shell): 원문 표시 + 로딩 점 애니메이션 + 결과 + 추가 질문 입력창
- 사이드패널 (Aurora Chat): 채팅 말풍선 UI + 슬림 사이드바
- "패널에서 계속" 버튼: 팝업 결과 → 사이드패널으로 전달
- LanguageModel outputLanguage: 'ja' 설정 (Gemini Nano 지원 언어: en/es/ja만 가능)

### 핵심 메시지 흐름
```
텍스트 선택
  → selection-observer.ts (mouseup 감지)
  → selection-toolbar.ts (툴바 표시)
  → 버튼 클릭
  → floating-shell.ts (팝업 + LanguageModel 호출)
  → "패널에서 계속" 클릭
  → chrome.storage.local에 panelContinue 저장
  → chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' })
  → background/index.ts → chrome.sidePanel.open()
  → sidepanel-app.ts → storage.onChanged 감지 → 말풍선 표시
```

### LanguageModel 호출 방식 (2026 표준 — 중요)
```typescript
// ✅ 현재 Aurora에서 사용하는 방식 (이 방식만 사용할 것)
const session = await LanguageModel.create({
  systemPrompt: '당신은 번역가입니다...',
  outputLanguage: 'ja'   // Gemini Nano 지원: en, es, ja 만 가능
})
const result = await session.prompt('번역할 텍스트...')
session.destroy()  // 반드시 호출 (메모리 누수 방지)

// ❌ 구버전 방식 — 사용 금지
// window.ai.createTextSession() 은 더 이상 작동하지 않음
```

---

## 2. 경쟁 앱 기능 분석

### 2-1. Sider
Sider의 핵심 철학은 "웹페이지 어디서든 AI를 꺼내 쓴다"는 것입니다. 가장 특징적인 기능은 **페이지 전체 컨텍스트 인식**입니다. 현재 보고 있는 페이지의 전체 텍스트를 AI에게 전달해서, "이 페이지 요약해줘"나 "이 페이지에서 가격 정보만 뽑아줘" 같은 질문을 할 수 있습니다. 또한 **채팅 히스토리**가 있어서 이전 대화를 불러올 수 있고, YouTube 영상 자막을 자동으로 가져와서 요약해주는 **YouTube 요약** 기능도 있습니다.

### 2-2. Monica
Monica의 특징은 **다양한 AI 모델 선택**입니다. GPT-4, Claude, Gemini를 스위칭하면서 쓸 수 있고, **프롬프트 라이브러리**에 자주 쓰는 프롬프트를 저장해두고 클릭 한 번으로 실행합니다. 또한 웹페이지를 읽는 것을 넘어서 **PDF 파일 분석**, 이미지에서 텍스트를 뽑는 **OCR 기능**도 제공합니다. 사이드바가 항상 열려 있는 **상주형 패널** 방식이 특징입니다.

### 2-3. MaxAI
MaxAI는 **입력창 감지**가 핵심입니다. Gmail, Twitter, LinkedIn 등 어느 사이트의 텍스트 입력창에서든 Aurora 버튼이 나타나서 "이 내용 다듬어줘", "더 전문적으로 바꿔줘" 같은 작업을 바로 실행합니다. **번역 오버레이** 기능도 강력한데, 페이지의 모든 텍스트를 그 자리에서 번역된 텍스트로 교체해서 보여줍니다.

### 2-4. Merlin
Merlin은 **검색 결과 강화**가 특기입니다. Google, Naver 등 검색 결과 페이지 옆에 자동으로 AI 요약이 붙어서 나옵니다. 또한 **유튜브 댓글 요약**, **GitHub 코드 설명** 같이 특정 사이트에 특화된 기능들이 있습니다.

---

## 3. Aurora 구현 로드맵 (우선순위 순)

> **구현 난이도 기준**
> - 🟢 쉬움: 기존 파일에 코드 추가, 뼈대 수정 없음
> - 🟡 중간: manifest.json 권한 추가 필요
> - 🔴 어려움: 새 아키텍처 설계 필요

---

### PHASE 1 — 지금 당장 구현 가능 (뼈대 수정 없음)

#### 기능 1: 사이드바 저장소 🟢
**참고 앱:** Sider, Monica  
**설명:** AI 결과를 사이드패널 안에 저장해두는 기능입니다. "저장" 버튼을 누르면 `chrome.storage.local`에 보관되고, 슬림 사이드바의 히스토리 버튼(🕐)을 누르면 저장된 내용 목록이 나타납니다.  
**수정 파일:**
- `src/sidepanel/sidepanel-app.ts` — 저장/불러오기 함수 추가
- `src/sidepanel/sidepanel.html` — 저장소 탭 UI 추가
```typescript
// 저장 함수 예시
async saveResult(action: string, text: string, result: string) {
  const items = await chrome.storage.local.get('savedItems')
  const list = items['savedItems'] ?? []
  list.unshift({ id: Date.now(), action, text, result, date: new Date().toISOString() })
  await chrome.storage.local.set({ savedItems: list.slice(0, 100) }) // 최대 100개
}
```

#### 기능 2: 입력창 감지 (MaxAI 방식) 🟢
**참고 앱:** MaxAI  
**설명:** 웹페이지의 `<textarea>`, `<input>`, contenteditable 요소에 포커스하면 Aurora 버튼이 옆에 나타납니다. 버튼 클릭 시 입력창 내용을 가져와서 다듬기/번역을 바로 실행합니다.  
**수정 파일:**
- `src/content/index.ts` — input focus 이벤트 리스너 추가
- `src/content/ui/` — `input-helper.ts` 신규 파일 생성

#### 기능 3: 프롬프트 라이브러리 🟢
**참고 앱:** Monica  
**설명:** 자주 쓰는 프롬프트를 저장해두고 목록에서 클릭 한 번으로 실행합니다. 기본 프롬프트 10개를 내장하고, 사용자가 직접 추가할 수 있습니다.  
**수정 파일:**
- `src/sidepanel/sidepanel-app.ts` — 라이브러리 렌더 함수 추가
- `src/sidepanel/sidepanel.html` — 라이브러리 탭 UI 추가

#### 기능 4: 텍스트 하이라이트 저장 🟢
**참고 앱:** Sider  
**설명:** 드래그한 텍스트에 형광펜 색상을 입히고 저장합니다. 페이지를 다시 방문했을 때 하이라이트가 유지됩니다.  
**수정 파일:**
- `src/content/selection/selection-toolbar.ts` — 하이라이트 버튼 추가
- `src/content/ui/highlighter.ts` — 신규 파일 생성

---

### PHASE 2 — manifest.json 권한 추가 필요

#### 기능 5: Notion 연동 🟡
**참고 앱:** Sider (외부 저장소 연동)  
**설명:** Aurora 저장소의 내용을 Notion 페이지로 내보냅니다. 사용자가 Notion API 키와 대상 페이지 ID를 Aurora 설정에 입력해두면, "Notion에 저장" 버튼 하나로 자동 전송됩니다.  
**manifest.json 추가 권한:**
```json
"host_permissions": [
  "https://api.notion.com/*"
]
```
**수정/신규 파일:**
- `src/shared/notion-client.ts` — Notion API 통신 함수
- `src/sidepanel/sidepanel-app.ts` — "Notion에 저장" 버튼 연결

#### 기능 6: Obsidian 연동 🟡
**참고 앱:** 없음 (Aurora 차별화 기능)  
**설명:** Obsidian URI 스킴을 이용해서 로컬 Obsidian Vault에 노트를 생성합니다. `obsidian://new?vault=내볼트&name=제목&content=내용` 방식으로 동작합니다.  
**manifest.json 추가 권한:**
```json
"permissions": ["...", "tabs"]
```
**수정/신규 파일:**
- `src/shared/obsidian-client.ts` — URI 스킴 생성 함수

#### 기능 7: 검색 결과 강화 (Merlin 방식) 🟡
**참고 앱:** Merlin  
**설명:** Google/Naver 검색 결과 페이지 우측에 Aurora의 AI 요약이 자동으로 표시됩니다.  
**manifest.json 추가 권한:**
```json
"content_scripts": [
  {
    "matches": ["https://www.google.com/search*", "https://search.naver.com/*"],
    "js": ["search-enhancer.js"]
  }
]
```
**신규 파일:**
- `src/content/search-enhancer.ts`

#### 기능 8: YouTube 요약 🟡
**참고 앱:** Sider, Merlin  
**설명:** YouTube 영상 페이지에서 자막(cc) 데이터를 자동으로 가져와 요약합니다.  
**manifest.json 추가 권한:**
```json
"host_permissions": [
  "https://www.youtube.com/*"
]
```

---

### PHASE 3 — 아키텍처 설계 필요 (나중에)

#### 기능 9: 여러 AI 동시 팝업 🔴
**참고 앱:** Monica (멀티 모델)  
**중요 제약:** ChatGPT, Claude, Gemini 웹사이트는 보안 정책(X-Frame-Options)으로 iframe 삽입이 불가합니다. 두 가지 현실적인 방법이 있습니다.

방법 A: "AI 탭 동시 열기" — 버튼 클릭 시 ChatGPT/Claude/Gemini 탭을 한꺼번에 열고, 클립보드에 현재 선택 텍스트를 복사해둡니다.

방법 B: "API 키 직접 연결" — 사용자가 OpenAI API 키, Anthropic API 키를 Aurora 설정에 입력해두면, Aurora 팝업 안에서 바로 각 AI에 질문할 수 있습니다. (Gemini Nano와 별개로 추가 비용 발생)

#### 기능 10: 페이지 전체 컨텍스트 분석 🔴
**참고 앱:** Sider  
**설명:** 현재 보는 페이지의 전체 텍스트를 Aurora가 인식해서 "이 페이지 요약해줘" 질문에 답합니다. Gemini Nano는 토큰 한계가 있어서 긴 페이지는 분할 처리 로직이 필요합니다.

---

## 4. 다른 AI에게 작업을 넘길 때 필수 규칙

### 절대 지켜야 할 것

**파일을 반드시 첨부할 것.** "selection-toolbar.ts 수정해줘"라고만 하면 AI가 오래된 버전으로 코드를 써줄 수 있습니다. 수정하려는 파일을 직접 첨부하고 "이게 현재 코드야, 이 부분만 바꿔줘"라는 방식으로 요청하세요.

**LanguageModel API 버전을 명시할 것.** 대부분의 AI는 구버전 `window.ai.createTextSession()` 방식을 알고 있습니다. 항상 아래 문구를 프롬프트 앞에 붙이세요:

> "Chrome 2026 Built-in AI API를 사용합니다. `LanguageModel.create({ systemPrompt, outputLanguage })` 방식을 사용하고, `window.ai.createTextSession()`은 사용하지 마세요. outputLanguage는 반드시 'en', 'es', 'ja' 중 하나만 써야 합니다."

**TypeScript + Vite 구조임을 명시할 것.** React 코드나 순수 JavaScript로 된 코드를 줄 수 있습니다. "TypeScript로 작성하고, React를 사용하지 말 것"을 명시하세요.

### Gemini vs ChatGPT 역할 분담 권장

**Gemini에게 맡기기 좋은 작업**은 새 UI 디자인 이미지 생성, 기능 아이디어 발굴, UX 흐름 기획입니다. 비주얼 결과물이 필요할 때 Gemini가 강합니다.

**ChatGPT에게 맡기기 좋은 작업**은 실제 TypeScript 코드 수정, 오류 원인 추적, 여러 파일 간 의존 관계 파악입니다. 코드 맥락을 이어받아 수정하는 능력이 뛰어납니다.

---

## 5. 다음 작업 추천 프롬프트 (복사해서 바로 사용)

### ChatGPT에게 "저장소 기능 추가" 요청할 때
```
나는 Aurora라는 크롬 확장 프로그램을 개발 중이야.
TypeScript + Vite + Manifest V3 구조야. React는 사용하지 않아.
Chrome 2026 Built-in AI API를 사용해. LanguageModel.create() 방식이야.

[첨부 파일]
- sidepanel-app.ts (현재 사이드패널 로직)
- sidepanel.html (현재 사이드패널 UI)

[요청]
사이드패널에 저장소 기능을 추가해줘.
1. floating-shell.ts에서 "저장" 버튼 클릭 시 chrome.storage.local에 저장
2. 저장 항목: { id, action, text, result, date }
3. sidepanel.html 슬림 사이드바의 히스토리 버튼 클릭 시 저장 목록 표시
4. 저장된 항목 클릭 시 채팅 말풍선으로 결과 표시
5. 항목 삭제 버튼 포함
기존 코드 스타일(css() 헬퍼 함수, DOM 직접 생성 방식)을 유지해줘.
```

### Gemini에게 "새 UI 디자인" 요청할 때
```
Aurora 크롬 확장 프로그램의 새 UI를 디자인해줘.
다크 테마, 퍼플(#8b5cf6)과 핑크(#ec4899) 네온 그라데이션 스타일이야.

[요청]
저장소 탭을 추가했을 때 사이드패널이 어떻게 보일지
목업 이미지로 만들어줘.
저장된 항목 카드, 검색창, 삭제 버튼이 포함되어야 해.
```

---

## 6. 주의사항 모음

**빌드 경고 (무시해도 됨):**
`The CJS build of Vite's Node API is deprecated` — 동작에 영향 없는 경고입니다.

**Gemini Nano outputLanguage 제약:**
`outputLanguage`는 반드시 `'en'`, `'es'`, `'ja'` 중 하나여야 합니다. `'ko'`를 쓰면 경고가 발생합니다. 한국어 출력은 `systemPrompt` 안의 "반드시 한국어로 답하세요" 지시로 제어합니다.

**iframe 제약:**
ChatGPT, Claude, Gemini 웹사이트는 보안 정책으로 Aurora 팝업 안에 iframe으로 넣을 수 없습니다. API 키 방식 또는 "탭 동시 열기" 방식을 사용해야 합니다.

**Notion API 호출은 content script에서 직접 불가:**
Manifest V3 보안 정책으로 인해 외부 API 호출은 `background/index.ts`(서비스 워커)를 통해 중계하는 방식을 써야 합니다.
