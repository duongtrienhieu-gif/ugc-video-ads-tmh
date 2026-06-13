// ── Hybrid pipeline constants ────────────────────────────────────────────────
// Single source of truth for the two resolutions in the hybrid flow.
//
// The user picks NOTHING here on purpose:
//   • broll/3D clips render at 480p on Grok i2v to keep cost down — that's the
//     vast majority of the render bill. The viewer's eye on a TikTok feed barely
//     distinguishes 480p from 720p inside a 3-5s b-roll cut.
//   • the FINAL MP4 is assembled at 720p — the master canvas every clip scales
//     onto (an upscale for 480p brolls; lossless for the 720p Kling lipsync clips).
//
// One file, two constants — referenced everywhere instead of magic strings, so a
// later bump (e.g. 1080p premium tier) is a single edit.
// ─────────────────────────────────────────────────────────────────────────────

export const BROLL_RENDER_RES: '480p' = '480p'
export const FINAL_RES: '720p' = '720p'
