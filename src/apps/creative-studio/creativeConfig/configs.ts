// ── Creative Configs (P15) ──────────────────────────────────────────────────
//
// Single declarative registry — 17 entries. Each CreativeConfig binds:
//   • engine + model routing
//   • Creative DNA (the marketing brain)
//   • Composable PromptBlock sequence
//   • Per-creative negative additions
//   • Output rules
//
// SCALING RULE: adding a new creative type = adding ONE entry below.
// NO code changes in dispatcher / assembler / engine.

import type { CreativeConfig } from '../types/creativeDNA'
import type { AssetTypeId } from '../types/asset'
import { BLOCKS } from '../shared/prompt/blockLibrary'

const CONFIGS: CreativeConfig[] = [
  // ═══════════════ PHOTOGRAPHIC (9) — prompt-driven ═══════════════

  {
    id: 'product-shot',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'pro-photo',
      marketingGoal: 'Hero packshot khách thấy ĐẦU TIÊN — phải sharp, sạch, label readable. Drives trust at first impression.',
      emotion: 'authority',
      realism: 'highly-real',
      composition: 'product-hero',
      productVisibility: 'hero-dominant',
      textImportance: 'critical',
      platformStyle: 'ecommerce-thumbnail',
      cameraStyle: 'tripod-studio',
      renderStyle: 'studio-clean',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.composition('Product centered. Single-product hero. No props. Negative space all around for cropping flexibility.'),
      BLOCKS.scene('Clean studio packshot. Seamless near-white background. Product floats centered.'),
      BLOCKS.lighting('Even softbox light. No harsh shadows. No bokeh.'),
      BLOCKS.camera('Tripod-mounted DSLR feel, head-on eye-level shot.'),
      BLOCKS.platform('ecommerce-thumbnail'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['lifestyle clutter', 'environmental props', 'hands or people in frame', 'colored backgrounds']),
    ],
    negativeBlocks: ['lifestyle clutter', 'environmental props', 'hands or people in frame', 'colored backgrounds'],
    outputRules: {
      aspectRatio: '1:1',
      enforce: ['label fully readable', 'sharp focus end-to-end', 'product hero centered'],
      forbid: ['lifestyle background', 'props', 'colored gradient bg'],
    },
  },

  {
    id: 'holding-product',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'ugc-real',
      marketingGoal: 'Standard UGC packshot-with-hands — trust hơn studio thuần vì có "người thật" cầm.',
      emotion: 'trust',
      realism: 'highly-real',
      composition: 'single-subject-centered',
      productVisibility: 'high',
      textImportance: 'supporting',
      platformStyle: 'landing-page',
      cameraStyle: 'handheld-smartphone',
      renderStyle: 'ugc-realism',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.scene('Person holds product at chest level with both hands. Label fully facing camera at eye level.'),
      BLOCKS.emotion('Gentle confident smile, looking directly at lens. Authentic, NOT model-portfolio.'),
      BLOCKS.lighting('Soft daylight, indoor. No studio key light.'),
      BLOCKS.camera('Hand-held smartphone feel, eye level, slight asymmetric framing.'),
      BLOCKS.ugc('Natural skin texture with pores. Real human. NOT plastic AI skin. NOT influencer aesthetic.'),
      BLOCKS.platform('landing-page'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['studio softbox', 'magazine retouching', 'plastic glossy skin']),
    ],
    negativeBlocks: ['studio softbox', 'magazine retouching', 'plastic glossy skin'],
    outputRules: { aspectRatio: '1:1', enforce: ['both hands visible', 'label faces camera'], forbid: ['fake studio look', 'over-retouched skin'] },
  },

  {
    id: 'ugc-selfie',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'ugc-real',
      marketingGoal: 'Pass authentic-check — trông như khách hàng thật post lên TikTok.',
      emotion: 'intimacy',
      realism: 'highly-real',
      composition: 'single-subject-centered',
      productVisibility: 'high',
      textImportance: 'none',
      platformStyle: 'tiktok',
      cameraStyle: 'selfie-ring-light',
      renderStyle: 'ugc-realism',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.scene('Smartphone-selfie composition from slightly above. Person holds product right next to cheek with one hand.'),
      BLOCKS.emotion('Faint genuine smile, looking into lens. Casual, not posed.'),
      BLOCKS.lighting('Soft window light. Ring-light reflection in eyes optional.'),
      BLOCKS.camera('Selfie angle, high-front-3/4. Slight off-pixel framing.'),
      BLOCKS.ugc('Looks like a real selfie a customer posted. Natural imperfection. No studio.'),
      BLOCKS.platform('tiktok'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['professional headshot', 'studio glamour', 'editorial portrait', 'symmetric perfection']),
    ],
    negativeBlocks: ['professional headshot', 'studio glamour', 'editorial portrait', 'symmetric perfection'],
    outputRules: { aspectRatio: '1:1', enforce: ['product label readable', 'selfie angle'], forbid: ['professional camera look'] },
  },

  {
    id: 'review-table',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'pro-photo',
      marketingGoal: 'Aesthetic Instagram-grid-friendly review unboxing shot — bố cục clean cho lifestyle feed.',
      emotion: 'aspiration',
      realism: 'natural',
      composition: 'flat-lay',
      productVisibility: 'hero-dominant',
      textImportance: 'minimal',
      platformStyle: 'instagram-feed',
      cameraStyle: 'overhead-flatlay',
      renderStyle: 'editorial-beauty',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.scene('Product placed on clean wooden desk. Hands visible holding or arranging it.'),
      BLOCKS.composition('Three-quarter overhead angle. Negative space around.'),
      BLOCKS.lighting('Soft daylight. No shadow obscuring the label.'),
      BLOCKS.camera('Tripod overhead, slight 45° tilt allowed.'),
      BLOCKS.platform('instagram-feed'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['busy background props', 'overly stylized lifestyle clutter']),
    ],
    negativeBlocks: ['busy background props', 'overly stylized lifestyle clutter'],
    outputRules: { aspectRatio: '1:1', enforce: ['label unobstructed', 'three-quarter overhead'], forbid: ['busy props'] },
  },

  {
    id: 'before-after',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'conversion',
      marketingGoal: 'Strongest visual conversion driver — show kết quả cụ thể, tăng tỉ lệ click + CR.',
      emotion: 'aspiration',
      realism: 'highly-real',
      composition: 'split-frame',
      productVisibility: 'contextual',
      textImportance: 'supporting',
      platformStyle: 'facebook-ads',
      cameraStyle: 'tripod-studio',
      renderStyle: 'ugc-realism',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.scene('Split-frame 1:1. Left half: person BEFORE — looking tired / dull. Right half: same person AFTER — glowing / refreshed, holding product. Identical framing both halves.'),
      BLOCKS.composition('Strict 50/50 vertical split. Same person, same crop, same backdrop.'),
      BLOCKS.lighting('Neutral backdrop. Equal lighting both halves to make the change about the SUBJECT, not the lighting.'),
      BLOCKS.emotion('Left: dull / tired / withdrawn. Right: confident / refreshed / open.'),
      BLOCKS.textRendering('Optional SEBELUM / SELEPAS or TRƯỚC / SAU labels — small + bottom edge of each half. If included, must be readable Vietnamese / Malay typography.'),
      BLOCKS.platform('facebook-ads'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['Photoshop blur/glow overlay', 'fake skin smoothing', 'beauty filter look', 'different person in two halves']),
    ],
    negativeBlocks: ['Photoshop blur/glow overlay', 'fake skin smoothing', 'beauty filter look', 'different person in two halves'],
    outputRules: { aspectRatio: '1:1', enforce: ['split-frame 50/50', 'identical framing'], forbid: ['Photoshop smoothing', 'two different people'] },
  },

  {
    id: 'lifestyle-kitchen',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'lifestyle',
      marketingGoal: 'Gắn sản phẩm vào routine ấm cúng — khách tưởng tượng dùng SP mỗi sáng trong bếp nhà mình.',
      emotion: 'comfort',
      realism: 'highly-real',
      composition: 'lifestyle-environmental',
      productVisibility: 'high',
      textImportance: 'none',
      platformStyle: 'instagram-feed',
      cameraStyle: 'wide-environmental',
      renderStyle: 'editorial-beauty',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.scene('Product on a bright modern kitchen counter, morning sunlight through a window. Person in background out of focus pouring coffee / preparing breakfast.'),
      BLOCKS.lighting('Morning sunlight, soft warm tone, window-side light.'),
      BLOCKS.camera('Mid-shot, slight depth-of-field, label sharp in foreground.'),
      BLOCKS.platform('instagram-feed'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['dark moody kitchen', 'industrial gritty look']),
    ],
    negativeBlocks: ['dark moody kitchen', 'industrial gritty look'],
    outputRules: { aspectRatio: '1:1', enforce: ['morning warm light', 'label sharp foreground'], forbid: ['moody dark kitchen'] },
  },

  {
    id: 'bathroom-routine',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'lifestyle',
      marketingGoal: 'Gợi cảm giác self-care premium — gắn sản phẩm vào nghi thức chăm sóc bản thân.',
      emotion: 'comfort',
      realism: 'natural',
      composition: 'lifestyle-environmental',
      productVisibility: 'hero-dominant',
      textImportance: 'none',
      platformStyle: 'instagram-feed',
      cameraStyle: 'tripod-studio',
      renderStyle: 'editorial-beauty',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.scene('Product on white marble bathroom counter with neatly folded towels. Person softly out of focus in background looking into mirror.'),
      BLOCKS.lighting('Morning skincare routine vibe. Warm soft light.'),
      BLOCKS.camera('Tripod, slight 3/4 angle.'),
      BLOCKS.platform('instagram-feed'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['dirty bathroom', 'cluttered counter']),
    ],
    negativeBlocks: ['dirty bathroom', 'cluttered counter'],
    outputRules: { aspectRatio: '1:1', enforce: ['marble + towels', 'soft warm light'], forbid: ['clutter', 'dim lighting'] },
  },

  {
    id: 'cafe-lifestyle',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'lifestyle',
      marketingGoal: 'Gắn sản phẩm vào lối sống urban / freelancer / millennial.',
      emotion: 'aspiration',
      realism: 'natural',
      composition: 'lifestyle-environmental',
      productVisibility: 'high',
      textImportance: 'none',
      platformStyle: 'instagram-feed',
      cameraStyle: 'handheld-smartphone',
      renderStyle: 'ugc-realism',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.scene('Person at cafe table holding product, cappuccino + laptop on table, warm bokeh-free background, candid lifestyle moment, product label rotated toward camera.'),
      BLOCKS.lighting('Cafe ambient + warm window light.'),
      BLOCKS.camera('Handheld smartphone, eye-level, candid.'),
      BLOCKS.platform('instagram-feed'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['posed influencer shoot', 'overly styled lifestyle']),
    ],
    negativeBlocks: ['posed influencer shoot', 'overly styled lifestyle'],
    outputRules: { aspectRatio: '1:1', enforce: ['cafe context', 'product label visible'], forbid: ['posed influencer look'] },
  },

  {
    id: 'ugc-tiktok',
    engine: 'photographic',
    model: 'gpt-image-2',
    dna: {
      category: 'ugc-real',
      marketingGoal: 'Capitalize trên trend creator review — visual quen với audience TikTok.',
      emotion: 'hype',
      realism: 'highly-real',
      composition: 'single-subject-centered',
      productVisibility: 'high',
      textImportance: 'none',
      platformStyle: 'tiktok',
      cameraStyle: 'selfie-ring-light',
      renderStyle: 'ugc-realism',
    },
    promptBlocks: [
      BLOCKS.productLock(),
      BLOCKS.productContext(),
      BLOCKS.continuity(),
      BLOCKS.scene('Phone-camera-style review still — person holds product up to camera in bedroom / vanity setup. Ring-light reflection visible in eyes.'),
      BLOCKS.camera('Phone selfie-camera framing, slight handheld jitter.'),
      BLOCKS.ugc('Looks like an actual still from a TikTok video. Raw smartphone aesthetic. No studio post.'),
      BLOCKS.platform('tiktok'),
      BLOCKS.variation(),
      BLOCKS.localeHardLock(),
      BLOCKS.negative(['cinematic mood lighting', 'professional studio backdrop']),
    ],
    negativeBlocks: ['cinematic mood lighting', 'professional studio backdrop'],
    outputRules: { aspectRatio: '1:1', enforce: ['ring-light reflection', 'bedroom/vanity context'], forbid: ['cinematic mood'] },
  },

  // ═══════════════ UI-NATIVE (6) — template-driven, DNA only ═════════

  ...uiNativeConfig('whatsapp-proof', {
    category: 'social-proof',
    marketingGoal: 'Bằng chứng xã hội tức thì — khách tưởng tin nhắn thật từ người dùng cũ.',
    emotion: 'trust',
    composition: 'mobile-screenshot',
    platformStyle: 'whatsapp',
  }),
  ...uiNativeConfig('messenger-chat', {
    category: 'social-proof',
    marketingGoal: 'Show shop có tương tác thật — chứng minh uy tín đang hoạt động.',
    emotion: 'trust',
    composition: 'mobile-screenshot',
    platformStyle: 'messenger',
  }),
  ...uiNativeConfig('shopee-feedback', {
    category: 'social-ui',
    marketingGoal: 'Trust signal từ Shopee — kênh Việt mặc định check trước khi mua.',
    emotion: 'trust',
    composition: 'mobile-screenshot',
    platformStyle: 'shopee',
  }),
  ...uiNativeConfig('tiktok-feedback', {
    category: 'social-ui',
    marketingGoal: 'Trust signal cho audience Gen Z mua qua TikTok Shop.',
    emotion: 'aspiration',
    composition: 'mobile-screenshot',
    platformStyle: 'tiktok-shop',
  }),
  ...uiNativeConfig('facebook-comment', {
    category: 'social-ui',
    marketingGoal: 'Engagement social proof — show bài post nhận phản hồi tích cực.',
    emotion: 'trust',
    composition: 'mobile-screenshot',
    platformStyle: 'facebook-ads',
  }),
  ...uiNativeConfig('tiktok-comment', {
    category: 'social-ui',
    marketingGoal: 'Trigger FOMO — show video đang viral, engagement cao.',
    emotion: 'hype',
    composition: 'mobile-screenshot',
    platformStyle: 'tiktok',
  }),

  // ═══════════════ DESIGNED-GRAPHIC (2) — template + Gemini text ═════

  {
    id: 'infographic',
    engine: 'designed-graphic',
    model: 'gemini-text+canvas',
    dna: {
      category: 'product-explain',
      marketingGoal: 'Tăng độ tin tưởng + giải thích công dụng nhanh trong 5 giây.',
      emotion: 'authority',
      realism: 'stylized',
      composition: 'infographic-hierarchy',
      productVisibility: 'high',
      textImportance: 'critical',
      platformStyle: 'landing-page',
      cameraStyle: 'tripod-studio',
      renderStyle: 'infographic-vector',
    },
    promptBlocks: [],
    negativeBlocks: ['cluttered layout', 'gradient noise overlays'],
    outputRules: {
      aspectRatio: '4:5',
      enforce: ['hero stat readable', '3-5 supporting bullets', 'footnote source'],
      forbid: ['random photo as bg', 'unreadable typography'],
    },
  },

  {
    id: 'cta-banner',
    engine: 'designed-graphic',
    model: 'gemini-text+canvas',
    dna: {
      category: 'conversion',
      marketingGoal: 'Click-thru optimization — banner cho Facebook / Shopee / TikTok ads paid traffic.',
      emotion: 'urgency',
      realism: 'stylized',
      composition: 'product-hero',
      productVisibility: 'hero-dominant',
      textImportance: 'critical',
      platformStyle: 'facebook-ads',
      cameraStyle: 'tripod-studio',
      renderStyle: 'editorial-beauty',
    },
    promptBlocks: [],
    negativeBlocks: ['busy gradient', 'low-contrast CTA'],
    outputRules: {
      aspectRatio: '4:5',
      enforce: ['headline readable at thumbnail size', 'offer pill visible', 'CTA button contrasts bg'],
      forbid: ['low contrast', 'busy gradient bg'],
    },
  },
]

