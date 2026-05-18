// ── Ads Video Engine v3 — Zustand Store ──────────────────────────────────────
// Z30 PHASE 1 — persisted pipeline state. F5 / logout survives by default
// (lesson learned from Z27 — the user explicitly demanded this).
//
// What this store owns:
//   • V3PipelineState — phase, mode, costMode, inputs, creatorVideo, inserts
//
// What this store DOES NOT own (yet — comes in later phases):
//   • Actual render runner — stub until Phase 2 builds the creator video pipe
//   • Action insert renderer — Phase 3
//   • Auto-edit / concat — Phase 4
//
// On resume, transient flags (rendering / startedAt) reset to idle / undefined
// so a refresh during a render doesn't leave the UI stuck in a loading state.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import {
  createEmptyV3State,
  type V3PipelineState, type V3Phase, type WorkflowMode, type CostMode,
  type ActionInsertClip, type CreatorVideoClip,
  // Z31 — Ad Brain
  type AdStructure, type AdAngle, type ScriptTargetDurationSec,
  type GeneratedScript, type HookVariant, type VoiceCategoryId,
  type VoiceRecord,
  // Z32 — Creator Video Engine
  type CreatorPresetId, type CreatorVideoConfig,
} from '../types'
import { CREATOR_PRESETS } from '../services/creatorPresets'
import type { Model, Product } from '../../../../stores/types'

const STORAGE_KEY = 'ugc-lab-v3-ads-video-state'
const CURRENT_SCHEMA = 1

interface AdsVideoStoreState {
  state: V3PipelineState

  // ── Top-level setters ───────────────────────────────────────────────────

  setPhase:    (phase: V3Phase) => void
  setMode:     (mode: WorkflowMode) => void
  setCostMode: (mode: CostMode) => void

  // ── Input setters ───────────────────────────────────────────────────────

  setAvatar:  (avatar: Model | null) => void
  setProduct: (product: Product | null) => void
  setScript:  (script: string) => void
  setVoiceId: (voiceId: string | null) => void

  // ── Creator video ───────────────────────────────────────────────────────

  setCreatorVideo:       (clip: CreatorVideoClip | null) => void
  patchCreatorVideo:     (patch: Partial<CreatorVideoClip>) => void
  /** Z32 — set/replace creator video config (setting + energy + preset + wardrobe + resolution) */
  setCreatorVideoConfig: (config: CreatorVideoConfig) => void
  /** Z32 — apply a preset (writes setting + energy + wardrobeNote in one go) */
  applyCreatorPreset:    (presetId: CreatorPresetId) => void
  /** Z32 — partial config patch (e.g. only setting or only energy) */
  patchCreatorVideoConfig: (patch: Partial<CreatorVideoConfig>) => void

  // ── Action inserts ──────────────────────────────────────────────────────

  /** Replace the whole inserts array (used when the user re-picks presets). */
  setInserts:   (inserts: ActionInsertClip[]) => void
  /** Add one insert to the end. Auto-assigns insertId. */
  addInsert:    (insert: Omit<ActionInsertClip, 'insertId'>) => void
  /** Patch one insert by insertId. */
  patchInsert:  (insertId: number, patch: Partial<ActionInsertClip>) => void
  /** Remove one insert by insertId. */
  removeInsert: (insertId: number) => void

  // ── Z31 Ad Brain (Script + Voice foundation) ────────────────────────────

  setAdStructure:        (structure: AdStructure) => void
  setAdAngle:            (angle: AdAngle) => void
  setTargetDurationSec:  (sec: ScriptTargetDurationSec) => void
  /** Set or replace the generated script (called after Gemini returns). */
  setGeneratedScript:    (script: GeneratedScript | null) => void
  /** Update one block's text + recompute its estDurationSec via the
   *  caller (use voiceTimingEstimator). */
  patchScriptBlock:      (blockIdx: number, patch: { text?: string; estDurationSec?: number }) => void
  /** Replace the script's totalDurationSec — called after a recompute. */
  setScriptTotalDuration: (sec: number) => void
  setHookVariants:       (variants: HookVariant[]) => void
  /** Pick which hook variant replaces the script's HOOK block. -1 = use
   *  the script's own HOOK as generated. */
  pickHookVariant:       (idx: number) => void
  setVoiceCategory:      (cat: VoiceCategoryId | null) => void
  setVoiceRecord:        (rec: VoiceRecord | null) => void
  setIsGeneratingScript: (v: boolean) => void
  setIsGeneratingVoice:  (v: boolean) => void
  setScriptBrainError:   (err: string | null) => void

