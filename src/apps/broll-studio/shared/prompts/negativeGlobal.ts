// ── Shared Global Negative Prompts (P3) ─────────────────────────────────────
//
// Extracted from BrollStudio.tsx legacy `negativeBlock`. Every photographic
// module appends this baseline negative; modules may add their own
// module-specific bans on top.

/** Format constraints negative — always applied. */
export function buildFormatNegative(hasAvatar: boolean): string {
  return `[NEGATIVE — DO NOT]
- Do NOT modify the product packaging in any way.
- Do NOT invent new packaging, new label text, new colors, new logo.
- Do NOT add captions, callouts, price tags, sale badges, or any text overlay.
- Do NOT add watermarks or other brand logos.
- Do NOT duplicate the product unless the scene explicitly says multi-product.
${hasAvatar ? '- Do NOT generate a different random person — the person must resemble the avatar reference.\n' : ''}- No extra hands, no deformed fingers, no warped bottles, no melted labels, no garbled letters.`
}

/** Wrong-brand hallucination bans. Names of brands the model commonly
 *  drifts toward — explicit forbidden examples improve reliability. */
export const FAKE_BRAND_BANS = [
  'Shaklee', 'Nutriplus', 'Gastrofeed', 'Triple Detox', 'Detox Juice',
  'OXEVIN', 'DOSPRO', 'VITALEX', 'generic supplement bottle',
  'random wellness bottle', 'fake medicine box',
]
