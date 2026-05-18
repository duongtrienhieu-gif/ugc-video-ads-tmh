// ── Persona Library (P4) ────────────────────────────────────────────────────
//
// Static archetype presets. Photographic modules (and future ui-native
// chat-proof modules in P5) reference these by id and bake the matching
// appearance + environment + voiceCharacter blocks into their prompts.
//
// Distilled from the landing-page advertorial archetype work
// (services/forms/advertorial.ts:103 ARCHETYPE_OPTIONS) but generalized
// to cover Vietnamese + SEA archetypes — not Malaysia-only.
//
// Adding a new persona:
//   1. Append to PERSONA_LIBRARY
//   2. Keep appearance 60-100 words, environment 40-60 words
//   3. Use suitableFor to gate where the persona shows up in pickers

import type { Persona } from '../../types/persona'

export const PERSONA_LIBRARY: Persona[] = [
  {
    id: 'vn-office-female-late-20s',
    label: { vi: 'Văn phòng nữ, cuối 20', en: 'Office woman, late 20s' },
    appearance:
      'Vietnamese woman, late 20s, soft natural face with light asian skin tone, slim build, '
      + 'shoulder-length straight black hair often tied back, minimal makeup (light tinted lip, '
      + 'thin eyeliner), no jewelry beyond small ear studs. Wears a fitted neutral knit top, beige '
      + 'or pastel cardigan, simple silver watch. Posture slightly tired but composed. Mid-budget '
      + 'office wardrobe — not luxury, not student.',
    environment:
      'Modern Hanoi or Saigon office with warm desk lamp, secondary laptop screen out of focus, '
      + 'small succulent plant, half-filled coffee mug. Late afternoon natural light from a side '
      + 'window, soft window-shade glow.',
    voiceCharacter:
      'Calm, low-key honest, slightly self-deprecating. Talks like a friend recommending something '
      + 'tried for a few months, not a brand ambassador.',
    demographicTags: ['female', 'millennial', 'vietnamese', 'office-worker', 'no-hijab', 'urban'],
    suitableFor: ['ugc', 'social-proof', 'before-after', 'chat-proof'],
  },
  {
    id: 'vn-homemaker-mid-30s',
    label: { vi: 'Mẹ nội trợ, đầu 30', en: 'Homemaker mother, early 30s' },
    appearance:
      'Vietnamese woman, early 30s, warm rounded face, healthy slightly tanned skin, gentle smile '
      + 'lines, mid-length dark brown hair often pulled into a loose low bun, no professional '
      + 'makeup, simple wedding ring. Wears a soft cotton blouse or pastel pajama top at home, '
      + 'a thin gold necklace, no heavy accessories. Body language patient and grounded, used to '
      + 'multitasking around children.',
    environment:
      'Compact Vietnamese family kitchen — rice cooker on counter, small ceramic bowls, hanging '
      + 'utensils, a child\'s drawing on the fridge. Soft morning light through a kitchen window, '
      + 'tile floor, warm domestic atmosphere.',
    voiceCharacter:
      'Warm, practical, advice-from-a-mother tone. Mentions kids or husband naturally. Trusts '
      + 'word-of-mouth over ads, sceptical of fancy claims.',
    demographicTags: ['female', 'millennial', 'vietnamese', 'homemaker', 'parent', 'no-hijab', 'urban'],
    suitableFor: ['ugc', 'social-proof', 'chat-proof'],
  },
  {
    id: 'vn-office-male-early-30s',
    label: { vi: 'Văn phòng nam, đầu 30', en: 'Office man, early 30s' },
    appearance:
      'Vietnamese man, early 30s, lean build, short side-parted black hair, light stubble, '
      + 'rectangular thin-rimmed glasses, smooth skin with light eye fatigue. Wears a slim-fit '
      + 'oxford shirt sleeves rolled to forearm, dark slim trousers, simple stainless watch. No '
      + 'rings, no chain. Body language slightly hunched from screen work but otherwise contained.',
    environment:
      'Open-plan tech office in Saigon — second monitor with code, mechanical keyboard, water '
      + 'bottle, energy bar wrapper, sticky note grid behind desk. Cool fluorescent overhead light '
      + 'mixed with warm desk lamp, late-evening window darkness.',
    voiceCharacter:
      'Analytical, data-driven, sceptical until convinced. Speaks in short sentences, mentions '
      + 'numbers (energy / sleep / hours) when explaining results.',
    demographicTags: ['male', 'millennial', 'vietnamese', 'office-worker', 'urban'],
    suitableFor: ['ugc', 'social-proof', 'chat-proof'],
  },
  {
    id: 'vn-gen-z-student-female',
    label: { vi: 'Sinh viên nữ Gen Z', en: 'Gen Z female student' },
    appearance:
      'Vietnamese woman, early 20s, fair smooth youthful skin, expressive almond eyes, soft natural '
      + 'brows, glossy clear lip balm. Long straight black hair or with subtle caramel highlights, '
      + 'sometimes with bangs. Wears an oversized neutral hoodie or cropped cardigan, small hoop '
      + 'earrings, simple beaded bracelet. Posture relaxed, playful candid energy.',
    environment:
      'University dorm or café corner — laptop with stickers, iced milk tea cup, open notebook with '
      + 'highlighted pages, AirPods case on the table. Bright cool daylight from a large window, '
      + 'soft chatter atmosphere.',
    voiceCharacter:
      'Friendly, casual, peppered with light Gen Z internet vocabulary but not cringe. Recommends '
      + 'products with energy of "found a hack". Honest about trying free samples first.',
    demographicTags: ['female', 'gen-z', 'vietnamese', 'student', 'urban'],
    suitableFor: ['ugc', 'social-proof', 'chat-proof'],
  },
  {
    id: 'my-hijab-female-late-20s',
    label: { vi: 'Phụ nữ Malaysia đội hijab, cuối 20', en: 'Malaysian hijab woman, late 20s' },
    appearance:
      'Malaysian Malay woman, late 20s, warm light-brown skin, soft round face, natural minimal '
      + 'makeup (light blush, nude lip). Wears a modest pastel tudung neatly pinned framing her '
      + 'face, long-sleeve modest cotton blouse, simple analog watch. No visible hair, no fitted '
      + 'Western fashion. Calm modest posture, eye contact gentle.',
    environment:
      'Modest Malaysian apartment living room — soft beige curtain, rattan stool, prayer mat folded '
      + 'in corner, family photo on shelf, tropical plant. Warm afternoon light through sheer '
      + 'curtain, lived-in domestic feel.',
    voiceCharacter:
      'Gentle, religious-aware, family-oriented. Frames recommendations around modest family '
      + 'wellness, never around vanity or aesthetics.',
    demographicTags: ['female', 'millennial', 'malaysian', 'hijab', 'parent', 'urban'],
    suitableFor: ['ugc', 'social-proof', 'before-after', 'chat-proof'],
  },
  {
    id: 'sea-generic-female-mid-30s',
    label: { vi: 'Phụ nữ SEA chung, giữa 30', en: 'Generic SEA woman, mid 30s' },
    appearance:
      'Southeast Asian woman, mid-30s, neutral build, warm light skin, soft natural face with '
      + 'subtle smile lines, shoulder-length dark hair worn loose or in a low ponytail, simple '
      + 'studs, no other jewelry. Wears a plain cotton t-shirt or modest blouse in muted color. No '
      + 'strong regional markers — works as a fallback when no specific country is needed.',
    environment:
      'Generic warm domestic interior — wooden floor, neutral wall, daylight from an off-screen '
      + 'window, plain coffee mug, single houseplant. No country-specific decor, no flag, no signage.',
    voiceCharacter:
      'Neutral warm conversational tone, no regional slang. Useful when the brand wants a pan-SEA '
      + 'voice without locking into one country.',
    demographicTags: ['female', 'gen-x', 'sea-generic', 'urban'],
    suitableFor: ['ugc', 'social-proof', 'before-after'],
  },
]

/** Look up a persona by id. Returns null when missing — callers decide
 *  whether to fall back or throw. Different from findStyleVariant (which
 *  silently returns the first style on miss) because persona mis-match
 *  has higher consequence — wrong archetype = wrong ad. */
export function findPersona(id: string): Persona | null {
  return PERSONA_LIBRARY.find((p) => p.id === id) ?? null
}

/** Filter personas by demographic tag intersection. Useful for UI pickers
 *  (e.g. "show all female + vietnamese personas"). */
export function listPersonasByTags(...tags: Persona['demographicTags']): Persona[] {
  if (tags.length === 0) return PERSONA_LIBRARY
  return PERSONA_LIBRARY.filter((p) =>
    tags.every((t) => p.demographicTags.includes(t)),
  )
}
