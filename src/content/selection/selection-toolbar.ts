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
