// ── Continuity Public Surface (P4) ──────────────────────────────────────────
//
// Single import entry for callers. Keeps the engine internals (SESSIONS
// map, id gen, test-only helpers) out of the public surface.

export {
  startContinuitySession,
  getContinuitySession,
  bindHeroAsset,
  noteSequenceStep,
  disposeContinuitySession,
  resolveContinuityRefs,
  buildContinuityDirective,
} from './continuityEngine'
