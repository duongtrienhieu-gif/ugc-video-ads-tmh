// ── Hybrid Scene Renderer (P3c-3) ────────────────────────────────────────────
// Orchestration that turns a directed hybrid plan (TimedBrollScene[]) into rendered
// clips — the CREDIT-COSTING half of the hybrid pipeline. The 0-credit ffmpeg
// assembly lives in hybridAssembler.ts; this file only drives the per-scene Kling
// renders (lips + b-roll/3d) and is reusable by both the dev helper and the real
// P3d UI button.
//
//   • lips        → renderLipsyncSegment (Kling avatar lip-synced to the voice span)
//   • broll / 3d  → renderInsert (Grok i2v, mapped to an action preset)
//   • a broll with an EMPTY conceptPrompt (the cut-split / density-floor leftovers)
//     falls back to a clean PRODUCT_CLOSEUP grounded in the product bank — never a
//     generic stock cut (per the grounded-no-generic rule).
// ─────────────────────────────────────────────────────────────────────────────

import { renderLipsyncSegment } from './creatorVideoEngine'
import { renderInsert } from './insertRenderer'
import type { TimedBrollScene } from './brollDirector'
import type { HybridSceneClip } from './hybridAssembler'
import type { Product, Model } from '../../../../stores/types'
import type { CreatorVideoConfig, ActionPresetId } from '../types'

export interface HybridRenderContext {
  kieApiKey: string
  /** Creator keyframe (Bước 3) — the talking face for lips + the chain anchor. */
  keyframeRef?: string
  /** Master TTS (asset ref) — lips cuts slice their span from this. */
  voiceRef?: string
  product?: Product | null
  avatar?: Model | null
  creatorVideoConfig: CreatorVideoConfig
  resolution: '480p' | '720p' | '1080p'
}

// Render ONE scene → a clip videoRef.
export async function renderOneHybridScene(
  scene: TimedBrollScene,
  ctx: HybridRenderContext,
  onStage?: (stage: string) => void,
  // P3t — fired each KIE poll so the UI can show "đang render… poll #5 · 28s"
  // instead of a blind spinner. Best-effort: only the broll/mechanism path
  // currently surfaces it (it's where the long Grok i2v wait lives); the lips
  // path stays opaque for now since KIE's lipsync poll is shorter.
  onProgress?: (info: { pollCount: number; elapsedSec: number }) => void,
  // P3z — fired the moment the Grok i2v job is submitted, so the caller can
  // PERSIST the taskId. If the user navigates away / F5s mid-render, the already
  // -paid job can be RE-POLLED (resumeInsertVideo) on return instead of lost.
  // Only the broll/mechanism path has a resumable taskId (lips uses a different
  // Kling flow); lips renders are short and just re-render if interrupted.
  onTaskId?: (taskId: string) => void,
): Promise<string> {
  if (scene.role === 'lips') {
    if (!ctx.keyframeRef || !ctx.voiceRef) {
      throw new Error('Cảnh lips cần keyframe + voice — tạo keyframe ở Bước 3 trước.')
    }
    const r = await renderLipsyncSegment({
      kieApiKey: ctx.kieApiKey,
      config: ctx.creatorVideoConfig,
      voiceRef: ctx.voiceRef,
      keyframeRef: ctx.keyframeRef,
      startSec: scene.startSec,
      endSec: scene.endSec,
    })
    return r.videoRef
  }

  // broll / mechanism3d → Grok insert.
  let conceptPrompt = scene.conceptPrompt || ''
  // Cut-split / density-floor leftovers arrive as broll with no conceptPrompt.
  const emptyBroll = scene.role === 'broll' && !conceptPrompt.trim()
  // P3v — preset mapping. The OLD mapping sent every `product_closeup` scene to
  // the PRODUCT_CLOSEUP preset, which IGNORES conceptPrompt (insertRenderer only
  // honours conceptPrompt for PRODUCT_IN_ACTION / CONCEPT_SCENE). Result: every
  // product scene rendered the SAME fixed "packaging on a surface" shot — the
  // "toàn túi bánh giống nhau" bug the user audited. Now ANY broll WITH a real
  // conceptPrompt routes to PRODUCT_IN_ACTION so the director's vivid concept is
  // actually used as the ACTION. PRODUCT_CLOSEUP is the fallback ONLY when the
  // concept is empty (a clean product shot is better than a blank Grok frame).
  const presetId: ActionPresetId =
    scene.role === 'mechanism3d' ? 'CONCEPT_SCENE'
    : scene.kind === 'concept' ? 'CONCEPT_SCENE'
    : emptyBroll ? 'PRODUCT_CLOSEUP'
    : 'PRODUCT_IN_ACTION'
  // P3v — a product B-roll must NOT randomly grow a face. PRODUCT_IN_ACTION only
  // drops the avatar ref when cameraFraming === 'hands_noface'; if the director
  // left it unset, default product scenes to hands-only so we never inject a
  // stray creator face into a pure product shot. ('creator' is kept only when
  // the director explicitly asked for a person — e.g. the CTA endorsement).
  const cameraFraming: typeof scene.cameraFraming =
    scene.cameraFraming ?? (scene.kind === 'product_closeup' ? 'hands_noface' : 'creator')

  if (scene.role === 'mechanism3d' && !conceptPrompt.startsWith('3D MECHANISM ANIMATION')) {
    conceptPrompt = `3D MECHANISM ANIMATION (no people): clean photorealistic 3D scientific/technical animation INSIDE the subject — ${conceptPrompt}. Cross-section or macro of the internal workings, studio 3D render, soft clinical light. NO people, NO hands, NO product packaging, NO text.`
  }

  const r = await renderInsert({
    kieApiKey: ctx.kieApiKey,
    presetId,
    product: ctx.product ?? null,
    avatar: ctx.avatar ?? null,
    creatorKeyframeRef: ctx.keyframeRef,
    resolution: ctx.resolution,
    conceptPrompt,
    renderMode: 'video',
    durationSec: scene.endSec - scene.startSec,
    cameraFraming,   // P3v — defaulted above so product shots don't grow a face.
    quote: scene.quote,
    onStageUpdate: (u) => {
      onStage?.(u.stage)
      // P3z — surface the Grok video taskId so the caller can persist it for resume.
      if (u.fullTaskId) onTaskId?.(u.fullTaskId)
    },
    onProgress,   // P3t — thread KIE poll updates so the UI shows "poll #N · Ms".
  })
  return r.videoRef
}

