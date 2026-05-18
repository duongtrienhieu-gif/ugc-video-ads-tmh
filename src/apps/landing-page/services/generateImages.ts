import type {
  LandingPagePack, LandingSection, ImagePrompt, SectionType, VisualMemoryItem,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import {
  submitGpt4oImage, pollGpt4oUntilDone, type Gpt4oSize,
} from '../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'

// ─────────────────────────────────────────────────────────────────────────
// IMAGE GENERATION QUEUE for landing-page packs.
//
// Z8 PERFORMANCE FIX — targets:
//   • 5 ảnh   < 30s
//   • 15 ảnh  < 90s
//   • 30 ảnh  < 3-5 phút
//
// Major changes vs previous version:
//  1. Concurrency 2 → 6 (3x throughput).
//  2. PRIORITY QUEUE — hero generates FIRST, then social-proof/whatsapp/
//     before-after (visible above the fold), then infographics/comparison,
//     then everything else. User sees important assets land first.
//  3. CREDIT-SAFE RETRY — splits submit / poll so on a poll-timeout we
//     poll the SAME taskId again instead of re-submitting (saves credit).
//  4. 'retrying' UI status — distinct from 'generating', surfaced in cards.
//  5. SECTION 1 CHARACTER LOCK — every hero prompt is prepended with
//     "Malaysian Muslim woman in hijab" lock so the brand persona stays
//     consistent across hero variants.
// ─────────────────────────────────────────────────────────────────────────

// Section types rendered WITH the user's product references.
const PRODUCT_FOCUS_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'hero',
  'product-discovery',
  'ingredients',
  'mechanism',
  'benefits',
  'comparison',
  'social-proof',
  'whatsapp-testimonials',
  'offer',
  'final-cta',
])

// People / lifestyle / editorial — do NOT pass product refs.
const PEOPLE_FOCUS_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'pain',
  'failed-solutions',
  'lifestyle',
  'news-proof',
  'before-after',
])

// ─────────────────────────────────────────────────────────────────────────
// PRIORITY QUEUE — lower number = higher priority.
//
// Tier 0 (HERO — non-negotiable first): hero
// Tier 1 (TRUST proof above the fold): social-proof, whatsapp-testimonials,
//        before-after, final-cta
// Tier 2 (BODY copy support):           pain, product-discovery, lifestyle,
//        news-proof
// Tier 3 (LOW-priority fillers):        ingredients, mechanism, benefits,
//        comparison, why-happens, failed-solutions, offer, faq
// ─────────────────────────────────────────────────────────────────────────
const SECTION_PRIORITY: Record<SectionType, number> = {
  'hero':                  0,
  'social-proof':          1,
  'whatsapp-testimonials': 1,
  'before-after':          1,
  'final-cta':             1,
  'pain':                  2,
  'product-discovery':     2,
  'lifestyle':             2,
  'news-proof':            2,
  'ingredients':           3,
  'mechanism':             3,
  'benefits':              3,
  'comparison':            3,
  'why-happens':           3,
  'failed-solutions':      3,
  'offer':                 3,
  'faq':                   3,
}

// ─────────────────────────────────────────────────────────────────────────
// PRODUCT IDENTITY LOCK — Z22 NARROW LOCK POLICY.
//
// Previously this prefix locked too much (composition, lighting, hand, room).
// Result: KIE rendered every image with the same hand pose / same background /
// same bottle angle → obvious AI-clone look that users spot instantly.
//
// New policy: lock ONLY the product identity (label / logo / bottle shape).
// EXPLICITLY allow every other axis to vary so the section feels like real
// customer photos taken on different days in different rooms.
// ─────────────────────────────────────────────────────────────────────────
// Phase 7 stabilization — hardened against fake-brand hallucination.
// User reported pain/lifestyle sections producing Shaklee, Nutriplus,
// random detox / supplement bottles instead of the uploaded product.
// Now explicit fail-rather-than-substitute language + named examples
// of forbidden hallucinations.
const PRODUCT_IDENTITY_PREFIX =
  'ABSOLUTE PRODUCT IDENTITY LOCK — read this rule before anything else in the prompt:\n'
  + '  • The product in this image MUST be PIXEL-FOR-PIXEL the EXACT product visible in the attached reference image(s) (filesUrl).\n'
  + '  • Match EVERY detail: brand name TEXT on label, label typography, label colors, bottle/jar/sachet SHAPE, packaging proportions, cap style, cap color, logo placement.\n'
  + '  • You may VARY freely: background scene, lighting, hand pose, camera angle, bottle rotation, scene context.\n'
  + '  • NEVER invent a different brand. NEVER render a different label. NEVER swap to a similar-looking supplement. NEVER render: Shaklee, Nutriplus, Gastrofeed, Detox Juice, Triple Detox, generic "probiotic supplement bottle", random wellness bottle, fake medicine box, made-up brand text.\n'
  + '  • If the reference image is not clear enough to replicate, fail rather than substitute. Do NOT hallucinate packaging.\n'
  + '  • The uploaded reference product is the ONLY product allowed to appear in this generated image.\n'

// ─────────────────────────────────────────────────────────────────────────
// SECTION-1 HERO CHARACTER LOCK — Malaysian Muslim hijab women only.
// Brand persona consistency across hero variants. No men, no Western faces,
// no Chinese influencer aesthetic.
// ─────────────────────────────────────────────────────────────────────────
// Z23 — compressed from ~330 to ~150 chars.
const HERO_CHARACTER_LOCK =
  'CHARACTER: Malaysian Muslim woman in modest hijab, mid-30s, Southeast-Asian features, warm UGC selfie aesthetic. NO men, NO Western/Chinese/Korean faces. '

// ─────────────────────────────────────────────────────────────────────────
// Z22 — DIVERSITY ENGINE: 4 axis pools rotated deterministically per image.
//
// For a section with N images, this picks N DIFFERENT combinations of
// (background, camera angle, hand pose, lighting) by hashing
// `${sectionType}-${imageIdx}-${variationSeed}`. KIE receives an explicit
// "shot this scene at <angle>, in <background>, with <hand>, in <lighting>"
// directive per image so latents diverge.
//
// Pools are deliberately wide. The hash-mod indexing guarantees no two
// adjacent images in the same section pick the same axis value.
// ─────────────────────────────────────────────────────────────────────────

const BG_POOL = [
  'home kitchen counter with morning sunlight',
  'wooden dining table with breakfast nearby',
  'minimal white desk with notebook',
  'living room sofa corner with cushions',
  'cafe table with coffee cup beside',
  'marble bathroom countertop with towel',
  'bedroom bedside with plant and soft daylight',
  'home office desk with laptop edge in frame',
  'balcony garden corner with leaves softly out of focus',
  'sunlit windowsill with sheer curtain',
  'restaurant table with food blurred behind',
  'car passenger seat with daylight through window',
  'picnic blanket outdoor warm light',
  'shelf-edge with books and small plant',
  'open shopfront with natural ambient light',
]

