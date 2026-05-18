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
  | 'input'           // pick avatar + product (basic inputs only)
  | 'script-voice'    // Z31 — Ad Brain: structure + angle + script + voice timing
  | 'creator-video'   // generate the main lip-synced avatar shot
  | 'action-inserts'  // pick + render 3-8 action preset clips
  | 'preview'         // play through all clips in sequence
  | 'approve'         // per-clip approve / reject / lock
  | 'final-render'    // upgrade approved clips to FINAL_1080
  | 'auto-edit'       // ffmpeg concat + transitions + subtitles + audio
  | 'export'          // download MP4

export const V3_PHASE_LABEL_VI: Record<V3Phase, string> = {
  'input':          'Chọn input',
  'script-voice':   'Script + Voice',
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
// Z30/Z33 — the ONLY motion primitives the v3 engine emits. Every action
// insert is one of these — NO freeform motion. Z33 spec §5 expanded the
// catalogue from 8 → 12 presets to cover the full "supporting B-roll"
// vocabulary: opening cap, holding bottle, taking pill, pointing label,
// phone scrolling, before/after reaction, product closeup, unbox,
// show package, desk product, bag pull, etc.
//
// Stability rule (Z33 §7): all presets must remain slow + simple +
// readable + low-motion. NO complex hand interactions, NO fast physics,
// NO object deformation — AI video breaks on those.

export type ActionPresetId =
  | 'HOLD_PRODUCT'
  | 'OPEN_CAP'
  | 'POINT_LABEL'
  | 'DRINK'
  | 'TAKE_PILL'
  | 'UNBOX'
  | 'PHONE_SCROLL'
  | 'BEFORE_AFTER_REACTION'
  // Z33 — Phase 4 additions
  | 'PRODUCT_CLOSEUP'
  | 'SHOW_PACKAGE'
  | 'DESK_PRODUCT'
  | 'BAG_PRODUCT_PULL'

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

// ═════════════════════════════════════════════════════════════════════════
// Z32 — Main Creator Video Engine (Phase 3)
// ═════════════════════════════════════════════════════════════════════════
// The "talking head" track — 70-80% of the final ad. Pipeline:
//   1. TTS (ElevenLabs) → MP3 + measured duration
//   2. Keyframe (KIE GPT-4o) → still with identity locked from avatar
//   3. Preview-motion (KIE Kling Avatar) — 1-2s motion test
//   4. Full lipsync (KIE Kling Avatar) → final talking video
// ─────────────────────────────────────────────────────────────────────────

// ── Creator settings — where the talking happens (Z32 §4) ─────────────────

export type CreatorSettingId =
  | 'selfie_handheld'
  | 'desk_talking'
  | 'couch_talking'
  | 'bathroom_mirror'
  | 'kitchen_talking'
  | 'gym_selfie'
  | 'walking_vlog'
  | 'product_demo'

export const DEFAULT_CREATOR_SETTING: CreatorSettingId = 'selfie_handheld'

// ── Creator energy levels (Z32 §13) ───────────────────────────────────────

export type CreatorEnergyLevel =
  | 'calm'
  | 'conversational'
  | 'excited'
  | 'emotional'
  | 'authority'
  | 'aggressive_tiktok'

export const DEFAULT_CREATOR_ENERGY: CreatorEnergyLevel = 'conversational'

// ── Creator presets — combos of setting + energy + wardrobe (Z32 §9) ──────

export type CreatorPresetId =
  | 'malay_mom_casual'
  | 'skincare_creator'
  | 'gym_coach'
  | 'office_woman'
  | 'tech_reviewer'
  | 'young_tiktok_girl'

// ── Render stage tracking ─────────────────────────────────────────────────

export type CreatorVideoStage =
  | 'idle'
  | 'tts'
  | 'keyframe'
  | 'preview_motion'
  | 'lipsync_full'
  | 'completed'
  | 'failed'

export const CREATOR_VIDEO_STAGE_LABEL_VI: Record<CreatorVideoStage, string> = {
  idle:           'Chưa bắt đầu',
  tts:            'Đang tạo voice (ElevenLabs)...',
  keyframe:       'Đang tạo keyframe (GPT-4o)...',
  preview_motion: 'Đang tạo preview motion 1-2s...',
  lipsync_full:   'Đang lipsync video đầy đủ...',
  completed:      'Đã xong ✓',
  failed:         'Lỗi',
}

// ── Creator video config (user's picks BEFORE rendering) ─────────────────

export interface CreatorVideoConfig {
  setting: CreatorSettingId
  energy: CreatorEnergyLevel
  /** Optional preset shortcut — null = customised manually */
  preset: CreatorPresetId | null
  /** Wardrobe override — empty = preset's default */
  wardrobeNote: string
  resolution: '480p' | '720p' | '1080p'
}

export function createDefaultCreatorVideoConfig(): CreatorVideoConfig {
  return {
    setting: DEFAULT_CREATOR_SETTING,
    energy: DEFAULT_CREATOR_ENERGY,
    preset: null,
    wardrobeNote: '',
    resolution: '480p',  // Z30 cheap-default
  }
}

// ── Main Creator Video clip ─────────────────────────────────────────────────
// The "talking head" — one per project. 15-45s lip-synced shot.

export interface CreatorVideoClip {
  /** Multi-stage status. Renderer flips through these on its way to 'completed'. */
  stage: CreatorVideoStage
  /** Legacy V3ClipStatus for back-compat — kept in sync with `stage`. */
  status: V3ClipStatus

  /** Asset:xxx of the ElevenLabs TTS audio (MP3) */
  voiceRef?: string
  voiceDurationSec?: number
  voiceId?: string

  /** Asset:xxx of the still keyframe (avatar in setting + energy + wardrobe) */
  keyframeRef?: string
  keyframePromptUsed?: string

  /** Asset:xxx of the 1-2s preview-motion test */
  previewVideoRef?: string
  /** Lipsync task id for the FULL render — used to re-poll if user refreshes */
  fullLipsyncTaskId?: string
  /** Asset:xxx of the FINAL full lipsync video */
  videoRef?: string

  /** Config used for this render — captured for re-render parity */
  config: CreatorVideoConfig

  durationSec: number
  resolution: '480p' | '720p' | '1080p'
  error?: string
  startedAt?: number
  finishedAt?: number
  /** Z30 — Hero flag */
  hero?: boolean
}

// ── Insert render stage ────────────────────────────────────────────────────
// Z33 — Like CreatorVideoStage but for action inserts. Inserts are 2-stage
// (keyframe → video) — no TTS, no lipsync. The preview is a 1-second
// motion test rendered at TEST_480 BEFORE the full insert render.

export type InsertRenderStage =
  | 'idle'             // nothing started yet
  | 'keyframe'         // KIE GPT-4o generating the still
  | 'preview_motion'   // 1s motion test
  | 'video_full'       // full insert clip
  | 'completed'        // has videoRef
  | 'failed'

export const INSERT_STAGE_LABEL_VI: Record<InsertRenderStage, string> = {
  idle:            'Chưa render',
  keyframe:        'Đang tạo keyframe...',
  preview_motion:  'Đang preview 1s...',
  video_full:      'Đang render full...',
  completed:       'Đã xong ✓',
  failed:          'Lỗi',
}

// ── Action Insert clip ──────────────────────────────────────────────────────
// One of N inserts. Each tied to a preset. Z33: extended with multi-stage
// + scriptKeyword (for timing engine traceability) + suggestedAt timestamp.

export interface ActionInsertClip {
  /** Unique id within the project */
  insertId: number
  /** Which preset this clip realises */
  presetId: ActionPresetId
  /** Index in the planned timeline (after main creator video) */
  order: number

  /** Z33 — render pipeline stage (orthogonal to verdict status) */
  stage: InsertRenderStage

  /** asset:xxx of the source still (product or scene shot) */
  keyframeRef?: string
  /** Compiled keyframe prompt — exposed for debug */
  keyframePromptUsed?: string

  /** Z33 — 1s motion preview test (cheap pre-flight check) */
  previewVideoRef?: string
  /** Kling task id for the FULL render */
  fullTaskId?: string
  /** asset:xxx of the rendered insert clip (full version) */
  videoRef?: string

  /** Duration in seconds (preset default, may be tweaked by user) */
  durationSec: number
  /** Resolution used for this render */
  resolution: '480p' | '720p' | '1080p'

  /** Z33 — script keyword that triggered this insert (from suggester).
   *  Empty for manually-added inserts. Used by timing engine to anchor
   *  the insert at the right voice timestamp. */
  scriptKeyword?: string
  /** Z33 — target timestamp within the voice timeline (seconds from 0).
   *  null = no anchor, insert plays at natural position in `order`. */
  voiceTimestampSec?: number | null

  /** Verdict status (Z26-style approve / reject / lock) */
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

  /** Z31 Ad Brain — structure + angle + script + voice + master timeline */
  scriptBrain: ScriptBrain

  /** Z32 — user's creator-video picks BEFORE rendering. Survives across
   *  edits even when creatorVideo (the render output) is null. */
  creatorVideoConfig: CreatorVideoConfig

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
    scriptBrain: createEmptyScriptBrain(),
    creatorVideoConfig: createDefaultCreatorVideoConfig(),
    creatorVideo: null,
    inserts: [],
    updatedAt: Date.now(),
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Z31 — AD BRAIN (Phase 2: Script + Voice Foundation)
// ═════════════════════════════════════════════════════════════════════════
// Replaces the v2 "cinematic storyboard" with a lean TikTok-native ad
// flow. The Ad Brain produces:
//   • A script in 5 blocks (HOOK / PAIN / DISCOVERY / BENEFIT / CTA)
//   • 3 hook variants the user picks from
//   • Voice category + voice ID matched to the avatar
//   • Per-block timing estimates (the MASTER TIMELINE — everything
//     downstream syncs to this)
//
// NO scene generation. NO motion. Pure logic + Gemini text + ElevenLabs TTS.

// ── Ad Structures (Z31 §2) ─────────────────────────────────────────────────

export type AdStructure =
  | 'PROBLEM_SOLUTION'
  | 'STORY_CONFESSION'
  | 'BEFORE_AFTER'
  | 'AUTHORITY_EXPERT'
  | 'PRODUCT_DEMO'
  | 'SOCIAL_PROOF'
  | 'PAIN_POINT_HOOK'
  | 'LISTICLE_TIPS'

export const DEFAULT_AD_STRUCTURE: AdStructure = 'PROBLEM_SOLUTION'

// ── Ad Angles (Z31 §10) ────────────────────────────────────────────────────

export type AdAngle =
  | 'emotional'
  | 'authority'
  | 'testimonial'
  | 'problem_solution'
  | 'curiosity'
  | 'direct_response'
  | 'native_tiktok'
  | 'educational'

export const DEFAULT_AD_ANGLE: AdAngle = 'native_tiktok'

// ── Target script duration (Z31 §5) ────────────────────────────────────────

export type ScriptTargetDurationSec = 15 | 30 | 45 | 60

export const DEFAULT_SCRIPT_DURATION_SEC: ScriptTargetDurationSec = 30

// ── Voice categories (Z31 §7) ──────────────────────────────────────────────

export type VoiceCategoryId =
  | 'calm_female'
  | 'energetic_creator'
  | 'authority_male'
  | 'emotional_mom'
  | 'skincare_influencer'
  | 'gym_creator'

// ── Script blocks (Z31 §3) ─────────────────────────────────────────────────

export type ScriptBlockId =
  | 'hook'
  | 'pain'
  | 'discovery'
  | 'benefit'
  | 'cta'

export const SCRIPT_BLOCK_ORDER: ScriptBlockId[] = [
  'hook',
  'pain',
  'discovery',
  'benefit',
  'cta',
]

export const SCRIPT_BLOCK_LABEL_VI: Record<ScriptBlockId, string> = {
  hook:      'HOOK',
  pain:      'PAIN / CONTEXT',
  discovery: 'DISCOVERY',
  benefit:   'BENEFIT',
  cta:       'CTA',
}

export interface ScriptBlock {
  /** Which of the 5 ad sections this is */
  id: ScriptBlockId
  /** The actual text — Vietnamese or English, TikTok-native conversational */
  text: string
  /** Estimated read duration in seconds (from voiceTimingEstimator) */
  estDurationSec: number
}

// ── Hook variants (Z31 §11) ────────────────────────────────────────────────
// Generated alongside the main script; user picks 1 of 3.

export type HookStyle = 'emotional' | 'shock' | 'curiosity'

export const HOOK_STYLE_LABEL_VI: Record<HookStyle, string> = {
  emotional: 'Cảm xúc',
  shock:     'Sốc / Bất ngờ',
  curiosity: 'Tò mò',
}

export interface HookVariant {
  /** Tone of this hook */
  style: HookStyle
  /** The hook text — short, 1-2 lines */
  text: string
  /** Estimated read duration */
  estDurationSec: number
}

// ── Generated script ───────────────────────────────────────────────────────

export interface GeneratedScript {
  /** Which structure was used to generate this */
  structure: AdStructure
  /** Which angle was used */
  angle: AdAngle
  /** Target duration the user picked (15/30/45/60) */
  targetDurationSec: ScriptTargetDurationSec
  /** 5 script blocks in order */
  blocks: ScriptBlock[]
  /** Sum of block durations — the MASTER TIMELINE LENGTH */
  totalDurationSec: number
  /** When the script was generated (resume / cache check) */
  generatedAt: number
}

// ── Voice record ───────────────────────────────────────────────────────────
// Output of the voice generation step. Caches the TTS asset + total duration
// so all downstream rendering can sync to it.

export interface VoiceRecord {
  /** ElevenLabs voice id (or other provider id) used */
  voiceId: string
  /** Category metadata the matcher picked (for UI display) */
  category: VoiceCategoryId
  /** asset:xxx ref of the rendered MP3 in IndexedDB */
  audioRef: string
  /** Actual measured duration of the rendered audio (seconds) */
  measuredDurationSec: number
  /** When the voice was generated */
  generatedAt: number
}

// ── Script Brain section on V3PipelineState ────────────────────────────────

export interface ScriptBrain {
  /** Which ad structure the user picked */
  structure: AdStructure
  /** Which angle */
  angle: AdAngle
  /** Target duration */
  targetDurationSec: ScriptTargetDurationSec
  /** The last generated script (null until first generation) */
  script: GeneratedScript | null
  /** 3 hook variants Gemini produced */
  hookVariants: HookVariant[]
  /** Index into hookVariants[] the user picked. -1 = use script's own hook block. */
  pickedHookIdx: number
  /** Voice category matched (auto-suggested from avatar metadata, user can override) */
  voiceCategory: VoiceCategoryId | null
  /** Generated voice record (null until voice TTS runs) */
  voice: VoiceRecord | null
  /** True while Gemini script generation is in flight (Z27 transient) */
  isGeneratingScript: boolean
  /** True while ElevenLabs TTS is in flight */
  isGeneratingVoice: boolean
  /** Last error (script gen or TTS) */
  error: string | null
}

export function createEmptyScriptBrain(): ScriptBrain {
  return {
    structure: DEFAULT_AD_STRUCTURE,
    angle: DEFAULT_AD_ANGLE,
    targetDurationSec: DEFAULT_SCRIPT_DURATION_SEC,
    script: null,
    hookVariants: [],
    pickedHookIdx: -1,
    voiceCategory: null,
    voice: null,
    isGeneratingScript: false,
    isGeneratingVoice: false,
    error: null,
  }
}
