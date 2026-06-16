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

export interface HybridStickerPlacement {
  /** Transparent PNG asset ref (rendered locally via stickerRenderer — 0 credit). */
  pngRef: string
  /** Absolute timeline second to pop on (from the voice word-alignment). */
  atSec: number
  /** How long it stays on screen (default ~1.8s). */
  durationSec: number
  /** Sticker height as a fraction of the frame (default 0.10). */
  heightFraction?: number
}

export interface HybridCaptionPlacement {
  /** Transparent caption PNG (rendered locally via captionRenderer — 0 credit). */
  pngRef: string
  /** Absolute timeline second the chunk appears. */
  atSec: number
  /** How long the chunk stays (chunker makes these continuous → no gaps/flicker). */
  durationSec: number
}

export interface HybridAssembleParams {
  /** Clips in TIMELINE ORDER. Missing/unrendered scenes should be omitted. */
  clips: HybridSceneClip[]
  /** Master TTS audio (asset ref) — the ONLY audio in the output. */
  voiceRef: string
  /** Real measured voice length (for -shortest sanity / logging). */
  voiceDurationSec: number
  /** 0-credit text pops, composited onto the segment they fall within. */
  stickers?: HybridStickerPlacement[]
  /** 0-credit burned captions (bottom-centre), composited like stickers. */
  captions?: HybridCaptionPlacement[]
  /** P5x — one persistent top hook banner PNG, held over EVERY non-card segment.
   *  `fullWidth` = a ribbon flush to the top edge; false = a centred pill. */
  banner?: { pngRef: string; fullWidth: boolean }
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
// i2v clips OPEN on the still keyframe (~0.3-0.5s frozen before motion ramps). Skip
// that lead-in so each cut opens ON MOTION, not on a freeze (the "ảnh tĩnh ở chuyển
// cảnh"). Grok clips are ~6s; if a slot needs more source than exists we re-fit the
// speed so the segment still fills the slot EXACTLY (never a held last frame / a short
// segment that drifts the back-half sync).
const INSERT_LEAD_IN_SEC = 0.35
const INSERT_SOURCE_BUDGET_SEC = 6.0

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
  // P4c — sharpness fix. The single re-encode here was CRF 28 + veryfast, which
  // bóp nhòe MỌI clip — even the native-720p Kling lips clip came out as mushy as
  // an upscaled 480p broll (the user audited "lips cũng mờ y chang"). CRF is the
  // dominant perceived-quality lever and costs NO credit (just a bigger file +
  // slightly slower encode). 20/19 ≈ visually sharp; 'fast' preset compresses
  // better per bit than 'veryfast' for a small wasm-time cost.
  const crf = params.resolution === '1080p' ? '19' : '20'
  const preset_x264 = 'fast'
  const MARGIN = 24                       // px from the frame edge (sticker)
  const allStickers = params.stickers ?? []
  const allCaptions = params.captions ?? []
  // Caption: max width 92% (the rare over-long line shrinks to this), sat 12% above the
  // bottom so it clears the TikTok action bar. Consistent placement every chunk.
  const CAP_MAXW = Math.round((evenW * 0.92) / 2) * 2
  const CAP_BOT_MARGIN = Math.round(evenH * 0.12)
  // P5y — fixed caption scale: renderer draws each chunk at FONT_PX(80)×dpr(2)=160px
  // glyphs; this maps them to ~5.5% of frame height, the SAME for every chunk (no more
  // box-fit ballooning of short chunks). Width is clamped to CAP_MAXW at use site.
  const CAP_SCALE_K = (evenH * 0.055) / 160
  // P5x — top hook banner: a centred pill ~86% width sat ~3.5% below the top, OR a
  // full-width ribbon flush to y=0. Held the whole segment (no enable window).
  const BANNER_PILL_W = Math.round((evenW * 0.86) / 2) * 2
  const BANNER_TOP = Math.round((evenH * 0.035) / 2) * 2
  const normFiles: string[] = []
  const failedIdx: number[] = []

