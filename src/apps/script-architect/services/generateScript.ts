import type { EditableProductContext, AdaptScriptResult } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiVision } from '../../../utils/gemini'

// ── System instruction ────────────────────────────────────────────────────────

const ADAPT_SYSTEM = `You are a UGC script CLONE engineer.
Your job: take a proven winning template script and clone its EXACT structure, rhythm, and feel for a new product. The output should feel like the same person wrote both scripts.

═══════════════════════════════════════════════════════════════
CRITICAL FIDELITY RULES (this is a CLONE, not a rewrite)
═══════════════════════════════════════════════════════════════
1. LINE COUNT must match EXACTLY — count the template's lines (separated by line breaks), output the SAME number of lines. Do not add lines. Do not merge lines.
2. LINE LENGTH must roughly match — if a template line is 4 words, the output line is 4-7 words (not 20). If 15 words, the output line is 12-18 words.
3. SENTENCE STRUCTURE — if template uses "Because X, Y is going to be great because Z" — output uses the SAME pattern. Do not switch to corporate marketing voice.
4. WORD-FOR-WORD MAPPING for connectors and rhythm phrases:
   - "Let's talk about X" → "Let's talk about [NEW PRODUCT]"
   - "Because X is a Y disorder" → "Because [pain point] is a [problem type]"
   - "herbs like X, also known as Y, is going to be great because Z" → "[ingredient] like X, also known as Y, is going to be great because Z"
   - "Another great herb is X. This is known as Y, contains A, B, C." → SAME structure with new ingredient
   - "We use all of these X and more in our [product] formulas" → SAME structure
   - "which in recent clinical trial was found 70-90% effective" → "which in recent [topic] trial was found X% effective"
   - "So if you're curious about X, tap the link to take [free thing]" → SAME soft CTA structure
5. CTA TONE — match the template's CTA tone exactly. If template ends with soft helpful CTA ("tap the link to take our free assessment"), do NOT switch to hard sales ("50% off for first 50 customers!"). The CTA should feel identical in energy.
6. INGREDIENT SUBSTITUTION is the KEY mechanic:
   - If template names SPECIFIC herbs/vitamins/compounds (Motherwort, Angelica sinensis, Vitamin B12), substitute with SPECIFIC ingredients from the new product's "Ingredients" field
   - Use the actual ingredient names — do not write generic "this powerful formula contains beneficial compounds"
   - Mention ingredient origins/names exactly like template does ("from Denmark", "also known as Motherwort")
7. DO NOT add marketing language not in the template — no "amazing", "powerful", "revolutionary" unless template has them
8. REMOVE any "Hook:" / "Script:" / section labels — output plain content only

═══════════════════════════════════════════════════════════════
TRANSLATION RULES (Malay version)
═══════════════════════════════════════════════════════════════
- Translate to natural Malaysian Malay (Bahasa Malaysia), colloquial and authentic
- KEEP product name and ingredient names in original English (do not translate "INFINITY PROBIOTICS PLUS" or "Vitamin B12")
- Match line count and structure of the English version exactly
- Do NOT include section labels

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — use EXACTLY these two markers, nothing else:
═══════════════════════════════════════════════════════════════
<<<ENGLISH>>>
[adapted English script — same line count and rhythm as template]
<<<MALAY>>>
[Malaysian Malay translation — same structure]`

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(template: string, context: EditableProductContext): string {
  // Pre-compute template stats so the AI sees them explicitly
  const templateLines = template.split('\n').filter((l) => l.trim() !== '')
  const lineCount = templateLines.length
  const wordCounts = templateLines.map((l) => l.trim().split(/\s+/).length)
  const totalWords = wordCounts.reduce((a, b) => a + b, 0)

  const lines: string[] = []
  lines.push(`═══════════════════════════════════════════════════════════════`)
  lines.push(`TEMPLATE SCRIPT (this is the winning proven script — CLONE ITS STRUCTURE EXACTLY)`)
  lines.push(`Template line count: ${lineCount} non-empty lines`)
  lines.push(`Template word count: ${totalWords} words total`)
  lines.push(`Per-line word counts: [${wordCounts.join(', ')}]`)
  lines.push(`═══════════════════════════════════════════════════════════════`)
  lines.push(template)
  lines.push(``)
  lines.push(`═══════════════════════════════════════════════════════════════`)
  lines.push(`NEW PRODUCT (replace template product with this one)`)
  lines.push(`═══════════════════════════════════════════════════════════════`)
  if (context.productDescription) lines.push(`Product: ${context.productDescription}`)
  if (context.targetMarket)       lines.push(`Audience: ${context.targetMarket}`)
  if (context.painPoints)         lines.push(`Pain points to substitute: ${context.painPoints}`)
  if (context.usps)               lines.push(`USPs: ${context.usps}`)
  if (context.benefits)           lines.push(`Benefits: ${context.benefits}`)
  if (context.offer)              lines.push(`Offer: ${context.offer}`)
  if (context.ingredients)        lines.push(`★ INGREDIENTS (substitute these for template's herbs/compounds, KEEP NAMES IN ENGLISH): ${context.ingredients}`)
  lines.push(``)
  lines.push(`YOUR TASK:`)
  lines.push(`1. Output ${lineCount} non-empty lines in English — SAME COUNT as template`)
  lines.push(`2. Each line's word count should be within ±30% of the corresponding template line`)
  lines.push(`3. Match sentence patterns word-for-word where possible — only swap product-specific content`)
  lines.push(`4. Substitute template's specific ingredients/herbs with the new product's INGREDIENTS field — name them specifically, do not write generic descriptions`)
  lines.push(`5. Match CTA tone exactly — if template uses soft "tap the link to learn more", do NOT switch to hard sales`)
  lines.push(`6. After the English version, output the Malaysian Malay translation using the same line count and structure`)
  lines.push(`7. Follow the <<<ENGLISH>>> / <<<MALAY>>> output format exactly`)
  return lines.join('\n')
}

