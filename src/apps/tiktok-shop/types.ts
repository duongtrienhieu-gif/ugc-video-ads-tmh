// TikTok Shop — type contract.
// Phase 1: skeleton types. Locked for Phase 2-3 consumption.

import type { Market } from '../../types/brandKit'
export type { Market }

// ── 9-slot conversion arc ────────────────────────────────────────────────
// Intent is LOCKED per slot — never user-overridable. The 9 intents form a
// fixed PAS/AIDA narrative for TPCN health listings.

export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type SlotIntent =
  | 'hero-hook'
  | 'pain-point'
  | 'transformation'
  | 'usp-mechanism'
  | 'social-proof'
  | 'usage-demo'
  | 'comparison'
  | 'qualifying-checklist'
  | 'brand-story-bar'

// ── 6 composition families ───────────────────────────────────────────────
// Locked per slot (code chooses, not user). Tier 3 in the consistency system.

export type CompositionFamily =
  | 'pill-bottle-hero-centered'
  | 'split-screen-before-after'
  | 'floating-ingredients-bottle'
  | 'testimonial-card-overlay'
  | 'step-infographic'
  | 'cert-lab-report-stack'

// ── 3 atmosphere variants ────────────────────────────────────────────────
// Tier 2 visual variation within the same brand palette. Each slot is
// pre-assigned one variant in SLOT_MAP.

export type AtmosphereVariant = 'classic' | 'soft' | 'energetic'

// ── 4 TPCN palette families ──────────────────────────────────────────────
// Brand Kit primary color snaps to the nearest of these 4 fixed palettes.
// Ensures medical-commerce feel across all listings.

export type PaletteFamily = 'medicalBlue' | 'cleanGreen' | 'softMint' | 'premiumNavy'

// ── Slot configuration ───────────────────────────────────────────────────
// Maps each slot number to its locked attributes. Constants file owns SLOT_MAP.

export interface SlotConfig {
  slot: SlotNumber
  intent: SlotIntent
  intentLabel: string             // VN label shown in app UI
  composition: CompositionFamily
  atmosphere: AtmosphereVariant
  visualMode: 'ai-gen' | 'canvas-only'
  highRes: boolean                // true → 2K (10 credits), false → 1K (6 credits)
}

// ── Overlay config — deterministic text/visuals rendered by canvas ──────
// AI never touches text. Code reads from this and renders via Konva (Phase 2).

export interface OverlayConfig {
  headline?: string
  subheadline?: string
  bullets?: string[]
  metric?: { value: string; label?: string }
  badges?: string[]
  cta?: string
  testimonial?: { quote: string; author: string; rating?: number }
  steps?: { number: number; icon?: string; text: string }[]
  comparison?: { headers: [string, string]; rows: Array<[string, string]> }
  faq?: { q: string; a: string }[]
  price?: { current: string; original?: string; discount?: string }
  disclaimer?: string             // e.g. "Hasil mungkin berbeza individu"
}

// ── Per-slot output image ────────────────────────────────────────────────

export type ImageGenStatus = 'pending' | 'generating' | 'completed' | 'failed'

export interface ListingImage {
  slot: SlotNumber
  config: SlotConfig
  imageAssetId: string | null     // null until completed; asset-uuid in Supabase
  overlay: OverlayConfig
  aiGenPrompt?: string            // saved for re-roll diagnostics
  status: ImageGenStatus
  error?: string
  generatedAt?: string
}

// ── 11-block description ─────────────────────────────────────────────────
// Aligns with the 9-slot arc + opening hook + closing promise/CTA.

export type DescriptionBlock =
  | { kind: 'hook';      text: string }
  | { kind: 'pain';      bullets: string[] }
  | { kind: 'solution';  text: string }
  | { kind: 'benefits';  bullets: string[] }
  | { kind: 'specs';     rows: Array<[string, string]> }
  | { kind: 'reviews';   quotes: Array<{ text: string; author: string }> }
  | { kind: 'usage';     steps: string[] }
  | { kind: 'offer';     text: string }
  | { kind: 'faq';       items: Array<{ q: string; a: string }> }
  | { kind: 'promise';   bullets: string[] }
  | { kind: 'cta';       text: string }

export type DescriptionBlockKind = DescriptionBlock['kind']

