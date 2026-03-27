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
