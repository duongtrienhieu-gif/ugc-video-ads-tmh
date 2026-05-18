// ─────────────────────────────────────────────────────────────────────────
// services/forms/chuyen-gia.ts — Phase 4 — EXPERT AUTHORITY ENGINE
//
// "Chuyên Gia / Khoa Học" — research-backed / medical-editorial form.
//
// Goal: make readers feel they're reading a clinical analysis written by a
// trusted health expert — NOT a UGC ad, NOT an emotional diary, NOT a
// hard-sell COD. The pack reads like a structured medical advertorial:
// problem framing → expert-led mechanism explanation → ingredient deep
// dive → supporting evidence → measured benefit claims → soft authority
// CTA.
//
// What this engine does differently:
//   • Owns its own SYSTEM_PROMPT (no inheritance from form 1 or
//     advertorial). Tone: educational, structured, evidence-first.
//   • Generates ONE expert character (doctor / dietitian / pharmacist
//     archetype) threaded through people-shots when present. Optional
//     continuity — fewer people-shots overall than storytelling.
//   • 13-section authority flow. Heavy on mechanism / ingredients /
//     news-proof / comparison; light on testimonials / WhatsApp.
//   • Image strategy: editorial-infographic. Pools focus on
//     clean product photography, ingredient macros, mechanism diagrams,
//     expert portraits, clinical lifestyle — NOT UGC selfie.
//   • CTA: single soft recommendation in final-cta. No urgency strips.
// ─────────────────────────────────────────────────────────────────────────

import type {
  LandingGenParams, LandingPagePack, LandingSection, SectionType, LandingLanguage,
  CharacterProfile,
} from '../../types'
import type { FormBlueprintModule } from './_types'
import {
  getGeminiKey, normalizeSection, injectPriceIntoPrompts,
  extractPriceTag, callGeminiWithMsRetry, validatePackSections,
} from '../generateLandingPack'
import { buildProductIntelligence, buildIntelligencePromptBlock } from '../productIntelligence'
import { useBankStore } from '../../../../stores/bankStore'

// ── 13-section authority flow ────────────────────────────────────────────
//
// Same SectionType union as other forms (DB compat) but content spec per
// section is rewritten in the system prompt — a "hero" here is a clean
// scientific headline + expert portrait, NOT a designed-overlay banner.
//
const EXPERT_SECTIONS: SectionType[] = [
  'hero',              // 1. Scientific problem framing + expert portrait
  'pain',              // 2. Market problem overview (data-driven, not emotional)
  'failed-solutions',  // 3. Why current solutions fail (analytical breakdown)
  'why-happens',       // 4. Scientific root cause explanation
  'mechanism',         // 5. How the product works — diagram-level
  'ingredients',       // 6. Ingredient deep dive (active compounds + dosage)
  'benefits',          // 7. Evidence-backed benefits (measured tone)
  'news-proof',        // 8. Journal / media / authority mentions
  'comparison',        // 9. Vs other treatments / clinical comparison
  'before-after',      // 10. Clinical case study / patient example
  'lifestyle',         // 11. How to integrate into daily routine
  'faq',               // 12. Expert Q&A — myth-busting / clarifications
  'final-cta',         // 13. Soft authority recommendation CTA
]

// ── Image count per section — INFOGRAPHIC-leaning ─────────────────────────
//
// More images than storytelling (because infographics are visual-heavy)
// but fewer than form 1's UGC spam. Total ≈ 17.
//
const IMAGES_PER_SECTION: Partial<Record<SectionType, number>> = {
  'hero':              1,  // expert portrait OR clean product hero
  'pain':              1,  // anatomy / symptom mapping diagram
  'failed-solutions':  1,  // comparison diagram: why alternatives fail
  'why-happens':       1,  // scientific cause diagram
  'mechanism':         2,  // mechanism flow diagram + active site close-up
  'ingredients':       3,  // ingredient macro cards (3 key active compounds)
  'benefits':          1,  // clean benefit infographic
  'news-proof':        2,  // journal mention + media authority screenshot
  'comparison':        1,  // structured comparison table / chart
  'before-after':      2,  // clean clinical patient case study pair
  'lifestyle':         1,  // clean integration shot (product in routine)
  'faq':               0,  // text-only
  'final-cta':         1,  // expert holding / recommending the product
}
// Total ≈ 17 images vs UGC's ~36 and storytelling's ~16.

