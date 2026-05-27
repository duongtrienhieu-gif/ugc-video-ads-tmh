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
  AllowedOverlayType, BlockId, CharacterProfile, LandingGenParams, LandingPagePack,
  LandingSection, ProtagonistProfile, StorytellingPack,
} from '../types'
import type { SectionType } from '../../types'
import { useBankStore } from '../../../../stores/bankStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { resolveStorytellingInput } from '../resolvers/resolveStorytellingInput'
import { resolveBlockPlan } from '../resolvers/resolveBlockPlan'
import { buildProductBrief } from '../runtime/buildPackGenPrompt'
import { generatePackWithRetry } from '../runtime/retryWithFeedback'
import type { GeneratedPackResult } from '../runtime/retryWithFeedback'
import { selectNarratorDna } from '../runtime/selectNarratorDna'
import { composeMobilePage } from '../../composer'
import { deriveRenderContractedPage } from '../../renderContract'
import { deriveVisualSemanticsPage } from '../../visualSemantics'
import { deriveImageIntentPage } from '../../imageSemantics'
import { translateImageIntentPage } from '../../promptTranslation'

// ── Map storytelling BlockId → existing UGC SectionType for
//    LandingSection.type compat. Storytelling block ID stored
//    separately trong storytellingMeta.sectionIds. ───────────────────
const BLOCK_TYPE_MAP: Record<BlockId, SectionType> = {
  // Phase 1 — RECOGNITION
  'self-recognition-hook':     'hero',
  'daily-micro-friction':      'pain',
  'hidden-emotional-truth':    'pain',
  'not-alone-bridge':          'pain',
  'proof-recognition':         'social-proof',        // P2 — distributed proof
  // Phase 2 — TRUST + RESISTANCE ALIGNMENT
  'narrator-validation-entry': 'pain',
  'shared-failed-attempts':    'failed-solutions',
  'skepticism-alignment':      'failed-solutions',
  'belief-shift':              'why-happens',         // AHA reinterpretation
  // Phase 3 — SOLUTION OPENING
  'natural-product-discovery': 'product-discovery',
  'why-this-felt-different':   'product-discovery',
  'proof-solution':            'social-proof',        // P2 — distributed proof
  'soft-mechanism-compare':    'product-discovery',
  // Phase 4 — FUTURE SELF IMMERSION
  'micro-transformation':      'lifestyle',
  'emotional-wins':            'lifestyle',
  'proof-future-self':         'social-proof',        // P2 — distributed proof
  'future-self-cta':           'final-cta',
}

/** Block → emotional arc mood (for UGC CharacterProfile.emotionalArc).
 *  String free-form per parent CharacterProfile.emotionalArc.mood: string. */
const BLOCK_EMOTIONAL_MOOD: Record<BlockId, string> = {
  'self-recognition-hook':     'calm-curious',
  'daily-micro-friction':      'subtle-unease',
  'hidden-emotional-truth':    'recurring-discomfort',
  'not-alone-bridge':          'quiet-relief',
  'proof-recognition':         'shared-relief',
  'narrator-validation-entry': 'companion-warmth',
  'shared-failed-attempts':    'frustration',
  'skepticism-alignment':      'guarded-curiosity',
  'belief-shift':              'quiet-reflection',
  'natural-product-discovery': 'tentative',
  'why-this-felt-different':   'hesitant-curiosity',
  'proof-solution':            'reduced-skepticism',
  'soft-mechanism-compare':    'quiet-reflection',
  'micro-transformation':      'first-hope',
  'emotional-wins':            'acceptance-joy',
  'proof-future-self':         'transformation-witness',
  'future-self-cta':           'settled-resolve',
}

/** Build CharacterProfile từ resolved ProtagonistProfile + actual blockIds
 *  ordered by plan. Emotional arc length matches pack's block count (13-15). */
