// ── Mode 3 — Caption thoại (P2c+) ────────────────────────────────────────────
// Render 1 PNG TRONG SUỐT full-frame 9:16 với câu thoại to, VÀNG + viền đen (kiểu
// TikTok viral: DAH / SEBAB / MAKANAN). Đặt ở lower-third. Ghép vào clip bằng ffmpeg
// (scale2ref → khớp mọi kích thước clip). Dùng canvas DOM nên render đúng dấu VN/MY.
// ─────────────────────────────────────────────────────────────────────────────

/** Render caption thoại → PNG bytes (full-frame 9:16). text = câu thoại (ngôn ngữ đích). */
export async function renderCaptionPng(text: string, w = 720, h = 1280): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không tạo được canvas caption')
  ctx.clearRect(0, 0, w, h)

  const clean = (text ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
  if (!clean) {
    const empty: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
    return new Uint8Array(await empty.arrayBuffer())
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxW = w * 0.86

  const wrap = (fs: number): string[] => {
    ctx.font = `900 ${fs}px Arial, "Segoe UI", sans-serif`
    const words = clean.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const word of words) {
      const t = cur ? `${cur} ${word}` : word
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = word }
      else cur = t
    }
    if (cur) lines.push(cur)
    return lines
  }

  // Font to (~8.5% bề ngang), tự thu nhỏ nếu thoại dài (≤3 dòng).
  let fontSize = Math.round(w * 0.085)
  let lines = wrap(fontSize)
  while (lines.length > 3 && fontSize > 28) { fontSize -= 4; lines = wrap(fontSize) }

  ctx.font = `900 ${fontSize}px Arial, "Segoe UI", sans-serif`
  const lineH = fontSize * 1.15
  const blockH = lines.length * lineH
  const cy = h * 0.74 - blockH / 2 + lineH / 2   // lower-third, né action-bar TikTok

  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = Math.max(6, fontSize * 0.18)
  ctx.fillStyle = '#FFE600'
  lines.forEach((ln, i) => {
    const y = cy + i * lineH
    ctx.strokeText(ln, w / 2, y)
    ctx.fillText(ln, w / 2, y)
  })

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}
