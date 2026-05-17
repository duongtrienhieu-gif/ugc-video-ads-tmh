import type {
  LandingPagePack, LandingSection, ImagePrompt, SectionType, VisualMemoryItem,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import {
  submitGpt4oImage, pollGpt4oUntilDone, type Gpt4oSize,
} from '../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'
import { routeAndExecuteJob } from './hybridRouter'

// ─────────────────────────────────────────────────────────────────────────
// IMAGE GENERATION QUEUE for landing-page packs.
//
// Z8 PERFORMANCE FIX — targets:
//   • 5 ảnh   < 30s
//   • 15 ảnh  < 90s
//   • 30 ảnh  < 3-5 phút
//
// Major changes vs previous version:
//  1. Concurrency 2 → 6 (3x throughput).
//  2. PRIORITY QUEUE — hero generates FIRST, then social-proof/whatsapp/
//     before-after (visible above the fold), then infographics/comparison,
//     then everything else. User sees important assets land first.
//  3. CREDIT-SAFE RETRY — splits submit / poll so on a poll-timeout we
//     poll the SAME taskId again instead of re-submitting (saves credit).
//  4. 'retrying' UI status — distinct from 'generating', surfaced in cards.
//  5. SECTION 1 CHARACTER LOCK — every hero prompt is prepended with
//     "Malaysian Muslim woman in hijab" lock so the brand persona stays
//     consistent across hero variants.
// ─────────────────────────────────────────────────────────────────────────

// Section types rendered WITH the user's product references.
const PRODUCT_FOCUS_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'hero',
  'product-discovery',
  'ingredients',
  'mechanism',
  'benefits',
  'comparison',
  'social-proof',
  'whatsapp-testimonials',
  'offer',
  'final-cta',
])

// People / lifestyle / editorial — do NOT pass product refs.
const PEOPLE_FOCUS_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'pain',
  'failed-solutions',
  'lifestyle',
  'news-proof',
  'before-after',
])

// ─────────────────────────────────────────────────────────────────────────
// PRIORITY QUEUE — lower number = higher priority.
//
// Tier 0 (HERO — non-negotiable first): hero
// Tier 1 (TRUST proof above the fold): social-proof, whatsapp-testimonials,
//        before-after, final-cta
// Tier 2 (BODY copy support):           pain, product-discovery, lifestyle,
//        news-proof
// Tier 3 (LOW-priority fillers):        ingredients, mechanism, benefits,
//        comparison, why-happens, failed-solutions, offer, faq
// ─────────────────────────────────────────────────────────────────────────
const SECTION_PRIORITY: Record<SectionType, number> = {
  'hero':                  0,
  'social-proof':          1,
  'whatsapp-testimonials': 1,
  'before-after':          1,
  'final-cta':             1,
  'pain':                  2,
  'product-discovery':     2,
  'lifestyle':             2,
  'news-proof':            2,
  'ingredients':           3,
  'mechanism':             3,
  'benefits':              3,
  'comparison':            3,
  'why-happens':           3,
  'failed-solutions':      3,
  'offer':                 3,
  'faq':                   3,
}

// ─────────────────────────────────────────────────────────────────────────
// PRODUCT IDENTITY LOCK — V3 — strict-no-substitute policy.
// User reported AI swapping the product entirely (OXEVIN / DOSPRO renamed)
// instead of using INFINITY PROBIOTICS reference. Hardened with explicit
// pixel-for-pixel + brand-name lock + fail-rather-than-substitute language.
// ─────────────────────────────────────────────────────────────────────────
const PRODUCT_IDENTITY_PREFIX =
  'ABSOLUTE PRODUCT IDENTITY LOCK — read carefully:\n' +
  'The product MUST be PIXEL-FOR-PIXEL the EXACT product from the attached reference image.\n' +
  '  • Same bottle / jar / sachet / packaging SHAPE (no swapping container types)\n' +
  '  • Same exact brand name TEXT on the label — do NOT rename, do NOT invent a new brand\n' +
  '  • Same label TYPOGRAPHY (font, size, layout)\n' +
  '  • Same label COLORS (every color must match the reference)\n' +
  '  • Same cap style and color\n' +
  '  • Same logo placement and proportions\n' +
  '  • Same packaging RATIO (squat vs tall — do NOT change)\n' +
  'BANNED behaviors:\n' +
  '  • Inventing a fake brand name like "OXEVIN", "DOSPRO", "VITALEX" — use ONLY the brand from the reference\n' +
  '  • Substituting a "similar-looking" generic supplement bottle — pixel-for-pixel match only\n' +
  '  • Redesigning the label even slightly — every word and graphic stays as-is\n' +
  '  • Changing the cap, removing the cap, swapping container types\n' +
  'If you cannot precisely replicate the product, fail and return an error rather than render a substitute.\n'

