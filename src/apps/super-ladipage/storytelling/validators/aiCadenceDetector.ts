// ─────────────────────────────────────────────────────────────────────
// aiCadenceDetector
//
// Detect AI essay patterns: enumerated structure, repetitive transitions,
// bullet spam, uniform paragraph density.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

export function aiCadenceDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    const text = s.copy.toLowerCase()

    // ─── Enumerated essay structure ──────────────────────────────
    if (/thứ nhất[\s,.].*thứ hai[\s,.].*(thứ ba|cuối cùng)/s.test(text)) {
      violations.push({
        sectionId: s.id,
        violation: 'Enumerated essay structure ("thứ nhất... thứ hai... cuối cùng")',
      })
    }
    if (/đầu tiên[\s,.].*tiếp theo[\s,.].*cuối cùng/s.test(text)) {
      violations.push({
        sectionId: s.id,
        violation: 'Sequential essay transitions ("đầu tiên... tiếp theo... cuối cùng")',
      })
    }
    if (/(điều\s+(thứ\s+nhất|đầu tiên|một)).*(điều\s+(thứ\s+hai|hai|tiếp theo))/s.test(text)) {
      violations.push({
        sectionId: s.id,
        violation: 'Numbered "điều X" enumeration',
      })
    }

    // ─── "Sau đó / và rồi" chain (AI summarize tone) ─────────────
    const sauDoCount = (text.match(/sau đó/g) ?? []).length
    if (sauDoCount >= 4) {
      violations.push({
        sectionId: s.id,
        violation: `"Sau đó" chain detected (${sauDoCount}× in single section — AI summarize tone)`,
      })
    }
    const vaRoiCount = (text.match(/và rồi/g) ?? []).length
    if (vaRoiCount >= 3) {
      violations.push({
        sectionId: s.id,
        violation: `"Và rồi" chain detected (${vaRoiCount}× — AI essay tone)`,
      })
    }

    // ─── Bullet spam ─────────────────────────────────────────────
    const bulletCount = (s.copy.match(/^\s*[-•*]\s+/gm) ?? []).length
    if (bulletCount > 4) {
      violations.push({
        sectionId: s.id,
        violation: `Bullet spam (${bulletCount} items — storytelling max 4 per section)`,
      })
    }

    // ─── Uniform paragraph density (AI essay sign) ───────────────
    const paragraphs = s.copy.split(/\n{2,}/).filter((p) => p.trim())
    if (paragraphs.length >= 4) {
      const wordCounts = paragraphs.map((p) => p.split(/\s+/).filter((w) => w).length)
      const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
      // If avg > 30 and all paragraphs within ±20% of avg → uniform = AI essay
      const variance = wordCounts.every((w) => Math.abs(w - avg) < avg * 0.2)
      if (avg > 30 && variance) {
        violations.push({
          sectionId: s.id,
          violation: `Uniform paragraph density (avg ${Math.round(avg)} words, low variance — AI essay)`,
        })
      }
    }

    // ─── Conclusion phrases (AI essay close) ─────────────────────
    if (/tóm lại|nhìn chung|nói chung|tổng kết lại/.test(text)) {
      violations.push({
        sectionId: s.id,
        violation: 'Conclusion phrase ("tóm lại"/"nhìn chung") — AI essay close',
      })
    }
  }

  return { pass: violations.length === 0, violations }
}
