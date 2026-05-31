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
  LandingSection, NicheKey, ProtagonistProfile, StorytellingPack,
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
import { buildSynthesizedBrief, synthesizeBriefAndCP } from '../../productSynthesis'
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
import { composePIBlocks, interleaveIntoPack, PI_IMAGE_ROLE, piBlockIdForType } from '../../productInfoLayer'
import type { PIBlock } from '../../productInfoLayer'
import type { GeneratedAsset } from '../../generationOrchestration'
import { synthesizePageScenes } from '../../imageSceneSynthesis'
import type { SceneDescription } from '../../imageSceneSynthesis'
// REBUILD Sprint 1 (2026-05-28) — Pre-write brainstorm stage.
// Reads productSynthesis + commercialPsychology + raw input, picks hook
// angle, drafts the opening, lists agitate beats. Output is threaded
// into the storytelling system prompt so Gemini stops defaulting to
// "soft diary nostalgia" for every niche.
import { synthesizePackBrainstorm } from '../../packBrainstorm'
import type { PackBrainstorm } from '../../packBrainstorm'
// OPT-DIAG2 Fix B (2026-05-28) — localStorage quota guard.
// localStorage has a 5-10MB per-origin limit. After many packs the niche
// cache + reality cache + hook memory entries can fill it, causing
// QuotaExceededError on every subsequent write (silent cache misses
// → wasted Gemini calls). safeSetItem catches the quota error, prunes
// oldest entries across our cache prefixes, and retries once.
const CACHE_PREFIXES = [
  'super-ladipage:hookMemory:',
  'super-ladipage:nicheCache:',
  'super-ladipage:realityCache:',
] as const
/** List our cache entries with their savedAt timestamp (or 0 if untimestamped). */
function listOurCacheEntries(): Array<{ key: string; ts: number }> {
  if (typeof window === 'undefined') return []
  const out: Array<{ key: string; ts: number }> = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key) continue
    if (!CACHE_PREFIXES.some((p) => key.startsWith(p))) continue
    let ts = 0
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as { savedAt?: number } | string[]
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.savedAt === 'number') {
          ts = parsed.savedAt
        }
        // hookMemory is a string[] — no savedAt; treat as 0 = oldest
      }
    } catch { /* ignore parse error, ts stays 0 */ }
    out.push({ key, ts })
  }
  return out
}
/** Safe setItem with quota recovery — on QuotaExceededError prune oldest
 *  N entries from our caches and retry once. Returns true on success. */
function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (err) {
    const isQuota = err instanceof DOMException && (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )
    if (!isQuota) return false
    // Quota exceeded — prune the 5 oldest entries from our caches.
    const entries = listOurCacheEntries()
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 5)
    for (const e of entries) {
      try { window.localStorage.removeItem(e.key) } catch { /* ignore */ }
    }
    console.warn(`[storytelling/cache] localStorage quota hit — pruned ${entries.length} oldest entries, retrying write`)
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch {
      console.warn(`[storytelling/cache] retry after prune still failed — skipping write for ${key.slice(0, 40)}`)
      return false
    }
  }
}

// REBUILD Sprint 4 (2026-05-28) — Anti-repeat memory helpers (Layer E).
// Persists the last N hook fingerprints per productId in localStorage so
// subsequent regenerations of the SAME product pick a different hook
// candidate from the brainstorm pool.
// OPT-DIAG2 Fix B: HOOK_MEMORY_MAX reduced 5 → 3 to lighten storage
// footprint without sacrificing variety (3 past fingerprints is still
// enough to force rotation through different sub-variants).
const HOOK_MEMORY_PREFIX = 'super-ladipage:hookMemory:'
const HOOK_MEMORY_MAX = 3
function readHookMemory(productId: string): string[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = window.localStorage.getItem(HOOK_MEMORY_PREFIX + productId)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === 'string').slice(0, HOOK_MEMORY_MAX)
  } catch {
    return []
  }
}
function pushHookMemory(productId: string, fingerprint: string): void {
  if (typeof window === 'undefined' || !fingerprint) return
  const existing = readHookMemory(productId)
  // Move to front + de-dupe + cap
  const next = [fingerprint, ...existing.filter((f) => f !== fingerprint)].slice(0, HOOK_MEMORY_MAX)
  safeSetItem(HOOK_MEMORY_PREFIX + productId, JSON.stringify(next))
}