// ─────────────────────────────────────────────────────────────────────────
// SECTION-1 HERO CHARACTER LOCK — Malaysian Muslim hijab women only.
// Brand persona consistency across hero variants. No men, no Western faces,
// no Chinese influencer aesthetic.
// ─────────────────────────────────────────────────────────────────────────
const HERO_CHARACTER_LOCK =
  'CHARACTER LOCK: Malaysian Muslim woman in modest hijab, mid 30s, ' +
  'natural Southeast-Asian features, warm friendly expression, ' +
  'authentic ecommerce-native UGC aesthetic. ' +
  'STRICTLY NO men, NO Western/Caucasian faces, NO Chinese influencer-style faces, ' +
  'NO Korean/Japanese aesthetic. Same ethnicity and hijab style across hero variants. '

/** Pick the asset refs (if any) to pass into KIE filesUrl for this section. */
function selectRefsForSection(type: SectionType, memory: VisualMemoryItem[]): string[] {
  if (PEOPLE_FOCUS_SECTIONS.has(type)) return []
  if (PRODUCT_FOCUS_SECTIONS.has(type)) return memory.slice(0, 3).map((m) => m.ref)
  return []
}

/** Map landing-section ratio → KIE GPT-4o supported size.
 *  KIE only supports 1:1, 3:2 (landscape), and 2:3 (portrait).
 *   - '1:1'  → '1:1'
 *   - '16:9' → '3:2' (closest KIE landscape — used by offer + final-cta banners)
 *   - '4:5' / '9:16' / anything else → '2:3' (portrait, default)
 *  9:16 still banned at the section-spec level. */
function toKieAspect(ratio: string | undefined): Gpt4oSize {
  if (ratio === '1:1')  return '1:1'
  if (ratio === '16:9') return '3:2'
  return '2:3'
}

async function resolveRefs(refs: string[]): Promise<string[]> {
  const urls: string[] = []
  for (const ref of refs) {
    if (!ref) continue
    if (isAssetRef(ref)) {
      const u = await getUrl(ref)
      if (u) urls.push(u)
    } else if (ref.startsWith('http')) {
      urls.push(ref)
    }
  }
  return urls
}

interface ImageJob {
  sectionIdx: number
  imageIdx: number
  prompt: ImagePrompt
  section: LandingSection
}

interface QueueOptions {
  concurrency?: number
  signal?: AbortSignal
  onTaskUpdate: (sectionIdx: number, imageIdx: number, patch: Partial<ImagePrompt>) => void
  /**
   * Progress callback. Args:
   *  done, failed, total, retries (number of retry attempts performed so far,
   *  accumulated across all jobs)
   */
  onProgress?: (done: number, failed: number, total: number, retries: number) => void
}

// ─────────────────────────────────────────────────────────────────────────
// Build the final prompt fed to KIE — prepends identity locks as needed.
// Phase H1: appends a per-image variation token + diversity instruction so
// KIE never produces "same hand / same bg / same bottle angle" clones.
// ─────────────────────────────────────────────────────────────────────────
function buildFinalPrompt(job: ImageJob, hasProductRefs: boolean): string {
  const parts: string[] = []
  // Hero ALWAYS gets the character lock (even without product refs)
  if (job.section.type === 'hero') parts.push(HERO_CHARACTER_LOCK)
  if (hasProductRefs) parts.push(PRODUCT_IDENTITY_PREFIX)
  parts.push(job.prompt.prompt)
  // ── Phase H1 anti-clone variation enrichment ─────────────────────────
  parts.push(buildVariationDirective(job))
  return parts.join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Phase H1 — Variation directive.
// Forces KIE to produce a DIFFERENT latent per image even when the base
// prompts look similar. Two mechanisms:
//   1. Unique 6-char `variationSeed` token appended → forces prompt-hash drift
//   2. Explicit per-image axis selection (camera/lighting/hand/bg/bottle)
//      seeded by section type + image index so each shot in a section gets
//      a deterministically different rotation through the axis pools.
// ─────────────────────────────────────────────────────────────────────────

// Axis pools — picked deterministically per image so a section's N shots
// cycle through DIFFERENT combinations.
const CAMERA_ANGLES = [
  'iPhone selfie eye-level', 'slight low-angle 30°', '3/4 angle waist-height',
  'top-down flat-lay', 'side-profile slice', 'over-the-shoulder',
  'POV reach (first-person)', 'mirror reflection shot',
]
const LIGHTING_DIRS = [
  'soft window daylight from left', 'warm kitchen-side glow',
  'overhead noon natural light', 'golden-hour right-side warm',
  'cool morning bathroom light', 'dim cozy table-lamp evening',
  'mixed window + ceiling light', 'soft overcast diffused',
]
// V3 — HAND_POSES, BG_CONTEXTS, BOTTLE_ANGLES removed.
// Old 5-axis variation directive softened to 2 axes (camera + lighting only)
// so section structure (e.g. "BEFORE portrait", "pure WhatsApp screenshot")
// is not contaminated by generic hand/bg/bottle hints.

function pickFromPool<T>(pool: T[], seed: string, offset = 0): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return pool[(h + offset) % pool.length]
}

