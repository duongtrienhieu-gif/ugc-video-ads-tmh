// ─────────────────────────────────────────────────────────────────────────
// services/forms/advertorial.ts — Phase 3 — STORYTELLING ENGINE
//
// "Kể Chuyện Hành Trình" — first-person editorial advertorial form.
//
// This is the FIRST form to ship with its own real engine. It does NOT
// share the 17-section conversion factory prompt of form 1. Instead it
// generates a narrative-driven landing page with:
//
//   • One fixed character (generated up front) threaded through every
//     section as a textual identity lock — same name, same look, same
//     home, mood evolving across the arc.
//   • 12-section emotional flow (NOT a conversion funnel).
//   • Long-form first-person copy (3-5 line paragraphs per section).
//   • Image strategy = cinematic-lifestyle; FEWER images per section
//     than form 1; character continuity ON.
//   • CTA placement = single soft invitation at the very end. No
//     mid-page urgency strips.
//
// Implementation notes:
//   - Owns its own SYSTEM_PROMPT (no inheritance from generateLandingPack).
//   - Reuses shared helpers: getGeminiKey, extractJson, normalizeSection,
//     injectPriceIntoPrompts, extractPriceTag.
//   - Sets pack.form='advertorial' and pack.characterProfile so the image
//     pipeline can suppress its default diversity engine and emit
//     character-lock directives instead.
// ─────────────────────────────────────────────────────────────────────────

import type {
  LandingGenParams, LandingPagePack, LandingSection, SectionType, LandingLanguage,
  CharacterProfile,
} from '../../types'
import type { FormBlueprintModule } from './_types'
import {
  getGeminiKey, extractJson, normalizeSection, injectPriceIntoPrompts,
  extractPriceTag, type RawPack,
} from '../generateLandingPack'
import { useBankStore } from '../../../../stores/bankStore'
import { directGeminiVision } from '../../../../utils/gemini'

// ── Storytelling section blueprint — 12 emotional beats ──────────────────
//
// Same SectionType union as form 1 (DB compat) but per-section content
// spec is completely rewritten in the system prompt below — a "hero" here
// is an emotional opener, NOT a designed-overlay product hero.
//
const STORYTELLING_SECTIONS: SectionType[] = [
  'hero',               // 1. Emotional hook + character first appearance
  'pain',               // 2. Character introduces their problem (1st-person)
  'lifestyle',          // 3. How life is affected day-to-day
  'failed-solutions',   // 4. "I tried everything before…"
  'why-happens',        // 5. Emotional / vulnerable frustration peak
  'product-discovery',  // 6. Cơ duyên — how they found the product
  'mechanism',          // 7. Initial skepticism → reading about how it works
  'benefits',           // 8. First week experience (subtle changes)
  'before-after',       // 9. Observable change (textual journal + 1 paired photo)
  'social-proof',       // 10. Family / friends start to notice
  'faq',                // 11. Reader Q&A — answered by the character
  'final-cta',          // 12. Soft invitation close — "kalau saya boleh, anda pun boleh"
]

// ── Image count per section — DELIBERATELY LOW vs form 1 ────────────────
//
// Form 1 ships ~36-40 images. Storytelling ships ~14-18 — bigger, more
// emotional, fewer total. Reader spends time WITH each image.
//
const IMAGES_PER_SECTION: Partial<Record<SectionType, number>> = {
  'hero':              1,  // single emotional portrait
  'pain':              2,  // 1 portrait of character + 1 environmental
  'lifestyle':         2,  // daily life moments
  'failed-solutions':  1,  // character with discarded alternatives
  'why-happens':       1,  // emotional peak moment
  'product-discovery': 1,  // discovery moment (handed product / browsing)
  'mechanism':         2,  // reading label + first dose
  'benefits':          1,  // subtle change moment
  'before-after':      2,  // a SAME-SCENE pair: tired vs healthier
  'social-proof':      2,  // character with family / friend reactions
  'faq':               0,  // text-only Q&A
  'final-cta':         1,  // closing emotional portrait
}
// Total ≈ 16 images vs form 1's ~36.

// ── Character profile generator ─────────────────────────────────────────
//
// Build a stable character profile ONCE per pack. Same person threads
// through the whole story arc. Used in two places:
//   1. Baked into the Gemini user prompt so generated imagePrompts all
//      reference the same person.
//   2. Saved to pack.characterProfile so generateImages.ts can emit a
//      character-lock directive on every people-shot at KIE submission.

