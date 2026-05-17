// ── Render Payload Compiler ──────────────────────────────────────────────────
// Z19 — Critical architectural correction.
//
// The editorial brain (Z11-Z17) accumulates rich metadata: visualMotif,
// cameraGrammar, cinematicIntent, motion blueprints, visualRole, transition
// graph, energyScore, etc. That richness is USEFUL internally but TOXIC
// when injected into the image-model prompt — KIE/GPT-4o chokes on
// 1500-2000+ char prompts, leading to 60s+ stalls and timeout loops.
//
// This compiler sits BETWEEN compilePrompt() (rich internal representation)
// and the actual KIE call. It produces a LIGHTWEIGHT render payload:
//
//   • Strict per-mode char budget (FAST_SAFE 600 / BALANCED 850 /
//     CINEMATIC_HEAVY 1200)
//   • Per-model adjustment factor (gpt4o 1.0 / flux 1.3 / kling 1.2)
//   • Priority-order trimming when over budget
//   • Diagnostic [RENDER_PAYLOAD] log on every call
//
// Editorial fields that NEVER make it to the prompt:
//   energyScore · continuityGroup · transitionGraph · semantic similarity ·
//   visualRole · timeline metadata · pacing metadata · editorial diagnostics
//
// Editorial fields that DO survive (in cinematic-heavy mode only):
//   motif anchor · camera grammar anchor · motion intent phrase
//
// FAST_SAFE strips ALL cinematic extras. Just:
//   identity lock · product lock · core composition · realism cue · minimal negative
// ─────────────────────────────────────────────────────────────────────────────

import { compileMasterFramePrompt, compileScenePrompt } from './promptCompiler'
import type { CompiledPrompt, CompiledPromptContext, SceneBlueprint } from '../types'

// ── Public types ────────────────────────────────────────────────────────────

export type RenderMode = 'FAST_SAFE' | 'BALANCED' | 'CINEMATIC_HEAVY'
export type RenderTargetModel = 'gpt4o' | 'flux' | 'kling'

export interface RenderPayload {
  /** The full prompt string ready to send to the image model. Negative
   *  is appended as an "Avoid: ..." paragraph at the end. */
  prompt: string
  /** How many chars of `prompt` are in the trailing "Avoid:" section.
   *  Informational only. */
  negativeChars: number
  /** Total chars in `prompt`. */
  chars: number
  /** 0-1 complexity score for diagnostics. */
  complexity: number
  /** Mode used to compile. */
  mode: RenderMode
  /** Target model. */
  model: RenderTargetModel
  /** Was the prompt auto-trimmed because it exceeded the budget? */
  trimmed: boolean
  /** Which refs to pass as filesUrl[] — same shape as CompiledPrompt's. */
  filesUrlOrder: CompiledPrompt['filesUrlOrder']
}

export interface CompileOptions {
  /** Render mode. Defaults to BALANCED. */
  mode?: RenderMode
  /** Target image model. Defaults to gpt4o (KIE GPT-Image-1). */
  targetModel?: RenderTargetModel
}

// ── Hard char budgets per mode ──────────────────────────────────────────────
// Combined budget (prompt + negative). Per-model factor applied on top.

const MODE_BUDGETS: Record<RenderMode, { prompt: number; negative: number }> = {
  'FAST_SAFE':       { prompt: 600,  negative: 100 },
  'BALANCED':        { prompt: 850,  negative: 200 },
  'CINEMATIC_HEAVY': { prompt: 1200, negative: 300 },
}

// ── Per-model verbosity factor ──────────────────────────────────────────────
// GPT-4o (default at KIE) is sensitive to long prompts → factor 1.0 (baseline)
// Flux tolerates richer environment descriptors → 1.3
// Kling image handles stronger composition cues → 1.2

const MODEL_FACTOR: Record<RenderTargetModel, number> = {
  'gpt4o': 1.0,
  'flux':  1.3,
  'kling': 1.2,
}

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINTS
// ────────────────────────────────────────────────────────────────────────────

