// ─────────────────────────────────────────────────────────────────────
// Product Info Layer — generatePISection (1 Gemini call per section)
//
// Per-section-type user prompt assembled from:
//   - SYNTHESIS BRIEF (productEssence + readerSpecificSymptoms)
//   - INPUT DATA SLICE (only the fields relevant to THIS section type)
//   - NARRATOR CONTEXT (character archetype + appearance + environment)
//   - NICHE METADATA (mechanismVocab / objectionPatterns / proofTexture)
//
// Each prompt asks Gemini to OUTPUT JSON: { heading, paragraphs, subtleCallout? }
// System instruction is the LOCKED diary voice instruction.
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../../services/textGenWithFallback'
import { getDiaryVoiceSystemInstruction } from '../config/diaryVoiceLock'
import { NICHE_MECHANISM_VOCAB } from '../../storytelling/config/nicheMechanismVocab'
import { NICHE_OBJECTIONS } from '../../proof/config/objectionPatterns'
import { PROOF_TEXTURE_PROFILES } from '../../proof/config/proofTextureProfiles'
import type {
  GeneratorInput,
  GeneratorKeys,
  PIBlock,
  PISectionType,
} from '../types'
import { PI_ANCHOR_BY_TYPE } from '../types'

interface RawPIResponse {
  heading?: string
  paragraphs?: string[]
  subtleCallout?: string
}

// ─── Per-section-type user prompt builders ────────────────────────────

function buildPromptMechanism(input: GeneratorInput): string {
  const vocab = NICHE_MECHANISM_VOCAB[input.niche]
  const concreteVocab = vocab.mechanismVocab.slice(0, 4).join(', ')

  return `Write the "mechanism-personal" PI block. Narrator just discovered the product in the previous storytelling block, and now NATURALLY shares what they learned about HOW IT WORKS — through their own research moment.

═══ PRODUCT REALITY (from synthesis) ═══
Product: ${input.productName}
Essence: ${input.synthesizedBrief.productEssence}
${input.synthesizedBrief.rationale ? `Niche rationale: ${input.synthesizedBrief.rationale}` : ''}

═══ NICHE MECHANISM VOCABULARY (use 2-3 of these naturally) ═══
${concreteVocab}

═══ BANNED for THIS niche (generic AI fingerprints) ═══
${vocab.bannedGenericPhrases.join(' / ')}

═══ NARRATOR (continuing from storytelling) ═══
Archetype: ${input.character.archetype}
The narrator's research moment should feel REAL — they read an article, asked
a sibling, talked to a doctor — NOT they suddenly know everything.

═══ INSTRUCTIONS ═══
1. Open with the narrator's research trigger ("Tôi tò mò nên Google...",
   "Em gái tôi học dược nên giải thích...", "Bác sĩ tôi nói...")
2. Explain HOW the product works using 2-3 niche-specific vocab terms above,
   but THROUGH the narrator's voice (NOT lecture tone)
3. End with narrator's emotional reaction ("À hóa ra...", "Lúc đó tôi mới hiểu...")
4. Word budget: 100-160 words across 2-3 paragraphs

Output JSON only.`
}

function buildPromptIngredientsUsp(input: GeneratorInput): string {
  return `Write the "ingredients-usp-woven" PI block. Narrator notices what's inside the product + what's different about it — through their own examination (reading label, checking with family, comparing to past products tried).

═══ PRODUCT DATA ═══
Product: ${input.productName}
Ingredients (raw): ${input.productIngredients || '(none provided — focus on USP)'}
USP (raw): ${input.productUsp || '(none provided — focus on ingredients)'}
Pain points it addresses: ${input.productPainPoints || ''}
Benefits claimed: ${input.productBenefits || ''}

═══ NARRATOR (continuing from storytelling) ═══
Archetype: ${input.character.archetype}

═══ INSTRUCTIONS ═══
1. Open with narrator examining the product (reading label, checking pack,
   comparing to previous products they tried that failed)
2. Weave ingredients + USP into PROSE — NOT bullet list. Examples:
   - "Tôi mới biết B1 không chỉ là vitamin — nó làm việc với enzyme..."
   - "Cái khác tôi nhận ra là nó chewable, vị trái cây — trước tôi uống pill khô..."
3. If certifications mentioned in USP (HALAL/KKM/FDA), narrator notes them
   THROUGH personal lens ("vợ tôi check kỹ vì cho con bú...", "tôi sợ hàng giả...")
4. Allow narrator uncertainty: "tôi không phải dược sĩ, chỉ là thấy..."
5. Word budget: 100-170 words across 2-3 paragraphs

Output JSON only.`
}

