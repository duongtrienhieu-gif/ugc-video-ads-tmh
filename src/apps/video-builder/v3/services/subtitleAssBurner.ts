// ── Subtitle ASS Burner ──────────────────────────────────────────────────────
// Z36 §6 — Generate Advanced SubStation Alpha (.ass) subtitle file content
// from AutoEditPlan.captions. ASS supports per-caption styling (font /
// color / size / position / outline) and inline overrides, which the
// simpler SRT format can't represent.
//
// ffmpeg burns ASS subtitles INTO the final MP4 via the `ass` filter:
//   ffmpeg -i video.mp4 -vf "ass=subs.ass" -c:a copy out.mp4
//
// Output styles map to Phase 5 SubtitleStyleId presets:
//   • bold_creator       → Arial Bold 18, white + black outline, center-bottom
//   • minimal            → Roboto Light 12, white, no outline, bottom-third
//   • aggressive_tiktok  → Impact Bold 28, yellow + heavy black outline, ALL CAPS,
//                          shake on emphasised caption
//   • clean_ugc          → Inter Medium 14, white + thin outline, sentence case
//   • none               → empty file (caller skips burn-in)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CaptionSegment, SubtitleStyleId,
} from '../types'

interface AssStyle {
  /** Style block name — referenced by each Dialogue line */
  name: string
  /** Font family (must be available on the encoder; we ship safe defaults) */
  fontName: string
  /** Pixels — ASS uses pixels at the resolution declared in PlayResX/Y */
  fontSize: number
  /** Primary fill color — ASS uses &H<AABBGGRR> format */
  primaryColor: string
  /** Outline color */
  outlineColor: string
  /** Outline thickness in pixels */
  outlineWidth: number
  /** 1 = normal weight, -1 = bold (ASS quirk) */
  bold: boolean
  /** Vertical alignment 1-9 numpad (2 = center bottom, 8 = center top) */
  alignment: 2 | 5 | 8
  /** Vertical margin from edge (in pixels at the declared resolution) */
  marginV: number
}

// Z84 — ALL styles use 'Be Vietnam Pro' (the one .ttf we bundle + load into the
// ffmpeg FS). The old per-style names (Arial Black / Roboto / Impact / Inter)
// don't exist in the wasm FS, so libass rendered NOTHING — that was the
// "subtitles never show" bug. Be Vietnam Pro has full VN diacritics. The styles
// still differ by size / colour / outline / margin, so they remain distinct.
const STYLE_PRESETS: Record<SubtitleStyleId, AssStyle | null> = {
  none: null,
  bold_creator: {
    name: 'BoldCreator',
    fontName: 'Be Vietnam Pro',
    fontSize: 56,
    primaryColor: '&H00FFFFFF',  // white BGR + 00 alpha (ASS quirk)
    outlineColor: '&H00000000',  // black
    outlineWidth: 4,
    bold: true,
    alignment: 2,
    marginV: 200,  // from bottom
  },
  minimal: {
    name: 'Minimal',
    fontName: 'Be Vietnam Pro',
    fontSize: 36,
    primaryColor: '&H00FFFFFF',
    outlineColor: '&H00000000',
    outlineWidth: 2,
    bold: false,
    alignment: 2,
    marginV: 140,
  },
  aggressive_tiktok: {
    name: 'AggressiveTiktok',
    fontName: 'Be Vietnam Pro',
    fontSize: 64,
    primaryColor: '&H0024B5FB',   // tailwind amber-400 (BGR = FB B5 24)
    outlineColor: '&H00000000',
    outlineWidth: 6,
    bold: true,
    alignment: 2,
    marginV: 220,
  },
  clean_ugc: {
    name: 'CleanUGC',
    fontName: 'Be Vietnam Pro',
    fontSize: 46,
    primaryColor: '&H00FAFCF8',   // slate-50ish in BGR
    outlineColor: '&H001B233E',   // slate-900 outline
    outlineWidth: 3,
    bold: true,
    alignment: 2,
    marginV: 180,
  },
}

export interface BuildAssParams {
  captions: CaptionSegment[]
  styleId: SubtitleStyleId
  /** Video resolution — ASS positions everything relative to this. Match the
   *  ffmpeg output resolution for correct scaling. */
  videoWidth: number
  videoHeight: number
}

/**
 * Z36 — Build an ASS subtitle file string. Caller writes this to a virtual
 * .ass file in the ffmpeg.wasm FS, then references it in the `ass` filter.
 *
 * Returns empty string when styleId='none' — caller should skip the burn-in
 * filter entirely.
 */
export function buildAssSubtitles(params: BuildAssParams): string {
  const style = STYLE_PRESETS[params.styleId]
  if (!style || params.captions.length === 0) return ''

  // ── [Script Info] header ────────────────────────────────────────────
  const header = `[Script Info]
Title: UGC Ad Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${params.videoWidth}
PlayResY: ${params.videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${style.name},${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},&H00000000,${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outlineWidth},2,${style.alignment},40,40,${style.marginV},1
Style: ${style.name}Emphasised,${style.fontName},${Math.round(style.fontSize * 1.15)},&H0000A5FB,&H000000FF,${style.outlineColor},&H00000000,-1,0,0,0,100,100,0,0,1,${Math.round(style.outlineWidth * 1.2)},2,${style.alignment},40,40,${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  // ── [Events] body — one Dialogue line per caption ──────────────────
  const events = params.captions
    .filter((c) => c.text.trim() && c.endSec > c.startSec)
    .map((c) => {
      const start = secToAssTimecode(c.startSec)
      const end = secToAssTimecode(c.endSec)
      const styleName = c.emphasised ? `${style.name}Emphasised` : style.name
      // ASS text — uppercase for aggressive_tiktok, otherwise as-is.
      // Escape commas + braces (ASS-special chars).
      const text = (params.styleId === 'aggressive_tiktok' ? c.text.toUpperCase() : c.text)
        .replace(/\{/g, '˂')
        .replace(/\}/g, '˃')
        .replace(/\n/g, '\\N')
        .trim()
      return `Dialogue: 0,${start},${end},${styleName},,0,0,0,,${text}`
    })
    .join('\n')

  return header + events + '\n'
}

/** Convert seconds → ASS timecode "H:MM:SS.cs" (centiseconds) */
function secToAssTimecode(totalSec: number): string {
  const cs = Math.floor((totalSec - Math.floor(totalSec)) * 100)
  const totalSecInt = Math.floor(totalSec)
  const hh = Math.floor(totalSecInt / 3600)
  const mm = Math.floor((totalSecInt % 3600) / 60)
  const ss = totalSecInt % 60
  return `${hh}:${pad2(mm)}:${pad2(ss)}.${pad2(cs)}`
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}
