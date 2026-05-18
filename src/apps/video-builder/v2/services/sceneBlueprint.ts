// ── Scene Blueprint service ──────────────────────────────────────────────────
// Replaces the v1 "Gemini outputs giant cinematic prompts" approach with
// strict structured JSON. Gemini receives:
//   - The script
//   - The locked identity pack
//   - The visual style DNA
//   - A rotation of scene presets (for diversity)
//
// Gemini returns a SceneBlueprint[] (9 scenes by default).
// The Prompt Compiler then converts each blueprint → final image prompt.
//
// Safety:
//   - Visual tone clamped (no cinematic / studio / fashion)
//   - Diversity validator catches "9 identical close-ups" output
//   - At least 70% scenes must have productVisibility = 'high'
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiVision } from '../../../../utils/gemini'
import type {
  IdentityPack, SceneBlueprint, SceneType, ShotEnergy, SubjectFocus, VisualMotif,
  VisualStyleDna, DiversityReport,
  CameraGrammar, CinematicIntent, SocialMotionPreset, SceneTransition,
} from '../types'
import { SCENE_PRESETS, DEFAULT_PRESET_ROTATION, VISUAL_TONE_CLAMP, getPreset, inferPresetForScene } from './scenePresets'
import { safeParseJson, logJsonFailure } from './jsonResilience'
import {
  inferVisualRole,
  enforceVisualRoleDiversity,
  autoMutateRepetitive,
  buildMotionForMaster,
} from './editorialIntelligence'

// ── Gemini storyboard prompt builder ─────────────────────────────────────────

// Strict JSON-only output rules — LLMs need EXPLICIT escape instructions
const STORYBOARD_SYSTEM = `You are an AI UGC VIDEO ADS DIRECTOR — NOT a product image generator.

Your job is to design 9 frames of an EMOTIONAL TIMELINE for a UGC video ad,
following the script's beat-by-beat narrative arc (hook → pain → discovery →
recovery → CTA). The 9 frames should feel like stills pulled from a real edited
UGC TikTok/Facebook video — NOT 9 pose-variations of the same product showcase.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — ABSOLUTE RULES (violation = response rejected)
═══════════════════════════════════════════════════════════════
1. Return ONLY a raw JSON array. Nothing else.
2. NO markdown wrappers — do NOT prefix with \`\`\`json or any code fence.
3. NO prose before or after the array. NO explanation. NO comments.
4. Escape ALL inner quotes inside string values: \\" not "
5. NEVER use literal line breaks inside JSON string values — use \\n if you must.
6. Keep every string value SHORT (under 15 words) — no paragraphs.
7. Use ONLY straight double quotes ("), never curly quotes.
8. Output must be valid compact JSON that JSON.parse() accepts in one shot.

═══════════════════════════════════════════════════════════════
CONTENT RULES
═══════════════════════════════════════════════════════════════
• All values in English (feeds the image-gen pipeline).
• visualTone must include one of: "ecommerce", "ugc", "landing-page", "social-proof", "advertorial". Never "cinematic", "movie", "fashion editorial", "studio commercial".
• 'speech' for each scene = 1-2 short lines copied from the script, in order.

═══════════════════════════════════════════════════════════════
STEP 1 — SCRIPT SEGMENTATION (do this first, internally)
═══════════════════════════════════════════════════════════════
Read the script. Mentally split it into emotional beats:
  hook → pain → frustration → failed_solution → discovery →
  explanation → recovery → lifestyle → social_proof → cta
Then assign each of the 9 scenes a sceneType matching its beat.
Not every script has all 10 beats — pick the ones that fit the script's arc.
A typical 30-sec UGC ad uses 5-7 of these beats spread over 9 scenes.

═══════════════════════════════════════════════════════════════
REQUIRED FIELDS PER SCENE
═══════════════════════════════════════════════════════════════
sceneId, sceneType, subjectFocus, visualMotif, visualObjective, subjectAction,
narrativePurpose, sceneGoal, environment, environmentType, wardrobeStyle,
composition, cameraAngle, shotType, shotEnergy, pose, emotion, handUsage,
productVisibility, backgroundType, lightingStyle, visualTone,
motionIntent, overlayDensity, ctaFocus, speech, presetLabel,
motionStyle, cameraMotion

═══════════════════════════════════════════════════════════════
subjectFocus — Z11 VISUAL TYPE ENGINE — ONE OF (mandatory):
═══════════════════════════════════════════════════════════════
person · product · infographic · ingredient · lifestyle

This is the SINGLE MOST IMPORTANT axis for video-ad diversity. Without it,
every scene becomes a portrait of the same person holding the same product
— that is NOT a video ad, it is a product gallery.

CLASSIFICATION RULES (read the script line tied to each scene):

• person      → the SCRIPT LINE expresses EMOTION, TESTIMONIAL, or DIRECT
                ADDRESS. Examples: "saya rasa…", "anda akan…", "macam tak
                percaya…", "cuba bayangkan…". Hook / pain / discovery /
                recovery / social_proof / cta usually = person.
• product     → the SCRIPT LINE describes the PRODUCT itself (packaging /
                label / form factor). Examples: "produk ini…", "dalam botol
                ini…", "bentuk gummy…". Render as macro hero shot of the
                product, NO PERSON.
• infographic → the SCRIPT LINE describes a MECHANISM, SCIENCE, BODY
                FUNCTION, or invisible cause. Examples: "vitamin B membantu
                metabolisme…", "8 jenis vitamin penting…", "darah anda…",
                "sel tubuh…". Render as 3D animation / floating molecules /
                glowing particles / capsule explode view / energy flow
                infographic AROUND the product, NO PERSON.
• ingredient  → the SCRIPT LINE names specific INGREDIENTS. Examples:
                "kolagen…", "vitamin B1, B2…", "ekstrak buah delima…".
                Render as raw ingredient macro / capsule cross-section /
                ingredient swirl. NO PERSON.
• lifestyle   → the SCRIPT LINE describes CONTEXT / ENVIRONMENT / AFTER-
                LIFE without explicit person. Examples: "pagi yang
                produktif…", "rumah anda…". Render as environment shot,
                NO PERSON, product subtle or absent.

COMPOSITION MIX TARGET (across all scenes in the storyboard):
  ~40% person · ~30% product · ~20% infographic · ~10% ingredient/lifestyle

NEVER let person scenes exceed 60% of the total. NEVER produce 3+ consecutive
person scenes back-to-back — interleave them with product/infographic beats.

WHEN subjectFocus IS NOT 'person':
  • Set wardrobeStyle = "n/a (no person)" — the field still ships but isn't used.
  • Set pose / emotion / handUsage to short n/a placeholders ("n/a — product hero",
    "n/a — animation", etc) — they won't drive the image.
  • shotEnergy and lightingStyle STILL APPLY — they shape mood.
  • cameraAngle / composition STILL APPLY — they shape framing of the product/
    infographic/ingredient.
  • subjectAction describes the VISUAL ACTION: "particles orbit product",
    "capsule splits open releasing molecules", "ingredient powder swirls", etc.

═══════════════════════════════════════════════════════════════
Z12 — visualMotif — VISUAL AESTHETIC LAYER (mandatory):
═══════════════════════════════════════════════════════════════
ONE OF: medical · chemistry · energy · premium · luxury · scientific ·
        organic · social-proof · kinetic · emotional

This is a SECOND axis layered on top of subjectFocus. Without it, two
infographic scenes look identical. With it, one infographic scene becomes
"chemistry" (molecular bonds, lab feel) and another becomes "energy"
(glowing particles, light streaks) — they finally feel different.

MOTIF CLASSIFICATION GUIDE (combined with subjectFocus):

  • infographic + chemistry    → molecular bonds, atomic structure, formulas
  • infographic + energy       → glowing particles, light streaks, energy waves
  • infographic + social-proof → metric cards (★ rating, user count, badges)
  • infographic + medical      → clinical diagram, body system, cell pathways
  • infographic + scientific   → data viz, microscope feel, lab clean

  • ingredient + organic       → fresh herbs / fruit / leaf macro, daylight
  • ingredient + chemistry     → capsule cross-section, molecule swirl

  • product + premium          → soft gradient, gold/cream accent, halo glow
  • product + luxury           → black velvet, marble pedestal, chiaroscuro
  • product + kinetic          → product spinning, motion-blur action shot

  • person + emotional         → warm window light, vulnerable / intimate
  • person + kinetic           → motion-blur action, dynamic pose
  • person + premium           → polished confident lighting, brand model feel

  • lifestyle + emotional      → golden hour, warm interior, after-life mood
  • lifestyle + organic        → outdoor daylight, plant-rich environment

CLASSIFICATION RULE:
  Read the script line. If it talks about science / vitamin function /
  metabolism → motif "chemistry" or "energy". If it cites numbers / reviews /
  trust → motif "social-proof". If it talks about ingredient origin →
  "organic". If it's about emotion / aspiration → "emotional". If product
  glamour → "premium" or "luxury". If high-action / motion → "kinetic".

DIVERSITY: across all scenes use AT LEAST 4 different visualMotif values.
Never repeat the same motif in 3+ scenes in a row.

═══════════════════════════════════════════════════════════════
VIDEO-LAYER FIELDS (drive downstream Kling / Veo / Runway clip gen)
═══════════════════════════════════════════════════════════════
motionStyle — ONE OF (what the subject's BODY does during the shot):
  subtle_head_turn · stomach_holding · eating_motion · selfie_talk ·
  pointing_product · laugh_with_family · unboxing_reveal · walking_in ·
  static_pose

cameraMotion — ONE OF (what the CAMERA does behind the lens):
  handheld · iphone_selfie · slow_pushin · slow_pullout · static ·
  over_shoulder · walking_follow · overhead_top

Pair motion to the beat:
  pain → stomach_holding + slow_pushin
  failed_solution → static_pose + overhead_top
  discovery → unboxing_reveal + iphone_selfie
  explanation → pointing_product + static
  recovery → eating_motion + walking_follow
  cta → selfie_talk + iphone_selfie

═══════════════════════════════════════════════════════════════
sceneType — ONE OF (mandatory):
═══════════════════════════════════════════════════════════════
hook · pain · frustration · failed_solution · discovery · explanation ·
recovery · lifestyle · social_proof · cta

═══════════════════════════════════════════════════════════════
PRODUCT VISIBILITY BY sceneType (HARD RULE — not every frame holds product)
═══════════════════════════════════════════════════════════════
• pain          → "low" or "none-equivalent" (we are showing the PROBLEM, not the package)
  use "low" — product fully absent from frame OR tiny in background
• frustration   → "low" (the user has not yet found the answer)
• failed_solution → "low" — competitor / wrong product context, do NOT feature OUR product
• hook          → "low" or "medium" (pattern interrupt; product gentle, focus on emotion)
• discovery     → "medium" — first reveal, product just entering frame
• explanation   → "high" — label + ingredients front-facing, readable
• recovery      → "medium" — proof IS the result (glowing face / energized body), product subtle
• lifestyle     → "medium" — product integrated into daily life, not held up to lens
• social_proof  → "high" — review / testimonial frame, product visible
• cta           → "high" — product hero, label clear, eye contact

REQUIREMENT: ≥3 scenes (~30%) should be productVisibility = "low" or "medium" —
this is what makes it feel like a VIDEO AD with narrative, not a product gallery.

═══════════════════════════════════════════════════════════════
WARDROBE EVOLUTION (SOFT LOCK — outfit MUST vary across timeline)
═══════════════════════════════════════════════════════════════
Identity (face / ethnicity / age / hair or hijab) stays IDENTICAL.
But the SAME person naturally wears DIFFERENT outfits across the day/week:
  • pajama (bedroom / night scenes)
  • home casual (kitchen / living room)
  • modest casual (general indoor)
  • office casual (work / desk scenes)
  • cafe outfit (going out)
  • weekend relaxed / lifestyle wear
  • polished confident (CTA / social_proof / recovery)
Across 9 scenes, you MUST use AT LEAST 3 different wardrobeStyle values.
NEVER repeat the same wardrobeStyle in scenes that span different sceneType beats.

═══════════════════════════════════════════════════════════════
ENVIRONMENT EVOLUTION (SOFT LOCK — location MUST vary)
═══════════════════════════════════════════════════════════════
environmentType — one short canonical value (drives image gen):
  bedroom · kitchen · dining room · bathroom · living room · home office desk ·
  cafe · outdoor lifestyle · supermarket · pharmacy
Real UGC ads naturally jump locations as the story progresses:
  pain in bedroom → frustration in kitchen → discovery at desk →
  recovery at cafe → social_proof in living room → cta polished home
Across 9 scenes, use AT LEAST 4 different environmentType values.
NEVER use the same environmentType in 3+ scenes in a row.

═══════════════════════════════════════════════════════════════
LIGHTING / MOOD EVOLUTION (matches sceneType emotion)
═══════════════════════════════════════════════════════════════
• pain / frustration / failed_solution → dim, cool/blue-tinted, slightly messy
• hook                                  → neutral natural, candid
• discovery                             → softer warm light entering scene
• explanation                           → clean even daylight, label readable
• recovery / lifestyle / social_proof   → bright warm daylight, healthier glow
• cta                                   → clean confident polished light

═══════════════════════════════════════════════════════════════
VISUAL RHYTHM ENGINE — composition rotation
═══════════════════════════════════════════════════════════════
A 9-scene UGC ad must ALTERNATE framings or it feels like a slideshow:
  close-up · medium close-up · medium shot · wide-medium · over-the-shoulder ·
  selfie POV · object detail shot · environment shot · reaction shot
Use AT LEAST 5 different composition values.
NEVER repeat the same composition back-to-back.

cameraAngle pool: iphone eye-level · slight low-angle · slight high-angle ·
selfie eye-level · overhead · slight side-angle · waist-level
Use AT LEAST 4 different cameraAngle values.

shotType pool: ugc handheld · selfie arm-extended · static tripod ·
phone-on-shelf POV · phone-on-tripod static · selfie POV intimate ·
object detail close-in
Use AT LEAST 3 different shotType values.

shotEnergy — pick one of: intimate · dynamic · emotional · calm · tension ·
relief · energetic
Match shotEnergy to sceneType:
  pain → tension/emotional · frustration → tension · discovery → dynamic ·
  explanation → calm · recovery → relief · lifestyle → calm/energetic ·
  social_proof → calm · cta → energetic/confident · hook → dynamic/intimate
Use AT LEAST 4 different shotEnergy values across the 9 scenes.

═══════════════════════════════════════════════════════════════
GOAL CHECK BEFORE OUTPUT
═══════════════════════════════════════════════════════════════
Ask yourself: if these 9 frames were stitched into a 30-sec video,
would a viewer feel a real STORY arc — pain, discovery, relief — or just
"9 photos of the same person holding the same thing"?
If the answer is "9 photos", REGENERATE before emitting JSON.`

