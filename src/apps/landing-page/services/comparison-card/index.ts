// ─────────────────────────────────────────────────────────────────────
// Comparison UI Card — public entry point.
//
// renderComparisonCard()  — pure render from a fully-resolved spec.
// renderForLandingSlot()  — high-level helper invoked by generateImages.ts.
// ─────────────────────────────────────────────────────────────────────

import { drawComparisonCard } from './cardRenderer'
import { generateComparisonScene } from './sceneGen'
import { loadImage } from '../chat-proof/canvasUtils'
import { postProcess } from '../chat-proof/postProcess'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type {
  ComparisonCardSpec, ComparisonCardResult, ComparisonCardVariant,
  ComparisonContent, ComparisonBullet,
} from './types'

const VARIANT_ROTATION: ComparisonCardVariant[] = [
  'supplement-wellness',
  'tiktok-bold',
  'beauty-luxury',
  'detox-clinical',
]

export async function renderComparisonCard(spec: ComparisonCardSpec): Promise<ComparisonCardResult> {
  const width = spec.width ?? 1080
  const height = spec.height ?? 1350

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  let sceneImage: HTMLImageElement | null = null
  if (spec.sceneRef) {
    const src = isAssetRef(spec.sceneRef) ? await getUrl(spec.sceneRef) : spec.sceneRef
    if (src) {
      try { sceneImage = await loadImage(src) } catch (err) {
        console.warn('[comparison-card] scene image load failed:', err)
      }
    }
  }

  drawComparisonCard(ctx, width, height, spec.variant, spec.content, sceneImage)

  const { blob, mimeType } = await postProcess(canvas, spec.realism ?? 'subtle')
  return { blob, mimeType, width, height }
}

// ──────────────────────────────────────────────────────────────────────
// Bullet derivation — parses the section's bullets / copy into THEM / US
// pairs. The 'comparison' section is supposed to express pain → benefit
// pairings; we look for clear "X / ✓" markers, "vs" separators, or fall
// back to splitting the bullets list in half.
// ──────────────────────────────────────────────────────────────────────

const NEGATIVE_MARKERS = ['✗', '❌', 'sebelum', 'before', 'cũ', 'old', 'them', 'tradisional', 'tradisi', 'biasa', 'lain']
const POSITIVE_MARKERS = ['✓', '✅', 'selepas', 'after', 'mới', 'new', 'us', 'kami', 'lebih baik']

function isNegativeBullet(b: string): boolean {
  const low = b.toLowerCase()
  return NEGATIVE_MARKERS.some((m) => low.includes(m))
}
function isPositiveBullet(b: string): boolean {
  const low = b.toLowerCase()
  return POSITIVE_MARKERS.some((m) => low.includes(m))
}

/** Try to split each bullet on "X — Y" or "X vs Y". Returns paired
 *  THEM / US lists when the bullets are formatted that way. */
function tryPairedSplit(bullets: string[]): { them: ComparisonBullet[]; us: ComparisonBullet[] } | null {
  const them: ComparisonBullet[] = []
  const us: ComparisonBullet[] = []
  const separators = [' vs ', ' VS ', ' → ', ' — ', ' – ', ': ', ' / ']
  for (const raw of bullets) {
    const b = raw.replace(/^[•\-*]\s*/, '').trim()
    let sepIdx = -1
    let sep = ''
    for (const s of separators) {
      const i = b.indexOf(s)
      if (i > 0) { sepIdx = i; sep = s; break }
    }
    if (sepIdx < 0) return null
    them.push({ text: b.slice(0, sepIdx).trim() })
    us.push({ text: b.slice(sepIdx + sep.length).trim() })
  }
  if (them.length < 2) return null
  return { them, us }
}

/** Public — extract THEM / US bullet lists from a landing section.
 *  Strategy in order:
 *    1. Try paired split ("Messy powders → Ready to drink")
 *    2. Group by negative / positive markers
 *    3. Fall back to even split (first half = THEM, second half = US)
 */
export function deriveComparisonBullets(bullets: string[]): {
  them: ComparisonBullet[]
  us: ComparisonBullet[]
} {
  const cleaned = bullets
    .map((b) => b.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean)

  if (cleaned.length === 0) return { them: [], us: [] }

  const paired = tryPairedSplit(cleaned)
  if (paired) {
    return {
      them: paired.them.slice(0, 4),
      us: paired.us.slice(0, 4),
    }
  }

  const them: ComparisonBullet[] = []
  const us: ComparisonBullet[] = []
  for (const b of cleaned) {
    if (isPositiveBullet(b)) {
      us.push({ text: b.replace(/[✓✅]/g, '').trim() })
    } else if (isNegativeBullet(b)) {
      them.push({ text: b.replace(/[✗❌]/g, '').trim() })
    }
  }

  if (them.length >= 2 && us.length >= 2) {
    return { them: them.slice(0, 4), us: us.slice(0, 4) }
  }

  // Fallback — even split
  const half = Math.ceil(cleaned.length / 2)
  return {
    them: cleaned.slice(0, half).map((t) => ({ text: t })).slice(0, 4),
    us: cleaned.slice(half).map((t) => ({ text: t })).slice(0, 4),
  }
}

export interface RenderForLandingSlotArgs {
  slotIdx: number
  productName: string
  sectionBullets: string[]
  brandWordmark?: string
  brandDomain?: string
  totalSlides?: number
  productRefUrls: string[]
  /** Optional hint for the competitor archetype (eg "powder tub", "matte black cream jar"). */
  competitorArchetype?: string
  kieApiKey: string
  variationSeed?: string
}

function deriveDomain(productName: string): string {
  return productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14) + '.com'
}

export async function renderForLandingSlot(args: RenderForLandingSlotArgs): Promise<{
  assetRef: string
  mimeType: string
}> {
  const variant = VARIANT_ROTATION[args.slotIdx % VARIANT_ROTATION.length]
  const { them, us } = deriveComparisonBullets(args.sectionBullets)

  if (them.length === 0 || us.length === 0) {
    throw new Error('Không tìm được cặp bullet THEM / US — vui lòng kiểm tra section copy.')
  }

  const seed = args.variationSeed ?? `slot${args.slotIdx}`

  // 1) Photographic split-composition
  const sceneRef = await generateComparisonScene({
    productName: args.productName,
    productRefUrls: args.productRefUrls,
    variant,
    competitorArchetype: args.competitorArchetype,
    kieApiKey: args.kieApiKey,
    variationSeed: seed,
  })

  // 2) Canvas overlay
  const totalSlides = args.totalSlides ?? 5
  const content: ComparisonContent = {
    leftHeader: 'THEM',
    rightHeader: 'US',
    themBullets: them,
    usBullets: us,
    vsBadge: 'VS',
    carousel: {
      slideIndex: `${args.slotIdx + 1} / ${totalSlides}`,
      brandWordmark: args.brandWordmark ?? args.productName.split(/\s+/)[0],
      brandDomain: args.brandDomain ?? deriveDomain(args.productName),
    },
  }

  const result = await renderComparisonCard({
    variant,
    content,
    sceneRef,
    realism: 'subtle',
  })

  const assetRef = await saveAsset(result.blob, result.mimeType)
  return { assetRef, mimeType: result.mimeType }
}

export type { ComparisonCardSpec, ComparisonContent, ComparisonBullet, ComparisonCardVariant } from './types'
