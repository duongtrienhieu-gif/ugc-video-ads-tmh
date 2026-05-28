// ─────────────────────────────────────────────────────────────────────
// Pack Brainstorm — barrel (REBUILD Sprint 1, 2026-05-28)
//
// Pre-write brainstorm layer for the storytelling engine. ONE Gemini
// call that reads input + product synthesis + commercial psychology and
// decides the hook angle, drafts the opening, and lists agitate beats
// BEFORE the main storytelling generator runs.
// ─────────────────────────────────────────────────────────────────────

export { synthesizePackBrainstorm } from './synthesizePackBrainstorm'
export { buildBrainstormBrief } from './buildBrainstormBrief'
// Sprint 4 — picker + fingerprint helpers exposed for the caller's
// localStorage-based anti-repeat memory.
export { pickHookCandidate, hookFingerprint } from './pickHookCandidate'
export { listSubVariants, getSubVariantSpec, HOOK_SUB_VARIANTS } from './hookSubVariants'
export type { HookSubVariantSpec, HookSubVariant } from './hookSubVariants'
export type {
  PackBrainstorm,
  PainLadderEntry,
  HookAngle,
  HookCandidate,
  SocialProofPersonaSeed,
  SynthesizePackBrainstormInput,
  SynthesizePackBrainstormKeys,
} from './types'
