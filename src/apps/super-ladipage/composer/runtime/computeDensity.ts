// ─────────────────────────────────────────────────────────────────────
// Composer — computeDensity (P4)
//
// Measure density tier + scroll weight per section. Used to:
//   - flag mobile fatigue risk
//   - inform renderer (later) about typography density
//   - guide spacing decisions
// ─────────────────────────────────────────────────────────────────────

import type { SectionDensity, ScrollWeight } from '../types'

export interface DensityMetrics {
  wordCount: number
  paragraphCount: number
  density: SectionDensity
  scrollWeight: ScrollWeight
}

/** Count words in a string — Vietnamese-aware (whitespace + word chars). */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length
}

/** Compute density metrics from paragraphs. */
export function computeDensity(paragraphs: string[]): DensityMetrics {
  const paragraphCount = paragraphs.length
  const wordCount = paragraphs.reduce((sum, p) => sum + countWords(p), 0)

  // Density tier based on paragraph count + word density per paragraph.
  let density: SectionDensity
  const wordsPerParagraph = paragraphCount > 0 ? wordCount / paragraphCount : 0

  // 2026-05-29 — Relaxed fragmented threshold from `paragraphCount >= 6`
  // to `>= 12`. After the mobile-rhythm length-mode fix, EVERY storytelling
  // block is intentionally split into 3-5 short paragraphs for mobile
  // breathability. A composed section that merges 2-3 blocks easily has
  // 6-10 short paragraphs — calling that "fragmented" was a false positive
  // and triggered downstream image-stripping. Real fragmentation (worth
  // flagging) only kicks in at ~12+ paragraphs in a single composed section.
  if (paragraphCount === 0) {
    density = 'tight'  // edge case
  } else if (paragraphCount === 1 && wordCount < 30) {
    density = 'tight'
  } else if (paragraphCount <= 2 && wordCount < 80) {
    density = 'tight'
  } else if (paragraphCount >= 12 || wordsPerParagraph > 70) {
    density = 'fragmented'  // truly excessive paragraphs OR very long ones
  } else if (paragraphCount >= 4 && wordCount > 200) {
    density = 'airy'
  } else {
    density = 'medium'
  }

  // Scroll weight based on word count (mobile reading effort).
  let scrollWeight: ScrollWeight
  if (wordCount < 80) {
    scrollWeight = 'light'
  } else if (wordCount < 200) {
    scrollWeight = 'moderate'
  } else {
    scrollWeight = 'heavy'
  }

  return { wordCount, paragraphCount, density, scrollWeight }
}

/** Estimated mobile scroll time in seconds — based on ~200 WPM reading speed. */
export function estimateScrollTime(totalWords: number): number {
  const wordsPerSecond = 200 / 60  // ~3.33 WPS at 200 WPM
  return Math.round(totalWords / wordsPerSecond)
}