function buildPromptUsageFaq(input: GeneratorInput): string {
  const objections = NICHE_OBJECTIONS[input.niche]?.objections ?? []
  const top2Objections = objections.slice(0, 3).map((o) => `• ${o.objection}`).join('\n')

  return `Write the "usage-faq-personal" PI block. Narrator describes their own routine using the product + naturally addresses common questions THROUGH family/friends asking them.

═══ PRODUCT DATA ═══
Product: ${input.productName}
Pain points addressed: ${input.productPainPoints || ''}

═══ NICHE OBJECTIONS (reader's likely questions — weave 1-2 in via family asking) ═══
${top2Objections || '(none specific)'}

═══ NARRATOR (continuing from storytelling) ═══
Archetype: ${input.character.archetype}
Environment: ${input.character.environmentLock}

═══ INSTRUCTIONS ═══
1. Narrator describes WHEN + HOW they use the product (morning routine, before
   sleep, after meals, etc. — concrete moment with their environment)
2. Weave in 1-2 common questions reader would have — but framed as someone
   asked the NARRATOR ("vợ tôi hỏi...", "em gái nhắn hỏi tôi...", "bạn cùng cty
   thấy tôi đỡ mệt nên hỏi...") and how the narrator answers based on their
   own checking (read label, asked doctor, etc.)
3. NO Q&A format. NO bullet list. NO "Question:" / "Answer:". Pure prose.
4. Word budget: 110-170 words across 2-3 paragraphs

Output JSON only.`
}

function buildPromptSocialProof(input: GeneratorInput): string {
  const texture = PROOF_TEXTURE_PROFILES[input.niche]
  const cues = texture.textureCues.slice(0, 3).join('; ')

  return `Write the "social-proof-collective" PI block. The narrator's voice yields to 2-3 OTHER voices (family/friends/colleagues) who also tried the product. Multiple diary-tone testimonials in the SAME register as the main storytelling — NOT polished testimonials.

═══ PRODUCT ═══
Product: ${input.productName}
Pain points: ${input.productPainPoints || ''}
Benefits: ${input.productBenefits || ''}

═══ NICHE PROOF TEXTURE (mimic this voice style) ═══
Typical voice: ${texture.typicalVoice}
Platform feel: ${texture.platformFeel}
Texture cues (weave 1-2 across the 2-3 mini-voices): ${cues}

═══ AVOID (sai niche voice) ═══
${texture.avoidPatterns.join(' / ')}

═══ NARRATOR (continuing from storytelling) ═══
Archetype: ${input.character.archetype}

═══ INSTRUCTIONS ═══
1. Open with 1 short line from the main narrator introducing ("Em gái tôi sau
   khi giới thiệu cho tôi cũng đã giới thiệu cho 2-3 chị...", or
   "Tôi share lên group lớp cấp 3 thì có 3 anh cũng đang dùng...")
2. Then 2-3 mini-voices in DIFFERENT personas — each ~25-40 words:
   • Different ages / occupations / contexts
   • Use texture cues authentically (e.g. supplement: "3 giờ chiều", "sáng dậy"
   • Each mini-voice 1 specific moment (NOT generic praise)
   • Slight imperfection: contractions, fragments, missing diacritics OK
3. NO 5-star ratings. NO "TUYỆT VỜI!". NO ALL CAPS. NO emojis spam.
4. Format paragraphs naturally — first paragraph = main narrator intro, then
   each mini-voice = own paragraph (3-4 paragraphs total OK)
5. Word budget: 130-180 words

Output JSON only.`
}

