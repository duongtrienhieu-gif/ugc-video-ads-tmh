// ── Kling Motion Normalizer ──────────────────────────────────────────────────
// Z22 — Strict mapping layer between EDITORIAL motion grammar (the rich
// internal vocabulary produced by Z13 cinematic engine + Z17 motion
// blueprints + Z21 cut types) and the small set of motion verbs Kling 3.0
// actually understands.
//
// CRITICAL: Never send editorial motion strings ("smash_cut", "punch_zoom",
// "whip_pan_fast", "parallax_depth", etc.) directly to Kling — they cause
// 422 / generation failures because Kling's prompt parser doesn't have them
// in its motion dictionary.
//
// Pure logic — no API calls.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CameraGrammar, EditorialTransition, MotionBlueprint,
  KlingSafeMotion, VisualRole,
} from '../types'

// ═════════════════════════════════════════════════════════════════════════
// 1. Camera grammar → Kling-safe motion
// ═════════════════════════════════════════════════════════════════════════

const CAMERA_GRAMMAR_TO_KLING: Record<CameraGrammar, KlingSafeMotion> = {
  handheld_close:   'handheld',
  slow_push:        'dolly_in',
  punch_zoom:       'zoom_in',
  drift_left:       'pan_left',
  drift_right:      'pan_right',
  orbit_soft:       'pan_right',     // Kling has no orbit — gentle pan
  parallax_depth:   'dolly_in',      // depth feel via dolly
  static_tension:   'static',
  shake_micro:      'handheld',
  topdown_float:    'tilt_down',
  review_pan:       'pan_left',
  whatsapp_scroll:  'tilt_up',       // vertical scroll feel
  infographic_float:'dolly_in',
  emotional_zoom:   'zoom_in',
  product_macro:    'zoom_in',
}

// ═════════════════════════════════════════════════════════════════════════
// 2. Editorial transition / cut type → Kling-safe motion
// ═════════════════════════════════════════════════════════════════════════
//
// Transitions are FX between cuts, NOT camera moves. But when no other
// motion signal exists, we use the transition's energy as a hint for the
// cut's internal motion.

const TRANSITION_TO_KLING: Record<EditorialTransition, KlingSafeMotion> = {
  cut:          'static',
  smash_cut:    'zoom_in',
  whip:         'pan_right',     // whip pan
  dissolve:     'static',
  blur_wipe:    'dolly_in',
  flash:        'zoom_in',
}

// ═════════════════════════════════════════════════════════════════════════
// 3. MotionBlueprint → Kling-safe motion (derived from zoom + camera move)
// ═════════════════════════════════════════════════════════════════════════
//
// Per Z17 MotionBlueprint shape: { zoomDirection, cameraMove, intensity,
// blurAmount, handheldAmount, easing }. We pick the dominant signal.

function motionFromBlueprint(motion: MotionBlueprint | undefined): KlingSafeMotion | null {
  if (!motion) return null

  // Strong handheld → handheld wins
  if ((motion.handheldAmount ?? 0) >= 40) return 'handheld'

  // Zoom signal — explicit direction takes priority
  if (motion.zoomDirection === 'in')  return 'zoom_in'
  if (motion.zoomDirection === 'out') return 'zoom_out'

  // Camera move signal
  if (motion.cameraMove === 'left')  return 'pan_left'
  if (motion.cameraMove === 'right') return 'pan_right'
  if (motion.cameraMove === 'up')    return 'tilt_up'
  if (motion.cameraMove === 'down')  return 'tilt_down'

  // High intensity but no direction → handheld energy
  if ((motion.intensity ?? 0) >= 70) return 'handheld'

  return null
}

// ═════════════════════════════════════════════════════════════════════════
// 4. VisualRole → fallback Kling motion (last resort)
// ═════════════════════════════════════════════════════════════════════════

