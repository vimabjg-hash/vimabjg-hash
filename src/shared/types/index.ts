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
