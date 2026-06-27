// ── Vercel serverless — proxy TẢI video ad về máy (ép download + đặt tên) ──
// Link CDN FB/TikTok là cross-origin → <a download> bị bỏ qua (mở tab). Proxy này
// tải server-side rồi trả lại với Content-Disposition: attachment → trình duyệt tải thật.
// Dùng cho nút "Tải video" + "Tải hàng loạt" của Spy Ads.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = typeof req.query.url === 'string' ? req.query.url : ''
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Thiếu url hợp lệ' })
  const rawName = typeof req.query.name === 'string' ? req.query.name : 'ad.mp4'
  const name = rawName.replace(/[^\w.\-]+/g, '-').slice(0, 80) || 'ad.mp4'

  // Referer theo nguồn — Douyin/TikTok/CN CDN chặn hotlink nếu thiếu.
  const host = url.toLowerCase()
  const referer = /1688|alicdn|taobao|tmall|tbcdn|mmstat|cloud\.video/.test(host)
    ? 'https://www.1688.com/'
    : /douyin|amemv|bytecdn|douyinpic|zjcdn|kuaishou|kwimg|xhscdn|xiaohongshu/.test(host)
      ? 'https://www.douyin.com/'
      : /tiktok|tiktokcdn|ttwstatic|muscdn/.test(host)
        ? 'https://www.tiktok.com/'
        : 'https://www.facebook.com/'

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: referer } })
    if (!r.ok) return res.status(502).json({ error: `Nguồn video lỗi ${r.status}` })
    const buf = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', r.headers.get('content-type') || 'video/mp4')
    res.setHeader('Content-Length', String(buf.length))
    res.setHeader('Content-Disposition', `attachment; filename="${/\.\w{2,4}$/.test(name) ? name : name + '.mp4'}"`)
    res.setHeader('Cache-Control', 'private, max-age=600')
    return res.status(200).send(buf)
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
