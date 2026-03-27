# Aurora Project Master Code


## File: `.claude/settings.local.json`
```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run:*)"
    ]
  }
}

```

## File: `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "Aurora",
  "version": "0.2.0",
  "description": "AI assistant side panel",

  "permissions": [
    "sidePanel",
    "storage",
    "activeTab",
    "scripting",
    "tabs"
  ],

  "host_permissions": [],

  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ],

  "web_accessible_resources": [],

  "side_panel": {
    "default_path": "src/sidepanel/sidepanel.html"
  },

  "commands": {
    "open-sidepanel": {
      "suggested_key": {
        "default": "Alt+A"
      },
      "description": "Aurora 사이드패널 열기"
    }
  },

  "action": {
    "default_title": "Aurora"
  }
}

```

## File: `package.json`
```json
{
  "name": "aurora",
  "version": "0.1.0",
  "private": true,
 "scripts": {
    "dev": "vite",
    "build": "vite build",
    "sync": "node generate-master.js" 
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.29",
    "@types/chrome": "^0.0.324",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  },
  "dependencies": {
    "marked": "^12.0.0"
  }
}

```

## File: `src/background/index.ts`
```typescript
// ════════════════════════════════════════════════════════════
//  Aurora — background/index.ts (서비스 워커)
//  역할: 메시지 라우터 + 외부 API 중계
// ════════════════════════════════════════════════════════════
//
//  새 기능의 메시지 핸들러를 추가할 때는
//  HANDLERS 객체에 딱 한 줄만 추가하면 됩니다.
//
//  예시:
//    NOTION_SAVE: handleNotionSave,
//    FETCH_YOUTUBE_TRANSCRIPT: handleYoutubeTranscript,
//
//  그리고 이 파일 아래에 해당 함수를 구현하면 끝입니다.
//  다른 파일은 건드릴 필요 없습니다.
//
// ════════════════════════════════════════════════════════════

// ── 메시지 타입 정의 ─────────────────────────────────────────
// 새 메시지 타입을 추가할 때 여기에만 추가하세요.
// 이 타입 목록이 Aurora 전체의 "메시지 명세서"입니다.

export type MessageType =
  // ── 현재 활성 ──────────────────────────────────────────
  | 'OPEN_SIDEPANEL'          // 사이드패널 열기 (floating-shell → background)

  // ── PHASE 2: 외부 API 연동 ─────────────────────────────
  | 'NOTION_SAVE'             // Notion 페이지에 저장
  | 'NOTION_FETCH'            // Notion 페이지 불러오기
  | 'FETCH_EXTERNAL'          // 범용 외부 URL fetch (MV3: content에서 직접 불가)

  // ── PHASE 2: 사이트 특화 기능 ──────────────────────────
  | 'FETCH_YOUTUBE_TRANSCRIPT'// YouTube 자막 가져오기
  | 'OPEN_TABS_BATCH'         // 여러 탭 한꺼번에 열기 (멀티 AI 기능)

  // ── PHASE 3: 고급 기능 ─────────────────────────────────
  | 'SCHEDULE_TASK'           // 주기적 작업 등록 (알림 등)

export interface AuroraMessage {
  type: MessageType
  payload?: unknown
}

export interface AuroraResponse {
  success: boolean
  data?: unknown
  error?: string
}

// ── 핸들러 라우터 ────────────────────────────────────────────
// 새 기능 추가 시 이 객체에 한 줄만 추가하면 됩니다.

type HandlerFn = (
  payload: unknown,
  sender: chrome.runtime.MessageSender
) => Promise<AuroraResponse>

const HANDLERS: Partial<Record<MessageType, HandlerFn>> = {
  // ── 현재 활성 핸들러 ──────────────────────────────────
  OPEN_SIDEPANEL:           handleOpenSidepanel,

  // ── 아래는 구현 후 주석 해제 ──────────────────────────
  // NOTION_SAVE:           handleNotionSave,
  // NOTION_FETCH:          handleNotionFetch,
  // FETCH_EXTERNAL:        handleFetchExternal,
  // FETCH_YOUTUBE_TRANSCRIPT: handleYoutubeTranscript,
  // OPEN_TABS_BATCH:       handleOpenTabsBatch,
}

// ── 메인 메시지 리스너 (이 부분은 수정하지 않아도 됩니다) ──────
chrome.runtime.onMessage.addListener(
  (message: AuroraMessage, sender, sendResponse) => {
    const handler = HANDLERS[message.type]

    if (!handler) {
      console.warn(`[Aurora] 알 수 없는 메시지 타입: ${message.type}`)
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` })
      return false
    }

    // 비동기 핸들러 실행
    handler(message.payload, sender)
      .then(sendResponse)
      .catch((err) => {
        console.error(`[Aurora] 핸들러 오류 (${message.type}):`, err)
        sendResponse({ success: false, error: String(err) })
      })

    return true // 비동기 응답을 위해 반드시 true 반환
  }
)

// ── 단축키 리스너 ────────────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-sidepanel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (tabId) {
        chrome.sidePanel.open({ tabId }).catch(console.error)
      }
    })
  }
})

// ════════════════════════════════════════════════════════════
//  핸들러 구현부
//  새 기능 추가 시 여기에 함수를 추가하세요.
// ════════════════════════════════════════════════════════════

// ── OPEN_SIDEPANEL ───────────────────────────────────────────
// floating-shell.ts에서 "패널에서 계속" 클릭 시 호출됨
async function handleOpenSidepanel(
  _payload: unknown,
  sender: chrome.runtime.MessageSender
): Promise<AuroraResponse> {
  const tabId = sender.tab?.id
  if (!tabId) {
    return { success: false, error: 'tabId를 찾을 수 없습니다.' }
  }
  await chrome.sidePanel.open({ tabId })
  return { success: true }
}


// ── NOTION_SAVE ──────────────────────────────────────────────
// Notion API는 MV3 보안 정책상 content script에서 직접 호출 불가.
// 반드시 이 background 서비스 워커를 통해 중계해야 합니다.
//
// 구현 시 주석 해제 + HANDLERS에 등록
//
// interface NotionSavePayload {
//   apiKey: string
//   pageId: string
//   title: string
//   content: string
// }
//
// async function handleNotionSave(payload: unknown): Promise<AuroraResponse> {
//   const { apiKey, pageId, title, content } = payload as NotionSavePayload
//   const res = await fetch('https://api.notion.com/v1/pages', {
//     method: 'POST',
//     headers: {
//       'Authorization': `Bearer ${apiKey}`,
//       'Notion-Version': '2022-06-28',
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       parent: { page_id: pageId },
//       properties: {
//         title: { title: [{ text: { content: title } }] }
//       },
//       children: [
//         { object: 'block', type: 'paragraph',
//           paragraph: { rich_text: [{ text: { content } }] } }
//       ]
//     })
//   })
//   if (!res.ok) return { success: false, error: `Notion API 오류: ${res.status}` }
//   return { success: true, data: await res.json() }
// }


// ── FETCH_EXTERNAL ───────────────────────────────────────────
// 외부 URL에서 데이터를 가져와야 할 때 (YouTube 자막, 뉴스 등)
// MV3에서 content script는 외부 도메인 fetch가 제한됨.
// 이 핸들러를 통해 모든 외부 요청을 중계합니다.
//
// async function handleFetchExternal(payload: unknown): Promise<AuroraResponse> {
//   const { url, options } = payload as { url: string; options?: RequestInit }
//   const res = await fetch(url, options)
//   if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
//   const data = await res.text()
//   return { success: true, data }
// }


// ── OPEN_TABS_BATCH ──────────────────────────────────────────
// 여러 AI 사이트를 동시에 탭으로 여는 기능
// (ChatGPT, Claude, Gemini 등 iframe 불가 → 탭 동시 열기로 대응)
//
// async function handleOpenTabsBatch(payload: unknown): Promise<AuroraResponse> {
//   const { urls } = payload as { urls: string[] }
//   await Promise.all(urls.map(url => chrome.tabs.create({ url, active: false })))
//   return { success: true }
// }


// ── FETCH_YOUTUBE_TRANSCRIPT ────────────────────────────────
// YouTube 영상의 자막 데이터 가져오기
// videoId로 자막 XML을 fetch해서 텍스트로 반환
//
// async function handleYoutubeTranscript(payload: unknown): Promise<AuroraResponse> {
//   const { videoId } = payload as { videoId: string }
//   const res = await fetch(
//     `https://www.youtube.com/watch?v=${videoId}`,
//     { headers: { 'Accept-Language': 'ko,en' } }
//   )
//   const html = await res.text()
//   // 자막 URL 파싱 로직 추가 필요
//   return { success: true, data: html }
// }

```

## File: `src/content/index.ts`
```typescript
import { SelectionObserver } from './selection/selection-observer'
import { SelectionToolbar } from './selection/selection-toolbar'
import { FloatingShell } from './ui/floating-shell'
import type { SelectionInfo } from './selection/selection-observer'
import type { SavedHighlight } from '../shared/types'

// ── Selection observer + toolbar ─────────────────────────────
let toolbar: SelectionToolbar | null = null

const observer = new SelectionObserver((info) => {
  if (info) {
    toolbar?.show(info)
  } else {
    toolbar?.hide()
  }
})

toolbar = new SelectionToolbar(
  (action, info: SelectionInfo) => {
    // text 유실 보정: 비어있으면 window.getSelection()으로 최후 수단 복구
    const resolvedText = info.text.trim() || window.getSelection()?.toString().trim() || ''
    console.log('[AURORA-DEBUG] toolbar callback — action:', action, '| text:', resolvedText, '| mode:', info.mode)

    if (action === 'save') {
      toolbar?.hide()                          // ① 가장 먼저 툴바 닫기
      window.getSelection()?.removeAllRanges() // ② 텍스트 선택 해제 → Observer 재실행 차단
      void saveHighlight(resolvedText, info.rect)   // ③ 저장 (내부 try-catch로 예외 보장)
      return
    }

    toolbar?.hide()
    new FloatingShell(action, { ...info, text: resolvedText })
  },
  () => observer.suppress(),  // X 버튼 클릭 시 재생성 차단
)

// 페이지 로드 후 사이드패널 토글 버튼 주입
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFloatingBtn)
} else {
  injectFloatingBtn()
}

// ── 하이라이트 저장 ─────────────────────────────────────
async function saveHighlight(text: string, rect: DOMRect): Promise<void> {
  const rawText = text.trim()
  if (!rawText) {
    console.warn('[AURORA-DEBUG] saveHighlight: empty text, skip')
    return
  }
  console.log('[AURORA-DEBUG] saveHighlight text:', rawText)

  try {
    const result = await chrome.storage.local.get('aurora_highlights')
    const highlights: SavedHighlight[] = result['aurora_highlights'] ?? []

    highlights.unshift({
      id:        crypto.randomUUID(),
      text:      rawText,
      url:       window.location.href,
      title:     document.title,
      timestamp: Date.now(),
    })

    await chrome.storage.local.set({ aurora_highlights: highlights })
    showSaveToast(rect)
  } catch {
    // Extension context invalidated 등 chrome API 오류 — 툴바는 이미 닫힌 상태
  }
}

// ── 웹페이지 우측 사이드패널 토글 버튼 ──────────────────
function injectFloatingBtn(): void {
  if (document.getElementById('aurora-float-btn')) return

  const btn = document.createElement('button')
  btn.id = 'aurora-float-btn'
  btn.title = 'Aurora 패널 열기'
  btn.innerHTML = `<svg viewBox="0 0 100 100" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="af-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><path d="M20 80L50 20L80 80" stroke="url(#af-g)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 80L50 50L65 80" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>`
  Object.assign(btn.style, {
    position:        'fixed',
    right:           '0',
    top:             '50%',
    transform:       'translateY(-50%)',
    zIndex:          '2147483646',
    width:           '32px',
    height:          '44px',
    background:      '#1a1c2e',
    border:          '1px solid #3d3f58',
    borderRight:     'none',
    borderRadius:    '8px 0 0 8px',
    cursor:          'pointer',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    boxShadow:       '-2px 0 12px rgba(0,0,0,0.4)',
    transition:      'background 0.15s',
  })
  btn.addEventListener('mouseenter', () => { btn.style.background = '#313244' })
  btn.addEventListener('mouseleave', () => { btn.style.background = '#1a1c2e' })
  btn.addEventListener('click', () => {
    try {
      chrome.runtime?.sendMessage({ type: 'OPEN_SIDEPANEL' })
    } catch {
      // Extension context invalidated
    }
  })

  document.body.appendChild(btn)
}

// ── 저장 확인 토스트 (2초 후 사라짐) ───────────────────
function showSaveToast(rect: DOMRect): void {
  document.getElementById('aurora-save-toast')?.remove()

  const toast = document.createElement('div')
  toast.id = 'aurora-save-toast'
  Object.assign(toast.style, {
    position:   'fixed',
    zIndex:     '2147483647',
    background: '#1a1c2e',
    border:     '1px solid #a6e3a1',
    borderRadius: '8px',
    padding:    '8px 14px',
    fontSize:   '13px',
    color:      '#a6e3a1',
    fontFamily: 'system-ui, sans-serif',
    boxShadow:  '0 4px 16px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    opacity:    '1',
    transition: 'opacity 0.3s',
  })
  toast.textContent = '✓ 하이라이트가 저장되었습니다'

  const toastW = 210
  const top  = rect.top > 48 ? rect.top - 44 : rect.bottom + 8
  const left = Math.max(8, Math.min(
    rect.left + rect.width / 2 - toastW / 2,
    window.innerWidth - toastW - 8
  ))
  toast.style.top  = `${top}px`
  toast.style.left = `${left}px`

  document.body.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

```

## File: `src/content/selection/selection-observer.ts`
```typescript
import type { ToolbarMode, SourceMeta } from '../../shared/types'

export interface SelectionInfo {
  text:       string
  rect:       DOMRect
  mode:       ToolbarMode
  sourceMeta: SourceMeta
}

type SelectionCallback = (info: SelectionInfo | null) => void

// editable 영역 감지 — input / textarea / contenteditable / 리치 에디터 공통
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  if (el.getAttribute('role') === 'textbox') return true
  // ProseMirror / Slate / Lexical / CodeMirror / Monaco 류 에디터 및 공통 조상 검사
  if (el.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"], ' +
    '.ProseMirror, .cm-editor, .monaco-editor, .ql-editor, .CodeMirror'
  )) return true
  return false
}

