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
    "tabs",
    "contextMenus"
  ],

  "host_permissions": [
    "<all_urls>",
    "https://generativelanguage.googleapis.com/*",
    "https://api.openai.com/*"
  ],

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
    "@types/dompurify": "^3.0.5",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  },
  "dependencies": {
    "dompurify": "^3.3.3",
    "highlight.js": "^11.11.1",
    "marked": "^12.0.2"
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
  | 'TOGGLE_SIDEPANEL'        // 사이드패널 토글 (floating-button → background)
  | 'CALL_CLOUD_AI'           // Cloud AI API 중계 (sidepanel → background)
  | 'AUTO_RUN_PROMPT'         // 컨텍스트 메뉴 → 사이드패널 자동 실행 (background → sidepanel)

  // ── PHASE 2: 외부 API 연동 ─────────────────────────────
  | 'NOTION_SAVE'             // Notion 페이지에 저장
  | 'NOTION_FETCH'            // Notion 페이지 불러오기
  | 'FETCH_EXTERNAL'          // 범용 외부 URL fetch (MV3: content에서 직접 불가)

  // ── PHASE 2: 사이트 특화 기능 ──────────────────────────
  | 'FETCH_YOUTUBE_TRANSCRIPT'// YouTube 자막 가져오기
  | 'OPEN_TABS_BATCH'         // 여러 탭 한꺼번에 열기 (멀티 AI 기능)

  // ── PHASE 2: 사이트 특화 ───────────────────────────────
  | 'YOUTUBE_SUMMARY_REQUEST' // YouTube 영상 요약 요청 (content → background)
  | 'EXECUTE_YOUTUBE_SUMMARY' // YouTube 요약 실행 (background → sidepanel)

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

// ── 사이드패널 열림 상태 추적 ────────────────────────────────
let isSidePanelOpen = false

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'aurora-sidepanel') return
  isSidePanelOpen = true
  port.onDisconnect.addListener(() => { isSidePanelOpen = false })
})

const HANDLERS: Partial<Record<MessageType, HandlerFn>> = {
  // ── 현재 활성 핸들러 ──────────────────────────────────
  OPEN_SIDEPANEL:           handleOpenSidepanel,
  TOGGLE_SIDEPANEL:         handleToggleSidepanel,
  CALL_CLOUD_AI:            handleCallCloudAi,
  YOUTUBE_SUMMARY_REQUEST:  handleYoutubeSummary,

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

// ── 컨텍스트 메뉴 생성 ──────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'aurora-summary',
    title: '✨ Aurora로 요약하기',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'aurora-translate',
    title: '🌐 Aurora로 번역하기',
    contexts: ['selection'],
  })
})

// ── 컨텍스트 메뉴 클릭 핸들러 ───────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.windowId || !info.selectionText) return

  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error)

  setTimeout(() => {
    const prompt = info.menuItemId === 'aurora-summary'
      ? '다음 내용을 요약해 줘:\n\n' + info.selectionText
      : '다음 내용을 자연스러운 한국어로 번역해 줘:\n\n' + info.selectionText
    chrome.runtime.sendMessage({ type: 'AUTO_RUN_PROMPT', payload: prompt }).catch(() => {})
  }, 800)
})

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

// ── TOGGLE_SIDEPANEL ─────────────────────────────────────────
// floating-button 클릭 시 호출 — 열려있으면 닫고, 닫혀있으면 열기
async function handleToggleSidepanel(
  _payload: unknown,
  sender: chrome.runtime.MessageSender
): Promise<AuroraResponse> {
  try {
    if (isSidePanelOpen) {
      // 사이드패널 내부에 CLOSE_SIDEPANEL 메시지 전송 → sidepanel-app이 window.close() 호출
      chrome.runtime.sendMessage({ action: 'CLOSE_SIDEPANEL' }).catch(() => {})
    } else {
      const windowId = sender.tab?.windowId ?? (await chrome.windows.getCurrent()).id
      if (windowId) await chrome.sidePanel.open({ windowId })
    }
    return { success: true }
  } catch (err) {
    console.error('[Aurora] Toggle Error:', err)
    return { success: false, error: String(err) }
  }
}


// ── CALL_CLOUD_AI ────────────────────────────────────────────
// sidepanel에서 Cloud AI(Gemini Flash / GPT-4o) 호출 시 중계
// MV3 정책상 sidepanel에서 외부 API 직접 호출은 허용되지 않으므로
// host_permissions를 가진 background가 대신 fetch합니다.

interface CallCloudAiPayload {
  provider: 'gemini' | 'openai'
  model: string
  apiKey: string
  systemPrompt: string
  userPrompt: string
}

async function handleCallCloudAi(payload: unknown): Promise<AuroraResponse> {
  const p = payload as CallCloudAiPayload
  const apiModel = p.model
  try {
    if (p.provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${p.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: { text: p.systemPrompt } },
            contents: [{ role: 'user', parts: [{ text: p.userPrompt }] }],
          }),
        }
      )
      if (!res.ok) {
        const errText = await res.text()
        return { success: false, error: `API 오류 (${res.status}): ${errText}` }
      }
      const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      return { success: true, data: text }
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: apiModel,
          messages: [
            { role: 'system', content: p.systemPrompt },
            { role: 'user',   content: p.userPrompt },
          ],
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        return { success: false, error: `API 오류 (${res.status}): ${errText}` }
      }
      const data = await res.json() as { choices: { message: { content: string } }[] }
      const text = data.choices?.[0]?.message?.content ?? ''
      return { success: true, data: text }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}


// ── YOUTUBE_SUMMARY_REQUEST ──────────────────────────────────
// YouTube 컨텐츠 스크립트에서 "Aurora 영상 요약" 클릭 시 호출됨.
// 사이드패널을 열고, 렌더링 완료 후 EXECUTE_YOUTUBE_SUMMARY를 브로드캐스트.

interface YoutubeSummaryPayload {
  title: string
  channel: string
  description: string
}

async function handleYoutubeSummary(
  payload: unknown,
  sender: chrome.runtime.MessageSender
): Promise<AuroraResponse> {
  try {
    const tabId    = sender.tab?.id
    const windowId = sender.tab?.windowId ?? (await chrome.windows.getCurrent()).id

    if (tabId) {
      await chrome.sidePanel.open({ tabId })
    } else if (windowId) {
      await chrome.sidePanel.open({ windowId })
    }

    // 사이드패널이 로드되어 메시지 리스너가 등록될 때까지 대기
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type:    'EXECUTE_YOUTUBE_SUMMARY',
        payload: payload as YoutubeSummaryPayload,
      }).catch(() => { /* sidepanel 미열림 시 무시 */ })
    }, 800)

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
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
import { QuickLauncher } from './ui/quick-launcher'
import { initYouTubeSummarizer } from './youtube'
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
  btn.style.setProperty('z-index', '2147483647', 'important')
  btn.style.setProperty('pointer-events', 'auto', 'important')
  btn.addEventListener('mouseenter', () => { btn.style.background = '#313244' })
  btn.addEventListener('mouseleave', () => { btn.style.background = '#1a1c2e' })
  const sendToggle = () => {
    try { chrome.runtime?.sendMessage({ type: 'TOGGLE_SIDEPANEL' }) } catch { /* invalidated */ }
  }
  btn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); sendToggle() })
  btn.addEventListener('click',     (e) => { e.stopPropagation(); sendToggle() })

  document.body.appendChild(btn)
}

// ── YouTube 요약 버튼 주입 ───────────────────────────────
initYouTubeSummarizer()