interface BlueprintPromptParams {
  script: string
  identity: IdentityPack
  productName: string
  dna: VisualStyleDna
  presetRotation: string[]
  numScenes: number
}

// ── SAFE-MODE prompt — fallback when JSON keeps breaking ─────────────────────
// Shorter strings, no emoji, no special chars, simpler wording.
// Reliability > creativity. Used on the 3rd attempt after 2 normal+repair fails.

function buildSafeModeStoryboardPrompt(p: BlueprintPromptParams): string {
  const numScenes = p.numScenes
  return `Output a JSON array of exactly ${numScenes} simple scene objects. Use plain ASCII only. No emoji. No special characters.

Each object has these keys with short string values (max 8 words each):
sceneId, sceneType, subjectFocus, visualMotif, visualObjective, subjectAction, narrativePurpose, sceneGoal, environment, environmentType, wardrobeStyle, composition, cameraAngle, shotType, shotEnergy, pose, emotion, handUsage, productVisibility, backgroundType, lightingStyle, visualTone, motionIntent, overlayDensity, ctaFocus, speech, presetLabel

sceneType must be one of: hook, pain, frustration, failed_solution, discovery, explanation, recovery, lifestyle, social_proof, cta.
subjectFocus must be one of: person, product, infographic, ingredient, lifestyle.
Mix subjectFocus across scenes — roughly 40% person / 30% product / 20% infographic / 10% ingredient or lifestyle.
visualMotif must be one of: medical, chemistry, energy, premium, luxury, scientific, organic, social-proof, kinetic, emotional.
Use at least 4 different visualMotif values across the scenes.
shotEnergy must be one of: intimate, dynamic, emotional, calm, tension, relief, energetic.
productVisibility must be low or medium or high.
overlayDensity must be none or low or medium or high.
ctaFocus must be true or false.

Vary wardrobeStyle across scenes (pajama, home casual, office casual, cafe outfit, lifestyle, polished). Vary environmentType too (bedroom, kitchen, cafe, office desk, living room).
Pain scenes use productVisibility low. CTA scene uses high.

Avatar: ${p.identity.avatarDescription.slice(0, 200).replace(/["']/g, '')}
Product: ${p.productName.replace(/["']/g, '')} - ${p.identity.productDescription.slice(0, 150).replace(/["']/g, '')}

Script (extract speech lines and emotional beats from this):
${p.script.slice(0, 1500).replace(/["']/g, '')}

Example: {"sceneId":1,"sceneType":"pain","subjectFocus":"person","visualMotif":"emotional","visualObjective":"show night fatigue","subjectAction":"rubbing temple at desk","narrativePurpose":"establish problem","sceneGoal":"open with pain","environment":"messy home office at night","environmentType":"home office desk","wardrobeStyle":"home casual","composition":"medium close up","cameraAngle":"iphone eye level","shotType":"ugc handheld","shotEnergy":"tension","pose":"slumped at desk","emotion":"tired concerned","handUsage":"hand on forehead","productVisibility":"low","backgroundType":"messy desk dim","lightingStyle":"dim cool night","visualTone":"warm ecommerce ugc","motionIntent":"handheld","overlayDensity":"low","ctaFocus":false,"speech":"line from script","presetLabel":"pain hook"}

Return only the JSON array. Nothing else. No markdown.`
}

function buildStoryboardPrompt(p: BlueprintPromptParams): string {
  // Compact preset hints — minimize token usage
  const presetHints = p.presetRotation.slice(0, p.numScenes).map((id, idx) => {
    const preset = getPreset(id)
    if (!preset) return `${idx + 1}=free`
    return `${idx + 1}=${preset.labelEn}`
  }).join(', ')

  // Pre-compile the example object so the LLM sees the EXACT schema (smaller = more reliable)
  return `SCRIPT (extract 1-2 lines for each scene's 'speech' in order):
${p.script.slice(0, 2000)}

IDENTITY (do NOT alter):
avatar: ${p.identity.avatarDescription.slice(0, 300)}
product: "${p.productName}" — ${p.identity.productDescription.slice(0, 200)}

STYLE DNA:
tone=${p.dna.visualTone.slice(0, 100)} | camera=${p.dna.cameraStyle.slice(0, 60)} | cta=${p.dna.ctaStyle.slice(0, 60)}

PRESET ROTATION (loose hint — sceneType + script beat takes priority): ${presetHints}

OUTPUT — JSON array of exactly ${p.numScenes} objects with these keys (short string values, <15 words each):
[{"sceneId":1,"sceneType":"pain","subjectFocus":"person","visualMotif":"emotional","visualObjective":"convey night fatigue reality","subjectAction":"rubbing temple while staring at laptop","narrativePurpose":"establish problem the viewer recognizes","sceneGoal":"open on pain","environment":"messy home office at night","environmentType":"home office desk","wardrobeStyle":"home casual","composition":"medium close-up","cameraAngle":"iphone slight low-angle","shotType":"ugc handheld","shotEnergy":"tension","pose":"slumped over laptop","emotion":"tired concerned","handUsage":"hand on forehead, no product","productVisibility":"low","backgroundType":"cluttered desk dim light","lightingStyle":"dim cool blue night","visualTone":"warm authentic ugc","motionIntent":"subtle handheld","overlayDensity":"low","ctaFocus":false,"speech":"...","presetLabel":"pain hook"}]

KEY REMINDERS before emitting:
- Z11: subjectFocus MUST vary — target ~40% person / 30% product / 20% infographic / 10% ingredient or lifestyle
- Z12: visualMotif MUST vary — use ≥4 different motifs across the storyboard. Two infographic scenes with same motif look identical.
- When the script line is about MECHANISM / VITAMIN / INGREDIENT / BODY SCIENCE → subjectFocus = "infographic" or "ingredient" + motif = "chemistry" / "energy" / "medical"
- When the script line cites REVIEWS / STARS / USER COUNT → motif = "social-proof"
- When the script line describes the PACKAGING / PRODUCT FORM → subjectFocus = "product" + motif = "premium" or "kinetic"
- NEVER produce 3+ consecutive person scenes — interleave them with product/infographic beats
- NEVER repeat the same composition back-to-back (medium close-up → medium close-up is forbidden)
- NEVER repeat the same pose twice anywhere in the storyboard
- CTA scene must be in the FINAL 20% of the timeline (e.g. last 2 of 9, last 3 of 12), never earlier
- Vary wardrobeStyle (≥3 unique) and environmentType (≥4 unique) across person scenes
- Pain/frustration/failed_solution scenes: productVisibility = "low"
- CTA scene: productVisibility = "high" + ctaFocus = true
- Match shotEnergy to sceneType (pain→tension, recovery→relief, cta→energetic)
- The frames must read as a STORY ARC, not a product gallery

Return ONLY the JSON array. No markdown. No prose.`
}

