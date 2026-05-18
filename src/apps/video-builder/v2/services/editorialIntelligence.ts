// ── Editorial Intelligence Layer ─────────────────────────────────────────────
// Z17 — sits BETWEEN the storyboard engine (Z11/Z12/Z13) and the future
// video renderer. Adds the "editor brain" that converts a static blueprint
// into a TikTok-native paced timeline:
//
//   P1. VisualRole engine            — semantic role per scene
//   P2. Visual role diversity rules  — no 3 info-heavy in a row
//   P3. Semantic similarity detector — catches "looks the same to viewer"
//   P4. Auto-mutation system         — repair repetitive sequences
//   P5. Shot coverage engine         — 3-6 derived shots per master
//   P6. Continuity system            — identity-lock groups
//   P7. Motion blueprint mapping     — zoom/pan/blur per shot
//   P9. Timeline assembler           — 20-35 cuts for 60s voice
//   P10. Timeline energy curve       — per-second energy
//   P11. Transition graph            — cut-to-cut transitions
//
// Pure logic — no Gemini calls, no image gen. Consumed by the future
// renderer phase.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SceneBlueprint, SceneType,
  VisualRole, CoverageShot, CoverageShotType, EditorialTransition,
  MotionBlueprint, ContinuityGroup, TimelineCut, EditorialBlueprint,
  CameraGrammar,
} from '../types'
// Z21 — coverage + timeline engines layered on top of the Z17 foundation
import {
  deriveCoverageShots as ceDeriveCoverageShots,
  enforceCoverageDiversity as ceEnforceCoverageDiversity,
} from './coverageEngine'
import {
  recommendCoverageShotCount as tlRecommendCoverageShotCount,
  buildTimelineCuts as tlBuildTimelineCuts,
  buildEnergyCurve as tlBuildEnergyCurve,
  summarizePhaseDensities as tlSummarizePhaseDensities,
} from './timelineAssembler'
// Z28 — mode-driven duration scaling
import type { TimelineMode } from './timelineMode'
import { getModeConfig } from './timelineMode'

// ═════════════════════════════════════════════════════════════════════════
// P1 — VISUAL ROLE ENGINE
// ═════════════════════════════════════════════════════════════════════════

const ROLE_FROM_SCENE_TYPE: Record<SceneType, VisualRole> = {
  hook:            'hook',
  pain:            'pain',
  frustration:     'reaction',
  failed_solution: 'reaction',
  discovery:       'product_reveal',
  explanation:     'education',
  recovery:        'recovery',
  lifestyle:       'lifestyle',
  social_proof:    'social_proof',
  cta:             'cta',
}

/** Smart-default the visual role from existing axes. Priority order:
 *   1. subjectFocus 'ingredient' → ingredient
 *   2. subjectFocus 'infographic' + motif 'social-proof' → credibility
 *   3. subjectFocus 'infographic' → education
 *   4. subjectFocus 'product' (non-CTA) → product_reveal
 *   5. sceneType lookup
 */
export function inferVisualRole(b: SceneBlueprint): VisualRole {
  if (b.subjectFocus === 'ingredient') return 'ingredient'
  if (b.subjectFocus === 'infographic') {
    if (b.visualMotif === 'social-proof') return 'credibility'
    return 'education'
  }
  if (b.subjectFocus === 'product' && b.sceneType !== 'cta' && !b.ctaFocus) {
    return 'product_reveal'
  }
  return ROLE_FROM_SCENE_TYPE[b.sceneType ?? 'discovery'] ?? 'sensory'
}

// ═════════════════════════════════════════════════════════════════════════
// P2 — VISUAL ROLE DIVERSITY RULES
// ═════════════════════════════════════════════════════════════════════════
//
// Sits OVER the existing Z12 enforceTimelineDirector. R1-R9 catch visual
// duplication (same composition / pose / motif). The functions below catch
// SEMANTIC duplication (same purpose / density / focal hierarchy).

const HIGH_INFO_ROLES: ReadonlySet<VisualRole> = new Set<VisualRole>([
  'education', 'credibility', 'ingredient',
])

const HERO_ROLES: ReadonlySet<VisualRole> = new Set<VisualRole>([
  'product_reveal', 'cta',
])

/** Density tier — used by diversity rules. */
type DensityTier = 'high' | 'hero' | 'low'

function densityOf(role: VisualRole): DensityTier {
  if (HIGH_INFO_ROLES.has(role)) return 'high'
  if (HERO_ROLES.has(role)) return 'hero'
  return 'low'
}

/** Pick a "breaker" role for a scene that needs to interrupt a density run.
 *  Tries to stay narratively-coherent with the surrounding beats. */