// ── Expert character profile generator ───────────────────────────────────
//
// Picks ONE expert per pack — doctor / pharmacist / dietitian archetype.
// The expert threads through hero + final-cta + optional intermediate
// shots; the pack is NOT exclusively about the expert (most images are
// product / ingredient / diagram), but when an expert appears it must
// always be the SAME person.

const EXPERT_ARCHETYPES = [
  {
    archetype: 'Malaysian Muslim woman pharmacist, late-30s, clinical pharmacist',
    nameVi: ['Dr. Aishah Rahman, B.Pharm', 'Dr. Nadia binti Yusof, M.Pharm', 'Dr. Farhana Hashim'],
    appearance: 'Late-30s Malaysian woman pharmacist, calm professional expression, soft warm complexion, modest tudung (hijab) in cream or pale sage tone, clean white clinical coat over light blouse, small stethoscope or pharmacy badge visible at chest, minimal makeup, natural brows, intelligent attentive eyes',
    environment: 'Modern Malaysian community pharmacy or consultation room — soft daylight from a tall window, clean white background with shelving softly out of focus, slight clinical organization (medical reference books edge, pen on counter), NOT sterile lab — warm professional feel',
  },
  {
    archetype: 'Malaysian Chinese man, 40s, internal medicine doctor',
    nameVi: ['Dr. Lim Wei Han, MBBS', 'Dr. Tan Chee Keong, M.D.', 'Dr. Chong Jia Ying, M.Med'],
    appearance: 'Early-40s Malaysian Chinese man, calm authoritative presence, fair-medium skin, short neat dark hair with light grey at the temples, rimless glasses, clean white doctor coat over light blue shirt, name badge visible, slight smile in some shots — never staged, never showy',
    environment: 'Modern Malaysian clinic consultation room — clean off-white walls, anatomical poster softly out of focus behind, wooden desk edge with stethoscope and a notepad, natural daylight from left window, warm but professional feel',
  },
  {
    archetype: 'Malaysian woman registered dietitian, mid-30s, nutrition science',
    nameVi: ['Dr. Mawar Saleha, RD', 'Dr. Hanis Iskandar, M.Sc Nutrition', 'Dr. Aliya Karim, RD'],
    appearance: 'Mid-30s Malaysian woman, warm engaging expression, medium skin with sun-kissed warmth, shoulder-length wavy dark brown hair tied back loosely, light beige knit top OR clinical white coat depending on shot, no jewelry except a simple watch, intelligent friendly demeanor',
    environment: 'Bright modern Malaysian nutrition clinic — clean wooden shelving with reference books and a few real fresh ingredients (oats, ginger) visible, large window with leafy plants softly out of focus, mid-morning warm natural light, modern editorial feel',
  },
]