const ANGLE_POOL = [
  'iPhone selfie eye-level',
  'slight low-angle 30° hand-held',
  '3/4 angle waist-height',
  'top-down flat-lay',
  'side-profile slice with shallow DOF',
  'over-the-shoulder POV',
  'first-person reach toward camera',
  'mirror reflection shot',
  'macro close-up of label',
  'wide environmental lifestyle shot',
]

const HAND_POOL = [
  'one hand cradling the product at chest',
  'both hands lifting the product to face',
  'pointing index finger at the label',
  'product resting on palm of open hand',
  'no hands — product on a real surface',
  'hand on belly / chest area, product beside',
  'reaching toward camera with product',
  'product gripped at the neck with thumb on cap',
]

const LIGHT_POOL = [
  'soft window daylight from left',
  'warm kitchen-side glow with golden hour bounce',
  'overhead noon natural light',
  'cool morning bathroom diffused light',
  'dim cozy table-lamp evening',
  'mixed window + ceiling light',
  'soft overcast diffused window light',
  'late afternoon side-warmth from right window',
]

// Z24 — COMPOSITION POOL. Root cause of "all 4 WhatsApp attachments show
// box + bottle side by side" was that KIE was mimicking the composition of
// the reference product image. By injecting an explicit composition
// directive per render, we force the model to pick a DIFFERENT physical
// arrangement of the product in each shot — not always packshot+bottle
// side-by-side.
const COMPOSITION_POOL = [
  'single bottle only (no box) held casually',
  'single bottle only on a real surface, no packaging box',
  '2 bottles together standing on a table — no box',
  '3-4 bottles grouped casually (family pack feel) — no box',
  'bottle on a dining table with breakfast/meal nearby',
  'bottle in the kitchen next to fresh produce / fruit',
  'bottle peeking out of a handbag or tote',
  'bottle on a bathroom shelf with personal items',
  'bottle on an office desk next to laptop edge',
  'bottle handheld close-up showing only label and one hand',
  'casual selfie of person holding a single bottle',
  'unpacking-style shot: bottle just removed from torn paper / box discarded behind',
  'bottle on a messy real kitchen counter (slightly cluttered, lived-in)',
  'bottle outdoors (balcony / picnic / cafe) in natural light',
]

