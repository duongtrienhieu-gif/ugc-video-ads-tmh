// ── Coverage Engine ──────────────────────────────────────────────────────────
// Z21 P18 — derives 3-6 coverage shots per master scene with rich editor-
// semantic roles. Sits on top of the Z17 editorialIntelligence layer; adds:
//
//   • 6 templates per visualRole (was 3-5 in Z17) — more variety
//   • CoverageShotRole semantic tag per shot (closeup / macro / wide / ...)
//   • promptDelta — what changes vs master prompt (for renderer phase)
//   • Coverage-specific similarity engine (0.72 threshold) — different
//     weights than Z17's scene-level similarity
//   • Mutation table for repetitive coverage sequences
//
// All pure logic — NO Gemini calls. Template-driven + local inference.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SceneBlueprint, CoverageShot, CoverageShotRole, CoverageShotType,
  MotionBlueprint, VisualRole,
} from '../types'
import { inferVisualRole, buildMotionForMaster } from './editorialIntelligence'

// ═════════════════════════════════════════════════════════════════════════
// COVERAGE TEMPLATES V2 — 6 shots per visualRole, matching spec exactly.
// Each template pairs a CoverageShotRole + CoverageShotType + English desc
// + base motion + promptDelta.
// ═════════════════════════════════════════════════════════════════════════

export interface CoverageTemplate {
  coverageRole: CoverageShotRole
  shotType: CoverageShotType
  /** Short English description fed to the future renderer */
  desc: string
  /** Delta phrase — what changes vs the master scene's prompt */
  promptDelta: string
  /** Base motion blueprint */
  motion: MotionBlueprint
}

