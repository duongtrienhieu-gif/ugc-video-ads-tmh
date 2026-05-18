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
      emotionalGoal: 'Premium ecommerce confidence — label đáng tin, packaging chỉn chu',
      platformBehavior: 'Ecommerce thumbnail — sharp at small size, label readable when zoomed out',
      layoutRules: [
        'product centered hero',
        'negative space all around for cropping flexibility',
        'no props, no people, no environmental context',
      ],
      visualRules: [
        'dramatic key + fill studio lighting',
        'premium shadow with clear feet placement on the surface',
        'subtle reflection plane acceptable',
        'seamless near-white background',
      ],
      qualityRules: [
        'label fully readable at thumbnail size',
        'sharp focus end-to-end on the packaging',
        'packaging proportions accurate to reference image',
      ],
      failureModes: [
        'lifestyle clutter or environmental props',
        'colored gradient or photographic backgrounds',
        'visible hands or people in frame',
        'distorted packaging proportions',
      ],
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
      emotionalGoal: 'Authentic human trust — "khách hàng thật cầm sản phẩm", non-influencer feel',
      platformBehavior: 'Landing page + social — works as hero or scrollable testimonial slot',
      layoutRules: [
        'person at chest level, both hands grip product',
        'label faces camera at eye level',
        'eye-level framing, slight asymmetric off-center',
      ],
      visualRules: [
        'natural skin texture with visible pores',
        'soft indoor daylight (no studio key light)',
        'authentic non-influencer feel',
      ],
      qualityRules: [
        'both hands visible holding the product',
        'product label readable',
        'genuine human skin (not plastic AI smoothness)',
      ],
      failureModes: [
        'studio softbox glow',
        'magazine retouching / plastic skin',
        'over-symmetric model pose',
        'influencer-perfect aesthetic',
      ],
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
      emotionalGoal: 'Private creator-customer authenticity — looks like a real selfie',
      platformBehavior: 'TikTok / Reels — handheld smartphone aesthetic, off-center framing OK',
      layoutRules: [
        'phone-camera angle slightly elevated',
        'product near face / cheek',
        'asymmetric framing, not centered',
      ],
      visualRules: [
        'ring-light reflection in eyes acceptable',
        'raw smartphone aesthetic with slight digital grain',
        'phone-screen glare or natural shadows acceptable',
      ],
      qualityRules: [
        'product visible alongside face with label readable',
        'genuine relaxed expression, not posed model smile',
      ],
      failureModes: [
        'professional studio key-light setup',
        'symmetric posed magazine shot',
        'editorial portrait lighting',
        'plastic-smooth skin',
      ],
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
      marketingGoal: 'Macro detail shot — chứng minh chất lượng cao qua texture cận cảnh.',
      emotion: 'aspiration',
      realism: 'natural',
      composition: 'flat-lay',
      productVisibility: 'hero-dominant',
      textImportance: 'minimal',
      platformStyle: 'instagram-feed',
      cameraStyle: 'macro-detail',
      renderStyle: 'editorial-beauty',
      emotionalGoal: 'Tactile premium quality — khách thấy texture là tin "có hàng thật"',
      platformBehavior: 'Detail page + carousel — works for ingredient close-ups and texture proof',
      layoutRules: [
        'macro close-up, very tight framing',
        'product texture in foreground focus plane',
        'optional ingredient swatch alongside packaging',
      ],
      visualRules: [
        'shallow depth of field with sharp focal point',
        'soft daylight, no harsh studio key',
        'natural surface (wood / marble / linen)',
      ],
      qualityRules: [
        'label readable when label is in frame',
        'texture / material clearly visible',
        'one sharp focal point — no everything-in-focus look',
      ],
      failureModes: [
        'wide-angle environmental shot',
        'busy background props',
        'overprocessed digital glow',
      ],
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
      category: 'pro-photo',
      marketingGoal: 'Strongest visual conversion driver — show kết quả cụ thể, tăng tỉ lệ click + CR.',
      emotion: 'aspiration',
      realism: 'highly-real',
      composition: 'split-frame',
      productVisibility: 'contextual',
      textImportance: 'supporting',
      platformStyle: 'facebook-ads',
      cameraStyle: 'tripod-studio',
      renderStyle: 'ugc-realism',
      emotionalGoal: 'Concrete transformation evidence — set realistic before/after expectation',
      platformBehavior: 'Performance ads — thumb-stop hook with clear visual delta',
      layoutRules: [
        'strict 50/50 vertical split frame',
        'SAME person both halves',
        'identical lighting, backdrop, and camera angle both halves',
      ],
      contentRules: [
        'optional small SEBELUM/SELEPAS or TRƯỚC/SAU label at the bottom edge',
        'no overlay text covering the subject',
      ],
      visualRules: [
        'left half: dull / tired / withdrawn',
        'right half: refreshed / confident / open',
        'neutral backdrop — change comes from the SUBJECT not the lighting',
      ],
      qualityRules: [
        'left+right halves pixel-aligned',
        'same camera angle both halves',
        'continuity of clothing and hairstyle',
      ],
      failureModes: [
        'two different people on each side',
        'Photoshop blur / glow filter divide',
        'beauty filter smoothing only on the "after" side',
        'different lighting between halves',
      ],
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
      category: 'pro-photo',
      marketingGoal: 'Benefit scene — gắn sản phẩm vào morning routine, khách tưởng tượng dùng SP mỗi sáng.',
      emotion: 'comfort',
      realism: 'highly-real',
      composition: 'lifestyle-environmental',
      productVisibility: 'high',
      textImportance: 'none',
      platformStyle: 'instagram-feed',
      cameraStyle: 'wide-environmental',
      renderStyle: 'editorial-beauty',
      emotionalGoal: 'Warm domestic comfort — sản phẩm thuộc về bếp nhà mình',
      platformBehavior: 'Instagram + lifestyle ads — narrative scene, scroll-stop emotion',
      layoutRules: [
        'product on counter foreground',
        'person blurred in background, candid action',
        'natural depth of field — label sharp, scene soft',
      ],
      visualRules: [
        'warm morning sunlight through a window',
        'authentic lived-in kitchen (slight clutter acceptable)',
        'soft warm color grade',
      ],
      qualityRules: [
        'product label readable in foreground',
        'kitchen context clearly recognizable',
      ],
      failureModes: [
        'staged perfect magazine kitchen',
        'over-produced photo-studio look',
        'dark moody mood lighting',
      ],
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
      category: 'pro-photo',
      marketingGoal: 'Benefit scene — gợi cảm giác self-care premium, sản phẩm trong morning routine.',
      emotion: 'comfort',
      realism: 'natural',
      composition: 'lifestyle-environmental',
      productVisibility: 'hero-dominant',
      textImportance: 'none',
      platformStyle: 'instagram-feed',
      cameraStyle: 'tripod-studio',
      renderStyle: 'editorial-beauty',
      emotionalGoal: 'Premium self-care ritual — beauty editorial vibe, slow morning',
      platformBehavior: 'Instagram + skincare ads — clean editorial composition',
      layoutRules: [
        'product hero on marble counter foreground',
        'optional person blurred in mirror reflection or background',
        'neatly folded towels as supporting prop',
      ],
      visualRules: [
        'white marble or clean tile surface',
        'soft warm natural light, morning skincare vibe',
        'minimal counter clutter — premium not cluttered',
      ],
      qualityRules: [
        'product label sharp and readable',
        'bathroom context clearly recognizable as upscale',
      ],
      failureModes: [
        'cluttered or dirty bathroom',
        'industrial / institutional bathroom feel',
        'dim or moody lighting',
      ],
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
      category: 'pro-photo',
      marketingGoal: 'Benefit scene — gắn sản phẩm vào lối sống urban / freelancer / millennial.',
      emotion: 'aspiration',
      realism: 'natural',
      composition: 'lifestyle-environmental',
      productVisibility: 'high',
      textImportance: 'none',
      platformStyle: 'instagram-feed',
      cameraStyle: 'handheld-smartphone',
      renderStyle: 'ugc-realism',
      emotionalGoal: 'Candid urban moment — sản phẩm thuộc về freelancer/digital nomad lifestyle',
      platformBehavior: 'Instagram lifestyle + brand-vibe ads',
      layoutRules: [
        'cafe table in foreground',
        'product + cappuccino + laptop / notebook as supporting props',
        'candid handheld eye-level framing',
      ],
      visualRules: [
        'ambient cafe light + warm window backlight',
        'natural bokeh-free background',
        'product label angled toward camera',
      ],
      qualityRules: [
        'product clearly visible with label readable',
        'cafe context unambiguously recognizable',
      ],
      failureModes: [
        'hotel-restaurant or fine-dining look',
        'overstaged influencer-shoot composition',
        'tripod-studio precision (this is candid)',
      ],
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
      emotionalGoal: 'TikTok creator review still — feels like a frame plucked from a viral video',
      platformBehavior: 'TikTok / Reels — vertical-thinking framing, raw smartphone aesthetic',
      layoutRules: [
        'vertical-thinking framing (works cropped to 9:16)',
        'bedroom / vanity / desk setup as context',
        'product near face at handheld arm distance',
      ],
      visualRules: [
        'ring-light reflection in eyes',
        'phone smartphone camera aesthetic',
        'mild digital grain and slight handheld jitter',
      ],
      qualityRules: [
        'authentic creator-review feel',
        'product label visible at frame center',
      ],
      failureModes: [
        'cinematic studio mood lighting',
        'professional camera DSLR aesthetic',
        'editorial model pose',
      ],
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
    emotionalGoal: 'Casual authenticity — private recommendation between two people',
    typographyStyle: 'native WhatsApp system font sizes, no custom typography',
    platformBehavior: 'WhatsApp 1-on-1 chat — customer + shop, casual conversational',
    layoutRules: [
      'portrait mobile screenshot',
      'WhatsApp-safe margins (16px side gutters)',
      'realistic chat bubble spacing',
      'proper bubble padding, never centered',
    ],
    contentRules: [
      'believable conversational tone',
      'imperfect grammar acceptable',
      'non-salesy — NEVER marketing copy',
      'casual emoji 0-2 per chat, never spammy',
      'mix message lengths — 4-25 words each',
    ],
    visualRules: [
      'native WhatsApp green for outgoing bubbles',
      'realistic avatar crops',
      'correct timestamp spacing under bubble groups',
      'double blue tick for read messages',
    ],
    qualityRules: [
      'all text fully readable',
      'UI pixel-correct to WhatsApp 2024',
      'no icon distortion',
    ],
    failureModes: [
      'AI gibberish text or broken Unicode',
      'overly clean Figma-perfect UI',
      'fake typography that does not match WhatsApp',
      'centered chat bubble layout',
      'landscape screenshot orientation',
      'language leakage (e.g. Vietnamese in a my-MY locale)',
    ],
  }),
  ...uiNativeConfig('messenger-chat', {
    category: 'social-proof',
    marketingGoal: 'Show shop có tương tác thật — chứng minh uy tín đang hoạt động.',
    emotion: 'trust',
    composition: 'mobile-screenshot',
    platformStyle: 'messenger',
    emotionalGoal: 'Customer-to-page trust — show shop active and replying',
    typographyStyle: 'native Messenger system font, blue gradient outgoing bubbles',
    platformBehavior: 'Messenger buyer ↔ page — customer inquiry then shop response',
    layoutRules: [
      'portrait mobile screenshot',
      'Messenger header with page name + avatar at top',
      'Messenger-blue outgoing bubble gradient',
      'realistic bubble spacing',
    ],
    contentRules: [
      'casual buyer asking + page replying',
      'short conversational messages',
      'Seen indicator after page replies',
      'mix of question + helpful response',
    ],
    visualRules: [
      'Messenger blue gradient for outgoing',
      'realistic Seen indicator with page profile thumb',
      'system timestamp formatting',
    ],
    qualityRules: [
      'text readable, no broken glyphs',
      'realistic timestamps and Seen states',
    ],
    failureModes: [
      'WhatsApp green color leakage (this is Messenger blue)',
      'landscape orientation',
      'centered bubble layout',
      'corporate marketing copy in customer voice',
    ],
  }),
  ...uiNativeConfig('shopee-feedback', {
    category: 'social-proof',
    marketingGoal: 'Trust signal từ Shopee — kênh Việt mặc định check trước khi mua.',
    emotion: 'trust',
    composition: 'mobile-screenshot',
    platformStyle: 'shopee',
    emotionalGoal: 'Buyer testimonial confidence — "đã mua, đã dùng, đã thấy kết quả"',
    typographyStyle: 'Shopee marketplace native — rating stars + variant tag + helpful count',
    platformBehavior: 'Shopee review — short review density, rating-first emphasis',
    layoutRules: [
      'Shopee orange brand header',
      'star rating block at top of card',
      'review body 60-160 words',
      'variant string and helpful count visible',
    ],
    contentRules: [
      'specific buyer details — when used, what changed, sensory detail',
      'casual reviewer tone',
      '0-2 emojis max — no emoji spam',
      'rating usually 5, sometimes 4 (never 1-3 in testimonial use)',
    ],
    visualRules: [
      'Shopee brand orange consistent',
      'realistic helpful count (3-80)',
      'product variant text feels like a real SKU choice',
    ],
    qualityRules: [
      'rating stars clearly visible',
      'variant string realistic',
      'review text fully readable',
    ],
    failureModes: [
      'corporate shop-generated marketing copy in buyer voice',
      'rating below 4 (testimonial use case is 4-5)',
      'links, phone numbers, prices',
    ],
  }),
  ...uiNativeConfig('tiktok-feedback', {
    category: 'social-proof',
    marketingGoal: 'Trust signal cho audience Gen Z mua qua TikTok Shop.',
    emotion: 'aspiration',
    composition: 'mobile-screenshot',
    platformStyle: 'tiktok-shop',
    emotionalGoal: 'Gen Z buyer confidence — TikTok Shop is the new ecommerce default',
    typographyStyle: 'TikTok Shop UI 2024 — pink-red accents, sans-serif',
    platformBehavior: 'TikTok Shop — younger voice, mobile-vertical buy-now context',
    layoutRules: [
      'TikTok pink-red chrome header',
      'star rating block prominent',
      'buy-now button visible',
      'mobile-vertical 9:16 framing',
    ],
    contentRules: [
      'Gen Z casual tone, light slang',
      'short body with one specific result detail',
      '0-1 emojis',
    ],
    visualRules: [
      'TikTok Shop 2024 UI chrome',
      'pink-red brand accents (NOT Shopee orange)',
    ],
    qualityRules: [
      'UI realistic to current TikTok Shop',
      'review text readable',
    ],
    failureModes: [
      'Shopee orange color leakage',
      'corporate older-demographic voice',
      'long-essay review (this is short)',
    ],
  }),
  ...uiNativeConfig('facebook-comment', {
    category: 'social-proof',
    marketingGoal: 'Engagement social proof — show bài post nhận phản hồi tích cực.',
    emotion: 'trust',
    composition: 'mobile-screenshot',
    platformStyle: 'facebook-ads',
    emotionalGoal: 'Community endorsement — strangers vouching publicly',
    typographyStyle: 'Facebook native sans-serif, like + reply buttons',
    platformBehavior: 'Facebook comments — older demographic tone, longer conversational comments',
    layoutRules: [
      'portrait screenshot',
      'thread of 4-6 comments stacked',
      'each comment: avatar + name + body + like count + reply count',
    ],
    contentRules: [
      'older demographic tone acceptable (vs TikTok Gen Z)',
      'longer conversational comments OK',
      'mix question + testimonial + reaction across the thread',
      'one or two viral comments with high like counts',
      'each commenter has a DIFFERENT username',
    ],
    visualRules: [
      'Facebook blue accents',
      'realistic timestamps ("2h", "1d", "5d")',
      'like + reply controls under each comment',
    ],
    qualityRules: [
      'every commenter username unique',
      'realistic like distribution — most 0..15, one or two 60..400',
    ],
    failureModes: [
      '8 near-identical variations of the same comment',
      'shop self-commenting under own post',
      'sponsored / ad / promo language',
    ],
  }),
  ...uiNativeConfig('tiktok-comment', {
    category: 'social-proof',
    marketingGoal: 'Trigger FOMO — show video đang viral, engagement cao.',
    emotion: 'hype',
    composition: 'mobile-screenshot',
    platformStyle: 'tiktok',
    emotionalGoal: 'Viral FOMO — "ai cũng comment, mình cũng phải xem"',
    typographyStyle: 'TikTok dark UI — white text on dark overlay, pink heart icons',
    platformBehavior: 'TikTok comment overlay — chaotic engagement, casual tone, emoji-heavy, Gen Z phrasing',
    layoutRules: [
      'dark TikTok overlay theme',
      '"9.4k bình luận" header at top',
      'heart count visible per comment',
      'overlay layered on bottom of a video frame',
    ],
    contentRules: [
      'chaotic engagement — short fragments, drop punctuation',
      'casual lowercase tone, emoji-heavy 1-3 per comment',
      'younger Gen Z phrasing, light slang',
      'mix reaction + question + tag-a-friend',
      'one or two reply chains where a username quotes another',
    ],
    visualRules: [
      'dark theme TikTok 2024 chrome',
      'pink/red heart icons',
      'realistic like spread — some 0, some viral 200+',
    ],
    qualityRules: [
      'authentic Gen Z voice across the thread',
      'high engagement signaling — not boring',
    ],
    failureModes: [
      'older formal tone or full sentences',
      'long-essay comments',
      'corporate marketing voice',
      'Shopee/Facebook UI leakage',
    ],
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
      emotionalGoal: 'Educational confidence — justify purchase with cứng numbers',
      typographyStyle: 'Ecommerce readability, bold benefit emphasis, mobile-safe 14px+ minimum',
      platformBehavior: 'Landing page section + ad carousel — 5-second scan readability',
      layoutRules: [
        'hierarchy-first composition',
        'large headline at top',
        'hero stat dominant in center',
        'clean section dividers between bullets and footnote',
      ],
      contentRules: [
        'specific numbers, never vague claims',
        '3-5 supporting bullet points, each 4-9 words',
        'footnote: source / timeframe / methodology hint',
      ],
      visualRules: [
        'icon-driven sections',
        'clean limited color palette',
        'high-contrast typography',
      ],
      qualityRules: [
        'hero stat readable at thumbnail size',
        'bullets parseable in a 5-second scan',
        'mobile-safe minimum font sizes',
      ],
      failureModes: [
        'cluttered layout',
        'tiny unreadable text',
        'random photo as background',
        'stock-photo collage feel',
      ],
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
      category: 'product-explain',
      marketingGoal: 'Click-thru optimization — banner cho Facebook / Shopee / TikTok ads paid traffic.',
      emotion: 'urgency',
      realism: 'stylized',
      composition: 'product-hero',
      productVisibility: 'hero-dominant',
      textImportance: 'critical',
      platformStyle: 'facebook-ads',
      cameraStyle: 'tripod-studio',
      renderStyle: 'editorial-beauty',
      emotionalGoal: 'Action-trigger urgency — pull the click without feeling spammy',
      typographyStyle: 'Bold headline readable at thumbnail size, CTA button contrasts background',
      platformBehavior: 'Paid ads — Facebook + Shopee + TikTok thumb-stop hook',
      layoutRules: [
        'product hero on one side (left or right)',
        'headline + offer + CTA stacked on the opposite side',
        'CTA button visually anchored at the bottom',
      ],
      contentRules: [
        'headline: 4-9 words',
        'subheadline: 6-12 words',
        'offer line: single benefit ("Giảm 30%", "Giao 24h")',
        'CTA: 2-3 word action verb ("Đặt ngay", "Xem chi tiết")',
      ],
      visualRules: [
        'brand palette consistent',
        'clean composition without bg noise',
        'CTA button contrasts background',
      ],
      qualityRules: [
        'headline readable at thumbnail size',
        'CTA button strongly contrasts background',
        'offer pill visible at a glance',
      ],
      failureModes: [
        'busy gradient background',
        'low-contrast CTA button',
        'crowded multi-element layout',
        'corporate stock-template feel',
      ],
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
 *  Returns a 1-element array so the spread above stays flat.
 *
 *  P28: helper now accepts Phase 4 rule arrays so each UI-native creative
 *  declares its layout / content / visual / quality / failure rules
 *  inline alongside the shared screenshot DNA. */
function uiNativeConfig(
  id: AssetTypeId,
  partial: {
    category: import('../uiCatalog/assetCatalog').CategoryId
    marketingGoal: string
    emotion: import('../types/creativeDNA').EmotionTone
    composition: import('../types/creativeDNA').CompositionKind
    platformStyle: import('../types/creativeDNA').PlatformStyle
    emotionalGoal?: string
    typographyStyle?: string
    platformBehavior?: string
    layoutRules?: string[]
    contentRules?: string[]
    visualRules?: string[]
    qualityRules?: string[]
    failureModes?: string[]
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
      emotionalGoal:    partial.emotionalGoal,
      typographyStyle:  partial.typographyStyle,
      platformBehavior: partial.platformBehavior,
      layoutRules:      partial.layoutRules,
      contentRules:     partial.contentRules,
      visualRules:      partial.visualRules,
      qualityRules:     partial.qualityRules,
      failureModes:     partial.failureModes,
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
