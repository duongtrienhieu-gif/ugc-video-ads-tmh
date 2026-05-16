// ── UGC Builder v2 — AI Director Pipeline Types ──────────────────────────────
// Module 1: Master Frame Workflow
// Module 2: Prompt Compiler (placeholders below for future modules)
// Module 3: Scene Blueprint JSON
// Module 4: Basic QC (Gemini Vision similarity)
// Module 5: Consistency Slider
// ─────────────────────────────────────────────────────────────────────────────

import type { Product, Model } from '../../../stores/types'

// ── MODULE 1: Master Frame Workflow ──────────────────────────────────────────

/**
 * Identity descriptions extracted from input assets via Gemini Vision.
 * These are the FROZEN textual anchors that all subsequent generations reuse.
 */
export interface IdentityPack {
  /** Avatar face/style description: ethnicity, age, hijab/hair, eyes, features */
  avatarDescription: string
  /** Product description: container type, shape, colors, label, branding */
  productDescription: string
  /** Public URL of the avatar reference image */
  avatarImageUrl: string
  /** Public URL of the product reference image (first if multiple) */
  productImageUrl: string
}

/**
 * The canonical Master Frame — a single approved image showing the avatar
 * holding/using the product in a clean baseline composition. All B-Roll
 * scenes in module 6 are derived (img2img) from THIS frame, not from raw
 * avatar/product images. This is the heart of consistency in v2.
 */
export interface MasterFrame {
  /** Public URL (Supabase) or asset:// ref of the approved master frame */
  imageUrl: string
  /** Prompt used to generate this frame (for reproducibility / debugging) */
  promptUsed: string
  /** When this frame was generated */
  createdAt: number
  /** Approval state — only approved frames can be used downstream */
  status: 'pending-approval' | 'approved' | 'rejected'
  /** QC audit result (null = not yet QC'd, or QC disabled for this candidate) */
  qc?: QcScore | null
}

/**
 * State of the Master Frame generation step in the v2 pipeline.
 */
export interface MasterFrameStepState {
  /** All candidate frames the user has generated (for re-roll / picking) */
  candidates: MasterFrame[]
  /** Which candidate index is approved (-1 = none yet) */
  approvedIdx: number
  /** Loading state for the generation call */
  isGenerating: boolean
  /** Error from the last gen attempt */
  error: string | null
}

// ── MODULE 2: Prompt Compiler (5-section structure) ──────────────────────────

/**
 * Visual Style DNA — extracted from an Ads Win Template (or default preset).
 * Replaces the old "inject entire Ads Win prompt" approach. Each field is a
 * short concept token, not a paragraph — keeps the compiled prompt short.
 *
 * Phase 1: default values are hardcoded for ecommerce/landing/UGC use.
 * Phase 2: will be extracted via Gemini from uploaded Ads Win reference.
 */
export interface VisualStyleDna {
  /** Camera style — e.g. "iphone selfie", "handheld over-shoulder", "tabletop flatlay" */
  cameraStyle: string
  /** Hook style — e.g. "pattern interrupt", "before-after reveal", "direct claim" */
  hookStyle: string
  /** Pacing — e.g. "fast cuts (3-5s)", "slow soak (8-10s)", "balanced (5-7s)" */
  pacingStyle: string
  /** Subtitle / overlay density — e.g. "minimal", "bold-claim-keywords", "heavy-callouts" */
  subtitleDensity: 'none' | 'minimal' | 'medium' | 'heavy'
  /** Overall visual tone — e.g. "warm authentic UGC", "clinical credibility", "lifestyle aspirational" */
  visualTone: string
  /** Persuasion pattern (overall arc) — e.g. "problem → solution → proof → CTA" */
  persuasionPattern: string
  /** CTA style — e.g. "urgency-limited-time", "soft-link-bio", "scarcity-50-units" */
  ctaStyle: string
}

/** Sensible defaults for ecommerce + landing page + social proof UGC ads. */
export function defaultVisualStyleDna(): VisualStyleDna {
  return {
    cameraStyle: 'authentic iphone selfie + over-shoulder UGC, vertical handheld',
    hookStyle: 'pattern interrupt + relatable pain point',
    pacingStyle: 'balanced 5-7s shots, beat-matched to voice',
    subtitleDensity: 'medium',
    visualTone: 'warm authentic UGC — realistic ecommerce / landing-page lifestyle imagery, social proof tone',
    persuasionPattern: 'problem → solution → ingredient/proof → social proof → CTA',
    ctaStyle: 'soft helpful direction to link in bio / website',
  }
}