// ── Parse + safety-clamp ─────────────────────────────────────────────────────

interface RawBlueprint {
  sceneId?: number
  sceneNumber?: number
  sceneType?: string
  subjectFocus?: string
  visualMotif?: string
  visualObjective?: string
  subjectAction?: string
  narrativePurpose?: string
  wardrobeStyle?: string
  environmentType?: string
  shotEnergy?: string
  sceneGoal?: string
  environment?: string
  composition?: string
  cameraAngle?: string
  shotType?: string
  pose?: string
  emotion?: string
  handUsage?: string
  productVisibility?: string
  backgroundType?: string
  lightingStyle?: string
  visualTone?: string
  motionIntent?: string
  overlayDensity?: string
  ctaFocus?: boolean
  speech?: string
  presetLabel?: string
  motionStyle?: string
  cameraMotion?: string
}

const SCENE_TYPE_SET: SceneType[] = [
  'hook', 'pain', 'frustration', 'failed_solution', 'discovery',
  'explanation', 'recovery', 'lifestyle', 'social_proof', 'cta',
]

const SUBJECT_FOCUS_SET: SubjectFocus[] = [
  'person', 'product', 'infographic', 'ingredient', 'lifestyle',
]

/** Z11: smart default for subjectFocus when LLM omits it — derived from
 *  sceneType. Person-centric beats default to 'person'; explanation
 *  scenes default to 'infographic' (mechanism / science); the rest stay
 *  person but normalizer keeps the mix from collapsing entirely. */
function focusForSceneType(t: SceneType | undefined): SubjectFocus {
  if (!t) return 'person'
  if (t === 'explanation') return 'infographic'
  return 'person'
}

function clampSubjectFocus(v: string | undefined, fallback: SubjectFocus): SubjectFocus {
  if (!v) return fallback
  const lower = v.toLowerCase().trim().replace(/[\s-]/g, '_')
  // Common aliases LLMs use
  if (lower === 'avatar' || lower === 'user' || lower === 'subject') return 'person'
  if (lower === 'macro'  || lower === 'closeup' || lower === 'product_hero') return 'product'
  if (lower === 'animation' || lower === 'mechanism' || lower === 'science') return 'infographic'
  if (lower === 'capsule' || lower === 'pill') return 'ingredient'
  if (lower === 'environment' || lower === 'context' || lower === 'scene') return 'lifestyle'
  return (SUBJECT_FOCUS_SET as string[]).includes(lower) ? (lower as SubjectFocus) : fallback
}

// ── Z12: visualMotif clamp + smart default ─────────────────────────────────
const VISUAL_MOTIF_SET: VisualMotif[] = [
  'medical', 'chemistry', 'energy', 'premium', 'luxury', 'scientific',
  'organic', 'social-proof', 'kinetic', 'emotional',
]

/** Smart default motif based on (sceneType, subjectFocus) when LLM omits it. */
function motifDefault(sceneType: SceneType | undefined, focus: SubjectFocus): VisualMotif {
  if (focus === 'infographic') {
    if (sceneType === 'explanation') return 'chemistry'
    if (sceneType === 'social_proof') return 'social-proof'
    return 'energy'
  }
  if (focus === 'ingredient') return 'organic'
  if (focus === 'product') return sceneType === 'cta' ? 'kinetic' : 'premium'
  if (focus === 'lifestyle') return 'emotional'
  // person
  if (sceneType === 'pain' || sceneType === 'frustration' || sceneType === 'discovery') return 'emotional'
  if (sceneType === 'cta') return 'kinetic'
  return 'emotional'
}

function clampVisualMotif(v: string | undefined, fallback: VisualMotif): VisualMotif {
  if (!v) return fallback
  const lower = v.toLowerCase().trim().replace(/[\s_]/g, '-')
  // Common aliases
  if (lower === 'clinical' || lower === 'pharma') return 'medical'
  if (lower === 'molecular' || lower === 'molecule' || lower === 'lab') return 'chemistry'
  if (lower === 'particles' || lower === 'glow' || lower === 'electric') return 'energy'
  if (lower === 'elegant' || lower === 'minimal-premium') return 'premium'
  if (lower === 'high-end' || lower === 'sophisticated') return 'luxury'
  if (lower === 'data' || lower === 'lab-tech') return 'scientific'
  if (lower === 'natural' || lower === 'herbal' || lower === 'fresh') return 'organic'
  if (lower === 'metrics' || lower === 'reviews' || lower === 'testimonials' || lower === 'socialproof') return 'social-proof'
  if (lower === 'motion' || lower === 'action' || lower === 'dynamic') return 'kinetic'
  if (lower === 'warm' || lower === 'intimate' || lower === 'storytelling') return 'emotional'
  return (VISUAL_MOTIF_SET as string[]).includes(lower) ? (lower as VisualMotif) : fallback
}

const SHOT_ENERGY_SET: ShotEnergy[] = [
  'intimate', 'dynamic', 'emotional', 'calm', 'tension', 'relief', 'energetic',
]

function clampSceneType(v: string | undefined): SceneType | undefined {
  if (!v) return undefined
  const lower = v.toLowerCase().trim().replace(/[\s-]/g, '_')
  return (SCENE_TYPE_SET as string[]).includes(lower) ? (lower as SceneType) : undefined
}

function clampShotEnergy(v: string | undefined): ShotEnergy | undefined {
  if (!v) return undefined
  const lower = v.toLowerCase().trim()
  return (SHOT_ENERGY_SET as string[]).includes(lower) ? (lower as ShotEnergy) : undefined
}

/** Default product visibility derived from sceneType — used when LLM omits it. */
function visibilityForSceneType(t: SceneType | undefined): 'low' | 'medium' | 'high' {
  if (!t) return 'high'
  if (t === 'pain' || t === 'frustration' || t === 'failed_solution') return 'low'
  if (t === 'hook' || t === 'discovery' || t === 'recovery' || t === 'lifestyle') return 'medium'
  return 'high' // explanation / social_proof / cta
}

/**
 * Resilient parse — uses jsonResilience.safeParseJson + validates shape.
 * Returns null on failure (caller decides to retry vs fail).
 */
function parseStoryboardResponse(raw: string): RawBlueprint[] | null {
  const result = safeParseJson<unknown>(raw)
  if (!result.ok) {
    logJsonFailure('parseStoryboardResponse', raw, result)
    return null
  }
  if (!Array.isArray(result.data)) {
    console.error('[parseStoryboardResponse] result is not an array:', result.data)
    return null
  }
  if (result.repairUsed) {
    console.info('[parseStoryboardResponse] ✓ recovered via repair layer')
  }
  if (result.sanitizationUsed) {
    console.info('[parseStoryboardResponse] ✓ unicode sanitization applied')
  }
  return result.data as RawBlueprint[]
}

// ── Schema validation — strict per-scene field check ────────────────────────

/**
 * Required fields per scene (per spec Task 6). Returns the FIRST validation
 * error encountered, or null if all scenes pass.
 *
 * Strictness allows the runtime to defaultable some optional fields in
 * `normalizeBlueprint` — but core identity-shaping fields (sceneId, sceneGoal,
 * cameraAngle, composition, emotion, environment, productVisibility) MUST be
 * present and non-empty. presetLabel can be missing.
 */
export interface SchemaError {
  sceneIndex: number
  field: string
  reason: string
}

export function validateBlueprintSchema(blueprints: RawBlueprint[], expectedCount: number): SchemaError | null {
  if (blueprints.length < expectedCount * 0.7) {
    return {
      sceneIndex: -1,
      field: 'array length',
      reason: `Chỉ có ${blueprints.length}/${expectedCount} scene — quá ít`,
    }
  }
  // sceneType is new-Phase-A required; others kept loose (auto-defaulted in normalize)
  const required: Array<keyof RawBlueprint> = [
    'sceneType', 'sceneGoal', 'cameraAngle', 'composition', 'emotion', 'environment', 'productVisibility',
  ]
  for (let i = 0; i < blueprints.length; i++) {
    const bp = blueprints[i]
    if (typeof bp !== 'object' || bp === null) {
      return { sceneIndex: i, field: '(whole object)', reason: 'không phải object' }
    }
    for (const field of required) {
      const val = bp[field]
      if (val === undefined || val === null) {
        return { sceneIndex: i, field, reason: 'missing' }
      }
      if (typeof val === 'string' && val.trim().length === 0) {
        return { sceneIndex: i, field, reason: 'empty string' }
      }
    }
    // productVisibility must be one of low/medium/high
    const vis = String(bp.productVisibility).toLowerCase()
    if (!['low', 'medium', 'high', 'hero', 'mid', 'med', 'none'].includes(vis)) {
      return { sceneIndex: i, field: 'productVisibility', reason: `value '${bp.productVisibility}' không hợp lệ (cần low/medium/high)` }
    }
    // sceneType must be one of the valid enum values
    const st = String(bp.sceneType).toLowerCase().trim().replace(/[\s-]/g, '_')
    if (!(SCENE_TYPE_SET as string[]).includes(st)) {
      return { sceneIndex: i, field: 'sceneType', reason: `value '${bp.sceneType}' không hợp lệ (cần hook/pain/frustration/failed_solution/discovery/explanation/recovery/lifestyle/social_proof/cta)` }
    }
  }
  return null
}

