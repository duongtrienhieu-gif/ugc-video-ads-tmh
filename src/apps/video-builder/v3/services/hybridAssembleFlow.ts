// ── Hybrid assemble flow (P3e) ───────────────────────────────────────────────
// Shared by Bước "Tạo Video" ("Tạo video →") and the Export step ("Ghép lại"):
// turn the persisted hybrid state (rendered clips + stickers + master voice) into
// the final MP4. 0 credit (local ffmpeg + canvas). Renders sticker PNGs, places
// them on the timeline (word-align → quote estimate, ≥3s dedup), then assembles.
// ─────────────────────────────────────────────────────────────────────────────

import { assembleHybridVideo, type HybridSceneClip, type HybridStickerPlacement, type HybridCaptionPlacement } from './hybridAssembler'
import { renderStickerBlob, type StickerStyle } from './stickerRenderer'
import { renderCaptionBlob } from './captionRenderer'
import { buildCaptionChunks } from './captionChunker'
import { DEFAULT_CAPTION_PRESET, type CaptionPresetId } from './captionPresets'
import { computeWordTimestampFromAlignment, computeQuoteTimestamp } from './insertTimingEngine'
import { saveAsset } from '../../../../utils/assetStore'
import type { HybridState, GeneratedScript } from '../types'
import type { BrollSticker } from './brollDirector'
import type { VoiceAlignment } from '../types'

async function buildStickerPlacements(
  raw: BrollSticker[], alignment: VoiceAlignment | undefined, realDur: number, script: GeneratedScript,
): Promise<HybridStickerPlacement[]> {
  const dated = raw
    .map((stk) => {
      const at = (alignment ? computeWordTimestampFromAlignment(alignment, stk.quote, stk.wordAnchor) : null)
        ?? computeQuoteTimestamp(script, stk.quote)
      return { stk, at }
    })
    .filter((x): x is { stk: BrollSticker; at: number } => typeof x.at === 'number' && x.at < realDur)
    .sort((a, b) => a.at - b.at)

  // P4c — was: DROP any sticker within 3s of the previous one → 8 stickers became
  // 4 (the user audited the loss; the CTA burst "179k / tặng kèm / 139k / quà"
  // all land within ~3s → only 1 survived). Now we GROUP stickers that fall
  // within MERGE_WINDOW into ONE stacked LIST card instead of dropping them — so
  // EVERY sticker's info stays on screen, just consolidated when they cluster.
  // Spread-out stickers still pop individually (livelier, as the user wants).
  const MERGE_WINDOW = 2.0   // stickers closer than this share one list card
  type Group = { at: number; items: string[] }
  const groups: Group[] = []
  for (const { stk, at } of dated) {
    const label = (stk.items && stk.items.length > 0) ? stk.items : (stk.text ? [stk.text] : [])
    if (label.length === 0) continue
    const g = groups[groups.length - 1]
    if (g && at - g.at < MERGE_WINDOW) {
      g.items.push(...label)               // merge into the current card (no drop)
    } else {
      groups.push({ at, items: [...label] })
    }
  }

  const out: HybridStickerPlacement[] = []
  for (const g of groups) {
    const isList = g.items.length > 1
    try {
      const blob = await renderStickerBlob({
        style: (isList ? 'list' : 'badge') as StickerStyle,
        text: isList ? '' : g.items[0],
        items: isList ? g.items : undefined,
      })
      out.push({
        pngRef: await saveAsset(blob, 'image/png'),
        atSec: g.at,
        // A consolidated list card holds longer (more to read) + sits taller so
        // multiple lines stay legible; a single badge keeps the original size.
        durationSec: isList ? 3.4 : 2.7,
        heightFraction: isList ? Math.min(0.30, 0.10 + 0.045 * (g.items.length - 1)) : 0.10,
      })
    } catch { /* skip a bad sticker */ }
  }
  return out
}

// P5k — burned captions: chunk the REAL spoken text (voiceAlignment.text = verbatim,
// zero drift, NEVER a translation; falls back to the script text) into phrase chunks,
// render each as a transparent PNG (0 credit), place it on the timeline. Applied at
// assemble so changing the preset / re-exporting costs no render credit.
async function buildCaptionPlacements(
  alignment: VoiceAlignment | undefined, script: GeneratedScript, realDur: number,
  presetId: CaptionPresetId,
): Promise<HybridCaptionPlacement[]> {
  const fallback = script.blocks.map((b) => b.text).join(' ')
  const chunks = buildCaptionChunks(alignment, fallback, realDur)
  const out: HybridCaptionPlacement[] = []
  for (const ch of chunks) {
    const text = ch.text.trim()
    if (!text) continue
    try {
      const blob = await renderCaptionBlob(text, presetId)
      out.push({
        pngRef: await saveAsset(blob, 'image/png'),
        atSec: ch.startSec,
        durationSec: Math.max(0.4, ch.endSec - ch.startSec),
      })
    } catch { /* skip a bad chunk — never break the assemble */ }
  }
  return out
}

/** Assemble the final MP4 from the current hybrid state. Throws if not ready
 *  (no voice, or a scene still unrendered). Returns the final video asset ref. */
export async function assembleFromHybridState(
  hybrid: HybridState, script: GeneratedScript, resolution: '480p' | '720p' | '1080p',
  // P4b — real assemble progress: `onProgress` is the ffmpeg ratio (0-1, the bulk
  // is the per-clip normalize loop = genuinely accurate), `onStage` is the
  // human-readable phase ("Chuẩn hoá cảnh 3/14…", "Ghép timeline", "Xuất 720p").
  // The UI shows a real % bar + the stage label instead of a blind spinner.
  opts?: { onProgress?: (ratio: number) => void; onStage?: (label: string) => void },
): Promise<string> {
  const sc = hybrid.scenes ?? []
  if (!hybrid.voiceRef) throw new Error('Chưa có giọng (Tạo giọng + mặt trước)')
  if (sc.length === 0) throw new Error('Chưa có cảnh nào')
  if (sc.some((_, i) => !hybrid.clips[i])) throw new Error('Còn cảnh chưa render — render hết đã')
  const realDur = hybrid.voiceDurationSec ?? script.totalDurationSec
  const clips: HybridSceneClip[] = sc.map((scene, i) => ({ scene, videoRef: hybrid.clips[i] }))
  const placements = await buildStickerPlacements(hybrid.stickers, hybrid.voiceAlignment, realDur, script)
  // P5k — captions default ON (absent = on); preset defaults to Clean White.
  const captionsOn = hybrid.captionsOn !== false
  const presetId = hybrid.captionPreset ?? DEFAULT_CAPTION_PRESET
  opts?.onStage?.(captionsOn ? 'Tạo phụ đề…' : 'Bỏ qua phụ đề…')
  const captions = captionsOn
    ? await buildCaptionPlacements(hybrid.voiceAlignment, script, realDur, presetId)
    : []
  const r = await assembleHybridVideo({
    clips, voiceRef: hybrid.voiceRef, voiceDurationSec: realDur, resolution,
    stickers: placements, captions,
    onProgress: opts?.onProgress,
    onStage: opts?.onStage,
  })
  return r.videoRef
}
