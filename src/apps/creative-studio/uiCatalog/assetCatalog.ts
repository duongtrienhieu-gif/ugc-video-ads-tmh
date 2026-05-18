// ── Asset Catalog (P14 — marketing-mindset Vietnamese library) ─────────────
//
// Library re-org per P14 spec. Picker is now a "thư viện góc quảng cáo
// AI" organized by MARKETING CATEGORIES (8) — not by engine group.
// Every entry has:
//   • Vietnamese marketing-mindset title (no "cinematic render", no
//     "beauty lighting" — only words a non-technical user understands)
//   • short Vietnamese subtitle (1 line)
//   • hover tooltip (marketing goal + suitable platforms)
//   • badges (Sản phẩm / Avatar AI / TikTok / Shopee / ...)

import type { AssetTypeId } from '../types/asset'
import type { EngineGroup } from '../types/engine'

// ── Marketing categories (replace the old 3 engine groups in UI) ───────

export type CategoryId =
  | 'social-proof'      // BẰNG CHỨNG XÃ HỘI
  | 'product-explain'   // GIẢI THÍCH SẢN PHẨM
  | 'lifestyle'         // CẢM XÚC & LỐI SỐNG
  | 'conversion'        // QUẢNG CÁO CHUYỂN ĐỔI
  | 'social-ui'         // GIAO DIỆN MẠNG XÃ HỘI
  | 'pro-photo'         // ẢNH SẢN PHẨM CHUYÊN NGHIỆP
  | 'ugc-real'          // UGC & NGƯỜI THẬT
  | 'ai-magic'          // AI VISUAL MAGIC (placeholder roadmap)

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
    description: { vi: 'Khách hàng nói thay bạn — tin nhắn, review, screenshot trust' },
    accentClass: 'border-emerald-200',
    cardBgClass: 'bg-gradient-to-br from-emerald-50/60 to-white hover:from-emerald-100/60',
    iconKey: 'users',
  },
  {
    id: 'product-explain',
    title: { vi: 'Giải thích sản phẩm', en: 'Product explanation' },
    description: { vi: 'Tăng độ tin — phân tích thành phần, cơ chế, công dụng dễ hiểu' },
    accentClass: 'border-sky-200',
    cardBgClass: 'bg-gradient-to-br from-sky-50/60 to-white hover:from-sky-100/60',
    iconKey: 'flask',
  },
  {
    id: 'lifestyle',
    title: { vi: 'Cảm xúc & Lối sống', en: 'Emotion & lifestyle' },
    description: { vi: 'Gắn sản phẩm vào routine + vibe — vẽ ra cuộc sống có sản phẩm' },
    accentClass: 'border-rose-200',
    cardBgClass: 'bg-gradient-to-br from-rose-50/60 to-white hover:from-rose-100/60',
    iconKey: 'heart',
  },
  {
    id: 'conversion',
    title: { vi: 'Quảng cáo chuyển đổi', en: 'Conversion ads' },
    description: { vi: 'Nỗi đau + giải pháp + CTA — tối ưu cho ads chạy paid' },
    accentClass: 'border-orange-200',
    cardBgClass: 'bg-gradient-to-br from-orange-50/60 to-white hover:from-orange-100/60',
    iconKey: 'flame',
  },
  {
    id: 'social-ui',
    title: { vi: 'Giao diện mạng xã hội', en: 'Social UI mockup' },
    description: { vi: 'Screenshot Shopee / Facebook / TikTok / Messenger trông như thật' },
    accentClass: 'border-indigo-200',
    cardBgClass: 'bg-gradient-to-br from-indigo-50/60 to-white hover:from-indigo-100/60',
    iconKey: 'smartphone',
  },
  {
    id: 'pro-photo',
    title: { vi: 'Ảnh sản phẩm chuyên nghiệp', en: 'Pro product photography' },
    description: { vi: 'Studio / ecommerce / luxury — packshot chỉn chu cho web + Shopee' },
    accentClass: 'border-stone-200',
    cardBgClass: 'bg-gradient-to-br from-stone-50/60 to-white hover:from-stone-100/60',
    iconKey: 'camera',
  },
  {
    id: 'ugc-real',
    title: { vi: 'UGC & Người thật', en: 'UGC & real people' },
    description: { vi: 'Selfie + POV điện thoại — vibe khách hàng thật, không stock' },
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

export interface BadgeMeta {
  label: string
  className: string
}

export const BADGE_META: Record<BadgeKey, BadgeMeta> = {
  'needs-product':   { label: 'Sản phẩm',   className: 'bg-rose-100 text-rose-700' },
  'needs-avatar':    { label: 'Avatar AI',  className: 'bg-violet-100 text-violet-700' },
  'needs-reference': { label: 'Reference',  className: 'bg-amber-100 text-amber-800' },
  'tiktok':          { label: 'TikTok',     className: 'bg-black text-white' },
  'shopee':          { label: 'Shopee',     className: 'bg-orange-100 text-orange-700' },
  'whatsapp':        { label: 'WhatsApp',   className: 'bg-emerald-100 text-emerald-700' },
  'messenger':       { label: 'Messenger',  className: 'bg-blue-100 text-blue-700' },
  'facebook':        { label: 'Facebook',   className: 'bg-blue-100 text-blue-800' },
  'ecommerce':       { label: 'Ecommerce',  className: 'bg-stone-100 text-stone-700' },
  'banner':          { label: 'Banner',     className: 'bg-amber-100 text-amber-700' },
  'infographic':     { label: 'Infographic',className: 'bg-sky-100 text-sky-700' },
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

// ── Asset catalog entry (V2) ───────────────────────────────────────────

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
}

// ── 17 mapped entries — Vietnamese marketing labels + categories ───────

export const ASSET_CATALOG: AssetCatalogEntry[] = [
  // ─── BẰNG CHỨNG XÃ HỘI ────────────────────────────────────────────
  {
    id: 'whatsapp-proof',
    group: 'ui-native',
    categoryId: 'social-proof',
    title: { vi: 'Tin nhắn WhatsApp', en: 'WhatsApp messages' },
    description: { vi: 'Khách hàng chat khen sản phẩm — screenshot WhatsApp', en: 'Customer praises product — WhatsApp screenshot' },
    aspectRatio: '9:16',
    iconKey: 'messageCircle',
    tooltip: {
      what: 'Tạo screenshot WhatsApp giả lập đoạn chat giữa khách hàng và shop, với tin nhắn khen sản phẩm + dấu tick xanh đã xem.',
      marketingGoal: 'Tạo bằng chứng xã hội tức thì — khách nhìn vào tin tưởng "đây là phản hồi thật từ người dùng cũ".',
      suitableFor: ['Landing page section trust', 'Carousel Facebook ads', 'Story Instagram', 'Pop-up retargeting'],
    },
    badges: ['needs-product', 'whatsapp'],
  },
  {
    id: 'messenger-chat',
    group: 'ui-native',
    categoryId: 'social-proof',
    title: { vi: 'Tin nhắn Messenger', en: 'Messenger chat' },
    description: { vi: 'Cuộc trò chuyện Messenger giữa khách và page', en: 'Messenger thread between buyer and page' },
    aspectRatio: '9:16',
    iconKey: 'messagesSquare',
    tooltip: {
      what: 'Screenshot Messenger conversation giữa khách hàng và fanpage, với bubble xanh + dấu Seen.',
      marketingGoal: 'Cho thấy shop có tương tác thật, đông khách inbox — chứng minh shop uy tín đang hoạt động.',
      suitableFor: ['Bài đăng Facebook page', 'Story Facebook', 'Quảng cáo lead generation'],
    },
    badges: ['needs-product', 'messenger'],
  },

  // ─── GIẢI THÍCH SẢN PHẨM ──────────────────────────────────────────
  {
    id: 'infographic',
    group: 'designed-graphic',
    categoryId: 'product-explain',
    title: { vi: 'Phân tích công dụng', en: 'Benefit infographic' },
    description: { vi: 'Infographic số liệu + bullets điểm mạnh sản phẩm', en: 'Stat-driven product infographic' },
    aspectRatio: '4:5',
    iconKey: 'barChart3',
    tooltip: {
      what: 'Tạo infographic với số liệu hero (vd "92% hài lòng") + 3-5 bullets điểm mạnh + footnote nguồn — phong cách clean modern.',
      marketingGoal: 'Tăng độ tin tưởng + giải thích công dụng nhanh trong 5 giây. Phù hợp người scroll nhanh trên feed.',
      suitableFor: ['Landing page section benefits', 'Bài đăng Facebook', 'Carousel Instagram', 'Slide trong video TikTok'],
    },
    badges: ['needs-product', 'needs-reference', 'infographic'],
  },

  // ─── CẢM XÚC & LỐI SỐNG ───────────────────────────────────────────
  {
    id: 'lifestyle-kitchen',
    group: 'photographic',
    categoryId: 'lifestyle',
    title: { vi: 'Sản phẩm trong bếp', en: 'Kitchen lifestyle' },
    description: { vi: 'Bếp sáng buổi sáng, nắng cửa sổ, sản phẩm ở counter', en: 'Bright morning kitchen' },
    aspectRatio: '1:1',
    iconKey: 'sun',
    tooltip: {
      what: 'Tạo ảnh sản phẩm đặt trên counter bếp sáng, nắng buổi sáng qua cửa sổ, có người mờ ở hậu cảnh đang pha cà phê / chuẩn bị bữa sáng.',
      marketingGoal: 'Gắn sản phẩm vào routine ấm cúng — khách tưởng tượng mình dùng SP mỗi sáng trong bếp nhà mình.',
      suitableFor: ['Thực phẩm chức năng', 'Đồ uống', 'Coffee / matcha', 'Skincare buổi sáng'],
    },
    badges: ['needs-product', 'needs-avatar'],
  },
  {
    id: 'bathroom-routine',
    group: 'photographic',
    categoryId: 'lifestyle',
    title: { vi: 'Routine buổi sáng', en: 'Morning bathroom routine' },
    description: { vi: 'Counter marble bathroom, vibe skincare routine sáng', en: 'Marble bathroom skincare vibe' },
    aspectRatio: '1:1',
    iconKey: 'sparkles',
    tooltip: {
      what: 'Tạo ảnh sản phẩm trên counter marble bathroom với khăn tắm xếp gọn, có người mờ ở hậu cảnh đang soi gương — vibe routine skincare buổi sáng.',
      marketingGoal: 'Gợi cảm giác "self-care premium" — gắn sản phẩm vào nghi thức chăm sóc bản thân chuẩn beauty editorial.',
      suitableFor: ['Skincare', 'Beauty', 'Premium grooming', 'Mỹ phẩm cao cấp'],
    },
    badges: ['needs-product', 'needs-avatar'],
  },
  {
    id: 'cafe-lifestyle',
    group: 'photographic',
    categoryId: 'lifestyle',
    title: { vi: 'Góc cafe lifestyle', en: 'Cafe lifestyle' },
    description: { vi: 'Bàn cafe có cappuccino + laptop + sản phẩm', en: 'Cafe table moment' },
    aspectRatio: '1:1',
    iconKey: 'coffee',
    tooltip: {
      what: 'Tạo ảnh người ngồi ở bàn cafe cầm sản phẩm, cappuccino + laptop trên bàn, vibe candid lifestyle moment.',
      marketingGoal: 'Gắn sản phẩm vào lối sống urban / freelancer / millennial — phù hợp brand muốn vibe trendy.',
      suitableFor: ['Đồ uống', 'Vitamin', 'Wellness lifestyle', 'Brand trẻ trung'],
    },
    badges: ['needs-product', 'needs-avatar'],
  },

  // ─── QUẢNG CÁO CHUYỂN ĐỔI ─────────────────────────────────────────
  {
    id: 'before-after',
    group: 'photographic',
    categoryId: 'conversion',
    title: { vi: 'So sánh trước/sau', en: 'Before / After' },
    description: { vi: 'Split frame transformation 2 trạng thái', en: 'Split-frame transformation' },
    aspectRatio: '1:1',
    iconKey: 'arrowRightLeft',
    tooltip: {
      what: 'Tạo ảnh split-frame 50/50: bên trái "trước" (mệt mỏi / dull) và bên phải "sau" (rạng rỡ / refreshed) — cùng 1 người, cùng góc máy.',
      marketingGoal: 'Visual chuyển đổi mạnh nhất cho ads — show kết quả cụ thể, tăng tỉ lệ click + conversion.',
      suitableFor: ['Skincare ads', 'Thực phẩm chức năng', 'Giảm cân', 'Hair / nail care', 'Whitening'],
    },
    badges: ['needs-product', 'needs-avatar'],
  },
  {
    id: 'cta-banner',
    group: 'designed-graphic',
    categoryId: 'conversion',
    title: { vi: 'Banner ưu đãi', en: 'CTA promo banner' },
    description: { vi: 'Banner headline + offer + nút CTA + ảnh sản phẩm', en: 'Headline + offer + CTA + product hero' },
    aspectRatio: '4:5',
    iconKey: 'megaphone',
    tooltip: {
      what: 'Tạo banner quảng cáo với ảnh sản phẩm hero, headline lớn, offer pill ("Giảm 30%"), CTA button ("Đặt ngay") — sẵn sàng paste vào ads.',
      marketingGoal: 'Click-thru optimization — banner tối ưu cho Facebook ads / Shopee ads / TikTok ads paid traffic.',
      suitableFor: ['Facebook ads', 'Instagram ads', 'Email blast', 'Shopee banner', 'Landing page hero'],
    },
    badges: ['needs-product', 'needs-reference', 'banner'],
  },

  // ─── GIAO DIỆN MẠNG XÃ HỘI ────────────────────────────────────────
  {
    id: 'shopee-feedback',
    group: 'ui-native',
    categoryId: 'social-ui',
    title: { vi: 'Review Shopee 5 sao', en: 'Shopee 5-star review' },
    description: { vi: 'Card đánh giá khách Shopee — 5 sao, variant, ảnh', en: 'Shopee buyer review card' },
    aspectRatio: '9:16',
    iconKey: 'shoppingBag',
    tooltip: {
      what: 'Tạo screenshot card review Shopee đầy đủ: rating 5 sao, variant đã mua, body review chân thực, helpful count, header màu cam Shopee.',
      marketingGoal: 'Bằng chứng từ Shopee — platform mà khách Việt tin nhất để check review trước khi mua.',
      suitableFor: ['Landing page social proof', 'Story Instagram', 'Bài đăng Facebook ads', 'Slide trong video TikTok'],
    },
    badges: ['needs-product', 'shopee', 'ecommerce'],
  },
  {
    id: 'tiktok-feedback',
    group: 'ui-native',
    categoryId: 'social-ui',
    title: { vi: 'Review TikTok Shop', en: 'TikTok Shop review' },
    description: { vi: 'Card đánh giá người mua TikTok Shop', en: 'TikTok Shop buyer review' },
    aspectRatio: '9:16',
    iconKey: 'shoppingBag',
    tooltip: {
      what: 'Tạo screenshot card review TikTok Shop với chrome pink-red TikTok, stars, variant, buy-now button — chuẩn UI TikTok Shop 2024.',
      marketingGoal: 'Trust signal cho audience Gen Z mua qua TikTok Shop — kênh đang growth nhanh nhất ở Việt Nam.',
      suitableFor: ['TikTok ads', 'Story Instagram', 'Carousel feed', 'UGC overlay'],
    },
    badges: ['needs-product', 'tiktok', 'ecommerce'],
  },
  {
    id: 'facebook-comment',
    group: 'ui-native',
    categoryId: 'social-ui',
    title: { vi: 'Bình luận Facebook', en: 'Facebook comments' },
    description: { vi: 'Thread bình luận viral dưới bài Facebook', en: 'Facebook comment thread' },
    aspectRatio: '9:16',
    iconKey: 'messageSquare',
    tooltip: {
      what: 'Tạo screenshot thread bình luận Facebook (4-6 comment), mỗi commenter có avatar riêng + nội dung mix question / testimonial / emoji, likes count thực tế.',
      marketingGoal: 'Engagement social proof — show bài post của bạn nhận được nhiều phản hồi tích cực từ cộng đồng.',
      suitableFor: ['Landing page section', 'Story testimonial', 'Carousel post', 'Hook video TikTok'],
    },
    badges: ['needs-product', 'facebook'],
  },
  {
    id: 'tiktok-comment',
    group: 'ui-native',
    categoryId: 'social-ui',
    title: { vi: 'Bình luận TikTok viral', en: 'TikTok comment overlay' },
    description: { vi: 'Comment overlay TikTok dark theme, viral count', en: 'TikTok dark comment overlay' },
    aspectRatio: '9:16',
    iconKey: 'video',
    tooltip: {
      what: 'Tạo screenshot comment overlay TikTok với dark theme, "9.4k bình luận" + nhiều unique commenter + heart count viral — chuẩn UI TikTok 2024.',
      marketingGoal: 'Trigger FOMO — show video của bạn đang viral, có engagement cao, thúc đẩy người xem tham gia.',
      suitableFor: ['TikTok ads', 'Story Instagram overlay', 'UGC video', 'Hook reel'],
    },
    badges: ['needs-product', 'tiktok'],
  },

  // ─── ẢNH SẢN PHẨM CHUYÊN NGHIỆP ───────────────────────────────────
  {
    id: 'product-shot',
    group: 'photographic',
    categoryId: 'pro-photo',
    title: { vi: 'Ảnh studio sạch', en: 'Clean studio product shot' },
    description: { vi: 'Packshot studio, label rõ, nền trắng / xám sạch', en: 'Studio packshot, clear label' },
    aspectRatio: '1:1',
    iconKey: 'package',
    tooltip: {
      what: 'Tạo ảnh packshot studio chuyên nghiệp: sản phẩm centered, ánh sáng softbox đều, label rõ ràng, không bóng / không bokeh.',
      marketingGoal: 'Hình hero chính cho website + Shopee — ảnh đầu tiên khách thấy, phải sharp + sạch + tin được.',
      suitableFor: ['Shopee thumbnail', 'Website hero', 'Catalogue', 'Email banner', 'Print materials'],
    },
    badges: ['needs-product', 'ecommerce'],
  },
  {
    id: 'review-table',
    group: 'photographic',
    categoryId: 'pro-photo',
    title: { vi: 'Flatlay trên bàn', en: 'Desk flatlay' },
    description: { vi: 'Flat-lay top-down trên bàn gỗ, vibe review', en: 'Top-down flatlay on wood' },
    aspectRatio: '1:1',
    iconKey: 'layoutGrid',
    tooltip: {
      what: 'Tạo ảnh flatlay top-down hoặc 45° trên bàn gỗ sạch, có thể có thêm hand grip — vibe review unboxing.',
      marketingGoal: 'Aesthetic Instagram-grid friendly — bố cục clean cho lifestyle feed của brand.',
      suitableFor: ['Instagram grid', 'Pinterest', 'Bài đăng review blog', 'Carousel feed'],
    },
    badges: ['needs-product'],
  },

  // ─── UGC & NGƯỜI THẬT ─────────────────────────────────────────────
  {
    id: 'holding-product',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'Cầm sản phẩm trước camera', en: 'Holding product' },
    description: { vi: 'Tay người cầm SP, label hướng camera', en: 'Person holding product at camera' },
    aspectRatio: '1:1',
    iconKey: 'package',
    tooltip: {
      what: 'Tạo ảnh người cầm sản phẩm trước ngực với 2 tay, label hướng thẳng camera, biểu cảm tự nhiên — chuẩn shot UGC chính.',
      marketingGoal: 'Standard UGC packshot-with-hands — trust hơn ảnh studio thuần vì có "người thật" cầm.',
      suitableFor: ['Landing page', 'Social ads', 'Shopee main image', 'TikTok product showcase'],
    },
    badges: ['needs-product', 'needs-avatar'],
  },
  {
    id: 'ugc-selfie',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'Selfie cầm sản phẩm', en: 'UGC selfie' },
    description: { vi: 'Selfie smartphone cùng SP — vibe khách hàng thật', en: 'Selfie with product, TikTok vibe' },
    aspectRatio: '1:1',
    iconKey: 'userRound',
    tooltip: {
      what: 'Tạo ảnh selfie từ smartphone (góc cao hơi nghiêng), người cầm sản phẩm cạnh mặt, smile chân thực — không pose, không studio.',
      marketingGoal: 'Trông như khách hàng thật chụp + post — pass authentic check ngay cả khi audience nghi ngờ.',
      suitableFor: ['UGC ads', 'TikTok video frame', 'Story Instagram', 'Testimonial section'],
    },
    badges: ['needs-product', 'needs-avatar', 'tiktok'],
  },
  {
    id: 'ugc-tiktok',
    group: 'photographic',
    categoryId: 'ugc-real',
    title: { vi: 'POV camera điện thoại', en: 'POV phone camera' },
    description: { vi: 'Frame TikTok review, ring-light, vibe creator', en: 'TikTok review still, ring-light' },
    aspectRatio: '1:1',
    iconKey: 'video',
    tooltip: {
      what: 'Tạo frame "still" giống screenshot từ video TikTok review: ring-light reflection trong mắt, raw smartphone aesthetic, bedroom / vanity setup.',
      marketingGoal: 'Capitalize trên trend creator review — visual quen với audience TikTok, trust cao vì giống video viral đã từng xem.',
      suitableFor: ['TikTok ads', 'TikTok organic', 'Carousel slide', 'Story Instagram'],
    },
    badges: ['needs-product', 'needs-avatar', 'tiktok'],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────

export function findCatalogEntry(id: AssetTypeId): AssetCatalogEntry | null {
  return ASSET_CATALOG.find((e) => e.id === id) ?? null
}

/** List entries in a marketing category (NEW — replaces listCatalogByGroup
 *  in the picker UI; old fn kept below for any legacy consumer). */
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

// ── P13 — dynamic input requirements (preserved) ──────────────────────

export interface CreativeRequirements {
  requireProduct: boolean
  requireAvatar: boolean
  requireReference: boolean
}

const REQ_PHOTO_PERSON: CreativeRequirements = { requireProduct: true, requireAvatar: true,  requireReference: false }
const REQ_PHOTO_NO_PERSON: CreativeRequirements = { requireProduct: true, requireAvatar: false, requireReference: false }
const REQ_UI_NATIVE: CreativeRequirements = { requireProduct: true, requireAvatar: false, requireReference: false }
const REQ_DESIGNED: CreativeRequirements = { requireProduct: true, requireAvatar: false, requireReference: true }

const REQUIREMENTS: Partial<Record<AssetTypeId, CreativeRequirements>> = {
  'holding-product':    REQ_PHOTO_PERSON,
  'ugc-selfie':         REQ_PHOTO_PERSON,
  'before-after':       REQ_PHOTO_PERSON,
  'lifestyle-kitchen':  REQ_PHOTO_PERSON,
  'bathroom-routine':   REQ_PHOTO_PERSON,
  'cafe-lifestyle':     REQ_PHOTO_PERSON,
  'ugc-tiktok':         REQ_PHOTO_PERSON,
  'product-shot':       REQ_PHOTO_NO_PERSON,
  'review-table':       REQ_PHOTO_NO_PERSON,
  'whatsapp-proof':     REQ_UI_NATIVE,
  'messenger-chat':     REQ_UI_NATIVE,
  'shopee-feedback':    REQ_UI_NATIVE,
  'tiktok-feedback':    REQ_UI_NATIVE,
  'facebook-comment':   REQ_UI_NATIVE,
  'tiktok-comment':     REQ_UI_NATIVE,
  'infographic':        REQ_DESIGNED,
  'cta-banner':         REQ_DESIGNED,
}

const DEFAULT_REQ: CreativeRequirements = { requireProduct: true, requireAvatar: false, requireReference: false }

export function requirementsFor(id: AssetTypeId): CreativeRequirements {
  return REQUIREMENTS[id] ?? DEFAULT_REQ
}
