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
  LandingPagePack, LandingGenParams, LandingLanguage,
  CharacterProfile, VisualMemoryItem,
} from '../types'

// ── Re-exports for downstream consumers (so storytelling code chỉ cần
//    import từ './types' thay vì xuyên qua barrel) ──────────────────────
export type {
  LandingPagePack, LandingGenParams, LandingLanguage,
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
export type SectionId =
  | 'intro-portrait'
  | 'ordinary-life'
  | 'daily-friction'
  | 'failed-attempts'
  | 'inner-realization'
  | 'discovery-moment'
  | 'first-trial'
  | 'subtle-change'
  | 'new-normal'
  | 'sharing-invitation'

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

export type OverlayAllowance = 'never' | 'chapter-marker' | 'time-marker' | 'caption'

/** Metadata-only section spec — KHÔNG hardcode text. Runtime text gen
 *  consume blueprint via prompt builder. */
export interface SectionBlueprint {
  id: SectionId
  order: number                        // 1-10
  role: string                          // short label, vd "mở chuyện"
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
  /** Section kết thúc bằng open loop / curiosity gap kéo người đọc tiếp. */
  curiosityGapAfter: boolean
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

/** Storytelling-specific metadata attached to the pack output. */
export interface StorytellingMeta {
  emotionalIntensity: EmotionalIntensity
  pacingType: PacingType
  productRevealSection: ProductRevealSection
  niche: NicheKey
  overlayBudgetUsed: number
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