/** Tiny deterministic hash → index into a pool. */
function hashPick<T>(pool: T[], seed: string, salt: number): T {
  let h = 0
  const s = `${seed}::${salt}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}

/** 6-char random token appended to every prompt to force latent drift. */
function makeVariationSeed(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** Z22 — per-image diversity directive.
 *  Suppressed for `before-after` (which has its own same-scene lock spec
 *  written by Gemini into the imagePrompt body). */
// Sections where the diversity directive is suppressed because the
// section spec already mandates a specific structure (same-scene lock,
// app screenshot recreation, etc.). Mixing in a "random composition"
// directive would fight the structural intent.
const DIVERSITY_SUPPRESSED_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'before-after',          // same-scene lock per pair
  'social-proof',          // FB/TikTok/Shopee screenshot recreation
  'whatsapp-testimonials', // pure screenshot vs attached-photo split
  'news-proof',            // news article screenshot recreation
])

// Z24 — diversity directive with COMPOSITION axis added. Suppressed for
// sections where structure is locked by spec (see set above).
//
// Phase 3 — when pack.form === 'advertorial' AND pack.characterProfile is
// set, the diversity directive is REPLACED by a character-continuity
// directive: same person, same environment, varying ONLY by emotional
// state per section. The COMPOSITION_POOL/BG_POOL/etc shotgun approach
// would fight the storytelling intent (we WANT the same room across
// sections — that's the whole point of "kể chuyện hành trình").
function buildDiversityDirective(job: ImageJob): string {
  // Storytelling override — character lock, no random pool
  if (job.pack.form === 'advertorial' && job.pack.characterProfile) {
    return buildStorytellingContinuityDirective(job)
  }
  // Expert / scientific override — editorial-infographic aesthetic with
  // an expert character lock for people-shots and clean-editorial style
  // for diagram/ingredient/news-proof shots.
  if (job.pack.form === 'chuyen-gia') {
    return buildExpertEditorialDirective(job)
  }
  // Premium / luxury override — fashion-editorial aesthetic, soft palette,
  // generous whitespace, cinematic luxury campaign feel.
  if (job.pack.form === 'premium') {
    return buildPremiumLuxuryDirective(job)
  }
  if (DIVERSITY_SUPPRESSED_SECTIONS.has(job.section.type)) return ''
  if (!job.prompt.variationSeed) job.prompt.variationSeed = makeVariationSeed()
  const seed = `${job.section.type}-${job.imageIdx}-${job.prompt.variationSeed}`
  const composition = hashPick(COMPOSITION_POOL, seed, 0)
  const bg          = hashPick(BG_POOL,          seed, 1)
  const angle       = hashPick(ANGLE_POOL,       seed, 2)
  const hand        = hashPick(HAND_POOL,        seed, 3)
  const light       = hashPick(LIGHT_POOL,       seed, 4)
  return `COMPOSITION: ${composition}. SHOT: ${angle}, in ${bg}, ${hand}, ${light}. Render as INDEPENDENT phone photo — do not mimic the side-by-side box+bottle composition of the reference image; pick the COMPOSITION above. Seed: ${job.prompt.variationSeed}.`
}

/** Phase 6 — Premium / luxury form directive.
 *
 *  Routes per section type. All shots get a luxury-editorial aesthetic
 *  envelope; section-specific adjustments layer on top.
 *
 *  Hero / lifestyle / product-discovery / final-cta: fashion-campaign
 *  cinematic shot.
 *  Pain (brand-philosophy mood) / mechanism (texture-ritual): atmospheric
 *  moody photography or premium texture macro.
 *  Ingredients: luxury beauty-magazine ingredient macro.
 *  Social-proof: editorial portrait (NOT marketplace screenshot).
 *  News-proof: Vogue/Tatler/Female Malaysia mock layout (NOT mStar).
 */
function buildPremiumLuxuryDirective(job: ImageJob): string {
  const sectionType = job.section.type
  const imageIdx = job.imageIdx

  // Phase 7 stabilization — premium form was producing fashion-model
  // energy with no product visible. User wants PREMIUM WELLNESS BRAND
  // aesthetic (Aman / Aesop / Tatcha) NOT fashion editorial.
  const baseAesthetic =
    'PREMIUM WELLNESS BRAND AESTHETIC (thuong-hieu-cao-cap form — NOT fashion editorial):\n'
    + '  • TARGET reference: Aman / Aesop / Tatcha / Japanese wellness / Scandinavian wellness brand campaign. NOT Vogue / Tatler / Zara campaign. NOT perfume / cosmetic advertising. NOT high-fashion runway.\n'
    + '  • Premium palette: cream / dusty rose / soft beige / linen / marble / pale sage / muted gold / warm grey. AVOID hot red, neon orange, harsh contrast.\n'
    + '  • Composition: real-feeling affluent home (marble kitchen / linen bedroom / sunlit bathroom shelf) OR studio still-life. Generous whitespace, soft natural daylight preferred over harsh studio.\n'
    + '  • Models: SOUTHEAST ASIAN Malaysian, mid-30s to mid-40s, refined casual wellness attire (linen / silk / soft cotton). Quietly confident demeanor. NO broad smile. NO phone-selfie. NO fashion-model stance. NO seductive pose. NO heavy makeup. NO statement jewelry / designer logos.\n'
    + '  • NO designed text overlay (no discount badge, no CTA button, no star widget, no marketplace UI, no emoji rendered into image).\n'

  // ── PRODUCT-VISIBLE sections — user said premium needs product in 80% of shots ──
  if (sectionType === 'hero') {
    return baseAesthetic + (
      '  • Specific to hero: PRODUCT MUST BE VISIBLE in this shot. Elegant Malaysian woman in her tasteful affluent home — marble kitchen counter, linen-dressed bedroom, OR sunlit bathroom shelf — with the EXACT uploaded product naturally in frame (held softly, on the shelf next to fresh fruit, on a marble surface next to coffee). NOT empty-room standing pose. NOT fashion model headshot. Soft natural daylight. Wellness lifestyle mood.'
    )
  }

  if (sectionType === 'lifestyle') {
    if (imageIdx === 0) {
      return baseAesthetic + (
        '  • Specific to lifestyle (morning ritual): PRODUCT MUST BE VISIBLE. Elegant Malaysian woman at her marble kitchen counter — fresh fruit / herbal tea / coffee in frame, the EXACT uploaded product naturally placed or held. Sunlit warm morning light. Reference: Japanese wellness / Aman-spa morning aesthetic. NOT fashion editorial.'
      )
    }
    return baseAesthetic + (
      '  • Specific to lifestyle (evening ritual): PRODUCT MUST BE VISIBLE. Same OR different elegant Malaysian woman in her bathroom shelf moment OR bedside ritual with the EXACT product clearly in frame. Soft warm evening light, candle / linen / muted tones. Reference: Aesop bathroom / Scandinavian wellness home. NOT perfume ad.'
    )
  }

  if (sectionType === 'benefits') {
    return baseAesthetic + (
      '  • Specific to benefits: PRODUCT MUST BE VISIBLE. Elegant Malaysian woman in a quietly-confident wellness moment that conveys renewal (energetic morning glow, peaceful evening, calm healthy life) with the product naturally held or placed in frame. NOT icon grid, NOT infographic, NOT a fashion-model headshot.'
    )
  }

  if (sectionType === 'final-cta') {
    return baseAesthetic + (
      '  • Specific to final-cta: PRODUCT MUST BE PROMINENTLY VISIBLE. Closing premium wellness brand shot — the exact product elegantly displayed on a premium surface (marble / linen / glass) OR held by a relaxed model in golden-hour wellness lifestyle setting. Calm grounded mood. Wellness brand campaign aesthetic, NOT fashion close-up.'
    )
  }

  if (sectionType === 'product-discovery') {
    return baseAesthetic + (
      '  • Specific to product-discovery: PRODUCT IS THE HERO. Luxury wellness-brand product photography — exact uploaded product on a premium surface (raw silk, soft marble, dusty linen, sculpted shadow). Soft natural daylight or controlled studio. Wellness-brand still-life aesthetic (Aesop / Tatcha / Goop product page register), NOT fashion still-life.'
    )
  }

  if (sectionType === 'mechanism') {
    return baseAesthetic + (
      '  • Specific to mechanism (texture / ritual moment): close-up of the product\'s sensory experience — cream swatch on fingertips, capsule on porcelain dish, oil drop on glass — OR a serene wellness ritual moment with product visible. Editorial intimate composition. Premium wellness aesthetic, NOT cosmetic-ad gloss.'
    )
  }

  if (sectionType === 'ingredients') {
    return baseAesthetic + (
      '  • Specific to ingredients: premium WELLNESS ingredient macro — natural source close-up (ginseng root on linen, marine algae texture, rosehip macro, ginger slice) on luxe neutral background. Wellness brand still-life (Aesop / Tatcha aesthetic), NOT cosmetic beauty-magazine.'
    )
  }

  if (sectionType === 'pain') {
    return baseAesthetic + (
      '  • Specific to pain (brand philosophy mood): atmospheric photograph evoking the gap the brand fills — quiet morning routine, hand on glass, candle moment, empty wellness home corner. Does NOT need product in frame for this section only (mood philosophy). NOT fashion editorial mood. Soft contemplative wellness mood.'
    )
  }

  if (sectionType === 'social-proof') {
    return baseAesthetic + (
      '  • Specific to social-proof: refined editorial portrait of an elegant Malaysian woman (or man) in soft natural light, candid contemplative moment. Wellness lifestyle portrait — NOT fashion magazine. NOT looking at camera. NOT broad smile. NO Shopee/TikTok/Facebook UI. NO marketplace badges.'
    )
  }

  if (sectionType === 'news-proof') {
    if (imageIdx === 0) {
      return baseAesthetic + (
        '  • Specific to news-proof (mock 1): premium press editorial layout — Vogue / Tatler / Harper\'s Bazaar / Female Malaysia register OK for this MOCK only (this is a mock article, fashion-mag layout is appropriate for it). Clean serif typography, generous whitespace, single product feature image. NEVER mStar / Berita Harian style.'
      )
    }
    return baseAesthetic + (
      '  • Specific to news-proof (mock 2): minimal recognition badge / award-mention layout. Neutral palette, single line of recognition text. NO loud color, NO starbursts, NO discount badges.'
    )
  }

  // Fallback
  return baseAesthetic + (
    `  • Specific to ${sectionType}: premium wellness lifestyle composition. Product visible when contextually relevant. Quiet confident wellness mood, NOT fashion editorial.`
  )
}

/** Phase 4 — Expert / Scientific form directive.
 *
 *  Routes based on section type within the expert blueprint:
 *
 *    People-shots (hero/pain/failed-solutions/why-happens/mechanism/
 *    comparison/before-after/lifestyle/final-cta): emit expert continuity
 *    lock so the same expert appears across all shots.
 *
 *    Diagram-shots (pain anatomy diagrams, why-happens scientific diagrams,
 *    mechanism flow diagram, comparison chart, failed-solutions
 *    comparison): emit editorial-infographic style directive (clean
 *    palette, neat typography, magazine-textbook style).
 *
 *    Ingredient shots: emit ingredient-macro photography directive.
 *
 *    News-proof shots: emit clean editorial mock article directive.
 *
 *  Since Gemini wrote the imagePrompt body already with the section
 *  context, this directive layers AESTHETIC + CONTINUITY guarantees on
 *  top — KIE may otherwise drift toward UGC selfie defaults. */
function buildExpertEditorialDirective(job: ImageJob): string {
  const expert = job.pack.characterProfile
  const sectionType = job.section.type
  const imageIdx = job.imageIdx

  // Sections where the imagePrompt body is fundamentally about an
  // INFOGRAPHIC / DIAGRAM (no expert face needed). Apply editorial
  // aesthetic only.
  const isDiagramShot =
    (sectionType === 'pain'             && imageIdx === 0) ||
    (sectionType === 'failed-solutions' && imageIdx === 0) ||
    (sectionType === 'why-happens'      && imageIdx === 0) ||
    (sectionType === 'mechanism'        && imageIdx === 0) ||
    (sectionType === 'benefits'         && imageIdx === 0) ||
    (sectionType === 'comparison'       && imageIdx === 0)

  const isIngredientMacro = sectionType === 'ingredients'
  const isNewsProof       = sectionType === 'news-proof'
  const isBeforeAfter     = sectionType === 'before-after'

  // ── Diagram / infographic shots — REQUIRE labeled callouts ────────────
  if (isDiagramShot) {
    return (
      `EDITORIAL SCIENTIFIC INFOGRAPHIC (chuyen-gia form):\n`
      + `  • Clean magazine-textbook layout with VISIBLE TEXT LABELS rendered into the image. Use neat editorial sans-serif typography for all callouts.\n`
      + `  • Soft palette: cream / pale sage / off-white / pale blue. Generous whitespace.\n`
      + `  • Scientific / anatomical diagram with clear text callouts pointing to organs / cells / mechanism steps. EVERY callout has a short label (eg "Gut Microbiome", "Bước 1", "50 Billion CFU"). Thin connecting lines or arrows between label and target.\n`
      + `  • Reference style: pages from a health magazine OR medical textbook — NOT phone screenshots, NOT marketing posters.\n`
      + `  • NO person in this shot. NO UGC selfie aesthetic. NO TikTok composition. NO floating product PNG. NO emoji.\n`
      + `  • LABELS are REQUIRED — this is the difference between "scientific article" and "generic stock illustration".`
    )
  }

  // ── Ingredient infographic — LABELED scientific aesthetic ──────────────
  if (isIngredientMacro) {
    return (
      `INGREDIENT SCIENTIFIC INFOGRAPHIC (chuyen-gia form) — LABELED:\n`
      + `  • The active compound name MUST be rendered AS TEXT inside the image in clean editorial sans-serif typography (eg "Lactobacillus Acidophilus", "Niacinamide 5%", "Glucosamine Sulfate", "Hyaluronic Acid"). Use the exact compound name from the imagePrompt body above.\n`
      + `  • Optional small molecular formula OR "% concentration" annotation next to the label.\n`
      + `  • Vary asset format across the section's 3 images:\n`
      + `      - Labeled ingredient macro (close-up of raw compound + name label)\n`
      + `      - Capsule cross-section / formula board with 3-4 ingredient labels and thin callout lines\n`
      + `      - Mechanism target diagram (microbiome / cell / tissue) showing where the compound acts, with the compound name labeled\n`
      + `  • Neutral background — pale cream / off-white / soft beige / linen / pale sage.\n`
      + `  • Editorial supplement / food / scientific magazine photography aesthetic.\n`
      + `  • NO person. NO product packaging / bottle in frame. NO emoji. NO marketing badge. NO discount overlay.\n`
      + `  • Banned: generic unlabeled powder stock photo (this is the failure mode we are fixing — every ingredient image MUST have its compound name visible).`
    )
  }

  // ── News-proof editorial mocks ───────────────────────────────────────
  if (isNewsProof) {
    return (
      `EDITORIAL AUTHORITY MOCK (chuyen-gia form):\n`
      + `  • Clean health-magazine / journal article layout OR authority badge composition.\n`
      + `  • Reference Malaysian publications when relevant: mStar, Berita Harian, Health.com.my, Hello Doktor style.\n`
      + `  • NO designed marketing graphics. NO floating product.\n`
      + `  • Soft neutral palette. Magazine-clean typography.`
    )
  }

  // ── Before-after clinical pair ───────────────────────────────────────
  if (isBeforeAfter) {
    return (
      `CLINICAL CASE-STUDY PAIR (chuyen-gia form — anonymized):\n`
      + `  • Subject anonymity cue (head out of frame, back of head, OR shadow / silhouette) — clinical patient case, NOT dramatic UGC transformation.\n`
      + `  • Soft clinical environment — NOT homey kitchen, NOT gym.\n`
      + `  • SAME framing across the BEFORE/AFTER pair (same camera angle, same anonymity cue).\n`
      + `  • RENDER "SEBELUM" / "SELEPAS" Malay label top-left in clean editorial sans-serif (NOT bold caps stamp — clean magazine label style).\n`
      + `  • NO dramatic body-shape swap. NO gym-influencer aesthetic. Measured clinical transformation only.`
    )
  }

  // ── Default: expert portrait shot (hero / lifestyle / final-cta) ──────
  if (!expert) return ''
  const arc = expert.emotionalArc.find((e) => e.sectionType === sectionType)
  const tone = arc?.mood ?? 'calm authoritative professional expression'
  return (
    `EXPERT CONTINUITY LOCK (chuyen-gia form — same expert every people-shot):\n`
    + `  • Expert: ${expert.name} — ${expert.archetype}\n`
    + `  • Appearance (KEEP EXACT across all renders): ${expert.appearanceLock}\n`
    + `  • Environment: ${expert.environmentLock}\n`
    + `  • Pose / tone for this section (${sectionType}): ${tone}\n`
    + `  • Editorial clinical photography — clean professional aesthetic, soft natural lighting, magazine-quality composition. NO UGC selfie style. NO designed text overlay (except SEBELUM/SELEPAS labels in before-after section).\n`
    + `  • DO NOT introduce a different expert. DO NOT change face / age / clinical attire / environment between sections — only pose + facial micro-expression vary.`
  )
}

