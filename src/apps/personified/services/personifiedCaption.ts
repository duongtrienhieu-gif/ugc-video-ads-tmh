// ── Mode 3 — Caption thoại KARAOKE (P2c+) ────────────────────────────────────
// Render PNG TRONG SUỐT full-frame 9:16 cho 1 "frame" caption: cả cụm chữ to vàng/
// trắng + viền đen (kiểu TikTok), TỪ ĐANG NÓI được tô VÀNG nổi (karaoke), từ khác
// trắng. activeIndex = -1 → tĩnh (cả cụm vàng). Vẽ ở lower-third. Dùng canvas DOM
// nên render đúng dấu VN/MY. Ghép vào clip ở bước lồng giọng (overlay theo enable-window).
// ─────────────────────────────────────────────────────────────────────────────

const YELLOW = '#FFE600'
const WHITE = '#FFFFFF'

/** Render 1 frame caption (full-frame 9:16) → PNG bytes.
 *  words: các từ của cụm; activeIndex: từ đang nói (-1 = tĩnh, tô vàng hết). */
export async function renderCaptionPng(
  words: string[], activeIndex = -1, w = 720, h = 1280,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không tạo được canvas caption')
  ctx.clearRect(0, 0, w, h)

  const toks = words.map((x) => x.trim().toUpperCase()).filter(Boolean)
  if (!toks.length) {
    const empty: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
    return new Uint8Array(await empty.arrayBuffer())
  }

  const maxW = w * 0.86
  const setFont = (fs: number) => { ctx.font = `900 ${fs}px Arial, "Segoe UI", sans-serif` }

  // Wrap thành dòng (≤3), tự thu nhỏ nếu dài.
  const wrap = (fs: number): string[][] => {
    setFont(fs)
    const lines: string[][] = []
    let cur: string[] = []
    let curW = 0
    const space = ctx.measureText(' ').width
    for (const t of toks) {
      const tw = ctx.measureText(t).width
      if (cur.length && curW + space + tw > maxW) { lines.push(cur); cur = [t]; curW = tw }
      else { if (cur.length) curW += space; cur.push(t); curW += tw }
    }
    if (cur.length) lines.push(cur)
    return lines
  }

  let fontSize = Math.round(w * 0.078)
  let lines = wrap(fontSize)
  while (lines.length > 3 && fontSize > 26) { fontSize -= 4; lines = wrap(fontSize) }

  setFont(fontSize)
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const lineH = fontSize * 1.18
  const space = ctx.measureText(' ').width
  const strokeW = Math.max(6, fontSize * 0.18)
  const blockH = lines.length * lineH
  const cy0 = h * 0.74 - blockH / 2 + lineH / 2

  // index từ chạy liên tục qua các dòng để biết từ nào active.
  let running = 0
  lines.forEach((line, li) => {
    const y = cy0 + li * lineH
    const lineW = line.reduce((s, t, i) => s + ctx.measureText(t).width + (i ? space : 0), 0)
    let x = (w - lineW) / 2
    for (const t of line) {
      const tw = ctx.measureText(t).width
      const active = running === activeIndex
      ctx.textAlign = 'left'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = strokeW
      ctx.strokeText(t, x, y)
      ctx.fillStyle = active || activeIndex < 0 ? YELLOW : WHITE
      ctx.fillText(t, x, y)
      x += tw + space
      running += 1
    }
  })

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}
