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
  | 'auto-edit'       // ffmpeg concat + transitions + subtitles + audio (clip approval gate lives here)
  | 'export'          // download MP4

export const V3_PHASE_LABEL_VI: Record<V3Phase, string> = {
  'input':          'Input + Script',
  'script-voice':   'Script + Voice',
  'creator-video':  'Video creator chính',
  'action-inserts': 'Action inserts',
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
  /** Default for the cheap 1s motion pre-flight. TEST skips it (the full
   *  render is already 480p cheap, so the preview is redundant overhead);
   *  STANDARD/FULL keep it (cheap insurance before an expensive HD render). */
  skipPreviewDefault: boolean
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
    skipPreviewDefault: true,
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
    skipPreviewDefault: false,
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
    skipPreviewDefault: false,
    tone: 'pink',
    badge: 'PREMIUM',
  },
}

// Z36 — the cost-mode picker was removed from the UI. The whole engine now
// runs ONE fixed, balanced profile: 720p / 30s / up-to-5 inserts. STANDARD is
// that profile. (TEST/FULL configs are kept so any old persisted state still
// resolves, but nothing in the UI selects them anymore.)
export const DEFAULT_COST_MODE: CostMode = 'STANDARD'

// ── Per-step credit cost estimates (Z36) ─────────────────────────────────────
// Single source of truth for the cost labels shown on every render / continue
// button — the user must see what each step burns BEFORE committing credit.
// These are ESTIMATES, anchored to the real provider prices we already know:
//   • KIE gpt-4o-image still  ≈ 6 credits   (tiktok-shop listing: 73cr ≈ $0.37)
//   • KIE Kling video 5s clip ≈ 70 credits  (v2 KLING_CREDIT_PER_CLIP)
//   • credit → USD            ≈ $0.005      (73 credits ≈ $0.37)
// Display-only: no billing or render logic reads these.
export const CREDIT_USD = 0.005

export const V3_CREDIT_COST = {
  /** ElevenLabs TTS for a ~30s script */
  tts: 5,
  /** KIE gpt-4o-image keyframe still */
  keyframe: 6,
  /** Optional 1-2s Kling motion pre-flight */
  previewMotion: 10,
  /** KIE Kling Avatar Std full talking-head lipsync */
  lipsync: 70,
  /** One action insert = 1 keyframe (6) + 1 Kling 5s clip (70) */
  insert: 76,
} as const

// Z38 — realistic KIE-credit estimate for a Kling AI-Avatar lipsync render.
// HARD-WON lesson: Kling avatar is billed roughly PER SECOND of output, NOT
// as a flat 5s clip. A real ~81s talking-head render burned ~730 KIE credits
// (≈ 9 cr/s). The old flat `lipsync: 70` understated a full-length creator
// video by ~10x — which is how a "~91 credit" button silently cost ~1.4k.
// Use THIS (not V3_CREDIT_COST.lipsync) anywhere a real talking-head render
// cost is shown to the user.
export const KIE_LIPSYNC_CREDITS_PER_SEC = 9

export function estimateLipsyncCredits(durationSec: number): number {
  const sec = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 30
  return Math.ceil(Math.max(5, sec) * KIE_LIPSYNC_CREDITS_PER_SEC)
}

// Z38 — realistic estimate for ONE action insert: a gpt-4o keyframe (~6 cr,
// stable) + a 5s Kling i2v clip. The old flat `insert: 76` bundled the same
// fictional "70-cr 5s clip" that overstated everything. A Kling video is billed
// per second of output (~9 cr/s like the avatar render ⇒ ~45 cr for 5s), so a
// single insert lands ~51 cr, not 76. STILL AN ESTIMATE — render ONE real
// insert to confirm the per-second rate for kling-3.0/video before trusting
// this for a 4-5 insert budget.
export const INSERT_CLIP_SECONDS = 5

export function estimateInsertCredits(): number {
  return V3_CREDIT_COST.keyframe + Math.ceil(INSERT_CLIP_SECONDS * KIE_LIPSYNC_CREDITS_PER_SEC)
}

