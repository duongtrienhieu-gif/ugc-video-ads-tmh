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
import {
  classifyProductReality,
  buildRealityBrief,
  PACING_OVERRIDES,
} from '../../productClass'
import { readProductImages } from '../../productVision'
import { synthesizeProductBrief, buildSynthesizedBrief, synthesizeCommercialPsychology } from '../../productSynthesis'
import type { SynthesizedCommercialPsychology } from '../../productSynthesis'
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
import { composePIBlocks, interleaveIntoPack } from '../../productInfoLayer'
import { synthesizePageScenes } from '../../imageSceneSynthesis'
import type { SceneDescription } from '../../imageSceneSynthesis'
// REBUILD Sprint 1 (2026-05-28) — Pre-write brainstorm stage.
// Reads productSynthesis + commercialPsychology + raw input, picks hook
// angle, drafts the opening, lists agitate beats. Output is threaded
// into the storytelling system prompt so Gemini stops defaulting to
// "soft diary nostalgia" for every niche.
import { synthesizePackBrainstorm } from '../../packBrainstorm'
import type { PackBrainstorm } from '../../packBrainstorm'
// REBUILD Sprint 2 (2026-05-28) — Narrative mode detector + filter.
import { detectNarrativeMode, getSkippedBlocksForMode } from '../../narrativeMode'
import type { NarrativeMode } from '../../narrativeMode'

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
  // FIX v3 (2026-05-27) — Gemini classifier (Option A). Reads full
  // product context (name + painPoints + benefits) and classifies to
  // ONE of 8 NicheKey values. Same downstream pipeline (niche-keyed
  // pools unchanged). Falls back to regex if Gemini fails.
  const settingsForNiche = useSettingsStore.getState()
  const nicheDetection = await detectNiche(
    {
      productName: product.productName,
      painPoints: product.painPoints,
      benefits: (product as { benefits?: string }).benefits,
    },
    {
      geminiApiKey: settingsForNiche.geminiApiKey,
      kieApiKey: settingsForNiche.kieApiKey,
    },
  )
  console.info(
    `[storytelling] niche detection: ${nicheDetection.niche} ` +
    `(source=${nicheDetection.source}, confidence=${nicheDetection.confidence}, ` +
    `matched=[${nicheDetection.matchedKeywords.join(', ')}])`,
  )
  // ─── 2.5 P-PRODUCT-CLASS (2026-05-27) — Product reality classifier ──
  // Classifies product into 7-axis ProductRealityModel.
  // Solves: knee brace vs glucosamine pill — both health-functional niche
  // but completely different storytelling needs (form/pacing/discovery).
  const productReality = await classifyProductReality(
    {
      productName: product.productName,
      painPoints: product.painPoints,
      benefits: (product as { benefits?: string }).benefits,
      uniqueSellingPoints: (product as { usp?: string; uniqueSellingPoints?: string }).usp
        ?? (product as { usp?: string; uniqueSellingPoints?: string }).uniqueSellingPoints,
      offerPricing: (product as { offerPricing?: string; pricing?: string }).offerPricing
        ?? (product as { offerPricing?: string; pricing?: string }).pricing,
    },
    {
      geminiApiKey: settingsForNiche.geminiApiKey,
      kieApiKey: settingsForNiche.kieApiKey,
    },
  )
  console.info(
    `[storytelling] product reality: form=${productReality.productForm}, ` +
    `mechanism=${productReality.mechanismFamily}, ` +
    `pacing=${productReality.pacingProfile}, ` +
    `discovery=${productReality.discoveryContext}, ` +
    `source=${productReality.source}` +
    (productReality.rationale ? ` // ${productReality.rationale.slice(0, 80)}` : ''),
  )

  // ─── Resolve input WITH pacing override from product reality ──────
  const pacingOverride = PACING_OVERRIDES[productReality.pacingProfile]
  const input = resolveStorytellingInput(params, nicheDetection.niche, pacingOverride)
  // NOTE: plan is RE-resolved AFTER brainstorm so the chosen narrative mode
  // can cull filler blocks. This first call captures the niche-default
  // outline for logging only.
  let plan = resolveBlockPlan(input)
  console.info(
    `[storytelling] resolved input: niche=${input.niche}, pacing=${input.pacingType}, ` +
    `intensity=${input.emotionalIntensity}, productReveal=section ${input.productRevealSection}, ` +
    `blocks planned (niche-default)=${plan.length} (pacing override: ${pacingOverride.rationale})`,
  )

  // ─── 2.7 P-VISION (2026-05-27) — Read product images via Gemini Vision ──
  // CRITICAL: input.visualMemory contains user-uploaded packaging/label/
  // product images. Reading them solves:
  //   1. Storytelling drift (knew product visually, no wrong-niche bleed)
  //   2. Image generation accuracy (product identity preserved in CTA images)
  const visionReality = await readProductImages(
    {
      visualMemory: params.visualMemory ?? [],
      productName: product.productName,
      productPainPoints: product.painPoints,
    },
    { geminiApiKey: settingsForNiche.geminiApiKey },
  )
  console.info(
    `[storytelling] vision: ${visionReality.source}, images=${visionReality.imageCount}, ` +
    `form="${visionReality.formFactor.slice(0, 60)}", ` +
    `brand="${visionReality.brandTone.slice(0, 40)}"` +
    (visionReality.inconsistencyFlags.length > 0
      ? ` // ⚠ inconsistencies: ${visionReality.inconsistencyFlags.join('; ')}`
      : ''),
  )

  // ─── 2.8 P-SYNTHESIS (2026-05-27) — Deep product brief synthesis ─
  // Single Gemini deep-call combining ALL upstream: text + vision +
  // niche + reality. Output: SynthesizedProductBrief = tight 3-5 line
  // product reality with forbiddenDriftSymptoms (anti-drift guardrail).
  const synthesizedBrief = await synthesizeProductBrief(
    {
      productName: product.productName,
      productPainPoints: product.painPoints,
      productBenefits: (product as { benefits?: string }).benefits,
      productUsp: (product as { usp?: string; uniqueSellingPoints?: string }).usp
        ?? (product as { usp?: string; uniqueSellingPoints?: string }).uniqueSellingPoints,
      productPricing: (product as { offerPricing?: string; pricing?: string }).offerPricing
        ?? (product as { offerPricing?: string; pricing?: string }).pricing,
      visionReality,
      niche: nicheDetection.niche,
      productReality,
      targetLanguage: params.language,
    },
    {
      geminiApiKey: settingsForNiche.geminiApiKey,
      kieApiKey: settingsForNiche.kieApiKey,
    },
  )
  console.info(
    `[storytelling] synthesized brief: ${synthesizedBrief.source}, ` +
    `essence_length=${synthesizedBrief.productEssence.length}, ` +
    `reader_symptoms=${synthesizedBrief.readerSpecificSymptoms.length}, ` +
    `forbidden_drift=${synthesizedBrief.forbiddenDriftSymptoms.length}` +
    (synthesizedBrief.rationale ? ` // ${synthesizedBrief.rationale.slice(0, 80)}` : ''),
  )

  // ─── 3. Build product brief ───────────────────────────────────────
  // Brief composition (PRIMARY → SECONDARY context order):
  //   1. synthesizedBriefText (PRIMARY — tight product reality + drift guardrails)
  //   2. realityBrief (mechanism description + library defaults)
  //   3. legacy productBrief (niche-level summary)
  const synthesizedBriefText = buildSynthesizedBrief(synthesizedBrief)
  const productBrief = buildProductBrief(product.productName, input.niche, product.painPoints)
  const realityBrief = buildRealityBrief(productReality)

  // ─── 3.4 CP-SYNTHESIS (2026-05-28) — Commercial psychology synthesis ──
  // Hybrid layered synthesis (Hướng B): derive product-specific commercial
  // psychology (desire / CTA / objections / proof voice / mechanism vocab)
  // that OVERRIDES niche-table defaults when present. Same pattern as
  // SPEC.1 (synthesis symptoms override niche pool). Works for any product
  // including those outside 22 known niches.
  let commercialPsychology: SynthesizedCommercialPsychology | undefined = undefined
  try {
    commercialPsychology = await synthesizeCommercialPsychology(
      {
        productName: product.productName,
        productPainPoints: product.painPoints,
        productBenefits:   product.benefits,
        productUsp:        product.usps,
        productPricing:    product.offer,
        niche: input.niche,
        productEssence: synthesizedBrief.productEssence,
        readerSpecificSymptoms: synthesizedBrief.readerSpecificSymptoms,
        usageScene: synthesizedBrief.usageScene,
        realisticFailedAttempts: synthesizedBrief.realisticFailedAttempts,
        targetLanguage: params.language,
      },
      {
        geminiApiKey: settingsForNiche.geminiApiKey,
        kieApiKey: settingsForNiche.kieApiKey,
      },
    )
    console.info(
      `[storytelling] commercial psychology: ${commercialPsychology.source}, ` +
      `desire=${commercialPsychology.primaryDesire.length}c, ` +
      `objections=${commercialPsychology.topObjections.length}, ` +
      `vocab_hints=${commercialPsychology.mechanismVocabHints.length}` +
      (commercialPsychology.rationale ? ` // ${commercialPsychology.rationale.slice(0, 80)}` : ''),
    )
  } catch (err) {
    console.warn(`[storytelling] Commercial psychology synthesis failed — pack uses niche-baseline only:`, err)
  }

  // ─── 3.45 REBUILD Sprint 1 (2026-05-28) — Pre-write brainstorm ───
  // Runs AFTER productSynthesis + commercialPsychology because it needs
  // both as inputs. Runs BEFORE generatePackWithRetry because its output
  // is threaded into the storytelling system prompt as a HARD ANCHOR for
  // Block 1 hook + Phase 1-2 agitate beats. Without this stage Gemini
  // kept defaulting to "soft diary nostalgia recall" for every niche
  // regardless of input — the universal lan-man bug across all packs.
  let packBrainstorm: PackBrainstorm | undefined = undefined
  try {
    const brainstormStart = Date.now()
    packBrainstorm = await synthesizePackBrainstorm(
      {
        productName: product.productName,
        niche: input.niche,
        productEssence: synthesizedBrief.productEssence,
        readerSpecificSymptoms: synthesizedBrief.readerSpecificSymptoms,
        realisticFailedAttempts: synthesizedBrief.realisticFailedAttempts,
        usageScene: synthesizedBrief.usageScene,
        primaryDesire: commercialPsychology?.primaryDesire,
        desireTensions: commercialPsychology?.desireTensions,
        topObjections: commercialPsychology?.topObjections,
        rawPainPoints: product.painPoints ?? '',
        rawBenefits: product.benefits ?? '',
        rawUsp: product.usps ?? '',
        rawPricing: product.offer ?? '',
        targetLanguage: params.language,
      },
      { geminiApiKey, kieApiKey },
    )
    console.info(
      `[storytelling/brainstorm] ${packBrainstorm.source} · angle=${packBrainstorm.chosenAngle} · ` +
      `pains=${packBrainstorm.painLadder.length} · beats=${packBrainstorm.agitateBeats.length} · ` +
      `personas=${packBrainstorm.socialProofPersonas.length} in ${((Date.now() - brainstormStart) / 1000).toFixed(1)}s` +
      (packBrainstorm.rationale ? ` // ${packBrainstorm.rationale.slice(0, 80)}` : ''),
    )
  } catch (err) {
    console.warn('[storytelling/brainstorm] Brainstorm synthesis failed — pack uses niche-baseline only:', err)
  }

  // ─── 3.47 REBUILD Sprint 2 (2026-05-28) — Detect narrative mode ──
  // Uses niche + (optional) brainstorm angle to decide pacing register:
  //   - pain-driven-DR  → dense outline, cut filler chapters
  //   - aspiration-led  → future-vision led, full structure
  //   - recognition-soft → soft diary default, full structure
  // Then re-resolve the block plan honoring the chosen mode's filter list.
  const narrativeModeDecision = detectNarrativeMode({
    niche: input.niche,
    brainstormAngle: packBrainstorm?.chosenAngle,
  })
  const narrativeMode: NarrativeMode = narrativeModeDecision.mode
  const skippedForMode = getSkippedBlocksForMode(narrativeMode)
  const planAfterMode = resolveBlockPlan(input, narrativeMode)
  if (planAfterMode.length !== plan.length) {
    console.info(
      `[storytelling/narrativeMode] mode=${narrativeMode} (${narrativeModeDecision.source}) — ` +
      `re-resolved plan: ${plan.length} → ${planAfterMode.length} blocks ` +
      `(skipped: ${skippedForMode.join(', ') || 'none'})`,
    )
  } else {
    console.info(
      `[storytelling/narrativeMode] mode=${narrativeMode} (${narrativeModeDecision.source}) — ` +
      `plan unchanged at ${plan.length} blocks`,
    )
  }
  plan = planAfterMode

  // ─── 3.5 v5.1 — Select narrator/DNA/curve (human variation engine) ──
  const selection = selectNarratorDna({
    niche: input.niche,
    productId: input.productId,
    seed: input.randomSeed,
  })

  // ─── 4. Generate with retry + fallback ───────────────────────────
  // P-SYNTHESIS (2026-05-27): pass synthesizedBriefText as PRIMARY context.
  // Combined with vision-extracted reality + product class reality, gives
  // Gemini deep accurate product understanding with explicit forbidden-
  // DriftSymptoms guardrail. Solves multi-sub-niche pool pollution
  // (e.g., nasal spray drift to knee/joint).
  const result = await generatePackWithRetry({
    input,
    plan,
    productBrief,
    realityBrief,
    synthesizedBrief: synthesizedBriefText,
    // SPEC-FIX (2026-05-27): pass reader-specific symptoms structurally
    // so nicheDomainLockBrief can REPLACE its generic pool with these.
    // Resolves the two-competing-pools conflict that caused niche drift.
    synthesizedReaderSymptoms: synthesizedBrief.readerSpecificSymptoms,
    // PARADIGM-FIX (2026-05-27): pass full synthesis brief so fallback
    // content adapts to product paradigm (no more supplement hardcode).
    synthesisBriefObj: synthesizedBrief,
    // CP-SYNTHESIS (2026-05-28): commercial psychology synthesis result
    // overrides niche-table defaults in desireBrief / ctaBrief /
    // objectionSampling / textureBrief.
    commercialPsychology,
    // REBUILD Sprint 1 (2026-05-28): pre-write brainstorm — threaded into
    // systemPrompt as a hard anchor for Block 1 + Phase 1-2.
    packBrainstorm,
    // REBUILD Sprint 2 (2026-05-28): narrative mode for per-mode cadence
    // guidance pasted into systemPrompt under the brainstorm anchor.
    narrativeMode,
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
  const storytellingBlockIds = result.sections.map((s) => s.id)
  const characterProfile = buildCharacterProfile(input.protagonistProfile, storytellingBlockIds)
  const overlayPerSection = allocateOverlay(storytellingBlockIds)

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

  // ─── 6.14 PI-LAYER (2026-05-27) — Generate + interleave Product Info ──
  // 5 short knowledge-transmission blocks (mechanism / ingredients-USP /
  // usage-FAQ / social-proof / pricing) in continued diary voice. Interleaved
  // at emotional-arc anchors in the FINAL pack.sections — NOT in the upstream
  // image-gen orchestration pipeline (PI blocks are text-only by default).
  // Skips blocks whose input data isn't supported.
  let finalSections: LandingSection[] = sections
  let finalSectionIds: string[] = storytellingBlockIds
  let finalOverlay: (AllowedOverlayType | null)[] = overlayPerSection
  try {
    const piBatchStart = Date.now()
    const piResult = await composePIBlocks(
      {
        niche: input.niche,
        productPainPoints:  product.painPoints ?? '',
        productBenefits:    product.benefits ?? '',
        productUsp:         product.usps ?? '',
        productPricing:     product.offer ?? '',
        productIngredients: product.ingredients ?? '',
        productName:        product.productName,
        synthesizedBrief,
        targetLanguage:     params.language,
        character:          characterProfile,
      },
      { geminiApiKey, kieApiKey },
      { concurrency: 3 },
    )
    console.info(
      `[storytelling/PI] ${piResult.blocks.length} blocks ` +
      `(${piResult.succeeded} gemini, ${piResult.fallbackCount} fallback, ` +
      `${piResult.skippedCount} skipped) in ${((Date.now() - piBatchStart) / 1000).toFixed(1)}s`,
    )

    if (piResult.blocks.length > 0) {
      const merged = interleaveIntoPack({
        sections,
        sectionIds: storytellingBlockIds,
        piBlocks: piResult.blocks,
      })
      finalSections = merged.sections
      finalSectionIds = merged.sectionIds
      // Build parallel overlay array — null for PI blocks (no overlay budget)
      finalOverlay = merged.sectionIds.map((id) => {
        if (id.startsWith('pi-')) return null
        const origIdx = (storytellingBlockIds as string[]).indexOf(id)
        return origIdx >= 0 ? overlayPerSection[origIdx] : null
      })
    }
  } catch (err) {
    console.warn('[storytelling/PI] PI layer failed — pack ships without PI blocks:', err)
  }

  // ─── 6.15 UI-FIX (2026-05-28) — Pre-compute scene prompts ─────────
  // Run scene synthesis at PACK-GEN time so prompts are visible in UI
  // BEFORE user clicks "Tạo ảnh" (matches UGC app preview pattern).
  // Cost: +1 Gemini call/image (~9 calls, parallel, ~$0.001/pack).
  // executePageGeneration will reuse these instead of re-synthesizing.
  let imageScenes: Record<string, SceneDescription> | undefined = undefined
  try {
    if (exportablePage.sections.length > 0) {
      const sceneSynthStart = Date.now()
      const composedSectionsForSynth = exportablePage.sections
        .filter((s) => s.imageRole !== 'none')
        .map((s) => ({
          id: s.id,
          role: s.role,
          sourceBlockIds: s.sourceBlockIds,
          paragraphs: s.paragraphs,
          inlineProof: s.inlineProof,
          density: s.density,
          pacingRole: s.pacingRole,
          imageRole: s.imageRole,
          scrollWeight: s.scrollWeight,
          ctaInline: s.ctaInline,
          spacingBefore: s.spacingBefore,
          spacingAfter: s.spacingAfter,
          transitionHint: s.transitionHint,
          wordCount: s.wordCount,
          paragraphCount: s.paragraphCount,
        }))
      const sceneBatch = await synthesizePageScenes(
        composedSectionsForSynth,
        {
          niche: input.niche,
          protagonist: {
            archetype: characterProfile.archetype,
            appearanceLock: characterProfile.appearanceLock,
            environmentLock: characterProfile.environmentLock,
          },
          productContext: synthesizedBrief.productIdentityForImage
            ? { productIdentityForImage: synthesizedBrief.productIdentityForImage }
            : null,
          targetLanguage: params.language,
        },
        { geminiApiKey, kieApiKey },
        { concurrency: 4 },
      )
      imageScenes = sceneBatch.scenes
      console.info(
        `[storytelling/sceneSynth] pre-computed ${Object.keys(sceneBatch.scenes).length} scene prompts ` +
        `(${sceneBatch.succeeded} gemini, ${sceneBatch.fallbackCount} fallback) in ${((Date.now() - sceneSynthStart) / 1000).toFixed(1)}s`,
      )
    }
  } catch (err) {
    console.warn('[storytelling/sceneSynth] Pre-compute failed — UI will request synthesis lazily at exec time:', err)
  }

  // ─── 7. Assemble StorytellingPack ────────────────────────────────
  const pack: StorytellingPack = {
    productId:   params.productId,
    productName: product.productName,
    language:    params.language,
    form:        'advertorial',
    sections:    finalSections,
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
    characterProfile,
    storytellingMeta: {
      emotionalIntensity:   input.emotionalIntensity,
      pacingType:           input.pacingType,
      productRevealSection: input.productRevealSection,
      niche:                input.niche,
      overlayBudgetUsed:    finalOverlay.filter((o) => o !== null).length,
      sectionIds:           finalSectionIds as never[],
      overlayPerSection:    finalOverlay,
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
      // P-VISION + P-SYNTHESIS (2026-05-27) — image accuracy
      productIdentityForImage: synthesizedBrief.productIdentityForImage
                              || visionReality.productIdentityForImage
                              || undefined,
      visionSource:         visionReality.source,
      synthesisSource:      synthesizedBrief.source,
      // UI-FIX (2026-05-28) — pre-computed scene prompts per composed
      // section so UI shows "Xem prompt" preview before user clicks gen.
      imageScenes,
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
