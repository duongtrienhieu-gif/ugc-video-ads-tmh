// ── MKT Agent · Lọc spy CHÍNH XÁC sản phẩm ───────────────────────────────────
// Yêu cầu gốc: video spy phải ĐÚNG SP đó (không drift sang SP khác cùng ngách),
// có video thật. So ẢNH SP vs cover từng ad qua /api/gemini-upload?action=matchads
// (server fetch cover né CORS + Gemini vision batch ≤8). Giữ match ≥75.
import type { SpyAd } from '../store'

export async function filterExactSpy(
  apiKey: string,
  productImageUrl: string,
  ads: SpyAd[],
): Promise<SpyAd[]> {
  const withCover = ads.filter((a) => a.cover && a.videoUrl)
  const out: SpyAd[] = []
  const CHUNK = 8
  for (let i = 0; i < withCover.length; i += CHUNK) {
    const batch = withCover.slice(i, i + CHUNK)
    try {
      const r = await fetch('/api/gemini-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'matchads',
          apiKey,
          productImageUrl,
          covers: batch.map((a) => ({ id: a.id, url: a.cover })),
        }),
      })
      if (!r.ok) continue
      const j = (await r.json()) as { matches?: { id: string; match: boolean; score: number }[] }
      const map = new Map((j.matches ?? []).map((m) => [m.id, m]))
      for (const a of batch) {
        const m = map.get(a.id)
        if (m && m.match && m.score >= 75) out.push({ ...a, match: true, score: m.score })
      }
    } catch { /* batch lỗi → bỏ batch, không vỡ */ }
  }
  // top theo ad chạy lâu + scale (winner trước)
  return out.sort((x, y) => (y.days - x.days) || (y.scale - x.scale))
}
