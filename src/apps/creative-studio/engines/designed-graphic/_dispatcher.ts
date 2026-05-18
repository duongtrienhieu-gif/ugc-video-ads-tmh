// ── Designed-Graphic Engine Dispatcher (P8 — body filled) ───────────────────
//
// Runtime pipeline for designed-graphic modules. Replaces the P7 stub.
//
// Flow:
//   1. Resolve product context from bankStore (productId required)
//   2. Resolve typography / layout / colorTheme via module builders
//      (caller can override via params.options.{layoutId, typographyId,
//      colorThemeId})
//   3. Generate text content payload (Gemini Text) OR consume
//      params.options.content (caller short-circuit)
//   4. Resolve product image URL from bankStore
//   5. Render canvas via the platform renderer
//      (rendererKind from module.metadata.engineExtras)
//   6. Save asset (JPEG, no post-process drift — designed assets
//      should be pixel-clean unlike ui-native screenshots)
//   7. Normalize output via factory

import type { DesignedGraphicModule } from '../../types/designedGraphic'
import type { GenerateAssetParams, GeneratedAsset } from '../../types/asset'
import type { UINativeLocale } from '../../types/uiNative'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useBankStore } from '../../../../stores/bankStore'
import { saveAsset } from '../../../../utils/assetStore'
import { canvasToBlob } from '../../shared/canvas'
import { toPublicUrl } from '../../shared/utils/refResolver'
import { runBaselineQC } from '../../shared/qc/baselineQC'
import {
  generateInfographicContent,
  generateCtaBannerContent,
  type InfographicContent,
  type CtaBannerContent,
  type ContentRequest,
} from './_textPayload'
import { renderInfographic } from './infographic/template'
import { renderCtaBanner } from './cta-banner/template'
import { fromProduct, type ProductKnowledge } from '../../services/productKnowledge'
import { findCreativeConfig } from '../../creativeConfig/configs'
import { dnaSummary } from '../../shared/prompt/dnaDirective'
import type { Product } from '../../../../stores/types'
import type { CreativeDNA } from '../../types/creativeDNA'

export async function dispatchDesignedGraphic(
  module: DesignedGraphicModule,
  params: GenerateAssetParams = {},
): Promise<GeneratedAsset> {
  const settings = useSettingsStore.getState()

  // ── Step 1: resolve product context ────────────────────────────────
  const bank = useBankStore.getState()
  const product = params.productId ? bank.getProductById(params.productId) : null

  // ── Step 2: build design tokens via the module's builders ──────────
  const layout = module.buildLayout(params)
  const typography = module.buildTypography(params)
  const colorTheme = module.buildColorTheme(params)

  // ── Step 3: text content ──────────────────────────────────────────
  const opts = (params.options ?? {}) as Record<string, unknown>
  const locale = (opts.locale as UINativeLocale | undefined) ?? 'vi-VN'

  // Determine renderer kind from module engineExtras (set by the
  // factory spec — eg 'infographic' or 'cta-banner')
  const rendererKind = readRendererKind(module, params)

  if (!settings.geminiApiKey && !opts.content) {
    throw new Error('[designed-graphic dispatcher] Missing Gemini API key (or supply params.options.content to short-circuit text generation)')
  }

  const productImageRef = product?.productImage
    ? await toPublicUrl(product.productImage)
    : null
  const productImageUrl = productImageRef ?? undefined

  // P25 — load product knowledge once, share across both renderers
  const productKnowledge = product ? fromProduct(product as Product, locale) : undefined

  // P28 — load Creative DNA so its hard rule arrays append to the
  // Gemini system instruction during content generation.
  const config = findCreativeConfig(module.id)
  const dna = config?.dna

  // ── Step 4: render the canvas ─────────────────────────────────────
  let canvas: HTMLCanvasElement
  if (rendererKind === 'infographic') {
    const content = (opts.content as InfographicContent | undefined)
      ?? await generateInfographicContent(settings.geminiApiKey, buildContentReq('infographic', product ?? null, opts, locale, productKnowledge, dna))
    canvas = await renderInfographic({
      content,
      layout,
      typography,
      colorTheme,
      productImageUrl,
    })
  } else if (rendererKind === 'cta-banner') {
    const content = (opts.content as CtaBannerContent | undefined)
      ?? await generateCtaBannerContent(settings.geminiApiKey, buildContentReq('cta-banner', product ?? null, opts, locale, productKnowledge, dna))
    canvas = await renderCtaBanner({
      content,
      layout,
      typography,
      colorTheme,
      productImageUrl,
    })
  } else {
    throw new Error(`[designed-graphic dispatcher] Unknown rendererKind "${rendererKind}" — module "${module.id}" misconfigured engineExtras.rendererKind`)
  }

  // ── Step 5: save (no crop drift / authenticity post-process —
  //     designed assets stay pixel-clean) ─────────────────────────────
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.94)

  // ── Step 6: baseline QC (P9 — promoted shared, engine-agnostic) ───
  const qc = await runBaselineQC({
    blob,
    expectedWidth:  layout.canvasSize.width,
    expectedHeight: layout.canvasSize.height,
    requireJpeg:    true,
  })

  const assetRef = await saveAsset(blob, 'image/jpeg')

  console.info('[designed-graphic dispatcher]', {
    assetType: module.id,
    rendererKind,
    canvasSize: layout.canvasSize,
    blobSize: blob.size,
    qc: { passed: qc.passed, overall: qc.overall, issues: qc.issues.length },
  })

  // ── Step 7: normalize output via factory + attach QC ──────────────
  const asset = module.normalizeOutput(
    { outputUrl: assetRef, productId: params.productId },
    params,
  )
  asset.metadata.qcSummary = {
    passed:     qc.passed,
    overall:    qc.overall,
    issues:     qc.issues,
    visionPass: qc.visionPass,
  }
  // P28 — surface DNA rule snapshot on the asset.
  if (dna) {
    asset.metadata.engineExtras = {
      ...(asset.metadata.engineExtras ?? {}),
      creativeDna: dnaSummary(dna),
    }
  }
  return asset
}