function clampVisibility(v: string | undefined): SceneBlueprint['productVisibility'] {
  const lower = (v ?? '').toLowerCase()
  if (lower === 'high' || lower === 'hero') return 'high'
  if (lower === 'medium' || lower === 'mid' || lower === 'med') return 'medium'
  return 'low'
}

function clampOverlay(v: string | undefined): SceneBlueprint['overlayDensity'] {
  const lower = (v ?? '').toLowerCase()
  if (lower === 'high' || lower === 'heavy') return 'high'
  if (lower === 'medium' || lower === 'med') return 'medium'
  if (lower === 'low') return 'low'
  return 'none'
}

function clampVisualTone(v: string | undefined): string {
  const tone = (v ?? '').trim()
  if (!tone) return 'warm authentic ecommerce ugc'
  const lower = tone.toLowerCase()
  // Strip banned terms (replace with safe alternative)
  const banned = ['cinematic', 'movie', 'film noir', 'editorial fashion', 'studio commercial', 'stock photo corporate']
  if (banned.some((b) => lower.includes(b))) {
    return 'warm authentic ecommerce ugc — landing-page / social-proof lifestyle'
  }
  // Ensure ecommerce-ish keyword present
  if (!/ecommerce|ugc|landing-page|social-proof|lifestyle|advertorial/i.test(tone)) {
    return `${tone} — ecommerce lifestyle`
  }
  return tone
}

function normalizeBlueprint(raw: RawBlueprint, idx: number): SceneBlueprint {
  const sceneType = clampSceneType(raw.sceneType)
  const subjectFocus = clampSubjectFocus(raw.subjectFocus, focusForSceneType(sceneType))
  const visualMotif = clampVisualMotif(raw.visualMotif, motifDefault(sceneType, subjectFocus))
  const productVisibility = raw.productVisibility
    ? clampVisibility(raw.productVisibility)
    : visibilityForSceneType(sceneType)
  return {
    sceneId: raw.sceneId ?? raw.sceneNumber ?? idx + 1,
    sceneNumber: raw.sceneId ?? raw.sceneNumber ?? idx + 1,
    sceneType,
    subjectFocus,
    visualMotif,
    visualObjective: raw.visualObjective,
    subjectAction: raw.subjectAction,
    narrativePurpose: raw.narrativePurpose,
    wardrobeStyle: raw.wardrobeStyle ?? 'home casual',
    environmentType: raw.environmentType,
    shotEnergy: clampShotEnergy(raw.shotEnergy),
    sceneGoal: raw.sceneGoal ?? 'advance the story',
    environment: raw.environment ?? 'home interior',
    composition: raw.composition ?? 'medium close-up',
    cameraAngle: raw.cameraAngle ?? 'iphone eye-level',
    shotType: raw.shotType ?? 'ugc handheld',
    pose: raw.pose ?? 'natural body language for the moment',
    emotion: raw.emotion ?? 'authentic',
    handUsage: raw.handUsage ?? 'natural hand position for the action',
    productVisibility,
    backgroundType: raw.backgroundType ?? 'real lived-in home softly out of focus',
    lightingStyle: raw.lightingStyle ?? 'soft natural daylight',
    visualTone: clampVisualTone(raw.visualTone),
    motionIntent: raw.motionIntent ?? 'subtle handheld realism',
    overlayDensity: clampOverlay(raw.overlayDensity),
    ctaFocus: raw.ctaFocus === true || sceneType === 'cta',
    speech: raw.speech ?? '',
    presetLabel: raw.presetLabel,
    motionStyle: clampMotionStyle(raw.motionStyle, sceneType),
    cameraMotion: clampCameraMotion(raw.cameraMotion, sceneType),
  }
}

// ── Motion field clamps — fall back to sceneType-aware defaults ──────────
// These are critical for downstream Kling/Veo/Runway video gen — the
// animator needs to know WHAT the subject does and WHERE the camera moves,
// not guess from a still.

const MOTION_STYLE_SET: NonNullable<SceneBlueprint['motionStyle']>[] = [
  'subtle_head_turn', 'stomach_holding', 'eating_motion', 'selfie_talk',
  'pointing_product', 'laugh_with_family', 'unboxing_reveal',
  'walking_in', 'static_pose',
]
const CAMERA_MOTION_SET: NonNullable<SceneBlueprint['cameraMotion']>[] = [
  'handheld', 'iphone_selfie', 'slow_pushin', 'slow_pullout',
  'static', 'over_shoulder', 'walking_follow', 'overhead_top',
]

function motionForSceneType(t: SceneType | undefined): SceneBlueprint['motionStyle'] {
  switch (t) {
    case 'pain':
    case 'frustration':     return 'stomach_holding'
    case 'failed_solution': return 'static_pose'
    case 'discovery':       return 'unboxing_reveal'
    case 'explanation':     return 'pointing_product'
    case 'recovery':
    case 'lifestyle':       return 'eating_motion'
    case 'social_proof':    return 'laugh_with_family'
    case 'cta':             return 'selfie_talk'
    case 'hook':            return 'subtle_head_turn'
    default:                return 'subtle_head_turn'
  }
}

function cameraForSceneType(t: SceneType | undefined): SceneBlueprint['cameraMotion'] {
  switch (t) {
    case 'pain':
    case 'frustration':     return 'slow_pushin'   // tighten in on emotion
    case 'failed_solution': return 'overhead_top'  // flat lay of failed remedies
    case 'discovery':       return 'iphone_selfie' // first-moment selfie
    case 'explanation':     return 'static'        // credibility / steady
    case 'recovery':
    case 'lifestyle':       return 'walking_follow' // tracking through happy moments
    case 'social_proof':    return 'handheld'
    case 'cta':             return 'iphone_selfie' // talk-to-camera testimonial
    case 'hook':            return 'handheld'      // scroll-stopping micro-shake
    default:                return 'handheld'
  }
}

function clampMotionStyle(v: string | undefined, t: SceneType | undefined): SceneBlueprint['motionStyle'] {
  if (v && (MOTION_STYLE_SET as readonly string[]).includes(v)) return v as SceneBlueprint['motionStyle']
  return motionForSceneType(t)
}

function clampCameraMotion(v: string | undefined, t: SceneType | undefined): SceneBlueprint['cameraMotion'] {
  if (v && (CAMERA_MOTION_SET as readonly string[]).includes(v)) return v as SceneBlueprint['cameraMotion']
  return cameraForSceneType(t)
}

// ── Diversity validator ──────────────────────────────────────────────────────

/**
 * Diversity validator — now tracks 6 axes (was 4). Per Task 3 optimization spec.
 * Returns notes in Vietnamese for the UI.
 */
export function validateDiversity(blueprints: SceneBlueprint[]): DiversityReport {
  const total = blueprints.length
  const notes: string[] = []

  const norm = (s: string | undefined) => (s ?? '').toLowerCase().trim()
  const uniqueCompositions = new Set(blueprints.map((b) => norm(b.composition))).size
  const uniqueCameraAngles = new Set(blueprints.map((b) => norm(b.cameraAngle))).size
  const uniquePoses        = new Set(blueprints.map((b) => norm(b.pose))).size
  const uniqueShotTypes    = new Set(blueprints.map((b) => norm(b.shotType))).size
  const uniqueEnvironments = new Set(blueprints.map((b) => norm(b.environment))).size
  const uniqueHandUsages   = new Set(blueprints.map((b) => norm(b.handUsage))).size
  // Phase A — new story-driven axes
  const uniqueWardrobes    = new Set(blueprints.map((b) => norm(b.wardrobeStyle))).size
  const uniqueEnvTypes     = new Set(blueprints.map((b) => norm(b.environmentType))).size
  const uniqueShotEnergy   = new Set(blueprints.map((b) => norm(b.shotEnergy))).size
  const uniqueSceneTypes   = new Set(blueprints.map((b) => norm(b.sceneType))).size
  const highVisibilityCount = blueprints.filter((b) => b.productVisibility === 'high').length
  const lowVisibilityCount  = blueprints.filter((b) => b.productVisibility === 'low').length

  // Visual-rhythm thresholds
  const minComposition  = Math.max(5, Math.floor(total * 0.55))
  const minCameraAngle  = Math.max(4, Math.floor(total * 0.45))
  const minPose         = Math.max(5, Math.floor(total * 0.55))
  const minShotType     = Math.max(3, Math.floor(total * 0.33))
  // Story-evolution thresholds (Phase A)
  const minWardrobe     = Math.max(3, Math.floor(total * 0.33))
  const minEnvType      = Math.max(4, Math.floor(total * 0.45))
  const minShotEnergy   = Math.max(4, Math.floor(total * 0.45))
  const minSceneType    = Math.max(4, Math.floor(total * 0.45))
  const minEnvironment  = Math.max(4, Math.floor(total * 0.45))
  const minHandUsage    = Math.max(4, Math.floor(total * 0.45))

  if (uniqueCompositions < minComposition) notes.push(`Composition đa dạng yếu (${uniqueCompositions}/${total}, cần ≥${minComposition})`)
  if (uniqueCameraAngles < minCameraAngle) notes.push(`Góc máy đa dạng yếu (${uniqueCameraAngles}/${total}, cần ≥${minCameraAngle})`)
  if (uniquePoses < minPose) notes.push(`Pose đa dạng yếu (${uniquePoses}/${total}, cần ≥${minPose})`)
  if (uniqueShotTypes < minShotType) notes.push(`Shot type đa dạng yếu (${uniqueShotTypes}/${total}, cần ≥${minShotType})`)
  if (uniqueEnvironments < minEnvironment) notes.push(`Môi trường đa dạng yếu (${uniqueEnvironments}/${total}, cần ≥${minEnvironment})`)
  if (uniqueEnvTypes < minEnvType) notes.push(`Bối cảnh (environmentType) đa dạng yếu (${uniqueEnvTypes}/${total}, cần ≥${minEnvType}) — timeline UGC phải đổi địa điểm`)
  if (uniqueWardrobes < minWardrobe) notes.push(`Outfit (wardrobeStyle) đa dạng yếu (${uniqueWardrobes}/${total}, cần ≥${minWardrobe}) — nhân vật phải thay đồ theo timeline`)
  if (uniqueShotEnergy < minShotEnergy) notes.push(`Năng lượng khung hình (shotEnergy) đa dạng yếu (${uniqueShotEnergy}/${total}, cần ≥${minShotEnergy})`)
  if (uniqueSceneTypes < minSceneType) notes.push(`Nhịp cảm xúc (sceneType) đa dạng yếu (${uniqueSceneTypes}/${total}, cần ≥${minSceneType}) — cần ít nhất 4 beat khác nhau`)
  if (uniqueHandUsages < minHandUsage) notes.push(`Cách cầm sản phẩm đa dạng yếu (${uniqueHandUsages}/${total}, cần ≥${minHandUsage})`)

  // Story arc check: need ≥1 low-visibility scene (pain/frustration beat)
  const minLowVis = Math.max(1, Math.floor(total * 0.2))
  if (lowVisibilityCount < minLowVis) notes.push(`Quá ít scene low-visibility (${lowVisibilityCount}/${total}, cần ≥${minLowVis}) — pain/frustration scenes không nên cầm sản phẩm`)

  // Hero CTA constraint — last scene + any cta-marked scene must be high vis
  const ctaScenes = blueprints.filter((b) => b.ctaFocus || b.sceneType === 'cta')
  for (const s of ctaScenes) {
    if (s.productVisibility !== 'high') {
      notes.push(`Scene #${s.sceneId} (CTA) phải có productVisibility=high — đang là ${s.productVisibility}`)
    }
  }
  // Loose hero floor — ≥40% scenes hero/high (was 70%, relaxed for story-driven flow)
  const minHigh = Math.ceil(total * 0.4)
  if (highVisibilityCount < minHigh) notes.push(`Quá ít scene productVisibility=high (${highVisibilityCount}/${total}, cần ≥${minHigh}) — cần đủ frame hero cho social_proof/cta/explanation`)

  // Back-to-back identical detection
  for (let i = 1; i < blueprints.length; i++) {
    if (norm(blueprints[i].composition) === norm(blueprints[i - 1].composition)) {
      notes.push(`Scene #${i + 1} composition giống scene #${i} — không nên lặp liên tiếp`)
    }
    if (norm(blueprints[i].environmentType) && norm(blueprints[i].environmentType) === norm(blueprints[i - 1].environmentType) && i >= 2 && norm(blueprints[i - 2].environmentType) === norm(blueprints[i].environmentType)) {
      notes.push(`Scene #${i - 1}, #${i}, #${i + 1} cùng environmentType — quá monotone, đổi địa điểm`)
    }
  }

  return {
    passed: notes.length === 0,
    uniqueCompositions,
    uniqueCameraAngles,
    uniquePoses,
    highVisibilityCount,
    totalScenes: total,
    notes,
  }
}