function pickBreakerRole(neighborBefore: VisualRole, neighborAfter: VisualRole): VisualRole {
  // If sandwiched between hero scenes, break with sensory/lifestyle
  if (HERO_ROLES.has(neighborBefore) && HERO_ROLES.has(neighborAfter)) return 'sensory'
  // If sandwiched between info-heavy, break with reaction/sensory
  if (HIGH_INFO_ROLES.has(neighborBefore) && HIGH_INFO_ROLES.has(neighborAfter)) {
    // Pick reaction if a pain/frustration beat is nearby; else sensory
    return 'reaction'
  }
  return 'lifestyle'
}

/** Auto-mutation table from spec P4 — when a scene needs to break a run,
 *  here's where it goes. Returns a NEW VisualRole. */
function autoMutationFor(currentRole: VisualRole): VisualRole {
  switch (currentRole) {
    case 'education':      return 'ingredient'      // infographic → ingredient macro
    case 'product_reveal': return 'sensory'         // product hero → hand holding
    case 'credibility':    return 'social_proof'    // credibility infographic → selfie testimonial
    case 'recovery':       return 'lifestyle'       // recovery → outdoor lifestyle
    case 'pain':           return 'reaction'        // pain → office fatigue / reaction
    case 'cta':            return 'cta'             // CTA never gets mutated
    default:               return 'sensory'
  }
}

/** P2 — Enforce visual role diversity. Returns NEW array (immutable). */
export function enforceVisualRoleDiversity(blueprints: SceneBlueprint[]): SceneBlueprint[] {
  if (blueprints.length === 0) return blueprints
  const out = blueprints.map((b) => ({ ...b, visualRole: b.visualRole ?? inferVisualRole(b) }))
  const ctaCutoff = Math.floor(out.length * 0.8)

  // ── E1 (P2): no 3+ informational scenes in a row ─────────────────────
  for (let i = 2; i < out.length; i++) {
    const a = out[i - 2].visualRole!
    const b = out[i - 1].visualRole!
    const c = out[i].visualRole!
    if (HIGH_INFO_ROLES.has(a) && HIGH_INFO_ROLES.has(b) && HIGH_INFO_ROLES.has(c)) {
      // Don't mutate inside CTA window — final escalation often legit info-heavy
      if (i - 1 >= ctaCutoff) continue
      const breaker = pickBreakerRole(a, c)
      out[i - 1] = { ...out[i - 1], visualRole: breaker }
      console.log(`[editorial E1] scene ${i} broke 3-info run — scene ${i - 1} role ${b} → ${breaker}`)
    }
  }

  // ── E2 (P2): no 2 hero scenes back-to-back ───────────────────────────
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1].visualRole!
    const cur  = out[i].visualRole!
    if (HERO_ROLES.has(prev) && HERO_ROLES.has(cur)) {
      // Allow back-to-back hero only if BOTH are in the CTA escalation window
      if (i >= ctaCutoff && (i - 1) >= ctaCutoff) continue
      // CTA is sacred — never mutate it. Mutate the OTHER one if possible.
      const target = cur === 'cta' ? i - 1 : i
      const originalRole = out[target].visualRole!
      const mutated = autoMutationFor(originalRole)
      out[target] = { ...out[target], visualRole: mutated }
      console.log(`[editorial E2] hero back-to-back at ${i} — scene ${target + 1} ${originalRole} → ${mutated}`)
    }
  }

  // ── E3 (P2): no 3+ same density tier in a row (any tier) ─────────────
  for (let i = 2; i < out.length; i++) {
    const d1 = densityOf(out[i - 2].visualRole!)
    const d2 = densityOf(out[i - 1].visualRole!)
    const d3 = densityOf(out[i].visualRole!)
    if (d1 === d2 && d2 === d3 && i - 1 < ctaCutoff) {
      // Already partially handled by E1/E2 for high+hero — this catches
      // 3 'low' in a row (which is OK-ish but still benefits from contrast)
      // Skip — low density runs are fine for narrative flow
      if (d1 === 'low') continue
      // Otherwise mutate middle
      const middle = out[i - 1]
      const mutated = autoMutationFor(middle.visualRole!)
      out[i - 1] = { ...out[i - 1], visualRole: mutated }
      console.log(`[editorial E3] 3-density run (${d1}) at ${i} — scene ${i - 1} mutated to ${mutated}`)
    }
  }

  return out
}

// ═════════════════════════════════════════════════════════════════════════
// P3 — SEMANTIC SIMILARITY DETECTOR
// ═════════════════════════════════════════════════════════════════════════
//
// Compares two scenes on multiple SEMANTIC axes (not just visual). Returns
// 0.0-1.0 similarity. Threshold 0.7+ = "viewer perceives as same scene".

export function computeSemanticSimilarity(a: SceneBlueprint, b: SceneBlueprint): number {
  let score = 0
  // Visual role match — strongest signal
  if ((a.visualRole ?? inferVisualRole(a)) === (b.visualRole ?? inferVisualRole(b))) score += 0.40
  // Subject focus match
  if (a.subjectFocus && b.subjectFocus && a.subjectFocus === b.subjectFocus) score += 0.20
  // Visual motif match
  if (a.visualMotif && b.visualMotif && a.visualMotif === b.visualMotif) score += 0.15
  // Camera grammar match
  if (a.cameraGrammar && b.cameraGrammar && a.cameraGrammar === b.cameraGrammar) score += 0.15
  // Energy within 10 points — similar pacing
  const ea = a.energyScore ?? 50
  const eb = b.energyScore ?? 50
  if (Math.abs(ea - eb) <= 10) score += 0.10
  return Math.min(1, score)
}