export const COVERAGE_TEMPLATES_V2: Record<VisualRole, CoverageTemplate[]> = {
  pain: [
    { coverageRole: 'closeup',     shotType: 'closeup',     desc: 'forehead closeup, weary expression',           promptDelta: 'tight crop on forehead, hand resting on temple', motion: { zoomDirection: 'in', intensity: 30, handheldAmount: 25 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'tired eyes macro, dark circles visible',       promptDelta: 'extreme macro on eyes, dim cool light, fatigue detail', motion: { zoomDirection: 'in', intensity: 50 } },
    { coverageRole: 'insert',      shotType: 'crop',        desc: 'blurry laptop POV with blue screen glow',      promptDelta: 'over-shoulder POV of laptop screen, slight blur', motion: { zoomDirection: 'in', intensity: 20 } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'phone frustration scroll, slumped posture',    promptDelta: 'reaction to phone notification, frustrated', motion: { handheldAmount: 45 } },
    { coverageRole: 'wide',        shotType: 'environment', desc: 'messy desk wide, dim ambient light',           promptDelta: 'pull back to wide environment, dim cluttered desk', motion: { cameraMove: 'left', intensity: 20 } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'slow sigh portrait, exhale moment',            promptDelta: 'subject exhales, eyes closed briefly', motion: { zoomDirection: 'in', intensity: 25, easing: 'ease-out' } },
  ],
  reaction: [
    { coverageRole: 'closeup',     shotType: 'closeup',     desc: 'frustrated face crop, brow furrow',            promptDelta: 'tight crop on furrowed brow', motion: { zoomDirection: 'in', intensity: 30, handheldAmount: 50 } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'eye roll / sigh / disbelief',                  promptDelta: 'eye roll reaction shot', motion: { handheldAmount: 40 } },
    { coverageRole: 'hand_detail', shotType: 'detail',      desc: 'tossing failed product to side',               promptDelta: 'hand discards product to side, frustrated', motion: { cameraMove: 'right', intensity: 40 } },
    { coverageRole: 'insert',      shotType: 'crop',        desc: 'crumpled receipt / failed attempt',            promptDelta: 'insert: failed alternative product on counter', motion: { intensity: 15 } },
    { coverageRole: 'wide',        shotType: 'environment', desc: 'wide of subject + competitor clutter',         promptDelta: 'wider shot revealing failed attempts', motion: { cameraMove: 'left', intensity: 20 } },
    { coverageRole: 'closeup',     shotType: 'closeup',     desc: 'shaking head, slight disgust',                 promptDelta: 'closeup: head shake, disappointed', motion: { handheldAmount: 35 } },
  ],
  hook: [
    { coverageRole: 'closeup',     shotType: 'closeup',     desc: 'tight eye-level reaction, snap-zoom feel',     promptDelta: 'punch zoom into eye-level reaction', motion: { zoomDirection: 'in', intensity: 70, easing: 'ease-in' } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'expressive surprise, slight tilt',             promptDelta: 'expressive face on hook moment', motion: { zoomDirection: 'in', intensity: 50, handheldAmount: 25 } },
    { coverageRole: 'motion_anchor', shotType: 'motion_frame', desc: 'punch-zoom into product mid-reveal',        promptDelta: 'fast snap zoom to product reveal', motion: { zoomDirection: 'in', intensity: 85, blurAmount: 30 } },
    { coverageRole: 'insert',      shotType: 'crop',        desc: 'overlay-ready frame, text headroom',           promptDelta: 'compose with negative space for headline overlay', motion: { zoomDirection: 'in', intensity: 30 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'product label flash detail',                   promptDelta: 'macro flash on product label', motion: { zoomDirection: 'in', intensity: 60 } },
    { coverageRole: 'environment', shotType: 'environment', desc: 'wide hook environment establishing shot',      promptDelta: 'wide establishing of hook environment', motion: { cameraMove: 'left', intensity: 30 } },
  ],
  education: [
    { coverageRole: 'motion_anchor', shotType: 'motion_frame', desc: 'molecular orbit around product, blue glow', promptDelta: 'molecular structures orbiting product, glowing chemistry feel', motion: { cameraMove: 'right', intensity: 35 } },
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'nervous system diagram with energy paths',  promptDelta: 'body system diagram with energy flow infographic', motion: { zoomDirection: 'in', intensity: 25 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'capsule cross-section showing actives',        promptDelta: 'capsule splitting open revealing active compounds', motion: { zoomDirection: 'in', intensity: 60 } },
    { coverageRole: 'motion_anchor', shotType: 'motion_frame', desc: 'vitamin chain visual, glowing nodes',       promptDelta: 'vitamin molecule chain animation, glowing nodes', motion: { cameraMove: 'up', intensity: 40 } },
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'energy conversion infographic, body silhouette', promptDelta: 'energy conversion infographic over body silhouette', motion: { zoomDirection: 'in', intensity: 30 } },
    { coverageRole: 'motion_anchor', shotType: 'motion_frame', desc: 'animated nutrient flow through body diagram', promptDelta: 'animated nutrient flow particles through body', motion: { cameraMove: 'up', intensity: 50 } },
  ],
  sensory: [
    { coverageRole: 'closeup',     shotType: 'closeup',     desc: 'hand touching skin / feeling texture',         promptDelta: 'tactile closeup of skin texture', motion: { zoomDirection: 'in', intensity: 35 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'water droplet / soft glow detail',             promptDelta: 'macro of water droplet sliding down', motion: { easing: 'ease-out', intensity: 20 } },
    { coverageRole: 'motion_anchor', shotType: 'motion_frame', desc: 'macro float with ambient particles',       promptDelta: 'macro float with soft ambient particles', motion: { cameraMove: 'up', intensity: 40, easing: 'ease-in-out' } },
    { coverageRole: 'hand_detail', shotType: 'detail',      desc: 'fingertip touching capsule surface',           promptDelta: 'fingertip texture contact with product', motion: { handheldAmount: 15 } },
    { coverageRole: 'closeup',     shotType: 'reaction',    desc: 'eyes-closed peaceful expression',              promptDelta: 'closeup of peaceful eyes closed', motion: { zoomDirection: 'in', intensity: 20, easing: 'ease-out' } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'water splash slow-motion macro',               promptDelta: 'slow-motion macro of water splash', motion: { easing: 'ease-out', intensity: 25 } },
  ],
  product_reveal: [
    { coverageRole: 'product_macro', shotType: 'closeup',   desc: 'bottle hero center, soft glow halo',          promptDelta: 'product centered with soft halo glow', motion: { zoomDirection: 'in', intensity: 45 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'label macro, every letter readable',           promptDelta: 'extreme macro on label typography', motion: { zoomDirection: 'in', intensity: 35 } },
    { coverageRole: 'hand_detail', shotType: 'product_focus', desc: 'hand holding product at chest level',       promptDelta: 'hand reveals product at chest level', motion: { handheldAmount: 25 } },
    { coverageRole: 'environment', shotType: 'crop',        desc: 'product on counter with morning light',        promptDelta: 'product on kitchen counter, soft morning light', motion: { zoomDirection: 'in', intensity: 25 } },
    { coverageRole: 'motion_anchor', shotType: 'motion_frame', desc: 'bottle rotation 360 turntable anchor',     promptDelta: 'product rotating 360 on turntable', motion: { cameraMove: 'right', intensity: 55 } },
    { coverageRole: 'product_macro', shotType: 'closeup',   desc: 'glowing halo shot with subtle particles',     promptDelta: 'product with soft glowing halo and particles', motion: { zoomDirection: 'in', intensity: 35 } },
  ],
  credibility: [
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'metric cards floating (★4.8/5, 20k users)', promptDelta: 'metric cards floating around product', motion: { zoomDirection: 'in', intensity: 25 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'KKM-verified badge closeup',                  promptDelta: 'KKM verified badge shield macro', motion: { zoomDirection: 'in', intensity: 30 } },
    { coverageRole: 'wide',        shotType: 'medium',      desc: 'testimonial card row drifting',                promptDelta: 'row of testimonial chips drifting horizontally', motion: { cameraMove: 'left', intensity: 35 } },
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'COD Malaysia trust badge frame',            promptDelta: 'COD Malaysia badge with truck icon', motion: { intensity: 20 } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'satisfied customer selfie still',              promptDelta: 'real customer selfie with product', motion: { handheldAmount: 20 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'star rating graphics overlay closeup',         promptDelta: 'macro on ★★★★★ rating graphics', motion: { zoomDirection: 'in', intensity: 25 } },
  ],
  ingredient: [
    { coverageRole: 'ingredient',  shotType: 'detail',      desc: 'fresh fruit/herb macro with dew',              promptDelta: 'fresh herb macro with morning dew', motion: { handheldAmount: 10, easing: 'ease-out' } },
    { coverageRole: 'motion_anchor', shotType: 'motion_frame', desc: 'ingredient powder swirl above product',    promptDelta: 'ingredient powder swirling above bottle', motion: { cameraMove: 'up', intensity: 50 } },
    { coverageRole: 'macro',       shotType: 'closeup',     desc: 'capsule split cross-section, actives visible', promptDelta: 'capsule splits revealing active compound', motion: { zoomDirection: 'in', intensity: 60 } },
    { coverageRole: 'environment', shotType: 'environment', desc: 'herb flatlay arrangement, natural daylight',   promptDelta: 'flatlay arrangement of fresh herbs and ingredients', motion: { cameraMove: 'up', intensity: 25 } },
    { coverageRole: 'hand_detail', shotType: 'detail',      desc: 'chew tablet detail in hand',                   promptDelta: 'tablet held between fingers, soft daylight', motion: { handheldAmount: 15 } },
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'nutrition composition infographic',         promptDelta: 'nutrition composition card overlay', motion: { intensity: 20 } },
  ],
  lifestyle: [
    { coverageRole: 'environment', shotType: 'environment', desc: 'outdoor morning walk, soft natural light',     promptDelta: 'lifestyle wide shot outdoor morning', motion: { cameraMove: 'left', intensity: 20 } },
    { coverageRole: 'wide',        shotType: 'medium',      desc: 'kitchen counter with product, morning light',  promptDelta: 'kitchen lifestyle with product subtly placed', motion: { cameraMove: 'right', intensity: 25 } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'confident smile in the mirror',                promptDelta: 'mirror reaction shot confident smile', motion: { handheldAmount: 20 } },
    { coverageRole: 'environment', shotType: 'environment', desc: 'cafe table with laptop and product',           promptDelta: 'cafe productive scene with product visible', motion: { cameraMove: 'left', intensity: 25 } },
    { coverageRole: 'closeup',     shotType: 'closeup',     desc: 'genuine smile catching natural light',         promptDelta: 'closeup of genuine smile in natural light', motion: { handheldAmount: 15 } },
    { coverageRole: 'motion_anchor', shotType: 'motion_frame', desc: 'subject walking past frame',                promptDelta: 'subject walks confidently across frame', motion: { cameraMove: 'right', intensity: 35 } },
  ],
  recovery: [
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'smiling lifestyle moment',                     promptDelta: 'genuine smile, warm relief expression', motion: { handheldAmount: 15 } },
    { coverageRole: 'environment', shotType: 'environment', desc: 'active walking outdoor',                       promptDelta: 'subject walks outdoor with energy', motion: { cameraMove: 'left', intensity: 30 } },
    { coverageRole: 'wide',        shotType: 'medium',      desc: 'healthy morning routine wide',                 promptDelta: 'wide of subject in morning routine, healthy glow', motion: { cameraMove: 'up', intensity: 30 } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'focused work session',                         promptDelta: 'reaction of focused productive work', motion: { zoomDirection: 'in', intensity: 25 } },
    { coverageRole: 'closeup',     shotType: 'reaction',    desc: 'energetic selfie close-up',                    promptDelta: 'energetic selfie closeup, healthy glow', motion: { handheldAmount: 30 } },
    { coverageRole: 'environment', shotType: 'environment', desc: 'kitchen scene with natural light',             promptDelta: 'kitchen recovery scene with natural light', motion: { cameraMove: 'right', intensity: 25 } },
  ],
  social_proof: [
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'testimonial card layout with ★ rating',     promptDelta: 'testimonial card with star rating', motion: { cameraMove: 'left', intensity: 30 } },
    { coverageRole: 'wide',        shotType: 'medium',      desc: 'before/after split frame',                     promptDelta: 'before/after side-by-side composition', motion: { intensity: 20 } },
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'review overlay screenshot mock-up',         promptDelta: 'WhatsApp/Facebook review overlay frame', motion: { zoomDirection: 'in', intensity: 25 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'COD payment / trust badge graphics',           promptDelta: 'macro on COD payment badge', motion: { zoomDirection: 'in', intensity: 20 } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: 'UGC selfie testimonial frame',                 promptDelta: 'UGC selfie of customer with product', motion: { handheldAmount: 30 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'rating graphics overlay ★★★★★',                promptDelta: 'macro on 5-star rating graphics', motion: { zoomDirection: 'in', intensity: 25 } },
  ],
  cta: [
    { coverageRole: 'product_macro', shotType: 'closeup',   desc: 'final product hero, polished light',          promptDelta: 'final hero product shot with polished lighting', motion: { zoomDirection: 'in', intensity: 55 } },
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'promo price overlay frame',                 promptDelta: 'compose for price overlay (RM XX)', motion: { zoomDirection: 'in', intensity: 50 } },
    { coverageRole: 'insert',      shotType: 'overlay_space', desc: 'urgency text frame (HARI INI SAHAJA)',      promptDelta: 'urgency text frame composition', motion: { blurAmount: 15, intensity: 60 } },
    { coverageRole: 'macro',       shotType: 'detail',      desc: 'discount badge / starburst macro',             promptDelta: 'macro on discount badge starburst', motion: { zoomDirection: 'in', intensity: 70 } },
    { coverageRole: 'product_macro', shotType: 'product_focus', desc: 'product + CTA button composition',        promptDelta: 'product with CTA button visible', motion: { zoomDirection: 'in', intensity: 60 } },
    { coverageRole: 'reaction',    shotType: 'reaction',    desc: '"try now" eye-contact confident close',       promptDelta: 'direct eye contact "try now" address', motion: { zoomDirection: 'in', intensity: 65, handheldAmount: 20 } },
  ],
}

