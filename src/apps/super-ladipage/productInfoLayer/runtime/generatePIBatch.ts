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

/** 2026-05-29 — Strip bracket placeholders from Gemini output.
 *  Observed Pack 2 (cough patch) leaked "[tên thảo dược 1]" placeholders
 *  in the mechanism-personal block when Gemini was rate-limited and KIE
 *  fallback (gpt-4o-mini) under-performed. The placeholder syntax slips
 *  through JSON parse because it's just a regular string.
 *
 *  Strategy:
 *    1. Detect `[anything]` brackets
 *    2. If bracket content includes "tên", "X", "Y", "placeholder", etc.
 *       → clearly a template — strip entire bracket
 *    3. If bracket content looks like real content (>= 4 chars + valid
 *       prose) → keep it (might be a legit aside like "[chú thích]")
 *    4. Log warning when any stripping happens
 *
 *  Worst case: real bracketed asides also get stripped — but PI blocks
 *  almost never use brackets in production prose, so false-positive rate
 *  is acceptable for the readability win. */
function sanitizeBracketPlaceholders(text: string, blockType: string): string {
  if (!text || typeof text !== 'string') return text
  if (!text.includes('[')) return text

  // Patterns that indicate template placeholder (always strip)
  const PLACEHOLDER_PATTERNS = [
    /\[t[êe]n\s+[^\]]*\]/gi,              // [tên thảo dược 1], [tên sản phẩm]
    /\[(name|ingredient|placeholder|insert)[^\]]*\]/gi,  // [name X], [ingredient 2]
    /\[X\]|\[Y\]|\[Z\]/g,                  // [X], [Y]
    /\[(số|amount|price|cost|brand|nhãn)\s*[^\]]*\]/gi, // [số tiền], [brand X]
    /\[\d+\]/g,                            // [1], [2] alone
    /\[\.\.\.\]/g,                         // [...] ellipsis
    /\[\?\]/g,                             // [?] unknown
  ]

  let cleaned = text
  let strippedCount = 0
  for (const pat of PLACEHOLDER_PATTERNS) {
    const before = cleaned
    cleaned = cleaned.replace(pat, '')
    if (cleaned !== before) strippedCount++
  }

  // Clean up double spaces + dangling punctuation left by strips
  cleaned = cleaned
    .replace(/\s+,/g, ',')              // " ," → ","
    .replace(/,\s*,/g, ',')             // ",," → ","
    .replace(/\s+\./g, '.')             // " ." → "."
    .replace(/\s+/g, ' ')               // multiple spaces → 1
    .replace(/^\s*[,.]\s*/, '')         // leading comma/period
    .trim()

  if (strippedCount > 0) {
    console.warn(
      `[PI/batch] sanitized ${strippedCount} bracket placeholder(s) in ${blockType}. ` +
      `Gemini likely emitted template syntax — output cleaned for production.`,
    )
  }

  return cleaned
}

/** Build per-type micro-directive (compact — used inline in batch prompt).
 *
 *  Sprint 6 (2026-05-28) — Product Info Enforcement:
 *  Previously each directive was a 1-2 line summary that Gemini softened
 *  into vague "thảo dược chung", "thử nhiều cách"-style output. Each type
 *  now ships HARD RULES that explicitly enforce input specifics
 *  (ingredient names, ALL USPs, ALL pricing tiers, scarcity hooks, usage
 *  detail, return policy). Goal: reader finishes pack feeling "I have
 *  enough info, I want to try this NOW", not "interesting story, let me
 *  think more". */
