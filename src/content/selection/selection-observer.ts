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
