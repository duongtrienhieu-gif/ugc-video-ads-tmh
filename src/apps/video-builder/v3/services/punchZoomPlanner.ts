// ── Punch Zoom Planner ───────────────────────────────────────────────────────
// Z34 §4 — TikTok-style subtle punch zooms at emphasis moments.
//
// Zoom triggers:
//   1. Hook moment (first ~1.5s of script) — always zoom (if style allows)
//   2. CTA moment (last ~2s) — always zoom
//   3. Product mention keyword in script
//   4. Emotional beat marker (style-dependent)
//
// Zoom magnitudes are SUBTLE per Z34 §4 ("subtle / fast / natural / not
// cinematic"):
//   targetScale 1.10 → barely noticeable
//   targetScale 1.15 → standard subtle TikTok zoom
//   targetScale 1.25 → noticeable but not cartoony
//   targetScale 1.30 → max — only for aggressive_sales style
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GeneratedScript, PunchZoomCue, EditingStyleId,
} from '../types'
import { EDITING_STYLES } from './editingStyles'

interface BuildZoomsParams {
  script: GeneratedScript
  /** Where the script starts on the edit timeline */
  scriptStartSec: number
  styleId: EditingStyleId
  /** Total edit duration (seconds) — used to pin CTA zoom at the end */
  totalDurationSec: number
}

/**
 * Z34 — Produce the punch-zoom cue list for a given script + style.
 *
 * Honors the style's `zoomIntensity` (0-1):
 *   • 0   → empty array (no zooms — clean_minimal style)
 *   • 0.5 → ~3 zooms (hook + CTA + one mid keyword)
 *   • 1.0 → ~6 zooms (hook + CTA + multiple emphasis points)
 */
export function buildPunchZoomCues(params: BuildZoomsParams): PunchZoomCue[] {
  const style = EDITING_STYLES[params.styleId]
  if (style.zoomIntensity <= 0) return []

  const cues: PunchZoomCue[] = []

  // 1. HOOK zoom — always (if style allows hook emphasis)
  if (style.applyHookEmphasis) {
    cues.push({
      startSec: params.scriptStartSec + 0.2,
      durationSec: 0.7,
      targetScale: 1.0 + 0.15 * style.zoomIntensity,
      easing: 'ease-out',
      reason: 'hook',
    })
  }

  // 2. CTA zoom — always (if style applies CTA overlay)
  if (style.applyCtaOverlay && params.totalDurationSec > 2) {
    cues.push({
      startSec: params.totalDurationSec - 1.5,
      durationSec: 1.0,
      targetScale: 1.0 + 0.20 * style.zoomIntensity,
      easing: 'ease-in',
      reason: 'cta',
    })
  }

  // 3. Mid-block emphasis zooms — based on intensity budget
  // Budget: ceil(zoomIntensity * 4) additional zooms across the timeline.
  const midBudget = Math.ceil(style.zoomIntensity * 4)
  let cursor = params.scriptStartSec
  let midZoomsAdded = 0
  for (const block of params.script.blocks) {
    if (block.id === 'hook' || block.id === 'cta') {
      cursor += block.estDurationSec
      continue
    }
    if (midZoomsAdded >= midBudget) break

    // Place a zoom at the START of any block matching emphasis keywords
    const text = block.text.toLowerCase()
    const isEmphasis =
      text.includes('this product') ||
      text.includes('actually') ||
      text.includes('really') ||
      text.includes('thật ra') ||
      text.includes('thực sự') ||
      text.includes('khác hẳn') ||
      block.id === 'discovery'  // discovery block always gets a zoom

    if (isEmphasis) {
      cues.push({
        startSec: round2(cursor + 0.3),
        durationSec: 0.6,
        targetScale: 1.0 + 0.10 * style.zoomIntensity,
        easing: 'ease-in-out',
        reason: block.id === 'discovery' ? 'product_mention' : 'emphasis_keyword',
      })
      midZoomsAdded++
    }
    cursor += block.estDurationSec
  }

  // Sort + dedupe close-together zooms
  return dedupeZooms(cues)
}

/** Remove zooms that start within 0.4s of another zoom — overlaps look weird. */
function dedupeZooms(cues: PunchZoomCue[]): PunchZoomCue[] {
  const sorted = [...cues].sort((a, b) => a.startSec - b.startSec)
  const out: PunchZoomCue[] = []
  for (const cue of sorted) {
    const last = out[out.length - 1]
    if (!last || cue.startSec - last.startSec > 0.4) {
      out.push(cue)
    }
  }
  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