/** Phase 3 (Phase 7 hardened) — character continuity directive for the
 *  advertorial / storytelling form.
 *
 *  Locks the character via TWO mechanisms:
 *    1. Textual appearance + environment lock (this directive)
 *    2. Image reference — hero asset is prepended to filesUrl for every
 *       non-hero people-shot once stage-1 sequential render completes
 *       (see generatePackImages → STAGE 1 + selectRefsForSection)
 *
 *  Adds HARD NEGATIVE bans to prevent the failure modes user reported:
 *  random ethnicity switches, hijab-removed shots, male appearances,
 *  Western/Korean/Chinese influencer faces, age drift, hair-down portraits. */
function buildStorytellingContinuityDirective(job: ImageJob): string {
  const char = job.pack.characterProfile
  if (!char) return ''
  const arc = char.emotionalArc.find((e) => e.sectionType === job.section.type)
  const mood = arc?.mood ?? 'natural neutral expression'

  // Phase 7 — check if hero ref will be injected as filesUrl[0]. If so,
  // tell KIE explicitly that the FIRST reference image IS the hero
  // character (locks face identity via image-to-image).
  const isHeroShot = job.section.type === 'hero'
  const heroSection = job.pack.sections.find((s) => s.type === 'hero')
  const hasHeroRef = !isHeroShot && !!heroSection?.imagePrompts?.[0]?.generatedAssetRef
  const heroRefLine = hasHeroRef
    ? `  • REFERENCE IMAGE #1 (filesUrl[0]) IS THE HERO CHARACTER — render the SAME WOMAN with the SAME FACE / SAME HIJAB STYLE / SAME ETHNICITY. Treat ref image #1 as the identity lock; the OUTPUT must be visually recognizable as the same person.\n`
    : ''

  return (
    `CHARACTER CONTINUITY LOCK (advertorial — Malaysian Muslim hijab woman, SAME person every shot):\n`
    + `  • Person: ${char.name} — ${char.archetype}\n`
    + `  • Appearance (KEEP EXACT across all renders): ${char.appearanceLock}\n`
    + `  • Environment (consistent home / room family): ${char.environmentLock}\n`
    + `  • Mood for this section (${job.section.type}): ${mood}\n`
    + heroRefLine
    + `  • Cinematic lifestyle documentary photography. Natural skin texture. Soft DOF. NO studio glamour. NO commercial gloss. NO designed text overlay (except SEBELUM/SELEPAS labels if section is before-after).\n`
    + `\n`
    + `HARD BANS — this image will be rejected if it depicts:\n`
    + `  ✗ A man / male / boy / father\n`
    + `  ✗ A woman WITHOUT hijab / tudung (hero wears hijab in EVERY shot)\n`
    + `  ✗ Western / Caucasian / European / Korean idol / Chinese beauty model / Japanese anime face\n`
    + `  ✗ Hair-down portrait, fitted Western fashion, bare arms / shoulders / décolletage\n`
    + `  ✗ Different face structure / different ethnicity / different age range than the locked archetype\n`
    + `  ✗ Studio glamour, luxury fashion editorial, professional model headshot, heavy makeup, influencer aesthetic\n`
    + `  ✗ A second main woman (the hero is solo; auxiliary children / spouse / mother allowed but the HERO is the same woman every time)`
  )
}

