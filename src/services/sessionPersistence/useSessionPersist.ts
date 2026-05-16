// ── useSessionPersist — generic session-recovery hook ──────────────────────
// Wraps the BrollStudio pattern (hydratedRef + restorePrompt + debounced save)
// into a reusable hook for every module. Phase R1 spec.
//
// Usage:
//   const sessionApi = useSessionPersist<MyShape>({
//     moduleId: 'landing-page',
//     moduleNameVi: 'LandingPage AI',
//     version: 1,
//     snapshot: () => ({ pack, isGenerating, imageProgress }),
//     hydrate: (data) => { setPack(data.pack); setProgress(data.imageProgress) },
//     getStatus: () => isGenerating ? 'in-progress' : pack ? 'paused' : 'completed',
//     getProgressVi: () => pack ? `${doneCount}/${totalCount} sections` : undefined,
//     getTitleVi: () => pack?.title,
//     shouldPersist: () => !!pack || isGenerating,
//   })
//
//   // call sessionApi.markCompleted() when work is finished+saved elsewhere
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import type { SessionStatus, SnapshotEnvelope } from './types'
import { getRegistration, readEnvelope, writeEnvelope, clearEnvelope } from './registry'
import { restoreCoordinator } from './restoreCoordinator'

const SAVE_DEBOUNCE_MS = 500

export interface UseSessionPersistOpts<T> {
  /** Must match a ModuleRegistration in registry.ts. */
  moduleId: string
  /** Vietnamese label override — falls back to the registration's value. */
  moduleNameVi?: string
  /** Snapshot version — bump when the T shape changes. Must match registry. */
  version: number
  /** Capture the current snapshot. Called on every save tick. */
  snapshot: () => T
  /** Apply a previously saved snapshot back into component state. */
  hydrate: (data: T) => void
  /** Lifecycle status — drives modal display. */
  getStatus?: () => SessionStatus
  /** Vietnamese progress text shown under the title in the modal. */
  getProgressVi?: () => string | undefined
  /** Project title (optional) — shown as subtitle in the modal. */
  getTitleVi?: () => string | undefined
  /** Return false to skip persisting this tick (e.g. nothing to save yet). */
  shouldPersist?: () => boolean
  /** Dependency array — changes here re-run the save effect. */
  deps: ReadonlyArray<unknown>
}

export interface UseSessionPersistApi {
  /** True after the hook has resolved any pending snapshot — safe to start UI. */
  isHydrated: boolean
  /** Call this when the work cycle is complete — clears the snapshot. */
  markCompleted: () => void
  /** Call this on a hard failure — moves snapshot to 'failed' status (kept ~1h). */
  markFailed: () => void
  /** Manually force-save right now (bypasses debounce). */
  forceSave: () => void
  /** Manually discard the snapshot (used by "New Project" flow). */
  clear: () => void
  /** When true, the most recent save succeeded — drives "Đã lưu" indicator. */
  lastSaveOk: boolean
  /** ms timestamp of last successful save (for "đã lưu xx giây trước"). */
  lastSavedAt: number | null
}

