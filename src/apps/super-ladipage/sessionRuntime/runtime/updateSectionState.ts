// ─────────────────────────────────────────────────────────────────────
// Session Runtime — updateSectionState (P16A)
//
// Pure section-state transition helpers. All return new LandingSession.
//
//   setRegenStatus     — change SectionRegenStatus
//   incrementRetry     — bump retry counter (also increments metrics)
//   recordFailure      — mark section failed + capture reason
//   setReviewVerdict   — approve / reject
//   toggleReviewFlag   — add/remove a review flag
//   setReviewNote      — attach marketer note
// ─────────────────────────────────────────────────────────────────────

import type {
  LandingSession,
  SectionRegenStatus,
  SectionRegenTarget,
  ReviewVerdict,
  ReviewFlag,
} from '../types'

function touch(session: LandingSession, sectionId: string): LandingSession {
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    sections: {
      ...session.sections,
      [sectionId]: {
        ...session.sections[sectionId],
        updatedAt: Date.now(),
      },
    },
  }
}

export function setRegenStatus(
  session: LandingSession,
  sectionId: string,
  status: SectionRegenStatus,
  target?: SectionRegenTarget,
): LandingSession {
  const cur = session.sections[sectionId]
  if (!cur) return session
  const next = touch(session, sectionId)
  next.sections[sectionId] = {
    ...cur,
    regenStatus: status,
    lastRegenTarget: target ?? cur.lastRegenTarget,
    updatedAt: Date.now(),
  }
  // bump partialRegenCount when transitioning into 'queued' or 'generating'
  if (status === 'queued' || status === 'generating') {
    next.metrics = {
      ...next.metrics,
      partialRegenCount: next.metrics.partialRegenCount + 1,
    }
  }
  return next
}

export function incrementRetry(
  session: LandingSession,
  sectionId: string,
): LandingSession {
  const cur = session.sections[sectionId]
  if (!cur) return session
  const next = touch(session, sectionId)
  next.sections[sectionId] = {
    ...cur,
    retryCount: cur.retryCount + 1,
    updatedAt: Date.now(),
  }
  next.metrics = {
    ...next.metrics,
    totalRetries: next.metrics.totalRetries + 1,
  }
  return next
}

export function recordFailure(
  session: LandingSession,
  sectionId: string,
  reason: string,
): LandingSession {
  const cur = session.sections[sectionId]
  if (!cur) return session
  const wasAlreadyFailed = cur.regenStatus === 'failed'
  const next = touch(session, sectionId)
  next.sections[sectionId] = {
    ...cur,
    regenStatus: 'failed',
    lastFailureReason: reason,
    updatedAt: Date.now(),
  }
  if (!wasAlreadyFailed) {
    next.metrics = {
      ...next.metrics,
      failedSectionCount: next.metrics.failedSectionCount + 1,
    }
  }
  return next
}

export function setReviewVerdict(
  session: LandingSession,
  sectionId: string,
  verdict: ReviewVerdict,
): LandingSession {
  const cur = session.sections[sectionId]
  if (!cur) return session
  const next = touch(session, sectionId)
  next.sections[sectionId] = {
    ...cur,
    review: {
      ...cur.review,
      verdict,
      lastReviewedAt: new Date().toISOString(),
    },
    updatedAt: Date.now(),
  }
  return next
}

export function toggleReviewFlag(
  session: LandingSession,
  sectionId: string,
  flag: ReviewFlag,
): LandingSession {
  const cur = session.sections[sectionId]
  if (!cur) return session
  const flags = cur.review.flags.includes(flag)
    ? cur.review.flags.filter((f) => f !== flag)
    : [...cur.review.flags, flag]
  const next = touch(session, sectionId)
  next.sections[sectionId] = {
    ...cur,
    review: {
      ...cur.review,
      flags,
      lastReviewedAt: new Date().toISOString(),
    },
    updatedAt: Date.now(),
  }
  return next
}

export function setReviewNote(
  session: LandingSession,
  sectionId: string,
  note: string,
): LandingSession {
  const cur = session.sections[sectionId]
  if (!cur) return session
  const next = touch(session, sectionId)
  next.sections[sectionId] = {
    ...cur,
    review: {
      ...cur.review,
      note,
      lastReviewedAt: new Date().toISOString(),
    },
    updatedAt: Date.now(),
  }
  return next
}
