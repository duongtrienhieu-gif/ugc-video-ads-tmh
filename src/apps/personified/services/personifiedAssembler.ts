// ── Mode 3 — Personified ASSEMBLER (P2d) ─────────────────────────────────────
// Ghép các clip cảnh (đã render) thành 1 video dọc 9:16, UPSCALE 480p→720p khi ghép.
// Khác hybrid (mode-1): GIỮ audio RIÊNG từng clip (clip lipsync đã có tiếng nhân vật);
// clip CÂM (i2v không thoại) được chèn 1 track audio im để concat đồng nhất stream.
// Memory-safe: normalize mỗi clip ra 1 đoạn MPEG-TS rồi nối bằng concat DEMUXER
// (stream-copy, không decode lại) → gần như không tốn RAM, chạy được 720p trong wasm.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from '../../video-builder/v3/services/ffmpegLoader'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'

export interface PersonifiedAssembleClip {
  /** Clip cuối cùng của cảnh (lipsyncRef nếu có, không thì clipRef i2v câm). */
  videoRef: string
  /** Độ dài slot (giây) — dùng cho track audio im của clip câm. */
  durationSec: number
  /** Clip có sẵn tiếng (đã lipsync) → giữ audio; false → chèn audio im. */
  hasAudio: boolean
}

export interface PersonifiedAssembleParams {
  /** Clip theo ĐÚNG thứ tự cảnh. Cảnh chưa render nên bỏ khỏi danh sách (caller lọc). */
  clips: PersonifiedAssembleClip[]
  /** Độ phân giải XUẤT (upscale khi ghép). Mặc định 720p. */
  resolution?: '720p' | '1080p'
  onStage?: (msg: string) => void
  onProgress?: (ratio: number) => void
}

export interface PersonifiedAssembleResult {
  videoRef: string
  /** Index clip không tải/encode được (đã bỏ qua). */
  failedIdx: number[]
  encodeMs: number
}

function nowMs(): number {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : 0
}

/** Ghép + upscale các clip cảnh → 1 video 9:16. Throw nếu không clip nào dùng được. */
export async function assemblePersonifiedVideo(
  params: PersonifiedAssembleParams,
): Promise<PersonifiedAssembleResult> {
  if (!params.clips.length) throw new Error('Chưa có clip nào để ghép')
  const t0 = nowMs()
  const outH = params.resolution === '1080p' ? 1080 : 720
  const evenH = outH % 2 === 0 ? outH : outH + 1
  const rawW = Math.round((outH * 9) / 16)        // 9:16 dọc (TikTok)
  const evenW = rawW % 2 === 0 ? rawW : rawW + 1

  params.onStage?.('Đang nạp ffmpeg…')
  const ffmpeg = await getFFmpeg({
    onLog: (msg) => { if (msg.length > 4 && !msg.startsWith('frame=')) console.log('[FFMPEG]', msg) },
  })

  const crf = params.resolution === '1080p' ? '19' : '20'
  const preset = 'veryfast'
  // PAD-FIT 9:16 nền BLUR (KHÔNG crop → không cắt rìa/caption). Clip 2:3 (cảnh câm) fit
  // nguyên vào giữa, nền là bản blur phóng to. Clip đã 9:16 (cảnh có giọng) → fit khít.
  const vf = `split=2[a][b];[a]scale=${evenW}:${evenH}:force_original_aspect_ratio=increase,crop=${evenW}:${evenH},boxblur=24:4[bg];[b]scale=${evenW}:${evenH}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`

  const normFiles: string[] = []
  const failedIdx: number[] = []

  // ── STAGE 1: normalize từng clip → đoạn MPEG-TS (video 720p + audio aac đồng nhất) ──
  for (let i = 0; i < params.clips.length; i++) {
    const c = params.clips[i]
    params.onStage?.(`Chuẩn hoá cảnh ${i + 1}/${params.clips.length}…`)
    params.onProgress?.((i / Math.max(1, params.clips.length)) * 0.9)

    const url = isAssetRef(c.videoRef) ? await getUrl(c.videoRef) : c.videoRef
    if (!url) { console.warn(`[PERS_ASM] cảnh ${i} thiếu videoRef — bỏ qua`); failedIdx.push(i); continue }

    let bytes: Uint8Array
    try { bytes = await fetchFile(url) }
    catch (err) { console.warn(`[PERS_ASM] cảnh ${i} fetch lỗi — bỏ qua`, err); failedIdx.push(i); continue }
    if (!bytes || bytes.byteLength < 512) {
      console.warn(`[PERS_ASM] cảnh ${i} dữ liệu rỗng/hỏng (${bytes?.byteLength ?? 0}B — URL hết hạn?) — bỏ qua`)
      failedIdx.push(i); continue
    }

    const inFile = `pin_${i}.mp4`
    const normFile = `pnorm_${i}.ts`
    const dur = Math.max(0.3, c.durationSec || 4)
    try {
      await ffmpeg.writeFile(inFile, bytes)
      const common = [
        '-vf', vf, '-r', '30',
        '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-ar', '44100', '-ac', '2',
        '-f', 'mpegts', '-y', normFile,
      ]
      if (c.hasAudio) {
        // Giữ tiếng của clip (đã lipsync).
        await ffmpeg.exec(['-i', inFile, ...common])
      } else {
        // Clip câm → chèn 1 track audio im đúng độ dài để concat đồng nhất stream.
        await ffmpeg.exec([
          '-i', inFile,
          '-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo',
          '-map', '0:v:0', '-map', '1:a:0', '-shortest',
          ...common,
        ])
      }
    } catch (err) {
      console.warn(`[PERS_ASM] cảnh ${i} encode lỗi — bỏ qua`, err)
      failedIdx.push(i)
      await ffmpeg.deleteFile(inFile).catch(() => {})
      continue
    }
    normFiles.push(normFile)
    await ffmpeg.deleteFile(inFile).catch(() => {})
  }

  if (!normFiles.length) throw new Error('Không clip nào ghép được (tất cả lỗi/hết hạn URL)')

  // ── STAGE 2: nối các đoạn TS bằng concat demuxer (stream-copy) ──────────────
  params.onStage?.('Đang nối video…')
  params.onProgress?.(0.92)
  const listFile = 'pconcat.txt'
  await ffmpeg.writeFile(listFile, new TextEncoder().encode(normFiles.map((f) => `file '${f}'`).join('\n')))
  const outFile = 'pfinal.mp4'
  await ffmpeg.exec([
    '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c', 'copy', '-movflags', '+faststart', '-y', outFile,
  ])

  const out = await ffmpeg.readFile(outFile)
  const src = typeof out === 'string' ? new TextEncoder().encode(out) : out
  // Copy sang ArrayBuffer phẳng — out.buffer có thể là SharedArrayBuffer (wasm cross-origin-isolated).
  const outBytes = new Uint8Array(src.byteLength)
  outBytes.set(src)
  const blob = new Blob([outBytes], { type: 'video/mp4' })
  const videoRef = await saveAsset(blob, 'video/mp4')

  // Dọn FS.
  for (const f of normFiles) await ffmpeg.deleteFile(f).catch(() => {})
  await ffmpeg.deleteFile(listFile).catch(() => {})
  await ffmpeg.deleteFile(outFile).catch(() => {})

  params.onStage?.('Xong')
  params.onProgress?.(1)
  return { videoRef, failedIdx, encodeMs: Math.round(nowMs() - t0) }
}
