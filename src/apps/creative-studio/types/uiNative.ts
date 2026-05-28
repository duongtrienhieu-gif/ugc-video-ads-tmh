// ── UI-Native Engine Group — Module Contract (Phase 2 scaffold) ────────────
//
// UI-Native modules simulate MOBILE SCREENSHOT output (WhatsApp, Messenger,
// TikTok comments, Shopee reviews, Facebook comments). Pipeline is FUNDA-
// MENTALLY different from photographic:
//
//   1. Generate ATOMIC AI assets (avatars, product thumbnails)
//   2. Inject into a CANVAS TEMPLATE (UI skeleton)
//   3. POST-PROCESS for screenshot realism (jpeg recompress, blur, crop drift)
//   4. AUTHENTICITY QC (status bar / spacing / typography / compression)
//
// Each platform has its own template module. WhatsApp template never
// imports from Messenger, Shopee never imports from TikTok. Architectural
// rule: no cross-platform leakage.
//
// P2 only declares the interface — no canvas templates, no reference
// library yet. Implementation starts at P5 (Chat Proof MVP).

import type { AssetTypeId, AssetCategory, GenerateAssetParams, GeneratedAsset } from './asset'

/** Which mobile platform's UI this module simulates. */
export type UINativePlatform =
  | 'whatsapp'
  | 'messenger'
  | 'tiktok-comment'
  | 'tiktok-shop'
  | 'shopee'
  | 'facebook'

/** Variant within a platform — eg conversation type, review style. */
export type UINativeVariant = string

/** Locale for usernames, language register, and reference exemplar pick. */
export type UINativeLocale = 'my-MY' | 'vi-VN' | 'id-ID' | 'global'

/** UI version vintage — apps refresh their UI; templates pinned to a year. */
export type UIVintage = '2024' | '2025'

/** Light or dark mode rendering. */
export type UITheme = 'light' | 'dark'

/** Status bar rendering style. */
export type StatusBarStyle = 'android' | 'ios'

/** Authenticity ruleset — drives QC + post-process. */
export interface UINativeAuthenticity {
  /** Must render a phone status bar (battery / signal / time) */
  requireStatusBar: boolean
  /** Timestamps must look realistic (eg "Khamis 14:23", not "00:00") */
  requireRealisticTimestamps: boolean
  /** Output must have a slight imperfect crop (~5-10px) — anti-Figma look */
  requireImperfectCrop: boolean
  /** Output must show visible JPEG compression artifacts */
  requireJpegCompression: boolean
  /** Aesthetic styles that auto-fail QC */
  bannedAesthetics: string[]
}

/** Reference exemplar pointer — module declares which reference image to use. */
export interface ReferenceExemplar {
  /** Unique exemplar id, used by registry to load the file. */
  id: string
  /** Public URL (Vite static asset path) */
  exemplarUrl: string
  /** What this exemplar exemplifies — for variant selection. */
  variantHint: UINativeVariant
}

/**
 * Generated text content — produced BEFORE the canvas render. Decoupling
 * the text generation (Gemini text) from the layout (canvas template)
 * means we don't ask KIE to render small UI text (which fails).
 */
export interface UINativeTextContent {
  /** Participants in a chat / review thread. */
  participants: {
    displayName: string
    avatarHint: string  // for atomic AI avatar generation
    locale: UINativeLocale
  }[]

  /** Messages / reviews / comments. */
  items: {
    side?: 'incoming' | 'outgoing'  // chat-style only
    authorIdx: number  // index into participants[]
    text: string
    timestamp: string
    reactions?: string[]
    hasAttachment?: 'product' | 'photo' | 'none'
  }[]

  /** Conversation / review context metadata. */
  context: {
    topic: string
    niche?: string
    productName?: string
    /** P48 — for facebook-comment threads: the original post caption +
     *  the page / creator name + post-engagement counts that appear
     *  above the comments. Optional so chat / review payloads stay
     *  unchanged. */
    postCaption?: string
    ownerName?: string
    postLikes?: number
    postShares?: number
  }
}

/**
 * Canvas template render contract — pure pixel rendering function.
 * Templates do NOT call KIE; they consume already-generated atomic
 * assets. Implementation: OffscreenCanvas + 2D context.
 *
 * Templates live in engines/ui-native/<platform>/template-*.ts.
 */
export interface UINativeTemplate {
  /** Template id (eg 'whatsapp-conversation-v1') */
  id: string
  /** Platform this template belongs to. */
  platform: UINativePlatform
  /** UI variant covered by this template. */
  variant: UINativeVariant
  /** Output canvas dimensions (9:16 = 1080×1920 typical for mobile). */
  canvasSize: { width: number; height: number }
  /** Theme + status bar style this template renders. */
  theme: UITheme
  statusBarStyle: StatusBarStyle
  /** UI vintage — for visual accuracy. */
  uiVintage: UIVintage
}

/** Post-process intensity preset. */
export type PostProcessIntensity = 'subtle' | 'medium' | 'heavy'

/**
 * UI-Native module contract. Every file under
 * engines/ui-native/<asset-id>/module.ts exports an object of this shape.
 *
 * P2 only declares — implementation lands in P5.
 */
export interface UINativeModule {
  /** Canonical asset type id. */
  id: AssetTypeId

  /** Always 'ui-native'. */
  engineGroup: 'ui-native'

  /** UI label. */
  label: { vi: string; en: string }

  /** UI grouping category. */
  category: AssetCategory

  /** Platform this module covers. */
  platform: UINativePlatform

  /** Locale default. */
  defaultLocale: UINativeLocale

  /** Authenticity ruleset for QC + post-process. */
  authenticity: UINativeAuthenticity

  /** Default reference exemplar pool — module picks from these per generation. */
  defaultExemplars: ReferenceExemplar[]

  // ── Builder methods (implemented in P5, stubbed in P2) ───────────────

  /** Pick the right canvas template for this generation. */
  buildCanvasTemplate(params: GenerateAssetParams): UINativeTemplate

  /** Generate text content (Gemini Text call). */
  buildTextPayload(params: GenerateAssetParams): Promise<UINativeTextContent>

  /** Build atomic avatar generation specs (KIE image-to-image specs). */
  buildAvatarPayload(text: UINativeTextContent): { prompts: string[]; refs?: string[] }[]

  /** Build product thumbnail spec (optional, only if attachment is product). */
  buildProductThumb(params: GenerateAssetParams): { prompt: string; refs: string[] } | null

  /** Post-process intensity for this module. */
  postProcess: PostProcessIntensity

  /** Take canvas output + metadata and normalise to GeneratedAsset. */
  normalizeOutput(raw: { outputUrl: string; productId?: string }, params: GenerateAssetParams): GeneratedAsset
}
