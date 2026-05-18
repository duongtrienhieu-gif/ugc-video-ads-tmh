// ── Ads Video Engine v3 — Types ──────────────────────────────────────────────
// Z30 PHASE 1 RESET — creator-first ad pipeline.
//
// Replaces the v2 cinematic/coverage architecture (50-cut motion graph,
// editorial layers, transition graph, motion blueprint matrix) with a
// simpler creator-centric model:
//
//   INPUT → SCRIPT+VOICE → MAIN CREATOR VIDEO → ACTION INSERTS →
//   PREVIEW → APPROVE/REJECT → FINAL RENDER → AUTO EDIT → EXPORT
//
// MAIN CREATOR VIDEO ≈ 70-80% of the final ad — one continuous lip-synced
// avatar talking head. ACTION INSERTS ≈ 3-8 short product moments (hold
// bottle, open cap, point label, scrolling phone, etc).
//
// No coverage graph. No motion blueprint matrix. No editorial cuts.
// Just: one main shot + a handful of insert presets + ffmpeg concat.
// ─────────────────────────────────────────────────────────────────────────────

import type { Model, Product } from '../../../stores/types'

// ── Top-level phase enum ────────────────────────────────────────────────────
// Sequential workflow; each phase has its own view + persisted state.

export type V3Phase =
  | 'input'           // pick avatar + product + script + voice
  | 'creator-video'   // generate the main lip-synced avatar shot
  | 'action-inserts'  // pick + render 3-8 action preset clips
  | 'preview'         // play through all clips in sequence
  | 'approve'         // per-clip approve / reject / lock
  | 'final-render'    // upgrade approved clips to FINAL_1080
  | 'auto-edit'       // ffmpeg concat + transitions + subtitles + audio
  | 'export'          // download MP4

export const V3_PHASE_LABEL_VI: Record<V3Phase, string> = {
  'input':          'Chọn input',
  'creator-video':  'Video creator chính',
  'action-inserts': 'Action inserts',
  'preview':        'Preview',
  'approve':        'Duyệt / Loại',
  'final-render':   'Render bản cuối',
  'auto-edit':      'Auto edit',
  'export':         'Export MP4',
}

// ── Workflow modes ──────────────────────────────────────────────────────────
// User-facing layer that controls AUTOMATION level. Z30 spec §5.
//
//   QUICK    — user uploads product only; AI picks creator/script/voice/scenes
//   HYBRID   — user picks avatar + voice; AI fills the rest
//   ADVANCED — full manual control of every step

export type WorkflowMode = 'QUICK' | 'HYBRID' | 'ADVANCED'

export interface WorkflowModeConfig {
  id: WorkflowMode
  labelVi: string
  descriptionVi: string
  /** What the user must provide */
  userProvides: string[]
  /** What the AI auto-fills */
  aiAutofills: string[]
  /** Tone for UI tint */
  tone: 'emerald' | 'violet' | 'amber'
}

export const WORKFLOW_MODE_CONFIG: Record<WorkflowMode, WorkflowModeConfig> = {
  QUICK: {
    id: 'QUICK',
    labelVi: 'Nhanh',
    descriptionVi: 'Chỉ cần product — AI tự pick creator + script + voice + cảnh',
    userProvides: ['Product'],
    aiAutofills: ['Creator', 'Script', 'Voice', 'Action inserts'],
    tone: 'emerald',
  },
  HYBRID: {
    id: 'HYBRID',
    labelVi: 'Bán tự động',
    descriptionVi: 'Bạn pick avatar + voice — AI lo phần còn lại',
    userProvides: ['Product', 'Avatar', 'Voice'],
    aiAutofills: ['Script', 'Action inserts'],
    tone: 'violet',
  },
  ADVANCED: {
    id: 'ADVANCED',
    labelVi: 'Chuyên gia',
    descriptionVi: 'Bạn kiểm soát mọi thứ — script, voice, từng insert',
    userProvides: ['Product', 'Avatar', 'Voice', 'Script', 'Inserts'],
    aiAutofills: [],
    tone: 'amber',
  },
}

export const DEFAULT_WORKFLOW_MODE: WorkflowMode = 'HYBRID'

// ── Cost modes ──────────────────────────────────────────────────────────────
// Z30 spec §8. Controls the QUALITY / DURATION / COST of every render.

export type CostMode = 'TEST' | 'STANDARD' | 'FULL'

export interface CostModeConfig {
  id: CostMode
  labelVi: string
  descriptionVi: string
  /** Final video target duration (seconds) */
  targetDurationSec: number
  /** How many action-insert clips to generate */
  insertCount: { min: number; max: number }
  /** Kling resolution sent to the render API */
  resolution: '480p' | '720p' | '1080p'
  /** Estimated total cost for the WHOLE project at this mode (USD) */
  estimatedUsd: { min: number; max: number }
  /** Tone for UI tint */
  tone: 'amber' | 'violet' | 'pink'
  /** Short tag rendered onto the chip */
  badge: string
}