/** P4 — auto-mutate any pair of consecutive scenes with similarity ≥ 0.7. */
export function autoMutateRepetitive(blueprints: SceneBlueprint[], threshold = 0.7): SceneBlueprint[] {
  if (blueprints.length < 2) return blueprints
  const out = blueprints.map((b) => ({ ...b }))
  for (let i = 1; i < out.length; i++) {
    const sim = computeSemanticSimilarity(out[i - 1], out[i])
    if (sim < threshold) continue
    // Don't mutate the CTA scene
    if (out[i].sceneType === 'cta' || out[i].ctaFocus) continue
    const oldRole = out[i].visualRole ?? inferVisualRole(out[i])
    const mutated = autoMutationFor(oldRole)
    out[i] = { ...out[i], visualRole: mutated }
    console.log(`[editorial autoMutate] scenes ${i} and ${i + 1} too similar (${sim.toFixed(2)}) — scene ${i + 1} role ${oldRole} → ${mutated}`)
  }
  return out
}

// ═════════════════════════════════════════════════════════════════════════
// P5 — SHOT COVERAGE ENGINE
// ═════════════════════════════════════════════════════════════════════════
//
// Each master scene gets 3-6 coverage shots so a 60s voice has 20-35 cuts.
// Templates per VisualRole.

interface CoverageTemplate {
  shotType: CoverageShotType
  /** Short English description — replaces {productName} / {avatar} markers
   *  at derivation time. */
  descTemplate: string
  /** Base motion for this shot type */
  motion: MotionBlueprint
}

