// ── Render Profile ───────────────────────────────────────────────────────────
// Z29 — Cost-control profile applied at the Kling submission layer.
//
// Replaces the previous hardcoded `resolution: '720p'` in the cut-level
// runner. Now every render goes through one of three profiles:
//
//   TEST_480       — 480p · 5s · low CFG · cheapest · DEFAULT
//                    User-facing label: "TEST 480 ⚡ CHEAP"
//                    Use for: motion tests, character consistency checks,
//                             iteration. Watermark may appear.
//                    Cost: ~40-50 credits/clip (vs 70 for STANDARD).
//
//   STANDARD_720   — 720p · 5s · balanced CFG · normal quality
//                    User-facing label: "STANDARD 720p"
//                    Use for: actual production renders after preview lock.
//                    Cost: ~70 credits/clip.
//
//   FINAL_1080     — 1080p · 5-10s · high CFG · best quality
//                    User-facing label: "FINAL 1080p"
//                    Use for: the FINAL re-render of approved clips
//                             only. Costly — use sparingly.
//                    Cost: ~140 credits/clip.
//
// DEFAULT
//
//   App boots with TEST_480. Per Z29 spec: "DEFAULT RENDER PROFILE: TEST_480".
//
// HOW IT THREADS
//
//   • VideoBuilderV2 holds state.renderProfile (persisted via Z27)
//   • TimelineRenderGrid header has a 3-chip picker
//   • Per-card [Test Motion] forces TEST_480 regardless of selected profile
//     (so user can preview-test cheaply even from STANDARD/FINAL mode)
//   • renderSingleCut + startTimelineRender both accept a `profile` opt
//   • buildKlingPayloadForCut translates the profile into KIE submission
//     fields (resolution + duration cap)
//
// KLING CAVEAT
//
//   Kling 3.0 std actually supports only '720p' + '1080p' through the
//   public KIE.ai API at the time of writing. We still send '480p' for
//   TEST_480 — if KIE rejects, the runner's 422 fallback path retries
//   with a minimal payload that drops resolution entirely (KIE picks
//   default = cheapest tier). Net effect: TEST_480 always works, even
//   if Kling can't honour the literal 480p.
// ─────────────────────────────────────────────────────────────────────────────

export type RenderProfileId = 'TEST_480' | 'STANDARD_720' | 'FINAL_1080'

export interface RenderProfileConfig {
  /** Profile key */
  id: RenderProfileId
  /** Short user-facing label for chips/badges */
  labelVi: string
  /** Slightly longer description for tooltips / picker cards */
  descriptionVi: string
  /** Resolution string sent to KIE (Kling validates server-side) */
  resolution: '480p' | '720p' | '1080p'
  /** Max Kling clip duration (seconds). Kling supports 5 or 10 only. */
  maxDurationSec: 5 | 10
  /** Estimated credit cost per rendered clip */
  estimatedCreditCost: number
  /** UI tint — used for chip colour */
  tone: 'amber' | 'violet' | 'pink'
  /** Tag rendered onto the UI chip ("⚡ CHEAP" / "DEFAULT" / etc) */
  badge: string
}

export const RENDER_PROFILE_CONFIG: Record<RenderProfileId, RenderProfileConfig> = {
  TEST_480: {
    id: 'TEST_480',
    labelVi: 'TEST 480',
    descriptionVi: '480p · 5s · low CFG · watermark có thể có · rẻ nhất — MẶC ĐỊNH cho test',
    resolution: '480p',
    maxDurationSec: 5,
    estimatedCreditCost: 45,
    tone: 'amber',
    badge: '⚡ CHEAP',
  },
  STANDARD_720: {
    id: 'STANDARD_720',
    labelVi: 'STD 720',
    descriptionVi: '720p · 5s · CFG cân bằng · chất lượng chuẩn · cho production thật',
    resolution: '720p',
    maxDurationSec: 5,
    estimatedCreditCost: 70,
    tone: 'violet',
    badge: 'STANDARD',
  },
  FINAL_1080: {
    id: 'FINAL_1080',
    labelVi: 'FINAL 1080',
    descriptionVi: '1080p · 5-10s · CFG cao · chất lượng tốt nhất · CHỈ dùng cho các clip cuối',
    resolution: '1080p',
    maxDurationSec: 10,
    estimatedCreditCost: 140,
    tone: 'pink',
    badge: 'PREMIUM',
  },
}

/** Default profile for new sessions. Per Z29 spec: TEST_480. */
export const DEFAULT_RENDER_PROFILE: RenderProfileId = 'TEST_480'

/** Convenience: get the config for a profile. */
export function getProfileConfig(profile: RenderProfileId): RenderProfileConfig {
  return RENDER_PROFILE_CONFIG[profile]
}

/** Ordered list of profiles for picker UIs. Cheapest first. */
export const ALL_RENDER_PROFILES: RenderProfileId[] = [
  'TEST_480',
  'STANDARD_720',
  'FINAL_1080',
]

/**
 * Z29 — Test-motion profile: locked at TEST_480 regardless of currently-
 * selected user profile. Returned by getTestMotionProfile() so the
 * per-card [Test Motion] button always renders cheaply, even when the
 * user has switched the app-wide profile up to STANDARD or FINAL.
 */
export function getTestMotionProfile(): RenderProfileId {
  return 'TEST_480'
}
