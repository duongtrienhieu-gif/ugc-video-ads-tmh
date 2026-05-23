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

/** Section IDs nội bộ storytelling engine. KHÔNG dùng SectionType của UGC. */
/** v4 section IDs — 11 sections, sales-functional conversion flow:
 *  Hook → Friction → Fear → Failed → BeliefShift → SoftReveal →
 *  MicroReward → Payoff → Reflection → TrustContinuity → SoftCTA
 *
 *  Belief-shift = CONVERSION CORE (not product reveal).
 *  Trust-continuity uses LandingSection.reviews field for 3 mini quotes. */
export type SectionId =
  | 'hook-interrupt'        // pattern-interrupt hook + identity anchor
  | 'daily-friction'        // relatable daily struggles
  | 'internal-fear'         // escalation + fear of decline
  | 'failed-attempts'       // frustration loop
  | 'belief-shift'          // 🆕 AHA reinterpretation — conversion core
  | 'soft-reveal'           // reluctant product mention, low expectation
  | 'micro-reward'          // subtle initial improvement
  | 'emotional-payoff'      // life feels lighter
  | 'reflection-trust'      // 🆕 looking back maturity
  | 'trust-continuity'      // 🆕 3 mini testimonial quotes (uses reviews field)
  | 'soft-cta'              // human emotional invitation

export type EmotionalBeat =
  | 'calm-curious'
  | 'subtle-unease'
  | 'recurring-discomfort'
  | 'frustration'
  | 'quiet-reflection'
  | 'hesitant-curiosity'
  | 'tentative'
  | 'first-hope'
  | 'acceptance-joy'
  | 'settled-resolve'

// ═════════════════════════════════════════════════════════════════════
// NARRATIVE DYNAMICS — v4 layer
//
// Encode WHAT each section does (function) — không chỉ where it sits
// on emotional curve (beat). Prevents AI-essay drift.
// ═════════════════════════════════════════════════════════════════════

/** Section's role trong narrative arc. Mỗi section có exactly 1 role. */
export type NarrativeRole =
  | 'hook'                  // section 1 only
  | 'orientation'           // establish world/identity AFTER hook
  | 'friction-loop'         // recurring micro-pain pattern
  | 'frustration-anchor'    // emotional bottom — quiet, not dramatic
  | 'reflection-pause'      // pure text breathing, insight emerges
  | 'curiosity-spark'       // discovery / pivotal moment
  | 'tentative-action'      // first try, uncertain
  | 'micro-reward'          // first sign of change — small, real
  | 'calm-payoff'           // sustained transformation
  | 'quiet-closure'         // closing invitation, no resolution-bow

/** What this section DOES to reader (≠ beat = what reader FEELS). */
export type EmotionalFunction =
  | 'create-unrest'         // unresolved tension — section 1 default
  | 'establish-recognition' // reader sees themselves in protagonist
  | 'deepen-empathy'        // empathy via repetition / small moments
  | 'invite-reflection'     // pause, reader's mind wanders
  | 'open-possibility'      // hope / new angle without promise
  | 'reward-attention'      // pay off the patient reader
  | 'settle-trust'          // bond stabilizes, payoff felt
  | 'invite-co-presence'    // reader feels invited, not sold to

/** Device pulling reader to next section. Subtle — anti-cliffhanger. */
export type CuriosityMechanic =
  | 'observation-anomaly'      // someone noticed something
  | 'unresolved-pronoun'       // who? what? ai? cái gì?
  | 'open-loop'                // ends mid-arc
  | 'unstated-cause'           // effect shown, cause withheld
  | 'time-jump-tease'          // "sau này...", "ngày đó..."
  | 'small-moment-magnification' // tiny detail given weight

/** Sentence-length & cadence pattern. Storyselling realignment: DROP
 *  'fragmented' (creates AI-essay feel). 'conversational' is now the
 *  default. 'short-clipped' restricted to rare emphasis — never section-
 *  level rhythm.
 *
 *  Anti-monotony loosened: 2 adjacent conversational/flowing sections OK
 *  if readable. We do NOT punish flowing similarity. */
export type RhythmProfile =
  | 'conversational'        // DEFAULT — 12-20 word sentences, natural flow, 2-4 sentence paragraphs
  | 'long-flowing'          // 15-22 words, em-dash, observational, longer paragraphs
  | 'short-clipped'         // RARE emphasis only — 5-9 words. Not section-default.
  | 'reflective-pause'      // longer sentences + occasional trailing "…", interior monologue
  | 'mixed'                 // combo — for multi-tonal sections like discovery/payoff

/** How section hands off to next. Anti-hard-cliffhanger. */
export type TransitionPsychology =
  | 'open-loop'             // unresolved phrase / unanswered observation
  | 'silent-cut'            // hard stop, time-shift implicit
  | 'time-jump'             // "đêm đó", "ba tuần sau"
  | 'thematic-echo'         // motif from earlier returns subtly
  | 'question-implicit'     // reader's own question forms
  | 'emotional-pull'        // feeling carries forward
  | 'resolution-settle'     // closing — no pull, just settle

/** Opening hook pattern — only section 1 (narrativeRole='hook'). */
/** v4 hook patterns — pattern interrupt + emotional snap.
 *  Section 1 (hook-interrupt) MUST create immediate recognition + fear within
 *  3 lines. NO smooth/descriptive/bio openers. */
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
  /** Per-section tension delta (added to base TENSION_CURVE). */
  tensionDeltas: Partial<Record<SectionId, number>>
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

