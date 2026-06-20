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
import type { StickerStyle } from './services/stickerRenderer'
// type-only (erased at runtime → no circular dependency) — the hybrid plan shapes
// live in brollDirector; the store persists them as the `hybrid` slice.
import type { BrollScene, TimedBrollScene } from './services/brollDirector'

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
  'action-inserts': 'Tạo Video',
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
    // Z98 — TEST mode is now the engine's default. The old TEST (a 15-20s
    // thumbnail-test with a 3-scene cap) was wrong for the default — a 60s
    // script flowing through it got its director output sliced to 3 cuts
    // covering 12s, leaving 48s of pure talking-head. TEST now keeps its
    // CHEAP 480p render path (the reason it was promoted to default) but
    // accepts the same 3-16 director scenes as STANDARD/FULL, so script
    // length — not mode — drives how dense the ad is.
    labelVi: 'TEST',
    descriptionVi: 'Mọi độ dài · 480p · 3-16 inserts (đạo diễn tự quyết theo độ dài) · CHEAP · ~$1-5',
    targetDurationSec: 30,
    insertCount: { min: 3, max: 16 },
    resolution: '480p',
    estimatedUsd: { min: 1, max: 5 },
    skipPreviewDefault: true,
    tone: 'amber',
    badge: '⚡ CHEAP · MẶC ĐỊNH',
  },
  STANDARD: {
    id: 'STANDARD',
    labelVi: 'STANDARD',
    descriptionVi: '30s · 720p · 3-16 inserts (đạo diễn tự quyết theo độ dài) · chất lượng cân bằng · ~$3-8',
    targetDurationSec: 30,
    insertCount: { min: 3, max: 16 },
    resolution: '720p',
    estimatedUsd: { min: 3, max: 5 },
    skipPreviewDefault: false,
    tone: 'violet',
    badge: 'STANDARD',
  },
  FULL: {
    id: 'FULL',
    labelVi: 'FULL',
    descriptionVi: '45-60s · 1080p · tới 16 inserts · HD export · ~$6-10',
    targetDurationSec: 50,
    insertCount: { min: 6, max: 16 },
    resolution: '1080p',
    estimatedUsd: { min: 6, max: 10 },
    skipPreviewDefault: false,
    tone: 'pink',
    badge: 'PREMIUM',
  },
}

// Z36 — the cost-mode picker was removed from the UI. The whole engine now
// runs ONE fixed, balanced profile: 720p / 30s / 3-8 inserts (the Scene
// Director decides how many within that range). STANDARD is that profile.
// (TEST/FULL configs are kept so any old persisted state still resolves, but
// nothing in the UI selects them anymore.)
// Z98 — default flipped STANDARD → TEST. User pivots on cost — 480p × 6s
// (~16cr per insert) is the right starting point. STANDARD (720p × 8s, ~36cr)
// was triple the cost without user opting in, and the UI cost chip was hard-
// coded to the 480p estimate so the difference wasn't visible until the bill
// arrived. STANDARD/FULL stay available as opt-ins via the cost-mode picker.
export const DEFAULT_COST_MODE: CostMode = 'TEST'

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

// Z38/Z72 — KIE-credit estimate for the creator-video lipsync, billed PER
// SECOND of output. Model history:
//   Standard (~10 cr/s) → InfiniteTalk 480p (~3 cr/s, BUT 15-sec audio cap →
//   fails real UGC scripts) → Pro (~21 cr/s, 1080p, but ~$4/40s too pricey)
//   → BACK to Standard (~10 cr/s, 720p, 5-min audio).
// Standard handles the 30-60s+ audio a real UGC ad needs at ~half the Pro
// cost. ESTIMATE — verify against the real KIE deduction on the first render.
export const KIE_LIPSYNC_CREDITS_PER_SEC = 10

export function estimateLipsyncCredits(durationSec: number): number {
  const sec = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 30
  return Math.ceil(Math.max(5, sec) * KIE_LIPSYNC_CREDITS_PER_SEC)
}