const COVERAGE_TEMPLATES: Record<VisualRole, CoverageTemplate[]> = {
  hook: [
    { shotType: 'closeup',     descTemplate: 'tight eye-level reaction, mid-snap-zoom feel',         motion: { zoomDirection: 'in', intensity: 60, handheldAmount: 25, easing: 'ease-in' } },
    { shotType: 'reaction',    descTemplate: 'expressive face, slight tilt, hook energy',            motion: { zoomDirection: 'in', intensity: 40, handheldAmount: 30 } },
    { shotType: 'motion_frame',descTemplate: 'punch-zoom into product mid-reveal',                    motion: { zoomDirection: 'in', intensity: 80, blurAmount: 30, easing: 'ease-in' } },
    { shotType: 'crop',        descTemplate: 'tight crop with text-overlay headroom',                 motion: { zoomDirection: 'in', intensity: 35, easing: 'ease-out' } },
  ],
  pain: [
    { shotType: 'closeup',     descTemplate: 'eye fatigue closeup, dim cool light',                   motion: { zoomDirection: 'in', intensity: 25, handheldAmount: 35, easing: 'ease-in' } },
    { shotType: 'detail',      descTemplate: 'hand on forehead, weary gesture',                       motion: { handheldAmount: 40 } },
    { shotType: 'crop',        descTemplate: 'laptop screen crop, blue glow on face',                 motion: { zoomDirection: 'in', intensity: 20 } },
    { shotType: 'reaction',    descTemplate: 'phone scroll frustration, slumped shoulder',            motion: { handheldAmount: 45 } },
    { shotType: 'environment', descTemplate: 'messy desk wide, dim lamp light',                       motion: { cameraMove: 'left', intensity: 20 } },
  ],
  reaction: [
    { shotType: 'closeup',     descTemplate: 'frustrated face crop, brow furrow',                     motion: { zoomDirection: 'in', intensity: 30, handheldAmount: 50 } },
    { shotType: 'detail',      descTemplate: 'tossing failed product to side',                        motion: { cameraMove: 'right', intensity: 40 } },
    { shotType: 'reaction',    descTemplate: 'eye roll / sigh / disbelief',                           motion: { handheldAmount: 40 } },
  ],
  education: [
    { shotType: 'overlay_space', descTemplate: 'infographic with floating labels and arrows',          motion: { zoomDirection: 'in', intensity: 25, easing: 'ease-out' } },
    { shotType: 'medium',        descTemplate: '3D molecular structures orbiting the product',         motion: { cameraMove: 'right', intensity: 30 } },
    { shotType: 'detail',        descTemplate: 'capsule cross-section with active compounds visible',  motion: { zoomDirection: 'in', intensity: 50 } },
    { shotType: 'motion_frame',  descTemplate: 'energy particles flowing through body silhouette',     motion: { cameraMove: 'up', intensity: 60 } },
  ],
  sensory: [
    { shotType: 'closeup',       descTemplate: 'hand touching skin / feeling texture',                  motion: { zoomDirection: 'in', intensity: 35 } },
    { shotType: 'detail',        descTemplate: 'water droplet / capsule splash / soft glow detail',     motion: { handheldAmount: 15, easing: 'ease-out' } },
    { shotType: 'motion_frame',  descTemplate: 'macro float with soft ambient particles',                motion: { cameraMove: 'up', intensity: 40, easing: 'ease-in-out' } },
  ],
  product_reveal: [
    { shotType: 'closeup',       descTemplate: 'bottle macro, label centered, soft glow halo',          motion: { zoomDirection: 'in', intensity: 45 } },
    { shotType: 'detail',        descTemplate: 'label closeup, every letter readable',                   motion: { zoomDirection: 'in', intensity: 35 } },
    { shotType: 'product_focus', descTemplate: 'hand holding product at chest level, gentle reveal',     motion: { handheldAmount: 25 } },
    { shotType: 'crop',          descTemplate: 'product on counter with morning light',                   motion: { zoomDirection: 'in', intensity: 25 } },
    { shotType: 'motion_frame',  descTemplate: 'bottle rotation 360 with soft turntable feel',           motion: { cameraMove: 'right', intensity: 55 } },
  ],
  credibility: [
    { shotType: 'overlay_space', descTemplate: 'metric cards floating around product (★ rating, users)', motion: { zoomDirection: 'in', intensity: 25 } },
    { shotType: 'detail',        descTemplate: 'KKM-verified badge closeup, shield icon',                motion: { zoomDirection: 'in', intensity: 30 } },
    { shotType: 'medium',        descTemplate: 'testimonial card row drifting horizontally',             motion: { cameraMove: 'left', intensity: 35 } },
  ],
  ingredient: [
    { shotType: 'detail',        descTemplate: 'fresh herb/fruit macro, dew, soft daylight',             motion: { handheldAmount: 10, easing: 'ease-out' } },
    { shotType: 'motion_frame',  descTemplate: 'ingredient powder swirling above the product',            motion: { cameraMove: 'up', intensity: 50 } },
    { shotType: 'closeup',       descTemplate: 'capsule split cross-section showing active inside',      motion: { zoomDirection: 'in', intensity: 60 } },
  ],
  lifestyle: [
    { shotType: 'environment',   descTemplate: 'outdoor morning walk, soft natural light',               motion: { cameraMove: 'left', intensity: 20 } },
    { shotType: 'medium',        descTemplate: 'kitchen counter with product, morning light',            motion: { cameraMove: 'right', intensity: 25 } },
    { shotType: 'reaction',      descTemplate: 'confident smile in the mirror',                          motion: { handheldAmount: 20 } },
  ],
  recovery: [
    { shotType: 'closeup',       descTemplate: 'relieved face exhale, soft warm light',                  motion: { zoomDirection: 'in', intensity: 30, easing: 'ease-out' } },
    { shotType: 'medium',        descTemplate: 'energetic stretch by window, morning glow',              motion: { cameraMove: 'up', intensity: 30 } },
    { shotType: 'reaction',      descTemplate: 'genuine smile catching light',                           motion: { handheldAmount: 15 } },
  ],
  social_proof: [
    { shotType: 'overlay_space', descTemplate: 'review cards row with ★★★★★ ratings and short quotes',   motion: { cameraMove: 'left', intensity: 30 } },
    { shotType: 'medium',        descTemplate: 'Malaysian customers selfie collage, real UGC feel',       motion: { handheldAmount: 25 } },
    { shotType: 'detail',        descTemplate: 'WhatsApp screenshot snippet, genuine review chat',        motion: { zoomDirection: 'in', intensity: 20 } },
  ],
  cta: [
    { shotType: 'closeup',       descTemplate: 'eye-contact direct address, confident smile',            motion: { zoomDirection: 'in', intensity: 55, handheldAmount: 20, easing: 'ease-in' } },
    { shotType: 'product_focus', descTemplate: 'product hero with CTA button visible nearby',            motion: { zoomDirection: 'in', intensity: 60 } },
    { shotType: 'overlay_space', descTemplate: 'urgency / discount overlay text-ready frame',            motion: { zoomDirection: 'in', intensity: 50, blurAmount: 15 } },
  ],
}