/** UI-native configs share most DNA shape — generate via helper.
 *  Returns a 1-element array so the spread above stays flat. */
function uiNativeConfig(
  id: AssetTypeId,
  partial: {
    category: import('../uiCatalog/assetCatalog').CategoryId
    marketingGoal: string
    emotion: import('../types/creativeDNA').EmotionTone
    composition: import('../types/creativeDNA').CompositionKind
    platformStyle: import('../types/creativeDNA').PlatformStyle
  },
): CreativeConfig[] {
  return [{
    id,
    engine: 'ui-native',
    model: 'gemini-text+canvas',
    dna: {
      category: partial.category,
      marketingGoal: partial.marketingGoal,
      emotion: partial.emotion,
      realism: 'highly-real',
      composition: partial.composition,
      productVisibility: 'contextual',
      textImportance: 'critical',
      platformStyle: partial.platformStyle,
      cameraStyle: 'handheld-smartphone',
      renderStyle: 'mobile-ui-screenshot',
    },
    promptBlocks: [],   // template-rendered, not prompt-driven
    negativeBlocks: ['figma-perfect-edges', 'studio-clean-screenshot', 'png-export'],
    outputRules: {
      aspectRatio: '9:16',
      enforce: ['status bar realistic', 'realistic timestamps', 'JPEG compression artifacts'],
      forbid: ['perfect Figma edges', 'PNG export', 'desktop screenshot'],
    },
  }]
}

// ── Public registry ──────────────────────────────────────────────────

const BY_ID = new Map<AssetTypeId, CreativeConfig>(CONFIGS.map((c) => [c.id, c]))

export function findCreativeConfig(id: AssetTypeId): CreativeConfig | null {
  return BY_ID.get(id) ?? null
}

export function listCreativeConfigs(): CreativeConfig[] {
  return CONFIGS
}