// OPT-F1 (2026-05-28) — Niche detection cache.
// detectNiche is deterministic per product (niche depends only on
// productName + painPoints + benefits which don't change between packs
// of the same product). Caching saves ~1 Gemini call per regeneration.
// TTL 7 days so a user editing product input gets a fresh classification.
// 2026-05-29 — Cache prefix bumped to v2 to invalidate stale entries that
// resolved knee braces / nasal sprays to 'health-functional' (the old
// detectNiche CRITICAL RULES had a contradiction that misrouted these
// products). New cache key forces re-classification with the fixed
// Gemini prompt. Old localStorage entries become unreachable and are
// garbage-collected on next pack-gen.
const NICHE_CACHE_PREFIX = 'super-ladipage:nicheCache-v2:'
const NICHE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000   // 7 days
interface NicheCacheEntry {
  niche: string
  source: string
  matchedKeywords: string[]
  confidence: string
  /** Hash of (productName + painPoints + benefits) — invalidates cache
   *  when user edits product. */
  inputHash: string
  savedAt: number
}
function hashProductInput(p: { productName: string; painPoints?: string; benefits?: string }): string {
  const raw = `${p.productName}|${p.painPoints ?? ''}|${p.benefits ?? ''}`
  let h = 0
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h) + raw.charCodeAt(i)
    h |= 0
  }
  return (h >>> 0).toString(36)
}
function readNicheCache(
  productId: string,
  input: { productName: string; painPoints?: string; benefits?: string },
): NicheCacheEntry | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(NICHE_CACHE_PREFIX + productId)
    if (!raw) return null
    const entry = JSON.parse(raw) as NicheCacheEntry
    if (typeof entry?.niche !== 'string' || typeof entry.savedAt !== 'number') return null
    if (Date.now() - entry.savedAt > NICHE_CACHE_TTL_MS) return null
    if (entry.inputHash !== hashProductInput(input)) return null
    return entry
  } catch {
    return null
  }
}
function writeNicheCache(
  productId: string,
  input: { productName: string; painPoints?: string; benefits?: string },
  result: { niche: string; source: string; matchedKeywords: string[]; confidence: string },
): void {
  if (typeof window === 'undefined') return
  const entry: NicheCacheEntry = {
    ...result,
    inputHash: hashProductInput(input),
    savedAt: Date.now(),
  }
  safeSetItem(NICHE_CACHE_PREFIX + productId, JSON.stringify(entry))
}

// OPT-F3 (2026-05-28) — Product reality cache.
// classifyProductReality is deterministic per product (depends on
// productName + painPoints + benefits + USP + offer). Same caching
// pattern as F1: hash of input invalidates the entry when user edits
// product, 7-day TTL is the belt-and-suspenders.
const REALITY_CACHE_PREFIX = 'super-ladipage:realityCache:'
const REALITY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
interface RealityCacheInputShape {
  productName: string
  painPoints?: string
  benefits?: string
  uniqueSellingPoints?: string
  offerPricing?: string
}
function hashRealityInput(p: RealityCacheInputShape): string {
  const raw = `${p.productName}|${p.painPoints ?? ''}|${p.benefits ?? ''}|${p.uniqueSellingPoints ?? ''}|${p.offerPricing ?? ''}`
  let h = 0
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h) + raw.charCodeAt(i)
    h |= 0
  }
  return (h >>> 0).toString(36)
}
interface RealityCacheEntry {
  reality: unknown   // serialized ProductReality — kept opaque for forward compat
  inputHash: string
  savedAt: number
}
function readRealityCache(productId: string, input: RealityCacheInputShape): RealityCacheEntry | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(REALITY_CACHE_PREFIX + productId)
    if (!raw) return null
    const entry = JSON.parse(raw) as RealityCacheEntry
    if (typeof entry?.savedAt !== 'number' || !entry.reality) return null
    if (Date.now() - entry.savedAt > REALITY_CACHE_TTL_MS) return null
    if (entry.inputHash !== hashRealityInput(input)) return null
    return entry
  } catch {
    return null
  }
}
function writeRealityCache(
  productId: string,
  input: RealityCacheInputShape,
  reality: unknown,
): void {
  if (typeof window === 'undefined') return
  const entry: RealityCacheEntry = {
    reality,
    inputHash: hashRealityInput(input),
    savedAt: Date.now(),
  }
  safeSetItem(REALITY_CACHE_PREFIX + productId, JSON.stringify(entry))
}
// REBUILD Sprint 2 (2026-05-28) — Narrative mode detector + filter.
import {
  detectNarrativeMode,
  getSkippedBlocksForMode,
  detectLengthMode,
  getSkippedBlocksForLength,
  LENGTH_MODE_SPEC,
} from '../../narrativeMode'
import type { LengthMode } from '../../narrativeMode'
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