/** P5 — Derive 3-6 coverage shots for a master scene based on its visualRole. */
export function deriveCoverageShots(
  master: SceneBlueprint,
  startShotId: number,
  options: { minShots?: number; maxShots?: number } = {},
): CoverageShot[] {
  const role = master.visualRole ?? inferVisualRole(master)
  const templates = COVERAGE_TEMPLATES[role] ?? COVERAGE_TEMPLATES['sensory']
  const minShots = options.minShots ?? 3
  const maxShots = options.maxShots ?? 6
  const count = Math.max(minShots, Math.min(maxShots, templates.length))
  const continuityGroup = master.continuityGroup ?? `cg_master_${master.sceneId}`

  const shots: CoverageShot[] = []
  // First coverage shot is always the MASTER itself
  shots.push({
    shotId: startShotId,
    masterSceneId: master.sceneId,
    shotType: 'master',
    shotDescription: master.subjectAction ?? master.sceneGoal ?? `${role} master`,
    motion: master.motion ?? { intensity: 30, easing: 'ease-in-out' },
    continuityGroup,
    durationSec: 2.5,
    visualRole: role,
  })
  // Then template-driven coverage shots
  for (let i = 0; i < count; i++) {
    const tpl = templates[i % templates.length]
    shots.push({
      shotId: startShotId + i + 1,
      masterSceneId: master.sceneId,
      shotType: tpl.shotType,
      shotDescription: tpl.descTemplate,
      motion: { ...tpl.motion },
      continuityGroup,
      durationSec: 2.0,
      visualRole: role,
    })
  }
  return shots
}

// ═════════════════════════════════════════════════════════════════════════
// P6 — CONTINUITY SYSTEM
// ═════════════════════════════════════════════════════════════════════════

/** Hash for grouping shots that share identity bundle. */
function continuityKeyOf(b: SceneBlueprint): string {
  const wardrobe   = (b.wardrobeStyle  ?? 'unset').toLowerCase().replace(/\s+/g, '-')
  const lighting   = (b.lightingStyle  ?? 'natural').toLowerCase().split(/\s+/)[0]
  const env        = (b.environmentType ?? b.environment ?? 'home').toLowerCase().split(/\s+/)[0]
  const focus      = b.subjectFocus ?? 'person'
  return `cg_${focus}_${wardrobe}_${lighting}_${env}`
}

/** P6 — Assign continuity groups to coverage shots. Returns ContinuityGroup[]
 *  and mutates the shots in place with .continuityGroup. */
export function assignContinuityGroups(
  masters: SceneBlueprint[],
  shots: CoverageShot[],
): ContinuityGroup[] {
  const groups = new Map<string, ContinuityGroup>()

  for (const master of masters) {
    const groupId = master.continuityGroup ?? continuityKeyOf(master)
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        groupId,
        avatarRef: master.subjectAction ?? `master_${master.sceneId}`,
        wardrobe: master.wardrobeStyle ?? 'home casual',
        lightingFamily: (master.lightingStyle ?? 'natural').split(/\s+/)[0],
        roomTone: master.environmentType ?? master.environment ?? 'home',
        productRef: master.subjectFocus === 'person' ? 'avatar+product' : 'product-only',
        shotIds: [],
      })
    }
    const group = groups.get(groupId)!
    for (const shot of shots.filter((s) => s.masterSceneId === master.sceneId)) {
      shot.continuityGroup = groupId
      group.shotIds.push(shot.shotId)
    }
  }

  return Array.from(groups.values())
}

// ═════════════════════════════════════════════════════════════════════════
// P7 — MOTION BLUEPRINT MAPPING
// ═════════════════════════════════════════════════════════════════════════

const ROLE_MOTION: Record<VisualRole, MotionBlueprint> = {
  hook:           { zoomDirection: 'in',  intensity: 70, handheldAmount: 30, easing: 'ease-in' },
  pain:           { zoomDirection: 'in',  intensity: 25, handheldAmount: 40, easing: 'ease-in' },
  reaction:       { zoomDirection: 'in',  intensity: 35, handheldAmount: 45 },
  education:      { zoomDirection: 'in',  intensity: 30, easing: 'ease-out' },
  sensory:        { zoomDirection: 'in',  intensity: 35, easing: 'ease-in-out' },
  product_reveal: { zoomDirection: 'in',  intensity: 45 },
  credibility:    { zoomDirection: 'in',  intensity: 25 },
  ingredient:     { cameraMove: 'up',     intensity: 40, easing: 'ease-out' },
  lifestyle:      { cameraMove: 'right',  intensity: 25 },
  recovery:       { zoomDirection: 'in',  intensity: 30, easing: 'ease-out' },
  social_proof:   { cameraMove: 'left',   intensity: 30 },
  cta:            { zoomDirection: 'in',  intensity: 80, blurAmount: 20, easing: 'ease-in' },
}

/** Cinematic camera grammar → motion blueprint hint, layered on top of role
 *  motion. The richer of the two wins per field. */