/** P5 — return the template list for a given role. */
export function deriveCoverageByRole(role: VisualRole): CoverageTemplate[] {
  return COVERAGE_TEMPLATES_V2[role] ?? COVERAGE_TEMPLATES_V2['sensory']
}

/** P5 — Build prompt delta phrase combining template + master scene. */
export function buildCoveragePrompt(scene: SceneBlueprint, template: CoverageTemplate): string {
  const sceneSubject = scene.subjectAction ?? scene.sceneGoal ?? scene.visualObjective ?? ''
  return sceneSubject ? `${template.promptDelta} — ${sceneSubject}` : template.promptDelta
}

/**
 * Z25 MVP COST CAP — was minShots=3, maxShots=6 (so 6 template shots +
 * 1 master = 7 per master = ~56 total). Now defaults to minShots=1,
 * maxShots=2 (so 1-2 template shots + 1 master = 2-3 per master =
 * ~10-15 total).
 *
 * Template selection: the first 1-2 entries in each COVERAGE_TEMPLATES_V2
 * row are hand-ordered as the STRONGEST picks for that role:
 *   pain/reaction/hook → strongest emotional shot first
 *   product_reveal/cta → strongest product shot first
 *   education/social_proof/credibility → strongest trust shot first
 * Everything past index 1 is treated as a fallback/diversity variant —
 * dropped by default in MVP mode.
 *
 * Callers wanting "Hollywood mode" coverage can still pass higher
 * min/max to opt out of the cost cap.
 */
