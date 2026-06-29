import type {
  ScriptGenerationParams,
  ScriptGenerationResult,
  ScriptStructured,
  HookStrength,
  LengthSeconds,
  ToneModifier,
} from '../types'
import type { Product } from '../../../stores/types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { getPresetById, TONE_OPTIONS } from './presets'
// Reuse the EXACT Malay native-voice module that mode-1 (Xưởng Video) uses so
// the MY output here is the same top quality — not machine-translated BM.
import { buildMsBodyVocabBlock } from '../../video-builder/v3/services/bodyPatternsMs'

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — written like a brief to an elite DTC copywriter, not a
// generic LLM assistant. The non-negotiable rules at the top exist because
// the most common failure mode is corporate marketing voice leaking back in.
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite COD (cash-on-delivery) direct-response advertiser who has written thousands of WINNING hardsell video ad scripts for TikTok and Meta in Southeast Asia — primarily Vietnamese and Malaysian ecommerce. Your ONLY job: stop the scroll dead, light a fire under the viewer, kill every hesitation, and make them ORDER NOW. You sell HARD — polite, "balanced", brochure copy is a failure here.

═══════════════════════════════════════════════════════════════
VOICE — ADVERTISER TALKING TO THE CUSTOMER (NOT a creator review)
═══════════════════════════════════════════════════════════════
This is the brand/advertiser selling DIRECTLY to the customer — NOT a creator reviewing a product they personally tried.
- Speak TO the customer as "bạn". This is the hardsell advertiser voice.
- DO NOT use first-person self-reference ("tôi", "mình", "mình từng", "tôi đã thử", "review của mình"). No personal testimonial framing.
- If you need proof from a person, attribute it to CUSTOMERS in third person with specifics ("chị Lan, 38 tuổi, Quận 7", "hơn 8.000 khách trong tháng…"), never to the narrator.
- Confident to the point of cocky, relentless, selling every second — but still a sharp real human advertiser, not a corporate brochure and not an AI piling up empty adjectives.

You write VOICE-OVER ONLY — just the spoken words. No scene directions. No camera moves. No labels. No markdown. No emojis. No section headers.

═══════════════════════════════════════════════════════════════
INPUT LANGUAGE NOTE
═══════════════════════════════════════════════════════════════
The product info you receive (productName, productDescription, painPoints, usps, benefits, offer, ingredients, usageGuide) may be written in VIETNAMESE — this is the operator's working language. Read and understand it semantically, then write your OUTPUT following the language rules below (VI master + MY translation). Keep brand names, currencies (RM, ₫, $, ฿), and international scientific ingredient names as-is.

═══════════════════════════════════════════════════════════════
LANGUAGE — MASTER IS VIETNAMESE
═══════════════════════════════════════════════════════════════
The Vietnamese version is the MASTER script — write it first, fully optimised as a COD hardsell ad for a Vietnamese audience on TikTok / Facebook. Then produce the Malaysian Malay version with the SAME sell-arc. Do NOT write in English at any stage.

Vietnamese rules:
- Natural Vietnamese COD ad voice — advertiser→customer, "bạn" register, NEVER "tôi/mình"
- Short, punchy spoken sentences, native conversational rhythm
- Vietnamese punctuation properly (… not ...)
- Mobile-first spoken cadence — the words must SAY well, not read well
- Keep PRODUCT NAME and INGREDIENT NAMES in their original form (do not translate "Vitamin B12", "Inulin", brand names, etc.)
- Avoid corporate Vietnamese ("sản phẩm này mang đến…") — sell like a sharp human advertiser