// Z76 — estimate for ONE action insert: a gpt-4o keyframe (~6 cr) + a video clip.
// CREDIT-BURN FIX: Z68 used `grok-imagine-video-1-5-preview` — which on KIE is
// the PREMIUM Grok tier at 14.5 cr/s @480p (25 cr/s @720p). A 6s clip = ~87 cr,
// and a single 7-insert render burned ~500 cr. Z76 swaps to the SEPARATE cheap
// model `grok-imagine/image-to-video` = 1.6 cr/s @480p (3 cr/s @720p). The model
// floor is 6s, so 6 × 1.6 ≈ 10 cr per video insert at 480p — ~9× cheaper.
// VERIFIED against the kie.ai Pricing page (2026-06-09 screenshots).
export const INSERT_CLIP_SECONDS = 6
export const INSERT_VIDEO_CREDITS = 10

// Z39/Z76 — two ways to realise an insert:
//   'video'     → grok-imagine/image-to-video clip (keyframe ~6cr + ~10cr i2v
//                 ≈ ~16cr). For scenes with REAL motion/people (drink, hold,
//                 react, before/after). Video-only (no audio-gen failures).
//   'ken_burns' → keyframe still ONLY (~6cr). NOTE: the literal is kept for
//                 backwards-compat with saved drafts, but as of Z76 it no
//                 longer zooms — it renders a STATIC image clip (full content
//                 fit inside the frame, never cropped) because the Ken Burns
//                 zoom kept cutting off infographic text labels. Used for
//                 concept / ingredient / mechanism scenes.
// Z98 #5 — 'sticker' = a local canvas-drawn transparent PNG overlay (TikTok-style
// keyword pop). Rendered in the browser (0 credit), composited in the corner over
// the talking-head. See services/stickerRenderer.ts for the 9 styles.
export type InsertRenderMode = 'video' | 'ken_burns' | 'sticker'

// Z69 — how the insert sits in the timeline against the creator video:
//   'cut'            → replaces the creator video for the insert's window
//                      (full-screen). Use for high-impact reveal / CTA / demo /
//                      visible-result beats where focus belongs on the insert.
//   'overlay_corner' → insert sits as a corner PIP (~30% of the frame) while
//                      the creator KEEPS talking full-screen behind it. Use
//                      for teaching beats (ingredients, mechanism, "5x" claim)
//                      so the viewer never loses the creator's face.
export type InsertLayout = 'cut' | 'overlay_corner'

// i2v actual cost per second by resolution. Model swapped Grok → Seedance 1.5 Pro
// (bytedance/seedance-1.5-pro): 480p 1.75 cr/s, 720p 3.5 cr/s (real KIE pricing).
// ~same as Grok at 480p, stronger prompt-adherence. (1080p isn't a Seedance tier;
// mode-1 renders 480p — kept only so the type stays exhaustive.)
const I2V_CR_PER_SEC: Record<'480p' | '720p' | '1080p', number> = {
  '480p': 1.75,
  '720p': 3.5,
  '1080p': 7,
}

/** Seedance 1.5 Pro renders ONLY 4 / 8 / 12s. Pick the SMALLEST that gives the assembler
 *  enough source to fill the director's slot: inserts are sped up by ~INSERT_SPEED (1.5×)
 *  after a ~0.35s lead-in skip, so a slot of S seconds needs ≈ S×1.5 + 0.85s of footage.
 *  The renderer AND the credit estimate both call this, so the shown cost always matches the
 *  rendered length (short cuts get the cheap 4s).
 *  ⚠️ Keep the 1.5 in sync with INSERT_SPEED in hybridAssembler.
 *  CAP at 8s (drop the 12s tier): hybridAssembler's INSERT_SOURCE_BUDGET_SEC hard-caps source
 *  consumption at 8.0s (lead-in 0.35 + trimDur ≤ 7.65), so a 12s clip's last ~4s was ALWAYS
 *  discarded — pure credit waste (~7cr/cut) with zero visual difference. An 8s clip supplies
 *  exactly what the assembler uses. If INSERT_SOURCE_BUDGET_SEC is ever raised above 8, lift
 *  this cap in sync so long slots can again pull 12s of source. */
export function pickSeedanceDuration(slotDurSec: number): 4 | 8 | 12 {
  const needed = Math.min(8, Math.max(1, slotDurSec) * 1.5 + 0.85)
  return needed <= 4 ? 4 : 8
}

