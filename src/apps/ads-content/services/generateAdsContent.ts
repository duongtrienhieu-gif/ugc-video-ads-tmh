import type {
  AdsContentGenParams, AdsContentResult, AdsContentVariation, LangMode,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import {
  getAngleById, getAdsPresetById, getPlatformById, LENGTH_OPTIONS,
} from './presets'
// Reuse the Script Engine's Malay native-voice POOLS (pure data). We DON'T
// reuse buildMsBodyVocabBlock() because that block is tuned for VIDEO scripts
// (it forces "very short 3-7 word spoken lines / whole script" rhythm). A
// readable ad CAPTION needs the native vocabulary + tone WITHOUT the choppy
// spoken cadence — so we assemble a caption-specific voice block below.
import {
  MS_PARTICLES, MS_CODESWITCH_EN, MS_HYPE, MS_NATIVE_OPENERS, MS_BLACKLIST_INDO,
} from '../../video-builder/v3/services/bodyPatternsMs'

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — elite media buyer writing scroll-stopping ad CAPTIONS.
// Timeless rules live here; the dynamic language/marker spec is built per
// request in buildUserPrompt (because it depends on langMode).
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite performance media buyer who has written over $10M in winning Facebook + TikTok DTC ecommerce ad CAPTIONS for the Southeast Asian market — Malaysia and Vietnam in particular.

You write ad CAPTIONS — the text next to a video/image creative on a feed. NOT voice-over scripts, NOT essays, NOT blog posts. The reader is scrolling FAST on a phone and SCANS before they read. If the post looks like a wall of text, they scroll past. Your job is a caption that is impossible to scroll past AND easy to scan.

═══════════════════════════════════════════════════════════════
INPUT LANGUAGE NOTE
═══════════════════════════════════════════════════════════════
The product info (productName, productDescription, painPoints, usps, benefits, offer, ingredients, usageGuide) may be written in VIETNAMESE — the operator's working language. Understand it semantically, then write OUTPUT strictly in the language(s) in the LANGUAGE OUTPUT section. Keep brand names, currencies (RM, ₫, $, ฿), and scientific ingredient names as-is.

═══════════════════════════════════════════════════════════════
FORMATTING IS RULE #1 — SCANNABLE OR IT FAILS (non-negotiable)
═══════════════════════════════════════════════════════════════
- SHORT paragraphs: 1-2 lines each, separated by BLANK LINES. NEVER a dense block of text.
- Use ✅ for benefits / what works, ❌ for the wrong way / failed alternatives, 👉 or 👇 for the CTA.
- An emoji anchor at the start of key paragraphs for visual rhythm (not every line).
- The body must be SCANNABLE: the reader should grasp the structure (contrast / list / steps) at a glance.
- Match the structure to the chosen ANGLE (see its brief): most angles are BULLET/CONTRAST/LIST-driven. ONLY the "Kể chuyện" (story) angle is flowing narrative — and even it uses short paragraphs + white space, never one block.
- NO markdown headers (#), no bullet symbols other than ✅/❌, no labels like "Hook:"/"CTA:"/"Body:".

═══════════════════════════════════════════════════════════════
OTHER NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. LINE 1 is a scroll-stopper — no warm-up, no "Hôm nay mình giới thiệu". Open mid-tension. (See HOOK LIBRARY.)
2. Use the product's REAL ingredient names — never invent, never "powerful formula".
3. NEVER claim cure / treatment / guaranteed results. Hedged verbs ("giúp / hỗ trợ / cảm thấy").
4. NEVER write ANY price or money amount — not even one that appears in the product brief. Banned: "RM29", "asal RM149", "99k", "₫299.000", "-50%", "giảm 50%", any figure with RM/₫/$/% attached to price. You MAY hint a promo exists in WORDS ONLY ("đang có ưu đãi", "promo terhad", "harga special") but NEVER the number. Close on value/urgency/FOMO, not a price.
5. The 4 variations must FEEL DIFFERENT — different hook, energy, pacing, CTA — not reworded twins.

═══════════════════════════════════════════════════════════════
HOOK LIBRARY (line-1 scroll-stoppers — a different one per variation)
═══════════════════════════════════════════════════════════════
SKEPTIC/SCAM-TEST ("Mình tưởng quảng cáo nói quá, ai dè…" · MS "Aku ingat scam, rupanya jadi.") · INSIDER-SECRET ("Có 1 chi tiết ít ai nói…" · MS "Part ni ramai seller skip.") · WRONG-WAY ("Đừng mua thêm cho tới khi đọc cái này.") · CURIOSITY LOOP (open a question, pay it off LATER) · DISCOVERY ("Tình cờ tìm ra…") · COMPARISON SHOCK.
Rules: ≤ ~16 words, ABOUT this product, no fabricated numbers. If a loop is opened, the body must pay it off — concisely.

Avoid robotic textbook copy, but DO stay tight and scannable: punchy is good, long-winded storytelling for a non-story angle is a FAIL.`

// ─────────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

/** Normalised angle: prefer the new ADS_ANGLES, fall back to a legacy preset id. */
function resolveAngle(presetId: string) {
  const angle = getAngleById(presetId)
  if (angle) {
    return {
      label: angle.label, glyph: angle.glyph, briefEn: angle.briefEn,
      educational: angle.educational, defaultLength: angle.defaultLength,
      defaultCta: angle.defaultCta,
    }
  }
  const legacy = getAdsPresetById(presetId)
  if (legacy) {
    return {
      label: legacy.label, glyph: legacy.glyph, briefEn: legacy.briefEn,
      educational: legacy.category === 'mechanism',
      defaultLength: 'medium' as const, defaultCta: 'balanced' as const,
    }
  }
  return null
}

// Caption-tuned Malay native voice — reuses the Script Engine's pools but
// keeps a READABLE ad-post cadence (no choppy spoken-video rhythm). This is
// what makes MS read native without becoming a fragmented voice-over.
function buildMsCaptionVoice(): string {
  return [
    '*** GIỌNG MALAY BẢN ĐỊA (caption — vẫn phải DỄ QUÉT, không phải lời nói trong video) ***',
    `- END-PARTICLES (rải 2-3 cho CẢ bài, KHÔNG phải mỗi dòng — mỗi dòng = giả): ${MS_PARTICLES.join(', ')}.`,
    `- KEEP these English words in English (Malaysians code-switch naturally): ${MS_CODESWITCH_EN.join(', ')}.`,
    '- PRONOUN — pick ONE, keep consistent: "aku"+"korang" casual/affordable; "saya" older/higher-value; "sis" women\'s beauty; "boss"/"bro" men\'s gadgets.',
    `- HYPE markers (punchy, sparing): ${MS_HYPE.join(', ')}.`,
    `- Natural openers ok: ${MS_NATIVE_OPENERS.slice(0, 8).join(', ')}.`,
    `- NEVER Indonesian words (instant fake giveaway): ${MS_BLACKLIST_INDO.join(', ')} — use Malay (tak, korang, je, dah).`,
    '- NO textbook/formal BM ("anda/saudara/kami selaku"), NO word-by-word translation from Vietnamese, NO TV-commercial tone.',
    '- BUT this is a CAPTION TO READ: write smooth, complete sentences with white space + the ✅/❌/👉 structure. Do NOT chop it into short rapid spoken fragments.',
    'Target voice: a real Malaysian creator writing a tidy, scannable post for a friend.',
  ].join('\n')
}

// ── Language + output-marker spec (dynamic per langMode) ───────────────────
// Titles are written in the SEND language (MS for the MY market, VN otherwise)
// with a faithful VN gloss whenever MS is output, so the VN operator
// understands what they're posting.

function buildLanguageSpec(langMode: LangMode): string {
  const wantVN = langMode === 'vi' || langMode === 'both'
  const wantMS = langMode === 'ms' || langMode === 'both'
  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('LANGUAGE OUTPUT')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (wantVN) {
    lines.push('Vietnamese: natural VN ecommerce ad voice, informal "mình/bạn", local creator tone (not corporate), proper VN punctuation (… not ...).')
  }
  if (wantMS) {
    lines.push('Bahasa Malaysia: follow the MS NATIVE VOICE block below EXACTLY — this is the difference between a real Malaysian creator and machine-translated BM.')
    lines.push('')
    lines.push(buildMsCaptionVoice())
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('TITLES (headlines to post alongside the video)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('For EACH variation, write EXACTLY 3 BOLD scroll-stopping TITLES (each ~6-16 words) — sensational, high-shock / high-curiosity headlines a creator pins above the video to STOP the thumb dead. Make them provocative and emotionally charged: shock framing, bold call-out, a curiosity gap, "wait what" energy. Each title a DIFFERENT angle. No quotes, no numbering.')
  lines.push('HARD RULE — NEVER invent numbers, stats, percentages or rankings: use a number ONLY if it literally appears in the product brief; otherwise use NO number. No fake "#1", no made-up "10,000 users / 98%". Stay advertorial-safe — shocking in framing, but NO cure / guaranteed-result claims.')
  if (wantMS) {
    lines.push('Write the titles in Bahasa Malaysia. Format EACH title line as: <Malay title> :: <faithful Vietnamese meaning>  (the part after :: lets the VN operator understand it).')
  } else {
    lines.push('Write the titles in Vietnamese.')
  }

  // Output markers
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('OUTPUT FORMAT — use these markers EXACTLY, nothing else')
  lines.push('═══════════════════════════════════════════════════════════════')
  const block: string[] = ['<<<VARIATION 1>>>', '<<<ANGLE>>>', '[3-6 word English label of this variation\'s hook angle]', '<<<TITLES>>>', '[2-3 title lines as specified above]']
  if (wantVN) { block.push('<<<VN>>>', '[Vietnamese caption]') }
  if (wantMS) {
    block.push('<<<MY>>>', '[Bahasa Malaysia caption]')
    block.push('<<<MY_GLOSS>>>', '[faithful Vietnamese translation of the MY caption — by meaning & vibe, NOT word-by-word; keep code-switched English; render slang naturally (e.g. "padu/power" → "đỉnh/xịn", "racun" → "gây nghiện"). For the VN operator to understand.]')
  }
  lines.push(block.join('\n'))
  lines.push('')
  lines.push('Repeat the SAME marker structure for <<<VARIATION 2>>>, <<<VARIATION 3>>> and <<<VARIATION 4>>>.')
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────

function buildUserPrompt(params: AdsContentGenParams): string {
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const angle = resolveAngle(params.presetId)
  if (!angle) throw new Error(`Góc tiếp cận không tồn tại: ${params.presetId}`)

  const platform = getPlatformById(params.platform)
  if (!platform) throw new Error(`Platform không tồn tại: ${params.platform}`)

  // Smart defaults from the angle (UI no longer asks for length/CTA/edu).
  const effLength = angle.defaultLength
  const lengthOpt = LENGTH_OPTIONS.find((l) => l.id === effLength) ?? LENGTH_OPTIONS[1]
  const effCta = angle.defaultCta
  const educationalActive = angle.educational || params.educationalMode

  const ctaBrief =
    effCta === 'soft'
      ? 'CTA strength: SOFT — gentle invitation, no pressure ("link in bio kalau berminat").'
      : effCta === 'hard'
        ? 'CTA strength: HARD — direct, urgent, scarcity only if the brief states a real deal.'
        : 'CTA strength: BALANCED — confident, direct, no pressure tactics.'

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT (use real fields, never invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.painPoints)         lines.push(`Pain points: ${product.painPoints}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer (a promo EXISTS — but DO NOT write any price/amount/number/percentage from this in the output; only hint a deal exists in words): ${product.offer}`)
  if (product.ingredients)        lines.push(`★ Ingredients & mechanism (name specifically + how they work — never generic): ${product.ingredients}`)
  if (product.usageGuide)         lines.push(`How to use (ground any how-to/demo angle in this, don't recite verbatim): ${product.usageGuide}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`ANGLE — ${angle.label}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(angle.briefEn)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`PLATFORM — ${platform.label}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(platform.promptHint)

  lines.push('')
  lines.push(`Target length: ~${lengthOpt.targetWords} words per caption (${lengthOpt.label}).`)
  lines.push(ctaBrief)

  if (educationalActive) {
    lines.push('')
    lines.push('EDUCATIONAL SELLING — ON. Build BELIEF: WHY the problem happens, HOW 1-2 named ingredients work, WHY this differs from the category default. Conversational analogies, plain language. NEVER medical-textbook, NEVER cure claims.')
  }

  lines.push('')
  lines.push(buildLanguageSpec(params.langMode))

  lines.push('')
  lines.push('Generate EXACTLY 4 distinct variations. Each: a different hook from the library, different emotional energy, pacing, and CTA.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Parse variations. Tolerant of marker whitespace/case.
// ─────────────────────────────────────────────────────────────────────────

const ALL_MARKERS = ['ANGLE', 'HOOK', 'TITLES', 'VN', 'MY', 'MY_GLOSS', 'VARIATION']

function extractMarkerBlock(text: string, marker: string): string {
  const startRe = new RegExp(`<<<\\s*${marker}\\s*>>>`, 'i')
  const startMatch = startRe.exec(text)
  if (!startMatch) return ''
  const after = text.slice(startMatch.index + startMatch[0].length)
  let nearest = after.length
  for (const m of ALL_MARKERS) {
    if (m === marker) continue
    const re = new RegExp(`<<<\\s*${m}\\s*>>>`, 'i')
    const found = re.exec(after)
    if (found && found.index < nearest) nearest = found.index
  }
  return after.slice(0, nearest).trim()
}

/** Split the TITLES block into titles + optional VN gloss (split on " :: "). */
function parseTitles(block: string): { titles: string[]; glosses: string[] } {
  const titles: string[] = []
  const glosses: string[] = []
  for (const raw of block.split('\n')) {
    const line = raw.replace(/^[\s\-*•\d.)]+/, '').trim()
    if (!line) continue
    const idx = line.indexOf('::')
    if (idx >= 0) {
      titles.push(line.slice(0, idx).trim())
      glosses.push(line.slice(idx + 2).trim())
    } else {
      titles.push(line)
    }
  }
  return { titles: titles.slice(0, 3), glosses: glosses.slice(0, 3) }
}

function parseVariations(raw: string, langMode: LangMode): AdsContentVariation[] {
  const variations: AdsContentVariation[] = []
  const chunkRe = /<<<\s*VARIATION\s*(\d+)\s*>>>/gi
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = chunkRe.exec(raw))) indices.push(m.index)
  if (indices.length === 0) return variations

  const wantVN = langMode === 'vi' || langMode === 'both'
  const wantMS = langMode === 'ms' || langMode === 'both'

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : raw.length
    const chunk = raw.slice(start, end)

    const angleLabel = extractMarkerBlock(chunk, 'ANGLE') || extractMarkerBlock(chunk, 'HOOK')
    const { titles, glosses } = parseTitles(extractMarkerBlock(chunk, 'TITLES'))
    const vn = wantVN ? extractMarkerBlock(chunk, 'VN') : ''
    const my = wantMS ? extractMarkerBlock(chunk, 'MY') : ''
    const myGloss = wantMS ? extractMarkerBlock(chunk, 'MY_GLOSS') : ''

    // A variation is valid if at least one requested caption came through.
    const ok = (wantVN ? !!vn : true) && (wantMS ? !!my : true) && (vn || my)
    if (!ok) continue

    variations.push({
      id: crypto.randomUUID(),
      hookLabel: angleLabel || `Variation ${i + 1}`,
      titles: titles.length ? titles : [],
      titlesGlossVi: glosses.length ? glosses : undefined,
      vietnamese: vn,
      malay: my,
      malayGlossVi: myGloss || undefined,
    })
  }

  return variations
}