function buildPromptPricing(input: GeneratorInput): string {
  return `Write the "pricing-narrator" PI block. Narrator briefly + SOFTLY mentions the offer/price — as part of their personal purchase decision moment. This is the SHORTEST PI block — must feel light, not commercial.

═══ PRICING INFO ═══
${input.productPricing}

═══ NARRATOR (continuing from storytelling) ═══
Archetype: ${input.character.archetype}

═══ INSTRUCTIONS ═══
1. Narrator's purchase moment — when they decided to order, how, why
2. Mention the price + offer THROUGH personal decision lens:
   - "Đợt này tôi mua được X, bình thường Y — tôi đặt 2-3 hộp luôn..."
   - "Lúc đó đang sale RM55 nên tôi tranh thủ..."
   - "Tôi nhớ tôi đặt qua... hôm sau là nhận..."
3. Allow narrator pragmatism: "tôi không phải kiểu shopping bốc đồng, nhưng..."
4. NO superlative urgency: NO "đừng bỏ lỡ" / "ưu đãi có hạn" / "duy nhất hôm nay"
5. The 'subtleCallout' field can be 1 short line — "Giá hiện tại: RM55 (từ RM109)"
   or similar — WHISPERED, not shouted
6. Word budget: 70-110 words across 1-2 paragraphs (SHORTEST PI block)

Output JSON only.`
}

const PROMPT_BUILDERS: Record<PISectionType, (input: GeneratorInput) => string> = {
  'mechanism-personal':      buildPromptMechanism,
  'ingredients-usp-woven':   buildPromptIngredientsUsp,
  'usage-faq-personal':      buildPromptUsageFaq,
  'social-proof-collective': buildPromptSocialProof,
  'pricing-narrator':        buildPromptPricing,
}

// ─── Fallback paragraphs (when Gemini fails) — SYNTHESIS-AWARE ────────
//
// PARADIGM-FIX (2026-05-27): old fallback hardcoded SUPPLEMENT paradigm
// ("Tôi uống đều mỗi sáng", "không tương tác mạnh với thuốc đang dùng")
// → broke for non-supplement products (dental powder, eye drops, knee
// brace, sleep pillow, etc.).
//
// New fallback READS from synthesisBrief — usageScene + productEssence +
// realisticFailedAttempts — so output adapts to actual product paradigm.
// When synthesis data missing, falls back to GENERIC neutral phrasing
// that works across paradigms (no "uống" / "tiêm" / "đeo" assumption).

