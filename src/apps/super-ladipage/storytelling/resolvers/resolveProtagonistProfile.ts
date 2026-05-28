// ─────────────────────────────────────────────────────────────────────
// resolveProtagonistProfile — niche + language aware (Fix A 2026-05-29)
//
// 2026-05-29 — Replaced the P0.5 hardcoded stub. The stub returned the
// SAME "Malay-Muslim woman 35-45, hijab always, baju-kurung" for EVERY
// product regardless of niche or language. Combined with the fallback
// prompt path (when Gemini batch synthesis failed), every pack produced
// near-identical image prompts. Root cause of "prompt y chang nhau cho
// mọi sản phẩm input".
//
// New behavior:
//   1. Niche-keyed archetype mapping: 9 archetypes covering 22 niches.
//      Each archetype defines a (gender, ageRange, vibe, setting,
//      family) tuple appropriate to the buyer profile for that niche.
//   2. Language-aware cultural world: 'ms' → malay-muslim/secular,
//      'vi' → vietnamese-urban/rural, anything else → safe MY default.
//   3. Deterministic sub-variant: each archetype has 1-3 variants; the
//      product seed (productId hash) picks one stably across re-rolls.
//      Same product → same protagonist; different product → likely
//      different age/vibe/setting.
//
// Architecture stays the same — output shape is still ProtagonistProfile.
// Downstream code (buildCharacterProfile + appearanceLock) is untouched.
// ─────────────────────────────────────────────────────────────────────

import type {
  NicheKey, ProtagonistProfile, AgeRangeKey, CulturalWorldKey,
  WardrobeWorldKey, PersonalityVibeKey, HomeSettingKey, FamilyStructureKey,
  LandingLanguage,
} from '../types'

interface ResolveArgs {
  niche?: NicheKey
  /** Output-language → cultural world default. 'ms' = MY, 'vi' = VN. */
  targetLanguage?: LandingLanguage
  /** Any stable string (productId / productName) hashed for sub-variant
   *  selection. Same seed → same protagonist; different seed → likely
   *  different variant. Omit for deterministic default (variant 0). */
  productSeed?: string
}

// ─── Archetype skeletons (gender/age/vibe/setting/family) ─────────────
//
// Each archetype is a "buyer persona" snapshot — who realistically buys
// this niche's products. Wardrobe + cultural world are layered on top
// based on targetLanguage (so the same archetype renders MY-Muslim in
// Malaysia vs VN-urban in Vietnam).

interface ArchetypeSkeleton {
  gender: 'female' | 'male' | 'non-binary'
  ageRange: AgeRangeKey
  personalityVibe: PersonalityVibeKey
  homeSetting: HomeSettingKey
  family: FamilyStructureKey
  /** Brief tag for telemetry / logs. */
  label: string
}

// 9 archetypes covering the 22 niches. Multiple niches share an archetype
// when their buyer profile is similar (e.g. cardiovascular + diabetes +
// joint = older suburban health-concern adult).

const ARCHETYPE_OLDER_FEMALE_HEALTH: ArchetypeSkeleton[] = [
  { gender: 'female', ageRange: '45-55', personalityVibe: 'warm-maternal',     homeSetting: 'suburban-house',  family: 'with-children',      label: 'older-female-suburban-mom' },
  { gender: 'female', ageRange: '55+',   personalityVibe: 'soft-spoken-caring',homeSetting: 'family-compound', family: 'multigenerational',  label: 'senior-female-multigen' },
]

const ARCHETYPE_OLDER_MALE_HEALTH: ArchetypeSkeleton[] = [
  { gender: 'male',   ageRange: '45-55', personalityVibe: 'reserved-thoughtful', homeSetting: 'suburban-house', family: 'partnered',          label: 'older-male-suburban' },
  { gender: 'male',   ageRange: '55+',   personalityVibe: 'practical-direct',    homeSetting: 'family-compound',family: 'multigenerational',  label: 'senior-male-multigen' },
]

const ARCHETYPE_MID_MATURE: ArchetypeSkeleton[] = [
  { gender: 'female', ageRange: '35-45', personalityVibe: 'reserved-thoughtful', homeSetting: 'suburban-house', family: 'with-children',     label: 'mid-mature-female-suburban' },
  { gender: 'male',   ageRange: '35-45', personalityVibe: 'practical-direct',    homeSetting: 'urban-apartment',family: 'partnered',          label: 'mid-mature-male-urban' },
]

const ARCHETYPE_YOUNG_URBAN_FEMALE: ArchetypeSkeleton[] = [
  { gender: 'female', ageRange: '25-35', personalityVibe: 'soft-spoken-caring',  homeSetting: 'urban-apartment',family: 'single',             label: 'young-urban-female-single' },
  { gender: 'female', ageRange: '25-35', personalityVibe: 'gentle-introvert',    homeSetting: 'urban-apartment',family: 'partnered',          label: 'young-urban-female-partnered' },
  { gender: 'female', ageRange: '35-45', personalityVibe: 'soft-spoken-caring',  homeSetting: 'urban-apartment',family: 'with-children',      label: 'mid-urban-female-mom' },
]