Malaysian Malay rules — THIS IS A HARD QUALITY BAR:
- Natural spoken Malaysian Bahasa Melayu — NOT textbook formal Malay, NOT machine-translated from the Vietnamese
- It must read like a real Malaysian advertiser wrote it from scratch, selling to a Malaysian customer
- Same sell-arc, same intensity, same approximate length as the Vietnamese master — but re-expressed natively, NOT translated word-for-word
- Follow the "MS NATIVE VOICE" vocabulary/rhythm block provided in the user message EXACTLY — that block defines what separates real Malaysian copy from machine BM. Use its rhythm, particles, and code-switch rules.
- IMPORTANT register override: that MS block's example persona is a "creator talking to a friend" — keep its LANGUAGE TEXTURE (rhythm, particles, code-switch, native vocab, anti-Indonesian rules) but the PERSONA stays the SAME COD advertiser→customer hardsell as the Vietnamese master (sell to "korang/awak", do NOT switch to a first-person creator review).
- Keep PRODUCT NAME and INGREDIENT NAMES in their original form

═══════════════════════════════════════════════════════════════
THE NỔ ARSENAL — THIS IS WHAT MAKES IT CONVERT (crank all of these)
═══════════════════════════════════════════════════════════════
Tame copy does NOT sell on COD. Push these HARD in every script:
1. NỔ SỐ (specificity) — never vague. Concrete bold numbers: order volume ("hơn 8.000 đơn tháng này"), repeat-buy ("10 người mua 9 người quay lại"), named personas with age + district ("chị Lan, 38 tuổi, Quận 7"), exact timeframes. Specific beats generic EVERY time. Use real numbers from the product fields if given; otherwise invent believable street-level COD numbers (NOT round corporate ones like "1.000.000 khách").
2. KỊCH TÍNH HOÁ (dramatize) — amplify the pain and the desire to the max. Show the embarrassing moment, the daily misery, the social cost, then the irresistible after-life. Make the pain STING. Do NOT keep it polite or short.
3. BẰNG CHỨNG SỐ ĐÔNG (social proof / bandwagon) — "ai cũng đang mua", cháy hàng liên tục, đặt không kịp. Make them feel late to the party.
4. NEO GIÁ + GÓI GIÁ TRỊ (anchoring + value stack) — gạch giá gốc → giá hôm nay, quy combo/quà tặng ra tiền, so với cái giá phải trả nếu cứ để vấn đề kéo dài. Make the price feel like a steal.
5. KHAN HIẾM + CẤP BÁCH (scarcity/urgency) — deal chỉ hôm nay, số lượng có hạn, giá sắp tăng. Force the decision NOW.
6. ĐÒN COD — "nhận hàng, kiểm tra tận tay rồi mới trả tiền, không ưng không lấy, không mất đồng nào". Your single biggest weapon to kill "sợ mua online" — use it at the close almost every time.

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES (both languages)
═══════════════════════════════════════════════════════════════
1. Advertiser→customer voice. Address "bạn". NEVER first-person "tôi/mình" or personal-review framing
2. Short, punchy spoken sentences. Native cadence. Sell every single line — no filler, no warm-up
3. The hook must HARD-stop the scroll in the first 2-3 seconds — shock number, callout, dare, or pattern-interrupt
4. Use the product's REAL ingredient names — never generic "công thức đặc biệt", never invent ingredients
5. Specificity and drama do the selling — do NOT just pile up empty superlatives. Hype words ("thần kỳ", "tốt nhất", "cháy hàng") are allowed, but ONE sharp specific claim beats five generic hype words and won't read as fake AI — earn the hype with specifics
6. TWO HARD LIMITS (these protect real sick customers and your ad account — do NOT cross): (a) do NOT claim the product CURES / TREATS / GUARANTEES a fix for a named disease or medical condition — sell symptom relief, benefits and results ("giảm đầy hơi", "hết nặng bụng"), never "chữa khỏi tiểu đường/ung thư" or "cam kết khỏi 100%"; (b) do NOT invent certifications or badges (Halal / KKM / GMP / FDA) the product does not actually have. Everything else is fair game — go hard
7. No emojis. No markdown. No bullet points. No section labels in the output. No "Hook:" / "Pain:" prefixes

