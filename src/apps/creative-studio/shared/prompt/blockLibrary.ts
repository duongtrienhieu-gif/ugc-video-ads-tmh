// ── Prompt Block Library (P15) ──────────────────────────────────────────────
//
// Composable text fragments the assembler stitches into a final KIE
// prompt. Each block is small + focused + tested in real generations.
// Existing inline prompts (productLock, avatarLock, scene presets,
// style modifiers, negative blocks) are now factored out as block
// builders here.
//
// USAGE:
//   const config: CreativeConfig = {
//     promptBlocks: [
//       BLOCKS.productLock(),
//       BLOCKS.scene('UGC bedroom, woman holding product to camera...'),
//       BLOCKS.lighting('ring-light front, slight blow-out'),
//       BLOCKS.camera('phone selfie at chest height, slight pitch up'),
//       BLOCKS.platform('tiktok'),
//       BLOCKS.negative(['studio glamour', 'stock photo look']),
//     ],
//     ...
//   }

import type { PromptBlock, PromptContext, PlatformStyle, CreativeDNA } from '../../types/creativeDNA'
import type { UINativeLocale } from '../../types/uiNative'
import { formatProductKnowledgeForPrompt } from '../../services/productKnowledge'
import { assembleDnaDirective } from './dnaDirective'
import {
  demographicAnchor,
  settingPack,
  screenshotFeel,
  designedOverlay,
  priceLockDirective,
  culturalCueByLocale,
  type DemographicOpts,
} from './scenePatterns'

// ── Product / Avatar identity locks ──────────────────────────────────

const PRODUCT_LOCK_TEXT =
  '[PRODUCT LOCK — HIGHEST PRIORITY]\n'
  + 'The product in the FIRST reference image must be reproduced EXACTLY:\n'
  + '- Same container shape (jar / bottle / tube / box / pouch as shown)\n'
  + '- Same colors on the packaging\n'
  + '- Same logo / brand mark — do not redraw\n'
  + '- Same label text, same typography, same wording — do not rewrite or invent text\n'
  + '- Same proportions and silhouette\n'
  + 'This product MUST be recognizable as the SAME real-world item. Do NOT substitute, do NOT redesign, do NOT invent new copy.'

const AVATAR_LOCK_TEXT =
  '[AVATAR REFERENCE — RELAXED]\n'
  + 'Generate a person who resembles the SECOND reference image:\n'
  + '- Same approximate age, gender, ethnicity, skin tone\n'
  + '- Similar hair / hijab color and overall hairstyle\n'
  + '- Similar body type\n'
  + 'An approximate resemblance is enough — a perfect face match is NOT required, but do NOT generate an obviously different random person.'

// ── Platform style blocks ────────────────────────────────────────────

const PLATFORM_STYLE_TEXT: Record<PlatformStyle, string> = {
  tiktok:
    'TikTok aesthetic — phone-camera vibe, ring-light reflection in eyes acceptable, slight digital grain, raw smartphone feel.',
  'instagram-feed':
    'Instagram-grid friendly — clean composition, natural color science, slight warm grade, polished but not over-edited.',
  'instagram-story':
    'Story-friendly — vertical-thinking framing, room for top + bottom safe-area text, mobile candid feel.',
  'facebook-ads':
    'Facebook ads ready — thumb-stop hook framing, clear product readability at small thumbnail size, no fine detail that loses at compression.',
  shopee:
    'Shopee marketplace style — clear product, neutral background, label faces camera, trust-building family-friendly composition.',
  'tiktok-shop':
    'TikTok Shop style — punchy pink-red accent palette, mobile-vertical thinking, dynamic UGC feel.',
  'landing-page':
    'Landing page hero style — clean balanced composition, suitable for centered or split-frame placement, web-friendly cropping.',
  whatsapp:
    'WhatsApp screenshot context — chat-application surrounding feel, mobile-portrait crop.',
  messenger:
    'Messenger screenshot context — blue-bubble UI surrounding, mobile-portrait crop.',
  'ecommerce-thumbnail':
    'Ecommerce thumbnail — seamless near-white background, even studio softbox light, product hero centered, sharp focus on label, no harsh shadows.',
  pinterest:
    'Pinterest aesthetic — 2:3 portrait-friendly, lifestyle context, soft saturation, aspirational mood.',
  'editorial-print':
    'Editorial magazine style — premium quality, refined typography-safe composition, magazine-page feel.',
}

