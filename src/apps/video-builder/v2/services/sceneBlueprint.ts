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
• 'speech' for each scene = 1-2 short lines copied from the script, in order.

═══════════════════════════════════════════════════════════════
DIVERSITY RULES (HARD CONSTRAINTS — failure = poor ad)
═══════════════════════════════════════════════════════════════
Across the 9 scenes, you MUST diversify on these axes:

1. COMPOSITION — use AT LEAST 5 different values from:
   close-up · tight close-up · medium close-up · medium shot · wide-medium ·
   over-the-shoulder · tabletop flatlay · split-frame before-after
   NEVER repeat the same composition back-to-back.

2. CAMERA ANGLE — use AT LEAST 4 different values from:
   iphone eye-level · iphone slight low-angle · iphone slight high-angle ·
   iphone selfie eye-level · iphone overhead · iphone slight side-angle ·
   iphone waist-level

3. SHOT TYPE — mix at least 3 from:
   ugc handheld · selfie arm-extended · static tripod · phone-on-shelf POV ·
   phone-on-tripod static · selfie POV intimate

4. POSE / POSTURE — vary across:
   sitting · standing · walking · leaning · close-to-mirror · at-desk ·
   in-bed · at-kitchen-counter
   At least 3 different postures across 9 scenes.

5. ENVIRONMENT — use AT LEAST 4 different settings:
   home kitchen · bathroom · bedroom · home office desk · cafe ·
   living room · bedside · home counter
   NEVER use the same environment 3 times in a row.

6. EMOTIONAL STATE — vary:
   tired/concerned · curious/surprised · confident/explaining ·
   relieved/glowing · warm/trusting · excited/energetic · contemplative
   Track the SCRIPT'S emotional arc — early scenes can be lower energy
   (pain/curiosity), later scenes higher energy (proof/CTA).

7. PRODUCT DISTANCE — vary how far the product is from the lens:
   far (on table 2m) · medium (held at chest) · close (right at lens) · using

═══════════════════════════════════════════════════════════════
PRODUCT VISIBILITY LOGIC (smart per-role rules)
═══════════════════════════════════════════════════════════════
Apply these rules when picking each scene's productVisibility:

• HOOK scene (scene 1-2): "medium" OK — focus on pain/expression, product
  introduces gently. Even "low" is acceptable if hook is pure emotion.
• TRUST / CREDIBILITY scenes (mom rec, doctor explanation): "high" required
  with label clearly visible and readable.
• INGREDIENT explanation scenes: "high" + label/branding front-facing so
  ingredient names on the package are readable.
• REVIEW / DEMO scenes: "high" with packaging front-facing toward camera.
• PROOF / RESULT scenes (before-after): "medium" or "high" — product can
  be subtle here since the proof IS the result, not the package.
• CTA scene (last 1-2): MUST be "high" — product clearly hero in frame,
  no obstruction, label readable for the final purchase moment.

