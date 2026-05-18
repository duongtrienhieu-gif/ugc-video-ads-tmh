// ── Subtitle Engine ──────────────────────────────────────────────────────────
// Z34 §5 — Generate caption segments from the Phase 2 script + voice
// timeline. Each caption is 2-5 words long (TikTok-native chunk size) and
// occupies a time window on the edit timeline.
//
// Emphasis rules (Z34 §5 word emphasis):
//   • Words inside the HOOK block always emphasised
//   • Words inside the CTA block always emphasised
//   • Trigger keywords (from action presets) emphasised when in mid blocks
//   • EmphasisRate from editing style decides how aggressive
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GeneratedScript, ScriptBlock, CaptionSegment, ScriptBlockId,
} from '../types'
import { ACTION_PRESETS } from './actionPresets'

interface BuildCaptionParams {
  script: GeneratedScript
  /** Time offset on the edit timeline where the script's HOOK block starts.
   *  Usually 0 — but if there's a silent intro, set this higher. */
  scriptStartSec: number
  /** Words per caption chunk. TikTok-native default 3. */
  wordsPerChunk?: number
  /** Emphasis rate from the editing style (0-1) */
  emphasisRate: number
}

/**
 * Z34 — Build word-level caption segments aligned to voice timeline.
 *
 * Strategy:
 *   For each block:
 *     1. Compute the block's start offset on the edit timeline
 *     2. Split block.text into chunks of `wordsPerChunk` words
 *     3. Distribute the block's estDurationSec evenly across chunks
 *     4. Emit one CaptionSegment per chunk with emphasis flags
 */
export function buildCaptionSegments(params: BuildCaptionParams): CaptionSegment[] {
  const { script, scriptStartSec, emphasisRate } = params
  const wordsPerChunk = Math.max(1, params.wordsPerChunk ?? 3)
  const segments: CaptionSegment[] = []
  let cursor = scriptStartSec

  for (const block of script.blocks) {
    const blockStart = cursor
    const blockDuration = block.estDurationSec
    const chunks = chunkText(block.text, wordsPerChunk)
    if (chunks.length === 0) {
      cursor += blockDuration
      continue
    }
    const perChunk = blockDuration / chunks.length

    for (let i = 0; i < chunks.length; i++) {
      const start = blockStart + i * perChunk
      const end = blockStart + (i + 1) * perChunk
      const emphasised = shouldEmphasise(block, chunks[i], emphasisRate)
      segments.push({
        startSec: round2(start),
        endSec: round2(end),
        text: chunks[i],
        emphasised,
        emphasisReason: emphasised ? emphasisReason(block.id) : null,
      })
    }
    cursor = blockStart + blockDuration
  }

  return segments
}

/** Split text into ~N-word chunks, preserving punctuation. */
function chunkText(text: string, n: number): string[] {
  const cleaned = text.trim()
  if (!cleaned) return []
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const chunks: string[] = []
  for (let i = 0; i < tokens.length; i += n) {
    chunks.push(tokens.slice(i, i + n).join(' '))
  }
  return chunks
}

/** Emphasise if:
 *   - block is HOOK or CTA (always emphasis-heavy)
 *   - OR text contains an action-preset trigger keyword
 *   - OR random sample below emphasisRate (gradient density)
 */
function shouldEmphasise(
  block: ScriptBlock,
  chunkText: string,
  emphasisRate: number,
): boolean {
  // Hook + CTA: always emphasise the FIRST chunk in each
  if (block.id === 'hook' || block.id === 'cta') {
    return true
  }
  // Mid blocks: check action-preset keywords
  const lc = chunkText.toLowerCase()
  for (const preset of Object.values(ACTION_PRESETS)) {
    for (const kw of preset.triggerKeywords) {
      if (lc.includes(kw)) return true
    }
  }
  // Else: probability gate from style's emphasisRate
  return Math.random() < emphasisRate * 0.5  // halve the chance — emphasis is rare
}

function emphasisReason(blockId: ScriptBlockId): CaptionSegment['emphasisReason'] {
  if (blockId === 'hook') return 'hook'
  if (blockId === 'cta') return 'cta'
  return 'keyword'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