/** Pacing class — cross-pack rhythm orchestration. Different sections
 *  have different pacing density để chống monotony. v4.6. */
export type PacingClass =
  | 'impact'           // strong opening (section 1) — emotional snap + anchor image
  | 'text-breathing'   // high text + minimal/no image (sections 3, 5, 11)
  | 'dense-narrative'  // solid text + 1 image (sections 2, 9)
  | 'mixed'            // balanced text + 1-2 image (sections 4, 6, 7, 8)
  | 'image-led'        // multiple images + low text (section 10 only)

/** Camera language — per emotional beat. Storyselling visual grammar. */
export type CameraLanguage =
  | 'partial-face-observational'    // pain/friction — không full face, không hero shot
  | 'static-quiet-frame'            // reflection/belief-shift — still, contemplative
  | 'softer-wider-composition'      // hope/discovery — wider breathing room
  | 'breathing-warm-space'          // relief/payoff — warm tone, lifestyle
  | 'environmental-distance'        // internal-fear — observed from outside
  | 'domestic-realism'              // micro-reward — kitchen / home everyday
  | 'over-shoulder-peripheral'      // discovery — not center, casual catch

/** Lightweight pull device — subtle continuation, NOT plot twist.
 *  Each section optionally has 1. Section 10 typically null (closure). */
export type RetentionMechanic =
  | 'section-end-pull'       // last line creates quiet continuation
  | 'reveal-delay'           // info dripped, not dumped
  | 'curiosity-debt'         // unanswered question carried forward
  | 'emotional-contrast'     // small mismatch (calm tone + unsettled fact)
  | 'micro-question'         // implicit reader question formed

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
// 4. SECTION BLUEPRINT METADATA
// ═════════════════════════════════════════════════════════════════════

export type TextDensity = 'none' | 'low' | 'medium' | 'medium-high' | 'high'

export type ContinuityRequirement = 'anchor' | 'required' | 'optional' | 'none'

export type ProductVisibility =
  | 'forbidden'
  | 'mentioned-only'
  | 'subtle-background'
  | 'still-life'

/** Section-level overlay allowance — values match AllowedOverlayType union
 *  so blueprint hints map 1:1 to actual overlay types ở render time. */
export type OverlayAllowance =
  | 'never'
  | 'chapter-marker'
  | 'diary-timestamp'
  | 'photobook-caption'
  | 'film-subtitle'

/** Metadata-only section spec — KHÔNG hardcode text. Runtime text gen
 *  consume blueprint via prompt builder. */
export interface SectionBlueprint {
  id: SectionId
  order: number                        // 1-10
  role: string                          // short VN label, vd "mở chuyện"
  emotionalBeat: EmotionalBeat
  textDensity: TextDensity
  imageRequirement: {
    countDefault: number               // 0 | 1 | 2
    rangeMin: number
    rangeMax: number
    isOptional: boolean
  }
  continuityRequirement: ContinuityRequirement
  productVisibility: ProductVisibility
  overlayAllowance: OverlayAllowance
  pacingPurpose: string                 // 1-line, vd "rock-bottom anchor"
  curiosityGapAfter: boolean

  // ─── v4 Narrative Dynamics layer ───────────────────────────────────
  /** Structured role (vs `role` which is VN human-readable label). */
  narrativeRole: NarrativeRole
  /** What section DOES to reader (≠ feeling reader gets). */
  emotionalFunction: EmotionalFunction
  /** Device pulling reader forward — null for closure section. */
  curiosityMechanic: CuriosityMechanic | null
  /** Cadence profile — adjacent sections MUST differ. */
  rhythmProfile: RhythmProfile
  /** Hand-off psychology to next section. */
  transitionPsychology: TransitionPsychology
  /** Tension/release graph position 0-10. */
  tensionLevel: number
  /** Optional retention micro-mechanic — null = no pull (closure). */
  retentionMechanic: RetentionMechanic | null
  /** Hook pattern — only section 1 (narrativeRole='hook'). */
  hookPattern?: HookPattern

  // ─── v4.3 Visual Role System ──────────────────────────────────────
  /** Image purpose roles for this section (parallel to imageRequirement.countDefault).
   *  Every generated image MUST belong to one role — necessity test. */
  imagePurposeRoles?: ImagePurposeRole[]
  /** Camera language styles preferred for this section. Image gen prompts
   *  inject these as visual treatment directives. */
  cameraLanguage?: CameraLanguage[]

  // ─── v4.6 Pacing Orchestration ────────────────────────────────────
  /** Cross-pack rhythm class. Variety required across pack — no 3 adjacent
   *  sections share class. */
  pacingClass?: PacingClass
}

/** SectionPlan — output của resolveSectionPlan(). Drives prompt builder. */
export interface SectionPlan {
  blueprint: SectionBlueprint
  imageCount: number
  hasImage: boolean
  showsProduct: boolean
  overlayType: AllowedOverlayType | null
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
  sectionCount: 9 | 10 | 11
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
   *  section ID của pack.sections[i]. Tránh pollute shared LandingSection
   *  type với storytelling-specific field. */
  sectionIds: SectionId[]
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
