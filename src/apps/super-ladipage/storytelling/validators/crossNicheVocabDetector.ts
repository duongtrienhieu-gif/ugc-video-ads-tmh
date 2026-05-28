// ─────────────────────────────────────────────────────────────────────
// crossNicheVocabDetector — SOFT WARNING (REBUILD Sprint 3, 2026-05-28)
//
// Complements nicheContaminationDetector. That detector uses
// NICHE_DOMAIN_LOCK.forbiddenLeak (broad daily-life vocab leaks like
// "vịn cầu thang" appearing in a haircare pack). This one uses
// NICHE_MECHANISM_DENY — specifically the MECHANISM domain vocab from
// other niches that should not show up here.
//
// Example bug it catches:
//   A health-respiratory pack mentioning "vi khuẩn kỵ khí" (dental/gut
//   vocab), "lông tơ ở cổ họng" (anatomically wrong), "viêm niêm mạc
//   mũi" (nasal vocab in a chest-patch product).
//
// SOFT — informational. Logs the leak so we can decide whether to
// tighten the deny list or escalate to hard. Doesn't force retry.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'
import { detectMechanismLeaks, getMechanismDenyList } from '../config/nicheMechanismDeny'
import { BLOCK_POOL } from '../config/blockPool'
import type { NicheKey } from '../types'

export function crossNicheVocabDetector(
  sections: ParsedSection[],
  niche: NicheKey,
): ValidatorResult {
  // Quick exit when no deny list configured for this niche yet.
  if (getMechanismDenyList(niche).length === 0) {
    return { pass: true, violations: [] }
  }

  const violations: ValidatorViolation[] = []
  for (const s of sections) {
    // Skip proof callout blocks — voice-isolated.
    if (typeof s.id === 'string' && s.id.startsWith('proof-')) continue
    if (!BLOCK_POOL[s.id]) continue

    const hits = detectMechanismLeaks(s.copy, niche)
    if (hits.length === 0) continue
    violations.push({
      sectionId: s.id,
      violation:
        `Cross-niche mechanism leak in ${niche} pack — detected terms: ` +
        `${hits.map((h) => `"${h}"`).join(', ')} (these belong to a DIFFERENT niche).`,
    })
  }

  return { pass: violations.length === 0, violations }
}
