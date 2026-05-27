// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — type definitions (P0.5 foundation)
//
// Sandbox riêng cho form 'advertorial' ("Kể Chuyện Hành Trình"). Engine
// này KHÔNG share recipe/registry/routing với UGC engine. Output shape
// (LandingPagePack) được kế thừa từ parent types.ts để OutputPanel render
// được mà không cần build UI riêng.
//
// Philosophy & guardrails: xem memory `project_storytelling_engine_guardrails`.
// Blueprint v3: 10 sections / 9 ảnh default / continuity-first / anti-fake.
// ═════════════════════════════════════════════════════════════════════

import type {
  LandingPagePack, LandingSection, LandingGenParams, LandingLanguage,
  CharacterProfile, VisualMemoryItem,
} from '../types'

// ── Re-exports for downstream consumers (so storytelling code chỉ cần
//    import từ './types' thay vì xuyên qua barrel) ──────────────────────
export type {
  LandingPagePack, LandingSection, LandingGenParams, LandingLanguage,
  CharacterProfile, VisualMemoryItem,
}

// ═════════════════════════════════════════════════════════════════════
// 1. ENUM / UNION KEYS
// ═════════════════════════════════════════════════════════════════════

export type NicheKey =
  | 'skincare'
  | 'haircare'
  | 'supplement-wellness'
  | 'health-functional'
  | 'mom-baby'
  | 'relationship'
  | 'fitness-recovery'
  | 'beauty-confidence'
  // Tier S extensions (2026-05-27) — diary-fit niches per user request
  | 'sleep-insomnia'            // mất ngủ / khó ngủ / sleep quality issues
  | 'menopause'                 // mãn kinh / tiền mãn kinh / hormone phụ nữ
  | 'mental-health'             // lo âu / stress / depression / burnout
  | 'anti-aging-longevity'      // chống lão hóa B2C / NAD-NMN / biological age

/** Country target — drives cultural defaults. */
export type CountryCode = 'MY' | 'VN' | 'SG' | 'ID' | 'TH' | 'PH'

/** Emotional intensity scale — KHÔNG có 'trauma' level (anti-fake guardrail). */
export type EmotionalIntensity = 'low' | 'medium' | 'high'

export type PacingType = 'slow-burn' | 'steady' | 'quicker'

/** Section index where product becomes visually visible for the first time.
 *  Configurable per niche — wellness late (7-8), COD impulse earlier (5-6). */
export type ProductRevealSection = 5 | 6 | 7 | 8

export type CulturalWorldKey =
  | 'malay-muslim'
  | 'malay-secular'
  | 'vietnamese-urban'
  | 'vietnamese-rural'
  | 'chinese-sea'
  | 'indian-sea'
  | 'mixed-sea'

export type CtaSoftnessKey = 'invitation-only' | 'quiet-suggestion' | 'gentle-direct'

export type SupportingCharacterMode = 'none' | 'family' | 'friend' | 'partner'

export type VisualRealismKey = 'documentary' | 'family-album' | 'smartphone-candid'

/** Overlay budget for whole pack — KHÔNG bao giờ vượt 2 (anti-ads-vibe guardrail). */
export type OverlayModeKey = 'none' | 'minimal-1' | 'sparse-2'

export type AgeRangeKey = '18-25' | '25-35' | '35-45' | '45-55' | '55+'

export type WardrobeWorldKey =
  | 'baju-kurung'
  | 'modern-modest'
  | 'ao-dai-casual'
  | 'urban-casual'
  | 'rural-traditional'
  | 'workwear-business'

export type PersonalityVibeKey =
  | 'warm-maternal'
  | 'reserved-thoughtful'
  | 'gentle-introvert'
  | 'practical-direct'
  | 'soft-spoken-caring'

export type HomeSettingKey =
  | 'urban-apartment'
  | 'suburban-house'
  | 'rural-traditional'
  | 'family-compound'