// ── Quick Launcher (Alt+J) ────────────────────────────────
const launcher = new QuickLauncher()
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.code === 'KeyJ') {
    e.preventDefault()
    launcher.toggle()
  }
})

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
  private mouseDownPos = { x: 0, y: 0 }  // 유령 선택 방어용 클릭 좌표

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

      // rect: 가능하면 DOM Range, 없으면 input 자체의 bounding rect 사용.
      // React/Vue 등의 검색창은 실제 input을 x:0,y:0 또는 width:0으로 숨기는 경우가 있으므로
      // bounding rect가 비정상이면 마우스 이벤트 좌표로 대체한다.
      let rect: DOMRect
      try {
        const sel = window.getSelection()
        const r   = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null
        rect = (r && r.width > 0) ? r : inputEl.getBoundingClientRect()
      } catch {
        rect = inputEl.getBoundingClientRect()
      }
      const isDegenerate = rect.width < 4 || rect.height < 4 || (rect.x === 0 && rect.y === 0)
      if (isDegenerate) {
        // 마우스 위치를 중심으로 1×1 가상 rect 생성
        rect = new DOMRect(e.clientX, e.clientY, 1, 1)
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
      this.lastSnapshot = null
      this.callback(null)
      return
    }

    // 유령 선택(Ghost Selection) 방어:
    // 드래그 없는 단순 클릭인데 이전 스냅샷과 텍스트가 동일하면
    // 에디터의 selection 해제 지연으로 보고 툴바를 띄우지 않는다.
    const dx = Math.abs(e.clientX - this.mouseDownPos.x)
    const dy = Math.abs(e.clientY - this.mouseDownPos.y)
    const isClick = dx < 5 && dy < 5
    if (isClick && this.lastSnapshot && text === this.lastSnapshot.text) {
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
    // Lexical: [data-lexical-editor="true"], Slate: [data-slate-editor="true"] 추가
    const CE_ROOT =
      EDITABLE_ATTR + ', ' +
      '.ProseMirror, .cm-editor, .monaco-editor, .ql-editor, .CodeMirror, ' +
      '[data-lexical-editor="true"], [data-slate-editor="true"]'

    let isWriteArea =
      anchorEl?.isContentEditable ||
      anchorEl?.getAttribute('role') === 'textbox' ||
      !!anchorEl?.closest(EDITABLE_ATTR)

    // AI 사이트 코드블록/답변 읽기 전용 컨테이너 예외:
    // <pre>, <code>, .markdown, .prose 등의 내부는 하이라이팅 라이브러리가
    // contenteditable을 심더라도 실제 편집 불가 영역이므로 read mode로 강제 전환.
    // 단, textarea / input 은 이 경로에 오지 않으므로 실제 입력창은 영향 없음.
    const READ_ONLY_CONTAINER =
      'pre, code, ' +
      '.markdown, .prose, ' +
      '[class*="markdown"], [class*="prose"], ' +
      '[data-message-author-role], ' +   // ChatGPT 답변 컨테이너
      '.claude-content, .response-content'  // Claude 등 AI 답변 래퍼
    if (isWriteArea && anchorEl?.closest(READ_ONLY_CONTAINER)) {
      // VIP 프리패스: 실제 입력창(#prompt-textarea 등)은 읽기 전용 컨테이너 안에
      // 있더라도 무조건 쓰기 모드로 복구한다.
      const VIP_WRITE_SELECTOR = '#prompt-textarea'
      if (!anchorEl?.closest(VIP_WRITE_SELECTOR)) {
        isWriteArea = false
      }
    }

    if (isWriteArea) {
      // Write mode — contenteditable / role="textbox" / 리치 에디터
      // ceEl: 항상 closest()로 루트 컨테이너를 탐색.
      // anchorEl.isContentEditable이 true여도 <p>/<span> 같은 deep child일 수 있으므로
      // 직접 사용하지 않고 루트를 찾아야 el.focus() + execCommand가 안정적으로 동작함.
      let ceEl = anchorEl?.closest(CE_ROOT) as HTMLElement | null
      if (!ceEl) {
        // closest()로 루트를 찾지 못한 경우 (Shadow DOM 경계, 비표준 에디터 등)
        // document.activeElement가 contenteditable이면 그것을 루트로 사용
        const active = document.activeElement
        ceEl = (active instanceof HTMLElement && active.isContentEditable)
          ? active
          : anchorEl
      }

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

    // 유령 선택 방어: mousedown 좌표를 기록해 mouseup에서 드래그 여부를 판별
    this.mouseDownPos = { x: e.clientX, y: e.clientY }

    const target = e.target as HTMLElement

    // Aurora 자체 UI 클릭은 무시 (툴바 + 팝업 셸)
    if (target.closest('#aurora-toolbar') || target.closest('#aurora-shell')) return

    // Aurora UI 외의 어떤 곳을 클릭해도 즉시 툴바 숨김
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
import type { ToolbarAction, SourceMeta } from '../../shared/types'

type ActionCallback = (action: ToolbarAction, info: SelectionInfo) => void

// ── SVG 아이콘 ──────────────────────────────────────────────
const ICONS: Record<string, string> = {
  translate: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  summarize: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  ask:       `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  save:      `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
  grammar:   `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><path d="m15 5 3 3"/></svg>`,
  draft:     `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  shorter:   `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/></svg>`,
  longer:    `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><path d="M20 10l2 2-2 2"/></svg>`,
  tone:      `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  copy:      `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  highlight: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`,
  more:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
  aurora:    `<svg viewBox="0 0 100 100" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ag-tb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><path d="M20 80L50 20L80 80" stroke="url(#ag-tb)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 80L50 50L65 80" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/><path d="M10 85C30 75 70 75 90 85" stroke="url(#ag-tb)" stroke-width="3" stroke-linecap="round" opacity="0.8"/></svg>`,
}

type ActionCategory = 'read' | 'write' | 'common'
interface ActionDef { action: ToolbarAction; label: string; readMode: boolean; writeMode: boolean; category: ActionCategory }

const ACTIONS: ActionDef[] = [
  { action: 'translate', label: '번역',           readMode: true,  writeMode: false, category: 'read'   },
  { action: 'summarize', label: '요약',           readMode: true,  writeMode: false, category: 'read'   },
  { action: 'save',      label: '저장',           readMode: true,  writeMode: false, category: 'read'   },
  { action: 'grammar',   label: '문법/맞춤법',    readMode: false, writeMode: true,  category: 'write'  },
  { action: 'shorter',   label: '짧게',           readMode: false, writeMode: true,  category: 'write'  },
  { action: 'longer',    label: '길게',           readMode: false, writeMode: true,  category: 'write'  },
  { action: 'tone',      label: '톤 변경',        readMode: false, writeMode: true,  category: 'write'  },
  { action: 'draft',     label: '생각 담기',       readMode: true,  writeMode: true,  category: 'write'  },
  { action: 'ask',       label: '질문',           readMode: true,  writeMode: true,  category: 'common' },
  { action: 'copy',      label: '복사',           readMode: true,  writeMode: true,  category: 'common' },
  { action: 'highlight', label: '하이라이트',     readMode: true,  writeMode: false, category: 'read'   },
]

const DEFAULT_PINNED = ['translate', 'summarize', 'save', 'grammar', 'draft', 'ask']

export class SelectionToolbar {
  private readonly el:       HTMLDivElement
  private readonly onAction: ActionCallback
  private readonly onClose:  () => void
  private currentInfo: SelectionInfo | null = null
  private pinnedSet = new Set<string>()
  private readonly pinBtnMap     = new Map<string, HTMLButtonElement>()
  private readonly primaryBtnMap = new Map<ToolbarAction, HTMLButtonElement>()
  // 메인 버튼 컨테이너 (동적 렌더링 대상)
  private primaryBtnContainer!: HTMLDivElement
  // 이벤트 리스너 참조 (destroy 시 해제용)
  private readonly _boundKeyup:            (e: KeyboardEvent) => void
  private readonly _boundMouseup:          (e: MouseEvent)    => void
  private readonly _boundSelectionChange:  () => void
  // checkSelection 디바운스 타이머
  private _checkTimer: ReturnType<typeof setTimeout> | null = null

  constructor(onAction: ActionCallback, onClose: () => void = () => {}) {
    this.onAction = onAction
    this.onClose  = onClose
    this.el = this.buildEl()
    this.renderPrimaryButtons('read')   // 초기 렌더 (pinnedSet 비어있는 상태)
    document.getElementById('aurora-toolbar')?.remove()
    document.body.appendChild(this.el)
    void chrome.storage.local.get('aurora_pinned').then((res) => {
      const pinned: string[] = res['aurora_pinned']
      this.pinnedSet = new Set(pinned ?? DEFAULT_PINNED)
      this.renderPrimaryButtons('read')  // 핀 데이터 로드 후 재렌더
      this.refreshPinIcons()
    })
    this._boundKeyup           = this.handleKeyup.bind(this)
    this._boundMouseup         = this.handleMouseup.bind(this)
    this._boundSelectionChange = this.handleSelectionChange.bind(this)
    // capture: true — 페이지가 stopPropagation으로 이벤트를 삼키기 전에 먼저 감지
    document.addEventListener('keyup',            this._boundKeyup,           { capture: true })
    document.addEventListener('mouseup',          this._boundMouseup,         { capture: true })
    // selectionchange — keyup을 삼키는 사이트(Gemini 등)에서도 선택 변경 감지
    document.addEventListener('selectionchange',  this._boundSelectionChange)
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

    // 메인 버튼 컨테이너 — renderPrimaryButtons()가 여기에 동적으로 채운다
    this.primaryBtnContainer = document.createElement('div')
    this.primaryBtnContainer.style.cssText = 'display:flex;gap:1px;align-items:center'
    row.appendChild(this.primaryBtnContainer)

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
      if (isOpen) { moreMenu.style.display = 'none'; return }
      moreMenu.style.display      = 'block'
      moreMenu.style.top          = '100%'
      moreMenu.style.bottom       = 'auto'
      moreMenu.style.marginTop    = '4px'
      moreMenu.style.marginBottom = '0'
      const rect = moreMenu.getBoundingClientRect()
      if (rect.bottom > window.innerHeight - 10) {
        moreMenu.style.top          = 'auto'
        moreMenu.style.bottom       = '100%'
        moreMenu.style.marginTop    = '0'
        moreMenu.style.marginBottom = '4px'
      }
    })
    moreWrapper.append(moreBtn, moreMenu)
    row.appendChild(moreWrapper)

    // 외부 클릭 시 더보기 닫기 (toolbar가 DOM에서 제거된 후엔 자동 스킵)
    document.addEventListener('mousedown', (e) => {
      if (!document.body.contains(this.el)) return
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

      if (action === 'copy') {
        const text = this.currentInfo?.text || ''
        void navigator.clipboard.writeText(text).then(() => {
          btn.innerHTML = '<span style="font-size:12px; font-weight:bold; color:#a6e3a1">✓ 복사 완료</span>'
          setTimeout(() => { this.hide() }, 800)
        })
        return
      }

      if (action === 'highlight') {
        this.showHighlightPicker()
        return
      }

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
    btn.textContent = '닫기'
    btn.title = '닫기'
    Object.assign(btn.style, {
      background: 'transparent', border: 'none', color: '#6c7086',
      fontSize: '13px', fontWeight: 'bold', padding: '6px 12px',
      marginLeft: '1px', borderRadius: '6px', cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>)
    btn.addEventListener('mouseenter', () => { btn.style.color = '#cdd6f4'; btn.style.background = '#313244' })
    btn.addEventListener('mouseleave', () => { btn.style.color = '#6c7086'; btn.style.background = 'transparent' })
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      window.getSelection()?.removeAllRanges()
      this.onClose()
      this.destroy()
    })
    return btn
  }

  // 더보기 드롭다운 — 카테고리별 섹션
  private buildMoreMenu(): HTMLDivElement {
    const menu = document.createElement('div')
    Object.assign(menu.style, {
      display: 'none', position: 'absolute', top: '100%', left: '0',
      zIndex: '2147483647', background: '#1a1c2e', border: '1px solid #3d3f58',
      borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      minWidth: '170px', padding: '4px', marginTop: '4px',
    })

    const CATEGORY_LABELS: Record<ActionCategory, string> = {
      common: '공통 기능',
      read:   '읽기 모드',
      write:  '쓰기 모드',
    }
    const CATEGORY_ORDER: ActionCategory[] = ['common', 'read', 'write']

    for (const cat of CATEGORY_ORDER) {
      const catActions = ACTIONS.filter(d => d.category === cat)
      if (catActions.length === 0) continue

      // 카테고리 헤더
      const header = document.createElement('div')
      header.textContent = CATEGORY_LABELS[cat]
      Object.assign(header.style, {
        fontSize: '10px', color: '#6c7086', padding: '6px 8px 2px',
        fontWeight: 'bold', userSelect: 'none',
      } satisfies Partial<CSSStyleDeclaration>)
      menu.appendChild(header)

      for (const { action, label } of catActions) {
        const row = document.createElement('div')
        Object.assign(row.style, {
          display: 'flex', alignItems: 'center', gap: '6px',
          borderRadius: '5px', padding: '0 4px', cursor: 'pointer',
        } satisfies Partial<CSSStyleDeclaration>)
        row.addEventListener('mouseenter', () => { row.style.background = '#313244' })
        row.addEventListener('mouseleave', () => { row.style.background = 'transparent' })

        // 아이콘
        const iconSpan = document.createElement('span')
        iconSpan.innerHTML = ICONS[action] ?? ''
        Object.assign(iconSpan.style, {
          display: 'flex', alignItems: 'center',
          color: '#cdd6f4', flexShrink: '0', pointerEvents: 'none',
        } satisfies Partial<CSSStyleDeclaration>)

        // 라벨
        const labelBtn = document.createElement('button')
        labelBtn.textContent = label
        Object.assign(labelBtn.style, {
          flex: '1', background: 'transparent', border: 'none',
          color: '#cdd6f4', fontSize: '12px',
          fontFamily: 'system-ui, sans-serif', padding: '6px 0',
          textAlign: 'left', cursor: 'pointer',
        } satisfies Partial<CSSStyleDeclaration>)
        labelBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          menu.style.display = 'none'
          const capturedInfo = this.currentInfo!
          this.hide()
          this.onAction(action, capturedInfo)
        })

        // 핀 버튼
        const isPinned = this.pinnedSet.has(action)
        const pinBtn = document.createElement('button')
        pinBtn.innerHTML = pinSvg(isPinned)
        Object.assign(pinBtn.style, {
          background: 'transparent', border: 'none',
          color: isPinned ? '#cba6f7' : '#3d3f58',
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
        menu.appendChild(row)
      }
    }

    return menu
  }

  private renderPrimaryButtons(mode: 'read' | 'write'): void {
    if (!this.primaryBtnContainer) return
    this.primaryBtnContainer.innerHTML = ''
    this.primaryBtnMap.clear()

    for (const def of ACTIONS) {
      const isModeMatch = mode === 'read' ? def.readMode : def.writeMode
      if (isModeMatch && this.pinnedSet.has(def.action)) {
        const btn = this.buildActionBtn(def.action, def.label)
        this.primaryBtnMap.set(def.action, btn)
        this.primaryBtnContainer.appendChild(btn)
      }
    }
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
    if (this.currentInfo) {
      this.renderPrimaryButtons(this.currentInfo.mode)
      this.show(this.currentInfo)
    } else {
      this.renderPrimaryButtons('read')
    }
  }

  // ── 공개 메서드 ──────────────────────────────────────────

  show(info: SelectionInfo): void {
    this.currentInfo = info
    if (!document.body.contains(this.el)) document.body.appendChild(this.el)

    this.renderPrimaryButtons(info.mode)

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

  private handleKeyup(_e: KeyboardEvent): void {
    this.checkSelection()
  }

  private handleMouseup(e: MouseEvent): void {
    const target = e.target as HTMLElement
    if (target.closest('#aurora-toolbar') || target.closest('#aurora-shell')) return
    this.checkSelection()
  }

  private handleSelectionChange(): void {
    // checkSelection 내부에서 모든 분기를 처리하므로 무조건 위임
    // clearTimeout은 checkSelection 내부에서 수행
    this.checkSelection()
  }

  // ── 통합 선택 감지 ── 마우스/키보드/selectionchange 공통 호출 ──
  private checkSelection(): void {
    if (this._checkTimer !== null) { clearTimeout(this._checkTimer); this._checkTimer = null }
    this._checkTimer = setTimeout(() => {
      this._checkTimer = null

      const activeEl = document.activeElement as HTMLElement
      // input/textarea + contenteditable(Notion, ChatGPT 등) 모두 입력창으로 인식
      const isInput = activeEl && (
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'INPUT'    ||
        activeEl.isContentEditable      ||
        activeEl.closest('[contenteditable="true"]') !== null
      )

      let text = ''
      let rect: DOMRect | null = null
      const selection = window.getSelection()

      if (isInput && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        // ── 순수 input / textarea ────────────────────────────
        const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement
        text = inputEl.value.substring(inputEl.selectionStart ?? 0, inputEl.selectionEnd ?? 0).trim()
        rect = inputEl.getBoundingClientRect()
      } else {
        // ── 일반 웹페이지 OR contenteditable (Notion, ChatGPT 등) ──
        if (!selection || selection.rangeCount === 0) { this.hide(); return }
        text = selection.toString().trim()

        if (text.length > 0) {
          // Aurora 자체 UI 내부 선택 무시
          const anchorEl = selection.anchorNode instanceof Element
            ? selection.anchorNode as HTMLElement
            : selection.anchorNode?.parentElement ?? null
          if (anchorEl?.closest('#aurora-toolbar, #aurora-shell')) return

          const range = selection.getRangeAt(0)
          rect = range.getBoundingClientRect()

          // Ctrl+A 전체 선택 시 width/height=0 버그 방어
          if (rect.width === 0 || rect.height === 0) {
            const container = range.commonAncestorContainer
            const element   = (container.nodeType === Node.ELEMENT_NODE
              ? container
              : container.parentElement) as Element | null
            rect = element?.getBoundingClientRect()
              ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0)
          }
        }
      }

      if (text.length === 0 || !rect) { this.hide(); return }

      // ── sourceMeta 구성 ──────────────────────────────────
      const isPlainInput = isInput && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')
      const sourceMeta = isPlainInput
        ? {
            el:                activeEl,
            selStart:          (activeEl as HTMLInputElement).selectionStart ?? 0,
            selEnd:            (activeEl as HTMLInputElement).selectionEnd   ?? 0,
            isContentEditable: false,
            rangeClone:        null,
          }
        : (() => {
            const range     = selection!.getRangeAt(0)
            const container = range.commonAncestorContainer
            const targetEl  = (container.nodeType === Node.ELEMENT_NODE
              ? container
              : container.parentElement) as HTMLElement
            return {
              el:                targetEl,
              selStart:          0,
              selEnd:            text.length,
              isContentEditable: isInput as boolean,
              rangeClone:        range.cloneRange(),
            }
          })()

      this.show({
        text,
        rect,
        mode: isInput ? 'write' : 'read',
        sourceMeta,
      })
    }, 150)
  }

  private showHighlightPicker(): void {
    document.getElementById('aurora-hl-picker')?.remove()

    const COLORS = [
      { hex: 'rgba(255, 235, 59, 0.4)',  label: '노랑' },
      { hex: 'rgba(255, 183, 77, 0.4)',  label: '주황' },
      { hex: 'rgba(165, 214, 167, 0.4)', label: '초록' },
      { hex: 'rgba(144, 202, 249, 0.4)', label: '파랑' },
      { hex: 'rgba(206, 147, 216, 0.4)', label: '보라' },
    ]

    const picker = document.createElement('div')
    picker.id = 'aurora-hl-picker'
    Object.assign(picker.style, {
      position: 'fixed', zIndex: '2147483647',
      background: '#1a1c2e', border: '1px solid #3d3f58',
      borderRadius: '10px', padding: '8px 10px',
      display: 'flex', gap: '8px', alignItems: 'center',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    } satisfies Partial<CSSStyleDeclaration>)

    for (const { hex, label } of COLORS) {
      const colorBtn = document.createElement('button')
      colorBtn.title = label
      Object.assign(colorBtn.style, {
        width: '26px', height: '26px', borderRadius: '50%',
        background: hex, border: '2px solid transparent',
        cursor: 'pointer', padding: '0', flexShrink: '0',
      } satisfies Partial<CSSStyleDeclaration>)
      colorBtn.addEventListener('mouseenter', () => { colorBtn.style.border = '2px solid #cdd6f4'; colorBtn.style.transform = 'scale(1.15)' })
      colorBtn.addEventListener('mouseleave', () => { colorBtn.style.border = '2px solid transparent'; colorBtn.style.transform = 'scale(1)' })
      colorBtn.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation()
        picker.remove()
        this.applyHighlight(hex)
      })
      picker.appendChild(colorBtn)
    }

    // 구분선
    const sep = document.createElement('div')
    Object.assign(sep.style, { width: '1px', height: '20px', background: '#3d3f58', flexShrink: '0' } satisfies Partial<CSSStyleDeclaration>)
    picker.appendChild(sep)

    // 초기화 버튼 (휴지통 아이콘)
    const clearBtn = document.createElement('button')
    clearBtn.title = '하이라이트 제거'
    clearBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6M14 11v6"/></svg>`
    Object.assign(clearBtn.style, {
      width: '30px', height: '30px', borderRadius: '6px',
      background: 'transparent', border: '1px solid #3d3f58',
      cursor: 'pointer', color: '#6c7086',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0',
    } satisfies Partial<CSSStyleDeclaration>)
    clearBtn.addEventListener('mouseenter', () => { clearBtn.style.background = '#313244'; clearBtn.style.color = '#cdd6f4' })
    clearBtn.addEventListener('mouseleave', () => { clearBtn.style.background = 'transparent'; clearBtn.style.color = '#6c7086' })
    clearBtn.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation()
      picker.remove()
      this.applyHighlight('clear')
    })
    picker.appendChild(clearBtn)

    document.body.appendChild(picker)

    // 위치: 툴바 바로 아래 (off-screen 시 위로 플립)
    const tbRect = this.el.getBoundingClientRect()
    picker.style.left = `${Math.max(8, tbRect.left)}px`
    picker.style.top  = `${tbRect.bottom + 6}px`
    requestAnimationFrame(() => {
      const pr = picker.getBoundingClientRect()
      if (pr.right > window.innerWidth - 8)  picker.style.left = `${window.innerWidth - pr.width - 8}px`
      if (pr.bottom > window.innerHeight - 8) picker.style.top  = `${tbRect.top - pr.height - 6}px`
    })

    // 외부 클릭 시 닫기
    const onOutside = (ev: MouseEvent) => {
      if (!picker.contains(ev.target as Node)) {
        picker.remove()
        document.removeEventListener('mousedown', onOutside)
      }
    }
    setTimeout(() => document.addEventListener('mousedown', onOutside), 0)
  }

  private applyHighlight(color: string): void {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) { this.hide(); return }
    document.designMode = 'on'
    if (color === 'clear') {
      document.execCommand('removeFormat', false, undefined)
      document.execCommand('hiliteColor', false, 'transparent')
    } else {
      document.execCommand('hiliteColor', false, color)
    }
    document.designMode = 'off'
    selection.removeAllRanges()
    this.hide()
  }

  destroy(): void {
    document.removeEventListener('keyup',           this._boundKeyup,           { capture: true })
    document.removeEventListener('mouseup',         this._boundMouseup,         { capture: true })
    document.removeEventListener('selectionchange', this._boundSelectionChange)
    if (this._checkTimer !== null) clearTimeout(this._checkTimer)
    this.el.remove()
  }
}

