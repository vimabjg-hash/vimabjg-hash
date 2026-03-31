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
