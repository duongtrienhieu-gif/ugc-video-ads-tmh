// ─────────────────────────────────────────────────────────────────────
// Ingredient UI Card — type contracts.
//
// Architecture: KIE generates ONE composed photographic scene (product
// centered + ingredients arranged around it on a clean light surface),
// canvas overlays all UI chrome (carousel indicator, ingredient labels +
// connector lines, brand domain, slide arrows).
//
// NEVER ask AI to render label text — that's the failure mode this
// system fixes. AI renders ONLY photographic ingredient composition.
// ─────────────────────────────────────────────────────────────────────

/** 4 variant aesthetics the user requested. */
export type IngredientCardVariant =
  | 'minimal-wellness'    // off-white, generous whitespace, Aman/Tatcha feel
  | 'clinical-clean'      // pale blue/grey, lab-magazine register
  | 'tiktok-ad'           // bold contrast, larger labels, ad-creative energy
  | 'premium-supplement'  // dark cream, gold accents, premium supplement brand

/** A single ingredient with its 1-line benefit. The renderer pairs each
 *  ingredient with a label callout pointing into the AI-rendered scene. */
export interface IngredientItem {
  /** Display name — "Blueberries", "Lemon", "Lion's Mane Mushroom". */
  name: string
  /** 1-line benefit phrase, ≤ 25 chars — "Antioxidant Rich", "Vitamin C". */
  benefit: string
  /** Where the label sits relative to the composition.
   *  Auto-assigned by the renderer if omitted. */
  anchor?: { sideX: 'left' | 'right'; positionY: number }
}

/** Carousel chrome — gives the "screenshot from a TikTok / Meta carousel
 *  creative" feel the spec asks for. */
export interface CarouselChrome {
  /** "1 / 5" or "2 / 5" — which slide this card represents. */
  slideIndex: string
  /** Brand wordmark printed bottom-left (the actual brand name). */
  brandWordmark?: string
  /** Domain text under the wordmark — "huel.com" / "shop.my". */
  brandDomain?: string
}

/** Full payload — passed to renderIngredientCard(). */
export interface IngredientCardContent {
  /** Up to 5 ingredients — more than 5 looks cluttered. */
  ingredients: IngredientItem[]
  carousel?: CarouselChrome
  /** Optional headline strip across the top of the card. */
  headline?: string
}

/** Render spec — top-level. */
export interface IngredientCardSpec {
  variant: IngredientCardVariant
  content: IngredientCardContent
  /** Pre-generated photographic scene URL or asset ref (KIE output). */
  sceneRef?: string
  /** Output canvas size — defaults to 1080×1080 (1:1). */
  width?: number
  height?: number
  /** Post-process intensity — 'subtle' keeps it crisp (default for
   *  premium feel), 'medium' adds slight compression for "video frame"
   *  feel. */
  realism?: 'subtle' | 'medium'
}

export interface IngredientCardResult {
  blob: Blob
  mimeType: string
  width: number
  height: number
}
