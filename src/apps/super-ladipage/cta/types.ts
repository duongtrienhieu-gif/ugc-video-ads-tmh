// ═════════════════════════════════════════════════════════════════════
// CTA System — type definitions (P3 lightweight orchestration)
//
// CTA = INDEPENDENT orchestration system, ADDITIVE to storytelling LOCK.
// Module sandbox: src/apps/super-ladipage/cta/
//
// Philosophy lock (per user direction):
//   "CTA should feel emotionally inevitable, NOT commercially inserted."
//   Layered action momentum > 1 final CTA. Small psychological commitments
//   accumulate before final action.
//
// NOT a button copy engine. NOT scarcity. NOT countdown.
// Pure psychological action pacing — sampling-driven brief at pack-top.
// ═════════════════════════════════════════════════════════════════════

import type { NicheKey } from '../storytelling/types'

export type { NicheKey }

// ─── CTA moment types ──────────────────────────────────────────────

export type CtaMomentType =
  | 'micro-commitment'        // small internal agreement reader makes
  | 'friction-reduction'      // lower resistance ("không cần tin ngay")
  | 'reassurance-texture'     // gradual improvement language (anti-miracle)
  | 'urgency-texture'         // EMOTIONAL urgency (NOT scarcity / countdown)

// ─── CTA energy modes per niche (action push) ──────────────────────

export type CtaEnergyModeId =
  | 'confidence-restoration'   // haircare — identity/femininity pull
  | 'age-presence-restoration' // skincare — visibility without anxiety
  | 'aliveness-recovery'       // supplement-wellness — emotional + cognitive return
  | 'dignity-mobility'         // health-functional — independent capacity
  | 'self-reclamation'         // mom-baby — "tôi trở lại là tôi"
  | 'attention-restoration'    // beauty-confidence — being looked at again
  | 'warmth-reconnection'      // relationship — emotional presence
  | 'activity-restoration'     // fitness-recovery — capacity return
  // Tier S extensions (2026-05-27)
  | 'restful-night-return'     // sleep-insomnia — sleep restoration as identity return
  | 'identity-continuity'      // menopause — "tôi vẫn là tôi" through transition
  | 'inner-calm-return'        // mental-health — emotional regulation return
  | 'vitality-extension'       // anti-aging-longevity — vital years extension
  // SEA-6 extensions (2026-05-27)
  | 'social-smile-return'      // dental-oral-care — confident smile + breath, social re-entry
  | 'health-stability-recovery' // diabetes-blood-sugar — stable numbers + food freedom
  | 'internal-cleanse-relief'  // liver-detox — internal lightness + energy return
  | 'silent-vitality-return'   // prostate-urology — quiet capacity / dignity in male body
  | 'discreet-comfort-return'  // hemorrhoids-digestive-shame — bathroom dignity back
  | 'clarity-return'           // eye-vision-care — visual clarity + screen endurance
  // SPEC-FIX (2026-05-27) — health-functional split
  | 'breath-freedom-return'    // health-respiratory — open airway, sleep through night
  | 'mobility-dignity-return'  // health-joint — independent capacity, no caregiver burden
  | 'digestive-ease-return'    // health-digestive — eat without fear, work without distraction
  | 'cardiac-stability'        // health-cardiovascular — stable numbers, peace of mind

export interface CtaEnergyMode {
  id: CtaEnergyModeId
  niche: NicheKey
  /** 1-line action-push description for prompt injection. */
  description: string
  /** What CTA momentum tone to weave (NOT prescriptive rule, vibe only). */
  vibe: string
  /** What CTA tone to AVOID for this niche (anti-default). */
  avoidPatterns: string[]
}

// ─── Pattern shape (shared structure for 4 moment types) ───────────

export interface CtaPattern {
  id: string
  posture: string          // 1-line posture description
  /** Structural frame — niche fills in concrete content. */
  frame: string
  /** 1 niche-mismatched example to teach SHAPE not verbatim. */
  exampleNicheMismatched: string
}

// ─── Per-pack sampled CTA orchestration ────────────────────────────

export interface CtaFlow {
  /** Niche-specific CTA energy mode. */
  energyMode: CtaEnergyMode
  /** 2 micro-commitment patterns (woven across Phase 2-3-4). */
  microCommitments: CtaPattern[]
  /** 1 friction reduction pattern. */
  frictionReduction: CtaPattern
  /** 1 reassurance texture pattern. */
  reassurance: CtaPattern
  /** 1 urgency texture pattern (emotional, NOT scarcity). */
  urgency: CtaPattern
}