export function useSessionPersist<T>(opts: UseSessionPersistOpts<T>): UseSessionPersistApi {
  const registration = getRegistration(opts.moduleId)
  const persistKey = registration?.persistKey ?? `ugc-lab:${opts.moduleId}:inflight-v${opts.version}`

  const hydratedRef = useRef(false)
  // Initialised lazily to avoid calling Date.now() during render (React 19 purity rule).
  // The actual value is overwritten in the mount effect — this is just a stable placeholder.
  const startedAtRef = useRef<number>(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [lastSaveOk, setLastSaveOk] = useState(true)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  // Keep latest opts in a ref so the subscribe effect doesn't re-fire on every render.
  // React 19 purity rule forbids writing to refs during render, so we update it in an effect.
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })

  // ── Mount: auto-hydrate immediately if a valid snapshot exists ──────────
  // Generated outputs are user assets — treat them like Figma files: always
  // restore on reload. The coordinator's 'discard' decision is still honored
  // for the case where the user explicitly clicked "Bỏ" in the drafts panel.
  // setState in this effect is the documented hydration pattern (subscribe to
  // an external system = localStorage), so the set-state-in-effect rule is
  // disabled with a justification for the whole effect body.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const envelope = readEnvelope<T>(persistKey)
    const hasSnapshot = !!envelope && envelope.version === opts.version

    if (!hasSnapshot) {
      hydratedRef.current = true
      setIsHydrated(true)
      startedAtRef.current = Date.now()
      return
    }

    if (restoreCoordinator.getDecision(persistKey) === 'discard') {
      clearEnvelope(persistKey)
      hydratedRef.current = true
      setIsHydrated(true)
      startedAtRef.current = Date.now()
      return
    }

    try {
      optsRef.current.hydrate(envelope!.data)
    } catch (err) {
      console.warn(`[useSessionPersist:${opts.moduleId}] hydrate failed:`, err)
    }
    startedAtRef.current = envelope!.startedAt
    restoreCoordinator.accept(persistKey)
    hydratedRef.current = true
    setIsHydrated(true)
  }, [persistKey, opts.moduleId, opts.version])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Save effect — debounced ─────────────────────────────────────────────
  // We deliberately depend on `opts.deps` (user-provided) plus isHydrated.
  useEffect(() => {
    if (!hydratedRef.current) return
    if (opts.shouldPersist && !opts.shouldPersist()) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        const data = opts.snapshot()
        const envelope: SnapshotEnvelope<T> = {
          version: opts.version,
          moduleId: opts.moduleId,
          moduleNameVi: opts.moduleNameVi ?? registration?.moduleNameVi ?? opts.moduleId,
          status: opts.getStatus?.() ?? 'in-progress',
          startedAt: startedAtRef.current,
          updatedAt: Date.now(),
          progressVi: opts.getProgressVi?.(),
          titleVi: opts.getTitleVi?.(),
          data,
        }
        writeEnvelope(persistKey, envelope)
        setLastSavedAt(Date.now())
        setLastSaveOk(true)
      } catch (err) {
        console.warn(`[useSessionPersist:${opts.moduleId}] save failed:`, err)
        setLastSaveOk(false)
      }
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [isHydrated, ...opts.deps])

  const markCompleted = () => {
    clearEnvelope(persistKey)
  }
  const markFailed = () => {
    const data = opts.snapshot()
    const envelope: SnapshotEnvelope<T> = {
      version: opts.version,
      moduleId: opts.moduleId,
      moduleNameVi: opts.moduleNameVi ?? registration?.moduleNameVi ?? opts.moduleId,
      status: 'failed',
      startedAt: startedAtRef.current,
      updatedAt: Date.now(),
      progressVi: opts.getProgressVi?.(),
      titleVi: opts.getTitleVi?.(),
      data,
    }
    writeEnvelope(persistKey, envelope)
  }
  const forceSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    try {
      const data = opts.snapshot()
      const envelope: SnapshotEnvelope<T> = {
        version: opts.version,
        moduleId: opts.moduleId,
        moduleNameVi: opts.moduleNameVi ?? registration?.moduleNameVi ?? opts.moduleId,
        status: opts.getStatus?.() ?? 'in-progress',
        startedAt: startedAtRef.current,
        updatedAt: Date.now(),
        progressVi: opts.getProgressVi?.(),
        titleVi: opts.getTitleVi?.(),
        data,
      }
      writeEnvelope(persistKey, envelope)
      setLastSavedAt(Date.now())
      setLastSaveOk(true)
    } catch (err) {
      console.warn(`[useSessionPersist:${opts.moduleId}] forceSave failed:`, err)
      setLastSaveOk(false)
    }
  }
  const clear = () => clearEnvelope(persistKey)

  return { isHydrated, markCompleted, markFailed, forceSave, clear, lastSaveOk, lastSavedAt }
}