export function estimateInsertCredits(
  mode: InsertRenderMode = 'video',
  resolution: '480p' | '720p' | '1080p' = '480p',
  durationSec: number = 6,
): number {
  if (mode === 'sticker') return 0           // Z98 #5 — local canvas PNG, no AI call
  if (mode === 'ken_burns') return V3_CREDIT_COST.keyframe
  // Bill EXACTLY the Seedance length the renderer will use (4/8/12s), so the cost chip
  // matches reality — no more under-reporting from a 6-8 clamp.
  const billedSec = pickSeedanceDuration(durationSec)
  const videoCr = Math.round(I2V_CR_PER_SEC[resolution] * billedSec)
  return V3_CREDIT_COST.keyframe + videoCr
}

// Concept scenes default to Ken Burns (they're abstract/static — the exact
// case where Kling i2v morphs and overcharges). Everything else defaults to a
// real Kling video; the user can flip any insert per-card.
export function defaultInsertRenderMode(presetId: ActionPresetId): InsertRenderMode {
  return presetId === 'CONCEPT_SCENE' ? 'ken_burns' : 'video'
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
  // Z42 — niche-agnostic "product in real action" scene. The product IS on
  // screen (fidelity-locked to the reference) but the ACTION is free-written
  // per-scene by the AI scene director via conceptPrompt — e.g. durability
  // test, outdoor use, machine running, real-world demo. Covers any niche
  // (home appliance / tool / gadget / cosmetics) that the 12 fixed product
  // presets can't describe. Like CONCEPT_SCENE it carries a director-written
  // prompt; UNLIKE it, the product reference is kept and locked. Excluded from
  // ACTION_PRESET_ORDER (never in the manual picker or keyword suggester).
  | 'PRODUCT_IN_ACTION'

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
  | 'keyframe_ready'   // Z95 — keyframe done, AWAITING user approval before lipsync
  | 'preview_motion'   // 1-2s preview test
  | 'lipsync_full'     // KIE Kling Avatar full talking video
  | 'completed'        // we have a full lipsync video
  | 'failed'           // last stage errored — error field has reason

export const CREATOR_VIDEO_STAGE_LABEL_VI: Record<CreatorVideoStage, string> = {
  idle:           'Chưa bắt đầu',
  tts:            'Đang tạo voice (ElevenLabs)...',
  keyframe:       'Đang tạo keyframe (GPT-4o)...',
  keyframe_ready: 'Ảnh sẵn sàng — duyệt trước khi dựng video',
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

// ── Z98 (#6) — REAL voice timing from ElevenLabs /with-timestamps ───────────
// The per-character spoken time of the TTS audio, already mapped onto the FINAL
// (atempo-stretched) audio the user hears — i.e. raw ElevenLabs times divided by
// EXPRESSIVE_TTS.speed. `text` is the exact transcript the timings index into
// (alignment.characters joined). charStartSecs[i] = second char text[i] is
// spoken. Used by the planner to land each cut/insert on the EXACT second its
// quoted line is read, instead of the WPM estimate. Absent on old projects or
// when the timestamped TTS call failed (→ planner falls back to the estimate).
export interface VoiceAlignment {
  /** The spoken transcript the timings index into (alignment.characters joined). */
  text: string
  /** Final-audio start second of each character in `text` (post-atempo). */
  charStartSecs: number[]
  /** Which ElevenLabs model produced these timings (eleven_v3 / multilingual_v2). */
  model?: string
}

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
  /** Z98 (#6) — real per-character voice timing (when the timestamped TTS path
   *  succeeded). Lets the planner anchor cuts/inserts to the exact spoken second. */
  voiceAlignment?: VoiceAlignment

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

// Director upgrade — how a scene is FRAMED with respect to the creator's face.
//   'creator'      → the creator is on screen, face visible (holding / using /
//                    reacting) — the current default, identity-locked to the avatar.
//   'hands_noface' → no face: only hands + the product, in its real-world use
//                    context (sprinkling salt over a pan, pumping a tyre roadside,
//                    applying serum). The renderer drops the avatar reference for
//                    these so the shot is a genuine product-in-use B-roll.
// Universal: the director infers WHICH framing fits each scene from the product's
// usageGuide + the spoken line — never hardcoded per niche.
export type CameraFraming = 'creator' | 'hands_noface'

export interface ActionInsertClip {
  /** Unique id within the project */
  insertId: number
  /** Which preset this clip realises */
  presetId: ActionPresetId
  /** Index in the planned timeline (after main creator video) */
  order: number

  /** Z33 — render pipeline stage (orthogonal to verdict status) */
  stage: InsertRenderStage

  /** Z39 — how this insert is realised: a Kling video clip ('video') or a
   *  Ken Burns still ('ken_burns', keyframe-only + local ffmpeg zoom). When
   *  ken_burns, the renderer skips Kling entirely and produces an mp4 LOCALLY
   *  from the keyframe, so `videoRef` is still set and the planner/assembler
   *  treat it identically. Defaults to 'video' when absent (back-compat). */
  renderMode?: InsertRenderMode

  /** Z69 — how the insert is composited against the creator video.
   *  Defaults to 'cut' when absent (back-compat). The Director chooses this
   *  per scene based on intent (teaching → overlay; reveal/demo → cut). */
  layout?: InsertLayout

  /** Director upgrade — face-vs-no-face framing (see CameraFraming). Defaults to
   *  'creator' when absent (back-compat). Only acted on by the renderer for
   *  free action scenes; CTA / before-after / emotion always stay 'creator'. */
  cameraFraming?: CameraFraming

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
  /** Z98 (#6) — the VERBATIM spoken line this scene illustrates (from the Scene
   *  Director). Persisted so the planner can re-anchor the insert against the
   *  REAL voice alignment (computeQuoteTimestampFromAlignment) instead of the
   *  WPM estimate. Empty for manually-added inserts. */
  quote?: string
  /** Z98 #5 — sticker scenes only (renderMode 'sticker'). The visual style
   *  (number / countdown / pill / flag / badge / warning / price / highlight /
   *  arrow) the local canvas renderer draws. */
  stickerStyle?: StickerStyle
  /** Z98 #5 — the sticker's display text (e.g. "3 giây", "Nano", "RM59"). */
  stickerText?: string
  /** Z98 #5.3 — the exact keyword inside `quote` the sticker should pop ON
   *  (word-level anchor). When set, the timing engine seeks the second that
   *  word is spoken; when absent it falls back to the quote's start second. */
  stickerWordAnchor?: string

  /** Verdict status (Z26-style approve / reject / lock) */
  status: V3ClipStatus
  error?: string
  startedAt?: number
  finishedAt?: number
  hero?: boolean
}

// ── Z98 B2 — voice-first slot ───────────────────────────────────────────────
// The REAL voice is synthesized BEFORE the director (Step 2) so scene count +
// placement use the actual measured duration, not a 215-wpm estimate that can be
// ~40% off. The same voice is then REUSED at Step 3 for lipsync (no second TTS
// charge). `scriptSig` = a cheap hash of (full script text + voiceId); when the
// current sig no longer matches, this voice is stale (script/voice changed) and
// must be regenerated.
export interface VoiceFirstSlot {
  voiceRef: string
  voiceDurationSec: number
  voiceId: string
  voiceAlignment?: VoiceAlignment
  scriptSig: string
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

  /** Z98 B2 — pre-generated REAL voice (synthesized at Step 2 before the
   *  director, reused at Step 3). null until synthesized. See VoiceFirstSlot. */
  voiceFirst: VoiceFirstSlot | null

  /** Action inserts — 3-8 short product moments */
  inserts: ActionInsertClip[]

  /** Z34 — auto-edit plan state (style picks + last generated plan) */
  autoEdit: AutoEditState

  /** Z35 — export + variation state (format/quality + CTA variations
   *  + last built export package) */
  exportVariation: ExportVariationState

  /** P3e — HYBRID 1-luồng state (director plan + per-scene clips + creator
   *  assets + final MP4). Persisted so F5 / step-nav never loses rendered work. */
  hybrid: HybridState

  /** P6au — id of the SavedProject this active state is currently editing (set when the
   *  user opens a project from the library, or after the first "Lưu project"). Lets a
   *  re-save / auto-save UPDATE the same library slot instead of creating duplicates.
   *  undefined = an unsaved scratch project. */
  activeProjectId?: string

  /** Timestamp this state was last saved (informational) */
  updatedAt: number
}

/** P3e — the hybrid pipeline's persisted state. */
export interface HybridState {
  /** Raw director scenes (un-timed) — kept so the plan can be RE-TIMED to the real
   *  voice once the creator assets exist, without re-calling the director. */
  rawScenes: BrollScene[]
  /** Director plan (timed scenes) — null until "Đạo diễn" runs. */
  scenes: TimedBrollScene[] | null
  /** Rendered clip asset ref per scene INDEX (so a re-render replaces just one). */
  clips: Record<number, string>
  /** One creator keyframe + voice for the whole video (needed for lips + master TTS). */
  keyframeRef?: string
  voiceRef?: string
  voiceDurationSec?: number
  voiceAlignment?: VoiceAlignment
  /** P4m — the user's voice PICK this cached voice was generated with ('' = the
   *  category default). Lets Bước 2 detect a voice change (inputs.voiceId differs)
   *  and regenerate instead of serving a stale voice. */
  voiceId?: string
  /** The final assembled MP4 (shown on the Export step). */
  finalVideoRef?: string
  /** P3x — epoch ms when "Tạo giọng + mặt" started. Persisted so that if the
   *  user navigates away mid-generation and comes back, the UI still shows
   *  "đang tạo" and keeps the button locked (preventing a double-charge of the
   *  ElevenLabs TTS + GPT-4o keyframe). Cleared (undefined) when the generation
   *  finishes or fails. A >4-minute-old value is treated as stale (the tab was
   *  closed mid-gen) so the UI never gets permanently stuck. */
  assetsGenStartedAt?: number
  /** P3z — per-scene render tracking, persisted so a mid-render navigation (to
   *  Bước 1 and back) or an F5 doesn't lose the "đang render" state. Keyed by
   *  scene INDEX. `startedAt` drives the visual + a staleness guard; `taskId` is
   *  the Grok i2v job id (set once the job is submitted) so an F5 can RE-POLL the
   *  already-paid job via resumeInsertVideo (no new charge) instead of losing it.
   *  Cleared per index when that scene's clip saves or its render fails. */
  renderingScenes?: Record<number, { startedAt: number; taskId?: string }>
  /** P4p — bulk-render queue (scene indices waiting for a free slot). Persisted so
   *  "Tạo tất cả" survives a tab switch instead of the queued cảnh vanishing. */
  queuedScenes?: number[]
  /** P5k — burned-caption settings (applied at assemble, 0 credit). Absent = ON +
   *  default preset, so existing projects get captions automatically. */
  captionsOn?: boolean
  captionPreset?: import('./services/captionPresets').CaptionPresetId
  /** P6b — karaoke captions: highlight each word (accent background box) as the voice
   *  reaches it, using the per-word timing from the voice alignment. Absent = OFF
   *  (existing projects keep the static phrase caption). */
  captionKaraoke?: boolean
  /** P5x — top hook banner (a short slogan from the script's anchor, applied at
   *  assemble, 0 credit). Absent = ON + default preset. Skipped on social-proof cards. */
  bannerOn?: boolean
  bannerPreset?: import('./services/bannerPresets').BannerPresetId
  /** P5z2 — user-edited banner text (overrides the AI hook). Persisted per project so
   *  F5 / re-assemble keeps it. Empty = fall back to the AI hook. */
  bannerText?: string
  /** P5s — in-flight ASSEMBLE progress, kept in the store (not component state) so a
   *  tab switch mid-ghép doesn't lose it: navigating away unmounts HybridExportPhase, but
   *  the assemble promise keeps writing here → on return the bar reconnects. Reset to
   *  false on hydrate (an F5 kills the promise, so a persisted `true` would stick). */
  assembling?: boolean
  assembleRatio?: number
  assembleStage?: string
}

export function createEmptyHybridState(): HybridState {
  return { rawScenes: [], scenes: null, clips: {} }
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
    voiceFirst: null,
    inserts: [],
    autoEdit: createEmptyAutoEditState(),
    exportVariation: createEmptyExportVariationState(),
    hybrid: createEmptyHybridState(),
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

// P3j — collapsed from 8 sub-frameworks → 2 GROUPS. The 6 hookShape templates
// that the 8 frameworks each carried were over-rigid: a hook from POV_FOR_YOU
// could only end with "...là dành cho bạn", a body picked under RAPID_REASONS
// was forced into a 3-bullet shape even when the natural tone was a confession.
// Hook tone is now decided by mix-matching 3 POOLs in `hookViralPatterns.ts`;
// the 2 groups below only carry what's structural:
//   INSTANT — product in the hook (~0-2s). Strongest cold-reach scroll-stop.
//   LEAD    — product revealed mid-script (~30-40%). Best when emotion / story
//             / authority needs to be built before the product lands.
export type AdStructure = 'INSTANT' | 'LEAD'

export const DEFAULT_AD_STRUCTURE: AdStructure = 'INSTANT'

// ── Script Shape (P3q) ─────────────────────────────────────────────────────
// Layered ORTHOGONALLY on top of AdStructure. AdStructure decides WHEN the
// product is revealed (instant vs lead); AdShape decides the BODY shape — how
// the 4 non-hook blocks are repurposed. The 5-block schema stays for back-compat
// (director + storage + validator); only the SEMANTIC of pain/discovery/benefit
// shifts per shape so output stops feeling like Problem-Solution every time.
export type ScriptShape =
  | 'narrative'   // (default) hook → pain → discovery → benefit → cta — current behaviour
  | 'listicle'   // hook (N reasons) → reason 1 → reasons 2..N → summary → cta
  | 'comparison' // hook (A vs B) → setup → A test + B test → winner reveal → cta
  | 'journey'    // hook (multi-day test) → day 1 → mid days → final result → cta

export const DEFAULT_SCRIPT_SHAPE: ScriptShape = 'narrative'

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

export type ScriptTargetDurationSec = 40 | 50 | 60 | 70 | 80

export const DEFAULT_SCRIPT_DURATION_SEC: ScriptTargetDurationSec = 50

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

// ── Hook archetypes (#6 quick-gen) ─────────────────────────────────────────
// The hook is the single biggest lever on whether an ad survives the scroll,
// so the quick-gen treats it as a FIRST-CLASS layer (generate many, pick one,
// then write the body around it) — independent of the body FRAMEWORK. These 6
// archetypes are PROVEN, UNIVERSAL TikTok-ad opening patterns; the AI fills the
// niche from the product brief, so they work for ANY product (skincare,
// supplement, appliance, power tool, apparel…). NO hardcoded niche.

export type HookArchetype =
  | 'callout_pain'   // "Nếu bạn [đau rất cụ thể], dừng lại xem cái này"
  | 'contrarian'     // "Ngừng [việc ai cũng làm] đi, nó đang [hậu quả]"
  | 'curiosity_gap'  // "Không ai nói cho bạn [bí mật này]..."
  | 'confession'     // "3 năm nay mình [khổ vì X], tới khi..."
  | 'shock_result'   // "[Chuyển biến bất ngờ] chỉ sau [thời gian ngắn]"
  | 'question_pov'   // "Tại sao [hiện tượng]?" / "POV: bạn vừa biết..."

export interface HookArchetypeConfig {
  id: HookArchetype
  labelVi: string
  /** One-line user-facing description for the picker chip */
  descriptionVi: string
  emoji: string
  /** Gemini prompt fragment — UNIVERSAL, niche filled from the product brief. */
  promptHint: string
}

export const HOOK_ARCHETYPES: Record<HookArchetype, HookArchetypeConfig> = {
  callout_pain: {
    id: 'callout_pain',
    labelVi: 'Gọi đích nỗi đau',
    descriptionVi: 'Nhắm thẳng người đang gặp đúng nỗi đau cụ thể của ngách.',
    emoji: '🎯',
    promptHint:
      'CALLOUT a very specific pain of THIS product\'s exact audience in the first ' +
      'line, so the right viewer feels personally named and stops scrolling. So ' +
      'precise it feels like the algorithm read their mind. Niche comes from the brief.',
  },
  contrarian: {
    id: 'contrarian',
    labelVi: 'Phản biện / Bẻ niềm tin',
    descriptionVi: 'Bẻ một niềm tin/thói quen sai phổ biến trong ngách.',
    emoji: '🔄',
    promptHint:
      'Open by CONTRADICTING a common belief or habit in this niche ("Stop doing ' +
      'X — it is quietly causing Y"). Bold, a little provocative, but honest. Creates ' +
      'tension that makes the viewer stay to find out if they are wrong.',
  },
  curiosity_gap: {
    id: 'curiosity_gap',
    labelVi: 'Khoảng trống tò mò',
    descriptionVi: 'Hé lộ có một bí mật/điều ít ai biết — chưa nói ra ngay.',
    emoji: '🕳️',
    promptHint:
      'Open a CURIOSITY GAP — hint at a little-known secret / reason / method this ' +
      'product reveals, WITHOUT giving it away in the first line. The viewer must ' +
      'keep watching to close the gap. Avoid clickbait that the script cannot pay off.',
  },
  confession: {
    id: 'confession',
    labelVi: 'Tự thú trạng thái trước',
    descriptionVi: 'Thú nhận cá nhân kiểu "mình từng khổ vì... tới khi".',
    emoji: '🤫',
    promptHint:
      'Open as a first-person CONFESSION of a past struggle / mistake ("For months ' +
      'I ... until ..."). Vulnerable, intimate, like a voice memo to a friend — not ' +
      'an ad. The product appears later as the turning point, never in the hook.',
  },
  shock_result: {
    id: 'shock_result',
    labelVi: 'Kết quả gây sốc',
    descriptionVi: 'Đập ngay vào một kết quả/chuyển biến bất ngờ.',
    emoji: '⚡',
    promptHint:
      'Open with a SURPRISING, concrete RESULT or transformation up front ("In days ' +
      'this completely changed ..."). Specific and believable — a real felt or ' +
      'visible change, never an unbacked medical/clinical claim. Numbers only if real.',
  },
  question_pov: {
    id: 'question_pov',
    labelVi: 'Câu hỏi cắm chốt',
    descriptionVi: 'Mở bằng câu hỏi người xem thầm gật đầu, hoặc thả thẳng vào 1 khoảnh khắc thật.',
    emoji: '❓',
    promptHint:
      'Open with a sharp QUESTION the viewer silently answers "yes" to, OR drop them ' +
      'straight into a vivid, specific everyday moment. Write it as the natural spoken ' +
      'words the person says — NEVER as a label or stage direction like "POV:". Short, ' +
      'punchy, about a real tension the script resolves.',
  },
}

export const HOOK_ARCHETYPE_ORDER: HookArchetype[] = [
  'callout_pain', 'contrarian', 'curiosity_gap', 'confession', 'shock_result', 'question_pov',
]

export interface HookVariant {
  /** Tone of this hook (legacy 3-style; kept for back-compat) */
  style: HookStyle
  /** #6 — which archetype produced this hook (absent on legacy 3-variant hooks) */
  archetype?: HookArchetype
  /** The hook text — short, 1-2 lines, in the TARGET language */
  text: string
  /** #6 — Vietnamese gloss for DISPLAY ONLY (when target lang ≠ vi). Never used
   *  as the actual hook/script — purely so the VN user understands the meaning. */
  viGloss?: string
  /** Estimated read duration */
  estDurationSec: number
}

// ── Generated script ───────────────────────────────────────────────────────

export interface GeneratedScript {
  /** Which structure was used to generate this */
  structure: AdStructure
  /** Which angle was used */
  angle: AdAngle
  /** Target duration the user picked (40/50/60) */
  targetDurationSec: ScriptTargetDurationSec
  /** 5 script blocks in order */
  blocks: ScriptBlock[]
  /** Sum of block durations — the MASTER TIMELINE LENGTH */
  totalDurationSec: number
  /** When the script was generated (resume / cache check) */
  generatedAt: number
  /** P5m — the ONE concrete memorable reason/number (anchor) the script plants early
   *  + restates at the CTA. Passed to the director so it gives the anchor a HERO shot
   *  + sticker. Absent on own-script / older projects. */
  anchor?: string
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
  /** P3q — which body SHAPE: narrative (default, P-S flow) / listicle (N reasons) /
   *  comparison (A vs B) / journey (multi-day test). Layers orthogonally on the
   *  structure (INSTANT or LEAD can pick any of the 4 shapes). */
  shape: ScriptShape
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
    shape: DEFAULT_SCRIPT_SHAPE,
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
  /** Z69 — corner-PIP overlays played ON TOP of this creator segment. Only
   *  populated on creator_video segments; ignored on action_insert segments.
   *  Each overlay shows an insert clip in a corner (~30% width) for its
   *  window, while the creator keeps speaking full-screen behind it. */
  overlays?: SegmentOverlay[]
}

/** Z69 — a corner-PIP overlay riding on top of a creator segment. The compositor
 *  draws this insert clip at the chosen corner for `startSec..startSec+durationSec`
 *  RELATIVE to the segment start. */
export interface SegmentOverlay {
  /** Insert id this overlay sources from (for debug). */
  insertId: number
  /** Insert mp4 source (video / ken_burns overlays). Optional — a sticker overlay
   *  uses `imageRef` instead. */
  videoRef?: string
  /** Z98 #5 — sticker overlay: a transparent PNG (looped) instead of an mp4. */
  imageRef?: string
  /** Start time INSIDE this creator segment (seconds from segment start). */
  startSec: number
  /** Overlay duration (seconds). */
  durationSec: number
  /** Where to place the PIP. Default 'tr' (top-right). 'mr' = mid-right edge,
   *  vertically centred (used by stickers so they stay clear of the face/chest). */
  corner?: 'tl' | 'tr' | 'bl' | 'br' | 'mr'
  /** PIP width as a fraction of the output frame width (0.25-0.4). Default 0.32. */
  widthFraction?: number
  /** Z98 #5 — sticker overlays size by HEIGHT (consistent text size regardless
   *  of label length) instead of width. Fraction of the output frame height. */
  heightFraction?: number
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

// Z85 — default to FINAL 1080 (the user doesn't want to pick quality; the
// Director ships the best output by default — upscaled from the 480p sources).
export const DEFAULT_EXPORT_QUALITY: ExportQualityId = 'final_1080'

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

// ── Z89 — AI thumbnail archetypes (đợt 3) ───────────────────────────────────
// 4 fully-AI-rendered thumbnail styles (GPT-4o i2i with avatar + product refs).
// Each pairs a distinct scroll-stopping composition with a curiosity hook the
// Director writes. The user picks 1 of 4.
export type ThumbnailArchetypeId =
  | 'reaction_face'   // big creator face (shocked/curious) + hook + small product
  | 'before_after'    // split problem→result + hook
  | 'product_hero'    // product front-and-centre held by avatar + hook + offer
  | 'curiosity_text'  // giant curiosity-question hook + avatar + product small

export interface AiThumbnail {
  archetypeId: ThumbnailArchetypeId
  /** The curiosity hook text baked into the image. */
  hook: string
  /** asset:xxx of the generated thumbnail (null while still rendering / failed). */
  imageRef: string | null
  /** Per-card render state so the grid can show spinners + errors. */
  status: 'rendering' | 'completed' | 'failed'
  error?: string
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
    /** P6au — the CURRENT "Tạo Video" hybrid pipeline (scenes + rendered clips + voice +
     *  caption/banner config + final MP4). Durable fields only — transient render flags
     *  (renderingScenes / queuedScenes / assembling / assetsGenStartedAt) are stripped on save.
     *  Optional so legacy projects (saved before P6au) still load. */
    hybrid?: HybridState
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
  /** Z89 — the 4 AI thumbnail candidates + which one the user picked. */
  aiThumbnails: AiThumbnail[]
  pickedThumbnailRef: string | null
  isGeneratingThumbnails: boolean
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
    aiThumbnails: [],
    pickedThumbnailRef: null,
    isGeneratingThumbnails: false,
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