/** Build a render payload for a Master Frame (no scene blueprint). */
export function compileMasterFrameRenderPayload(
  ctx: Omit<CompiledPromptContext, 'scene' | 'masterFrameUrl'>,
  opts: CompileOptions = {},
): RenderPayload {
  const mode = opts.mode ?? 'BALANCED'
  const targetModel = opts.targetModel ?? 'gpt4o'
  const internal = compileMasterFramePrompt(ctx)
  return assemblePayload(internal, mode, targetModel, /* isMasterFrame */ true)
}

/** Build a render payload for a derived scene (img2img from master frame). */
export function compileSceneRenderPayload(
  ctx: Omit<CompiledPromptContext, 'scene' | 'masterFrameUrl'>,
  scene: SceneBlueprint,
  masterFrameUrl: string,
  opts: CompileOptions = {},
): RenderPayload {
  const mode = opts.mode ?? 'BALANCED'
  const targetModel = opts.targetModel ?? 'gpt4o'
  const internal = compileScenePrompt(ctx, scene, masterFrameUrl)
  return assemblePayload(internal, mode, targetModel, /* isMasterFrame */ false)
}

// ────────────────────────────────────────────────────────────────────────────
// INTERNAL: assembly + trim per mode
// ────────────────────────────────────────────────────────────────────────────

function assemblePayload(
  internal: CompiledPrompt,
  mode: RenderMode,
  targetModel: RenderTargetModel,
  isMasterFrame: boolean,
): RenderPayload {
  // 1. Build the per-mode prompt
  let combined = composeForMode(internal, mode)

  // 2. Compute per-model budget cap (combined prompt + negative)
  const budget = MODE_BUDGETS[mode]
  const factor = MODEL_FACTOR[targetModel]
  const maxTotal = Math.floor((budget.prompt + budget.negative) * factor)

  // 3. Trim if over budget — priority removal order
  let trimmed = false
  if (combined.length > maxTotal) {
    combined = trimToBudget(combined, maxTotal)
    trimmed = true
  }

  // 4. Compute diagnostics
  const avoidMatch = combined.match(/(?:^|\n)Avoid:[\s\S]+$/i)
  const negativeChars = avoidMatch ? avoidMatch[0].length : 0
  const chars = combined.length
  const complexity = computeComplexity(combined)

  const payload: RenderPayload = {
    prompt: combined,
    negativeChars,
    chars,
    complexity,
    mode,
    model: targetModel,
    trimmed,
    filesUrlOrder: internal.filesUrlOrder,
  }

  console.log(
    `[RENDER_PAYLOAD] model=${targetModel} chars=${chars} negative=${negativeChars} ` +
    `mode=${mode} complexity=${complexity.toFixed(2)} trimmed=${trimmed} ` +
    `${isMasterFrame ? 'masterFrame' : 'scene'} budget=${maxTotal}`,
  )

  return payload
}

/** Compose the rendered prompt based on the mode + internal rich representation. */
function composeForMode(internal: CompiledPrompt, mode: RenderMode): string {
  const paragraphs: string[] = []

  // Locks are ALWAYS included — identity is critical for KIE img-edit.
  if (internal.identityLock) paragraphs.push(internal.identityLock)
  if (internal.productLock)  paragraphs.push(internal.productLock)

  // Scene delta — stripped per mode
  paragraphs.push(stripSceneByMode(internal.sceneBlueprint, mode))

  // Visual DNA — realism anchor. Compact in FAST_SAFE.
  if (mode === 'FAST_SAFE') {
    paragraphs.push('Authentic UGC iPhone photo, real lived-in interior, NOT cinematic, NOT studio.')
  } else {
    paragraphs.push(internal.visualDna)
  }

  // Negative — different intensity per mode
  if (mode === 'FAST_SAFE') {
    paragraphs.push('Avoid: wrong face, redesigned packaging, distorted hands, text overlay, cartoon, 3D-render look.')
  } else {
    paragraphs.push(internal.negativePrompt)
  }

  return paragraphs.join('\n\n')
}