export interface RenderHybridScenesOpts {
  /** Max concurrent Kling renders (default 2 — same gate as the bulk render). */
  concurrency?: number
  onSceneStart?: (i: number, scene: TimedBrollScene) => void
  onSceneStage?: (i: number, stage: string) => void
  /** Fires as each scene resolves (clip = null on failure) — use to cache incrementally. */
  onSceneDone?: (i: number, clip: HybridSceneClip | null) => void
}

// Render ALL scenes, concurrency-limited. Returns clips in scene order (null where a
// scene failed) + the list of failed indices. A failed scene never aborts the rest.
export async function renderHybridScenes(
  scenes: TimedBrollScene[],
  ctx: HybridRenderContext,
  opts: RenderHybridScenesOpts = {},
): Promise<{ clips: (HybridSceneClip | null)[]; failed: number[] }> {
  const clips: (HybridSceneClip | null)[] = new Array(scenes.length).fill(null)
  const failed: number[] = []
  const concurrency = Math.max(1, opts.concurrency ?? 2)

  // Shared cursor — `cursor++` is atomic in JS's single-threaded loop (no await
  // between the read and the increment), so the workers never grab the same index.
  let cursor = 0
  const worker = async () => {
    for (;;) {
      const i = cursor++
      if (i >= scenes.length) break
      opts.onSceneStart?.(i, scenes[i])
      try {
        const videoRef = await renderOneHybridScene(scenes[i], ctx, (s) => opts.onSceneStage?.(i, s))
        const clip: HybridSceneClip = { scene: scenes[i], videoRef }
        clips[i] = clip
        opts.onSceneDone?.(i, clip)
      } catch (e) {
        console.error(`[HYBRID_RENDER] cảnh ${i} lỗi:`, e)
        failed.push(i)
        opts.onSceneDone?.(i, null)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, scenes.length) }, worker))
  return { clips, failed }
}