export type FamilyStructureKey = 'single' | 'partnered' | 'with-children' | 'multigenerational'

// ═════════════════════════════════════════════════════════════════════
// READER-IMMERSION ARCHITECTURE — Phase-based blocks (post-v5.8 rebuild)
//
// Architecture shift: each block is a PSYCHOLOGICAL TRANSITION carried
// by the reader, NOT a "story scene" carried by the narrator. Reader
// becomes the emotional center of gravity; narrator = validator.
//
// Output per pack: flex 13-15 blocks (never rigid). 4 phases stable.
// ═════════════════════════════════════════════════════════════════════

/** 4 phases of reader-immersion conversion psychology. */
export type Phase =
  | 'recognition'        // Phase 1 — reader sees themselves
  | 'trust-alignment'    // Phase 2 — narrator joins, resistance softens
  | 'solution-opening'   // Phase 3 — product emerges from emotional context
  | 'future-self'        // Phase 4 — reader projects forward + soft invitation

/** YOU/I balance per block. NOT a hard template — opening reader-heavy,
 *  middle narrator-validation, ending future-reader. */
export type YouIBalance =
  | 'reader-heavy'         // YOU dominant; narrator absent or implicit
  | 'narrator-validation'  // narrator validates, reader still emotional center
  | 'future-reader'        // YOU projected forward; narrator recedes

/** Psychological function — what each block DOES to reader's mind.
 *  Drives directive content, not just labeling. */
export type PsychologicalFunction =
  | 'mirror-recognition'         // reader sees self in micro-moment
  | 'surface-friction'           // expose lived behaviors reader normalizes
  | 'name-hidden-feeling'        // surface unspoken emotion reader carries
  | 'reduce-isolation'           // "I'm not the only one" — relief
  | 'narrator-join'              // narrator validates by joining reader
  | 'shared-frustration'         // both have tried, both failed
  | 'anticipate-resistance'      // surface reader's skepticism, validate
  | 'reframe-belief'             // catalyst-triggered new understanding
  | 'organic-discovery'          // product emerges naturally, no announcement
  | 'mechanism-through-emotion'  // explain why through felt difference
  | 'emotional-compare'          // soft positioning vs old approach
  | 'specific-micro-win'         // tangible small change noticed retrospectively
  | 'quality-of-life-shift'      // daily ease returned
  | 'normalize-via-others'       // imperfect peer voices
  | 'future-self-invitation'     // reader projects forward, soft action

/** Canonical blocks across 4 phases. Resolver picks story blocks (13-15)
 *  + interleaves proof callouts (3) at phase boundaries.
 *
 *  Story blocks: phase architecture stable; count flex by niche/intensity.
 *  Proof callouts (P2): inserted by resolveBlockPlan at phase boundaries.
 *  Proof content comes from SEPARATE generateProofSet Gemini call (proof/
 *  module), distributed via phaseResonance matching. */
export type BlockId =
  // Phase 1 — Recognition (4 blocks, all reader-heavy)
  | 'self-recognition-hook'        // Block 1 — you-first opener + mirror beat
  | 'daily-micro-friction'         // Block 2 — lived behaviors reader recognizes
  | 'hidden-emotional-truth'       // Block 3 — unspoken feelings reader carries
  | 'not-alone-bridge'             // Block 4 — "I'm not the only one" → narrator joins
  | 'proof-recognition'            // P2 — Phase 1 proof callout (after Block 4)

  // Phase 2 — Trust + Resistance Alignment (3-4 blocks)
  | 'narrator-validation-entry'    // Block 5 — narrator validates from lived experience
  | 'shared-failed-attempts'       // Block 6 — frustration loop, you+I together
  | 'skepticism-alignment'         // Block 7 — anticipate reader's "yeah but..." (OPTIONAL)
  | 'belief-shift'                 // Block 8 — catalyst + reframe

  // Phase 3 — Solution Opening (2-3 blocks)
  | 'natural-product-discovery'    // Block 9 — organic mention, low expectation
  | 'why-this-felt-different'      // Block 10 — mechanism through emotional context
  | 'proof-solution'               // P2 — Phase 3 proof callout (after Block 10)
  | 'soft-mechanism-compare'       // Block 11 — emotional compare (OPTIONAL)

  // Phase 4 — Future Self Immersion (3 story blocks + 1 proof + cta)
  | 'micro-transformation'         // Block 12 — small specific wins
  | 'emotional-wins'               // Block 13 — quality of life returned
  | 'proof-future-self'            // P2 — Phase 4 proof callout (after Block 13)
  | 'future-self-cta'              // Block 14 — emotional projection + soft invitation

