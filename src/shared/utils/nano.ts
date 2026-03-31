// ══════════════════════════════════════════════════════════
//  Aurora — Nano 공용 유틸
//  한국어 ↔ 영어 파이프라인 (Tree of Thoughts 구조)
//  한국어 입력 → 영어 캡슐 프롬프트 → Nano → 한국어 답변
// ══════════════════════════════════════════════════════════

// Chrome 146+ 최신 LanguageModel API 타입
export declare const LanguageModel: {
  create(options?: {
    systemPrompt?: string
    expectedOutputs?: Array<{ type: string; languages: string[] }>
    temperature?: number
    topK?: number
  }): Promise<{
    prompt(input: string): Promise<string>
    destroy(): void
  }>
}

// [STRICT LANGUAGE RULE] — 영어 시스템 프롬프트로 한국어 강제
export const NANO_SYSTEM_PROMPT_KO =
  "You are a brilliant AI assistant. " +
  "Think in English internally for optimal logic and accuracy. " +
  "However, you MUST output your FINAL answer ENTIRELY in Korean (한국어). " +
  "Never output Japanese (日本語). Never output English in the final answer. " +
  "Korean output only. This is a strict requirement."

// Nano 세션 생성 — 최신 API 규격 (outputLanguage 경고 완전 차단)
export async function createNanoSession(customSystemPrompt?: string) {
  return LanguageModel.create({
    systemPrompt: customSystemPrompt ?? NANO_SYSTEM_PROMPT_KO,
    expectedOutputs: [{ type: "text", languages: ["en"] }],
    temperature: 0.6,
    topK: 5,
  })
}

// 한국어 입력 ➔ 영어 캡슐 ➔ Nano ➔ 한국어 답변
// Tree of Thoughts: 논리는 영어로, 출력은 한국어로
export function buildKoreanCapsulePrompt(
  koreanInput: string,
  taskInstruction: string
): string {
  return (
    `[TASK]\n${taskInstruction}\n\n` +
    `[INPUT TEXT - Process this Korean text]\n` +
    `"""\n${koreanInput}\n"""\n\n` +
    `[OUTPUT REQUIREMENT]\n` +
    `- Think step by step in English\n` +
    `- Write ONLY the final result in Korean inside [RESULT][/RESULT] tags\n` +
    `- No English in the output\n` +
    `[RESULT]`
  )
}

// 다듬기(Refine) 전용 캡슐 프롬프트 — 반말/존댓말 자동 감지 + 유지
export function buildRefinePrompt(koreanInput: string): string {
  return buildKoreanCapsulePrompt(
    koreanInput,
    "Polish and refine the Korean text below. " +
    "CRITICAL: First detect the speech level: if the text uses INFORMAL Korean " +
    "(반말: ~다/~어/~야/~지 endings), output in INFORMAL Korean only. " +
    "If the text uses FORMAL Korean (존댓말: ~요/~습니다 endings), output in FORMAL Korean only. " +
    "Fix awkward phrasing, grammar errors, unclear expressions. " +
    "Keep the original meaning, tone, and speech level EXACTLY as detected. " +
    "Never change informal to formal or formal to informal."
  )
}

// 번역 전용 프롬프트 — 반말/존댓말 자동 감지 + 유지
export function buildTranslatePrompt(
  inputText: string,
  targetLanguage: string
): string {
  const targetInstruction =
    targetLanguage === '자동 감지'
      ? "Detect the source language and translate to the most appropriate language (if Korean → English, if English → Korean, otherwise → Korean)."
      : `Translate to ${targetLanguage}.`

  return (
    `[TASK]\n` +
    `${targetInstruction}\n` +
    `CRITICAL FORMALITY RULE: ` +
    `Detect speech level in source text. ` +
    `If source uses INFORMAL style (반말: ~다/~어/~야 endings), use INFORMAL in translation. ` +
    `If source uses FORMAL style (존댓말: ~요/~습니다 endings), use FORMAL in translation. ` +
    `Preserve the original speech register EXACTLY.\n\n` +
    `[INPUT TEXT]\n"""\n${inputText}\n"""\n\n` +
    `[OUTPUT]\nWrite ONLY the translation inside [RESULT][/RESULT] tags.\n[RESULT]`
  )
}
