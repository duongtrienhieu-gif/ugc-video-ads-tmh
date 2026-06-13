// ── Hybrid assemble flow (P3e) ───────────────────────────────────────────────
// Shared by Bước "Tạo Video" ("Tạo video →") and the Export step ("Ghép lại"):
// turn the persisted hybrid state (rendered clips + stickers + master voice) into
// the final MP4. 0 credit (local ffmpeg + canvas). Renders sticker PNGs, places
// them on the timeline (word-align → quote estimate, ≥3s dedup), then assembles.
// ─────────────────────────────────────────────────────────────────────────────

import { assembleHybridVideo, type HybridSceneClip, type HybridStickerPlacement } from './hybridAssembler'
import { renderStickerBlob, type StickerStyle } from './stickerRenderer'
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
  const out: HybridStickerPlacement[] = []
  let last = -Infinity
  for (const { stk, at } of dated) {
    if (at - last < 3.0) continue            // ≥ sticker duration so they don't stack
    last = at
    try {
      const blob = await renderStickerBlob({ style: stk.style as StickerStyle, text: stk.text ?? '', items: stk.items })
      out.push({ pngRef: await saveAsset(blob, 'image/png'), atSec: at, durationSec: 2.7, heightFraction: 0.1 })
    } catch { /* skip a bad sticker */ }
  }
  return out
}

/** Assemble the final MP4 from the current hybrid state. Throws if not ready
 *  (no voice, or a scene still unrendered). Returns the final video asset ref. */
export async function assembleFromHybridState(
  hybrid: HybridState, script: GeneratedScript, resolution: '480p' | '720p' | '1080p',
): Promise<string> {
  const sc = hybrid.scenes ?? []
  if (!hybrid.voiceRef) throw new Error('Chưa có giọng (Tạo giọng + mặt trước)')
  if (sc.length === 0) throw new Error('Chưa có cảnh nào')
  if (sc.some((_, i) => !hybrid.clips[i])) throw new Error('Còn cảnh chưa render — render hết đã')
  const realDur = hybrid.voiceDurationSec ?? script.totalDurationSec
  const clips: HybridSceneClip[] = sc.map((scene, i) => ({ scene, videoRef: hybrid.clips[i] }))
  const placements = await buildStickerPlacements(hybrid.stickers, hybrid.voiceAlignment, realDur, script)
  const r = await assembleHybridVideo({
    clips, voiceRef: hybrid.voiceRef, voiceDurationSec: realDur, resolution, stickers: placements,
  })
  return r.videoRef
}
