// ─────────────────────────────────────────────────────────────────────
// Product Info Layer — generatePIBatch (OPT.2 2026-05-28)
//
// SINGLE Gemini call producing ALL planned PI block types in one JSON
// response. Replaces 5 separate Gemini calls (mechanism / ingredients-usp
// / usage-faq / social-proof / pricing) — save 4 calls per pack.
//
// Architecture: same system instruction (LOCKED diary voice) + user prompt
// with all planned types listed inline. Each type has its own micro-
// directive within the prompt. Gemini outputs strict JSON:
//   { "mechanism-personal": {...}, "ingredients-usp-woven": {...}, ... }
//
// Falls back to per-section generation if batch parsing fails.
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../../services/textGenWithFallback'
import { getDiaryVoiceSystemInstruction } from '../config/diaryVoiceLock'
import { NICHE_MECHANISM_VOCAB } from '../../storytelling/config/nicheMechanismVocab'
import { NICHE_OBJECTIONS } from '../../proof/config/objectionPatterns'
import { PROOF_TEXTURE_PROFILES } from '../../proof/config/proofTextureProfiles'
import type {
  PISectionType,
  PIBlock,
  PlannerInput,
  PISectionPlan,
  GeneratorKeys,
} from '../types'
import { PI_ANCHOR_BY_TYPE } from '../types'

interface BatchOutput {
  [type: string]: {
    heading?: string
    paragraphs?: string[]
    subtleCallout?: string
  }
}

/** Build per-type micro-directive (compact — used inline in batch prompt). */
function buildMicroDirective(type: PISectionType, input: PlannerInput): string {
  switch (type) {
    case 'mechanism-personal': {
      const vocab = NICHE_MECHANISM_VOCAB[input.niche]
      const concreteVocab = vocab.mechanismVocab.slice(0, 4).join(', ')
      return `mechanism-personal: Narrator's RESEARCH MOMENT — how it works through their research/family-doctor/etc. Use 2-3 niche-specific vocab: ${concreteVocab}. Avoid generic AI: ${vocab.bannedGenericPhrases.join(', ')}. 100-160 words across 2-3 paragraphs.`
    }
    case 'ingredients-usp-woven':
      return `ingredients-usp-woven: Narrator examines product (reads label, checks with family). Weave ingredients + USP into PROSE (NO bullet list). Ingredients: ${input.productIngredients || '(not provided)'}. USP: ${input.productUsp || '(not provided)'}. 100-170 words across 2-3 paragraphs. Allow narrator uncertainty.`
    case 'usage-faq-personal':
      return `usage-faq-personal: Narrator describes WHEN+HOW they use product. Weave 1-2 common questions (asked by family). Use synthesisBrief.usageScene if available: ${input.synthesizedBrief.usageScene || '(none)'}. NO Q&A format. NO bullet. 110-170 words across 2-3 paragraphs.`
    case 'social-proof-collective': {
      const texture = PROOF_TEXTURE_PROFILES[input.niche]
      const cues = texture.textureCues.slice(0, 3).join('; ')
      return `social-proof-collective: 1 short narrator intro + 2-3 mini-voices (DIFFERENT personas, ~25-40 words each). Texture: ${texture.typicalVoice}. Platform: ${texture.platformFeel}. Cues: ${cues}. NO 5-star ratings. NO "TUYỆT VỜI!". 130-180 words.`
    }
    case 'pricing-narrator':
      return `pricing-narrator: Narrator's PURCHASE MOMENT — how/why decided to order. Pricing info: ${input.productPricing || '(not provided)'}. SHORTEST block — 70-110 words across 1-2 paragraphs. Optional subtleCallout (1 short line, whispered).`
  }
}

const FALLBACK_HEADINGS: Record<PISectionType, string> = {
  'mechanism-personal': 'Cái cơ chế tôi mới hiểu',
  'ingredients-usp-woven': 'Cái tôi check kỹ',
  'usage-faq-personal': 'Cách tôi dùng + câu hỏi gặp',
  'social-proof-collective': 'Người quen tôi cũng đang dùng',
  'pricing-narrator': 'Lúc tôi đặt',
}

/** Batch-generate ALL planned PI sections in ONE Gemini call.
 *  Returns array of PIBlocks in plan order. */