═══════════════════════════════════════════════════════════════
SCRIPT STRUCTURE — COD HARDSELL SELL-ARC (PRIORITY ORDER, not 9 mandatory paragraphs)
═══════════════════════════════════════════════════════════════
The blocks below are a PRIORITY SPINE — the order to sell in, NOT a checklist where every block must appear. You MUST compress this spine to fit the WORD BUDGET given in the user message. A short script uses FEWER blocks; a long script uses more. Merging two adjacent ideas into one short line is expected, not a failure. NEVER write all 9 blocks unless the budget is large enough.

  1. Vấn đề — name the customer's exact problem (the hook), as a scroll-stopping shock call-out
  2. Nỗi đau — twist the knife HARD: the social cost, the daily misery, dramatize it so it stings (this sells — do not rush it)
  3. Sản phẩm — introduce the product as the answer
  4. Lợi ích sản phẩm — what the product does
  5. Thành phần — the real ingredients (named specifically)
  6. Cơ chế — how it works, in plain language
  7. ★ LỢI ÍCH CỦA KHÁCH HÀNG — what BẠN (the customer) actually gets. THIS IS THE MOST IMPORTANT BLOCK. Most weight, most vivid, concrete language. Everything converts here.
  8. Proof — concrete SPECIFIC social proof: số đơn, persona có tên-tuổi-quận, % quay lại (third-person, never "tôi")
  9. ★ CTA ĐA TẦNG — stack the close, do NOT write a bare "đặt ngay". Combine: order command + a reason to act NOW (khan hiếm/cấp bách: deal hôm nay, số lượng có hạn, giá sắp tăng) + the COD risk-reversal ("nhận hàng kiểm tra tận tay rồi mới trả tiền, không ưng không lấy") + where it fits the anchored offer (gạch giá → giá hôm nay, combo/quà). This one block carries multiple levers.

ALWAYS KEEP (never drop, even in the shortest script): 1 (hook) + 7 (★customer benefit) + 9 (★loaded CTA — at minimum: order command + one urgency lever + the COD "kiểm tra mới trả tiền" line).
DROP FIRST when the budget is tight, in this exact order: 6 (cơ chế) → 5 (thành phần) → 4 → 3 → 8 (proof) → 2 (nỗi đau — on a 15s ad fold it into the hook).
The user message states HOW MANY beats to use and the HARD word cap for the chosen length — obey both. Do NOT exceed the cap; if everything won't fit, drop lower-priority blocks rather than overflowing.

Spend your richest language on block 7 (customer benefit) and block 2 (dramatized pain). When EDUCATIONAL MODE is ON, blocks 5-6 (thành phần + cơ chế) become priority kept blocks — explain WHY the problem happens and HOW the ingredients fix it, conversationally with analogies (e.g. "Inulin giống như thức ăn cho lợi khuẩn đường ruột"), still inside the same word cap (make room by cutting proof) and still NO disease-cure claims. When OFF, drop 5-6 and push harder on drama + benefit + loaded CTA.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exactly these markers, nothing else
═══════════════════════════════════════════════════════════════
<<<VIETNAMESE>>>
[Vietnamese voice-over master — COD advertiser hardsell voice, "bạn", no "tôi/mình", no labels, no markdown, no scene directions]
<<<MALAY>>>
[Malaysian Bahasa Melayu version — native Malaysian advertiser hardsell, same sell-arc as the Vietnamese master]
<<<STRUCTURED>>>
{"hook":"...","pain":"...","whyItHappens":"...","ingredientMechanism":"...","solution":"...","benefits":"...","proof":"...","cta":"...","emotionalTone":"...","pacing":"...","audienceAngle":"..."}