// ── Z15: validator helpers — advisory mode, never reject batch ──────────
// `validateBlueprintSchema` still exists for diagnostic use. The generator
// uses these lighter helpers so a single bad field doesn't tank the entire
// retry loop. Missing/invalid fields get defaulted by normalizeBlueprint.

/**
 * Loose count check used during the retry decision. Accepts the array if it
 * has ≥50% of the requested scenes with a floor of 6. Truncated outputs
 * (Gemini ran out of tokens mid-array) still survive as long as we got
 * enough beats to work with.
 */
function hasEnoughScenes(blueprints: RawBlueprint[], requested: number): boolean {
  const floor = Math.max(6, Math.ceil(requested * 0.5))
  return blueprints.length >= floor
}

/** Diagnostic logger — surfaces field issues without rejecting the batch. */
function logFieldWarnings(blueprints: RawBlueprint[], expected: number, tag: string): void {
  const result = validateBlueprintSchema(blueprints, expected)
  if (result) {
    console.warn(
      `[VALIDATION_WARN ${tag}] scene #${result.sceneIndex + 1} field "${result.field}" ` +
      `(${result.reason}) — non-fatal, normalizer will default`,
    )
  }
}

// ── Main service ─────────────────────────────────────────────────────────────

/** Stage of the 3-tier retry pipeline — used by the UI to show specific status. */
export type StoryboardGenStage = 'attempt-1' | 'repair-1' | 'reprompt-2' | 'safe-mode-3'

/**
 * Generate a structured storyboard (array of SceneBlueprints) from a script via Gemini.
 *
 * PRODUCTION-GRADE 3-TIER RESILIENCE:
 *   Tier 1: Normal Gemini call → safeParseJson (extract + repair internally)
 *           → schema validate. If pass: done.
 *   Tier 2: Reprompt with explicit "Previous failed" prefix → safeParseJson →
 *           schema validate. If pass: done (recoveredFromRetry=true).
 *   Tier 3: SAFE-MODE — shorter prompt, no emoji, plain ASCII bias →
 *           safeParseJson → schema validate. Last resort, reliability > creativity.
 *
 * Throws a Vietnamese-friendly error if all 3 tiers fail.
 */
