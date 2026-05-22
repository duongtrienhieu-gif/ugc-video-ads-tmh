// ─────────────────────────────────────────────────────────────────────
// resolveProtagonistProfile — STUB cho P0.5
//
// P0.5: hardcoded skeleton — Malay Muslim woman, 35-45, hijab always,
// suburban house. Phase 3 (Character engine) sẽ:
//   - infer từ product.targetMarket + niche + culturalWorld
//   - allow user override fields (vd hijabState, ageRange)
//   - validate consistency (vd modestyLevel='conservative' + wardrobeWorld='urban-casual' → conflict)
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey, ProtagonistProfile } from '../types'

interface ResolveArgs {
  niche?: NicheKey
}

/** P0.5 stub: return hardcoded default protagonist. Real resolver ở P3. */
export function resolveProtagonistProfile(_args: ResolveArgs = {}): ProtagonistProfile {
  return {
    gender: 'female',
    ageRange: '35-45',

    cultural: {
      world: 'malay-muslim',
      hijabState: 'always',
      hairVisible: false,
      modestyLevel: 'modern-modest',
    },

    wardrobeWorld: 'baju-kurung',
    personalityVibe: 'warm-maternal',

    homeLifestyle: {
      setting: 'suburban-house',
      familyStructure: 'with-children',
    },
  }
}
