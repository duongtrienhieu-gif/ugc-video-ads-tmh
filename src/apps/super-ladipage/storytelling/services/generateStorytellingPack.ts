// ═════════════════════════════════════════════════════════════════════
// generateStorytellingPack — P1 RUNTIME (real Gemini)
//
// Replaces P0.5 mock. Pipeline:
//   1. Resolve product + API keys
//   2. resolveStorytellingInput(params) → StorytellingInput
//   3. resolveSectionPlan(input) → SectionPlan[]
//   4. buildProductBrief(product, niche) → 1-line context
//   5. generatePackWithRetry(args) — orchestrate Gemini call + validators
//      + retry + fallback. Max 2 attempts, then downgrade failing sections.
//   6. Assemble LandingPagePack with character profile + meta
//
// Mock fallback: nếu Gemini+KIE đều fail → applyFallback() in
// retryWithFeedback đã handle gracefully. Never throws on validation —
// always returns a usable pack.
//
// Throws on:
//   - product not found
//   - missing API key
//   - hard Gemini+KIE infrastructure failure (both providers down)
//   - JSON parse irrecoverable
// ═════════════════════════════════════════════════════════════════════

import type {
  AllowedOverlayType, CharacterProfile, LandingGenParams, LandingPagePack,
  LandingSection, ProtagonistProfile, SectionId, StorytellingPack,
} from '../types'
import type { SectionType } from '../../types'
import { useBankStore } from '../../../../stores/bankStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { DEFAULT_SECTION_ORDER, SECTION_BLUEPRINTS } from '../config/sectionBlueprints'
import { resolveStorytellingInput } from '../resolvers/resolveStorytellingInput'
import { resolveSectionPlan } from '../resolvers/resolveSectionPlan'
import { buildProductBrief } from '../runtime/buildPackGenPrompt'
import { generatePackWithRetry } from '../runtime/retryWithFeedback'
import type { GeneratedPackResult } from '../runtime/retryWithFeedback'

// ── Map storytelling SectionId → existing UGC SectionType for
//    LandingSection.type compat. Storytelling section ID stored
//    separately trong storytellingMeta.sectionIds. ───────────────────
/** v4.1 — 11 storytelling section IDs → existing UGC SectionType (for
 *  LandingSection.type compat). Storytelling SectionId is stored in
 *  storytellingMeta.sectionIds parallel array. */
const SECTION_TYPE_MAP: Record<SectionId, SectionType> = {
  'hook-interrupt':    'hero',
  'daily-friction':    'pain',
  'internal-fear':     'pain',
  'failed-attempts':   'failed-solutions',
  'belief-shift':      'why-happens',         // AHA reinterpretation
  'soft-reveal':       'product-discovery',
  'micro-reward':      'lifestyle',
  'emotional-payoff':  'lifestyle',
  'reflection-trust':  'lifestyle',
  'trust-continuity':  'social-proof',        // mini testimonials in reviews field
  'soft-cta':          'final-cta',
}

/** Build CharacterProfile từ resolved ProtagonistProfile. P1: name là
 *  placeholder "Nhân vật chính"; Phase 3 (Character Engine) sẽ extract
 *  name từ product/niche hoặc cho Gemini quyết. */
function buildCharacterProfile(p: ProtagonistProfile): CharacterProfile {
  const hijab = p.cultural.hijabState === 'always' ? ', hijab always' :
                p.cultural.hijabState === 'never'  ? '' : ', hijab sometimes'
  return {
    name: 'Nhân vật chính',
    archetype: `${p.gender}, age ${p.ageRange}, ${p.cultural.world}${hijab}, ${p.personalityVibe}`,
    appearanceLock:
      `${p.cultural.world}, age ${p.ageRange}${hijab}, ${p.cultural.modestyLevel} dress, ${p.wardrobeWorld} wardrobe, ${p.personalityVibe} vibe`,
    environmentLock:
      `${p.homeLifestyle.setting} setting, family: ${p.homeLifestyle.familyStructure}`,
    emotionalArc: DEFAULT_SECTION_ORDER.map((sid) => ({
      sectionType: SECTION_TYPE_MAP[sid],
      mood: SECTION_BLUEPRINTS[sid].emotionalBeat,
    })),
  }
}

/** Allocate overlay per section. P1: hardcoded heuristic (chapter @ s1,
 *  diary @ s8). Phase 5 (CTA system) sẽ make overlay allocation niche-aware. */
/** v4.1 — 11 sections. Overlay budget = 2/14 ảnh.
 *  Chapter-marker on hook-interrupt (section 1), diary-timestamp on
 *  micro-reward (section 7) — feels like photo book page break. */
function allocateOverlay(sectionIds: SectionId[]): (AllowedOverlayType | null)[] {
  return sectionIds.map((sid) => {
    if (sid === 'hook-interrupt') return 'chapter-marker'
    if (sid === 'micro-reward')   return 'diary-timestamp'
    return null
  })
}