/** Sampling injection hooks per block — which sampling objects to weave in. */
export interface BlockSamplingHooks {
  performanceHookLayer?: boolean   // Block 1 only — you-first opener + bridge
  readerMirrorBeat?: boolean       // recognition + trust-alignment blocks
  discoveryChannel?: boolean       // natural-product-discovery only
  beliefCatalyst?: boolean         // belief-shift only
  payoffArchetype?: boolean        // future-self blocks
  reviewSlot?: boolean             // social-proof only
  softCta?: boolean                // future-self-cta only
  productDissolution?: boolean     // natural-product-discovery only (Chunk D)
  softCompare?: boolean            // soft-mechanism-compare only (Chunk D, optional block)
}

/** Block blueprint — lean philosophy-driven section spec.
 *  Replaces v4-v5.8 SectionBlueprint which carried narrator-scene-arc fields. */
export interface BlockBlueprint {
  id: BlockId
  phase: Phase
  psychologicalFunction: PsychologicalFunction
  youIBalance: YouIBalance
  /** 1-line description of what this block does psychologically. */
  intent: string
  /** Required = always in pack. Optional = resolver may skip based on niche/intensity. */
  required: boolean
  /** Paragraph count target (soft guidance, paragraphCountDetector warns). */
  paragraphTarget: { min: number; max: number }
  /** Which sampling objects this block weaves in. */
  samplingHooks: BlockSamplingHooks
}

/** BlockPlan — resolved per-pack ordering with metadata. */
export interface BlockPlan {
  blueprint: BlockBlueprint
  /** 1-indexed position in this pack's ordering. */
  order: number
}

// ═════════════════════════════════════════════════════════════════════
// HOOK PATTERN — emotional posture for Phase-1 Block-1 (sampled per pack)
// ═════════════════════════════════════════════════════════════════════

/** 6 emotional postures for the self-recognition-hook block.
 *  Layered as flavor on top of YOU-first opener (sampled separately). */
export type HookPattern =
  | 'emotional-rejection'   // "Tôi bắt đầu ghét buổi sáng."
  | 'specific-fear-moment'  // "Có sáng tôi đứng cạnh mép giường 3 phút..."
  | 'physical-immediacy'    // "Sáng nay đầu gối tôi lại nhói lên..."
  | 'internal-confession'   // "Tôi không nói điều đó với ai..."
  | 'pattern-disruption'    // "Trước đây tôi không để ý — nhưng dạo này..."
  | 'self-question'         // "Có ai giống tôi không — sáng dậy mệt hơn đêm trước?"

// ═════════════════════════════════════════════════════════════════════
// VISUAL ROLE SYSTEM (v4.3)
// ═════════════════════════════════════════════════════════════════════

/** Image purpose role — every image MUST belong to one role. If image
 *  doesn't fit any → don't generate (necessity test). */
export type ImagePurposeRole =
  | 'anchor-face'           // identity lock — section 1 hero
  | 'environment'           // wide context, no face, place sense
  | 'emotion-detail'        // partial face / hands / micro discomfort
  | 'memory-snapshot'       // candid, slightly blurred, peripheral angle
  | 'object-symbol'         // flat-lay objects (dầu nóng, miếng dán, ly cà phê...)
  | 'product-presence'      // product in domestic context (~15% frame, NOT hero)
  | 'relief-lifestyle'      // post-recovery candid (đi chợ, nấu ăn, đi bộ)
  | 'silence-frame'         // landscape / window / no character (breathing CTA)

