import type {
  LandingPagePack, LandingSection, ImagePrompt, SectionType, VisualMemoryItem,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { generateGpt4oImage, type Gpt4oSize } from '../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'

// ─────────────────────────────────────────────────────────────────────────
// IMAGE GENERATION QUEUE for landing-page packs.
//
// Fix round — key changes vs previous version:
// 1. social-proof + whatsapp moved to PRODUCT_FOCUS_SECTIONS — they show
//    the product in TikTok/Shopee/selfie/crowd images.
// 2. Product identity lock prefix injected into prompts when refs exist.
// 3. Section-level imageAspectRatio overrides per-image aspectRatio.
// 4. 9:16 removed — only 1:1 and 4:5 (→ '2:3') allowed.
// 5. Retry logic: up to 3 attempts with 5s / 15s backoff.
// 6. Concurrency lowered from 3 → 2 for backend stability.
// ─────────────────────────────────────────────────────────────────────────

// Section types rendered WITH the user's product references.
// Includes social-proof and whatsapp-testimonials — both show the product
// (TikTok/Shopee screenshots have the product image; selfie/crowd show people
// holding the product). Without the ref the model hallucinates a different product.
const PRODUCT_FOCUS_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'hero',
  'product-discovery',
  'ingredients',
  'mechanism',
  'benefits',
  'comparison',
  'social-proof',          // TikTok, Shopee, selfie, crowd — all show the product
  'whatsapp-testimonials', // WhatsApp screenshots include product thumbnail/mention
  'offer',
  'final-cta',
])

// People / lifestyle / editorial — do NOT pass product refs so the model
// doesn't insert the packaging into a candid human moment.
const PEOPLE_FOCUS_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'pain',
  'failed-solutions',
  'lifestyle',
  'news-proof',
  'before-after',
])

// ─────────────────────────────────────────────────────────────────────────
// PRODUCT IDENTITY LOCK — prepend to every prompt that receives product refs.
// Tells the image model to preserve exact packaging, not redesign the product.
// ─────────────────────────────────────────────────────────────────────────
const PRODUCT_IDENTITY_PREFIX =
  'CRITICAL — match the reference product image EXACTLY: ' +
  'preserve the same bottle/packaging shape, label typography, cap style, ' +
  'packaging colors, logo placement and proportions. ' +
  'Do NOT redesign, alter, or replace the product. '

/** Pick the asset refs (if any) to pass into KIE filesUrl for this section. */
function selectRefsForSection(type: SectionType, memory: VisualMemoryItem[]): string[] {
  if (PEOPLE_FOCUS_SECTIONS.has(type)) return []
  if (PRODUCT_FOCUS_SECTIONS.has(type)) return memory.slice(0, 3).map((m) => m.ref)
  return []
}

/**
 * Convert section/prompt aspect ratio → the closest KIE-supported size.
 * Only 1:1 and 4:5 (→ '2:3') are allowed — 9:16 and 16:9 are banned.
 */
function toKieAspect(ratio: string | undefined): Gpt4oSize {
  if (ratio === '1:1') return '1:1'
  // Everything portrait (4:5, 9:16, 2:3, undefined) → 2:3
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
  onProgress?: (done: number, failed: number, total: number) => void
}