// ─────────────────────────────────────────────────────────────────────────

export async function generateAdsContent(params: AdsContentGenParams): Promise<AdsContentResult> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  const angle = resolveAngle(params.presetId)
  if (!angle) throw new Error(`Góc tiếp cận không hợp lệ: ${params.presetId}`)
  const platform = getPlatformById(params.platform)
  if (!platform) throw new Error(`Platform không hợp lệ: ${params.platform}`)

  const userPrompt = buildUserPrompt(params)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 4 variations × (caption + MS gloss + 3 titles) is long. Without
    // thinkingBudget:0, gemini-2.5-flash spends the output budget on "thinking"
    // and the response truncates at variation 2-3 (only 2 parsed). Disable
    // thinking + raise the cap so all 4 come through in full.
    maxOutputTokens: 16384,
    thinkingBudget: 0,
  })

  const variations = parseVariations(raw, params.langMode)
  if (variations.length === 0) {
    throw new Error('Gemini không trả về variation hợp lệ — thử lại')
  }

  return {
    variations,
    presetId: params.presetId,
    presetLabel: angle.label,
    presetGlyph: angle.glyph,
    platform: params.platform,
    platformLabel: platform.label,
    langMode: params.langMode,
    lengthMode: angle.defaultLength,
    toneIds: params.toneIds,
    ctaStrength: angle.defaultCta,
    educationalMode: angle.educational || params.educationalMode,
    productId: params.productId,
    productName: product.productName,
    generatedAt: Date.now(),
  }
}