// ── Helpers ────────────────────────────────────────────────────────────

function readRendererKind(module: DesignedGraphicModule, params: GenerateAssetParams): string {
  // First check the engineExtras encoded by the factory spec
  const normalized = module.normalizeOutput({ outputUrl: 'unused' }, params)
  const extras = normalized.metadata.engineExtras as Record<string, unknown> | undefined
  const kind = extras?.['rendererKind']
  if (typeof kind === 'string') return kind
  // Fallback: map by module id (defensive default)
  if (module.id === 'infographic') return 'infographic'
  if (module.id === 'cta-banner')  return 'cta-banner'
  return ''
}

interface BankProductLike {
  productName?: string
  productDescription?: string
  targetMarket?: string
  /** Freeform string from bankStore — newline / comma separated. */
  benefits?: string
  usps?: string
  offer?: string
}

/** Split a freeform benefits / usps string into an array. Accepts
 *  newline, semicolon, bullet glyphs, or commas as separators. */
function splitList(s: string | undefined): string[] | undefined {
  if (!s) return undefined
  const parts = s
    .split(/\n|;|•|·|—|\s\|\s/)
    .map((p) => p.replace(/^\s*[-*•·]\s*/, '').trim())
    .filter((p) => p.length > 1)
  return parts.length ? parts : undefined
}

function buildContentReq(
  kind: 'infographic' | 'cta-banner',
  product: BankProductLike | null,
  opts: Record<string, unknown>,
  locale: UINativeLocale,
  productKnowledge?: ProductKnowledge,
  dna?: CreativeDNA,
): ContentRequest {
  return {
    kind,
    locale,
    productName:        product?.productName ?? (opts.productName as string | undefined) ?? 'this product',
    productDescription: product?.productDescription ?? (opts.productDescription as string | undefined),
    niche:              (opts.niche as string | undefined) ?? product?.targetMarket,
    benefits:           (opts.benefits as string[] | undefined) ?? splitList(product?.benefits),
    usps:               (opts.usps as string[] | undefined) ?? splitList(product?.usps),
    offer:              (opts.offer as string | undefined) ?? product?.offer,
    tone:               opts.tone as string | undefined,
    productKnowledge,
    dna,
  }
}