export async function generatePIBatch(
  plannedTypes: PISectionPlan[],
  input: PlannerInput,
  keys: GeneratorKeys,
): Promise<{ blocks: PIBlock[]; source: 'gemini' | 'fallback' | 'partial' }> {
  if (plannedTypes.length === 0) return { blocks: [], source: 'gemini' }

  const langName = input.targetLanguage === 'ms' ? 'Bahasa Melayu'
    : input.targetLanguage === 'en' ? 'English' : 'Tiếng Việt'

  const niche = input.niche
  const nicheObjections = NICHE_OBJECTIONS[niche]?.objections.slice(0, 3) ?? []
  const objectionHints = nicheObjections.map((o) => `• ${o.objection}`).join('\n')

  const directives = plannedTypes
    .map((p) => `── ${p.type} ──\n${buildMicroDirective(p.type, input)}`)
    .join('\n\n')

  const systemInstruction = getDiaryVoiceSystemInstruction(input.targetLanguage)

  const userPrompt = `Generate ALL planned Product Info blocks for THIS pack in ONE response.

═══ PRODUCT CONTEXT ═══
Product: ${input.productName}
Niche baseline: ${niche}
Pain points: ${input.productPainPoints || '(none)'}
Benefits: ${input.productBenefits || '(none)'}

═══ SYNTHESIS BRIEF ═══
Essence: ${input.synthesizedBrief.productEssence}
${input.synthesizedBrief.usageScene ? `Usage scene: ${input.synthesizedBrief.usageScene}` : ''}
${input.synthesizedBrief.realisticFailedAttempts.length > 0 ? `Failed attempts: ${input.synthesizedBrief.realisticFailedAttempts.slice(0, 3).join(' / ')}` : ''}

═══ NARRATOR (continuing from storytelling) ═══
Archetype: ${input.character.archetype}
Appearance lock: ${input.character.appearanceLock.slice(0, 240)}

═══ NICHE OBJECTIONS (reader's likely questions — weave 1-2 into usage-faq-personal) ═══
${objectionHints || '(none specific)'}

═══ PLANNED BLOCK DIRECTIVES (generate ONE entry per type below) ═══

${directives}

═══ OUTPUT FORMAT ═══

Strict JSON with one key per type (use exact type strings from the directives above):

{
${plannedTypes.map((p) => `  "${p.type}": { "heading": "...", "paragraphs": ["...", "..."], "subtleCallout": "(optional)" }`).join(',\n')}
}

ALL fields in ${langName}. Diary voice. Each block obeys its micro-directive.
NO markdown fences. NO prose outside JSON. JSON only.`

  if (!keys.geminiApiKey && !keys.kieApiKey) {
    console.warn('[PI/batch] No API key — using fallback')
    return { blocks: plannedTypes.map((p) => fallbackBlock(p, input)), source: 'fallback' }
  }

  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: userPrompt,
      systemInstruction,
      jsonMode: true,
      maxOutputTokens: 3000,
      timeoutMs: 60_000,
      label: 'pi-batch',
    })

    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }

    const parsed = JSON.parse(cleaned) as BatchOutput
    const blocks: PIBlock[] = []
    let fallbackUsedCount = 0

    for (const plan of plannedTypes) {
      const entry = parsed[plan.type]
      if (
        entry
        && typeof entry.heading === 'string'
        && entry.heading.length > 0
        && Array.isArray(entry.paragraphs)
        && entry.paragraphs.filter((p) => typeof p === 'string' && p.trim().length > 5).length > 0
      ) {
        const validParas = entry.paragraphs.filter((p): p is string => typeof p === 'string' && p.trim().length > 5)
        blocks.push({
          id: `pi-${plan.type}`,
          type: plan.type,
          heading: entry.heading.slice(0, 120),
          paragraphs: validParas,
          subtleCallout: typeof entry.subtleCallout === 'string' && entry.subtleCallout.length > 0
            ? entry.subtleCallout.slice(0, 140)
            : undefined,
          anchor: PI_ANCHOR_BY_TYPE[plan.type],
          source: 'gemini',
        })
      } else {
        // Parsing failed for this specific type → fallback
        blocks.push(fallbackBlock(plan, input))
        fallbackUsedCount++
      }
    }

    console.info(`[PI/batch] 1 Gemini call → ${blocks.length} blocks (${blocks.length - fallbackUsedCount} gemini, ${fallbackUsedCount} per-block fallback)`)
    return {
      blocks,
      source: fallbackUsedCount === 0 ? 'gemini' : 'partial',
    }
  } catch (err) {
    console.warn('[PI/batch] Batch generation failed — using fallback for all:', err)
    return {
      blocks: plannedTypes.map((p) => fallbackBlock(p, input)),
      source: 'fallback',
    }
  }
}

