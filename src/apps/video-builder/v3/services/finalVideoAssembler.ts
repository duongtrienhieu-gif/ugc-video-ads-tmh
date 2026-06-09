// ── Final Video Assembler ────────────────────────────────────────────────────
// Z36 Phase 7 — Real MP4 assembly via ffmpeg.wasm. Takes a Phase 5 edit
// plan + Phase 3/4 asset refs → produces a single MP4 blob → saves to
// the asset store → returns the asset ref.
//
// Pipeline:
//   1. PREP   — Resolve every asset ref to a public URL, fetch the blob,
//               write it into the ffmpeg.wasm virtual FS. Build the ASS
//               subtitle file. Build the audio mix concat list.
//   2. ENCODE — Run ffmpeg with the assembled filter graph:
//                 concat segments → punch zoom filter → scale → fps → CRF
//   3. MUX    — Run a second ffmpeg pass to BURN subtitles + MIX audio:
//                 -vf "ass=subs.ass" + -filter_complex "amix=..."
//   4. SAVE   — Read /out.mp4 from FS → blob → saveAsset → returns asset ref
//
// COST PHILOSOPHY (Z36 §17):
//   This entire pipeline is FREE — runs locally in the browser. The user
//   only pays for clip generation (Phases 3-4). Export should never
//   re-render clips — only assemble what's already approved (§16).
//
// FAIL-SOFT (Z36 §18):
//   If a clip's asset fails to fetch (404, IDB missing), we SKIP it and
//   the rest of the timeline still renders. Caller gets a failedClipIds[]
//   list to surface in the UI.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from './ffmpegLoader'
import { saveAsset, getUrl, isAssetRef } from '../../../../utils/assetStore'
import { buildAssSubtitles } from './subtitleAssBurner'
import { EXPORT_FORMATS } from './exportFormats'
import { EXPORT_QUALITIES } from './exportQuality'
import { BGM_CATALOG } from './bgmCatalog'
import { SFX_CATALOG } from './sfxCatalog'
import type {
  AutoEditPlan, ExportFormatId, ExportQualityId,
  ExportRenderStage,
} from '../types'

// ── Public API ─────────────────────────────────────────────────────────

export interface AssembleParams {
  /** Phase 5 plan — drives segments, captions, zooms, SFX, BGM, CTA */
  plan: AutoEditPlan
  /** Format determines output aspect ratio + filename */
  formatId: ExportFormatId
  /** Quality determines output resolution + bitrate */
  qualityId: ExportQualityId
  /** Optional: 'preview' = aggressive downscale + low CFG for fast iteration.
   *  'final' = full quality. */
  preset?: 'preview' | 'final'
  /** Voice MP3 ref — the master audio track */
  voiceRef: string | null
  /** Stage progress callback */
  onStage?: (stage: ExportRenderStage, msg?: string) => void
  /** Encode progress 0-1 */
  onProgress?: (ratio: number) => void
}

export interface AssembleResult {
  /** asset:xxx of the final MP4 */
  videoRef: string
  /** Clip IDs that we couldn't fetch (skipped — Z36 §18) */
  failedClipIds: number[]
  /** Wall-clock encode time (ms) — useful for debug */
  encodeMs: number
}

/**
 * Z36 — Assemble the final MP4. Throws on fatal errors; soft-skips
 * individual failed clips (with failedClipIds in the result).
 */
