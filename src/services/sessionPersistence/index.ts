// Public surface of the session-persistence layer.
export type {
  SessionStatus,
  SnapshotEnvelope,
  SessionMeta,
  ModuleRegistration,
} from './types'

export {
  MODULE_REGISTRY,
  getRegistration,
  readEnvelope,
  writeEnvelope,
  clearEnvelope,
  scanForPendingSessions,
  discardSession,
  discardAllPendingSessions,
  pruneExpiredSnapshots,
  formatRelativeVi,
} from './registry'

export { restoreCoordinator } from './restoreCoordinator'

export { useSessionPersist } from './useSessionPersist'
export type { UseSessionPersistOpts, UseSessionPersistApi } from './useSessionPersist'
