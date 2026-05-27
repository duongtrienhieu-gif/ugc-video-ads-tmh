// ─────────────────────────────────────────────────────────────────────
// Session Runtime — createLandingSession (P16A)
//
// ExportablePage → initial LandingSession with all sections initialized
// to 'idle' regen state + identity tuning + initial history snapshot.
//
// Pure function (deterministic except for sessionId + timestamps).
// ─────────────────────────────────────────────────────────────────────

import type { ExportablePage } from '../../exportPipeline'
import { IDENTITY_KNOBS } from '../../semanticRenderer'
import type {
  LandingSession,
  SectionSessionState,
  HistorySnapshot,
  SessionMetrics,
} from '../types'

export interface CreateLandingSessionOptions {
  productName?: string
  niche?: string
}

export function createLandingSession(
  page: ExportablePage,
  options: CreateLandingSessionOptions = {},
): LandingSession {
  const now = new Date()
  const nowIso = now.toISOString()
  const sessionId = generateSessionId()

  // ── Per-section initial state ─────────────────────────────────
  const sections: Record<string, SectionSessionState> = {}
  for (const s of page.sections) {
    sections[s.id] = {
      sectionId: s.id,
      regenStatus: 'idle',
      retryCount: 0,
      review: {
        verdict: 'pending',
        flags: [],
      },
      updatedAt: now.getTime(),
    }
  }

  // ── Renderer distribution snapshot from orchestration plan ────
  const rendererDistribution: Record<string, number> = {}
  for (const s of page.sections) {
    if (s.generatedAsset?.renderer) {
      rendererDistribution[s.generatedAsset.renderer] =
        (rendererDistribution[s.generatedAsset.renderer] ?? 0) + 1
    }
  }

  const metrics: SessionMetrics = {
    totalGenerationMs: 0,
    totalRetries: 0,
    failedSectionCount: 0,
    rendererDistribution,
    partialRegenCount: 0,
    previewRenderSamples: 0,
    meanRenderMs: 0,
  }

  // ── Initial history snapshot ──────────────────────────────────
  const initialSnapshot: HistorySnapshot = {
    snapshotId: generateSnapshotId(),
    kind: 'initial',
    takenAt: nowIso,
    tuning: IDENTITY_KNOBS,
    note: 'Session created',
    affectedSectionIds: page.sections.map((s) => s.id),
  }

  return {
    sessionId,
    createdAt: nowIso,
    updatedAt: nowIso,
    packIdentity: {
      productName: options.productName,
      niche: options.niche,
      sourcePackBlockCount: page.sourcePackBlockCount,
    },
    tuning: IDENTITY_KNOBS,
    sections,
    history: [initialSnapshot],
    metrics,
  }
}

// ─── ID helpers (lightweight, no crypto dep) ──────────────────────

function generateSessionId(): string {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function generateSnapshotId(): string {
  return `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
