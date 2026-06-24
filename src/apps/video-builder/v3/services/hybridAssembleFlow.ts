// ── Hybrid assemble flow (P3e) ───────────────────────────────────────────────
// Shared by Bước "Tạo Video" ("Tạo video →") and the Export step ("Ghép lại"):
// turn the persisted hybrid state (rendered clips + master voice) into the final
// MP4. 0 credit (local ffmpeg + canvas). Burns captions + the top banner, then
// assembles. (P6p — the sticker layer was removed from the Ads Video pipeline.)
// ─────────────────────────────────────────────────────────────────────────────

import { assembleHybridVideo, type HybridSceneClip, type HybridCaptionPlacement } from './hybridAssembler'
import { resetFFmpeg } from './ffmpegLoader'
import { renderCaptionBlob, deriveCaptionHighlights, ensureCaptionFonts } from './captionRenderer'
import { renderBannerBlob, deriveBannerSlogan } from './bannerRenderer'
import { renderCommentCardBlob } from './commentCardRenderer'
import { BANNER_PRESETS, DEFAULT_BANNER_PRESET } from './bannerPresets'
import { buildCaptionChunks } from './captionChunker'
import './socialProofRenderer'   // P5v — registers __testSocialProof + bundles the card renderer (wired in a later step)
import { DEFAULT_CAPTION_PRESET, type CaptionPresetId } from './captionPresets'
import { saveAsset } from '../../../../utils/assetStore'
import type { HybridState, GeneratedScript } from '../types'
import type { VoiceAlignment } from '../types'

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
  // P6v — progress callback: karaoke renders 100+ word PNGs BEFORE ffmpeg starts, so the
  // % bar (ffmpeg-driven) sits at 0% the whole time → looked frozen ("ko biết có tạo dc ko").
  // Report "Tạo phụ đề N/total…" so the user sees it's actually working.
  onStage?: (label: string) => void,
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
  let done = 0   // P6v — shared across workers (single-threaded JS → no race on ++)
  const worker = async (): Promise<void> => {
    for (let my = next++; my < tasks.length; my = next++) {
      const t = tasks[my]
      try {
        const blob = await renderCaptionBlob(t.text, presetId, highlightTerms, t.wi < 0 ? undefined : t.wi)
        out[my] = { pngRef: await saveAsset(blob, 'image/png'), atSec: t.atSec, durationSec: t.durationSec }
      } catch { /* skip a bad frame — never break the assemble */ }
      done++
      if (onStage && (done % 6 === 0 || done === tasks.length)) onStage(`Tạo phụ đề ${done}/${tasks.length}…`)
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
  opts?: { onProgress?: (ratio: number) => void; onStage?: (label: string) => void; bannerSlogan?: string; replyComment?: string },
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
  opts?.onStage?.(captionsOn ? 'Tạo phụ đề…' : 'Bỏ qua phụ đề…')
  const cardWindows = sc
    .filter((s) => s.role === 'social_proof')
    .map((s) => ({ startSec: s.startSec, endSec: s.endSec }))
  // P5y (ii) — caption keyword highlight: colour the script's KEY terms (from the anchor).
  const highlightTerms = deriveCaptionHighlights(script.anchor, script.blocks.map((b) => b.text).join(' '))
  const captions = captionsOn
    ? await buildCaptionPlacements(hybrid.voiceAlignment, script, realDur, presetId, cardWindows, highlightTerms, hybrid.captionKaraoke !== false, opts?.onStage)
    : []
  // P5 reply-to-comment — when answering a comment, the comment card IS the opening hook, so the
  // persistent top slogan banner is suppressed (they'd clash at the top) and the card is rendered.
  const replyMode = !!(opts?.replyComment && opts.replyComment.trim())
  // P5x — top hook banner: a short slogan from the script's KEY (anchor → hook fallback),
  // rendered as ONE PNG and held over every non-card segment. Default ON; 0 credit.
  const bannerOn = hybrid.bannerOn !== false && !replyMode
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
  // P5 reply-to-comment — render the TikTok comment card (0 credit) shown near the top during the
  // OPENING ~4.5s (the creator's spoken reply window), then it disappears.
  let commentCard: { pngRef: string; durationSec: number } | undefined
  if (replyMode) {
    try {
      const blob = await renderCommentCardBlob(opts!.replyComment!.trim())
      commentCard = { pngRef: await saveAsset(blob, 'image/png'), durationSec: Math.min(realDur, 4.5) }
    } catch { /* a bad card never breaks the assemble */ }
  }
  // P6ar — assemble with ONE retry on a FRESH ffmpeg worker. A wasm worker can die
  // mid-export (OOM after a long session, or a corrupt/expired clip) → "ErrnoError:
  // FS error", and the dead singleton then fails EVERY later attempt until a page
  // reload. Resetting between tries lets a transient crash recover automatically; the
  // captions/banner/clips are all assetStore refs (already built) so the retry is cheap.
  let lastErr: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await assembleHybridVideo({
        clips, voiceRef: hybrid.voiceRef, voiceDurationSec: realDur, resolution,
        captions, banner, commentCard,
        onProgress: opts?.onProgress,
        onStage: opts?.onStage,
      })
      return r.videoRef
    } catch (e) {
      lastErr = e
      console.warn(`[HYBRID_ASM] ghép lần ${attempt}/2 lỗi:`, e)
      await resetFFmpeg()   // kill the (possibly crashed/stuck) worker so the retry runs clean
      if (attempt < 2) opts?.onStage?.('Ffmpeg lỗi — thử lại trên tiến trình mới…')
    }
  }
  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(
    `Ghép video thất bại sau 2 lần (ffmpeg). Thường do MỘT cảnh lỗi/clip hỏng. ` +
    `Thử: vào "Sửa cảnh" render lại cảnh nghi lỗi rồi bấm Ghép lại; nếu vẫn lỗi, tải lại trang. (Chi tiết: ${detail.slice(0, 120)})`,
  )
}