const GRAMMAR_MOTION: Partial<Record<CameraGrammar, MotionBlueprint>> = {
  punch_zoom:     { zoomDirection: 'in',  intensity: 80, blurAmount: 30, easing: 'ease-in' },
  slow_push:     { zoomDirection: 'in',  intensity: 30, easing: 'ease-out' },
  parallax_depth: { zoomDirection: 'in',  intensity: 25, easing: 'ease-in-out' },
  shake_micro:    { handheldAmount: 60 },
  emotional_zoom: { zoomDirection: 'in',  intensity: 40, easing: 'ease-out' },
  product_macro:  { zoomDirection: 'in',  intensity: 50 },
  orbit_soft:     { cameraMove: 'right',  intensity: 40 },
  drift_left:     { cameraMove: 'left',   intensity: 25 },
  drift_right:    { cameraMove: 'right',  intensity: 25 },
  topdown_float:  { cameraMove: 'up',     intensity: 30, easing: 'ease-in-out' },
  review_pan:     { cameraMove: 'left',   intensity: 35 },
  whatsapp_scroll:{ cameraMove: 'up',     intensity: 30 },
  static_tension: { intensity: 5 },
  handheld_close: { handheldAmount: 50, intensity: 25 },
  infographic_float: { zoomDirection: 'in', intensity: 20 },
}

/** Merge two motion blueprints — second one's defined fields override first. */
function mergeMotion(base: MotionBlueprint, overlay: MotionBlueprint): MotionBlueprint {
  return {
    zoomDirection:  overlay.zoomDirection  ?? base.zoomDirection,
    cameraMove:     overlay.cameraMove     ?? base.cameraMove,
    intensity:      overlay.intensity      ?? base.intensity,
    blurAmount:     overlay.blurAmount     ?? base.blurAmount,
    handheldAmount: overlay.handheldAmount ?? base.handheldAmount,
    easing:         overlay.easing         ?? base.easing,
  }
}

/** Compose the final motion blueprint for a master scene: role base +
 *  camera grammar overlay. */
export function buildMotionForMaster(b: SceneBlueprint): MotionBlueprint {
  const role = b.visualRole ?? inferVisualRole(b)
  const base = ROLE_MOTION[role]
  const overlay = b.cameraGrammar ? GRAMMAR_MOTION[b.cameraGrammar] : undefined
  return overlay ? mergeMotion(base, overlay) : { ...base }
}

// ═════════════════════════════════════════════════════════════════════════
// P10 — TIMELINE ENERGY CURVE
// ═════════════════════════════════════════════════════════════════════════
//
// Per-second curve over the voiceover. Used by the timeline assembler to
// pick cut tempo (high energy = shorter cuts). Same shape as Z13's
// computeEnergyArc but indexed by second, not by scene.

/** Per-second energy 0-100 over `durationSec`. */
export function computeTimelineEnergyCurve(durationSec: number): number[] {
  const N = Math.max(1, Math.round(durationSec))
  const points: Array<[number, number]> = [
    [0.00, 90],   // hook spike (first 5s)
    [0.08, 90],   // hold the hook
    [0.10, 70],   // ease into body
    [0.40, 55],   // mid breathing room (education / credibility)
    [0.65, 75],   // re-engagement spike
    [0.75, 60],   // brief dip
    [0.80, 90],   // CTA escalation start
    [1.00, 100],  // final CTA peak
  ]
  const curve: number[] = []
  for (let i = 0; i < N; i++) {
    const t = i / Math.max(1, N - 1)
    let lower = points[0]
    let upper = points[points.length - 1]
    for (let p = 0; p < points.length - 1; p++) {
      if (t >= points[p][0] && t <= points[p + 1][0]) {
        lower = points[p]
        upper = points[p + 1]
        break
      }
    }
    const span = upper[0] - lower[0]
    const localT = span === 0 ? 0 : (t - lower[0]) / span
    const e = Math.round(lower[1] + (upper[1] - lower[1]) * localT)
    curve.push(Math.max(0, Math.min(100, e)))
  }
  return curve
}

// ═════════════════════════════════════════════════════════════════════════
// P9 — TIMELINE ASSEMBLER
// ═════════════════════════════════════════════════════════════════════════
//
// Picks coverage shots in narrative order, assigns durations based on the
// energy curve. Higher energy → shorter cuts (faster pacing).
//
// Timing targets (from spec):
//   HOOK (first 0-5s):  0.8-1.5s per cut
//   MIDDLE (5-45s):     2-3s per cut
//   CTA (45-60s):       1-1.8s per cut

/** Pick cut duration based on energy + phase. */
function durationForEnergy(energy: number): number {
  // High energy (≥85) → 1.0-1.5s cuts (hook / CTA escalation)
  if (energy >= 85) return 1.0 + (100 - energy) * 0.025   // 1.0s @ energy=100, 1.4s @ 85
  // Med-high (70-84) → 1.5-2.0s cuts
  if (energy >= 70) return 1.5 + (84 - energy) * 0.04    // 1.5-2.0s
  // Mid (50-69) → 2.0-2.8s cuts
  if (energy >= 50) return 2.0 + (69 - energy) * 0.04    // 2.0-2.8s
  // Low (<50) → 2.5-3.0s cuts
  return 2.5 + (49 - energy) * 0.01                       // 2.5-3.0s
}

/** P9 — Assemble the editorial timeline by picking coverage shots in order
 *  until voiceDurationSec is filled. */
