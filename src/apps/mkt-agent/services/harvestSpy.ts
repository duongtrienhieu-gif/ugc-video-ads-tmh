// ── MKT Agent · Harvest spy ĐÚNG SP (paid-only, đảm bảo đủ 5) ─────────────────
// Mô hình: ưu tiên ad TRẢ PHÍ của đối thủ. Để đủ 5 dù keyword nông:
//   1. lọc ảnh exact tập seed (từ Soi sâu)
//   2. ĐÀO HẾT ad của mỗi đối thủ đúng SP (FB pageId mode) — 1 seller thường
//      chạy 5-20 biến thể → dư 5 dễ. Lọc ảnh lại.
//   <5 → trả về hết (caller cảnh báo SP gần như không có đối thủ COD).
import type { SpyAd } from '../store'
import { filterExactSpy } from './matchSpy'

const NON_COD_RE = /klinik|dental|pergigi|dentist|\bclinic\b|hospital|farmasi|pharmacy|aesthetic|\bspa\b|salon|booking|appointment|temujanji/i

interface RawAd {
  id?: string; page?: string; pageId?: string; cover?: string
  videoUrl?: string; text?: string; daysRunning?: number; advertiserAds?: number
}
function mapAd(a: RawAd, platform: 'fb' | 'tiktok'): SpyAd {
  return {
    id: String(a.id ?? ''), platform,
    pageId: a.pageId ? String(a.pageId) : undefined,
    page: a.page ? String(a.page) : undefined,
    cover: String(a.cover ?? ''), videoUrl: String(a.videoUrl ?? ''),
    text: String(a.text ?? ''), days: Number(a.daysRunning) || 0, scale: Number(a.advertiserAds) || 0,
  }
}

export async function harvestExactSpy(
  apiKey: string,
  productImageUrl: string,
  seed: SpyAd[],
  target = 5,
): Promise<SpyAd[]> {
  const have = new Map<string, SpyAd>()
  const add = (ads: SpyAd[]) => { for (const a of ads) if (a.id && !have.has(a.id)) have.set(a.id, a) }

  // 1) Lọc ảnh exact tập seed.
  add(await filterExactSpy(apiKey, productImageUrl, seed))

  // 2) Đào hết ad của mỗi đối thủ FB đúng SP (cap 4 advertiser).
  if (have.size < target) {
    const pids = [...new Set([...have.values()].filter((a) => a.platform === 'fb' && a.pageId).map((a) => a.pageId as string))].slice(0, 4)
    for (const pid of pids) {
      if (have.size >= target) break
      try {
        const j = (await fetch(`/api/fb-ads?pageId=${encodeURIComponent(pid)}&country=MY&status=ACTIVE`).then((r) => r.json())) as { ads?: RawAd[] }
        const ads = (j.ads ?? [])
          .filter((a) => !NON_COD_RE.test(`${a.page ?? ''} ${a.text ?? ''}`))
          .map((a) => mapAd(a, 'fb'))
          .filter((a) => a.id && a.cover && a.videoUrl && !have.has(a.id))
        if (ads.length) add(await filterExactSpy(apiKey, productImageUrl, ads))
      } catch { /* advertiser lỗi → bỏ qua */ }
    }
  }

  // Winner trước: chạy lâu + scale.
  return [...have.values()].sort((x, y) => (y.days - x.days) || (y.scale - x.scale))
}
