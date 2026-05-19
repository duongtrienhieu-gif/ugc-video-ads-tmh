// ── Export Formats ───────────────────────────────────────────────────────────
// Z35 §1 — 6 aspect ratios for ad export. TikTok / Reels / Shorts all
// share 9:16 but stay as distinct entries so the user can pick the
// PLATFORM (and we tag the export bundle accordingly) — useful when
// uploading later.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExportFormatId } from '../types'

export interface ExportFormatConfig {
  id: ExportFormatId
  labelVi: string
  platformVi: string
  emoji: string
  /** Width x Height for the export */
  aspectRatio: { w: number; h: number }
  /** Aspect ratio as string for prompts ("9:16" / "1:1" / "4:5") */
  aspectString: '9:16' | '1:1' | '4:5'
  /** UI tint */
  tone: 'violet' | 'pink' | 'rose' | 'emerald' | 'sky' | 'amber'
}

export const EXPORT_FORMATS: Record<ExportFormatId, ExportFormatConfig> = {
  tiktok_9x16: {
    id: 'tiktok_9x16',
    labelVi: 'TikTok',
    platformVi: 'TikTok native 9:16',
    emoji: '🎵',
    aspectRatio: { w: 9, h: 16 },
    aspectString: '9:16',
    tone: 'pink',
  },
  reels_9x16: {
    id: 'reels_9x16',
    labelVi: 'Reels',
    platformVi: 'Instagram Reels 9:16',
    emoji: '📷',
    aspectRatio: { w: 9, h: 16 },
    aspectString: '9:16',
    tone: 'rose',
  },
  shorts_9x16: {
    id: 'shorts_9x16',
    labelVi: 'Shorts',
    platformVi: 'YouTube Shorts 9:16',
    emoji: '▶️',
    aspectRatio: { w: 9, h: 16 },
    aspectString: '9:16',
    tone: 'amber',
  },
  square_1x1: {
    id: 'square_1x1',
    labelVi: 'Square',
    platformVi: 'IG/FB feed square 1:1',
    emoji: '🟦',
    aspectRatio: { w: 1, h: 1 },
    aspectString: '1:1',
    tone: 'sky',
  },
  story_9x16: {
    id: 'story_9x16',
    labelVi: 'Story',
    platformVi: 'IG/FB Stories 9:16',
    emoji: '📖',
    aspectRatio: { w: 9, h: 16 },
    aspectString: '9:16',
    tone: 'violet',
  },
  feed_4x5: {
    id: 'feed_4x5',
    labelVi: 'Feed 4:5',
    platformVi: 'IG feed vertical 4:5',
    emoji: '🖼️',
    aspectRatio: { w: 4, h: 5 },
    aspectString: '4:5',
    tone: 'emerald',
  },
}

export const EXPORT_FORMAT_ORDER: ExportFormatId[] = [
  'tiktok_9x16',
  'reels_9x16',
  'shorts_9x16',
  'square_1x1',
  'story_9x16',
  'feed_4x5',
]