/** Strip cinematic / retry extras from the scene-delta paragraph per mode. */
function stripSceneByMode(sceneDelta: string, mode: RenderMode): string {
  if (mode === 'CINEMATIC_HEAVY') return sceneDelta  // keep everything

  if (mode === 'BALANCED') {
    // Keep motif + camera grammar (useful cinematic cues), but strip retry bumps
    return sceneDelta
      .replace(/\s*Retry:\s*[^.]+\.\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // FAST_SAFE — strip ALL editorial / cinematic extras
  return sceneDelta
    .replace(/\s*Motif:\s*[^.]+\.\s*/g, ' ')           // strip motif anchor
    .replace(/\s*Camera:\s*[^.]+\.\s*/g, ' ')          // strip camera grammar anchor
    .replace(/\s*Retry:\s*[^.]+\.\s*/g, ' ')           // strip retry bumps
    .replace(/\s*Preserve every label letter\./g, ' ') // strip label-lock bump
    .replace(/\s*Outfit \+ environment vary per scene\.?\s*/g, ' ')  // unused for render
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Priority-order budget trim.
 *
 * REMOVAL ORDER (most-stripped first):
 *   1. Cinematic extras (Motif: ... · Camera: ...)
 *   2. Decorative adjectives (NOT cinematic · NOT studio · NOT editorial)
 *   3. Editorial overlays (retry bumps)
 *   4. Duplicate descriptors
 *
 * PRESERVED (per spec):
 *   • Identity lock
 *   • Product lock
 *   • Core composition
 *   • Realism cue
 */
function trimToBudget(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt

  let out = prompt
    // 1. Cinematic extras
    .replace(/\s*Motif:\s*[^.]+\./gi, '')
    .replace(/\s*Camera:\s*[^.]+\./gi, '')
    // 2. Decorative adjectives
    .replace(/\s*·\s*NOT cinematic\s*/gi, ' ')
    .replace(/\s*·\s*NOT studio\s*/gi, ' ')
    .replace(/\s*·\s*NOT editorial\.?/gi, '')
    // 3. Editorial overlays (retry bumps)
    .replace(/\s*Retry:\s*[^.]+\./gi, '')
    .replace(/\s*Preserve every label letter\./gi, '')
    // 4. Duplicate descriptors
    .replace(/Outfit \+ environment vary per scene\.\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Hard truncate if still over budget
  if (out.length > maxChars) {
    out = out.slice(0, maxChars - 3).trimEnd() + '...'
  }
  return out
}

/** Rough 0-1 complexity score — drives the diagnostic log. */
function computeComplexity(prompt: string): number {
  const cinematicMarkers = (prompt.match(/\b(cinematic|motif|grammar|parallax|kinetic|emotional_zoom|push_zoom|orbit|drift)\b/gi)?.length ?? 0)
  const avoidMarkers = (prompt.match(/\bAvoid:/gi)?.length ?? 0)
  const score =
    (prompt.length / 1500) * 0.6 +
    (cinematicMarkers / 8) * 0.25 +
    (avoidMarkers * 0.15)
  return Math.min(1, Math.max(0, score))
}

// ── Mode escalation helper for retry pipelines ──────────────────────────────
/**
 * Pick the mode for a given retry attempt. Spec P5:
 *   Attempt 1 → BALANCED
 *   Attempt 2 → FAST_SAFE (strip cinematic, shorter prompt)
 *   Attempt 3+ → FAST_SAFE (already minimal)
 *
 * Caller can override by passing their own mode. This helper is the
 * default for both Master Frame and scene-gen retry loops.
 */
export function modeForAttempt(attempt: number): RenderMode {
  if (attempt <= 1) return 'BALANCED'
  return 'FAST_SAFE'
}
