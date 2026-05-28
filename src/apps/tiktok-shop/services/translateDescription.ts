// Description translator — sends the assembled description text through
// kieTextGenerate (Gemini Flash via kie.ai) to convert MS ↔ VN while
// preserving structure (emojis, headings, bullet markers, **bold** markdown).
//
// Cost: ~1 credit per translate. Single API call, no batching.

import { kieTextGenerate } from '../../../utils/kieai'
import type { Market } from '../../../types/brandKit'

export interface TranslateParams {
  apiKey: string
  /** The full assembled description text (with emojis, bullets, **bold**) */
  sourceText: string
  /** Source language — what the text is currently in */
  sourceLang: Market
  /** Target language — what to translate to */
  targetLang: Market
}

export async function translateDescriptionText(params: TranslateParams): Promise<string> {
  if (params.sourceLang === params.targetLang) return params.sourceText

  const sourceName = langName(params.sourceLang)
  const targetName = langName(params.targetLang)

  const systemInstruction = `You are a professional TikTok Shop copywriter for the Malaysia and Vietnam markets. Translate product listing descriptions naturally — like a native local seller would write, NOT machine-translated.

OUTPUT LANGUAGE: ${targetName} ONLY. No mixing.
PRESERVE STRUCTURE EXACTLY:
- Keep all emojis in the same positions
- Keep bullet markers (•) and numbering (1. 2. 3.)
- Keep **markdown bold** markers around the same emphasized terms
- Keep line breaks and section spacing
- Keep section headers (e.g. "ANDA SEDANG", "KENAPA PILIH...") translated
- Keep brand names + product names unchanged (do NOT translate them)
- Keep prices unchanged (RM 89, 500K, etc.)
- Keep "Q:" / "A:" prefixes in FAQ blocks

DO NOT add commentary, headers, or notes. Output ONLY the translated text.`

  const prompt = `Translate the following TikTok Shop product description from ${sourceName} to ${targetName}, preserving all formatting exactly:

---
${params.sourceText}
---

Output the translated text only, no preamble.`

  const translated = await kieTextGenerate(params.apiKey, prompt, systemInstruction)
  return translated.trim()
}

function langName(m: Market): string {
  return m === 'ms' ? 'Bahasa Malaysia' : 'Vietnamese (with proper diacritics)'
}
