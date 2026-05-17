// ── V2 Pipeline State Persistence ────────────────────────────────────────────
// Z27 — HARD FIX for "F5 / logout wipes the pipeline" bug.
//
// Before Z27 the entire V2PipelineState lived only in React useState. A
// single F5 destroyed the expensive Gemini Vision identity extraction,
// the storyboard JSON, the editorial blueprint, the master frame
// approvals — every output the user paid credits to generate.
//
// Z27 mirrors the same persistence pattern the job stores already use
// (zustand + localStorage) but for the top-level V2PipelineState that
// lives in VideoBuilderV2's useState. On every state change we save;
// on mount we hydrate.
//
// What WE save (everything that took money / time / Gemini calls):
//   • inputs (avatar / product / script — survives picker dismissal)
//   • identityPack (Gemini Vision face + product descriptions)
//   • masterFrame.candidates + approvedIdx (approved master frames)
//   • blueprints (storyboard JSON from Gemini)
//   • qcScores (avoid re-running QC if the user already approved)
//   • consistency + dna (slider state + visual DNA picks)
//   • editorialBlueprint (coverage + cuts + motion graph)
//   • timelineRenderJob (cut-level render job — though the Z26 store
//     also persists this independently, we keep a copy in V2 state so
//     the planning view can render before the user navigates)
//   • phase (current step — so refresh returns the user to where they were)
//
// What we DON'T save (transient / UI-only):
//   • masterFrame.isGenerating + .error  → reset to false / null on resume
//   • pickerMode / debugOpen / analyticsOpen → React modal state
//   • addToast / cancelledRef → derived / refs
//
// The 4 job stores (masterFrame / sceneGen / videoGen / timelineRender)
// already persist their own data via their respective stores. Z27 is
// the missing fourth piece — the pipeline state that owns the rest.
// ─────────────────────────────────────────────────────────────────────────────

import type { V2PipelineState } from '../types'

const STORAGE_KEY = 'ugc-lab-v2-pipeline-state'
/** Bump when V2PipelineState shape changes incompatibly so old payloads
 *  get discarded gracefully instead of crashing the app. */
const SCHEMA_VERSION = 1

interface PersistedShape {
  schemaVersion: number
  state: V2PipelineState
  savedAt: number
}

/**
 * Hydrate V2PipelineState from localStorage. Returns null if nothing
 * stored, the payload is corrupted, or the schema version doesn't match.
 * The caller is expected to fall back to createEmptyV2State() in that case.
 *
 * Transient flags are reset:
 *   • masterFrame.isGenerating → false
 *   • masterFrame.error → null
 * so a refresh during generation doesn't leave the UI stuck in a
 * "loading" state with no underlying job.
 */
export function loadV2State(): V2PipelineState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedShape
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`[V2_STATE] discarding stale payload (schema ${parsed?.schemaVersion} ≠ ${SCHEMA_VERSION})`)
      return null
    }
    const state = parsed.state
    // Defensive: reset transient flags so we never resume into a stuck
    // "spinner forever" state. The job stores own the real running flag.
    if (state.masterFrame) {
      state.masterFrame.isGenerating = false
      state.masterFrame.error = null
    }
    const ageSec = Math.round((Date.now() - (parsed.savedAt ?? 0)) / 1000)
    console.log(`[V2_STATE] hydrated · phase=${state.phase} · age=${ageSec}s · scenes=${state.blueprints?.length ?? 0} · masters=${state.masterFrame?.candidates?.length ?? 0}`)
    return state
  } catch (err) {
    console.warn('[V2_STATE] load failed — starting fresh', err)
    return null
  }
}

/**
 * Persist V2PipelineState to localStorage. Idempotent; safe to call
 * on every state change. Total payload typically 50-200KB which is
 * well under localStorage's 5MB-per-origin quota.
 *
 * On quota-exceeded errors (huge editorialBlueprint or thousands of
 * scenes), we log + skip rather than throw — losing one save isn't
 * worth crashing the UI.
 */
export function saveV2State(state: V2PipelineState): void {
  try {
    const payload: PersistedShape = {
      schemaVersion: SCHEMA_VERSION,
      state,
      savedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[V2_STATE] save failed (quota?) — pipeline state may not survive next refresh', err)
  }
}

/** Wipe the persisted V2 state. Called by the "Tạo lại từ đầu" button
 *  in the header. Does NOT touch the 4 job stores — the caller should
 *  also clear those (see clearAllV2Persistence). */
export function clearV2State(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    console.log('[V2_STATE] cleared')
  } catch { /* silent */ }
}

/**
 * Z27 — Nuclear option: wipe ALL V2 persistence in one shot.
 * Used by the "Tạo lại từ đầu" button. Clears:
 *   1. The V2 pipeline state (this module)
 *   2. masterFrameJobStore
 *   3. sceneGenJobStore
 *   4. videoGenJobStore
 *   5. timelineRenderJobStore
 *
 * Imported lazily inside the function so this util module doesn't
 * become a circular dep target for every store.
 */
export async function clearAllV2Persistence(): Promise<void> {
  clearV2State()
  const [
    { useMasterFrameJobStore },
    { useSceneGenJobStore },
    { useVideoGenJobStore },
    { useTimelineRenderJobStore },
  ] = await Promise.all([
    import('../stores/masterFrameJobStore'),
    import('../stores/sceneGenJobStore'),
    import('../stores/videoGenJobStore'),
    import('../stores/timelineRenderJobStore'),
  ])
  useMasterFrameJobStore.getState().clearJob?.()
  useSceneGenJobStore.getState().clearJob?.()
  useVideoGenJobStore.getState().clearJob?.()
  useTimelineRenderJobStore.getState().clearJob?.()
  console.log('[V2_STATE] cleared ALL — pipeline state + 4 job stores')
}
