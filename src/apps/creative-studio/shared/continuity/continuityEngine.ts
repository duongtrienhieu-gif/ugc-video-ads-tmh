// ── Continuity Engine (P4) ──────────────────────────────────────────────────
//
// Manages in-memory continuity sessions. A session bundles the locks
// (product / model / persona / hero asset) for a multi-shot photographic
// sequence so every render after the first reuses the same identity.
//
// Pattern generalised from landing-page advertorial flow — hero is
// rendered first, then injected as filesUrl[0] for every subsequent
// people-shot (see services/generateImages.ts → STAGE 1 + the
// buildStorytellingContinuityDirective text block).
//
// In-memory only. No persistence. Sessions live for the duration of one
// browser tab and are intended to be opened per "shoot" / "sequence" by
// the caller. Disposing is optional — the Map will be GC'd with the
// module on tab close.

import type {
  ContinuitySession,
  ContinuitySessionInit,
  ContinuityRef,
} from '../../types/continuity'
import type { GeneratedAsset } from '../../types/asset'
import { findPersona } from '../metadata/personaLibrary'
import { findEmotionalBeat } from '../metadata/emotionalBeats'

const SESSIONS = new Map<string, ContinuitySession>()

function genSessionId(): string {
  return `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** Open a new continuity session. Returns the sessionId for the caller. */
export function startContinuitySession(init: ContinuitySessionInit): string {
  if (!init.productId) {
    throw new Error('[continuity] startContinuitySession requires productId')
  }
  const sessionId = genSessionId()
  SESSIONS.set(sessionId, {
    sessionId,
    init,
    heroAssetRef: null,
    sequenceOrder: 0,
    startedAt: Date.now(),
  })
  return sessionId
}

/** Read a session by id. Returns null when unknown. */
export function getContinuitySession(sessionId: string): ContinuitySession | null {
  return SESSIONS.get(sessionId) ?? null
}

/** Bind the hero asset for this session. Subsequent renders will use it
 *  as the identity-lock reference image. Idempotent — last write wins. */
export function bindHeroAsset(sessionId: string, asset: GeneratedAsset): void {
  const session = SESSIONS.get(sessionId)
  if (!session) {
    throw new Error(`[continuity] bindHeroAsset: unknown session ${sessionId}`)
  }
  session.heroAssetRef = asset.outputUrl
  session.sequenceOrder += 1
}

/** Notify the session that a non-hero render completed (advances counter). */
export function noteSequenceStep(sessionId: string): void {
  const session = SESSIONS.get(sessionId)
  if (!session) return
  session.sequenceOrder += 1
}

/** Close a session and free its memory. */
export function disposeContinuitySession(sessionId: string): void {
  SESSIONS.delete(sessionId)
}

/**
 * Resolve the ordered list of reference assets for the next render in
 * this session.
 *
 * Priority (highest first → KIE treats earlier indices as more
 * authoritative for image-to-image identity):
 *   1. heroAssetRef  → identity lock once stage-1 hero exists
 *   2. productImage  → product packshot from bankStore (always present)
 *   3. modelImage    → bank model character image when modelId given
 *
 * NOTE: this helper returns refs in CALLER-OWNED format (asset:xxx or
 * blob: or https:) — orchestrator is responsible for converting to
 * public URLs via toPublicUrl before passing to KIE.
 */
export function resolveContinuityRefs(
  sessionId: string,
  productImage: string,
  modelImage: string | null,
): ContinuityRef[] {
  const session = SESSIONS.get(sessionId)
  if (!session) {
    throw new Error(`[continuity] resolveContinuityRefs: unknown session ${sessionId}`)
  }

  const refs: ContinuityRef[] = []

  if (session.heroAssetRef) {
    refs.push({ kind: 'hero', url: session.heroAssetRef })
  }

  refs.push({ kind: 'product', url: productImage })

  if (modelImage && !session.heroAssetRef) {
    // Hero ref already dominates identity; only attach model ref when no
    // hero exists yet (first/hero render of the session).
    refs.push({ kind: 'avatar', url: modelImage })
  }

  return refs
}

/**
 * Build the text directive injected into the photographic prompt so KIE
 * knows which reference image is the identity anchor and what archetype
 * + mood to render. Mirrors the landing-page directive
 * (buildStorytellingContinuityDirective) but generalized for any persona.
 *
 * Returns an empty string when there is nothing to enforce — caller can
 * always concatenate it safely.
 */
export function buildContinuityDirective(
  sessionId: string,
  beatId?: string,
): string {
  const session = SESSIONS.get(sessionId)
  if (!session) return ''

  const persona = session.init.personaId ? findPersona(session.init.personaId) : null
  const beat = beatId ? findEmotionalBeat(beatId) : null
  const heroAttached = !!session.heroAssetRef

  const lines: string[] = []
  lines.push('CHARACTER CONTINUITY LOCK (multi-shot sequence — SAME individual every shot):')

  if (persona) {
    lines.push(`  • Archetype: ${persona.label.en}`)
    lines.push(`  • Appearance (KEEP EXACT across all renders): ${persona.appearance}`)
    lines.push(`  • Typical environment (consistent world): ${persona.environment}`)
  }

  if (heroAttached) {
    lines.push(
      '  • REFERENCE IMAGE #1 IS THE HERO CHARACTER from this same shoot — render the SAME '
      + 'PERSON with the SAME FACE / SAME HAIR / SAME SKIN TONE / SAME OUTFIT FAMILY. Treat ref '
      + 'image #1 as the identity lock; the OUTPUT must be visually recognizable as the same '
      + 'individual.',
    )
  }

  if (beat) {
    lines.push(`  • Mood for this shot (phase: ${beat.phase}): ${beat.moodDirective}`)
    lines.push(`  • Face expression for this shot: ${beat.faceExpressionDirective}`)
  }

  lines.push(
    '  • Cinematic UGC documentary photography. Natural skin texture. Soft DOF. NO studio glamour. '
    + 'NO commercial gloss. NO designed text overlay.',
  )

  if (persona) {
    // Persona-derived hard bans — keep the archetype lock strict
    const tags = new Set(persona.demographicTags)
    const bans: string[] = []
    if (tags.has('female')) bans.push('a man / male / boy')
    if (tags.has('male')) bans.push('a woman / female')
    if (tags.has('hijab')) bans.push('a woman WITHOUT hijab / tudung')
    if (tags.has('no-hijab')) bans.push('a woman wearing hijab when archetype does not')
    if (tags.has('vietnamese') || tags.has('malaysian') || tags.has('sea-generic')) {
      bans.push('Western / Caucasian / European / Korean idol / Chinese beauty model / Japanese anime face')
    }

    if (bans.length > 0) {
      lines.push('')
      lines.push('HARD BANS — image will be rejected if it depicts:')
      for (const b of bans) lines.push(`  ✗ ${b}`)
    }
  }

  return lines.join('\n')
}

/** Test-only utility — clears all sessions. Not exported from index.ts. */
export function __clearAllSessions_TEST_ONLY(): void {
  SESSIONS.clear()
}
