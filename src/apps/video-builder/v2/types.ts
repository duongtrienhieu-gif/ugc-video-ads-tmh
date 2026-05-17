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
/**
 * Story-driven scene type — drives product visibility, wardrobe, environment,
 * lighting, energy, AND framing for that specific emotional beat of the script.
 *
 * Pipeline philosophy: NOT 9 pose-variations of the same product showcase.
 * Instead: 9 frames of an EMOTIONAL TIMELINE (hook → pain → discovery → CTA),
 * where each scene's visual mood matches the script's narrative beat.
 */
export type SceneType =
  | 'hook'              // pattern-interrupt opening — pull attention
  | 'pain'              // showing the problem — low energy, dark/messy, low product visibility
  | 'frustration'       // peak of pain — emotional/tense, product absent or hidden
  | 'failed_solution'   // tried-other-things — competitor product context, skeptical mood
  | 'discovery'         // first encounter with the product — curious/surprised
  | 'explanation'       // how/why it works — calm credibility, label visible, ingredient closeup
  | 'recovery'          // post-use result — relief, brighter look, healthier energy
  | 'lifestyle'         // integrated daily-life context — confident, social, polished
  | 'social_proof'      // testimonial / review / before-after — trust signals
  | 'cta'               // closing direct ask — polished, product hero, eye-contact

/**
 * Shot energy — drives visual rhythm across the 9-scene timeline so it feels
 * like a real edited UGC video, not a flat product gallery.
 */
export type ShotEnergy =
  | 'intimate'   // close, quiet, vulnerable framing
  | 'dynamic'    // motion-feeling, slight tilt, candid
  | 'emotional'  // expressive face, tighter on emotion
  | 'calm'       // grounded, balanced framing
  | 'tension'    // pulled-back unease, slight asymmetry
  | 'relief'     // relaxed posture, soft warm light
  | 'energetic'  // upbeat, action-feeling, brighter

/**
 * Subject motion style — describes WHAT the person physically does during
 * the shot. Captured at storyboard time so downstream Kling / Veo / Runway
 * / Minimax / Hailuo video gen knows what to animate, instead of forcing
 * the animator to guess from a still image.
 */
export type MotionStyle =
  | 'subtle_head_turn'   // small head turn / face-to-camera reveal — hook & discovery beats
  | 'stomach_holding'    // hand on stomach, slight wince — pain / frustration
  | 'eating_motion'      // raising fork, taking a sip, biting — recovery / lifestyle
  | 'selfie_talk'        // talking to camera, slight nod — testimonial / CTA
  | 'pointing_product'   // index finger pointing at label — explain / proof
  | 'laugh_with_family'  // group warmth, smile, slight body laugh — lifestyle / recovery
  | 'unboxing_reveal'    // hands lifting / opening / rotating packaging — discovery
  | 'walking_in'         // entering frame from edge — lifestyle / hook
  | 'static_pose'        // intentionally still — credibility / explain beats

/**
 * Camera motion intent — what the operator (or AI animator) does behind the
 * lens. Feeds Kling/Veo prompt as the "camera move" instruction so the
 * generated clip has the right cinematic rhythm.
 */
export type CameraMotion =
  | 'handheld'         // realistic micro-shake, UGC default
  | 'iphone_selfie'    // arm-extended selfie cadence, slight bob
  | 'slow_pushin'      // gentle dolly toward subject — emotional moments
  | 'slow_pullout'     // dolly back — reveal / lifestyle
  | 'static'           // tripod, fixed — credibility / testimonial
  | 'over_shoulder'    // POV behind subject — explain / discovery
  | 'walking_follow'   // tracking shot, walking pace — lifestyle
  | 'overhead_top'     // flat lay / top-down — ingredient / explain

/**
 * Z11 — what KIND of visual this scene is. Decides whether the avatar
 * appears at all, whether the product is hero, or whether the scene is
 * an infographic / animation / lifestyle environment.
 *
 * Drives ref-routing in promptCompiler:
 *   • person       → pass avatar + product refs (existing default)
 *   • product      → drop avatar ref, product hero macro
 *   • infographic  → drop avatar ref, infographic / 3D animation / floating particles
 *   • ingredient   → drop avatar ref, ingredient closeup / macro
 *   • lifestyle    → drop BOTH refs — environment-only context shot
 *
 * Without this axis, every scene defaulted to a person holding the product,
 * producing 9 near-identical portraits instead of a real video-ad timeline.
 */
export type SubjectFocus =
  | 'person'       // avatar visible — emotional / testimonial / CTA / UGC selfie
  | 'product'      // product hero macro — label closeup / hero shot, no person
  | 'infographic'  // 3D animation / molecular / floating particles / mechanism diagram
  | 'ingredient'   // raw ingredient macro / capsule explode / ingredient swirl
  | 'lifestyle'    // environment / context only — no person, no product hero