  for (let i = 0; i < params.clips.length; i++) {
    const c = params.clips[i]
    params.onStage?.(`Chuẩn hoá cảnh ${i + 1}/${params.clips.length}…`)
    params.onProgress?.((i / Math.max(1, params.clips.length)) * 0.9)

    const url = isAssetRef(c.videoRef) ? await getUrl(c.videoRef) : c.videoRef
    if (!url) { console.warn(`[HYBRID_ASM] cảnh ${i} thiếu videoRef — bỏ qua`); failedIdx.push(i); continue }

    const isCard = c.scene.role === 'social_proof'   // P5w — a static FB-post IMAGE, not a video
    const inFile = isCard ? `hin_${i}.png` : `hin_${i}.mp4`
    try {
      await ffmpeg.writeFile(inFile, await fetchFile(url))
    } catch (err) {
      console.warn(`[HYBRID_ASM] cảnh ${i} fetch lỗi — bỏ qua`, err)
      failedIdx.push(i)
      continue
    }

    const dur = Math.max(0.3, c.scene.endSec - c.scene.startSec)

    // P5w — social-proof card: hold the FB-post image for the line's duration, fitted
    // INSIDE the 9:16 frame on a soft pad (never crop the post → keep all comments
    // readable). No speed-up / lead-in / overlay (it's a full-frame card; captions are
    // skipped for this window in buildCaptionPlacements).
    if (isCard) {
      const normFile = `hnorm_${i}.ts`
      await ffmpeg.exec([
        '-loop', '1', '-t', dur.toFixed(3), '-i', inFile,
        '-vf', `scale=${evenW}:${evenH}:force_original_aspect_ratio=decrease,pad=${evenW}:${evenH}:(ow-iw)/2:(oh-ih)/2:color=0xEEF1F7,setsar=1`,
        '-an', '-c:v', 'libx264', '-preset', preset_x264, '-crf', crf,
        '-pix_fmt', 'yuv420p', '-r', '30', '-f', 'mpegts', '-y', normFile,
      ])
      normFiles.push(normFile)
      await ffmpeg.deleteFile(inFile).catch(() => {})
      continue
    }

    const isInsert = c.scene.role !== 'lips'   // broll + mechanism3d need the speed-up
    // lips: take the clip as-is (start 0, speed 1). insert: skip the static lead-in,
    // speed 1.3×; but if the slot needs more source than the ~6s clip holds, re-fit
    // the speed so the trimmed source still maps to EXACTLY `dur` (no freeze / no short).
    const leadIn = isInsert ? INSERT_LEAD_IN_SEC : 0
    let speed = isInsert ? INSERT_SPEED : 1
    let trimDur = dur * speed
    if (isInsert && leadIn + trimDur > INSERT_SOURCE_BUDGET_SEC) {
      trimDur = Math.max(0.3, INSERT_SOURCE_BUDGET_SEC - leadIn)
      speed = trimDur / dur                      // output = trimDur / speed = dur
    }
    const ptsExpr = `setpts=(PTS-STARTPTS)/${speed.toFixed(4)}`
    const baseChain =
      `scale=${evenW}:${evenH}:force_original_aspect_ratio=increase,` +
      `crop=${evenW}:${evenH},trim=start=${leadIn.toFixed(3)}:duration=${trimDur.toFixed(3)},${ptsExpr}`

    // P4d — a sticker rides on EVERY segment its display window overlaps, not
    // just the one it pops in. Was: `s.atSec in [segStart,segEnd)` → a sticker
    // popping near a scene cut got truncated at the boundary (the user audited
    // "1.8s thay vì 2.7s"). Now: window [atSec, atSec+durationSec] overlaps the
    // segment's output range → it carries into the next clip and shows its full
    // duration. The enable window is recomputed per-segment in OUTPUT time below.
    const overlapsSeg = (atSec: number, durationSec: number) =>
      atSec + durationSec > c.scene.startSec && atSec < c.scene.endSec
    const segStickers = allStickers.filter((s) => overlapsSeg(s.atSec, s.durationSec))
    const segCaptions = allCaptions.filter((s) => overlapsSeg(s.atSec, s.durationSec))
    const overlayFiles: string[] = []
    const normFile = `hnorm_${i}.ts`

    // P5x — the top banner rides EVERY non-card segment (cards already `continue`d
    // above). It has no time window — it's held the whole segment.
    const segBanner = params.banner ?? null
    if (segStickers.length === 0 && segCaptions.length === 0 && !segBanner) {
      await ffmpeg.exec([
        '-i', inFile,
        '-vf', baseChain,
        '-an',                                 // strip clip audio — master TTS only
        '-c:v', 'libx264', '-preset', preset_x264, '-crf', crf,
        '-pix_fmt', 'yuv420p', '-r', '30',
        '-f', 'mpegts', '-y', normFile,
      ])
    } else {
      // Build a filter_complex: base + one looped PNG input per overlay. Banner (top,
      // whole segment) first, then stickers (corner, height-scaled — UNCHANGED), then
      // captions (bottom-centre, box-fit). Sticker/caption use an OUTPUT-local enable
      // window; the banner is always-on for the segment.
      type Overlay =
        | { mode: 'banner'; pngRef: string; fullWidth: boolean }
        | { mode: 'sticker'; pngRef: string; atSec: number; durationSec: number; heightFraction?: number }
        | { mode: 'caption'; pngRef: string; atSec: number; durationSec: number }
      const overlays: Overlay[] = [
        ...(segBanner ? [{ mode: 'banner' as const, pngRef: segBanner.pngRef, fullWidth: segBanner.fullWidth }] : []),
        ...segStickers.map((s) => ({ mode: 'sticker' as const, ...s })),
        ...segCaptions.map((s) => ({ mode: 'caption' as const, pngRef: s.pngRef, atSec: s.atSec, durationSec: s.durationSec })),
      ]
      const inputs: string[] = ['-i', inFile]
      const parts: string[] = [`[0:v]${baseChain}[base]`]
      let last = 'base'
      for (let j = 0; j < overlays.length; j++) {
        const s = overlays[j]
        const sUrl = isAssetRef(s.pngRef) ? await getUrl(s.pngRef) : s.pngRef
        if (!sUrl) continue
        const pngFile = `hov_${i}_${j}.png`
        try { await ffmpeg.writeFile(pngFile, await fetchFile(sUrl)) }
        catch (err) { console.warn(`[HYBRID_ASM] overlay ${i}.${j} fetch lỗi — bỏ qua`, err); continue }
        overlayFiles.push(pngFile)
        inputs.push('-loop', '1', '-t', dur.toFixed(3), '-i', pngFile)
        const inIdx = j + 1
        const next = `m${j}`
        if (s.mode === 'banner') {
          // Top hook banner: pill ~86% width near the top, OR full-width ribbon at y=0.
          // Scaled by WIDTH only (uniform → no text distortion). Held the whole segment.
          const bw = s.fullWidth ? evenW : BANNER_PILL_W
          const by = s.fullWidth ? 0 : BANNER_TOP
          parts.push(`[${inIdx}:v]format=rgba,scale=${bw}:-2,setsar=1[ov${j}]`)
          parts.push(`[${last}][ov${j}]overlay=x=(W-w)/2:y=${by}[${next}]`)
          last = next
          continue
        }
        // P4d — enable window in OUTPUT-local time; a carried overlay shows only its
        // remaining time here (clamped to the segment), not a fresh full duration.
        const off = Math.max(0, s.atSec - c.scene.startSec)
        const endW = Math.min(dur, (s.atSec + s.durationSec) - c.scene.startSec)
        if (s.mode === 'caption') {
          // P5y — CONSISTENT caption size: scale by a FIXED factor (not box-fit), so a
          // SHORT chunk no longer balloons to fill the width. CAP_SCALE_K maps the
          // renderer's glyph (FONT_PX 80 × dpr 2 = 160px) to ~5.5% of frame height; the
          // width is clamped to CAP_MAXW for the rare over-long line (single-quoted so the
          // min() comma is literal, same as the enable filter below). Bottom-centre.
          parts.push(`[${inIdx}:v]format=rgba,scale='min(iw*${CAP_SCALE_K.toFixed(4)},${CAP_MAXW})':-2,setsar=1[ov${j}]`)
          parts.push(
            `[${last}][ov${j}]overlay=x=(W-w)/2:y=H-h-${CAP_BOT_MARGIN}:` +
            `enable='between(t,${off.toFixed(2)},${endW.toFixed(2)})'[${next}]`,
          )
        } else {
          // mid-right, upper-middle (y≈60%) — raised from 72% so it clears the
          // bottom-centre captions added in P5k (was colliding with the caption band).
          const pipH = Math.round((evenH * (s.heightFraction ?? 0.10)) / 2) * 2
          parts.push(`[${inIdx}:v]format=rgba,scale=-2:${pipH},setsar=1[ov${j}]`)
          parts.push(
            `[${last}][ov${j}]overlay=x=W-w-${MARGIN}:y=(H-h)*0.60:` +
            `enable='between(t,${off.toFixed(2)},${endW.toFixed(2)})'[${next}]`,
          )
        }
        last = next
      }
      await ffmpeg.exec([
        ...inputs,
        '-filter_complex', parts.join(';'),
        '-map', `[${last}]`,
        '-an',
        '-c:v', 'libx264', '-preset', preset_x264, '-crf', crf,
        '-pix_fmt', 'yuv420p', '-r', '30',
        '-f', 'mpegts', '-y', normFile,
      ])
    }

    normFiles.push(normFile)
    await ffmpeg.deleteFile(inFile).catch(() => {})
    for (const f of overlayFiles) await ffmpeg.deleteFile(f).catch(() => {})
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
  params.onStage?.('Ghép tiếng + xuất MP4…')
  params.onProgress?.(0.95)   // P4b — nudge so the bar moves 92→95 before the final mux
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
