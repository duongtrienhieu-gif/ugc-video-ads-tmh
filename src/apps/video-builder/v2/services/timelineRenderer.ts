// ── Timeline Renderer ────────────────────────────────────────────────────────
// Z22 — Cut-level video rendering.
//
// Consumes an EditorialBlueprint (which already has timelineCuts +
// coverageShots + motionBlueprints + transitionGraph) and a map of
// rendered master keyframe asset refs. Produces one Kling clip per
// TimelineCut — NOT per master scene.
//
// For a 60s ad: 8 masters → ~30 timeline cuts → ~30 Kling clips with
// VARIED motion / pacing / duration. Same source image per cut group
// (parent master's keyframe), but Kling animates each with a different
// motion verb so the final feels edited, not slideshow.
//
// Architectural separation:
//   • EditorialBlueprint = WHAT to render (cuts + motion + pacing)
//   • timelineRenderer  = COMPILE Kling-safe payload per cut
//   • Kling API call    = produce the actual clip
//
// The runner (timelineRendererJobRunner.ts) wires these together with a
// worker pool. THIS file is pure logic — no API calls.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  EditorialBlueprint, TimelineCut, CoverageShot, SceneBlueprint,
  TimelineRenderItem, TimelineRenderJob, KlingSafeMotion,
} from '../types'
import {
  normalizeKlingMotion, klingMotionPhrase, ensureSafeMotion,
} from './klingMotionNormalizer'

// ═════════════════════════════════════════════════════════════════════════
// 1. Kling payload sanitization
// ═════════════════════════════════════════════════════════════════════════
//
// Kling 3.0 std rejects:
//   • Multi-paragraph prompts (newlines inside the string)
//   • Prompts >1500 chars
//   • Invalid duration (must be 5 or 10)
//   • Invalid aspect ratio
//   • Empty / null fields
//
// Sanitizer ENFORCES these rules at payload-build time so the API never
// sees garbage.

const MAX_PROMPT_CHARS = 800   // safe for Kling — short single-line works best
const MAX_NEGATIVE_CHARS = 200
const VALID_DURATIONS = new Set([5, 10])
const VALID_ASPECT_RATIOS = new Set(['9:16', '16:9', '1:1'])

function flattenAndTrim(text: string, maxChars: number): string {
  let s = (text ?? '').toString().trim()
  // Flatten newlines + collapse whitespace — Kling reads single-line best
  s = s.replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim()
  if (s.length > maxChars) s = s.slice(0, maxChars - 3).trimEnd() + '...'
  return s
}

function validDuration(d: number | undefined): number {
  if (typeof d !== 'number' || !VALID_DURATIONS.has(d)) {
    // Round to closest legal value
    if (typeof d === 'number' && d >= 7.5) return 10
    return 5
  }
  return d
}

function validAspect(a: string | undefined): string {
  if (typeof a === 'string' && VALID_ASPECT_RATIOS.has(a)) return a
  return '9:16'  // vertical default for FB Reels / TikTok / IG Reels
}

// ═════════════════════════════════════════════════════════════════════════
// 2. Per-cut prompt compilation
// ═════════════════════════════════════════════════════════════════════════
//
// Each cut needs a SHORT single-line prompt that tells Kling:
//   1. What to animate (motion verb)
//   2. The subject's mood (from blueprint emotion)
//   3. The narrative beat (sceneType / coverageRole) — 1-2 words only
//
// We do NOT inject editorial metadata, motion blueprints, transition graph,
// continuity groups, energy scores, etc. Those stay internal.

export function compileCutPrompt(
  _cut: TimelineCut,  // reserved for future editorial enrichment
  coverageShot: CoverageShot,
  masterBlueprint: SceneBlueprint | undefined,
  klingMotion: KlingSafeMotion,
): string {
  const motion = klingMotionPhrase(klingMotion)
  const emotion = (masterBlueprint?.emotion ?? 'natural').trim()
  // Use coverage shot description as the WHAT (already short — 5-8 words)
  const beat = (coverageShot.shotDescription ?? '').replace(/[\n\r]+/g, ' ').trim()

  // Single-line prompt. Kling-friendly: motion verb first, then emotion,
  // then beat. Style clause kept short.
  const raw =
    `Animate the input image: ${motion}. ` +
    `Subject emotion: ${emotion}. ` +
    (beat ? `Visual: ${beat}. ` : '') +
    `Style: authentic UGC phone-camera realism, natural micro-motion, identical face / outfit / product / environment as input image — only animate motion. 24fps, no slow motion.`

  return flattenAndTrim(raw, MAX_PROMPT_CHARS)
}