/** Allocate overlay per block.
 *
 *  2026-05-30 — Universal caption rollout. User feedback: pack reads as
 *  wall-of-text without visual chapter markers; readers want a short
 *  scan-friendly label on every image. Previous design hard-capped
 *  overlays at 2/pack as an anti-ads guard, but the "photobook-caption"
 *  overlay style is documentary not advertising (Humans of New York /
 *  family album), so it reinforces the diary aesthetic rather than
 *  cheapening it.
 *
 *  New rule:
 *  - First block keeps `chapter-marker` ("Chương 1") — anchors the page
 *    opening as Phase-1 of a story arc, not just a random first image.
 *  - `micro-transformation` keeps `diary-timestamp` ("Vài tuần sau") —
 *    time-shift signal for the recognition payoff.
 *  - Every OTHER block gets `photobook-caption` — section title rendered
 *    as a soft caption beneath/over the image. UI suppresses it when the
 *    composed section has no image (PI blocks / no-image roles), so the
 *    actual overlay count matches the image count, ~7/pack.
 *  - Universal across all 22 niches + 3 languages — no hardcoding. */
function allocateOverlay(blockIds: BlockId[]): (AllowedOverlayType | null)[] {
  return blockIds.map((id, idx) => {
    if (idx === 0 && id === 'self-recognition-hook') return 'chapter-marker'
    if (id === 'micro-transformation') return 'diary-timestamp'
    return 'photobook-caption'
  })
}