function pinSvg(active: boolean): string {
  return `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="${active ? 'currentColor' : 'none'}" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`
}

```

## File: `src/content/ui/floating-shell.ts`
```typescript
import type { ToolbarAction, SourceMeta } from '../../shared/types'
import type { SelectionInfo } from '../selection/selection-observer'
import { renderMarkdown } from '../../shared/utils/markdown'

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
// Gemini Nano 전용 경량 공통 규칙 — 단순할수록 로컬 모델이 잘 따름
const NANO_RULE = '반드시 한국어로만 작성하라. 질문에 대답하지 말고 주어진 텍스트만 지시대로 변환하라.\n\n'

function enforceKorean(systemPrompt: string): string {
  return NANO_RULE + systemPrompt
}

// ── 액션 아이콘 / 라벨 ───────────────────────────────────────
const ACTION_ICONS: Partial<Record<ToolbarAction, string>> = {
  translate: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  summarize: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  grammar:   `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><path d="m15 5 3 3"/></svg>`,
  draft:     `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  ask:       `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  shorter:   `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/></svg>`,
  longer:    `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  tone:      `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
}

const ACTION_LABELS: Record<ToolbarAction, string> = {
  translate: '번역', summarize: '요약', grammar: '문법/맞춤법', draft: '생각 담기',
  ask: '질문', save: '저장', shorter: '짧게', longer: '길게', tone: '톤 변경',
  copy: '복사', highlight: '하이라이트',
}

// AI 실행 가능한 액션 (save/draft는 별도 처리)
type AiAction = 'translate' | 'summarize' | 'grammar' | 'ask' | 'shorter' | 'longer' | 'tone'

const SYSTEM_PROMPTS: Record<AiAction, string> = {
  translate: '당신은 번역가입니다. 텍스트를 한국어로 번역하세요.',
  summarize: '당신은 요약 전문가입니다. 텍스트의 핵심을 간결하게 요약하세요.',
  grammar:   '당신은 교열 전문가입니다. 오직 문법과 맞춤법만 교정하세요. 절대 존댓말을 쓰지 말고, 반드시 \'~다\', \'~어/아\'로 끝나는 반말로 작성하세요.',
  ask:       '당신은 AI 어시스턴트입니다. 텍스트에 대한 유용한 정보를 제공하세요.',
  shorter:   '당신은 편집자입니다. 텍스트를 의미를 유지하며 절반 이하로 짧게 줄이세요.',
  longer:    '당신은 작가입니다. 텍스트의 핵심을 살려 더 상세하고 풍부하게 늘려 쓰세요.',
  tone:      '당신은 어조 변환기입니다. 원문의 의미와 길이를 100% 똑같이 유지하면서, 오직 문장의 끝맺음만 \'~요\', \'~습니다\' 형태의 정중한 존댓말로 바꾸세요.',
}

