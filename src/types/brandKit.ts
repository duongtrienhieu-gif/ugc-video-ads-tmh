// Studio Brand Kit — public data contract.
// TikTok Shop app (built in a separate session) imports from here.
// DO NOT introduce breaking changes without aligning with that consumer.

export type Market = 'vi' | 'ms'

export type VoiceTone =
  | 'formal'
  | 'casual'
  | 'playful'
  | 'premium'
  | 'clinical'
  | 'gen-z'

export type BrandCategory =
  | 'beauty'
  | 'supplement'
  | 'tech'
  | 'fashion'
  | 'food'
  | 'home'
  | 'mom-baby'
  | 'other'

export interface BrandKitLocalization {
  tagline?: string
  voice?: {
    samplePhrases?: string[]
    vocabulary?: { preferred?: string[]; banned?: string[] }
  }
  cta?: { preferred?: string[] }
}

export interface BrandKit {
  id: string
  name: string                          // user input
  category: BrandCategory               // user input
  isExistingBrand: boolean              // user toggle
  version: 1
  createdAt: string
  updatedAt: string

  // Visual identity — AI infer
  logoAssetId: string
  logoMonoAssetId?: string
  palette: {
    primary: string
    secondary: string
    cta: string
    neutral?: string
  }
  typography: {
    display: string                     // ∈ FONT_WHITELIST
    body: string                        // ∈ FONT_WHITELIST
  }
  badges: Array<{ name: string; assetId: string }>
  flagOrigin?: string                   // ISO country code

  // Verbal identity — AI infer
  storeName: string
  tagline?: string
  voice: {
    tone?: VoiceTone
    vocabulary?: { preferred?: string[]; banned?: string[] }
    samplePhrases?: string[]
  }
  cta?: { preferred?: string[] }

  // Meta
  markets: Market[]
  allowSecondaryLanguage?: 'en' | null
  localizations?: Partial<Record<Market, BrandKitLocalization>>
}

export interface ResolvedBrandKit
  extends Omit<BrandKit, 'logoAssetId' | 'badges'> {
  logo: { blobUrl: string; width: number; height: number }
  logoMono?: { blobUrl: string; width: number; height: number }
  badges: Array<{ name: string; blobUrl: string; width: number; height: number }>
  market: Market
}

// Font whitelist — TikTok Shop app must mirror this list.
// Be Vietnam Pro is only valid when markets includes 'vi'.
export const FONT_WHITELIST = [
  'Plus Jakarta Sans',
  'Poppins',
  'Nunito Sans',
  'Inter',
  'Manrope',
  'DM Sans',
  'Be Vietnam Pro',
] as const

export type WhitelistedFont = (typeof FONT_WHITELIST)[number]

export const BRAND_CATEGORY_LABELS: Record<BrandCategory, string> = {
  beauty: 'Làm đẹp',
  supplement: 'Thực phẩm chức năng',
  tech: 'Công nghệ',
  fashion: 'Thời trang',
  food: 'Đồ ăn',
  home: 'Đồ gia dụng',
  'mom-baby': 'Mẹ & Bé',
  other: 'Khác',
}

export const VOICE_TONE_LABELS: Record<VoiceTone, string> = {
  formal: 'Trang trọng',
  casual: 'Thân thiện',
  playful: 'Vui tươi',
  premium: 'Cao cấp',
  clinical: 'Y khoa',
  'gen-z': 'Gen-Z',
}

export const MARKET_LABELS: Record<Market, string> = {
  vi: 'Việt Nam',
  ms: 'Malaysia',
}
