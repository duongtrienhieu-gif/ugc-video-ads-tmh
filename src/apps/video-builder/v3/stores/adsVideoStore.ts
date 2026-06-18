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
  createEmptyV3State, createEmptyHybridState,
  type V3PipelineState, type V3Phase, type WorkflowMode, type CostMode,
  type VoiceAlignment,
  type ActionInsertClip, type CreatorVideoClip, type VoiceFirstSlot,
  // Z31 — Ad Brain
  type AdStructure, type AdAngle, type ScriptTargetDurationSec,
  type ScriptLang,
  type GeneratedScript, type HookVariant, type VoiceCategoryId,
  type VoiceRecord,
  // Z32 — Creator Video Engine
  type CreatorPresetId, type CreatorVideoConfig,
  // Z33 — Action Inserts
  type ActionPresetId,
  // Z34 — Auto Edit Engine
  type EditingStyleId, type SubtitleStyleId, type BgmStyleId,
  type AutoEditPlan,
  // Z35 — Export + Variation Engine
  type ExportFormatId, type ExportQualityId,
  type CtaVariation, type ExportPackage, type ThumbnailStyleId, type AiThumbnail,
  // Z36 — Final MP4 Assembly
  type ExportRenderStage,
} from '../types'
import { COST_MODE_CONFIG, DEFAULT_COST_MODE, defaultInsertRenderMode, DEFAULT_EXPORT_FORMAT, DEFAULT_EXPORT_QUALITY } from '../types'
import type { BrollScene, TimedBrollScene, BrollSceneKind, ShotIntent } from '../services/brollDirector'
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
  /** Manual override for the 1s motion pre-flight (null = follow cost mode). */
  setSkipPreviewOverride: (value: boolean | null) => void

  // ── Input setters ───────────────────────────────────────────────────────

  setAvatar:  (avatar: Model | null) => void
  setProduct: (product: Product | null) => void
  setScript:  (script: string) => void
  setVoiceId: (voiceId: string | null) => void

  // ── Creator video ───────────────────────────────────────────────────────

  setCreatorVideo:       (clip: CreatorVideoClip | null) => void
  patchCreatorVideo:     (patch: Partial<CreatorVideoClip>) => void
  /** Z98 B2 — store / clear the pre-generated real voice (voice-first). */
  setVoiceFirst:         (voice: VoiceFirstSlot | null) => void
  clearVoiceFirst:       () => void

  // ── Hybrid (P3e) ──────────────────────────────────────────────────────────
  /** Store the director plan (resets clips + final — indices change on re-plan). */
  setHybridPlan:          (scenes: TimedBrollScene[], rawScenes: BrollScene[]) => void
  /** Cache a rendered clip for scene INDEX (a re-render replaces just that one). */
  setHybridClip:          (idx: number, videoRef: string) => void
  /** P3t — patch ONE scene's conceptPrompt without re-running the director.
   *  The user fixes a drift inline + re-renders that single scene. P6a — the AI
   *  fixer may also flip kind / cameraFraming (e.g. a product macro → a creator
   *  emotion shot); pass them together so the prompt never fights the framing.
   *  Both optional → the manual textarea edit (conceptPrompt only) is unchanged. */
  setSceneConceptPrompt:  (idx: number, conceptPrompt: string, plan?: { kind?: BrollSceneKind; cameraFraming?: 'creator' | 'hands_noface'; shotIntent?: ShotIntent }) => void
  /** P3x — mark the creator-assets (giọng + mặt) generation in flight. Persisted
   *  so navigating away + back keeps the "đang tạo" lock (no double-charge).
   *  Pass a timestamp to start, undefined to clear. */
  setAssetsGenStartedAt:  (ts: number | undefined) => void
  /** P3z — track a per-scene render in flight (persisted). Pass an info object to
   *  set/merge (startedAt + optional taskId), or null to clear that index. */
  patchSceneRender:       (idx: number, info: { startedAt: number; taskId?: string } | null) => void
  /** P4p — persist the bulk-render queue so it survives a tab switch. */
  setHybridQueue:         (idxs: number[]) => void
  /** Store the one creator keyframe + voice for the whole video. */
  setHybridCreatorAssets: (a: { keyframeRef: string; voiceRef: string; voiceDurationSec: number; voiceAlignment?: VoiceAlignment; voiceId?: string }) => void
  /** Store the final assembled MP4. */
  setHybridFinal:         (videoRef: string) => void
  /** P5k — burned-caption settings (preset + on/off), applied at assemble. */
  setHybridCaption:       (patch: { captionsOn?: boolean; captionPreset?: import('../services/captionPresets').CaptionPresetId; captionKaraoke?: boolean; bannerOn?: boolean; bannerPreset?: import('../services/bannerPresets').BannerPresetId; bannerText?: string }) => void
  setHybridAssemble:      (patch: { assembling?: boolean; assembleRatio?: number; assembleStage?: string }) => void
  clearHybrid:            () => void
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
  /** Z33 — bulk-add a list of presets in one shot. Auto-assigns insertIds
   *  + sensible defaults (stage='idle', status='idle', resolution from
   *  current cost mode). Used by "Apply suggestions" button. */
  bulkAddInsertsFromPresets: (
    items: Array<{ presetId: ActionPresetId; durationSec: number; scriptKeyword?: string; voiceTimestampSec?: number | null; quote?: string; conceptPrompt?: string; renderMode?: ActionInsertClip['renderMode']; layout?: ActionInsertClip['layout']; cameraFraming?: ActionInsertClip['cameraFraming']; stickerStyle?: ActionInsertClip['stickerStyle']; stickerText?: string; stickerWordAnchor?: string }>,
  ) => void
  /** Patch one insert by insertId. */
  patchInsert:  (insertId: number, patch: Partial<ActionInsertClip>) => void
  /** Remove one insert by insertId. */
  removeInsert: (insertId: number) => void
  /** Z33 — remove ALL inserts (used by "Clear inserts" button). */
  clearAllInserts: () => void

  // ── Z34 Auto Edit Engine ────────────────────────────────────────────────

  setEditingStyle:    (styleId: EditingStyleId) => void
  setSubtitleStyle:   (styleId: SubtitleStyleId) => void
  setBgmStyle:        (styleId: BgmStyleId | null) => void
  setAutoEditPlan:    (plan: AutoEditPlan | null) => void
  setIsGeneratingPlan: (v: boolean) => void
  setIsExporting:     (v: boolean) => void
  setExportedVideoRef: (ref: string | null) => void
  setAutoEditError:   (err: string | null) => void

  // ── Z35 Export + Variation Engine ───────────────────────────────────────

  setExportFormat:        (formatId: ExportFormatId) => void
  setExportQuality:       (qualityId: ExportQualityId) => void
  setCtaVariations:       (variations: CtaVariation[]) => void
  pickCtaVariation:       (idx: number) => void
  pickHookForExport:      (idx: number) => void
  setExportPackage:       (pkg: ExportPackage | null) => void
  setThumbnailStyle:      (styleId: ThumbnailStyleId) => void
  // Z89 — AI thumbnail set (đợt 3)
  setAiThumbnails:        (thumbs: AiThumbnail[]) => void
  patchAiThumbnail:       (index: number, patch: Partial<AiThumbnail>) => void
  pickThumbnail:          (ref: string | null) => void
  setIsGeneratingThumbnails: (v: boolean) => void
  setIsGeneratingCtaVars: (v: boolean) => void
  setIsBuildingPackage:   (v: boolean) => void
  setExportError:         (err: string | null) => void
  /** Z35 — hydrate state from a SavedProject (used by Library "Load" button). */
  hydrateFromSnapshot:    (partial: Partial<V3PipelineState>) => void

  // ── Z36 Phase 7 final MP4 assembly state ───────────────────────────────

  setExportStage:        (stage: ExportRenderStage) => void
  setExportProgress:     (ratio: number) => void
  setExportPreset:       (preset: 'preview' | 'final') => void
  setAssembledVideoRef:  (ref: string | null) => void
  setFailedClipIds:      (ids: number[]) => void

  // ── Z31 Ad Brain (Script + Voice foundation) ────────────────────────────

  setAdStructure:        (structure: AdStructure) => void
  setAdShape:            (shape: import('../types').ScriptShape) => void
  setAdAngle:            (angle: AdAngle) => void
  setTargetDurationSec:  (sec: ScriptTargetDurationSec) => void
  /** Set the output language — locks script + voice + insert keywords to one language. */
  setOutputLang:         (lang: ScriptLang) => void
  /** Toggle "use my own script" mode (script text lives in inputs.script). */
  setUseOwnScript:       (v: boolean) => void
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
    // Flow-model migration — the 'preview' / 'approve' / 'final-render' phases
    // were removed (collapsed into the auto-edit step). Remap any persisted
    // session landing on one of them so the body switch always has a view.
    const legacyPhase = parsed.phase as string
    if (
      legacyPhase === 'preview' ||
      legacyPhase === 'approve' ||
      legacyPhase === 'final-render'
    ) {
      parsed.phase = 'auto-edit'
    }
    // Z36 — the cost-mode picker was removed; the engine runs one fixed 720p
    // profile. Snap any old persisted TEST/FULL session onto it so resumed
    // sessions can't keep rendering at a resolution the UI no longer exposes.
    parsed.costMode = DEFAULT_COST_MODE
    // Defensive: reset transient rendering flags so resume never deadlocks
    if (parsed.creatorVideo?.status === 'rendering') {
      parsed.creatorVideo = { ...parsed.creatorVideo, status: 'idle', startedAt: undefined }
    }
    // Z32/Z98 — a FINISHED render (videoRef present) MUST survive a refresh:
    // force it back to 'completed' instead of resetting its stage, so F5 NEVER
    // loses a paid lipsync video. Only an output-less render (truly mid-flight,
    // no videoRef) gets reset to 'idle' so the user can retry.
    if (parsed.creatorVideo?.videoRef) {
      parsed.creatorVideo = { ...parsed.creatorVideo, stage: 'completed', status: 'completed' }
    } else if (parsed.creatorVideo && parsed.creatorVideo.stage !== 'completed' && parsed.creatorVideo.stage !== 'failed') {
      parsed.creatorVideo = { ...parsed.creatorVideo, stage: 'idle' }
    }
    // Z32 — pre-Z32 saves won't have creatorVideoConfig; backfill it.
    if (!parsed.creatorVideoConfig) {
      const empty = createEmptyV3State()
      parsed.creatorVideoConfig = empty.creatorVideoConfig
    }
    // P3e — pre-hybrid saves won't have the hybrid slice; backfill it.
    if (!parsed.hybrid) parsed.hybrid = createEmptyHybridState()
    // P3h — `resolution` was removed from the slice (now a hard constant in
    // hybridConstants.ts: 480p render, 720p final). Drop any persisted field.
    if (parsed.hybrid) {
      const h = parsed.hybrid as unknown as Record<string, unknown>
      if ('resolution' in h) delete h.resolution
      // P5s — assemble is in-memory progress; an F5 killed the ffmpeg promise, so a
      // persisted `assembling:true` would stick forever. Always reset on hydrate.
      h.assembling = false; h.assembleRatio = 0; h.assembleStage = ''
    }
    // P3j — AdStructure collapsed from 8 sub-frameworks → 2 groups. Map any
    // persisted old value onto its group so the picker doesn't crash.
    if (parsed.scriptBrain && typeof parsed.scriptBrain.structure === 'string') {
      const old = parsed.scriptBrain.structure as string
      const INSTANT_OLD = ['VISUAL_HAND', 'RAPID_REASONS', 'UNEXPECTED_DISCOVERY', 'POV_FOR_YOU']
      const LEAD_OLD = ['STORY_CONFESSION', 'AUTHORITY_EXPERT', 'SOCIAL_PROOF', 'PROBLEM_SOLUTION']
      if (INSTANT_OLD.includes(old)) parsed.scriptBrain.structure = 'INSTANT'
      else if (LEAD_OLD.includes(old)) parsed.scriptBrain.structure = 'LEAD'
      else if (old !== 'INSTANT' && old !== 'LEAD') parsed.scriptBrain.structure = 'INSTANT'
    }
    // P3q — older brain payloads have no `shape` field. Backfill to 'narrative'
    // (the previous-implicit shape) so the picker + body prompt have a value.
    if (parsed.scriptBrain && typeof parsed.scriptBrain.shape !== 'string') {
      (parsed.scriptBrain as { shape: string }).shape = 'narrative'
    }
    // Defensive: a corrupted / pre-inserts payload may not carry an array.
    // Guard before .map so a bad localStorage blob can't crash hydration.
    if (!Array.isArray(parsed.inserts)) parsed.inserts = []
    parsed.inserts = parsed.inserts.map((it) => {
      let next = it
      // Reset legacy V3ClipStatus
      if (next.status === 'rendering') {
        next = { ...next, status: 'idle', startedAt: undefined }
      }
      // Z33 — reset in-flight insert stage so a refresh mid-render
      // doesn't leave the UI stuck on "Đang preview 1s..."
      if (next.stage === 'keyframe' || next.stage === 'preview_motion' || next.stage === 'video_full') {
        next = { ...next, stage: 'idle' }
      }
      // Pre-Z33 inserts won't have `stage` at all — backfill
      if (!('stage' in next) || !next.stage) {
        next = { ...next, stage: next.videoRef ? 'completed' : 'idle' }
      }
      return next
    })
    // Z34 — defensive autoEdit hydration. Old payloads (pre-Z34) won't
    // have autoEdit at all; fill with empty defaults. Reset transient
    // isGenerating / isExporting flags so refresh mid-plan doesn't deadlock.
    if (!parsed.autoEdit) {
      const empty = createEmptyV3State()
      parsed.autoEdit = empty.autoEdit
    } else {
      parsed.autoEdit.isGenerating = false
      parsed.autoEdit.isExporting = false
      parsed.autoEdit.error = null
    }
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
    // Z35 — defensive exportVariation hydration. Pre-Z35 saves backfilled.
    // Transient isGenerating / isBuilding reset to false on resume.
    if (!parsed.exportVariation) {
      const empty = createEmptyV3State()
      parsed.exportVariation = empty.exportVariation
    } else {
      parsed.exportVariation.isGeneratingCtaVariations = false
      parsed.exportVariation.isBuildingPackage = false
      parsed.exportVariation.error = null
      // Z89 — backfill AI-thumbnail fields for pre-Z89 saves + reset the
      // transient generating flag (a refresh mid-generate shouldn't deadlock).
      if (!Array.isArray(parsed.exportVariation.aiThumbnails)) parsed.exportVariation.aiThumbnails = []
      if (parsed.exportVariation.pickedThumbnailRef === undefined) parsed.exportVariation.pickedThumbnailRef = null
      parsed.exportVariation.isGeneratingThumbnails = false
      // Z88 — the Format + Quality pickers were removed (Director auto-decides:
      // TikTok 9:16 · FINAL 1080). Snap any persisted draft onto those defaults
      // so an old session can't stay stuck at TEST 480 / a hidden format with
      // NO UI left to change it (mirrors the costMode reset above).
      parsed.exportVariation.qualityId = DEFAULT_EXPORT_QUALITY
      parsed.exportVariation.formatId = DEFAULT_EXPORT_FORMAT
      // Z36 — reset in-flight export stage (assembledVideoRef survives)
      if (parsed.exportVariation.exportStage &&
          parsed.exportVariation.exportStage !== 'done' &&
          parsed.exportVariation.exportStage !== 'failed' &&
          parsed.exportVariation.exportStage !== 'idle') {
        parsed.exportVariation.exportStage = 'idle'
        parsed.exportVariation.exportProgress = 0
      }
      // Backfill Z36 fields for pre-Z36 saves
      if (parsed.exportVariation.exportStage === undefined) {
        parsed.exportVariation.exportStage = 'idle'
        parsed.exportVariation.exportProgress = 0
        parsed.exportVariation.exportPreset = 'preview'
        parsed.exportVariation.assembledVideoRef = null
        parsed.exportVariation.failedClipIds = []
      }
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

/** A previously-built auto-edit plan snapshots refs to the creator video +
 *  every insert. Any STRUCTURAL change to those clips (add/remove/replace)
 *  leaves the plan pointing at refs that no longer match — at export the
 *  assembler would fetch a removed/stale ref. Drop the plan so the user is
 *  forced to rebuild it from the current clip set. */
function invalidatePlan(
  autoEdit: V3PipelineState['autoEdit'],
): V3PipelineState['autoEdit'] {
  return autoEdit.plan ? { ...autoEdit, plan: null } : autoEdit
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

  setSkipPreviewOverride: (skipPreviewOverride) =>
    commit(set, get, (s) => ({ ...s, skipPreviewOverride })),

  setAvatar: (avatar) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, avatar } })),

  setProduct: (product) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, product } })),

  setScript: (script) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, script } })),

  setVoiceId: (voiceId) =>
    commit(set, get, (s) => ({ ...s, inputs: { ...s.inputs, voiceId } })),

  setCreatorVideo: (clip) =>
    commit(set, get, (s) => ({ ...s, creatorVideo: clip, autoEdit: invalidatePlan(s.autoEdit) })),

  setVoiceFirst: (voice) =>
    commit(set, get, (s) => ({ ...s, voiceFirst: voice })),

  clearVoiceFirst: () =>
    commit(set, get, (s) => ({ ...s, voiceFirst: null })),

  // ── Hybrid (P3e) ──────────────────────────────────────────────────────────
  setHybridPlan: (scenes, rawScenes) =>
    commit(set, get, (s) => ({
      ...s,
      // New plan → scene indices change, so old clips + final are stale. Keep the
      // creator keyframe/voice (not plan-dependent).
      hybrid: { ...s.hybrid, rawScenes, scenes, clips: {}, finalVideoRef: undefined },
    })),

  setHybridClip: (idx, videoRef) =>
    commit(set, get, (s) => ({
      ...s,
      // A clip changed → the previous final MP4 is stale.
      hybrid: { ...s.hybrid, clips: { ...s.hybrid.clips, [idx]: videoRef }, finalVideoRef: undefined },
    })),

  // P3t — let the user fix a director-hallucinated conceptPrompt INLINE on the
  // scene card and re-render that ONE scene, without re-creating the voice +
  // keyframe (which is what "Tạo lại" used to force). Persisted, so the edit
  // survives a refresh.
  setSceneConceptPrompt: (idx, conceptPrompt, plan) =>
    commit(set, get, (s) => {
      const cur = s.hybrid.scenes
      if (!cur) return s
      const scenes = cur.slice()
      if (idx < 0 || idx >= scenes.length) return s
      scenes[idx] = {
        ...scenes[idx],
        conceptPrompt,
        ...(plan?.kind ? { kind: plan.kind } : {}),
        ...(plan?.cameraFraming ? { cameraFraming: plan.cameraFraming } : {}),
        ...(plan?.shotIntent ? { shotIntent: plan.shotIntent } : {}),   // P6t — keep the scene on the intent spine + tag truthful
      }
      return { ...s, hybrid: { ...s.hybrid, scenes } }
    }),

  setAssetsGenStartedAt: (ts) =>
    commit(set, get, (s) => ({
      ...s,
      hybrid: { ...s.hybrid, assetsGenStartedAt: ts },
    })),

  patchSceneRender: (idx, info) =>
    commit(set, get, (s) => {
      const cur = { ...(s.hybrid.renderingScenes ?? {}) }
      if (info === null) delete cur[idx]
      else cur[idx] = { ...cur[idx], ...info }
      return { ...s, hybrid: { ...s.hybrid, renderingScenes: cur } }
    }),

  // P4p — persist the render QUEUE so "Tạo tất cả" survives a tab switch (the queue
  // was local React state → lost on unmount → queued cảnh treo mãi after returning).
  setHybridQueue: (idxs) =>
    commit(set, get, (s) => ({ ...s, hybrid: { ...s.hybrid, queuedScenes: idxs } })),

  setHybridCreatorAssets: (a) =>
    commit(set, get, (s) => ({
      ...s,
      hybrid: { ...s.hybrid, keyframeRef: a.keyframeRef, voiceRef: a.voiceRef, voiceDurationSec: a.voiceDurationSec, voiceAlignment: a.voiceAlignment, voiceId: a.voiceId },
    })),

  setHybridFinal: (videoRef) =>
    commit(set, get, (s) => ({ ...s, hybrid: { ...s.hybrid, finalVideoRef: videoRef } })),

  setHybridCaption: (patch) =>
    commit(set, get, (s) => ({ ...s, hybrid: { ...s.hybrid, ...patch } })),

  setHybridAssemble: (patch) =>
    commit(set, get, (s) => ({ ...s, hybrid: { ...s.hybrid, ...patch } })),

  clearHybrid: () =>
    commit(set, get, (s) => ({ ...s, hybrid: createEmptyHybridState() })),

  patchCreatorVideo: (patch) =>
    commit(set, get, (s) => ({
      ...s,
      creatorVideo: s.creatorVideo ? { ...s.creatorVideo, ...patch } : s.creatorVideo,
      // A re-render hands back a new videoRef — the prior plan still points
      // at the old creator clip, so drop it. Status-only patches don't.
      autoEdit: patch.videoRef !== undefined ? invalidatePlan(s.autoEdit) : s.autoEdit,
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
    commit(set, get, (s) => ({ ...s, inserts, autoEdit: invalidatePlan(s.autoEdit) })),

  addInsert: (insert) =>
    commit(set, get, (s) => {
      const nextId = s.inserts.reduce((m, it) => Math.max(m, it.insertId), 0) + 1
      const full: ActionInsertClip = { ...insert, insertId: nextId }
      return { ...s, inserts: [...s.inserts, full], autoEdit: invalidatePlan(s.autoEdit) }
    }),

  patchInsert: (insertId, patch) =>
    commit(set, get, (s) => ({
      ...s,
      inserts: s.inserts.map((it) =>
        it.insertId === insertId ? { ...it, ...patch } : it
      ),
      // Re-rendering an insert swaps its videoRef — invalidate the plan that
      // referenced the old one. Status/stage patches leave the plan intact.
      autoEdit: patch.videoRef !== undefined ? invalidatePlan(s.autoEdit) : s.autoEdit,
    })),

  removeInsert: (insertId) =>
    commit(set, get, (s) => ({
      ...s,
      inserts: s.inserts.filter((it) => it.insertId !== insertId),
      autoEdit: invalidatePlan(s.autoEdit),
    })),

  // Z33 — bulk add from preset suggestions
  bulkAddInsertsFromPresets: (items) =>
    commit(set, get, (s) => {
      // Pick resolution from current cost mode
      const resolution: ActionInsertClip['resolution'] =
        s.costMode === 'FULL' ? '1080p' :
        s.costMode === 'STANDARD' ? '720p' :
        '480p'
      // Enforce the cost-mode insert ceiling — never let a bulk apply push the
      // total past what the chosen mode budgeted for (drives render cost).
      // Z98 #5 — stickers are EXEMPT: they're 0-credit local overlays, additive
      // on top of the talking-head, so they don't eat the paid-render budget.
      const maxInserts = COST_MODE_CONFIG[s.costMode].insertCount.max
      const stickerItems = items.filter((it) => it.renderMode === 'sticker')
      const sceneItems = items.filter((it) => it.renderMode !== 'sticker')
      const room = Math.max(0, maxInserts - s.inserts.length)
      const accepted = [...sceneItems.slice(0, room), ...stickerItems]
      let nextId = s.inserts.reduce((m, it) => Math.max(m, it.insertId), 0)
      const newInserts: ActionInsertClip[] = accepted.map((item, i) => {
        nextId += 1
        return {
          insertId: nextId,
          presetId: item.presetId,
          order: s.inserts.length + i,
          stage: 'idle' as const,
          status: 'idle' as const,
          durationSec: item.durationSec,
          resolution,
          scriptKeyword: item.scriptKeyword,
          voiceTimestampSec: item.voiceTimestampSec ?? null,
          renderMode: item.renderMode ?? defaultInsertRenderMode(item.presetId),
          layout: item.layout ?? 'cut',
          ...(item.cameraFraming ? { cameraFraming: item.cameraFraming } : {}),
          ...(item.quote ? { quote: item.quote } : {}),
          ...(item.conceptPrompt ? { conceptPrompt: item.conceptPrompt } : {}),
          // Z98 #5 — sticker fields (only present on sticker scenes).
          ...(item.stickerStyle ? { stickerStyle: item.stickerStyle } : {}),
          ...(item.stickerText ? { stickerText: item.stickerText } : {}),
          ...(item.stickerWordAnchor ? { stickerWordAnchor: item.stickerWordAnchor } : {}),
        }
      })
      return { ...s, inserts: [...s.inserts, ...newInserts], autoEdit: invalidatePlan(s.autoEdit) }
    }),

  clearAllInserts: () =>
    commit(set, get, (s) => ({ ...s, inserts: [], autoEdit: invalidatePlan(s.autoEdit) })),

  // ── Z34 Auto Edit ──────────────────────────────────────────────────────

  setEditingStyle: (styleId) =>
    commit(set, get, (s) => ({
      ...s,
      autoEdit: { ...s.autoEdit, styleId },
    })),

  setSubtitleStyle: (styleId) =>
    commit(set, get, (s) => ({
      ...s,
      autoEdit: { ...s.autoEdit, subtitleStyleId: styleId },
    })),

  setBgmStyle: (styleId) =>
    commit(set, get, (s) => ({
      ...s,
      autoEdit: { ...s.autoEdit, bgmStyleId: styleId },
    })),

  setAutoEditPlan: (plan) =>
    commit(set, get, (s) => ({
      ...s,
      autoEdit: { ...s.autoEdit, plan },
    })),

  setIsGeneratingPlan: (v) =>
    commit(set, get, (s) => ({
      ...s,
      autoEdit: { ...s.autoEdit, isGenerating: v },
    })),

  setIsExporting: (v) =>
    commit(set, get, (s) => ({
      ...s,
      autoEdit: { ...s.autoEdit, isExporting: v },
    })),

  setExportedVideoRef: (ref) =>
    commit(set, get, (s) => ({
      ...s,
      autoEdit: { ...s.autoEdit, exportedVideoRef: ref },
    })),

  setAutoEditError: (err) =>
    commit(set, get, (s) => ({
      ...s,
      autoEdit: { ...s.autoEdit, error: err },
    })),

  // ── Z35 Export + Variation ─────────────────────────────────────────────

  setExportFormat: (formatId) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, formatId },
    })),

  setExportQuality: (qualityId) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, qualityId },
    })),

  setCtaVariations: (variations) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, ctaVariations: variations },
    })),

  pickCtaVariation: (idx) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, pickedCtaIdx: idx },
    })),

  pickHookForExport: (idx) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, pickedHookIdxForExport: idx },
    })),

  setExportPackage: (pkg) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, lastPackage: pkg },
    })),

  setThumbnailStyle: (styleId) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, thumbnailStyleId: styleId },
    })),

  // Z89 — AI thumbnail set (đợt 3)
  setAiThumbnails: (thumbs) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, aiThumbnails: thumbs },
    })),
  patchAiThumbnail: (index, patch) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: {
        ...s.exportVariation,
        aiThumbnails: s.exportVariation.aiThumbnails.map((t, i) => (i === index ? { ...t, ...patch } : t)),
      },
    })),
  pickThumbnail: (ref) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, pickedThumbnailRef: ref },
    })),
  setIsGeneratingThumbnails: (v) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, isGeneratingThumbnails: v },
    })),

  setIsGeneratingCtaVars: (v) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, isGeneratingCtaVariations: v },
    })),

  setIsBuildingPackage: (v) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, isBuildingPackage: v },
    })),

  setExportError: (err) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, error: err },
    })),

  hydrateFromSnapshot: (partial) =>
    commit(set, get, (s) => ({
      ...s,
      ...partial,
    })),

  // ── Z36 Phase 7 final MP4 assembly ──────────────────────────────────────

  setExportStage: (stage) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, exportStage: stage },
    })),

  setExportProgress: (ratio) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, exportProgress: ratio },
    })),

  setExportPreset: (preset) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, exportPreset: preset },
    })),

  setAssembledVideoRef: (ref) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, assembledVideoRef: ref },
    })),

  setFailedClipIds: (ids) =>
    commit(set, get, (s) => ({
      ...s,
      exportVariation: { ...s.exportVariation, failedClipIds: ids },
    })),

  // ── Z31 Ad Brain ────────────────────────────────────────────────────────

  setAdStructure: (structure) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, structure },
    })),

  setAdShape: (shape) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, shape },
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

  setOutputLang: (outputLang) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, outputLang },
    })),

  setUseOwnScript: (useOwnScript) =>
    commit(set, get, (s) => ({
      ...s,
      scriptBrain: { ...s.scriptBrain, useOwnScript },
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
