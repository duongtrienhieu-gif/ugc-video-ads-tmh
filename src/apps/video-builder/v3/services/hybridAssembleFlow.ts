// ── Hybrid assemble flow (P3e) ───────────────────────────────────────────────
// Shared by Bước "Tạo Video" ("Tạo video →") and the Export step ("Ghép lại"):
// turn the persisted hybrid state (rendered clips + stickers + master voice) into
// the final MP4. 0 credit (local ffmpeg + canvas). Renders sticker PNGs, places
// them on the timeline (word-align → quote estimate, ≥3s dedup), then assembles.
// ─────────────────────────────────────────────────────────────────────────────

import { assembleHybridVideo, type HybridSceneClip, type HybridStickerPlacement, type HybridCaptionPlacement } from './hybridAssembler'
import { renderStickerBlob, type StickerStyle } from './stickerRenderer'
import { renderCaptionBlob, deriveCaptionHighlights } from './captionRenderer'
import { renderBannerBlob, deriveBannerSlogan } from './bannerRenderer'
import { BANNER_PRESETS, DEFAULT_BANNER_PRESET } from './bannerPresets'
import { buildCaptionChunks } from './captionChunker'
import './socialProofRenderer'   // P5v — registers __testSocialProof + bundles the card renderer (wired in a later step)
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
  // P5w — time windows of social-proof CARD scenes: skip captions there (the card is a
  // full-frame FB-post with its own text; a burned caption on top would clutter it).
  skipWindows: { startSec: number; endSec: number }[] = [],
  // P5y (ii) — script keywords (from the anchor) to colour-highlight inside any chunk.
  highlightTerms: string[] = [],
): Promise<HybridCaptionPlacement[]> {
  const fallback = script.blocks.map((b) => b.text).join(' ')
  const chunks = buildCaptionChunks(alignment, fallback, realDur)
  const out: HybridCaptionPlacement[] = []
  for (const ch of chunks) {
    const text = ch.text.trim()
    if (!text) continue
    // drop a chunk whose midpoint falls inside a social-proof card window
    const mid = (ch.startSec + ch.endSec) / 2
    if (skipWindows.some((w) => mid >= w.startSec && mid < w.endSec)) continue
    try {
      const blob = await renderCaptionBlob(text, presetId, highlightTerms)
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
  // P5x — `bannerSlogan` is the top-banner text computed by the caller (product name ·
  // benefit) so the export preview chip and the rendered banner are identical.
  opts?: { onProgress?: (ratio: number) => void; onStage?: (label: string) => void; bannerSlogan?: string },
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
  const cardWindows = sc
    .filter((s) => s.role === 'social_proof')
    .map((s) => ({ startSec: s.startSec, endSec: s.endSec }))
  // P5y (ii) — caption keyword highlight: colour the script's KEY terms (from the anchor).
  const highlightTerms = deriveCaptionHighlights(script.anchor)
  const captions = captionsOn
    ? await buildCaptionPlacements(hybrid.voiceAlignment, script, realDur, presetId, cardWindows, highlightTerms)
    : []
  // P5x — top hook banner: a short slogan from the script's KEY (anchor → hook fallback),
  // rendered as ONE PNG and held over every non-card segment. Default ON; 0 credit.
  const bannerOn = hybrid.bannerOn !== false
  let banner: { pngRef: string; fullWidth: boolean } | undefined
  if (bannerOn) {
    // Prefer the caller-computed slogan (product name · benefit); fall back to the
    // anchor alone when none was passed (the service has no product context).
    const slogan = (opts?.bannerSlogan ?? '').trim() || deriveBannerSlogan(undefined, script.anchor, script.blocks[0]?.text)
    if (slogan) {
      const bpid = hybrid.bannerPreset ?? DEFAULT_BANNER_PRESET
      try {
        const blob = await renderBannerBlob(slogan, bpid)
        banner = { pngRef: await saveAsset(blob, 'image/png'), fullWidth: BANNER_PRESETS[bpid].shape === 'ribbon' }
      } catch { /* a bad banner never breaks the assemble */ }
    }
  }
  const r = await assembleHybridVideo({
    clips, voiceRef: hybrid.voiceRef, voiceDurationSec: realDur, resolution,
    stickers: placements, captions, banner,
    onProgress: opts?.onProgress,
    onStage: opts?.onStage,
  })
  return r.videoRef
}