  // ── Resume / clear ──────────────────────────────────────────────────────

  tryResumeFromStorage: () => boolean
  /** Wipe v3 state — only the "Tạo lại từ đầu" button calls this. */
  clearState: () => void
}

function loadFromStorage(): V3PipelineState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as V3PipelineState
    if (parsed.schemaVersion !== CURRENT_SCHEMA) {
      console.warn(`[V3_STATE] discarding stale payload (schema ${parsed.schemaVersion} ≠ ${CURRENT_SCHEMA})`)
      return null
    }
    // Defensive: reset transient rendering flags so resume never deadlocks
    if (parsed.creatorVideo?.status === 'rendering') {
      parsed.creatorVideo = { ...parsed.creatorVideo, status: 'idle', startedAt: undefined }
    }
    // Z32 — also reset any in-flight stage. tts/keyframe/preview/lipsync
    // get bumped back to 'idle' so the user can retry rather than seeing
    // a stuck stage indicator.
    if (parsed.creatorVideo && parsed.creatorVideo.stage !== 'completed' && parsed.creatorVideo.stage !== 'failed') {
      parsed.creatorVideo = { ...parsed.creatorVideo, stage: 'idle' }
    }
    // Z32 — pre-Z32 saves won't have creatorVideoConfig; backfill it.
    if (!parsed.creatorVideoConfig) {
      const empty = createEmptyV3State()
      parsed.creatorVideoConfig = empty.creatorVideoConfig
    }
    parsed.inserts = parsed.inserts.map((it) =>
      it.status === 'rendering'
        ? { ...it, status: 'idle', startedAt: undefined }
        : it
    )
    // Z31 — defensive scriptBrain hydration. Old payloads (pre-Z31) won't
    // have scriptBrain at all; fill in with empty defaults. Reset transient
    // isGenerating* flags so a refresh during script gen doesn't deadlock.
    if (!parsed.scriptBrain) {
      // Lazy import to avoid circular deps at module-load time
      const empty = createEmptyV3State()
      parsed.scriptBrain = empty.scriptBrain
    } else {
      parsed.scriptBrain.isGeneratingScript = false
      parsed.scriptBrain.isGeneratingVoice = false
      parsed.scriptBrain.error = null
    }
    return parsed
  } catch (err) {
    console.warn('[V3_STATE] load failed', err)
    return null
  }
}

function saveToStorage(state: V3PipelineState | null): void {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    else localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[V3_STATE] save failed (quota?)', err)
  }
}

/** Helper: update state immutably, save, set. */
function commit(
  set: (partial: { state: V3PipelineState }) => void,
  get: () => AdsVideoStoreState,
  updater: (cur: V3PipelineState) => V3PipelineState,
): void {
  const next = updater(get().state)
  next.updatedAt = Date.now()
  set({ state: next })
  saveToStorage(next)
}