REQUIREMENT: ≥70% of scenes (7 of 9) must have productVisibility = "high".`

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
sceneId, sceneGoal, environment, composition, cameraAngle, shotType, pose, emotion, handUsage, productVisibility, backgroundType, lightingStyle, visualTone, motionIntent, overlayDensity, ctaFocus, speech, presetLabel

productVisibility must be "low" or "medium" or "high".
overlayDensity must be "none" or "low" or "medium" or "high".
ctaFocus must be true or false.

Avatar: ${p.identity.avatarDescription.slice(0, 200).replace(/["']/g, '')}
Product: ${p.productName.replace(/["']/g, '')} - ${p.identity.productDescription.slice(0, 150).replace(/["']/g, '')}

Script (extract speech lines from this):
${p.script.slice(0, 1500).replace(/["']/g, '')}

Example single object: {"sceneId":1,"sceneGoal":"hook","environment":"home kitchen","composition":"medium close up","cameraAngle":"iphone eye level","shotType":"ugc handheld","pose":"holding product","emotion":"curious","handUsage":"one hand","productVisibility":"high","backgroundType":"home","lightingStyle":"daylight","visualTone":"warm ecommerce ugc","motionIntent":"handheld","overlayDensity":"low","ctaFocus":false,"speech":"line from script","presetLabel":"product showcase"}

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
  const required: Array<keyof RawBlueprint> = [
    'sceneGoal', 'cameraAngle', 'composition', 'emotion', 'environment', 'productVisibility',
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
    if (!['low', 'medium', 'high', 'hero', 'mid', 'med'].includes(vis)) {
      return { sceneIndex: i, field: 'productVisibility', reason: `value '${bp.productVisibility}' không hợp lệ (cần low/medium/high)` }
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

/**
 * Diversity validator — now tracks 6 axes (was 4). Per Task 3 optimization spec.
 * Returns notes in Vietnamese for the UI.
 */
export function validateDiversity(blueprints: SceneBlueprint[]): DiversityReport {
  const total = blueprints.length
  const notes: string[] = []

  // Axis: composition / cameraAngle / pose / shotType / environment / handUsage
  const norm = (s: string) => s.toLowerCase().trim()
  const uniqueCompositions = new Set(blueprints.map((b) => norm(b.composition))).size
  const uniqueCameraAngles = new Set(blueprints.map((b) => norm(b.cameraAngle))).size
  const uniquePoses        = new Set(blueprints.map((b) => norm(b.pose))).size
  const uniqueShotTypes    = new Set(blueprints.map((b) => norm(b.shotType))).size
  const uniqueEnvironments = new Set(blueprints.map((b) => norm(b.environment))).size
  const uniqueHandUsages   = new Set(blueprints.map((b) => norm(b.handUsage))).size
  const highVisibilityCount = blueprints.filter((b) => b.productVisibility === 'high').length

  // 9-scene thresholds — stricter than v1 to push real diversity
  const minComposition  = Math.max(5, Math.floor(total * 0.55))  // ≥55% unique
  const minCameraAngle  = Math.max(4, Math.floor(total * 0.45))  // ≥45%
  const minPose         = Math.max(5, Math.floor(total * 0.55))
  const minShotType     = Math.max(3, Math.floor(total * 0.33))
  const minEnvironment  = Math.max(4, Math.floor(total * 0.45))
  const minHandUsage    = Math.max(4, Math.floor(total * 0.45))

  if (uniqueCompositions < minComposition) notes.push(`Composition đa dạng yếu (${uniqueCompositions}/${total}, cần ≥${minComposition})`)
  if (uniqueCameraAngles < minCameraAngle) notes.push(`Góc máy đa dạng yếu (${uniqueCameraAngles}/${total}, cần ≥${minCameraAngle})`)
  if (uniquePoses < minPose) notes.push(`Pose đa dạng yếu (${uniquePoses}/${total}, cần ≥${minPose})`)
  if (uniqueShotTypes < minShotType) notes.push(`Shot type đa dạng yếu (${uniqueShotTypes}/${total}, cần ≥${minShotType})`)
  if (uniqueEnvironments < minEnvironment) notes.push(`Môi trường đa dạng yếu (${uniqueEnvironments}/${total}, cần ≥${minEnvironment})`)
  if (uniqueHandUsages < minHandUsage) notes.push(`Cách cầm sản phẩm đa dạng yếu (${uniqueHandUsages}/${total}, cần ≥${minHandUsage})`)

  // 70% must be high visibility
  const minHigh = Math.ceil(total * 0.7)
  if (highVisibilityCount < minHigh) notes.push(`Quá ít scene có productVisibility=high (${highVisibilityCount}/${total}, cần ≥${minHigh})`)

  // Check for back-to-back identical compositions OR environments
  for (let i = 1; i < blueprints.length; i++) {
    if (norm(blueprints[i].composition) === norm(blueprints[i - 1].composition)) {
      notes.push(`Scene #${i + 1} composition giống scene #${i} — không nên lặp liên tiếp`)
    }
    if (norm(blueprints[i].environment) === norm(blueprints[i - 1].environment) && i >= 2 && norm(blueprints[i - 2].environment) === norm(blueprints[i].environment)) {
      notes.push(`Scene #${i - 1}, #${i}, #${i + 1} cùng môi trường — quá monotone`)
    }
  }

  // Last scene MUST be CTA visibility (high)
  if (total > 0) {
    const lastIsCTA = blueprints[total - 1].ctaFocus
    const lastIsHighVis = blueprints[total - 1].productVisibility === 'high'
    if (lastIsCTA && !lastIsHighVis) {
      notes.push(`Scene CTA cuối (${total}) phải có productVisibility=high — đang là ${blueprints[total - 1].productVisibility}`)
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

  let rawBlueprints: RawBlueprint[] | null = null
  let recoveredAtStage: StoryboardGenStage = 'attempt-1'

  // ── Tier 1: Normal call ─────────────────────────────────────────────────
  params.onStageChange?.('attempt-1')
  const normalPrompt = buildStoryboardPrompt(promptParams)
  let raw = await directGeminiVision({
    apiKey: params.geminiKey,
    parts: [{ text: normalPrompt }],
    systemInstruction: STORYBOARD_SYSTEM,
    maxOutputTokens: 4096,
  })
  rawBlueprints = parseStoryboardResponse(raw)

  // ── Tier 1.5: schema validation on tier-1 success ──────────────────────
  if (rawBlueprints) {
    const schemaErr = validateBlueprintSchema(rawBlueprints, numScenes)
    if (schemaErr) {
      console.warn(`[generateStoryboard] tier 1 parsed but schema failed: scene ${schemaErr.sceneIndex} field '${schemaErr.field}' (${schemaErr.reason})`)
      rawBlueprints = null  // force retry
    }
  }

  // ── Tier 2: Reprompt with "Previous failed" prefix ──────────────────────
  if (!rawBlueprints) {
    console.warn('[generateStoryboard] tier 1 failed — auto-retry with stricter prompt')
    recoveredAtStage = 'reprompt-2'
    params.onStageChange?.('reprompt-2', 'parse/schema fail on attempt 1')

    const retryPrompt = `Your previous output was NOT valid JSON or missing required fields. The response failed validation.

Return STRICT VALID JSON ONLY this time:
- No markdown wrappers (no \`\`\`json)
- No prose before or after
- Escape all inner quotes with \\"
- No literal newlines inside string values
- Compact JSON only
- Every scene MUST include: sceneId, sceneGoal, environment, composition, cameraAngle, shotType, pose, emotion, handUsage, productVisibility, backgroundType, lightingStyle, visualTone, motionIntent, overlayDensity, ctaFocus, speech, presetLabel
- productVisibility must be exactly one of: "low" | "medium" | "high"

Original task:
${normalPrompt}`

    raw = await directGeminiVision({
      apiKey: params.geminiKey,
      parts: [{ text: retryPrompt }],
      systemInstruction: STORYBOARD_SYSTEM,
      maxOutputTokens: 4096,
    })
    rawBlueprints = parseStoryboardResponse(raw)
    if (rawBlueprints) {
      const schemaErr = validateBlueprintSchema(rawBlueprints, numScenes)
      if (schemaErr) {
        console.warn(`[generateStoryboard] tier 2 parsed but schema failed: ${JSON.stringify(schemaErr)}`)
        rawBlueprints = null
      }
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
      maxOutputTokens: 4096,
    })
    rawBlueprints = parseStoryboardResponse(raw)
    if (rawBlueprints) {
      const schemaErr = validateBlueprintSchema(rawBlueprints, numScenes)
      if (schemaErr) {
        console.error(`[generateStoryboard] SAFE-MODE also failed schema: ${JSON.stringify(schemaErr)}`)
        rawBlueprints = null
      }
    }
  }

  // ── All 3 tiers failed — give up with VN-friendly error ────────────────
  if (!rawBlueprints) {
    throw new Error('AI không trả về JSON hợp lệ sau 3 lần thử (normal → reprompt → safe-mode). Vui lòng thử lại — mở DevTools Console để xem chi tiết debug.')
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

  return { blueprints, diversity, recoveredAtStage }
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
