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
  refine:    `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1-8.313-12.454z"/><path d="M17 4a2 2 0 0 0 4 0 2 2 0 0 0-4 0"/><path d="M19 17l2 2 4-4"/></svg>`,
  more:      `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
  aurora:    `<svg viewBox="0 0 100 100" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ag-tb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><path d="M20 80L50 20L80 80" stroke="url(#ag-tb)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 80L50 50L65 80" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/><path d="M10 85C30 75 70 75 90 85" stroke="url(#ag-tb)" stroke-width="3" stroke-linecap="round" opacity="0.8"/></svg>`,
}

type ActionCategory = 'read' | 'write' | 'common'
interface ActionDef { action: ToolbarAction; label: string; readMode: boolean; writeMode: boolean; category: ActionCategory }

const ACTIONS: ActionDef[] = [
  { action: 'translate', label: '번역',           readMode: true,  writeMode: true,  category: 'common' },
  { action: 'summarize', label: '요약',           readMode: true,  writeMode: false, category: 'read'   },
  { action: 'save',      label: '저장',           readMode: true,  writeMode: true,  category: 'common' },
  { action: 'grammar',   label: '문법/맞춤법',    readMode: false, writeMode: true,  category: 'write'  },
  { action: 'shorter',   label: '짧게',           readMode: false, writeMode: true,  category: 'write'  },
  { action: 'longer',    label: '길게',           readMode: false, writeMode: true,  category: 'write'  },
  { action: 'tone',      label: '톤 변경',        readMode: false, writeMode: true,  category: 'write'  },
  { action: 'refine',   label: '✨다듬기',        readMode: false, writeMode: true,  category: 'write'  },
  { action: 'draft',     label: '생각 담기',       readMode: true,  writeMode: true,  category: 'write'  },
  { action: 'ask',       label: '질문',           readMode: true,  writeMode: true,  category: 'common' },
  { action: 'copy',      label: '복사',           readMode: true,  writeMode: true,  category: 'common' },
  { action: 'highlight', label: '하이라이트',     readMode: true,  writeMode: false, category: 'read'   },
]

const DEFAULT_PINNED = ['translate', 'summarize', 'save', 'grammar', 'refine', 'draft', 'ask']

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