// ═════════════════════════════════════════════════════════════════════
// HUMAN VARIATION ENGINE (v5.1 — P0.6)
// ═════════════════════════════════════════════════════════════════════

/** Social context where narrator's life unfolds — variation across packs. */
export type SocialContext =
  | 'family-centered'       // home, kids, spouse, family meals
  | 'work-centered'         // office, customers, colleagues
  | 'public-self-conscious' // siêu thị, đám đông, restaurant, ánh sáng public
  | 'solitary-internal'     // alone, mirror, bedroom, private moments
  | 'community-social'      // friends, neighbors, gatherings

/** v5.7 Chunk 3 — Underlying psychology DRIVER (orthogonal to personalityVibe).
 *  PersonalityVibe is surface tone (warm-maternal, gentle-introvert). Psychology
 *  driver is the deeper FORCE shaping voice: what pulls this person forward
 *  through the story, what they're defending, what they actually fear.
 *
 *  Without this axis, all narrators converge to "reflective-middle-aged-woman"
 *  variants regardless of surface tone. */
export type NarratorPsychologyDriver =
  | 'reflective-acceptance'    // existing default — quiet self-acceptance
  | 'practical-no-bullshit'    // doesn't tolerate fluff; gets to point
  | 'skeptical-defensive'      // tests everything; assumes worst
  | 'ego-driven-image'         // image-conscious; appearance matters
  | 'emotionally-tired'        // depleted; can't muster strong emotions
  | 'blunt-cộc'                // direct/sharp; doesn't soften
  | 'oversharing-anxious'      // dumps too much context; needs to be heard
  | 'socially-anxious'         // avoids judgment; comparing self constantly
  | 'bitter-resentful'         // carries grievance; mild anger underneath
  | 'vanity-sensitive'         // appearance is real stake; not minimized
  | 'emotionally-detached'     // observes self from distance; flat affect
  | 'insecure-doubting'        // questions own perception; needs validation
  | 'driven-ambitious'         // hates downtime; sees mediocre as failure

/** Narrator archetype — pre-selected per pack. Drives wording / pacing /
 *  shame / lifestyle / CTA tone / visual environment. */
export interface NarratorArchetype {
  id: string                        // 'female-housewife-suburban-38'
  label: string                     // 'Nữ nội trợ ngoại ô 38 tuổi'
  gender: 'female' | 'male'
  ageRange: AgeRangeKey
  occupation: string
  lifestyle: string                 // setting summary
  personalityVibe: PersonalityVibeKey
  /** v5.7 Chunk 3 — underlying psychology force shaping voice.
   *  Orthogonal to personalityVibe. Drives MEANING of shame patterns,
   *  contradictions, voice. */
  psychologyDriver: NarratorPsychologyDriver
  /** How they tend to phrase things. */
  wordingTendency: string
  /** What they're embarrassed about. Per-narrator concrete shame moments. */
  shamePatterns: string[]
  /** Micro-contradictions — humans aren't internally consistent. */
  contradictions: string[]
  /** Which social contexts most surface in this archetype's story. */
  socialContextPreference: SocialContext[]
  /** Which niches this archetype fits naturally. */
  compatibleNiches: NicheKey[]
}

/** Per-niche emotional DNA — niche-specific vocabulary, fears, avoidance. */
export interface PersonaEmotionalDNA {
  niche: NicheKey
  /** Primary emotions surface for this niche. */
  primaryEmotions: string[]
  /** Hidden fears reader carries (rarely articulated). */
  hiddenFears: string[]
  /** Behaviors of avoidance (what they STOP doing). */
  avoidanceBehaviors: string[]
  /** Identity threats this niche represents. */
  identityThreats: string[]
  /** Niche-specific embodied vocabulary — memory snapshot seeds. */
  embodiedVocabulary: string[]
}