export function compileCutNegativePrompt(): string {
  // Same negative for all cuts — Kling-safe shortlist
  const raw = 'cinematic camera moves, dramatic zoom, synthetic motion, face changes, outfit changes, environment changes, text overlays, watermarks, cartoon, slow motion'
  return flattenAndTrim(raw, MAX_NEGATIVE_CHARS)
}

// ═════════════════════════════════════════════════════════════════════════
// 3. Resolve coverage shot from cut
// ═════════════════════════════════════════════════════════════════════════

export function resolveCoverageShot(
  cut: TimelineCut,
  allShots: CoverageShot[],
): CoverageShot | null {
  return allShots.find((s) => s.shotId === cut.coverageShotId) ?? null
}

// ═════════════════════════════════════════════════════════════════════════
// 4. Build a TimelineRenderItem from a TimelineCut
// ═════════════════════════════════════════════════════════════════════════
//
// Pulls the parent master keyframe ref from the lookup map, resolves the
// coverage shot, normalizes the motion, compiles the prompt, returns a
// ready-to-render TimelineRenderItem.

export interface BuildRenderItemContext {
  /** Map masterSceneId → keyframe asset ref (e.g. 'asset://xyz') */
  masterKeyframeRefs: Record<number, string>
  /** All coverage shots from the EditorialBlueprint */
  coverageShots: CoverageShot[]
  /** All master scenes (for emotion + identity reads in the prompt) */
  masterScenes: SceneBlueprint[]
}

