// ─────────────────────────────────────────────────────────────────────
// nicheContaminationDetector — SOFT WARNING (Chunk C2)
//
// Detects cross-niche language leak. Each niche's nicheDomainLock has a
// forbiddenLeak list (phrases that belong to OTHER niches and should NOT
// appear in this pack).
//
// Example: haircare pack with "đứng dậy chậm" / "vịn cầu thang" — that's
// health-functional language leaking in. Reader unconsciously notices
// template reuse → immersion drop.
//
// SOFT — surfaces audit visibility, doesn't trigger retry. Repeat
// violations across packs → escalate to hard validator or strengthen
// domain lock pool.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'
import { NICHE_DOMAIN_LOCK } from '../config/nicheDomainLock'
import { BLOCK_POOL } from '../config/blockPool'
import type { NicheKey } from '../types'

/** Run detector — needs niche context which is in storytellingMeta.
 *  Caller passes via separate argument since ParsedSection alone doesn't
 *  carry niche. */
export function nicheContaminationDetector(
  sections: ParsedSection[],
  niche: NicheKey,
): ValidatorResult {
  const lock = NICHE_DOMAIN_LOCK[niche]
  if (!lock) return { pass: true, violations: [] }

  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    // Skip social-proof — reviews come from separate call, voice-isolated.
    if (s.id === 'social-proof') continue
    if (!BLOCK_POOL[s.id]) continue

    const lowerText = s.copy.toLowerCase()
    for (const forbidden of lock.forbiddenLeak) {
      if (lowerText.includes(forbidden.toLowerCase())) {
        violations.push({
          sectionId: s.id,
          violation:
            `Cross-niche leak: "${forbidden}" appears in ${niche} pack ` +
            `(this phrase belongs to a different niche — template reuse detected).`,
        })
      }
    }
  }

  return { pass: violations.length === 0, violations }
}