function buildMicroDirective(type: PISectionType, input: PlannerInput): string {
  switch (type) {
    case 'mechanism-personal': {
      // Sprint 6 P3 — receive Block 10 handoff + name specific ingredients
      const vocab = NICHE_MECHANISM_VOCAB[input.niche]
      const concreteVocab = vocab.mechanismVocab.slice(0, 5).join(', ')
      return `mechanism-personal: Narrator's RESEARCH MOMENT — mechanism deep-dive.

⚠️ HANDOFF NOTE: storytelling Block 10 (why-this-felt-different) only teases
mechanism (Beat 3 hand-off). THIS block carries the FULL deep-dive — reader
is already curious, deliver the explanation here.

HARD RULES:
1. Name 2-3 SPECIFIC ingredient / mechanism terms (NOT generic "thảo dược").
   For niche ${input.niche}, pick 2 from: ${concreteVocab}
2. Frame: narrator learned from a credible source — em rể dược sĩ /
   chị bác sĩ / nhà thuốc nói. 1 attribution line anchors authority.
3. Explain HOW each ingredient works in plain felt terms (NOT pseudo-science).
4. Close with 1 sentence linking mechanism → felt experience.

⛔ FORBIDDEN generic phrases (anti-AI fingerprint): ${vocab.bannedGenericPhrases.join(', ')}
⛔ FORBIDDEN: "tôi không hiểu rõ lắm về khoa học" only (you DO have an
   authority source — actually explain).

100-160 words across 2-3 paragraphs.`
    }

    case 'ingredients-usp-woven':
      // Sprint 6 P1 — enforce ALL USPs woven into prose
      return `ingredients-usp-woven: Narrator examines product (reads label, checks with family).

⚠️ HARD RULE — must touch ALL USPs from input, woven into diary prose (NOT bullet list).
USPs from input: ${input.productUsp || '(not provided)'}
Ingredients from input: ${input.productIngredients || '(not provided)'}

EACH USP signal that appears in input MUST be acknowledged in this block:
- "no sticky residue" / "không dính" → narrator notes peeling experience
- "soothing herbal scent" / "mùi thảo dược" → narrator describes scent
- "top-selling in [country]" / "bán chạy ở [nước]" → narrator references trust signal
- "fast effects" / "tác dụng nhanh" → narrator notes onset moment
- COD / free shipping / fast returns → save for the pricing-narrator block

Style: diary voice, narrator uncertainty allowed ("tôi check kỹ vì lần đầu...").
⛔ FORBIDDEN: bullet list, "Đặc điểm:", marketing-claim voice.
100-170 words across 2-3 paragraphs.`

    case 'usage-faq-personal':
      // Sprint 6 P4 — enforce specifics: WHEN/HOW LONG/FREQUENCY/WHERE/PRECAUTION
      return `usage-faq-personal: Narrator describes WHEN + HOW they use product.

⚠️ HARD RULES — must answer ALL 5 usage dimensions explicitly:
1. WHEN: time of day (sáng / tối / trước ngủ) + trigger moment (khi ho / khi đau ngực).
2. HOW LONG: duration to wear (4-8 tiếng / qua đêm / 30 phút).
3. FREQUENCY: how often (1 lần/ngày / liên tục / khi cần thiết).
4. WHERE: location on body (dán lên ngực / sau lưng / điểm cụ thể).
5. PRECAUTION: 1 brief "không dùng khi..." (1 short sentence).

Format: 1 paragraph for narrator's routine + 1 paragraph weaving 1-2 questions
INLINE (asked by family / friend / colleague) — NOT Q&A list format.

Synthesis usage scene (use if relevant): ${input.synthesizedBrief.usageScene || '(none)'}

⛔ FORBIDDEN: bullet list, formal Q&A format, generic "dễ sử dụng" without specifics.
110-170 words across 2-3 paragraphs.`

    case 'social-proof-collective': {
      // (unchanged — already works; persona seeds come from brainstorm separately)
      const texture = PROOF_TEXTURE_PROFILES[input.niche]
      const cues = texture.textureCues.slice(0, 3).join('; ')
      return `social-proof-collective: 1 short narrator intro + 2-3 mini-voices (DIFFERENT personas, ~25-40 words each). Texture: ${texture.typicalVoice}. Platform: ${texture.platformFeel}. Cues: ${cues}. NO 5-star ratings. NO "TUYỆT VỜI!". 130-180 words.`
    }

    case 'pricing-narrator':
      // Sprint 6 P2 + P5 — enforce ALL pricing dimensions + scarcity + COD + return
      return `pricing-narrator: Narrator's PURCHASE MOMENT.

⚠️ HARD RULE — must mention ALL pricing dimensions present in input.
Pricing info from input: ${input.productPricing || '(not provided)'}

REQUIRED COVERAGE — each dimension below MUST appear if input has it:
1. ORIGINAL PRICE / discount magnitude — "giá gốc RM119" (sets value anchor).
2. EACH PROMOTIONAL TIER — list all that apply (1+1 / 2+2 / 3+3),
   then state which one the narrator picked + 1-line reason.
3. TIME-BOUND SCARCITY HOOK — if input mentions "first N customers" /
   "50% off first 200" / "limited time" — narrator MUST cite this
   verbatim or near-verbatim. Example: "thấy có 50% cho 200 khách đầu
   tiên, tôi quyết định luôn để không lỡ".
4. SHIPPING perk — if input has free-shipping threshold, narrator notes
   it as a small relief ("miễn ship nếu mua 2+ — đỡ tiếc").
5. PAYMENT mode — if input has COD, narrator chooses COD ("đặt COD an
   tâm hơn, lần đầu thử mà").
6. RETURN / EXCHANGE perk — if input has "fast returns" or guarantee,
   narrator closes with 1 sentence risk-reversal ("Mua thử 1 cái trước,
   không hợp thì còn đổi được — không sợ mất tiền").

Narrator template: "Lúc đặt tôi thấy [scarcity hook]. Giá gốc [X] nhưng
giờ chỉ [Y] cho gói [tier picked] vì [reason]. Có [shipping/COD perk]
nên tôi thấy [feeling]. Nếu [return perk available], thì cũng yên tâm
hơn."

⛔ FORBIDDEN: "MUA NGAY!" / "ưu đãi cực sốc!" / exclamation marks /
   urgency caps / hard-sell voice.
✅ ALLOWED: factual narrator observation of the deal + small relief feeling.
Optional subtleCallout: 1 short whispered line.

90-140 words across 1-2 paragraphs (allowing slight expansion vs old 70-110
cap because we now require multiple pricing dimensions).`
  }
}