/** Build summary string from result — for UI debug strip. */
function buildValidationSummary(result: GeneratedPackResult): string {
  const { finalValidation, initialValidation, attempts } = result
  if (finalValidation.pass && attempts === 1) {
    return '✓ all 6 validators passed (clean first try)'
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
  const nicheClassifierInput = {
    productName: product.productName,
    painPoints: product.painPoints,
    benefits: (product as { benefits?: string }).benefits,
  }
  // OPT-F1 (2026-05-28) — Read from localStorage cache first. Niche is
  // deterministic per product input, so any prior detection is reusable
  // until the user edits product fields (input hash mismatch = cache miss).
  let nicheDetection: import('../resolvers/detectNiche').DetectResult | null = null
  const cachedNiche = readNicheCache(product.id, nicheClassifierInput)
  if (cachedNiche) {
    nicheDetection = {
      niche: cachedNiche.niche as NicheKey,
      source: cachedNiche.source as 'gemini' | 'regex-fallback' | 'safe-default',
      matchedKeywords: cachedNiche.matchedKeywords,
      confidence: cachedNiche.confidence as 'high' | 'medium' | 'low',
    }
    console.info(
      `[storytelling] niche detection: ${nicheDetection.niche} ` +
      `(source=${nicheDetection.source}+cache, confidence=${nicheDetection.confidence}, ` +
      `cached at ${new Date(cachedNiche.savedAt).toISOString().slice(0, 16)})`,
    )
  } else {
    nicheDetection = await detectNiche(
      nicheClassifierInput,
      {
        geminiApiKey: settingsForNiche.geminiApiKey,
        kieApiKey: settingsForNiche.kieApiKey,
      },
    )
    writeNicheCache(product.id, nicheClassifierInput, nicheDetection)
    console.info(
      `[storytelling] niche detection: ${nicheDetection.niche} ` +
      `(source=${nicheDetection.source}, confidence=${nicheDetection.confidence}, ` +
      `matched=[${nicheDetection.matchedKeywords.join(', ')}])`,
    )
  }
  // ─── 2.5 P-PRODUCT-CLASS (2026-05-27) — Product reality classifier ──
  // Classifies product into 7-axis ProductRealityModel.
  // Solves: knee brace vs glucosamine pill — both health-functional niche
  // but completely different storytelling needs (form/pacing/discovery).
  //
  // OPT-F3 (2026-05-28): cached in localStorage with same TTL+hash
  // pattern as F1 (niche cache). Product reality is deterministic from
  // product fields, so we skip the Gemini call on repeat packs.
  const realityClassifierInput = {
    productName: product.productName,
    painPoints: product.painPoints,
    benefits: (product as { benefits?: string }).benefits,
    uniqueSellingPoints: (product as { usp?: string; uniqueSellingPoints?: string }).usp
      ?? (product as { usp?: string; uniqueSellingPoints?: string }).uniqueSellingPoints,
    offerPricing: (product as { offerPricing?: string; pricing?: string }).offerPricing
      ?? (product as { offerPricing?: string; pricing?: string }).pricing,
  }
  const cachedReality = readRealityCache(product.id, realityClassifierInput)
  let productReality: Awaited<ReturnType<typeof classifyProductReality>>
  if (cachedReality) {
    productReality = cachedReality.reality as Awaited<ReturnType<typeof classifyProductReality>>
    console.info(
      `[storytelling] product reality (cached): form=${productReality.productForm}, ` +
      `mechanism=${productReality.mechanismFamily}, ` +
      `pacing=${productReality.pacingProfile}, ` +
      `discovery=${productReality.discoveryContext}, ` +
      `source=${productReality.source}+cache, ` +
      `cached at ${new Date(cachedReality.savedAt).toISOString().slice(0, 16)}`,
    )
  } else {
    productReality = await classifyProductReality(
      realityClassifierInput,
      {
        geminiApiKey: settingsForNiche.geminiApiKey,
        kieApiKey: settingsForNiche.kieApiKey,
      },
    )
    writeRealityCache(product.id, realityClassifierInput, productReality)
    console.info(
      `[storytelling] product reality: form=${productReality.productForm}, ` +
      `mechanism=${productReality.mechanismFamily}, ` +
      `pacing=${productReality.pacingProfile}, ` +
      `discovery=${productReality.discoveryContext}, ` +
      `source=${productReality.source}` +
      (productReality.rationale ? ` // ${productReality.rationale.slice(0, 80)}` : ''),
    )
  }

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
  // OPT-F5 (2026-05-28): merged brief + commercial-psychology into ONE
  // Gemini call. CP previously ran sequentially after Brief because it
  // needed Brief outputs as inputs — now they're produced together in a
  // single combined JSON. Fail-safe: synthesizeBriefAndCP internally falls
  // back to the 2 sequential calls if the combined call fails / truncates.
  const briefAndCpStart = Date.now()
  const synthCombined = await synthesizeBriefAndCP(
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
  const synthesizedBrief = synthCombined.brief
  const commercialPsychologyFromCombined = synthCombined.commercialPsychology
  console.info(
    `[storytelling] synthesized brief+CP: path=${synthCombined.source} (${((Date.now() - briefAndCpStart) / 1000).toFixed(1)}s) ` +
    `essence_length=${synthesizedBrief.productEssence.length}, ` +
    `reader_symptoms=${synthesizedBrief.readerSpecificSymptoms.length}, ` +
    `forbidden_drift=${synthesizedBrief.forbiddenDriftSymptoms.length}` +
    (commercialPsychologyFromCombined ? `, CP desire=${commercialPsychologyFromCombined.primaryDesire.length}c, objections=${commercialPsychologyFromCombined.topObjections.length}` : ', CP=undefined') +
    (synthesizedBrief.rationale ? ` // ${synthesizedBrief.rationale.slice(0, 60)}` : ''),
  )

  // ─── 3. Build product brief ───────────────────────────────────────
  // Brief composition (PRIMARY → SECONDARY context order):
  //   1. synthesizedBriefText (PRIMARY — tight product reality + drift guardrails)
  //   2. realityBrief (mechanism description + library defaults)
  //   3. legacy productBrief (niche-level summary)
  const synthesizedBriefText = buildSynthesizedBrief(synthesizedBrief)
  const productBrief = buildProductBrief(product.productName, input.niche, product.painPoints)
  const realityBrief = buildRealityBrief(productReality)

  // ─── 3.4 CP-SYNTHESIS (now from combined call — OPT-F5 2026-05-28) ──
  // commercialPsychology was previously a SEPARATE Gemini call that ran
  // sequentially after synthesizeProductBrief. F5 merged the two into
  // synthesizeBriefAndCP — the CP output now arrives bundled with the
  // brief, saving 1 Gemini call. We just alias for downstream readers.
  const commercialPsychology: SynthesizedCommercialPsychology | undefined = commercialPsychologyFromCombined

  // ─── 3.45 REBUILD Sprint 1 (2026-05-28) — Pre-write brainstorm ───
  // Runs AFTER productSynthesis + commercialPsychology because it needs
  // both as inputs. Runs BEFORE generatePackWithRetry because its output
  // is threaded into the storytelling system prompt as a HARD ANCHOR for
  // Block 1 hook + Phase 1-2 agitate beats. Without this stage Gemini
  // kept defaulting to "soft diary nostalgia recall" for every niche
  // regardless of input — the universal lan-man bug across all packs.
  //
  // OPT-F2 (2026-05-28): preliminary mode check from niche alone — if
  // niche default is recognition-soft (beauty / lifestyle / luxury),
  // brainstorm pain-anchor isn't useful (those packs WANT the soft
  // diary opener). Skip the entire Gemini brainstorm call for those
  // niches. The narrative mode hint pasted into systemPrompt later
  // still tells the writer to use the soft opener directly.
  const preliminaryMode = detectNarrativeMode({ niche: input.niche }).mode
  let packBrainstorm: PackBrainstorm | undefined = undefined
  // REBUILD Sprint 4 (Layer E): read past hook fingerprints for this product
  // so the brainstorm + picker can avoid recently-used patterns.
  const avoidedHookFingerprints = readHookMemory(product.id)
  // Sprint 4: seed is taken from input.randomSeed (string — hashed to int)
  // or Date.now() if absent, so click-after-click still rotates candidates.
  const brainstormSeed = (() => {
    const raw = input.randomSeed
    if (typeof raw === 'string' && raw.length > 0) {
      let h = 0
      for (let i = 0; i < raw.length; i++) {
        h = ((h << 5) - h) + raw.charCodeAt(i)
        h |= 0
      }
      return h >>> 0
    }
    return Date.now() >>> 0
  })()
  if (preliminaryMode === 'recognition-soft') {
    console.info(
      `[storytelling/brainstorm] SKIPPED — niche=${input.niche} default mode is recognition-soft. ` +
      `Soft niches use the diary nostalgia opener directly; no pain-anchor brainstorm needed.`,
    )
  } else try {
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
        // Sprint 4 — variety inputs
        avoidedHookFingerprints,
        seed: brainstormSeed,
      },
      { geminiApiKey, kieApiKey },
    )
    console.info(
      `[storytelling/brainstorm] ${packBrainstorm.source} · angle=${packBrainstorm.chosenAngle} · ` +
      `subVariant=${packBrainstorm.chosenSubVariant} · candidates=${packBrainstorm.hookCandidates.length} · ` +
      `pains=${packBrainstorm.painLadder.length} · beats=${packBrainstorm.agitateBeats.length} · ` +
      `personas=${packBrainstorm.socialProofPersonas.length} in ${((Date.now() - brainstormStart) / 1000).toFixed(1)}s` +
      (avoidedHookFingerprints.length > 0 ? ` · avoiding ${avoidedHookFingerprints.length} past fingerprints` : '') +
      ` · fp=${packBrainstorm.hookFingerprint}` +
      (packBrainstorm.rationale ? ` // ${packBrainstorm.rationale.slice(0, 80)}` : ''),
    )
    // Sprint 4 (Layer E): persist this fingerprint so next regen avoids it.
    pushHookMemory(product.id, packBrainstorm.hookFingerprint)
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

  // 2026-05-29 — Length Mode (adaptive pack length).
  // Driven by productClass.pacingProfile: fast-cod → short, medium-narrative
  // → medium, slow-burn → long. SHORT mode trims 2-3 additional non-critical
  // blocks (hidden-emotional-truth merges into Block 1, soft-mechanism-compare
  // dropped, skepticism-alignment optional anyway). Empathy + cost rule +
  // narrator validation + mechanism + transformation + CTA all preserved.
  const lengthMode: LengthMode = detectLengthMode(productReality.pacingProfile)
  const lengthSpec = LENGTH_MODE_SPEC[lengthMode]
  const skippedForLength = getSkippedBlocksForLength(lengthMode)
  const planAfterMode = resolveBlockPlan(input, narrativeMode, lengthMode)
  if (planAfterMode.length !== plan.length) {
    console.info(
      `[storytelling/narrativeMode] mode=${narrativeMode} (${narrativeModeDecision.source}) + ` +
      `length=${lengthMode} (~${lengthSpec.expectedPackWords}w target) — ` +
      `re-resolved plan: ${plan.length} → ${planAfterMode.length} blocks ` +
      `(skipped mode=[${skippedForMode.join(', ') || 'none'}], length=[${skippedForLength.join(', ') || 'none'}])`,
    )
  } else {
    console.info(
      `[storytelling/narrativeMode] mode=${narrativeMode} (${narrativeModeDecision.source}) + ` +
      `length=${lengthMode} — plan unchanged at ${plan.length} blocks`,
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

  // 2026-05-29 — Fix #2: when synthesis returns 0 reader symptoms (free-tier
  // overload / 429 truncation), derive them from the brainstorm pain ladder.
  // Brainstorm reads RAW product input directly (not just synthesis) so it
  // remains product-specific even when synthesis fails — its painLadder is
  // a reliable backup source. Without this fallback, an empty synthesis
  // dumps storytelling onto the generic niche pool → cross-symptom pollution
  // (nasal spray pack mentions chest tightness; cough patch mentions
  // skincare/fatigue). With this fallback, the pack stays product-anchored
  // even when the synthesis JSON truncated.
  let effectiveReaderSymptoms = synthesizedBrief.readerSpecificSymptoms
  if (effectiveReaderSymptoms.length === 0 && packBrainstorm && packBrainstorm.painLadder.length > 0) {
    effectiveReaderSymptoms = packBrainstorm.painLadder
      .slice(0, 6)
      .map((p) => p.pain.trim())
      .filter((s) => s.length > 0)
    console.info(
      `[storytelling] synthesis returned 0 reader symptoms — derived ${effectiveReaderSymptoms.length} from brainstorm pain ladder ` +
      `(angle=${packBrainstorm.chosenAngle}). Pack stays product-specific instead of falling to generic niche pool.`,
    )
  }

  const result = await generatePackWithRetry({
    input,
    plan,
    productBrief,
    realityBrief,
    synthesizedBrief: synthesizedBriefText,
    // SPEC-FIX (2026-05-27): pass reader-specific symptoms structurally
    // so nicheDomainLockBrief can REPLACE its generic pool with these.
    // Fix #2 (2026-05-29): symptoms may come from brainstorm if synthesis empty.
    synthesizedReaderSymptoms: effectiveReaderSymptoms,
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
    // 2026-05-29 — Length Mode: adaptive pack length + mobile rhythm rules
    // injected into systemPrompt + per-block word cap honored in
    // buildPackGenPrompt directive.
    lengthMode,
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
  // 2026-05-30 — Hoist PI block list so the scene-synth block below can
  // also synthesize prompts for PI blocks that need images (currently just
  // pi-mechanism-personal per PI_IMAGE_ROLE). Stays undefined when PI gen
  // fails entirely — image-enriched PI flow then no-ops cleanly.
  let piBlocksGenerated: PIBlock[] = []
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
      piBlocksGenerated = piResult.blocks   // hoist for scene-synth step below
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
  // 2026-05-30 — Parallel store for PI block image scenes + plans. Stays
  // undefined when PI gen failed or no PI block has PI_IMAGE_ROLE !== null.
  let piImageScenes: Record<string, SceneDescription> | undefined = undefined
  let piImageAssets: Record<string, GeneratedAsset> | undefined = undefined
  try {
    // ── Build storytelling synth inputs (existing path) ─────────────
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

    // ── 2026-05-30 — Build PI synth inputs for blocks with image role ─
    // PI blocks adapt to the same ComposedSection shape that
    // synthesizePageScenes consumes (the synthesizer only reads .id,
    // .imageRole, .paragraphs, and a couple of pacing flags). We map
    // PI properties to safe defaults for fields not relevant to PI
    // (sourceBlockIds, density, etc.) without polluting the actual
    // composer output — these synthetic sections live ONLY in this
    // batch call.
    const piIdsForSynth = new Set<string>()
    const piSectionsForSynth = piBlocksGenerated
      .map((piBlock) => {
        const role = PI_IMAGE_ROLE[piBlock.type]
        if (!role) return null
        const id = piBlockIdForType(piBlock.type)
        piIdsForSynth.add(id)
        return {
          id,
          // 'solution-opening' is the closest semantic SectionRole for PI
          // mechanism — narrator is in product-discovery / mechanism-reveal
          // mode. Used by synth for phase mood inference.
          role: 'solution-opening' as const,
          sourceBlockIds: [],   // PI blocks aren't composed; empty is fine
          paragraphs: piBlock.paragraphs,
          inlineProof: undefined,
          density: 'medium' as const,
          pacingRole: 'mixed' as const,
          imageRole: role,
          scrollWeight: 'moderate' as const,
          ctaInline: false,
          spacingBefore: 'normal' as const,
          spacingAfter: 'normal' as const,
          transitionHint: 'product-detail-callout',
          wordCount: piBlock.paragraphs.join(' ').split(/\s+/).length,
          paragraphCount: piBlock.paragraphs.length,
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    const totalSynthSections = composedSectionsForSynth.length + piSectionsForSynth.length
    if (totalSynthSections > 0) {
      const sceneSynthStart = Date.now()
      const sceneBatch = await synthesizePageScenes(
        [...composedSectionsForSynth, ...piSectionsForSynth],
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

      // Split scenes back into storytelling vs PI per the id sets.
      const storytellingScenes: Record<string, SceneDescription> = {}
      const piScenes: Record<string, SceneDescription> = {}
      for (const [id, scene] of Object.entries(sceneBatch.scenes)) {
        if (piIdsForSynth.has(id)) piScenes[id] = scene
        else storytellingScenes[id] = scene
      }
      imageScenes = storytellingScenes
      if (Object.keys(piScenes).length > 0) {
        piImageScenes = piScenes
      }

      // Build PI image asset plans for each PI block that got a scene.
      // Stub renderer (gpt4o) — matches scene.routing.renderer; UI swaps
      // these in for the actual prompt at exec time via the same path
      // the storytelling pipeline already uses.
      if (piImageScenes) {
        const plans: Record<string, GeneratedAsset> = {}
        for (const [piId, scene] of Object.entries(piImageScenes)) {
          plans[piId] = {
            renderer: scene.routing.renderer,
            promptUsed: { prompt: scene.prompt },
            referenceAssets: [],
            generationStatus: 'planned',
            retryCount: 0,
            outputImages: [],
            plannedAt: Date.now(),
          }
        }
        piImageAssets = plans
      }

      console.info(
        `[storytelling/sceneSynth] pre-computed ${Object.keys(sceneBatch.scenes).length} scene prompts ` +
        `(${sceneBatch.succeeded} gemini, ${sceneBatch.fallbackCount} fallback, ` +
        `${Object.keys(piScenes).length} are PI) in ${((Date.now() - sceneSynthStart) / 1000).toFixed(1)}s`,
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
      // 2026-05-30 — PI image scenes + asset plans (parallel store).
      // Currently only pi-mechanism-personal — see PI_IMAGE_ROLE table.
      piImageScenes,
      piImageAssets,
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
