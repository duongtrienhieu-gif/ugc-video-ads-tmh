// ─────────────────────────────────────────────────────────────────────
// Photographic split-composition generator — one KIE GPT-image-1 call
// that produces the side-by-side comparison scene:
//   - LEFT half: a darker / duller / generic competitor product on a
//     muted charcoal background. NEVER any real brand text; this is an
//     anonymous "old / worse" alternative archetype.
//   - RIGHT half: the EXACT uploaded product on a brighter, cleaner
//     background matching the variant aesthetic.
//
// NO text in this image — bullet copy, headers, VS badge, and chrome
// are drawn by the canvas overlay step.
// ─────────────────────────────────────────────────────────────────────

import { submitGpt4oImage, pollGpt4oUntilDone } from '../../../../utils/kieai'
import { saveAsset } from '../../../../utils/assetStore'
import type { ComparisonCardVariant } from './types'

interface GenerateSceneArgs {
  productName: string
  productRefUrls: string[]
  variant: ComparisonCardVariant
  /** Optional hint for what the "competitor" should look like —
   *  inferred from the product niche (eg "powder tub", "cream jar"). */
  competitorArchetype?: string
  kieApiKey: string
  variationSeed?: string
}

const VARIANT_AESTHETIC: Record<ComparisonCardVariant, {
  leftBg: string
  rightBg: string
}> = {
  'supplement-wellness': {
    leftBg: 'muted dark charcoal / graphite grey background, low-energy moody studio light',
    rightBg: 'bright premium wellness green background (eg #2A6B3F or natural sage tone), clean uplifting studio light',
  },
  'beauty-luxury': {
    leftBg: 'dark dusty mauve / dim charcoal background, soft moody studio light',
    rightBg: 'soft cream / blush rose background, bright luminous studio light',
  },
  'detox-clinical': {
    leftBg: 'cold dark slate / charcoal grey background, dim clinical light',
    rightBg: 'crisp clean white / pale ice-blue background, bright clinical studio light',
  },
  'tiktok-bold': {
    leftBg: 'deep matte black background, single-source moody light from above',
    rightBg: 'electric lime / vivid premium brand-color background, punchy ad-creative studio light',
  },
}

const SCENE_PROMPT = (args: GenerateSceneArgs): string => {
  const aesthetic = VARIANT_AESTHETIC[args.variant]
  const archetype = args.competitorArchetype ?? 'a generic competitor product (eg an unbranded matte black tub or a plain dark bottle)'

  return [
    'SIDE-BY-SIDE COMPARISON COMPOSITION — viral ad creative still:',
    '',
    'LAYOUT: a single 4:5 portrait image split exactly down the vertical middle into TWO halves. Both halves are studio still-life — NOT lifestyle, NOT person, NOT environment.',
    '',
    'LEFT HALF (the "worse / old" alternative):',
    `  • ${aesthetic.leftBg}.`,
    `  • Product: ${archetype} — DULLER, slightly desaturated, less premium, weaker lighting, with subtle shadow indicating low energy.`,
    '  • NEVER render any real brand name / logo / readable text on this competitor — it must look anonymous and generic.',
    '  • Position the competitor product roughly centered in the left half, dominant size.',
    '',
    'RIGHT HALF (the "better / new" choice):',
    `  • ${aesthetic.rightBg}.`,
    `  • Product: the EXACT uploaded product (${args.productName}) — PIXEL-FOR-PIXEL same label, brand name typography, bottle/can/jar shape, cap, colors as the uploaded reference image. NEVER invent a different brand.`,
    '  • Brighter cleaner lighting, premium lift, healthier visual energy.',
    '  • Position the hero product roughly centered in the right half, dominant size — slightly LARGER and more dominant than the competitor (visual hierarchy: the right product wins).',
    '',
    'COMPOSITION RULES:',
    '  • The two backgrounds meet at the vertical midline with a soft natural gradient blend (~2-3% of width) — NOT a hard sharp edge.',
    '  • Both products are at the same vertical height for clean symmetry.',
    '  • Soft natural contact shadow under each product.',
    '  • NO additional bottles, NO box packaging, NO multiple copies.',
    '',
    'ABSOLUTE BANS:',
    '  • NO text anywhere in the image (no labels, no "VS", no checkmarks, no headers, no bullet copy, no numbers, no logos other than the uploaded product\'s native label).',
    '  • NO person, NO hands, NO body parts.',
    '  • NO marketplace UI, NO discount badges, NO designed graphics.',
    '  • NO arrows, NO connectors, NO decorative shapes.',
    `  • Seed: ${args.variationSeed ?? Math.random().toString(36).slice(2, 8)}.`,
  ].join('\n')
}

export async function generateComparisonScene(args: GenerateSceneArgs): Promise<string> {
  if (args.productRefUrls.length === 0) {
    throw new Error('Cần ít nhất 1 ảnh sản phẩm để lock identity cho comparison card.')
  }

  const prompt = SCENE_PROMPT(args)

  const { taskId } = await submitGpt4oImage({
    apiKey: args.kieApiKey,
    prompt,
    filesUrl: args.productRefUrls.slice(0, 3),
    size: '2:3',
  })

  const remoteUrl = await pollGpt4oUntilDone({
    apiKey: args.kieApiKey,
    taskId,
    timeoutMs: 100_000,
  })

  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`Fetch comparison scene failed: ${resp.status}`)
  const blob = await resp.blob()
  if (blob.size < 1000) throw new Error('Scene response too small — possibly corrupt')

  return await saveAsset(blob, blob.type || 'image/png')
}