function fallbackBlock(input: GeneratorInput): PIBlock {
  const brief = input.synthesizedBrief
  const hasUsageScene = brief.usageScene && brief.usageScene.length > 10
  const hasEssence    = brief.productEssence && brief.productEssence.length > 10
  const hasFailedAtt  = Array.isArray(brief.realisticFailedAttempts) && brief.realisticFailedAttempts.length > 0

  switch (input.type) {
    case 'mechanism-personal': {
      // Mechanism explanation uses productEssence when available (knows actual
      // product action mode). Otherwise generic paradigm-neutral phrasing.
      const para1 = hasEssence
        ? `Tôi tò mò nên đọc thêm về ${input.productName}. Hóa ra nó hoạt động khác hẳn so với cách tôi nghĩ trước đây.`
        : `Tôi tò mò nên đọc thêm về ${input.productName}. Hóa ra cái cách nó hoạt động khác so với những gì tôi nghĩ trước đây.`
      const para2 = hasEssence
        ? `Cụ thể: ${brief.productEssence.slice(0, 220)}. Khi đọc tới đây tôi mới hiểu vì sao mấy thứ tôi thử trước không hiệu quả — tôi đã tập trung sai chỗ.`
        : `Tôi không hiểu hết về mặt khoa học. Tôi chỉ biết cách tiếp cận này khác với những gì tôi đã thử trước đây — và đó là điều khiến tôi quyết định thử.`
      return makeBlock(input.type, 'Cái cơ chế tôi mới hiểu', [para1, para2])
    }

    case 'ingredients-usp-woven': {
      const para1 = input.productIngredients && input.productIngredients.trim().length > 5
        ? `Tôi đọc kỹ hộp trước khi đặt. Thành phần liệt kê khá rõ: ${input.productIngredients.slice(0, 180)}. Không có cái gì làm tôi gợn nghi.`
        : `Tôi đọc kỹ hộp trước khi đặt. Thành phần liệt kê rõ ràng trên bao bì — không có cái gì làm tôi gợn nghi.`
      const para2 = input.productUsp && input.productUsp.trim().length > 5
        ? `Cái khác tôi nhận ra: ${input.productUsp.slice(0, 160)}. Đó là điểm tôi đánh giá cao so với mấy loại tôi đã thử trước.`
        : `Tôi cẩn thận vì đã thử nhiều thứ rồi — lần này tôi thấy yên tâm hơn.`
      return makeBlock(input.type, 'Cái tôi check kỹ', [para1, para2])
    }

    case 'usage-faq-personal': {
      // PARADIGM-FIX: usageScene from synthesis is product-specific
      // (eg "đánh răng xong nhúng bột này 1-2 phút rồi súc miệng" for dental,
      //  "xịt 2-3 nhát mỗi sáng" for nasal, "đeo 4-6 giờ/ngày" for brace).
      // When synthesis missing, neutral "dùng đều theo hướng dẫn" works everywhere.
      const para1 = hasUsageScene
        ? brief.usageScene
        : `Tôi dùng đều theo hướng dẫn — nguyên tắc đơn giản, không cần ép.`
      const para2 = `Người nhà tôi có hỏi "Cái này có an toàn không?". Tôi đã check kỹ trước rồi — đọc nhãn, hỏi người đã dùng — không thấy cảnh báo gì bất thường. Cứ làm đúng hướng dẫn là OK.`
      return makeBlock(input.type, 'Cách tôi dùng + cái người nhà hỏi', [para1, para2])
    }

    case 'social-proof-collective': {
      // Use realisticFailedAttempts to anchor "đã thử" theme; else generic.
      const failedAttRef = hasFailedAtt
        ? ` Mọi người trước đây đã thử ${brief.realisticFailedAttempts.slice(0, 2).join(', ').slice(0, 120)} nhưng vẫn không đỡ.`
        : ''
      return makeBlock(input.type, 'Mấy người quen tôi cũng đang dùng', [
        `Sau khi tôi thấy đỡ hơn, mấy người trong nhóm chat cũng nhắn hỏi.${failedAttRef}`,
        `Có chị bảo 2-3 tuần đầu đã khác. Có anh thì chậm hơn, tới tháng thứ 2 mới chịu công nhận. Mỗi người mỗi nhịp — không ai giống ai.`,
      ])
    }

    case 'pricing-narrator': {
      const pricing = input.productPricing && input.productPricing.trim().length > 0
        ? input.productPricing
        : '(giá đợt khuyến mại)'
      return makeBlock(input.type, 'Lúc tôi đặt', [
        `Tôi đặt qua đợt đang giảm: ${pricing}. Tôi không phải kiểu shopping bốc đồng, nhưng đợt này đáng — tôi mua liền 2 sản phẩm để dùng kiên trì.`,
      ], `Giá hiện tại: ${pricing.split(/[(\n]/)[0].trim()}`)
    }
  }
}

function makeBlock(
  type: PISectionType,
  heading: string,
  paragraphs: string[],
  subtleCallout?: string,
): PIBlock {
  return {
    id: `pi-${type}`,
    type,
    heading,
    paragraphs,
    subtleCallout,
    anchor: PI_ANCHOR_BY_TYPE[type],
    source: 'fallback',
  }
}

// ─── Main per-section runtime ─────────────────────────────────────────