// ── Product Brief — Phase 10 (Vision-based product understanding) ──────
// Extracted ONCE upfront via Gemini Vision (on reference product images +
// metadata) before any description or image generation. Acts as the single
// source of truth that flows through description gen + all 9 image slots +
// combo thumbnails — ensures every output anchors to the same understanding
// of the product (mirrors Super Ladipage's extractProductIdentity pattern).
//
// READ-ONLY across the rest of the pipeline — never re-derived per slot.

export interface TiktokShopProductBrief {
  // ── Vision-extracted from product image / packaging label ──
  /** Exact product name as printed on the label (e.g. "LANZF Nasal Care Spray"). */
  productNameExact: string
  /** Category in plain English (e.g. "Nasal Care Spray", "Whitening Toothpaste"). */
  productCategory: string
  /** Product form factor (e.g. "spray bottle", "cream jar", "tablet box", "patch"). */
  productSubtype: string
  /** Short visual description of packaging for image consistency
   *  (e.g. "blue plastic spray bottle ~30ml with white cap, red wave logo on white box"). */
  packagingDescription: string
  /** Visible brand colors from refs, hex or names (e.g. ["#1E4D8C", "#FFFFFF", "red"]). */
  primaryColors: string[]
  /** ONLY ingredient names visible on the actual product label/packaging.
   *  EMPTY array if label doesn't show ingredients — must NOT be invented. */
  visibleIngredients: string[]

  // ── Customer inference ──
  targetCustomer: {
    ageRange: string                    // e.g. "25-45"
    primaryGender: 'female' | 'male' | 'mixed'
    dailyContext: string                // e.g. "office workers in AC environments with nasal dryness"
  }

  // ── Physical application context (Phase 11 — context intelligence) ──
  // Tells image-gen WHERE on body / surface the product is used and HOW.
  // Critical for slots that show usage (slot 2 pain, slot 3 transformation,
  // slot 6 usage demo, slot 5 customer chat). Without this, AI may render
  // a knee brace on the arm or a face cream on the elbow.
  applicationDetails: {
    /** Where on the body / surface the product is applied.
     *  E.g., "knee joint", "lower back", "nostrils", "facial skin (cheeks + forehead)",
     *  "scalp", "lips", "tongue", "(oral — swallowed, no body application)". */
    bodyZone: string
    /** Concrete physical interaction. E.g.,
     *  - "wrap around the knee joint and secure velcro straps tightly"
     *  - "spray 1-2 puffs into each nostril while head tilted slightly back"
     *  - "apply a pea-sized amount with fingertip in circular motion"
     *  - "place 1 tablet under tongue, let dissolve" */
    howApplied: string
    /** Full image-gen scene direction — ONE concrete sentence describing the
     *  pose / camera / action so AI renders the right body interaction.
     *  E.g., "Person sitting on a couch with knee bent at 90°, both hands
     *  wrapping the brace around the knee joint, securing the velcro strap,
     *  medium close-up camera angle focused on the knee". */
    usageScene: string
  }

  // ── Pain & promise (commercial copywriting anchor) ──
  /** 3 customer-voice pain feelings ranked by emotional intensity, max 12 words each. */
  corePains: string[]
  /** What specifically changes after using this product (concrete, observable). */
  transformationPromise: string
  /** ALL CAPS short metric like "DALAM 15 MINIT" / "3× LEBIH LANCAR" — for slot 3. */
  specificMetric: string
  /** What makes this product different from generic alternative (specific, measurable). */
  keyDifferentiator: string
  /** Where/when the product is typically used (e.g. "morning + before sleep"). */
  usageContext: string
  /** Top 3 buyer objections (safety / timing / returns / etc.). */
  commonObjections: string[]

  // ── Legal / niche safety ──
  /** 3-5 claims that are SAFE to make for this product's niche. */
  nicheSafeClaims: string[]
  /** Claims to avoid (cert/clinical/regulatory landmines for this niche). */
  forbiddenClaims: string[]
}

// ── Per-slot text overlays — Phase 8 ────────────────────────────────────
// Generated by the description AI call (one shot, same JSON) so image
// prompts no longer carry HARDCODED product-specific copy. The image AI
// renders these strings inside its scene.