/** Energy curve preset — different emotional movement styles per pack. */
export type EnergyCurveId =
  | 'steady-decline-recovery'    // slow down, then up
  | 'oscillating-frustration'    // try-fail-try-fail-breakthrough
  | 'sudden-realization'         // plateau, sudden insight
  | 'gradual-acceptance'         // slow evidence accumulation
  | 'reluctant-trust-building'   // many small wins before belief shifts

export interface EnergyCurvePreset {
  id: EnergyCurveId
  label: string
  description: string
  /** Pacing flavor for prompt — 1-line emotional movement style. */
  pacingFlavor: string
}

/** Memory snapshot emotional state — categorization for sampling.
 *  Different from micro-realism (v4.4 — short embodied details).
 *  Snapshots = FULL mini-scenes with setting + action + meaning. */
export type MemorySnapshotState =
  | 'physical-discomfort'   // body friction in concrete moment
  | 'shame-mirror'          // mirror confrontation moments
  | 'avoidance-public'      // public self-conscious avoidance
  | 'family-witness'        // family member notices/asks
  | 'private-moment'        // alone, intimate, hidden
  | 'fatigue-cognitive'     // energy/cognitive collapse
  | 'identity-shift'        // don't recognize self anymore
  | 'failed-attempt-trace'  // objects/routines that failed
  | 'social-comparison'     // comparing self to others
  | 'narrative-pivot'       // moment of catalyst (discovery)

/** Full memory snapshot — mini-scene with setting + action + meaning. */
export interface MemorySnapshot {
  id: string                    // 'haircare-shower-counting'
  niche: NicheKey
  emotionalState: MemorySnapshotState
  /** Full Vietnamese scene — 1-2 sentences, embodied. */
  scene: string
}

/** Camera language — visual grammar (Chunk E rebuilds taxonomy). */
export type CameraLanguage =
  | 'partial-face-observational'    // pain/friction — không full face, không hero shot
  | 'static-quiet-frame'            // reflection/belief-shift — still, contemplative
  | 'softer-wider-composition'      // hope/discovery — wider breathing room
  | 'breathing-warm-space'          // relief/payoff — warm tone, lifestyle
  | 'environmental-distance'        // internal-fear — observed from outside
  | 'domestic-realism'              // micro-reward — kitchen / home everyday
  | 'over-shoulder-peripheral'      // discovery — not center, casual catch

// ═════════════════════════════════════════════════════════════════════
// 2. PROTAGONIST PROFILE — identity anchor
// ═════════════════════════════════════════════════════════════════════

/** Identity anchor. Granular split tránh "Malaysia Indian woman" shorthand
 *  gây drift cultural identity. Hijab/hair logic explicit để tránh
 *  lúc-có-lúc-không. */
export interface ProtagonistProfile {
  gender: 'female' | 'male' | 'non-binary'
  ageRange: AgeRangeKey

  cultural: {
    world: CulturalWorldKey
    /** never lúc-có-lúc-không — 'always' or 'never', 'sometimes' chỉ cho
     *  niche có visual support cho chuyển đổi context (vd mom-baby ở nhà). */
    hijabState: 'always' | 'sometimes' | 'never'
    hairVisible: boolean
    modestyLevel: 'conservative' | 'modern-modest' | 'casual' | 'urban'
  }

  wardrobeWorld: WardrobeWorldKey
  personalityVibe: PersonalityVibeKey

  homeLifestyle: {
    setting: HomeSettingKey
    familyStructure: FamilyStructureKey
  }

  /** Optional — user upload làm hero anchor. Nếu absent, derived từ
   *  niche + cultural defaults. */
  referenceImage?: string
}

