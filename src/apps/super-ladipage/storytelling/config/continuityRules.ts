// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — continuity rules
//
// PRIORITY #1 sau architecture. Identity drift = nguyên nhân #1 phá vỡ
// "real person" illusion. Fallback rule: render fail → drop ảnh, giữ
// section text-only. Better missing image than wrong identity.
// ─────────────────────────────────────────────────────────────────────

import type { ContinuityRules } from '../types'

export const CONTINUITY_RULES: ContinuityRules = {
  /** HARD locks — NEVER drift. Bất kỳ image gen nào break 1 trong số
   *  này → fail check → drop ảnh. */
  hardLocks: [
    'face-identity',
    'ethnicity',
    'age-range',
    'face-shape',
    'hijab-state',          // đặc biệt quan trọng: lúc-có-lúc-không = fail
    'hair-style',
    'body-build',
    'personality-vibe',
  ],

  /** SOFT locks — có thể đổi tự nhiên (outfit cụ thể OK miễn cùng style
   *  world; room có thể đổi nếu cùng house feel). */
  softLocks: [
    'outfit-specific',
    'room',
    'lighting',
    'time-of-day',
  ],

  /** FREE — chính là emotional arc, MUST đổi giữa các section. */
  freeAttributes: [
    'mood',
    'expression',
  ],

  /** Fallback policy: drop ảnh, giữ section text-only. KHÔNG retry vô
   *  hạn — chỉ retry 1 lần để tránh ăn token vô ích. */
  fallbackPolicy: 'retry-then-drop',
  retryLimit: 1,
}
