// ── Asset Catalog (P27 — Phase 3 conversion-first taxonomy) ────────────────
//
// Library re-org per Phase 3 spec. Picker is now organized by MARKETING
// PURPOSE — every entry answers "what does this creative SELL?", not
// "what does it look like?".
//
// 5 categories (was 8):
//   A. social-proof    — Bằng chứng xã hội    (UI-native screenshots)
//   B. product-explain — Giải thích sản phẩm  (designed-graphic infographics)
//   C. pro-photo       — Ảnh sản phẩm pro     (photographic, product-led)
//   D. ugc-real        — UGC & người thật     (photographic, people-led)
//   E. ai-magic        — AI Visual Magic      (experimental, optional)
//
// Removed categories (P14): lifestyle / conversion / social-ui. Their
// items rebucketed into the 5 new categories with marketing-purpose
// framing. CTA banner now lives under product-explain (it explains the
// offer). Before/after now lives under pro-photo (product transformation).
// All chat / comment / review UIs collapse into social-proof.
//
// Phase 3 also introduces 6 NEW catalog stubs flagged `comingSoon: true`:
// ingredients-explain / mechanism-explain / benefit-timeline /
// group-holding / collage-4-frames / expert-kol. They show in the
// picker so users see the taxonomy roadmap; engine implementation
// ships in a follow-up phase.

import type { AssetTypeId } from '../types/asset'
import type { EngineGroup } from '../types/engine'

// ── Marketing categories ───────────────────────────────────────────────

export type CategoryId =
  | 'social-proof'      // BẰNG CHỨNG XÃ HỘI
  | 'product-explain'   // GIẢI THÍCH SẢN PHẨM (infographics)
  | 'pro-photo'         // ẢNH SẢN PHẨM CHUYÊN NGHIỆP
  | 'ugc-real'          // UGC & NGƯỜI THẬT
  | 'ai-magic'          // AI VISUAL MAGIC (experimental)

export interface MarketingCategory {
  id: CategoryId
  title: { vi: string; en: string }
  description: { vi: string }
  /** Tailwind accent border for the section header. */
  accentClass: string
  /** Tailwind hover gradient for cards in this category. */
  cardBgClass: string
  /** Lucide icon for the category header. */
  iconKey: string
}

export const MARKETING_CATEGORIES: MarketingCategory[] = [
  {
    id: 'social-proof',
    title: { vi: 'Bằng chứng xã hội', en: 'Social proof' },
    description: { vi: 'Khách hàng nói thay bạn — chat, comment, review screenshot trust' },
    accentClass: 'border-emerald-200',
    cardBgClass: 'bg-gradient-to-br from-emerald-50/60 to-white hover:from-emerald-100/60',
    iconKey: 'users',
  },
  {
    id: 'product-explain',
    title: { vi: 'Giải thích sản phẩm', en: 'Product explanation' },
    description: { vi: 'Justify mua hàng — thành phần, cơ chế, timeline kết quả, số liệu' },
    accentClass: 'border-sky-200',
    cardBgClass: 'bg-gradient-to-br from-sky-50/60 to-white hover:from-sky-100/60',
    iconKey: 'flask',
  },
  {
    id: 'pro-photo',
    title: { vi: 'Ảnh sản phẩm chuyên nghiệp', en: 'Pro product photography' },
    description: { vi: 'Packshot / macro / so sánh / benefit scene — chỉn chu cho ecommerce' },
    accentClass: 'border-stone-200',
    cardBgClass: 'bg-gradient-to-br from-stone-50/60 to-white hover:from-stone-100/60',
    iconKey: 'camera',
  },
  {
    id: 'ugc-real',
    title: { vi: 'UGC & Người thật', en: 'UGC & real people' },
    description: { vi: 'Human trust — selfie, đám đông, chuyên gia, POV creator' },
    accentClass: 'border-violet-200',
    cardBgClass: 'bg-gradient-to-br from-violet-50/60 to-white hover:from-violet-100/60',
    iconKey: 'userRound',
  },
  {
    id: 'ai-magic',
    title: { vi: 'AI Visual Magic', en: 'AI visual magic' },
    description: { vi: 'Concept fantasy / cinematic / scale-shift — viral attention pieces' },
    accentClass: 'border-amber-200',
    cardBgClass: 'bg-gradient-to-br from-amber-50/60 to-white hover:from-amber-100/60',
    iconKey: 'wand',
  },
]

export function findCategory(id: CategoryId): MarketingCategory {
  return MARKETING_CATEGORIES.find((c) => c.id === id) ?? MARKETING_CATEGORIES[0]
}

// ── Badges (rendered as pill chips on each card) ───────────────────────

export type BadgeKey =
  | 'needs-product'
  | 'needs-avatar'
  | 'needs-reference'
  | 'tiktok'
  | 'shopee'
  | 'whatsapp'
  | 'messenger'
  | 'facebook'
  | 'ecommerce'
  | 'banner'
  | 'infographic'
  | 'engine-photo'       // P27 — engine type indicator
  | 'engine-ui'
  | 'engine-graphic'
  | 'coming-soon'        // P27 — Sắp ra mắt
  | 'expert'             // P27 — Chuyên gia / KOL
  | 'collage'            // P27 — Collage / multi-frame