/**
 * Z12 — VISUAL MOTIF ENGINE.
 *
 * subjectFocus tells WHAT kind of subject is in the scene (person / product /
 * infographic / etc). visualMotif tells the AESTHETIC the scene wears so two
 * infographic scenes don't end up looking identical.
 *
 * Example pairings:
 *   • infographic + chemistry  → molecular bonds, chemical formulas, lab feel
 *   • infographic + energy     → glowing particles, light streaks, motion blur
 *   • infographic + social-proof → metrics cards, star ratings, testimonial chips
 *   • ingredient  + organic    → fresh leaves, herb macro, natural light
 *   • product     + premium    → soft gradient, gold accent, halo glow
 *   • product     + luxury     → black velvet, marble pedestal, dramatic light
 *   • person      + emotional  → tight on face, warm window light, vulnerable
 *   • person      + kinetic    → motion-blur action, dynamic pose
 *   • lifestyle   + emotional  → golden-hour, warm interior, after-life mood
 */
export type VisualMotif =
  | 'medical'       // clinical / lab / diagnostic — cell diagrams, body systems
  | 'chemistry'     // molecular bonds, chemical formulas, atom orbitals
  | 'energy'        // glowing particles, light streaks, motion-blur energy waves
  | 'premium'       // soft gradients, gold/cream accent, halo glow, refined
  | 'luxury'        // black velvet, marble, dramatic chiaroscuro lighting
  | 'scientific'    // data viz, microscope feel, sterile clean
  | 'organic'       // fresh herbs/leaves/fruit, soft natural daylight, earthy
  | 'social-proof'  // metric cards, stars, testimonial chips, multi-card layout
  | 'kinetic'       // motion blur, action, dynamic crop, fast feel
  | 'emotional'     // warm window light, golden hour, vulnerable / intimate

// ═════════════════════════════════════════════════════════════════════════
// Z13 — CINEMATIC ENGINE (P2): camera grammar + motion psychology +
//        energy mapping + social preset + transition director.
//
// These fields make image-based scenes FEEL like video by encoding the
// editor's motion intent, energy curve, and inter-scene transition rules.
// All four are inferred LOCALLY from existing blueprint axes — Gemini is
// NOT asked to fill them, so prompt complexity stays flat.
// ═════════════════════════════════════════════════════════════════════════

/** Camera language — concrete movement description used to drive both
 *  cinematic prompt phrasing AND the future downstream video animator. */
export type CameraGrammar =
  | 'handheld_close'      // hook / pain — tight handheld with micro-shake
  | 'slow_push'           // testimonials / discovery — gentle dolly in
  | 'punch_zoom'          // hook / CTA — aggressive snap zoom
  | 'drift_left'          // ambient / lifestyle — slow lateral drift
  | 'drift_right'         // ambient / lifestyle — slow lateral drift
  | 'orbit_soft'          // product hero — slow rotational orbit
  | 'parallax_depth'      // infographic — layered floating parallax
  | 'static_tension'      // pain / failed_solution — locked-off, no movement, tense
  | 'shake_micro'         // urgency moments — sub-second shake bursts
  | 'topdown_float'       // flatlay / ingredient overhead
  | 'review_pan'          // social_proof — slow pan across review cards
  | 'whatsapp_scroll'     // WhatsApp testimonial scroll feel
  | 'infographic_float'   // floating mechanism diagram with depth
  | 'emotional_zoom'      // recovery / testimonial — slow emotional push
  | 'product_macro'       // product hero macro — locked tight on label

/** Motion psychology layer — what FEELING the motion should evoke.
 *  Different name from legacy `motionIntent: string` field (which is a
 *  free-form description). The two coexist: `motionIntent` stays as
 *  free-form text fed to image prompts; `cinematicIntent` is the typed
 *  psychology category that drives camera-grammar selection. */
export type CinematicIntent =
  | 'urgency'       // hook / CTA — fast, aggressive, attention-grabbing
  | 'trust'         // social_proof / explanation — slow, stable, credible
  | 'premium'       // brand-elevation moments — smooth, refined, elegant
  | 'emotional'     // pain / recovery — warm, intimate, vulnerable
  | 'educational'   // explanation / mechanism — clear, paced, didactic
  | 'authority'     // expert / clinical — composed, sterile, scientific
  | 'kinetic'       // product spin / action — dynamic motion energy
  | 'curiosity'     // discovery / reveal — anticipation-building
  | 'relief'        // post-pain / after-state — soft exhale, calm
  | 'conversion'    // CTA — momentum, "BUY NOW" energy

/** Reusable TikTok-native motion packs. Each preset bundles a camera
 *  grammar + energy band + transition flavor for fast assignment. */
export type SocialMotionPreset =
  | 'hook_aggressive'   // punch zoom + fast scale + shake micro
  | 'ugc_soft'          // handheld drift + subtle zoom (default lifestyle)
  | 'infographic_edu'   // layered parallax + floating labels
  | 'social_proof_pan'  // review pan + comment scroll + screenshot drift
  | 'cta_hardsell'      // rapid zoom + glow pulse + kinetic typography