/** 6-char random token — appended to every prompt to force latent drift. */
function makeVariationSeed(): string {
  return Math.random().toString(36).slice(2, 8)
}

function buildVariationDirective(job: ImageJob): string {
  // Pull the existing seed (if pack was loaded from saved project) or mint
  // a fresh one. Either way, this token appears in the prompt body and
  // makes the prompt-hash unique per render.
  const seed = job.prompt.variationSeed ?? makeVariationSeed()

  // Cache the seed onto the prompt for stability — subsequent regens of
  // this image reuse the same seed so the latent stays consistent.
  if (!job.prompt.variationSeed) {
    job.prompt.variationSeed = seed
  }

  // ── V3: softer variation — 2 axes instead of 5 ──────────────────────
  // Previous version aggressively rotated 5 axes per image which OVER-
  // randomized and broke section structure. V3 keeps section structure
  // intact + only varies camera angle + lighting. Section-specific specs
  // in SYSTEM_PROMPT now drive context/hand/bottle variation naturally.
  const idxSeed = `${job.section.type}-${job.imageIdx}-${seed}`
  const camera   = pickFromPool(CAMERA_ANGLES, idxSeed, 0)
  const lighting = pickFromPool(LIGHTING_DIRS, idxSeed, 7)

  const lines: string[] = []
  lines.push('AUTHENTICITY VARIATION DIRECTIVE (soft — respect section structure):')
  lines.push(`  • Camera angle hint: ${camera}`)
  lines.push(`  • Lighting hint: ${lighting}`)
  lines.push(`  • Render as INDEPENDENT phone-quality photo — do NOT derive from any other image.`)
  lines.push(`  • Fresh seed token: ${seed}`)

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// CREDIT-SAFE single image — splits submit / poll so we can recover
// in-flight taskIds across retry boundaries instead of burning a fresh
// credit on every retry.
//
// First attempt: submit + poll (5 min timeout)
// Retry attempt: re-poll the OLD taskId for 60s. If KIE eventually returns
// success → no new credit. If still stuck/failed → submit a fresh task.
// ─────────────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 4
const RECOVERY_POLL_MS = 60_000   // give an in-flight task another 60s
const FRESH_POLL_MS    = 5 * 60_000

async function runWithCreditSafeRetry(
  job: ImageJob,
  memory: VisualMemoryItem[],
  kieApiKey: string,
  onTaskUpdate: (patch: Partial<ImagePrompt>) => void,
  signal?: AbortSignal,
): Promise<{ assetRef: string; retries: number }> {
  const refs = selectRefsForSection(job.section.type, memory)
  const filesUrl = await resolveRefs(refs)
  const hasProductRefs = filesUrl.length > 0

  const effectiveRatio = job.section.imageAspectRatio ?? job.prompt.aspectRatio ?? '4:5'
  const size = toKieAspect(effectiveRatio)

  const finalPrompt = buildFinalPrompt(job, hasProductRefs)

  let lastTaskId: string | null = null
  let lastError: Error | null = null
  let retries = 0

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new Error('Đã huỷ')

    // ── Recover an in-flight task before re-submitting (saves credit) ──
    if (lastTaskId) {
      try {
        onTaskUpdate({ status: 'retrying', error: undefined })
        const recoveredUrl = await pollGpt4oUntilDone({
          apiKey: kieApiKey,
          taskId: lastTaskId,
          timeoutMs: RECOVERY_POLL_MS,
          signal,
        })
        const assetRef = await downloadAndStore(recoveredUrl)
        return { assetRef, retries }
      } catch (err) {
        // Recovery failed — fall through to fresh submission
        lastError = err instanceof Error ? err : new Error(String(err))
        lastTaskId = null
        retries++
      }
    }

    // ── Submit a brand-new task ────────────────────────────────────────
    try {
      onTaskUpdate({ status: attempt === 0 ? 'generating' : 'retrying', error: undefined })

      const { taskId } = await submitGpt4oImage({
        apiKey: kieApiKey,
        prompt: finalPrompt,
        filesUrl: filesUrl.length > 0 ? filesUrl : undefined,
        size,
      })
      lastTaskId = taskId

      const remoteUrl = await pollGpt4oUntilDone({
        apiKey: kieApiKey,
        taskId,
        timeoutMs: FRESH_POLL_MS,
        signal,
      })

      const assetRef = await downloadAndStore(remoteUrl)
      // Success → clear the in-flight tracker
      lastTaskId = null
      return { assetRef, retries }

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Hard failures — never retry (don't burn credit on something that
      // structurally can't succeed)
      if (
        lastError.message === 'INSUFFICIENT_CREDITS' ||
        lastError.message.includes('content_policy') ||
        lastError.message.includes('Đã huỷ') ||
        lastError.message.includes('CANCELLED')
      ) {
        throw lastError
      }

      // GENERATE_FAILED → KIE definitively failed → retry with fresh submit
      if (lastError.message.includes('GENERATE_FAILED')) {
        lastTaskId = null
      }
      // Otherwise (timeout / network) → keep lastTaskId so next iteration
      // tries to recover it before re-submitting.

      retries++
      if (attempt < MAX_ATTEMPTS - 1) {
        const backoff = [0, 3_000, 8_000, 15_000][attempt + 1] ?? 15_000
        console.log(`[LandingPageAI] retry ${attempt + 1}/${MAX_ATTEMPTS - 1} for ${job.prompt.filename} (wait ${backoff / 1000}s, ${lastTaskId ? 'will re-poll old task' : 'will re-submit'})`)
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
  }

  throw lastError ?? new Error('Image generation failed after max retries')
}

async function downloadAndStore(remoteUrl: string): Promise<string> {
  if (isAssetRef(remoteUrl)) return remoteUrl
  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`Fetch generated image lỗi: ${resp.status}`)
  const blob = await resp.blob()
  if (blob.size < 1000) throw new Error('Response image quá nhỏ — có thể bị corrupt')
  return await saveAsset(blob, blob.type || 'image/png')
}

// ─────────────────────────────────────────────────────────────────────────
// Build the flat list of jobs from a pack — SORTED by priority.
//
// Sort key: (section priority tier, original section index, image index).
// This guarantees hero comes first; within a tier we preserve pack order.
// ─────────────────────────────────────────────────────────────────────────
function collectJobs(pack: LandingPagePack): ImageJob[] {
  const jobs: ImageJob[] = []
  for (let si = 0; si < pack.sections.length; si++) {
    const section = pack.sections[si]
    if (!section.imagePrompts) continue
    for (let ii = 0; ii < section.imagePrompts.length; ii++) {
      jobs.push({ sectionIdx: si, imageIdx: ii, prompt: section.imagePrompts[ii], section })
    }
  }

  // Priority sort — stable on tie via insertion order
  jobs.sort((a, b) => {
    const pa = SECTION_PRIORITY[a.section.type] ?? 9
    const pb = SECTION_PRIORITY[b.section.type] ?? 9
    if (pa !== pb) return pa - pb
    if (a.sectionIdx !== b.sectionIdx) return a.sectionIdx - b.sectionIdx
    return a.imageIdx - b.imageIdx
  })

  return jobs
}

function getKieKey(): string {
  const s = useSettingsStore.getState()
  if (!s.kieApiKey) throw new Error('Chưa có KIE.ai API key — vào Cài đặt để nhập.')
  return s.kieApiKey
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: count how many images will be generated (for cost preview).
// ─────────────────────────────────────────────────────────────────────────
export function countImagesInPack(pack: LandingPagePack): number {
  return collectJobs(pack).length
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: generate all images in a pack with a high-throughput worker pool.
// Concurrency raised 2 → 6 for ~3x speedup. KIE backend handles concurrent
// /gpt4o-image/generate fine — the bottleneck is per-image latency, not API
// rate limit.
// ─────────────────────────────────────────────────────────────────────────
export async function generatePackImages(
  pack: LandingPagePack,
  options: QueueOptions,
): Promise<void> {
  const kieApiKey = getKieKey()
  const jobs = collectJobs(pack)
  const total = jobs.length
  if (total === 0) return

  for (const j of jobs) {
    options.onTaskUpdate(j.sectionIdx, j.imageIdx, { status: 'queued', error: undefined })
  }
  let done = 0
  let failed = 0
  let totalRetries = 0
  options.onProgress?.(done, failed, total, totalRetries)

  // ── Z8: concurrency 2 → 6 (3x throughput) ────────────────────────────
  const concurrency = options.concurrency ?? 6
  let cursor = 0

  await new Promise<void>((resolve) => {
    let active = 0
    let resolved = false

    const finish = () => {
      if (resolved) return
      if (cursor >= jobs.length && active === 0) {
        resolved = true
        resolve()
      }
    }

    const pump = () => {
      while (!resolved && active < concurrency && cursor < jobs.length) {
        if (options.signal?.aborted) {
          for (let i = cursor; i < jobs.length; i++) {
            options.onTaskUpdate(jobs[i].sectionIdx, jobs[i].imageIdx, {
              status: 'failed', error: 'Đã huỷ',
            })
          }
          cursor = jobs.length
          finish()
          return
        }

        const job = jobs[cursor++]
        active++
        options.onTaskUpdate(job.sectionIdx, job.imageIdx, { status: 'generating' })

        // ── Hybrid router: classify + dispatch (flag off = legacy path) ─
        routeAndExecuteJob(job, {
          pack,
          kieApiKey,
          onTaskUpdate: (patch) => options.onTaskUpdate(job.sectionIdx, job.imageIdx, patch),
          signal: options.signal,
          legacyRunner: () => runWithCreditSafeRetry(
            job, pack.visualMemory, kieApiKey,
            (patch) => options.onTaskUpdate(job.sectionIdx, job.imageIdx, patch),
            options.signal,
          ),
        })
          .then(({ assetRef, retries }) => {
            options.onTaskUpdate(job.sectionIdx, job.imageIdx, {
              status: 'done', generatedAssetRef: assetRef, error: undefined,
            })
            done++
            totalRetries += retries
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err)
            options.onTaskUpdate(job.sectionIdx, job.imageIdx, {
              status: 'failed', error: msg,
            })
            failed++
          })
          .finally(() => {
            active--
            options.onProgress?.(done, failed, total, totalRetries)
            pump()
            finish()
          })
      }
      finish()
    }

    pump()
  })
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: regenerate a SINGLE image (per-card retry button).
// Also uses credit-safe retry wrapper for consistency.
// ─────────────────────────────────────────────────────────────────────────
export async function regenerateSingleImage(
  pack: LandingPagePack,
  sectionIdx: number,
  imageIdx: number,
  onTaskUpdate: (sectionIdx: number, imageIdx: number, patch: Partial<ImagePrompt>) => void,
): Promise<void> {
  const kieApiKey = getKieKey()
  const section = pack.sections[sectionIdx]
  if (!section) throw new Error(`Section ${sectionIdx} không tồn tại`)
  const prompt = section.imagePrompts?.[imageIdx]
  if (!prompt) throw new Error(`Image ${imageIdx} không tồn tại`)

  onTaskUpdate(sectionIdx, imageIdx, { status: 'generating', error: undefined })
  try {
    // ── Hybrid router for single-image regen as well ─────────────────
    const job = { sectionIdx, imageIdx, prompt, section }
    const { assetRef } = await routeAndExecuteJob(job, {
      pack,
      kieApiKey,
      onTaskUpdate: (patch) => onTaskUpdate(sectionIdx, imageIdx, patch),
      legacyRunner: () => runWithCreditSafeRetry(
        job, pack.visualMemory, kieApiKey,
        (patch) => onTaskUpdate(sectionIdx, imageIdx, patch),
      ),
    })
    onTaskUpdate(sectionIdx, imageIdx, { status: 'done', generatedAssetRef: assetRef, error: undefined })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onTaskUpdate(sectionIdx, imageIdx, { status: 'failed', error: msg })
  }
}
