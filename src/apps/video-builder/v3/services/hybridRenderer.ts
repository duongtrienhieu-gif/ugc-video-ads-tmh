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
import { isWeakConceptPrompt, deriveConceptPrompt } from './brollDirector'
import { generateSocialProofImage } from './socialProofRenderer'
import type { HybridSceneClip } from './hybridAssembler'
import type { Product, Model } from '../../../../stores/types'
import type { CreatorVideoConfig, ActionPresetId, ScriptLang } from '../types'

export interface HybridRenderContext {
  kieApiKey: string
  /** Creator keyframe (Bước 3) — the talking face for lips + the chain anchor. */
  keyframeRef?: string
  /** P6av — KF-B: the same creator HOLDING the product; used for a lips cut whose line mentions
   *  the product (scene.lipsHoldsProduct). Falls back to keyframeRef when absent. */
  keyframeProductRef?: string
  /** Master TTS (asset ref) — lips cuts slice their span from this. */
  voiceRef?: string
  product?: Product | null
  avatar?: Model | null
  creatorVideoConfig: CreatorVideoConfig
  resolution: '480p' | '720p' | '1080p'
  /** P5w — output language (for the social-proof card text). */
  lang?: ScriptLang
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
    // P6av — a product-mention lips uses KF-B (creator holding the product) when available;
    // otherwise the plain talking-head KF-A. Falls back safely if KF-B wasn't generated.
    const lipsKeyframe = (scene.lipsHoldsProduct && ctx.keyframeProductRef) ? ctx.keyframeProductRef : ctx.keyframeRef
    const r = await renderLipsyncSegment({
      kieApiKey: ctx.kieApiKey,
      config: ctx.creatorVideoConfig,
      voiceRef: ctx.voiceRef,
      keyframeRef: lipsKeyframe,
      startSec: scene.startSec,
      endSec: scene.endSec,
    })
    return r.videoRef
  }

  // P5w — social-proof card: a realistic FB-post IMAGE (GPT-4o), NOT i2v. The
  // assembler holds + slow-pans it as a 2-4s clip. 0 i2v drift; ~6cr for the image.
  if (scene.role === 'social_proof') {
    onStage?.('Tạo thẻ bằng chứng…')
    return await generateSocialProofImage({
      kieApiKey: ctx.kieApiKey,
      lang: ctx.lang ?? 'vi',
      productName: ctx.product?.productName ?? 'Sản phẩm',
      productImageRef: ctx.product?.productImage ?? undefined,
    })
  }

  // broll / mechanism3d → Grok insert.
  let conceptPrompt = scene.conceptPrompt || ''
  // P4e Layer 3 — deterministic last-resort: any non-lips scene still carrying an
  // empty/vague conceptPrompt (the split/density FILLER cuts, or a scene the
  // director + Gemini backfill both missed) gets a grounded prompt derived from
  // its role/kind + the product's real usage. Universal — never a silent generic
  // close-up. (Layer 2's Gemini backfill already handled the main scenes.)
  if (isWeakConceptPrompt(conceptPrompt)) {
    conceptPrompt = deriveConceptPrompt({
      role: scene.role, kind: scene.kind, cameraFraming: scene.cameraFraming, product: ctx.product,
    })
  }
  // After the derive above this is ~never true; kept as the absolute backstop.
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
    // P6ag — "cận sản phẩm / chi tiết" (product_closeup) = product ALONE, NO hands. Hands
    // holding + rotating a product is exactly what makes i2v DRIFT/morph the packaging, so a
    // macro/detail cut goes to PRODUCT_CLOSEUP (no-hands preset), never PRODUCT_IN_ACTION (which
    // adds hands). product_action (đang dùng) keeps PRODUCT_IN_ACTION — hands USING it is the point.
    : scene.kind === 'product_closeup' ? 'PRODUCT_CLOSEUP'
    : emptyBroll ? 'PRODUCT_CLOSEUP'
    : 'PRODUCT_IN_ACTION'
  // P3v — a product B-roll must NOT randomly grow a face. PRODUCT_IN_ACTION only
  // drops the avatar ref when cameraFraming === 'hands_noface'; if the director
  // left it unset, default product scenes to hands-only so we never inject a
  // stray creator face into a pure product shot. ('creator' is kept only when
  // the director explicitly asked for a person — e.g. the CTA endorsement).
  const cameraFraming: typeof scene.cameraFraming =
    scene.cameraFraming ?? (scene.kind === 'product_closeup' ? 'hands_noface' : 'creator')

  if (scene.role === 'mechanism3d' && !conceptPrompt.startsWith('3D ')) {
    // P6ae — 3D covers TWO modes: (1) a cross-section of the internal mechanism (how the active
    // works inside the body), OR (2) an INGREDIENT-3D — the PRODUCT as hero in the centre with the
    // active's molecules/particles orbiting it (for synthetic/abstract actives that have no real
    // plant form). The conceptPrompt (written by the director per ingredient type) leads; we no
    // longer force "INSIDE the subject / no packaging" so the molecules-around-product shot works.
    conceptPrompt = `3D ANIMATION (no people, no hands, no on-screen text): clean photorealistic studio 3D render — ${conceptPrompt}. Keep the EXACT body site / subject named above — do NOT substitute a different or generic organ. EITHER a cross-section / macro of that internal mechanism, OR the PRODUCT as hero in the centre with the active's glowing molecules / particles flowing and orbiting around it. Soft clinical light. P6as — STYLISED, NON-graphic wellness visualisation: no gore, no blood, no distressing or explicit medical realism (keeps the image-model content filter from blocking it).`
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
    giftRef: scene.giftRef,   // Phase A — extra gift reference on the two closing cuts
    productUnits: scene.productUnits,   // Phase A — render the real offer quantity (penult)

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
