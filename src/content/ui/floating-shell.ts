import type { ToolbarAction, SourceMeta } from '../../shared/types'
import type { SelectionInfo } from '../selection/selection-observer'
import { renderMarkdown } from '../../shared/utils/markdown'
import { createNanoSession, buildKoreanCapsulePrompt, buildRefinePrompt, buildTranslatePrompt } from '../../shared/utils/nano'

// ── 패널 크기 상수 ───────────────────────────────────────────
const DEFAULT_W = 560
const DEFAULT_H = 520
const MIN_W     = 420
const MIN_H     = 340

// ── 액션 아이콘 / 라벨 ───────────────────────────────────────
const ACTION_ICONS: Partial<Record<ToolbarAction, string>> = {
  translate: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  summarize: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  grammar:   `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><path d="m15 5 3 3"/></svg>`,
  draft:     `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  ask:       `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  shorter:   `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/></svg>`,
  longer:    `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  tone:      `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  refine:    `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1-8.313-12.454z"/><path d="M17 4a2 2 0 0 0 4 0 2 2 0 0 0-4 0"/></svg>`,
  save:      `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
}

const ACTION_LABELS: Record<ToolbarAction, string> = {
  translate: '번역', summarize: '요약', grammar: '문법/맞춤법', draft: '생각 담기',
  ask: '질문', save: '저장', shorter: '짧게', longer: '길게', tone: '톤 변경',
  copy: '복사', highlight: '하이라이트', refine: '✨ 다듬기',
}

// AI 실행 가능한 액션 (save/draft는 별도 처리)
type AiAction = 'translate' | 'summarize' | 'grammar' | 'ask' | 'shorter' | 'longer' | 'tone' | 'refine'

const SYSTEM_PROMPTS: Record<AiAction, string> = {
  translate: '당신은 번역가입니다. 텍스트를 한국어로 번역하세요.',
  summarize: '당신은 요약 전문가입니다. 텍스트의 핵심을 간결하게 요약하세요.',
  grammar:   '당신은 교열 전문가입니다. 오직 문법과 맞춤법만 교정하세요. 절대 존댓말을 쓰지 말고, 반드시 \'~다\', \'~어/아\'로 끝나는 반말로 작성하세요.',
  ask:       '당신은 AI 어시스턴트입니다. 텍스트에 대한 유용한 정보를 제공하세요.',
  shorter:   '당신은 편집자입니다. 텍스트를 의미를 유지하며 절반 이하로 짧게 줄이세요.',
  longer:    '당신은 작가입니다. 텍스트의 핵심을 살려 더 상세하고 풍부하게 늘려 쓰세요.',
  tone:      '당신은 어조 변환기입니다. 원문의 의미와 길이를 100% 똑같이 유지하면서, 오직 문장의 끝맺음만 \'~요\', \'~습니다\' 형태의 정중한 존댓말로 바꾸세요.',
}

const USER_PROMPTS: Record<AiAction, (t: string) => string> = {
  translate: (t) => `다음 <text> 안의 내용을 한국어로 번역해라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  summarize: (t) => `다음 <text> 안의 내용을 핵심만 간결하게 요약해라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  grammar:   (t) => `다음 <text> 안의 내용에서 문법과 맞춤법만 교정해라. 절대 존댓말 금지, 반드시 반말(~다/~어/아체)로 출력해라.\n<text>\n${t}\n</text>\n\n오직 교정된 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  ask:       (t) => `다음 <text> 에 대해 유용한 정보를 한국어로 설명해라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  shorter:   (t) => `다음 <text> 안의 내용을 의미를 유지하며 절반 이하로 짧게 줄여라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  longer:    (t) => `다음 <text> 안의 내용을 핵심을 살려 더 상세하고 풍부하게 늘려 써라.\n<text>\n${t}\n</text>\n\n오직 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  tone:      (t) => `다음 <text> 안의 내용에서 문장 끝맺음만 '~요'/'~습니다' 존댓말로 바꿔라. 의미/길이/내용은 절대 변경 금지.\n<text>\n${t}\n</text>\n\n오직 변환된 결과만 [RESULT] 태그 안에 출력해:\n[RESULT]`,
  refine:    (t) => buildRefinePrompt(t),
}

const TASK_MAP: Record<AiAction, string> = {
  translate: "Translate the text to Korean. Output only the Korean translation.",
  summarize: "Summarize the key points of the text concisely in 2-3 sentences.",
  grammar:   "Fix only grammar and spelling errors. Keep the original style. Use informal Korean (~다/~어 endings, no honorifics).",
  ask:       "Explain the text and provide helpful information about it.",
  shorter:   "Shorten the text to half its length while keeping the core meaning.",
  longer:    "Expand the text with more detail and richer expression while keeping the core meaning.",
  tone:      "Change the sentence endings to polite honorific Korean (~요/~습니다). Keep the exact same meaning and length.",
  refine:    "Refine and polish the Korean text. Fix awkward phrasing, grammar errors, and unclear expressions. Keep the original meaning and tone.",
}

// ── FloatingShell ─────────────────────────────────────────────

export class FloatingShell {
  private readonly el!:              HTMLDivElement
  private readonly loadingEl!:       HTMLElement
  private readonly resultEl!:        HTMLElement
  private readonly statusEl!:        HTMLElement
  private readonly copyBtn!:         HTMLButtonElement
  private readonly replaceBtn!:      HTMLButtonElement
  private readonly retryBtn!:        HTMLButtonElement
  private readonly panelBtn!:        HTMLButtonElement
  private readonly translateBtn!:    HTMLButtonElement
  private readonly followUpInput!:   HTMLTextAreaElement
  private readonly actionLabelEl!:   HTMLElement
  private readonly actionIconEl!:    HTMLElement
  private readonly modelSelectEl!:    HTMLSelectElement
  private readonly transLangSelectEl!: HTMLSelectElement
  private readonly paginationEl!:    HTMLDivElement
  private currentAction: ToolbarAction
  private readonly sourceText!: string
  private readonly sourceMeta!: SourceMeta
  private resultText = ''
  private resultHistory: string[] = []
  private historyIndex: number = -1

  constructor(action: ToolbarAction, info: SelectionInfo) {
    this.currentAction = action
    this.sourceText    = info.text
    this.sourceMeta    = info.sourceMeta

    if (!info.text.trim()) { console.error('[AURORA] FloatingShell: empty sourceText'); return }

    this.injectStyle()

    const built = this.buildEl(action, info.text)
    this.el              = built.el
    this.loadingEl       = built.loadingEl
    this.resultEl        = built.resultEl
    this.statusEl        = built.statusEl
    this.copyBtn         = built.copyBtn
    this.replaceBtn      = built.replaceBtn
    this.retryBtn        = built.retryBtn
    this.panelBtn        = built.panelBtn
    this.translateBtn    = built.translateBtn
    this.followUpInput   = built.followUpInput
    this.actionLabelEl   = built.actionLabelEl
    this.actionIconEl    = built.actionIconEl
    this.modelSelectEl      = built.modelSelectEl
    this.transLangSelectEl  = built.transLangSelectEl
    this.paginationEl       = built.paginationEl
    if (action === 'translate') this.transLangSelectEl.style.display = 'inline-block'

    document.getElementById('aurora-shell')?.remove()
    document.body.appendChild(this.el)

    // 크기 복원 (비동기 — 이미 DOM에 있으므로 안전)
    void chrome.storage.local.get('aurora_shell_size').then((res) => {
      const saved = res['aurora_shell_size'] as { w: number; h: number } | undefined
      if (saved?.w && saved?.h) {
        const w = Math.max(MIN_W, Math.min(saved.w, window.innerWidth  - 16))
        const h = Math.max(MIN_H, Math.min(saved.h, window.innerHeight - 16))
        this.el.style.width  = `${w}px`
        this.el.style.height = `${h}px`
      }
    })

    if (action === 'translate') {
      this.translateBtn.style.display    = 'inline-flex'
      this.transLangSelectEl.style.display = 'inline-block'
    }

    this.position(info.rect)
    this.initDrag(built.dragHandle)
    this.initResize(built.resizeHandle)
    this.bindCopyButtons()

    if (action === 'refine') {
      void this.runRefineAction(this.sourceText)
    } else if (action === 'draft' || action === 'translate') {
      void Promise.resolve().then(() => this.showResult(this.sourceText))
    } else if (action !== 'save' && action !== 'highlight' && action !== 'copy') {
      void this.runAction(
        SYSTEM_PROMPTS[action as AiAction] ?? '',
        USER_PROMPTS[action as AiAction]?.(this.sourceText) ?? '',
      )
    }
  }

  private switchAction(action: ToolbarAction): void {
    this.currentAction = action
    this.actionIconEl.innerHTML    = ACTION_ICONS[action] ?? ''
    this.actionLabelEl.textContent = ACTION_LABELS[action]
    this.transLangSelectEl.style.display = action === 'translate' ? 'inline-block' : 'none'
    this.translateBtn.style.display      = action === 'translate' ? 'inline-flex' : 'none'
    if (action === 'refine') { void this.runRefineAction(this.resultText || this.sourceText); return }
    if (action === 'draft' || action === 'translate') { this.showResult(this.sourceText); return }
    if (action === 'save') {
      this.showResult(this.sourceText)
      void this.saveToHighlightHistory(this.sourceText)
      return
    }
    if (action !== 'save') {
      // 연쇄(Chaining): 이전 AI 결과가 있으면 그것을 다음 작업의 입력으로 사용
      const inputText = this.resultText || this.sourceText
      void this.runAction(
        SYSTEM_PROMPTS[action as AiAction] ?? '',
        USER_PROMPTS[action as AiAction]?.(inputText) ?? '',
      )
    }
  }

  // ── AI 실행 ──────────────────────────────────────────────

  private async runAction(systemPrompt: string, userPrompt: string): Promise<void> {
    if (this.currentAction === 'draft') { this.showResult(this.sourceText); return }
    const effectiveUserPrompt = this.currentAction === 'translate'
      ? userPrompt + `\n\n(목표 번역 언어: ${this.transLangSelectEl.value})`
      : userPrompt
    this.retryBtn.disabled         = true
    this.retryBtn.style.opacity    = '0.4'
    this.loadingEl.style.display   = 'flex'
    this.resultEl.style.display    = 'none'
    this.followUpInput.disabled    = true

    const selectedModel = this.modelSelectEl.value
    const modelName     = this.modelSelectEl.options[this.modelSelectEl.selectedIndex].text
    this.statusEl.textContent = `${modelName.toUpperCase()} 처리 중...`
    this.statusEl.style.color = '#6c7086'

    // ── Cloud AI (gemini-nano 외) ─────────────────────────
    if (selectedModel !== 'gemini-nano') {
      const keysRes = await chrome.storage.local.get('aurora_api_keys')
      const keys    = keysRes['aurora_api_keys'] as { openai?: string; gemini?: string } | undefined
      const isGemini = !selectedModel.startsWith('gpt')
      const provider  = isGemini ? 'gemini' : 'openai'
      const apiKey    = isGemini ? keys?.gemini : keys?.openai

      if (!apiKey) {
        this.showError(`${modelName} API 키가 없습니다. 패널 설정에서 등록해주세요.`)
        return
      }
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CALL_CLOUD_AI',
          payload: { provider, model: selectedModel, apiKey, systemPrompt, userPrompt: effectiveUserPrompt },
        }) as { success: boolean; data?: string; error?: string }
        if (response.success && response.data) { this.showResult(response.data) }
        else { this.showError(response.error ?? '알 수 없는 오류가 발생했습니다.') }
      } catch (err) {
        this.showError(err instanceof Error ? err.message : String(err))
      }
      return
    }

    // ── Gemini Nano (로컬) ────────────────────────────────
    let session: Awaited<ReturnType<typeof createNanoSession>> | null = null
    try {
      session = await createNanoSession()
      let rawResponse: string
      if (this.currentAction === 'translate') {
        const targetLang = this.transLangSelectEl.value
        rawResponse = await session.prompt(buildTranslatePrompt(this.sourceText, targetLang))
      } else if (this.currentAction === 'refine') {
        rawResponse = await session.prompt(buildRefinePrompt(this.sourceText))
      } else {
        const taskDesc = TASK_MAP[this.currentAction as AiAction] ?? 'Process the text as instructed'
        rawResponse = await session.prompt(buildKoreanCapsulePrompt(this.sourceText, taskDesc))
      }
      let result = extractResult(rawResponse)
      if (needsCorrection(this.sourceText, result)) {
        result = extractResult(await session.prompt(
          'ERROR: 인칭이 바뀌었어. 나/내/너/네를 사용해서 [RESULT] 태그 안에 다시 출력해.\n[RESULT]'
        ))
      }
      this.showResult(result)
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err))
    } finally {
      session?.destroy()
    }
  }

  private async runFollowUp(userPrompt: string): Promise<void> {
    this.retryBtn.disabled         = true
    this.retryBtn.style.opacity    = '0.4'
    this.loadingEl.style.display   = 'flex'
    this.resultEl.style.display    = 'none'
    this.followUpInput.disabled    = true

    const selectedModel = this.modelSelectEl.value
    const modelName     = this.modelSelectEl.options[this.modelSelectEl.selectedIndex].text
    this.statusEl.textContent = `${modelName.toUpperCase()} 처리 중...`
    this.statusEl.style.color = '#6c7086'

    const sysP = '당신은 도움이 되는 AI 어시스턴트입니다. 반드시 한국어로 답변하세요.'
    const ctx  =
      `[원문]\n"${this.sourceText}"\n\n` +
      `[이전 결과]\n"${this.resultText}"\n\n` +
      `[추가 질문]\n${userPrompt}\n\n` +
      '오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'

    // ── Cloud AI (gemini-nano 외) ─────────────────────────
    if (selectedModel !== 'gemini-nano') {
      const keysRes = await chrome.storage.local.get('aurora_api_keys')
      const keys    = keysRes['aurora_api_keys'] as { openai?: string; gemini?: string } | undefined
      const isGemini = !selectedModel.startsWith('gpt')
      const provider  = isGemini ? 'gemini' : 'openai'
      const apiKey    = isGemini ? keys?.gemini : keys?.openai

      if (!apiKey) {
        this.showError(`${modelName} API 키가 없습니다. 패널 설정에서 등록해주세요.`)
        this.followUpInput.disabled = false
        return
      }
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CALL_CLOUD_AI',
          payload: { provider, model: selectedModel, apiKey, systemPrompt: sysP, userPrompt: ctx },
        }) as { success: boolean; data?: string; error?: string }
        if (response.success && response.data) { this.showResult(response.data) }
        else { this.showError(response.error ?? '알 수 없는 오류가 발생했습니다.') }
      } catch (err) {
        this.showError(err instanceof Error ? err.message : String(err))
      } finally {
        this.followUpInput.disabled = false
      }
      return
    }

    // ── Gemini Nano (로컬) ────────────────────────────────
    let session: Awaited<ReturnType<typeof createNanoSession>> | null = null
    try {
      session = await createNanoSession()
      const raw = await session.prompt(ctx)
      let result = extractResult(raw)
      if (needsCorrection(this.sourceText, result)) {
        result = extractResult(await session.prompt(
          "[ERROR] 인칭이 바뀌었어. '저/제'를 다시 '나/내'로 고쳐서 [RESULT] 태그 안에 다시 출력해."
        ))
      }
      this.showResult(result)
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err))
    } finally {
      session?.destroy()
      this.followUpInput.disabled = false
    }
  }

  private async runRefineAction(inputText: string): Promise<void> {
    this.loadingEl.style.display = 'flex'
    this.resultEl.style.display  = 'none'
    let session: Awaited<ReturnType<typeof createNanoSession>> | null = null
    try {
      session = await createNanoSession()
      const prompt = buildRefinePrompt(inputText)
      const raw = await session.prompt(prompt)
      this.showResult(extractResult(raw))
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err))
    } finally {
      session?.destroy()
      this.loadingEl.style.display = 'none'
    }
  }

  private async runTranslateAction(targetLang: string): Promise<void> {
    this.retryBtn.disabled       = true
    this.retryBtn.style.opacity  = '0.4'
    this.loadingEl.style.display = 'flex'
    this.resultEl.style.display  = 'none'
    this.followUpInput.disabled  = true
    this.statusEl.textContent    = '번역 중...'
    this.statusEl.style.color    = '#6c7086'

    const selectedModel = this.modelSelectEl.value

    if (selectedModel !== 'gemini-nano') {
      const keysRes = await chrome.storage.local.get('aurora_api_keys')
      const keys    = keysRes['aurora_api_keys'] as { openai?: string; gemini?: string } | undefined
      const isGemini = !selectedModel.startsWith('gpt')
      const provider  = isGemini ? 'gemini' : 'openai'
      const apiKey    = isGemini ? keys?.gemini : keys?.openai
      if (!apiKey) { this.showError('API 키가 없습니다.'); return }
      const sysP = 'You are a professional translator. Detect and preserve the speech level (formal/informal) of the source text in your translation.'
      const userP =
        `Translate the following text to ${targetLang === '자동 감지' ? 'the most appropriate language (Korean↔English auto-swap)' : targetLang}.\n` +
        `PRESERVE speech level: if source is informal (반말), translate informally. If formal (존댓말), translate formally.\n\n` +
        `Text:\n${this.sourceText}\n\n` +
        `Output ONLY the translation:`
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CALL_CLOUD_AI',
          payload: { provider, model: selectedModel, apiKey, systemPrompt: sysP, userPrompt: userP },
        }) as { success: boolean; data?: string; error?: string }
        if (response.success && response.data) { this.showResult(response.data as string) }
        else { this.showError(response.error ?? '오류') }
      } catch (err) {
        this.showError(err instanceof Error ? err.message : String(err))
      }
      return
    }

    // Nano
    let session: Awaited<ReturnType<typeof createNanoSession>> | null = null
    try {
      session = await createNanoSession()
      const raw = await session.prompt(buildTranslatePrompt(this.sourceText, targetLang))
      this.showResult(extractResult(raw))
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err))
    } finally {
      session?.destroy()
    }
  }

  private async saveToHighlightHistory(text: string): Promise<void> {
    if (!text.trim()) return
    try {
      const result = await chrome.storage.local.get('aurora_highlights')
      const highlights: { id: string; text: string; url: string; title: string; timestamp: number }[] =
        result['aurora_highlights'] ?? []
      highlights.unshift({
        id:        crypto.randomUUID(),
        text:      text.trim(),
        url:       window.location.href,
        title:     document.title,
        timestamp: Date.now(),
      })
      await chrome.storage.local.set({ aurora_highlights: highlights })
      this.statusEl.textContent = '✓ 히스토리에 저장됨'
      this.statusEl.style.color = '#a6e3a1'
      setTimeout(() => {
        this.statusEl.textContent = ''
        this.statusEl.style.color = ''
      }, 2000)
    } catch (err) {
      console.error('[Aurora] 저장 실패:', err)
    }
  }

  // ── 결과 / 에러 표시 ─────────────────────────────────────

  private showResult(text: string): void {
    this.resultText = sanitizeResult(text)
    if (this.resultHistory[this.resultHistory.length - 1] !== this.resultText) {
      this.resultHistory.push(this.resultText)
    }
    this.historyIndex = this.resultHistory.length - 1
    this.loadingEl.style.display  = 'none'
    this.resultEl.style.display   = 'block'
    this.resultEl.style.color     = '#cdd6f4'
    this.resultEl.innerHTML       = renderMarkdown(this.resultText)
    this.statusEl.textContent     = `${this.modelSelectEl.options[this.modelSelectEl.selectedIndex].text} 응답 완료`
    this.statusEl.style.color     = '#a6e3a1'
    this.copyBtn.disabled         = false
    this.replaceBtn.disabled      = false
    this.retryBtn.disabled        = false
    this.panelBtn.disabled        = false
    this.copyBtn.style.opacity    = '1'
    this.replaceBtn.style.opacity = '1'
    this.retryBtn.style.opacity   = '1'
    this.panelBtn.style.opacity   = '1'
    this.followUpInput.disabled   = false
    this.updatePaginationUI()
  }

  private bindCopyButtons(): void {
    this.el.addEventListener('click', async (e) => {
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

  private showError(error: string): void {
    this.loadingEl.style.display  = 'none'
    this.resultEl.style.display   = 'block'
    this.resultEl.style.color     = '#f38ba8'
    this.resultEl.textContent     = `오류: ${error}`   // 에러는 plain text 유지
    this.statusEl.textContent     = '오류 발생'
    this.statusEl.style.color     = '#f38ba8'
    this.retryBtn.disabled        = false
    this.retryBtn.style.opacity   = '1'
    this.followUpInput.disabled   = false
  }

  // ── 패널 열기 ────────────────────────────────────────────

  private openSidebar(): void {
    try { chrome.runtime.sendMessage({ type: 'TOGGLE_SIDEPANEL' }) } catch { /* invalidated */ }
  }

  private async continueInPanel(): Promise<void> {
    await chrome.storage?.local?.set({
      panelContinue: {
        action: this.currentAction,
        text:   this.sourceText,
        result: this.resultText,
      },
    })
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' })
    this.destroy()
  }

  // ── DOM 빌드 ─────────────────────────────────────────────

  private buildEl(action: ToolbarAction, sourceText: string): {
    el:           HTMLDivElement
    header:       HTMLDivElement
    dragHandle:   HTMLDivElement
    resizeHandle: HTMLDivElement
    loadingEl:    HTMLElement
    resultEl:     HTMLElement
    statusEl:        HTMLElement
    copyBtn:         HTMLButtonElement
    replaceBtn:      HTMLButtonElement
    retryBtn:        HTMLButtonElement
    panelBtn:        HTMLButtonElement
    translateBtn:    HTMLButtonElement
    followUpInput:   HTMLTextAreaElement
    actionLabelEl:   HTMLElement
    actionIconEl:       HTMLElement
    modelSelectEl:      HTMLSelectElement
    transLangSelectEl:  HTMLSelectElement
    paginationEl:       HTMLDivElement
  } {
    // ── 루트 컨테이너 ─────────────────────────────────────
    const el = document.createElement('div')
    el.id = 'aurora-shell'
    css(el, {
      position:      'fixed',
      zIndex:        '2147483645',
      width:         `${DEFAULT_W}px`,
      height:        `${DEFAULT_H}px`,
      minWidth:      `${MIN_W}px`,
      minHeight:     `${MIN_H}px`,
      display:       'flex',
      flexDirection: 'column',
      background:    '#1a1c2e',
      border:        '1px solid #3d3f58',
      borderRadius:  '12px',
      boxShadow:     '0 12px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(139,92,246,0.1)',
      fontFamily:    'system-ui, sans-serif',
      fontSize:      '13px',
      color:         '#cdd6f4',
      overflow:      'hidden',
    })

    // ── 헤더 ──────────────────────────────────────────────
    const header = document.createElement('div')
    css(header, {
      display:      'flex',
      alignItems:   'center',
      padding:      '0 12px',
      height:       '42px',
      borderBottom: '1px solid #2d2f45',
      flexShrink:   '0',
      background:   '#141625',
      position:     'relative',
      zIndex:       '10',
      gap:          '6px',
    })

    // 헤더 좌측: 액션 드롭다운
    const headerLeft = document.createElement('div')
    css(headerLeft, { position: 'relative', display: 'flex', alignItems: 'center', gap: '5px', userSelect: 'none', flexShrink: '0' })

    const actionIconEl = document.createElement('span')
    actionIconEl.innerHTML = ACTION_ICONS[action] ?? ''
    css(actionIconEl, { display: 'flex', alignItems: 'center', color: '#cba6f7' })

    const actionLabel = document.createElement('span')
    actionLabel.textContent = ACTION_LABELS[action]
    css(actionLabel, { fontWeight: '600', color: '#cba6f7', fontSize: '13px' })

    const chevron = document.createElement('span')
    chevron.textContent = '▼'
    css(chevron, { fontSize: '9px', color: '#6c7086' })
    headerLeft.append(actionIconEl, actionLabel, chevron)

    // 액션 드롭다운
    const DROPDOWN_ACTIONS: ToolbarAction[] = [
      'translate', 'summarize', 'grammar', 'refine', 'draft',
      'ask', 'shorter', 'longer', 'tone', 'save'
    ]
    const actionDropdown = document.createElement('div')
    css(actionDropdown, {
      display: 'none', position: 'absolute', top: '100%', left: '0',
      zIndex: '999', background: '#141625', border: '1px solid #3d3f58',
      borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      minWidth: '120px', padding: '4px', marginTop: '4px',
      maxHeight: '300px', overflowY: 'auto',
    })
    for (const act of DROPDOWN_ACTIONS) {
      const item = document.createElement('button')
      css(item, {
        display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
        background: 'transparent', border: 'none', color: '#cdd6f4',
        fontSize: '12px', padding: '6px 10px', textAlign: 'left',
        cursor: 'pointer', borderRadius: '5px',
      })
      const iconSpan = document.createElement('span')
      iconSpan.innerHTML = ACTION_ICONS[act] ?? ''
      css(iconSpan, { display: 'flex', alignItems: 'center', opacity: '0.7', flexShrink: '0' })
      const textSpan = document.createElement('span')
      textSpan.textContent = ACTION_LABELS[act]
      item.append(iconSpan, textSpan)
      item.addEventListener('mouseenter', () => { item.style.background = '#313244' })
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent' })
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation()
        actionDropdown.style.display = 'none'
        this.switchAction(act)
      })
      actionDropdown.appendChild(item)
    }
    headerLeft.appendChild(actionDropdown)

    // 드롭다운 외부 클릭 감지 — shell이 DOM에서 제거되면 자동으로 리스너 해제
    const onDropdownOutside = (e: MouseEvent) => {
      if (!document.body.contains(this.el)) {
        document.removeEventListener('mousedown', onDropdownOutside)
        return
      }
      if (actionDropdown.style.display === 'block' && !headerLeft.contains(e.target as Node)) {
        actionDropdown.style.display = 'none'
      }
    }
    document.addEventListener('mousedown', onDropdownOutside)

    // headerLeft 호버 효과
    css(headerLeft, { padding: '4px 8px', borderRadius: '8px', transition: 'background 0.12s' })
    headerLeft.addEventListener('mouseenter', () => { headerLeft.style.background = '#313244' })
    headerLeft.addEventListener('mouseleave', () => { headerLeft.style.background = 'transparent' })

    headerLeft.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName.toLowerCase() === 'select') return
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault(); e.stopPropagation()
      if (actionDropdown.style.display !== 'none') { actionDropdown.style.display = 'none'; return }
      actionDropdown.style.display      = 'block'
      actionDropdown.style.top          = '100%'
      actionDropdown.style.bottom       = 'auto'
      actionDropdown.style.marginTop    = '4px'
      actionDropdown.style.marginBottom = '0'
      const rect = actionDropdown.getBoundingClientRect()
      if (rect.bottom > window.innerHeight - 10) {
        actionDropdown.style.top          = 'auto'
        actionDropdown.style.bottom       = '100%'
        actionDropdown.style.marginTop    = '0'
        actionDropdown.style.marginBottom = '4px'
      }
    })

    // 헤더 우측: 모델 뱃지 + 사이드바 열기 버튼 + 닫기
    const headerRight = document.createElement('div')
    css(headerRight, { display: 'flex', alignItems: 'center', gap: '12px' })

    // 모델 선택 드롭다운
    const modelSelectEl = document.createElement('select')
    modelSelectEl.innerHTML = `
      <option value="gemini-nano">Gemini Nano</option>
      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
      <option value="gpt-4o">GPT-4o</option>
    `
    css(modelSelectEl, {
      background: '#1e1e2e', border: '1px solid #45475a', borderRadius: '8px',
      color: '#cdd6f4', fontSize: '14px', padding: '6px 24px 6px 12px',
      cursor: 'pointer', outline: 'none',
    })
    void chrome.storage.local.get('aurora_model').then((res) => {
      const saved = res['aurora_model'] as string | undefined
      if (saved) modelSelectEl.value = saved
    })
    modelSelectEl.addEventListener('change', () => {
      void chrome.storage.local.set({ aurora_model: modelSelectEl.value })
    })

    // 번역 언어 선택 드롭다운 (translate 액션일 때만 표시)
    const transLangSelectEl = document.createElement('select')
    transLangSelectEl.innerHTML = `
      <optgroup label="자동">
        <option value="자동 감지">🔍 자동 감지</option>
      </optgroup>
      <optgroup label="주요 언어 (Nano 지원)">
        <option value="Korean">🇰🇷 한국어</option>
        <option value="English">🇺🇸 영어</option>
        <option value="Japanese">🇯🇵 일본어</option>
        <option value="Spanish">🇪🇸 스페인어</option>
      </optgroup>
      <optgroup label="기타 언어 (Cloud AI 권장)">
        <option value="Chinese Simplified">🇨🇳 중국어 간체</option>
        <option value="Chinese Traditional">🇹🇼 중국어 번체</option>
        <option value="French">🇫🇷 프랑스어</option>
        <option value="German">🇩🇪 독일어</option>
        <option value="Portuguese">🇵🇹 포르투갈어</option>
        <option value="Russian">🇷🇺 러시아어</option>
        <option value="Italian">🇮🇹 이탈리아어</option>
        <option value="Arabic">🇸🇦 아랍어</option>
        <option value="Vietnamese">🇻🇳 베트남어</option>
        <option value="Thai">🇹🇭 태국어</option>
        <option value="Indonesian">🇮🇩 인도네시아어</option>
      </optgroup>
    `
    css(transLangSelectEl, {
      display: 'none', background: '#1e1e2e', border: '1px solid #45475a',
      borderRadius: '8px', color: '#cdd6f4', fontSize: '14px',
      padding: '6px 24px 6px 12px', cursor: 'pointer', outline: 'none',
    })

    // Nano 비지원 언어 선택 시 자동 Cloud AI 전환 안내
    const NANO_SUPPORTED_LANGS = new Set(['자동 감지', 'Korean', 'English', 'Japanese', 'Spanish'])
    transLangSelectEl.addEventListener('change', () => {
      const selectedLang = transLangSelectEl.value
      const currentModel = modelSelectEl.value
      if (currentModel === 'gemini-nano' && !NANO_SUPPORTED_LANGS.has(selectedLang)) {
        modelSelectEl.value = 'gemini-2.5-flash'
        void chrome.storage.local.set({ aurora_model: 'gemini-2.5-flash' })
        this.statusEl.textContent = '⚡ Gemini 2.5 Flash로 전환됨 (해당 언어는 Cloud AI 권장)'
        this.statusEl.style.color = '#fab387'
        setTimeout(() => { this.statusEl.textContent = ''; this.statusEl.style.color = '' }, 3000)
      }
    })

    // 페이지네이션 ( ‹ 1 / 3 › )
    const paginationEl = document.createElement('div')
    css(paginationEl, {
      display: 'none', alignItems: 'center', gap: '2px',
      background: '#1e1e2e', border: '1px solid #45475a', borderRadius: '8px',
      fontSize: '14px', color: '#cdd6f4', padding: '6px 12px',
    })
    const pgPrev = document.createElement('button')
    pgPrev.className = 'aurora-pg-prev'
    pgPrev.textContent = '‹'
    css(pgPrev, { background: 'transparent', border: 'none', color: '#cdd6f4', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: '1.2' })
    pgPrev.disabled = true
    const pgLabel = document.createElement('span')
    pgLabel.className = 'aurora-pg-label'
    pgLabel.textContent = '1 / 1'
    css(pgLabel, { padding: '0 4px', whiteSpace: 'nowrap', fontSize: '13px', color: '#cdd6f4' })
    const pgNext = document.createElement('button')
    pgNext.className = 'aurora-pg-next'
    pgNext.textContent = '›'
    css(pgNext, { background: 'transparent', border: 'none', color: '#cdd6f4', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: '1.2' })
    pgNext.disabled = true
    pgPrev.addEventListener('click', () => {
      if (this.historyIndex > 0) {
        this.historyIndex--
        this.resultText = this.resultHistory[this.historyIndex]
        this.resultEl.innerHTML = renderMarkdown(this.resultText)
        this.updatePaginationUI()
      }
    })
    pgNext.addEventListener('click', () => {
      if (this.historyIndex < this.resultHistory.length - 1) {
        this.historyIndex++
        this.resultText = this.resultHistory[this.historyIndex]
        this.resultEl.innerHTML = renderMarkdown(this.resultText)
        this.updatePaginationUI()
      }
    })
    paginationEl.append(pgPrev, pgLabel, pgNext)

    // 사이드바 열기 버튼
    const sidebarBtn = document.createElement('button')
    sidebarBtn.title = 'Aurora 사이드바 열기'
    sidebarBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>`
    css(sidebarBtn, {
      background: 'transparent', border: 'none', color: '#6c7086',
      width: '32px', height: '32px', padding: '4px', borderRadius: '6px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    })
    sidebarBtn.addEventListener('mouseenter', () => { sidebarBtn.style.color = '#cba6f7'; sidebarBtn.style.background = '#2d2f45' })
    sidebarBtn.addEventListener('mouseleave', () => { sidebarBtn.style.color = '#6c7086'; sidebarBtn.style.background = 'transparent' })
    sidebarBtn.addEventListener('click', () => this.openSidebar())

    // 닫기 버튼
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '닫기'
    css(closeBtn, {
      background: 'transparent', border: 'none', color: '#6c7086',
      padding: '6px 12px', borderRadius: '6px',
      cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
    })
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#cdd6f4'; closeBtn.style.background = '#313244' })
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#6c7086'; closeBtn.style.background = 'transparent' })
    closeBtn.addEventListener('click', () => this.destroy())

    // 가운데 드래그 핸들 (빈 공간)
    const dragHandle = document.createElement('div')
    css(dragHandle, { flex: '1', height: '100%', cursor: 'grab', minWidth: '20px' })

    headerRight.append(paginationEl, transLangSelectEl, modelSelectEl, sidebarBtn, closeBtn)
    header.append(headerLeft, dragHandle, headerRight)

    // ── 컨텍스트 바 (원문 미리보기) ──────────────────────
    const ctxBar = document.createElement('div')
    css(ctxBar, {
      padding:      '8px 14px',
      borderBottom: '1px solid #1e2035',
      background:   '#0f111a',
      flexShrink:   '0',
      fontSize:     '12px',
      color:        '#6c7086',
      lineHeight:   '1.5',
      display:      'flex',
      alignItems:   'flex-start',
      gap:          '6px',
    })
    const quoteIcon = document.createElement('span')
    quoteIcon.textContent = '"'
    css(quoteIcon, { color: '#3d3f58', fontSize: '16px', lineHeight: '1.3', flexShrink: '0' })
    const ctxText = document.createElement('span')
    ctxText.textContent = sourceText.length > 140 ? sourceText.slice(0, 140) + '…' : sourceText
    css(ctxText, { flex: '1', overflow: 'hidden', display: '-webkit-box',
      webkitLineClamp: '2', webkitBoxOrient: 'vertical' } as Partial<CSSStyleDeclaration>)
    // overflow 관련 비표준 속성은 style 직접 할당
    ctxText.style.cssText += ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden'
    ctxBar.append(quoteIcon, ctxText)

    // ── 바디 (결과 영역, flex:1) ──────────────────────────
    const body = document.createElement('div')
    css(body, {
      flex:          '1',
      overflowY:     'auto',
      overflowX:     'hidden',
      padding:       '14px 16px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      minHeight:     '0',
    })
    body.style.cssText += ';scrollbar-width:thin;scrollbar-color:#2d2f45 transparent'

    // 로딩 애니메이션
    const loadingEl = document.createElement('div')
    css(loadingEl, { display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 0' })
    const dotsEl = document.createElement('span')
    dotsEl.className = 'aurora-loading-dots'
    dotsEl.innerHTML = '<span>●</span><span>●</span><span>●</span>'
    const loadingText = document.createElement('span')
    loadingText.textContent = 'AI 처리 중...'
    css(loadingText, { fontSize: '12px', color: '#6c7086', letterSpacing: '0.05em' })
    loadingEl.append(dotsEl, loadingText)

    // 결과 영역
    const resultEl = document.createElement('div')
    css(resultEl, {
      display:    'none',
      whiteSpace: 'pre-wrap',
      lineHeight: '1.75',
      wordBreak:  'break-word',
      color:      '#cdd6f4',
      fontSize:   '14px',
    })

    body.append(loadingEl, resultEl)

    // ── 상태 + 액션 버튼 행 ───────────────────────────────
    const footer1 = document.createElement('div')
    css(footer1, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '8px 14px',
      borderTop:      '1px solid #2d2f45',
      flexShrink:     '0',
      background:     '#141625',
      gap:            '8px',
    })

    // 왼쪽: Aurora 아이콘 + 상태 텍스트
    const statusLeft = document.createElement('div')
    css(statusLeft, { display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0', flex: '1' })
    const auroraIcon = document.createElement('span')
    auroraIcon.innerHTML = `<svg viewBox="0 0 100 100" width="14" height="14" fill="none"><defs><linearGradient id="ag-sh" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><path d="M20 80L50 20L80 80" stroke="url(#ag-sh)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 80L50 50L65 80" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/></svg>`
    const statusEl = document.createElement('span')
    statusEl.textContent = 'AI 처리 중...'
    css(statusEl, { fontSize: '11px', color: '#6c7086', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
    // 새로고침(재호출) 버튼
    const retryBtn = document.createElement('button')
    retryBtn.title = '다시 실행'
    retryBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`
    styleIconBtn(retryBtn)
    retryBtn.style.marginLeft = '6px'
    retryBtn.style.opacity = '0.4'
    retryBtn.addEventListener('click', () => {
      if (this.currentAction === 'draft') { this.showResult(this.sourceText); return }
      if (this.currentAction !== 'save') void this.runAction(SYSTEM_PROMPTS[this.currentAction as AiAction], USER_PROMPTS[this.currentAction as AiAction](this.sourceText))
    })
    statusLeft.append(auroraIcon, statusEl, retryBtn)

    // 오른쪽: 번역하기 | 바꾸기 | 복사 | 패널에서 계속
    const btnGroup = document.createElement('div')
    css(btnGroup, { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: '0' })

    // 번역하기 버튼 (translate 액션일 때만 표시)
    const translateBtn = document.createElement('button')
    translateBtn.textContent = '번역하기'
    css(translateBtn, {
      background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)', border: 'none',
      color: '#fff', fontSize: '12px', fontWeight: '600',
      padding: '6px 18px', borderRadius: '6px', cursor: 'pointer',
      display: 'none', alignItems: 'center',
    })
    translateBtn.addEventListener('mouseenter', () => { translateBtn.style.opacity = '0.85' })
    translateBtn.addEventListener('mouseleave', () => { translateBtn.style.opacity = '1' })
    translateBtn.addEventListener('click', () => {
      const targetLang = this.transLangSelectEl.value
      void this.runTranslateAction(targetLang)
    })

    // ↵ 바꾸기 버튼
    const replaceBtn = document.createElement('button')
    replaceBtn.textContent = '↵ 바꾸기'
    replaceBtn.disabled = true
    css(replaceBtn, {
      background: 'linear-gradient(135deg, #7c3aed, #db2777)', border: 'none',
      color: '#fff', fontSize: '12px', fontWeight: '600',
      padding: '6px 20px', borderRadius: '6px', cursor: 'pointer', opacity: '0.4',
    })
    replaceBtn.addEventListener('click', () => {
      if (!this.resultText) return
      const err = this.replaceInSource()
      if (err === null) {
        replaceBtn.textContent = '✓ 바꿈'
        setTimeout(() => { replaceBtn.textContent = '↵ 바꾸기' }, 1500)
      } else {
        // 실패 시 버튼 라벨 유지, 상태 텍스트로만 알림
        statusEl.textContent = err
        statusEl.style.color = '#f38ba8'
        setTimeout(() => { statusEl.textContent = 'AI 응답 완료'; statusEl.style.color = '#a6e3a1' }, 2000)
      }
    })

    // 복사 버튼
    const copyBtn = document.createElement('button')
    copyBtn.title = '복사'
    copyBtn.disabled = true
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
    styleIconBtn(copyBtn)
    css(copyBtn, { width: '32px', height: '32px', justifyContent: 'center' })
    copyBtn.style.opacity = '0.4'
    copyBtn.addEventListener('click', () => {
      if (!this.resultText) return
      void navigator.clipboard.writeText(this.resultText).then(() => {
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="#a6e3a1" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`
        setTimeout(() => {
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
        }, 1500)
      })
    })

    // 패널에서 계속 버튼
    const panelBtn = document.createElement('button')
    panelBtn.title = '패널에서 계속'
    panelBtn.disabled = true
    panelBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
    styleIconBtn(panelBtn)
    css(panelBtn, { width: '32px', height: '32px', justifyContent: 'center' })
    panelBtn.style.opacity = '0.4'
    panelBtn.addEventListener('click', () => void this.continueInPanel())

    btnGroup.append(translateBtn, replaceBtn, copyBtn, panelBtn)
    footer1.append(statusLeft, btnGroup)

    // ── 추가 질문 입력창 (항상 표시) ──────────────────────
    const footer2 = document.createElement('div')
    css(footer2, {
      display:       'flex',
      alignItems:    'flex-end',
      gap:           '8px',
      padding:       '8px 14px 10px',
      borderTop:     '1px solid #1e2035',
      flexShrink:    '0',
      background:    '#0f111a',
      pointerEvents: 'auto',
    })

    const inputWrap = document.createElement('div')
    css(inputWrap, {
      flex:         '1',
      display:      'flex',
      alignItems:   'flex-end',
      gap:          '6px',
      background:   '#141625',
      border:       '1px solid #2d2f45',
      borderRadius: '10px',
      padding:      '6px 8px',
      transition:   'border-color 0.15s',
    })
    inputWrap.addEventListener('focusin',  () => { inputWrap.style.borderColor = '#7c3aed' })
    inputWrap.addEventListener('focusout', () => { inputWrap.style.borderColor = '#2d2f45' })

    // ── 퀵버튼 (스파클 ✨) ───────────────────────────────────
    const quickBtn = document.createElement('button')
    quickBtn.title = '프롬프트 템플릿'
    quickBtn.textContent = '✨'
    css(quickBtn, {
      background:  'none',
      border:      'none',
      cursor:      'pointer',
      fontSize:    '14px',
      lineHeight:  '1',
      padding:     '0',
      flexShrink:  '0',
      opacity:     '0.6',
      transition:  'opacity 0.15s',
      alignSelf:   'center',
    })
    quickBtn.addEventListener('mouseenter', () => { quickBtn.style.opacity = '1' })
    quickBtn.addEventListener('mouseleave', () => { quickBtn.style.opacity = '0.6' })

    const QUICK_TEMPLATES = [
      {
        label: '✏️ 반말 교정',
        value: '이 텍스트의 문법과 맞춤법을 반말(~다체)로 교정해줘',
      },
      {
        label: '🎩 존댓말 변환',
        value: '이 텍스트를 정중한 존댓말(~요/~습니다체)로 바꿔줘',
      },
      {
        label: '✂️ 더 짧게',
        value: '이 텍스트를 의미를 유지하며 절반 이하로 줄여줘. 반드시 원문과 동일한 말체(반말이면 반말, 존댓말이면 존댓말)로 출력해줘.',
      },
      {
        label: '📝 더 자세히',
        value: '이 텍스트를 더 상세하고 풍부하게 늘려줘. 반드시 원문과 동일한 말체(반말이면 반말, 존댓말이면 존댓말)로 출력해줘.',
      },
      {
        label: '🚀 마스터 프롬프트 생성',
        value: '이 내용을 기반으로 고급 AI 프롬프트를 작성해줘. 반말로 써줘. 목표, 제약 조건, 출력 형식을 포함해줘.',
      },
      {
        label: '💡 저장 후 분석',
        value: '이 텍스트의 핵심 내용을 3가지로 정리해줘. 반드시 원문과 동일한 말체로 출력해줘.',
      },
    ]

    let quickMenuOpen = false
    let quickMenuEl: HTMLDivElement | null = null

    const closeQuickMenu = () => {
      quickMenuEl?.remove()
      quickMenuEl = null
      quickMenuOpen = false
    }

    quickBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (quickMenuOpen) { closeQuickMenu(); return }
      quickMenuOpen = true

      quickMenuEl = document.createElement('div')
      css(quickMenuEl, {
        position:     'absolute',
        bottom:       '100%',
        left:         '0',
        marginBottom: '6px',
        background:   '#1e2035',
        border:       '1px solid #3d3f5a',
        borderRadius: '10px',
        padding:      '4px',
        zIndex:       '10',
        minWidth:     '200px',
        boxShadow:    '0 4px 16px rgba(0,0,0,0.5)',
      })

      QUICK_TEMPLATES.forEach(({ label, value }) => {
        const item = document.createElement('button')
        item.textContent = label
        css(item, {
          display:      'block',
          width:        '100%',
          background:   'none',
          border:       'none',
          color:        '#cdd6f4',
          fontSize:     '12px',
          padding:      '7px 10px',
          textAlign:    'left',
          cursor:       'pointer',
          borderRadius: '7px',
          whiteSpace:   'nowrap',
        })
        item.addEventListener('mouseenter', () => { item.style.background = '#2d2f45' })
        item.addEventListener('mouseleave', () => { item.style.background = 'none' })
        item.addEventListener('click', () => {
          followUpInput.value = value
          followUpInput.style.height = 'auto'
          followUpInput.style.height = `${Math.min(followUpInput.scrollHeight, 84)}px`
          followUpInput.focus()
          closeQuickMenu()
        })
        quickMenuEl!.appendChild(item)
      })

      footer2.style.position = 'relative'
      footer2.appendChild(quickMenuEl)

      const onOutside = (ev: MouseEvent) => {
        if (!quickMenuEl?.contains(ev.target as Node) && ev.target !== quickBtn) {
          closeQuickMenu()
          document.removeEventListener('click', onOutside)
        }
      }
      setTimeout(() => document.addEventListener('click', onOutside), 0)
    })

    const followUpInput = document.createElement('textarea')
    followUpInput.placeholder = 'AI에게 추가 질문을 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)'
    followUpInput.rows = 1
    css(followUpInput, {
      flex:          '1',
      minWidth:      '0',
      background:    'transparent',
      border:        'none',
      color:         '#cdd6f4',
      fontSize:      '12px',
      resize:        'none',
      outline:       'none',
      lineHeight:    '1.5',
      fontFamily:    'system-ui, sans-serif',
      display:       'block',
      pointerEvents: 'auto',
      overflow:      'hidden',
    })
    followUpInput.addEventListener('click', () => {
      followUpInput.focus()
    })
    // 자동 높이 확장 (최대 ~5줄)
    followUpInput.addEventListener('input', () => {
      followUpInput.style.height = 'auto'
      followUpInput.style.height = `${Math.min(followUpInput.scrollHeight, 84)}px`
    })
    followUpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const text = followUpInput.value.trim()
        if (text) { followUpInput.value = ''; followUpInput.style.height = 'auto'; void this.runFollowUp(text) }
      }
    })
    inputWrap.append(quickBtn, followUpInput)

    const sendBtn = document.createElement('button')
    sendBtn.title = '전송'
    sendBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>`
    css(sendBtn, {
      background: '#8b5cf6', border: 'none', borderRadius: '8px',
      padding: '7px 8px', cursor: 'pointer', display: 'flex',
      alignItems: 'center', flexShrink: '0',
    })
    sendBtn.addEventListener('mouseenter', () => { sendBtn.style.background = '#7c3aed' })
    sendBtn.addEventListener('mouseleave', () => { sendBtn.style.background = '#8b5cf6' })
    sendBtn.addEventListener('click', () => {
      const text = followUpInput.value.trim()
      if (text) { followUpInput.value = ''; followUpInput.style.height = 'auto'; void this.runFollowUp(text) }
    })

    footer2.append(inputWrap, sendBtn)

    // ── 리사이즈 핸들 ────────────────────────────────────
    const resizeHandle = document.createElement('div')
    resizeHandle.title = '크기 조절'
    css(resizeHandle, {
      position: 'absolute', right: '0', bottom: '0',
      width: '18px', height: '18px', cursor: 'se-resize', zIndex: '10',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
      padding: '3px',
    })
    resizeHandle.innerHTML = `<svg viewBox="0 0 10 10" width="10" height="10" fill="none"><path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#3d3f58" stroke-width="1.5" stroke-linecap="round"/></svg>`
    el.style.position = 'fixed' // ensure relative children use this

    el.append(header, ctxBar, body, footer1, footer2, resizeHandle)

    return {
      el, header, dragHandle, resizeHandle,
      loadingEl, resultEl,
      statusEl, copyBtn, replaceBtn, retryBtn, panelBtn, translateBtn,
      followUpInput,
      actionLabelEl: actionLabel,
      actionIconEl,
      modelSelectEl,
      transLangSelectEl,
      paginationEl,
    }
  }

  // ── 드래그 이동 ───────────────────────────────────────────

  private initDrag(handle: HTMLElement): void {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false

    const onMove = (e: MouseEvent) => {
      if (!dragging) return
      const left = Math.max(0, Math.min(startLeft + e.clientX - startX, window.innerWidth  - this.el.offsetWidth))
      const top  = Math.max(0, Math.min(startTop  + e.clientY - startY, window.innerHeight - this.el.offsetHeight))
      this.el.style.left = `${left}px`
      this.el.style.top  = `${top}px`
    }
    const onUp = () => {
      dragging = false
      handle.style.cursor = 'grab'
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      dragging   = true
      startX     = e.clientX; startY     = e.clientY
      startLeft  = parseInt(this.el.style.left, 10) || 0
      startTop   = parseInt(this.el.style.top,  10) || 0
      handle.style.cursor = 'grabbing'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  // ── 리사이즈 ─────────────────────────────────────────────

  private initResize(handle: HTMLElement): void {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startW = this.el.offsetWidth
      const startH = this.el.offsetHeight

      const onMove = (ev: MouseEvent) => {
        const newW = Math.max(MIN_W, Math.min(startW + ev.clientX - startX, window.innerWidth  - 16))
        const newH = Math.max(MIN_H, Math.min(startH + ev.clientY - startY, window.innerHeight - 16))
        this.el.style.width  = `${newW}px`
        this.el.style.height = `${newH}px`
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        void chrome.storage.local.set({
          aurora_shell_size: { w: this.el.offsetWidth, h: this.el.offsetHeight },
        })
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  // ── 위치 계산 ─────────────────────────────────────────────

  private position(rect: DOMRect): void {
    const W     = DEFAULT_W
    const H_EST = DEFAULT_H
    const OFFSET = 10

    let top = rect.bottom + OFFSET
    if (top + H_EST > window.innerHeight - 8) {
      top = rect.top - H_EST - OFFSET
      if (top < 8) top = 8
    }
    // 실제 렌더된 높이(offsetHeight)로 뷰포트 이탈을 엄격하게 제한
    const elH = this.el.offsetHeight || H_EST
    top = Math.max(8, Math.min(top, window.innerHeight - elH - 8))

    let left = rect.left + rect.width / 2 - W / 2
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))

    this.el.style.top  = `${top}px`
    this.el.style.left = `${left}px`
  }

  // ── CSS 주입 ─────────────────────────────────────────────

  private injectStyle(): void {
    if (document.getElementById('aurora-shell-style')) return
    const style = document.createElement('style')
    style.id = 'aurora-shell-style'
    style.textContent = `
      .aurora-loading-dots span {
        display: inline-block; width: 7px; height: 7px; border-radius: 50%;
        background: #8b5cf6; margin: 0 2px;
        animation: aurora-dot-bounce 1.2s ease-in-out infinite;
      }
      .aurora-loading-dots span:nth-child(2) { animation-delay: 0.2s; background: #a855f7; }
      .aurora-loading-dots span:nth-child(3) { animation-delay: 0.4s; background: #ec4899; }
      @keyframes aurora-dot-bounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30%            { transform: translateY(-6px); opacity: 1; }
      }
      #aurora-shell *::-webkit-scrollbar { width: 4px; }
      #aurora-shell *::-webkit-scrollbar-track { background: transparent; }
      #aurora-shell *::-webkit-scrollbar-thumb { background: #2d2f45; border-radius: 2px; }
    `
    document.head.appendChild(style)
  }

  // ── 바꾸기 ────────────────────────────────────────────────
  // null 반환 = 성공 / string 반환 = 에러 메시지

  private replaceInSource(): string | null {
    const { el, selStart, selEnd, isContentEditable, rangeClone } = this.sourceMeta

    if (!el) return '원문 선택 영역을 찾을 수 없습니다'

    // ── textarea / input ──────────────────────────────────
    if (!isContentEditable && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
      if (selStart < 0 || selEnd <= selStart) {
        return 'textarea: 선택 위치를 찾을 수 없습니다'
      }
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement
      inputEl.focus()
      inputEl.value =
        inputEl.value.slice(0, selStart) + this.resultText + inputEl.value.slice(selEnd)
      inputEl.setSelectionRange(selStart, selStart + this.resultText.length)
      inputEl.dispatchEvent(new Event('input',  { bubbles: true }))
      inputEl.dispatchEvent(new Event('change', { bubbles: true }))
      return null
    }

    // ── contenteditable / 리치 에디터 ────────────────────
    if (isContentEditable) {
      if (!rangeClone) return 'contenteditable: 선택 범위를 찾을 수 없습니다'

      // rangeClone의 startContainer가 DOM에서 분리된 경우 조기 탐지
      if (!rangeClone.startContainer.isConnected) {
        return 'contenteditable: 선택 영역이 만료됨 — 다시 드래그 후 시도하세요'
      }

      const sel = window.getSelection()
      if (!sel) return 'contenteditable: Selection API 사용 불가'

      try {
        el.focus()
        sel.removeAllRanges()
        sel.addRange(rangeClone)
        const ok = document.execCommand('insertText', false, this.resultText)
        if (!ok) {
          // execCommand 실패 시 DOM 직접 조작으로 폴백
          // deleteContents + insertNode를 별도 try/catch로 감싸 DOM 오염 방지
          try {
            rangeClone.deleteContents()
            rangeClone.insertNode(document.createTextNode(this.resultText))
            // 삽입된 노드 뒤로 커서 이동 (범위 정규화)
            rangeClone.collapse(false)
            sel.removeAllRanges()
            sel.addRange(rangeClone)
          } catch (insertErr) {
            const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
            return `contenteditable: insertNode 실패 — ${msg}`
          }
        }
        el.dispatchEvent(new Event('input',  { bubbles: true }))
        return null
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `contenteditable: 바꾸기 실패 — ${msg}`
      }
    }

    return '원문 선택 영역을 찾을 수 없습니다'
  }

  private updatePaginationUI(): void {
    const total   = this.resultHistory.length
    const current = this.historyIndex + 1
    const prevBtn = this.paginationEl.querySelector<HTMLButtonElement>('.aurora-pg-prev')!
    const nextBtn = this.paginationEl.querySelector<HTMLButtonElement>('.aurora-pg-next')!
    const label   = this.paginationEl.querySelector<HTMLSpanElement>('.aurora-pg-label')!
    label.textContent      = `${current} / ${total}`
    prevBtn.disabled       = this.historyIndex <= 0
    nextBtn.disabled       = this.historyIndex >= total - 1
    prevBtn.style.opacity  = prevBtn.disabled ? '0.3' : '0.8'
    nextBtn.style.opacity  = nextBtn.disabled ? '0.3' : '0.8'
    this.paginationEl.style.display = total <= 1 ? 'none' : 'flex'
  }

  destroy(): void { this.el?.remove() }
}

// ── 유틸 ──────────────────────────────────────────────────────

// 최종 방어선: [RESULT]/[/RESULT] 태그 잔재를 모두 제거
function sanitizeResult(text: string): string {
  return text.replace(/\[\/?\s*RESULT\s*\]/gi, '').trim()
}

function extractResult(rawText: string): string {
  // 정규식으로 [RESULT]...[/RESULT] 블록 추출 (대소문자 무관)
  const match = rawText.match(/\[RESULT\]([\s\S]*?)\[\/RESULT\]/i)
  if (match?.[1]) return match[1].trim()

  // 프롬프트 끝에 [RESULT]를 넣은 경우 모델이 여는 태그 없이 내용 + [/RESULT]만 출력할 수 있음.
  // 이 경우 [RESULT] 여는 태그가 rawText에 없으므로 아래에서 [/RESULT] 닫는 태그만 제거.
  const startIdx = rawText.indexOf('[RESULT]')
  if (startIdx !== -1) {
    return rawText.slice(startIdx + 8).replace(/\[\/RESULT\][\s\S]*/i, '').trim()
  }

  // 폴백: 태그 없이 [/RESULT]만 남아 있으면 제거
  return rawText.replace(/\[\/RESULT\][\s\S]*/i, '').trim()
}

function needsCorrection(input: string, output: string): boolean {
  const markers = ['저 ', '제 ', '제가', '저의', '당신']
  return markers.some(m => !input.includes(m) && output.includes(m))
}

function css(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles)
}

function styleIconBtn(btn: HTMLButtonElement): void {
  css(btn, {
    background: 'transparent', border: 'none', color: '#6c7086',
    padding: '5px', borderRadius: '5px', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
  })
  btn.addEventListener('mouseenter', () => {
    if (!btn.disabled) { btn.style.background = '#313244'; btn.style.color = '#cdd6f4' }
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent'; btn.style.color = '#6c7086'
  })
}
