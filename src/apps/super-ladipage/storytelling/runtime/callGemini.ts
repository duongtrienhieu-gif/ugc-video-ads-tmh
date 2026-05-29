// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — Gemini caller
//
// Thin wrapper around UGC's textGenWithFallback (low-level infra OK to
// reuse). Adds storytelling-specific timeout + label + token sizing.
//
// Storytelling pack ~10 sections × ~300-500 chars/section = ~3-5K char
// output ≈ 1-2K tokens. Gemini 2.5 Flash ~200t/s → 5-10s real call.
// Set 90s safety margin (faster than UGC's 150s because smaller payload).
// ═════════════════════════════════════════════════════════════════════

import { textGenWithFallback } from '../../services/textGenWithFallback'

const PACK_GEN_TIMEOUT_MS = 90_000

export interface CallGeminiArgs {
  geminiApiKey: string
  kieApiKey: string
  systemPrompt: string
  userPrompt: string
  /** Override default timeout (P0.5.2 mock = 0ms, prod = 90s). */
  timeoutMs?: number
  label?: string
}

/** Call Gemini with storytelling pack-gen prompt. Returns raw JSON
 *  string (caller validates + parses). KIE fallback automatic if Gemini
 *  503/overload. */
export async function callGeminiForPack(args: CallGeminiArgs): Promise<string> {
  return textGenWithFallback({
    geminiApiKey:      args.geminiApiKey,
    kieApiKey:         args.kieApiKey,
    systemInstruction: args.systemPrompt,
    prompt:            args.userPrompt,
    jsonMode:          true,
    // Output cap — 10 sections × ~500 chars × safety = ~8K chars ≈ 4K tokens
    maxOutputTokens:   6000,
    timeoutMs:         args.timeoutMs ?? PACK_GEN_TIMEOUT_MS,
    label:             args.label ?? 'storytelling-packgen',
  })
}