// ═════════════════════════════════════════════════════════════════════
// 3. TOP-LEVEL INPUT CONTRACT
// ═════════════════════════════════════════════════════════════════════

/** Top-level input passed to storytelling engine entry. Resolved from
 *  LandingGenParams + product + nicheMap defaults. */
export interface StorytellingInput {
  // Product context
  productId: string
  niche: NicheKey
  targetCountry: CountryCode
  targetLanguage: LandingLanguage

  // Narrative DNA
  protagonistProfile: ProtagonistProfile
  emotionalIntensity: EmotionalIntensity
  pacingType: PacingType
  productRevealSection: ProductRevealSection
  culturalWorld: CulturalWorldKey
  ctaSoftness: CtaSoftnessKey
  supportingCharacterMode: SupportingCharacterMode

  // Visual / overlay
  visualRealismLevel: VisualRealismKey
  overlayMode: OverlayModeKey

  // v5.1 — Human Variation Engine
  /** Optional seed for deterministic narrator/DNA/curve selection.
   *  If undefined, derived from productId + timestamp.
   *  Logged so caller can re-use for reproducibility. */
  randomSeed?: string

  // Optional carry-over from LandingGenParams
  visualMemory?: VisualMemoryItem[]
}

// ═════════════════════════════════════════════════════════════════════
// 5. CONTINUITY RULES
// ═════════════════════════════════════════════════════════════════════

export type ContinuityAttribute =
  | 'face-identity'
  | 'ethnicity'
  | 'age-range'
  | 'face-shape'
  | 'hijab-state'
  | 'hair-style'
  | 'body-build'
  | 'personality-vibe'
  | 'outfit-specific'
  | 'room'
  | 'lighting'
  | 'time-of-day'
  | 'mood'
  | 'expression'

export interface ContinuityRules {
  hardLocks: ContinuityAttribute[]
  softLocks: ContinuityAttribute[]
  freeAttributes: ContinuityAttribute[]
  /** Khi render fail continuity check: drop ảnh, giữ section text-only.
   *  Better missing image than wrong identity. */
  fallbackPolicy: 'drop-image-keep-section' | 'retry-then-drop'
  retryLimit: number
}

// ═════════════════════════════════════════════════════════════════════
// 6. VISUAL LANGUAGE
// ═════════════════════════════════════════════════════════════════════

export type VisualTreatment =
  | 'smartphone-candid'
  | 'domestic-observational'
  | 'family-album'
  | 'photojournalism-light'
  | 'imperfect-real'
  | 'environmental-wide'
  | 'flat-lay-natural'
  | 'memory-snapshot'
  | 'still-life-domestic'
  | 'landscape-quiet'

export type AntiAestheticTag =
  | 'pinterest'
  | 'luxury-editorial'
  | 'fashion-campaign'
  | 'catalog'
  | 'ai-commercial'
  | 'tvc-montage'
  | 'instagram-aesthetic'
  | 'kinfolk-cereal'
  | 'overly-composed'
  | 'hyper-golden-hour'

export interface VisualLanguageConfig {
  treatments: VisualTreatment[]
  antiAestheticBlacklist: AntiAestheticTag[]
  /** Single-string self-test prompt injected vào image gen. */
  realismSelfTestPrompt: string
}

// ═════════════════════════════════════════════════════════════════════
// 7. PACING RULES — text rhythm
// ═════════════════════════════════════════════════════════════════════

export type RhythmRequirement = 'required' | 'recommended' | 'optional'

