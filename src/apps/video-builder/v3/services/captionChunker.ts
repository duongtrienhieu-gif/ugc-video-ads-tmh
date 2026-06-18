// ── Caption chunker (P5k Part B) ─────────────────────────────────────────────
// Splits the SPOKEN text into readable phrase chunks (3-7 words, ≤2 lines) and times
// each chunk. ZERO text drift: the text comes from the REAL spoken transcript
// (voiceAlignment.text = exactly what ElevenLabs read) or, as a fallback, the script
// text itself — NEVER a translation. Timing comes from the per-char alignment when
// available, else an even spread across the real duration.
//
// This is the fix for the old burner's flicker: it chunked at WORD level driven by
// the fast voice → each word flashed ~0.1s. Here chunks are PHRASES held for their
// whole span and made CONTINUOUS (each chunk runs until the next begins → no blank
// gaps, no flash). WE control the chunk size, not the reading speed.
// ─────────────────────────────────────────────────────────────────────────────

import type { VoiceAlignment } from '../types'

export interface CaptionWord {
  text: string
  startSec: number
  endSec: number
}
export interface CaptionChunk {
  text: string
  startSec: number
  endSec: number
  /** P6b — per-word timing for karaoke (gapless: each word runs until the next starts,
   *  the last until the chunk ends). Same order as the words joined in `text`. */
  words: CaptionWord[]
}

const MAX_WORDS = 6        // close a chunk after this many words…
const MAX_CHARS = 30       // …or this many characters, whichever first
const SENTENCE_END = /[.!?…]$/

// Group a word list into phrase chunks (returns arrays of word-objects with offsets).
function groupWords(
  words: { text: string; start: number; end: number }[],
): { text: string; start: number; end: number }[][] {
  const chunks: typeof words[] = []
  let cur: typeof words = []
  let chars = 0
  for (const w of words) {
    cur.push(w)
    chars += w.text.length + 1
    const longEnough = cur.length >= MAX_WORDS || chars >= MAX_CHARS
    const sentenceBreak = SENTENCE_END.test(w.text)
    if (sentenceBreak || longEnough) {
      chunks.push(cur)
      cur = []
      chars = 0
    }
  }
  if (cur.length) chunks.push(cur)
  return chunks
}

/** Build timed caption chunks from the real spoken alignment. Falls back to an even
 *  spread of `fallbackText` across `realDur` when there is no usable alignment. */
export function buildCaptionChunks(
  alignment: VoiceAlignment | undefined,
  fallbackText: string,
  realDur: number,
): CaptionChunk[] {
  const dur = realDur > 0 ? realDur : 0
  // ── Path 1: real alignment (zero drift + accurate timing) ──────────────────
  if (alignment && alignment.text && alignment.charStartSecs?.length) {
    const text = alignment.text
    const t = alignment.charStartSecs
    const charSec = (i: number) => t[Math.max(0, Math.min(i, t.length - 1))]
    // Tokenise into words WITH their char offsets in `text`.
    const words: { text: string; start: number; end: number }[] = []
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      words.push({ text: m[0], start: charSec(m.index), end: charSec(m.index + m[0].length) })
    }
    if (words.length === 0) return []
    const grouped = groupWords(words)
    const chunks: CaptionChunk[] = grouped.map((g) => ({
      text: g.map((w) => w.text).join(' '),
      startSec: g[0].start,
      endSec: g[g.length - 1].end,
      words: g.map((w) => ({ text: w.text, startSec: w.start, endSec: w.end })),
    }))
    // Make continuous: each chunk shows until the next begins (no blank gaps / flash).
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].endSec = i + 1 < chunks.length ? chunks[i + 1].startSec : (dur || chunks[i].endSec)
      if (chunks[i].endSec <= chunks[i].startSec) chunks[i].endSec = chunks[i].startSec + 0.6
      makeWordsContinuous(chunks[i])
    }
    return chunks
  }

  // ── Path 2: fallback — even spread of the script text (still verbatim, no drift) ─
  const clean = (fallbackText ?? '').trim()
  if (!clean || dur <= 0) return []
  const words = clean.split(/\s+/).map((w) => ({ text: w, start: 0, end: 0 }))
  const grouped = groupWords(words)
  const totalChars = grouped.reduce((s, g) => s + g.reduce((n, w) => n + w.text.length + 1, 0), 0) || 1
  let acc = 0
  return grouped.map((g) => {
    const gChars = g.reduce((n, w) => n + w.text.length + 1, 0)
    const startSec = (acc / totalChars) * dur
    acc += gChars
    const endSec = (acc / totalChars) * dur
    // P6b — no real per-word timing in this path → spread the words evenly across the
    // chunk by char length so karaoke still advances roughly with the voice (degrades
    // gracefully; the alignment path above is the tight one).
    const span = Math.max(0.001, endSec - startSec)
    const chunkChars = gChars || 1
    let wAcc = 0
    const cwords: CaptionWord[] = g.map((w) => {
      const wStart = startSec + (wAcc / chunkChars) * span
      wAcc += w.text.length + 1
      const wEnd = startSec + (wAcc / chunkChars) * span
      return { text: w.text, startSec: wStart, endSec: wEnd }
    })
    return { text: g.map((w) => w.text).join(' '), startSec, endSec, words: cwords }
  })
}

/** P6b — make a chunk's word timings gapless + monotonic inside [chunk.start, chunk.end]:
 *  each word shows until the NEXT word begins, the last until the chunk ends. Clamps any
 *  noisy alignment value so karaoke never jumps backwards or leaves a gap. */
function makeWordsContinuous(chunk: CaptionChunk): void {
  const w = chunk.words
  if (!w.length) return
  let prev = chunk.startSec
  for (let i = 0; i < w.length; i++) {
    w[i].startSec = Math.min(Math.max(w[i].startSec, prev), chunk.endSec)
    prev = w[i].startSec
  }
  for (let i = 0; i < w.length; i++) {
    w[i].endSec = i + 1 < w.length ? w[i + 1].startSec : chunk.endSec
    if (w[i].endSec <= w[i].startSec) w[i].endSec = w[i].startSec + 0.12
  }
}
