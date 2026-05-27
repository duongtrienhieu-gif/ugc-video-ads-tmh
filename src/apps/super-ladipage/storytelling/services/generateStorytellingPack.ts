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
import { detectNiche } from '../resolvers/detectNiche'
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
import { adaptRenderContractedPage } from '../../rendererAdapters'
import { planImageGenerationPage } from '../../generationOrchestration'
import { validateOrchestratedPage } from '../../validationCalibration'
import { deriveExportPipelinePage } from '../../exportPipeline'
import { translatePackToVi } from '../../services/translate'

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
  // FIX (2026-05-27): detect niche from product BEFORE resolving input.
  // Previously niche defaulted to 'skincare' → nasal spray products were
  // mislabeled, story arc generated wrong-niche framing (face/skin
  // vocabulary for sinus products).
  // FIX v2 — also pass product.benefits (previously missing → "boost
  // confidence to walk again" in benefits falsely triggered beauty-
  // confidence niche for knee/joint products).
  const nicheDetection = detectNiche({
    productName: product.productName,
    painPoints: product.painPoints,
    benefits: (product as { benefits?: string }).benefits,
  })
  console.info(
    `[storytelling] niche detection: ${nicheDetection.niche} (confidence=${nicheDetection.confidence}, ` +
    `matched=[${nicheDetection.matchedKeywords.join(', ')}])`,
  )
  const input = resolveStorytellingInput(params, nicheDetection.niche)
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

  // ─── 6.10 P11 — Renderer adapters (gptImage / flux / sdxl) ────────
  // Pure SYNTAX translation per renderer. Psychology preserved across
  // all 3 outputs. NO Midjourney. NO semantic re-interpretation.
  const rendererAdaptedPage = adaptRenderContractedPage(imagePromptPage)
  if (rendererAdaptedPage.rendererAdapterWarnings.length > 0) {
    console.warn(`[storytelling/rendererAdapters] ${rendererAdaptedPage.rendererAdapterWarnings.length} adapter warning(s):`)
    for (const w of rendererAdaptedPage.rendererAdapterWarnings) {
      console.warn(`  ⚠ ${w}`)
    }
  }
  console.log(
    `[storytelling/rendererAdapters] ${rendererAdaptedPage.adaptedSectionCount}/${rendererAdaptedPage.totalSections} sections received rendererOutputs`,
  )

  // ─── 6.11 P12 — Plan image generation orchestration ───────────────
  // Sync deterministic plan: routing + reference selection + retry policy
  // per section. NO API calls. NO auto-execution. References default empty
  // — consumer re-plans when user uploads packaging/logo/product refs.
  const orchestratedPage = planImageGenerationPage(rendererAdaptedPage, [])
  if (orchestratedPage.orchestrationWarnings.length > 0) {
    console.warn(`[storytelling/orchestration] ${orchestratedPage.orchestrationWarnings.length} orchestration warning(s):`)
    for (const w of orchestratedPage.orchestrationWarnings) {
      console.warn(`  ⚠ ${w}`)
    }
  }
  console.log(
    `[storytelling/orchestration] ${orchestratedPage.generationPlanCount}/${orchestratedPage.totalSections} sections planned for image generation`,
  )

  // ─── 6.12 P13 — Validation + calibration loop ────────────────────
  // Soft governance: 6 detectors + per-section calibration + advisory
  // knob recommendations. NO mutation, NO redesign, NO AI taste engine.
  const validatedPage = validateOrchestratedPage(orchestratedPage)
  if (validatedPage.validationReport.warnings.length > 0) {
    console.warn(`[storytelling/validation] ${validatedPage.validationReport.warnings.length} validation warning(s):`)
    for (const w of validatedPage.validationReport.warnings) {
      console.warn(`  ⚠ [${w.severity}][${w.category}] ${w.message}`)
    }
  }
  if (validatedPage.validationReport.recommendedKnobAdjustments.length > 0) {
    console.log(`[storytelling/validation] ${validatedPage.validationReport.recommendedKnobAdjustments.length} advisory knob recommendation(s):`)
    for (const rec of validatedPage.validationReport.recommendedKnobAdjustments) {
      console.log(`  ↳ ${rec.knob} ${rec.direction > 0 ? '+' : ''}${rec.direction} — ${rec.reason}`)
    }
  }

  // ─── 6.13 P14 — Derive ExportGuide per section (productization) ───
  // Pure declarative derivation. NO HTML auto-generation, NO publishing.
  // Output is design-intent metadata that marketers consume during
  // Ladipage assembly via the Export view + serializers.
  const exportablePage = deriveExportPipelinePage(validatedPage)
  console.log(
    `[storytelling/export] Export pipeline ready · ${exportablePage.sections.length} sections with ExportGuide`,
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
      // P14 — Exportable page (composer + renderContract + visualSemantics +
      // imageIntent + prompt fragments + renderer adapters + orchestration +
      // validation/calibration + ExportGuide per section). Full subtype chain:
      // ExportablePage IS-A ValidatedPage IS-A OrchestratedPage IS-A
      // RendererAdaptedPage IS-A ImagePromptPage IS-A ImageIntentPage IS-A
      // VisualSemanticsPage.
      exportablePage,
    },
  }

  // ─── 8. FIX 2026-05-27 — Auto-translate to VN when target !== vi ─
  // Marketer working on MY/EN packs wants VN translation alongside
  // for QA + paste-into-VN-Ladipage workflow. translatePackToVi adds
  // viTranslation / titleVi / headlineVi / etc to each section in-place.
  if (params.language !== 'vi') {
    try {
      const settings = useSettingsStore.getState()
      const translated = await translatePackToVi({
        apiKey:        settings.geminiApiKey,
        kieApiKey:     settings.kieApiKey,
        pack,
        fromLanguage:  params.language,
      })
      // Replace pack.sections with translated versions
      pack.sections = translated.sections
      console.log(`[storytelling/translate] Bản dịch VN sẵn sàng cho ${pack.sections.length} sections`)
    } catch (err) {
      console.warn(`[storytelling/translate] Dịch VN thất bại — pack vẫn ship native-only:`, err)
      // Non-fatal — pack ships without VN translation, UI gracefully hides
      // the VN box per section
    }
  } else {
    console.log(`[storytelling/translate] language='vi' — không cần dịch`)
  }

  console.log(`[storytelling] ═══ DONE in ${Math.round((Date.now() - totalStart) / 1000)}s ═══`)
  return pack
}
