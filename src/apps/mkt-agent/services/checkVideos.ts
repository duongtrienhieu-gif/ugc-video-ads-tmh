// ── MKT Agent · Dò spy lúc quét — TikTok (đúng SP) + FB (đối thủ cùng ngách) ──
// TikTok: research-videos search bằng coreTerms(TÊN SP) + chấm liên quan → video
//   bán ĐÚNG SP (tải no-watermark, rip).
// FB: ad đối thủ ở MY viết TIẾNG MALAY → query bằng NGÁCH (Malay) chứ KHÔNG phải
//   coreTerms tiếng Anh (sẽ 0/drift). Ra nhiều ad COD cùng ngách, loại clinic.
// → reel cân bằng 2 nguồn; xếp SP có nhiều spy lên đầu. ~2 call/SP (free SC).
import type { SpCandidate, VideoCheck, VidItem } from '../store'

const TERM_STOP = new Set([
  'new', 'promo', 'sale', 'hot', 'big', 'free', 'buy', 'beli', 'murah', 'viral', 'original', 'ori', 'ready', 'stock',
  'pek', 'pcs', 'pc', 'pack', 'set', 'box', 'botol', 'bottle', 'tablet', 'tablets', 'kapsul', 'capsule', 'gummies', 'sachet',
  'untuk', 'dengan', 'dan', 'yang', 'the', 'for', 'and', 'plus', 'best', 'seller', 'halal', 'tiktok', 'shop', 'exclusive',
  'combo', 'bundle', 'isi', 'satu', 'dua', 'ml', 'gm', 'gram', 'mg', 'kg', 'official', 'store',
])
function coreTerms(title: string): string[] {
  const cleaned = title
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Za-z0-9À-ɏ ]+/g, ' ')
  const out: string[] = []
  for (const raw of cleaned.split(/\s+/)) {
    const low = raw.trim().toLowerCase()
    if (low.length < 3 || TERM_STOP.has(low) || /^\d+$/.test(low) || out.includes(low)) continue
    out.push(low)
    if (out.length >= 6) break
  }
  return out
}

// Advertiser KHÔNG phải đối thủ COD (phòng khám/nha/dịch vụ/nhà thuốc) → loại.
const NON_COD_RE = /klinik|dental|pergigi|dentist|\bclinic\b|hospital|farmasi|pharmacy|aesthetic|\bspa\b|salon|booking|appointment|temujanji/i
interface FbAd { id?: string; page?: string; cover?: string; videoUrl?: string; text?: string; daysRunning?: number }

// author (unique_id/nickname TikTok) ≈ seller (tên shop TikTok Shop)? → video của chính người bán
// = gần như chắc ĐÚNG SP. So thận trọng: chứa nhau, hoặc từ đặc trưng ≥4 ký tự của seller có trong author.
const SELLER_STOP = /official|store|\bshop\b|malaysia|\bmy\b|trading|enterprise|\bsdn\b|\bbhd\b|resources|beauty|global/
function sellerMatch(author: string, seller?: string): boolean {
  if (!author || !seller) return false
  const na = author.toLowerCase().replace(/[^a-z0-9]/g, '')
  const ns = seller.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (na.length < 3 || ns.length < 3) return false
  if (na.includes(ns) || ns.includes(na)) return true
  const words = seller.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !SELLER_STOP.test(w))
  return words.some((w) => na.includes(w))
}

export async function checkProductVideos(c: SpCandidate): Promise<VideoCheck> {
  const terms = coreTerms(c.title)
  const joined = terms.slice(0, 6).join(' ')
  const q = joined.length >= 4
    ? joined
    : (c.title.replace(/[【[(][^】\])]*[】\])]/g, ' ').split(/[|\-–—]/)[0] || c.title).trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' ')
  const termsParam = terms.join(',')

  // TikTok — video bán ĐÚNG SP (rip-ready). strict=1 → chỉ giữ video khớp thật (bớt drift).
  const tk: VidItem[] = []
  try {
    const r = await fetch(`/api/research-videos?market=MY&q=${encodeURIComponent(q)}&minSec=15&maxSec=90&strict=1${termsParam ? `&terms=${encodeURIComponent(termsParam)}` : ''}`)
    if (r.ok) {
      const j = (await r.json()) as { videos?: VidItem[] }
      for (const v of j.videos ?? []) tk.push({ ...v, platform: 'tiktok', authorMatch: sellerMatch(String(v.author || ''), c.seller) })
    }
  } catch { /* bỏ qua */ }
  // author≈seller (video chính người bán) lên trước, rồi tới view.
  tk.sort((a, b) => (Number(!!b.authorMatch) - Number(!!a.authorMatch)) || (Number(b.views) || 0) - (Number(a.views) || 0))

  // FB — ad ĐỐI THỦ CÙNG NGÁCH (query NGÁCH tiếng Malay; coreTerms EN không khớp ad Malay)
  const fbQ = (c.niche && c.niche.trim()) || terms[0] || q
  const fb: VidItem[] = []
  const seen = new Set<string>()
  try {
    const r = await fetch(`/api/fb-ads?q=${encodeURIComponent(fbQ)}&country=MY&status=ACTIVE`)
    if (r.ok) {
      const j = (await r.json()) as { ads?: FbAd[] }
      for (const a of j.ads ?? []) {
        const id = String(a.id ?? '')
        if (!a.videoUrl || !a.cover || !id || seen.has(id)) continue
        if (NON_COD_RE.test(`${a.page ?? ''} ${a.text ?? ''}`)) continue
        seen.add(id)
        fb.push({
          id: 'fb_' + id, platform: 'fb', cover: String(a.cover), downloadUrl: '', url: String(a.videoUrl),
          views: 0, desc: String(a.text || a.page || ''), author: String(a.page || ''), durationSec: 0, days: Number(a.daysRunning) || 0,
        })
      }
    }
  } catch { /* bỏ qua */ }
  fb.sort((a, b) => (b.days ?? 0) - (a.days ?? 0))

  const maxViews = tk.reduce((m, v) => Math.max(m, Number(v.views) || 0), 0)
  // Cân bằng 2 nguồn: TikTok đúng SP trước, FB đối thủ cùng ngách sau.
  const list = [...tk.slice(0, 10), ...fb.slice(0, 10)]
  return { count: list.length, maxViews, list }
}