export interface BadgeMeta {
  label: string
  className: string
}

export const BADGE_META: Record<BadgeKey, BadgeMeta> = {
  'needs-product':   { label: 'Sản phẩm',     className: 'bg-rose-100 text-rose-700' },
  'needs-avatar':    { label: 'Avatar AI',    className: 'bg-violet-100 text-violet-700' },
  'needs-reference': { label: 'Reference',    className: 'bg-amber-100 text-amber-800' },
  'tiktok':          { label: 'TikTok',       className: 'bg-black text-white' },
  'shopee':          { label: 'Shopee',       className: 'bg-orange-100 text-orange-700' },
  'whatsapp':        { label: 'WhatsApp',     className: 'bg-emerald-100 text-emerald-700' },
  'messenger':       { label: 'Messenger',    className: 'bg-blue-100 text-blue-700' },
  'facebook':        { label: 'Facebook',     className: 'bg-blue-100 text-blue-800' },
  'ecommerce':       { label: 'Ecommerce',    className: 'bg-stone-100 text-stone-700' },
  'banner':          { label: 'Banner',       className: 'bg-amber-100 text-amber-700' },
  'infographic':     { label: 'Infographic',  className: 'bg-sky-100 text-sky-700' },
  'engine-photo':    { label: 'Photo engine', className: 'bg-stone-50 text-stone-600 ring-1 ring-stone-200' },
  'engine-ui':       { label: 'UI engine',    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  'engine-graphic':  { label: 'Graphic engine', className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
  'coming-soon':     { label: 'Sắp ra mắt',   className: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' },
  'expert':          { label: 'Chuyên gia',   className: 'bg-indigo-100 text-indigo-700' },
  'collage':         { label: 'Collage',      className: 'bg-fuchsia-100 text-fuchsia-700' },
}

// ── Tooltip content shape ──────────────────────────────────────────────

export interface CardTooltip {
  /** Long-form description shown when user hovers a card. */
  what: string           // "Tạo ảnh ..."
  /** Marketing intent — what conversion / trust outcome this drives. */
  marketingGoal: string  // "Tăng độ tin tưởng, ..."
  /** Platforms / niches where this asset shines. */
  suitableFor: string[]  // ["TikTok ads", "Shopee", "skincare"]
}

// ── Asset catalog entry ────────────────────────────────────────────────

export interface AssetCatalogEntry {
  id: AssetTypeId
  /** Engine group — kept for dispatcher routing (not shown in UI). */
  group: EngineGroup
  /** Marketing category — drives picker grouping in UI. */
  categoryId: CategoryId
  /** Vietnamese marketing-mindset title. */
  title: { vi: string; en: string }
  /** 1-line subtitle shown on the card. */
  description: { vi: string; en: string }
  /** Output aspect ratio. */
  aspectRatio: '1:1' | '4:5' | '9:16' | '3:2' | '16:9'
  /** Lucide icon for the card. */
  iconKey: string
  /** Long-form hover tooltip. */
  tooltip: CardTooltip
  /** Pill badges shown on card. */
  badges: BadgeKey[]
  /** P27 — true when the catalog entry advertises the type but the
   *  underlying engine hasn't shipped yet. Picker renders these as
   *  visually muted + disables click + adds "Sắp ra mắt" badge. */
  comingSoon?: boolean
}

// ── 23 entries — Phase 3 marketing-purpose taxonomy ────────────────────

export const ASSET_CATALOG: AssetCatalogEntry[] = [
  // ═══════════════════════════════════════════════════════════════════
  // A. BẰNG CHỨNG XÃ HỘI — UI-native screenshots (template render, NOT
  //                       image prompting). Drives TRUST + SOCIAL PROOF.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'whatsapp-proof',
    group: 'ui-native',
    categoryId: 'social-proof',
    title: { vi: 'Tin nhắn WhatsApp', en: 'WhatsApp messages' },
    description: { vi: 'Screenshot chat khách hàng hỏi mua + cảm ơn sau khi nhận', en: 'WhatsApp buyer testimonial chat' },
    aspectRatio: '9:16',
    iconKey: 'messageCircle',
    tooltip: {
      what: 'Render screenshot WhatsApp giả lập đoạn chat giữa khách hàng và shop — bubble layout chuẩn, dấu tick xanh, timestamp, spacing thật như app gốc.',
      marketingGoal: 'TRUST tức thì — khách nhìn vào tin "đây là phản hồi thật từ người dùng đã mua", không phải copy marketing.',
      suitableFor: ['Landing page trust section', 'Carousel Facebook ads', 'Story Instagram', 'Pop-up retargeting'],
    },
    badges: ['needs-product', 'whatsapp', 'engine-ui'],
  },
  {
    id: 'messenger-chat',
    group: 'ui-native',
    categoryId: 'social-proof',
    title: { vi: 'Tin nhắn Messenger', en: 'Messenger chat' },
    description: { vi: 'Cuộc trò chuyện Messenger giữa khách hàng và fanpage', en: 'Messenger thread buyer ↔ page' },
    aspectRatio: '9:16',
    iconKey: 'messagesSquare',
    tooltip: {
      what: 'Render screenshot Messenger conversation — bubble xanh chuẩn, dấu Seen, timestamp realistic, customer inquiry flow + shop response.',
      marketingGoal: 'Cho thấy shop có tương tác thật, đông khách inbox — chứng minh "shop đang sống và bán hàng".',
      suitableFor: ['Bài đăng Facebook page', 'Story Facebook', 'Quảng cáo lead generation'],
    },
    badges: ['needs-product', 'messenger', 'engine-ui'],
  },
  {
    id: 'facebook-comment',
    group: 'ui-native',
    categoryId: 'social-proof',
    title: { vi: 'Bình luận Facebook', en: 'Facebook comments' },
    description: { vi: 'Thread bình luận viral dưới bài Facebook — engagement đậm đặc', en: 'Viral Facebook comment thread' },
    aspectRatio: '9:16',
    iconKey: 'messageSquare',
    tooltip: {
      what: 'Render screenshot thread 4-6 comment dưới bài Facebook — mỗi commenter có avatar riêng, nội dung mix question / testimonial / reaction emoji, like count tự nhiên.',
      marketingGoal: 'Engagement social proof — bài post nhận phản hồi tích cực từ cộng đồng, không phải comment shop tự fake.',
      suitableFor: ['Landing page trust section', 'Story testimonial', 'Carousel ads', 'Hook video TikTok'],
    },
    badges: ['needs-product', 'facebook', 'engine-ui'],
  },
  {
    id: 'tiktok-comment',
    group: 'ui-native',
    categoryId: 'social-proof',
    title: { vi: 'Bình luận TikTok viral', en: 'TikTok viral comments' },
    description: { vi: 'Overlay comment TikTok dark UI — "9.4k bình luận" viral feel', en: 'TikTok dark comment overlay' },
    aspectRatio: '9:16',
    iconKey: 'video',
    tooltip: {
      what: 'Render overlay comment TikTok — dark theme chuẩn UI 2024, badge "9.4k bình luận", nhiều unique commenter, heart count viral.',
      marketingGoal: 'Trigger FOMO — show video của bạn đang viral, có engagement cao, khách nghĩ "ai cũng xem rồi mình cũng phải xem".',
      suitableFor: ['TikTok ads', 'Story Instagram overlay', 'UGC video frame', 'Hook reel'],
    },
    badges: ['needs-product', 'tiktok', 'engine-ui'],
  },
  {
    id: 'shopee-feedback',
    group: 'ui-native',
    categoryId: 'social-proof',
    title: { vi: 'Review Shopee 5 sao', en: 'Shopee 5-star review' },
    description: { vi: 'Card đánh giá Shopee — 5 sao, variant, body review chân thực', en: 'Shopee buyer review card' },
    aspectRatio: '9:16',
    iconKey: 'shoppingBag',
    tooltip: {
      what: 'Render card review Shopee chuẩn — header màu cam, rating 5 sao, variant đã mua, body review specific, helpful count, ảnh đính kèm.',
      marketingGoal: 'Bằng chứng từ Shopee — kênh khách Việt tin nhất để check review trước khi mua. Trust signal khó refute.',
      suitableFor: ['Landing page social proof', 'Story Instagram', 'Bài đăng Facebook ads', 'Slide trong video TikTok'],
    },
    badges: ['needs-product', 'shopee', 'ecommerce', 'engine-ui'],
  },
  {
    id: 'tiktok-feedback',
    group: 'ui-native',
    categoryId: 'social-proof',
    title: { vi: 'Review TikTok Shop', en: 'TikTok Shop review' },
    description: { vi: 'Card đánh giá TikTok Shop — Gen Z trust signal', en: 'TikTok Shop buyer review' },
    aspectRatio: '9:16',
    iconKey: 'shoppingBag',
    tooltip: {
      what: 'Render card review TikTok Shop — chrome pink-red chuẩn UI TikTok, stars, variant, buy-now button, body review.',
      marketingGoal: 'Trust signal cho audience Gen Z mua qua TikTok Shop — kênh growth nhanh nhất Việt Nam 2024.',
      suitableFor: ['TikTok ads', 'Story Instagram', 'Carousel feed', 'UGC overlay'],
    },
    badges: ['needs-product', 'tiktok', 'ecommerce', 'engine-ui'],
  },
  // ── P37 — News authority mock ──────────────────────────────────────
  {
    id: 'news-mock',
    group: 'photographic',
    categoryId: 'social-proof',
    title: { vi: 'Mock báo / cơ quan y tế', en: 'News / Authority Mock' },
    description: { vi: 'Fake news screenshot — authority via media', en: 'Mock news article screenshot' },
    aspectRatio: '4:5',
    iconKey: 'megaphone',
    tooltip: {
      what: 'Render fake screenshot bài báo / health portal về niche sản phẩm — headline + article body + chrome neutral (KHÔNG copy outlet thật).',
      marketingGoal: 'Authority via media — "có báo / cơ quan y tế nói" tăng độ tin cho audience cảnh giác.',
      suitableFor: ['Landing page authority section', 'Facebook ad share', 'Advertorial credibility beat'],
    },
    badges: ['needs-product', 'engine-photo'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // B. GIẢI THÍCH SẢN PHẨM — Infographic / educational, designed-graphic
  //                          engine. Justify mua hàng. NOT photo engine.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'infographic',
    group: 'designed-graphic',
    categoryId: 'product-explain',
    title: { vi: 'Thống kê & Số liệu', en: 'Stats infographic' },
    description: { vi: 'Hero stat ("92% hài lòng") + bullets + footnote — chứng minh bằng số', en: 'Stat-driven infographic' },
    aspectRatio: '4:5',
    iconKey: 'barChart3',
    tooltip: {
      what: 'Render infographic số liệu: hero stat lớn (vd "92% hài lòng sau 2 tuần") + 3-5 bullets điểm mạnh + footnote nguồn — clean modern layout.',
      marketingGoal: 'Tăng độ tin trong 5 giây — phù hợp người scroll nhanh. Số liệu cứng dễ nhớ hơn câu copy.',
      suitableFor: ['Landing page benefits', 'Bài đăng Facebook', 'Carousel Instagram', 'Slide trong video TikTok'],
    },
    badges: ['needs-product', 'infographic', 'engine-graphic'],
  },
  {
    id: 'cta-banner',
    group: 'designed-graphic',
    categoryId: 'product-explain',
    title: { vi: 'Banner ưu đãi + CTA', en: 'Offer + CTA banner' },
    description: { vi: 'Headline + offer ("Giảm 30%") + nút CTA — paste vào ads ngay', en: 'Headline + offer + CTA banner' },
    aspectRatio: '4:5',
    iconKey: 'megaphone',
    tooltip: {
      what: 'Render banner quảng cáo: ảnh sản phẩm hero, headline lớn, offer pill ("Giảm 30%"), CTA button ("Đặt ngay") — layout sẵn sàng cho ads.',
      marketingGoal: 'Click-thru optimization — banner cuối phễu cho Facebook / Shopee / TikTok ads paid traffic.',
      suitableFor: ['Facebook ads', 'Instagram ads', 'Email blast', 'Shopee banner', 'Landing page hero'],
    },
    badges: ['needs-product', 'banner', 'engine-graphic'],
  },
  // ── P40 — Benefits Icon Grid (photographic) ───────────────────────
  {
    id: 'benefits-grid',
    group: 'photographic',
    categoryId: 'product-explain',
    title: { vi: 'Lưới biểu tượng công dụng', en: 'Benefits Icon Grid' },
    description: { vi: 'Sản phẩm trung tâm + 6 huy hiệu icon công dụng xung quanh', en: 'Product center + 6 surrounding benefit badges' },
    aspectRatio: '1:1',
    iconKey: 'layoutGrid',
    tooltip: {
      what: 'Render sản phẩm centered + 6 circular/hexagonal badges xung quanh, mỗi badge có icon + label công dụng ngắn (2-4 từ). Pull benefits từ product knowledge — KHÔNG invent.',
      marketingGoal: 'Visual benefit at-a-glance — tất cả công dụng trong 1 visual. Scroll-stop hook mạnh cho detail page + ads carousel.',
      suitableFor: ['Detail page Shopee', 'Landing page benefits section', 'Facebook carousel', 'TikTok Shop product detail'],
    },
    badges: ['needs-product', 'infographic', 'engine-photo'],
  },

  // ── P37 — Metric-Chip CTA + Comparison Table ───────────────────────
  {
    id: 'metric-cta',
    group: 'photographic',
    categoryId: 'product-explain',
    title: { vi: 'Banner CTA + Metric Chip', en: 'Metric-Chip CTA' },
    description: { vi: 'Product + halo metric chips + price-lock — last-scroll stopper', en: 'Product + halo metric chips banner' },
    aspectRatio: '16:9',
    iconKey: 'megaphone',
    tooltip: {
      what: 'Render banner conversion: product packaging centered + halo glow + 4-6 metric chips (★ 4.8/5, 20,000+ pengguna, ✓ Halal, TOP RATED). Price extracted từ offer field — không invent.',
      marketingGoal: 'Last-scroll-stopper — trust via metrics + price-lock. Phù hợp final-stage paid ads + landing-page last CTA.',
      suitableFor: ['Facebook paid ads', 'TikTok ads', 'Landing page bottom CTA', 'Retargeting'],
    },
    badges: ['needs-product', 'banner', 'engine-photo'],
  },
  {
    id: 'comparison-table',
    group: 'photographic',
    categoryId: 'product-explain',
    title: { vi: 'Bảng so sánh đối thủ', en: 'Comparison Table' },
    description: { vi: '2-col VS — green ✓ vs red ✗, justify superiority', en: '2-column VS competitor table' },
    aspectRatio: '1:1',
    iconKey: 'arrowRightLeft',
    tooltip: {
      what: 'Render bảng so sánh 2 cột: trái = sản phẩm (emerald + ✓), phải = "competitor" (gray + ✗). 5-6 rows. KHÔNG name competitor brand cụ thể.',
      marketingGoal: 'Justify purchase via head-to-head — clear-cut superiority. Phù hợp niche supplement / skincare / health.',
      suitableFor: ['Detail page Shopee', 'Landing page comparison section', 'Carousel Facebook'],
    },
    badges: ['needs-product', 'infographic', 'engine-photo'],
  },
  {
    id: 'ingredients-explain',
    group: 'designed-graphic',
    categoryId: 'product-explain',
    title: { vi: 'Thành phần sản phẩm', en: 'Ingredients map' },
    description: { vi: 'Infographic phân tích thành phần — herb/molecule + benefit mapping', en: 'Ingredient composition infographic' },
    aspectRatio: '4:5',
    iconKey: 'flask',
    tooltip: {
      what: 'Render infographic phân tích thành phần sản phẩm — molecule / herb illustration kết nối với benefit cụ thể, layout clean ecommerce readable.',
      marketingGoal: 'Justify purchase qua thành phần — khách thấy "có khoa học, có lý do" thay vì marketing copy chung chung.',
      suitableFor: ['Skincare', 'Thực phẩm chức năng', 'Supplement', 'Mỹ phẩm', 'Detail page Shopee'],
    },
    badges: ['needs-product', 'infographic', 'engine-graphic'],
  },
  {
    id: 'mechanism-explain',
    group: 'designed-graphic',
    categoryId: 'product-explain',
    title: { vi: 'Cơ chế hoạt động', en: 'How it works' },
    description: { vi: 'Body heatmap + mũi tên — show cơ chế tác động lên cơ thể', en: 'Mechanism heatmap + arrows' },
    aspectRatio: '4:5',
    iconKey: 'sparkles',
    tooltip: {
      what: 'Render infographic cơ chế hoạt động — body / skin / area diagram + arrows + heat zones giải thích sản phẩm tác động ở đâu, như thế nào.',
      marketingGoal: 'Conversion mạnh nhất cho pain relief / supplement / skincare — khách hiểu RÕ cơ chế là tin và mua.',
      suitableFor: ['Pain relief', 'Supplement', 'Skincare', 'Health & wellness', 'Landing page detail'],
    },
    badges: ['needs-product', 'infographic', 'engine-graphic'],
  },
  {
    id: 'benefit-timeline',
    group: 'designed-graphic',
    categoryId: 'product-explain',
    title: { vi: 'Timeline kết quả', en: 'Benefit timeline' },
    description: { vi: 'Sau 5 phút · sau 7 ngày · sau 30 ngày — visual tiến triển', en: 'Result progression timeline' },
    aspectRatio: '4:5',
    iconKey: 'arrowRightLeft',
    tooltip: {
      what: 'Render infographic timeline: "Sau 5 phút" / "Sau 7 ngày" / "Sau 30 ngày" với mô tả từng giai đoạn + visual progress.',
      marketingGoal: 'Set expectation đúng + tạo cảm giác kết quả nhanh — khách nhìn timeline biết khi nào thấy đổi.',
      suitableFor: ['Skincare', 'Supplement', 'Hair care', 'Whitening', 'Detail page'],
    },
    badges: ['needs-product', 'infographic', 'engine-graphic'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // C. ẢNH SẢN PHẨM CHUYÊN NGHIỆP — Photographic engine, product-led.
  //                                Packshot / macro / so sánh / scene.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'product-shot',
    group: 'photographic',
    categoryId: 'pro-photo',
    title: { vi: 'Packshot Premium', en: 'Premium packshot' },
    description: { vi: 'Hero image — floating product, dramatic light, premium shadow', en: 'Premium floating packshot' },
    aspectRatio: '1:1',
    iconKey: 'package',
    tooltip: {
      what: 'Render ảnh packshot premium: sản phẩm centered, dramatic studio lighting, premium shadow, có thể có reflection nhẹ — vibe luxury ecommerce.',
      marketingGoal: 'Hero image chính cho website + Shopee — ảnh đầu tiên khách thấy phải premium + đáng tin.',
      suitableFor: ['Shopee thumbnail', 'Website hero', 'Catalogue', 'Email banner', 'Landing page'],
    },
    badges: ['needs-product', 'ecommerce', 'engine-photo'],
  },
  {
    id: 'review-table',
    group: 'photographic',
    categoryId: 'pro-photo',
    title: { vi: 'Macro Detail Shot', en: 'Macro detail' },
    description: { vi: 'Macro texture + packaging detail — show chất lượng cận cảnh', en: 'Macro texture close-up' },
    aspectRatio: '1:1',
    iconKey: 'sparkles',
    tooltip: {
      what: 'Render macro shot cận cảnh sản phẩm — texture rõ, packaging detail, có thể có ingredient close-up (gel / cream / powder swatch).',
      marketingGoal: 'Show chất lượng cao — khách nhìn macro tin sản phẩm "có thật", "có hàng", không phải ảnh stock chỉnh lung tung.',
      suitableFor: ['Skincare', 'Mỹ phẩm', 'Gel / serum', 'Thực phẩm chức năng', 'Detail page'],
    },
    badges: ['needs-product', 'engine-photo'],
  },
  {
    id: 'before-after',
    group: 'photographic',
    categoryId: 'pro-photo',
    title: { vi: 'So sánh trước / sau', en: 'Before / After' },
    description: { vi: 'Split-frame transformation — performance advertising', en: 'Split-frame comparison' },
    aspectRatio: '1:1',
    iconKey: 'arrowRightLeft',
    tooltip: {
      what: 'Render split-frame 50/50: bên trái "trước" và bên phải "sau" — cùng góc máy, cùng lighting, chỉ thay đổi trạng thái target.',
      marketingGoal: 'Visual chuyển đổi mạnh nhất cho performance ads — show kết quả cụ thể, tăng tỉ lệ click + conversion.',
      suitableFor: ['Skincare ads', 'Thực phẩm chức năng', 'Giảm cân', 'Hair / nail care', 'Whitening'],
    },
    badges: ['needs-product', 'needs-avatar', 'engine-photo'],
  },
  {
    id: 'floating-product',
    group: 'photographic',
    categoryId: 'pro-photo',
    title: { vi: 'Floating Product Ad', en: 'Floating Product Ad' },
    description: { vi: 'Splash + glow + particles — thumb-stop hero cho paid ads', en: 'Dynamic ad packshot with splash + glow' },
    aspectRatio: '1:1',
    iconKey: 'sparkles',
    tooltip: {
      what: 'Render premium ad packshot — sản phẩm floating mid-frame, splash / glow / particles xung quanh. Vibe luxury hero shot.',
      marketingGoal: 'Thumb-stop hook cho paid Facebook / TikTok ads — premium ad creative chứ không phải ecommerce thumbnail.',
      suitableFor: ['Facebook ads', 'TikTok ads', 'Instagram paid', 'Premium brand campaigns'],
    },
    badges: ['needs-product', 'engine-photo'],
  },
  {
    id: 'ingredient-composition',
    group: 'photographic',
    categoryId: 'pro-photo',
    title: { vi: 'Sản phẩm + Nguyên liệu', en: 'Product + Ingredient' },
    description: { vi: 'Hero + herbs / botanicals — vibe editorial wellness', en: 'Product hero with botanical composition' },
    aspectRatio: '1:1',
    iconKey: 'flask',
    tooltip: {
      what: 'Render sản phẩm hero + arrangement nguyên liệu tự nhiên (lá, hoa, raw extracts) — vibe editorial wellness magazine.',
      marketingGoal: 'Justify purchase qua ingredient provenance — show "có thành phần thật, có khoa học" để build trust.',
      suitableFor: ['Skincare', 'Mỹ phẩm', 'Supplement', 'Herbal', 'Wellness', 'Detail page'],
    },
    badges: ['needs-product', 'engine-photo'],
  },
  // P31 — Cảm xúc & lối sống (kitchen / bathroom / cafe) removed from
  // catalog per user spec: too generic, stock-photo feel, weak
  // conversion. The underlying photographic configs + engine modules
  // remain registered so older history rows still resolve, but the
  // picker UI no longer surfaces them.

  // ═══════════════════════════════════════════════════════════════════
  // D. UGC & NGƯỜI THẬT — Photographic engine, people-led. Human trust.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'holding-product',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'Cầm sản phẩm trước camera', en: 'Person holding product' },
    description: { vi: 'Tay người cầm sản phẩm, label hướng camera — UGC standard', en: 'Person holds product at camera' },
    aspectRatio: '1:1',
    iconKey: 'package',
    tooltip: {
      what: 'Render người cầm sản phẩm trước ngực 2 tay, label hướng thẳng camera, biểu cảm tự nhiên — chuẩn shot UGC chính.',
      marketingGoal: 'Standard UGC packshot-with-hands — trust hơn ảnh studio thuần vì có "người thật" cầm.',
      suitableFor: ['Landing page', 'Social ads', 'Shopee main image', 'TikTok product showcase'],
    },
    badges: ['needs-product', 'needs-avatar', 'engine-photo'],
  },
  {
    id: 'ugc-selfie',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'POV / Selfie creator', en: 'POV / Selfie creator' },
    description: { vi: 'Selfie smartphone cùng sản phẩm — vibe khách hàng thật', en: 'Phone selfie with product' },
    aspectRatio: '1:1',
    iconKey: 'userRound',
    tooltip: {
      what: 'Render selfie smartphone (góc cao hơi nghiêng) người cầm sản phẩm cạnh mặt, smile chân thực — handheld framing, không pose studio.',
      marketingGoal: 'Trông như khách hàng thật chụp + post — pass authentic check ngay cả khi audience cảnh giác.',
      suitableFor: ['UGC ads', 'TikTok video frame', 'Story Instagram', 'Testimonial section'],
    },
    badges: ['needs-product', 'needs-avatar', 'tiktok', 'engine-photo'],
  },
  {
    id: 'ugc-tiktok',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'TikTok review still', en: 'TikTok review still' },
    description: { vi: 'Frame still từ video TikTok review — ring-light, vibe creator', en: 'Still from TikTok review video' },
    aspectRatio: '1:1',
    iconKey: 'video',
    tooltip: {
      what: 'Render frame "still" giống screenshot từ video TikTok review — ring-light reflection trong mắt, raw smartphone aesthetic, bedroom / vanity setup.',
      marketingGoal: 'Capitalize trên trend creator review — visual quen với audience TikTok, trust cao vì giống video viral đã từng xem.',
      suitableFor: ['TikTok ads', 'TikTok organic', 'Carousel slide', 'Story Instagram'],
    },
    badges: ['needs-product', 'needs-avatar', 'tiktok', 'engine-photo'],
  },
  {
    id: 'group-holding',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'Đám đông cầm sản phẩm', en: 'Group holding product' },
    description: { vi: 'Bạn bè / gia đình / đồng nghiệp cùng cầm sản phẩm — mass trust', en: 'Group of people holding product' },
    aspectRatio: '1:1',
    iconKey: 'users',
    tooltip: {
      what: 'Render nhóm 3-5 người (bạn bè / gia đình / đồng nghiệp) cùng cầm sản phẩm — biểu cảm tự nhiên, culturally believable, KHÔNG stock-photo look.',
      marketingGoal: 'Mass trust + social adoption — "nhiều người cùng dùng = sản phẩm hot", trigger herd behavior.',
      suitableFor: ['Brand awareness', 'Bài đăng cộng đồng', 'Story group', 'Carousel social proof'],
    },
    badges: ['needs-product', 'needs-avatar', 'engine-photo'],
  },
  {
    id: 'collage-4-frames',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'Collage 4 khung feedback', en: '4-frame testimonial collage' },
    description: { vi: '4 người khác nhau cầm sản phẩm — testimonial grid', en: '4 different people testimonial grid' },
    aspectRatio: '1:1',
    iconKey: 'layoutGrid',
    tooltip: {
      what: 'Render collage 4 ô — 4 người khác nhau cầm sản phẩm trong 4 khung riêng. Mỗi portrait generate độc lập rồi composition engine ghép, KHÔNG dùng single prompt fake collage.',
      marketingGoal: 'Diverse testimonial grid — show "nhiều demographic khác nhau đều dùng" trong 1 visual.',
      suitableFor: ['Landing page social proof grid', 'Carousel post', 'Story testimonial', 'Ad creative grid'],
    },
    badges: ['needs-product', 'collage', 'engine-photo'],
  },
  {
    id: 'expert-kol',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'Chuyên gia / Bác sĩ / KOL', en: 'Expert / Doctor / KOL' },
    description: { vi: 'Chuyên gia AI + review box quote — authority signal', en: 'Fictional expert + quote card' },
    aspectRatio: '4:5',
    iconKey: 'userRound',
    tooltip: {
      what: 'Render chuyên gia fictional (AI spokesperson) — top area: portrait + tên + chuyên môn + năm kinh nghiệm; bottom area: review box + quote + recommendation. KHÔNG fake real celebrities/doctors.',
      marketingGoal: 'Authority signal — chuyên gia bảo "có hiệu quả" mạnh hơn shop tự bảo. Phù hợp niche y tế / health / skincare.',
      suitableFor: ['Health & wellness', 'Skincare cao cấp', 'Supplement', 'Landing page authority'],
    },
    badges: ['needs-product', 'expert', 'engine-photo'],
  },
  // ── P37 — Ladipage-inspired UGC additions in ugc-real ──────────────
  {
    id: 'pain-overlay',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'Pain Point Overlay', en: 'Pain Point Overlay' },
    description: { vi: 'Face mid-symptom + italic warning overlay — empathy hook', en: 'Pain face with italic warning overlay' },
    aspectRatio: '4:5',
    iconKey: 'sparkles',
    tooltip: {
      what: 'Render người đang mid-symptom (mệt mỏi / đầy hơi / mất ngủ / đau bụng / tăng cân) + italic Malay/Vietnamese overlay trên dark glass panel. NO product visible.',
      marketingGoal: 'Pain-point empathy — khách nhận ra "đây là vấn đề của mình" → trigger emotional response trước khi reveal product.',
      suitableFor: ['Top-funnel ads', 'Pain hook', 'Facebook scroll-stop', 'Advertorial mở đầu'],
    },
    badges: ['needs-product', 'engine-photo'],
  },
  {
    id: 'failed-solutions',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'Đã thử nhiều mà thất bại', en: 'Failed Solutions' },
    description: { vi: 'UGC customer bao quanh bottles thất bại — empathy bridge', en: 'Empathy UGC surrounded by failed bottles' },
    aspectRatio: '4:5',
    iconKey: 'arrowRightLeft',
    tooltip: {
      what: 'Render khách hàng disheartened, bao quanh bởi 4-8 chai thuốc / supplement / OTC thất bại. NO target product. Vibe candid UGC.',
      marketingGoal: 'Empathy bridge — "I\'ve been there" moment trước khi reveal product. Pre-discovery funnel beat.',
      suitableFor: ['Mid-funnel advertorial', 'Pain → solution transition', 'Facebook ads emotional'],
    },
    badges: ['needs-product', 'engine-photo'],
  },

  // ═══════════════════════════════════════════════════════════════════
  // E. AI VISUAL MAGIC — experimental / attention-grabbing. Optional.
  //                      Keep separated from conversion creatives.
  // ═══════════════════════════════════════════════════════════════════
  // (Empty for now — roadmap. Picker shows "Đang phát triển — sắp ra mắt"
  // for empty categories via CategorySection.)
]