export async function assembleFinalVideo(
  params: AssembleParams,
): Promise<AssembleResult> {
  const t0 = Date.now()
  const formatCfg = EXPORT_FORMATS[params.formatId]
  const qualityCfg = EXPORT_QUALITIES[params.qualityId]
  const preset = params.preset ?? 'preview'

  // Output dims from format aspect + quality height
  const outH = preset === 'preview' ? 480 : qualityCfg.resolutionPx
  const outW = Math.round(
    (outH * formatCfg.aspectRatio.w) / formatCfg.aspectRatio.h,
  )
  // Make sure width is even (libx264 requirement)
  const evenW = outW % 2 === 0 ? outW : outW + 1
  const evenH = outH % 2 === 0 ? outH : outH + 1

  params.onStage?.('loading_ffmpeg', 'Loading ffmpeg.wasm...')
  const ffmpeg = await getFFmpeg({
    onLog: (msg) => {
      // Only log meaningful lines to keep console clean
      if (msg.length > 4 && !msg.startsWith('frame=')) console.log('[FFMPEG]', msg)
    },
    onExecProgress: (ratio) => {
      if (Number.isFinite(ratio) && ratio >= 0 && ratio <= 1) {
        params.onProgress?.(ratio)
      }
    },
  })

  // ── STAGE 1: PREP — resolve assets + write to ffmpeg FS ───────────────
  params.onStage?.('preparing', 'Fetching clips + audio...')
  const failedClipIds: number[] = []
  const segmentInputs: {
    idx: number
    fileName: string
    durationSec: number
    sourceInSec: number
    /** Z73 — overlay PIPs that ride on this segment, with their fetched filenames.
     *  Only populated for creator_video segments that have overlays. */
    overlays?: { fileName: string; startSec: number; durationSec: number; corner: 'tl' | 'tr' | 'bl' | 'br'; widthFraction: number }[]
  }[] = []

  for (let i = 0; i < params.plan.segments.length; i++) {
    const seg = params.plan.segments[i]
    const ref = seg.source.kind === 'creator_video'
      ? seg.source.videoRef
      : seg.source.videoRef
    const url = isAssetRef(ref) ? await getUrl(ref) : ref
    if (!url) {
      const clipId = seg.source.kind === 'action_insert' ? seg.source.insertId : -1
      console.warn(`[ASSEMBLE] segment ${seg.segmentId} clip-${clipId} missing — skipping`)
      if (clipId >= 0) failedClipIds.push(clipId)
      continue
    }
    try {
      const fileName = `seg_${i}.mp4`
      const data = await fetchFile(url)
      await ffmpeg.writeFile(fileName, data)

      // Z73 — fetch overlay PIPs for this creator segment (if any).
      const overlayFiles: NonNullable<typeof segmentInputs[number]['overlays']> = []
      const ovs = seg.overlays ?? []
      for (let j = 0; j < ovs.length; j++) {
        const ov = ovs[j]
        const ovUrl = isAssetRef(ov.videoRef) ? await getUrl(ov.videoRef) : ov.videoRef
        if (!ovUrl) continue
        try {
          const ovFile = `seg_${i}_ov_${j}.mp4`
          const ovData = await fetchFile(ovUrl)
          await ffmpeg.writeFile(ovFile, ovData)
          overlayFiles.push({
            fileName: ovFile,
            startSec: ov.startSec,
            durationSec: ov.durationSec,
            corner: ov.corner ?? 'br',
            widthFraction: Math.max(0.2, Math.min(0.55, ov.widthFraction ?? 0.46)),
          })
        } catch (err) {
          console.warn(`[ASSEMBLE] overlay ${seg.segmentId}.${j} fetch failed — dropping`, err)
        }
      }

      segmentInputs.push({
        idx: i,
        fileName,
        durationSec: seg.durationSec,
        sourceInSec: seg.sourceInSec ?? 0,
        overlays: overlayFiles.length > 0 ? overlayFiles : undefined,
      })
    } catch (err) {
      const clipId = seg.source.kind === 'action_insert' ? seg.source.insertId : -1
      console.warn(`[ASSEMBLE] segment ${seg.segmentId} fetch failed — skipping`, err)
      if (clipId >= 0) failedClipIds.push(clipId)
    }
  }

  if (segmentInputs.length === 0) {
    throw new Error('Không có segment nào fetch được — kiểm tra creator video + inserts')
  }

  // Write voice audio if available
  let voiceFile: string | null = null
  if (params.voiceRef) {
    try {
      const voiceUrl = isAssetRef(params.voiceRef) ? await getUrl(params.voiceRef) : params.voiceRef
      if (voiceUrl) {
        voiceFile = 'voice.mp3'
        const voiceData = await fetchFile(voiceUrl)
        await ffmpeg.writeFile(voiceFile, voiceData)
      }
    } catch (err) {
      console.warn('[ASSEMBLE] voice fetch failed — continuing without override', err)
      voiceFile = null
    }
  }

  // Write SFX cue audio (fail-soft — skip any that 404 / are placeholders).
  // Each resolvable cue carries its timeline position + per-cue volume.
  const sfxFiles: { fileName: string; startSec: number; volume: number }[] = []
  for (let i = 0; i < params.plan.sfxCues.length; i++) {
    const cue = params.plan.sfxCues[i]
    const url = SFX_CATALOG[cue.sfxId]?.url
    if (!url) continue
    const data = await tryFetchAudio(url)
    if (!data) continue
    const fileName = `sfx_${i}.mp3`
    await ffmpeg.writeFile(fileName, data)
    sfxFiles.push({ fileName, startSec: cue.startSec, volume: cue.volume })
  }

  // Write BGM track (fail-soft). Looped + faded to cover the whole video.
  let bgmFile: { fileName: string; volume: number; fadeInSec: number; fadeOutSec: number } | null = null
  if (params.plan.bgm) {
    const url = BGM_CATALOG[params.plan.bgm.styleId]?.url
    if (url) {
      const data = await tryFetchAudio(url)
      if (data) {
        await ffmpeg.writeFile('bgm.mp3', data)
        bgmFile = {
          fileName: 'bgm.mp3',
          volume: params.plan.bgm.volume,
          fadeInSec: params.plan.bgm.fadeInSec,
          fadeOutSec: params.plan.bgm.fadeOutSec,
        }
      }
    }
  }

  // Write ASS subtitle file (or skip)
  const assContent = buildAssSubtitles({
    captions: params.plan.captions,
    styleId: params.plan.subtitleStyleId,
    videoWidth: evenW,
    videoHeight: evenH,
  })
  let assFile: string | null = null
  if (assContent) {
    assFile = 'subs.ass'
    await ffmpeg.writeFile(assFile, new TextEncoder().encode(assContent))
  }

  // ── STAGE 2: ENCODE — concat segments with normalized resolution ──────
  params.onStage?.('encoding', `Encoding ${preset === 'preview' ? '480p preview' : `${qualityCfg.labelVi}`}...`)

  // Build a concat-style input list — each segment gets trimmed to its
  // durationSec (which may differ from the file's full duration if the
  // segment is an inserted overlay). We use ffmpeg's `concat` demuxer via
  // an intermediate per-segment normalised .ts file.
  //
  // For implementation simplicity in v1, use the concat FILTER (slower
  // but more reliable across codec mismatches):
  //   -i seg_0.mp4 -i seg_1.mp4 ... -filter_complex "[0:v]scale=...[v0];[1:v]scale=...[v1];[v0][v1]concat=n=N:v=1[outv]"

  // Z73 — input list now also includes overlay PIPs (one ffmpeg input per
  // overlay file). We keep track of the input INDEX for each overlay so the
  // filter graph can reference it.
  const inputArgs: string[] = []
  const segInputIdx: number[] = []           // global ffmpeg-input index of each segment's main video
  const overlayInputIdx: number[][] = []     // per-segment list of overlay input indices
  let nextInputIdx = 0
  for (const s of segmentInputs) {
    inputArgs.push('-i', s.fileName)
    segInputIdx.push(nextInputIdx)
    nextInputIdx++
    const ovIdx: number[] = []
    for (const ov of s.overlays ?? []) {
      inputArgs.push('-i', ov.fileName)
      ovIdx.push(nextInputIdx)
      nextInputIdx++
    }
    overlayInputIdx.push(ovIdx)
  }

  // Filter graph: scale each segment to output dims, trim to durationSec; for
  // segments with overlays, scale + position each PIP and overlay it on the
  // base segment with `enable=between(t,...)` for its window; then concat all.
  const N = segmentInputs.length
  const filterParts: string[] = []
  for (let i = 0; i < N; i++) {
    const s = segmentInputs[i]
    const baseIdx = segInputIdx[i]
    // Base segment: scale + crop + trim
    filterParts.push(
      `[${baseIdx}:v]scale=${evenW}:${evenH}:force_original_aspect_ratio=increase,` +
      `crop=${evenW}:${evenH},trim=start=${s.sourceInSec}:duration=${s.durationSec},` +
      `setpts=PTS-STARTPTS[base${i}]`,
    )

    const ovs = s.overlays ?? []
    if (ovs.length === 0) {
      // No overlays — base IS the segment output
      filterParts.push(`[base${i}]null[v${i}]`)
    } else {
      // Build a chain: base → overlay 0 → overlay 1 → ... → v{i}
      const MARGIN = 24  // px from the frame edges
      ovs.forEach((ov, j) => {
        const ovGlobalIdx = overlayInputIdx[i][j]
        const pipW = Math.round(evenW * ov.widthFraction / 2) * 2  // even
        // Pre-process the overlay video: scale to PIP size, trim to its
        // duration, and offset its presentation timestamp so it starts at
        // `ov.startSec` inside the segment.
        filterParts.push(
          `[${ovGlobalIdx}:v]scale=${pipW}:-2,setsar=1,` +
          `trim=duration=${ov.durationSec},setpts=PTS-STARTPTS+${ov.startSec}/TB[pip${i}_${j}]`,
        )
        // Position by corner. `W` and `H` are the BASE width/height inside
        // the overlay filter; `w` and `h` are the OVERLAY's.
        const x = (ov.corner === 'tl' || ov.corner === 'bl') ? `${MARGIN}` : `W-w-${MARGIN}`
        const y = (ov.corner === 'tl' || ov.corner === 'tr') ? `${MARGIN}` : `H-h-${MARGIN}`
        const prevLabel = j === 0 ? `base${i}` : `mix${i}_${j - 1}`
        const nextLabel = j === ovs.length - 1 ? `v${i}` : `mix${i}_${j}`
        const endT = ov.startSec + ov.durationSec
        filterParts.push(
          `[${prevLabel}][pip${i}_${j}]overlay=x=${x}:y=${y}:` +
          `enable='between(t,${ov.startSec},${endT})':eof_action=pass[${nextLabel}]`,
        )
      })
    }
  }
  const concatInputs = Array.from({ length: N }, (_, i) => `[v${i}]`).join('')
  filterParts.push(`${concatInputs}concat=n=${N}:v=1:a=0[outv]`)
  const filterGraph = filterParts.join(';')

  const crf = preset === 'preview' ? '32' : '23'
  const preset_x264 = preset === 'preview' ? 'ultrafast' : 'fast'

  // Intermediate file — video only, no audio yet (audio comes from voiceFile)
  const intermediateFile = '_video_only.mp4'
  await ffmpeg.exec([
    ...inputArgs,
    '-filter_complex', filterGraph,
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-preset', preset_x264,
    '-crf', crf,
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-y', intermediateFile,
  ])

  // ── STAGE 3: MUX — burn subtitles + add audio ─────────────────────────
  params.onStage?.('muxing', 'Burning subtitles + mixing audio...')

  const outFile = 'out.mp4'
  const hasExtraAudio = sfxFiles.length > 0 || bgmFile !== null

  if (!hasExtraAudio) {
    // ── Simple path: voice-only (or silent) — burn subs via -vf ─────────
    const muxInputs: string[] = ['-i', intermediateFile]
    if (voiceFile) muxInputs.push('-i', voiceFile)

    const muxArgs: string[] = [...muxInputs]
    if (assFile) muxArgs.push('-vf', `ass=${assFile}`)

    if (voiceFile) {
      muxArgs.push(
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'libx264',
        '-preset', preset_x264,
        '-crf', crf,
        '-c:a', 'aac',
        '-b:a', `${qualityCfg.audioBitrateKbps}k`,
        '-shortest',
      )
    } else {
      muxArgs.push(
        '-map', '0:v:0',
        '-c:v', 'libx264',
        '-preset', preset_x264,
        '-crf', crf,
        '-an',  // no audio
      )
    }
    muxArgs.push('-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', outFile)
    await ffmpeg.exec(muxArgs)
  } else {
    // ── Mix path: voice + SFX cues + BGM via amix ───────────────────────
    // -vf cannot coexist with -filter_complex, so burn subtitles inside the
    // graph too. Voice stays at full volume (normalize=0); SFX are delayed
    // to their cue time; BGM is looped + faded under the voice.
    const muxInputs: string[] = ['-i', intermediateFile]
    let inIdx = 1
    const audioParts: string[] = []
    const amixLabels: string[] = []

    if (voiceFile) {
      muxInputs.push('-i', voiceFile)
      audioParts.push(`[${inIdx}:a]volume=1.0[a_voice]`)
      amixLabels.push('[a_voice]')
      inIdx++
    }
    for (let i = 0; i < sfxFiles.length; i++) {
      const s = sfxFiles[i]
      muxInputs.push('-i', s.fileName)
      const delayMs = Math.max(0, Math.round(s.startSec * 1000))
      audioParts.push(`[${inIdx}:a]adelay=${delayMs}:all=1,volume=${s.volume.toFixed(2)}[a_sfx${i}]`)
      amixLabels.push(`[a_sfx${i}]`)
      inIdx++
    }
    if (bgmFile) {
      // -stream_loop -1 must precede its -i so the track repeats; atrim caps it.
      muxInputs.push('-stream_loop', '-1', '-i', bgmFile.fileName)
      const total = params.plan.totalDurationSec
      const fadeOutStart = Math.max(0, total - bgmFile.fadeOutSec)
      audioParts.push(
        `[${inIdx}:a]volume=${bgmFile.volume.toFixed(2)},` +
        `afade=t=in:st=0:d=${bgmFile.fadeInSec},` +
        `afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${bgmFile.fadeOutSec},` +
        `atrim=0:${total.toFixed(2)}[a_bgm]`,
      )
      amixLabels.push('[a_bgm]')
      inIdx++
    }

    const fcParts: string[] = []
    fcParts.push(assFile ? `[0:v]ass=${assFile}[outv]` : `[0:v]null[outv]`)
    fcParts.push(...audioParts)
    let audioMapLabel: string | null = null
    if (amixLabels.length > 1) {
      fcParts.push(`${amixLabels.join('')}amix=inputs=${amixLabels.length}:normalize=0:duration=longest[aout]`)
      audioMapLabel = '[aout]'
    } else if (amixLabels.length === 1) {
      audioMapLabel = amixLabels[0]
    }

    const muxArgs: string[] = [
      ...muxInputs,
      '-filter_complex', fcParts.join(';'),
      '-map', '[outv]',
    ]
    if (audioMapLabel) {
      muxArgs.push(
        '-map', audioMapLabel,
        '-c:v', 'libx264', '-preset', preset_x264, '-crf', crf,
        '-c:a', 'aac', '-b:a', `${qualityCfg.audioBitrateKbps}k`,
        '-shortest',
      )
    } else {
      muxArgs.push('-c:v', 'libx264', '-preset', preset_x264, '-crf', crf, '-an')
    }
    muxArgs.push('-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', outFile)
    await ffmpeg.exec(muxArgs)
  }

  // ── STAGE 4: SAVE ────────────────────────────────────────────────────
  const data = await ffmpeg.readFile(outFile)
  // Cast Uint8Array → BlobPart (TS strict types differ across DOM lib versions
  // re: SharedArrayBuffer vs ArrayBuffer; the runtime payload is always a
  // plain Uint8Array view, safe to feed Blob).
  const blob = new Blob([data instanceof Uint8Array ? (data as unknown as BlobPart) : new TextEncoder().encode(String(data))], { type: 'video/mp4' })
  const videoRef = await saveAsset(blob, 'video/mp4')

  // Cleanup virtual FS (best-effort — ffmpeg.wasm doesn't always succeed)
  try {
    for (const s of segmentInputs) await ffmpeg.deleteFile(s.fileName).catch(() => {})
    if (voiceFile) await ffmpeg.deleteFile(voiceFile).catch(() => {})
    for (const s of sfxFiles) await ffmpeg.deleteFile(s.fileName).catch(() => {})
    if (bgmFile) await ffmpeg.deleteFile(bgmFile.fileName).catch(() => {})
    if (assFile) await ffmpeg.deleteFile(assFile).catch(() => {})
    await ffmpeg.deleteFile(intermediateFile).catch(() => {})
    await ffmpeg.deleteFile(outFile).catch(() => {})
  } catch { /* silent */ }

  const encodeMs = Date.now() - t0
  console.log(`[ASSEMBLE] done · ${(blob.size / 1024 / 1024).toFixed(1)}MB · ${(encodeMs / 1000).toFixed(1)}s · failedClips=${failedClipIds.length}`)

  return { videoRef, failedClipIds, encodeMs }
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Z36 — Dry-run estimation: how big would the export be? Used by the UI
 * to show a "this MP4 ~= X MB" hint before user clicks Build. Pure math
 * from the quality config + duration — no actual ffmpeg work.
 */
export function estimateExportSize(plan: AutoEditPlan, qualityId: ExportQualityId): { mb: number } {
  const q = EXPORT_QUALITIES[qualityId]
  // (bitrate kbps * duration sec) / 8 = KB
  // Approximate — actual depends on content complexity
  const videoKb = (q.videoBitrateKbps * plan.totalDurationSec) / 8
  const audioKb = (q.audioBitrateKbps * plan.totalDurationSec) / 8
  const mb = (videoKb + audioKb) / 1024
  return { mb: Math.round(mb * 10) / 10 }
}

/**
 * Cross-check that all segments in the plan have resolvable refs BEFORE
 * the user kicks off a multi-minute encode. Returns the list of broken
 * segments so the UI can warn / disable.
 */
export async function preflightCheckAssets(plan: AutoEditPlan): Promise<{
  totalSegments: number
  resolvedSegments: number
  missingClipIds: number[]
}> {
  let resolved = 0
  const missing: number[] = []
  for (const seg of plan.segments) {
    const ref = seg.source.videoRef
    try {
      const url = isAssetRef(ref) ? await getUrl(ref) : ref
      if (url) {
        resolved++
      } else {
        const clipId = seg.source.kind === 'action_insert' ? seg.source.insertId : -1
        if (clipId >= 0) missing.push(clipId)
      }
    } catch {
      const clipId = seg.source.kind === 'action_insert' ? seg.source.insertId : -1
      if (clipId >= 0) missing.push(clipId)
    }
  }
  return {
    totalSegments: plan.segments.length,
    resolvedSegments: resolved,
    missingClipIds: missing,
  }
}

/**
 * Fetch a (possibly placeholder) audio URL fail-soft. Returns the bytes only
 * if the response is a real audio file. Guards against the dev-server SPA
 * fallback that returns index.html (200 + text/html) for missing /sfx/*.mp3
 * and /bgm/*.mp3 — feeding that HTML to ffmpeg would corrupt the whole mux.
 */
async function tryFetchAudio(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0) return null
    return new Uint8Array(buf)
  } catch {
    return null
  }
}
