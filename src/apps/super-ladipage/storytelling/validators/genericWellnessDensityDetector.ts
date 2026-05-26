// ─────────────────────────────────────────────────────────────────────
// genericWellnessDensityDetector — SOFT WARNING (Chunk C2)
//
// Detects overuse of generic wellness abstractions across the pack.
// Common AI fingerprints: "từ bên trong", "gốc rễ", "nuôi dưỡng",
// "cân bằng", "phục hồi tự nhiên", "lành mạnh từ trong ra", etc.
//
// Multiple uses across blocks = AI generic wellness template detected.
// Reader notices repetition → conversion drops.
//
// Threshold: pack has >3 total occurrences across all blocks → flag.
// Per-block ban also enforced via nicheMechanismVocab.bannedGenericPhrases.
//
// SOFT — surfaces audit, doesn't trigger retry. Caller iterates by
// strengthening mechanism vocab pool or pruning generic words from
// engine philosophy.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

/** Generic wellness abstractions — AI fingerprints across niches. */
const GENERIC_WELLNESS_PHRASES = [
  'từ bên trong',
  'gốc rễ vấn đề',
  'gốc rễ của',
  'nuôi dưỡng toàn diện',
  'nuôi dưỡng từ',
  'cân bằng cơ thể',
  'cân bằng nội tiết',
  'phục hồi tự nhiên',
  'lành mạnh từ trong ra',
  'hài hoà cơ thể',
  'tăng cường sức khỏe',
  'an yên tâm hồn',
  'thanh lọc cơ thể',
  'cân bằng năng lượng',
]

const PACK_THRESHOLD = 3  // total occurrences across pack triggers flag

export function genericWellnessDensityDetector(
  sections: ParsedSection[],
): ValidatorResult {
  const violations: ValidatorViolation[] = []
  const foundPhrases: Array<{ blockId: string; phrase: string }> = []

  for (const s of sections) {
    const lowerText = s.copy.toLowerCase()
    for (const phrase of GENERIC_WELLNESS_PHRASES) {
      if (lowerText.includes(phrase.toLowerCase())) {
        foundPhrases.push({ blockId: s.id, phrase })
      }
    }
  }

  if (foundPhrases.length > PACK_THRESHOLD) {
    // Group by block for cleaner audit output.
    const byBlock = new Map<string, string[]>()
    for (const f of foundPhrases) {
      const arr = byBlock.get(f.blockId) ?? []
      arr.push(f.phrase)
      byBlock.set(f.blockId, arr)
    }
    for (const [blockId, phrases] of byBlock) {
      violations.push({
        sectionId: blockId as ParsedSection['id'],
        violation:
          `Generic wellness density: ${phrases.length} AI-fingerprint phrase(s) in this block ` +
          `(pack total: ${foundPhrases.length}, threshold: ${PACK_THRESHOLD}). ` +
          `Found: ${phrases.map((p) => `"${p}"`).join(', ')}. ` +
          `Use niche-specific mechanism vocab instead (see NICHE_MECHANISM_VOCAB).`,
      })
    }
  }

  return { pass: violations.length === 0, violations }
}
