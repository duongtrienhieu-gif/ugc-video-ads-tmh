// ─────────────────────────────────────────────────────────────────────
// Session Runtime — computeSessionMetrics (P16A)
//
// Observability helpers. Record a generation event or a render sample.
// All return new LandingSession.
// ─────────────────────────────────────────────────────────────────────

import type { LandingSession } from '../types'

export interface GenerationEvent {
  durationMs: number
  renderer?: string
}

export function recordGenerationEvent(
  session: LandingSession,
  event: GenerationEvent,
): LandingSession {
  const newDistribution = { ...session.metrics.rendererDistribution }
  if (event.renderer) {
    newDistribution[event.renderer] = (newDistribution[event.renderer] ?? 0) + 1
  }
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    metrics: {
      ...session.metrics,
      totalGenerationMs: session.metrics.totalGenerationMs + event.durationMs,
      rendererDistribution: newDistribution,
    },
  }
}

export function recordRenderSample(
  session: LandingSession,
  renderMs: number,
): LandingSession {
  const samples = session.metrics.previewRenderSamples + 1
  // rolling mean
  const newMean =
    session.metrics.meanRenderMs +
    (renderMs - session.metrics.meanRenderMs) / samples
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    metrics: {
      ...session.metrics,
      previewRenderSamples: samples,
      meanRenderMs: newMean,
    },
  }
}
