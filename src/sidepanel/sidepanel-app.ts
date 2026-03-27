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