// ── Helpers ───────────────────────────────────────────────────────────

export function findCatalogEntry(id: AssetTypeId): AssetCatalogEntry | null {
  return ASSET_CATALOG.find((e) => e.id === id) ?? null
}

/** List entries in a marketing category. */
export function listCatalogByCategory(categoryId: CategoryId): AssetCatalogEntry[] {
  return ASSET_CATALOG.filter((e) => e.categoryId === categoryId)
}

/** Legacy — kept for any callers that still group by engine. */
export function listCatalogByGroup(group: EngineGroup): AssetCatalogEntry[] {
  return ASSET_CATALOG.filter((e) => e.group === group)
}

// ── Old GROUP_META kept for back-compat (anything that imported it
//    won't break — but the picker no longer uses it). ─────────────────

export interface GroupMeta {
  group: EngineGroup
  title: { vi: string; en: string }
  description: { vi: string; en: string }
  accentClass: string
  cardBgClass: string
}

export const GROUP_META: GroupMeta[] = [
  {
    group: 'photographic',
    title: { vi: 'Ảnh photographic', en: 'Photographic' },
    description: { vi: 'AI photo via KIE GPT-4o', en: 'AI photo via KIE GPT-4o' },
    accentClass: 'border-rose-200',
    cardBgClass: 'bg-rose-50/60',
  },
  {
    group: 'ui-native',
    title: { vi: 'UI-native screenshot', en: 'UI-native screenshot' },
    description: { vi: 'Canvas + AI avatar', en: 'Canvas + AI avatar' },
    accentClass: 'border-indigo-200',
    cardBgClass: 'bg-indigo-50/60',
  },
  {
    group: 'designed-graphic',
    title: { vi: 'Designed graphic', en: 'Designed graphic' },
    description: { vi: 'Layout + typography', en: 'Layout + typography' },
    accentClass: 'border-amber-200',
    cardBgClass: 'bg-amber-50/60',
  },
]

