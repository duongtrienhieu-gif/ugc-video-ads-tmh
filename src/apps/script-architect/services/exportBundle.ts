// ── B5 / Phase C — export a CapCut-ready bundle (Hướng A: no server trim) ─────
// Packs every picked source clip + the AI-rendered CTA video into one ZIP the
// operator drops into CapCut and edits by hand. Per the agreed design:
//   • Clips ship FULL-LENGTH. A picked in/out window is written into the filename
//     and cutlist as a CUT HINT only ("cut_12.0-17.0s") — so the operator jumps
//     straight to the right 4-5s instead of scrubbing a 40-50s spy clip.
//   • A scene can carry several clips ("bung cả") — they're numbered 01a/01b/01c
//     so CapCut auto-sorts them next to each other.
//   • Subtitles are 1 block PER SCENE (one spoken line per beat), MY + VN files.
//   • cutlist.csv is the operator's editing guide (scene, timing, cut window,
//     "cần thay" flag, dialogue).
// Clips are fetched at export time through /api/dl-video (the same proxy B3 uses)
// to dodge CORS + expiring source URLs.

import JSZip from 'jszip'
import type { ShotPlan, ShotBlock } from '../types'
import type { Product } from '../../../stores/types'
import { trimVideo } from './trimClip'

const proxyUrl = (url: string) => `/api/dl-video?url=${encodeURIComponent(url)}`

export interface ExportProgress {
  done: number
  total: number
  label: string
}

// Hướng B — cắt thật bằng ffmpeg.wasm khi export.
//   'none'     : Hướng A cũ — clip ship full, chỉ ghi mốc cắt vào tên + cutlist.
//   'fast'     : cắt -c copy (nhanh, lệch ~1-2s theo keyframe).
//   'accurate' : re-encode đúng frame (chậm hơn, output ngắn nên vẫn nhanh).
// Chỉ cắt những clip ĐÃ chấm điểm cắt (inSec); clip chưa chấm vẫn ship full.
export type ExportCutMode = 'none' | 'fast' | 'accurate'

const BLOCK_VI: Record<ShotBlock, string> = {
  'van-de': 'Vấn đề',
  'noi-dau': 'Nỗi đau',
  'san-pham': 'Sản phẩm',
  'loi-ich-sp': 'Lợi ích SP',
  'thanh-phan': 'Thành phần',
  'co-che': 'Cơ chế',
  'loi-ich-kh': '★ Lợi ích KH',
  'proof': 'Proof',
  'cta': 'CTA',
}
const PLAT_VI: Record<string, string> = { xhs: 'RED', kuaishou: 'Kuaishou', douyin: 'Douyin', ai: 'AI render' }
const platVi = (p: string) => PLAT_VI[p] ?? p

const pad2 = (n: number) => String(n).padStart(2, '0')
const letter = (i: number) => String.fromCharCode(97 + i) // a, b, c, …