export function buildRenderItemFromCut(
  cut: TimelineCut,
  ctx: BuildRenderItemContext,
): TimelineRenderItem | null {
  const coverageShot = resolveCoverageShot(cut, ctx.coverageShots)
  if (!coverageShot) {
    console.warn(`[TIMELINE_RENDER] cut-${cut.cutId} has unresolvable coverageShotId=${cut.coverageShotId} — skipping`)
    return null
  }

  const masterKeyframeRef = ctx.masterKeyframeRefs[cut.masterSceneId]
  if (!masterKeyframeRef) {
    console.warn(`[TIMELINE_RENDER] cut-${cut.cutId} has no master keyframe (masterSceneId=${cut.masterSceneId}) — skipping`)
    return null
  }

  const masterBlueprint = ctx.masterScenes.find((s) => s.sceneId === cut.masterSceneId)

  // Pick the Kling-safe motion from coverage + master motion + cut transition
  const klingMotionRaw = normalizeKlingMotion({
    motion: coverageShot.motion,
    cameraGrammar: coverageShot.cameraGrammar ?? masterBlueprint?.cameraGrammar,
    transition: cut.transition,
    visualRole: cut.visualRole,
  })
  const klingMotion = ensureSafeMotion(klingMotionRaw)

  const prompt = compileCutPrompt(cut, coverageShot, masterBlueprint, klingMotion)
  const negativePrompt = compileCutNegativePrompt()

  return {
    cutId: cut.cutId,
    coverageShotId: cut.coverageShotId,
    masterSceneId: cut.masterSceneId,
    startSec: cut.startSec,
    endSec: cut.endSec,
    durationSec: cut.durationSec,
    parentKeyframeRef: masterKeyframeRef,
    prompt,
    negativePrompt,
    klingMotion,
    visualRole: cut.visualRole,
    phase: cut.phase,
    cutType: cut.cutType,
    status: 'pending',
    retryCount: 0,
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 5. Build the full TimelineRenderJob
// ═════════════════════════════════════════════════════════════════════════
//
// Top-level entry. Iterates EditorialBlueprint.timelineCuts and builds a
// TimelineRenderJob with one TimelineRenderItem per cut.

export interface BuildJobOptions {
  /** Map masterSceneId → keyframe asset ref */
  masterKeyframeRefs: Record<number, string>
  /** Provider label for cost preview UI */
  providerLabel?: string
  /** Credits per Kling clip (5s std typically ~70) */
  creditPerClip?: number
}

export function buildTimelineRenderJob(
  blueprint: EditorialBlueprint,
  options: BuildJobOptions,
): TimelineRenderJob {
  const ctx: BuildRenderItemContext = {
    masterKeyframeRefs: options.masterKeyframeRefs,
    coverageShots: blueprint.coverageShots,
    masterScenes: blueprint.masterScenes,
  }

  const items: TimelineRenderItem[] = []
  for (const cut of blueprint.timelineCuts) {
    const item = buildRenderItemFromCut(cut, ctx)
    if (item) items.push(item)
  }

  const estimatedDurationSec = items.reduce((sum, it) => sum + it.durationSec, 0)

  console.log(
    `[TIMELINE_RENDER BUILD] ${items.length} cuts → ${estimatedDurationSec.toFixed(1)}s total ` +
    `(masters=${Object.keys(options.masterKeyframeRefs).length}, ` +
    `coverage=${blueprint.coverageShots.length})`,
  )

  return {
    id: `tlr-${Date.now()}`,
    masterKeyframeRefs: options.masterKeyframeRefs,
    items,
    isRunning: false,
    isPaused: false,
    providerLabel: options.providerLabel ?? 'Kling 3.0 std / KIE (cut-level)',
    creditPerClip: options.creditPerClip ?? 70,
    estimatedDurationSec,
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 6. Kling submission payload (sanitized + validated)
// ═════════════════════════════════════════════════════════════════════════
//
// Builds the EXACT input object that goes to the KIE Kling endpoint.
// Strips undefined / null, validates duration, validates aspect, flattens
// prompts.

export interface KlingSubmitPayload {
  jobModelId: 'kling-3.0/video'
  prompt: string
  negativePrompt: string
  aspectRatio: '9:16' | '16:9' | '1:1'
  duration: 5 | 10
  imageUrl: string
  motion: KlingSafeMotion
}

export function buildKlingPayloadForCut(
  item: TimelineRenderItem,
  resolvedImageUrl: string,
): KlingSubmitPayload {
  const aspect = validAspect('9:16') as KlingSubmitPayload['aspectRatio']
  // Kling supports 5s and 10s std clips. Editorial cuts may be 0.8-3.2s
  // (way shorter than Kling minimum). We render at the legal duration and
  // the final compositor trims to the cut's editorial duration.
  const duration = validDuration(item.durationSec >= 7.5 ? 10 : 5) as KlingSubmitPayload['duration']
  return {
    jobModelId: 'kling-3.0/video',
    prompt: flattenAndTrim(item.prompt, MAX_PROMPT_CHARS),
    negativePrompt: flattenAndTrim(item.negativePrompt, MAX_NEGATIVE_CHARS),
    aspectRatio: aspect,
    duration,
    imageUrl: resolvedImageUrl,
    motion: item.klingMotion,
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 7. Validate before submit
// ═════════════════════════════════════════════════════════════════════════

export interface PayloadValidationError {
  field: string
  reason: string
}

export function validateKlingPayload(payload: KlingSubmitPayload): PayloadValidationError | null {
  if (!payload.prompt || payload.prompt.length < 10) {
    return { field: 'prompt', reason: `prompt quá ngắn (${payload.prompt?.length ?? 0} chars)` }
  }
  if (payload.prompt.length > MAX_PROMPT_CHARS) {
    return { field: 'prompt', reason: `prompt > ${MAX_PROMPT_CHARS} chars` }
  }
  if (!payload.imageUrl || !payload.imageUrl.startsWith('http')) {
    return { field: 'imageUrl', reason: `imageUrl không phải URL hợp lệ: ${payload.imageUrl?.slice(0, 50) ?? 'null'}` }
  }
  if (!VALID_DURATIONS.has(payload.duration)) {
    return { field: 'duration', reason: `duration phải là 5 hoặc 10, nhận: ${payload.duration}` }
  }
  if (!VALID_ASPECT_RATIOS.has(payload.aspectRatio)) {
    return { field: 'aspectRatio', reason: `aspectRatio không hợp lệ: ${payload.aspectRatio}` }
  }
  return null
}

// ═════════════════════════════════════════════════════════════════════════
// 8. Minimal fallback — for 422 retry
// ═════════════════════════════════════════════════════════════════════════
//
// If the full sanitized payload still fails with 422, strip everything
// down to the bare minimum: motion verb + emotion + image. No style
// clauses, no negative, no beat description.

export function buildMinimalFallbackPayload(
  item: TimelineRenderItem,
  resolvedImageUrl: string,
): KlingSubmitPayload {
  return {
    jobModelId: 'kling-3.0/video',
    prompt: flattenAndTrim(
      `Animate the input image: ${klingMotionPhrase(item.klingMotion)}. Subject is natural and calm. Identical face and product as input image.`,
      300,
    ),
    negativePrompt: 'cinematic, dramatic, fast motion',
    aspectRatio: '9:16',
    duration: 5,
    imageUrl: resolvedImageUrl,
    motion: item.klingMotion,
  }
}
