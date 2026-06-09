// ── Export Package Builder ───────────────────────────────────────────────────
// Z35 §11 — Bundle all export artifacts (SRT, plain-text script, hook,
// CTA, thumbnail) for a chosen format + quality.
//
// What this DOES NOT do (yet):
//   • Encode the final MP4 from the auto-edit plan — that's Phase 7
//     ffmpeg.wasm work. videoRef stays null for now; caller can pull the
//     creator-video lipsync MP4 as a quick-fallback "preview export" so
//     the user has SOMETHING to ship today.
//
// What this DOES:
//   • Generate SRT subtitles from AutoEditPlan.captions
//   • Build plain-text script
//   • Resolve picked hook + picked CTA → final strings for ads ops
//   • Render thumbnail
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ExportPackage, ExportFormatId, ExportQualityId,
  AutoEditPlan, GeneratedScript, CtaVariation, HookVariant,
  ThumbnailStyleId,
} from '../types'
import { buildSrtFromCaptions, buildPlainTextScript } from './srtExporter'
import { buildAndRenderThumbnail } from './thumbnailEngine'

export interface BuildExportPackageParams {
  formatId: ExportFormatId
  qualityId: ExportQualityId
  plan: AutoEditPlan
  script: GeneratedScript
  /** Phase 2 hook variants list — pickedHookIdx selects one */
  hookVariants: HookVariant[]
  /** Index into hookVariants (or -1 = use script's own HOOK block) */
  pickedHookIdx: number
  /** Phase 6 CTA variations — pickedCtaIdx selects one */
  ctaVariations: CtaVariation[]
  /** Index into ctaVariations (or -1 = use script's own CTA block) */
  pickedCtaIdx: number
  /** Source ref for the thumbnail — creator video keyframe is ideal */
  thumbnailSourceRef: string | null
  thumbnailStyleId: ThumbnailStyleId
  /** Z89 — if the user picked an AI thumbnail, use it directly (skip canvas). */
  pickedThumbnailRef?: string | null
  /** Optional override for the existing creator-video MP4 (used as a
   *  fallback videoRef until Phase 7 ffmpeg.wasm encodes the full plan). */
  creatorVideoRef?: string | null
}

export async function buildExportPackage(
  params: BuildExportPackageParams,
): Promise<ExportPackage> {
  // ── 1. SRT subtitles ─────────────────────────────────────────────────
  const srtContent = buildSrtFromCaptions(params.plan.captions)

  // ── 2. Plain-text script (after hook/CTA override) ───────────────────
  const blocks = params.script.blocks.map((b) => {
    if (b.id === 'hook' && params.pickedHookIdx >= 0) {
      const v = params.hookVariants[params.pickedHookIdx]
      return { id: b.id, text: v?.text ?? b.text }
    }
    if (b.id === 'cta' && params.pickedCtaIdx >= 0) {
      const v = params.ctaVariations[params.pickedCtaIdx]
      return { id: b.id, text: v?.text ?? b.text }
    }
    return { id: b.id, text: b.text }
  })
  const plainTextScript = buildPlainTextScript(blocks)

  // ── 3. Hook + CTA final strings (separate from script for ads-ops list) ─
  const hookBlock = blocks.find((b) => b.id === 'hook')
  const ctaBlock = blocks.find((b) => b.id === 'cta')
  const hookText = hookBlock?.text ?? ''
  const ctaText = ctaBlock?.text ?? ''

  // ── 4. Thumbnail ─────────────────────────────────────────────────────
  let thumbnail = null
  if (params.pickedThumbnailRef) {
    // Z89 — user picked an AI-generated thumbnail; use it directly.
    thumbnail = {
      styleId: params.thumbnailStyleId,
      sourceRef: params.pickedThumbnailRef,
      headlineText: (hookText || '').slice(0, 60),
      imageRef: params.pickedThumbnailRef,
      generatedAt: Date.now(),
    }
  } else if (params.thumbnailSourceRef) {
    try {
      // Use the picked hook text as the thumbnail headline — strongest
      // attention-grabber for ad context.
      // Fall back through hook → first block (both in the script's output
      // language); never inject an English literal as a last resort.
      const headline = (hookText || params.script.blocks[0]?.text || '')
        .split(/[.!?\n]/)[0]
        .trim()
        .slice(0, 60)
      thumbnail = await buildAndRenderThumbnail(
        params.thumbnailStyleId,
        params.thumbnailSourceRef,
        headline,
      )
    } catch (err) {
      console.warn('[EXPORT] thumbnail render failed', err)
    }
  }

  // ── 5. Assemble package ──────────────────────────────────────────────
  const pkg: ExportPackage = {
    formatId: params.formatId,
    qualityId: params.qualityId,
    // For now we point videoRef at the creator-video MP4 as a placeholder
    // so the user has SOMETHING to download until Phase 7 wires ffmpeg.wasm.
    videoRef: params.creatorVideoRef ?? null,
    srtContent,
    plainTextScript,
    hookText,
    ctaText,
    thumbnail,
    durationSec: params.plan.totalDurationSec,
    createdAt: Date.now(),
  }

  console.log(
    `[EXPORT] package built · format=${pkg.formatId} quality=${pkg.qualityId} ` +
    `duration=${pkg.durationSec.toFixed(1)}s srt=${pkg.srtContent.length}chars ` +
    `thumb=${pkg.thumbnail ? 'yes' : 'no'} mp4=${pkg.videoRef ? 'fallback(creator)' : 'none'}`
  )
  return pkg
}

// ── Helpers: download from package ──────────────────────────────────────

/**
 * Trigger a download of the SRT subtitle file.
 */
export function downloadSrt(pkg: ExportPackage, filename = 'subtitles.srt'): void {
  downloadString(pkg.srtContent, filename, 'application/x-subrip')
}

export function downloadPlainTextScript(pkg: ExportPackage, filename = 'script.txt'): void {
  downloadString(pkg.plainTextScript, filename, 'text/plain')
}

/** Download a single asset ref (resolves to a blob URL then triggers download). */
export async function downloadAssetAs(
  assetUrl: string | null,
  filename: string,
): Promise<void> {
  if (!assetUrl) throw new Error('Asset không tồn tại')
  const a = document.createElement('a')
  a.href = assetUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function downloadString(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