export function assembleTimeline(
  coverageShots: CoverageShot[],
  voiceDurationSec: number,
): TimelineCut[] {
  if (coverageShots.length === 0 || voiceDurationSec <= 0) return []
  const energyCurve = computeTimelineEnergyCurve(voiceDurationSec)
  const cuts: TimelineCut[] = []

  // Sort coverage shots by their master scene id so narrative order is preserved.
  // Within each master, the master shot comes first (shotType === 'master'),
  // then derived shots.
  const sorted = [...coverageShots].sort((a, b) => {
    if (a.masterSceneId !== b.masterSceneId) return a.masterSceneId - b.masterSceneId
    if (a.shotType === 'master' && b.shotType !== 'master') return -1
    if (b.shotType === 'master' && a.shotType !== 'master') return 1
    return a.shotId - b.shotId
  })

  // Distribute voice time across masters proportionally to coverage count
  // so longer-coverage masters get more screen-time. Within each master,
  // pace via energy curve.
  let cursorSec = 0
  let cutId = 1
  let lastVisualRoleAtTransition: VisualRole | null = null

  for (const shot of sorted) {
    if (cursorSec >= voiceDurationSec) break
    const energySample = energyCurve[Math.floor(cursorSec)] ?? 60
    const baseDuration = durationForEnergy(energySample)
    const remaining = voiceDurationSec - cursorSec
    const duration = Math.min(baseDuration, remaining)
    if (duration < 0.3) break  // skip tiny remainders

    cuts.push({
      cutId: cutId++,
      coverageShotId: shot.shotId,
      masterSceneId: shot.masterSceneId,
      startSec: round1(cursorSec),
      endSec: round1(cursorSec + duration),
      durationSec: round1(duration),
      visualRole: shot.visualRole,
      energy: energySample,
      transition: pickTransition(shot.visualRole, lastVisualRoleAtTransition),
    })
    lastVisualRoleAtTransition = shot.visualRole
    cursorSec += duration
  }

  return cuts
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

// ═════════════════════════════════════════════════════════════════════════
// P11 — TRANSITION GRAPH
// ═════════════════════════════════════════════════════════════════════════

/** Pick a transition INTO a cut based on the current and previous role.
 *  Anti-repeat handled by buildTransitionGraph below. */
function pickTransition(
  current: VisualRole,
  prev: VisualRole | null,
): EditorialTransition {
  // Destination-driven rules
  if (current === 'cta') return 'flash'
  if (current === 'hook') return 'smash_cut'
  if (current === 'education' || current === 'credibility' || current === 'ingredient') return 'blur_wipe'
  if (current === 'social_proof') return 'dissolve'
  if (current === 'recovery') return 'dissolve'
  if (current === 'sensory' || current === 'lifestyle') return 'dissolve'
  // Source-driven fallbacks
  if (prev === 'pain' && current === 'reaction') return 'smash_cut'
  return 'cut'
}

/** P11 — Build the cut-to-cut transition graph with anti-repeat enforcement.
 *  Mutates cuts in place to ensure no 2 same transitions in a row. */
export function buildTransitionGraph(
  cuts: TimelineCut[],
): EditorialBlueprint['transitionGraph'] {
  if (cuts.length === 0) return []
  const graph: EditorialBlueprint['transitionGraph'] = []
  const ALT_POOL: EditorialTransition[] = ['cut', 'dissolve', 'whip', 'blur_wipe']
  let lastTransition: EditorialTransition | null = null
  let consecutiveSame = 0

  for (let i = 1; i < cuts.length; i++) {
    let t = cuts[i].transition
    if (lastTransition && t === lastTransition) {
      consecutiveSame++
      if (consecutiveSame >= 1) {
        const alt = ALT_POOL.find((a) => a !== t && a !== lastTransition) ?? 'cut'
        t = alt
        cuts[i] = { ...cuts[i], transition: alt }
        consecutiveSame = 0
      }
    } else {
      consecutiveSame = 0
    }
    lastTransition = t
    graph.push({
      fromCutId: cuts[i - 1].cutId,
      toCutId:   cuts[i].cutId,
      type:      t,
    })
  }
  return graph
}

// ═════════════════════════════════════════════════════════════════════════
// TOP-LEVEL COORDINATOR — buildEditorialBlueprint
// ═════════════════════════════════════════════════════════════════════════
//
// Pipeline order:
//   1. infer visualRole on every master scene (if missing)
//   2. enforceVisualRoleDiversity (P2 — E1/E2/E3)
//   3. autoMutateRepetitive (P3+P4 — semantic similarity gate)
//   4. compute motion blueprint per master (P7)
//   5. derive coverage shots per master (P5)
//   6. assignContinuityGroups (P6)
//   7. assembleTimeline (P9 — uses P10 energy curve)
//   8. buildTransitionGraph (P11)

export interface BuildEditorialOptions {
  voiceDurationSec: number
  minShotsPerMaster?: number
  maxShotsPerMaster?: number
  /** Z28 — explicit timeline mode. When set, overrides the Z25 default
   *  fixed shotsPerMaster cap with mode-specific values, and propagates
   *  to buildTimelineCuts for duration-band scaling. */
  mode?: TimelineMode
}

export function buildEditorialBlueprint(
  rawMasters: SceneBlueprint[],
  options: BuildEditorialOptions,
): EditorialBlueprint {
  // ── 1. Infer visualRole everywhere it's missing ──────────────────────
  // The narrowed type below tells TS that visualRole is non-optional after
  // step 1. enforceVisualRoleDiversity + autoMutateRepetitive return the
  // same shape (they only ever copy/mutate, never strip visualRole), so we
  // cast the result back to the narrowed type to preserve the guarantee.
  type MasterWithRole = SceneBlueprint & { visualRole: NonNullable<SceneBlueprint['visualRole']> }
  let masters: MasterWithRole[] = rawMasters.map((b) => ({
    ...b,
    visualRole: (b.visualRole ?? inferVisualRole(b)) as MasterWithRole['visualRole'],
  }))

  // ── 2. Enforce visual role diversity ─────────────────────────────────
  masters = enforceVisualRoleDiversity(masters) as MasterWithRole[]

  // ── 3. Auto-mutate semantically duplicate consecutive scenes ─────────
  masters = autoMutateRepetitive(masters) as MasterWithRole[]

  // ── 4. Build motion blueprint per master ─────────────────────────────
  masters = masters.map((m) => ({ ...m, motion: m.motion ?? buildMotionForMaster(m) }))

  // ── 5. Z25/Z28 COST CAP — coverage shots ────────────────────────────
  // Z25 baseline: 1-2 template shots per master + 1 master = 2-3 per master
  // Z28: when mode is set, use mode.shotsPerMaster (SHORT 2-3 / MID 3-4
  //      / FULL 4-5) so the cuts/master ratio matches the target output
  //      duration. Without mode, the Z25 cheap defaults apply.
  const modeConfig = options.mode ? getModeConfig(options.mode) : null
  const minShots = options.minShotsPerMaster
    ?? (modeConfig ? Math.max(1, modeConfig.shotsPerMaster.min - 1) : 1)
  const maxShots = options.maxShotsPerMaster
    ?? (modeConfig ? Math.max(1, modeConfig.shotsPerMaster.max - 1) : 2)

  const coverageShots: CoverageShot[] = []
  let shotIdCursor = 1
  for (const master of masters) {
    const shots = ceDeriveCoverageShots(master, shotIdCursor, { minShots, maxShots })
    coverageShots.push(...shots)
    shotIdCursor += shots.length
    console.log(`[COVERAGE] scene-${master.sceneId} (${master.visualRole}) generated ${shots.length} coverage shots`)
  }
  void tlRecommendCoverageShotCount  // kept for back-compat — see note above

  // ── 5b. Z21 — Enforce coverage diversity (similarity ≥ 0.72 → mutate) ─
  const diverseShots = ceEnforceCoverageDiversity(coverageShots, 0.72)

  // ── 6. Assign continuity groups ──────────────────────────────────────
  const continuityGroups = assignContinuityGroups(masters, diverseShots)

  // ── 7. Z21/Z28 — Assemble timeline via phase-aware assembler ─────────
  const timelineCuts = tlBuildTimelineCuts(diverseShots, {
    voiceDurationSec: options.voiceDurationSec,
    mode: options.mode,  // Z28 — drives maxCuts + duration band per mode
  })

  // ── 8. Build the cut-to-cut transition graph (Z17 — back-compat) ────
  const transitionGraph = buildTransitionGraph(timelineCuts)

  // Parallel motion blueprints array
  const motionBlueprints = diverseShots.map((s) => s.motion)

  // Energy curve at second-granularity (Z21 refined arc)
  const energyCurve = tlBuildEnergyCurve(options.voiceDurationSec)

  // Estimated total duration = sum of cut durations
  const estimatedDurationSec = timelineCuts.reduce((sum, c) => sum + c.durationSec, 0)

  console.log(
    `[TIMELINE] ${options.voiceDurationSec}s voice → ${timelineCuts.length} cuts ` +
    `(estimated ${estimatedDurationSec.toFixed(1)}s, ${diverseShots.length} coverage shots, ` +
    `${masters.length} masters, ${continuityGroups.length} continuity groups)`,
  )

  // Phase density summary
  const phaseSummary = tlSummarizePhaseDensities(timelineCuts)
  console.log(
    `[PACING] hook_density=${phaseSummary.hook} · body_density=${phaseSummary.body} · ` +
    `education_density=${phaseSummary.education} · recovery_density=${phaseSummary.recovery} · ` +
    `cta_density=${phaseSummary.cta}`,
  )

  return {
    masterScenes: masters,
    coverageShots: diverseShots,
    timelineCuts,
    motionBlueprints,
    energyCurve,
    continuityGroups,
    transitionGraph,
    voiceDurationSec: options.voiceDurationSec,
    estimatedDurationSec,
  }
}
