// ── Continuity Engine Public Surface (P4) ──────────────────────────────────
//
// Re-exports for the continuity engine. Modules consume continuity via
// these named exports — the inner file structure is internal.

export {
  defaultCharacterMemory,
  memoryFromPersona,
  mergeMemory,
  buildCharacterMemoryBlock,
  resolveRealism,
} from './characterMemory'

export {
  IDENTITY_LOCK_NEGATIVES,
  buildIdentityLockBlock,
  appendIdentityNegatives,
} from './identityLock'

export {
  pickOutfit,
  buildOutfitBlock,
  type OutfitChoice,
} from './outfitVariation'

export {
  computeSceneEvolution,
  type SceneEvolution,
} from './sceneEvolution'