/** Inter-scene transition style — assigned to scene N as the "exit" toward
 *  scene N+1. Last scene has no transitionOut. */
export type SceneTransition =
  | 'soft_fade'           // emotional → emotional
  | 'directional_wipe'    // → infographic
  | 'smash_cut'           // → hook / aggressive reveal
  | 'flash_impact'        // → CTA
  | 'cinematic_dissolve'  // → social_proof / testimonial
  | 'cross_dissolve'      // generic warm transition
  | 'cut'                 // default hard cut

// ═════════════════════════════════════════════════════════════════════════
// Z17 — EDITORIAL INTELLIGENCE LAYER (P1-P13)
//
// Sits between the storyboard engine (Z11/Z12/Z13) and the future video
// renderer. Adds:
//   • visualRole — semantic purpose per scene (hook/pain/sensory/credibility/...)
//   • coverageShots — 3-6 derived shots per master scene
//   • continuityGroup — identity-lock bundle (avatar/wardrobe/lighting/product)
//   • motion blueprint — zoom/pan/blur/handheld parameters per shot
//   • timelineCuts — final ordered cuts assembled to fill voice duration
//   • editorial transition graph — cut-to-cut transition rules
//
// All inferred LOCALLY from existing blueprint axes — Gemini schema unchanged.
// ═════════════════════════════════════════════════════════════════════════

/** Semantic role of a scene in the editorial flow. Adds a layer of meaning
 *  beyond sceneType + subjectFocus + visualMotif so the diversity engine can
 *  detect "3 informational beats in a row" (semantic duplication) — not just
 *  "3 same compositions in a row" (visual duplication). */
export type VisualRole =
  | 'hook'             // attention-grab opener
  | 'pain'             // problem agitation
  | 'reaction'         // emotional reaction shot (frustration, failed attempts)
  | 'education'        // mechanism / ingredient explanation / science
  | 'sensory'          // tactile / textural / sensual closeup
  | 'product_reveal'   // product hero / first encounter
  | 'credibility'      // metric cards / certification / authority signals
  | 'ingredient'       // ingredient macro / capsule splay / herbs
  | 'lifestyle'        // after-life / environmental context
  | 'recovery'         // relief / post-pain result
  | 'social_proof'     // testimonial / review / before-after
  | 'cta'              // closer / BUY NOW / direct ask

/** Coverage shot type — what KIND of derived shot this is within a master
 *  scene. Each master scene gets 3-6 coverage shots so a 60s voiceover has
 *  20-35 cuts (editor-style pacing) instead of 9 long static masters. */
export type CoverageShotType =
  | 'master'           // the original master scene (1:1 with SceneBlueprint)
  | 'closeup'          // tight emotional / detail crop
  | 'medium'           // mid-distance composition
  | 'detail'           // hand / label / texture detail
  | 'reaction'         // face / emotion crop
  | 'environment'      // wider establishing context shot
  | 'product_focus'    // product macro / label-only / cap rotation
  | 'crop'             // tighter recompose of the master
  | 'overlay_space'    // composition leaves room for typography overlay
  | 'motion_frame'     // implied motion (rotation / spin / particles)

/** Cut-to-cut transition style at the editorial timeline level. Different
 *  from SceneTransition (which is master-to-master at storyboard level). */
export type EditorialTransition =
  | 'cut'              // default hard cut
  | 'smash_cut'        // aggressive — hook / pain spike
  | 'whip'             // fast directional blur transition
  | 'dissolve'         // soft warm crossfade — recovery / emotional
  | 'blur_wipe'        // → infographic / education
  | 'flash'            // → CTA impact

// ═════════════════════════════════════════════════════════════════════════
// Z21 — COVERAGE ENGINE + TIMELINE ASSEMBLER (P18)
// ═════════════════════════════════════════════════════════════════════════
//
// Refinement of Z17 EditorialIntelligenceLayer with:
//   • 10 explicit editor-semantic coverage roles (CoverageShotRole)
//   • Editor-style cut taxonomy (EditorialCutType)
//   • Phase-aware pacing density
//   • Phase-aware timeline phases for cut density rules
//
// Coexists with Z17 fields — CoverageShot.shotType / TimelineCut.transition
// stay for backward compat; new coverageRole / cutType / phase fields layer
// editor-semantic meaning on top.

/** Editor-style coverage shot role — the semantic purpose of THIS shot
 *  within the parent master scene's coverage set. Drives template lookup
 *  + diversity rules. */
export type CoverageShotRole =
  | 'closeup'         // tight emotional crop
  | 'macro'           // extreme detail (product label, capsule cross-section)
  | 'wide'            // establishing / environment shot
  | 'insert'          // brief contextual insert (laptop screen, phone)
  | 'reaction'        // face / emotion reaction shot
  | 'hand_detail'     // hand interaction (holding, pointing, scooping)
  | 'ingredient'      // raw ingredient macro / capsule split
  | 'product_macro'   // hero product macro shot
  | 'environment'     // setting / room / outdoor context
  | 'motion_anchor'   // implied motion (rotation, particles, spin)