function buildCharacterProfile(p: ProtagonistProfile, blockIds: BlockId[]): CharacterProfile {
  const hijab = p.cultural.hijabState === 'always' ? ', hijab always' :
                p.cultural.hijabState === 'never'  ? '' : ', hijab sometimes'
  return {
    name: 'Nhân vật chính',
    archetype: `${p.gender}, age ${p.ageRange}, ${p.cultural.world}${hijab}, ${p.personalityVibe}`,
    appearanceLock:
      `${p.cultural.world}, age ${p.ageRange}${hijab}, ${p.cultural.modestyLevel} dress, ${p.wardrobeWorld} wardrobe, ${p.personalityVibe} vibe`,
    environmentLock:
      `${p.homeLifestyle.setting} setting, family: ${p.homeLifestyle.familyStructure}`,
    emotionalArc: blockIds.map((id) => ({
      sectionType: BLOCK_TYPE_MAP[id],
      mood: BLOCK_EMOTIONAL_MOOD[id],
    })),
  }
}

/** Allocate overlay per block. Chapter-marker on Phase-1 first block only.
 *  Chunk E (visual rebuild) will expand to phase-aware overlay budget. */
function allocateOverlay(blockIds: BlockId[]): (AllowedOverlayType | null)[] {
  return blockIds.map((id, idx) => {
    if (idx === 0 && id === 'self-recognition-hook') return 'chapter-marker'
    if (id === 'micro-transformation') return 'diary-timestamp'
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

  // ─── 2. Resolve input + block plan ────────────────────────────────
  const input = resolveStorytellingInput(params)
  const plan = resolveBlockPlan(input)
  console.info(
    `[storytelling] resolved input: niche=${input.niche}, pacing=${input.pacingType}, ` +
    `intensity=${input.emotionalIntensity}, productReveal=section ${input.productRevealSection}, ` +
    `blocks planned=${plan.length}`,
  )

  // ─── 3. Build product brief ───────────────────────────────────────
  const productBrief = buildProductBrief(product.productName, input.niche, product.painPoints)

  // ─── 3.5 v5.1 — Select narrator/DNA/curve (human variation engine) ──
  const selection = selectNarratorDna({
    niche: input.niche,
    productId: input.productId,
    seed: input.randomSeed,
  })

  // ─── 4. Generate with retry + fallback ───────────────────────────
  const result = await generatePackWithRetry({
    input,
    plan,
    productBrief,
    geminiApiKey,
    kieApiKey,
    selection,
  })

  const elapsedSec = ((Date.now() - totalStart) / 1000).toFixed(1)
  console.info(
    `[storytelling] ═══ DONE in ${elapsedSec}s — attempts=${result.attempts}, ` +
    `final=${result.finalValidation.pass ? 'PASS' : 'FALLBACK'} ═══`,
  )

  // ─── 5. Assemble LandingSection[] ────────────────────────────────
  const sections: LandingSection[] = result.sections.map((s) => {
    // social-proof block: map parsed reviews → LandingSection.reviews
    // (uses existing UGC LandingSection.reviews field — no schema pollution)
    const reviews = s.reviews?.map((r) => ({
      author: r.author ?? 'Một bạn đọc',
      quote:  r.quote,
      meta:   r.meta,
    }))
    return {
      type:        BLOCK_TYPE_MAP[s.id],
      title:       s.title,
      titleVi:     s.title,  // copy is already Vietnamese
      copy:        s.copy,
      layoutGuide: '',       // Chunk E (visual rebuild) will repopulate
      imagePrompts: [],      // image gen = Chunk E
      reviews,
    }
  })

  // ─── 6. Build character profile + overlay allocation ─────────────
  const blockIds = result.sections.map((s) => s.id)
  const characterProfile = buildCharacterProfile(input.protagonistProfile, blockIds)
  const overlayPerSection = allocateOverlay(blockIds)

  // ─── 6.5 P4 — Compose mobile page (headless translation layer) ──
  const composedPage = composeMobilePage({
    packSections: result.sections,
    hasCtaFlow: true,  // CTA flow always sampled (P3)
  })
  console.info(
    `[storytelling] composer: ${composedPage.sourcePackBlockCount} blocks → ` +
    `${composedPage.totalSections} mobile sections, ` +
    `${composedPage.totalWordCount} words, ~${composedPage.estimatedScrollTimeSec}s scroll`,
  )
  if (composedPage.fatigueWarnings.length > 0) {
    console.warn(`[storytelling/composer] ${composedPage.fatigueWarnings.length} fatigue warning(s):`)
    for (const w of composedPage.fatigueWarnings) {
      console.warn(`  ⚠ ${w}`)
    }
  }

  // ─── 6.6 P5 — Derive render contracts (mobile rendering intelligence) ──
  const renderContractedPage = deriveRenderContractedPage(composedPage)
  if (renderContractedPage.consistencyWarnings.length > 0) {
    console.warn(`[storytelling/renderContract] ${renderContractedPage.consistencyWarnings.length} consistency warning(s):`)
    for (const w of renderContractedPage.consistencyWarnings) {
      console.warn(`  ⚠ ${w}`)
    }
  }

  // ─── 6.7 P6 — Derive visual semantics (visual psychology layer) ──────
  const visualSemanticsPage = deriveVisualSemanticsPage(renderContractedPage)
  if (visualSemanticsPage.semanticsWarnings.length > 0) {
    console.warn(`[storytelling/visualSemantics] ${visualSemanticsPage.semanticsWarnings.length} semantics warning(s):`)
    for (const w of visualSemanticsPage.semanticsWarnings) {
      console.warn(`  ⚠ ${w}`)
    }
  }

  // ─── 6.8 P9 — Derive image intent (image orchestration governance) ───
  // Pure declarative derivation. NO prompts, NO AI, NO image generation.
  // Future P10+ phases consume imageIntent to build prompts.
  const imageIntentPage = deriveImageIntentPage(visualSemanticsPage)
  if (imageIntentPage.imageIntentWarnings.length > 0) {
    console.warn(`[storytelling/imageSemantics] ${imageIntentPage.imageIntentWarnings.length} image intent warning(s):`)
    for (const w of imageIntentPage.imageIntentWarnings) {
      console.warn(`  ⚠ ${w}`)
    }
  }
  console.log(
    `[storytelling/imageSemantics] ${imageIntentPage.imageBearingSectionCount}/${imageIntentPage.totalSections} sections received imageIntent`,
  )

  // ─── 6.9 P10 — Translate image intent → prompt fragment contract ──
  // Pure deterministic translator. NO prompt engineering, NO model syntax.
  // Fragment system: 6 buckets per section, renderer-agnostic.
  const imagePromptPage = translateImageIntentPage(imageIntentPage)
  if (imagePromptPage.promptContractWarnings.length > 0) {
    console.warn(`[storytelling/promptTranslation] ${imagePromptPage.promptContractWarnings.length} contract warning(s):`)
    for (const w of imagePromptPage.promptContractWarnings) {
      console.warn(`  ⚠ ${w}`)
    }
  }
  console.log(
    `[storytelling/promptTranslation] ${imagePromptPage.promptBearingSectionCount}/${imagePromptPage.totalSections} sections received imagePromptContract`,
  )

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
      sectionIds:           blockIds,
      overlayPerSection,
      sectionStatus:        result.perSectionStatus,
      attempts:             result.attempts,
      validationSummary:    buildValidationSummary(result),
      // v5.1 — Human Variation Engine selections
      narratorArchetypeId:  selection.narrator.id,
      energyCurveId:        selection.energyCurve.id,
      randomSeed:           selection.seed,
      // v5.2 — Memory snapshot IDs sampled for this pack
      memorySnapshotIds:    selection.memorySnapshots.map((s) => s.id),
      // v5.3 — Hook + Discovery variation
      hookAxisId:           selection.hookAxis,
      discoveryChannelId:   selection.discoveryChannel,
      // P10 — Image prompt page (composer + renderContract + visualSemantics +
      // imageIntent + prompt fragment translation). ImagePromptPage IS-A
      // ImageIntentPage IS-A VisualSemanticsPage — all upstream consumers
      // continue to work via subtype assignability.
      imagePromptPage,
    },
  }

  return pack
}
