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
