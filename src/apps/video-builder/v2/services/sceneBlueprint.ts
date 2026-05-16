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
import type { IdentityPack, SceneBlueprint, VisualStyleDna, DiversityReport } from '../types'
import { SCENE_PRESETS, DEFAULT_PRESET_ROTATION, VISUAL_TONE_CLAMP, getPreset } from './scenePresets'

// ── Gemini storyboard prompt builder ─────────────────────────────────────────

const STORYBOARD_SYSTEM = `You are a UGC ad storyboard director planning ECOMMERCE / LANDING-PAGE / SOCIAL-PROOF / ADVERTORIAL imagery (NOT cinematic, NOT studio commercial).

Your job: read a script + a list of preset scene types, and output a strict JSON array of scene blueprints — one per scene.

ABSOLUTE RULES:
1. Output ONLY a JSON array. No markdown fences, no preamble, no explanation.
2. Every value is in English (technical strings for image-gen).
3. Visual tone for EVERY scene must include "ecommerce" or "ugc" or "landing-page" or "social-proof" — never "cinematic", "movie", "fashion editorial", "studio commercial".
4. Diversity is mandatory: across 9 scenes, vary composition, cameraAngle, pose. Never repeat the same composition twice in a row.
5. At least 70% of scenes (e.g. 7 of 9) must have productVisibility = "high".
6. The 'speech' field for each scene MUST be 1-2 lines extracted verbatim from the script (in order).
7. The last 1-2 scenes have ctaFocus = true (where the script's CTA falls).
8. Keep all string values SHORT (under 15 words each) — these feed the Prompt Compiler, not the image API directly.`

interface BlueprintPromptParams {
  script: string
  identity: IdentityPack
  productName: string
  dna: VisualStyleDna
  presetRotation: string[]
  numScenes: number
}

function buildStoryboardPrompt(p: BlueprintPromptParams): string {
  // Pull preset templates as hints
  const presetDescriptions = p.presetRotation.slice(0, p.numScenes).map((id, idx) => {
    const preset = getPreset(id)
    if (!preset) return `Scene ${idx + 1}: free choice`
    return `Scene ${idx + 1}: PRESET "${preset.labelEn}" — composition=${preset.template.composition}, cameraAngle=${preset.template.cameraAngle}, shotType=${preset.template.shotType}, pose=${preset.template.pose}, visibility=${preset.template.productVisibility}, environment hint=${preset.template.backgroundType}`
  }).join('\n')

  return `SCRIPT (in order — extract 1-2 lines for each scene's 'speech' field, in sequence):
"""
${p.script}
"""

LOCKED IDENTITY (do NOT alter):
- Avatar: ${p.identity.avatarDescription}
- Product name: "${p.productName}"
- Product visual: ${p.identity.productDescription}

LOCKED VISUAL STYLE DNA:
- Tone: ${p.dna.visualTone}
- Camera style: ${p.dna.cameraStyle}
- Pacing: ${p.dna.pacingStyle}
- Persuasion pattern: ${p.dna.persuasionPattern}
- Subtitle density default: ${p.dna.subtitleDensity}
- CTA style: ${p.dna.ctaStyle}

PRESET ROTATION FOR DIVERSITY (use these as starting points; you may refine):
${presetDescriptions}

OUTPUT FORMAT — strict JSON array of ${p.numScenes} objects with EXACTLY these keys:
[
  {
    "sceneId": 1,
    "sceneGoal": "short narrative goal — e.g. 'pattern interrupt hook'",
    "environment": "specific setting — e.g. 'home kitchen morning', 'bathroom mirror'",
    "composition": "framing — e.g. 'medium close-up'",
    "cameraAngle": "vertical/horizontal angle — e.g. 'iphone eye-level'",
    "shotType": "shot style — e.g. 'ugc handheld' / 'selfie arm-extended' / 'static tripod'",
    "pose": "what avatar is doing — e.g. 'holding product near face, looking at camera'",
    "emotion": "expression — e.g. 'friendly confident' / 'curious surprised'",
    "handUsage": "hand interaction — e.g. 'one hand holding bottle' / 'both hands cradling jar'",
    "productVisibility": "low" | "medium" | "high",
    "backgroundType": "what's behind — e.g. 'real lived-in home softly out of focus on far walls'",
    "lightingStyle": "light source — e.g. 'soft natural daylight' / 'morning window glow'",
    "visualTone": "MUST contain 'ecommerce' or 'ugc' or 'landing-page' or 'social-proof' — never cinematic/studio/fashion",
    "motionIntent": "subtle motion hint for video gen — e.g. 'slight handheld realism'",
    "overlayDensity": "none" | "low" | "medium" | "high",
    "ctaFocus": true | false,
    "speech": "1-2 lines copied from the script",
    "presetLabel": "the labelEn of the preset used as a base"
  },
  ... (repeat for ${p.numScenes} scenes)
]

Remember: Output ONLY the JSON array. Nothing else.`
}

// ── Parse + safety-clamp ─────────────────────────────────────────────────────

interface RawBlueprint {
  sceneId?: number
  sceneNumber?: number
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
}