export function deriveCoverageShots(
  master: SceneBlueprint,
  startShotId: number,
  opts: { minShots?: number; maxShots?: number } = {},
): CoverageShot[] {
  const role = master.visualRole ?? inferVisualRole(master)
  const templates = deriveCoverageByRole(role)
  // Z25 defaults: 1-2 template shots per master (was 3-6).
  const minShots = opts.minShots ?? 1
  const maxShots = Math.min(opts.maxShots ?? 2, templates.length)
  const count = Math.max(minShots, maxShots)
  const continuityGroup = master.continuityGroup ?? `cg_master_${master.sceneId}`

  const shots: CoverageShot[] = []

  // First shot is always the MASTER itself
  shots.push({
    shotId: startShotId,
    masterSceneId: master.sceneId,
    shotType: 'master',
    coverageRole: 'wide',
    shotDescription: master.subjectAction ?? master.sceneGoal ?? `${role} master`,
    promptDelta: 'master scene baseline (no delta)',
    motion: master.motion ?? buildMotionForMaster(master),
    cameraGrammar: master.cameraGrammar,
    continuityGroup,
    durationSec: 2.5,
    visualRole: role,
    derivedFrom: `master_${master.sceneId}`,
  })

  // Template-driven coverage shots — pick the TOP `count` templates
  // (already ordered strongest-first in COVERAGE_TEMPLATES_V2).
  for (let i = 0; i < count; i++) {
    const tpl = templates[i % templates.length]
    shots.push({
      shotId: startShotId + i + 1,
      masterSceneId: master.sceneId,
      shotType: tpl.shotType,
      coverageRole: tpl.coverageRole,
      shotDescription: tpl.desc,
      promptDelta: buildCoveragePrompt(master, tpl),
      motion: { ...tpl.motion },
      cameraGrammar: master.cameraGrammar,
      continuityGroup,
      durationSec: 2.0,
      visualRole: role,
      derivedFrom: `master_${master.sceneId}`,
    })
  }
  return shots
}