/** Editor-style cut type — captures the EDITORIAL INTENT of the transition
 *  (not just the visual effect). Sister field to existing EditorialTransition
 *  which captures the visual FX kind. Both stored on TimelineCut. */
export type EditorialCutType =
  | 'hard'      // basic hard cut — default
  | 'match'     // match cut — visual similarity bridge between shots
  | 'smash'     // smash cut — aggressive contrast (pain → discovery)
  | 'dissolve'  // crossfade — emotional / recovery
  | 'whip'      // whip pan — energetic transition
  | 'flash'     // flash impact — → CTA

/** Pacing density at a timeline phase — drives cut duration target. */
export type EditorialPacingDensity = 'high' | 'medium' | 'low'

/** Logical phase a cut belongs to — used by the timeline assembler
 *  to pick the right pacing density. Phases roughly map to a typical
 *  60s UGC ad: 0-8% hook, 8-65% body, 65-80% breath, 80-100% CTA. */
export type EditorialPhase = 'hook' | 'body' | 'education' | 'recovery' | 'cta'

// ═════════════════════════════════════════════════════════════════════════
// Z22 — TIMELINE RENDERER PHASE
// ═════════════════════════════════════════════════════════════════════════
//
// Consumes EditorialBlueprint (timelineCuts, coverageShots, motion
// blueprints, transitionGraph, continuityGroups) → produces 25-35 Kling
// video clips at CUT level (NOT master level). Each cut renders the same
// master image with DIFFERENT motion / pacing / duration so the final
// video feels edited, not slideshow.

/** Kling-safe motion grammar. Editorial motion (smash/whip/parallax/...)
 *  gets normalized to one of these BEFORE sending to Kling. */
export type KlingSafeMotion =
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'dolly_in'
  | 'dolly_out'
  | 'static'
  | 'handheld'

/** Status of a single cut render. */
export type TimelineRenderStatus =
  | 'pending'
  | 'queued'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** A single cut waiting to render OR already rendered. Pairs the
 *  EditorialBlueprint's TimelineCut metadata with the actual Kling job
 *  state (taskId, videoRef) so the UI can track per-cut progress. */
export interface TimelineRenderItem {
  /** 1-indexed cut id — matches TimelineCut.cutId */
  cutId: number
  /** Reference to CoverageShot.shotId */
  coverageShotId: number
  /** Master scene id (for continuity grouping) */
  masterSceneId: number
  /** Start time in seconds (from t=0) */
  startSec: number
  /** End time in seconds */
  endSec: number
  /** Cut duration */
  durationSec: number
  /** asset:xxx ref of the source keyframe (the parent master's approved image) */
  parentKeyframeRef: string
  /** Compiled cut-level prompt (single-line, Kling-safe) */
  prompt: string
  /** Compiled negative prompt — short, Kling-safe */
  negativePrompt: string
  /** Kling-safe motion grammar */
  klingMotion: KlingSafeMotion
  /** Visual role for ordering / UI grouping */
  visualRole: VisualRole
  /** Editorial phase */
  phase?: EditorialPhase
  /** Editorial cut type — for analytics, not sent to Kling */
  cutType?: EditorialCutType
  /** Render status */
  status: TimelineRenderStatus
  /** Kling task id (when submitted) */
  taskId?: string
  /** asset:xxx ref of the rendered video clip (when completed) */
  videoRef?: string
  /** Error message on failure */
  error?: string
  /** Retry attempts */
  retryCount?: number
}

/** Top-level timeline render job. 1:1 with EditorialBlueprint.timelineCuts. */
export interface TimelineRenderJob {
  id: string
  /** Map masterSceneId → keyframe asset ref. Lookup table for resolving
   *  each cut's parentKeyframeRef. */
  masterKeyframeRefs: Record<number, string>
  /** One render item per timelineCut */
  items: TimelineRenderItem[]
  isRunning: boolean
  isPaused: boolean
  providerLabel: string
  creditPerClip: number
  /** Sum of all cut durations — what the final assembled video will be */
  estimatedDurationSec: number
}

/** Motion blueprint per coverage shot — drives the downstream video animator
 *  (Kling / Veo / Runway). Static keyframe becomes an animated cut. */
