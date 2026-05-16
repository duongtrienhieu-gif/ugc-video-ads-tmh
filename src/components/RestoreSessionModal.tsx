// ── RestoreSessionModal ─────────────────────────────────────────────────────
// Boot-time scanner that primes the session-persistence layer. Since R7,
// the app AUTO-RESTORES every pending snapshot silently — there is no
// blocking modal any more. Users manage drafts via the "Bản nháp" sidebar
// button (DraftsPanel) and the per-module "New Project" / "Clear" actions.
//
// We keep this component as a thin mount-only side-effect so the App.tsx
// render tree doesn't need to change.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import {
  scanForPendingSessions,
  pruneExpiredSnapshots,
  migrateLegacyKeys,
} from '../services/sessionPersistence'

export default function RestoreSessionModal() {
  const addToast = useAppStore((s) => s.addToast)
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    migrateLegacyKeys()
    pruneExpiredSnapshots()
    const found = scanForPendingSessions()
    if (found.length === 0) return

    // Auto-restore happens inside each module's useSessionPersist on mount;
    // here we just notify the user that previous work was preserved.
    const moduleNames = found.map((s) => s.moduleNameVi).join(', ')
    addToast(
      found.length === 1
        ? `Đã khôi phục phiên trước: ${moduleNames}`
        : `Đã khôi phục ${found.length} phiên trước (${moduleNames})`,
      'success',
    )
  }, [addToast])

  return null
}