// ═════════════════════════════════════════════════════════════════════════
// P8 — COVERAGE SIMILARITY ENGINE
// ═════════════════════════════════════════════════════════════════════════
//
// Compares two CoverageShots on editor-relevant axes. Different weights
// from Z17's scene-level similarity (which compares SceneBlueprints).
//
// Weights (sum 1.0):
//   composition (shotType)    0.20
//   visualRole                0.25
//   prompt keyword overlap    0.20
//   coverageRole              0.15
//   camera grammar match      0.10
//   motion shape match        0.10
//
// Threshold 0.72 → auto-mutate the later shot to a different template.

const KEYWORD_TOKENIZER = /\b[a-z]{4,}\b/gi

function keywordSet(text: string): Set<string> {
  const matches = text.toLowerCase().match(KEYWORD_TOKENIZER) ?? []
  return new Set(matches)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const k of a) if (b.has(k)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function computeCoverageSimilarity(a: CoverageShot, b: CoverageShot): number {
  let score = 0
  if (a.shotType === b.shotType)                           score += 0.20
  if (a.visualRole === b.visualRole)                       score += 0.25
  score += jaccard(keywordSet(a.shotDescription), keywordSet(b.shotDescription)) * 0.20
  if (a.coverageRole && a.coverageRole === b.coverageRole) score += 0.15
  if (a.cameraGrammar && a.cameraGrammar === b.cameraGrammar) score += 0.10
  if (a.motion.zoomDirection && a.motion.zoomDirection === b.motion.zoomDirection) score += 0.05
  if (a.motion.cameraMove    && a.motion.cameraMove    === b.motion.cameraMove)    score += 0.05
  return Math.min(1, score)
}

// Mutation table per spec — when a coverage shot is too similar to its
// neighbor, pick an alternative from this map.
const MUTATION_MAP: Record<CoverageShotRole, CoverageShotRole> = {
  'closeup':       'macro',
  'macro':         'hand_detail',
  'wide':          'reaction',
  'insert':        'environment',
  'reaction':      'closeup',
  'hand_detail':   'product_macro',
  'ingredient':    'environment',
  'product_macro': 'hand_detail',
  'environment':   'wide',
  'motion_anchor': 'macro',
}

/** P8 — Enforce coverage diversity. For every consecutive pair with
 *  similarity ≥ 0.72, mutate the later shot to a different role. */
export function enforceCoverageDiversity(
  shots: CoverageShot[],
  threshold = 0.72,
): CoverageShot[] {
  if (shots.length < 2) return shots
  const out = shots.map((s) => ({ ...s }))
  let mutations = 0

  for (let i = 1; i < out.length; i++) {
    const sim = computeCoverageSimilarity(out[i - 1], out[i])
    if (sim < threshold) continue
    const prevRole = out[i].coverageRole ?? 'wide'
    const newRole = MUTATION_MAP[prevRole]
    // Look up a template that matches the new role within the same visualRole
    const templates = deriveCoverageByRole(out[i].visualRole)
    const candidate = templates.find((t) => t.coverageRole === newRole)
    if (!candidate) continue
    out[i] = {
      ...out[i],
      coverageRole: candidate.coverageRole,
      shotType: candidate.shotType,
      shotDescription: candidate.desc,
      promptDelta: candidate.promptDelta,
      motion: { ...candidate.motion },
    }
    mutations++
    console.log(`[DIVERSITY] mutated shot-${out[i].shotId} (similarity ${sim.toFixed(2)}) → ${candidate.coverageRole}`)
  }

  if (mutations > 0) {
    console.log(`[DIVERSITY] ${mutations} coverage shots mutated (threshold ${threshold})`)
  }
  return out
}

// ═════════════════════════════════════════════════════════════════════════
// P9 — ASSIGN COVERAGE ENERGY
// ═════════════════════════════════════════════════════════════════════════
//
// Each coverage shot inherits the master scene's energy + small variance
// based on its coverageRole (closeups higher energy, wides lower, etc).

const COVERAGE_ROLE_ENERGY_BIAS: Record<CoverageShotRole, number> = {
  closeup:        +8,
  macro:          +5,
  wide:           -8,
  insert:         -3,
  reaction:       +6,
  hand_detail:    +2,
  ingredient:     -2,
  product_macro:  +4,
  environment:    -10,
  motion_anchor:  +10,
}

/** P9 — Assign energy to each coverage shot based on master + role bias. */
export function assignCoverageEnergy(
  shots: CoverageShot[],
  masterEnergyByScene: Map<number, number>,
): CoverageShot[] {
  return shots.map((s) => {
    const baseEnergy = masterEnergyByScene.get(s.masterSceneId) ?? 60
    const bias = s.coverageRole ? COVERAGE_ROLE_ENERGY_BIAS[s.coverageRole] : 0
    // Energy is stored on TimelineCut not CoverageShot — but we attach via
    // motion intensity hint for the renderer. Return shot as-is for now;
    // the timeline assembler reads master energy + role bias too.
    void baseEnergy
    void bias
    return s
  })
}