const FALLBACK_HEADINGS: Record<PISectionType, string> = {
  'mechanism-personal': 'Cái cơ chế tôi mới hiểu',
  'ingredients-usp-woven': 'Cái tôi check kỹ',
  'usage-faq-personal': 'Cách tôi dùng + câu hỏi gặp',
  'social-proof-collective': 'Người quen tôi cũng đang dùng',
  'pricing-narrator': 'Lúc tôi đặt',
}

/** OPT.6 (2026-05-28) — Partial JSON recovery for batch Gemini outputs.
 *
 *  Gemini sometimes truncates mid-string (server-side limit or mid-stream
 *  cut) leaving a JSON like:
 *      { "type-a": { ... },
 *        "type-b": { ... },
 *        "type-c": { "heading": "...",  // ← truncated here
 *  Standard JSON.parse throws on the whole document. This helper walks
 *  the string, tracks brace depth + string state, and identifies every
 *  complete `"key": { ...balanced }` entry that lives BEFORE the
 *  truncation point. It then reassembles a valid root object containing
 *  only those complete entries.
 *
 *  Returns null when nothing is recoverable, so the caller can decide
 *  whether to fall back fully.
 */
function recoverPartialBatchJson(raw: string): BatchOutput | null {
  // Find the opening root brace
  const rootStart = raw.indexOf('{')
  if (rootStart === -1) return null

  const out: Record<string, unknown> = {}
  let i = rootStart + 1

  // Walk top-level entries: "key": { ... }
  while (i < raw.length) {
    // Skip whitespace + commas
    while (i < raw.length && /[\s,]/.test(raw[i])) i++
    if (i >= raw.length) break
    if (raw[i] === '}') break   // root closes — done

    // Expect a quoted key
    if (raw[i] !== '"') return Object.keys(out).length > 0 ? (out as BatchOutput) : null
    const keyStart = i + 1
    i++
    while (i < raw.length && raw[i] !== '"') {
      if (raw[i] === '\\') i++
      i++
    }
    if (i >= raw.length) break
    const key = raw.slice(keyStart, i)
    i++   // past closing quote

    // Skip whitespace + colon
    while (i < raw.length && /[\s:]/.test(raw[i])) i++
    if (i >= raw.length) break

    // Expect '{' to start value object
    if (raw[i] !== '{') return Object.keys(out).length > 0 ? (out as BatchOutput) : null
    const valStart = i
    let depth = 0
    let inString = false
    let escape = false
    let valEnd = -1
    for (; i < raw.length; i++) {
      const c = raw[i]
      if (escape) { escape = false; continue }
      if (c === '\\' && inString) { escape = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) { valEnd = i; break }
      }
    }
    if (valEnd === -1) break   // truncated mid-value — can't include this entry

    const valStr = raw.slice(valStart, valEnd + 1)
    try {
      out[key] = JSON.parse(valStr)
    } catch {
      // entry itself is malformed — skip, keep going for later complete ones
    }
    i = valEnd + 1
  }

  return Object.keys(out).length > 0 ? (out as BatchOutput) : null
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
    // 2026-05-29 — Defensive retry on suspiciously short output.
    // Pack 3 (dental Teeth Restoration) showed Gemini returning 404 chars
    // for a 5-block JSON request — clearly truncated mid-stream by free-tier
    // server overload (not by maxOutputTokens which was 3000). A 5-block
    // PI batch typically produces 2500-4000 chars; <800 chars means
    // server cut early. In that case the recovery walker gets nothing
    // useful (can't even close the first entry's brace). Retry once
    // with the same prompt — usually a different server worker that's
    // less throttled. Bumped tokens 3000→4000 for headroom.
    const SHORT_OUTPUT_THRESHOLD = 800   // chars
    let raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: userPrompt,
      systemInstruction,
      jsonMode: true,
      maxOutputTokens: 4000,
      timeoutMs: 60_000,
      label: 'pi-batch',
    })

    if (raw.trim().length < SHORT_OUTPUT_THRESHOLD) {
      console.warn(
        `[PI/batch] attempt 1 returned only ${raw.trim().length} chars (< ${SHORT_OUTPUT_THRESHOLD} threshold) — likely server-side truncation. Retrying once.`,
      )
      raw = await textGenWithFallback({
        geminiApiKey: keys.geminiApiKey,
        kieApiKey: keys.kieApiKey,
        prompt: userPrompt,
        systemInstruction,
        jsonMode: true,
        maxOutputTokens: 4000,
        timeoutMs: 60_000,
        label: 'pi-batch-retry',
      })
    }

    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }

    // OPT.6 (2026-05-28) — Partial JSON recovery.
    // Gemini occasionally truncates mid-entry (saw position 2099 / 4 blocks
    // at 3000 maxTokens — likely a server-side guard, not a token cap).
    // Before this change a single SyntaxError dumped ALL 4 PI blocks to
    // fallback. Now we try a strict parse first, and if that throws we
    // attempt a brace-balanced slice that includes every complete entry
    // BEFORE the truncation point. Worst case we still fall back per-block
    // for the truncated entry, but the 3 complete ones keep Gemini quality.
    let parsed: BatchOutput
    try {
      parsed = JSON.parse(cleaned) as BatchOutput
    } catch (parseErr) {
      const recovered = recoverPartialBatchJson(cleaned)
      if (recovered) {
        const recoveredCount = Object.keys(recovered).length
        console.warn(`[PI/batch] strict parse failed (${(parseErr as Error).message.slice(0, 80)}); recovered ${recoveredCount} complete entries from partial JSON`)
        parsed = recovered
      } else {
        throw parseErr   // Let outer catch trigger full fallback as before
      }
    }
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
        // 2026-05-29 — Sanitize bracket placeholders. Gemini under load
        // (rate limit / KIE fallback to weaker model) sometimes emits
        // template syntax like "[tên thảo dược 1]" instead of filling it
        // with concrete ingredient names. Stripping brackets is safer than
        // shipping the placeholder visible to the buyer.
        const validParas = entry.paragraphs
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 5)
          .map((p) => sanitizeBracketPlaceholders(p, plan.type))
        const sanitizedHeading = sanitizeBracketPlaceholders(entry.heading.slice(0, 120), plan.type)
        const sanitizedCallout = typeof entry.subtleCallout === 'string' && entry.subtleCallout.length > 0
          ? sanitizeBracketPlaceholders(entry.subtleCallout.slice(0, 140), plan.type)
          : undefined
        blocks.push({
          id: `pi-${plan.type}`,
          type: plan.type,
          heading: sanitizedHeading,
          paragraphs: validParas,
          subtleCallout: sanitizedCallout,
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