// ── Key helper ────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const store = useSettingsStore.getState()
  if (!store.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return store.getGeminiApiKey()
}

// ── Parse response ────────────────────────────────────────────────────────────

/**
 * Strip "Hook:" / "Script:" / "Section:" / numbered labels from any line.
 * Belt-and-suspenders cleanup in case Gemini ignores the system instruction.
 */
function stripSectionLabels(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // Remove labels like "Hook:", "Script:", "Hook 1:", "Script (intro):"
      // Match optional bullet/dash/number prefix, then label, then colon
      return line.replace(/^\s*[-*•]?\s*(?:Hook|Script|Section|Body|Intro|Outro|CTA|Cta)\s*\d*\s*(?:\([^)]*\))?\s*:\s*/i, '')
    })
    .join('\n')
    // Collapse 3+ consecutive blank lines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseResponse(raw: string): { english: string; malay: string } {
  const englishMatch = raw.match(/<<<ENGLISH>>>([\s\S]*?)(?:<<<MALAY>>>|$)/)
  const malayMatch   = raw.match(/<<<MALAY>>>([\s\S]*)$/)

  let english = (englishMatch?.[1] ?? '').trim()
  let malay   = (malayMatch?.[1]  ?? '').trim()

  // Fallback: if markers not found, try splitting on blank line heuristic
  if (!english && !malay) {
    const lines = raw.split('\n')
    const half  = Math.floor(lines.length / 2)
    english = lines.slice(0, half).join('\n').trim()
    malay   = lines.slice(half).join('\n').trim()
  }

  // Strip Hook:/Script: labels post-hoc (Gemini sometimes ignores instruction)
  english = stripSectionLabels(english)
  malay   = stripSectionLabels(malay)

  return { english, malay }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Single Gemini call: adapt template script for new product (English)
 * + translate to Malaysian Malay simultaneously.
 * Using maxOutputTokens: 16384 to prevent truncation on long scripts.
 */
export async function adaptAndTranslate(
  template: string,
  context: EditableProductContext,
): Promise<AdaptScriptResult> {
  const apiKey = getGeminiKey()

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: buildPrompt(template, context) }],
    systemInstruction: ADAPT_SYSTEM,
    maxOutputTokens: 16384,   // was 2048 — prevents mid-script cutoff
  })

  const { english, malay } = parseResponse(raw)

  // Validate we got something meaningful back
  if (!english || english.length < 50) {
    throw new Error('Gemini trả về kịch bản quá ngắn — thử lại hoặc rút gọn kịch bản mẫu')
  }
  if (!malay || malay.length < 50) {
    throw new Error('Gemini không dịch được sang tiếng Malay — thử lại')
  }

  return { vietnamese: english, malay }
}