const ARCHETYPE_YOUNG_MOM: ArchetypeSkeleton[] = [
  { gender: 'female', ageRange: '25-35', personalityVibe: 'warm-maternal',       homeSetting: 'urban-apartment',family: 'with-children',      label: 'young-mom-urban' },
  { gender: 'female', ageRange: '25-35', personalityVibe: 'warm-maternal',       homeSetting: 'suburban-house', family: 'with-children',      label: 'young-mom-suburban' },
]

const ARCHETYPE_BURNOUT_WORKER: ArchetypeSkeleton[] = [
  { gender: 'female', ageRange: '25-35', personalityVibe: 'gentle-introvert',    homeSetting: 'urban-apartment',family: 'single',             label: 'burnout-female-urban' },
  { gender: 'male',   ageRange: '25-35', personalityVibe: 'reserved-thoughtful', homeSetting: 'urban-apartment',family: 'partnered',          label: 'burnout-male-urban' },
  { gender: 'female', ageRange: '35-45', personalityVibe: 'reserved-thoughtful', homeSetting: 'urban-apartment',family: 'with-children',      label: 'burnout-female-mom-urban' },
]

const ARCHETYPE_MENOPAUSE: ArchetypeSkeleton[] = [
  { gender: 'female', ageRange: '45-55', personalityVibe: 'warm-maternal',       homeSetting: 'suburban-house', family: 'with-children',      label: 'menopause-female-suburban' },
  { gender: 'female', ageRange: '45-55', personalityVibe: 'reserved-thoughtful', homeSetting: 'urban-apartment',family: 'partnered',          label: 'menopause-female-urban' },
]

const ARCHETYPE_HAIRCARE: ArchetypeSkeleton[] = [
  { gender: 'female', ageRange: '35-45', personalityVibe: 'gentle-introvert',    homeSetting: 'urban-apartment',family: 'partnered',          label: 'haircare-female-mid' },
  { gender: 'male',   ageRange: '35-45', personalityVibe: 'reserved-thoughtful', homeSetting: 'urban-apartment',family: 'partnered',          label: 'haircare-male-mid' },
  { gender: 'female', ageRange: '45-55', personalityVibe: 'soft-spoken-caring',  homeSetting: 'suburban-house', family: 'with-children',      label: 'haircare-female-mature' },
]

const ARCHETYPE_RELATIONSHIP_WELLNESS: ArchetypeSkeleton[] = [
  { gender: 'female', ageRange: '25-35', personalityVibe: 'gentle-introvert',    homeSetting: 'urban-apartment',family: 'partnered',          label: 'wellness-female-young' },
  { gender: 'male',   ageRange: '25-35', personalityVibe: 'practical-direct',    homeSetting: 'urban-apartment',family: 'partnered',          label: 'wellness-male-young' },
  { gender: 'female', ageRange: '35-45', personalityVibe: 'reserved-thoughtful', homeSetting: 'suburban-house', family: 'with-children',      label: 'wellness-female-mid' },
]

// ─── Niche → archetype pool mapping ───────────────────────────────────

const NICHE_ARCHETYPE_POOL: Record<NicheKey, ArchetypeSkeleton[]> = {
  // Older health-concern adults (joint, BP, sugar, eye, prostate)
  'health-joint':              ARCHETYPE_OLDER_FEMALE_HEALTH,
  'health-cardiovascular':     ARCHETYPE_OLDER_FEMALE_HEALTH,
  'diabetes-blood-sugar':      ARCHETYPE_OLDER_FEMALE_HEALTH,
  'eye-vision-care':           ARCHETYPE_MID_MATURE,
  'prostate-urology':          ARCHETYPE_OLDER_MALE_HEALTH,

  // Mid-mature internal health (respiratory, digestive, liver, hemorrhoids)
  'health-respiratory':        ARCHETYPE_MID_MATURE,
  'health-digestive':          ARCHETYPE_MID_MATURE,
  'liver-detox':               ARCHETYPE_MID_MATURE,
  'hemorrhoids-digestive-shame': ARCHETYPE_MID_MATURE,
  'health-functional':         ARCHETYPE_MID_MATURE,    // generic fallback for kitchen-sink niche

  // Beauty / skincare / anti-aging
  'skincare':                  ARCHETYPE_YOUNG_URBAN_FEMALE,
  'beauty-confidence':         ARCHETYPE_YOUNG_URBAN_FEMALE,
  'anti-aging-longevity':      ARCHETYPE_MID_MATURE,

  // Haircare (unisex)
  'haircare':                  ARCHETYPE_HAIRCARE,

  // Mom-baby
  'mom-baby':                  ARCHETYPE_YOUNG_MOM,

  // Mental + sleep
  'sleep-insomnia':            ARCHETYPE_BURNOUT_WORKER,
  'mental-health':             ARCHETYPE_BURNOUT_WORKER,

  // Women's hormonal
  'menopause':                 ARCHETYPE_MENOPAUSE,

  // Dental (unisex mid-adult)
  'dental-oral-care':          ARCHETYPE_MID_MATURE,

  // Wellness / relationship / fitness / supplement
  'relationship':              ARCHETYPE_RELATIONSHIP_WELLNESS,
  'supplement-wellness':       ARCHETYPE_RELATIONSHIP_WELLNESS,
  'fitness-recovery':          ARCHETYPE_RELATIONSHIP_WELLNESS,
}

