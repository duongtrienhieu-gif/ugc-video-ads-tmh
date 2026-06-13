// ── Hybrid Video Assembler (P3c) ─────────────────────────────────────────────
// The NEW assembler for the HYBRID rebuild. Unlike the mode-1 finalVideoAssembler
// (creator base + overlay PIPs + subtitles + SFX + BGM), a hybrid video is a flat
// SEQUENCE of full-screen cuts that already cover the whole timeline:
//   • lips cuts (creator lip-synced to a voice span, rendered at natural speed),
//   • broll / mechanism3d cuts (Grok i2v, rendered ~0.77× speed → sped up 1.3×).
// A single master TTS track is the ONLY audio — every clip's own audio is STRIPPED
// (a lips clip was lip-synced to the SAME voice span the master plays at that time,
// so the mouth still matches; b-roll has no meaningful audio). This avoids
// double-audio and keeps perfect sync.
//
// MEMORY-SAFE (same lesson as Z98 finalVideoAssembler): normalize each segment in
// its OWN ffmpeg pass to an MPEG-TS clip, then join with the concat DEMUXER
// (stream-copy, no re-decode) → near-zero memory, works at 1080p. We do NOT import
// or touch finalVideoAssembler — mode-1 stays frozen.
//
// Stickers are added in P3c-2 (composited per-segment, same incantation as mode-1).
// ─────────────────────────────────────────────────────────────────────────────

import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from './ffmpegLoader'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import type { TimedBrollScene } from './brollDirector'

export interface HybridSceneClip {
  /** The timed scene (role drives the speed-up; start/end drive the trim length). */
  scene: TimedBrollScene
  /** The rendered clip asset ref (lips → renderLipsyncSegment; broll/3d → renderInsert). */
  videoRef: string
}

export interface HybridAssembleParams {
  /** Clips in TIMELINE ORDER. Missing/unrendered scenes should be omitted. */
  clips: HybridSceneClip[]
  /** Master TTS audio (asset ref) — the ONLY audio in the output. */
  voiceRef: string
  /** Real measured voice length (for -shortest sanity / logging). */
  voiceDurationSec: number
  /** Output height; width is derived 9:16 vertical. Default 480p. */
  resolution?: '480p' | '720p' | '1080p'
  onStage?: (msg: string) => void
  onProgress?: (ratio: number) => void
}

export interface HybridAssembleResult {
  videoRef: string
  /** Scene indices whose clip couldn't be fetched (skipped). */
  failedIdx: number[]
  encodeMs: number
}

// Grok i2v renders motion at ~0.77× of natural speed (a 4s-requested clip lands as
// a ~6s file that looks slow-mo). Speed b-roll/3d cuts up 1.3× so they fill their
// timeline slot at natural speed. Lips clips are already correct (Kling + TTS).
const INSERT_SPEED = 1.3