/**
 * Inputs the compiler needs to produce a final prompt.
 * Shared across master-frame, scene, and re-roll compilations.
 */
export interface CompiledPromptContext {
  /** Locked text anchors from Gemini Vision */
  identity: IdentityPack
  /** Product display name (from bank) */
  productName: string
  /** Visual style — defaults to ecommerce UGC preset */
  dna: VisualStyleDna
  /** Consistency config — drives lock language strength */
  consistency: ConsistencyConfig
  /** Optional scene-specific blueprint (omit for master frame baseline) */
  scene?: SceneBlueprint
  /** Optional master-frame URL when this is a scene-derived gen (img2img anchor) */
  masterFrameUrl?: string
  /** Optional per-section overrides — used by smart QC retry to bump specific locks */
  overrides?: SectionOverrides
}

/**
 * The compiled output. Sections kept separately so the debug panel can show
 * each block; `final` is the joined string sent to the image API.
 */
export interface CompiledPrompt {
  identityLock: string
  productLock: string
  sceneBlueprint: string
  visualDna: string
  negativePrompt: string
  /** All sections concatenated — this is what gets sent as the `prompt` field */
  final: string
  /** Reference priority order — what to pass as filesUrl[] */
  filesUrlOrder: Array<'product' | 'avatar' | 'masterFrame'>
}

// ── MODULE 3: Scene Blueprint JSON ───────────────────────────────────────────

/**
 * Structured per-scene blueprint — replaces giant cinematic prompts.
 * Gemini outputs an array of these instead of long visual paragraphs.
 * The Prompt Compiler (module 2) turns these into final prompts.
 *
 * All values target ecommerce / landing-page / advertorial / social proof
 * use — NOT cinematic movie scenes, NOT studio commercials.
 */
export interface SceneBlueprint {
  /** 1-indexed scene id in the storyboard (1-9 typically) */
  sceneId: number
  /** @deprecated use sceneId — kept for back-compat with v1 */
  sceneNumber?: number
  /** The scene's narrative goal — e.g. "social proof review", "ingredient credibility", "demonstrate result" */
  sceneGoal: string
  /** Setting — e.g. "home kitchen", "bedroom", "cafe", "office desk", "bathroom mirror" */
  environment: string
  /** Framing — e.g. "close-up", "medium close-up", "medium shot", "over-the-shoulder", "tabletop flatlay" */
  composition: string
  /** Camera vertical/horizontal angle — e.g. "iphone eye-level", "slight low angle", "high overhead" */
  cameraAngle: string
  /** Shot style — e.g. "ugc handheld", "selfie arm-extended", "tripod static", "phone-on-shelf POV" */
  shotType: string
  /** What the avatar is doing — e.g. "holding product near face", "pointing at label", "scooping from jar" */
  pose: string
  /** Emotion / expression — e.g. "friendly confident", "curious surprised", "warm reassuring", "concerned" */
  emotion: string
  /** How the hands interact with the product — e.g. "one hand holding bottle", "both hands cradling jar", "pinch-grip on sachet" */
  handUsage: string
  /** How prominently the product appears */
  productVisibility: 'low' | 'medium' | 'high'
  /** Background style — e.g. "real lived-in home", "messy kitchen counter", "clean white tile bathroom", "wooden cafe table" */
  backgroundType: string
  /** Lighting — e.g. "soft natural daylight", "warm window-side glow", "overhead kitchen LED", "morning bathroom light" */
  lightingStyle: string
  /** Visual tone keyword — should always lean ecommerce/UGC */
  visualTone: string
  /** Motion intent for downstream video gen — e.g. "slight handheld realism", "subtle slow zoom", "static phone-mount" */
  motionIntent: string
  /** Text overlay density (Module 5+ subtitles) */
  overlayDensity: 'none' | 'low' | 'medium' | 'high'
  /** True only on the dedicated CTA scene (usually last 1-2 scenes) */
  ctaFocus: boolean
  /** Speech (1-2 lines from the script that voice plays during this shot) */
  speech: string
  /** Optional preset label this scene was generated from (for UI display) */
  presetLabel?: string
}