export async function generateStoryboard(params: {
  geminiKey: string
  script: string
  identity: IdentityPack
  productName: string
  dna: VisualStyleDna
  numScenes?: number
  presetRotation?: string[]
  /** Per-stage callback — UI can show specific status per retry stage */
  onStageChange?: (stage: StoryboardGenStage, reason?: string) => void
}): Promise<{ blueprints: SceneBlueprint[]; diversity: DiversityReport; recoveredAtStage: StoryboardGenStage }> {
  const numScenes = params.numScenes ?? 9
  const presetRotation = params.presetRotation ?? DEFAULT_PRESET_ROTATION.slice(0, numScenes)
  const promptParams: BlueprintPromptParams = {
    script: params.script,
    identity: params.identity,
    productName: params.productName,
    dna: params.dna,
    presetRotation,
    numScenes,
  }

  console.log(`[generateStoryboard] START numScenes=${numScenes} script.words=${params.script.trim().split(/\s+/).filter(Boolean).length}`)

  let rawBlueprints: RawBlueprint[] | null = null
  let recoveredAtStage: StoryboardGenStage = 'attempt-1'

  // Z15 token budget: 4096 was too low for 12+ scenes × 27 fields → Gemini
  // would truncate mid-array, JSON parse would fail, retry would also fail
  // because the prompt is even larger. 8192 is Gemini 2.5 Flash's native
  // output ceiling — handles up to 24 scenes comfortably.
  const STORYBOARD_OUTPUT_TOKENS = 8192

  // ── Tier 1: Normal call ─────────────────────────────────────────────────
  params.onStageChange?.('attempt-1')
  const normalPrompt = buildStoryboardPrompt(promptParams)
  let raw = await directGeminiVision({
    apiKey: params.geminiKey,
    parts: [{ text: normalPrompt }],
    systemInstruction: STORYBOARD_SYSTEM,
    maxOutputTokens: STORYBOARD_OUTPUT_TOKENS,
  })
  console.log(`[RAW_GEMINI tier-1] length=${raw.length} preview=${raw.slice(0, 200).replace(/\s+/g, ' ')}`)
  rawBlueprints = parseStoryboardResponse(raw)
  console.log(`[PARSED tier-1] count=${rawBlueprints?.length ?? 'null'}`)

  // ── Tier 1.5: scene-count check on tier-1 success ─────────────────────
  // Z15: validator is now ADVISORY (returns warnings, doesn't reject batch).
  // Only retry when the parsed count is too low OR parse failed entirely.
  // Field-level issues get logged and handled by the normalizer's defaults.
  if (rawBlueprints && !hasEnoughScenes(rawBlueprints, numScenes)) {
    console.warn(`[VALIDATION_ERROR tier-1] count ${rawBlueprints.length} too low for requested ${numScenes} — retrying`)
    rawBlueprints = null
  } else if (rawBlueprints) {
    logFieldWarnings(rawBlueprints, numScenes, 'tier-1')
  }

  // ── Tier 2: Reprompt with "Previous failed" prefix ──────────────────────
  if (!rawBlueprints) {
    console.warn('[generateStoryboard] tier 1 failed — auto-retry with stricter prompt')
    recoveredAtStage = 'reprompt-2'
    params.onStageChange?.('reprompt-2', 'parse/schema fail on attempt 1')

    const retryPrompt = `Your previous output was NOT valid JSON or had too few scenes. The response failed validation.

Return STRICT VALID JSON ONLY this time:
- No markdown wrappers (no \`\`\`json)
- No prose before or after
- Escape all inner quotes with \\"
- No literal newlines inside string values
- Compact JSON only — keep every string value SHORT (<10 words)
- The array MUST contain at least ${Math.ceil(numScenes * 0.5)} scenes (target ${numScenes})
- Every scene MUST include: sceneId, sceneGoal, environment, composition, cameraAngle, shotType, pose, emotion, handUsage, productVisibility, backgroundType, lightingStyle, visualTone, motionIntent, overlayDensity, ctaFocus, speech, presetLabel
- productVisibility must be exactly one of: "low" | "medium" | "high"

Original task:
${normalPrompt}`

    raw = await directGeminiVision({
      apiKey: params.geminiKey,
      parts: [{ text: retryPrompt }],
      systemInstruction: STORYBOARD_SYSTEM,
      maxOutputTokens: STORYBOARD_OUTPUT_TOKENS,
    })
    console.log(`[RAW_GEMINI tier-2] length=${raw.length} preview=${raw.slice(0, 200).replace(/\s+/g, ' ')}`)
    rawBlueprints = parseStoryboardResponse(raw)
    console.log(`[PARSED tier-2] count=${rawBlueprints?.length ?? 'null'}`)
    if (rawBlueprints && !hasEnoughScenes(rawBlueprints, numScenes)) {
      console.warn(`[VALIDATION_ERROR tier-2] count ${rawBlueprints.length} too low — falling to safe-mode`)
      rawBlueprints = null
    } else if (rawBlueprints) {
      logFieldWarnings(rawBlueprints, numScenes, 'tier-2')
    }
  }

  // ── Tier 3: SAFE-MODE — simpler prompt, no emoji, plain ASCII ──────────
  if (!rawBlueprints) {
    console.warn('[generateStoryboard] tier 2 failed — falling back to SAFE-MODE (low-creativity JSON)')
    recoveredAtStage = 'safe-mode-3'
    params.onStageChange?.('safe-mode-3', 'parse/schema fail on attempt 2 — using simpler prompt')

    const safePrompt = buildSafeModeStoryboardPrompt(promptParams)
    raw = await directGeminiVision({
      apiKey: params.geminiKey,
      parts: [{ text: safePrompt }],
      // Use minimal system instruction in safe-mode — less verbose context to confuse
      systemInstruction: 'You output strict valid JSON arrays. No markdown. No prose. Plain ASCII only.',
      maxOutputTokens: STORYBOARD_OUTPUT_TOKENS,
    })
    console.log(`[RAW_GEMINI tier-3 safe] length=${raw.length} preview=${raw.slice(0, 200).replace(/\s+/g, ' ')}`)
    rawBlueprints = parseStoryboardResponse(raw)
    console.log(`[PARSED tier-3] count=${rawBlueprints?.length ?? 'null'}`)
    // Z15: safe-mode threshold is even looser — accept anything ≥ 4 scenes
    // since this is the last resort. The normalizer + cinematic engine will
    // fill in defaults for missing fields. Better to render an imperfect
    // storyboard than hard-fail.
    if (rawBlueprints && rawBlueprints.length < 4) {
      console.error(`[VALIDATION_ERROR tier-3] only ${rawBlueprints.length} scenes — too few even for safe-mode`)
      rawBlueprints = null
    } else if (rawBlueprints) {
      logFieldWarnings(rawBlueprints, numScenes, 'tier-3 safe-mode')
    }
  }

  // ── All 3 tiers failed — give up with VN-friendly error ────────────────
  if (!rawBlueprints) {
    throw new Error('AI không trả về JSON hợp lệ sau 3 lần thử (normal → reprompt → safe-mode). Vui lòng thử lại — mở DevTools Console để xem chi tiết debug.')
  }

  let blueprints = rawBlueprints.map((rb, i) => normalizeBlueprint(rb, i))
  console.log(
    `[NORMALIZED] count=${blueprints.length} ` +
    `subjectFocus_sample=[${blueprints.slice(0, 3).map((b) => b.subjectFocus ?? 'n/a').join(',')}] ` +
    `visualMotif_sample=[${blueprints.slice(0, 3).map((b) => b.visualMotif ?? 'n/a').join(',')}]`,
  )

  // Truncate or pad to exact numScenes
  if (blueprints.length > numScenes) blueprints = blueprints.slice(0, numScenes)

  // Ensure the last scene has ctaFocus=true if none does
  if (blueprints.length > 0 && !blueprints.some((b) => b.ctaFocus)) {
    blueprints[blueprints.length - 1].ctaFocus = true
  }

  // ── AUTO PRESET INFERENCE ENGINE (Phase A) ──────────────────────────────
  // Run AFTER normalize so blueprint has its sceneType + script-derived fields.
  // Sequential pass with anti-repetition penalty so 9 scenes spread across
  // the preset library instead of all picking the same hero preset.
  const usedPresetIds = new Set<string>()
  blueprints = blueprints.map((b) => {
    const match = inferPresetForScene(b, { usedPresetIds })
    usedPresetIds.add(match.preset.id)
    return {
      ...b,
      // Only auto-fill presetLabel if LLM didn't already pick one that matches a real preset
      presetLabel: b.presetLabel && SCENE_PRESETS.some((p) => p.labelEn === b.presetLabel)
        ? b.presetLabel
        : match.preset.labelEn,
      presetConfidence: match.confidence,
    }
  })

  // Z13: CINEMATIC ENGINE — assign cameraGrammar / cinematicIntent /
  // socialPreset / energyScore / transitionOut to every scene from inferred
  // defaults. Runs BEFORE timelineDirector so R7-R9 can polish energy +
  // transition rules on top of the assigned fields.
  blueprints = assignCinematicFields(blueprints)

  // Z12: TIMELINE DIRECTOR + ANTI-DUPLICATE ENGINE
  // Runs AFTER preset inference + cinematic assignment so mutations land
  // on the final shape and Z13 R7-R9 rules can fire.
  blueprints = enforceTimelineDirector(blueprints)

  // Z17: EDITORIAL INTELLIGENCE — attach visualRole + run semantic diversity
  // rules + auto-mutate semantic duplicates + add motion blueprint to each
  // master scene. Runs after the cinematic engine + timeline director so it
  // has the full Z11/Z12/Z13 data to work with.
  blueprints = blueprints.map((b) => ({ ...b, visualRole: b.visualRole ?? inferVisualRole(b) }))
  blueprints = enforceVisualRoleDiversity(blueprints)
  blueprints = autoMutateRepetitive(blueprints)
  blueprints = blueprints.map((m) => ({ ...m, motion: m.motion ?? buildMotionForMaster(m) }))

  const diversity = validateDiversity(blueprints)

  // Apply VISUAL_TONE_CLAMP suffix to ensure no scene smuggles in banned terms downstream
  blueprints = blueprints.map((b) => ({ ...b, visualTone: `${b.visualTone}. ${VISUAL_TONE_CLAMP}` }))

  // Z15: final diagnostic dump — confirms cinematic engine produced sane values
  const sample = blueprints[0]
  console.log(
    `[FINAL_SCENE_COUNT] requested=${numScenes} actual=${blueprints.length} stage=${recoveredAtStage}`,
  )
  if (sample) {
    console.log(
      `[CINEMATIC_FIELDS scene-1] ` +
      `subjectFocus=${sample.subjectFocus} · visualMotif=${sample.visualMotif} · ` +
      `cameraGrammar=${sample.cameraGrammar} · cinematicIntent=${sample.cinematicIntent} · ` +
      `energyScore=${sample.energyScore} · socialPreset=${sample.socialPreset} · ` +
      `transitionOut=${sample.transitionOut ?? '(end)'} · ` +
      `visualRole=${sample.visualRole} · motion=zoom:${sample.motion?.zoomDirection ?? '-'}/intensity:${sample.motion?.intensity ?? '-'}`,
    )
  }
  // Z17: editorial brain summary — visualRole distribution
  const roleHistogram: Record<string, number> = {}
  for (const b of blueprints) {
    const r = b.visualRole ?? 'unset'
    roleHistogram[r] = (roleHistogram[r] ?? 0) + 1
  }
  console.log(`[EDITORIAL_ROLES] ${Object.entries(roleHistogram).map(([r, c]) => `${r}×${c}`).join(' · ')}`)

  return { blueprints, diversity, recoveredAtStage }
}

// ═════════════════════════════════════════════════════════════════════════
// Z12 / Z25 — DYNAMIC SCENE COUNT (MVP COST CAP)
// ═════════════════════════════════════════════════════════════════════════
// Z25 MVP cost cap: was clamp(ceil(words/35), 8, 24) — produced 8 master
// scenes which exploded into 56 coverage shots / 50 timeline cuts /
// ~3500 credits per render. Way too expensive for iteration.
//
// New formula: clamp(ceil(words / 55), 4, 6)
//   • Floor 4 — minimum coherent narrative (hook · problem · reveal · cta)
//   • Ceiling 6 — caps render cost even for long scripts
//   • 55 words/scene — fewer beats, each carries more script
//
// Combined with Z25 coverage cap (1-2 templates per master) + maxCuts=18,
// this brings target render cost from ~3500 → ~500-1200 credits.
//
// Examples (new):
//   60-word script  → 2 scenes → clamped to 4 (floor)
//   175-word script → 4 scenes
//   275-word script → 5 scenes
//   330-word script → 6 scenes (ceiling)
//   800-word script → still 6 (ceiling)
// ─────────────────────────────────────────────────────────────────────────

/** Count words in the script (whitespace-split, filters empty tokens). */
function countWords(script: string): number {
  return script.trim().split(/\s+/).filter(Boolean).length
}

// Z25 MVP cost cap — was 8/24, now 4/8 (ceiling raised to support Z28 FULL).
// The render cost scales linearly with master count
// (each master → coverage shots → cuts → Kling clips).
export const SCENE_COUNT_MIN = 4
export const SCENE_COUNT_MAX = 8  // Z28 raised from 6 to support FULL mode
const WORDS_PER_SCENE = 55  // was 35 — fewer, denser beats

/**
 * Compute the number of master scenes to generate.
 *
 * Z28 — if a TimelineMode is provided, use the mode's `masters` value
 * directly (SHORT=4, MID=6, FULL=8). The legacy word-count formula is
 * the fallback when no mode is provided.
 */
export function computeSceneCount(
  script: string,
  mode?: 'SHORT' | 'MID' | 'FULL',
): number {
  if (mode === 'SHORT') return 4
  if (mode === 'MID')   return 6
  if (mode === 'FULL')  return 8
  const words = countWords(script)
  const raw = Math.ceil(words / WORDS_PER_SCENE)
  return Math.max(SCENE_COUNT_MIN, Math.min(SCENE_COUNT_MAX, raw))
}

// ═════════════════════════════════════════════════════════════════════════
// Z13 — CINEMATIC ENGINE
// ═════════════════════════════════════════════════════════════════════════
// 7 modules that turn the "smart slideshow" into TikTok-native UGC pacing.
// All inferred LOCALLY from (sceneType, subjectFocus, visualMotif, idx,
// totalScenes) — Gemini is not asked to fill these, so prompt complexity
// stays flat.
//
//   1. Camera grammar engine     — concrete movement per scene
//   2. Cinematic intent engine    — motion psychology layer
//   3. Cinematic timeline curves  — HIGH → MED → HIGH → MAX energy arc
//   4. Scene energy mapper        — 0-100 score per scene
//   5. Social motion presets      — bundled TikTok-native packs
//   6. Transition director        — scene-pair-aware exit transitions
//   7. CTA impact engine          — escalates pacing in final 20%
// ─────────────────────────────────────────────────────────────────────────

