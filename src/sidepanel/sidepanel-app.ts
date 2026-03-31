import type { ToolbarAction, SavedHighlight } from '../shared/types'
import { renderMarkdown } from '../shared/utils/markdown'
import { createNanoSession } from '../shared/utils/nano'

// ── 채팅 세션 ──────────────────────────────────────────────
interface ChatSession {
  id: string
  title: string
  messages: { role: 'user' | 'model'; content: string }[]
  updatedAt: number
}

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
  grammar:   '문법/맞춤법',
  draft:     '생각 담기',
  refine:    '다듬기',
  ask:       '질문',
  save:      '저장',
  shorter:   '짧게',
  longer:    '길게',
  tone:      '톤 변경',
  copy:      '복사',
  highlight: '하이라이트',
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

    // 사이드바 토글 버튼
    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
      const slim = document.querySelector<HTMLElement>('.slim-sidebar')
      const main = document.querySelector<HTMLElement>('.main-panel')
      if (!slim || !main) return
      const isHidden = slim.style.display === 'none'
      slim.style.display      = isHidden ? 'flex'  : 'none'
      main.style.borderRadius = isHidden ? '0 12px 12px 0' : '12px'
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
    const sel = document.getElementById('model-select-bottom') as HTMLSelectElement | null
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

    // 클라우드 AI용 시스템 프롬프트 (createNanoSession 내부에서 처리하므로 Nano는 불필요)
    const systemPrompt = '당신은 도움이 되는 AI 어시스턴트입니다. 반드시 한국어로 답변하세요. 간결하고 명확하게 답하세요.'

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
      let session: Awaited<ReturnType<typeof createNanoSession>> | null = null
      try {
        session = await createNanoSession()
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