// ── Global negative ──────────────────────────────────────────────────

const GLOBAL_NEGATIVE_TEXT =
  '[NEGATIVE — DO NOT]\n'
  + '- Do NOT modify the product packaging in any way.\n'
  + '- Do NOT invent new packaging, new label text, new colors, new logo.\n'
  + '- Do NOT add captions, callouts, price tags, sale badges, or text overlays (except where the creative type explicitly calls for them).\n'
  + '- Do NOT add watermarks or other brand logos.\n'
  + '- Do NOT duplicate the product unless the scene explicitly says multi-product.\n'
  + '- No extra hands, no deformed fingers, no warped bottles, no melted labels, no garbled letters.'

// ── Public block factory ─────────────────────────────────────────────

export const BLOCKS = {
  productLock(): PromptBlock {
    return { kind: 'product', text: PRODUCT_LOCK_TEXT }
  },

  // ── P28 — DNA hard-rule directive ─────────────────────────────────
  /** Emits the full Creative DNA as a structured "[CREATIVE DNA — HARD
   *  RULES SOURCE OF TRUTH]" block at the TOP of the prompt (per
   *  ASSEMBLE_ORDER). The block bundles marketing goal + emotional
   *  goal + typography + platform behavior + layout / content / visual
   *  / failure-mode / quality-bar rules.
   *
   *  Pass the active CreativeDNA when constructing the block — the
   *  prompt assembler does not have access to the DNA otherwise. */
  dnaRules(dna: CreativeDNA): PromptBlock {
    return { kind: 'dnaRules', text: assembleDnaDirective(dna) }
  },

  /** Continuity for sequential renders + avatar lock conditional on
   *  whether refs are attached. */
  continuity(): PromptBlock {
    return {
      kind: 'continuity',
      text: (ctx: PromptContext) => {
        if (!ctx.hasBaseRef && !ctx.hasAvatar) {
          return 'The FIRST reference image is the product.'
        }
        if (ctx.hasBaseRef && ctx.hasAvatar) {
          return 'The FIRST reference image is the product. The SECOND reference image is the person (avatar). The THIRD reference image is the previously generated photo from this same shoot — use it as a cohesion anchor for outfit, background, and overall look.'
        }
        if (ctx.hasBaseRef) {
          return 'The FIRST reference image is the product. The SECOND reference image is the previously generated photo — use it as a cohesion anchor.'
        }
        return AVATAR_LOCK_TEXT + '\n\n' + 'The FIRST reference image is the product. The SECOND reference image is the person (avatar).'
      },
    }
  },

  scene(text: string): PromptBlock {
    return { kind: 'scene', text: `[SCENE]\n${text}` }
  },

  lighting(text: string): PromptBlock {
    return { kind: 'lighting', text: `[LIGHTING]\n${text}` }
  },

  camera(text: string): PromptBlock {
    return { kind: 'camera', text: `[CAMERA]\n${text}` }
  },

  emotion(text: string): PromptBlock {
    return { kind: 'emotion', text: `[EMOTION & FACE]\n${text}` }
  },

  composition(text: string): PromptBlock {
    return { kind: 'composition', text: `[COMPOSITION]\n${text}` }
  },

  ugc(text: string): PromptBlock {
    return { kind: 'ugc', text: `[UGC AUTHENTICITY]\n${text}` }
  },

  socialProof(text: string): PromptBlock {
    return { kind: 'socialProof', text: `[SOCIAL PROOF CONTEXT]\n${text}` }
  },

  textRendering(text: string): PromptBlock {
    return { kind: 'textRendering', text: `[TEXT RENDERING]\n${text}` }
  },

  platform(style: PlatformStyle): PromptBlock {
    return { kind: 'platform', text: `[PLATFORM]\n${PLATFORM_STYLE_TEXT[style]}` }
  },

  variation(): PromptBlock {
    return {
      kind: 'composition',
      text: (ctx: PromptContext) =>
        ctx.variationHint
          ? `[VARIATION]\n${ctx.variationHint}\nThe product must remain pixel-faithful to the FIRST reference. The person must remain the same individual.`
          : '',
    }
  },

  /** Combine the global negative with creative-specific extras. */
  negative(extras: string[] = []): PromptBlock {
    if (extras.length === 0) {
      return { kind: 'negative', text: GLOBAL_NEGATIVE_TEXT }
    }
    const extrasBlock = extras.map((e) => `- ${e}`).join('\n')
    return {
      kind: 'negative',
      text: `${GLOBAL_NEGATIVE_TEXT}\n\n[ADDITIONAL NEGATIVE FOR THIS CREATIVE]\n${extrasBlock}`,
    }
  },

  /** Free-form custom block — escape hatch when none of the above fits. */
  custom(kind: PromptBlock['kind'], text: string): PromptBlock {
    return { kind, text }
  },

  // ── P25 — Product knowledge block ───────────────────────────────
  /** Embeds the full product profile (niche / benefits / pain points /
   *  audience / offer / tone) from bankStore into the prompt so the
   *  model picks scene context aligned with marketing reality —
   *  not what it guesses from the product image. */
  productContext(): PromptBlock {
    return {
      kind: 'product',
      text: (ctx: PromptContext) => {
        if (!ctx.productKnowledge) return ''
        return `[PRODUCT KNOWLEDGE]\n${formatProductKnowledgeForPrompt(ctx.productKnowledge)}\n\n`
          + `Use this product knowledge to choose appropriate scene context, persona, and mood. `
          + `DO NOT render benefits / pain points / offer as text overlays in the image (unless `
          + `a separate [TEXT RENDERING] block explicitly calls for it).`
      },
    }
  },

  // ── P25 — Locale hard-lock ──────────────────────────────────────
  /** Hard system rule: visible text in the generated image MUST be in
   *  the locale's native language. The ONLY exception is the product
   *  label (fixed by reference image — reproduced exactly). */
  localeHardLock(): PromptBlock {
    return {
      kind: 'negative',
      text: (ctx: PromptContext) => {
        const locale = (ctx.locale ?? 'vi-VN') as 'vi-VN' | 'my-MY' | 'id-ID' | 'global'
        const map: Record<typeof locale, { native: string; ban: string }> = {
          'vi-VN': {
            native: 'Vietnamese (Tiếng Việt with diacritics)',
            ban: 'NOT English, NOT Chinese, NOT Malay, NOT Korean',
          },
          'my-MY': {
            native: 'Bahasa Melayu',
            ban: 'NOT Vietnamese, NOT Chinese, NOT English (except approved brand terms), NOT Korean',
          },
          'id-ID': {
            native: 'Bahasa Indonesia',
            ban: 'NOT Vietnamese, NOT Chinese, NOT Malay (Bahasa Melayu has subtle differences), NOT English',
          },
          'global': {
            native: 'plain English',
            ban: 'NOT Vietnamese, NOT Chinese, NOT Korean, NOT Malay',
          },
        }
        const cfg = map[locale]
        return `[LOCALE HARD LOCK — ${locale}]\n`
          + `ALL visible text in the generated image MUST be in ${cfg.native}. ${cfg.ban}.\n`
          + `Exception: the product label/packaging is fixed by the reference image and must be reproduced EXACTLY (do not translate it).\n`
          + `This locale rule applies to:\n`
          + `  • captions, callouts, headlines if any\n`
          + `  • street signs, café chalkboards, magazine covers in the background\n`
          + `  • handwritten notes, post-it stickers, sticky tabs\n`
          + `  • price tags / sale badges if shown\n`
          + `  • on-package secondary text NOT in the reference (eg shelf labels)`
      },
    }
  },

  // ── P36 — Ladipage-style packed scene blocks ──────────────────────
  //
  // These factories produce richly-specific prompt fragments matching
  // the Ladipage advertorial reference quality. Each reads ctx.locale
  // so demographic / cultural / language details auto-adapt.

  /** Locale-aware demographic anchor: "A Malaysian woman in her mid-30s
   *  with a warm natural smile, wearing a hijab and modest casual
   *  attire, looking like a real customer". */
  demographic(opts: DemographicOpts = {}): PromptBlock {
    return {
      kind: 'composition',
      text: (ctx: PromptContext) => {
        const locale = (ctx.locale ?? 'vi-VN') as UINativeLocale
        return `[DEMOGRAPHIC]\n${demographicAnchor(locale, opts)}.`
      },
    }
  },

  /** Locale-aware setting + lighting pack: kitchen-morning, bathroom-
   *  routine, cafe-urban, etc. Mirrors Ladipage "casual indoor setting
   *  with natural window light" specificity. */
  setting(kind: Parameters<typeof settingPack>[0]): PromptBlock {
    return {
      kind: 'scene',
      text: (ctx: PromptContext) => {
        const locale = (ctx.locale ?? 'vi-VN') as UINativeLocale
        return `[SETTING]\n${settingPack(kind, locale)}.`
      },
    }
  },

  /** UGC phone-screenshot authenticity directive — selfie / handheld /
   *  tripod / macro / split-frame. */
  capture(mode: Parameters<typeof screenshotFeel>[0]): PromptBlock {
    return { kind: 'camera', text: `[CAPTURE]\n${screenshotFeel(mode)}.` }
  },

  /** Designed text-overlay layout directive — hero-hook, pain-italic,
   *  ingredient-card, comparison-table, final-cta-metrics,
   *  before-after-labels. Layout text auto-localizes via ctx.locale. */
  designedOverlay(
    layout: Parameters<typeof designedOverlay>[0],
    extras: { headline?: string; badges?: string[] } = {},
  ): PromptBlock {
    return {
      kind: 'textRendering',
      text: (ctx: PromptContext) => {
        const locale = (ctx.locale ?? 'vi-VN') as UINativeLocale
        return `[DESIGNED OVERLAY]\n${designedOverlay(layout, { ...extras, locale })}`
      },
    }
  },

  /** Price-lock directive — extracts the price token from the product
   *  knowledge offer field and emits "(show only RM59)" pattern. Skips
   *  emission when no parseable price exists. */
  priceLock(): PromptBlock {
    return {
      kind: 'textRendering',
      text: (ctx: PromptContext) => {
        const offer = ctx.productKnowledge?.offer ?? ''
        return priceLockDirective(offer)
      },
    }
  },

  /** Subtle cultural anchor based on locale — Halal cues for my-MY,
   *  batik for id-ID, Tết hint for vi-VN (seasonal only). */
  culturalCue(): PromptBlock {
    return {
      kind: 'scene',
      text: (ctx: PromptContext) => {
        const locale = (ctx.locale ?? 'vi-VN') as UINativeLocale
        return `[CULTURAL CONTEXT]\n${culturalCueByLocale(locale)}`
      },
    }
  },

  // ── P43 — Inline product facts for infographic photographic prompts ─
  /** Surface the actual benefit / ingredient / USP / pain-point list from
   *  productKnowledge as a SHORT inline directive so KIE renders the
   *  literal locale-native strings on badges / steps / time markers
   *  instead of inventing plausible-but-fake claims. Emitted as `'scene'`
   *  kind so it survives compressedPrompt's drop list (the [PRODUCT
   *  KNOWLEDGE] block at kind:'product' is dropped). Returns '' when
   *  productKnowledge has no items of the requested kind, so configs can
   *  pre-declare a factsList without breaking when bankStore data is
   *  sparse. */
  factsList(opts: {
    kind: 'benefits' | 'ingredients' | 'usps' | 'painPoints'
    max?: number
    /** Optional label override — defaults to the kind name. */
    label?: string
  }): PromptBlock {
    const max = opts.max ?? 6
    const label = opts.label ?? opts.kind
    return {
      kind: 'scene',
      text: (ctx: PromptContext) => {
        const k = ctx.productKnowledge
        if (!k) return ''
        const items = (k[opts.kind] ?? []).slice(0, max)
        if (items.length === 0) return ''
        return `Use EXACTLY these ${label} on the visible labels / badges / steps — do not invent or substitute: ${items.map((s) => `"${s}"`).join(', ')}.`
      },
    }
  },
}