/** Camera grammar inferred from sceneType + subjectFocus. */
function inferCameraGrammar(b: SceneBlueprint): CameraGrammar {
  const t = b.sceneType
  const f = b.subjectFocus ?? 'person'

  // Subject-focus-specific overrides take priority
  if (f === 'product')     return 'product_macro'
  if (f === 'ingredient')  return 'topdown_float'
  if (f === 'infographic') {
    return b.visualMotif === 'social-proof' ? 'parallax_depth' : 'infographic_float'
  }
  if (f === 'lifestyle')   return 'drift_right'

  // person path — pick by sceneType
  switch (t) {
    case 'hook':            return 'punch_zoom'
    case 'pain':            return 'handheld_close'
    case 'frustration':     return 'static_tension'
    case 'failed_solution': return 'static_tension'
    case 'discovery':       return 'slow_push'
    case 'explanation':     return 'parallax_depth'
    case 'recovery':        return 'emotional_zoom'
    case 'lifestyle':       return 'drift_left'
    case 'social_proof':    return 'review_pan'
    case 'cta':             return 'punch_zoom'
    default:                return 'slow_push'
  }
}

/** Cinematic intent (motion psychology) inferred from sceneType + ctaFocus. */
function inferCinematicIntent(b: SceneBlueprint): CinematicIntent {
  if (b.ctaFocus) return 'conversion'
  switch (b.sceneType) {
    case 'hook':            return 'urgency'
    case 'pain':            return 'emotional'
    case 'frustration':     return 'urgency'
    case 'failed_solution': return 'educational'
    case 'discovery':       return 'curiosity'
    case 'explanation':     return b.visualMotif === 'scientific' || b.visualMotif === 'medical' ? 'authority' : 'educational'
    case 'recovery':        return 'relief'
    case 'lifestyle':       return b.visualMotif === 'premium' || b.visualMotif === 'luxury' ? 'premium' : 'emotional'
    case 'social_proof':    return 'trust'
    case 'cta':             return 'conversion'
    default:                return 'trust'
  }
}

/** Social motion preset — TikTok-native pack. */
function inferSocialPreset(b: SceneBlueprint): SocialMotionPreset {
  if (b.ctaFocus || b.sceneType === 'cta')         return 'cta_hardsell'
  if (b.sceneType === 'hook')                       return 'hook_aggressive'
  if (b.subjectFocus === 'infographic')             return 'infographic_edu'
  if (b.sceneType === 'social_proof')               return 'social_proof_pan'
  return 'ugc_soft'
}

// ── Timeline curve: HIGH → MEDIUM → HIGH → MAX CTA ──────────────────────
/**
 * Energy curve for N scenes. Returns target energy 0-100 per scene index.
 *
 * Pattern:
 *   • scene 0 (hook):           90  (HIGH)
 *   • middle dip (≈30% mark):    50  (MEDIUM)
 *   • re-engagement (≈60%):      75  (HIGH)
 *   • middle low again (~75%):   55  (MEDIUM)
 *   • final 20% (CTA region):    90 → 100 (MAX)
 *
 * Interpolated linearly between control points.
 */
export function computeEnergyArc(numScenes: number): number[] {
  if (numScenes <= 0) return []
  if (numScenes === 1) return [95]
  if (numScenes === 2) return [85, 100]

  // Control points (fraction of timeline → energy 0-100)
  const ctaStart = 0.80
  const points: Array<[number, number]> = [
    [0.00, 90],   // hook spike
    [0.30, 50],   // breathing room
    [0.60, 75],   // re-engagement
    [0.75, 55],   // brief dip before CTA
    [ctaStart, 90], // CTA escalation start
    [1.00, 100],  // final CTA peak
  ]

  const arc: number[] = []
  for (let i = 0; i < numScenes; i++) {
    const t = i / (numScenes - 1)
    // Find the two control points t falls between
    let lower = points[0]
    let upper = points[points.length - 1]
    for (let p = 0; p < points.length - 1; p++) {
      if (t >= points[p][0] && t <= points[p + 1][0]) {
        lower = points[p]
        upper = points[p + 1]
        break
      }
    }
    const span = upper[0] - lower[0]
    const localT = span === 0 ? 0 : (t - lower[0]) / span
    const energy = Math.round(lower[1] + (upper[1] - lower[1]) * localT)
    arc.push(Math.max(0, Math.min(100, energy)))
  }
  return arc
}

/** Per-scene energy score derived from the global arc + scene-type modifier.
 *  Z15 safety: clamps + Number.isFinite guards so a malformed arc never
 *  produces NaN or Infinity that would crash downstream consumers. */
function assignEnergyScore(b: SceneBlueprint, idx: number, arc: number[]): number {
  const baseRaw = arc[idx]
  const base = Number.isFinite(baseRaw) ? (baseRaw as number) : 60

  // Scene-type modifiers — bump or dampen the base curve
  let modifier = 0
  if (b.ctaFocus)                                                modifier += 8
  if (b.sceneType === 'hook')                                    modifier += 5
  if (b.sceneType === 'pain' || b.sceneType === 'frustration')   modifier -= 3   // pain dampens raw energy
  if (b.sceneType === 'failed_solution')                         modifier -= 8   // static tension
  if (b.sceneType === 'explanation')                             modifier -= 10  // calm educational
  if (b.sceneType === 'recovery')                                modifier -= 5   // relief is soft
  if (b.sceneType === 'cta')                                     modifier += 10
  if (b.subjectFocus === 'product')                              modifier += 3

  const result = base + modifier
  if (!Number.isFinite(result)) return 50  // hard fallback per spec
  return Math.max(0, Math.min(100, result))
}

// ── Transition rules — scene-pair-aware ──────────────────────────────────
/** Pick the exit transition for scene `cur` heading into scene `next`. */
function inferTransition(cur: SceneBlueprint, next: SceneBlueprint | null): SceneTransition {
  if (!next) return 'cut' // last scene has no exit transition (handled by caller via undefined)

  // Destination-driven rules (priority order)
  if (next.ctaFocus || next.sceneType === 'cta')                 return 'flash_impact'
  if (next.sceneType === 'hook')                                 return 'smash_cut'
  if (next.subjectFocus === 'infographic')                       return 'directional_wipe'
  if (next.sceneType === 'social_proof')                         return 'cinematic_dissolve'

  // Source-driven rules
  if (cur.cinematicIntent === 'emotional')                       return 'soft_fade'
  if (cur.sceneType === 'recovery')                              return 'soft_fade'

  // Default warm transition
  return 'cross_dissolve'
}

function assignTransitions(blueprints: SceneBlueprint[]): SceneBlueprint[] {
  if (blueprints.length === 0) return blueprints
  const out = blueprints.map((b) => ({ ...b }))
  const TRANSITION_ALTS: SceneTransition[] = [
    'cross_dissolve', 'soft_fade', 'cut', 'directional_wipe', 'cinematic_dissolve',
  ]
  let lastUsed: SceneTransition | null = null
  let consecutiveSame = 0

  for (let i = 0; i < out.length - 1; i++) {
    let t = inferTransition(out[i], out[i + 1])

    // Anti-repeat: never the same transition 2x in a row
    if (lastUsed && t === lastUsed) {
      consecutiveSame++
      if (consecutiveSame >= 1) {
        // Pick an alt that's neither current nor would create a triple
        const alt = TRANSITION_ALTS.find((a) => a !== t && a !== lastUsed) ?? 'cut'
        t = alt
        consecutiveSame = 0
      }
    } else {
      consecutiveSame = 0
    }
    lastUsed = t
    out[i] = { ...out[i], transitionOut: t }
  }
  // Final scene: no exit transition
  return out
}

/** Apply all 4 cinematic fields to every blueprint + compute the energy arc.
 *  Called AFTER preset inference, BEFORE the extended timelineDirector. */
export function assignCinematicFields(blueprints: SceneBlueprint[]): SceneBlueprint[] {
  if (blueprints.length === 0) return blueprints
  const arc = computeEnergyArc(blueprints.length)

  const enriched = blueprints.map((b, idx) => {
    const cameraGrammar  = b.cameraGrammar  ?? inferCameraGrammar(b)
    const cinematicIntent = b.cinematicIntent ?? inferCinematicIntent(b)
    const socialPreset    = b.socialPreset    ?? inferSocialPreset(b)
    // Energy gets assigned via the arc + sceneType modifier
    const energyScore     = b.energyScore !== undefined
      ? b.energyScore
      : assignEnergyScore({ ...b, cameraGrammar, cinematicIntent, socialPreset }, idx, arc)
    return { ...b, cameraGrammar, cinematicIntent, socialPreset, energyScore }
  })

  // Transitions read both current + next scene's enriched fields
  return assignTransitions(enriched)
}

// ═════════════════════════════════════════════════════════════════════════
// Z12 — TIMELINE DIRECTOR + ANTI-DUPLICATE ENGINE
// ═════════════════════════════════════════════════════════════════════════
// Post-processor that runs AFTER normalizeBlueprint. Detects + auto-mutates
// blueprint sequences that violate the hard rules:
//
//   R1. No 3+ consecutive person scenes — middle one converts to product/
//       infographic/ingredient (whichever doesn't repeat)
//   R2. No 2 identical composition values back-to-back — second one swaps
//       to an alternative from a pool
//   R3. No identical pose appearing twice anywhere — duplicates get mutated
//   R4. Same backgroundType max 2x total — extras get re-themed
//   R5. CTA scenes must live in the final 20% of the timeline — earlier
//       ctaFocus flags get cleared (they were misclassified)
//   R6. Infographic motif spacing — same motif can't repeat 3+ in a row
//
// Why mutate vs retry: Gemini retry adds 20-30s + cost. Mutation is instant
// and uses a curated alternative pool that already passes style clamps.
// ─────────────────────────────────────────────────────────────────────────

const COMPOSITION_ALT_POOL = [
  'medium close-up', 'wide-medium', 'over-the-shoulder', 'selfie POV',
  'object detail shot', 'environment shot', 'reaction shot', 'macro detail',
  'top-down flatlay', 'centered hero composition',
]
const BACKGROUND_ALT_POOL = [
  'real lived-in home softly out of focus',
  'kitchen counter mid-morning',
  'cafe wooden table',
  'sunlit bedroom',
  'home office desk corner',
  'bathroom mirror morning light',
  'dining room window-side',
  'cosy living room couch',
]
const POSE_ALT_POOL = [
  'natural standing relaxed',
  'sitting at table thinking',
  'leaning on counter casually',
  'half-turn toward camera',
  'arms crossed confidently',
  'hand to chin reflective',
  'walking with subtle stride',
  'looking down then up at lens',
]