export type BannedTextPattern =
  | 'firstly-secondly'
  | 'bullet-spam'
  | 'statistical-claim'
  | 'doctor-testimonial'
  | 'generic-motivational'
  | 'miracle-transformation'
  | 'overdramatic-trauma'
  | 'hard-sell'
  | 'fake-urgency'
  | 'giant-paragraph'
  | 'ai-essay-tone'
  // P0.5.4 storyselling extremes — banned both ways
  | 'fragmented-cinematic'    // screenplay chops ("Mệt. Rất mệt.")
  | 'cinematic-blocking'      // novelistic action ("Vặn vòi nước. Quay lại bàn.")
  | 'observer-3rd-person'     // named character as main subject
  | 'copywriter-template'     // "Bạn xứng đáng...", "Đừng bỏ lỡ..."
  | 'motivational-guru'       // "Hãy tin vào bản thân..."
  | 'fake-empathy-script'     // "Tôi hiểu cảm giác của bạn..."
  | 'formulaic-hook-spam'     // same "Bạn đã từng..." opener every pack

export interface PacingRules {
  paragraphDensity: {
    maxSentencesPerParagraph: number
    minBreathingLines: number
  }
  rhythmElements: {
    shortEmotionalLine: RhythmRequirement
    pauseLine: RhythmRequirement
    oneLineReflection: RhythmRequirement
    unfinishedThought: RhythmRequirement
    conversationalRhythm: boolean
  }
  bannedPatterns: BannedTextPattern[]
  diarySelfTestPrompt: string
}

// ═════════════════════════════════════════════════════════════════════
// 8. OVERLAY RULES
// ═════════════════════════════════════════════════════════════════════

export type AllowedOverlayType =
  | 'chapter-marker'
  | 'diary-timestamp'
  | 'film-subtitle'
  | 'photobook-caption'

export type BannedOverlayType =
  | 'cta-button'
  | 'headline-banner'
  | 'benefits-list'
  | 'badge-sticker'
  | 'star-rating'
  | 'price-tag'
  | 'urgency-strip'
  | 'sales-copy'

export type OverlayPosition = 'lower-third-left' | 'lower-third-right' | 'top-left' | 'top-right'

export interface OverlayRules {
  allowedTypes: AllowedOverlayType[]
  bannedTypes: BannedOverlayType[]
  /** Hard cap toàn pack — anti-ads-vibe guardrail. */
  maxPerPack: number
  styleSpec: {
    fontFamily: 'italic-serif'
    /** Max size as % of canvas width. */
    sizePctMax: number
    opacity: number
    positions: OverlayPosition[]
  }
  vibeSelfTestPrompt: string
}

// ═════════════════════════════════════════════════════════════════════
// 9. ANTI-PATTERNS — negative space
// ═════════════════════════════════════════════════════════════════════

export type AntiPatternTag = string

export interface AntiPatterns {
  visual: AntiPatternTag[]
  text: AntiPatternTag[]
  vibe: AntiPatternTag[]
}

// ═════════════════════════════════════════════════════════════════════
// 10. NICHE PRESET
// ═════════════════════════════════════════════════════════════════════

export interface NichePreset {
  niche: NicheKey
  emotionalIntensity: EmotionalIntensity
  productRevealSection: ProductRevealSection
  pacingType: PacingType
  continuityPriority: 'standard' | 'high'
  preferredTreatments: VisualTreatment[]
  ctaSoftness: CtaSoftnessKey
  supportingCharacter: SupportingCharacterMode
  /** Block count is now flex 13-15 driven by resolveBlockPlan. Kept for
   *  legacy NICHE_PRESETS data which may still set this number; resolver
   *  ignores it (block plan is intensity + niche driven). */
  sectionCount: number
  imageCount: number
  recommendedCulturalWorld: CulturalWorldKey[]
}

// ═════════════════════════════════════════════════════════════════════
// 11. OUTPUT SHAPE — StorytellingPack
// ═════════════════════════════════════════════════════════════════════

/** Per-section gen status — populated by runtime pipeline (P1+). */
export type SectionGenStatus =
  | { kind: 'pass' }
  | { kind: 'retry-pass'; firstAttemptViolations: string[] }
  | { kind: 'fallback'; violations: string[] }