/** Diversity check result — fails when 9 scenes are too similar. */
export interface DiversityReport {
  passed: boolean
  /** Number of unique composition values across all scenes */
  uniqueCompositions: number
  /** Number of unique cameraAngle values */
  uniqueCameraAngles: number
  /** Number of unique pose values */
  uniquePoses: number
  /** Number of scenes with productVisibility = 'high' */
  highVisibilityCount: number
  /** Total scene count */
  totalScenes: number
  /** Notes about what failed */
  notes: string[]
}

// ── MODULE 4: Real QC Loop via Gemini Vision ─────────────────────────────────

/**
 * Failure classification — what went wrong in the generated image.
 * Drives the smart retry strategy: which lock to bump on regen.
 */
export type FailureClassification =
  | 'ok'                    // passed all checks
  | 'wrong-product'         // generated product doesn't match (different shape/brand)
  | 'wrong-label'           // label text/logo wrong
  | 'redesigned-packaging'  // packaging redesigned (related to wrong-product)
  | 'wrong-hijab'           // hijab style/color drifted
  | 'wrong-ethnicity'       // face is different ethnicity
  | 'wrong-age'             // face is wrong age range
  | 'fake-hands'            // distorted fingers, extra fingers, etc.
  | 'studio-look'           // looks like studio commercial, not UGC
  | 'cinematic-lighting'    // dramatic movie lighting (banned)
  | 'stock-photo-vibe'      // looks like stock photography
  | 'plastic-skin'          // AI sheen / over-retouched skin
  | 'multiple-issues'       // more than one of the above

/**
 * Per-image QC score from Gemini Vision audit.
 * Compares generated image against avatar + product references.
 */
export interface QcScore {
  /** Pass = all axis scores >= their respective thresholds */
  passed: boolean
  /** How many regen attempts were made before this final result */
  retryCount: number
  /** Face match score (0-100, threshold 72) */
  faceScore: number
  /** Product packaging match score (0-100, threshold 88 — highest priority) */
  productScore: number
  /** OCR label text similarity (0-100, threshold 82) */
  ocrScore: number
  /** Realism / non-AI-look score (0-100, threshold 75) */
  realismScore: number
  /** List of specific problems found (in English, technical) */
  failureReasons: string[]
  /** Single dominant failure classification (drives retry strategy) */
  classification: FailureClassification
  /** AI-generated recommendation on what to fix in the next attempt */
  recommendation: string
  /** Vietnamese user-facing summary (used in UI badges/tooltips) */
  notes: string
}

/** Per-axis pass thresholds. Product has highest threshold (most critical). */
export interface QcThresholds {
  faceScore: number
  productScore: number
  ocrScore: number
  realismScore: number
}

export const DEFAULT_QC_THRESHOLDS: QcThresholds = {
  faceScore: 72,
  productScore: 88,
  ocrScore: 82,
  realismScore: 75,
}

/** Override thresholds based on consistency strength (90-95 = tighter QC). */
export function computeQcThresholds(strength: number): QcThresholds {
  if (strength >= 90) {
    return { faceScore: 76, productScore: 92, ocrScore: 86, realismScore: 78 }
  }
  if (strength >= 85) {
    return DEFAULT_QC_THRESHOLDS
  }
  // creative tier — slightly relaxed
  return { faceScore: 68, productScore: 85, ocrScore: 78, realismScore: 72 }
}

/**
 * Per-section strength overrides — used by smart-retry to bump a specific
 * lock without changing the global consistency strength.
 */
export interface SectionOverrides {
  /** Extra-strict identity lock (bumps face-lock language) */
  bumpIdentityLock?: boolean
  /** Extra-strict product lock (extra ABSOLUTE BAN + duplicate reference) */
  bumpProductLock?: boolean
  /** Extra realism emphasis (more "raw unedited iphone" in DNA) */
  bumpRealism?: boolean
  /** Extra OCR / label preservation emphasis */
  bumpLabelLock?: boolean
}

// ── MODULE 5: Consistency Slider ─────────────────────────────────────────────

/**
 * 80-95 range. Higher = stricter identity/product lock (less creative drift).
 * Lower = more compositional variety but higher drift risk.
 * Affects:
 *   - prompt language ("MUST EXACTLY match" vs "closely resemble")
 *   - QC threshold (pass score)
 *   - regenerate retry budget
 */
export type ConsistencyStrength = number  // 80..95

