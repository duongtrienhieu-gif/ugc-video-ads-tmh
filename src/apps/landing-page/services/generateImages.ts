import type {
  LandingPagePack, LandingSection, ImagePrompt, SectionType, VisualMemoryItem,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { generateGpt4oImage, type Gpt4oSize } from '../../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../../utils/assetStore'

// ─────────────────────────────────────────────────────────────────────────
// IMAGE GENERATION QUEUE for landing-page packs.
//
// Phase A (generateLandingPack) produces 14 sections with image PROMPTS.
// Phase B (this file) actually generates each image via KIE GPT-image-1,
// passing the user's uploaded VisualMemoryItem refs as filesUrl[] for
// product-focused sections only — people-focused sections (pain, lifestyle,
// social-proof, WhatsApp) generate without product refs so the rendered
// person isn't tethered to the packaging visuals.
//
// Concurrency is capped at 3 to avoid overwhelming the KIE backend and to
// keep per-credit cost predictable for the user.
// ─────────────────────────────────────────────────────────────────────────

// Section types that should be rendered WITH the user's product references.
const PRODUCT_FOCUS_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'hero',
  'product-discovery',
  'ingredients',
  'mechanism',
  'benefits',
  'comparison',   // comparison infographic shows our product
  'offer',
  'final-cta',
])

// Section types that focus on people / lifestyle / chat — do NOT pass product
// refs to avoid the model inserting the product into a candid moment.
const PEOPLE_FOCUS_SECTIONS: ReadonlySet<SectionType> = new Set<SectionType>([
  'pain',
  'failed-solutions',
  'lifestyle',
  'social-proof',
  'whatsapp-testimonials',
  'news-proof',    // news screenshots — no product refs
  'before-after',  // transformation photos — no product refs
])

/** Pick the asset refs (if any) to pass into KIE filesUrl for this section. */
function selectRefsForSection(type: SectionType, memory: VisualMemoryItem[]): string[] {
  if (PEOPLE_FOCUS_SECTIONS.has(type)) return []
  if (PRODUCT_FOCUS_SECTIONS.has(type)) return memory.slice(0, 3).map((m) => m.ref)
  // why-happens, faq → no refs by default (infographic / no image)
  return []
}

/** Convert "4:5" / "1:1" / "9:16" / "16:9" → the closest KIE-supported aspect. */
function toKieAspect(ratio: string): Gpt4oSize {
  if (ratio === '1:1') return '1:1'
  if (ratio === '16:9') return '3:2'  // closest landscape
  // 4:5, 9:16, 2:3, anything portrait
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

/** Generate ONE image via KIE, save the result to the asset store, return the asset ref. */
async function runSingleImage(
  job: ImageJob,
  memory: VisualMemoryItem[],
  kieApiKey: string,
): Promise<string> {
  const refs = selectRefsForSection(job.section.type, memory)
  const filesUrl = await resolveRefs(refs)

  const remoteUrl = await generateGpt4oImage({
    apiKey: kieApiKey,
    prompt: job.prompt.prompt,
    filesUrl: filesUrl.length > 0 ? filesUrl : undefined,
    size: toKieAspect(job.prompt.aspectRatio),
    timeoutMs: 4 * 60 * 1000,
  })

  // Persist returned URL into the asset store so it survives the signed-URL TTL
  if (isAssetRef(remoteUrl)) return remoteUrl
  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`Fetch generated image lỗi: ${resp.status}`)
  const blob = await resp.blob()
  return await saveAsset(blob, blob.type || 'image/png')
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
// onTaskUpdate fires for every status transition so the UI can re-render
// per-image as workers finish. Returns when all jobs settle.
// ─────────────────────────────────────────────────────────────────────────
export async function generatePackImages(
  pack: LandingPagePack,
  options: QueueOptions,
): Promise<void> {
  const kieApiKey = getKieKey()
  const jobs = collectJobs(pack)
  const total = jobs.length
  if (total === 0) return

  // Mark every job as queued up front so the UI shows the spinner state.
  for (const j of jobs) {
    options.onTaskUpdate(j.sectionIdx, j.imageIdx, { status: 'queued', error: undefined })
  }
  let done = 0
  let failed = 0
  options.onProgress?.(done, failed, total)

  const concurrency = options.concurrency ?? 3
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
          // Mark remaining queued jobs as failed so the UI doesn't show
          // permanent spinners.
          for (let i = cursor; i < jobs.length; i++) {
            options.onTaskUpdate(jobs[i].sectionIdx, jobs[i].imageIdx, {
              status: 'failed',
              error: 'Đã huỷ',
            })
          }
          cursor = jobs.length
          finish()
          return
        }

        const job = jobs[cursor++]
        active++
        options.onTaskUpdate(job.sectionIdx, job.imageIdx, { status: 'generating' })

        runSingleImage(job, pack.visualMemory, kieApiKey)
          .then((assetRef) => {
            options.onTaskUpdate(job.sectionIdx, job.imageIdx, {
              status: 'done',
              generatedAssetRef: assetRef,
              error: undefined,
            })
            done++
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err)
            options.onTaskUpdate(job.sectionIdx, job.imageIdx, {
              status: 'failed',
              error: msg,
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
// PUBLIC: regenerate a SINGLE image (used by the per-card retry button).
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
    const assetRef = await runSingleImage(
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
