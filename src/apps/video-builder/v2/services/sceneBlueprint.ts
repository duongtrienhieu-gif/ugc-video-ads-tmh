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
import { safeParseJson, logJsonFailure } from './jsonResilience'

// ── Gemini storyboard prompt builder ─────────────────────────────────────────

// Strict JSON-only output rules — LLMs need EXPLICIT escape instructions
const STORYBOARD_SYSTEM = `You are a UGC ad storyboard director for ECOMMERCE / LANDING-PAGE / SOCIAL-PROOF / ADVERTORIAL imagery (NOT cinematic, NOT studio commercial).

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — ABSOLUTE RULES (violation = response rejected)
═══════════════════════════════════════════════════════════════
1. Return ONLY a raw JSON array. Nothing else.
2. NO markdown wrappers — do NOT prefix with \`\`\`json or any code fence.
3. NO prose before or after the array. NO explanation. NO comments.
4. Escape ALL inner quotes inside string values: \\" not "
5. NEVER use literal line breaks inside JSON string values — use \\n if you must.
6. Keep every string value SHORT (under 15 words) — no paragraphs.
7. Use ONLY straight double quotes ("), never curly quotes (" ").
8. Output must be valid compact JSON that JSON.parse() accepts in one shot.

If the output is not valid JSON, the response is considered failed.

═══════════════════════════════════════════════════════════════
CONTENT RULES
═══════════════════════════════════════════════════════════════
• All values in English (these feed the image-gen pipeline).
• visualTone must include one of: "ecommerce", "ugc", "landing-page", "social-proof", "advertorial". Never "cinematic", "movie", "fashion editorial", "studio commercial".
• Diversity: across 9 scenes vary composition + cameraAngle + pose. No back-to-back identical compositions.
• ≥70% of scenes (7+ of 9) must have productVisibility = "high".
• 'speech' for each scene = 1-2 short lines copied from the script, in order.
• Last 1-2 scenes have ctaFocus = true (CTA moment of the script).`

interface BlueprintPromptParams {
  script: string
  identity: IdentityPack
  productName: string
  dna: VisualStyleDna
  presetRotation: string[]
  numScenes: number
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

PRESET ROTATION (start from these, refine for script flow): ${presetHints}

OUTPUT — JSON array of exactly ${p.numScenes} objects with these keys (short string values, <15 words each):
[{"sceneId":1,"sceneGoal":"...","environment":"...","composition":"medium close-up","cameraAngle":"iphone eye-level","shotType":"ugc handheld","pose":"...","emotion":"friendly confident","handUsage":"...","productVisibility":"high","backgroundType":"...","lightingStyle":"soft natural daylight","visualTone":"warm ecommerce ugc","motionIntent":"subtle handheld","overlayDensity":"low","ctaFocus":false,"speech":"...","presetLabel":"..."}]

Return ONLY the JSON array. No markdown. No prose.`
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
  return result.data as RawBlueprint[]
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
 * via Gemini. Production-grade resilience:
 *   1. Strict JSON-only system prompt
 *   2. safeParseJson() with extract + repair layer
 *   3. Auto-retry ONCE on parse fail with "previous output was invalid JSON" prefix
 *   4. Friendly Vietnamese error if both attempts fail
 *   5. Debug logging of raw + extracted + repaired versions
 */
export async function generateStoryboard(params: {
  geminiKey: string
  script: string
  identity: IdentityPack
  productName: string
  dna: VisualStyleDna
  numScenes?: number
  presetRotation?: string[]
  /** Fires when a parse retry is happening — UI can show "AI format chưa đúng, đang retry..." */
  onParseRetry?: () => void
}): Promise<{ blueprints: SceneBlueprint[]; diversity: DiversityReport; recoveredFromRetry: boolean }> {
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

  // ── Attempt 1: normal call ──────────────────────────────────────────────
  let raw = await directGeminiVision({
    apiKey: params.geminiKey,
    parts: [{ text: prompt }],
    systemInstruction: STORYBOARD_SYSTEM,
    maxOutputTokens: 4096,
  })

  let rawBlueprints = parseStoryboardResponse(raw)
  let recoveredFromRetry = false

  // ── Attempt 2: auto-retry once with stricter "you just failed" prefix ──
  if (!rawBlueprints) {
    console.warn('[generateStoryboard] attempt 1 parse failed — auto-retrying with stricter prompt')
    params.onParseRetry?.()

    const retryPrompt = `Your previous output was NOT valid JSON. The response failed JSON.parse().

Return STRICT VALID JSON ONLY this time:
- No markdown wrappers (no \`\`\`json)
- No prose before or after
- Escape all inner quotes with \\"
- No literal newlines inside string values
- Compact JSON only

Original task:
${prompt}`

    raw = await directGeminiVision({
      apiKey: params.geminiKey,
      parts: [{ text: retryPrompt }],
      systemInstruction: STORYBOARD_SYSTEM,
      maxOutputTokens: 4096,
    })
    rawBlueprints = parseStoryboardResponse(raw)
    if (rawBlueprints) recoveredFromRetry = true
  }

  // ── Both attempts failed — throw a Vietnamese-friendly error ───────────
  if (!rawBlueprints) {
    throw new Error('AI không trả về JSON hợp lệ sau 2 lần thử. Vui lòng thử lại — mở DevTools Console để xem chi tiết debug.')
  }

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

  return { blueprints, diversity, recoveredFromRetry }
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
