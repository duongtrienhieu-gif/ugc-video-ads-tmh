// ── Continuity Session Type Contract (P4) ───────────────────────────────────
//
// A ContinuitySession bundles the identity locks (product / model /
// persona / hero asset) for a sequence of photographic shots so that
// every downstream render reuses the same face, the same product, the
// same outfit / room / lighting world.
//
// Pattern is generalized from landing-page advertorial which renders
// hero first then injects hero asset as filesUrl[0] for every
// subsequent people-shot — see
// src/apps/landing-page/services/generateImages.ts:547
// (buildStorytellingContinuityDirective).
//
// SESSIONS ARE IN-MEMORY ONLY in P4. No persistence layer, no Zustand,
// no IndexedDB. Caller owns the sessionId and is responsible for
// disposing it when done. P-future may promote to a store if cross-tab
// continuity is wanted.

/** Source priority for resolving the reference image stack. */
export type ContinuityRefKind = 'product' | 'avatar' | 'hero' | 'baseRef'

/** A single resolved reference, tagged with its source. */
export interface ContinuityRef {
  kind: ContinuityRefKind
  /** Asset ref (asset:xxx) or public URL — orchestrator converts later. */
  url: string
}

/** Configuration captured when a session is opened. */
export interface ContinuitySessionInit {
  /** Product id from bankStore.products — required. */
  productId: string
  /** Optional model id from bankStore.models for identity lock. */
  modelId?: string
  /** Optional persona id from personaLibrary for archetype text lock. */
  personaId?: string
}

/** Live state of an in-flight continuity session. */
export interface ContinuitySession {
  /** Unique session id — caller passes this to subsequent gen calls. */
  sessionId: string
  /** Immutable init params. */
  init: ContinuitySessionInit
  /** Hero asset ref — set once the first/hero render lands via bindHeroAsset. */
  heroAssetRef: string | null
  /** Number of generations performed in this session (for analytics). */
  sequenceOrder: number
  /** When the session was opened (ms epoch). */
  startedAt: number
}