/** SRT timestamp: HH:MM:SS,mmm */
const srtTime = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  const milli = ms % 1000
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)},${String(milli).padStart(3, '0')}`
}

const slug = (s: string, n = 24) =>
  (s || '').replace(/[^\w一-鿿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n) || 'x'

/** CSV cell — quote when it contains a comma/quote/newline. */
const csv = (v: string | number) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

interface FetchJob {
  url: string
  /** Path inside the zip, e.g. clips/01a_loi-ich-sp__xhs__cut_12.0-17.0s.mp4 */
  path: string
  label: string
  /** Hướng B — nếu set, cắt thật khúc này sau khi tải (chỉ clip đã chấm điểm). */
  trim?: { inSec: number; durSec: number }
}

/**
 * Build + download the CapCut bundle for a shot plan. Resolves when the ZIP has
 * been handed to the browser's download. Reports progress via onProgress.
 */
export async function exportCapcutBundle(
  plan: ShotPlan,
  product: Product | null,
  onProgress?: (p: ExportProgress) => void,
  cutMode: ExportCutMode = 'none',
): Promise<void> {
  const zip = new JSZip()

  const jobs: FetchJob[] = []
  const srtMy: string[] = []
  const srtVi: string[] = []
  const cutRows: string[] = [
    ['STT', 'Cảnh', 'Bắt đầu (s)', 'Dài (s)', 'File', 'Nền tảng', 'Cắt từ (s)', 'Cắt đến (s)', 'Cần thay', 'Thoại MY', 'Thoại VN']
      .map(csv).join(','),
  ]

  let cumT = 0
  plan.shots.forEach((shot, idx) => {
    const order = pad2(idx + 1)
    const start = cumT
    const dur = shot.durationSec || 0
    cumT += dur

    // Subtitles — one block per scene (the spoken line), both languages.
    const block = `${idx + 1}\n${srtTime(start)} --> ${srtTime(start + dur)}`
    srtMy.push(`${block}\n${(shot.my || '').trim()}\n`)
    srtVi.push(`${block}\n${(shot.vi || '').trim()}\n`)

    // CTA shot — uses the AI-rendered video (B4), not a source clip.
    if (shot.fill === 'ai-render') {
      const v = shot.ctaRender?.videoUrl
      const fn = `${order}_cta__ai-render.mp4`
      if (v) jobs.push({ url: v, path: `clips/${fn}`, label: `CTA (cảnh ${idx + 1})` })
      cutRows.push([
        order, 'CTA (AI render)', start.toFixed(1), dur.toFixed(1),
        v ? fn : '(chưa render video CTA)', 'AI render', '', '', '', shot.my, shot.vi,
      ].map(csv).join(','))
      return
    }

    // Source shots — every picked clip ships; main first, then backups.
    const clips = [...(shot.clips ?? [])].sort((a, b) => (a.role === 'main' ? 0 : 1) - (b.role === 'main' ? 0 : 1))
    if (clips.length === 0) {
      cutRows.push([
        order, BLOCK_VI[shot.block], start.toFixed(1), dur.toFixed(1),
        '(chưa chọn clip)', '', '', '', '', shot.my, shot.vi,
      ].map(csv).join(','))
      return
    }
    clips.forEach((c, ci) => {
      const hasCut = c.inSec != null
      const inS = c.inSec ?? 0
      const outS = c.outSec ?? (hasCut ? inS + dur : dur)
      // Hướng B: cắt thật những clip ĐÃ chấm điểm cắt; còn lại giữ full như cũ.
      const willCut = cutMode !== 'none' && hasCut
      const cutTag = hasCut ? `__${willCut ? 'dacat' : 'cut'}_${inS.toFixed(1)}-${outS.toFixed(1)}s` : ''
      const fn = `${order}${letter(ci)}_${shot.block}__${c.platform}${cutTag}.mp4`
      jobs.push({
        url: c.videoUrl,
        path: `clips/${fn}`,
        label: `Cảnh ${idx + 1} · clip ${ci + 1}`,
        trim: willCut ? { inSec: inS, durSec: Math.max(0.5, outS - inS) } : undefined,
      })
      cutRows.push([
        `${order}${letter(ci)}`,
        `${BLOCK_VI[shot.block]}${c.role === 'backup' ? ' (dự phòng)' : ''}`,
        start.toFixed(1), dur.toFixed(1),
        fn, platVi(c.platform),
        hasCut ? inS.toFixed(1) : '',
        hasCut ? outS.toFixed(1) : '',
        c.needsReplace ? 'CẦN THAY' : '',
        ci === 0 ? shot.my : '', // dialogue shown once per scene
        ci === 0 ? shot.vi : '',
      ].map(csv).join(','))
    })
  })

  // Fetch every clip sequentially (gentler on the proxy). A failure is recorded
  // as a small .LOI.txt note inside the zip instead of aborting the whole export.
  const total = jobs.length
  let done = 0
  onProgress?.({ done, total, label: total ? 'Bắt đầu tải clip…' : 'Không có clip để tải' })
  for (const job of jobs) {
    onProgress?.({ done, total, label: `Đang tải ${job.label}…` })
    try {
      const res = await fetch(proxyUrl(job.url))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      let blob = await res.blob()
      // Hướng B — cắt thật khúc đã chấm điểm. Lỗi codec → giữ clip gốc + ghi chú.
      if (job.trim && cutMode !== 'none') {
        onProgress?.({ done, total, label: `Đang cắt ${job.label}…` })
        const r = await trimVideo(blob, job.trim.inSec, job.trim.durSec, cutMode)
        if (r.blob) blob = r.blob
        else zip.file(
          `${job.path}.CATLOI.txt`,
          `Cắt tự động thất bại (${r.error ?? '?'}).\nFile kèm là CLIP GỐC ĐẦY ĐỦ — bạn tự cắt khúc ${job.trim.inSec.toFixed(1)}s → ${(job.trim.inSec + job.trim.durSec).toFixed(1)}s trong CapCut.`,
        )
      }
      zip.file(job.path, blob)
    } catch (e) {
      zip.file(`${job.path}.LOI.txt`, `Tải clip thất bại: ${e instanceof Error ? e.message : String(e)}\nURL gốc: ${job.url}\n\nClip nguồn có thể đã hết hạn — mở lại app, tìm/chọn clip mới rồi export lại.`)
    }
    done++
    onProgress?.({ done, total, label: `Đã tải ${done}/${total} clip` })
  }

  // Text assets.
  zip.file('subtitles_my.srt', srtMy.join('\n'))
  zip.file('subtitles_vi.srt', srtVi.join('\n'))
  zip.file('cutlist.csv', '﻿' + cutRows.join('\n')) // BOM → Excel reads UTF-8
  zip.file('HUONG_DAN.txt', buildReadme(plan, product, cutMode))

  onProgress?.({ done, total, label: 'Đang nén ZIP…' })
  const blob = await zip.generateAsync({ type: 'blob' })

  const name = `capcut_${slug(product?.productName ?? 'kich-ban')}_${plan.shots.length}canh.zip`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  onProgress?.({ done, total, label: 'Xong! Đã tải ZIP về máy.' })
}

function buildReadme(plan: ShotPlan, product: Product | null, cutMode: ExportCutMode): string {
  const cut = cutMode !== 'none'
  return [
    `BỘ DỰNG CAPCUT — ${product?.productName ?? 'Kịch bản UGC'}`,
    `Số cảnh: ${plan.shots.length} · Tổng thời lượng thoại: ~${Math.round(plan.totalDurationSec)}s · Ngôn ngữ chính: ${plan.language === 'my' ? 'MY' : 'VN'}`,
    cut ? `Chế độ cắt: ĐÃ CẮT SẴN bằng máy (${cutMode === 'fast' ? 'nhanh — gần đúng' : 'chuẩn — đúng frame'})` : `Chế độ cắt: KHÔNG (clip full, cắt tay trong CapCut)`,
    ``,
    `── TRONG GÓI CÓ GÌ ──`,
    `• clips/      : các clip nguồn + video CTA, đặt tên theo thứ tự (01, 02, 03…).`,
    `              Cùng 1 cảnh có nhiều clip thì đánh 01a, 01b, 01c (chính trước, dự phòng sau).`,
    `• cutlist.csv : bảng dựng — mỗi dòng 1 clip: cảnh, mốc thời gian, KHÚC CẦN CẮT, cờ "cần thay", thoại.`,
    `• subtitles_my.srt / subtitles_vi.srt : phụ đề, mỗi cảnh 1 dòng (theo lời thoại).`,
    ``,
    `── CÁCH DỰNG TRONG CAPCUT ──`,
    `1. Tạo project mới (dọc 9:16).`,
    `2. Kéo cả thư mục clips/ vào — CapCut tự xếp theo số 01 → 02 → 03…`,
    cut
      ? `3. CLIP CÓ TÊN "dacat_X-Ys" ĐÃ ĐƯỢC CẮT SẴN đúng khúc ~4-5s — kéo vào dùng luôn, khỏi cắt.`
      : `3. CLIP NGUỒN LÀ FILE ĐẦY ĐỦ (có thể dài 40-50s). Mở cutlist.csv xem cột "Cắt từ → Cắt đến":`,
    cut
      ? `   Clip CHƯA chấm điểm cắt (tên "cut_" hoặc không có mốc) vẫn là file FULL — tự cắt theo cutlist.`
      : `   đó là khúc ~4-5s bạn đã chọn trong app. Cắt đúng khúc đó (đã chừa sẵn vài giây để bạn nhích).`,
    cut
      ? `   Nếu thấy file kèm ".CATLOI.txt": clip đó cắt máy lỗi → file là bản GỐC, tự cắt theo ghi chú.`
      : `   Tên file cũng ghi sẵn mốc, ví dụ: 04a_loi-ich-sp__xhs__cut_12.0-17.0s.mp4`,
    `4. Cảnh nào có 01b/01c là clip DỰ PHÒNG cho cùng ý hình — chọn cái ưng, xóa cái thừa.`,
    `5. Dòng nào ghi "CẦN THAY" ở cutlist là clip pick tạm — nên tìm clip tốt hơn thay vào.`,
    `6. Import subtitles_my.srt (hoặc _vi) làm phụ đề. Chỉnh lại cho khớp khi đã cắt xong hình.`,
    `7. Thu/ghép voice theo thoại trong cutlist (app chưa kèm file giọng đọc).`,
    ``,
    `Lưu ý: clip lấy từ nền tảng nguồn chỉ để tham khảo/ghép dựng — tự chịu trách nhiệm bản quyền khi dùng.`,
  ].join('\n')
}