// Z24 — strengthened negatives per user list. Covers all known failure
// modes: clone composition, fake UI, poster/infographic look, etc.
const NEGATIVE_PROMPT_BLOCK =
  'AVOID HARD: poster or infographic layout; centered symmetrical composition; floating cut-out product PNG over a background; stacked product composites; duplicated background or hand pose across renders; cinematic / studio / luxury / editorial look; AI-glossy hyper-perfect skin; fake or futuristic UI; fake typography; overdesigned spacing; ecommerce advertisement look; fake brand text substitution; box and bottle always side-by-side as the only composition.'

/** Pick the asset refs (if any) to pass into KIE filesUrl for this section. */
/** Phase 7 stabilization — accepts the full pack so storytelling form
 *  can prepend the hero asset as the first filesUrl reference. This is
 *  the TRUE character identity binding (image-based, not just textual)
 *  that section 3 of the user's storytelling spec demands.
 *
 *  Rule per form:
 *    • advertorial: if hero asset is ready → prepend it as ref[0] for
 *      EVERY people-shot. Then add up to 2 product refs (cap total at 3).
 *    • other forms: existing behavior (product refs only). */
function selectRefsForSection(
  type: SectionType,
  pack: LandingPagePack,
  promptBody?: string,
): string[] {
  const memory = pack.visualMemory ?? []
  const refs: string[] = []

  // Storytelling — inject hero asset as the master character reference.
  if (pack.form === 'advertorial' && type !== 'hero') {
    const heroSection = pack.sections.find((s) => s.type === 'hero')
    const heroRef = heroSection?.imagePrompts?.[0]?.generatedAssetRef
    if (heroRef) refs.push(heroRef)
  }

  // ── Phase 7 CRITICAL FIX — product identity lock ─────────────────────
  // User reported pain/lifestyle/before-after sections were producing
  // RANDOM brands (Shaklee Gastrofeed, Nutriplus Detox Juice, etc) when
  // the imagePrompt mentioned the product. Root cause: PEOPLE_FOCUS list
  // excluded these sections from receiving product refs — KIE received
  // no image reference and invented packaging.
  //
  // New rule: if the imagePrompt BODY mentions any product-related token
  // OR the product's actual name, force-attach the product refs even if
  // the section type is normally PEOPLE_FOCUS. This guarantees KIE has
  // a visual reference for the brand whenever a brand is going to be
  // depicted.
  const promptLower = (promptBody ?? '').toLowerCase()
  const productNameLower = (pack.productName ?? '').toLowerCase()
  const PRODUCT_TOKENS = [
    'bottle', 'capsule', 'tablet', 'sachet', 'packet', 'tube', 'jar',
    'supplement', 'probiotic', 'product', 'packaging', 'label',
    'serum', 'cream', 'gel', 'powder',
  ]
  const promptMentionsProduct = memory.length > 0 && (
    PRODUCT_TOKENS.some((tok) => promptLower.includes(tok))
    || (productNameLower.length > 3 && promptLower.includes(productNameLower))
  )

  if (promptMentionsProduct) {
    // Force-attach product refs to lock identity. Even if the section is
    // listed in PEOPLE_FOCUS, the imagePrompt explicitly references the
    // product → we MUST send the reference image to KIE or it invents.
    const room = Math.max(0, 3 - refs.length)
    refs.push(...memory.slice(0, room).map((m) => m.ref))
    return refs
  }

  if (PEOPLE_FOCUS_SECTIONS.has(type)) {
    // Pure people-focused shot with no product mention — no product refs
    // needed (story portrait, before-after pair, news article mock, etc).
    return refs
  }

  if (PRODUCT_FOCUS_SECTIONS.has(type)) {
    const room = Math.max(0, 3 - refs.length)
    refs.push(...memory.slice(0, room).map((m) => m.ref))
  }

  return refs
}

/** Map landing-section ratio → KIE GPT-4o supported size.
 *  KIE only supports 1:1, 3:2 (landscape), and 2:3 (portrait).
 *   - '1:1'  → '1:1'
 *   - '16:9' → '3:2' (closest KIE landscape — used by offer + final-cta banners)
 *   - '4:5' / '9:16' / anything else → '2:3' (portrait, default)
 *  9:16 still banned at the section-spec level. */
function toKieAspect(ratio: string | undefined): Gpt4oSize {
  if (ratio === '1:1')  return '1:1'
  if (ratio === '16:9') return '3:2'
  return '2:3'
}

async function resolveRefs(refs: string[]): Promise<string[]> {
  const urls: string[] = []
  for (const ref of refs) {
    if (!ref) continue
    if (isAssetRef(ref)) {
      const u = await getUrl(ref)
      if (u) urls.push(u)
    } else if (ref.startsWith('http')) {
      urls.push(ref)
    }
  }
  return urls
}

interface ImageJob {
  /** Phase 3 — pack reference so form-aware logic (character continuity,
   *  per-form image strategy) can read pack.form + pack.characterProfile
   *  without threading extra params through every helper. */
  pack: LandingPagePack
  sectionIdx: number
  imageIdx: number
  prompt: ImagePrompt
  section: LandingSection
}