export interface ConsistencyConfig {
  strength: ConsistencyStrength
  /** Computed minimum QC passing score */
  qcThreshold: number
  /** How many times to auto-regenerate a scene if QC fails */
  maxRetries: number
}

export function computeConsistencyConfig(strength: ConsistencyStrength): ConsistencyConfig {
  // Map 80-95 → threshold 70-90 (linear) and retries 1-3
  const clamped = Math.max(80, Math.min(95, strength))
  const qcThreshold = Math.round(70 + ((clamped - 80) / 15) * 20)  // 70..90
  const maxRetries = clamped >= 90 ? 3 : clamped >= 85 ? 2 : 1
  return { strength: clamped, qcThreshold, maxRetries }
}

/** 3-tier classification of consistency strength (drives label colors + UI). */
export type StrengthTierName = 'creative' | 'balanced' | 'strict'

export function getStrengthTierName(strength: number): StrengthTierName {
  if (strength >= 90) return 'strict'
  if (strength >= 85) return 'balanced'
  return 'creative'
}

/** Vietnamese label for each tier (per Module 5 spec). */
export const TIER_LABEL_VI: Record<StrengthTierName, string> = {
  'creative': 'Sáng tạo hơn',
  'balanced': 'Cân bằng',
  'strict':   'Giữ mặt/sản phẩm chặt hơn',
}

/** Tier description for tooltips/debug panels. */
export const TIER_DESC_VI: Record<StrengthTierName, string> = {
  'creative': 'Mỗi cảnh được phép sáng tạo nhiều hơn, ít retry, QC dễ hơn. Đa dạng composition nhưng dễ drift mặt/sản phẩm.',
  'balanced': 'Điểm cân bằng giữa sáng tạo và nhất quán. Default cho hầu hết use case.',
  'strict':   'Product lock cực mạnh, identity lock mạnh, retry aggressive, thêm anti-redesign negatives, realism strict hơn.',
}

/** Pre-defined slider presets (per Module 5 spec). */
export interface ConsistencyPreset {
  id: string
  emoji: string
  labelVi: string
  hintVi: string
  strength: number
}

export const CONSISTENCY_PRESETS: ConsistencyPreset[] = [
  {
    id: 'tiktok',
    emoji: '🟣',
    labelVi: 'TikTok UGC',
    hintVi: 'Cân bằng sáng tạo, vẫn giữ identity ổn — phù hợp video viral nhanh',
    strength: 86,
  },
  {
    id: 'landing',
    emoji: '🟢',
    labelVi: 'Landing Page',
    hintVi: 'Identity + product chặt — ảnh dùng cho landing/advertorial chuyên nghiệp',
    strength: 92,
  },
  {
    id: 'ecommerce',
    emoji: '🟡',
    labelVi: 'Ecommerce sạch',
    hintVi: 'Tối đa product accuracy — packaging tuyệt đối không drift, dùng cho hero ảnh sản phẩm',
    strength: 94,
  },
]

// ── v2 Pipeline State ────────────────────────────────────────────────────────

export type V2Phase =
  | 'input'              // pick avatar + product + script
  | 'identity-extract'   // Gemini Vision → avatar/product descriptions
  | 'master-frame'       // gen + approve master frame
  | 'blueprint'          // Gemini → scene blueprints
  | 'scene-gen'          // img2img from master frame for each scene
  | 'qc-loop'            // QC + auto-regen
  | 'video-voice'        // delegate to v1 for video + voice + render
  | 'done'
  | 'failed'

export interface V2PipelineState {
  phase: V2Phase
  identityPack: IdentityPack | null
  masterFrame: MasterFrameStepState
  blueprints: SceneBlueprint[]
  qcScores: (QcScore | null)[]
  consistency: ConsistencyConfig
  inputs: {
    avatar: Model | null
    product: Product | null
    script: string
    visualStyleDna?: string  // Phase 2 — Ads Win DNA placeholder
  }
}

export function createEmptyV2State(): V2PipelineState {
  return {
    phase: 'input',
    identityPack: null,
    masterFrame: {
      candidates: [],
      approvedIdx: -1,
      isGenerating: false,
      error: null,
    },
    blueprints: [],
    qcScores: [],
    consistency: computeConsistencyConfig(90),  // default 90% strict
    inputs: {
      avatar: null,
      product: null,
      script: '',
    },
  }
}
