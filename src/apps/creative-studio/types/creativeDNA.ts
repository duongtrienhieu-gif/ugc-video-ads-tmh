// ── Creative DNA & Prompt Block Contracts (P15) ────────────────────────────
//
// AI MARKETING OS layer that sits between the user-facing
// CreativeCategory + the engine dispatchers. Every creative type gets:
//
//   1. CreativeDNA          — 10 psychology / composition attributes
//                             that describe THE ANGLE this asset hits
//   2. PromptBlock[]        — composable text fragments the assembler
//                             stitches into the final KIE prompt
//   3. OutputRules          — per-type rules the renderer enforces
//                             (layout, typography, what NOT to do)
//   4. NegativeBlock[]      — per-type ban list specific to the angle
//
// Model routing is currently single-target (gpt-image-2 via KIE) — the
// `engineModel` field is recorded in DNA for analytics + future
// multi-provider routing. No backend change today.
//
// SCALING RULE (per P15 spec §10): adding a new creative type =
// adding one CreativeConfig entry. NO new code in dispatcher / assembler.

import type { AssetTypeId } from './asset'
import type { EngineGroup } from './engine'
import type { CategoryId } from '../uiCatalog/assetCatalog'

// ── DNA ────────────────────────────────────────────────────────────────

export type EmotionTone =
  | 'hype' | 'trust' | 'curiosity' | 'shock' | 'aspiration' | 'intimacy'
  | 'authority' | 'urgency' | 'comfort' | 'wonder'

export type RealismLevel = 'highly-real' | 'natural' | 'stylized' | 'cinematic-fantasy'

export type CompositionKind =
  | 'crowd-centered' | 'single-subject-centered' | 'split-frame'
  | 'flat-lay' | 'editorial-rule-of-thirds' | 'mobile-screenshot'
  | 'infographic-hierarchy' | 'product-hero' | 'lifestyle-environmental'

export type ProductVisibility = 'hero-dominant' | 'high' | 'contextual' | 'absent'

export type TextImportance = 'critical' | 'supporting' | 'minimal' | 'none'

export type PlatformStyle =
  | 'tiktok' | 'instagram-feed' | 'instagram-story' | 'facebook-ads'
  | 'shopee' | 'tiktok-shop' | 'landing-page' | 'whatsapp' | 'messenger'
  | 'ecommerce-thumbnail' | 'pinterest' | 'editorial-print'

export type CameraStyle =
  | 'handheld-smartphone' | 'selfie-ring-light' | 'tripod-studio'
  | 'overhead-flatlay' | 'security-cam' | 'cinematic-handheld'
  | 'macro-detail' | 'wide-environmental'

export type RenderStyle =
  | 'ugc-realism' | 'studio-clean' | 'editorial-beauty' | 'luxury-mood'
  | 'clinical-pharma' | 'infographic-vector' | 'mobile-ui-screenshot'
  | 'cinematic-still'

/** 10 attributes — the marketing brain summary of an asset type. */
export interface CreativeDNA {
  /** Marketing category this DNA belongs to (matches UI picker). */
  category: CategoryId
  /** What conversion / trust outcome the asset is designed to drive. */
  marketingGoal: string
  /** Primary emotional tone. */
  emotion: EmotionTone
  /** Realism dial. */
  realism: RealismLevel
  /** Composition convention. */
  composition: CompositionKind
  /** How dominant the product should be. */
  productVisibility: ProductVisibility
  /** Whether text matters (drives model + negative selection). */
  textImportance: TextImportance
  /** Platform this asset is optimized for. */
  platformStyle: PlatformStyle
  /** Camera language. */
  cameraStyle: CameraStyle
  /** Top-level render style. */
  renderStyle: RenderStyle
}

// ── Prompt blocks ──────────────────────────────────────────────────────

export type PromptBlockKind =
  | 'scene' | 'lighting' | 'camera' | 'emotion' | 'socialProof'
  | 'ugc' | 'platform' | 'textRendering' | 'product' | 'negative'
  | 'continuity' | 'composition'

/** A single text fragment with a kind tag. The assembler concatenates
 *  these in a stable order (defined by ASSEMBLE_ORDER). */
export interface PromptBlock {
  kind: PromptBlockKind
  /** Pre-rendered text OR a function that builds text from runtime
   *  params (productName, persona, beat, etc). */
  text: string | ((ctx: PromptContext) => string)
  /** Optional weight hint (not used by KIE today; recorded for future
   *  weighted-prompt models like Flux Pro). */
  weight?: number
}

/** Runtime context passed to block builders. */
export interface PromptContext {
  productName?: string
  productDescription?: string
  hasAvatar: boolean
  hasBaseRef: boolean
  variationHint?: string | null
  personaId?: string
  beatId?: string
  locale?: string
  /** P25 — full product knowledge profile, loaded from bankStore.
   *  Blocks that need niche / benefits / pain points / audience read
   *  from here instead of inferring from the product image. */
  productKnowledge?: import('../services/productKnowledge').ProductKnowledge
}

// ── Output rules ───────────────────────────────────────────────────────

export interface OutputRules {
  /** Required aspect ratio. */
  aspectRatio: '1:1' | '4:5' | '9:16' | '3:2' | '16:9'
  /** Things the renderer / QC must enforce.  Free-form labels —
   *  analytics + future automated QC consume these. */
  enforce: string[]
  /** Things the renderer must NOT produce — feeds the negative block. */
  forbid: string[]
}

// ── Full creative config ───────────────────────────────────────────────

export interface CreativeConfig {
  /** Must match a key in ASSET_REGISTRY + AssetCatalogEntry.id. */
  id: AssetTypeId
  /** Which engine dispatcher handles this asset. */
  engine: EngineGroup
  /** Backend model identifier — for analytics + future routing.
   *  Single value today; later may become a router rule. */
  model: 'gpt-image-2' | 'gemini-canvas' | 'gemini-text+canvas'
  /** DNA — the marketing brain. */
  dna: CreativeDNA
  /** Composable prompt blocks. Only meaningful for prompt-driven engines
   *  (photographic). UI-native + designed-graphic use template render —
   *  their blocks may be empty / analytics-only. */
  promptBlocks: PromptBlock[]
  /** Extra negative ban list specific to this creative — appended to
   *  the global negative block. */
  negativeBlocks: string[]
  /** Output rules — what the renderer must enforce. */
  outputRules: OutputRules
}

/** Standard block assembly order. The assembler concatenates blocks
 *  whose kind appears in this list, in this order.  Blocks of any
 *  other kind are emitted last. */
export const ASSEMBLE_ORDER: PromptBlockKind[] = [
  'product',
  'composition',
  'scene',
  'continuity',
  'emotion',
  'socialProof',
  'ugc',
  'lighting',
  'camera',
  'platform',
  'textRendering',
  'negative',
]
