// ─────────────────────────────────────────────────────────────────────
// Comparison UI Card — type contracts.
//
// Architecture: KIE generates ONE side-by-side photographic composition
// (dark/dull generic competitor on left, bright/clean uploaded product
// on right, soft middle gradient). Canvas overlays everything else —
// THEM / US headers, bullet rows with check / X icons, the central VS
// badge, carousel chrome, slide arrows.
//
// NEVER ask AI to render bullet text — same failure mode as ingredient
// cards (warped fake typography). All text is canvas-rendered.
// ─────────────────────────────────────────────────────────────────────

/** 4 variant aesthetics aligned with the product niche. */
export type ComparisonCardVariant =
  | 'supplement-wellness'   // green/dark — health supplement niche
  | 'beauty-luxury'         // rose/cream — beauty / skincare
  | 'detox-clinical'        // blue/charcoal — detox / clinical
  | 'tiktok-bold'           // black/lime — viral ad creative energy

/** A single comparison bullet — appears as either a pain point (THEM,
 *  rendered with red X) or a benefit (US, rendered with green check). */
export interface ComparisonBullet {
  /** Short bullet text — ≤ ~35 chars, wraps to 2 lines max. */
  text: string
  /** Optional secondary line (smaller, fainter). */
  subtext?: string
}

export interface ComparisonContent {
  /** Header labels — defaults to "THEM" / "US" but customizable. */
  leftHeader?: string
  rightHeader?: string
  /** Pain bullets shown under THEM. Cap 4 items — more is unreadable on mobile. */
  themBullets: ComparisonBullet[]
  /** Benefit bullets shown under US. Cap 4 items. */
  usBullets: ComparisonBullet[]
  /** Center badge text — defaults to "VS". */
  vsBadge?: string
  /** Carousel chrome (slide indicator + brand wordmark). */
  carousel?: {
    slideIndex: string
    brandWordmark?: string
    brandDomain?: string
  }
}

export interface ComparisonCardSpec {
  variant: ComparisonCardVariant
  content: ComparisonContent
  /** Pre-generated photographic split composition (KIE output). */
  sceneRef?: string
  /** Output canvas size — defaults to 1080×1350 (4:5 portrait). */
  width?: number
  height?: number
  realism?: 'subtle' | 'medium'
}

export interface ComparisonCardResult {
  blob: Blob
  mimeType: string
  width: number
  height: number
}