interface QueueOptions {
  concurrency?: number
  signal?: AbortSignal
  onTaskUpdate: (sectionIdx: number, imageIdx: number, patch: Partial<ImagePrompt>) => void
  /**
   * Progress callback. Args:
   *  done, failed, total, retries (number of retry attempts performed so far,
   *  accumulated across all jobs)
   */
  onProgress?: (done: number, failed: number, total: number, retries: number) => void
}

// ─────────────────────────────────────────────────────────────────────────
// Build the final prompt fed to KIE — prepends identity locks as needed.
// ─────────────────────────────────────────────────────────────────────────
function buildFinalPrompt(job: ImageJob, hasProductRefs: boolean): string {
  const parts: string[] = []
  // Hero gets the default UGC-Malaysia character lock ONLY for the UGC
  // form (and only when no custom characterProfile is set). Premium /
  // advertorial / expert / hard-sell have their own model/character
  // direction — stacking the UGC hijab default would conflict with
  // their aesthetic.
  const hasCharacterProfile = !!job.pack.characterProfile
  const formNeedsHeroLock = !job.pack.form || job.pack.form === 'ugc-malaysia'
  if (job.section.type === 'hero' && !hasCharacterProfile && formNeedsHeroLock) {
    parts.push(HERO_CHARACTER_LOCK)
  }
  if (hasProductRefs) parts.push(PRODUCT_IDENTITY_PREFIX)
  parts.push(job.prompt.prompt)

  // Z22 — per-image diversity directive (replaced by continuity directive
  // for advertorial form via buildDiversityDirective branch logic).
  const diversity = buildDiversityDirective(job)
  if (diversity) parts.push(diversity)

  // Z22 — hard negatives. Form-specific overrides:
  //   • chuyen-gia: allows editorial / clinical look
  //   • hard-sell-cod: allows promo banner / CTA overlay / ecommerce ad
  //   • premium: allows fashion-editorial / luxury studio aesthetic +
  //     bans UGC selfie / marketplace screenshots / urgency badges
  //   • advertorial: cinematic-lifestyle, default negatives apply
  //   • ugc-malaysia: default negatives apply
  if (job.pack.form === 'chuyen-gia') {
    parts.push(EXPERT_NEGATIVE_BLOCK)
  } else if (job.pack.form === 'hard-sell-cod') {
    parts.push(HARDSELL_NEGATIVE_BLOCK)
  } else if (job.pack.form === 'premium') {
    parts.push(PREMIUM_NEGATIVE_BLOCK)
  } else {
    parts.push(NEGATIVE_PROMPT_BLOCK)
  }

  return parts.join('\n\n')
}

// Phase 4 (stabilization update) — expert-form-specific negative prompt.
// Allows editorial / clinical / magazine aesthetic + ALLOWS scientific
// text labels (compound names, mechanism step labels, benefit phrases) on
// ingredient / mechanism / benefits / diagram shots. Still bans:
// marketing-style text overlays (discount banners, urgency strips,
// CTA buttons rendered into image), UGC selfie, marketplace screenshots,
// emoji spam, cartoonish illustration.
const EXPERT_NEGATIVE_BLOCK =
  'AVOID HARD (chuyen-gia editorial-infographic form): UGC selfie phone-quality aesthetic; TikTok / Shopee / marketplace screenshot layout; floating product PNG; centered marketing composition; urgency badges / countdown / discount strips / CTA buttons / "DISKAUN" or "ORDER" text rendered into the image; emoji-heavy graphics; cartoonish or chibi illustration; harsh advertising lighting; dramatic gym-influencer transformation aesthetic; chaotic collage; fake brand text substitution; unlabeled generic stock powder photo (ingredient images MUST have compound name labels rendered into them); oversaturated colors. NOTE: scientific text labels (compound names like "Lactobacillus Acidophilus", mechanism step labels like "Bước 1", short benefit phrases like "Tenaga Stabil", anatomical callouts) ARE REQUIRED on infographic / ingredient / mechanism / benefits sections — these are scientific labels, NOT marketing overlays.'

// Phase 6 → Phase 7 stabilization — premium form negative block REWRITTEN.
// User reported the form was producing fashion-model / perfume-ad energy
// with empty rooms and no product. Now explicitly bans fashion editorial
// aesthetic on PEOPLE-SHOTS, requires product visibility, demands
// Southeast Asian Malaysian models with grounded wellness affect.
// Reference brands updated: Aman / Aesop / Tatcha / Japanese wellness /
// Scandinavian wellness — NOT Vogue / Tatler / Zara.
const PREMIUM_NEGATIVE_BLOCK =
  'AVOID HARD (thuong-hieu-cao-cap premium-wellness form): '
  + 'Fashion-magazine / Vogue / Zara campaign / runway aesthetic on PEOPLE-SHOTS; '
  + 'perfume / cosmetic / beauty advertising aesthetic (seductive pose, glamour styling, heavy makeup, statement jewelry, designer logos visible); '
  + 'fashion-model stance / posing / vacant-stare-at-window with no product visible; '
  + 'empty-room standing pose with no product (lifestyle / hero / benefits / final-cta MUST have product naturally in frame); '
  + 'Western / Caucasian / European / Korean idol / Chinese beauty influencer / Japanese anime face on Malaysian-target shots (use SOUTHEAST ASIAN Malaysian models with believable affluent-grounded look); '
  + 'cosmetic-product-page glossy beauty ad aesthetic (premium WELLNESS is calm and grounded, not glossy); '
  + 'broad-smile influencer pose or phone-selfie posing; '
  + 'UGC mobile-phone aesthetic; '
  + 'TikTok / Shopee / Facebook / WhatsApp screenshot UI; '
  + 'marketplace badges (Verified Purchase / 5-star widget / Trending #1); '
  + 'discount banners / urgency strips / countdown / CTA buttons / "DISKAUN" text rendered into image; '
  + 'SEBELUM/SELEPAS dramatic before-after labels; '
  + 'crowd group photos; '
  + 'hot red / neon orange / harsh contrast palettes; '
  + 'loud starburst graphics; '
  + 'floating cut-out product PNG; '
  + 'fake brand text substitution; '
  + 'clinical infographic icon grids; '
  + 'emoji rendered into image.'

// Phase 5 — hard-sell-form-specific negatives. ALLOWS designed CTA
// overlays / promo banners / urgency badges / ecommerce ad look on
// banner-type sections (hero / offer / final-cta / news-proof). Still
// bans the worst AI-clone failure modes: floating cut-out product PNG
// pasted on background, fake brand substitution, identical clone
// composition across all reviewer shots, AI-glossy skin.
const HARDSELL_NEGATIVE_BLOCK =
  'AVOID HARD (chot-don-manh COD form): floating cut-out product PNG pasted onto random background (must be in-scene grounded); identical clone composition across all reviewer / WhatsApp / TikTok / Shopee shots (each reviewer must be a DIFFERENT Malaysian person — diversity desired); AI-glossy hyper-perfect skin on selfie shots (real phone UGC quality with natural skin texture); fake brand text substitution (no inventing brand names — use the exact uploaded product brand); cinematic studio look on UGC sections (banner sections allow promo design but UGC reviews stay imperfect phone-quality); fabricated medical claims rendered into images; Western / Caucasian / Korean / Chinese-influencer faces in Malaysian-target reviewer slots (Malaysian Southeast-Asian features required for testimonials).'