export const useAdsVideoStore = create<AdsVideoStoreState>((set, get) => ({
  // Synchronous hydrate on first import — same trick as Z27. Avoids
  // a one-frame paint of the empty state when the user already has
  // a session in localStorage.
  state: loadFromStorage() ?? createEmptyV3State(),

  setPhase: (phase) =>
    commit(set, get, (s) => ({ ...s, phase })),

  setMode: (mode) =>
    commit(set, get, (s) => ({ ...s, mode })),

  setCostMode: (costMode) =>
    commit(set, get, (s) => ({ ...s, costMode })),

  setAvatar: (avatar) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, avatar } })),

  setProduct: (product) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, product } })),

  setScript: (script) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, script } })),

  setVoiceId: (voiceId) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, voiceId } })),

  setCreatorVideo: (clip) =>
    commit(set, get, (s) => ({ ...s, creatorVideo: clip })),

  patchCreatorVideo: (patch) =>
    commit(set, get, (s) => ({
      ...s,
      creatorVideo: s.creatorVideo ? { ...s.creatorVideo, ...patch } : s.creatorVideo,
    })),

  // ── Z32 creator video config ───────────────────────────────────────────

  setCreatorVideoConfig: (config) =>
    commit(set, get, (s) => ({ ...s, creatorVideoConfig: config })),

  patchCreatorVideoConfig: (patch) =>
    commit(set, get, (s) => ({
      ...s,
      creatorVideoConfig: { ...s.creatorVideoConfig, ...patch },
    })),

  applyCreatorPreset: (presetId) =>
    commit(set, get, (s) => {
      const preset = CREATOR_PRESETS[presetId]
      if (!preset) return s
      return {
        ...s,
        creatorVideoConfig: {
          ...s.creatorVideoConfig,
          setting: preset.setting,
          energy: preset.energy,
          wardrobeNote: preset.wardrobeNote,
          preset: presetId,
        },
      }
    }),

  setInserts: (inserts) =>
    commit(set, get, (s) => ({ ...s, inserts })),

  addInsert: (insert) =>
    commit(set, get, (s) => {
      const nextId = s.inserts.reduce((m, it) => Math.max(m, it.insertId), 0) + 1
      const full: ActionInsertClip = { ...insert, insertId: nextId }
      return { ...s, inserts: [...s.inserts, full] }
    }),

  patchInsert: (insertId, patch) =>
    commit(set, get, (s) => ({
      ...s,
      inserts: s.inserts.map((it) =>
        it.insertId === insertId ? { ...it, ...patch } : it
      ),
    })),

  removeInsert: (insertId) =>
    commit(set, get, (s) => ({
      ...s,
      inserts: s.inserts.filter((it) => it.insertId !== insertId),
    })),

  // ── Z31 Ad Brain ────────────────────────────────────────────────────────

  setAdStructure: (structure) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, structure },
    })),

  setAdAngle: (angle) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, angle },
    })),

  setTargetDurationSec: (targetDurationSec) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, targetDurationSec },
    })),

  setGeneratedScript: (script) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, script },
    })),

  patchScriptBlock: (blockIdx, patch) =>
    commit(set, get, (s) => {
      if (!s.scriptBrain.script) return s
      const blocks = [...s.scriptBrain.script.blocks]
      if (blockIdx < 0 || blockIdx >= blocks.length) return s
      blocks[blockIdx] = { ...blocks[blockIdx], ...patch }
      return {
        ...s,
        scriptBrain: {
          ...s.scriptBrain,
          script: { ...s.scriptBrain.script, blocks },
        },
      }
    }),

  setScriptTotalDuration: (sec) =>
    commit(set, get, (s) => {
      if (!s.scriptBrain.script) return s
      return {
        ...s,
        scriptBrain: {
          ...s.scriptBrain,
          script: { ...s.scriptBrain.script, totalDurationSec: sec },
        },
      }
    }),

  setHookVariants: (variants) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, hookVariants: variants },
    })),

  pickHookVariant: (idx) =>
    commit(set, get, (s) => {
      // When user picks a variant, also swap the HOOK block text to the variant.
      const variants = s.scriptBrain.hookVariants
      if (idx < -1 || idx >= variants.length) return s
      // -1 means "use the script's original HOOK block, don't override"
      if (idx === -1) {
        return {
          ...s,
          scriptBrain: { ...s.scriptBrain, pickedHookIdx: -1 },
        }
      }
      const variant = variants[idx]
      const script = s.scriptBrain.script
      let nextScript = script
      if (script) {
        const blocks = [...script.blocks]
        const hookBlockIdx = blocks.findIndex((b) => b.id === 'hook')
        if (hookBlockIdx >= 0) {
          blocks[hookBlockIdx] = {
            ...blocks[hookBlockIdx],
            text: variant.text,
            estDurationSec: variant.estDurationSec,
          }
          const totalDurationSec = Number(
            blocks.reduce((sum, b) => sum + b.estDurationSec, 0).toFixed(2),
          )
          nextScript = { ...script, blocks, totalDurationSec }
        }
      }
      return {
        ...s,
        scriptBrain: { ...s.scriptBrain, pickedHookIdx: idx, script: nextScript },
      }
    }),

  setVoiceCategory: (cat) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, voiceCategory: cat },
    })),

  setVoiceRecord: (rec) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, voice: rec },
    })),

  setIsGeneratingScript: (v) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, isGeneratingScript: v },
    })),

  setIsGeneratingVoice: (v) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, isGeneratingVoice: v },
    })),

  setScriptBrainError: (err) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, error: err },
    })),

  tryResumeFromStorage: () => {
    const loaded = loadFromStorage()
    if (!loaded) return false
    set({ state: loaded })
    return true
  },

  clearState: () => {
    set({ state: createEmptyV3State() })
    saveToStorage(null)
  },
}))