// ── Dynamic input requirements (per creative type) ────────────────────

export interface CreativeRequirements {
  requireProduct: boolean
  requireAvatar: boolean
  requireReference: boolean
}

const REQ_PHOTO_PERSON:    CreativeRequirements = { requireProduct: true, requireAvatar: true,  requireReference: false }
const REQ_PHOTO_NO_PERSON: CreativeRequirements = { requireProduct: true, requireAvatar: false, requireReference: false }
const REQ_UI_NATIVE:       CreativeRequirements = { requireProduct: true, requireAvatar: false, requireReference: false }
const REQ_DESIGNED:        CreativeRequirements = { requireProduct: true, requireAvatar: false, requireReference: false }

const REQUIREMENTS: Partial<Record<AssetTypeId, CreativeRequirements>> = {
  // pro-photo
  'product-shot':          REQ_PHOTO_NO_PERSON,
  'review-table':          REQ_PHOTO_NO_PERSON,
  'before-after':          REQ_PHOTO_PERSON,
  'floating-product':      REQ_PHOTO_NO_PERSON,
  'ingredient-composition':REQ_PHOTO_NO_PERSON,
  'lifestyle-kitchen':     REQ_PHOTO_PERSON,
  'bathroom-routine':      REQ_PHOTO_PERSON,
  'cafe-lifestyle':        REQ_PHOTO_PERSON,

  // ugc-real
  'holding-product':       REQ_PHOTO_PERSON,
  'ugc-selfie':            REQ_PHOTO_PERSON,
  'ugc-tiktok':            REQ_PHOTO_PERSON,
  'group-holding':         REQ_PHOTO_PERSON,
  // P35 — collage generates 4 different faces inside ONE KIE call,
  // no single avatar reference makes sense. Product only.
  'collage-4-frames':      REQ_PHOTO_NO_PERSON,

  // P37 — Ladipage-inspired creatives ──────────────────────────────
  'pain-overlay':          REQ_PHOTO_NO_PERSON,
  'news-mock':             REQ_PHOTO_NO_PERSON,
  'metric-cta':            REQ_PHOTO_NO_PERSON,
  'failed-solutions':      REQ_PHOTO_NO_PERSON,
  'comparison-table':      REQ_PHOTO_NO_PERSON,

  // P40 — Benefits Icon Grid ─────────────────────────────────────────
  'benefits-grid':         REQ_PHOTO_NO_PERSON,
  'expert-kol':            REQ_PHOTO_NO_PERSON,

  // social-proof (UI-native)
  'whatsapp-proof':        REQ_UI_NATIVE,
  'messenger-chat':        REQ_UI_NATIVE,
  'shopee-feedback':       REQ_UI_NATIVE,
  'tiktok-feedback':       REQ_UI_NATIVE,
  'facebook-comment':      REQ_UI_NATIVE,
  'tiktok-comment':        REQ_UI_NATIVE,

  // product-explain (designed-graphic)
  'infographic':           REQ_DESIGNED,
  'cta-banner':            REQ_DESIGNED,
  'ingredients-explain':   REQ_DESIGNED,
  'mechanism-explain':     REQ_DESIGNED,
  'benefit-timeline':      REQ_DESIGNED,
}

const DEFAULT_REQ: CreativeRequirements = { requireProduct: true, requireAvatar: false, requireReference: false }

export function requirementsFor(id: AssetTypeId): CreativeRequirements {
  return REQUIREMENTS[id] ?? DEFAULT_REQ
}
