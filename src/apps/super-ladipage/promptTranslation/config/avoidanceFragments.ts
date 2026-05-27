// ─────────────────────────────────────────────────────────────────────
// Prompt Translation — anti-aesthetic governance (P10)
//
// Static avoidance block applied to EVERY section that produces an image.
// Direct translation of user's anti-conversion list. NEUTRAL descriptors,
// not poetry. Renderer's negative-prompt slot consumes this directly.
//
// LOCKED: this list is the GOVERNANCE LAYER. It is the strongest signal
// against AI-art aesthetic drift / studio inflation / commercial polish.
//
// Conditional additions per imageRole are appended at translation time.
// ─────────────────────────────────────────────────────────────────────

import type { ImageRole, ProofFeel } from '../../imageSemantics'

// ─── STATIC GLOBAL AVOIDANCE — applied to every image ──────────────

export const GLOBAL_AVOIDANCE_FRAGMENTS: string[] = [
  // From user's explicit anti-conversion list:
  'studio perfection',
  'over-polish',
  'luxury ad feel',
  'glossy commercial lighting',
  'symmetrical composition',
  'over-designed framing',
  'stock-photo atmosphere',
  'beauty-shot posing',
  'AI perfection',
  // From user's "do not build" anti-list:
  'award-winning photography',
  'cinematic masterpiece',
  'dramatic lighting fetish',
  'hyper-detail obsession',
  'luxury visual language',
  'style inflation',
  // Adjacent commercial drift to block:
  'high commercial polish',
  'model agency look',
  'glamour pose',
  'perfect skin retouch',
  'lifestyle billboard aesthetic',
]

// ─── ROLE-CONDITIONAL AVOIDANCE — extra anti-aesthetics per role ───

export const ROLE_AVOIDANCE_FRAGMENTS: Record<ImageRole, string[]> = {
  'hero-anchor': [
    // Hero must feel like real reader, not actress
    'fashion editorial framing',
    'magazine cover composition',
  ],
  'mood-supporting': [],
  'object-trace': [
    // Frustration flat-lay must feel real, not curated
    'art-directed flat-lay',
    'curated product styling',
  ],
  'lifestyle-context': [
    // Lifestyle must feel lived-in, not staged
    'staged lifestyle pose',
    'real-estate brochure framing',
  ],
  'proof-callout': [
    // Proof must feel authentic, not fabricated testimonial
    'fake testimonial card',
    'sponsored ad watermark',
  ],
  'none': [],
}

// ─── PROOF-FEEL CONDITIONAL — anti-fake-proof additions ────────────

export const PROOF_AVOIDANCE_FRAGMENTS: Record<ProofFeel, string[]> = {
  'screenshot':         ['fabricated chat overlay', 'fake messaging UI'],
  'attribution-card':   ['inflated testimonial graphic'],
  'testimonial-still':  ['ad-style testimonial pose'],
  'context-evidence':   ['staged before-after artifice'],
  'none':               [],
}