// ─── Per-type fallback (paradigm-aware, reads synthesis brief) ────────

function fallbackBlock(plan: PISectionPlan, input: PlannerInput): PIBlock {
  const brief = input.synthesizedBrief
  const hasEssence = brief.productEssence && brief.productEssence.length > 10
  const hasUsageScene = brief.usageScene && brief.usageScene.length > 10
  const hasFailedAtt = Array.isArray(brief.realisticFailedAttempts) && brief.realisticFailedAttempts.length > 0

  let heading = FALLBACK_HEADINGS[plan.type]
  let paragraphs: string[] = []
  let subtleCallout: string | undefined

  switch (plan.type) {
    case 'mechanism-personal':
      paragraphs = [
        hasEssence
          ? `Tôi tò mò nên đọc thêm về ${input.productName}. Hóa ra cách nó hoạt động khác với cách tôi nghĩ trước đây.`
          : `Tôi tò mò nên đọc thêm về ${input.productName}.`,
        hasEssence
          ? `Cụ thể: ${brief.productEssence.slice(0, 220)}.`
          : `Tôi không hiểu hết khoa học. Tôi chỉ biết cách tiếp cận này khác — và đó là điều khiến tôi quyết định thử.`,
      ]
      break
    case 'ingredients-usp-woven':
      paragraphs = [
        input.productIngredients && input.productIngredients.length > 5
          ? `Tôi đọc kỹ hộp trước khi đặt. Thành phần: ${input.productIngredients.slice(0, 180)}.`
          : `Tôi đọc kỹ hộp trước khi đặt. Thành phần liệt kê rõ ràng — không có cái gì làm tôi gợn nghi.`,
        input.productUsp && input.productUsp.length > 5
          ? `Cái khác tôi nhận ra: ${input.productUsp.slice(0, 160)}.`
          : `Tôi cẩn thận vì đã thử nhiều thứ — lần này thấy yên tâm hơn.`,
      ]
      break
    case 'usage-faq-personal':
      paragraphs = [
        hasUsageScene ? brief.usageScene : `Tôi dùng đều theo hướng dẫn — nguyên tắc đơn giản, không cần ép.`,
        `Người nhà tôi có hỏi "Có an toàn không?". Tôi check kỹ trước rồi — đọc nhãn, hỏi người dùng — không thấy cảnh báo gì bất thường.`,
      ]
      break
    case 'social-proof-collective':
      paragraphs = [
        hasFailedAtt
          ? `Sau khi tôi thấy đỡ hơn, mấy người trong nhóm chat cũng nhắn hỏi. Mọi người trước đây đã thử ${brief.realisticFailedAttempts.slice(0, 2).join(', ').slice(0, 120)} nhưng vẫn không đỡ.`
          : `Sau khi tôi thấy đỡ hơn, mấy người trong nhóm chat cũng nhắn hỏi.`,
        `Có chị bảo 2-3 tuần đầu đã khác. Có anh thì chậm hơn, tới tháng thứ 2 mới chịu công nhận. Mỗi người mỗi nhịp — không ai giống ai.`,
      ]
      break
    case 'pricing-narrator': {
      const pricing = input.productPricing && input.productPricing.length > 0 ? input.productPricing : '(giá khuyến mại)'
      paragraphs = [
        `Tôi đặt qua đợt đang giảm: ${pricing}. Tôi không phải kiểu shopping bốc đồng, nhưng đợt này đáng — tôi mua liền 2 sản phẩm để dùng kiên trì.`,
      ]
      subtleCallout = `Giá hiện tại: ${pricing.split(/[(\n]/)[0].trim()}`
      break
    }
  }

  return {
    id: `pi-${plan.type}`,
    type: plan.type,
    heading,
    paragraphs,
    subtleCallout,
    anchor: PI_ANCHOR_BY_TYPE[plan.type],
    source: 'fallback',
  }
}