/** Storytelling-specific metadata attached to the pack output. */
export interface StorytellingMeta {
  emotionalIntensity: EmotionalIntensity
  pacingType: PacingType
  productRevealSection: ProductRevealSection
  niche: NicheKey
  overlayBudgetUsed: number
  /** Parallel array với `pack.sections` — sectionIds[i] = storytelling
   *  block ID của pack.sections[i]. Tránh pollute shared LandingSection
   *  type với storytelling-specific field. (Field name kept for back-compat
   *  with v5.8 persisted packs; values are BlockId post-Reader-Immersion rebuild.) */
  sectionIds: BlockId[]
  /** Per-section overlay assignment — null = no overlay (default).
   *  Parallel với pack.sections. */
  overlayPerSection: (AllowedOverlayType | null)[]
  /** Per-section gen status — P1 runtime. Optional cho backward compat
   *  với mock packs / saved legacy packs. */
  sectionStatus?: SectionGenStatus[]
  /** Total Gemini attempts: 1 = clean first try, 2 = retried, 3 = fallback used. */
  attempts?: number
  /** Compact validation summary line — for UI strip + telemetry. */
  validationSummary?: string

  // v5.1 — Human Variation Engine selections
  /** Selected narrator archetype ID. Used for logging + future anti-repetition. */
  narratorArchetypeId?: string
  /** Selected energy curve preset ID. */
  energyCurveId?: EnergyCurveId
  /** Random seed used for narrator/DNA/curve selection. Caller can re-use. */
  randomSeed?: string

  // v5.2 — Memory Snapshot sampling
  /** IDs of memory snapshots sampled for this pack. For telemetry + future
   *  anti-repetition tracker. */
  memorySnapshotIds?: string[]

  // v5.3 — Hook + Discovery variation
  /** Selected hook emotional axis for section 1. */
  hookAxisId?: string
  /** Selected discovery channel for section 6. */
  discoveryChannelId?: string

  // P-VISION + P-SYNTHESIS (2026-05-27) — vision-extracted product identity
  // for downstream image generation accuracy. Image executor prepends this
  // to KIE prompts for sections needing product visibility (proof-callout,
  // object-trace, lifestyle-context).
  /** 1 detailed sentence describing visual product identity from images +
   *  synthesis. Reused by image generation to keep CTA/proof images
   *  matching ACTUAL product (color, shape, label features). */
  productIdentityForImage?: string
  /** Vision source — for QA telemetry. */
  visionSource?: 'gemini-vision' | 'no-images' | 'vision-failed'
  /** Synthesis source — for QA telemetry. */
  synthesisSource?: 'gemini-synthesis' | 'fallback'

  // P14 — Exportable page (composer + renderContract + visualSemantics +
  // imageSemantics + promptTranslation + rendererAdapters + orchestration +
  // validation/calibration + export pipeline). Replaces P13 validatedPage
  // field. ExportablePage IS-A ValidatedPage IS-A OrchestratedPage IS-A
  // RendererAdaptedPage IS-A ImagePromptPage IS-A ImageIntentPage IS-A
  // VisualSemanticsPage — full subtype chain preserved.
  /** ExportablePage IS-A ValidatedPage + per-section ExportGuide
   *  (design-intent metadata for marketer Ladipage assembly). */
  exportablePage?: import('../exportPipeline').ExportablePage
}

/** Pack output — extends LandingPagePack shape để OutputPanel render được
 *  mà không cần UI riêng. `storytellingMeta` carry context cho QA &
 *  downstream tooling. */
export interface StorytellingPack extends LandingPagePack {
  form: 'advertorial'
  /** Required (not optional) trong storytelling pack — character anchor luôn có. */
  characterProfile: CharacterProfile
  storytellingMeta: StorytellingMeta
}

/** Type guard cho consumers cần discriminate. */
export function isStorytellingPack(pack: LandingPagePack): pack is StorytellingPack {
  return pack.form === 'advertorial' && 'storytellingMeta' in pack
}
