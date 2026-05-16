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
 */
export interface SceneBlueprint {
  /** Index in the storyboard (1-9 typically) */
  sceneNumber: number
  /** The scene's narrative goal — e.g. "show scientific authority", "build trust", "demonstrate result" */
  sceneGoal: string
  /** Emotion arc — e.g. "concerned", "curious", "confident", "excited", "relieved" */
  emotion: string
  /** Camera framing — e.g. "iphone selfie", "over-shoulder", "tabletop flatlay", "medium close-up" */
  cameraStyle: string
  /** How prominently the product appears — drives gen weighting */
  productVisibility: 'none' | 'low' | 'medium' | 'high' | 'hero'
  /** Setting — e.g. "modern kitchen", "bedroom", "park bench", "office desk", "bathroom mirror" */
  environment: string
  /** Camera/subject motion hint (used in step 9 video gen) */
  motionType: string
  /** How much text overlay accompanies this scene */
  overlayDensity: 'none' | 'low' | 'medium' | 'high'
  /** The avatar's action in this scene — e.g. "holding product up", "pointing at label", "smiling at camera" */
  avatarAction: string
  /** Speech (1-2 lines from the script that voice over plays during this shot) */
  speech: string
}

// ── MODULE 4: Basic QC via Gemini Vision ─────────────────────────────────────

/**
 * Per-image QC score after generation. Values 0-100, threshold ~75 to pass.
 * Computed by Gemini Vision comparing generated image against locked references.
 */
export interface QcScore {
  /** How well the face matches the master frame avatar (0-100) */
  faceMatchScore: number
  /** How well the product matches the master frame product (0-100) */
  productMatchScore: number
  /** OCR label similarity — does the label text match the original */
  labelMatchScore: number
  /** Overall photorealism score (no AI artifacts, plastic look, etc.) */
  realismScore: number
  /** Any drift/issue notes from Gemini Vision */
  notes: string
  /** Pass = all required scores >= threshold */
  passed: boolean
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