export interface MotionBlueprint {
  /** Zoom direction during the clip. 'none' = locked-off. */
  zoomDirection?: 'in' | 'out' | 'none'
  /** Camera pan/tilt direction. 'none' = locked-off. */
  cameraMove?: 'left' | 'right' | 'up' | 'down' | 'none'
  /** Overall motion intensity 0-100. Higher = more movement. */
  intensity?: number
  /** Motion blur amount 0-100. Higher for kinetic / urgency moments. */
  blurAmount?: number
  /** Handheld shake amount 0-100. Higher for UGC realism / pain / hook. */
  handheldAmount?: number
  /** Easing curve — drives the animation's velocity profile. */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

/** A single derived coverage shot — a master scene typically produces 3-6
 *  of these so the final timeline has editor-pace cuts instead of long
 *  static masters. */
export interface CoverageShot {
  /** 1-indexed shot id, unique across the entire EditorialBlueprint */
  shotId: number
  /** sceneId of the master scene this shot derives from */
  masterSceneId: number
  /** Kind of coverage this is — Z17 field */
  shotType: CoverageShotType
  /** Short English description — feeds the downstream renderer's prompt */
  shotDescription: string
  /** Motion blueprint */
  motion: MotionBlueprint
  /** Continuity group id (shots that share avatar/wardrobe/lighting/product) */
  continuityGroup: string
  /** Estimated screen-time in seconds (computed by the assembler) */
  durationSec: number
  /** Visual role inherited from the master scene */
  visualRole: VisualRole
  // ── Z21 fields ───────────────────────────────────────────────────
  /** Editor-semantic role (closeup / macro / wide / hand_detail / etc) */
  coverageRole?: CoverageShotRole
  /** Prompt DELTA from the master — what changes vs the master scene.
   *  Used by the renderer phase to derive per-shot prompts without
   *  re-running Gemini. */
  promptDelta?: string
  /** Camera grammar specific to this coverage shot (overrides master's). */
  cameraGrammar?: CameraGrammar
  /** Editorial transition INTO this shot (visual effect). */
  transitionOut?: EditorialTransition
  /** Explicit parent reference — same as masterSceneId but as string id
   *  for hash-style lookup. */
  derivedFrom?: string
}

/** A continuity bundle — group of shots that should share identity. Editor
 *  references this so the renderer phase locks avatar / wardrobe / room
 *  tone / product across the group, even when shots have different
 *  compositions / motion. */
export interface ContinuityGroup {
  groupId: string
  /** Reference to the avatar (or shot it derived from) */
  avatarRef: string
  /** Wardrobe / outfit signature */
  wardrobe: string
  /** Lighting family — broad category (warm / cool / dim / bright / golden) */
  lightingFamily: string
  /** Room tone signature */
  roomTone: string
  /** Product identity reference */
  productRef: string
  /** Shot ids that belong to this group */
  shotIds: number[]
}

/** A final ordered cut in the assembled timeline. The renderer phase
 *  consumes this array sequentially to produce the final video. */
export interface TimelineCut {
  /** 1-indexed ordinal in the final timeline */
  cutId: number
  /** Reference to a CoverageShot.shotId */
  coverageShotId: number
  /** Master scene id (for continuity grouping in the renderer) */
  masterSceneId: number
  /** Start time in seconds (absolute, from t=0) */
  startSec: number
  /** Z21: end time in seconds (= startSec + durationSec). Convenience for
   *  the renderer phase. */
  endSec: number
  /** Duration of this cut in seconds */
  durationSec: number
  /** Visual role of this cut */
  visualRole: VisualRole
  /** Energy 0-100 at this point in the curve (smoothed sample) */
  energy: number
  /** Transition INTO this cut (visual FX kind) */
  transition: EditorialTransition
  /** Z21: editor-semantic cut intent (separate from visual transition).
   *  Renderer may use either; transition for FX rendering, cutType for
   *  pacing audit + analytics. */
  cutType?: EditorialCutType
  /** Z21: which timeline phase this cut belongs to. Drives the assembler's
   *  density choice for this cut + adjacent cuts. */
  phase?: EditorialPhase
}

/** Top-level editorial intelligence output. Consumed by the future renderer
 *  phase; for now it's also surfaced in the debug panel. */
export interface EditorialBlueprint {
  masterScenes: SceneBlueprint[]
  coverageShots: CoverageShot[]
  timelineCuts: TimelineCut[]
  motionBlueprints: MotionBlueprint[]   // parallel array to coverageShots
  energyCurve: number[]                  // per-second energy 0-100
  continuityGroups: ContinuityGroup[]
  transitionGraph: Array<{ fromCutId: number; toCutId: number; type: EditorialTransition }>
  voiceDurationSec: number
  /** Z21: estimated TOTAL duration of the final assembled timeline (sum
   *  of cut durations). May differ slightly from voiceDurationSec if the
   *  assembler had to round cut counts. */
  estimatedDurationSec?: number
}

export interface SceneBlueprint {
  /** 1-indexed scene id in the storyboard (1-9 typically) */
  sceneId: number
  /** @deprecated use sceneId — kept for back-compat with v1 */
  sceneNumber?: number
  /** ── STORY-DRIVEN FIELDS (Phase A) ──────────────────────────────────────
   * sceneType = narrative role of this scene in the emotional timeline.
   * Drives product visibility, wardrobe, environment, lighting, energy. */
  sceneType?: SceneType
  /** Z11: what KIND of visual this scene is. Decides if the avatar appears
   *  at all. Without it, every scene becomes a portrait. */
  subjectFocus?: SubjectFocus
  /** Z12: visual motif / aesthetic skin layered on top of subjectFocus.
   *  Differentiates two scenes of the same focus (eg. two infographic scenes
   *  feel different when one is `chemistry` and the other is `social-proof`). */
  visualMotif?: VisualMotif
  // ── Z13 — CINEMATIC ENGINE (inferred locally, not asked from Gemini) ────
  /** Concrete camera language for this scene (punch_zoom, parallax_depth,
   *  emotional_zoom, etc). Drives both prompt phrasing AND downstream
   *  video animator. */
  cameraGrammar?: CameraGrammar
  /** Motion psychology — what FEELING the camera/edit evokes (urgency,
   *  trust, emotional, conversion, etc). Sister field to existing
   *  `motionIntent: string`; that stays as free-form text for image prompts,
   *  this one is typed for cinematic routing. */
  cinematicIntent?: CinematicIntent
  /** 0-100 energy score. Drives pacing curve + the "no 3 high-energy
   *  back-to-back" rule. CTA scenes get 90-100; calm middle gets 40-55. */
  energyScore?: number
  /** TikTok-native motion preset pack — bundles camera grammar + transition
   *  flavor for fast downstream lookup. */
  socialPreset?: SocialMotionPreset
  /** Transition style FROM this scene TO the next. Undefined on the final
   *  scene. Assigned by the transition director based on scene-pair logic. */
  transitionOut?: SceneTransition
  // ── Z17 — EDITORIAL INTELLIGENCE LAYER (inferred locally) ────────────
  /** Semantic editorial role — drives the visual-role diversity engine.
   *  Detects "3 informational beats in a row" (semantic dup) even when
   *  the underlying composition/pose are different. */
  visualRole?: VisualRole
  /** Continuity group id — bundles scenes that share avatar/wardrobe/
   *  lighting/product identity. The renderer phase locks identity across
   *  shots in the same group. */
  continuityGroup?: string
  /** Motion blueprint at the MASTER level. Coverage shots derived from
   *  this scene inherit + variate from this base. */
  motion?: MotionBlueprint
  /** What the scene visually proves / shows — e.g. "convey night-time fatigue", "demonstrate cap-twist freshness" */
  visualObjective?: string
  /** Concrete physical action subject performs — e.g. "rubbing temple while staring at laptop", "smiling, lifting jar to lens" */
  subjectAction?: string
  /** Why this frame exists in the ad — e.g. "establish problem reality", "trigger curiosity reflex", "close the sale" */
  narrativePurpose?: string
  /** Wardrobe style (SOFT LOCK — varies across timeline) — e.g. "pajama", "home casual", "office casual", "cafe outfit", "weekend relaxed" */
  wardrobeStyle?: string
  /** Environment archetype (SOFT LOCK — varies) — e.g. "bedroom", "kitchen", "cafe", "office desk", "outdoor lifestyle" */
  environmentType?: string
  /** Visual rhythm energy for this scene — alternates across timeline */
  shotEnergy?: ShotEnergy
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
  /** Optional preset label this scene was generated from (for UI display) — matches ScenePreset.labelEn */
  presetLabel?: string
  /** Auto-inferred preset confidence 0-100 (Phase A — Auto Preset Inference Engine) */
  presetConfidence?: number
  // ── VIDEO-LAYER PREP (Phase B) ───────────────────────────────────────
  /** What the SUBJECT physically does during the shot — used by downstream
   *  Kling/Veo/Runway video gen so the clip animates the right action
   *  rather than turning the still into a static slideshow. */
  motionStyle?: MotionStyle
  /** What the CAMERA does behind the lens — feeds the video-gen prompt as
   *  the camera move instruction (handheld micro-shake / slow pushin / etc). */
  cameraMotion?: CameraMotion
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

/** Vietnamese label for each tier — speed-first edition (spec section IX). */
export const TIER_LABEL_VI: Record<StrengthTierName, string> = {
  'creative': '⚡ Nhanh hơn — sáng tạo hơn',
  'balanced': '⚖️ Cân bằng',
  'strict':   '🛡️ Chặt hơn — chậm hơn',
}

/** Tier description — emphasize the speed trade-off so user picks intentionally. */
export const TIER_DESC_VI: Record<StrengthTierName, string> = {
  'creative': 'Tốc độ cao nhất. Prompt gọn, ít negative, generate 1 phát. Có thể drift nhẹ mặt/sản phẩm — đổi lại iterate nhanh để test ad.',
  'balanced': 'Mặc định cho media-buying workflow. Đủ lock identity + product, không lãng phí tốc độ cho perfectionism.',
  'strict':   'Lock cực chặt, retry khi QC bật, thêm anti-redesign negatives. Chậm hơn ~30-60s — chỉ bật khi cần ảnh hero cho landing/advertorial.',
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

// ── ASYNC JOB ARCHITECTURE — Master Frame ─────────────────────────────────────
// Master Frame generation is moved from synchronous request to a detached
// async job. The runner starts the job, returns jobId immediately, and the
// pipeline runs in the background. UI subscribes to job-state updates via
// the jobStore. State is persisted to localStorage so refresh resumes.

export type MasterFrameJobStatus =
  | 'queued'                  // job created, not yet started
  | 'extracting_identity'     // Gemini Vision describing avatar + product
  | 'generating'              // initial KIE image gen in flight (1st attempt)
  | 'auto_validating'         // quick heuristic + Gemini QC running
  | 'retrying_1'              // QC failed once, re-generating with bumps
  | 'retrying_2'              // 2nd retry
  | 'retrying_3'              // 3rd retry (final)
  | 'completed'               // success or best-of-N returned
  | 'failed'                  // hard error or timeout
  | 'cancelled'               // user cancelled

/** Vietnamese label for each job status — shown in the stepper UI. */
export const JOB_STATUS_LABEL_VI: Record<MasterFrameJobStatus, string> = {
  'queued':              'Chuẩn bị...',
  'extracting_identity': 'Đang phân tích avatar + sản phẩm...',
  'generating':          'Đang tạo ảnh...',
  'auto_validating':     'Đang kiểm tra chất lượng...',
  'retrying_1':          'Đang tạo lại...',
  'retrying_2':          'Đang tạo lại...',
  'retrying_3':          'Đang tạo lại...',
  'completed':           'Xong ✓',
  'failed':              'Thất bại',
  'cancelled':           'Đã hủy',
}

/** Estimated overall progress 0-100 per status — drives the progress bar. */
export const JOB_PROGRESS_PCT: Record<MasterFrameJobStatus, number> = {
  'queued':              5,
  'extracting_identity': 15,
  'generating':          40,
  'auto_validating':     55,
  'retrying_1':          70,
  'retrying_2':          82,
  'retrying_3':          90,
  'completed':           100,
  'failed':              100,
  'cancelled':           100,
}

export interface MasterFrameJobInputs {
  avatarId: string         // Model.id from bank
  productId: string        // Product.id from bank
  consistencyStrength: number
  qcEnabled: boolean
  /** Resolved at job start, used as primary identity refs */
  avatarImageUrl: string
  productImageUrl: string
  productName: string
}

export interface MasterFrameJobAttempt {
  attemptIdx: number          // 0 = first try, 1 = retry 1, ...
  /** Persisted intermediate image (per spec: auto-save every successful gen) */
  imageUrl: string | null
  /** KIE task id — persisted so refresh can re-poll without losing this attempt */
  kieTaskId?: string
  qc?: QcScore | null
  startedAt: number
  finishedAt?: number
}

export interface MasterFrameJobFailure {
  failureType: 'timeout' | 'api_error' | 'qc_unrecoverable' | 'cancelled' | 'unknown'
  message: string
  lastScores?: QcScore
  retryHistory: Array<{ attemptIdx: number; classification?: string; failureReasons?: string[] }>
}

export interface MasterFrameJob {
  jobId: string
  createdAt: number
  updatedAt: number
  status: MasterFrameJobStatus
  inputs: MasterFrameJobInputs

  /** Locked identity descriptions from Gemini Vision — set after extracting_identity completes */
  identity?: IdentityPack | null

  /** All attempts so far (success or fail) — auto-saved as they complete */
  attempts: MasterFrameJobAttempt[]

  /** Final accepted/best image (null until completed) */
  finalImageUrl?: string | null
  finalQc?: QcScore | null
  finalCompiled?: CompiledPrompt | null

  /** Vietnamese status text — drives stepper UI */
  statusVi: string
  /** Progress 0-100 — combines status pct + intra-status elapsed */
  progress: number
  /** Live elapsed seconds (UI ticker updates this) */
  elapsedSec: number

  /** Failure detail (populated when status='failed') */
  failure?: MasterFrameJobFailure
}

// ── MODULE 7: Scene Generation Engine ────────────────────────────────────────
// After Master Frame is approved + storyboard JSON is locked, the SceneGenEngine
// turns each Scene Blueprint into a REAL image via img2img derived from the
// approved Master Frame. NOT independent txt2img — every scene inherits identity
// + packaging from the master frame, only pose / framing / environment vary.

export type SceneGenItemStatus =
  | 'pending'       // queued, not yet started
  | 'generating'    // KIE GPT-4o image-edit in flight
  | 'auto_validating' // heuristic + Gemini QC running
  | 'retrying'      // QC failed once, regenerating with bumps
  | 'approved'      // user-approved (default: auto-approved on QC pass)
  | 'rejected'      // user rejected (will be regen'd or skipped)
  | 'failed'        // hard fail after retries exhausted
  | 'cancelled'

export const SCENE_STATUS_LABEL_VI: Record<SceneGenItemStatus, string> = {
  'pending':           'Đang chờ...',
  'generating':        'Đang tạo ảnh...',
  'auto_validating':   'Đang kiểm tra QC...',
  'retrying':          'Đang tạo lại (QC fail)...',
  'approved':          'Đã duyệt ✓',
  'rejected':          'Đã từ chối',
  'failed':            'Thất bại',
  'cancelled':         'Đã hủy',
}

export interface SceneGenItem {
  sceneId: number                 // 1-indexed (matches SceneBlueprint.sceneId)
  blueprint: SceneBlueprint       // locked at queue start
  status: SceneGenItemStatus
  /** Final accepted image url (or best-so-far on retry exhaust) */
  imageUrl: string | null
  /** Compiled prompt for this scene — for debug panel */
  promptUsed?: string
  /** QC score for the final accepted image */
  qc?: QcScore | null
  /** Per-scene retry count (within this scene's gen loop) */
  retryCount: number
  /** When this scene started / finished */
  startedAt?: number
  finishedAt?: number
  /** Error message if status='failed' */
  error?: string
}

export interface SceneGenJob {
  /** When the queue started */
  startedAt: number
  /** Master Frame URL — all scenes derive img2img from this */
  masterFrameUrl: string
  /** Locked identity pack from earlier phase */
  identity: IdentityPack
  /** Product name from bank for prompt anchoring */
  productName: string
  /** Consistency settings — locks compiler strength + QC thresholds */
  consistency: ConsistencyConfig
  /** Visual style DNA snapshot */
  dna: VisualStyleDna
  /** Cost control + speed: skip QC retry loop entirely (1 attempt per scene).
   *  Effectively the "Fast Mode" toggle — defaults to ON in VideoBuilderV2. */
  lowCostMode: boolean
  /** Z9 perf: number of scenes generated in parallel. KIE comfortably handles
   *  ~3 concurrent image-edit calls. */
  concurrency: number
  /** 9 scene items in order */
  items: SceneGenItem[]
  /** Index of the scene currently being processed (-1 = idle/done).
   *  In Z9 parallel mode this points at the LAST scene to enter the worker pool
   *  so the legacy "Đang xử lý cảnh X/N" header still moves forward. */
  currentIdx: number
  /** Overall queue status */
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
}

// ── v2 Pipeline State ────────────────────────────────────────────────────────

export type V2Phase =
  | 'input'              // pick avatar + product + script
  | 'identity-extract'   // Gemini Vision → avatar/product descriptions
  | 'master-frame'       // gen + approve master frame
  | 'blueprint'          // Gemini → scene blueprints
  | 'scene-gen'          // img2img from master frame for each scene
  | 'qc-loop'            // QC + auto-regen
  | 'video-gen'          // Phase B: keyframe → Kling 3.0 image-to-video clip
  | 'video-voice'        // delegate to v1 for video + voice + render
  | 'done'
  | 'failed'

// ── Phase 6 — Video clip generation per scene ────────────────────────────
// One VideoGenItem per approved scene keyframe. The runner submits the
// keyframe + motion/camera fields to KIE Kling, polls for the resulting
// clip URL, persists into the asset store, and exposes status via the
// videoGenJobStore for the UI to react to.

export type VideoGenItemStatus =
  | 'pending'
  | 'queued'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface VideoGenItem {
  /** 1-indexed scene id, matches the SceneBlueprint it derives from. */
  sceneId: number
  /** The keyframe asset ref this clip was animated from. */
  keyframeRef: string
  /** Compiled video prompt that was submitted to Kling. */
  promptUsed?: string
  /** Persisted asset ref to the generated clip (asset:xxx). */
  videoRef?: string
  /** KIE task id — kept for debugging + future retry/resume. */
  taskId?: string
  status: VideoGenItemStatus
  retryCount: number
  error?: string
  /** Duration sent to the API (sec) — Kling supports 5/8/10. */
  durationSec: number
}

export interface VideoGenJob {
  /** Local job id for grouping. */
  id: string
  /** Total clip count (= number of approved scenes). */
  total: number
  /** Per-clip state. */
  items: VideoGenItem[]
  /** True while at least one worker is mid-flight. */
  isRunning: boolean
  /** True when the user paused / cancelled the queue. */
  isPaused: boolean
  /** Provider label shown in the UI (e.g. "Kling 3.0 / KIE"). */
  providerLabel: string
  /** Approx KIE credit cost per clip (for the cost-preview UI). */
  creditPerClip: number
}

export const VIDEO_STATUS_LABEL_VI: Record<VideoGenItemStatus, string> = {
  pending:    'Chờ',
  queued:     'Trong hàng chờ',
  generating: 'Đang sinh video…',
  completed:  'Đã xong',
  failed:     'Lỗi',
  cancelled:  'Đã huỷ',
}

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
