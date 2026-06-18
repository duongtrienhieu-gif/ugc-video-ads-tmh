export interface Product {
  id: string
  productImage: string          // legacy primary image = productImages[0]; kept for back-compat
  productImages: string[]       // the 4 required product images (asset refs / data URLs)
  productName: string
  productDescription: string
  targetMarket: string
  painPoints: string
  usps: string
  benefits: string
  offer: string
  ingredients: string
  usageGuide: string
  /** P4i — universal VISUAL brief computed ONCE from the product photos (Gemini
   *  vision): form factor / hero parts / how it's used / size / shot-idea palette.
   *  Cached so the b-roll director (text-only) can "see" the product. Optional +
   *  additive — empty until computed; never required to construct a Product. */
  visualBrief?: string
  /** P6i — the product name as a local creator would SAY it in the picked output
   *  language (descriptive/common-noun parts translated, genuine brand tokens kept).
   *  Computed ONCE per (name, lang) + cached so the script + director + stickers/banner/
   *  thumbnail all use ONE consistent localized name. The ORIGINAL `productName` (bank/UI
   *  display) is NEVER overwritten. `localizedNameLang` = which output lang it's for. */
  localizedName?: string
  localizedNameLang?: string
  createdAt: number
}

/** A product is "image-complete" only when it has 4 real product images. Image-
 *  generating apps (TikTok Shop / Ladipage / UGC Builder / Avatar / Creative
 *  Studio) gate on this — legacy 1-image products fail it until the user
 *  re-uploads 4 and saves. Text-only apps do NOT gate on this. */
export function hasFourProductImages(p: Pick<Product, 'productImages'>): boolean {
  return Array.isArray(p.productImages) && p.productImages.filter((s) => !!s && s.trim() !== '').length >= 4
}

/** A variant is a different angle/expression of the SAME avatar.
 *  Used as additional reference image(s) when generating B-roll to lock
 *  identity across multiple shots. */
export interface AvatarVariant {
  id: string
  imageUrl: string       // asset:// reference
  label: string          // e.g. "3/4 left", "side profile", "smiling close-up"
  source: 'ai-generated' | 'manual-upload'
  createdAt: number
}

export interface Model {
  id: string
  characterImage: string
  jsonProfile: Record<string, unknown> | null
  name: string
  notes: string
  source: 'character-studio' | 'image-dna-extractor' | 'manual-import'
  variants?: AvatarVariant[]   // optional alternate angles for identity-lock
  createdAt: number
}

export interface Script {
  id: string
  title: string
  scriptText: string
  linkedProductId: string
  source: 'script-architect' | 'manual'
  createdAt: number
}

export interface VoicePreset {
  id: string
  label: string
  voiceName: string
  gender: 'Female' | 'Male'
  styleInstructions: string
  creativity: number
  ambience: 'Studio' | 'Small Room'
  linkedModelId: string
  createdAt: number
}

export interface BRollVideo {
  url: string
  aspectRatio: string
  createdAt: number
}

export interface BRoll {
  id: string
  imageUrl: string
  prompt: string
  productId?: string
  modelId?: string
  scriptId?: string
  videoUrl?: string
  videos?: BRollVideo[]
  createdAt: number
}

export interface VoiceHistoryItem {
  id: string
  voiceName: string
  voiceId: string
  modelId: string
  scriptText: string
  scriptPreview: string
  audioUrl: string
  duration: number
  createdAt: number
}

export interface InterAppPayload {
  targetApp: string
  targetField: string
  data: unknown
}