export interface SlotTexts {
  slot1?: { headline: string; tagline: string }
  slot2?: { question: string; painBullets: string[] }
  slot3?: { beforeLabel: string; afterLabel: string; metric: string; metricSubtitle: string; disclaimer: string }
  slot4?: { title: string; ingredients: Array<{ name: string; pct?: string }>; tagline: string }
  /** Slot 5 — WhatsApp-screenshot social proof (2-way conversation).
   *  conversation: alternating customer + shop bubbles. Customer = right-aligned
   *  green; shop = left-aligned white. Typical flow:
   *  1) customer: pain context
   *  2) customer: result after using (mentions body zone naturally)
   *  3) shop: thank-you + dặn dò (instruction to keep using)
   *  4) optional customer: thank-you / will-order-again. */
  slot5?: {
    contactName: string
    conversation: Array<{ from: 'customer' | 'shop'; text: string }>
    verifiedNote: string
  }
  slot6?: { title: string; steps: string[]; timing: string }
  slot7?: { title: string; usLabel: string; themLabel: string; points: Array<[string, string]> }
  /** Slot 8 — qualifying checklist ("Ai nên dùng?").
   *  5 concrete signs anchored to brief.corePains + targetCustomer.dailyContext.
   *  qualifier = bottom callout like "Có 2/5 dấu hiệu? Đây là sản phẩm cho bạn". */
  slot8?: { title: string; signs: string[]; qualifier: string }
  /** Slot 9 — brand story bar (3 product-specific reasons).
   *  Each reason: short specific headline + concrete one-line detail.
   *  MUST be grounded in brief (keyDifferentiator, visibleIngredients,
   *  packagingDescription, nicheSafeClaims) — never generic adjectives. */
  slot9?: { title: string; reasons: Array<{ headline: string; detail: string }> }
}

export interface ListingDescription {
  blocks: DescriptionBlock[]
  fullText: string                // assembled copy-pasteable string
  slotTexts?: SlotTexts           // Phase 8 — feeds image prompts
}

// ── Combo / variant option (Phase 7B) ────────────────────────────────────
// Each ComboOption produces ONE separate thumbnail image (1024×1024) shown
// in TikTok Shop's option picker. Independent from the 9-slot main listing.

export interface ComboOption {
  id: string
  /** Variant display name shown on the thumbnail + variant picker.
   *  E.g., "1 Kem trắng răng", "Combo 1: 1 kem + 1 xịt" */
  name: string
  /** Short visual description of what the combo contains — AI uses this
   *  to compose the thumbnail. E.g., "1 jar of mineral powder",
   *  "1 jar mineral powder + 1 spray bottle". */
  description: string
  /** Highlight as "Hot" / featured variant. */
  isHot?: boolean
  /** Explicit count of product instances to show in the thumbnail. When set,
   *  the AI prompt enforces this count instead of trying to infer from
   *  description. E.g., productCount=2 → "show EXACTLY 2 jars". */
  productCount?: number
  /** Generated thumbnail asset (null until generated). */
  imageAssetId: string | null
  status: ImageGenStatus
  error?: string
  generatedAt?: string
  /** Prompt used for the last gen — kept for re-roll diagnostics. */
  aiGenPrompt?: string
}

// ── Saved listing output ─────────────────────────────────────────────────
// Persisted to Supabase user_outputs (kind='tiktok-shop-listing') in Phase 4.

export interface ListingOutput {
  id: string
  productId: string
  brandKitId: string
  brandKitVersion: number         // snapshot — detect stale brand kit
  market: Market
  category: 'tpcn-health'         // locked Phase 1 — TPCN niche only
  paletteFamily: PaletteFamily
  createdAt: string
  updatedAt: string
  images: ListingImage[]
  description: ListingDescription
  /** Optional combo/variant thumbnails — Phase 7B addition. */
  combos?: ComboOption[]
}

// ── Working draft (in-app state, not persisted as final) ─────────────────

export interface ListingDraft {
  brandKitId: string | null
  productId: string | null
  referenceImageAssetIds: string[]  // 2-5 user-uploaded product photos
  market: Market
  output: ListingOutput | null      // populated after generation
  isGenerating: boolean
  /** Phase 10 — Vision-extracted product brief. Cached across re-rolls so
   *  the same product doesn't get re-analyzed every time. Invalidated when
   *  productId or referenceImageAssetIds change. */
  productBrief?: TiktokShopProductBrief | null
  /** Cache key — productId + ref images hash. When this changes, brief is stale. */
  productBriefKey?: string | null
}

// ── Validation ───────────────────────────────────────────────────────────

export interface DraftReadiness {
  ready: boolean
  missing: string[]
  warnings: string[]
}