/** "~N credit (~$X.XX)" — the standard cost chip on action buttons. */
export function formatCredits(credits: number): string {
  return `~${credits} credit (~$${(credits * CREDIT_USD).toFixed(2)})`
}

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
  // Z37 — script-driven scene redesign. NOT a product-interaction preset: a
  // free "concept" B-roll scene (ingredient / mechanism / lifestyle) whose
  // visual prompt is written per-scene by the AI scene director (the product
  // is NOT on screen, so there is no fidelity lock to break). Deliberately
  // excluded from ACTION_PRESET_ORDER so it never shows in the manual product
  // preset picker or the keyword suggester.
  | 'CONCEPT_SCENE'

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
//   1. TTS the locked script (ElevenLabs) → voice MP3 + measured duration
//   2. Generate keyframe still (KIE GPT-4o img-edit with avatar + setting
//      + energy prompts; preset / wardrobe / framing locked)
//   3. Lipsync video (KIE Kling Avatar Std) image + audio → talking clip
//   4. Preview-first: a 1-2s motion test BEFORE the full lipsync render
//      so the user catches identity drift early without burning 60s of
//      KIE credit.
// ─────────────────────────────────────────────────────────────────────────

// ── Creator settings — where the talking happens (Z32 §4) ─────────────────

export type CreatorSettingId =
  | 'selfie_handheld'    // phone-in-hand, casual selfie talking
  | 'desk_talking'       // sitting at desk, mid-shot
  | 'couch_talking'      // lounging on couch, casual
  | 'bathroom_mirror'    // mirror selfie / morning routine vibe
  | 'kitchen_talking'    // kitchen counter, mid-shot
  | 'gym_selfie'         // gym phone-selfie, post-workout
  | 'walking_vlog'       // walking + talking, vlogger pace
  | 'product_demo'       // sitting with product in hand, demo-mode

export const DEFAULT_CREATOR_SETTING: CreatorSettingId = 'selfie_handheld'

// ── Creator energy levels (Z32 §13) ───────────────────────────────────────

export type CreatorEnergyLevel =
  | 'calm'              // measured, soft pacing — for emotional / wellness
  | 'conversational'    // natural everyday talking — default
  | 'excited'           // upbeat, gestures, faster — for hooks
  | 'emotional'         // vulnerable, slower, micro-pauses
  | 'authority'         // confident, deliberate — expert content
  | 'aggressive_tiktok' // high-energy TikTok creator — direct response

export const DEFAULT_CREATOR_ENERGY: CreatorEnergyLevel = 'conversational'

// ── Creator presets — combinations of setting + energy + wardrobe (Z32 §9) ─

export type CreatorPresetId =
  | 'malay_mom_casual'
  | 'skincare_creator'
  | 'gym_coach'
  | 'office_woman'
  | 'tech_reviewer'
  | 'young_tiktok_girl'

// ── Render stage tracking (within the creator video render) ───────────────
// The render is multi-stage. Each stage can fail/be retried independently.

export type CreatorVideoStage =
  | 'idle'             // nothing started
  | 'tts'              // ElevenLabs running
  | 'keyframe'         // KIE GPT-4o generating the still
  | 'preview_motion'   // 1-2s preview test
  | 'lipsync_full'     // KIE Kling Avatar full talking video
  | 'completed'        // we have a full lipsync video
  | 'failed'           // last stage errored — error field has reason

export const CREATOR_VIDEO_STAGE_LABEL_VI: Record<CreatorVideoStage, string> = {
  idle:           'Chưa bắt đầu',
  tts:            'Đang tạo voice (ElevenLabs)...',
  keyframe:       'Đang tạo keyframe (GPT-4o)...',
  preview_motion: 'Đang tạo preview motion 1-2s...',
  lipsync_full:   'Đang lipsync video đầy đủ...',
  completed:      'Đã xong ✓',
  failed:         'Lỗi',
}

// ── Creator video config (the user's picks BEFORE rendering) ──────────────

export interface CreatorVideoConfig {
  /** Which setting (room/framing) to render */
  setting: CreatorSettingId
  /** Which energy level for expression + pacing */
  energy: CreatorEnergyLevel
  /** Optional preset shortcut — sets setting + energy + wardrobe in one click.
   *  null = user customised manually. */
  preset: CreatorPresetId | null
  /** Wardrobe override — free text. Empty = preset's default. */
  wardrobeNote: string
  /** Resolution to render at (controlled by costMode but user can bump). */
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