/** Pick the first item from `pool` that isn't already used in `seen`. */
function pickFreshFromPool(pool: string[], seen: Set<string>, idx: number): string {
  // Deterministic rotation so the same idx always picks the same slot when
  // not blocked — keeps mutations stable across regenerations.
  for (let off = 0; off < pool.length; off++) {
    const candidate = pool[(idx + off) % pool.length]
    if (!seen.has(candidate.toLowerCase())) return candidate
  }
  return pool[idx % pool.length]
}

export function enforceTimelineDirector(blueprints: SceneBlueprint[]): SceneBlueprint[] {
  if (blueprints.length === 0) return blueprints
  const N = blueprints.length
  const ctaCutoff = Math.floor(N * 0.8) // CTA only allowed from this index onward

  // Work on a mutable copy
  const out = blueprints.map((b) => ({ ...b }))

  // ── R1: no 3+ consecutive person scenes ──────────────────────────────
  for (let i = 2; i < out.length; i++) {
    if (
      out[i - 2].subjectFocus === 'person' &&
      out[i - 1].subjectFocus === 'person' &&
      out[i].subjectFocus     === 'person'
    ) {
      // Mutate the middle one. Pick a non-person focus that suits the beat.
      const middle = out[i - 1]
      const newFocus: SubjectFocus =
        middle.sceneType === 'explanation' ? 'infographic' :
        middle.sceneType === 'social_proof' ? 'infographic' :
        middle.sceneType === 'lifestyle' ? 'lifestyle' :
        'product'
      out[i - 1] = {
        ...middle,
        subjectFocus: newFocus,
        visualMotif: motifDefault(middle.sceneType, newFocus),
      }
      console.log(`[timelineDirector] R1: scene ${i} broke 3-person run — converted scene ${i - 1} to ${newFocus}`)
    }
  }

  // ── R2: no identical composition back-to-back ────────────────────────
  for (let i = 1; i < out.length; i++) {
    const prev = (out[i - 1].composition ?? '').toLowerCase().trim()
    const cur  = (out[i].composition ?? '').toLowerCase().trim()
    if (prev && cur && prev === cur) {
      const used = new Set([prev])
      out[i] = { ...out[i], composition: pickFreshFromPool(COMPOSITION_ALT_POOL, used, i) }
      console.log(`[timelineDirector] R2: scene ${i + 1} duplicated composition — swapped`)
    }
  }

  // ── R3: same pose appears 2x anywhere → mutate duplicates ────────────
  const seenPoses = new Set<string>()
  for (let i = 0; i < out.length; i++) {
    const pose = (out[i].pose ?? '').toLowerCase().trim()
    if (!pose) continue
    if (seenPoses.has(pose)) {
      out[i] = { ...out[i], pose: pickFreshFromPool(POSE_ALT_POOL, seenPoses, i) }
      seenPoses.add(out[i].pose.toLowerCase())
      console.log(`[timelineDirector] R3: scene ${i + 1} duplicated pose — mutated`)
    } else {
      seenPoses.add(pose)
    }
  }

  // ── R4: same backgroundType max 2x total ─────────────────────────────
  const bgCount = new Map<string, number>()
  for (let i = 0; i < out.length; i++) {
    const bg = (out[i].backgroundType ?? '').toLowerCase().trim()
    if (!bg) continue
    const c = bgCount.get(bg) ?? 0
    if (c >= 2) {
      const used = new Set(Array.from(bgCount.keys()))
      out[i] = { ...out[i], backgroundType: pickFreshFromPool(BACKGROUND_ALT_POOL, used, i) }
      bgCount.set(out[i].backgroundType.toLowerCase(), 1)
      console.log(`[timelineDirector] R4: scene ${i + 1} 3rd repeat of same background — swapped`)
    } else {
      bgCount.set(bg, c + 1)
    }
  }

  // ── R5: CTA only in final 20% ────────────────────────────────────────
  for (let i = 0; i < out.length; i++) {
    if (out[i].ctaFocus && i < ctaCutoff) {
      out[i] = { ...out[i], ctaFocus: false }
      console.log(`[timelineDirector] R5: scene ${i + 1} had ctaFocus too early (cutoff=${ctaCutoff}) — cleared`)
    }
  }
  // Guarantee at least one CTA-flagged scene in the final tier
  const ctaWindow = out.slice(ctaCutoff)
  if (!ctaWindow.some((b) => b.ctaFocus)) {
    const lastIdx = out.length - 1
    out[lastIdx] = { ...out[lastIdx], ctaFocus: true, sceneType: out[lastIdx].sceneType ?? 'cta' }
    console.log(`[timelineDirector] R5: no CTA in final window — promoted scene ${lastIdx + 1} to ctaFocus`)
  }

  // ── R6: visualMotif no 3+ in a row ───────────────────────────────────
  for (let i = 2; i < out.length; i++) {
    if (
      out[i - 2].visualMotif === out[i - 1].visualMotif &&
      out[i - 1].visualMotif === out[i].visualMotif &&
      out[i].visualMotif
    ) {
      // Rotate the middle motif to another from the set
      const altPool = VISUAL_MOTIF_SET.filter((m) => m !== out[i - 1].visualMotif)
      out[i - 1] = { ...out[i - 1], visualMotif: altPool[(i - 1) % altPool.length] }
      console.log(`[timelineDirector] R6: scene ${i} broke 3-motif run — rotated middle`)
    }
  }

  // ── Z13 R7: no 3+ high-energy scenes back-to-back ────────────────────
  // High-energy is defined as energyScore ≥ 75. If three in a row, dampen
  // the middle one to ~55 + tag it with a calmer cinematicIntent. Prevents
  // viewer fatigue + lets the editor breathe before the next spike.
  const HIGH_THRESHOLD = 75
  for (let i = 2; i < out.length; i++) {
    const a = out[i - 2].energyScore ?? 0
    const b = out[i - 1].energyScore ?? 0
    const c = out[i].energyScore ?? 0
    if (a >= HIGH_THRESHOLD && b >= HIGH_THRESHOLD && c >= HIGH_THRESHOLD) {
      // Don't dampen CTA window — the final escalation is intentional
      const inCtaWindow = (i - 1) >= ctaCutoff
      if (!inCtaWindow) {
        out[i - 1] = {
          ...out[i - 1],
          energyScore: 55,
          cinematicIntent: 'trust',  // calmer psychology
        }
        console.log(`[timelineDirector] R7: scene ${i} broke 3-high-energy run — cooled scene ${i - 1} to 55`)
      }
    }
  }

  // ── Z13 R8: never 2 identical transitions in a row ───────────────────
  // assignTransitions already enforces this; this pass is a final safety
  // net in case other mutations (R1-R7) re-tagged scenes and invalidated
  // the original transition pairing.
  for (let i = 1; i < out.length - 1; i++) {
    const prev = out[i - 1].transitionOut
    const cur  = out[i].transitionOut
    if (prev && cur && prev === cur) {
      const altPool: SceneTransition[] = ['cross_dissolve', 'soft_fade', 'cut', 'directional_wipe', 'cinematic_dissolve']
      const alt = altPool.find((a) => a !== prev) ?? 'cut'
      out[i] = { ...out[i], transitionOut: alt }
      console.log(`[timelineDirector] R8: scene ${i + 1} duplicated transition — swapped to ${alt}`)
    }
  }

  // ── Z13 R9: CTA IMPACT — escalate final 20% ──────────────────────────
  // Every scene in the CTA window must have:
  //   • energyScore ≥ 85
  //   • cinematicIntent ∈ {urgency, conversion}
  //   • cameraGrammar ∈ {punch_zoom, emotional_zoom, product_macro, shake_micro}
  //   • socialPreset = 'cta_hardsell' for the final scene
  // This guarantees the BUY NOW momentum the spec calls for.
  for (let i = ctaCutoff; i < out.length; i++) {
    const isFinal = i === out.length - 1
    const escalation: Partial<SceneBlueprint> = {}

    const curEnergy = out[i].energyScore ?? 0
    if (curEnergy < 85) escalation.energyScore = isFinal ? 100 : Math.max(85, curEnergy + 15)

    const intent = out[i].cinematicIntent
    if (intent !== 'urgency' && intent !== 'conversion') {
      escalation.cinematicIntent = isFinal ? 'conversion' : 'urgency'
    }

    const grammar = out[i].cameraGrammar
    const ctaGrammars: CameraGrammar[] = ['punch_zoom', 'emotional_zoom', 'product_macro', 'shake_micro']
    if (!grammar || !ctaGrammars.includes(grammar)) {
      escalation.cameraGrammar = isFinal ? 'punch_zoom' : (out[i].subjectFocus === 'product' ? 'product_macro' : 'emotional_zoom')
    }

    if (isFinal && out[i].socialPreset !== 'cta_hardsell') {
      escalation.socialPreset = 'cta_hardsell'
    }

    if (Object.keys(escalation).length > 0) {
      out[i] = { ...out[i], ...escalation }
      console.log(`[timelineDirector] R9: scene ${i + 1} (CTA window) escalated — ${Object.keys(escalation).join(', ')}`)
    }
  }

  return out
}

// ── Helper: build a single blueprint from a chosen preset ────────────────────
// (Used when user manually picks a preset for a scene slot.)

export function blueprintFromPreset(presetId: string, sceneId: number, speech: string = ''): SceneBlueprint {
  const preset = getPreset(presetId)
  if (!preset) {
    // Fallback to first preset
    const first = SCENE_PRESETS[0]
    return blueprintFromPreset(first.id, sceneId, speech)
  }
  return {
    sceneId,
    sceneNumber: sceneId,
    sceneGoal: 'show product naturally',
    environment: 'home interior',
    composition: preset.template.composition,
    cameraAngle: preset.template.cameraAngle,
    shotType: preset.template.shotType,
    pose: preset.template.pose,
    emotion: 'friendly confident',
    handUsage: preset.template.handUsage,
    productVisibility: preset.template.productVisibility,
    backgroundType: preset.template.backgroundType,
    lightingStyle: preset.template.lightingStyle,
    visualTone: `warm authentic ecommerce ugc. ${VISUAL_TONE_CLAMP}`,
    motionIntent: preset.template.motionIntent,
    overlayDensity: preset.template.overlayDensity,
    ctaFocus: false,
    speech,
    presetLabel: preset.labelEn,
  }
}
