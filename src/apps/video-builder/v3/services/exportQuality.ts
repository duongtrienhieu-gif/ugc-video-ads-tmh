// ── Export Quality ───────────────────────────────────────────────────────────
// Z35 §2 — 3 quality modes. Default TEST_480 — cheap iteration first.
// User upgrades to FINAL_1080 only when shipping the winning creative.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExportQualityId } from '../types'

export interface ExportQualityConfig {
  id: ExportQualityId
  labelVi: string
  descriptionVi: string
  emoji: string
  /** Output resolution (vertical pixels) */
  resolutionPx: 480 | 720 | 1080
  /** Estimated final file size for a 30s video (MB) */
  estFileSizeMb: number
  /** Compression / encoder hint */
  videoBitrateKbps: number
  audioBitrateKbps: number
  /** UI tint */
  tone: 'amber' | 'violet' | 'pink'
  /** Short tag rendered on chip */
  badge: string
}

export const EXPORT_QUALITIES: Record<ExportQualityId, ExportQualityConfig> = {
  test_480: {
    id: 'test_480',
    labelVi: 'TEST 480',
    descriptionVi: '480p · fast · light compress · cho iteration testing — MẶC ĐỊNH',
    emoji: '⚡',
    resolutionPx: 480,
    estFileSizeMb: 3,
    videoBitrateKbps: 1200,
    audioBitrateKbps: 96,
    tone: 'amber',
    badge: '⚡ FAST',
  },
  standard_720: {
    id: 'standard_720',
    labelVi: 'STANDARD 720',
    descriptionVi: '720p · balanced · chất lượng vừa đủ cho TikTok/Reels production',
    emoji: '✨',
    resolutionPx: 720,
    estFileSizeMb: 8,
    videoBitrateKbps: 2400,
    audioBitrateKbps: 128,
    tone: 'violet',
    badge: 'STD',
  },
  final_1080: {
    id: 'final_1080',
    labelVi: 'FINAL 1080',
    descriptionVi: '1080p · HD · final shipping quality. Dùng chỉ khi winning creative.',
    emoji: '🎬',
    resolutionPx: 1080,
    estFileSizeMb: 18,
    videoBitrateKbps: 5500,
    audioBitrateKbps: 192,
    tone: 'pink',
    badge: 'HD',
  },
}

export const EXPORT_QUALITY_ORDER: ExportQualityId[] = [
  'test_480',
  'standard_720',
  'final_1080',
]