  /** Asset:xxx of the ElevenLabs TTS audio (MP3). Set after TTS stage. */
  voiceRef?: string
  /** Measured duration of the TTS audio in seconds. */
  voiceDurationSec?: number
  /** ElevenLabs voice id used. */
  voiceId?: string

  /** Asset:xxx of the still keyframe (avatar in setting + energy + wardrobe). */
  keyframeRef?: string
  /** Compiled keyframe prompt — exposed for debug. */
  keyframePromptUsed?: string

  /** Asset:xxx of the 1-2s preview-motion test (cheap). */
  previewVideoRef?: string
  /** Lipsync task id for the FULL render — used to re-poll if user refreshes. */
  fullLipsyncTaskId?: string
  /** Asset:xxx of the FINAL full lipsync video. */
  videoRef?: string

  /** Config used for this render — captured for re-render parity. */
  config: CreatorVideoConfig

  /** Total wall-clock duration of the lip-synced talking video. */
  durationSec: number
  /** Render profile used for the FINAL video. */
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
  /** Z37 — free per-scene visual prompt for CONCEPT_SCENE inserts (written by
   *  the AI scene director, matched to the dialogue span). Ignored for the 12
   *  product presets (they build their prompt from the catalogue). Only read
   *  when presetId === 'CONCEPT_SCENE'. */
  conceptPrompt?: string
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
  /** Manual override for the 1s motion pre-flight. null = follow the cost
   *  mode's skipPreviewDefault; true/false = explicit user choice. */
  skipPreviewOverride: boolean | null

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

  /** Z34 — auto-edit plan state (style picks + last generated plan) */
  autoEdit: AutoEditState

  /** Z35 — export + variation state (format/quality + CTA variations
   *  + last built export package) */
  exportVariation: ExportVariationState

  /** Timestamp this state was last saved (informational) */
  updatedAt: number
}