const USER_PROMPTS: Record<AiAction, (t: string) => string> = {
  translate: (t) => `다음 <text> 안의 내용을 한국어로 번역해라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  summarize: (t) => `다음 <text> 안의 내용을 핵심만 간결하게 요약해라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  grammar:   (t) => `다음 <text> 안의 내용에서 문법과 맞춤법만 교정해라. 절대 존댓말 금지, 반드시 반말(~다/~어/아체)로 출력해라.\n<text>\n${t}\n</text>\n\n오직 교정된 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  ask:       (t) => `다음 <text> 에 대해 유용한 정보를 한국어로 설명해라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  shorter:   (t) => `다음 <text> 안의 내용을 의미를 유지하며 절반 이하로 짧게 줄여라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  longer:    (t) => `다음 <text> 안의 내용을 핵심을 살려 더 상세하고 풍부하게 늘려 써라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  tone:      (t) => `다음 <text> 안의 내용에서 문장 끝맺음만 '~요'/'~습니다' 존댓말로 바꿔라. 의미/길이/내용은 절대 변경 금지.\n<text>\n${t}\n</text>\n\n오직 변환된 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
}

// ── FloatingShell ─────────────────────────────────────────────

export class FloatingShell {
  private readonly el!:              HTMLDivElement
  private readonly loadingEl!:       HTMLElement
  private readonly resultEl!:        HTMLElement
  private readonly statusEl!:        HTMLElement
  private readonly copyBtn!:         HTMLButtonElement
  private readonly replaceBtn!:      HTMLButtonElement
  private readonly retryBtn!:        HTMLButtonElement
  private readonly panelBtn!:        HTMLButtonElement
  private readonly translateBtn!:    HTMLButtonElement
  private readonly followUpInput!:   HTMLTextAreaElement
  private readonly actionLabelEl!:   HTMLElement
  private readonly actionIconEl!:    HTMLElement
  private readonly modelSelectEl!:    HTMLSelectElement
  private readonly transLangSelectEl!: HTMLSelectElement
  private readonly paginationEl!:    HTMLDivElement
  private currentAction: ToolbarAction
  private readonly sourceText!: string
  private readonly sourceMeta!: SourceMeta
  private resultText = ''
  private resultHistory: string[] = []
  private historyIndex: number = -1

  constructor(action: ToolbarAction, info: SelectionInfo) {
    this.currentAction = action
    this.sourceText    = info.text
    this.sourceMeta    = info.sourceMeta

    if (!info.text.trim()) { console.error('[AURORA] FloatingShell: empty sourceText'); return }

    this.injectStyle()

    const built = this.buildEl(action, info.text)
    this.el              = built.el
    this.loadingEl       = built.loadingEl
    this.resultEl        = built.resultEl
    this.statusEl        = built.statusEl
    this.copyBtn         = built.copyBtn
    this.replaceBtn      = built.replaceBtn
    this.retryBtn        = built.retryBtn
    this.panelBtn        = built.panelBtn
    this.translateBtn    = built.translateBtn
    this.followUpInput   = built.followUpInput
    this.actionLabelEl   = built.actionLabelEl
    this.actionIconEl    = built.actionIconEl
    this.modelSelectEl      = built.modelSelectEl
    this.transLangSelectEl  = built.transLangSelectEl
    this.paginationEl       = built.paginationEl
    if (action === 'translate') this.transLangSelectEl.style.display = 'inline-block'

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

    if (action === 'translate') {
      this.translateBtn.style.display    = 'inline-flex'
      this.transLangSelectEl.style.display = 'inline-block'
    }

    this.position(info.rect)
    this.initDrag(built.dragHandle)
    this.initResize(built.resizeHandle)
    this.bindCopyButtons()

    if (action === 'draft' || action === 'translate') {
      void Promise.resolve().then(() => this.showResult(this.sourceText))
    } else if (action !== 'save') {
      void this.runAction(
        SYSTEM_PROMPTS[action as AiAction],
        USER_PROMPTS[action as AiAction](this.sourceText),
      )
    }
  }

  private switchAction(action: ToolbarAction): void {
    this.currentAction = action
    this.actionIconEl.innerHTML    = ACTION_ICONS[action] ?? ''
    this.actionLabelEl.textContent = ACTION_LABELS[action]
    this.transLangSelectEl.style.display = action === 'translate' ? 'inline-block' : 'none'
    this.translateBtn.style.display      = action === 'translate' ? 'inline-flex' : 'none'
    if (action === 'draft' || action === 'translate') { this.showResult(this.sourceText); return }
    if (action !== 'save') {
      // 연쇄(Chaining): 이전 AI 결과가 있으면 그것을 다음 작업의 입력으로 사용
      const inputText = this.resultText || this.sourceText
      void this.runAction(
        SYSTEM_PROMPTS[action as AiAction],
        USER_PROMPTS[action as AiAction](inputText),
      )
    }
  }

  // ── AI 실행 ──────────────────────────────────────────────

  private async runAction(systemPrompt: string, userPrompt: string): Promise<void> {
    if (this.currentAction === 'draft') { this.showResult(this.sourceText); return }
    const effectiveUserPrompt = this.currentAction === 'translate'
      ? userPrompt + `\n\n(목표 번역 언어: ${this.transLangSelectEl.value})`
      : userPrompt
    this.retryBtn.disabled         = true
    this.retryBtn.style.opacity    = '0.4'
    this.loadingEl.style.display   = 'flex'
    this.resultEl.style.display    = 'none'
    this.followUpInput.disabled    = true

    const selectedModel = this.modelSelectEl.value
    const modelName     = this.modelSelectEl.options[this.modelSelectEl.selectedIndex].text
    this.statusEl.textContent = `${modelName.toUpperCase()} 처리 중...`
    this.statusEl.style.color = '#6c7086'

    // ── Cloud AI (gemini-nano 외) ─────────────────────────
    if (selectedModel !== 'gemini-nano') {
      const keysRes = await chrome.storage.local.get('aurora_api_keys')
      const keys    = keysRes['aurora_api_keys'] as { openai?: string; gemini?: string } | undefined
      const isGemini = !selectedModel.startsWith('gpt')
      const provider  = isGemini ? 'gemini' : 'openai'
      const apiKey    = isGemini ? keys?.gemini : keys?.openai

      if (!apiKey) {
        this.showError(`${modelName} API 키가 없습니다. 패널 설정에서 등록해주세요.`)
        return
      }
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CALL_CLOUD_AI',
          payload: { provider, model: selectedModel, apiKey, systemPrompt, userPrompt: effectiveUserPrompt },
        }) as { success: boolean; data?: string; error?: string }
        if (response.success && response.data) { this.showResult(response.data) }
        else { this.showError(response.error ?? '알 수 없는 오류가 발생했습니다.') }
      } catch (err) {
        this.showError(err instanceof Error ? err.message : String(err))
      }
      return
    }

    // ── Gemini Nano (로컬) ────────────────────────────────
    let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
    try {
      session = await LanguageModel.create({ systemPrompt: enforceKorean(systemPrompt), outputLanguage: 'ko', temperature: 0.6, topK: 5 })
      const rawResponse = await session.prompt(effectiveUserPrompt)
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
    this.retryBtn.disabled         = true
    this.retryBtn.style.opacity    = '0.4'
    this.loadingEl.style.display   = 'flex'
    this.resultEl.style.display    = 'none'
    this.followUpInput.disabled    = true

    const selectedModel = this.modelSelectEl.value
    const modelName     = this.modelSelectEl.options[this.modelSelectEl.selectedIndex].text
    this.statusEl.textContent = `${modelName.toUpperCase()} 처리 중...`
    this.statusEl.style.color = '#6c7086'

    const sysP = '당신은 도움이 되는 AI 어시스턴트입니다. 반드시 한국어로 답변하세요.'
    const ctx  =
      `[원문]\n"${this.sourceText}"\n\n` +
      `[이전 결과]\n"${this.resultText}"\n\n` +
      `[추가 질문]\n${userPrompt}\n\n` +
      '오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'

    // ── Cloud AI (gemini-nano 외) ─────────────────────────
    if (selectedModel !== 'gemini-nano') {
      const keysRes = await chrome.storage.local.get('aurora_api_keys')
      const keys    = keysRes['aurora_api_keys'] as { openai?: string; gemini?: string } | undefined
      const isGemini = !selectedModel.startsWith('gpt')
      const provider  = isGemini ? 'gemini' : 'openai'
      const apiKey    = isGemini ? keys?.gemini : keys?.openai

      if (!apiKey) {
        this.showError(`${modelName} API 키가 없습니다. 패널 설정에서 등록해주세요.`)
        this.followUpInput.disabled = false
        return
      }
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CALL_CLOUD_AI',
          payload: { provider, model: selectedModel, apiKey, systemPrompt: sysP, userPrompt: ctx },
        }) as { success: boolean; data?: string; error?: string }
        if (response.success && response.data) { this.showResult(response.data) }
        else { this.showError(response.error ?? '알 수 없는 오류가 발생했습니다.') }
      } catch (err) {
        this.showError(err instanceof Error ? err.message : String(err))
      } finally {
        this.followUpInput.disabled = false
      }
      return
    }

    // ── Gemini Nano (로컬) ────────────────────────────────
    let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
    try {
      session = await LanguageModel.create({ systemPrompt: enforceKorean(sysP), outputLanguage: 'ko', temperature: 0.6, topK: 5 })
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
    if (this.resultHistory[this.resultHistory.length - 1] !== this.resultText) {
      this.resultHistory.push(this.resultText)
    }
    this.historyIndex = this.resultHistory.length - 1
    this.loadingEl.style.display  = 'none'
    this.resultEl.style.display   = 'block'
    this.resultEl.style.color     = '#cdd6f4'
    this.resultEl.innerHTML       = renderMarkdown(this.resultText)
    this.statusEl.textContent     = `${this.modelSelectEl.options[this.modelSelectEl.selectedIndex].text} 응답 완료`
    this.statusEl.style.color     = '#a6e3a1'
    this.copyBtn.disabled         = false
    this.replaceBtn.disabled      = false
    this.retryBtn.disabled        = false
    this.panelBtn.disabled        = false
    this.copyBtn.style.opacity    = '1'
    this.replaceBtn.style.opacity = '1'
    this.retryBtn.style.opacity   = '1'
    this.panelBtn.style.opacity   = '1'
    this.followUpInput.disabled   = false
    this.updatePaginationUI()
  }

  private bindCopyButtons(): void {
    this.el.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      if (!target.classList.contains('aurora-copy-btn')) return
      const code = target.nextElementSibling?.querySelector('code')
      if (!code) return
      try {
        await navigator.clipboard.writeText(code.innerText)
        const orig = target.innerText
        target.innerText   = '✔ 복사됨'
        target.style.color = '#a6e3a1'
        setTimeout(() => {
          target.innerText   = orig
          target.style.color = '#a6adc8'
        }, 2000)
      } catch { /* clipboard 권한 없음 — 무시 */ }
    })
  }

  private showError(error: string): void {
    this.loadingEl.style.display  = 'none'
    this.resultEl.style.display   = 'block'
    this.resultEl.style.color     = '#f38ba8'
    this.resultEl.textContent     = `오류: ${error}`   // 에러는 plain text 유지
    this.statusEl.textContent     = '오류 발생'
    this.statusEl.style.color     = '#f38ba8'
    this.retryBtn.disabled        = false
    this.retryBtn.style.opacity   = '1'
    this.followUpInput.disabled   = false
  }

  // ── 패널 열기 ────────────────────────────────────────────

  private openSidebar(): void {
    try { chrome.runtime.sendMessage({ type: 'TOGGLE_SIDEPANEL' }) } catch { /* invalidated */ }
  }

  private async continueInPanel(): Promise<void> {
    await chrome.storage?.local?.set({
      panelContinue: {
        action: this.currentAction,
        text:   this.sourceText,
        result: this.resultText,
      },
    })
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' })
    this.destroy()
  }

  // ── DOM 빌드 ─────────────────────────────────────────────

  private buildEl(action: ToolbarAction, sourceText: string): {
    el:           HTMLDivElement
    header:       HTMLDivElement
    dragHandle:   HTMLDivElement
    resizeHandle: HTMLDivElement
    loadingEl:    HTMLElement
    resultEl:     HTMLElement
    statusEl:        HTMLElement
    copyBtn:         HTMLButtonElement
    replaceBtn:      HTMLButtonElement
    retryBtn:        HTMLButtonElement
    panelBtn:        HTMLButtonElement
    translateBtn:    HTMLButtonElement
    followUpInput:   HTMLTextAreaElement
    actionLabelEl:   HTMLElement
    actionIconEl:       HTMLElement
    modelSelectEl:      HTMLSelectElement
    transLangSelectEl:  HTMLSelectElement
    paginationEl:       HTMLDivElement
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
      display:      'flex',
      alignItems:   'center',
      padding:      '0 12px',
      height:       '42px',
      borderBottom: '1px solid #2d2f45',
      flexShrink:   '0',
      background:   '#141625',
      position:     'relative',
      zIndex:       '10',
      gap:          '6px',
    })

    // 헤더 좌측: 액션 드롭다운
    const headerLeft = document.createElement('div')
    css(headerLeft, { position: 'relative', display: 'flex', alignItems: 'center', gap: '5px', userSelect: 'none', flexShrink: '0' })

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
    const DROPDOWN_ACTIONS: ToolbarAction[] = ['translate', 'summarize', 'grammar', 'draft', 'ask', 'shorter', 'longer', 'tone']
    const actionDropdown = document.createElement('div')
    css(actionDropdown, {
      display: 'none', position: 'absolute', top: '100%', left: '0',
      zIndex: '999', background: '#141625', border: '1px solid #3d3f58',
      borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      minWidth: '120px', padding: '4px', marginTop: '4px',
      maxHeight: '300px', overflowY: 'auto',
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

    // 드롭다운 외부 클릭 감지 — shell이 DOM에서 제거되면 자동으로 리스너 해제
    const onDropdownOutside = (e: MouseEvent) => {
      if (!document.body.contains(this.el)) {
        document.removeEventListener('mousedown', onDropdownOutside)
        return
      }
      if (actionDropdown.style.display === 'block' && !headerLeft.contains(e.target as Node)) {
        actionDropdown.style.display = 'none'
      }
    }
    document.addEventListener('mousedown', onDropdownOutside)

    // headerLeft 호버 효과
    css(headerLeft, { padding: '4px 8px', borderRadius: '8px', transition: 'background 0.12s' })
    headerLeft.addEventListener('mouseenter', () => { headerLeft.style.background = '#313244' })
    headerLeft.addEventListener('mouseleave', () => { headerLeft.style.background = 'transparent' })

    headerLeft.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName.toLowerCase() === 'select') return
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault(); e.stopPropagation()
      if (actionDropdown.style.display !== 'none') { actionDropdown.style.display = 'none'; return }
      actionDropdown.style.display      = 'block'
      actionDropdown.style.top          = '100%'
      actionDropdown.style.bottom       = 'auto'
      actionDropdown.style.marginTop    = '4px'
      actionDropdown.style.marginBottom = '0'
      const rect = actionDropdown.getBoundingClientRect()
      if (rect.bottom > window.innerHeight - 10) {
        actionDropdown.style.top          = 'auto'
        actionDropdown.style.bottom       = '100%'
        actionDropdown.style.marginTop    = '0'
        actionDropdown.style.marginBottom = '4px'
      }
    })

    // 헤더 우측: 모델 뱃지 + 사이드바 열기 버튼 + 닫기
    const headerRight = document.createElement('div')
    css(headerRight, { display: 'flex', alignItems: 'center', gap: '12px' })

    // 모델 선택 드롭다운
    const modelSelectEl = document.createElement('select')
    modelSelectEl.innerHTML = `
      <option value="gemini-nano">Gemini Nano</option>
      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
      <option value="gpt-4o">GPT-4o</option>
    `
    css(modelSelectEl, {
      background: '#1e1e2e', border: '1px solid #45475a', borderRadius: '8px',
      color: '#cdd6f4', fontSize: '14px', padding: '6px 24px 6px 12px',
      cursor: 'pointer', outline: 'none',
    })
    void chrome.storage.local.get('aurora_model').then((res) => {
      const saved = res['aurora_model'] as string | undefined
      if (saved) modelSelectEl.value = saved
    })
    modelSelectEl.addEventListener('change', () => {
      void chrome.storage.local.set({ aurora_model: modelSelectEl.value })
    })

    // 번역 언어 선택 드롭다운 (translate 액션일 때만 표시)
    const transLangSelectEl = document.createElement('select')
    transLangSelectEl.innerHTML = `
      <option value="한국어">한국어</option>
      <option value="영어">영어</option>
      <option value="일본어">일본어</option>
      <option value="중국어">중국어</option>
    `
    css(transLangSelectEl, {
      display: 'none', background: '#1e1e2e', border: '1px solid #45475a',
      borderRadius: '8px', color: '#cdd6f4', fontSize: '14px',
      padding: '6px 24px 6px 12px', cursor: 'pointer', outline: 'none',
    })

    // 페이지네이션 ( ‹ 1 / 3 › )
    const paginationEl = document.createElement('div')
    css(paginationEl, {
      display: 'none', alignItems: 'center', gap: '2px',
      background: '#1e1e2e', border: '1px solid #45475a', borderRadius: '8px',
      fontSize: '14px', color: '#cdd6f4', padding: '6px 12px',
    })
    const pgPrev = document.createElement('button')
    pgPrev.className = 'aurora-pg-prev'
    pgPrev.textContent = '‹'
    css(pgPrev, { background: 'transparent', border: 'none', color: '#cdd6f4', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: '1.2' })
    pgPrev.disabled = true
    const pgLabel = document.createElement('span')
    pgLabel.className = 'aurora-pg-label'
    pgLabel.textContent = '1 / 1'
    css(pgLabel, { padding: '0 4px', whiteSpace: 'nowrap', fontSize: '13px', color: '#cdd6f4' })
    const pgNext = document.createElement('button')
    pgNext.className = 'aurora-pg-next'
    pgNext.textContent = '›'
    css(pgNext, { background: 'transparent', border: 'none', color: '#cdd6f4', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: '1.2' })
    pgNext.disabled = true
    pgPrev.addEventListener('click', () => {
      if (this.historyIndex > 0) {
        this.historyIndex--
        this.resultText = this.resultHistory[this.historyIndex]
        this.resultEl.innerHTML = renderMarkdown(this.resultText)
        this.updatePaginationUI()
      }
    })
    pgNext.addEventListener('click', () => {
      if (this.historyIndex < this.resultHistory.length - 1) {
        this.historyIndex++
        this.resultText = this.resultHistory[this.historyIndex]
        this.resultEl.innerHTML = renderMarkdown(this.resultText)
        this.updatePaginationUI()
      }
    })
    paginationEl.append(pgPrev, pgLabel, pgNext)

    // 사이드바 열기 버튼
    const sidebarBtn = document.createElement('button')
    sidebarBtn.title = 'Aurora 사이드바 열기'
    sidebarBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>`
    css(sidebarBtn, {
      background: 'transparent', border: 'none', color: '#6c7086',
      width: '32px', height: '32px', padding: '4px', borderRadius: '6px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    })
    sidebarBtn.addEventListener('mouseenter', () => { sidebarBtn.style.color = '#cba6f7'; sidebarBtn.style.background = '#2d2f45' })
    sidebarBtn.addEventListener('mouseleave', () => { sidebarBtn.style.color = '#6c7086'; sidebarBtn.style.background = 'transparent' })
    sidebarBtn.addEventListener('click', () => this.openSidebar())

    // 닫기 버튼
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '닫기'
    css(closeBtn, {
      background: 'transparent', border: 'none', color: '#6c7086',
      padding: '6px 12px', borderRadius: '6px',
      cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
    })
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#cdd6f4'; closeBtn.style.background = '#313244' })
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#6c7086'; closeBtn.style.background = 'transparent' })
    closeBtn.addEventListener('click', () => this.destroy())

    // 가운데 드래그 핸들 (빈 공간)
    const dragHandle = document.createElement('div')
    css(dragHandle, { flex: '1', height: '100%', cursor: 'grab', minWidth: '20px' })

    headerRight.append(paginationEl, transLangSelectEl, modelSelectEl, sidebarBtn, closeBtn)
    header.append(headerLeft, dragHandle, headerRight)

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
      overflowX:     'hidden',
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
    loadingText.textContent = 'AI 처리 중...'
    css(loadingText, { fontSize: '12px', color: '#6c7086', letterSpacing: '0.05em' })
    loadingEl.append(dotsEl, loadingText)

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

    body.append(loadingEl, resultEl)

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
    statusEl.textContent = 'AI 처리 중...'
    css(statusEl, { fontSize: '11px', color: '#6c7086', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
    // 새로고침(재호출) 버튼
    const retryBtn = document.createElement('button')
    retryBtn.title = '다시 실행'
    retryBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`
    styleIconBtn(retryBtn)
    retryBtn.style.marginLeft = '6px'
    retryBtn.style.opacity = '0.4'
    retryBtn.addEventListener('click', () => {
      if (this.currentAction === 'draft') { this.showResult(this.sourceText); return }
      if (this.currentAction !== 'save') void this.runAction(SYSTEM_PROMPTS[this.currentAction as AiAction], USER_PROMPTS[this.currentAction as AiAction](this.sourceText))
    })
    statusLeft.append(auroraIcon, statusEl, retryBtn)

    // 오른쪽: 번역하기 | 바꾸기 | 복사 | 패널에서 계속
    const btnGroup = document.createElement('div')
    css(btnGroup, { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: '0' })

    // 번역하기 버튼 (translate 액션일 때만 표시)
    const translateBtn = document.createElement('button')
    translateBtn.textContent = '번역하기'
    css(translateBtn, {
      background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)', border: 'none',
      color: '#fff', fontSize: '12px', fontWeight: '600',
      padding: '6px 18px', borderRadius: '6px', cursor: 'pointer',
      display: 'none', alignItems: 'center',
    })
    translateBtn.addEventListener('mouseenter', () => { translateBtn.style.opacity = '0.85' })
    translateBtn.addEventListener('mouseleave', () => { translateBtn.style.opacity = '1' })
    translateBtn.addEventListener('click', () => {
      void this.runAction(
        SYSTEM_PROMPTS['translate'],
        USER_PROMPTS['translate'](this.resultText || this.sourceText),
      )
    })

    // ↵ 바꾸기 버튼
    const replaceBtn = document.createElement('button')
    replaceBtn.textContent = '↵ 바꾸기'
    replaceBtn.disabled = true
    css(replaceBtn, {
      background: 'linear-gradient(135deg, #7c3aed, #db2777)', border: 'none',
      color: '#fff', fontSize: '12px', fontWeight: '600',
      padding: '6px 20px', borderRadius: '6px', cursor: 'pointer', opacity: '0.4',
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
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
    styleIconBtn(copyBtn)
    css(copyBtn, { width: '32px', height: '32px', justifyContent: 'center' })
    copyBtn.style.opacity = '0.4'
    copyBtn.addEventListener('click', () => {
      if (!this.resultText) return
      void navigator.clipboard.writeText(this.resultText).then(() => {
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#a6e3a1" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`
        setTimeout(() => {
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
        }, 1500)
      })
    })

    // 패널에서 계속 버튼
    const panelBtn = document.createElement('button')
    panelBtn.title = '패널에서 계속'
    panelBtn.disabled = true
    panelBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
    styleIconBtn(panelBtn)
    css(panelBtn, { width: '32px', height: '32px', justifyContent: 'center' })
    panelBtn.style.opacity = '0.4'
    panelBtn.addEventListener('click', () => void this.continueInPanel())

    btnGroup.append(translateBtn, replaceBtn, copyBtn, panelBtn)
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
      display:      'flex',
      alignItems:   'flex-end',
      gap:          '6px',
      background:   '#141625',
      border:       '1px solid #2d2f45',
      borderRadius: '10px',
      padding:      '6px 8px',
      transition:   'border-color 0.15s',
    })
    inputWrap.addEventListener('focusin',  () => { inputWrap.style.borderColor = '#7c3aed' })
    inputWrap.addEventListener('focusout', () => { inputWrap.style.borderColor = '#2d2f45' })

    // ── 퀵버튼 (스파클 ✨) ───────────────────────────────────
    const quickBtn = document.createElement('button')
    quickBtn.title = '프롬프트 템플릿'
    quickBtn.textContent = '✨'
    css(quickBtn, {
      background:  'none',
      border:      'none',
      cursor:      'pointer',
      fontSize:    '14px',
      lineHeight:  '1',
      padding:     '0',
      flexShrink:  '0',
      opacity:     '0.6',
      transition:  'opacity 0.15s',
      alignSelf:   'center',
    })
    quickBtn.addEventListener('mouseenter', () => { quickBtn.style.opacity = '1' })
    quickBtn.addEventListener('mouseleave', () => { quickBtn.style.opacity = '0.6' })

    const QUICK_TEMPLATES = [
      { label: '✏️ 반말 교정', value: '이 텍스트의 문법과 맞춤법을 반말(~다체)로 교정해줘' },
      { label: '🎩 존댓말 변환', value: '이 텍스트를 정중한 존댓말(~요/~습니다체)로 바꿔줘' },
      { label: '✂️ 더 짧게', value: '이 텍스트를 의미를 유지하며 절반 이하로 줄여줘' },
      { label: '📝 더 자세히', value: '이 텍스트를 더 상세하고 풍부하게 늘려줘' },
      { label: '🚀 마스터 프롬프트 생성', value: '이 내용을 기반으로 고급 AI 프롬프트를 작성해줘' },
    ]

    let quickMenuOpen = false
    let quickMenuEl: HTMLDivElement | null = null

    const closeQuickMenu = () => {
      quickMenuEl?.remove()
      quickMenuEl = null
      quickMenuOpen = false
    }

    quickBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (quickMenuOpen) { closeQuickMenu(); return }
      quickMenuOpen = true

      quickMenuEl = document.createElement('div')
      css(quickMenuEl, {
        position:     'absolute',
        bottom:       '100%',
        left:         '0',
        marginBottom: '6px',
        background:   '#1e2035',
        border:       '1px solid #3d3f5a',
        borderRadius: '10px',
        padding:      '4px',
        zIndex:       '10',
        minWidth:     '200px',
        boxShadow:    '0 4px 16px rgba(0,0,0,0.5)',
      })

      QUICK_TEMPLATES.forEach(({ label, value }) => {
        const item = document.createElement('button')
        item.textContent = label
        css(item, {
          display:      'block',
          width:        '100%',
          background:   'none',
          border:       'none',
          color:        '#cdd6f4',
          fontSize:     '12px',
          padding:      '7px 10px',
          textAlign:    'left',
          cursor:       'pointer',
          borderRadius: '7px',
          whiteSpace:   'nowrap',
        })
        item.addEventListener('mouseenter', () => { item.style.background = '#2d2f45' })
        item.addEventListener('mouseleave', () => { item.style.background = 'none' })
        item.addEventListener('click', () => {
          followUpInput.value = value
          followUpInput.style.height = 'auto'
          followUpInput.style.height = `${Math.min(followUpInput.scrollHeight, 84)}px`
          followUpInput.focus()
          closeQuickMenu()
        })
        quickMenuEl!.appendChild(item)
      })

      footer2.style.position = 'relative'
      footer2.appendChild(quickMenuEl)

      const onOutside = (ev: MouseEvent) => {
        if (!quickMenuEl?.contains(ev.target as Node) && ev.target !== quickBtn) {
          closeQuickMenu()
          document.removeEventListener('click', onOutside)
        }
      }
      setTimeout(() => document.addEventListener('click', onOutside), 0)
    })

    const followUpInput = document.createElement('textarea')
    followUpInput.placeholder = 'AI에게 추가 질문을 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)'
    followUpInput.rows = 1
    css(followUpInput, {
      flex:          '1',
      minWidth:      '0',
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
    inputWrap.append(quickBtn, followUpInput)

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
      el, header, dragHandle, resizeHandle,
      loadingEl, resultEl,
      statusEl, copyBtn, replaceBtn, retryBtn, panelBtn, translateBtn,
      followUpInput,
      actionLabelEl: actionLabel,
      actionIconEl,
      modelSelectEl,
      transLangSelectEl,
      paginationEl,
    }
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
    // 실제 렌더된 높이(offsetHeight)로 뷰포트 이탈을 엄격하게 제한
    const elH = this.el.offsetHeight || H_EST
    top = Math.max(8, Math.min(top, window.innerHeight - elH - 8))

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

      // rangeClone의 startContainer가 DOM에서 분리된 경우 조기 탐지
      if (!rangeClone.startContainer.isConnected) {
        return 'contenteditable: 선택 영역이 만료됨 — 다시 드래그 후 시도하세요'
      }

      const sel = window.getSelection()
      if (!sel) return 'contenteditable: Selection API 사용 불가'

      try {
        el.focus()
        sel.removeAllRanges()
        sel.addRange(rangeClone)
        const ok = document.execCommand('insertText', false, this.resultText)
        if (!ok) {
          // execCommand 실패 시 DOM 직접 조작으로 폴백
          // deleteContents + insertNode를 별도 try/catch로 감싸 DOM 오염 방지
          try {
            rangeClone.deleteContents()
            rangeClone.insertNode(document.createTextNode(this.resultText))
            // 삽입된 노드 뒤로 커서 이동 (범위 정규화)
            rangeClone.collapse(false)
            sel.removeAllRanges()
            sel.addRange(rangeClone)
          } catch (insertErr) {
            const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
            return `contenteditable: insertNode 실패 — ${msg}`
          }
        }
        el.dispatchEvent(new Event('input',  { bubbles: true }))
        return null
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `contenteditable: 바꾸기 실패 — ${msg}`
      }
    }

    return '원문 선택 영역을 찾을 수 없습니다'
  }

  private updatePaginationUI(): void {
    const total   = this.resultHistory.length
    const current = this.historyIndex + 1
    const prevBtn = this.paginationEl.querySelector<HTMLButtonElement>('.aurora-pg-prev')!
    const nextBtn = this.paginationEl.querySelector<HTMLButtonElement>('.aurora-pg-next')!
    const label   = this.paginationEl.querySelector<HTMLSpanElement>('.aurora-pg-label')!
    label.textContent      = `${current} / ${total}`
    prevBtn.disabled       = this.historyIndex <= 0
    nextBtn.disabled       = this.historyIndex >= total - 1
    prevBtn.style.opacity  = prevBtn.disabled ? '0.3' : '0.8'
    nextBtn.style.opacity  = nextBtn.disabled ? '0.3' : '0.8'
    this.paginationEl.style.display = total <= 1 ? 'none' : 'flex'
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

## File: `src/content/ui/quick-launcher.ts`
```typescript
// ── Aurora: Quick Launcher (Spotlight-style) ─────────────────
// Alt+J 로 호출하는 전역 AI 검색 론처
import { renderMarkdown } from '../../shared/utils/markdown'

// Chrome Built-in AI — window.ai.languageModel (content script에서 접근 가능한 경로)
type NanoSession = { prompt(input: string): Promise<string>; destroy(): void }
type NanoAI = { create(opts?: Record<string, unknown>): Promise<NanoSession> }
const getNanoAI = (): NanoAI | null => (window as unknown as { ai?: { languageModel?: NanoAI } }).ai?.languageModel ?? null

export class QuickLauncher {
  private container: HTMLElement
  private inputEl:   HTMLInputElement
  private resultEl:  HTMLElement
  private _visible = false

  constructor() {
    this.container = this.buildEl()
    document.body.appendChild(this.container)
    this.bindEvents()
    this.bindCopyButtons()
  }

  // ── 토글 ──────────────────────────────────────────────────
  toggle(): void {
    this._visible ? this.hide() : this.show()
  }

  show(): void {
    this.container.style.display = 'flex'
    this.resultEl.style.display  = 'none'
    this.resultEl.innerHTML      = ''
    this._visible = true
    requestAnimationFrame(() => this.inputEl.focus())
  }

  hide(): void {
    this.container.style.display = 'none'
    this.inputEl.value = ''
    this._visible = false
  }

  // ── UI 생성 ───────────────────────────────────────────────
  private buildEl(): HTMLElement {
    const container = document.createElement('div')
    container.id = 'aurora-quick-launcher'
    Object.assign(container.style, {
      position:      'fixed',
      top:           '20vh',
      left:          'calc(50vw - 300px)',
      width:         '600px',
      minWidth:      '400px',
      minHeight:     '150px',
      maxWidth:      '90vw',
      maxHeight:     '90vh',
      background:    '#1e1e2e',
      border:        '1px solid #45475a',
      borderRadius:  '12px',
      boxShadow:     '0 10px 30px rgba(0,0,0,0.5)',
      display:       'none',
      flexDirection: 'column',
      overflow:      'hidden',
      resize:        'both',
      fontFamily:    'system-ui, -apple-system, sans-serif',
    })
    container.style.setProperty('z-index', '2147483647', 'important')

    // ── 헤더 (드래그 핸들 + 닫기 버튼) ──────────────────────
    const headerEl = document.createElement('div')
    headerEl.className = 'aurora-launcher-header'
    Object.assign(headerEl.style, {
      display:         'flex',
      justifyContent:  'space-between',
      alignItems:      'center',
      padding:         '10px 15px',
      background:      '#181825',
      borderBottom:    '1px solid #313244',
      cursor:          'grab',
      borderRadius:    '12px 12px 0 0',
      flexShrink:      '0',
    })

    const dragLabel = document.createElement('span')
    dragLabel.textContent = '⠿ Aurora 론처 (드래그로 이동)'
    Object.assign(dragLabel.style, {
      color:         '#a6adc8',
      fontSize:      '12px',
      pointerEvents: 'none',
      userSelect:    'none',
    })

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    Object.assign(closeBtn.style, {
      background: 'none',
      border:     'none',
      color:      '#f38ba8',
      fontSize:   '16px',
      cursor:     'pointer',
      padding:    '0 5px',
      lineHeight: '1',
    })
    closeBtn.addEventListener('click', () => this.hide())

    headerEl.append(dragLabel, closeBtn)

    // ── 드래그 이동 로직 ─────────────────────────────────────
    let isDragging = false
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0

    headerEl.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement) === closeBtn) return
      isDragging = true
      headerEl.style.cursor = 'grabbing'
      startX = e.clientX
      startY = e.clientY
      const rect = container.getBoundingClientRect()
      initialLeft = rect.left
      initialTop  = rect.top
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      container.style.left = `${initialLeft + dx}px`
      container.style.top  = `${initialTop  + dy}px`
    })

    document.addEventListener('mouseup', () => {
      if (!isDragging) return
      isDragging = false
      headerEl.style.cursor = 'grab'
    })

    // ── 검색 입력창 ──────────────────────────────────────────
    const inputWrapper = document.createElement('div')
    Object.assign(inputWrapper.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '12px',
      padding:    '0 20px',
      flexShrink: '0',
    })

    const icon = document.createElement('div')
    icon.style.flexShrink = '0'
    icon.innerHTML = `
      <svg viewBox="0 0 100 100" width="22" height="22" fill="none">
        <defs>
          <linearGradient id="ql-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </linearGradient>
        </defs>
        <path d="M20 80L50 20L80 80" stroke="url(#ql-g)" stroke-width="9"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M35 80L50 50L65 80" stroke="white" stroke-width="4.5"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
      </svg>
    `

    this.inputEl = document.createElement('input')
    this.inputEl.type        = 'text'
    this.inputEl.placeholder = '오로라에게 무엇이든 물어보세요... (Alt+J)'
    Object.assign(this.inputEl.style, {
      flex:       '1',
      fontSize:   '20px',
      padding:    '20px 0',
      background: 'transparent',
      border:     'none',
      outline:    'none',
      color:      '#cdd6f4',
      width:      '100%',
      caretColor: '#8b5cf6',
    })

    inputWrapper.append(icon, this.inputEl)

    // ── 결과 출력창 ──────────────────────────────────────────
    this.resultEl = document.createElement('div')
    this.resultEl.className = 'aurora-launcher-result'
    Object.assign(this.resultEl.style, {
      padding:    '0 20px 20px 20px',
      borderTop:  '1px solid #45475a',
      display:    'none',
      color:      '#cdd6f4',
      fontSize:   '15px',
      lineHeight: '1.6',
      overflowY:  'auto',
      flex:       '1',
      whiteSpace: 'pre-wrap',
      wordBreak:  'break-word',
    })

    container.append(headerEl, inputWrapper, this.resultEl)
    return container
  }

  // ── 이벤트 바인딩 ─────────────────────────────────────────
  private bindEvents(): void {
    // 슬래시 명령어 자동 치환
    const SLASH_COMMANDS: [string, string][] = [
      ['/요약 ', '다음 텍스트의 핵심 내용을 3줄로 요약해 줘:\n\n'],
      ['/번역 ', '다음 텍스트를 자연스럽고 매끄러운 한국어로 번역해 줘:\n\n'],
      ['/코드 ', '다음 코드의 동작 원리를 초보자도 이해하기 쉽게 단계별로 설명해 줘:\n\n'],
      ['/메일 ', '다음 내용을 바탕으로 정중하고 프로페셔널한 비즈니스 이메일을 작성해 줘:\n\n'],
    ]
    this.inputEl.addEventListener('input', () => {
      const value = this.inputEl.value
      for (const [cmd, expansion] of SLASH_COMMANDS) {
        if (value.includes(cmd)) {
          this.inputEl.value = value.replace(cmd, expansion)
          break
        }
      }
    })

    // Enter → AI 호출 / ESC → 닫기
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void this.runQuery()
      }
      if (e.key === 'Escape') {
        e.stopPropagation()
        this.hide()
      }
    })

    // ESC 전역 (capture로 다른 핸들러보다 먼저 처리)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._visible) {
        e.stopPropagation()
        this.hide()
      }
    }, { capture: true })
  }

  // ── AI 쿼리 ───────────────────────────────────────────────
  private async runQuery(): Promise<void> {
    const query = this.inputEl.value.trim()
    if (!query) return

    this.resultEl.style.display = 'block'
    this.resultEl.style.color   = '#6c7086'
    this.resultEl.textContent   = 'AI가 생각 중...'

    try {
      const [modelRes, keysRes] = await Promise.all([
        chrome.storage.local.get('aurora_model'),
        chrome.storage.local.get('aurora_api_keys'),
      ])
      const model = (modelRes['aurora_model'] as string | undefined) ?? 'gemini-2.5-flash'
      const keys  = keysRes['aurora_api_keys'] as { openai?: string; gemini?: string } | undefined

      const systemPrompt = '당신은 도움이 되는 AI 비서입니다. 반드시 한국어로 간결하게 답변하세요.'

      // ── Gemini Nano (로컬 Built-in AI) ───────────────────────
      if (model === 'gemini-nano') {
        const nanoAI = getNanoAI()
        if (!nanoAI) {
          const msg = '⚠️ 크롬 보안 정책으로 인해 현재 웹페이지에서는 Gemini Nano(Local)를 직접 호출할 수 없습니다. ' +
                      '사이드패널을 이용하시거나 모델을 변경해 주세요.'
          this.resultEl.style.color   = '#f38ba8'
          this.resultEl.style.display = 'block'
          this.resultEl.innerHTML     = renderMarkdown(msg)
          return
        }
        let session: NanoSession | null = null
        try {
          session = await nanoAI.create({
            systemPrompt,
            expectedInputLanguage: 'ko',
            outputLanguage:        'ko',
            temperature:           0.6,
            topK:                  5,
          })
          const raw = await session.prompt(query)
          const clean = raw.replace(/\[\/?RESULT\]/g, '').trim()
          this.resultEl.style.color   = '#cdd6f4'
          this.resultEl.style.display = 'block'
          this.resultEl.innerHTML     = renderMarkdown(clean)
        } catch {
          // window.ai 접근 거부 또는 세션 생성 실패 — 콘솔 에러 숨기고 안내 메시지 렌더링
          const msg = '⚠️ 크롬 보안 정책으로 인해 현재 웹페이지에서는 Gemini Nano(Local)를 직접 호출할 수 없습니다. ' +
                      '사이드패널을 이용하시거나 모델을 변경해 주세요.'
          this.resultEl.style.color   = '#f38ba8'
          this.resultEl.style.display = 'block'
          this.resultEl.innerHTML     = renderMarkdown(msg)
        } finally {
          session?.destroy()
        }
        return
      }

      // ── Cloud AI (Gemini Flash / GPT-4o) ────────────────────
      const isGemini = model !== 'gpt-4o'
      const provider = isGemini ? 'gemini' : 'openai'
      const apiKey   = isGemini ? keys?.gemini : keys?.openai

      if (!apiKey) {
        this.showError('API 키가 설정되지 않았습니다. Aurora 사이드패널 → 설정에서 키를 입력해주세요.')
        return
      }

      const response = await chrome.runtime.sendMessage({
        type:    'CALL_CLOUD_AI',
        payload: { provider, model, apiKey, systemPrompt, userPrompt: query },
      }) as { success: boolean; data?: string; error?: string }

      if (response.success && response.data) {
        const clean = (response.data as string).replace(/\[\/?RESULT\]/g, '').trim()
        this.resultEl.style.color = '#cdd6f4'
        this.resultEl.innerHTML = renderMarkdown(clean)
      } else {
        this.showError(response.error ?? '알 수 없는 오류가 발생했습니다.')
      }
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err))
    }
  }

  private bindCopyButtons(): void {
    this.container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      if (!target.classList.contains('aurora-copy-btn')) return
      const code = target.nextElementSibling?.querySelector('code')
      if (!code) return
      try {
        await navigator.clipboard.writeText(code.innerText)
        const orig = target.innerText
        target.innerText   = '✔ 복사됨'
        target.style.color = '#a6e3a1'
        setTimeout(() => {
          target.innerText   = orig
          target.style.color = '#a6adc8'
        }, 2000)
      } catch { /* clipboard 권한 없음 — 무시 */ }
    })
  }

  private showError(msg: string): void {
    this.resultEl.style.display = 'block'
    this.resultEl.style.color   = '#f38ba8'
    this.resultEl.textContent   = `오류: ${msg}`
  }
}

```

## File: `src/content/youtube.ts`
```typescript
// ── Aurora: YouTube Summarizer ────────────────────────────────
// 유튜브 /watch 페이지에서 "Aurora 영상 요약" 버튼을 주입합니다.

export function initYouTubeSummarizer(): void {
  if (!window.location.hostname.includes('youtube.com')) return

  let lastHref = location.href

  // ── 버튼 주입 ───────────────────────────────────────────────
  const tryInject = (): void => {
    if (!location.pathname.startsWith('/watch')) return
    if (document.getElementById('aurora-yt-summary-btn')) return

    // 제목 컨테이너가 렌더링될 때까지 대기
    const titleEl = document.querySelector<HTMLElement>('#title h1')
      ?? document.querySelector<HTMLElement>('h1.ytd-watch-metadata')
    if (!titleEl) return

    const insertParent = titleEl.closest<HTMLElement>('#title, ytd-video-primary-info-renderer')
      ?? titleEl.parentElement
    if (!insertParent) return

    // ── 버튼 생성 ────────────────────────────────────────────
    const btn = document.createElement('button')
    btn.id = 'aurora-yt-summary-btn'
    btn.innerHTML = `
      <svg viewBox="0 0 100 100" width="13" height="13" fill="none" style="flex-shrink:0;display:block">
        <defs>
          <linearGradient id="ayt-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#fff" stop-opacity="0.75"/>
          </linearGradient>
        </defs>
        <path d="M20 80L50 20L80 80" stroke="url(#ayt-g)" stroke-width="10"
              stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M35 80L50 50L65 80" stroke="white" stroke-width="5"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
      </svg>
      Aurora 영상 요약
    `

    Object.assign(btn.style, {
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '6px',
      marginTop:     '10px',
      marginBottom:  '4px',
      padding:       '7px 16px',
      background:    'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      color:         '#fff',
      border:        'none',
      borderRadius:  '20px',
      fontSize:      '13px',
      fontWeight:    '600',
      fontFamily:    'system-ui, -apple-system, sans-serif',
      cursor:        'pointer',
      boxShadow:     '0 2px 12px rgba(139,92,246,0.45)',
      transition:    'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
      letterSpacing: '0.015em',
      lineHeight:    '1',
      whiteSpace:    'nowrap',
    })
    btn.style.setProperty('z-index', '9999', 'important')

    btn.addEventListener('mouseenter', () => {
      btn.style.opacity   = '0.9'
      btn.style.transform = 'translateY(-1px)'
      btn.style.boxShadow = '0 4px 18px rgba(139,92,246,0.6)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity   = '1'
      btn.style.transform = 'translateY(0)'
      btn.style.boxShadow = '0 2px 12px rgba(139,92,246,0.45)'
    })
    btn.addEventListener('mousedown', () => { btn.style.transform = 'translateY(0) scale(0.97)' })
    btn.addEventListener('mouseup',   () => { btn.style.transform = 'translateY(-1px) scale(1)' })

    // ── 클릭: 메타데이터 추출 → background로 전송 ────────────
    btn.addEventListener('click', () => {
      const title = (
        document.querySelector<HTMLElement>('#title h1 yt-formatted-string')?.textContent
        ?? document.querySelector<HTMLElement>('h1.ytd-watch-metadata yt-formatted-string')?.textContent
        ?? document.querySelector<HTMLElement>('#title h1')?.textContent
        ?? document.title
      ).trim()

      const channel = (
        document.querySelector<HTMLElement>('ytd-channel-name#channel-name yt-formatted-string a')?.textContent
        ?? document.querySelector<HTMLElement>('#channel-name a')?.textContent
        ?? document.querySelector<HTMLElement>('ytd-channel-name a')?.textContent
        ?? ''
      ).trim()

      const descEl =
        document.querySelector<HTMLElement>('#description-inline-expander yt-attributed-string')
        ?? document.querySelector<HTMLElement>('ytd-text-inline-expander yt-attributed-string')
        ?? document.querySelector<HTMLElement>('#description')
      const description = (descEl?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500)

      try {
        chrome.runtime.sendMessage({
          type:    'YOUTUBE_SUMMARY_REQUEST',
          payload: { title, channel, description },
        })
      } catch { /* extension context invalidated */ }
    })

    insertParent.appendChild(btn)
  }

  // ── MutationObserver: 렌더링 완료 + SPA 이동 감지 ─────────
  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href
      document.getElementById('aurora-yt-summary-btn')?.remove()
      // 새 페이지 DOM이 안정될 때까지 짧게 대기
      setTimeout(tryInject, 1000)
    } else {
      tryInject()
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  tryInject()
}

```

## File: `src/shared/types/index.ts`
```typescript
export type ToolbarMode   = 'read' | 'write'
export type ToolbarAction =
  | 'translate' | 'summarize' | 'grammar' | 'draft' | 'ask' | 'save'
  | 'shorter'   | 'longer'    | 'tone'
  | 'copy'      | 'highlight'

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

## File: `src/shared/utils/markdown.ts`
```typescript
// ── Aurora: Markdown → Safe HTML ─────────────────────────────
// marked v12 : 마크다운 → HTML 변환
// highlight.js : 코드 블록 신택스 하이라이팅
// DOMPurify   : XSS 방지 새니타이즈

import { marked, Renderer } from 'marked'
import hljs from 'highlight.js/lib/core'
import DOMPurify from 'dompurify'

// 자주 쓰이는 언어만 등록 (번들 크기 최소화)
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python     from 'highlight.js/lib/languages/python'
import bash       from 'highlight.js/lib/languages/bash'
import json       from 'highlight.js/lib/languages/json'
import css        from 'highlight.js/lib/languages/css'
import xml        from 'highlight.js/lib/languages/xml'
import sql        from 'highlight.js/lib/languages/sql'
import markdown   from 'highlight.js/lib/languages/markdown'
import plaintext  from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js',         javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts',         typescript)
hljs.registerLanguage('python',     python)
hljs.registerLanguage('py',         python)
hljs.registerLanguage('bash',       bash)
hljs.registerLanguage('sh',         bash)
hljs.registerLanguage('json',       json)
hljs.registerLanguage('css',        css)
hljs.registerLanguage('html',       xml)
hljs.registerLanguage('xml',        xml)
hljs.registerLanguage('sql',        sql)
hljs.registerLanguage('markdown',   markdown)
hljs.registerLanguage('plaintext',  plaintext)