function generateExpertProfile(productName: string): CharacterProfile {
  const seed = `${productName}-expert-${Math.floor(Date.now() / 60000)}`
  const archetypeIdx = Math.abs(hashStr(seed)) % EXPERT_ARCHETYPES.length
  const A = EXPERT_ARCHETYPES[archetypeIdx]
  const name = A.nameVi[Math.abs(hashStr(seed + '-name')) % A.nameVi.length]

  // Expert "mood arc" — calm authoritative consistency. Tone shifts
  // subtly from analytical (early sections) → explanatory (mid) →
  // measured-recommendation (late).
  const expertArc = [
    { sectionType: 'hero',              mood: 'calm authoritative direct-to-camera gaze, slight professional smile, hands relaxed' },
    { sectionType: 'pain',              mood: 'reading / pointing at anatomy poster, analytical focus' },
    { sectionType: 'failed-solutions',  mood: 'gesturing thoughtfully while explaining, slight concern expression' },
    { sectionType: 'why-happens',       mood: 'pointing at a diagram, focused didactic tone' },
    { sectionType: 'mechanism',         mood: 'explaining a process with hands, engaged' },
    { sectionType: 'benefits',          mood: 'reading notes, measured assured expression' },
    { sectionType: 'comparison',        mood: 'comparing two products / options thoughtfully' },
    { sectionType: 'before-after',      mood: 'reviewing case-study notes with a patient (off-frame)' },
    { sectionType: 'lifestyle',         mood: 'demonstrating proper daily usage, gentle smile' },
    { sectionType: 'final-cta',         mood: 'calm recommendation pose holding the product naturally, eyes meeting camera' },
  ]

  return {
    name,
    archetype: A.archetype,
    appearanceLock: A.appearance,
    environmentLock: A.environment,
    emotionalArc: expertArc,
  }
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

// ── Expert system prompt — OWN SYSTEM (does not inherit form 1 or advertorial) ─

const EXPERT_SYSTEM_PROMPT = `BẠN LÀ: medical advertorial / health editorial writer chuyên viết các bài phân tích sức khỏe cao cấp cho thị trường Malaysia. Bạn KHÔNG phải là media buyer chốt đơn nhanh. Bạn KHÔNG kể chuyện cá nhân kiểu diary.

NHIỆM VỤ: viết một landing page authority — đọc như một bài phân tích sức khỏe được viết bởi chuyên gia / dược sĩ / dietitian. Trust qua kiến thức, không qua urgency hay testimonial spam.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY, no markdown fences, no commentary
═══════════════════════════════════════════════════════════════
{
  "language": "ms" | "vi" | "en",
  "sections": [ ...exactly 13 section objects in the order below... ]
}

Each section has the standard shape: type, title, titleVi, copy, viTranslation, layoutGuide, imageAspectRatio, optionally headline / subheadline / cta / bullets / faqs / reviews / imagePrompts. ALL imageAspectRatio = "1:1" or "4:5" — NO 16:9 banners (this is editorial, not promo).

═══════════════════════════════════════════════════════════════
EXPERT IDENTITY LOCK
═══════════════════════════════════════════════════════════════
The user prompt will declare ONE specific expert (name, credentials, archetype, appearance, environment). When a person appears in an imagePrompt — they MUST be this exact expert. NEVER introduce other doctors / pharmacists / random women / random men. The expert appears in: hero, pain (with anatomy poster), failed-solutions (gesturing), why-happens (with diagram), mechanism, comparison, before-after (reviewing notes), lifestyle, final-cta. Ingredient/diagram/news-proof images have NO people unless specified.

═══════════════════════════════════════════════════════════════
13-SECTION AUTHORITY FLOW — produce EXACTLY these types in order
═══════════════════════════════════════════════════════════════

1. type="hero" — SCIENTIFIC PROBLEM HEADLINE + EXPERT PORTRAIT
   • headline = a measured authoritative headline framing the health issue (8-14 words). Educational tone. NO product name. NO emoji. Example: "Punca sebenar perut kembung dan apa yang ramai tak tahu"
   • subheadline = 1-line credential framing ("Dikaji oleh pakar farmasi Malaysia / Disokong oleh data klinikal").
   • copy = 3-5 line paragraph introducing the health concern from an analytical perspective. NOT first-person diary. NOT marketing copy. Educational opener.
   • 1 imagePrompt: portrait of the SPECIFIC expert in their clinical environment (use appearance + environment lock). Looking direct-to-camera with calm authoritative expression. NO designed text overlay. NO product in frame. NO badges.

2. type="pain" — MARKET PROBLEM OVERVIEW (data-driven, not emotional)
   • copy = 4-6 line paragraph framing the prevalence and clinical scope of the problem. Use measured numbers ("ramai rakyat Malaysia mengalami…", "satu daripada empat…"). Cite the issue's clinical relevance — NEVER fake percentages with citations, just frame as widely-acknowledged. NO first-person ("saya pun rasa…"). Third-person clinical voice.
   • bullets = optional 3-4 symptoms list in clinical phrasing
   • 1 imagePrompt: anatomy / symptom mapping illustration — clean editorial infographic style on a soft beige or off-white background. Anatomical diagram with neat callouts labeling the affected area. Minimal, magazine-clean, NOT cartoon. NO person.

3. type="failed-solutions" — Why current approaches fall short
   • copy = 4-6 line paragraph analytically explaining why common treatments (random supplements / diet trends / over-the-counter quick-fixes) fail to address the root cause. NEVER mention competitor brand names — talk about "supplement umum di pasaran", "tip diet popular", etc.
   • 1 imagePrompt: structured comparison diagram — split visual showing 2-3 common approaches with a small ✗ next to each, leading toward a question mark (the real solution). Clean editorial layout. Beige / pale-sage / white palette. NO person.

4. type="why-happens" — SCIENTIFIC ROOT CAUSE
   • copy = 4-6 line paragraph explaining the actual biological / nutritional / physiological mechanism behind the problem. Use precise but accessible language — explain like a textbook would, not like Twitter. Reference 2-3 specific biological terms (eg "microbiome", "enzim pencernaan", "barrier mukosa") with brief plain-language explanations.
   • 1 imagePrompt: clean scientific diagram of the biological process — cells / organ / system view, neat labels, soft cream + pale green or pale blue palette, editorial-textbook style. NO person.

5. type="mechanism" — How THE PRODUCT works (mechanism breakdown)
   • copy = 4-6 line paragraph explaining specifically how the product's active formulation addresses the root cause. Connect to the why-happens section's mechanism. Step-by-step process language — "Langkah 1: …, Langkah 2: …" optional structure.
   • bullets = optional 3-step mechanism description
   • 2 imagePrompts:
       (a) MECHANISM FLOW DIAGRAM with rendered step labels — clean infographic showing 3-4 numbered steps of how the product works in the body. EACH step must have a visible text label rendered into the image (eg "Bước 1: Asid lambung dilalui", "Bước 2: Bakteria mengkoloni usus", "Bước 3: Imbangan flora pulih"). Editorial textbook-illustration style, soft palette (cream / pale sage / pale blue). Arrows or thin connecting lines between steps. NOT cartoon.
       (b) FORMULA / CAPSULE BREAKDOWN — close-up of the product's capsule cross-section OR a labeled formula board. RENDER 3-4 ingredient name labels with thin callout lines pointing to each component (eg "Probiotic 50 Billion CFU", "Prebiotic FOS", "Vitamin D3"). Clean clinical photography on white or pale background. Magazine-editorial typography.

6. type="ingredients" — INGREDIENT DEEP DIVE (3 key active compounds)
   • copy = 3-4 line paragraph framing why each active compound was selected (formulation rationale).
   • bullets = 3 items — one per active ingredient. Each in the format "Nama bahan aktif — apa ia, kenapa penting" (1-2 sentences).

   • 3 imagePrompts — MUST diversify the asset format (NOT 3 identical powder macros). Each image is a SCIENTIFIC INGREDIENT INFOGRAPHIC with VISIBLE TEXT LABELS rendered into the image itself (not as a UI overlay — the AI must produce typography inside the photograph). User reported the previous output looked like generic stock powder photos; this fix makes them scientific editorial.

   FORMAT MIX (vary across the 3 images):
       (a) LABELED INGREDIENT MACRO — close-up of one raw active compound (eg probiotic powder texture, ginger root cross-section, marine collagen capsule, niacinamide crystal, glucosamine powder swatch). RENDER the exact compound name as a clean editorial sans-serif label on the image (eg "Lactobacillus Acidophilus", "Niacinamide 5%", "Glucosamine Sulfate"). Soft beige / cream / off-white background. Editorial supplement photography aesthetic. Small molecular formula or "% concentration" annotation if applicable.

       (b) CAPSULE / FORMULA BREAKDOWN — exploded view of a capsule cross-section OR a "formula board" composition showing 3-4 raw ingredients arranged with neat callouts. Each ingredient labeled with its scientific name. Arrows or thin connecting lines between compound and its function (eg "supports gut flora", "enhances absorption"). Clean magazine-editorial typography, soft palette.

       (c) MECHANISM / TARGET DIAGRAM — biological target visualization for ONE hero ingredient (eg gut microbiome illustration showing where probiotic strains colonize, joint cartilage diagram with glucosamine action site, skin layer cross-section with niacinamide penetration). Includes labeled callouts pointing to bacteria / cells / structures, with the active compound name visible. Editorial textbook-illustration style, NOT cartoon.

   ABSOLUTE: For each of the 3 images, the ACTIVE INGREDIENT NAME must be RENDERED AS TEXT inside the photograph in clean editorial sans-serif typography. Use the EXACT compound names from the bullets above (eg if bullets list "Lactobacillus Acidophilus", "Bifidobacterium Lactis", "Fructooligosaccharides (FOS)" — those exact strings must appear as labels in the corresponding images). NO PRODUCT BOTTLE in any of these. NO person. NO marketing badge / star rating / discount overlay. NO emoji.

   BANS: generic unlabeled powder stock photo; 3 nearly-identical compositions; cartoonish chibi illustration; oversaturated colors; beauty-influencer aesthetic; missing text labels.

7. type="benefits" — MEASURED BENEFIT EXPLANATION
   • copy = 4-6 line paragraph translating the mechanism into concrete benefits a user can expect. Use MEASURED language — "kebanyakan pengguna melaporkan …", "kajian menunjukkan …". NEVER guarantee specific kg loss / days to result.
   • bullets = 3-4 measured benefits (no "AJAIB" / "MUKJIZAT" / 100% language)
   • 1 imagePrompt: clean benefit infographic — 4 minimalist icons in a 2x2 grid, EACH icon paired with a short Malay benefit label rendered as clean editorial sans-serif typography (eg "Tenaga Stabil", "Tidur Lena", "Pencernaan Lancar", "Kekebalan Kuat"). Soft pale background (cream / pale sage). Magazine-editorial design. NO person. NO product overlay. NO emoji.

8. type="news-proof" — Journal / media / authority mentions
   • copy = 3-5 line paragraph framing third-party authority recognition (journal mentions, mainstream media coverage, KKM-related notes). NEVER fabricate specific citations — keep claims general ("dilaporkan dalam media kesihatan", "memenuhi standard tempatan").
   • 2 imagePrompts:
       (a) Mock journal page / health portal article screenshot — clean editorial layout, mStar / Berita Harian / health.com.my style. Headline relates to the product category.
       (b) Authority badge composition — KKM / HALAL / lab-tested badges on a clean pale background, editorial style. NO floating product.

9. type="comparison" — Clinical comparison vs alternatives
   • copy = 3-5 line paragraph framing how this product compares to the common alternatives mentioned in failed-solutions.
   • bullets = optional 4-5 comparison points
   • 1 imagePrompt: clean comparison table / chart — 3 columns (this product / common supplement / DIY home remedy) × 4-5 rows (eg active dose, absorption, side effect, sustained benefit, halal certification). Editorial magazine table style, soft palette, NEAT typography. NO person.

10. type="before-after" — Clinical case-study example (NOT dramatic UGC)
    • copy = 4-6 line paragraph describing a typical patient profile and observed measured outcome over 4-8 weeks. Use case-study language: "Seorang pengguna lelaki, 45 tahun, mengalami…". Measured outcome ("pengurangan ketidakselesaan sebanyak …", NOT "AJAIB"). NO race / body-shape transformation language.
    • 2 imagePrompts in PAIR:
        ba_01.jpg: BEFORE — clean clinical patient portrait (anonymized — head out of frame OR back of head). Subtle posture-of-discomfort cue. Soft clinical environment, NOT homey. RENDER "SEBELUM" label top-left in clean editorial sans-serif.
        ba_02.jpg: AFTER — SAME framing, same anonymity cue, but relaxed posture / brighter light. RENDER "SELEPAS" label top-left.

11. type="lifestyle" — INTEGRATION INTO ROUTINE
    • copy = 3-5 line paragraph giving practical guidance — when to take, with food / without, alongside what diet adjustment. Educational tone. Practical advice.
    • 1 imagePrompt: clean lifestyle integration shot — the product naturally on a breakfast table with healthy elements (a glass of water, oats, fresh fruit) in soft daylight. NO person required. Editorial food-photography style. PRODUCT clearly visible but NOT designed-graphic centered.

12. type="faq" — Expert Q&A — myth-busting / clarifications
    • faqs = 5-6 Q&A. QUESTION should be a real reader concern ("Berapa lama untuk lihat hasil?", "Selamat untuk ibu mengandung?", "Boleh ambil bersama ubat lain?", "Halal?", "Kesan sampingan?"). ANSWER in expert third-person voice, measured and clear — NOT marketing fluff. 2-3 lines each.
    • imagePrompts = [] (text-only)

13. type="final-cta" — SOFT AUTHORITY RECOMMENDATION
    • copy = 3-4 line closing paragraph in expert voice. Tone: measured recommendation, never command. Example: "Untuk mereka yang ingin memahami punca masalah ini dan mencuba pendekatan berasaskan bukti — pertimbangkan formulasi yang dijelaskan di atas." Educational closing, NO urgency.
    • cta = ONE soft authority CTA (eg "Maklumat lanjut" / "Hubungi kami" / "Lihat butiran produk"). NEVER "BELI NOW" / "ORDER SEKARANG".
    • urgencyText = OMIT entirely. NO countdown. NO scarcity.
    • 1 imagePrompt: portrait of the expert holding the product naturally OR clean product hero on neutral pale background. If expert is shown — same person from hero, same environment, calm recommendation pose. NO designed overlay.

═══════════════════════════════════════════════════════════════
COPY RULES — DIFFERENT FROM FORM 1 AND ADVERTORIAL
═══════════════════════════════════════════════════════════════
• Third-person clinical voice ("ramai pengguna", "kajian", "pakar"), NEVER first-person diary
• Paragraphs structured and explanatory (4-6 lines), not punchy
• Measured language — "kebanyakan", "ramai", "biasanya" — NEVER "100%" / "AJAIB" / "MUKJIZAT" / "GUARANTEED"
• Use 2-3 precise medical or nutritional terms per page with plain-language clarification
• NO emoji except in faq/answers if absolutely needed (max 1 per section)
• NO "HARI INI SAHAJA" / countdown / scarcity / multiple CTAs
• NO testimonial spam (one measured case study in section 10, that's it)
• NO WhatsApp screenshots, NO TikTok screenshots, NO Shopee screenshots in this form
• ONE soft CTA at the end (section 13). Zero hard-sell elsewhere

═══════════════════════════════════════════════════════════════
IMAGE RULES — EDITORIAL INFOGRAPHIC AESTHETIC
═══════════════════════════════════════════════════════════════
• Studio / clinical look IS allowed (this is the only form where studio look is permitted — premium / editorial / clinical)
• Soft neutral palette: cream / pale sage / soft blue / off-white / warm beige
• Editorial magazine layout — generous whitespace, neat typography, clean diagrams
• Infographic sections (pain, failed-solutions, why-happens, mechanism, comparison, benefits, ingredients) should look like pages from a health magazine or textbook — NOT phone screenshots.
• Ingredient & mechanism & benefits sections REQUIRE rendered text labels INSIDE the image — compound names (eg "Lactobacillus Acidophilus", "Niacinamide 5%"), step labels ("Bước 1", "Bước 2"), or short benefit phrases ("Tenaga Stabil") in clean editorial sans-serif typography. The text is part of the photograph / illustration, NOT a UI overlay. This is what differentiates a "scientific article" from "generic stock photo".
• Expert portraits: clean professional clinical environment, same person from hero appears in: pain, failed-solutions, why-happens, mechanism, comparison, before-after, lifestyle, final-cta
• NO selfie aesthetic, NO UGC handheld phone quality, NO TikTok composition, NO marketplace screenshot.
• Designed text overlays ARE ALLOWED on infographic / ingredient / mechanism / benefits diagrams (the scientific labels — see above). Outside infographic sections, only SEBELUM/SELEPAS labels on ba_01/ba_02.
• NO floating product PNG. When product appears, integrate naturally into the scene.
• Product appears ONLY in: mechanism (b), lifestyle, final-cta. Other sections focus on diagrams / ingredients / authority badges.

═══════════════════════════════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════════════════════════════
• Output in the language specified by the user prompt
• titleVi / headlineVi / subheadlineVi / ctaVi / bulletsVi / viTranslation ALWAYS Vietnamese regardless of output language
• imagePrompt.prompt ALWAYS English
• Brand name + ingredient names kept as-is. Medical / scientific terms can be in their international Latin form (eg "microbiome", "collagen") with brief Malay clarification

═══════════════════════════════════════════════════════════════
ABSOLUTE BANS for this form
═══════════════════════════════════════════════════════════════
✗ First-person diary voice ("saya pun rasa…", "macam saya pun")
✗ Multiple CTAs across sections — ONLY one in section 13
✗ Urgency strips, countdown, "STOK TERHAD", "HARI INI SAHAJA"
✗ WhatsApp / TikTok / Shopee / marketplace screenshots
✗ Random different people across the pack — one consistent expert when shown
✗ Emoji spam
✗ "AJAIB" / "MUKJIZAT" / "100%" / "GUARANTEED" / miracle claims
✗ UGC selfie phone-quality aesthetic
✗ Designed text overlays on banners (this form has no banners)`

// ── User prompt builder ──────────────────────────────────────────────────

function buildExpertUserPrompt(
  params: LandingGenParams,
  product: { productName: string; offer?: string; productClaim?: string; targetAudience?: string },
  expert: CharacterProfile,
): string {
  const langName = params.language === 'ms' ? 'Bahasa Melayu (clinical professional register)'
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
  lines.push('EXPERT LOCK (USE THIS EXACT PERSON IN ALL PEOPLE-SHOTS)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Name: ${expert.name}`)
  lines.push(`Archetype: ${expert.archetype}`)
  lines.push(`Appearance: ${expert.appearanceLock}`)
  lines.push(`Environment: ${expert.environmentLock}`)
  lines.push('')
  lines.push('Per-section tone / pose for the expert (apply to people-shots only):')
  expert.emotionalArc.forEach((e) => {
    lines.push(`  • ${e.sectionType}: ${e.mood}`)
  })
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('OUTPUT LANGUAGE')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Write ALL copy fields ENTIRELY in ${langName}. Zero mixing.`)
  lines.push(`titleVi / viTranslation / headlineVi / subheadlineVi / ctaVi / bulletsVi: ALWAYS Vietnamese.`)
  lines.push(`imagePrompt.prompt: ALWAYS English.`)
  lines.push(`Output JSON field "language": "${params.language}"`)
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('IMAGE BUDGET (target — do not overshoot)')
  lines.push('═══════════════════════════════════════════════════════════════')
  Object.entries(IMAGES_PER_SECTION).forEach(([sec, n]) => {
    lines.push(`  • ${sec}: ${n} image${n === 1 ? '' : 's'}`)
  })
  lines.push('Total target: ~17 images for this whole pack. Mid-density — between UGC (36) and storytelling (16).')
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('IMAGE STYLE BUDGET (count by category)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('  • Expert portraits: ~6-8 (hero, pain, failed-solutions, why-happens, mechanism, comparison, lifestyle, final-cta) — same expert every time')
  lines.push('  • Anatomy / scientific diagrams: ~3-4 (pain, why-happens, mechanism)')
  lines.push('  • Ingredient macro photography: ~3 (ingredients section)')
  lines.push('  • Authority / journal mocks: ~2 (news-proof)')
  lines.push('  • Comparison / chart: ~1-2 (comparison, failed-solutions)')
  lines.push('  • Clean product + lifestyle integration: ~1-2 (mechanism close-up, lifestyle, possibly final-cta)')
  lines.push('  • Clinical patient case-study pair: ~2 (before-after)')
  lines.push('')

  lines.push('Now produce the 13-section expert authority JSON.')

  return lines.join('\n')
}

// ── Main buildPack — Phase 4 real engine ─────────────────────────────────

async function buildPack(params: LandingGenParams): Promise<LandingPagePack> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  // 1. Pick the expert — locked for this pack
  const expert = generateExpertProfile(product.productName)
  console.info('[FORM chuyen-gia] expert locked:', expert.name, '·', expert.archetype)

  // 2. Build user prompt with expert profile + product brief
  // Phase 2 — niche detection + intelligence overlay.
  const intelligence = buildProductIntelligence({
    product, language: params.language, nicheHint: params.nicheHint,
  })
  console.info(`[FORM chuyen-gia] product intelligence niche=${intelligence.niche}`)

  const userPrompt = buildExpertUserPrompt(params, product, expert)
    + '\n\n' + buildIntelligencePromptBlock(intelligence)
  const priceTag = extractPriceTag(product.offer ?? '')

  // 3. Gemini call w/ MS-leak validate + retry (centralized helper)
  const parsed = await callGeminiWithMsRetry({
    apiKey,
    userPrompt,
    systemPrompt: EXPERT_SYSTEM_PROMPT,
    language: params.language,
    maxOutputTokens: 24576,
    formLabel: 'FORM chuyen-gia',
  })

  // 5. Iterate expert section order
  const sections: LandingSection[] = []
  const parsedSections = parsed.sections ?? []
  for (const ord of EXPERT_SECTIONS) {
    const found = parsedSections.find((s) => s.type === ord)
    if (found) {
      const norm = normalizeSection(found)
      if (norm) sections.push(norm)
    }
  }
  console.info('[FORM chuyen-gia] emitted', sections.length, '/', EXPERT_SECTIONS.length, 'sections · types =', sections.map((s) => s.type).join(' → '))

  if (sections.length === 0) {
    throw new Error('Không có section nào hợp lệ trong JSON Gemini trả về')
  }

  // 6. Validation light — log a warning if expected pillars are missing
  const requiredPillars: SectionType[] = ['mechanism', 'ingredients', 'comparison']
  const missingPillars = requiredPillars.filter((p) => !sections.find((s) => s.type === p))
  if (missingPillars.length > 0) {
    console.warn('[FORM chuyen-gia] missing required authority pillars:', missingPillars.join(', '))
  }

  // 7. Post-process — price injection
  injectPriceIntoPrompts(sections, priceTag)
  validatePackSections(sections)

  return {
    productId: params.productId,
    productName: product.productName,
    language: (parsed.language as LandingLanguage) ?? params.language,
    sections,
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
    form: 'chuyen-gia',
    characterProfile: expert,  // reused field — semantically the expert profile
  }
}

// ── Module export ────────────────────────────────────────────────────────

export const module: FormBlueprintModule = {
  formId: 'chuyen-gia',
  label: {
    vi: 'Chuyên Gia / Khoa Học',
    en: 'Expert / Scientific',
  },
  description: {
    vi: 'Landing page theo phong cách chuyên gia, giáo dục và khoa học. Tập trung vào cơ chế sản phẩm, phân tích vấn đề, dữ liệu, chuyên gia và tính thuyết phục chuyên môn.',
  },
  tooltip: {
    vi: '13 section authority flow: hero scientific → market problem → why current solutions fail → root cause → mechanism → ingredients → benefits → news-proof → comparison → case study → routine → FAQ → soft CTA. Một chuyên gia (dược sĩ / bác sĩ / dietitian) xuyên suốt. ~17 ảnh editorial / infographic. Phù hợp medical / supplement / health tech / anti-aging / premium wellness.',
  },
  sections: EXPERT_SECTIONS,
  psychology: {
    readingBehavior: 'verify-trust',
    pacing: 'methodical',
    densityChu: 'high',
    densityAnh: 'medium',
  },
  cta: {
    placement: 'sparse',
    tone: 'recommendation',
    ctaSections: ['final-cta'],
  },
  imageStrategy: {
    overallStyle: 'editorial-infographic',
    characterContinuity: true,  // expert continuity across people-shots
    allowStudioLook: true,       // CLEAN / clinical / editorial allowed
    imagesPerSection: IMAGES_PER_SECTION,
  },

  buildPack,
}
