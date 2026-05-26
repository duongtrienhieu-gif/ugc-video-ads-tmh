// ─────────────────────────────────────────────────────────────────────
// Render Contract — renderContractConsistencyDetector (P5, SOFT)
//
// Detects layout consistency issues in RenderContractedPage:
//   - hero recommended but no image (broken impact)
//   - proof block has 'none' proofPresentation (orphan inline proof)
//   - 2+ adjacent sections with same mobilePattern (visual monotony)
//   - close-invitation has imageCount > 0 (anti-quiet close)
//
// Returns warning strings — soft, surfaces audit, never blocks.
// ─────────────────────────────────────────────────────────────────────

import type { RenderContractedSection } from '../types'

export function renderContractConsistencyDetector(
  sections: RenderContractedSection[],
): string[] {
  const warnings: string[] = []

  // ── Check 1: hero has no image ─────────────────────────────────────
  const hero = sections.find((s) => s.role === 'hero-recognition')
  if (hero && hero.renderContract.recommendedImageCount === 0) {
    warnings.push(
      `Hero section "${hero.id}" has recommendedImageCount=0. Hero requires ` +
      `anchor image for impact moment — check density override didn't fire.`,
    )
  }

  // ── Check 2: orphan inline proof (proof present but presentation='none') ─
  for (const s of sections) {
    if (s.inlineProof && s.renderContract.proofPresentation === 'none') {
      warnings.push(
        `Section "${s.id}" has inlineProof but proofPresentation='none' — ` +
        `proof will render invisibly. Check proof presentation logic for this role.`,
      )
    }
  }

  // ── Check 3: 2+ adjacent sections same mobilePattern ─────────────
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i].renderContract.mobilePattern
    const b = sections[i + 1].renderContract.mobilePattern
    if (a === b) {
      warnings.push(
        `Adjacent sections "${sections[i].id}" + "${sections[i + 1].id}" share ` +
        `mobilePattern="${a}" — visual monotony risk. Consider density/role differentiation.`,
      )
    }
  }

  // ── Check 4: close-invitation should be image-free ────────────────
  const close = sections.find((s) => s.role === 'close-invitation')
  if (close && close.renderContract.recommendedImageCount > 0) {
    warnings.push(
      `Close-invitation "${close.id}" has recommendedImageCount=${close.renderContract.recommendedImageCount}. ` +
      `Close should be quiet text-only — image breaks anti-pressure intent.`,
    )
  }

  return warnings
}