export async function assembleHybridVideo(
  params: HybridAssembleParams,
): Promise<HybridAssembleResult> {
  const t0 = nowMs()
  const outH = params.resolution === '1080p' ? 1080 : params.resolution === '720p' ? 720 : 480
  const rawW = Math.round((outH * 9) / 16)        // 9:16 vertical (TikTok)
  const evenW = rawW % 2 === 0 ? rawW : rawW + 1
  const evenH = outH % 2 === 0 ? outH : outH + 1

  params.onStage?.('Đang nạp ffmpeg...')
  const ffmpeg = await getFFmpeg({
    onLog: (msg) => { if (msg.length > 4 && !msg.startsWith('frame=')) console.log('[FFMPEG]', msg) },
  })

  // ── STAGE 1: normalize each clip to an MPEG-TS segment (no audio) ──────────
  const crf = params.resolution === '1080p' ? '23' : '28'
  const preset_x264 = 'veryfast'
  const normFiles: string[] = []
  const failedIdx: number[] = []

  for (let i = 0; i < params.clips.length; i++) {
    const c = params.clips[i]
    params.onStage?.(`Chuẩn hoá cảnh ${i + 1}/${params.clips.length}…`)
    params.onProgress?.((i / Math.max(1, params.clips.length)) * 0.9)

    const url = isAssetRef(c.videoRef) ? await getUrl(c.videoRef) : c.videoRef
    if (!url) { console.warn(`[HYBRID_ASM] cảnh ${i} thiếu videoRef — bỏ qua`); failedIdx.push(i); continue }

    const inFile = `hin_${i}.mp4`
    try {
      await ffmpeg.writeFile(inFile, await fetchFile(url))
    } catch (err) {
      console.warn(`[HYBRID_ASM] cảnh ${i} fetch lỗi — bỏ qua`, err)
      failedIdx.push(i)
      continue
    }

    const dur = Math.max(0.3, c.scene.endSec - c.scene.startSec)
    const isInsert = c.scene.role !== 'lips'   // broll + mechanism3d need the speed-up
    const trimDur = isInsert ? dur * INSERT_SPEED : dur
    const ptsExpr = isInsert ? `setpts=(PTS-STARTPTS)/${INSERT_SPEED}` : 'setpts=PTS-STARTPTS'

    const normFile = `hnorm_${i}.ts`
    await ffmpeg.exec([
      '-i', inFile,
      '-vf',
      `scale=${evenW}:${evenH}:force_original_aspect_ratio=increase,` +
      `crop=${evenW}:${evenH},trim=duration=${trimDur.toFixed(3)},${ptsExpr}`,
      '-an',                                   // strip clip audio — master TTS only
      '-c:v', 'libx264', '-preset', preset_x264, '-crf', crf,
      '-pix_fmt', 'yuv420p', '-r', '30',
      '-f', 'mpegts', '-y', normFile,
    ])
    normFiles.push(normFile)
    await ffmpeg.deleteFile(inFile).catch(() => {})
  }

  if (normFiles.length === 0) {
    throw new Error('Không có cảnh nào ghép được — render vài cảnh trước (kiểm tra videoRef).')
  }

  // ── STAGE 2: concat the TS segments (stream-copy, no decode) ───────────────
  params.onStage?.('Ghép các cảnh…')
  params.onProgress?.(0.92)
  const listFile = 'hconcat.txt'
  await ffmpeg.writeFile(listFile, new TextEncoder().encode(normFiles.map((f) => `file '${f}'`).join('\n')))
  const videoOnly = 'hvideo.mp4'
  await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-y', videoOnly])
  for (const f of normFiles) await ffmpeg.deleteFile(f).catch(() => {})
  await ffmpeg.deleteFile(listFile).catch(() => {})

  // ── STAGE 3: mux the master TTS (the only audio) ───────────────────────────
  params.onStage?.('Ghép tiếng (TTS)…')
  const voiceUrl = isAssetRef(params.voiceRef) ? await getUrl(params.voiceRef) : params.voiceRef
  if (!voiceUrl) throw new Error('Không lấy được voiceRef (master TTS)')
  const voiceFile = 'hvoice.mp3'
  await ffmpeg.writeFile(voiceFile, await fetchFile(voiceUrl))

  const outFile = 'hout.mp4'
  await ffmpeg.exec([
    '-i', videoOnly, '-i', voiceFile,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
    '-shortest', '-movflags', '+faststart', '-y', outFile,
  ])

  // ── STAGE 4: save ──────────────────────────────────────────────────────────
  const data = await ffmpeg.readFile(outFile)
  const blob = new Blob(
    [data instanceof Uint8Array ? (data as unknown as BlobPart) : new TextEncoder().encode(String(data))],
    { type: 'video/mp4' },
  )
  const videoRef = await saveAsset(blob, 'video/mp4')

  await ffmpeg.deleteFile(videoOnly).catch(() => {})
  await ffmpeg.deleteFile(voiceFile).catch(() => {})
  await ffmpeg.deleteFile(outFile).catch(() => {})

  const encodeMs = nowMs() - t0
  params.onProgress?.(1)
  console.log(
    `[HYBRID_ASM] xong · ${(blob.size / 1024 / 1024).toFixed(1)}MB · ${(encodeMs / 1000).toFixed(1)}s · ` +
    `cảnh=${normFiles.length}/${params.clips.length} (lỗi ${failedIdx.length}) · voiceDur≈${params.voiceDurationSec.toFixed(1)}s`,
  )
  return { videoRef, failedIdx, encodeMs }
}

// Date.now wrapper — keeps react-hooks/purity lint quiet at call sites that import
// this in components, mirroring the pattern used elsewhere in v3.
function nowMs(): number { return Date.now() }
