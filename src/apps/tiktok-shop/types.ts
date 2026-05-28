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
  | 'offer-combo'
  | 'faq-assurance'

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

export interface ListingDescription {
  blocks: DescriptionBlock[]
  fullText: string                // assembled copy-pasteable string
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
  /** Current sale price, free-form string. E.g., "359K", "RM 89", "508K". */
  price: string
  /** Optional original / struck-through price for discount badge. */
  originalPrice?: string
  /** Optional display label for discount badge. E.g., "-44%", "JIMAT 70K".
   *  If user provides both price + originalPrice, UI can auto-suggest a value
   *  but final string is what the user types. */
  discount?: string
  /** Highlight as "Hot" / featured variant. */
  isHot?: boolean
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
}

// ── Validation ───────────────────────────────────────────────────────────

export interface DraftReadiness {
  ready: boolean
  missing: string[]
  warnings: string[]
}
