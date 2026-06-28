// ── Mode 3 — Personified ASSEMBLER (P2d) ─────────────────────────────────────
// Ghép clip cảnh → 1 video dọc 9:16, pad-fit nền blur, upscale 720p.
// CHỐNG DESYNC (như hybrid): KHÔNG concat audio per-clip (demuxer không re-stamp PTS →
// tiếng lệch hình, đè hình). Thay vào: tách VIDEO CÂM + AUDIO riêng, mỗi cảnh CLAMP đúng
// `durationSec` (= độ dài giọng) cho CẢ video lẫn audio → concat 2 luồng rồi mux 1 lần →
// khớp tuyệt đối cảnh-theo-cảnh. Memory-safe: per-segment MPEG-TS + concat demuxer.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from '../../video-builder/v3/services/ffmpegLoader'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'

export interface PersonifiedAssembleClip {
  /** Video cảnh (voiced clip có caption, hoặc i2v câm). Audio của nó sẽ BỊ BỎ — dùng audioRef. */
  videoRef: string
  /** Audio giọng cảnh (asset mp3). Rỗng/undefined → cảnh câm (chèn im đúng durationSec). */
  audioRef?: string
  /** Độ dài cảnh (giây) — CLAMP cả video lẫn audio về đúng số này để khớp. */
  durationSec: number
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

  const vSegs: string[] = []   // đoạn VIDEO câm (.ts) theo thứ tự
  const aSegs: string[] = []   // đoạn AUDIO (.ts) cùng thứ tự, cùng độ dài
  const tmp: string[] = []     // file tạm để dọn
  const failedIdx: number[] = []

  // ── STAGE 1: mỗi cảnh → 1 đoạn video câm + 1 đoạn audio, ĐỀU clamp đúng durationSec ──
  for (let i = 0; i < params.clips.length; i++) {
    const c = params.clips[i]
    params.onStage?.(`Chuẩn hoá cảnh ${i + 1}/${params.clips.length}…`)
    params.onProgress?.((i / Math.max(1, params.clips.length)) * 0.85)
    const dur = Math.max(0.3, c.durationSec || 4)

    const vUrl = isAssetRef(c.videoRef) ? await getUrl(c.videoRef) : c.videoRef
    if (!vUrl) { console.warn(`[PERS_ASM] cảnh ${i} thiếu video — bỏ qua`); failedIdx.push(i); continue }
    let vBytes: Uint8Array
    try { vBytes = await fetchFile(vUrl) } catch { console.warn(`[PERS_ASM] cảnh ${i} fetch video lỗi`); failedIdx.push(i); continue }
    if (!vBytes || vBytes.byteLength < 512) { console.warn(`[PERS_ASM] cảnh ${i} video rỗng`); failedIdx.push(i); continue }

    const vin = `pvin_${i}.mp4`, vts = `pv_${i}.ts`, ats = `pa_${i}.ts`
    try {
      // VIDEO CÂM: pad-fit blur 9:16, 30fps, BỎ audio. tpad giữ frame cuối nếu clip ngắn
      // hơn dur → video LUÔN đủ dur (khớp audio); -t cắt nếu dài hơn.
      await ffmpeg.writeFile(vin, vBytes)
      tmp.push(vin)
      const vfClip = `${vf},tpad=stop_mode=clone:stop_duration=${dur.toFixed(3)}`
      await ffmpeg.exec([
        '-i', vin, '-vf', vfClip, '-t', dur.toFixed(3), '-r', '30', '-an',
        '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-pix_fmt', 'yuv420p',
        '-f', 'mpegts', '-y', vts,
      ])
      // AUDIO: giọng cảnh (pad im rồi cắt đúng dur) HOẶC im hoàn toàn (cảnh câm).
      const aUrl = c.audioRef ? (isAssetRef(c.audioRef) ? await getUrl(c.audioRef) : c.audioRef) : null
      if (aUrl) {
        const ain = `pain_${i}.mp3`
        await ffmpeg.writeFile(ain, await fetchFile(aUrl))
        tmp.push(ain)
        await ffmpeg.exec([
          '-i', ain, '-af', 'apad', '-t', dur.toFixed(3),
          '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-f', 'mpegts', '-y', ats,
        ])
      } else {
        await ffmpeg.exec([
          '-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo',
          '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-f', 'mpegts', '-y', ats,
        ])
      }
    } catch (err) {
      console.warn(`[PERS_ASM] cảnh ${i} encode lỗi — bỏ qua`, err)
      failedIdx.push(i)
      continue
    }
    vSegs.push(vts); aSegs.push(ats)
  }

  if (!vSegs.length) throw new Error('Không clip nào ghép được (tất cả lỗi/hết hạn URL)')

  // ── STAGE 2: concat VIDEO câm + concat AUDIO (demuxer copy), rồi MUX 1 lần ──
  params.onStage?.('Đang nối video + giọng…')
  params.onProgress?.(0.9)
  const vList = 'pvlist.txt', aList = 'palist.txt', vCat = 'pvcat.ts', aCat = 'pacat.ts', outFile = 'pfinal.mp4'
  await ffmpeg.writeFile(vList, new TextEncoder().encode(vSegs.map((f) => `file '${f}'`).join('\n')))
  await ffmpeg.writeFile(aList, new TextEncoder().encode(aSegs.map((f) => `file '${f}'`).join('\n')))
  await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', vList, '-c', 'copy', '-y', vCat])
  await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', aList, '-c', 'copy', '-y', aCat])
  // Mux: video câm + master audio. Cả 2 đã = tổng độ dài cảnh → khớp tuyệt đối.
  await ffmpeg.exec([
    '-i', vCat, '-i', aCat,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac',
    '-movflags', '+faststart', '-shortest', '-y', outFile,
  ])

  const out = await ffmpeg.readFile(outFile)
  const src = typeof out === 'string' ? new TextEncoder().encode(out) : out
  const outBytes = new Uint8Array(src.byteLength)   // copy khỏi SharedArrayBuffer (wasm)
  outBytes.set(src)
  const videoRef = await saveAsset(new Blob([outBytes], { type: 'video/mp4' }), 'video/mp4')

  // Dọn FS.
  for (const f of [...vSegs, ...aSegs, ...tmp, vList, aList, vCat, aCat, outFile]) await ffmpeg.deleteFile(f).catch(() => {})

  params.onStage?.('Xong')
  params.onProgress?.(1)
  return { videoRef, failedIdx, encodeMs: Math.round(nowMs() - t0) }
}
