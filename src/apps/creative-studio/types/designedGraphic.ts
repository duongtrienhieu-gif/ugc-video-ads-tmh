// ── Designed-Graphic Engine Group — Module Contract (Phase 2 scaffold) ─────
//
// Designed-Graphic modules produce LAYOUT-DRIVEN outputs: infographics,
// CTA banners, comparison charts, promo posters. Pipeline mixes canvas
// composition (typography, layout grid, color theme) with AI for image
// regions (background, ingredient macros).
//
// P2 only declares the interface. Implementation lands at P8 (designed-
// graphic group). For now this exists so that:
//   1. The registry can reference designed-graphic asset ids
//   2. Cross-group import discipline is enforced from day one
//   3. Future P8 work has a contract to fill in

import type { AssetTypeId, AssetCategory, GenerateAssetParams, GeneratedAsset } from './asset'

/** Color theme — narrow design tokens drive layout consistency. */
export interface DesignedGraphicColorTheme {
  /** Primary brand-aligned color (hex). */
  primary: string
  /** Accent color for CTA / highlights. */
  accent: string
  /** Background base. */
  background: string
  /** Text on background. */
  foreground: string
  /** Optional gradient stop array for hero blocks. */
  gradient?: string[]
}

/** Typography hierarchy. Templates are typeface-agnostic but scale-aware. */
export interface DesignedGraphicTypography {
  /** Display headline scale (px at 1080 canvas width). */
  displayPx: number
  /** Body copy scale. */
  bodyPx: number
  /** Caption / footnote scale. */
  captionPx: number
  /** Font family stack (web-loaded). */
  fontStack: string
}

/** Layout grid declaration. */
export interface DesignedGraphicLayout {
  /** Canvas output size. */
  canvasSize: { width: number; height: number }
  /** Grid columns. */
  gridColumns: number
  /** Padding (px). */
  padding: { top: number; right: number; bottom: number; left: number }
  /** Layout id — for runtime template lookup. */
  templateId: string
}

/**
 * Designed-Graphic module contract.
 *
 * P2 only declares — implementation lands in P8.
 */
export interface DesignedGraphicModule {
  /** Canonical asset type id. */
  id: AssetTypeId

  /** Always 'designed-graphic'. */
  engineGroup: 'designed-graphic'

  /** UI label. */
  label: { vi: string; en: string }

  /** UI grouping category. */
  category: AssetCategory

  /** Output aspect ratio. */
  aspectRatio: '1:1' | '4:5' | '9:16' | '3:2' | '16:9'

  // ── Builder methods (implemented in P8, stubbed in P2) ───────────────

  /** Build the layout configuration for this generation. */
  buildLayout(params: GenerateAssetParams): DesignedGraphicLayout

  /** Build typography settings. */
  buildTypography(params: GenerateAssetParams): DesignedGraphicTypography

  /** Build the color theme. */
  buildColorTheme(params: GenerateAssetParams): DesignedGraphicColorTheme

  /** Take canvas output + metadata and normalise to GeneratedAsset. */
  normalizeOutput(raw: { outputUrl: string; productId?: string }, params: GenerateAssetParams): GeneratedAsset
}