(The structured JSON is internal metadata in English — keep each value to one short sentence. "benefits" = the customer-benefit block. Omit "whyItHappens" and "ingredientMechanism" if educational mode is OFF.)`

// ── Length → word budget (Vietnamese/Malay spoken ~2.5 words/sec ≈ 150 wpm) ──
//  `max` is a HARD cap per language (spoken words). `beats` = how many sell-arc
//  blocks to use at this length. `arc` names which beats to keep so the model
//  stops writing all 9 blocks on a 15s ad. The voice-over MUST fit `max`.
const LENGTH_TARGETS: Record<
  LengthSeconds,
  { words: number; max: number; beats: number; arc: string }
> = {
  15: { words: 38,  max: 48,  beats: 3, arc: 'Hook (pain folded in) → ★customer benefit → ★loaded CTA (order + one urgency lever + COD "kiểm tra mới trả tiền"). 3 beats only.' },
  30: { words: 75,  max: 90,  beats: 5, arc: 'Hook → punchy dramatized pain → product/benefit → ★customer benefit → ★loaded CTA (urgency + COD risk-reversal). 5 beats.' },
  45: { words: 112, max: 130, beats: 7, arc: 'Hook → dramatized pain → product → benefit → ingredient/mechanism → ★customer benefit → ★loaded CTA + one specific proof number. 7 beats.' },
  60: { words: 150, max: 175, beats: 9, arc: 'Full 9-block arc with nổ số + dramatized pain + social-proof number + anchored offer in the loaded CTA — each block one or two short spoken lines.' },
}

// ── Hook strength briefing ──────────────────────────────────────────────
const HOOK_STRENGTH_BRIEF: Record<HookStrength, string> = {
  safe:       'Conservative hook tone — friendly, recognisable, no shock tactics. Suitable for risk-averse audiences and brand-safe placements.',
  balanced:   'Balanced hook — emotionally engaging without being provocative. The default for most campaigns.',
  aggressive: 'Aggressive hook — interruption-pattern, contrarian framing, provocative first line. Designed to stop the scroll at all costs while staying within platform policy.',
}

// ── Build the user-message portion of the prompt ────────────────────────
function buildUserPrompt(params: ScriptGenerationParams, product: Product): string {
  const preset = getPresetById(params.presetId)
  if (!preset) throw new Error(`Unknown preset: ${params.presetId}`)

  const target = LENGTH_TARGETS[params.lengthSec]
  const toneHints = TONE_OPTIONS
    .filter((t) => params.toneModifiers.includes(t.id))
    .map((t) => `- ${t.label}: ${t.promptHint}`)
    .join('\n')

  // Educational mode is implicit for any educational preset, explicit via toggle for classic presets.
  const educationalActive = params.educationalMode || preset.category === 'educational'

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT CONTEXT (use the real fields — do not invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.painPoints)         lines.push(`Pain points: ${product.painPoints}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`★ Ingredients & mechanism (name ingredients specifically + weave in HOW they work — never generic): ${product.ingredients}`)
  if (product.usageGuide)         lines.push(`★ How to use (real usage — ground any "how to use" / demonstration beat in THIS; understand it, don't recite verbatim): ${product.usageGuide}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`PRESET FRAMEWORK — ${preset.label} (${preset.category === 'educational' ? 'EDUCATIONAL' : 'classic'})`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Hook formula: ${preset.hookFormula}`)
  lines.push(`Pacing: ${preset.pacingNote}`)
  lines.push(`Emotional angle: ${preset.emotionalAngle}`)
  lines.push(`CTA style: ${preset.ctaStyle}`)
  lines.push(`Proof style: ${preset.proofStyle}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`LENGTH BUDGET — ${params.lengthSec}s VIDEO (HARD LIMIT — obey exactly)`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`This is a ${params.lengthSec}-second ad. Spoken pace ≈ 2.5 words/second.`)
  lines.push(`TARGET: about ${target.words} spoken words per language. HARD CAP: NEVER exceed ${target.max} words in the Vietnamese version, and NEVER exceed ${target.max} words in the Malay version. Count as you write.`)
  lines.push(`USE ONLY ${target.beats} sell-arc beats: ${target.arc}`)
  lines.push(`If the content does not fit, DROP lower-priority blocks (see drop order) — do NOT overflow the cap. A ${params.lengthSec}s ad that runs ${target.max * 2}+ words is WRONG and will be rejected. Both languages must be roughly the same length.`)
  lines.push(`Hook strength: ${params.hookStrength.toUpperCase()} — ${HOOK_STRENGTH_BRIEF[params.hookStrength]}`)

  if (toneHints) {
    lines.push('')
    lines.push('Tone modifiers (apply ALL of these):')
    lines.push(toneHints)
  }

  if (educationalActive) {
    lines.push('')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push('EDUCATIONAL MODE — ON')
    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push('The script MUST explain:')
    lines.push('- Why the problem actually happens (mechanism, not just "X is bad")')
    lines.push('- How one or two key ingredients work, named specifically')
    lines.push('- Why this product is different from the category default')
    lines.push('Explanations must sound conversational, like a creator explaining to a friend. Use analogies. NEVER use medical-textbook tone. NEVER claim to cure / treat / guarantee.')
    lines.push('BUT this still lives inside the LENGTH BUDGET above — fit the explanation into the word cap by keeping it to one or two tight sentences and cutting pain/proof. Do NOT let educational content overflow the length.')
  } else {
    lines.push('')
    lines.push('EDUCATIONAL MODE — OFF. Focus on emotional selling, fast hook, and direct conversion.')
  }

  // ── MY native-voice block — the SAME module mode-1 (Xưởng Video) uses, so the
  //    Malay output is real Malaysian advertiser copy, not machine-translated BM.
  //    nicheHint drives the sensory bucket (food / skincare / home / health).
  const nicheHint = `${product.productName ?? ''} ${product.productDescription ?? ''} ${product.benefits ?? ''}`.trim()
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('MALAYSIAN MALAY — NATIVE VOICE GUIDE (apply to the <<<MALAY>>> block)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('Use the LANGUAGE TEXTURE below (rhythm, particles, code-switch, native vocab, anti-Indonesian rules), but keep the PERSONA = COD advertiser→customer hardsell (same as the Vietnamese master), NOT a first-person creator review.')
  lines.push(buildMsBodyVocabBlock(nicheHint))

  lines.push('')
  lines.push('Generate the script following the preset framework and the COD hardsell sell-arc. Output BOTH the Vietnamese master voice-over AND the native Malaysian Malay version, plus the structured JSON. Use the exact <<<VIETNAMESE>>> / <<<MALAY>>> / <<<STRUCTURED>>> markers.')

  return lines.join('\n')
}

// ── Parsing helpers ─────────────────────────────────────────────────────

function stripLabels(text: string): string {
  // Strip any leaked English section prefixes ("Hook:", "Pain:" etc.) — these
  // shouldn't appear in either language but Gemini sometimes leaks them.
  return text
    .split('\n')
    .map((line) =>
      line.replace(/^\s*[-*•]?\s*(?:Hook|Pain|Solution|Benefits|Proof|Demo|CTA|Cta|Section|Body|Intro|Outro|Script|Voice[- ]?over)\s*\d*\s*(?:\([^)]*\))?\s*:\s*/i, ''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseStructured(raw: string): ScriptStructured | null {
  const m = raw.match(/<<<STRUCTURED>>>\s*([\s\S]+?)\s*$/)
  if (!m) return null
  let body = m[1].trim()
  const fence = body.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fence) body = fence[1].trim()
  try {
    return JSON.parse(body) as ScriptStructured
  } catch {
    const obj = body.match(/\{[\s\S]+\}/)
    if (!obj) return null
    try { return JSON.parse(obj[0]) as ScriptStructured } catch { return null }
  }
}

function parseResponse(raw: string): { vietnamese: string; malay: string; structured: ScriptStructured | null } {
  // Primary markers — the new Vietnamese-first prompt
  const vnMatch    = raw.match(/<<<VIETNAMESE>>>([\s\S]*?)(?:<<<MALAY>>>|<<<STRUCTURED>>>|$)/)
  const malayMatch = raw.match(/<<<MALAY>>>([\s\S]*?)(?:<<<STRUCTURED>>>|$)/)

  // Backwards compat — older Gemini responses may still use <<<ENGLISH>>>.
  // If the new marker is missing but the legacy one is present, treat that
  // block as the master so a stale model output doesn't break the UI.
  const legacyMatch = vnMatch ? null : raw.match(/<<<ENGLISH>>>([\s\S]*?)(?:<<<MALAY>>>|<<<STRUCTURED>>>|$)/)

  const vietnamese = stripLabels((vnMatch?.[1] ?? legacyMatch?.[1] ?? '').trim())
  const malay      = stripLabels(malayMatch?.[1]?.trim() ?? '')
  const structured = parseStructured(raw)

  return { vietnamese, malay, structured }
}

function getGeminiKey(): string {
  const store = useSettingsStore.getState()
  if (!store.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return store.getGeminiApiKey()
}

// Fallback khi khối <<<MALAY>>> thiếu/cắt cụt: dịch riêng VN→Malay bản địa (tái dùng
// đúng MS native block). Call ngắn (chỉ dịch 1 đoạn) nên không bị cắt cụt → app không
// hard-fail khi lượt đầu lỡ bỏ sót khối Malay.
async function translateVnToMalay(apiKey: string, product: Product, vietnamese: string): Promise<string> {
  const nicheHint = `${product.productName ?? ''} ${product.productDescription ?? ''} ${product.benefits ?? ''}`.trim()
  const prompt = [
    'Dịch kịch bản voice-over quảng cáo COD tiếng Việt dưới đây sang BAHASA MELAYU bản địa Malaysia.',
    'Giữ NGUYÊN sell-arc, cường độ và độ dài tương đương. Giọng nhà quảng cáo bán cho khách ("korang/awak"), KHÔNG phải review ngôi thứ nhất.',
    'Tiếng Malay nói tự nhiên — không sách vở, không dịch máy, không lẫn tiếng Indonesia. Giữ nguyên tên sản phẩm/thành phần + đơn vị tiền (RM, ₫, $).',
    'CHỈ in ra phần lời Malay, không nhãn, không markdown.',
    '',
    'MS NATIVE VOICE GUIDE (bám nhịp/tiểu từ/code-switch):',
    buildMsBodyVocabBlock(nicheHint),
    '',
    'KỊCH BẢN TIẾNG VIỆT (bản gốc cần dịch):',
    vietnamese,
  ].join('\n')
  const out = await directGeminiVision({
    apiKey,
    parts: [{ text: prompt }],
    maxOutputTokens: 4096,
    temperature: 0.6,
  })
  return stripLabels(out.trim())
}

// ── Main export ─────────────────────────────────────────────────────────

export async function generateUGCScript(params: ScriptGenerationParams): Promise<ScriptGenerationResult> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  const preset = getPresetById(params.presetId)
  if (!preset) throw new Error(`Preset không hợp lệ: ${params.presetId}`)

  const userPrompt = buildUserPrompt(params, product)

  // 8192 (không phải 4096): gemini-2.5-flash tốn 1 phần token cho "thinking",
  // và script hardsell dài (VN master + MY + JSON) — 4096 hay bị cắt cụt khối
  // <<<MALAY>>> (block thứ 2) → lỗi "không dịch được sang tiếng Malay".
  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    maxOutputTokens: 8192,
  })

  const { vietnamese, malay, structured } = parseResponse(raw)

  if (!vietnamese || vietnamese.length < 30) {
    throw new Error('Gemini trả về kịch bản tiếng Việt quá ngắn — thử lại')
  }
  // Khối Malay thiếu/cắt cụt → dịch riêng VN→Malay (fallback) thay vì hard-fail ngay.
  let malayFinal = malay
  if (!malayFinal || malayFinal.length < 30) {
    try { malayFinal = await translateVnToMalay(apiKey, product, vietnamese) } catch { /* giữ rỗng → báo lỗi dưới */ }
  }
  if (!malayFinal || malayFinal.length < 30) {
    throw new Error('Gemini không dịch được sang tiếng Malay — thử lại')
  }

  return {
    vietnamese,
    malay: malayFinal,
    structured,
    presetId: params.presetId,
    presetLabel: preset.label,
    lengthSec: params.lengthSec,
    hookStrength: params.hookStrength,
    toneModifiers: params.toneModifiers,
    educationalMode: params.educationalMode || preset.category === 'educational',
  }
}

// Re-export so call sites only need to import from this module.
export type { ScriptGenerationParams, ScriptGenerationResult, ToneModifier, HookStrength, LengthSeconds }