/** Build summary string from result — for UI debug strip. */
function buildValidationSummary(result: GeneratedPackResult): string {
  const { finalValidation, initialValidation, attempts } = result
  if (finalValidation.pass && attempts === 1) {
    return '✓ all 5 validators passed (clean first try)'
  }
  if (finalValidation.pass && attempts === 2) {
    return `✓ passed after retry (${initialValidation.violations.length} initial violations resolved)`
  }
  const fallbackCount = result.perSectionStatus.filter((s) => s.kind === 'fallback').length
  return `⚠ ${fallbackCount} section(s) downgraded to fallback after ${attempts} attempt(s)`
}

// ═════════════════════════════════════════════════════════════════════
// P1 entry point
// ═════════════════════════════════════════════════════════════════════

export async function generateStorytellingPack(
  params: LandingGenParams,
): Promise<LandingPagePack> {
  // ─── 1. Resolve product + API keys ────────────────────────────────
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) {
    throw new Error(`Không tìm thấy sản phẩm với id="${params.productId}". Vui lòng chọn lại sản phẩm.`)
  }

  const settings = useSettingsStore.getState()
  if (!settings.hasGeminiKey()) {
    throw new Error('Vui lòng nhập Google Gemini API key trong Cài đặt.')
  }
  if (!settings.hasApiKey()) {
    throw new Error('Vui lòng nhập kie.ai API key trong Cài đặt (cần làm fallback khi Gemini quá tải).')
  }
  const geminiApiKey = settings.getGeminiApiKey()
  const kieApiKey    = settings.getApiKey()

  console.info(
    `[storytelling] ═══ START — product="${product.productName}", language=${params.language} ═══`,
  )
  const totalStart = Date.now()

  // ─── 2. Resolve input + section plan ──────────────────────────────
  const input = resolveStorytellingInput(params)
  const plan = resolveSectionPlan(input)
  console.info(
    `[storytelling] resolved input: niche=${input.niche}, pacing=${input.pacingType}, ` +
    `intensity=${input.emotionalIntensity}, productReveal=section ${input.productRevealSection}, ` +
    `sections planned=${plan.length}`,
  )

  // ─── 3. Build product brief ───────────────────────────────────────
  const productBrief = buildProductBrief(product.productName, input.niche, product.painPoints)

  // ─── 4. Generate with retry + fallback ───────────────────────────
  const result = await generatePackWithRetry({
    input,
    plan,
    productBrief,
    geminiApiKey,
    kieApiKey,
  })

  const elapsedSec = ((Date.now() - totalStart) / 1000).toFixed(1)
  console.info(
    `[storytelling] ═══ DONE in ${elapsedSec}s — attempts=${result.attempts}, ` +
    `final=${result.finalValidation.pass ? 'PASS' : 'FALLBACK'} ═══`,
  )

  // ─── 5. Assemble LandingSection[] ────────────────────────────────
  const sections: LandingSection[] = result.sections.map((s) => {
    const blueprint = SECTION_BLUEPRINTS[s.id]
    // v4.5 — Trust-continuity section: map parsed reviews → LandingSection.reviews
    // (uses existing UGC LandingSection.reviews field — no schema pollution)
    const reviews = s.reviews?.map((r) => ({
      author: r.author ?? 'Một bạn đọc',
      quote:  r.quote,
      meta:   r.meta,
    }))
    return {
      type:        SECTION_TYPE_MAP[s.id],
      title:       s.title,
      titleVi:     s.title,  // copy is already Vietnamese
      copy:        s.copy,
      layoutGuide: blueprint.pacingPurpose,
      imagePrompts: [],  // image gen = Phase 4
      reviews,             // v4.5 — undefined for non-trust-continuity sections
    }
  })

  // ─── 6. Build character profile + overlay allocation ─────────────
  const characterProfile = buildCharacterProfile(input.protagonistProfile)
  const sectionIds = result.sections.map((s) => s.id)
  const overlayPerSection = allocateOverlay(sectionIds)

  // ─── 7. Assemble StorytellingPack ────────────────────────────────
  const pack: StorytellingPack = {
    productId:   params.productId,
    productName: product.productName,
    language:    params.language,
    form:        'advertorial',
    sections,
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
    characterProfile,
    storytellingMeta: {
      emotionalIntensity:   input.emotionalIntensity,
      pacingType:           input.pacingType,
      productRevealSection: input.productRevealSection,
      niche:                input.niche,
      overlayBudgetUsed:    overlayPerSection.filter((o) => o !== null).length,
      sectionIds,
      overlayPerSection,
      sectionStatus:        result.perSectionStatus,
      attempts:             result.attempts,
      validationSummary:    buildValidationSummary(result),
    },
  }

  return pack
}
