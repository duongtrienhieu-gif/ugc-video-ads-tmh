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

import type { PromptBlock, PromptContext, PlatformStyle } from '../../types/creativeDNA'

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
}