const ROLE_DEFAULT_KLING: Record<VisualRole, KlingSafeMotion> = {
  hook:           'zoom_in',
  pain:           'handheld',
  reaction:       'handheld',
  education:      'dolly_in',
  sensory:        'dolly_in',
  product_reveal: 'zoom_in',
  credibility:    'static',
  ingredient:     'dolly_in',
  lifestyle:      'pan_right',
  recovery:       'zoom_in',
  social_proof:   'pan_left',
  cta:            'zoom_in',
}

// ═════════════════════════════════════════════════════════════════════════
// 5. PUBLIC API
// ═════════════════════════════════════════════════════════════════════════

export interface NormalizeContext {
  cameraGrammar?: CameraGrammar
  transition?: EditorialTransition
  motion?: MotionBlueprint
  visualRole?: VisualRole
}

/**
 * Pick a Kling-safe motion verb from the editorial signals.
 *
 * Priority order:
 *   1. MotionBlueprint (most specific — has explicit zoom/pan/intensity)
 *   2. CameraGrammar (Z13 editorial layer)
 *   3. EditorialTransition (only when no camera signal)
 *   4. VisualRole default (last resort)
 *   5. 'static' (absolute fallback)
 */
export function normalizeKlingMotion(ctx: NormalizeContext): KlingSafeMotion {
  // 1. Try MotionBlueprint
  const fromMotion = motionFromBlueprint(ctx.motion)
  if (fromMotion) return fromMotion

  // 2. Try CameraGrammar
  if (ctx.cameraGrammar && CAMERA_GRAMMAR_TO_KLING[ctx.cameraGrammar]) {
    return CAMERA_GRAMMAR_TO_KLING[ctx.cameraGrammar]
  }

  // 3. Try transition
  if (ctx.transition && TRANSITION_TO_KLING[ctx.transition]) {
    return TRANSITION_TO_KLING[ctx.transition]
  }

  // 4. VisualRole default
  if (ctx.visualRole && ROLE_DEFAULT_KLING[ctx.visualRole]) {
    return ROLE_DEFAULT_KLING[ctx.visualRole]
  }

  // 5. Absolute fallback
  return 'static'
}

// ═════════════════════════════════════════════════════════════════════════
// 6. Motion → human-readable English phrase for the Kling prompt
// ═════════════════════════════════════════════════════════════════════════
//
// Kling 3.0 reads natural language better than enum strings. We emit a
// short phrase that describes the motion in plain English. Always single-
// line (no newlines).

const MOTION_PHRASE: Record<KlingSafeMotion, string> = {
  zoom_in:    'slow gentle zoom in toward the subject',
  zoom_out:   'slow gentle zoom out from the subject',
  pan_left:   'slow horizontal camera pan to the left',
  pan_right:  'slow horizontal camera pan to the right',
  tilt_up:    'gentle camera tilt upward',
  tilt_down:  'gentle camera tilt downward',
  dolly_in:   'subtle camera dolly forward, very gentle ~5% closer',
  dolly_out:  'subtle camera dolly back, gentle reveal',
  static:     'locked-off tripod, no camera movement',
  handheld:   'subtle handheld micro-shake, realistic phone camera feel',
}

export function klingMotionPhrase(motion: KlingSafeMotion): string {
  return MOTION_PHRASE[motion]
}

// ═════════════════════════════════════════════════════════════════════════
// 7. Validation guard
// ═════════════════════════════════════════════════════════════════════════

const VALID_KLING_MOTIONS: ReadonlySet<KlingSafeMotion> = new Set<KlingSafeMotion>([
  'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down',
  'dolly_in', 'dolly_out', 'static', 'handheld',
])

/** Guard against any string sneaking in. Returns the input if valid, or
 *  'static' as the safest fallback. */
export function ensureSafeMotion(motion: string | undefined): KlingSafeMotion {
  if (motion && VALID_KLING_MOTIONS.has(motion as KlingSafeMotion)) {
    return motion as KlingSafeMotion
  }
  return 'static'
}
