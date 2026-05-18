// ── Photographic Engine Group — Module Contract (Phase 2 scaffold) ─────────
//
// Every module under engines/photographic/ implements this contract. P2
// only declares the interface; P3 populates the first concrete modules
// (product-shot, ugc-selfie, etc.).
//
// Pipeline: prompt → KIE GPT-4o image generation → QC → normalised asset.
// Reference image strategy: product + optional avatar (loose person lock).

import type { AssetTypeId, AssetCategory, GenerateAssetParams, GeneratedAsset } from './asset'

/** Photographic-group composition rules — surfaced to QC + analytics. */
export interface PhotographicComposition {
  /** How dominant the product should be in the frame (0-1). */
  productDominance: number
  /** How dominant a person/face should be (0-1). 0 = no person. */
  faceDominance: number
  /** Allowed camera angles for this scene. Free-form labels. */
  allowedAngles: string[]
  /** Layouts that must NOT appear (eg "centered-symmetrical" for UGC). */
  forbiddenLayouts: string[]
}

/** Per-module QC configuration — wired into shared/qc/ at runtime. */
export interface PhotographicQCConfig {
  /** Run brand-identity check (label / logo / bottle match). */
  enableProductLockQC: boolean
  /** Minimum acceptable score 0-100 to pass. */
  minPassScore: number
  /** Engine-group-specific extra checks (continuity, composition, ethnicity, etc). */
  extraChecks?: string[]
}

/** Negative-prompt strategy per module. Combined with shared negatives. */
export interface PhotographicNegative {
  /** Module-specific banned tokens / patterns. */
  moduleNegatives: string[]
  /** Whether to apply shared global negatives (recommended: true). */
  applyGlobalNegatives: boolean
}

/**
 * Photographic module contract. Every file under
 * engines/photographic/<asset-id>/module.ts exports an object of this
 * shape as `export const module: PhotographicModule`.
 *
 * P2 only declares the interface; build*() functions are not invoked.
 * P3 will implement these in extracted modules.
 */
export interface PhotographicModule {
  /** Canonical asset type id — must match registry key. */
  id: AssetTypeId

  /** Always 'photographic' — narrows the union at the type level. */
  engineGroup: 'photographic'

  /** UI display label (Vietnamese first per Phase 7 spec). */
  label: { vi: string; en: string }

  /** UI grouping category. */
  category: AssetCategory

  /** Output aspect ratio for this module. */
  aspectRatio: '1:1' | '4:5' | '9:16' | '3:2' | '16:9'

  /** Composition rules — informs prompt builder + QC. */
  composition: PhotographicComposition

  /** Negative prompt strategy. */
  negative: PhotographicNegative

  /** QC configuration. */
  qc: PhotographicQCConfig

  // ── Builder methods (implemented in P3, stubbed in P2) ───────────────

  /** Build the prompt body fed to KIE. May reference params.options. */
  buildPrompt(params: GenerateAssetParams): string

  /** Build the negative prompt string. */
  buildNegativePrompt(params: GenerateAssetParams): string

  /** Compose the full request (prompt + refs + size + aspect). The
   *  orchestrator calls this then hands the composition off to KIE. */
  buildComposition(params: GenerateAssetParams): {
    prompt: string
    negativePrompt: string
    referenceUrls: string[]
    aspect: '1:1' | '2:3' | '3:2'
  }

  /** Resolve QC config for a specific generation run. */
  buildQC(params: GenerateAssetParams): PhotographicQCConfig

  /** Take raw KIE output URL + metadata and normalise to GeneratedAsset.
   *  Each module decides whether to attach engine extras / tags. */
  normalizeOutput(raw: { outputUrl: string; productId?: string; modelId?: string }, params: GenerateAssetParams): GeneratedAsset
}