export async function generatePISection(
  input: GeneratorInput,
  keys: GeneratorKeys,
): Promise<PIBlock> {
  const systemInstruction = getDiaryVoiceSystemInstruction(input.targetLanguage)
  const userPrompt = PROMPT_BUILDERS[input.type](input)

  if (!keys.geminiApiKey) {
    console.warn(`[PI/${input.type}] No Gemini key — using fallback`)
    return fallbackBlock(input)
  }

  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: userPrompt,
      systemInstruction,
      jsonMode: true,
      maxOutputTokens: 700,
      timeoutMs: 30_000,
      label: `pi-${input.type}`,
    })

    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }

    const parsed = JSON.parse(cleaned) as RawPIResponse
    const heading = typeof parsed.heading === 'string' && parsed.heading.length > 0
      ? parsed.heading.slice(0, 120)
      : 'Cái tôi đã đào ra'
    const paragraphs = Array.isArray(parsed.paragraphs)
      ? parsed.paragraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 5)
      : []

    if (paragraphs.length === 0) {
      console.warn(`[PI/${input.type}] Gemini returned empty paragraphs — using fallback`)
      return await translateFallbackIfNeeded(fallbackBlock(input), input, keys)
    }

    return {
      id: `pi-${input.type}`,
      type: input.type,
      heading,
      paragraphs,
      subtleCallout: typeof parsed.subtleCallout === 'string' && parsed.subtleCallout.length > 0
        ? parsed.subtleCallout.slice(0, 140)
        : undefined,
      anchor: PI_ANCHOR_BY_TYPE[input.type],
      source: 'gemini',
    }
  } catch (err) {
    console.warn(`[PI/${input.type}] Generation failed — using fallback:`, err)
    return await translateFallbackIfNeeded(fallbackBlock(input), input, keys)
  }
}

// ─── LANG-FIX (2026-05-27) — PI fallback language safety ──────────────
//
// PI fallback blocks are hardcoded Vietnamese (consistent with storytelling
// FALLBACK_COPY pattern). When pack target language is MS or EN, translate
// the fallback heading + paragraphs in a single small Gemini call so the
// PI block ships in target language (no mid-pack Vietnamese leak).
async function translateFallbackIfNeeded(
  block: PIBlock,
  input: GeneratorInput,
  keys: GeneratorKeys,
): Promise<PIBlock> {
  if (input.targetLanguage === 'vi') return block
  if (!keys.geminiApiKey && !keys.kieApiKey) return block

  const targetLangName = input.targetLanguage === 'ms'
    ? 'Bahasa Melayu (Malaysian Malay, natural conversational, NOT formal Bahasa Indonesia)'
    : 'natural conversational English'

  const payload = {
    heading: block.heading,
    paragraphs: block.paragraphs,
    subtleCallout: block.subtleCallout ?? '',
  }

  const prompt = `Translate this Vietnamese diary-tone product info fallback to ${targetLangName}.

═══ RULES ═══
- Keep first-person diary voice ("tôi/saya/I")
- ${input.targetLanguage === 'ms' ? 'Use "saya" + reader address "anda" (NOT kamu/engkau)' : 'Use "I" + reader address "you"'}
- Preserve paragraph breaks
- Do NOT add marketing phrases
- Do NOT invent product details

═══ INPUT JSON ═══
${JSON.stringify(payload, null, 2)}

═══ OUTPUT ═══
Same JSON shape with translated values. JSON only, no markdown.`

  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey:    keys.kieApiKey,
      prompt,
      jsonMode:        true,
      maxOutputTokens: 700,
      timeoutMs:       20_000,
      label:           `pi-fallback-translate-${input.type}`,
    })
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned) as { heading?: string; paragraphs?: string[]; subtleCallout?: string }
    const newHeading = typeof parsed.heading === 'string' && parsed.heading.length > 0 ? parsed.heading : block.heading
    const newParagraphs = Array.isArray(parsed.paragraphs)
      ? parsed.paragraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : block.paragraphs
    return {
      ...block,
      heading: newHeading,
      paragraphs: newParagraphs.length > 0 ? newParagraphs : block.paragraphs,
      subtleCallout: typeof parsed.subtleCallout === 'string' && parsed.subtleCallout.length > 0
        ? parsed.subtleCallout
        : block.subtleCallout,
    }
  } catch (err) {
    console.warn(`[PI/${input.type}] Fallback translate failed — keeping VN. ${err instanceof Error ? err.message : 'unknown'}`)
    return block
  }
}
