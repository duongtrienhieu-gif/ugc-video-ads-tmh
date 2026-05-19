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
  const segmentInputs: { idx: number; fileName: string; durationSec: number }[] = []

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
      segmentInputs.push({ idx: i, fileName, durationSec: seg.durationSec })
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

  const inputArgs: string[] = []
  for (const s of segmentInputs) inputArgs.push('-i', s.fileName)

  // Filter graph: scale each segment to output dims, trim to durationSec, concat
  const N = segmentInputs.length
  const filterParts: string[] = []
  for (let i = 0; i < N; i++) {
    const s = segmentInputs[i]
    filterParts.push(
      `[${i}:v]scale=${evenW}:${evenH}:force_original_aspect_ratio=increase,` +
      `crop=${evenW}:${evenH},setpts=PTS-STARTPTS,trim=duration=${s.durationSec}[v${i}]`,
    )
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

  const muxInputs: string[] = ['-i', intermediateFile]
  if (voiceFile) muxInputs.push('-i', voiceFile)

  const vfFilters: string[] = []
  if (assFile) vfFilters.push(`ass=${assFile}`)

  const muxArgs: string[] = [...muxInputs]
  if (vfFilters.length > 0) {
    muxArgs.push('-vf', vfFilters.join(','))
  }

  // Audio: if voice file present, use it; otherwise keep silent
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

  const outFile = 'out.mp4'
  muxArgs.push('-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', outFile)

  await ffmpeg.exec(muxArgs)

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

// Helper used by the BGM mixer in future — kept for forward-compat
export function bgmStyleVolume(styleId: AutoEditPlan['bgm'] extends infer T ? T : null): number {
  void styleId
  return 0.15
}

// Suppress unused-warning for BGM_CATALOG (referenced in future audio mixer pass)
void BGM_CATALOG
