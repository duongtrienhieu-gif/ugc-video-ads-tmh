// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — NICHE MECHANISM DENY (REBUILD Sprint 3, 2026-05-28)
//
// Cross-niche vocab DENY list. Complements nicheMechanismVocab.ts:
//
//   nicheMechanismVocab        — WHITELIST: domain terms this niche owns
//   nicheMechanismDeny (this)  — DENYLIST: terms from OTHER niches that
//                                must NOT leak into this niche's pack
//
// Example bug this fixes:
//   A health-respiratory pack mentioning "vi khuẩn kỵ khí" (anaerobic
//   bacteria — dental/gut vocab), "lông tơ ở cổ họng", "viêm niêm mạc
//   mũi bị sưng" (nasal — a chest patch doesn't act on the nose).
//
// Used by post-gen validator. When deny vocab is detected, the block is
// flagged so the retry loop can attempt one regen with explicit feedback
// ("avoid <term> — this is the wrong domain for niche X").
//
// LOCKED: keep lists short + high-precision. False positives flatten
// output. Add a term only when we've SEEN it leak across niches in
// real packs — not preemptively.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

/** Per-niche cross-niche vocab deny list. Lowercase, substring match. */
export const NICHE_MECHANISM_DENY: Partial<Record<NicheKey, string[]>> = {
  'health-respiratory': [
    // dental / oral / gut leaks
    'vi khuẩn kỵ khí',
    'anaerobic bacteria',
    'viêm lợi',
    'sâu răng',
    'men răng',
    'mảng bám răng',
    'enamel',
    'plaque',
    // nasal-only vocab leaking into a chest/lung product
    'niêm mạc mũi',
    'viêm xoang',
    'sinus',
    'nasal mucosa',
    // skin / hair leaks
    'nang tóc',
    'da đầu',
    'skin barrier',
    'sợi tóc',
    // joint leaks
    'sụn khớp',
    'khớp gối',
    'dịch khớp',
    // generic body part that's wrong for a respiratory product
    'lông tơ ở cổ họng',
  ],

  'health-joint': [
    // respiratory leaks
    'phế quản',
    'phổi viêm',
    'đường thở',
    'thở khò khè',
    // gut leaks
    'niêm mạc dạ dày',
    'vi khuẩn ruột',
    // hair/skin leaks
    'nang tóc',
    'da đầu',
    'skin barrier',
    // dental
    'men răng',
    'viêm lợi',
  ],

  'health-digestive': [
    // respiratory
    'phế quản',
    'phổi viêm',
    'đường thở',
    // dental
    'men răng',
    'viêm lợi',
    'sâu răng',
    // hair/skin
    'nang tóc',
    'da đầu',
    'skin barrier',
    // joint
    'sụn khớp',
    'khớp gối',
  ],

  'health-cardiovascular': [
    'phế quản',
    'phổi viêm',
    'nang tóc',
    'skin barrier',
    'men răng',
    'viêm lợi',
    'sụn khớp',
    'niêm mạc dạ dày',
  ],

  'haircare': [
    // respiratory
    'phế quản',
    'phổi viêm',
    'thở khò khè',
    // dental
    'men răng',
    'viêm lợi',
    // joint
    'sụn khớp',
    'khớp gối',
    // gut
    'niêm mạc dạ dày',
  ],

  'skincare': [
    'phế quản',
    'phổi viêm',
    'thở khò khè',
    'men răng',
    'viêm lợi',
    'sụn khớp',
    'khớp gối',
    'niêm mạc dạ dày',
  ],

  'dental-oral-care': [
    // respiratory
    'phế quản',
    'phổi viêm',
    'thở khò khè',
    // hair/skin
    'nang tóc',
    'skin barrier',
    // joint
    'sụn khớp',
    'khớp gối',
    // gut
    'niêm mạc dạ dày',
  ],

  'eye-vision-care': [
    'phế quản',
    'phổi viêm',
    'thở khò khè',
    'nang tóc',
    'skin barrier',
    'men răng',
    'viêm lợi',
    'sụn khớp',
    'khớp gối',
  ],
}

/** Look up the deny list for a niche. Returns empty when niche has no
 *  entry — caller should treat missing entry as "no cross-leak detection
 *  for this niche yet" (silent pass). */
export function getMechanismDenyList(niche: NicheKey): string[] {
  return NICHE_MECHANISM_DENY[niche] ?? []
}

/** Scan a piece of generated copy for deny-listed cross-niche vocab.
 *  Returns the list of terms that matched (lowercase substring match).
 *  Empty array = no leaks detected. */
export function detectMechanismLeaks(copy: string, niche: NicheKey): string[] {
  const denyList = getMechanismDenyList(niche)
  if (denyList.length === 0) return []
  const haystack = copy.toLowerCase()
  const hits: string[] = []
  for (const term of denyList) {
    if (haystack.includes(term.toLowerCase())) hits.push(term)
  }
  return hits
}