// Phase 7 stabilization — locked to ONE archetype only (Malaysian Muslim
// woman in hijab) per user spec. Previously had 3 archetypes (Chinese
// woman with hair down + Malay woman with hair tied back) which caused
// ethnicity / hijab inconsistency when Gemini was free to pick. The
// storytelling form must always be the SAME Malaysian Muslim hijab woman
// — period. Name + small environment details rotate per pack.
const ARCHETYPE_OPTIONS = [
  {
    archetype: 'Malaysian Muslim woman, mid-30s, modest hijab, working mother',
    nameVi: ['Aishah binti Rahman', 'Siti Norhayati', 'Nor Aini', 'Faridah Hassan', 'Hanis Iskandar', 'Mawar Saleha'],
    appearance: 'Mid-30s Malaysian Muslim woman, soft-rounded face, warm brown eyes, light-medium olive skin with natural pores, slight smile lines, ALWAYS wearing modest tudung (hijab) in muted tone (dusty pink OR pale sage OR cream OR soft mocha — pick ONE color and KEEP it across every render in the pack), no heavy makeup, natural eyebrows, small ear earrings barely visible under hijab, modest loose tunic / kurung / casual cotton top — NEVER fitted Western fashion, NEVER bare arms / shoulders / décolletage',
    environment: 'Small Malaysian Muslim family home — kitchen with formica counter and fruit bowl, living room with batik throw on a beige sofa, late-morning warm window light from the right side, soft "lived-in" cluttered feel — NOT staged Pinterest-perfect',
  },
]

