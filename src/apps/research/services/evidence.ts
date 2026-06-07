// Research module — sinh "bằng chứng" (video/creator/cross-market) cho 1 sản phẩm.
// P1: deterministic generator từ data mẫu (ổn định, không nhảy số mỗi lần mở).
// Khi nối Kalodata thật → thay bằng query research_videos / research_creators / cross-market.
import type { Market, NicheKey, ResearchProduct } from '../types'

export interface SampleVideo {
  id: string; caption: string; handle: string
  views: number; gmv: number; adRoas: number; durationSec: number
}
export interface SampleCreator {
  id: string; handle: string; nickname: string
  followers: number; gmv: number; engagementPct: number
}
export interface CrossMarketRow {
  market: Market; revenue: number; growthRate: number; shops: number; isCurrent: boolean
}

function seedFrom(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mkRng(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function rngFor(s: string) { return mkRng(seedFrom(s)) }

const HOOK_POOL = [
  'Before/after sau 7 ngày', 'Demo dùng thử tại nhà', 'Review thật không quảng cáo',
  'Mở hộp + test ngay', 'Tại sao nhà nào cũng nên có', 'Mẹo dùng cực hay',
  'So sánh với hàng ngoài chợ', 'Khách phản hồi sau 1 tuần',
]
const NAME_POOL = ['mira', 'aisyah', 'jenn', 'farah', 'kelvin', 'nadia', 'haziq', 'yanti', 'syafiq', 'lina']

export function getVideosFor(p: ResearchProduct): SampleVideo[] {
  const rng = mkRng(seedFrom(p.productId + 'v'))
  const count = Math.min(5, Math.max(2, Math.round(p.creatorNum / 2)))
  const totalGmv = p.videoRevenue ?? p.revenue * 0.6
  const out: SampleVideo[] = []
  let remaining = totalGmv
  for (let i = 0; i < count; i++) {
    const share = i === count - 1 ? remaining : totalGmv * Math.max(0.1, 0.42 - i * 0.07) * (0.8 + rng() * 0.4)
    const gmv = Math.max(300, Math.round(share))
    remaining = Math.max(0, remaining - gmv)
    out.push({
      id: `${p.productId}-v${i}`,
      caption: HOOK_POOL[Math.floor(rng() * HOOK_POOL.length)],
      handle: '@' + NAME_POOL[Math.floor(rng() * NAME_POOL.length)] + Math.floor(rng() * 90 + 10),
      views: Math.round(gmv * (40 + rng() * 140)),
      gmv,
      adRoas: Math.round((1.5 + rng() * 3) * 10) / 10,
      durationSec: Math.floor(12 + rng() * 46),
    })
  }
  return out.sort((a, b) => b.gmv - a.gmv)
}

export function getCreatorsFor(p: ResearchProduct): SampleCreator[] {
  const rng = mkRng(seedFrom(p.productId + 'c'))
  const count = Math.min(5, Math.max(1, p.creatorNum))
  const out: SampleCreator[] = []
  for (let i = 0; i < count; i++) {
    const name = NAME_POOL[Math.floor(rng() * NAME_POOL.length)]
    out.push({
      id: `${p.productId}-c${i}`,
      handle: '@' + name + Math.floor(rng() * 900 + 100),
      nickname: name.charAt(0).toUpperCase() + name.slice(1),
      followers: Math.round((5 + rng() * 280) * 1000),
      gmv: Math.round((p.revenue / count) * (0.5 + rng())),
      engagementPct: Math.round((2 + rng() * 8) * 10) / 10,
    })
  }
  return out.sort((a, b) => b.gmv - a.gmv)
}

export function getCrossMarketFor(p: ResearchProduct): CrossMarketRow[] {
  const rng = mkRng(seedFrom(p.productId + 'x'))
  const rows: CrossMarketRow[] = [
    { market: p.market, revenue: p.revenue, growthRate: p.growthRate, shops: p.competitionShops, isCurrent: true },
  ]
  const hot = (p.hotIn ?? []).filter((m) => m !== p.market)
  for (const m of hot) {
    rows.push({
      market: m,
      revenue: Math.round(p.revenue * (1.3 + rng() * 1.6)),
      growthRate: Math.round(p.growthRate * (1.3 + rng() * 0.9)),
      shops: Math.round(p.competitionShops * (2 + rng() * 3)),
      isCurrent: false,
    })
  }
  const all: Market[] = ['MY', 'TH', 'ID', 'VN']
  for (const m of all) {
    if (rows.find((r) => r.market === m)) continue
    rows.push({
      market: m,
      revenue: Math.round(p.revenue * (0.15 + rng() * 0.5)),
      growthRate: Math.round(-15 + rng() * 45),
      shops: Math.round(p.competitionShops * (0.4 + rng())),
      isCurrent: false,
    })
  }
  return rows
}

// ── AI phân tích "video win" (demo: bản mẫu theo loại hook;
//    data thật: cho Gemini xem video thật để mổ xẻ) ──
export interface VideoAnalysis {
  hookType: string
  sections: { label: string; text: string }[]
}

const ANALYSIS_TEMPLATES: { match: RegExp; hookType: string; structure: string; why: string; replicate: string }[] = [
  { match: /before|after|7 ngày/i, hookType: 'Before / After',
    structure: 'Cảnh "trước" (vấn đề) → dùng sản phẩm → cảnh "sau" (kết quả) trong 1 mạch liền.',
    why: 'Bằng chứng trực quan — khách tin vì THẤY kết quả, không cần lời quảng cáo.',
    replicate: 'Quay "before" thật (xấu/đau), "after" rõ ràng, gắn mốc thời gian. Hook = cảnh before ngay giây 1.' },
  { match: /review thật|không quảng cáo/i, hookType: 'Review chân thật',
    structure: 'Tự nhận "không được trả tiền" → dùng thật → nhận xét cả ưu lẫn nhược → chốt vẫn đáng mua.',
    why: 'Xây niềm tin bằng sự "thật" — chê 1 chút khiến lời khen đáng tin hơn.',
    replicate: 'Cho creator nói giọng thật, quay tay cầm, nêu 1 nhược điểm nhỏ rồi vẫn recommend.' },
  { match: /mở hộp|unbox/i, hookType: 'Mở hộp',
    structure: 'Bóc hộp → phản ứng bất ngờ → demo nhanh tính năng nổi bật.',
    why: 'Tò mò "bên trong có gì" giữ người xem; phản ứng thật tạo cảm xúc.',
    replicate: 'Quay cận cảnh lúc bóc, biểu cảm thật, lộ ngay điểm "wow" trong 5s đầu.' },
  { match: /tại sao|nên có/i, hookType: 'Giáo dục / Vì sao',
    structure: 'Đặt câu hỏi/nỗi đau → giải thích vì sao cần → sản phẩm là lời giải.',
    why: 'Cho người xem "lý do" trước khi bán → giảm phản kháng, tăng tin.',
    replicate: 'Mở bằng câu hỏi giật ("Tại sao nhà bạn vẫn...?"), 1 lý do rõ ràng, rồi mới ra sản phẩm.' },
  { match: /mẹo|cực hay/i, hookType: 'Mẹo hay',
    structure: 'Tip hữu ích → sản phẩm xuất hiện như công cụ làm tip đó dễ hơn.',
    why: 'Giá trị trước, bán sau — người xem lưu/chia sẻ vì hữu ích.',
    replicate: 'Dạy 1 mẹo nhanh gọn, sản phẩm chỉ là "trợ thủ", không hard-sell.' },
  { match: /so sánh|hàng ngoài chợ/i, hookType: 'So sánh',
    structure: 'Đặt sản phẩm cạnh hàng thường → demo khác biệt rõ → kết luận đáng tiền hơn.',
    why: 'Khác biệt nhìn thấy được → biện minh cho việc chi tiền.',
    replicate: 'Quay side-by-side cùng điều kiện, để khác biệt tự nói, đừng nói quá.' },
  { match: /khách phản hồi|sau 1 tuần/i, hookType: 'Lời chứng thực',
    structure: 'Trích phản hồi khách thật → minh hoạ kết quả → kêu gọi thử.',
    why: 'Social proof — người khác dùng tốt thì mình cũng muốn thử.',
    replicate: 'Dùng tin nhắn/đánh giá thật (che tên), kèm cảnh dùng, giọng tự nhiên.' },
]

export function analyzeVideo(caption: string): VideoAnalysis {
  const t = ANALYSIS_TEMPLATES.find((x) => x.match.test(caption)) ?? {
    hookType: 'Demo dùng thử', structure: 'Bắt tay dùng ngay → cho thấy hiệu quả tức thì.',
    why: 'Thấy là tin — demo trực tiếp thuyết phục hơn lời nói.',
    replicate: 'Vào thẳng cảnh dùng trong 3s đầu, làm bật hiệu quả rõ nhất.',
  }
  return {
    hookType: t.hookType,
    sections: [
      { label: 'Loại hook', text: t.hookType },
      { label: 'Cấu trúc video', text: t.structure },
      { label: 'Vì sao thắng', text: t.why },
      { label: 'Cách bắt chước (brief creator)', text: t.replicate },
    ],
  }
}

// ── format helpers ──
export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'tr'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(Math.round(n))
}
export function formatKMyr(n: number): string {
  if (n >= 1000) return 'RM' + (n / 1000).toFixed(1) + 'k'
  return 'RM' + Math.round(n)
}

// ── Shop đối thủ trong ngách (spy) ──
export interface CompetitorShop {
  id: string; name: string; nicheKey: NicheKey; market: Market
  revenue: number; growthRate: number; productCount: number; sellerType: string
}

const SHOP_PREFIX = ['MY', 'Top', 'Royal', 'Prime', 'Daily', 'Smart', 'Pro', 'Mega', 'Lumi', 'Nova', 'Glow', 'Urban']
const SHOP_SUFFIX = ['Store', 'Mart', 'Official', 'Shop', 'House', 'Hub', 'Care', 'Lab', 'Mall', 'Co']
const SELLER_TYPES = ['Thương hiệu', 'Nhà bán lẻ', 'Tự vận hành']

export function getShops(market: Market, niches: NicheKey[]): CompetitorShop[] {
  const out: CompetitorShop[] = []
  for (const nk of niches) {
    const r = rngFor(market + nk + 'shops')
    const count = 4 + Math.floor(r() * 4)
    for (let i = 0; i < count; i++) {
      const pre = SHOP_PREFIX[Math.floor(r() * SHOP_PREFIX.length)]
      const suf = SHOP_SUFFIX[Math.floor(r() * SHOP_SUFFIX.length)]
      out.push({
        id: `${market}-${nk}-shop${i}`,
        name: `${pre} ${suf}`,
        nicheKey: nk,
        market,
        revenue: Math.round((8 + r() * 90) * 1000),
        growthRate: Math.round(-20 + r() * 220),
        productCount: 5 + Math.floor(r() * 60),
        sellerType: SELLER_TYPES[Math.floor(r() * SELLER_TYPES.length)],
      })
    }
  }
  return out.sort((a, b) => b.revenue - a.revenue)
}

export function kalodataShopUrl(shopId: string, market: Market): string {
  const cur: Record<Market, string> = { MY: 'MYR', TH: 'THB', ID: 'IDR', VN: 'VND' }
  return `https://www.kalodata.com/shop/detail?id=${encodeURIComponent(shopId)}&language=vi-VN&currency=${cur[market]}&region=${market}`
}