// highlight.js 다크 테마 CSS
import 'highlight.js/styles/github-dark.css'

// ── 코드 블록 투명화 방지 CSS 강제 주입 ──────────────────────
;(function injectHljsOverride() {
  const ID = 'aurora-hljs-override'
  if (document.getElementById(ID)) return
  const style = document.createElement('style')
  style.id = ID
  style.textContent = `
    pre { background: #181825 !important; border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 8px 0; }
    pre code, pre code span { color: #cdd6f4 !important; }
    pre code.hljs, pre code { background: transparent !important; display: block; text-shadow: none; }
  `
  ;(document.head ?? document.documentElement).appendChild(style)
})()

// ── marked v12 렌더러 (순수 객체 방식 — 타입 충돌 없음) ──────
function highlight(code: string, lang: string | undefined): string {
  if (!code) return ''
  try {
    const validLang = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language: validLang }).value
  } catch {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}

// marked v12+ Token 객체 대응 렌더러 (new Renderer() 방식)
const renderer = new marked.Renderer()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
renderer.code = function(token: any): string {
  // marked v12+는 code()에 문자열이 아닌 Token 객체를 전달함
  let codeText = ''
  let lang     = 'plaintext'

  if (typeof token === 'object' && token !== null) {
    codeText = token.text  || ''
    lang     = token.lang  || 'plaintext'
  } else {
    codeText = typeof token === 'string' ? token : ''
  }

  const validLang = hljs.getLanguage(lang) ? lang : 'plaintext'
  let highlighted  = codeText
  try {
    highlighted = hljs.highlight(codeText, { language: validLang }).value
  } catch (e) {
    console.error('[Aurora] 하이라이팅 에러:', e)
  }

  return (
    `<div class="aurora-code-block" style="position:relative;margin:10px 0;">` +
      `<button class="aurora-copy-btn" style="position:absolute;top:8px;right:8px;background:#313244;color:#a6adc8;border:1px solid #45475a;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;z-index:10;">복사</button>` +
      `<pre style="background:#1e1e2e;padding:12px;padding-top:35px;border-radius:8px;overflow-x:auto;margin:0;">` +
        `<code class="hljs ${validLang}" style="color:#cdd6f4;display:block;">${highlighted}</code>` +
      `</pre>` +
    `</div>`
  )
}

