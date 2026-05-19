// ── SRT Exporter ─────────────────────────────────────────────────────────────
// Z35 §11 — Convert AutoEditPlan.captions[] → SRT subtitle file content.
// Caller writes the resulting string into a .srt file and includes it in
// the export package.
//
// SRT format:
//   1
//   00:00:00,000 --> 00:00:02,500
//   First caption text
//
//   2
//   00:00:02,500 --> 00:00:05,000
//   Second caption
//
// (One blank line between entries.)
// ─────────────────────────────────────────────────────────────────────────────

import type { CaptionSegment } from '../types'

/**
 * Z35 — Build an SRT subtitle file from caption segments.
 * Returns the file content as a string.
 */
export function buildSrtFromCaptions(captions: CaptionSegment[]): string {
  if (captions.length === 0) return ''
  // Filter out zero-length captions + sort by startSec
  const valid = captions
    .filter((c) => c.text.trim() && c.endSec > c.startSec)
    .sort((a, b) => a.startSec - b.startSec)

  return valid
    .map((c, i) => {
      const start = secToSrtTimecode(c.startSec)
      const end = secToSrtTimecode(c.endSec)
      // Emphasised captions get HTML-style bold tags (rendered by VLC,
      // most browser players, mpv, etc.)
      const text = c.emphasised ? `<b>${c.text.trim()}</b>` : c.text.trim()
      return `${i + 1}\n${start} --> ${end}\n${text}`
    })
    .join('\n\n') + '\n'
}

/** Convert seconds → "HH:MM:SS,mmm" SRT timecode */
function secToSrtTimecode(totalSec: number): string {
  const ms = Math.round((totalSec - Math.floor(totalSec)) * 1000)
  const totalSecInt = Math.floor(totalSec)
  const hh = Math.floor(totalSecInt / 3600)
  const mm = Math.floor((totalSecInt % 3600) / 60)
  const ss = totalSecInt % 60
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)},${pad3(ms)}`
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0')
}

/** Z35 §11 — Build a plain-text script for the export bundle (for ads
 *  ops + transcript). Concatenates all script blocks with block labels. */
export function buildPlainTextScript(
  blocks: { id: string; text: string }[],
): string {
  return blocks
    .map((b) => `[${b.id.toUpperCase()}]\n${b.text.trim()}`)
    .join('\n\n') + '\n'
}