function generateCharacterProfile(productName: string): CharacterProfile {
  // Deterministic-ish randomness so regenerating doesn't keep swapping
  // identity within the same session — use Date hash + product as seed.
  const seed = `${productName}-${Math.floor(Date.now() / 60000)}`
  const archetypeIdx = Math.abs(hashStr(seed)) % ARCHETYPE_OPTIONS.length
  const A = ARCHETYPE_OPTIONS[archetypeIdx]
  const name = A.nameVi[Math.abs(hashStr(seed + '-name')) % A.nameVi.length]

  // Emotional arc — mood per section in the story
  const emotionalArc = [
    { sectionType: 'hero',               mood: 'tired but resilient, soft hopeful gaze at camera' },
    { sectionType: 'pain',               mood: 'visibly fatigued, slumped posture, low energy' },
    { sectionType: 'lifestyle',          mood: 'pushing through daily routine but clearly drained' },
    { sectionType: 'failed-solutions',   mood: 'frustrated, exasperated, slightly defeated' },
    { sectionType: 'why-happens',        mood: 'quiet vulnerable moment alone — almost teary' },
    { sectionType: 'product-discovery',  mood: 'curious, open expression while reading about the product' },
    { sectionType: 'mechanism',          mood: 'studying the label, slightly hopeful but cautious' },
    { sectionType: 'benefits',           mood: 'gentle small smile noticing a difference' },
    { sectionType: 'before-after',       mood: 'before: dim and tired / after: brighter eyes and posture' },
    { sectionType: 'social-proof',       mood: 'warm laughing moment with family / friend' },
    { sectionType: 'final-cta',          mood: 'confident calm smile, holding the product, sunlit window' },
  ]

  return {
    name,
    archetype: A.archetype,
    appearanceLock: A.appearance,
    environmentLock: A.environment,
    emotionalArc,
  }
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

// ── System prompt — STORYTELLING engine (does not inherit form 1) ────────

const STORYTELLING_SYSTEM_PROMPT = `BẠN LÀ: editorial advertorial copywriter chuyên viết các bài kể chuyện cá nhân kiểu "review thật" / "diary" cho thị trường Malaysia. Bạn KHÔNG phải là media buyer chốt đơn nhanh.

NHIỆM VỤ: viết một bài advertorial dạng kể chuyện 12-section với MỘT nhân vật xuyên suốt. Đọc xong phải có cảm giác đây là review thật, không phải quảng cáo.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY, no markdown fences, no commentary
═══════════════════════════════════════════════════════════════
{
  "language": "ms" | "vi" | "en",
  "sections": [ ...exactly 12 section objects in the order below... ]
}

Each section object has the same shape as form 1: type, title, titleVi, copy, viTranslation, layoutGuide, imageAspectRatio, optionally headline/subheadline/cta/offerStrip/urgencyText/bullets/faqs/reviews/imagePrompts. ALL imageAspectRatio="4:5" for this form. NO 16:9 banners — this is a long-form article, not an ecommerce banner.

═══════════════════════════════════════════════════════════════
NHÂN VẬT CHÍNH — IDENTITY LOCK (CRITICAL — DO NOT BREAK)
═══════════════════════════════════════════════════════════════
The user prompt below declares ONE specific character (Malaysian Muslim woman in modest hijab — name, age, appearance, environment all locked). EVERY copy reference + EVERY imagePrompt that involves a person MUST use that exact character.

HARD BANS — auto-fail any imagePrompt that depicts:
  ✗ A MAN / male / boy / father (the hero is FEMALE — period)
  ✗ A woman WITHOUT hijab / tudung / head covering (this hero wears hijab in EVERY shot)
  ✗ Western / Caucasian / European face
  ✗ Korean idol / Chinese beauty model / Japanese anime aesthetic / Indian woman
  ✗ A different age (the hero is mid-30s — not 20-year-old college girl, not 50+ aunty)
  ✗ A different woman with different face structure / different ethnicity than the locked archetype
  ✗ Two main characters in one frame (the hero is solo; auxiliary characters in social-proof are children / spouse / mother but the HERO is the same woman every time)
  ✗ Bare arms / shoulders / décolletage / fitted Western fashion / influencer makeup
  ✗ Studio glam / luxury fashion editorial / professional model headshot
  ✗ Hair-down portraits (always hijab)

POSITIVE LOCK — EVERY people-shot prompt must explicitly state:
  • "Same Malaysian Muslim hijab woman from previous reference image"
  • The exact appearance descriptor from the user prompt
  • Modest dress (kurung / loose tunic / long-sleeve modest top)
  • Same hijab color across the whole pack (declared in user prompt)
  • Same Malaysian Muslim home environment

If you describe a person in any imagePrompt without these positive locks, the image will be rejected as a continuity break.

═══════════════════════════════════════════════════════════════
12-SECTION EMOTIONAL FLOW — produce EXACTLY these types in order
═══════════════════════════════════════════════════════════════

1. type="hero" — EMOTIONAL OPENER (NOT a designed banner)
   • headline = a single emotional 1-sentence hook from the character's voice (max 12 words). NO product name in headline.
   • copy = 3-5 line first-person paragraph introducing who the character is + the feeling they want to share. Mention age / role / family context. Soft warm tone. NO urgency.
   • 1 imagePrompt: portrait of the SPECIFIC character (use appearance lock), in their environment (use environment lock), soft window light, slight tired-but-hopeful expression, looking AWAY from camera or down — NOT a product hero shot. NO product in frame. NO designed text overlay. NO badges. Just an emotional portrait.

2. type="pain" — Character introduces the problem
   • copy = 4-6 line first-person paragraph naming the problem the product solves. SPECIFIC details: "setiap pagi saya rasa…", "anak-anak nampak saya letih…". NO bullet list. Prose flow.
   • 2 imagePrompts: (a) close-up portrait of character with tired expression — same person; (b) environmental detail of their daily life showing the problem (eg. half-eaten breakfast, dim morning kitchen, unmade bed).

3. type="lifestyle" — Daily life affected
   • copy = 4-6 line paragraph describing concrete daily moments where the problem shows up. Use sensory detail. Still first-person.
   • 2 imagePrompts: lifestyle moments featuring the same character — eg. character at office desk looking drained, character with kids but visibly exhausted.

4. type="failed-solutions" — "Saya dah cuba semua…"
   • copy = 4-6 line paragraph listing 2-3 things they tried before AND why each failed. Vulnerable tone — admits trying random products / diets / supplements.
   • bullets = optional 2-3 short items in parallel "Saya pernah cuba X — tidak berkesan kerana Y" style
   • 1 imagePrompt: character at a table with several discarded products / bottles / supplements (NOT our product) — looking exasperated. Same person, same environment.

5. type="why-happens" — Emotional peak (lowest point)
   • copy = 3-5 line paragraph. THIS IS THE EMOTIONAL VALLEY. Character admits feeling defeated, possibly close to giving up. Quiet, vulnerable, almost confessional. NO marketing. NO claims yet.
   • 1 imagePrompt: character ALONE in a quiet moment — staring at window / sitting on bed edge / by themselves. Lowest emotional point. Same person.

6. type="product-discovery" — Cơ duyên (the discovery moment)
   • copy = 4-6 line paragraph. How they STUMBLED on the product. Friend recommended / saw a Facebook ad / read an article / pharmacist mentioned. Believable casual discovery — NOT "TIME-LIMITED OFFER". Tone: gentle curiosity.
   • 1 imagePrompt: character reading about / receiving the product. Could be reading a phone screen, holding a parcel, or product just placed on their table. First time the product appears in the pack. Use the exact uploaded product packaging (preserve label/logo/bottle shape — narrow product lock).

7. type="mechanism" — Initial skepticism + how it works
   • copy = 4-6 line paragraph. Character admits being skeptical. Read the ingredient list. Looked it up. Decided to give it a try because "tak ada apa nak rugi". Add 2-3 simple ingredient sentences in story form (NOT a bulleted ingredient card).
   • 2 imagePrompts: (a) close-up of character reading the product label thoughtfully; (b) character with the product on a plain surface — first dose moment.

8. type="benefits" — First week experience (subtle, NOT miracle)
   • copy = 4-6 line paragraph. Day-by-day subtle change. "Hari ke-3 rasa…", "Selepas seminggu, saya perasan…". Realistic gradual change — NOT "lose 5kg overnight". Honest tone.
   • bullets = 3-4 optional short observations in same tone
   • 1 imagePrompt: subtle change moment — character looking slightly brighter, mid-morning natural light, holding coffee or doing a small daily thing. Same person.

9. type="before-after" — Observable change (SAME-SCENE PAIR)
   • copy = 3-5 line paragraph reflecting on the change from week 1 to week 4.
   • 2 imagePrompts in a PAIR (ba_01 + ba_02):
       ba_01.jpg: BEFORE — same character in same room corner, tired posture, dim light. RENDER a clean white "SEBELUM" label stamped top-left.
       ba_02.jpg: AFTER — SAME person, SAME room corner, SAME camera angle, SAME outfit family. Warmer light, brighter eyes, relaxed posture, subtle smile. RENDER "SELEPAS" label top-left.
   • NO collage. NO before-after stacked in one frame. Two separate phone-quality portraits.

10. type="social-proof" — Family / friends notice
    • copy = 4-6 line paragraph. Husband / mother / friend at work / kids notice the change. Quote 1-2 short reactions in dialogue style: "Mak cakap saya nampak lebih segar". NOT a review wall.
    • reviews = optional 2-3 short conversational reactions, NOT formal testimonials
    • 2 imagePrompts: character in a candid moment with family OR friend at a kopitiam. Same person, plus 1-2 supporting characters. Natural setting.

11. type="faq" — Reader Q&A (answered by the character)
    • faqs = 4-5 Q&A where the QUESTION is what a reader might ask and the ANSWER is the character's first-person reply ("Saya pun ingat hal yang sama… tapi…"). NOT brand-voice FAQ. Personal voice.
    • imagePrompts = [] (text-only section)

12. type="final-cta" — Soft emotional invitation
    • copy = 3-4 line closing paragraph. Recommendation style. "Kalau saya boleh berubah, mungkin anda pun boleh. Saya bukan cuba jual apa-apa, saya cuma kongsi pengalaman."
    • cta = ONE soft CTA button text (eg "Cuba lihat di sini" / "Lihat kedai" — NOT "BELI NOW", NOT urgency)
    • urgencyText = OMIT entirely. NO countdown. NO scarcity. This form deliberately has zero hard-sell.
    • 1 imagePrompt: closing portrait — character holding the product casually, warm window light, calm confident smile. Same person.

═══════════════════════════════════════════════════════════════
COPY RULES — DIFFERENT FROM FORM 1
═══════════════════════════════════════════════════════════════
• First-person narrative ("saya / aku") throughout, NEVER third-person brand voice
• Paragraphs 3-5 lines (NOT short punchy bullets like form 1)
• Tone vulnerable, honest, believable — like a diary entry on a blog
• NO emoji spam — max 1 emoji per section, often zero
• NO "HARI INI SAHAJA" / "STOK TERHAD" / countdown / scarcity
• NO repeated CTA buttons mid-story — only ONE soft CTA in section 12
• Use Malaysian colloquial registers when language is ms: "tak ada apa nak rugi", "macam tak percaya", "saya pun"
• Character voice consistent — same age, same family context, same speech patterns across all 12 sections

═══════════════════════════════════════════════════════════════
IMAGE RULES — DIFFERENT FROM FORM 1
═══════════════════════════════════════════════════════════════
• Every imagePrompt that includes a person MUST start with the character's appearance lock (paste it verbatim from the user prompt at the start of each people-shot prompt).
• Same character across ALL people-shots. No random new women, no different ethnicity, no different age, no different hijab style.
• Emotional progression: early sections (hero/pain/lifestyle/failed-solutions/why-happens) → dim cool light, low energy, tired posture. Mid sections (product-discovery/mechanism/benefits) → neutral / hopeful. Late sections (before-after/social-proof/final-cta) → warmer brighter light, relaxed posture, gentle smile.
• Aesthetic: cinematic lifestyle photography, documentary feel, natural imperfection (subtle skin texture, slight motion, soft DOF). NOT studio. NOT commercial. NOT UGC selfie.
• NO designed text overlays except the SEBELUM/SELEPAS labels on ba_01/ba_02 in section 9.
• NO floating product PNG. NO product-and-box-side-by-side composition. When product appears, it must be physically held or naturally placed in the scene.

═══════════════════════════════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════════════════════════════
• Output in the language specified by the user prompt
• titleVi/headlineVi/subheadlineVi/ctaVi/bulletsVi/viTranslation ALWAYS in Vietnamese regardless of output language (for the Vietnamese marketer)
• imagePrompt.prompt ALWAYS English
• Brand name + ingredient names kept as-is

═══════════════════════════════════════════════════════════════
ABSOLUTE BANS for this form
═══════════════════════════════════════════════════════════════
✗ 17-section conversion factory structure
✗ Repeated CTAs across multiple sections (only ONE CTA, in section 12)
✗ Countdown / scarcity / urgency strips
✗ WhatsApp screenshot section (not part of this form)
✗ Multiple different women across the pack — must be ONE consistent character
✗ Designed text overlays on hero / pain / etc.
✗ Bullet-heavy section copy — prose throughout
✗ Brand-voice corporate tone
✗ Studio / glossy / commercial aesthetic`

// ── User prompt builder — declares the character + product context ─────

function buildStorytellingUserPrompt(
  params: LandingGenParams,
  product: { productName: string; offer?: string; productClaim?: string; targetAudience?: string },
  character: CharacterProfile,
): string {
  const langName = params.language === 'ms' ? 'Bahasa Melayu (Malaysian colloquial)'
                  : params.language === 'vi' ? 'Tiếng Việt'
                  : 'English'

  const lines: string[] = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT BRIEF')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Product name: ${product.productName}`)
  if (product.offer)          lines.push(`Offer / price: ${product.offer}`)
  if (product.productClaim)   lines.push(`Main claim: ${product.productClaim}`)
  if (product.targetAudience) lines.push(`Target audience: ${product.targetAudience}`)
  if (params.nicheHint)       lines.push(`Niche hint: ${params.nicheHint}`)
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('CHARACTER LOCK (USE EXACTLY THIS PERSON IN EVERY COPY + IMAGE PROMPT)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Name: ${character.name}`)
  lines.push(`Archetype: ${character.archetype}`)
  lines.push(`Appearance: ${character.appearanceLock}`)
  lines.push(`Environment: ${character.environmentLock}`)
  lines.push('')
  lines.push('Emotional arc by section (use to set expression / posture / light mood):')
  character.emotionalArc.forEach((e) => {
    lines.push(`  • ${e.sectionType}: ${e.mood}`)
  })
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('OUTPUT LANGUAGE')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Write ALL copy fields ENTIRELY in ${langName}. Zero mixing.`)
  lines.push(`titleVi, viTranslation, headlineVi, subheadlineVi, ctaVi, bulletsVi: ALWAYS Vietnamese.`)
  lines.push(`imagePrompt.prompt: ALWAYS English.`)
  lines.push(`Output JSON field "language": "${params.language}"`)
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('IMAGE COUNT BUDGET (per section — DO NOT OVERSHOOT)')
  lines.push('═══════════════════════════════════════════════════════════════')
  Object.entries(IMAGES_PER_SECTION).forEach(([sec, n]) => {
    lines.push(`  • ${sec}: ${n} image${n === 1 ? '' : 's'}`)
  })
  lines.push('Total target: ~16 images for this whole pack. Form 1 ships ~36 — we want HALF the image count, each image more emotional and larger.')
  lines.push('')

  lines.push('Now produce the 12-section storytelling JSON.')

  return lines.join('\n')
}

// ── Main buildPack — Phase 3 real engine ─────────────────────────────────

async function buildPack(params: LandingGenParams): Promise<LandingPagePack> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  // 1. Generate the character — locked for this pack
  const character = generateCharacterProfile(product.productName)
  console.info('[FORM advertorial] character locked:', character.name, '·', character.archetype)

  // 2. Build user prompt with character + product context baked in
  const userPrompt = buildStorytellingUserPrompt(params, product, character)
  const priceTag = extractPriceTag(product.offer ?? '')

  // 3. Single Gemini call with storytelling system prompt
  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: STORYTELLING_SYSTEM_PROMPT,
    maxOutputTokens: 24576,    // less than form 1 — shorter expected output
    responseMimeType: 'application/json',
  })

  // 4. Parse + normalize
  let parsed: RawPack
  try {
    parsed = JSON.parse(extractJson(raw)) as RawPack
  } catch {
    console.error('[FORM advertorial] JSON parse failed. Raw head:', raw.slice(0, 500))
    throw new Error('Gemini trả về JSON không hợp lệ — thử lại')
  }

  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Gemini không trả về section nào — thử lại')
  }

  // 5. Iterate storytelling section order — drop anything off-blueprint
  const sections: LandingSection[] = []
  for (const ord of STORYTELLING_SECTIONS) {
    const found = parsed.sections.find((s) => s.type === ord)
    if (found) {
      const norm = normalizeSection(found)
      if (norm) sections.push(norm)
    }
  }
  console.info('[FORM advertorial] emitted', sections.length, '/', STORYTELLING_SECTIONS.length, 'sections · types =', sections.map((s) => s.type).join(' → '))

  if (sections.length === 0) {
    throw new Error('Không có section nào hợp lệ trong JSON Gemini trả về')
  }

  // 6. Post-process — price injection (same as form 1)
  injectPriceIntoPrompts(sections, priceTag)

  return {
    productId: params.productId,
    productName: product.productName,
    language: (parsed.language as LandingLanguage) ?? params.language,
    sections,
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
    form: 'advertorial',
    characterProfile: character,
  }
}

// ── Module export ────────────────────────────────────────────────────────

export const module: FormBlueprintModule = {
  formId: 'advertorial',
  label: {
    vi: 'Kể Chuyện Hành Trình',
    en: 'Storytelling Advertorial',
  },
  description: {
    vi: 'Một nhân vật xuyên suốt kể lại vấn đề của họ, quá trình tuyệt vọng, cơ duyên tìm thấy sản phẩm và kết quả sau khi sử dụng. Nhiều chữ hơn, ít ảnh hơn, cảm xúc hơn.',
  },
  tooltip: {
    vi: 'Form advertorial dạng kể chuyện cá nhân. 12 section emotional arc, 1 nhân vật xuyên suốt với character continuity, ~16 ảnh (vs 36 ảnh form UGC), 1 CTA mềm ở cuối. Phù hợp ngách supplement / health / beauty cần build trust trước khi sell.',
  },
  sections: STORYTELLING_SECTIONS,
  psychology: {
    readingBehavior: 'deep-read',
    pacing: 'flowing',
    densityChu: 'high',
    densityAnh: 'medium',
  },
  cta: {
    placement: 'single-end',
    tone: 'invitation',
    ctaSections: ['final-cta'],
  },
  imageStrategy: {
    overallStyle: 'cinematic-lifestyle',
    characterContinuity: true,  // ← Phase 3 enables this for the first time
    allowStudioLook: false,
    imagesPerSection: IMAGES_PER_SECTION,
  },

  buildPack,
}