marked.use({ renderer, gfm: true, breaks: true })

// ── 공개 API ──────────────────────────────────────────────────
export function renderMarkdown(rawText: string): string {
  if (!rawText) return ''
  const html = marked.parse(rawText) as string
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a',
      'p', 'br', 'u', 's', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'pre', 'code',
      'hr', 'span',
      'div', 'button',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    // ALLOWED_ATTR로 전체 명시 — ADD_ATTR과 달리 class/style이 절대 지워지지 않음
    ALLOWED_ATTR: ['href', 'title', 'class', 'className', 'style', 'target'],
    KEEP_CONTENT: true,
  })
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
import { renderMarkdown } from '../shared/utils/markdown'

// ── 채팅 세션 ──────────────────────────────────────────────
interface ChatSession {
  id: string
  title: string
  messages: { role: 'user' | 'model'; content: string }[]
  updatedAt: number
}

// Chrome 2026 Built-in AI
declare const LanguageModel: {
  create(options?: {
    systemPrompt?: string
    expectedInputLanguage?: string
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
  private settingsView!: HTMLElement
  private settingsOpenaiInput!: HTMLInputElement
  private settingsGeminiInput!: HTMLInputElement
  private settingsSaveBtn!: HTMLButtonElement

  // 마지막으로 받은 컨텍스트 (추가 질문에 활용)
  private lastContext: { action: ToolbarAction; text: string } | null = null

  // 채팅 세션 히스토리
  private chatSessions: ChatSession[] = []
  private currentSessionId: string | null = null
  private historyDrawer!: HTMLElement
  private sessionListEl!: HTMLElement

  // 페이지 컨텍스트 포함 체크박스
  private pageContextCheckbox!: HTMLInputElement

  init(): void {
    chrome.runtime.connect({ name: 'aurora-sidepanel' })

    // 패널 닫기 + YouTube 요약 등 background 브로드캐스트 수신
    chrome.runtime.onMessage.addListener((request: {
      action?: string
      type?: string
      payload?: unknown
    }) => {
      if (request.action === 'CLOSE_SIDEPANEL') {
        window.close()
        return
      }
      if (request.type === 'EXECUTE_YOUTUBE_SUMMARY') {
        const p = request.payload as { title: string; channel: string; description: string }
        this.executeYoutubeSummary(p)
      }
      if (request.type === 'AUTO_RUN_PROMPT') {
        this.startNewChat()
        this.userInput.value = request.payload as string
        this.sendMessage()
      }
    })
    this.chatArea          = document.getElementById('chat-area')!
    this.userInput         = document.getElementById('user-input') as HTMLTextAreaElement
    this.sendBtn           = document.getElementById('send-btn') as HTMLButtonElement
    this.contextIndicator  = document.getElementById('context-indicator')!
    this.historyView       = document.getElementById('history-view')!
    this.historyList       = document.getElementById('history-list')!
    this.historyCount      = document.getElementById('history-count')!
    this.inputFooter       = document.getElementById('input-footer')!
    this.settingsView      = document.getElementById('settings-view')!
    this.settingsOpenaiInput = document.getElementById('settings-openai-key') as HTMLInputElement
    this.settingsGeminiInput = document.getElementById('settings-gemini-key') as HTMLInputElement
    this.settingsSaveBtn   = document.getElementById('settings-save-btn') as HTMLButtonElement

    document.getElementById('clear-all-btn')!
      .addEventListener('click', () => void this.clearAllHighlights())

    this.settingsSaveBtn.addEventListener('click', () => void this.saveApiKeys())

    this.historyDrawer        = document.getElementById('history-drawer')!
    this.sessionListEl        = document.getElementById('session-list')!
    this.pageContextCheckbox  = document.getElementById('use-page-context') as HTMLInputElement

    // 체크박스 상태 변화 시 레이블 색상 업데이트
    const pageToggleLabel = document.getElementById('page-context-toggle')
    this.pageContextCheckbox.addEventListener('change', () => {
      pageToggleLabel?.classList.toggle('active', this.pageContextCheckbox.checked)
    })

    // 새 채팅 버튼
    document.getElementById('new-chat-btn')?.addEventListener('click', () => {
      this.startNewChat()
    })

    // 대화 기록 버튼 (토글)
    document.getElementById('history-btn')?.addEventListener('click', () => {
      if (this.historyDrawer.classList.contains('hidden')) {
        this.renderSessionList()
        this.historyDrawer.classList.remove('hidden')
      } else {
        this.historyDrawer.classList.add('hidden')
      }
    })

    // 드로어 닫기 버튼
    document.getElementById('close-drawer-btn')?.addEventListener('click', () => {
      this.historyDrawer.classList.add('hidden')
    })

    this.bindInput()
    this.bindSidebarBtns()
    this.bindCopyButtons(this.chatArea)
    this.listenRuntime()
    this.loadPending()
    this.bindModelSelect()
    void this.loadSessions()

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

    // 입력창 자동 높이 조절 + 슬래시 명령어 자동 치환
    this.userInput.addEventListener('input', () => {
      this.userInput.style.height = 'auto'
      this.userInput.style.height = `${Math.min(this.userInput.scrollHeight, 120)}px`

      const value = this.userInput.value
      const SLASH_COMMANDS: [string, string][] = [
        ['/요약 ', '다음 텍스트의 핵심 내용을 3줄로 요약해 줘:\n\n'],
        ['/번역 ', '다음 텍스트를 자연스럽고 매끄러운 한국어로 번역해 줘:\n\n'],
        ['/코드 ', '다음 코드의 동작 원리를 초보자도 이해하기 쉽게 단계별로 설명해 줘:\n\n'],
        ['/메일 ', '다음 내용을 바탕으로 정중하고 프로페셔널한 비즈니스 이메일을 작성해 줘:\n\n'],
      ]
      for (const [cmd, expansion] of SLASH_COMMANDS) {
        if (value.includes(cmd)) {
          this.userInput.value = value.replace(cmd, expansion)
          this.userInput.style.height = 'auto'
          this.userInput.style.height = `${Math.min(this.userInput.scrollHeight, 120)}px`
          break
        }
      }
    })
  }

  private sendMessage(): void {
    const text = this.userInput.value.trim()
    if (!text) return
    this.userInput.value = ''
    this.userInput.style.height = 'auto'

    // UI에는 원래 메시지만 표시
    this.addMessageToSession('user', text)
    this.appendUserBubble(text)
    void this.sendWithContext(text)
  }

  // 페이지 컨텍스트 체크 후 AI 호출
  private async sendWithContext(originalText: string): Promise<void> {
    if (!this.pageContextCheckbox?.checked) {
      await this.runAI(originalText)
      return
    }

    // 로딩 상태
    this.sendBtn.disabled = true
    const prevPlaceholder = this.userInput.placeholder
    this.userInput.placeholder = '페이지 읽는 중...'

    try {
      const pageContent = await this.getCurrentPageContent()
      const aiPrompt = pageContent
        ? `[현재 웹페이지 컨텍스트]\n${pageContent}\n\n[사용자 질문]\n${originalText}`
        : originalText
      await this.runAI(aiPrompt)
    } finally {
      this.sendBtn.disabled = false
      this.userInput.placeholder = prevPlaceholder
    }
  }

  // 현재 활성 탭의 본문 텍스트 추출 (최대 3만 자)
  private async getCurrentPageContent(): Promise<string> {
    try {
      // lastFocusedWindow: 사이드패널 컨텍스트에서 currentWindow는 패널 자체를 가리킬 수 있어 실패함
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      const tabId = tabs[0]?.id
      if (!tabId) {
        console.warn('[Aurora] 활성 탭을 찾을 수 없음')
        return ''
      }
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.body.innerText.substring(0, 30000),
      })
      return (results[0]?.result as string | null | undefined) ?? ''
    } catch (error) {
      console.error('[Aurora] 텍스트 추출 실패:', error)
      return ''
    }
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
      this.showSettingsPanel()
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

    // 세션에 저장 (컨텍스트 요약 → user, AI 결과 → model)
    const userMsg = `[${ACTION_LABEL[val.action]}] ${val.text.slice(0, 80)}`
    this.addMessageToSession('user', userMsg)
    this.addMessageToSession('model', val.result)
  }

  // ── AI 호출 (사이드패널에서 직접 질문할 때) ─────────────

  private async runAI(userText: string): Promise<void> {
    // 로딩 말풍선 먼저 표시
    const { setContent, setError } = this.appendAiBubble('', true)

    // 채팅 모드에서는 [RESULT] 태그 강제 없이 자연스러운 대화 프롬프트 사용
    const systemPrompt =
      STRICT_LANGUAGE_RULE +
      '당신은 도움이 되는 AI 어시스턴트입니다. 반드시 한국어로 답변하세요. 간결하고 명확하게 답하세요.'

    // 이전 컨텍스트가 있으면 프롬프트에 포함
    const userPrompt = this.lastContext
      ? `[컨텍스트: 사용자가 "${this.lastContext.text}" 텍스트에 대해 ${ACTION_LABEL[this.lastContext.action]} 작업 중]\n\n[질문]\n${userText}`
      : userText

    // 현재 선택된 모델과 저장된 API 키 조회
    const [modelRes, keysRes] = await Promise.all([
      chrome.storage.local.get('aurora_model'),
      chrome.storage.local.get('aurora_api_keys'),
    ])
    const model = (modelRes['aurora_model'] as string | undefined) ?? 'gemini-nano'
    const keys  = keysRes['aurora_api_keys'] as { openai?: string; gemini?: string } | undefined

    // ── Gemini Nano (로컬) ────────────────────────────────
    if (model === 'gemini-nano') {
      let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
      try {
        session = await LanguageModel.create({ systemPrompt, expectedInputLanguage: 'ko', outputLanguage: 'ko', temperature: 0.6, topK: 5 })
        const rawResponse = await session.prompt(userPrompt)
        const result = extractResult(rawResponse)
        setContent(result)
        this.addMessageToSession('model', result)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        session?.destroy()
      }
      return
    }

    // ── Cloud AI (Gemini Flash / GPT-4o) ─────────────────
    const isGemini  = model === 'gemini-2.5-flash'
    const provider  = isGemini ? 'gemini' : 'openai'
    const apiKey    = isGemini ? keys?.gemini : keys?.openai

    if (!apiKey) {
      setError(`${isGemini ? 'Gemini' : 'OpenAI'} API 키를 설정에서 입력해주세요.`)
      return
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CALL_CLOUD_AI',
        payload: { provider, model, apiKey, systemPrompt, userPrompt },
      }) as { success: boolean; data?: string; error?: string }

      if (response.success && response.data) {
        const result = extractResult(response.data as string)
        setContent(result)
        this.addMessageToSession('model', result)
      } else {
        setError(response.error ?? '알 수 없는 오류가 발생했습니다.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
      bubble.innerHTML = renderMarkdown(text)
    }

    row.append(avatar, bubble)
    this.chatArea.appendChild(row)
    this.scrollToBottom()

    // 외부에서 내용을 업데이트할 수 있는 함수 반환
    return {
      el: row,
      setContent: (t: string) => {
        bubble.innerHTML = renderMarkdown(t)
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
    document.getElementById('sb-settings')?.classList.remove('active')
    this.chatArea.style.display      = 'flex'
    this.inputFooter.style.display   = 'block'
    this.historyView.style.display   = 'none'
    this.settingsView.style.display  = 'none'
  }

  private showHistoryPanel(): void {
    document.getElementById('sb-history')?.classList.add('active')
    document.getElementById('sb-chat')?.classList.remove('active')
    document.getElementById('sb-settings')?.classList.remove('active')
    this.chatArea.style.display      = 'none'
    this.inputFooter.style.display   = 'none'
    this.historyView.style.display   = 'flex'
    this.settingsView.style.display  = 'none'

    void chrome.storage.local.get('aurora_highlights').then((result) => {
      const highlights: SavedHighlight[] = result['aurora_highlights'] ?? []
      this.renderHistory(highlights)
    })
  }

  private showSettingsPanel(): void {
    document.getElementById('sb-settings')?.classList.add('active')
    document.getElementById('sb-chat')?.classList.remove('active')
    document.getElementById('sb-history')?.classList.remove('active')
    this.chatArea.style.display      = 'none'
    this.inputFooter.style.display   = 'none'
    this.historyView.style.display   = 'none'
    this.settingsView.style.display  = 'flex'

    void chrome.storage.local.get('aurora_api_keys').then((res) => {
      const keys = res['aurora_api_keys'] as { openai?: string; gemini?: string } | undefined
      if (keys?.openai) this.settingsOpenaiInput.value = keys.openai
      if (keys?.gemini) this.settingsGeminiInput.value = keys.gemini
    })
  }

  private async saveApiKeys(): Promise<void> {
    const openai = this.settingsOpenaiInput.value.trim()
    const gemini = this.settingsGeminiInput.value.trim()
    await chrome.storage.local.set({ aurora_api_keys: { openai, gemini } })
    this.settingsSaveBtn.textContent = '✓ 저장됨'
    setTimeout(() => { this.settingsSaveBtn.textContent = '저장' }, 1500)
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

  // ── 코드 블록 복사 버튼 이벤트 위임 ──────────────────────────
  private bindCopyButtons(containerEl: HTMLElement): void {
    containerEl.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      if (!target.classList.contains('aurora-copy-btn')) return
      const code = target.nextElementSibling?.querySelector('code')
      if (!code) return
      try {
        await navigator.clipboard.writeText(code.innerText)
        const orig = target.innerText
        target.innerText     = '✔ 복사됨'
        target.style.color   = '#a6e3a1'
        setTimeout(() => {
          target.innerText   = orig
          target.style.color = '#a6adc8'
        }, 2000)
      } catch { /* clipboard 권한 없음 — 무시 */ }
    })
  }

  private async clearAllHighlights(): Promise<void> {
    await chrome.storage.local.remove('aurora_highlights')
    this.renderHistory([])
  }

  // ── YouTube 영상 요약 자동 실행 ──────────────────────────
  private executeYoutubeSummary(payload: {
    title: string
    channel: string
    description: string
  }): void {
    this.startNewChat()

    const prompt =
      `[유튜브 영상 요약 요청]\n` +
      `- 제목: ${payload.title}\n` +
      `- 채널: ${payload.channel || '(알 수 없음)'}\n` +
      `- 설명: ${payload.description || '(설명 없음)'}\n\n` +
      `위 유튜브 영상의 핵심 내용을 한눈에 보기 쉽게 구조화해서 요약해 줘.`

    // 입력창에 프롬프트를 채우고 즉시 전송
    this.userInput.value = prompt
    this.sendMessage()
  }

  // ── 채팅 세션 히스토리 ───────────────────────────────────

  private async loadSessions(): Promise<void> {
    const res = await chrome.storage.local.get('aurora_chats')
    this.chatSessions = (res['aurora_chats'] as ChatSession[] | undefined) ?? []
  }

  private async saveSessions(): Promise<void> {
    await chrome.storage.local.set({ aurora_chats: this.chatSessions })
  }

  private createNewSession(firstMessage: string): void {
    const session: ChatSession = {
      id:        crypto.randomUUID(),
      title:     firstMessage.slice(0, 30) || '새 대화',
      messages:  [],
      updatedAt: Date.now(),
    }
    this.chatSessions.unshift(session)
    this.currentSessionId = session.id
    void this.saveSessions()
  }

  private addMessageToSession(role: 'user' | 'model', content: string): void {
    if (!this.currentSessionId) {
      this.createNewSession(role === 'user' ? content : '대화')
    }
    const session = this.chatSessions.find(s => s.id === this.currentSessionId)
    if (!session) return
    session.messages.push({ role, content })
    session.updatedAt = Date.now()
    void this.saveSessions()
  }

  private renderSessionList(): void {
    while (this.sessionListEl.firstChild) {
      this.sessionListEl.removeChild(this.sessionListEl.firstChild)
    }

    if (this.chatSessions.length === 0) {
      const empty = document.createElement('li')
      empty.style.cssText = 'padding:16px;text-align:center;color:#6c7086;font-size:13px;'
      empty.textContent = '저장된 대화가 없습니다.'
      this.sessionListEl.appendChild(empty)
      return
    }

    const sorted = [...this.chatSessions].sort((a, b) => b.updatedAt - a.updatedAt)
    for (const session of sorted) {
      const li = document.createElement('li')
      li.className = 'session-item' + (session.id === this.currentSessionId ? ' active' : '')

      const title = document.createElement('div')
      title.className = 'session-title'
      title.textContent = session.title

      const meta = document.createElement('div')
      meta.className = 'session-meta'
      const d = new Date(session.updatedAt)
      meta.textContent = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${session.messages.length}개`

      li.append(title, meta)
      li.addEventListener('click', () => {
        this.historyDrawer.classList.add('hidden')
        this.loadSession(session.id)
      })
      this.sessionListEl.appendChild(li)
    }
  }

  private loadSession(id: string): void {
    const session = this.chatSessions.find(s => s.id === id)
    if (!session) return
    this.currentSessionId = id

    // 채팅 영역 초기화 후 메시지 재렌더링
    while (this.chatArea.firstChild) {
      this.chatArea.removeChild(this.chatArea.firstChild)
    }

    for (const msg of session.messages) {
      if (msg.role === 'user') {
        this.appendUserBubble(msg.content)
      } else {
        this.appendAiBubble(msg.content)
      }
    }

    this.showChatPanel()
  }

  private startNewChat(): void {
    this.currentSessionId = null

    while (this.chatArea.firstChild) {
      this.chatArea.removeChild(this.chatArea.firstChild)
    }

    this.lastContext = null
    this.contextIndicator.textContent = ''
    this.historyDrawer.classList.add('hidden')
    this.appendAiBubble('새 대화를 시작합니다. 웹페이지에서 텍스트를 선택하거나 아래에 질문을 입력하세요.')
    this.showChatPanel()
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
      position: relative; /* history-drawer overlay 기준 */
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

    /* ── 마크다운 렌더링 스타일 (AI 말풍선 내부) ── */
    .bubble-content p { margin-bottom: 8px; line-height: 1.6; }
    .bubble-content p:last-child { margin-bottom: 0; }

    .bubble-content strong,
    .bubble-content b { font-weight: 700; color: #e2e8f0; }

    .bubble-content em,
    .bubble-content i { font-style: italic; color: #cdd6f4; }

    .bubble-content h1, .bubble-content h2, .bubble-content h3,
    .bubble-content h4, .bubble-content h5, .bubble-content h6 {
      font-weight: 700;
      color: #e2e8f0;
      margin: 10px 0 4px;
      line-height: 1.3;
    }
    .bubble-content h1 { font-size: 15px; }
    .bubble-content h2 { font-size: 14px; }
    .bubble-content h3 { font-size: 13px; }

    .bubble-content ul,
    .bubble-content ol {
      padding-left: 1.4em;
      margin: 6px 0;
    }
    .bubble-content li { margin-bottom: 4px; line-height: 1.6; }

    .bubble-content blockquote {
      border-left: 3px solid #8b5cf6;
      margin: 8px 0;
      padding: 4px 10px;
      color: #a6adc8;
      background: #0f111a;
      border-radius: 0 4px 4px 0;
    }

    /* 인라인 코드 */
    .bubble-content code {
      background: #181825;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 12px;
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      color: #cba6f7;
    }

    /* 코드 블록 */
    .bubble-content pre {
      background: #181825;
      border-radius: 8px;
      padding: 12px 14px;
      margin: 8px 0;
      overflow-x: auto;
      border: 1px solid #2d2f45;
    }
    .bubble-content pre code {
      background: transparent;
      padding: 0;
      font-size: 12px;
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      color: inherit;
    }

    /* highlight.js github-dark 테마 투명화 버그 강제 차단 */
    pre code.hljs, pre code {
      color: #cdd6f4 !important;
      background: transparent !important;
      display: block;
      text-shadow: none;
    }

    .bubble-content hr {
      border: none;
      border-top: 1px solid #2d2f45;
      margin: 10px 0;
    }

    .bubble-content a {
      color: #89b4fa;
      text-decoration: underline;
    }

    .bubble-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
      font-size: 12px;
    }
    .bubble-content th,
    .bubble-content td {
      border: 1px solid #2d2f45;
      padding: 5px 10px;
      text-align: left;
    }
    .bubble-content th { background: #0f111a; color: #a78bfa; font-weight: 600; }

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

    /* ── 페이지 컨텍스트 토글 ── */
    #page-context-toggle {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #6c7086;
      font-size: 11px;
      margin-bottom: 7px;
      cursor: pointer;
      user-select: none;
      transition: color 0.15s;
    }

    #page-context-toggle:hover { color: #a6adc8; }

    #page-context-toggle input[type="checkbox"] {
      accent-color: #8b5cf6;
      cursor: pointer;
      width: 12px;
      height: 12px;
    }

    #page-context-toggle.active { color: #a78bfa; }

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

    /* ═══════════════════════════════════════════
       설정 뷰
    ═══════════════════════════════════════════ */
    #settings-view {
      flex: 1;
      flex-direction: column;
      overflow: hidden;
    }

    .settings-header {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      border-bottom: 1px solid #2d2f45;
      background: #141625;
      flex-shrink: 0;
    }

    .settings-title {
      font-size: 13px;
      font-weight: 600;
      color: #cdd6f4;
    }

    .settings-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .settings-body::-webkit-scrollbar { width: 4px; }
    .settings-body::-webkit-scrollbar-track { background: transparent; }
    .settings-body::-webkit-scrollbar-thumb { background: #2d2f45; border-radius: 2px; }

    .settings-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .settings-section-title {
      font-size: 11px;
      font-weight: 700;
      color: #6c7086;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .settings-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .settings-label {
      font-size: 12px;
      color: #a6adc8;
      font-weight: 500;
    }

    .settings-input {
      background: #0f111a;
      border: 1px solid #2d2f45;
      border-radius: 8px;
      color: #cdd6f4;
      font-size: 12px;
      font-family: system-ui, sans-serif;
      padding: 9px 12px;
      outline: none;
      transition: border-color 0.15s;
      width: 100%;
    }

    .settings-input:focus { border-color: #7c3aed; }
    .settings-input::placeholder { color: #45475a; }

    .settings-hint {
      font-size: 11px;
      color: #45475a;
      line-height: 1.5;
    }

    .settings-save-btn {
      background: linear-gradient(135deg, #7c3aed, #db2777);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 20px;
      cursor: pointer;
      transition: opacity 0.15s;
      align-self: flex-start;
    }

    .settings-save-btn:hover { opacity: 0.85; }

    /* ═══════════════════════════════════════════
       헤더 아이콘 버튼 (새 채팅 / 대화 기록)
    ═══════════════════════════════════════════ */
    .header-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .icon-btn {
      background: transparent;
      border: 1px solid #2d2f45;
      border-radius: 6px;
      color: #6c7086;
      font-size: 13px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }

    .icon-btn:hover {
      background: #2d2f45;
      color: #cdd6f4;
      border-color: #4c4f6b;
    }

    /* ═══════════════════════════════════════════
       대화 기록 드로어 (채팅 영역 위 오버레이)
    ═══════════════════════════════════════════ */
    .history-drawer {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #0f111a;
      z-index: 20;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .history-drawer.hidden { display: none; }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid #2d2f45;
      background: #141625;
      flex-shrink: 0;
    }

    .drawer-title {
      font-size: 13px;
      font-weight: 600;
      color: #cdd6f4;
    }

    .drawer-close {
      background: transparent;
      border: none;
      color: #6c7086;
      font-size: 18px;
      line-height: 1;
      padding: 0 4px;
      cursor: pointer;
    }

    .drawer-close:hover { color: #cdd6f4; }

    .session-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .session-list::-webkit-scrollbar { width: 4px; }
    .session-list::-webkit-scrollbar-track { background: transparent; }
    .session-list::-webkit-scrollbar-thumb { background: #2d2f45; border-radius: 2px; }

    .session-item {
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
      border: 1px solid transparent;
      transition: background 0.12s, border-color 0.12s;
    }

    .session-item:hover { background: #1e2035; border-color: #2d2f45; }

    .session-item.active {
      background: rgba(139,92,246,0.12);
      border-color: rgba(139,92,246,0.3);
    }

    .session-title {
      font-size: 13px;
      color: #cdd6f4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .session-meta {
      font-size: 11px;
      color: #45475a;
    }

    .session-empty {
      text-align: center;
      color: #45475a;
      font-size: 13px;
      padding: 40px 20px;
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

      <!-- 우측: 모델 선택 + 버튼 그룹 -->
      <div class="header-right">
        <select class="model-select">
          <option value="gemini-nano">Gemini Nano (Local)</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gpt-4o">GPT-4o</option>
        </select>
        <button class="icon-btn" id="new-chat-btn" title="새 채팅">✨</button>
        <button class="icon-btn" id="history-btn" title="대화 기록">🕒</button>
      </div>
    </header>

    <!-- 채팅 영역 (JS로 말풍선 주입) -->
    <div class="chat-area" id="chat-area">
      <!-- 빈 상태 (JS에서 처음 AI 환영 메시지가 여기 들어감) -->
    </div>

    <!-- 대화 기록 드로어 (채팅 영역 위 오버레이) -->
    <div id="history-drawer" class="history-drawer hidden">
      <div class="drawer-header">
        <span class="drawer-title">대화 기록</span>
        <button class="drawer-close" id="close-drawer-btn" title="닫기">✕</button>
      </div>
      <ul id="session-list" class="session-list"></ul>
    </div>

    <!-- 하이라이트 히스토리 뷰 (JS에서 show/hide) -->
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

    <!-- 설정 뷰 (JS에서 show/hide) -->
    <div id="settings-view" style="display: none;">
      <div class="settings-header">
        <span class="settings-title">설정</span>
      </div>
      <div class="settings-body">
        <div class="settings-section">
          <div class="settings-section-title">API 키</div>

          <div class="settings-field">
            <label class="settings-label" for="settings-openai-key">OpenAI API Key</label>
            <input
              class="settings-input"
              type="password"
              id="settings-openai-key"
              placeholder="sk-..."
              autocomplete="off"
            />
            <span class="settings-hint">GPT-4o 등 OpenAI 모델 사용 시 필요합니다.</span>
          </div>

          <div class="settings-field">
            <label class="settings-label" for="settings-gemini-key">Gemini API Key</label>
            <input
              class="settings-input"
              type="password"
              id="settings-gemini-key"
              placeholder="AIza..."
              autocomplete="off"
            />
            <span class="settings-hint">Gemini 2.5 Flash 등 클라우드 Gemini 모델 사용 시 필요합니다.</span>
          </div>

          <button class="settings-save-btn" id="settings-save-btn">저장</button>
        </div>
      </div>
    </div>

    <!-- 입력 영역 -->
    <div class="input-footer" id="input-footer">
      <label id="page-context-toggle">
        <input type="checkbox" id="use-page-context">
        📄 현재 페이지 컨텍스트 포함
      </label>
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
