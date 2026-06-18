// ── Hybrid assemble flow (P3e) ───────────────────────────────────────────────
// Shared by Bước "Tạo Video" ("Tạo video →") and the Export step ("Ghép lại"):
// turn the persisted hybrid state (rendered clips + stickers + master voice) into
// the final MP4. 0 credit (local ffmpeg + canvas). Renders sticker PNGs, places
// them on the timeline (word-align → quote estimate, ≥3s dedup), then assembles.
// ─────────────────────────────────────────────────────────────────────────────

import { assembleHybridVideo, type HybridSceneClip, type HybridStickerPlacement, type HybridCaptionPlacement } from './hybridAssembler'
import { renderStickerBlob, type StickerStyle } from './stickerRenderer'
import { renderCaptionBlob, deriveCaptionHighlights, ensureCaptionFonts } from './captionRenderer'
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

// P5s — sticker↔caption de-dup. A sticker that just repeats the words being spoken (and
// burned as a caption) at the same moment is dead weight (the user audited "trùng 100% →
// sticker vô nghĩa"). Drop any sticker ITEM whose words are ≥60% covered by the caption
// visible during its window. Caption wins (it's voice-synced); the sticker only survives
// if it adds NEW words (a stat/ingredient/offer the caption doesn't already show).
const stkWords = (s: string): string[] =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1)
function coveredByCaption(text: string, at: number, dur: number, chunks: { text: string; startSec: number; endSec: number }[]): boolean {
  const overlap = chunks.filter((c) => c.endSec > at && c.startSec < at + dur)
  if (!overlap.length) return false
  const capWords = new Set(overlap.flatMap((c) => stkWords(c.text)))
  const sw = stkWords(text)
  if (!sw.length) return false
  const inter = sw.filter((w) => capWords.has(w)).length
  return inter / sw.length >= 0.6
}

async function buildStickerPlacements(
  raw: BrollSticker[], alignment: VoiceAlignment | undefined, realDur: number, script: GeneratedScript,
  captionChunks: { text: string; startSec: number; endSec: number }[] = [],
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
    let label = (stk.items && stk.items.length > 0) ? stk.items : (stk.text ? [stk.text] : [])
    // P5s — drop item(s) the caption already shows at this moment (no on-screen echo).
    if (captionChunks.length) label = label.filter((it) => !coveredByCaption(it, at, 3, captionChunks))
    if (label.length === 0) continue   // every item echoed the caption → skip the sticker
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
  // P6b — karaoke: emit ONE placement per WORD (accent box behind the spoken word),
  // timed to the per-word alignment, instead of one static placement per phrase chunk.
  karaoke = false,
): Promise<HybridCaptionPlacement[]> {
  const fallback = script.blocks.map((b) => b.text).join(' ')
  const chunks = buildCaptionChunks(alignment, fallback, realDur)

  // P6b/P6g — build the FULL frame list first (static = 1/chunk; karaoke = 1/word), then
  // render with BOUNDED CONCURRENCY. The old per-word loop awaited font-ready + PNG-encode +
  // IndexedDB save sequentially for 100+ word-frames → it saturated the main thread with no
  // progress and looked frozen at "Tạo phụ đề… 0%" (the karaoke hang). Concurrency overlaps
  // the encode/save waits so it finishes in a few seconds; `wi:-1` = static (no karaoke box).
  // wi = the active-word index WITHIN the chunk to box (karaoke), or -1 for a static frame.
  type CapTask = { text: string; wi: number; atSec: number; durationSec: number }
  const tasks: CapTask[] = []
  for (const ch of chunks) {
    const text = ch.text.trim()
    if (!text) continue
    const mid = (ch.startSec + ch.endSec) / 2
    if (skipWindows.some((w) => mid >= w.startSec && mid < w.endSec)) continue   // skip social-proof card window
    if (karaoke && ch.words.length > 0) {
      ch.words.forEach((w, k) => tasks.push({ text, wi: k, atSec: w.startSec, durationSec: Math.max(0.1, w.endSec - w.startSec) }))
    } else {
      tasks.push({ text, wi: -1, atSec: ch.startSec, durationSec: Math.max(0.4, ch.endSec - ch.startSec) })
    }
  }

  await ensureCaptionFonts()   // warm fonts ONCE, not per frame
  const out: (HybridCaptionPlacement | null)[] = new Array(tasks.length).fill(null)
  let next = 0
  const worker = async (): Promise<void> => {
    for (let my = next++; my < tasks.length; my = next++) {
      const t = tasks[my]
      try {
        const blob = await renderCaptionBlob(t.text, presetId, highlightTerms, t.wi < 0 ? undefined : t.wi)
        out[my] = { pngRef: await saveAsset(blob, 'image/png'), atSec: t.atSec, durationSec: t.durationSec }
      } catch { /* skip a bad frame — never break the assemble */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, tasks.length) }, worker))
  return out.filter((p): p is HybridCaptionPlacement => p !== null)
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
  // P5k — captions default ON (absent = on); preset defaults to Clean White.
  const captionsOn = hybrid.captionsOn !== false
  const presetId = hybrid.captionPreset ?? DEFAULT_CAPTION_PRESET
  // P5s — caption chunks computed up-front so stickers can de-dup against them (drop a
  // sticker that just echoes the spoken caption at its moment). Same chunks the captions use.
  const capDedupChunks = captionsOn
    ? buildCaptionChunks(hybrid.voiceAlignment, script.blocks.map((b) => b.text).join(' '), realDur)
    : []
  const placements = await buildStickerPlacements(hybrid.stickers, hybrid.voiceAlignment, realDur, script, capDedupChunks)
  opts?.onStage?.(captionsOn ? 'Tạo phụ đề…' : 'Bỏ qua phụ đề…')
  const cardWindows = sc
    .filter((s) => s.role === 'social_proof')
    .map((s) => ({ startSec: s.startSec, endSec: s.endSec }))
  // P5y (ii) — caption keyword highlight: colour the script's KEY terms (from the anchor).
  const highlightTerms = deriveCaptionHighlights(script.anchor, script.blocks.map((b) => b.text).join(' '))
  const captions = captionsOn
    ? await buildCaptionPlacements(hybrid.voiceAlignment, script, realDur, presetId, cardWindows, highlightTerms, hybrid.captionKaraoke === true)
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
