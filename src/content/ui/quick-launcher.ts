// ── Aurora: Quick Launcher (Spotlight-style) ─────────────────
// Alt+J 로 호출하는 전역 AI 검색 론처
import { renderMarkdown } from '../../shared/utils/markdown'
import { NANO_SYSTEM_PROMPT_KO, buildKoreanCapsulePrompt } from '../../shared/utils/nano'

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
      display:        'flex',
      justifyContent: 'space-between',
      alignItems:     'center',
      padding:        '8px 12px',
      background:     '#181825',
      borderBottom:   '1px solid #313244',
      borderRadius:   '12px 12px 0 0',
      flexShrink:     '0',
      userSelect:     'none',
    })

    // 드래그 전용 핸들 (좌측)
    const dragHandle = document.createElement('div')
    dragHandle.title = '드래그로 이동'
    Object.assign(dragHandle.style, {
      display:      'flex',
      alignItems:   'center',
      gap:          '6px',
      flex:         '1',
      cursor:       'grab',
      paddingRight: '8px',
      minWidth:     '0',
    })
    const dragDots = document.createElement('span')
    dragDots.textContent = '⠿'
    Object.assign(dragDots.style, {
      color:         '#585b70',
      fontSize:      '14px',
      flexShrink:    '0',
      pointerEvents: 'none',
    })
    const dragLabel = document.createElement('span')
    dragLabel.textContent = 'Aurora 론처'
    Object.assign(dragLabel.style, {
      color:         '#a6adc8',
      fontSize:      '12px',
      pointerEvents: 'none',
      overflow:      'hidden',
      textOverflow:  'ellipsis',
      whiteSpace:    'nowrap',
    })
    dragHandle.append(dragDots, dragLabel)

    // 닫기 버튼 (클릭 전용 — 드래그 영역과 분리)
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕'
    Object.assign(closeBtn.style, {
      background:    'none',
      border:        'none',
      color:         '#f38ba8',
      fontSize:      '16px',
      cursor:        'pointer',
      padding:       '2px 6px',
      lineHeight:    '1',
      borderRadius:  '4px',
      flexShrink:    '0',
      pointerEvents: 'auto',
      zIndex:        '10',
    })
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = '#313244' })
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'none' })
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      this.hide()
    })

    headerEl.append(dragHandle, closeBtn)

    // ── 드래그 이동 로직 (dragHandle에만 적용) ──────────────
    let isDragging = false
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0

    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true
      dragHandle.style.cursor = 'grabbing'
      startX = e.clientX
      startY = e.clientY
      const rect = container.getBoundingClientRect()
      initialLeft = rect.left
      initialTop  = rect.top
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      container.style.left = `${initialLeft + e.clientX - startX}px`
      container.style.top  = `${initialTop  + e.clientY - startY}px`
    })

    document.addEventListener('mouseup', () => {
      if (!isDragging) return
      isDragging = false
      dragHandle.style.cursor = 'grab'
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
        let session: { prompt(input: string): Promise<string>; destroy(): void } | null = null
        try {
          // 방법 1: LanguageModel global (Chrome 146+ sidepanel/content 공용)
          const LM = (window as unknown as { LanguageModel?: { create(opts?: Record<string, unknown>): Promise<{ prompt(input: string): Promise<string>; destroy(): void }> } }).LanguageModel
          if (!LM) throw new Error('LanguageModel not available')

          session = await LM.create({
            systemPrompt:    NANO_SYSTEM_PROMPT_KO,
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
            temperature:     0.6,
            topK:            5,
          })
          const taskPrompt = buildKoreanCapsulePrompt(
            query,
            'Answer the user question helpfully and concisely.'
          )
          const raw   = await session.prompt(taskPrompt)
          const clean = raw.replace(/\[\/?\s*RESULT\s*\]/gi, '').trim()
          this.resultEl.style.color   = '#cdd6f4'
          this.resultEl.style.display = 'block'
          this.resultEl.innerHTML     = renderMarkdown(clean)
        } catch {
          // 방법 2: window.ai.languageModel 폴백 (구버전 API)
          const nanoAI = getNanoAI()
          if (!nanoAI) {
            const msg = '⚠️ Gemini Nano를 현재 페이지에서 사용할 수 없습니다.\n' +
                        'Aurora 사이드패널(우측 버튼)을 이용하거나 모델을 변경해 주세요.'
            this.resultEl.style.color   = '#f38ba8'
            this.resultEl.style.display = 'block'
            this.resultEl.innerHTML     = renderMarkdown(msg)
            return
          }
          try {
            session = await nanoAI.create({
              systemPrompt:    NANO_SYSTEM_PROMPT_KO,
              expectedOutputs: [{ type: 'text', languages: ['en'] }],
              temperature:     0.6,
              topK:            5,
            })
            const taskPrompt = buildKoreanCapsulePrompt(
              query,
              'Answer the user question helpfully and concisely.'
            )
            const raw   = await session.prompt(taskPrompt)
            const clean = raw.replace(/\[\/?\s*RESULT\s*\]/gi, '').trim()
            this.resultEl.style.color   = '#cdd6f4'
            this.resultEl.style.display = 'block'
            this.resultEl.innerHTML     = renderMarkdown(clean)
          } catch {
            const msg = '⚠️ Gemini Nano 호출 실패. 사이드패널을 이용하거나 다른 모델을 선택해 주세요.'
            this.resultEl.style.color   = '#f38ba8'
            this.resultEl.style.display = 'block'
            this.resultEl.innerHTML     = renderMarkdown(msg)
          } finally {
            session?.destroy()
          }
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
