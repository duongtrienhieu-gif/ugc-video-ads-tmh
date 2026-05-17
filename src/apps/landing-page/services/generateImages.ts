import type {
  LandingPagePack, LandingSection, ImagePrompt, SectionType, VisualMemoryItem,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import {
  submitGpt4oImage, pollGpt4oUntilDone, type Gpt4oSize,
} from '../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'

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
// PRODUCT IDENTITY LOCK — Z22 NARROW LOCK POLICY.
//
// Previously this prefix locked too much (composition, lighting, hand, room).
// Result: KIE rendered every image with the same hand pose / same background /
// same bottle angle → obvious AI-clone look that users spot instantly.
//
// New policy: lock ONLY the product identity (label / logo / bottle shape).
// EXPLICITLY allow every other axis to vary so the section feels like real
// customer photos taken on different days in different rooms.
// ─────────────────────────────────────────────────────────────────────────
// Z23 — compressed from ~700 chars to ~280. Same semantic content, fewer
// tokens for KIE to process = faster response.
const PRODUCT_IDENTITY_PREFIX =
  'PRODUCT LOCK: match reference EXACTLY on brand text, label typography/colors, bottle shape, cap, logo. VARY freely: background, hand pose, lighting, camera angle, bottle rotation. Use the exact brand from reference — no fake brand substitution. Do not redesign the label.'

// ─────────────────────────────────────────────────────────────────────────
// SECTION-1 HERO CHARACTER LOCK — Malaysian Muslim hijab women only.
// Brand persona consistency across hero variants. No men, no Western faces,
// no Chinese influencer aesthetic.
// ─────────────────────────────────────────────────────────────────────────
// Z23 — compressed from ~330 to ~150 chars.
const HERO_CHARACTER_LOCK =
  'CHARACTER: Malaysian Muslim woman in modest hijab, mid-30s, Southeast-Asian features, warm UGC selfie aesthetic. NO men, NO Western/Chinese/Korean faces. '

// ─────────────────────────────────────────────────────────────────────────
// Z22 — DIVERSITY ENGINE: 4 axis pools rotated deterministically per image.
//
// For a section with N images, this picks N DIFFERENT combinations of
// (background, camera angle, hand pose, lighting) by hashing
// `${sectionType}-${imageIdx}-${variationSeed}`. KIE receives an explicit
// "shot this scene at <angle>, in <background>, with <hand>, in <lighting>"
// directive per image so latents diverge.
//
// Pools are deliberately wide. The hash-mod indexing guarantees no two
// adjacent images in the same section pick the same axis value.
// ─────────────────────────────────────────────────────────────────────────

const BG_POOL = [
  'home kitchen counter with morning sunlight',
  'wooden dining table with breakfast nearby',
  'minimal white desk with notebook',
  'living room sofa corner with cushions',
  'cafe table with coffee cup beside',
  'marble bathroom countertop with towel',
  'bedroom bedside with plant and soft daylight',
  'home office desk with laptop edge in frame',
  'balcony garden corner with leaves softly out of focus',
  'sunlit windowsill with sheer curtain',
  'restaurant table with food blurred behind',
  'car passenger seat with daylight through window',
  'picnic blanket outdoor warm light',
  'shelf-edge with books and small plant',
  'open shopfront with natural ambient light',
]

const ANGLE_POOL = [
  'iPhone selfie eye-level',
  'slight low-angle 30° hand-held',
  '3/4 angle waist-height',
  'top-down flat-lay',
  'side-profile slice with shallow DOF',
  'over-the-shoulder POV',
  'first-person reach toward camera',
  'mirror reflection shot',
  'macro close-up of label',
  'wide environmental lifestyle shot',
]

const HAND_POOL = [
  'one hand cradling the product at chest',
  'both hands lifting the product to face',
  'pointing index finger at the label',
  'product resting on palm of open hand',
  'no hands — product on a real surface',
  'hand on belly / chest area, product beside',
  'reaching toward camera with product',
  'product gripped at the neck with thumb on cap',
]

const LIGHT_POOL = [
  'soft window daylight from left',
  'warm kitchen-side glow with golden hour bounce',
  'overhead noon natural light',
  'cool morning bathroom diffused light',
  'dim cozy table-lamp evening',
  'mixed window + ceiling light',
  'soft overcast diffused window light',
  'late afternoon side-warmth from right window',
]

// Z24 — COMPOSITION POOL. Root cause of "all 4 WhatsApp attachments show
// box + bottle side by side" was that KIE was mimicking the composition of
// the reference product image. By injecting an explicit composition
// directive per render, we force the model to pick a DIFFERENT physical
// arrangement of the product in each shot — not always packshot+bottle
// side-by-side.
const COMPOSITION_POOL = [
  'single bottle only (no box) held casually',
  'single bottle only on a real surface, no packaging box',
  '2 bottles together standing on a table — no box',
  '3-4 bottles grouped casually (family pack feel) — no box',
  'bottle on a dining table with breakfast/meal nearby',
  'bottle in the kitchen next to fresh produce / fruit',
  'bottle peeking out of a handbag or tote',
  'bottle on a bathroom shelf with personal items',
  'bottle on an office desk next to laptop edge',
  'bottle handheld close-up showing only label and one hand',
  'casual selfie of person holding a single bottle',
  'unpacking-style shot: bottle just removed from torn paper / box discarded behind',
  'bottle on a messy real kitchen counter (slightly cluttered, lived-in)',
  'bottle outdoors (balcony / picnic / cafe) in natural light',
]

/** Tiny deterministic hash → index into a pool. */
function hashPick<T>(pool: T[], seed: string, salt: number): T {
  let h = 0
  const s = `${seed}::${salt}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return pool[h % pool.length]
}

/** 6-char random token appended to every prompt to force latent drift. */
function makeVariationSeed(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** Z22 — per-image diversity directive.
 *  Suppressed for `before-after` (which has its own same-scene lock spec
 *  written by Gemini into the imagePrompt body). */
// Sections where the diversity directive is suppressed because the
// section spec already mandates a specific structure (same-scene lock,
// app screenshot recreation, etc.). Mixing in a "random composition"
// directive would fight the structural intent.
const DIVERSITY_SUPPRESSED_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'before-after',          // same-scene lock per pair
  'social-proof',          // FB/TikTok/Shopee screenshot recreation
  'whatsapp-testimonials', // pure screenshot vs attached-photo split
  'news-proof',            // news article screenshot recreation
])

// Z24 — diversity directive with COMPOSITION axis added. Suppressed for
// sections where structure is locked by spec (see set above).
//
// Phase 3 — when pack.form === 'advertorial' AND pack.characterProfile is
// set, the diversity directive is REPLACED by a character-continuity
// directive: same person, same environment, varying ONLY by emotional
// state per section. The COMPOSITION_POOL/BG_POOL/etc shotgun approach
// would fight the storytelling intent (we WANT the same room across
// sections — that's the whole point of "kể chuyện hành trình").
function buildDiversityDirective(job: ImageJob): string {
  // Storytelling override — character lock, no random pool
  if (job.pack.form === 'advertorial' && job.pack.characterProfile) {
    return buildStorytellingContinuityDirective(job)
  }
  if (DIVERSITY_SUPPRESSED_SECTIONS.has(job.section.type)) return ''
  if (!job.prompt.variationSeed) job.prompt.variationSeed = makeVariationSeed()
  const seed = `${job.section.type}-${job.imageIdx}-${job.prompt.variationSeed}`
  const composition = hashPick(COMPOSITION_POOL, seed, 0)
  const bg          = hashPick(BG_POOL,          seed, 1)
  const angle       = hashPick(ANGLE_POOL,       seed, 2)
  const hand        = hashPick(HAND_POOL,        seed, 3)
  const light       = hashPick(LIGHT_POOL,       seed, 4)
  return `COMPOSITION: ${composition}. SHOT: ${angle}, in ${bg}, ${hand}, ${light}. Render as INDEPENDENT phone photo — do not mimic the side-by-side box+bottle composition of the reference image; pick the COMPOSITION above. Seed: ${job.prompt.variationSeed}.`
}

/** Phase 3 — character continuity directive for the advertorial form.
 *  Pastes the locked appearance + environment + per-section mood verbatim
 *  into every people-shot prompt so KIE produces the same person across
 *  the entire pack. */
function buildStorytellingContinuityDirective(job: ImageJob): string {
  const char = job.pack.characterProfile
  if (!char) return ''
  const arc = char.emotionalArc.find((e) => e.sectionType === job.section.type)
  const mood = arc?.mood ?? 'natural neutral expression'
  return (
    `CHARACTER CONTINUITY LOCK (advertorial form — same person every shot):\n`
    + `  • Person: ${char.name} — ${char.archetype}\n`
    + `  • Appearance (KEEP EXACT across all renders in this pack): ${char.appearanceLock}\n`
    + `  • Environment (consistent home/room across the pack): ${char.environmentLock}\n`
    + `  • Mood for this section (${job.section.type}): ${mood}\n`
    + `  • Cinematic lifestyle photography — documentary feel, natural skin texture, soft DOF. NO studio glamour. NO commercial gloss. NO designed text overlays (except SEBELUM/SELEPAS labels on before-after pair if section type is before-after).\n`
    + `  • DO NOT introduce a different woman. DO NOT change face / hair / hijab style / outfit family between sections — only mood + posture + light vary.`
  )
}

// Z24 — strengthened negatives per user list. Covers all known failure
// modes: clone composition, fake UI, poster/infographic look, etc.
const NEGATIVE_PROMPT_BLOCK =
  'AVOID HARD: poster or infographic layout; centered symmetrical composition; floating cut-out product PNG over a background; stacked product composites; duplicated background or hand pose across renders; cinematic / studio / luxury / editorial look; AI-glossy hyper-perfect skin; fake or futuristic UI; fake typography; overdesigned spacing; ecommerce advertisement look; fake brand text substitution; box and bottle always side-by-side as the only composition.'

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
  /** Phase 3 — pack reference so form-aware logic (character continuity,
   *  per-form image strategy) can read pack.form + pack.characterProfile
   *  without threading extra params through every helper. */
  pack: LandingPagePack
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
// ─────────────────────────────────────────────────────────────────────────
function buildFinalPrompt(job: ImageJob, hasProductRefs: boolean): string {
  const parts: string[] = []
  // Hero gets the default UGC-Malaysia character lock UNLESS the pack
  // declares its own character profile (advertorial storytelling form).
  // Storytelling's per-section continuity directive (further down) covers
  // the character spec — stacking both would conflict ("hijab Muslim
  // woman" vs character.archetype="Chinese woman").
  const hasCharacterProfile = !!job.pack.characterProfile
  if (job.section.type === 'hero' && !hasCharacterProfile) {
    parts.push(HERO_CHARACTER_LOCK)
  }
  if (hasProductRefs) parts.push(PRODUCT_IDENTITY_PREFIX)
  parts.push(job.prompt.prompt)

  // Z22 — per-image diversity directive (replaced by continuity directive
  // for advertorial form via buildDiversityDirective branch logic).
  const diversity = buildDiversityDirective(job)
  if (diversity) parts.push(diversity)

  // Z22 — hard negatives appended on every render
  parts.push(NEGATIVE_PROMPT_BLOCK)

  return parts.join('\n\n')
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
// Z23 — tighter timeouts so a single stuck KIE task no longer drags the
// whole queue. Typical KIE GPT-4o render: 40-75s. We give 100s (FRESH) for
// the first attempt; if that times out, recovery-poll the SAME taskId for
// another 30s; otherwise re-submit. MAX_ATTEMPTS dropped 4→2 so we fail
// fast on broken tasks and free the slot for the next image. Same credit
// safety semantics (recovery-poll before re-submit).
const MAX_ATTEMPTS     = 2
const RECOVERY_POLL_MS = 30_000   // was 60s
const FRESH_POLL_MS    = 100_000  // was 5min

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
      jobs.push({ pack, sectionIdx: si, imageIdx: ii, prompt: section.imagePrompts[ii], section })
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
  // Z23 — concurrency 6 → 8. KIE backend tolerates 8 parallel /gpt4o-image
  // submissions; bottleneck is per-image latency, not API rate limit.
  const concurrency = options.concurrency ?? 8
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

        runWithCreditSafeRetry(
          job,
          pack.visualMemory,
          kieApiKey,
          (patch) => options.onTaskUpdate(job.sectionIdx, job.imageIdx, patch),
          options.signal,
        )
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
    const { assetRef } = await runWithCreditSafeRetry(
      { pack, sectionIdx, imageIdx, prompt, section },
      pack.visualMemory,
      kieApiKey,
      (patch) => onTaskUpdate(sectionIdx, imageIdx, patch),
    )
    onTaskUpdate(sectionIdx, imageIdx, { status: 'done', generatedAssetRef: assetRef, error: undefined })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onTaskUpdate(sectionIdx, imageIdx, { status: 'failed', error: msg })
  }
}
