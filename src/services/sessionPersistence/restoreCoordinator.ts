// ── Restore Coordinator ─────────────────────────────────────────────────────
// Tiny global event bus that lets the RestoreSessionModal communicate with
// per-module `useSessionPersist` hooks. Phase R1 spec.
//
// Flow:
//   1. App boots → RestoreSessionModal scans → finds pending sessions.
//   2. Modal shows. Until user decides, all `useSessionPersist` hooks see
//      `decisionPending=true` for their persistKey and SUSPEND auto-save
//      (so they don't overwrite the snapshot before user can restore it).
//   3. User clicks [Khôi phục] for a session → coordinator sets that key's
//      decision='accept'. Hook fires `onRestore(data)` callback and resumes save.
//   4. User clicks [Bỏ] for a session → coordinator sets decision='discard'.
//      Hook clears localStorage and starts fresh (resumes save with empty state).
//   5. Hook subscribes via subscribe(persistKey, fn) → cleanup on unmount.
// ─────────────────────────────────────────────────────────────────────────────

import { MODULE_REGISTRY, scanForPendingSessions, clearEnvelope } from './registry'

type Decision = 'pending' | 'accept' | 'discard'

interface Subscriber {
  persistKey: string
  fn: (decision: Decision) => void
}

class RestoreCoordinator {
  private decisions = new Map<string, Decision>()
  private subscribers: Subscriber[] = []

  /** Called by RestoreSessionModal on mount — marks all detected sessions as 'pending'. */
  initFromScan(): { hasPending: boolean; count: number } {
    const pending = scanForPendingSessions()
    this.decisions.clear()
    for (const session of pending) {
      this.decisions.set(session.persistKey, 'pending')
    }
    return { hasPending: pending.length > 0, count: pending.length }
  }

  /** Current decision for a key. 'pending' = waiting on user, 'accept'/'discard' = resolved. */
  getDecision(persistKey: string): Decision {
    return this.decisions.get(persistKey) ?? 'accept' // not in registry = treat as accept (fresh start, no pending block)
  }

  /** User chose "Khôi phục" for this session. */
  accept(persistKey: string): void {
    this.decisions.set(persistKey, 'accept')
    this.notify(persistKey, 'accept')
  }

  /** User chose "Bỏ" for this session. */
  discard(persistKey: string): void {
    this.decisions.set(persistKey, 'discard')
    clearEnvelope(persistKey)
    this.notify(persistKey, 'discard')
  }

  /** User chose "Khôi phục tất cả". */
  acceptAll(): void {
    for (const [key] of this.decisions) {
      if (this.decisions.get(key) === 'pending') {
        this.accept(key)
      }
    }
  }

  /** User chose "Bỏ tất cả". */
  discardAll(): void {
    for (const [key] of this.decisions) {
      if (this.decisions.get(key) === 'pending') {
        this.discard(key)
      }
    }
  }

  /** Hook subscribes for its key's decision. Returns unsubscribe fn. */
  subscribe(persistKey: string, fn: (decision: Decision) => void): () => void {
    const sub: Subscriber = { persistKey, fn }
    this.subscribers.push(sub)
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== sub)
    }
  }

  private notify(persistKey: string, decision: Decision): void {
    for (const sub of this.subscribers) {
      if (sub.persistKey === persistKey) sub.fn(decision)
    }
  }

  /** Check if any pending decisions still exist (for the modal to know when to close). */
  hasAnyPending(): boolean {
    for (const [, decision] of this.decisions) {
      if (decision === 'pending') return true
    }
    return false
  }

  /** Used in tests / dev to reset. */
  reset(): void {
    this.decisions.clear()
    this.subscribers = []
  }
}

/** Singleton — there's only one restore decision flow per app load. */
export const restoreCoordinator = new RestoreCoordinator()

/** Helper for the modal: get all module registrations that match a pending key. */
export function getRegistrationByKey(persistKey: string) {
  return MODULE_REGISTRY.find((m) => m.persistKey === persistKey)
}