export function createEmptyV3State(): V3PipelineState {
  return {
    schemaVersion: 1,
    phase: 'input',
    mode: DEFAULT_WORKFLOW_MODE,
    costMode: DEFAULT_COST_MODE,
    skipPreviewOverride: null,
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
    autoEdit: createEmptyAutoEditState(),
    exportVariation: createEmptyExportVariationState(),
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

// ── Output language (single language per generate) ─────────────────────────
// The script + voice + insert keywords all lock to ONE language per
// generation. Default = Bahasa Malaysia (primary market). Never let the
// generator mix languages in a single output.

export type ScriptLang = 'ms' | 'vi' | 'en'

export const DEFAULT_SCRIPT_LANG: ScriptLang = 'ms'

/** Full language name fed to Gemini ("write in ___"). */
export const SCRIPT_LANG_GEMINI_NAME: Record<ScriptLang, string> = {
  ms: 'Bahasa Malaysia',
  vi: 'Vietnamese',
  en: 'English',
}

/** Human label shown in the UI picker. */
export const SCRIPT_LANG_LABEL_VI: Record<ScriptLang, string> = {
  ms: 'Bahasa Malaysia',
  vi: 'Tiếng Việt',
  en: 'English',
}

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
  /** Output language — locks script + voice + insert keywords to ONE language. */
  outputLang: ScriptLang
  /** TRUE = use the user's own script verbatim (Gemini only segments it into
   *  the 5 roles, never rewrites). FALSE = Gemini writes from scratch.
   *  The script TEXT itself is the SINGLE source of truth in state.inputs.script
   *  (picked or typed at Bước 1) — there is no separate copy here. */
  useOwnScript: boolean
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
    outputLang: DEFAULT_SCRIPT_LANG,
    useOwnScript: false,
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

// ═════════════════════════════════════════════════════════════════════════
// Z34 — Auto Edit Engine (Phase 5)
// ═════════════════════════════════════════════════════════════════════════
// The "conversion layer" of v3. Takes Phase 3 creator video + Phase 4
// inserts + Phase 2 script timeline and produces an EDIT PLAN that the
// preview player + final exporter consume.
//
// The plan is a DETERMINISTIC data structure — no AI calls during
// editing. All decisions (where to cut, what to caption, when to zoom)
// come from rule-based heuristics applied to the script's timing.
//
// This is the layer that "cheats perception" — fast cuts + captions +
// zooms hide AI imperfections that would otherwise feel uncanny.
// ─────────────────────────────────────────────────────────────────────────

// ── Editing styles (Z34 §10) ──────────────────────────────────────────────

export type EditingStyleId =
  | 'native_tiktok'      // default — natural creator pacing
  | 'fast_ugc'           // tight cuts, heavy captions, punchy
  | 'emotional_story'    // slower pacing, breathing moments, soft captions
  | 'authority_review'   // measured pacing, clean captions, sparse SFX
  | 'soft_lifestyle'     // gentle pacing, minimal captions, ambient BGM
  | 'aggressive_sales'   // cuts every 1-2s, all-caps captions, hard SFX
  | 'clean_minimal'      // no SFX, sparse captions, no zooms

export const DEFAULT_EDITING_STYLE: EditingStyleId = 'native_tiktok'

// ── Subtitle styles (Z34 §5) ──────────────────────────────────────────────

export type SubtitleStyleId =
  | 'bold_creator'       // bold white text + black drop-shadow
  | 'minimal'            // small clean white text bottom-third
  | 'aggressive_tiktok'  // ALL CAPS yellow with hard shadow + emoji
  | 'clean_ugc'          // medium weight, sentence-case, off-white
  | 'none'               // captions off

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyleId = 'bold_creator'

// ── BGM styles (Z34 §7) ───────────────────────────────────────────────────

export type BgmStyleId =
  | 'none'
  | 'tiktok_upbeat'
  | 'emotional_soft'
  | 'authority_clean'
  | 'energetic_creator'
  | 'ambient_lifestyle'

export const DEFAULT_BGM_STYLE: BgmStyleId = 'tiktok_upbeat'

// ── SFX library (Z34 §6) ──────────────────────────────────────────────────

export type SfxId =
  | 'whoosh'        // transition between clips
  | 'pop'           // word emphasis / hook
  | 'click'         // subtle accent
  | 'swipe'         // insert transition
  | 'impact'        // CTA / shock moment
  | 'notification' // phone scroll insert

// ── Punch zoom cues (Z34 §4) ──────────────────────────────────────────────

export interface PunchZoomCue {
  /** When the zoom starts (seconds from edit timeline 0) */
  startSec: number
  /** Duration of the zoom effect (seconds) */
  durationSec: number
  /** Zoom-in target scale (1.0 = no zoom, 1.15 = subtle, 1.30 = strong) */
  targetScale: number
  /** Easing curve */
  easing: 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear'
  /** Why this zoom was added — for debug */
  reason: 'hook' | 'cta' | 'emphasis_keyword' | 'product_mention' | 'emotional_beat'
}

// ── Edit segments (Z34 §3) ────────────────────────────────────────────────
// The plan's main backbone — a list of clip segments in playback order.
// Each segment specifies WHICH source video to play + a time window.

export type EditSegmentSource =
  | { kind: 'creator_video'; videoRef: string }
  | { kind: 'action_insert'; insertId: number; videoRef: string }

export interface EditSegment {
  /** Sequential id from 0 */
  segmentId: number
  /** Position in the edit timeline (cumulative) */
  startSec: number
  /** Duration of this segment (seconds shown to viewer) */
  durationSec: number
  /** Source video reference */
  source: EditSegmentSource
  /** Time offset INSIDE the source video to start from (for sub-clipping) */
  sourceInSec: number
  /** Why this segment exists — debug */
  reason: 'narration_block' | 'insert_overlay' | 'transition_hide'
  /** Optional transition INTO this segment */
  transitionIn?: 'cut' | 'whoosh' | 'swipe' | 'crossfade'
}

// ── Caption segments (Z34 §5) ────────────────────────────────────────────
// Word-level groups so captions can be highlighted as voice progresses.

export interface CaptionSegment {
  /** Position on the edit timeline */
  startSec: number
  endSec: number
  /** Text shown */
  text: string
  /** Whether this caption should be EMPHASISED (larger / colored) */
  emphasised: boolean
  /** Why emphasised — debug */
  emphasisReason?: 'hook' | 'cta' | 'keyword' | null
}

// ── SFX cues (Z34 §6) ─────────────────────────────────────────────────────

export interface SfxCue {
  /** When to fire (seconds on edit timeline) */
  startSec: number
  /** Which SFX */
  sfxId: SfxId
  /** Volume 0-1 (most should be 0.3-0.5 — voice priority) */
  volume: number
  /** Why fired — debug */
  reason: 'transition' | 'hook_emphasis' | 'cta_emphasis' | 'punch_zoom'
}

// ── CTA overlay (Z34 §9) ──────────────────────────────────────────────────

export interface CtaOverlay {
  /** When to show */
  startSec: number
  /** How long visible */
  durationSec: number
  /** CTA text */
  text: string
  /** Animation entrance */
  animation: 'fade_in' | 'slide_up' | 'pop_in' | 'shake'
  /** Visual style */
  style: 'sticker_bottom' | 'fullscreen_centered' | 'side_chip'
}

// ── Auto Edit Plan (the master output of Phase 5 planner) ─────────────────

export interface AutoEditPlan {
  /** Total wall-clock duration of the edited video */
  totalDurationSec: number
  /** Edit segments in playback order — backbone of the timeline */
  segments: EditSegment[]
  /** Caption segments in time order — separate from segments because
   *  captions span across segment boundaries */
  captions: CaptionSegment[]
  /** Punch zoom cues — fired on top of segments */
  punchZooms: PunchZoomCue[]
  /** SFX cues — fired alongside segments */
  sfxCues: SfxCue[]
  /** Background music spec (or null for no BGM) */
  bgm: { styleId: BgmStyleId; volume: number; fadeInSec: number; fadeOutSec: number } | null
  /** CTA overlay shown at end of video */
  cta: CtaOverlay | null
  /** Style used to generate this plan */
  styleId: EditingStyleId
  /** Subtitle style chosen */
  subtitleStyleId: SubtitleStyleId
  /** Generation timestamp */
  generatedAt: number
}

// ── Auto Edit state on V3PipelineState ────────────────────────────────────

export interface AutoEditState {
  /** Which style the user picked */
  styleId: EditingStyleId
  /** Which subtitle style */
  subtitleStyleId: SubtitleStyleId
  /** Which BGM style — overrides the style preset's default if set */
  bgmStyleId: BgmStyleId | null
  /** Last generated plan (null until user clicks Generate) */
  plan: AutoEditPlan | null
  /** Asset:xxx of the final exported MP4 (null until Phase 6 export runs) */
  exportedVideoRef: string | null
  /** True while planner is computing */
  isGenerating: boolean
  /** True while final export is running (Phase 6 wiring) */
  isExporting: boolean
  error: string | null
}

export function createEmptyAutoEditState(): AutoEditState {
  return {
    styleId: DEFAULT_EDITING_STYLE,
    subtitleStyleId: DEFAULT_SUBTITLE_STYLE,
    bgmStyleId: null,
    plan: null,
    exportedVideoRef: null,
    isGenerating: false,
    isExporting: false,
    error: null,
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Z35 — Export + Variation Engine (Phase 6)
// ═════════════════════════════════════════════════════════════════════════
// Turns Ads Video into an "AI performance ad factory" — fast variation
// testing, project library, multi-format export. NOT a movie pipeline.
// Z35 §14: optimised for iteration speed + low cost + creative reuse.

export type ExportFormatId =
  | 'tiktok_9x16'
  | 'reels_9x16'
  | 'shorts_9x16'
  | 'square_1x1'
  | 'story_9x16'
  | 'feed_4x5'

export const DEFAULT_EXPORT_FORMAT: ExportFormatId = 'tiktok_9x16'

export type ExportQualityId =
  | 'test_480'
  | 'standard_720'
  | 'final_1080'

export const DEFAULT_EXPORT_QUALITY: ExportQualityId = 'test_480'

export type HookVariantStyle = 'curiosity' | 'emotional' | 'shocking' | 'confession' | 'authority'

export interface HookVariation {
  style: HookVariantStyle
  text: string
  estDurationSec: number
  generatedAt: number
}

export type CtaVariantStyle = 'soft' | 'urgency' | 'promo' | 'emotional' | 'testimonial'

export interface CtaVariation {
  style: CtaVariantStyle
  text: string
  estDurationSec: number
  generatedAt: number
}

export type ThumbnailStyleId =
  | 'tiktok_native'
  | 'bold_text'
  | 'clean_ugc'

export interface ThumbnailPlan {
  styleId: ThumbnailStyleId
  sourceRef: string
  headlineText: string
  imageRef: string | null
  generatedAt: number
}

export interface ExportPackage {
  formatId: ExportFormatId
  qualityId: ExportQualityId
  /** asset:xxx of the final encoded MP4 (null until Phase 7 ffmpeg.wasm runs) */
  videoRef: string | null
  /** SRT subtitle file content */
  srtContent: string
  /** Plain-text script for ads ops + transcript */
  plainTextScript: string
  hookText: string
  ctaText: string
  thumbnail: ThumbnailPlan | null
  durationSec: number
  createdAt: number
}

export interface SavedProject {
  id: string
  name: string
  productName: string
  avatarName: string
  snapshot: {
    inputs: V3PipelineState['inputs']
    scriptBrain: ScriptBrain
    creatorVideoConfig: CreatorVideoConfig
    creatorVideo: CreatorVideoClip | null
    inserts: ActionInsertClip[]
    autoEdit: AutoEditState
  }
  thumbRef?: string
  tags: string[]
  /** Z35 §7 — winning combo flag — bumps to top of library */
  isWinner: boolean
  createdAt: number
  lastEditedAt: number
}

// ── Z36 — Export Render Stages (Phase 7) ──────────────────────────────────
// Multi-stage state machine for the ffmpeg.wasm-driven final MP4 assembly.
// Each stage can fail independently — failed-clip-skip preserves the rest
// of the project.

export type ExportRenderStage =
  | 'idle'           // nothing in flight
  | 'loading_ffmpeg' // first-time ~30MB wasm fetch
  | 'preparing'      // resolving asset refs to blobs, writing to ffmpeg FS
  | 'encoding'       // running the filter graph
  | 'muxing'         // burning subtitles + mixing audio + final mp4 mux
  | 'done'           // success — videoRef on package
  | 'failed'         // last stage errored — error has details

export const EXPORT_RENDER_STAGE_LABEL_VI: Record<ExportRenderStage, string> = {
  idle:            'Chưa export',
  loading_ffmpeg:  'Đang tải ffmpeg.wasm (~30MB, lần đầu)...',
  preparing:       'Đang chuẩn bị assets...',
  encoding:        'Đang encode video...',
  muxing:          'Đang burn subtitles + mix audio...',
  done:            'Hoàn tất ✓',
  failed:          'Lỗi',
}

export interface ExportVariationState {
  formatId: ExportFormatId
  qualityId: ExportQualityId
  /** Phase-6 CTA alternates (separate from scriptBrain.hookVariants which
   *  is Phase-2 hooks). */
  ctaVariations: CtaVariation[]
  /** Index into ctaVariations[] (or -1 = use script's own CTA). */
  pickedCtaIdx: number
  /** Index into scriptBrain.hookVariants[] (or -1 = use script's own hook). */
  pickedHookIdxForExport: number
  /** Last built export package (null until user clicks Build) */
  lastPackage: ExportPackage | null
  thumbnailStyleId: ThumbnailStyleId
  isGeneratingCtaVariations: boolean
  isBuildingPackage: boolean
  error: string | null

  // ── Z36 — Final MP4 assembly state (Phase 7) ─────────────────────────
  /** Current ffmpeg pipeline stage */
  exportStage: ExportRenderStage
  /** Progress 0-1 (rough — ffmpeg.wasm progress is approximate) */
  exportProgress: number
  /** Which preset: 'preview' = fast 480p draft / 'final' = full quality */
  exportPreset: 'preview' | 'final'
  /** asset:xxx of the LAST real assembled MP4 (preview or final) */
  assembledVideoRef: string | null
  /** Last failed clip ids (Z36 §18 — for skip-failed UX) */
  failedClipIds: number[]
}

export function createEmptyExportVariationState(): ExportVariationState {
  return {
    formatId: DEFAULT_EXPORT_FORMAT,
    qualityId: DEFAULT_EXPORT_QUALITY,
    ctaVariations: [],
    pickedCtaIdx: -1,
    pickedHookIdxForExport: -1,
    lastPackage: null,
    thumbnailStyleId: 'tiktok_native',
    isGeneratingCtaVariations: false,
    isBuildingPackage: false,
    error: null,
    // Z36 Phase 7
    exportStage: 'idle',
    exportProgress: 0,
    exportPreset: 'preview',
    assembledVideoRef: null,
    failedClipIds: [],
  }
}
