// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — anti-patterns (negative space)
//
// Distilled tag list. Runtime prompt CHỈ inject các tag liên quan tới
// section/niche hiện tại (không dump full list) — token safety.
// ─────────────────────────────────────────────────────────────────────

import type { AntiPatterns, AntiPatternTag } from '../types'

export const ANTI_PATTERNS: AntiPatterns = {
  visual: [
    'holding-product-commercial',
    'smile-every-image',
    'multi-product-shot',
    'ecommerce-banner',
    'before-after-split',
    'comparison-table',
    'infographic',
    'doctor-labcoat',
    'pills-closeup',
    'star-rating-overlay',
    'whatsapp-screenshot',
    'urgency-strip',
    'price-tag',
    'stock-photo-vibe',
    'pinterest-aesthetic',
    'fashion-editorial',
    'luxury-catalog',
    'hyper-golden-hour',
  ],

  text: [
    'giant-block',
    'ai-essay-tone',
    'bullet-spam',
    'miracle-transformation',
    'overdramatic-trauma',
    'trauma-level-intensity',
    'generic-motivational',
    'hard-sell',
    'statistics-dump',
    'doctor-testimonial',
    'fake-urgency',
  ],

  vibe: [
    'ai-commercial',
    'tvc-montage',
    'catalog',
    'instagram-aesthetic',
    'brand-stylist-energy',
  ],
}

/** Tag → 1-line distilled negative instruction. Runtime prompt picks
 *  tags relevant to current section + niche, then injects 1-line bullet
 *  per selected tag. KHÔNG dump full record. */
export const ANTI_PATTERN_INSTRUCTIONS: Record<AntiPatternTag, string> = {
  // ── Visual ──
  'holding-product-commercial': 'no holding product up to camera in commercial pose',
  'smile-every-image':          'no smile-at-camera in every image (most images: candid, not making eye contact)',
  'multi-product-shot':         'no multiple products in one frame',
  'ecommerce-banner':           'no ecommerce banner / promo strip composition',
  'before-after-split':         'no before/after split labels or comparison frames',
  'comparison-table':           'no comparison table (us vs them)',
  'infographic':                'no infographic with arrows, percentages, stats',
  'doctor-labcoat':             'no doctor / lab coat / clipboard imagery',
  'pills-closeup':              'no pills / capsules close-up infographic',
  'star-rating-overlay':        'no star rating overlay on images',
  'whatsapp-screenshot':        'no WhatsApp/TikTok/Shopee screenshot mockup',
  'urgency-strip':              'no urgency strip / countdown overlay',
  'price-tag':                  'no price / discount tag in image',
  'stock-photo-vibe':           'no stock-photo over-polished generic-model vibe',
  'pinterest-aesthetic':        'no Pinterest-perfect composition',
  'fashion-editorial':          'no fashion editorial / magazine cover composition',
  'luxury-catalog':             'no luxury catalog / Aesop-Apple aesthetic',
  'hyper-golden-hour':          'no hyper golden-hour everything — natural light variety OK',

  // ── Text ──
  'giant-block':                'no paragraph exceeding 5 sentences without break',
  'ai-essay-tone':              'no AI essay tone — write like diary, not academic',
  'bullet-spam':                'no bullet list spam — max 1 list per section, max 4 items',
  'miracle-transformation':     'no "khỏi hẳn sau 7 ngày" / instant-result claims',
  'overdramatic-trauma':        'no overdramatic trauma language',
  'trauma-level-intensity':     'pain stays at niche-appropriate intensity, never trauma/medical despair',
  'generic-motivational':       'no generic motivational tone ("hãy tin vào bản thân")',
  'hard-sell':                  'no hard-sell language ("đặt hàng ngay", "chỉ còn 24h")',
  'statistics-dump':            'no statistics dump ("93% người dùng cảm thấy...")',
  'doctor-testimonial':         'no doctor / expert testimonial paragraph',
  'fake-urgency':               'no fake urgency / scarcity language',

  // ── Vibe ──
  'ai-commercial':              'avoid AI commercial vibe',
  'tvc-montage':                'avoid TVC montage feel',
  'catalog':                    'avoid catalog / product-page vibe',
  'instagram-aesthetic':        'avoid Instagram aesthetic / influencer haul energy',
  'brand-stylist-energy':       'self-test: would a brand stylist post this, or a real family member? Aim for the latter',
}