export class SelectionObserver {
  private readonly callback: SelectionCallback
  private suppressUntil = 0    // X 클릭 후 툴바 재생성 차단 타임스탬프
  private lastSnapshot: SelectionInfo | null = null  // P0-5: 우클릭 시 스냅샷 유지

  constructor(callback: SelectionCallback) {
    this.callback = callback
    document.addEventListener('mouseup',   this.onMouseUp)
    document.addEventListener('mousedown', this.onMouseDown)
  }

  // X 버튼 클릭 시 호출 — 500ms 동안 툴바 재생성 차단
  suppress(): void {
    this.suppressUntil = Date.now() + 500
  }

  private onMouseUp = (e: MouseEvent) => {
    if (Date.now() < this.suppressUntil) return

    const target = e.target as HTMLElement
    if (target.closest('#aurora-toolbar') || target.closest('#aurora-shell')) return

    // ── textarea / input 전용 경로 ──────────────────────────
    // window.getSelection()은 input/textarea 내부 선택을 노출하지 않으므로
    // selectionStart/End 로 직접 판별
    const inputEl = target.closest('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
    if (inputEl) {
      const selStart = inputEl.selectionStart ?? -1
      const selEnd   = inputEl.selectionEnd   ?? -1
      const text     = selEnd > selStart ? inputEl.value.slice(selStart, selEnd).trim() : ''

      if (!text) {
        this.lastSnapshot = null
        this.callback(null)
        return
      }

      // rect: 가능하면 DOM Range, 없으면 input 자체의 bounding rect 사용
      let rect: DOMRect
      try {
        const sel = window.getSelection()
        const r   = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null
        rect = (r && r.width > 0) ? r : inputEl.getBoundingClientRect()
      } catch {
        rect = inputEl.getBoundingClientRect()
      }

      const sourceMeta: SourceMeta = {
        el:                inputEl,
        selStart,
        selEnd,
        isContentEditable: false,
        rangeClone:        null,
      }
      const info: SelectionInfo = { text, rect, mode: 'write', sourceMeta }
      this.lastSnapshot = info
      this.callback(info)
      return
    }

    // ── 일반 DOM 선택 경로 ─────────────────────────────────
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ''

    if (!text) {
      // editable 영역 내 단순 클릭(커서 이동)은 callback(null)을 호출하지 않는다.
      // hide() → removeAllRanges() 체인으로 contenteditable 커서가 파괴되는 것을 방지.
      if (isEditableTarget(target)) return
      this.lastSnapshot = null
      this.callback(null)
      return
    }

    const range = selection!.getRangeAt(0)
    const rect  = range.getBoundingClientRect()

    // anchor 위치로 write / read 모드 판별
    const anchorNode = selection?.anchorNode
    const anchorEl   = anchorNode instanceof Element
      ? (anchorNode as HTMLElement)
      : (anchorNode?.parentElement ?? null)

    // isWriteArea 판별: 반드시 속성/role 기반만 사용.
    // .ProseMirror / .CodeMirror / .cm-editor 같은 클래스 셀렉터는
    // 읽기 전용 인스턴스(ChatGPT 코드블록 하이라이터 등)도 매칭하므로 판별에 쓰지 않음.
    const EDITABLE_ATTR = '[contenteditable="true"], [contenteditable=""], [role="textbox"]'

    // ceEl 루트 탐색 전용: write area 확정 후에만 사용 (focus + execCommand 안정화)
    const CE_ROOT =
      EDITABLE_ATTR + ', ' +
      '.ProseMirror, .cm-editor, .monaco-editor, .ql-editor, .CodeMirror'

    const isWriteArea =
      anchorEl?.isContentEditable ||
      anchorEl?.getAttribute('role') === 'textbox' ||
      !!anchorEl?.closest(EDITABLE_ATTR)

    if (isWriteArea) {
      // Write mode — contenteditable / role="textbox" / 리치 에디터
      // ceEl: 항상 closest()로 루트 컨테이너를 탐색.
      // anchorEl.isContentEditable이 true여도 <p>/<span> 같은 deep child일 수 있으므로
      // 직접 사용하지 않고 루트를 찾아야 el.focus() + execCommand가 안정적으로 동작함.
      const ceEl = anchorEl?.closest(CE_ROOT) as HTMLElement | null ?? anchorEl

      const sourceMeta: SourceMeta = {
        el:                ceEl ?? anchorEl,
        selStart:          -1,
        selEnd:            -1,
        isContentEditable: true,
        rangeClone:        range.cloneRange(),
      }
      const info: SelectionInfo = { text, rect, mode: 'write', sourceMeta }
      this.lastSnapshot = info
      this.callback(info)
    } else {
      // Read mode — 일반 읽기 텍스트 선택
      const sourceMeta: SourceMeta = {
        el:                null,
        selStart:          -1,
        selEnd:            -1,
        isContentEditable: false,
        rangeClone:        range.cloneRange(),
      }
      const info: SelectionInfo = { text, rect, mode: 'read', sourceMeta }
      this.lastSnapshot = info
      this.callback(info)
    }
  }

  private onMouseDown = (e: MouseEvent) => {
    // P0-5: 우클릭(contextmenu 직전)은 툴바를 숨기지 않는다
    if (e.button === 2) return

    const target = e.target as HTMLElement

    // Aurora 자체 UI 클릭은 무시 (툴바 + 팝업 셸)
    if (target.closest('#aurora-toolbar') || target.closest('#aurora-shell')) return

    // editable 영역 클릭은 무시 — focus/커서를 절대 깨지 않음
    if (isEditableTarget(target)) return

    // 그 외 바깥 클릭 시 툴바 숨김
    this.callback(null)
  }

  destroy() {
    document.removeEventListener('mouseup',   this.onMouseUp)
    document.removeEventListener('mousedown', this.onMouseDown)
  }
}

```

## File: `src/content/selection/selection-toolbar.ts`
```typescript
import type { SelectionInfo } from './selection-observer'
import type { ToolbarAction } from '../../shared/types'

type ActionCallback = (action: ToolbarAction, info: SelectionInfo) => void

// ── SVG 아이콘 ──────────────────────────────────────────────
const ICONS: Record<string, string> = {
  translate: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  summarize: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  ask:       `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  save:      `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
  refine:    `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>`,
  shorter:   `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/></svg>`,
  longer:    `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><path d="M20 10l2 2-2 2"/></svg>`,
  tone:      `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  more:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
  aurora:    `<svg viewBox="0 0 100 100" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ag-tb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><path d="M20 80L50 20L80 80" stroke="url(#ag-tb)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 80L50 50L65 80" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/><path d="M10 85C30 75 70 75 90 85" stroke="url(#ag-tb)" stroke-width="3" stroke-linecap="round" opacity="0.8"/></svg>`,
}

// 버튼 정의 — mode별 가시성 제어
// read:  translate, summarize, ask, save
// write: refine, ask
const ALL_PRIMARY: { action: ToolbarAction; label: string; readMode: boolean; writeMode: boolean }[] = [
  { action: 'translate', label: '번역',   readMode: true,  writeMode: false },
  { action: 'summarize', label: '요약',   readMode: true,  writeMode: false },
  { action: 'refine',    label: '다듬기', readMode: false, writeMode: true  },
  { action: 'ask',       label: '질문',   readMode: true,  writeMode: true  },
  { action: 'save',      label: '저장',   readMode: true,  writeMode: false },
]

// 더보기 메뉴 — active(구현)/placeholder(계획중) 구분
const MORE_ITEMS: { action: ToolbarAction; label: string; active: boolean }[] = [
  { action: 'refine',  label: '다듬기',   active: true  },
  { action: 'shorter', label: '짧게',     active: false },
  { action: 'longer',  label: '길게',     active: false },
  { action: 'tone',    label: '톤 변경',  active: false },
]

export class SelectionToolbar {
  private readonly el:       HTMLDivElement
  private readonly onAction: ActionCallback
  private readonly onClose:  () => void
  private currentInfo: SelectionInfo | null = null
  private pinnedSet = new Set<string>()
  private readonly pinBtnMap    = new Map<string, HTMLButtonElement>()
  // mode별 가시성 제어용 버튼 맵
  private readonly primaryBtnMap = new Map<ToolbarAction, { btn: HTMLButtonElement; readMode: boolean; writeMode: boolean }>()

  constructor(onAction: ActionCallback, onClose: () => void = () => {}) {
    this.onAction = onAction
    this.onClose  = onClose
    this.el = this.buildEl()
    document.getElementById('aurora-toolbar')?.remove()
    document.body.appendChild(this.el)
    void chrome.storage.local.get('aurora_pinned').then((res) => {
      const pinned: string[] = res['aurora_pinned'] ?? []
      this.pinnedSet = new Set(pinned)
      this.refreshPinIcons()
    })
  }

  // ── DOM 빌드 ─────────────────────────────────────────────

  private buildEl(): HTMLDivElement {
    const toolbar = document.createElement('div')
    toolbar.id = 'aurora-toolbar'
    Object.assign(toolbar.style, {
      position:      'fixed',
      display:       'none',
      flexDirection: 'row',
      gap:           '0px',
      zIndex:        '2147483647',
      background:    '#1a1c2e',
      border:        '1px solid #3d3f58',
      borderRadius:  '10px',
      padding:       '5px',
      boxShadow:     '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(139,92,246,0.12)',
    } satisfies Partial<CSSStyleDeclaration>)

    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:1px;align-items:center'

    // 모든 primary 버튼 생성 (read/write mode별 표시 제어)
    for (const def of ALL_PRIMARY) {
      const btn = this.buildActionBtn(def.action, def.label)
      this.primaryBtnMap.set(def.action, { btn, readMode: def.readMode, writeMode: def.writeMode })
      row.appendChild(btn)
    }

    // 세로 구분선
    const sep = document.createElement('div')
    sep.style.cssText = 'width:1px;height:16px;background:#313244;margin:0 3px;flex-shrink:0'
    row.appendChild(sep)

    // ··· 더보기 버튼 + 드롭다운
    const moreWrapper = document.createElement('div')
    moreWrapper.style.cssText = 'position:relative;display:inline-flex'
    const moreMenu = this.buildMoreMenu()
    const moreBtn = this.buildIconBtn('more', '더보기', () => {
      const isOpen = moreMenu.style.display !== 'none'
      moreMenu.style.display = isOpen ? 'none' : 'block'
    })
    moreWrapper.append(moreBtn, moreMenu)
    row.appendChild(moreWrapper)

    // 외부 클릭 시 더보기 닫기
    document.addEventListener('mousedown', (e) => {
      if (!moreWrapper.contains(e.target as Node)) {
        moreMenu.style.display = 'none'
      }
    })

    // Aurora 로고 버튼 → 사이드패널 열기
    const auroraBtn = this.buildIconBtn('aurora', 'Aurora 패널 열기', () => {
      this.hide()
      try { chrome.runtime?.sendMessage({ type: 'OPEN_SIDEPANEL' }) } catch { /* invalidated */ }
    })
    row.appendChild(auroraBtn)

    // 닫기 버튼
    row.appendChild(this.buildCloseBtn())

    toolbar.appendChild(row)
    return toolbar
  }

  private buildActionBtn(action: ToolbarAction, label: string): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.innerHTML = ICONS[action] ?? label
    btn.title = label
    Object.assign(btn.style, {
      background: 'transparent', border: 'none', color: '#cdd6f4',
      padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    } satisfies Partial<CSSStyleDeclaration>)
    btn.addEventListener('mouseenter', () => { btn.style.background = '#313244'; btn.style.color = '#cba6f7' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.color = '#cdd6f4' })
    btn.addEventListener('click',     (e) => { e.preventDefault(); e.stopPropagation() })
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const capturedInfo = this.currentInfo!
      this.hide()
      this.onAction(action, capturedInfo)
    })
    return btn
  }

  private buildIconBtn(iconKey: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.innerHTML = ICONS[iconKey] ?? ''
    btn.title = title
    Object.assign(btn.style, {
      background: 'transparent', border: 'none', color: '#6c7086',
      padding: '6px 7px', borderRadius: '6px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    } satisfies Partial<CSSStyleDeclaration>)
    btn.addEventListener('mouseenter', () => { btn.style.background = '#313244'; btn.style.color = '#cba6f7' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.color = '#6c7086' })
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); onClick() })
    return btn
  }

  private buildCloseBtn(): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.textContent = '×'
    btn.title = '닫기'
    Object.assign(btn.style, {
      background: 'transparent', border: 'none', color: '#6c7086',
      fontSize: '16px', lineHeight: '1', padding: '4px 6px',
      marginLeft: '1px', borderRadius: '5px', cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>)
    btn.addEventListener('mouseenter', () => { btn.style.color = '#f38ba8' })
    btn.addEventListener('mouseleave', () => { btn.style.color = '#6c7086' })
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      window.getSelection()?.removeAllRanges()
      this.onClose()
      this.destroy()
    })
    return btn
  }

  // 더보기 드롭다운 — 활성/계획중 구분
  private buildMoreMenu(): HTMLDivElement {
    const menu = document.createElement('div')
    Object.assign(menu.style, {
      display: 'none', position: 'absolute', top: '100%', left: '0',
      zIndex: '2147483647', background: '#1a1c2e', border: '1px solid #3d3f58',
      borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      minWidth: '156px', padding: '4px', marginTop: '4px',
    })

    for (const { action, label, active } of MORE_ITEMS) {
      const row = document.createElement('div')
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '6px',
        borderRadius: '5px', padding: '0 4px', cursor: active ? 'pointer' : 'default',
      } satisfies Partial<CSSStyleDeclaration>)
      if (active) {
        row.addEventListener('mouseenter', () => { row.style.background = '#313244' })
        row.addEventListener('mouseleave', () => { row.style.background = 'transparent' })
      }

      // 아이콘
      const iconSpan = document.createElement('span')
      iconSpan.innerHTML = ICONS[action] ?? ''
      Object.assign(iconSpan.style, {
        display: 'flex', alignItems: 'center',
        color: active ? '#cdd6f4' : '#45475a', flexShrink: '0', pointerEvents: 'none',
      } satisfies Partial<CSSStyleDeclaration>)

      // 라벨
      const labelBtn = document.createElement('button')
      labelBtn.textContent = label
      Object.assign(labelBtn.style, {
        flex: '1', background: 'transparent', border: 'none',
        color: active ? '#cdd6f4' : '#45475a', fontSize: '12px',
        fontFamily: 'system-ui, sans-serif', padding: '6px 0',
        textAlign: 'left', cursor: active ? 'pointer' : 'default',
      } satisfies Partial<CSSStyleDeclaration>)
      if (active) {
        labelBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          menu.style.display = 'none'
          const capturedInfo = this.currentInfo!
          this.hide()
          this.onAction(action, capturedInfo)
        })
      }

      // 계획중 뱃지
      if (!active) {
        const badge = document.createElement('span')
        badge.textContent = '계획중'
        Object.assign(badge.style, {
          fontSize: '9px', color: '#45475a', border: '1px solid #313244',
          borderRadius: '3px', padding: '1px 4px', flexShrink: '0',
        } satisfies Partial<CSSStyleDeclaration>)
        row.append(iconSpan, labelBtn, badge)
      } else {
        // 핀 버튼 (활성 항목만)
        const isActive = this.pinnedSet.has(action)
        const pinBtn = document.createElement('button')
        pinBtn.innerHTML = pinSvg(isActive)
        Object.assign(pinBtn.style, {
          background: 'transparent', border: 'none',
          color: isActive ? '#cba6f7' : '#3d3f58',
          padding: '4px', borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', flexShrink: '0',
        } satisfies Partial<CSSStyleDeclaration>)
        pinBtn.addEventListener('mouseenter', () => { pinBtn.style.color = '#cba6f7' })
        pinBtn.addEventListener('mouseleave', () => {
          pinBtn.style.color = this.pinnedSet.has(action) ? '#cba6f7' : '#3d3f58'
        })
        pinBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          void this.togglePin(action)
        })
        this.pinBtnMap.set(action, pinBtn)
        row.append(iconSpan, labelBtn, pinBtn)
      }

      menu.appendChild(row)
    }

    return menu
  }

  private refreshPinIcons(): void {
    for (const [action, btn] of this.pinBtnMap.entries()) {
      const active = this.pinnedSet.has(action)
      btn.innerHTML = pinSvg(active)
      btn.style.color = active ? '#cba6f7' : '#3d3f58'
    }
  }

  private async togglePin(action: string): Promise<void> {
    if (this.pinnedSet.has(action)) { this.pinnedSet.delete(action) }
    else                            { this.pinnedSet.add(action) }
    await chrome.storage.local.set({ aurora_pinned: [...this.pinnedSet] })
    this.refreshPinIcons()
  }

  // ── 공개 메서드 ──────────────────────────────────────────

  show(info: SelectionInfo): void {
    this.currentInfo = info
    if (!document.body.contains(this.el)) document.body.appendChild(this.el)

    // mode에 따라 버튼 가시성 업데이트
    for (const [, { btn, readMode, writeMode }] of this.primaryBtnMap) {
      const visible = info.mode === 'read' ? readMode : writeMode
      btn.style.display = visible ? 'flex' : 'none'
    }

    this.el.style.display = 'flex'

    requestAnimationFrame(() => {
      const { rect } = info
      const OFFSET = 8
      const tw = this.el.offsetWidth
      const th = this.el.offsetHeight
      const top = rect.top >= th + OFFSET + 8
        ? rect.top - th - OFFSET
        : rect.bottom + OFFSET
      const left = Math.max(8, Math.min(
        rect.left + rect.width / 2 - tw / 2,
        window.innerWidth - tw - 8,
      ))
      this.el.style.top  = `${top}px`
      this.el.style.left = `${left}px`
    })
  }

  hide(): void {
    this.el.style.display = 'none'
    this.currentInfo = null
    // removeAllRanges()를 여기서 호출하지 않는다.
    // contenteditable(ChatGPT·Gemini 등) 커서를 파괴하는 근본 원인.
    // 선택 해제가 필요한 경우(저장·닫기)는 호출부에서 직접 처리.
  }

  destroy(): void { this.el.remove() }
}

function pinSvg(active: boolean): string {
  return `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="${active ? 'currentColor' : 'none'}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`
}

```

## File: `src/content/ui/floating-shell.ts`
```typescript
import type { ToolbarAction, PersonaId, SourceMeta } from '../../shared/types'
import type { SelectionInfo } from '../selection/selection-observer'

// Chrome 2026 Built-in AI
declare const LanguageModel: {
  create(options?: {
    systemPrompt?: string
    outputLanguage?: string
    temperature?: number
    topK?: number
  }): Promise<{
    prompt(input: string): Promise<string>
    destroy(): void
  }>
}

// ── 패널 크기 상수 ───────────────────────────────────────────
const DEFAULT_W = 560
const DEFAULT_H = 520
const MIN_W     = 420
const MIN_H     = 340

// ── 한국어 강제 규칙 ─────────────────────────────────────────
const STRICT_LANGUAGE_RULE =
  '!!!경고!!! 너는 현재 한국인 사용자 전용 도구다. 모든 대답은 100% 한국어로만 한다. 일본어를 단 한 글자라도 섞으면 시스템 에러가 발생한다. 오직 한국어만 사용하라.\n\n' +
  '[STRICT LANGUAGE RULE]\n' +
  "- 출력 언어 설정이 'ja'로 되어 있더라도 실제 내용은 반드시 한국어(Korean)로만 작성해야 합니다.\n" +
  '- 일본어 문자는 단 하나도 사용하지 마십시오.\n\n'

const OUTPUT_RULE =
  '[OUTPUT RULE]\n' +
  '반드시 [RESULT]와 [/RESULT] 태그 사이에만 결과물을 한국어로 작성하라.\n' +
  '태그 밖에는 어떠한 텍스트도 출력하지 마라. 인사말·설명·서론 금지.\n\n'

function enforceKorean(systemPrompt: string): string {
  return STRICT_LANGUAGE_RULE + OUTPUT_RULE + systemPrompt
}

// ── 페르소나 정의 ─────────────────────────────────────────────
interface PersonaDef { id: PersonaId; label: string; description: string; systemPrompt: string }

const PERSONAS: PersonaDef[] = [
  { id: 'minimalist', label: '미니멀리스트 🧹', description: '핵심만 남기고 군더더기 제거',
    systemPrompt: '너는 문장 다이어트 전문가야. 화자의 시점을 유지하며 의미 전달에 불필요한 수식어만 삭제해서 짧게 다듬어줘. 반드시 한국어로만 출력해.' },
  { id: 'devil', label: '악마의 대변인 😈', description: '논리적 허점 3가지 지적',
    systemPrompt: '너는 냉철한 비평가야. 입력된 내용의 취약점과 반박할 점 3가지를 날카롭게 요약해줘. 반드시 한국어로만 출력해.' },
  { id: 'dictionary', label: '사전적 정의 🎓', description: '개념을 초등학생 수준으로 풀이',
    systemPrompt: '너는 쉬운 용어 사전이야. 드래그한 단어나 문장의 핵심을 누구나 이해할 수 있게 한 문장으로 정의해줘. 반드시 한국어로만 출력해.' },
  { id: 'master', label: '마스터 프롬프트 💎', description: '맥락/의도/제약/형식/예시 포함 프롬프트 생성',
    systemPrompt: '너는 오라라의 프롬프트 아키텍트다.\n심호흡을 하고 체계적으로 작업해.\n\n[STRICT RULE]\n1. 나/내/너/네/私/僕/君 인칭을 저/제/당신/あなた로 절대 바꾸지 마라.\n2. 반드시 한국어로만 출력해.\n\n[TASK]\n사용자의 아이디어를 분석해서\nContext/Intent/Constraints/Format/Examples\n5요소가 포함된 전문 프롬프트 템플릿을 생성해.\n\n[RESULT] 태그 안에만 결과를 출력해.' },
]

// ── 액션 아이콘 / 라벨 ───────────────────────────────────────
const ACTION_ICONS: Partial<Record<ToolbarAction, string>> = {
  translate: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  summarize: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  refine:    `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>`,
  ask:       `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  shorter:   `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/></svg>`,
  longer:    `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  tone:      `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
}

const ACTION_LABELS: Record<ToolbarAction, string> = {
  translate: '번역', summarize: '요약', refine: '다듬기', ask: '질문', save: '저장',
  shorter: '짧게', longer: '길게', tone: '톤 변경',
}

// AI 실행 가능한 액션만 (refine은 페르소나 UI, save/placeholder는 별도 처리)
type AiAction = 'translate' | 'summarize' | 'ask'

const SYSTEM_PROMPTS: Record<AiAction, string> = {
  translate: '당신은 전문 번역가입니다. 반드시 한국어로만 답하세요. 입력된 텍스트를 자연스러운 한국어로 번역하고, 번역 결과만 출력하세요.',
  summarize: '당신은 요약 전문가입니다. 입력된 텍스트의 핵심을 간결하게 요약하세요. 요약 결과만 출력하세요.',
  ask:       '당신은 친절한 AI 어시스턴트입니다. 입력된 텍스트에 대해 사용자가 궁금해할 내용을 파악하여 유용한 정보를 제공하세요.',
}

const USER_PROMPTS: Record<AiAction, (t: string) => string> = {
  translate: (t) => `반드시 한국어로만 번역하세요.\n\n번역할 텍스트:\n${t}\n\n오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]`,
  summarize: (t) => `반드시 한국어로만 요약하세요.\n\n텍스트:\n${t}\n\n오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]`,
  ask:       (t) => `반드시 한국어로만 답하세요.\n\n질문:\n${t}\n\n오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]`,
}

function sandwichPrompt(text: string): string {
  return (
    '[STRICT LANGUAGE RULE]\n' +
    "- 출력 언어 설정이 'ja'로 되어 있더라도 실제 내용은 반드시 한국어(Korean)로만 작성해야 합니다.\n" +
    '- 일본어 문자는 단 하나도 사용하지 마십시오.\n\n' +
    '[IDENTITY GUARD]\n- 절대 나/내/너/네를 저/제/당신으로 바꾸지 마라.\n\n' +
    '[TASK]\n' + `"${text}"\n\n` +
    '[OUTPUT RULE]\n- 최종 결과물은 반드시 [RESULT]와 [/RESULT] 태그 사이에만 작성하라.\n\n' +
    '오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'
  )
}

// ── FloatingShell ─────────────────────────────────────────────

export class FloatingShell {
  private readonly el!:              HTMLDivElement
  private readonly loadingEl!:       HTMLElement
  private readonly personaSelectEl!: HTMLElement
  private readonly resultEl!:        HTMLElement
  private readonly statusEl!:        HTMLElement
  private readonly copyBtn!:         HTMLButtonElement
  private readonly replaceBtn!:      HTMLButtonElement
  private readonly panelBtn!:        HTMLButtonElement
  private readonly followUpInput!:   HTMLTextAreaElement
  private readonly actionLabelEl!:   HTMLElement
  private readonly actionIconEl!:    HTMLElement
  private currentAction: ToolbarAction
  private readonly sourceText!: string
  private readonly sourceMeta!: SourceMeta
  private resultText     = ''
  private selectedPersona: PersonaDef | null = null

  constructor(action: ToolbarAction, info: SelectionInfo) {
    this.currentAction = action
    this.sourceText    = info.text
    this.sourceMeta    = info.sourceMeta

    if (!info.text.trim()) { console.error('[AURORA] FloatingShell: empty sourceText'); return }

    this.injectStyle()

    const built = this.buildEl(action, info.text)
    this.el              = built.el
    this.loadingEl       = built.loadingEl
    this.personaSelectEl = built.personaSelectEl
    this.resultEl        = built.resultEl
    this.statusEl        = built.statusEl
    this.copyBtn         = built.copyBtn
    this.replaceBtn      = built.replaceBtn
    this.panelBtn        = built.panelBtn
    this.followUpInput   = built.followUpInput
    this.actionLabelEl   = built.actionLabelEl
    this.actionIconEl    = built.actionIconEl

    document.getElementById('aurora-shell')?.remove()
    document.body.appendChild(this.el)

    // 크기 복원 (비동기 — 이미 DOM에 있으므로 안전)
    void chrome.storage.local.get('aurora_shell_size').then((res) => {
      const saved = res['aurora_shell_size'] as { w: number; h: number } | undefined
      if (saved?.w && saved?.h) {
        const w = Math.max(MIN_W, Math.min(saved.w, window.innerWidth  - 16))
        const h = Math.max(MIN_H, Math.min(saved.h, window.innerHeight - 16))
        this.el.style.width  = `${w}px`
        this.el.style.height = `${h}px`
      }
    })

    this.position(info.rect)
    this.initDrag(built.header)
    this.initResize(built.resizeHandle)

    if (action === 'refine') {
      this.showPersonaSelect()
    } else if (action === 'shorter' || action === 'longer' || action === 'tone') {
      this.showError('이 기능은 준비 중입니다.')
    } else if (action !== 'save') {
      void this.runAction(
        SYSTEM_PROMPTS[action as AiAction],
        USER_PROMPTS[action as AiAction](this.sourceText),
      )
    }
  }

  // ── 페르소나 선택 UI ──────────────────────────────────────

  private showPersonaSelect(): void {
    this.loadingEl.style.display       = 'none'
    this.personaSelectEl.style.display = 'flex'
    this.resultEl.style.display        = 'none'
  }

  private hidePersonaSelect(): void {
    this.personaSelectEl.style.display = 'none'
    this.loadingEl.style.display       = 'flex'
  }

  private switchAction(action: ToolbarAction): void {
    this.currentAction = action
    this.actionIconEl.innerHTML    = ACTION_ICONS[action] ?? ''
    this.actionLabelEl.textContent = ACTION_LABELS[action]
    if (action === 'refine') {
      this.showPersonaSelect()
    } else if (action === 'shorter' || action === 'longer' || action === 'tone') {
      this.showError('이 기능은 준비 중입니다.')
    } else if (action !== 'save') {
      void this.runAction(
        SYSTEM_PROMPTS[action as AiAction],
        USER_PROMPTS[action as AiAction](this.sourceText),
      )
    }
  }

  // ── AI 실행 ──────────────────────────────────────────────

  private async runAction(systemPrompt: string, userPrompt: string): Promise<void> {
    this.loadingEl.style.display   = 'flex'
    this.resultEl.style.display    = 'none'
    this.statusEl.textContent      = 'GEMINI NANO 처리 중...'
    this.statusEl.style.color      = '#6c7086'
    this.followUpInput.disabled    = true

    let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
    try {
      session = await LanguageModel.create({ systemPrompt: enforceKorean(systemPrompt), outputLanguage: 'ja', temperature: 0.6, topK: 5 })
      const rawResponse = await session.prompt(userPrompt)
      let result = extractResult(rawResponse)
      if (needsCorrection(this.sourceText, result)) {
        result = extractResult(await session.prompt(
          'ERROR: 인칭이 바뀌었어.\n다시 나/내/너/네를 사용해서 답변해줘.\n결과물만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'
        ))
      }
      this.showResult(result)
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err))
    } finally {
      session?.destroy()
    }
  }

  private async runFollowUp(userPrompt: string): Promise<void> {
    this.loadingEl.style.display   = 'flex'
    this.resultEl.style.display    = 'none'
    this.statusEl.textContent      = 'GEMINI NANO 처리 중...'
    this.statusEl.style.color      = '#6c7086'
    this.followUpInput.disabled    = true

    const sysP = '당신은 도움이 되는 AI 어시스턴트입니다. 반드시 한국어로 답변하세요.'
    const ctx  =
      `[원문]\n"${this.sourceText}"\n\n` +
      `[이전 결과]\n"${this.resultText}"\n\n` +
      `[추가 질문]\n${userPrompt}\n\n` +
      '오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'

    let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
    try {
      session = await LanguageModel.create({ systemPrompt: enforceKorean(sysP), outputLanguage: 'ja', temperature: 0.6, topK: 5 })
      const raw = await session.prompt(ctx)
      let result = extractResult(raw)
      if (needsCorrection(this.sourceText, result)) {
        result = extractResult(await session.prompt(
          "[ERROR] 인칭이 바뀌었어. '저/제'를 다시 '나/내'로 고쳐서 [RESULT] 태그 안에 다시 출력해."
        ))
      }
      this.showResult(result)
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err))
    } finally {
      session?.destroy()
      this.followUpInput.disabled = false
    }
  }

  // ── 결과 / 에러 표시 ─────────────────────────────────────

  private showResult(text: string): void {
    this.resultText = sanitizeResult(text)
    this.loadingEl.style.display  = 'none'
    this.resultEl.style.display   = 'block'
    this.resultEl.style.color     = '#cdd6f4'
    this.resultEl.textContent     = this.resultText
    this.statusEl.textContent     = 'AI 응답 완료'
    this.statusEl.style.color     = '#a6e3a1'
    this.copyBtn.disabled         = false
    this.replaceBtn.disabled      = false
    this.panelBtn.disabled        = false
    this.copyBtn.style.opacity    = '1'
    this.replaceBtn.style.opacity = '1'
    this.panelBtn.style.opacity   = '1'
    this.followUpInput.disabled   = false
  }

  private showError(error: string): void {
    this.loadingEl.style.display  = 'none'
    this.resultEl.style.display   = 'block'
    this.resultEl.style.color     = '#f38ba8'
    this.resultEl.textContent     = `오류: ${error}`
    this.statusEl.textContent     = '오류 발생'
    this.statusEl.style.color     = '#f38ba8'
    this.followUpInput.disabled   = false
  }

  // ── 패널 열기 ────────────────────────────────────────────

  private openSidebar(): void {
    try { chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }) } catch { /* invalidated */ }
  }

  private async continueInPanel(): Promise<void> {
    await chrome.storage?.local?.set({
      panelContinue: {
        action:  this.currentAction,
        text:    this.sourceText,
        result:  this.resultText,
        persona: this.selectedPersona?.label ?? null,
      },
    })
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' })
    this.destroy()
  }

  // ── DOM 빌드 ─────────────────────────────────────────────

  private buildEl(action: ToolbarAction, sourceText: string): {
    el:              HTMLDivElement
    header:          HTMLDivElement
    resizeHandle:    HTMLDivElement
    loadingEl:       HTMLElement
    personaSelectEl: HTMLElement
    resultEl:        HTMLElement
    statusEl:        HTMLElement
    copyBtn:         HTMLButtonElement
    replaceBtn:      HTMLButtonElement
    panelBtn:        HTMLButtonElement
    followUpInput:   HTMLTextAreaElement
    actionLabelEl:   HTMLElement
    actionIconEl:    HTMLElement
  } {
    // ── 루트 컨테이너 ─────────────────────────────────────
    const el = document.createElement('div')
    el.id = 'aurora-shell'
    css(el, {
      position:      'fixed',
      zIndex:        '2147483645',
      width:         `${DEFAULT_W}px`,
      height:        `${DEFAULT_H}px`,
      minWidth:      `${MIN_W}px`,
      minHeight:     `${MIN_H}px`,
      display:       'flex',
      flexDirection: 'column',
      background:    '#1a1c2e',
      border:        '1px solid #3d3f58',
      borderRadius:  '12px',
      boxShadow:     '0 12px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(139,92,246,0.1)',
      fontFamily:    'system-ui, sans-serif',
      fontSize:      '13px',
      color:         '#cdd6f4',
      overflow:      'hidden',
    })

    // ── 헤더 ──────────────────────────────────────────────
    const header = document.createElement('div')
    css(header, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0 12px',
      height:         '42px',
      borderBottom:   '1px solid #2d2f45',
      flexShrink:     '0',
      cursor:         'grab',
      background:     '#141625',
    })

    // 헤더 좌측: 액션 드롭다운
    const headerLeft = document.createElement('div')
    css(headerLeft, { position: 'relative', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' })

    const actionIconEl = document.createElement('span')
    actionIconEl.innerHTML = ACTION_ICONS[action] ?? ''
    css(actionIconEl, { display: 'flex', alignItems: 'center', color: '#cba6f7' })

    const actionLabel = document.createElement('span')
    actionLabel.textContent = ACTION_LABELS[action]
    css(actionLabel, { fontWeight: '600', color: '#cba6f7', fontSize: '13px' })

    const chevron = document.createElement('span')
    chevron.textContent = '▼'
    css(chevron, { fontSize: '9px', color: '#6c7086' })
    headerLeft.append(actionIconEl, actionLabel, chevron)

    // 액션 드롭다운
    const DROPDOWN_ACTIONS: ToolbarAction[] = ['translate', 'summarize', 'refine', 'ask']
    const actionDropdown = document.createElement('div')
    css(actionDropdown, {
      display: 'none', position: 'absolute', top: '100%', left: '0',
      zIndex: '999', background: '#141625', border: '1px solid #3d3f58',
      borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      minWidth: '120px', padding: '4px', marginTop: '4px',
    })
    for (const act of DROPDOWN_ACTIONS) {
      const item = document.createElement('button')
      css(item, {
        display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
        background: 'transparent', border: 'none', color: '#cdd6f4',
        fontSize: '12px', padding: '6px 10px', textAlign: 'left',
        cursor: 'pointer', borderRadius: '5px',
      })
      const iconSpan = document.createElement('span')
      iconSpan.innerHTML = ACTION_ICONS[act] ?? ''
      css(iconSpan, { display: 'flex', alignItems: 'center', opacity: '0.7', flexShrink: '0' })
      const textSpan = document.createElement('span')
      textSpan.textContent = ACTION_LABELS[act]
      item.append(iconSpan, textSpan)
      item.addEventListener('mouseenter', () => { item.style.background = '#313244' })
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent' })
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation()
        actionDropdown.style.display = 'none'
        this.switchAction(act)
      })
      actionDropdown.appendChild(item)
    }
    headerLeft.appendChild(actionDropdown)
    headerLeft.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault(); e.stopPropagation()
      actionDropdown.style.display = actionDropdown.style.display !== 'none' ? 'none' : 'block'
    })

    // 헤더 우측: 모델 뱃지 + 사이드바 열기 버튼 + 닫기
    const headerRight = document.createElement('div')
    css(headerRight, { display: 'flex', alignItems: 'center', gap: '6px' })

    // 모델 뱃지 (Gemini Nano 표시)
    const modelBadge = document.createElement('span')
    modelBadge.textContent = 'Gemini Nano'
    css(modelBadge, {
      background: '#0f111a', border: '1px solid #2d2f45', borderRadius: '4px',
      padding: '2px 7px', color: '#6c7086', fontSize: '10px', cursor: 'default',
    })

    // 사이드바 열기 버튼
    const sidebarBtn = document.createElement('button')
    sidebarBtn.title = 'Aurora 사이드바 열기'
    sidebarBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>`
    css(sidebarBtn, {
      background: 'transparent', border: 'none', color: '#6c7086',
      padding: '5px', borderRadius: '5px', cursor: 'pointer',
      display: 'flex', alignItems: 'center',
    })
    sidebarBtn.addEventListener('mouseenter', () => { sidebarBtn.style.color = '#cba6f7'; sidebarBtn.style.background = '#2d2f45' })
    sidebarBtn.addEventListener('mouseleave', () => { sidebarBtn.style.color = '#6c7086'; sidebarBtn.style.background = 'transparent' })
    sidebarBtn.addEventListener('click', () => this.openSidebar())

    // 닫기 버튼
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '×'
    css(closeBtn, {
      background: 'transparent', border: 'none', color: '#6c7086',
      cursor: 'pointer', fontSize: '18px', lineHeight: '1', padding: '0 2px',
    })
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#f38ba8' })
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#6c7086' })
    closeBtn.addEventListener('click', () => this.destroy())

    headerRight.append(modelBadge, sidebarBtn, closeBtn)
    header.append(headerLeft, headerRight)

    // ── 컨텍스트 바 (원문 미리보기) ──────────────────────
    const ctxBar = document.createElement('div')
    css(ctxBar, {
      padding:      '8px 14px',
      borderBottom: '1px solid #1e2035',
      background:   '#0f111a',
      flexShrink:   '0',
      fontSize:     '12px',
      color:        '#6c7086',
      lineHeight:   '1.5',
      display:      'flex',
      alignItems:   'flex-start',
      gap:          '6px',
    })
    const quoteIcon = document.createElement('span')
    quoteIcon.textContent = '"'
    css(quoteIcon, { color: '#3d3f58', fontSize: '16px', lineHeight: '1.3', flexShrink: '0' })
    const ctxText = document.createElement('span')
    ctxText.textContent = sourceText.length > 140 ? sourceText.slice(0, 140) + '…' : sourceText
    css(ctxText, { flex: '1', overflow: 'hidden', display: '-webkit-box',
      webkitLineClamp: '2', webkitBoxOrient: 'vertical' } as Partial<CSSStyleDeclaration>)
    // overflow 관련 비표준 속성은 style 직접 할당
    ctxText.style.cssText += ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden'
    ctxBar.append(quoteIcon, ctxText)

    // ── 바디 (결과 영역, flex:1) ──────────────────────────
    const body = document.createElement('div')
    css(body, {
      flex:          '1',
      overflowY:     'auto',
      padding:       '14px 16px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      minHeight:     '0',
    })
    body.style.cssText += ';scrollbar-width:thin;scrollbar-color:#2d2f45 transparent'

    // 로딩 애니메이션
    const loadingEl = document.createElement('div')
    css(loadingEl, { display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 0' })
    const dotsEl = document.createElement('span')
    dotsEl.className = 'aurora-loading-dots'
    dotsEl.innerHTML = '<span>●</span><span>●</span><span>●</span>'
    const loadingText = document.createElement('span')
    loadingText.textContent = 'GEMINI NANO 처리 중...'
    css(loadingText, { fontSize: '12px', color: '#6c7086', letterSpacing: '0.05em' })
    loadingEl.append(dotsEl, loadingText)

    // 페르소나 선택 UI
    const personaSelectEl = this.buildPersonaSelect()

    // 결과 영역
    const resultEl = document.createElement('div')
    css(resultEl, {
      display:    'none',
      whiteSpace: 'pre-wrap',
      lineHeight: '1.75',
      wordBreak:  'break-word',
      color:      '#cdd6f4',
      fontSize:   '14px',
    })

    body.append(loadingEl, personaSelectEl, resultEl)

    // ── 상태 + 액션 버튼 행 ───────────────────────────────
    const footer1 = document.createElement('div')
    css(footer1, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '8px 14px',
      borderTop:      '1px solid #2d2f45',
      flexShrink:     '0',
      background:     '#141625',
      gap:            '8px',
    })

    // 왼쪽: Aurora 아이콘 + 상태 텍스트
    const statusLeft = document.createElement('div')
    css(statusLeft, { display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0', flex: '1' })
    const auroraIcon = document.createElement('span')
    auroraIcon.innerHTML = `<svg viewBox="0 0 100 100" width="14" height="14" fill="none"><defs><linearGradient id="ag-sh" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><path d="M20 80L50 20L80 80" stroke="url(#ag-sh)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 80L50 50L65 80" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>`
    const statusEl = document.createElement('span')
    statusEl.textContent = 'GEMINI NANO 처리 중...'
    css(statusEl, { fontSize: '11px', color: '#6c7086', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
    statusLeft.append(auroraIcon, statusEl)

    // 오른쪽: 바꾸기 | 복사 | 패널에서 계속
    const btnGroup = document.createElement('div')
    css(btnGroup, { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: '0' })

    // ↵ 바꾸기 버튼
    const replaceBtn = document.createElement('button')
    replaceBtn.textContent = '↵ 바꾸기'
    replaceBtn.disabled = true
    css(replaceBtn, {
      background: 'linear-gradient(135deg, #7c3aed, #db2777)', border: 'none',
      color: '#fff', fontSize: '11px', fontWeight: '600',
      padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', opacity: '0.4',
    })
    replaceBtn.addEventListener('click', () => {
      if (!this.resultText) return
      const err = this.replaceInSource()
      if (err === null) {
        replaceBtn.textContent = '✓ 바꿈'
        setTimeout(() => { replaceBtn.textContent = '↵ 바꾸기' }, 1500)
      } else {
        // 실패 시 버튼 라벨 유지, 상태 텍스트로만 알림
        statusEl.textContent = err
        statusEl.style.color = '#f38ba8'
        setTimeout(() => { statusEl.textContent = 'AI 응답 완료'; statusEl.style.color = '#a6e3a1' }, 2000)
      }
    })

    // 복사 버튼
    const copyBtn = document.createElement('button')
    copyBtn.title = '복사'
    copyBtn.disabled = true
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
    styleIconBtn(copyBtn)
    copyBtn.style.opacity = '0.4'
    copyBtn.addEventListener('click', () => {
      if (!this.resultText) return
      void navigator.clipboard.writeText(this.resultText).then(() => {
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="#a6e3a1" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`
        setTimeout(() => {
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
        }, 1500)
      })
    })

    // 패널에서 계속 버튼
    const panelBtn = document.createElement('button')
    panelBtn.title = '패널에서 계속'
    panelBtn.disabled = true
    panelBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
    styleIconBtn(panelBtn)
    panelBtn.style.opacity = '0.4'
    panelBtn.addEventListener('click', () => void this.continueInPanel())

    btnGroup.append(replaceBtn, copyBtn, panelBtn)
    footer1.append(statusLeft, btnGroup)

    // ── 추가 질문 입력창 (항상 표시) ──────────────────────
    const footer2 = document.createElement('div')
    css(footer2, {
      display:       'flex',
      alignItems:    'flex-end',
      gap:           '8px',
      padding:       '8px 14px 10px',
      borderTop:     '1px solid #1e2035',
      flexShrink:    '0',
      background:    '#0f111a',
      pointerEvents: 'auto',
    })

    const inputWrap = document.createElement('div')
    css(inputWrap, {
      flex:         '1',
      background:   '#141625',
      border:       '1px solid #2d2f45',
      borderRadius: '10px',
      padding:      '6px 10px',
      transition:   'border-color 0.15s',
    })
    inputWrap.addEventListener('focusin',  () => { inputWrap.style.borderColor = '#7c3aed' })
    inputWrap.addEventListener('focusout', () => { inputWrap.style.borderColor = '#2d2f45' })

    const followUpInput = document.createElement('textarea')
    followUpInput.placeholder = 'AI에게 추가 질문을 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)'
    followUpInput.rows = 1
    css(followUpInput, {
      width:         '100%',
      background:    'transparent',
      border:        'none',
      color:         '#cdd6f4',
      fontSize:      '12px',
      resize:        'none',
      outline:       'none',
      lineHeight:    '1.5',
      fontFamily:    'system-ui, sans-serif',
      display:       'block',
      pointerEvents: 'auto',
      overflow:      'hidden',
    })
    followUpInput.addEventListener('click', () => {
      followUpInput.focus()
      console.log('[AURORA] followUpInput focused')
    })
    // 자동 높이 확장 (최대 ~5줄)
    followUpInput.addEventListener('input', () => {
      followUpInput.style.height = 'auto'
      followUpInput.style.height = `${Math.min(followUpInput.scrollHeight, 84)}px`
    })
    followUpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const text = followUpInput.value.trim()
        if (text) { followUpInput.value = ''; followUpInput.style.height = 'auto'; void this.runFollowUp(text) }
      }
    })
    inputWrap.appendChild(followUpInput)

    const sendBtn = document.createElement('button')
    sendBtn.title = '전송'
    sendBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>`
    css(sendBtn, {
      background: '#8b5cf6', border: 'none', borderRadius: '8px',
      padding: '7px 8px', cursor: 'pointer', display: 'flex',
      alignItems: 'center', flexShrink: '0',
    })
    sendBtn.addEventListener('mouseenter', () => { sendBtn.style.background = '#7c3aed' })
    sendBtn.addEventListener('mouseleave', () => { sendBtn.style.background = '#8b5cf6' })
    sendBtn.addEventListener('click', () => {
      const text = followUpInput.value.trim()
      if (text) { followUpInput.value = ''; followUpInput.style.height = 'auto'; void this.runFollowUp(text) }
    })

    footer2.append(inputWrap, sendBtn)

    // ── 리사이즈 핸들 ────────────────────────────────────
    const resizeHandle = document.createElement('div')
    resizeHandle.title = '크기 조절'
    css(resizeHandle, {
      position: 'absolute', right: '0', bottom: '0',
      width: '18px', height: '18px', cursor: 'se-resize', zIndex: '10',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
      padding: '3px',
    })
    resizeHandle.innerHTML = `<svg viewBox="0 0 10 10" width="10" height="10" fill="none"><path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#3d3f58" stroke-width="1.5" stroke-linecap="round"/></svg>`
    el.style.position = 'fixed' // ensure relative children use this

    el.append(header, ctxBar, body, footer1, footer2, resizeHandle)

    return {
      el, header, resizeHandle,
      loadingEl, personaSelectEl, resultEl,
      statusEl, copyBtn, replaceBtn, panelBtn,
      followUpInput,
      actionLabelEl: actionLabel,
      actionIconEl,
    }
  }

  // ── 페르소나 선택 빌드 ────────────────────────────────────

  private buildPersonaSelect(): HTMLElement {
    const wrap = document.createElement('div')
    css(wrap, { display: 'none', flexDirection: 'column', gap: '8px' })

    const title = document.createElement('div')
    title.textContent = '방식 선택'
    css(title, { fontSize: '12px', color: '#6c7086', marginBottom: '4px', fontWeight: '600' })
    wrap.appendChild(title)

    for (const persona of PERSONAS) {
      const btn = document.createElement('button')
      css(btn, {
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: '3px', width: '100%', background: '#0f111a',
        border: '1px solid #2d2f45', borderRadius: '10px',
        padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
      })
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#cba6f7' })
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#2d2f45' })
      const name = document.createElement('span')
      name.textContent = persona.label
      css(name, { color: '#cdd6f4', fontSize: '13px', fontWeight: '500' })
      const desc = document.createElement('span')
      desc.textContent = persona.description
      css(desc, { color: '#6c7086', fontSize: '11px' })
      btn.append(name, desc)
      btn.addEventListener('click', () => {
        this.selectedPersona = persona
        this.hidePersonaSelect()
        void this.runAction(persona.systemPrompt, sandwichPrompt(this.sourceText))
      })
      wrap.appendChild(btn)
    }
    return wrap
  }

  // ── 드래그 이동 ───────────────────────────────────────────

  private initDrag(handle: HTMLElement): void {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false

    const onMove = (e: MouseEvent) => {
      if (!dragging) return
      const left = Math.max(0, Math.min(startLeft + e.clientX - startX, window.innerWidth  - this.el.offsetWidth))
      const top  = Math.max(0, Math.min(startTop  + e.clientY - startY, window.innerHeight - this.el.offsetHeight))
      this.el.style.left = `${left}px`
      this.el.style.top  = `${top}px`
    }
    const onUp = () => {
      dragging = false
      handle.style.cursor = 'grab'
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    handle.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' ||
          (e.target as HTMLElement).closest('button, [data-no-drag]')) return
      e.preventDefault()
      dragging   = true
      startX     = e.clientX; startY     = e.clientY
      startLeft  = parseInt(this.el.style.left, 10) || 0
      startTop   = parseInt(this.el.style.top,  10) || 0
      handle.style.cursor = 'grabbing'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  // ── 리사이즈 ─────────────────────────────────────────────

  private initResize(handle: HTMLElement): void {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startW = this.el.offsetWidth
      const startH = this.el.offsetHeight

      const onMove = (ev: MouseEvent) => {
        const newW = Math.max(MIN_W, Math.min(startW + ev.clientX - startX, window.innerWidth  - 16))
        const newH = Math.max(MIN_H, Math.min(startH + ev.clientY - startY, window.innerHeight - 16))
        this.el.style.width  = `${newW}px`
        this.el.style.height = `${newH}px`
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        void chrome.storage.local.set({
          aurora_shell_size: { w: this.el.offsetWidth, h: this.el.offsetHeight },
        })
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  // ── 위치 계산 ─────────────────────────────────────────────

  private position(rect: DOMRect): void {
    const W     = DEFAULT_W
    const H_EST = DEFAULT_H
    const OFFSET = 10

    let top = rect.bottom + OFFSET
    if (top + H_EST > window.innerHeight - 8) {
      top = rect.top - H_EST - OFFSET
      if (top < 8) top = 8
    }
    let left = rect.left + rect.width / 2 - W / 2
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))

    this.el.style.top  = `${top}px`
    this.el.style.left = `${left}px`
  }

  // ── CSS 주입 ─────────────────────────────────────────────

  private injectStyle(): void {
    if (document.getElementById('aurora-shell-style')) return
    const style = document.createElement('style')
    style.id = 'aurora-shell-style'
    style.textContent = `
      .aurora-loading-dots span {
        display: inline-block; width: 7px; height: 7px; border-radius: 50%;
        background: #8b5cf6; margin: 0 2px;
        animation: aurora-dot-bounce 1.2s ease-in-out infinite;
      }
      .aurora-loading-dots span:nth-child(2) { animation-delay: 0.2s; background: #a855f7; }
      .aurora-loading-dots span:nth-child(3) { animation-delay: 0.4s; background: #ec4899; }
      @keyframes aurora-dot-bounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30%            { transform: translateY(-6px); opacity: 1; }
      }
      #aurora-shell *::-webkit-scrollbar { width: 4px; }
      #aurora-shell *::-webkit-scrollbar-track { background: transparent; }
      #aurora-shell *::-webkit-scrollbar-thumb { background: #2d2f45; border-radius: 2px; }
    `
    document.head.appendChild(style)
  }

  // ── 바꾸기 ────────────────────────────────────────────────
  // null 반환 = 성공 / string 반환 = 에러 메시지

  private replaceInSource(): string | null {
    const { el, selStart, selEnd, isContentEditable, rangeClone } = this.sourceMeta

    if (!el) return '원문 선택 영역을 찾을 수 없습니다'

    // ── textarea / input ──────────────────────────────────
    if (!isContentEditable && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
      if (selStart < 0 || selEnd <= selStart) {
        return 'textarea: 선택 위치를 찾을 수 없습니다'
      }
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement
      inputEl.focus()
      inputEl.value =
        inputEl.value.slice(0, selStart) + this.resultText + inputEl.value.slice(selEnd)
      inputEl.setSelectionRange(selStart, selStart + this.resultText.length)
      inputEl.dispatchEvent(new Event('input',  { bubbles: true }))
      inputEl.dispatchEvent(new Event('change', { bubbles: true }))
      return null
    }

    // ── contenteditable / 리치 에디터 ────────────────────
    if (isContentEditable) {
      if (!rangeClone) return 'contenteditable: 선택 범위를 찾을 수 없습니다'

      const sel = window.getSelection()
      if (!sel) return 'contenteditable: Selection API 사용 불가'

      try {
        el.focus()
        sel.removeAllRanges()
        sel.addRange(rangeClone)
        const ok = document.execCommand('insertText', false, this.resultText)
        if (!ok) {
          // execCommand 실패 시 DOM 직접 조작으로 폴백
          rangeClone.deleteContents()
          rangeClone.insertNode(document.createTextNode(this.resultText))
          sel.removeAllRanges()
        }
        el.dispatchEvent(new Event('input',  { bubbles: true }))
        return null
      } catch {
        return 'contenteditable: 바꾸기 중 오류가 발생했습니다'
      }
    }

    return '원문 선택 영역을 찾을 수 없습니다'
  }

  destroy(): void { this.el?.remove() }
}

// ── 유틸 ──────────────────────────────────────────────────────

// 최종 방어선: [RESULT]/[/RESULT] 태그 잔재를 모두 제거
function sanitizeResult(text: string): string {
  return text.replace(/\[\/?\s*RESULT\s*\]/gi, '').trim()
}

function extractResult(rawText: string): string {
  // 정규식으로 [RESULT]...[/RESULT] 블록 추출 (대소문자 무관)
  const match = rawText.match(/\[RESULT\]([\s\S]*?)\[\/RESULT\]/i)
  if (match?.[1]) return match[1].trim()

  // 프롬프트 끝에 [RESULT]를 넣은 경우 모델이 여는 태그 없이 내용 + [/RESULT]만 출력할 수 있음.
  // 이 경우 [RESULT] 여는 태그가 rawText에 없으므로 아래에서 [/RESULT] 닫는 태그만 제거.
  const startIdx = rawText.indexOf('[RESULT]')
  if (startIdx !== -1) {
    return rawText.slice(startIdx + 8).replace(/\[\/RESULT\][\s\S]*/i, '').trim()
  }

  // 폴백: 태그 없이 [/RESULT]만 남아 있으면 제거
  return rawText.replace(/\[\/RESULT\][\s\S]*/i, '').trim()
}

function needsCorrection(input: string, output: string): boolean {
  const markers = ['저 ', '제 ', '제가', '저의', '당신']
  return markers.some(m => !input.includes(m) && output.includes(m))
}

function css(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles)
}

function styleIconBtn(btn: HTMLButtonElement): void {
  css(btn, {
    background: 'transparent', border: 'none', color: '#6c7086',
    padding: '5px', borderRadius: '5px', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  })
  btn.addEventListener('mouseenter', () => {
    if (!btn.disabled) { btn.style.background = '#313244'; btn.style.color = '#cdd6f4' }
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent'; btn.style.color = '#6c7086'
  })
}

```

## File: `src/shared/types/index.ts`
```typescript
export type ToolbarMode   = 'read' | 'write'
export type ToolbarAction =
  | 'translate' | 'summarize' | 'refine' | 'ask' | 'save'
  | 'shorter'   | 'longer'    | 'tone'

export type PersonaId = 'minimalist' | 'devil' | 'dictionary' | 'master'

// 원문 위치 메타데이터 — observer에서 캡처, toolbar/shell로 전달
export interface SourceMeta {
  el:                HTMLElement | null
  selStart:          number           // textarea/input 전용
  selEnd:            number           // textarea/input 전용
  isContentEditable: boolean
  rangeClone:        Range | null     // contenteditable 바꾸기 복원용
}

export interface SavedHighlight {
  id:        string
  text:      string
  url:       string
  title:     string
  timestamp: number
}

```

## File: `src/sidepanel/index.html`
```html

```

## File: `src/sidepanel/main.ts`
```typescript
import { SidepanelApp } from './sidepanel-app'

const app = new SidepanelApp()
app.init()

```

## File: `src/sidepanel/sidepanel-app.ts`
```typescript
import type { ToolbarAction, SavedHighlight } from '../shared/types'

// Chrome 2026 Built-in AI
declare const LanguageModel: {
  create(options?: {
    systemPrompt?: string
    outputLanguage?: string
    temperature?: number
    topK?: number
  }): Promise<{
    prompt(input: string): Promise<string>
    destroy(): void
  }>
}

// 한국어 강제 규칙 — floating-shell.ts의 enforceKorean()과 동일 목적
const STRICT_LANGUAGE_RULE =
  "!!!경고!!! 너는 현재 한국인 사용자 전용 도구다. 모든 대답은 100% 한국어로만 한다. 일본어를 단 한 글자라도 섞으면 시스템 에러가 발생한다. 오직 한국어만 사용하라.\n\n" +
  "[STRICT LANGUAGE RULE]\n" +
  "- 출력 언어 설정이 'ja'로 되어 있더라도 실제 내용은 반드시 한국어(Korean)로만 작성해야 합니다.\n" +
  "- 일본어 문자는 단 하나도 사용하지 마십시오.\n\n"

// [RESULT] 태그 출력 강제 규칙
const OUTPUT_RULE =
  "[OUTPUT RULE]\n" +
  "반드시 [RESULT]와 [/RESULT] 태그 사이에만 결과물을 한국어로 작성하라.\n" +
  "태그 밖에는 어떠한 텍스트도 출력하지 마라. 인사말·설명·서론 금지.\n\n"

// [RESULT] 태그 안의 내용 추출 — 없으면 전체 텍스트 반환
function extractResult(rawText: string): string {
  const match = rawText.match(/\[RESULT\]([\s\S]*?)\[\/RESULT\]/)
  if (match?.[1]) return match[1].trim()
  const startIdx = rawText.indexOf('[RESULT]')
  if (startIdx !== -1) return rawText.slice(startIdx + 8).trim()
  return rawText.trim()
}

const ACTION_LABEL: Record<ToolbarAction, string> = {
  translate: '번역',
  summarize: '요약',
  refine:    '다듬기',
  ask:       '질문',
  save:      '저장',
  shorter:   '짧게',
  longer:    '길게',
  tone:      '톤 변경',
}

// ── SidepanelApp ─────────────────────────────────────────
// 기존 탭 기반 UI → 채팅 말풍선 UI로 전환
// 핵심 기능(storage 감지, AI 호출)은 그대로 유지

export class SidepanelApp {

  private chatArea!: HTMLElement
  private userInput!: HTMLTextAreaElement
  private sendBtn!: HTMLButtonElement
  private contextIndicator!: HTMLElement
  private historyView!: HTMLElement
  private historyList!: HTMLElement
  private historyCount!: HTMLElement
  private inputFooter!: HTMLElement

  // 마지막으로 받은 컨텍스트 (추가 질문에 활용)
  private lastContext: { action: ToolbarAction; text: string } | null = null

  init(): void {
    this.chatArea         = document.getElementById('chat-area')!
    this.userInput        = document.getElementById('user-input') as HTMLTextAreaElement
    this.sendBtn          = document.getElementById('send-btn') as HTMLButtonElement
    this.contextIndicator = document.getElementById('context-indicator')!
    this.historyView      = document.getElementById('history-view')!
    this.historyList      = document.getElementById('history-list')!
    this.historyCount     = document.getElementById('history-count')!
    this.inputFooter      = document.getElementById('input-footer')!

    document.getElementById('clear-all-btn')!
      .addEventListener('click', () => void this.clearAllHighlights())

    this.bindInput()
    this.bindSidebarBtns()
    this.listenRuntime()
    this.loadPending()
    this.bindModelSelect()

    // 첫 실행 시 환영 메시지
    this.appendAiBubble('안녕하세요! 웹페이지에서 텍스트를 드래그하여 선택하면 Aurora가 바로 도와드립니다. 아래 입력창에 질문을 직접 입력해도 됩니다.')
  }

  // ── 모델 선택기 바인딩 ──────────────────────────────────
  private bindModelSelect(): void {
    const sel = document.querySelector<HTMLSelectElement>('.model-select')
    if (!sel) return
    void chrome.storage.local.get('aurora_model').then((res) => {
      sel.value = (res['aurora_model'] as string) ?? 'gemini-nano'
    })
    sel.addEventListener('change', () => {
      void chrome.storage.local.set({ aurora_model: sel.value })
    })
  }

  // ── 입력 바인딩 ────────────────────────────────────────

  private bindInput(): void {
    // 전송 버튼 클릭
    this.sendBtn.addEventListener('click', () => this.sendMessage())

    // Enter 키 전송, Shift+Enter 줄바꿈
    this.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    // 입력창 자동 높이 조절
    this.userInput.addEventListener('input', () => {
      this.userInput.style.height = 'auto'
      this.userInput.style.height = `${Math.min(this.userInput.scrollHeight, 120)}px`
    })
  }

  private sendMessage(): void {
    const text = this.userInput.value.trim()
    if (!text) return
    this.userInput.value = ''
    this.userInput.style.height = 'auto'

    this.appendUserBubble(text)
    void this.runAI(text)
  }

  // ── 사이드바 버튼 ───────────────────────────────────────

  private bindSidebarBtns(): void {
    document.getElementById('sb-chat')?.addEventListener('click', () => {
      this.showChatPanel()
    })
    document.getElementById('sb-history')?.addEventListener('click', () => {
      this.showHistoryPanel()
    })
    document.getElementById('sb-settings')?.addEventListener('click', () => {
      this.appendAiBubble('설정 기능은 준비 중입니다.')
    })
  }

  // ── 런타임 메시지 감지 ──────────────────────────────────
  // floating-shell에서 "패널에서 계속" 버튼 클릭 시
  // → chrome.storage.local에 panelContinue가 저장됨
  // → 패널이 이미 열려 있으면 onChanged로 감지
  // → 막 열렸으면 loadPending()으로 처리

  private listenRuntime(): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return

      // floating-shell → sidepanel 전달
      const continueChange = changes['panelContinue']
      if (continueChange?.newValue) {
        const val = continueChange.newValue as {
          action: ToolbarAction
          text: string
          result: string
          persona?: string | null
        }
        void chrome.storage.local.remove('panelContinue')
        this.displayFromShell(val)
      }

      // 하이라이트 저장 감지 → 히스토리 뷰가 열려 있으면 즉시 갱신
      if ('aurora_highlights' in changes && this.historyView.style.display !== 'none') {
        const highlights: SavedHighlight[] = changes['aurora_highlights']?.newValue ?? []
        this.renderHistory(highlights)
      }
    })
  }

  private loadPending(): void {
    void chrome.storage.local.get('panelContinue').then((res) => {
      const val = res['panelContinue'] as {
        action: ToolbarAction
        text: string
        result: string
        persona?: string | null
      } | undefined
      if (!val) return
      void chrome.storage.local.remove('panelContinue')
      this.displayFromShell(val)
    })
  }

  // floating-shell에서 전달받은 결과를 말풍선으로 표시
  private displayFromShell(val: {
    action: ToolbarAction
    text: string
    result: string
    persona?: string | null
  }): void {
    this.lastContext = { action: val.action, text: val.text }

    // 컨텍스트 인디케이터 업데이트
    this.contextIndicator.textContent = `${ACTION_LABEL[val.action]} 컨텍스트 활성`
    this.contextIndicator.style.color = '#8b5cf6'

    // 원문 + 액션 컨텍스트 뱃지 표시
    this.appendContextBadge(val.action, val.text, val.persona ?? null)

    // AI 결과 말풍선 표시
    this.appendAiBubble(val.result)
  }

  // ── AI 호출 (사이드패널에서 직접 질문할 때) ─────────────

  private async runAI(userText: string): Promise<void> {
    // 로딩 말풍선 먼저 표시
    const { setContent, setError } = this.appendAiBubble('', true)

    const systemPrompt =
      STRICT_LANGUAGE_RULE +
      OUTPUT_RULE +
      '당신은 도움이 되는 AI 어시스턴트입니다. 반드시 한국어로 답변하세요. 간결하고 명확하게 답하세요.'

    // 이전 컨텍스트가 있으면 프롬프트에 포함
    const basePrompt = this.lastContext
      ? `[컨텍스트: 사용자가 "${this.lastContext.text}" 텍스트에 대해 ${ACTION_LABEL[this.lastContext.action]} 작업 중]\n\n[질문]\n${userText}`
      : userText
    const prompt = basePrompt + '\n\n오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'

    let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
    try {
      session = await LanguageModel.create({ systemPrompt, outputLanguage: 'ja', temperature: 0.6, topK: 5 })
      const rawResponse = await session.prompt(prompt)
      console.log('[ORARA-DEBUG] Nano Raw Response:', rawResponse)
      setContent(extractResult(rawResponse))
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      setError(error)
    } finally {
      session?.destroy()
    }
  }

  // ── 말풍선 생성 헬퍼 ────────────────────────────────────

  // 사용자 말풍선 (오른쪽 정렬)
  private appendUserBubble(text: string): void {
    const row = document.createElement('div')
    row.className = 'bubble-user'

    const bubble = document.createElement('div')
    bubble.className = 'bubble-content'
    bubble.textContent = text

    row.appendChild(bubble)
    this.chatArea.appendChild(row)
    this.scrollToBottom()
  }

  // AI 말풍선 (왼쪽 정렬, Aurora 아바타 포함)
  // loading=true 이면 점 애니메이션 표시, 나중에 setContent/setError로 업데이트
  private appendAiBubble(
    text: string,
    loading = false
  ): { el: HTMLElement; setContent: (t: string) => void; setError: (e: string) => void } {
    const row = document.createElement('div')
    row.className = 'bubble-ai'

    // AI 아바타
    const avatar = document.createElement('div')
    avatar.className = 'ai-avatar'
    avatar.innerHTML = `
      <svg viewBox="0 0 100 100" width="16" height="16" fill="none">
        <defs>
          <linearGradient id="ag-av" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </linearGradient>
        </defs>
        <path d="M20 80L50 20L80 80" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
        <path d="M35 80L50 50L65 80" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
      </svg>
    `

    // 말풍선 내용
    const bubble = document.createElement('div')
    bubble.className = 'bubble-content'

    if (loading) {
      // 로딩 상태: 점 애니메이션
      const dots = document.createElement('div')
      dots.className = 'loading-dots'
      dots.innerHTML = '<span></span><span></span><span></span>'
      bubble.appendChild(dots)
    } else if (text) {
      bubble.textContent = text
    }

    row.append(avatar, bubble)
    this.chatArea.appendChild(row)
    this.scrollToBottom()

    // 외부에서 내용을 업데이트할 수 있는 함수 반환
    return {
      el: row,
      setContent: (t: string) => {
        bubble.textContent = t
        this.scrollToBottom()
      },
      setError: (e: string) => {
        bubble.textContent = `오류: ${e}`
        bubble.style.color = '#f38ba8'
        this.scrollToBottom()
      },
    }
  }

  // 컨텍스트 뱃지 (액션 종류 + 원문 미리보기)
  private appendContextBadge(
    action: ToolbarAction,
    text: string,
    persona: string | null
  ): void {
    const badge = document.createElement('div')
    badge.className = 'context-badge'

    const actionLine = document.createElement('div')
    actionLine.className = 'badge-action'
    actionLine.textContent = persona
      ? `${ACTION_LABEL[action]} · ${persona}`
      : ACTION_LABEL[action]

    const textLine = document.createElement('div')
    textLine.className = 'badge-text'
    textLine.textContent = text.length > 80 ? text.slice(0, 80) + '…' : text

    badge.append(actionLine, textLine)
    this.chatArea.appendChild(badge)
    this.scrollToBottom()
  }

  // 채팅 영역 맨 아래로 스크롤
  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      this.chatArea.scrollTop = this.chatArea.scrollHeight
    })
  }

  // ── 패널 전환 ───────────────────────────────────────────

  private showChatPanel(): void {
    document.getElementById('sb-chat')?.classList.add('active')
    document.getElementById('sb-history')?.classList.remove('active')
    this.chatArea.style.display    = 'flex'
    this.inputFooter.style.display = 'block'
    this.historyView.style.display = 'none'
  }

  private showHistoryPanel(): void {
    document.getElementById('sb-history')?.classList.add('active')
    document.getElementById('sb-chat')?.classList.remove('active')
    this.chatArea.style.display    = 'none'
    this.inputFooter.style.display = 'none'
    this.historyView.style.display = 'flex'

    void chrome.storage.local.get('aurora_highlights').then((result) => {
      const highlights: SavedHighlight[] = result['aurora_highlights'] ?? []
      this.renderHistory(highlights)
    })
  }

  // ── 히스토리 렌더링 ─────────────────────────────────────

  private renderHistory(highlights: SavedHighlight[]): void {
    // 카운트 업데이트
    this.historyCount.textContent = highlights.length > 0 ? `(${highlights.length})` : ''

    // 목록 초기화
    while (this.historyList.firstChild) {
      this.historyList.removeChild(this.historyList.firstChild)
    }

    if (highlights.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'history-empty'
      empty.textContent = '저장된 하이라이트가 없습니다.\n웹페이지에서 텍스트를 드래그한 뒤 저장 버튼을 눌러보세요.'
      this.historyList.appendChild(empty)
      return
    }

    for (const item of highlights) {
      this.historyList.appendChild(this.buildHistoryCard(item))
    }
  }

  private buildHistoryCard(item: SavedHighlight): HTMLElement {
    const card = document.createElement('div')
    card.className = 'history-card'

    // 본문 텍스트 (최대 150자)
    const textEl = document.createElement('p')
    textEl.className = 'highlight-text'
    textEl.textContent = item.text.length > 150
      ? item.text.slice(0, 150) + '…'
      : item.text

    // 메타 행: 날짜 · 도메인 · 삭제 버튼
    const meta = document.createElement('div')
    meta.className = 'history-meta'

    const date = new Date(item.timestamp)
    const pad  = (n: number) => String(n).padStart(2, '0')
    const dateEl = document.createElement('span')
    dateEl.className = 'history-date'
    dateEl.textContent = `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`

    const siteEl = document.createElement('span')
    siteEl.className = 'history-site'
    siteEl.title = item.url
    try {
      siteEl.textContent = new URL(item.url).hostname
    } catch {
      siteEl.textContent = item.url
    }

    const delBtn = document.createElement('button')
    delBtn.className = 'history-del'
    delBtn.title = '삭제'
    delBtn.textContent = '×'
    delBtn.addEventListener('click', () => void this.deleteHighlight(item.id))

    meta.append(dateEl, siteEl, delBtn)
    card.append(textEl, meta)
    return card
  }

  // ── 삭제 ────────────────────────────────────────────────

  private async deleteHighlight(id: string): Promise<void> {
    const result = await chrome.storage.local.get('aurora_highlights')
    const highlights: SavedHighlight[] = result['aurora_highlights'] ?? []
    const updated = highlights.filter(h => h.id !== id)
    await chrome.storage.local.set({ aurora_highlights: updated })
    this.renderHistory(updated)
  }

  private async clearAllHighlights(): Promise<void> {
    await chrome.storage.local.remove('aurora_highlights')
    this.renderHistory([])
  }
}
```

## File: `src/sidepanel/sidepanel.html`
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aurora</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      background: #0f111a;
      color: #cdd6f4;
      height: 100vh;
      display: flex;
      overflow: hidden;
    }

    /* ═══════════════════════════════════════════
       메인 패널 (채팅 영역)
    ═══════════════════════════════════════════ */
    .main-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #1a1c2e;
      border-right: 1px solid #2d2f45;
    }

    /* ── 헤더 ── */
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid #2d2f45;
      background: #141625;
      flex-shrink: 0;
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Aurora 로고 SVG */
    .aurora-logo-svg { flex-shrink: 0; }

    .aurora-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.03em;
      background: linear-gradient(135deg, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .model-select {
      background: #0f111a;
      border: 1px solid #2d2f45;
      border-radius: 6px;
      color: #9ca3af;
      font-size: 11px;
      padding: 4px 8px;
      outline: none;
      cursor: pointer;
    }

    .model-select:hover { border-color: #4c4f6b; }

    /* ── 채팅 영역 ── */
    .chat-area {
      flex: 1;
      overflow-y: auto;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* 스크롤바 스타일 */
    .chat-area::-webkit-scrollbar { width: 4px; }
    .chat-area::-webkit-scrollbar-track { background: transparent; }
    .chat-area::-webkit-scrollbar-thumb { background: #2d2f45; border-radius: 2px; }

    /* ── 채팅 말풍선 ── */

    /* 사용자 말풍선 (오른쪽 정렬) */
    .bubble-user {
      display: flex;
      justify-content: flex-end;
    }

    .bubble-user .bubble-content {
      background: #2d2f45;
      color: #e2e8f0;
      border-radius: 18px 18px 4px 18px;
      padding: 10px 14px;
      max-width: 85%;
      font-size: 13px;
      line-height: 1.6;
      word-break: break-word;
    }

    /* AI 말풍선 (왼쪽 정렬) */
    .bubble-ai {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    /* AI 아바타 (퍼플→핑크 그라데이션 원형) */
    .ai-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #db2777);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 12px rgba(124,58,237,0.4);
    }

    .bubble-ai .bubble-content {
      background: #141625;
      border: 1px solid #2d2f45;
      color: #d1d5db;
      border-radius: 4px 18px 18px 18px;
      padding: 12px 14px;
      max-width: calc(100% - 42px);
      font-size: 13px;
      line-height: 1.7;
      word-break: break-word;
    }

    /* 컨텍스트 뱃지 (액션 종류 + 원문 미리보기) */
    .context-badge {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: #0f111a;
      border: 1px solid #2d2f45;
      border-left: 3px solid #8b5cf6;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 4px;
      font-size: 11px;
    }

    .context-badge .badge-action {
      color: #a78bfa;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .context-badge .badge-text {
      color: #6c7086;
      line-height: 1.5;
    }

    /* 로딩 점 애니메이션 */
    .loading-dots span {
      display: inline-block;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #8b5cf6;
      margin: 0 2px;
      animation: dot-bounce 1.2s ease-in-out infinite;
    }
    .loading-dots span:nth-child(2) { animation-delay: 0.2s; background: #a855f7; }
    .loading-dots span:nth-child(3) { animation-delay: 0.4s; background: #ec4899; }
    @keyframes dot-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    /* 빈 상태 메시지 */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px 20px;
      color: #45475a;
      text-align: center;
      flex: 1;
    }

    .empty-state svg { opacity: 0.4; }
    .empty-state p { font-size: 13px; line-height: 1.6; }

    /* 마크다운 스타일 (AI 결과에 적용) */
    .bubble-content ul,
    .bubble-content ol { padding-left: 1.4em; margin: 4px 0; }
    .bubble-content li { margin-bottom: 4px; }
    .bubble-content strong { color: #f5c2e7; }
    .bubble-content code {
      background: #313244; border-radius: 4px;
      padding: 1px 5px; font-size: 12px;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
    }

    /* ── 입력 영역 (푸터) ── */
    .input-footer {
      padding: 12px 14px;
      border-top: 1px solid #2d2f45;
      background: #141625;
      flex-shrink: 0;
    }

    .input-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: #0f111a;
      border: 1px solid #2d2f45;
      border-radius: 12px;
      padding: 8px 12px;
      transition: border-color 0.15s;
    }

    .input-row:focus-within { border-color: #7c3aed; }

    #user-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #cdd6f4;
      font-size: 13px;
      resize: none;
      outline: none;
      height: 36px;
      max-height: 120px;
      font-family: system-ui, sans-serif;
      line-height: 1.5;
    }

    #user-input::placeholder { color: #45475a; }

    #send-btn {
      background: #7c3aed;
      border: none;
      border-radius: 8px;
      padding: 7px 9px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    #send-btn:hover { background: #6d28d9; }
    #send-btn:disabled { background: #2d2f45; cursor: not-allowed; }

    .input-hints {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 10px;
      color: #45475a;
    }

    .context-active {
      color: #8b5cf6;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    /* ═══════════════════════════════════════════
       슬림 사이드바 (우측 60px)
    ═══════════════════════════════════════════ */
    .slim-sidebar {
      width: 56px;
      background: #0f111a;
      border-left: 1px solid #2d2f45;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 0;
      justify-content: space-between;
    }

    .sidebar-top,
    .sidebar-bottom {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 100%;
      padding: 0 6px;
    }

    .sidebar-sep {
      width: 32px;
      height: 1px;
      background: #2d2f45;
      margin: 8px 0;
    }

    /* 사이드바 버튼 */
    .sb-btn {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: #6c7086;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s, transform 0.15s;
    }

    .sb-btn:hover {
      background: #2d2f45;
      color: #cdd6f4;
    }

    .sb-btn.active {
      background: rgba(139,92,246,0.2);
      color: #a78bfa;
      border: 1px solid rgba(139,92,246,0.3);
    }

    .sb-btn.settings:hover { transform: rotate(60deg); }

    /* ═══════════════════════════════════════════
       히스토리 뷰
    ═══════════════════════════════════════════ */
    #history-view {
      flex: 1;
      flex-direction: column;
      overflow: hidden;
    }

    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid #2d2f45;
      background: #141625;
      flex-shrink: 0;
    }

    .history-title {
      font-size: 13px;
      font-weight: 600;
      color: #cdd6f4;
    }

    .history-count {
      font-size: 11px;
      color: #6c7086;
      margin-left: 6px;
    }

    .clear-all-btn {
      background: transparent;
      border: 1px solid #3d3f58;
      border-radius: 6px;
      color: #6c7086;
      font-size: 11px;
      padding: 4px 10px;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }

    .clear-all-btn:hover { border-color: #f38ba8; color: #f38ba8; }

    .history-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .history-list::-webkit-scrollbar { width: 4px; }
    .history-list::-webkit-scrollbar-track { background: transparent; }
    .history-list::-webkit-scrollbar-thumb { background: #2d2f45; border-radius: 2px; }

    .history-card {
      background: #141625;
      border: 1px solid #2d2f45;
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: border-color 0.15s;
    }

    .history-card:hover { border-color: #4c4f6b; }

    .highlight-text {
      font-size: 13px;
      color: #cdd6f4;
      line-height: 1.6;
      word-break: break-word;
      margin-bottom: 8px;
    }

    .history-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }

    .history-date { color: #6c7086; flex-shrink: 0; }

    .history-site {
      color: #6c7086;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-del {
      background: transparent;
      border: none;
      color: #45475a;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0 2px;
      flex-shrink: 0;
      transition: color 0.15s;
    }

    .history-del:hover { color: #f38ba8; }

    .history-empty {
      text-align: center;
      color: #45475a;
      font-size: 13px;
      padding: 48px 20px;
      line-height: 1.7;
    }
  </style>
</head>
<body>

  <!-- ═══════════════════ 메인 채팅 패널 ═══════════════════ -->
  <div class="main-panel">

    <!-- 헤더 -->
    <header class="panel-header">
      <div class="header-brand">
        <!-- Aurora 로고 (커스텀 SVG) -->
        <svg class="aurora-logo-svg" viewBox="0 0 100 100" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ag-panel" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#8b5cf6"/>
              <stop offset="100%" stop-color="#ec4899"/>
            </linearGradient>
          </defs>
          <path d="M20 80L50 20L80 80" stroke="url(#ag-panel)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M35 80L50 50L65 80" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
          <path d="M10 85C30 75 70 75 90 85" stroke="url(#ag-panel)" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
        </svg>
        <span class="aurora-title">Aurora Chat</span>
      </div>

      <!-- 모델 선택 드롭다운 -->
      <select class="model-select">
        <option>Gemini Nano (Local)</option>
        <option>Gemini 2.5 Flash</option>
      </select>
    </header>

    <!-- 채팅 영역 (JS로 말풍선 주입) -->
    <div class="chat-area" id="chat-area">
      <!-- 빈 상태 (JS에서 처음 AI 환영 메시지가 여기 들어감) -->
    </div>

    <!-- 히스토리 뷰 (JS에서 show/hide) -->
    <div id="history-view" style="display: none;">
      <div class="history-header">
        <div>
          <span class="history-title">저장된 하이라이트</span>
          <span class="history-count" id="history-count"></span>
        </div>
        <button class="clear-all-btn" id="clear-all-btn">전체 삭제</button>
      </div>
      <div class="history-list" id="history-list"></div>
    </div>

    <!-- 입력 영역 -->
    <div class="input-footer" id="input-footer">
      <div class="input-row">
        <textarea
          id="user-input"
          placeholder="오로라에게 메시지 보내기..."
          rows="1"
        ></textarea>
        <button id="send-btn" title="전송">
          <!-- 전송 아이콘 -->
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
            <path d="M22 2L11 13"/>
            <path d="M22 2L15 22 11 13 2 9l20-7z"/>
          </svg>
        </button>
      </div>
      <div class="input-hints">
        <span>Shift + Enter 로 줄바꿈</span>
        <span class="context-active" id="context-indicator">대기 중</span>
      </div>
    </div>
  </div>

  <!-- ═══════════════════ 슬림 사이드바 ═══════════════════ -->
  <nav class="slim-sidebar">

    <!-- 상단 탭 버튼들 -->
    <div class="sidebar-top">
      <!-- 채팅 버튼 (활성 상태) -->
      <button class="sb-btn active" title="채팅" id="sb-chat">
        <!-- IconChat 커스텀 SVG -->
        <svg viewBox="0 0 100 100" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="15" y="20" width="60" height="45" rx="4" stroke="currentColor" stroke-width="6"/>
          <path d="M25 65L15 85L35 65" fill="currentColor"/>
          <rect x="35" y="40" width="50" height="40" rx="4" stroke="url(#ag-sb)" stroke-width="6"/>
          <defs>
            <linearGradient id="ag-sb" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#8b5cf6"/>
              <stop offset="100%" stop-color="#ec4899"/>
            </linearGradient>
          </defs>
        </svg>
      </button>

      <!-- 히스토리 버튼 -->
      <button class="sb-btn" title="히스토리" id="sb-history">
        <!-- IconHistory 커스텀 SVG -->
        <svg viewBox="0 0 100 100" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 15C30.67 15 15 30.67 15 50C15 69.33 30.67 85 50 85C69.33 85 85 69.33 85 50" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
          <path d="M50 30V50L65 65" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- 하단: 설정 버튼 -->
    <div class="sidebar-bottom">
      <div class="sidebar-sep"></div>
      <!-- 설정 버튼 -->
      <button class="sb-btn settings" title="설정" id="sb-settings">
        <!-- IconSettings 커스텀 SVG -->
        <svg viewBox="0 0 100 100" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 20L80 35V65L50 80L20 65V35L50 20Z" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
          <circle cx="50" cy="50" r="10" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </nav>

  <script type="module" src="./main.ts"></script>
</body>
</html>

```

## File: `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["chrome"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "vite.config.ts"]
}

