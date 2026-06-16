// ── B-roll Studio (Mode 2) — model catalog + EXACT credit estimator (P6) ──────
// Mode-2 renders ONE scene at a time and MUST show the EXACT credit BEFORE the user
// clicks render (the user's hard requirement). Routing by scene role:
//   • product / concept / 3D / before-after i2v → Seedance 1.5 Pro (per-second)
//   • avatar talking-head (lipsync)             → InfiniteTalk  (per-second)
//   • "extra clean" premium i2v                 → Veo 3.1 Lite  (flat ≤8s)
//   • social-proof card / faithful first-frame  → gpt-4o-image  (flat ~6cr)
// Prices = the REAL KIE credits read off kie.ai/pricing (2026-06). Per-second models
// let the duration slider (2-10s) map to an exact credit; the gpt-4o-image faithful
// first-frame (product-fidelity step) adds a flat ~6cr when used.
// ─────────────────────────────────────────────────────────────────────────────

export type StudioResolution = '480p' | '720p'
export type StudioModelTier = 'seedance' | 'infinitalk' | 'veo_lite'

type ModelDef =
  | { jobModelId: string; mode: 'perSec'; rate: Record<StudioResolution, number> }
  | { jobModelId: string; mode: 'flat'; flat: Record<StudioResolution, number> }

export const STUDIO_MODELS: Record<StudioModelTier, ModelDef> = {
  // ByteDance Seedance 1.5 Pro, image-to-video, no-audio — the default workhorse.
  seedance:   { jobModelId: 'bytedance/seedance-1.5-pro', mode: 'perSec', rate: { '480p': 1.75, '720p': 3.5 } },
  // MeiGen InfiniteTalk lipsync (avatar image + TTS audio → talking head).
  infinitalk: { jobModelId: 'infinitalk/from-audio',      mode: 'perSec', rate: { '480p': 3,    '720p': 12  } },
  // Google Veo 3.1 Lite i2v — flat per clip (≤8s), Google-clean; the "extra nét" option.
  veo_lite:   { jobModelId: 'veo3_lite',                  mode: 'flat',   flat: { '480p': 30,   '720p': 30  } },
}

/** gpt-4o-image faithful first-frame (product fidelity step). Flat ~6cr. */
export const FAITHFUL_FRAME_CR = 6

export interface SceneCreditInput {
  tier: StudioModelTier
  resolution: StudioResolution
  durationSec: number
  /** product-present scenes that go gpt-4o-image faithful-frame → i2v (anti-drift). */
  withFaithfulFrame?: boolean
}

/** EXACT credit for ONE studio scene render — shown live on the render button and
 *  recomputed when the seconds slider / model / resolution changes. */
export function estimateSceneCredit(i: SceneCreditInput): number {
  const m = STUDIO_MODELS[i.tier]
  const base = m.mode === 'perSec'
    ? Math.ceil(m.rate[i.resolution] * Math.max(1, Math.round(i.durationSec)))
    : m.flat[i.resolution]
  return base + (i.withFaithfulFrame ? FAITHFUL_FRAME_CR : 0)
}
