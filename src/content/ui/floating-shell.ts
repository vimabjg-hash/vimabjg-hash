import type { ToolbarAction, PersonaId, SourceMeta } from '../../shared/types'
import type { SelectionInfo } from '../selection/selection-observer'

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

// ── 패널 크기 상수 ───────────────────────────────────────────
const DEFAULT_W = 560
const DEFAULT_H = 520
const MIN_W     = 420
const MIN_H     = 340

// ── 한국어 강제 규칙 ─────────────────────────────────────────
const STRICT_LANGUAGE_RULE =
  '!!!경고!!! 너는 현재 한국인 사용자 전용 도구다. 모든 대답은 100% 한국어로만 한다. 일본어를 단 한 글자라도 섞으면 시스템 에러가 발생한다. 오직 한국어만 사용하라.\n\n' +
  '[STRICT LANGUAGE RULE]\n' +
  "- 출력 언어 설정이 'ja'로 되어 있더라도 실제 내용은 반드시 한국어(Korean)로만 작성해야 합니다.\n" +
  '- 일본어 문자는 단 하나도 사용하지 마십시오.\n\n'

const OUTPUT_RULE =
  '[OUTPUT RULE]\n' +
  '반드시 [RESULT]와 [/RESULT] 태그 사이에만 결과물을 한국어로 작성하라.\n' +
  '태그 밖에는 어떠한 텍스트도 출력하지 마라. 인사말·설명·서론 금지.\n\n'

function enforceKorean(systemPrompt: string): string {
  return STRICT_LANGUAGE_RULE + OUTPUT_RULE + systemPrompt
}

// ── 페르소나 정의 ─────────────────────────────────────────────
interface PersonaDef { id: PersonaId; label: string; description: string; systemPrompt: string }

const PERSONAS: PersonaDef[] = [
  { id: 'minimalist', label: '미니멀리스트 🧹', description: '핵심만 남기고 군더더기 제거',
    systemPrompt: '너는 문장 다이어트 전문가야. 화자의 시점을 유지하며 의미 전달에 불필요한 수식어만 삭제해서 짧게 다듬어줘. 반드시 한국어로만 출력해.' },
  { id: 'devil', label: '악마의 대변인 😈', description: '논리적 허점 3가지 지적',
    systemPrompt: '너는 냉철한 비평가야. 입력된 내용의 취약점과 반박할 점 3가지를 날카롭게 요약해줘. 반드시 한국어로만 출력해.' },
  { id: 'dictionary', label: '사전적 정의 🎓', description: '개념을 초등학생 수준으로 풀이',
    systemPrompt: '너는 쉬운 용어 사전이야. 드래그한 단어나 문장의 핵심을 누구나 이해할 수 있게 한 문장으로 정의해줘. 반드시 한국어로만 출력해.' },
  { id: 'master', label: '마스터 프롬프트 💎', description: '맥락/의도/제약/형식/예시 포함 프롬프트 생성',
    systemPrompt: '너는 오라라의 프롬프트 아키텍트다.\n심호흡을 하고 체계적으로 작업해.\n\n[STRICT RULE]\n1. 나/내/너/네/私/僕/君 인칭을 저/제/당신/あなた로 절대 바꾸지 마라.\n2. 반드시 한국어로만 출력해.\n\n[TASK]\n사용자의 아이디어를 분석해서\nContext/Intent/Constraints/Format/Examples\n5요소가 포함된 전문 프롬프트 템플릿을 생성해.\n\n[RESULT] 태그 안에만 결과를 출력해.' },
]

