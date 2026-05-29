// ── SFX Catalog ──────────────────────────────────────────────────────────────
// Z34 §6 — 6 sound effects used by the auto-edit planner. Each SFX is a
// short audio file (or generated tone) fired at transition / emphasis
// moments.
//
// For Phase 5, the catalog stores METADATA only — actual audio playback
// happens in the preview player. Audio assets can be bundled later or
// loaded from a CDN. For development, we use placeholder URLs that
// resolve to nothing — the preview player falls back to silence.
// ─────────────────────────────────────────────────────────────────────────────

import type { SfxId } from '../types'

export interface SfxConfig {
  id: SfxId
  labelVi: string
  emoji: string
  /** What kind of moment this SFX fits (used by planner to pick the right one) */
  useFor: ('transition' | 'emphasis' | 'cta' | 'punch_zoom')[]
  /** Default volume 0-1 — voice is always priority so most stay below 0.5 */
  defaultVolume: number
  /** Suggested duration the SFX plays (ms) — for preview player */
  durationMs: number
  /** URL — placeholder for now; can wire to bundled audio later */
  url: string
}

export const SFX_CATALOG: Record<SfxId, SfxConfig> = {
  whoosh: {
    id: 'whoosh',
    labelVi: 'Whoosh',
    emoji: '💨',
    useFor: ['transition', 'punch_zoom'],
    defaultVolume: 0.4,
    durationMs: 350,
    url: '/sfx/whoosh.mp3',
  },
  pop: {
    id: 'pop',
    labelVi: 'Pop',
    emoji: '💥',
    useFor: ['emphasis', 'cta'],
    defaultVolume: 0.35,
    durationMs: 180,
    url: '/sfx/pop.mp3',
  },
  click: {
    id: 'click',
    labelVi: 'Click',
    emoji: '🔘',
    useFor: ['transition', 'emphasis'],
    defaultVolume: 0.25,
    durationMs: 120,
    url: '/sfx/click.mp3',
  },
  swipe: {
    id: 'swipe',
    labelVi: 'Swipe',
    emoji: '👆',
    useFor: ['transition'],
    defaultVolume: 0.35,
    durationMs: 280,
    url: '/sfx/swipe.mp3',
  },
  impact: {
    id: 'impact',
    labelVi: 'Impact',
    emoji: '🔨',
    useFor: ['cta', 'punch_zoom'],
    defaultVolume: 0.45,
    durationMs: 400,
    url: '/sfx/impact.mp3',
  },
  notification: {
    id: 'notification',
    labelVi: 'Notification',
    emoji: '🔔',
    useFor: ['emphasis'],
    defaultVolume: 0.3,
    durationMs: 250,
    url: '/sfx/notification.mp3',
  },
}

/** Pick the best SFX for a given context. Used by autoEditPlanner. */
export function pickSfxFor(
  context: 'transition' | 'emphasis' | 'cta' | 'punch_zoom',
): SfxId {
  // Hand-tuned defaults per context
  if (context === 'transition') return 'whoosh'
  if (context === 'emphasis')   return 'pop'
  if (context === 'cta')        return 'impact'
  if (context === 'punch_zoom') return 'click'
  return 'whoosh'
}