export const COST_MODE_CONFIG: Record<CostMode, CostModeConfig> = {
  TEST: {
    id: 'TEST',
    labelVi: 'TEST',
    descriptionVi: '15-20s · 480p · 3 inserts · motion thấp · ~$1-3 cho toàn project',
    targetDurationSec: 18,
    insertCount: { min: 2, max: 3 },
    resolution: '480p',
    estimatedUsd: { min: 1, max: 3 },
    tone: 'amber',
    badge: '⚡ CHEAP · MẶC ĐỊNH',
  },
  STANDARD: {
    id: 'STANDARD',
    labelVi: 'STANDARD',
    descriptionVi: '30s · 720p · 5 inserts · chất lượng cân bằng · ~$3-5',
    targetDurationSec: 30,
    insertCount: { min: 4, max: 5 },
    resolution: '720p',
    estimatedUsd: { min: 3, max: 5 },
    tone: 'violet',
    badge: 'STANDARD',
  },
  FULL: {
    id: 'FULL',
    labelVi: 'FULL',
    descriptionVi: '45-60s · 1080p · 7-8 inserts · HD export · ~$6-10',
    targetDurationSec: 50,
    insertCount: { min: 6, max: 8 },
    resolution: '1080p',
    estimatedUsd: { min: 6, max: 10 },
    tone: 'pink',
    badge: 'PREMIUM',
  },
}

export const DEFAULT_COST_MODE: CostMode = 'TEST'

// ── Action preset enum ──────────────────────────────────────────────────────
// Z30 spec §7. The ONLY motion primitives the v3 engine emits. Every
// action insert is one of these — no freeform motion.

export type ActionPresetId =
  | 'HOLD_PRODUCT'
  | 'OPEN_CAP'
  | 'POINT_LABEL'
  | 'DRINK'
  | 'TAKE_PILL'
  | 'UNBOX'
  | 'PHONE_SCROLL'
  | 'BEFORE_AFTER_REACTION'

// ── Per-clip render status (v3) ─────────────────────────────────────────────
// Simplified vs v2's TimelineRenderStatus — no queued/locked-vs-completed
// distinction. Just the verdict trail.

export type V3ClipStatus =
  | 'idle'        // not yet rendered
  | 'rendering'   // in flight
  | 'completed'   // has videoRef
  | 'approved'    // user OK — eligible for final-render upgrade
  | 'rejected'    // user NO — excluded from final video
  | 'locked'      // approved + protected from any rerender
  | 'failed'      // last render attempt errored

export const V3_CLIP_STATUS_LABEL_VI: Record<V3ClipStatus, string> = {
  idle:      'Chưa render',
  rendering: 'Đang render...',
  completed: 'Đã render',
  approved:  'Đã duyệt ✓',
  rejected:  'Đã loại',
  locked:    'Đã khoá 🔒',
  failed:    'Thất bại',
}

// ── Main Creator Video clip ─────────────────────────────────────────────────
// The "talking head" — one per project. 15-45s lip-synced shot.

export interface CreatorVideoClip {
  /** asset:xxx of the rendered lip-synced video */
  videoRef?: string
  /** asset:xxx of the source still keyframe (avatar pose) */
  keyframeRef?: string
  /** Voice TTS asset ref */
  voiceRef?: string
  /** Status of the rendering */
  status: V3ClipStatus
  durationSec: number
  /** Render profile used */
  resolution: '480p' | '720p' | '1080p'
  error?: string
  startedAt?: number
  finishedAt?: number
  /** Z30 — Hero flag (only one clip can be HERO for the project) */
  hero?: boolean
}

// ── Action Insert clip ──────────────────────────────────────────────────────
// One of N inserts. Each tied to a preset.

export interface ActionInsertClip {
  /** Unique id within the project */
  insertId: number
  /** Which preset this clip realises */
  presetId: ActionPresetId
  /** Index in the planned timeline (after main creator video) */
  order: number
  /** asset:xxx of the source still (product or scene shot) */
  keyframeRef?: string
  /** asset:xxx of the rendered insert clip */
  videoRef?: string
  /** Duration in seconds (preset default, may be tweaked by user) */
  durationSec: number
  /** Resolution used for this render */
  resolution: '480p' | '720p' | '1080p'
  status: V3ClipStatus
  error?: string
  startedAt?: number
  finishedAt?: number
  hero?: boolean
}

// ── Top-level pipeline state ────────────────────────────────────────────────

export interface V3PipelineState {
  /** Schema version — bump if shape changes incompatibly */
  schemaVersion: 1
  /** Current step in the workflow */
  phase: V3Phase
  /** Automation level */
  mode: WorkflowMode
  /** Quality / cost preset */
  costMode: CostMode

  /** Inputs picked by the user */
  inputs: {
    avatar: Model | null
    product: Product | null
    script: string
    voiceId: string | null
  }

  /** Main creator video (the talking head — single instance per project) */
  creatorVideo: CreatorVideoClip | null

  /** Action inserts — 3-8 short product moments */
  inserts: ActionInsertClip[]

  /** Timestamp this state was last saved (informational) */
  updatedAt: number
}

export function createEmptyV3State(): V3PipelineState {
  return {
    schemaVersion: 1,
    phase: 'input',
    mode: DEFAULT_WORKFLOW_MODE,
    costMode: DEFAULT_COST_MODE,
    inputs: {
      avatar: null,
      product: null,
      script: '',
      voiceId: null,
    },
    creatorVideo: null,
    inserts: [],
    updatedAt: Date.now(),
  }
}