// ── 액션 아이콘 / 라벨 ───────────────────────────────────────
const ACTION_ICONS: Partial<Record<ToolbarAction, string>> = {
  translate: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  summarize: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  refine:    `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>`,
  ask:       `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  shorter:   `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/></svg>`,
  longer:    `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  tone:      `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
}

const ACTION_LABELS: Record<ToolbarAction, string> = {
  translate: '번역', summarize: '요약', refine: '다듬기', ask: '질문', save: '저장',
  shorter: '짧게', longer: '길게', tone: '톤 변경',
}

// AI 실행 가능한 액션만 (refine은 페르소나 UI, save/placeholder는 별도 처리)
type AiAction = 'translate' | 'summarize' | 'ask'

const SYSTEM_PROMPTS: Record<AiAction, string> = {
  translate: '당신은 전문 번역가입니다. 반드시 한국어로만 답하세요. 입력된 텍스트를 자연스러운 한국어로 번역하고, 번역 결과만 출력하세요.',
  summarize: '당신은 요약 전문가입니다. 입력된 텍스트의 핵심을 간결하게 요약하세요. 요약 결과만 출력하세요.',
  ask:       '당신은 친절한 AI 어시스턴트입니다. 입력된 텍스트에 대해 사용자가 궁금해할 내용을 파악하여 유용한 정보를 제공하세요.',
}

const USER_PROMPTS: Record<AiAction, (t: string) => string> = {
  translate: (t) => `반드시 한국어로만 번역하세요.\n\n번역할 텍스트:\n${t}\n\n오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]`,
  summarize: (t) => `반드시 한국어로만 요약하세요.\n\n텍스트:\n${t}\n\n오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]`,
  ask:       (t) => `반드시 한국어로만 답하세요.\n\n질문:\n${t}\n\n오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]`,
}

function sandwichPrompt(text: string): string {
  return (
    '[STRICT LANGUAGE RULE]\n' +
    "- 출력 언어 설정이 'ja'로 되어 있더라도 실제 내용은 반드시 한국어(Korean)로만 작성해야 합니다.\n" +
    '- 일본어 문자는 단 하나도 사용하지 마십시오.\n\n' +
    '[IDENTITY GUARD]\n- 절대 나/내/너/네를 저/제/당신으로 바꾸지 마라.\n\n' +
    '[TASK]\n' + `"${text}"\n\n` +
    '[OUTPUT RULE]\n- 최종 결과물은 반드시 [RESULT]와 [/RESULT] 태그 사이에만 작성하라.\n\n' +
    '오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'
  )
}

// ── FloatingShell ─────────────────────────────────────────────

export class FloatingShell {
  private readonly el!:              HTMLDivElement
  private readonly loadingEl!:       HTMLElement
  private readonly personaSelectEl!: HTMLElement
  private readonly resultEl!:        HTMLElement
  private readonly statusEl!:        HTMLElement
  private readonly copyBtn!:         HTMLButtonElement
  private readonly replaceBtn!:      HTMLButtonElement
  private readonly panelBtn!:        HTMLButtonElement
  private readonly followUpInput!:   HTMLTextAreaElement
  private readonly actionLabelEl!:   HTMLElement
  private readonly actionIconEl!:    HTMLElement
  private currentAction: ToolbarAction
  private readonly sourceText!: string
  private readonly sourceMeta!: SourceMeta
  private resultText     = ''
  private selectedPersona: PersonaDef | null = null

  constructor(action: ToolbarAction, info: SelectionInfo) {
    this.currentAction = action
    this.sourceText    = info.text
    this.sourceMeta    = info.sourceMeta

    if (!info.text.trim()) { console.error('[AURORA] FloatingShell: empty sourceText'); return }

    this.injectStyle()

    const built = this.buildEl(action, info.text)
    this.el              = built.el
    this.loadingEl       = built.loadingEl
    this.personaSelectEl = built.personaSelectEl
    this.resultEl        = built.resultEl
    this.statusEl        = built.statusEl
    this.copyBtn         = built.copyBtn
    this.replaceBtn      = built.replaceBtn
    this.panelBtn        = built.panelBtn
    this.followUpInput   = built.followUpInput
    this.actionLabelEl   = built.actionLabelEl
    this.actionIconEl    = built.actionIconEl

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

    this.position(info.rect)
    this.initDrag(built.header)
    this.initResize(built.resizeHandle)

    if (action === 'refine') {
      this.showPersonaSelect()
    } else if (action === 'shorter' || action === 'longer' || action === 'tone') {
      this.showError('이 기능은 준비 중입니다.')
    } else if (action !== 'save') {
      void this.runAction(
        SYSTEM_PROMPTS[action as AiAction],
        USER_PROMPTS[action as AiAction](this.sourceText),
      )
    }
  }

  // ── 페르소나 선택 UI ──────────────────────────────────────

  private showPersonaSelect(): void {
    this.loadingEl.style.display       = 'none'
    this.personaSelectEl.style.display = 'flex'
    this.resultEl.style.display        = 'none'
  }

  private hidePersonaSelect(): void {
    this.personaSelectEl.style.display = 'none'
    this.loadingEl.style.display       = 'flex'
  }

  private switchAction(action: ToolbarAction): void {
    this.currentAction = action
    this.actionIconEl.innerHTML    = ACTION_ICONS[action] ?? ''
    this.actionLabelEl.textContent = ACTION_LABELS[action]
    if (action === 'refine') {
      this.showPersonaSelect()
    } else if (action === 'shorter' || action === 'longer' || action === 'tone') {
      this.showError('이 기능은 준비 중입니다.')
    } else if (action !== 'save') {
      void this.runAction(
        SYSTEM_PROMPTS[action as AiAction],
        USER_PROMPTS[action as AiAction](this.sourceText),
      )
    }
  }

  // ── AI 실행 ──────────────────────────────────────────────

  private async runAction(systemPrompt: string, userPrompt: string): Promise<void> {
    this.loadingEl.style.display   = 'flex'
    this.resultEl.style.display    = 'none'
    this.statusEl.textContent      = 'GEMINI NANO 처리 중...'
    this.statusEl.style.color      = '#6c7086'
    this.followUpInput.disabled    = true

    let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
    try {
      session = await LanguageModel.create({ systemPrompt: enforceKorean(systemPrompt), outputLanguage: 'ja', temperature: 0.6, topK: 5 })
      const rawResponse = await session.prompt(userPrompt)
      let result = extractResult(rawResponse)
      if (needsCorrection(this.sourceText, result)) {
        result = extractResult(await session.prompt(
          'ERROR: 인칭이 바뀌었어.\n다시 나/내/너/네를 사용해서 답변해줘.\n결과물만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'
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
    this.loadingEl.style.display   = 'flex'
    this.resultEl.style.display    = 'none'
    this.statusEl.textContent      = 'GEMINI NANO 처리 중...'
    this.statusEl.style.color      = '#6c7086'
    this.followUpInput.disabled    = true

    const sysP = '당신은 도움이 되는 AI 어시스턴트입니다. 반드시 한국어로 답변하세요.'
    const ctx  =
      `[원문]\n"${this.sourceText}"\n\n` +
      `[이전 결과]\n"${this.resultText}"\n\n` +
      `[추가 질문]\n${userPrompt}\n\n` +
      '오직 최종 답변만 [RESULT] 태그 안에 작성해. 시작한다:\n[RESULT]'

    let session: Awaited<ReturnType<typeof LanguageModel.create>> | null = null
    try {
      session = await LanguageModel.create({ systemPrompt: enforceKorean(sysP), outputLanguage: 'ja', temperature: 0.6, topK: 5 })
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

  // ── 결과 / 에러 표시 ─────────────────────────────────────

  private showResult(text: string): void {
    this.resultText = sanitizeResult(text)
    this.loadingEl.style.display  = 'none'
    this.resultEl.style.display   = 'block'
    this.resultEl.style.color     = '#cdd6f4'
    this.resultEl.textContent     = this.resultText
    this.statusEl.textContent     = 'AI 응답 완료'
    this.statusEl.style.color     = '#a6e3a1'
    this.copyBtn.disabled         = false
    this.replaceBtn.disabled      = false
    this.panelBtn.disabled        = false
    this.copyBtn.style.opacity    = '1'
    this.replaceBtn.style.opacity = '1'
    this.panelBtn.style.opacity   = '1'
    this.followUpInput.disabled   = false
  }

  private showError(error: string): void {
    this.loadingEl.style.display  = 'none'
    this.resultEl.style.display   = 'block'
    this.resultEl.style.color     = '#f38ba8'
    this.resultEl.textContent     = `오류: ${error}`
    this.statusEl.textContent     = '오류 발생'
    this.statusEl.style.color     = '#f38ba8'
    this.followUpInput.disabled   = false
  }

  // ── 패널 열기 ────────────────────────────────────────────

  private openSidebar(): void {
    try { chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }) } catch { /* invalidated */ }
  }

  private async continueInPanel(): Promise<void> {
    await chrome.storage?.local?.set({
      panelContinue: {
        action:  this.currentAction,
        text:    this.sourceText,
        result:  this.resultText,
        persona: this.selectedPersona?.label ?? null,
      },
    })
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' })
    this.destroy()
  }

  // ── DOM 빌드 ─────────────────────────────────────────────

  private buildEl(action: ToolbarAction, sourceText: string): {
    el:              HTMLDivElement
    header:          HTMLDivElement
    resizeHandle:    HTMLDivElement
    loadingEl:       HTMLElement
    personaSelectEl: HTMLElement
    resultEl:        HTMLElement
    statusEl:        HTMLElement
    copyBtn:         HTMLButtonElement
    replaceBtn:      HTMLButtonElement
    panelBtn:        HTMLButtonElement
    followUpInput:   HTMLTextAreaElement
    actionLabelEl:   HTMLElement
    actionIconEl:    HTMLElement
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
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0 12px',
      height:         '42px',
      borderBottom:   '1px solid #2d2f45',
      flexShrink:     '0',
      cursor:         'grab',
      background:     '#141625',
    })

    // 헤더 좌측: 액션 드롭다운
    const headerLeft = document.createElement('div')
    css(headerLeft, { position: 'relative', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none' })

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
    const DROPDOWN_ACTIONS: ToolbarAction[] = ['translate', 'summarize', 'refine', 'ask']
    const actionDropdown = document.createElement('div')
    css(actionDropdown, {
      display: 'none', position: 'absolute', top: '100%', left: '0',
      zIndex: '999', background: '#141625', border: '1px solid #3d3f58',
      borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      minWidth: '120px', padding: '4px', marginTop: '4px',
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
    headerLeft.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault(); e.stopPropagation()
      actionDropdown.style.display = actionDropdown.style.display !== 'none' ? 'none' : 'block'
    })

    // 헤더 우측: 모델 뱃지 + 사이드바 열기 버튼 + 닫기
    const headerRight = document.createElement('div')
    css(headerRight, { display: 'flex', alignItems: 'center', gap: '6px' })

    // 모델 뱃지 (Gemini Nano 표시)
    const modelBadge = document.createElement('span')
    modelBadge.textContent = 'Gemini Nano'
    css(modelBadge, {
      background: '#0f111a', border: '1px solid #2d2f45', borderRadius: '4px',
      padding: '2px 7px', color: '#6c7086', fontSize: '10px', cursor: 'default',
    })

    // 사이드바 열기 버튼
    const sidebarBtn = document.createElement('button')
    sidebarBtn.title = 'Aurora 사이드바 열기'
    sidebarBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>`
    css(sidebarBtn, {
      background: 'transparent', border: 'none', color: '#6c7086',
      padding: '5px', borderRadius: '5px', cursor: 'pointer',
      display: 'flex', alignItems: 'center',
    })
    sidebarBtn.addEventListener('mouseenter', () => { sidebarBtn.style.color = '#cba6f7'; sidebarBtn.style.background = '#2d2f45' })
    sidebarBtn.addEventListener('mouseleave', () => { sidebarBtn.style.color = '#6c7086'; sidebarBtn.style.background = 'transparent' })
    sidebarBtn.addEventListener('click', () => this.openSidebar())

    // 닫기 버튼
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '×'
    css(closeBtn, {
      background: 'transparent', border: 'none', color: '#6c7086',
      cursor: 'pointer', fontSize: '18px', lineHeight: '1', padding: '0 2px',
    })
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#f38ba8' })
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#6c7086' })
    closeBtn.addEventListener('click', () => this.destroy())

    headerRight.append(modelBadge, sidebarBtn, closeBtn)
    header.append(headerLeft, headerRight)

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
    loadingText.textContent = 'GEMINI NANO 처리 중...'
    css(loadingText, { fontSize: '12px', color: '#6c7086', letterSpacing: '0.05em' })
    loadingEl.append(dotsEl, loadingText)

    // 페르소나 선택 UI
    const personaSelectEl = this.buildPersonaSelect()

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

    body.append(loadingEl, personaSelectEl, resultEl)

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
    statusEl.textContent = 'GEMINI NANO 처리 중...'
    css(statusEl, { fontSize: '11px', color: '#6c7086', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
    statusLeft.append(auroraIcon, statusEl)

    // 오른쪽: 바꾸기 | 복사 | 패널에서 계속
    const btnGroup = document.createElement('div')
    css(btnGroup, { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: '0' })

    // ↵ 바꾸기 버튼
    const replaceBtn = document.createElement('button')
    replaceBtn.textContent = '↵ 바꾸기'
    replaceBtn.disabled = true
    css(replaceBtn, {
      background: 'linear-gradient(135deg, #7c3aed, #db2777)', border: 'none',
      color: '#fff', fontSize: '11px', fontWeight: '600',
      padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', opacity: '0.4',
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
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
    styleIconBtn(copyBtn)
    copyBtn.style.opacity = '0.4'
    copyBtn.addEventListener('click', () => {
      if (!this.resultText) return
      void navigator.clipboard.writeText(this.resultText).then(() => {
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="#a6e3a1" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`
        setTimeout(() => {
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
        }, 1500)
      })
    })

    // 패널에서 계속 버튼
    const panelBtn = document.createElement('button')
    panelBtn.title = '패널에서 계속'
    panelBtn.disabled = true
    panelBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
    styleIconBtn(panelBtn)
    panelBtn.style.opacity = '0.4'
    panelBtn.addEventListener('click', () => void this.continueInPanel())

    btnGroup.append(replaceBtn, copyBtn, panelBtn)
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
      background:   '#141625',
      border:       '1px solid #2d2f45',
      borderRadius: '10px',
      padding:      '6px 10px',
      transition:   'border-color 0.15s',
    })
    inputWrap.addEventListener('focusin',  () => { inputWrap.style.borderColor = '#7c3aed' })
    inputWrap.addEventListener('focusout', () => { inputWrap.style.borderColor = '#2d2f45' })

    const followUpInput = document.createElement('textarea')
    followUpInput.placeholder = 'AI에게 추가 질문을 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)'
    followUpInput.rows = 1
    css(followUpInput, {
      width:         '100%',
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
      console.log('[AURORA] followUpInput focused')
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
    inputWrap.appendChild(followUpInput)

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
      el, header, resizeHandle,
      loadingEl, personaSelectEl, resultEl,
      statusEl, copyBtn, replaceBtn, panelBtn,
      followUpInput,
      actionLabelEl: actionLabel,
      actionIconEl,
    }
  }

  // ── 페르소나 선택 빌드 ────────────────────────────────────

  private buildPersonaSelect(): HTMLElement {
    const wrap = document.createElement('div')
    css(wrap, { display: 'none', flexDirection: 'column', gap: '8px' })

    const title = document.createElement('div')
    title.textContent = '방식 선택'
    css(title, { fontSize: '12px', color: '#6c7086', marginBottom: '4px', fontWeight: '600' })
    wrap.appendChild(title)

    for (const persona of PERSONAS) {
      const btn = document.createElement('button')
      css(btn, {
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: '3px', width: '100%', background: '#0f111a',
        border: '1px solid #2d2f45', borderRadius: '10px',
        padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
      })
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#cba6f7' })
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#2d2f45' })
      const name = document.createElement('span')
      name.textContent = persona.label
      css(name, { color: '#cdd6f4', fontSize: '13px', fontWeight: '500' })
      const desc = document.createElement('span')
      desc.textContent = persona.description
      css(desc, { color: '#6c7086', fontSize: '11px' })
      btn.append(name, desc)
      btn.addEventListener('click', () => {
        this.selectedPersona = persona
        this.hidePersonaSelect()
        void this.runAction(persona.systemPrompt, sandwichPrompt(this.sourceText))
      })
      wrap.appendChild(btn)
    }
    return wrap
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
      if ((e.target as HTMLElement).tagName === 'BUTTON' ||
          (e.target as HTMLElement).closest('button, [data-no-drag]')) return
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

      const sel = window.getSelection()
      if (!sel) return 'contenteditable: Selection API 사용 불가'

      try {
        el.focus()
        sel.removeAllRanges()
        sel.addRange(rangeClone)
        const ok = document.execCommand('insertText', false, this.resultText)
        if (!ok) {
          // execCommand 실패 시 DOM 직접 조작으로 폴백
          rangeClone.deleteContents()
          rangeClone.insertNode(document.createTextNode(this.resultText))
          sel.removeAllRanges()
        }
        el.dispatchEvent(new Event('input',  { bubbles: true }))
        return null
      } catch {
        return 'contenteditable: 바꾸기 중 오류가 발생했습니다'
      }
    }

    return '원문 선택 영역을 찾을 수 없습니다'
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