// ─────────────────────────────────────────────────────────────────────────
// CREDIT-SAFE single image — splits submit / poll so we can recover
// in-flight taskIds across retry boundaries instead of burning a fresh
// credit on every retry.
//
// First attempt: submit + poll (5 min timeout)
// Retry attempt: re-poll the OLD taskId for 60s. If KIE eventually returns
// success → no new credit. If still stuck/failed → submit a fresh task.
// ─────────────────────────────────────────────────────────────────────────
// Z23 — tighter timeouts so a single stuck KIE task no longer drags the
// whole queue. Typical KIE GPT-4o render: 40-75s. We give 100s (FRESH) for
// the first attempt; if that times out, recovery-poll the SAME taskId for
// another 30s; otherwise re-submit. MAX_ATTEMPTS dropped 4→2 so we fail
// fast on broken tasks and free the slot for the next image. Same credit
// safety semantics (recovery-poll before re-submit).
const MAX_ATTEMPTS     = 2
const RECOVERY_POLL_MS = 30_000   // was 60s
const FRESH_POLL_MS    = 100_000  // was 5min

async function runWithCreditSafeRetry(
  job: ImageJob,
  _memory: VisualMemoryItem[],  // legacy param — kept for callers, pack now used directly
  kieApiKey: string,
  onTaskUpdate: (patch: Partial<ImagePrompt>) => void,
  signal?: AbortSignal,
): Promise<{ assetRef: string; retries: number }> {
  // Phase 7 — pass prompt body so selectRefsForSection can auto-attach
  // product refs when the imagePrompt mentions bottle / capsule / brand
  // name (prevents KIE from inventing fake brands on people-focus shots).
  const refs = selectRefsForSection(job.section.type, job.pack, job.prompt.prompt)
  const filesUrl = await resolveRefs(refs)
  const hasProductRefs = filesUrl.length > 0

  const effectiveRatio = job.section.imageAspectRatio ?? job.prompt.aspectRatio ?? '4:5'
  const size = toKieAspect(effectiveRatio)

  const finalPrompt = buildFinalPrompt(job, hasProductRefs)

  let lastTaskId: string | null = null
  let lastError: Error | null = null
  let retries = 0

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new Error('Đã huỷ')

    // ── Recover an in-flight task before re-submitting (saves credit) ──
    if (lastTaskId) {
      try {
        onTaskUpdate({ status: 'retrying', error: undefined })
        const recoveredUrl = await pollGpt4oUntilDone({
          apiKey: kieApiKey,
          taskId: lastTaskId,
          timeoutMs: RECOVERY_POLL_MS,
          signal,
        })
        const assetRef = await downloadAndStore(recoveredUrl)
        return { assetRef, retries }
      } catch (err) {
        // Recovery failed — fall through to fresh submission
        lastError = err instanceof Error ? err : new Error(String(err))
        lastTaskId = null
        retries++
      }
    }

    // ── Submit a brand-new task ────────────────────────────────────────
    try {
      onTaskUpdate({ status: attempt === 0 ? 'generating' : 'retrying', error: undefined })

      const { taskId } = await submitGpt4oImage({
        apiKey: kieApiKey,
        prompt: finalPrompt,
        filesUrl: filesUrl.length > 0 ? filesUrl : undefined,
        size,
      })
      lastTaskId = taskId

      const remoteUrl = await pollGpt4oUntilDone({
        apiKey: kieApiKey,
        taskId,
        timeoutMs: FRESH_POLL_MS,
        signal,
      })

      const assetRef = await downloadAndStore(remoteUrl)
      // Success → clear the in-flight tracker
      lastTaskId = null
      return { assetRef, retries }

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Hard failures — never retry (don't burn credit on something that
      // structurally can't succeed)
      if (
        lastError.message === 'INSUFFICIENT_CREDITS' ||
        lastError.message.includes('content_policy') ||
        lastError.message.includes('Đã huỷ') ||
        lastError.message.includes('CANCELLED')
      ) {
        throw lastError
      }

      // GENERATE_FAILED → KIE definitively failed → retry with fresh submit
      if (lastError.message.includes('GENERATE_FAILED')) {
        lastTaskId = null
      }
      // Otherwise (timeout / network) → keep lastTaskId so next iteration
      // tries to recover it before re-submitting.

      retries++
      if (attempt < MAX_ATTEMPTS - 1) {
        const backoff = [0, 3_000, 8_000, 15_000][attempt + 1] ?? 15_000
        console.log(`[LandingPageAI] retry ${attempt + 1}/${MAX_ATTEMPTS - 1} for ${job.prompt.filename} (wait ${backoff / 1000}s, ${lastTaskId ? 'will re-poll old task' : 'will re-submit'})`)
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
  }

  throw lastError ?? new Error('Image generation failed after max retries')
}

async function downloadAndStore(remoteUrl: string): Promise<string> {
  if (isAssetRef(remoteUrl)) return remoteUrl
  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`Fetch generated image lỗi: ${resp.status}`)
  const blob = await resp.blob()
  if (blob.size < 1000) throw new Error('Response image quá nhỏ — có thể bị corrupt')
  return await saveAsset(blob, blob.type || 'image/png')
}

// ─────────────────────────────────────────────────────────────────────────
// Build the flat list of jobs from a pack — SORTED by priority.
//
// Sort key: (section priority tier, original section index, image index).
// This guarantees hero comes first; within a tier we preserve pack order.
// ─────────────────────────────────────────────────────────────────────────
function collectJobs(pack: LandingPagePack): ImageJob[] {
  const jobs: ImageJob[] = []
  for (let si = 0; si < pack.sections.length; si++) {
    const section = pack.sections[si]
    if (!section.imagePrompts) continue
    for (let ii = 0; ii < section.imagePrompts.length; ii++) {
      jobs.push({ pack, sectionIdx: si, imageIdx: ii, prompt: section.imagePrompts[ii], section })
    }
  }

  // Priority sort — stable on tie via insertion order
  jobs.sort((a, b) => {
    const pa = SECTION_PRIORITY[a.section.type] ?? 9
    const pb = SECTION_PRIORITY[b.section.type] ?? 9
    if (pa !== pb) return pa - pb
    if (a.sectionIdx !== b.sectionIdx) return a.sectionIdx - b.sectionIdx
    return a.imageIdx - b.imageIdx
  })

  return jobs
}

function getKieKey(): string {
  const s = useSettingsStore.getState()
  if (!s.kieApiKey) throw new Error('Chưa có KIE.ai API key — vào Cài đặt để nhập.')
  return s.kieApiKey
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: count how many images will be generated (for cost preview).
// ─────────────────────────────────────────────────────────────────────────
export function countImagesInPack(pack: LandingPagePack): number {
  return collectJobs(pack).length
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: generate all images in a pack with a high-throughput worker pool.
// Concurrency raised 2 → 6 for ~3x speedup. KIE backend handles concurrent
// /gpt4o-image/generate fine — the bottleneck is per-image latency, not API
// rate limit.
// ─────────────────────────────────────────────────────────────────────────
export async function generatePackImages(
  pack: LandingPagePack,
  options: QueueOptions,
): Promise<void> {
  const kieApiKey = getKieKey()
  const allJobs = collectJobs(pack)
  const total = allJobs.length
  if (total === 0) return

  for (const j of allJobs) {
    options.onTaskUpdate(j.sectionIdx, j.imageIdx, { status: 'queued', error: undefined })
  }
  let done = 0
  let failed = 0
  let totalRetries = 0
  options.onProgress?.(done, failed, total, totalRetries)

  // ── Phase 7 stabilization — STAGE 1 SEQUENTIAL HERO RENDER ───────────
  //
  // Storytelling form ('advertorial') needs the hero image to be ready
  // BEFORE any other people-shot starts, so subsequent prompts can use
  // hero_01's generatedAssetRef as a filesUrl reference (true face
  // identity binding via KIE GPT-4o image-to-image).
  //
  // We render the hero in isolation first, mutate pack.sections to expose
  // the assetRef, then drop the hero job from the worker pool and run
  // everything else in parallel as before. selectRefsForSection (called
  // inside runWithCreditSafeRetry) reads pack.sections[hero].imagePrompts
  // [0].generatedAssetRef and prepends it as the first reference.
  let jobs = allJobs
  if (pack.form === 'advertorial') {
    const heroIdx = jobs.findIndex((j) => j.section.type === 'hero')
    if (heroIdx >= 0) {
      const heroJob = jobs[heroIdx]
      console.info('[FORM advertorial] stage-1 sequential hero render — waiting for hero_01 before dispatching other people-shots')
      options.onTaskUpdate(heroJob.sectionIdx, heroJob.imageIdx, { status: 'generating' })
      try {
        const { assetRef, retries } = await runWithCreditSafeRetry(
          heroJob,
          pack.visualMemory,
          kieApiKey,
          (patch) => options.onTaskUpdate(heroJob.sectionIdx, heroJob.imageIdx, patch),
          options.signal,
        )
        // CRITICAL — mutate pack so selectRefsForSection sees the hero ref
        const heroSection = pack.sections[heroJob.sectionIdx]
        if (heroSection && heroSection.imagePrompts?.[heroJob.imageIdx]) {
          heroSection.imagePrompts[heroJob.imageIdx].generatedAssetRef = assetRef
          heroSection.imagePrompts[heroJob.imageIdx].status = 'done'
        }
        options.onTaskUpdate(heroJob.sectionIdx, heroJob.imageIdx, {
          status: 'done', generatedAssetRef: assetRef, error: undefined,
        })
        done++
        totalRetries += retries
        options.onProgress?.(done, failed, total, totalRetries)
        console.info('[FORM advertorial] stage-1 hero ready — assetRef =', assetRef, '— dispatching stage-2 with hero ref injected')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[FORM advertorial] stage-1 hero failed — dispatching stage-2 without hero ref; subsequent people-shots may drift from one character:', msg)
        options.onTaskUpdate(heroJob.sectionIdx, heroJob.imageIdx, { status: 'failed', error: msg })
        failed++
        options.onProgress?.(done, failed, total, totalRetries)
      }
      // Remove hero from the pool — already processed (success or fail)
      jobs = jobs.filter((_, i) => i !== heroIdx)
    }
  }

  // ── Z8: concurrency 2 → 6 (3x throughput) ────────────────────────────
  // Z23 — concurrency 6 → 8. KIE backend tolerates 8 parallel /gpt4o-image
  // submissions; bottleneck is per-image latency, not API rate limit.
  const concurrency = options.concurrency ?? 8
  let cursor = 0

  await new Promise<void>((resolve) => {
    let active = 0
    let resolved = false

    const finish = () => {
      if (resolved) return
      if (cursor >= jobs.length && active === 0) {
        resolved = true
        resolve()
      }
    }

    const pump = () => {
      while (!resolved && active < concurrency && cursor < jobs.length) {
        if (options.signal?.aborted) {
          for (let i = cursor; i < jobs.length; i++) {
            options.onTaskUpdate(jobs[i].sectionIdx, jobs[i].imageIdx, {
              status: 'failed', error: 'Đã huỷ',
            })
          }
          cursor = jobs.length
          finish()
          return
        }

        const job = jobs[cursor++]
        active++
        options.onTaskUpdate(job.sectionIdx, job.imageIdx, { status: 'generating' })

        runWithCreditSafeRetry(
          job,
          pack.visualMemory,
          kieApiKey,
          (patch) => options.onTaskUpdate(job.sectionIdx, job.imageIdx, patch),
          options.signal,
        )
          .then(({ assetRef, retries }) => {
            options.onTaskUpdate(job.sectionIdx, job.imageIdx, {
              status: 'done', generatedAssetRef: assetRef, error: undefined,
            })
            done++
            totalRetries += retries
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err)
            options.onTaskUpdate(job.sectionIdx, job.imageIdx, {
              status: 'failed', error: msg,
            })
            failed++
          })
          .finally(() => {
            active--
            options.onProgress?.(done, failed, total, totalRetries)
            pump()
            finish()
          })
      }
      finish()
    }

    pump()
  })
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: regenerate a SINGLE image (per-card retry button).
// Also uses credit-safe retry wrapper for consistency.
// ─────────────────────────────────────────────────────────────────────────
export async function regenerateSingleImage(
  pack: LandingPagePack,
  sectionIdx: number,
  imageIdx: number,
  onTaskUpdate: (sectionIdx: number, imageIdx: number, patch: Partial<ImagePrompt>) => void,
): Promise<void> {
  const kieApiKey = getKieKey()
  const section = pack.sections[sectionIdx]
  if (!section) throw new Error(`Section ${sectionIdx} không tồn tại`)
  const prompt = section.imagePrompts?.[imageIdx]
  if (!prompt) throw new Error(`Image ${imageIdx} không tồn tại`)

  onTaskUpdate(sectionIdx, imageIdx, { status: 'generating', error: undefined })
  try {
    const { assetRef } = await runWithCreditSafeRetry(
      { pack, sectionIdx, imageIdx, prompt, section },
      pack.visualMemory,
      kieApiKey,
      (patch) => onTaskUpdate(sectionIdx, imageIdx, patch),
    )
    onTaskUpdate(sectionIdx, imageIdx, { status: 'done', generatedAssetRef: assetRef, error: undefined })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onTaskUpdate(sectionIdx, imageIdx, { status: 'failed', error: msg })
  }
}