// ─────────────────────────────────────────────────────────────────────────
// Core image generation — single attempt (no retry).
// ─────────────────────────────────────────────────────────────────────────
async function runSingleImage(
  job: ImageJob,
  memory: VisualMemoryItem[],
  kieApiKey: string,
): Promise<string> {
  const refs = selectRefsForSection(job.section.type, memory)
  const filesUrl = await resolveRefs(refs)

  // ── Section-level aspect ratio override (fixes #6 / #7) ──────────────
  // Section.imageAspectRatio takes priority over per-image aspectRatio.
  // If neither is set, default to portrait 4:5.
  const effectiveRatio = job.section.imageAspectRatio ?? job.prompt.aspectRatio ?? '4:5'
  const size = toKieAspect(effectiveRatio)

  // ── Product identity lock prefix (fixes #1) ───────────────────────────
  // Prepend lock text whenever product refs are passed so the model doesn't
  // redesign the packaging.
  const prompt = filesUrl.length > 0
    ? PRODUCT_IDENTITY_PREFIX + job.prompt.prompt
    : job.prompt.prompt

  const remoteUrl = await generateGpt4oImage({
    apiKey: kieApiKey,
    prompt,
    filesUrl: filesUrl.length > 0 ? filesUrl : undefined,
    size,
    timeoutMs: 5 * 60 * 1000, // 5 min — generous for KIE queue congestion
  })

  if (isAssetRef(remoteUrl)) return remoteUrl
  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`Fetch generated image lỗi: ${resp.status}`)
  const blob = await resp.blob()
  if (blob.size < 1000) throw new Error('Response image quá nhỏ — có thể bị corrupt')
  return await saveAsset(blob, blob.type || 'image/png')
}

// ─────────────────────────────────────────────────────────────────────────
// Retry wrapper — up to 3 attempts (fixes #4 / #8).
// Backs off 5s then 15s between retries.
// Does NOT retry on credit errors or content-policy failures.
// ─────────────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 3

async function runWithRetry(
  job: ImageJob,
  memory: VisualMemoryItem[],
  kieApiKey: string,
): Promise<string> {
  let lastError: Error | null = null
  const backoffMs = [0, 5_000, 15_000]

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = backoffMs[attempt] ?? 15_000
      console.log(`[LandingPageAI] retry ${attempt}/${MAX_ATTEMPTS - 1} for ${job.prompt.filename} (wait ${delay / 1000}s)`)
      await new Promise((r) => setTimeout(r, delay))
    }
    try {
      return await runSingleImage(job, memory, kieApiKey)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Hard failures — don't waste credits retrying
      if (
        lastError.message === 'INSUFFICIENT_CREDITS' ||
        lastError.message.includes('GENERATE_FAILED') ||
        lastError.message.includes('content_policy') ||
        lastError.message.includes('Đã huỷ')
      ) {
        throw lastError
      }
      console.warn(`[LandingPageAI] attempt ${attempt + 1} failed: ${lastError.message.slice(0, 120)}`)
    }
  }
  throw lastError ?? new Error('Image generation failed after max retries')
}

/** Build the flat list of jobs from a pack. */
function collectJobs(pack: LandingPagePack): ImageJob[] {
  const jobs: ImageJob[] = []
  for (let si = 0; si < pack.sections.length; si++) {
    const section = pack.sections[si]
    if (!section.imagePrompts) continue
    for (let ii = 0; ii < section.imagePrompts.length; ii++) {
      jobs.push({ sectionIdx: si, imageIdx: ii, prompt: section.imagePrompts[ii], section })
    }
  }
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
// PUBLIC: generate all images in a pack with a worker pool.
// Concurrency lowered to 2 (was 3) for better KIE backend stability.
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
  options.onProgress?.(done, failed, total)

  const concurrency = options.concurrency ?? 2 // lowered from 3 → 2 for stability
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

        runWithRetry(job, pack.visualMemory, kieApiKey)
          .then((assetRef) => {
            options.onTaskUpdate(job.sectionIdx, job.imageIdx, {
              status: 'done', generatedAssetRef: assetRef, error: undefined,
            })
            done++
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
            options.onProgress?.(done, failed, total)
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
// Also uses retry wrapper for consistency.
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
    const assetRef = await runWithRetry(
      { sectionIdx, imageIdx, prompt, section },
      pack.visualMemory,
      kieApiKey,
    )
    onTaskUpdate(sectionIdx, imageIdx, { status: 'done', generatedAssetRef: assetRef, error: undefined })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onTaskUpdate(sectionIdx, imageIdx, { status: 'failed', error: msg })
  }
}