// ─── Cultural world by target language ────────────────────────────────
//
// MY default: malay-muslim (hijab always, baju-kurung). Variant: malay-
// secular (urban, hijab never) for younger/urban archetypes — adds
// diversity within MY market without breaking cultural lock.
// VN default: vietnamese-urban (no hijab). Variant: vietnamese-rural
// for senior/multigenerational archetypes.

interface CulturalContext {
  world: CulturalWorldKey
  hijabState: 'always' | 'sometimes' | 'never'
  hairVisible: boolean
  modestyLevel: 'conservative' | 'modern-modest' | 'casual' | 'urban'
  wardrobeWorld: WardrobeWorldKey
}

function pickCulturalContext(
  language: LandingLanguage,
  archetype: ArchetypeSkeleton,
): CulturalContext {
  // Vietnamese branch
  if (language === 'vi') {
    const isYoung = archetype.ageRange === '18-25' || archetype.ageRange === '25-35'
    const isSenior = archetype.ageRange === '55+'
    return {
      world: isSenior ? 'vietnamese-rural' : 'vietnamese-urban',
      hijabState: 'never',
      hairVisible: true,
      modestyLevel: isYoung ? 'urban' : 'modern-modest',
      wardrobeWorld:
        archetype.gender === 'male'      ? 'urban-casual' :
        isSenior                          ? 'ao-dai-casual' :
        archetype.homeSetting === 'urban-apartment' ? 'urban-casual' :
        'ao-dai-casual',
    }
  }

  // English / other → fall through to MY default below
  // Malay branch (MY market default per project memory)
  const isYoungUrban =
    archetype.homeSetting === 'urban-apartment' &&
    (archetype.ageRange === '18-25' || archetype.ageRange === '25-35')
  const isMale = archetype.gender === 'male'

  if (isMale) {
    return {
      world: 'malay-secular',  // males don't wear hijab; secular framing avoids overreach
      hijabState: 'never',
      hairVisible: true,
      modestyLevel: 'modern-modest',
      wardrobeWorld: 'urban-casual',
    }
  }

  if (isYoungUrban) {
    // Young urban MY females: mix of hijab-wearing and not — pick secular for
    // visual variety. Otherwise every MY pack defaults to baju-kurung.
    return {
      world: 'malay-secular',
      hijabState: 'never',
      hairVisible: true,
      modestyLevel: 'modern-modest',
      wardrobeWorld: 'urban-casual',
    }
  }

  // Default MY mature/suburban female: malay-muslim with hijab
  return {
    world: 'malay-muslim',
    hijabState: 'always',
    hairVisible: false,
    modestyLevel: 'modern-modest',
    wardrobeWorld: 'baju-kurung',
  }
}

// ─── Hash util — stable variant selection per product ─────────────────

function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
  }
  return h >>> 0
}

// ─── Public resolver ──────────────────────────────────────────────────

export function resolveProtagonistProfile(args: ResolveArgs = {}): ProtagonistProfile {
  const niche: NicheKey = args.niche ?? 'health-functional'
  const language: LandingLanguage = args.targetLanguage ?? 'ms'

  // Pick archetype pool for this niche
  const pool = NICHE_ARCHETYPE_POOL[niche] ?? ARCHETYPE_MID_MATURE
  // Stable variant selection from product seed (so same product → same person)
  const idx = args.productSeed
    ? hashString(args.productSeed) % pool.length
    : 0
  const archetype = pool[idx]

  // Layer cultural context onto the archetype
  const culture = pickCulturalContext(language, archetype)

  return {
    gender: archetype.gender,
    ageRange: archetype.ageRange,
    cultural: {
      world: culture.world,
      hijabState: culture.hijabState,
      hairVisible: culture.hairVisible,
      modestyLevel: culture.modestyLevel,
    },
    wardrobeWorld: culture.wardrobeWorld,
    personalityVibe: archetype.personalityVibe,
    homeLifestyle: {
      setting: archetype.homeSetting,
      familyStructure: archetype.family,
    },
  }
}