function parseStoryboardResponse(raw: string): RawBlueprint[] {
  // Strip code-fence wrappers if any
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // Find the first [ and the last ] to be safe
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1)

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed as RawBlueprint[]
    throw new Error('not an array')
  } catch (err) {
    console.error('[parseStoryboardResponse] JSON parse failed. Raw response:', raw.slice(0, 400))
    throw new Error(`Gemini không trả về JSON hợp lệ: ${(err as Error).message}`)
  }
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
  return {
    sceneId: raw.sceneId ?? raw.sceneNumber ?? idx + 1,
    sceneNumber: raw.sceneId ?? raw.sceneNumber ?? idx + 1,
    sceneGoal: raw.sceneGoal ?? 'show product naturally',
    environment: raw.environment ?? 'home interior',
    composition: raw.composition ?? 'medium close-up',
    cameraAngle: raw.cameraAngle ?? 'iphone eye-level',
    shotType: raw.shotType ?? 'ugc handheld',
    pose: raw.pose ?? 'holding the product, looking at camera',
    emotion: raw.emotion ?? 'friendly confident',
    handUsage: raw.handUsage ?? 'one hand holding the product',
    productVisibility: clampVisibility(raw.productVisibility),
    backgroundType: raw.backgroundType ?? 'real lived-in home softly out of focus',
    lightingStyle: raw.lightingStyle ?? 'soft natural daylight',
    visualTone: clampVisualTone(raw.visualTone),
    motionIntent: raw.motionIntent ?? 'subtle handheld realism',
    overlayDensity: clampOverlay(raw.overlayDensity),
    ctaFocus: raw.ctaFocus === true,
    speech: raw.speech ?? '',
    presetLabel: raw.presetLabel,
  }
}

// ── Diversity validator ──────────────────────────────────────────────────────

export function validateDiversity(blueprints: SceneBlueprint[]): DiversityReport {
  const total = blueprints.length
  const notes: string[] = []

  const uniqueCompositions = new Set(blueprints.map((b) => b.composition.toLowerCase())).size
  const uniqueCameraAngles = new Set(blueprints.map((b) => b.cameraAngle.toLowerCase())).size
  const uniquePoses = new Set(blueprints.map((b) => b.pose.toLowerCase())).size
  const highVisibilityCount = blueprints.filter((b) => b.productVisibility === 'high').length

  // Diversity thresholds for 9 scenes: at least 4 unique compositions + 4 unique camera angles
  const minUnique = Math.max(3, Math.floor(total / 2))
  if (uniqueCompositions < minUnique) notes.push(`Quá ít composition khác nhau (${uniqueCompositions}/${total})`)
  if (uniqueCameraAngles < minUnique) notes.push(`Quá ít cameraAngle khác nhau (${uniqueCameraAngles}/${total})`)
  if (uniquePoses < minUnique) notes.push(`Quá ít pose khác nhau (${uniquePoses}/${total})`)

  // 70% must be high visibility
  const minHigh = Math.ceil(total * 0.7)
  if (highVisibilityCount < minHigh) notes.push(`Quá ít scene có productVisibility=high (${highVisibilityCount}/${total}, cần ≥${minHigh})`)

  // Check for back-to-back identical compositions
  for (let i = 1; i < blueprints.length; i++) {
    if (blueprints[i].composition.toLowerCase() === blueprints[i - 1].composition.toLowerCase()) {
      notes.push(`Scene #${i + 1} composition giống scene #${i} — không nên lặp liên tiếp`)
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

// ── Main service ─────────────────────────────────────────────────────────────

/**
 * Generate a structured storyboard (array of SceneBlueprints) from a script
 * via Gemini. NO long prompt text — only structured JSON. Diversity + safety
 * clamps applied in post-processing.
 */
export async function generateStoryboard(params: {
  geminiKey: string
  script: string
  identity: IdentityPack
  productName: string
  dna: VisualStyleDna
  numScenes?: number
  presetRotation?: string[]
}): Promise<{ blueprints: SceneBlueprint[]; diversity: DiversityReport }> {
  const numScenes = params.numScenes ?? 9
  const presetRotation = params.presetRotation ?? DEFAULT_PRESET_ROTATION.slice(0, numScenes)

  const prompt = buildStoryboardPrompt({
    script: params.script,
    identity: params.identity,
    productName: params.productName,
    dna: params.dna,
    presetRotation,
    numScenes,
  })

  const raw = await directGeminiVision({
    apiKey: params.geminiKey,
    parts: [{ text: prompt }],
    systemInstruction: STORYBOARD_SYSTEM,
    maxOutputTokens: 4096,
  })

  const rawBlueprints = parseStoryboardResponse(raw)
  let blueprints = rawBlueprints.map((rb, i) => normalizeBlueprint(rb, i))

  // Truncate or pad to exact numScenes
  if (blueprints.length > numScenes) blueprints = blueprints.slice(0, numScenes)

  // Ensure the last scene has ctaFocus=true if none does
  if (blueprints.length > 0 && !blueprints.some((b) => b.ctaFocus)) {
    blueprints[blueprints.length - 1].ctaFocus = true
  }

  const diversity = validateDiversity(blueprints)

  // Apply VISUAL_TONE_CLAMP suffix to ensure no scene smuggles in banned terms downstream
  blueprints = blueprints.map((b) => ({ ...b, visualTone: `${b.visualTone}. ${VISUAL_TONE_CLAMP}` }))

  return { blueprints, diversity }
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