```

## File: `vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// ════════════════════════════════════════════════════════════
//  AURORA 빌드 진입점 (Entry Points) 관리
// ════════════════════════════════════════════════════════════
//
//  새 UI 페이지를 추가할 때 이 객체에만 한 줄 추가하면 됩니다.
//  예시:
//    popup:   'src/popup/popup.html',
//    options: 'src/options/options.html',
//    youtube: 'src/content/youtube-enhancer.ts',
//
//  추가 후 반드시 npm run build 실행!
//
//  ┌────────────────────────────────────────────────────┐
//  │  현재 활성화된 진입점                               │
//  │  sidepanel → Aurora Chat 메인 UI                   │
//  └────────────────────────────────────────────────────┘
// ════════════════════════════════════════════════════════════

const ENTRIES: Record<string, string> = {
  // ── 현재 활성 ─────────────────────────────────────────
  sidepanel: 'src/sidepanel/sidepanel.html',

  // ── PHASE 2: 필요할 때 주석 해제 ─────────────────────

  // popup: 'src/popup/popup.html',
  // ↑ 크롬 툴바 Aurora 아이콘 클릭 시 뜨는 팝업
  //   (여러 AI 빠른 접근, 설정 단축키 등)
  //   주의: manifest.json의 "action" 에 "default_popup" 도 추가 필요

  // options: 'src/options/options.html',
  // ↑ Aurora 설정 페이지
  //   (Notion API 키, OpenAI 키, 테마 설정 등)
  //   주의: manifest.json의 "options_page" 에도 경로 추가 필요
}

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: ENTRIES,
    },
  },
})

```
