import type { LandingPagePack, ImagePrompt } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { generateImageGptImage1 } from '../providers/kieGptImage1'

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — Pass 2: sinh ảnh thật.
//
// Single provider: KIE gpt-image-2 (1K, 6 credit/ảnh).
// Phase 1 stability freeze: concurrency 2 (caller override = 2).
// Reduces KIE burst load; improves timeout/fail rate during migration.
// Retry hybrid (timeout → same prompt, Policy → softened prompt)
// handled bởi provider. AbortSignal hỗ trợ user hủy.
//
// P10 (watchdog): provider call wrapped với 180s timer per attempt.
// Nếu stall (no callback / ghost job) → retry ONCE same payload.
// Real provider errors (Policy/4xx/5xx) → no double-retry (provider có
// internal retry; double = burn credit). Max wall time per image = 360s.
// ─────────────────────────────────────────────────────────────────────

const WATCHDOG_TIMEOUT_MS = 180_000  // 180s per attempt

// ── HOTFIX prompt cũ khi REGEN 1 ẢNH ─────────────────────────────────────────
// Pack cũ lưu prompt STRING (không lưu concept) nên regen xài lại prompt cũ →
// không ăn fix recipe. Hàm này nâng cấp TẠI CHỖ đúng ảnh người recipe-A dính bug
// "nuốt chữ" (nhận diện qua VISUAL_MODE cũ) để user sửa CHỈ hero, khỏi tạo pack mới.
// Idempotent (đã hardened thì bỏ qua) + CHỈ đụng recipe-A, không phá recipe khác.
const OLD_UGC_SOCIAL_VM = 'VISUAL_MODE: authentic person, natural framing, ecommerce overlay badges'
function hardenTextBake(prompt: string): string {
  if (!prompt.includes(OLD_UGC_SOCIAL_VM) || prompt.includes('TEXT IS MANDATORY')) return prompt
  let p = prompt.replace(
    OLD_UGC_SOCIAL_VM,
    'VISUAL_MODE: authentic person, natural pose, in a POLISHED ECOMMERCE AD CREATIVE with bold text headline + solid pill badges composited on top (NOT a plain candid snapshot)',
  )
  p = p.replace(/position=overlay-on-product/g, 'position=floating pill in an empty frame area (a corner/side gap), NOT on the small product')
  return `${p}\n\nSTRICT — TEXT IS MANDATORY: this is a high-converting ECOMMERCE AD CREATIVE, NOT a plain candid photo. EVERY line in the TEXT block above MUST be rendered INTO the image, spelled EXACTLY (same language as the TEXT block), bold and clearly legible. Headline = LARGE and dominant across the TOP. Badges = solid pill floating in empty frame areas. Do NOT output a text-free photo.`
}

export interface BatchOptions {
  concurrency?: number
  signal?: AbortSignal
  onTaskUpdate?: (
    sectionIdx: number,
    imageIdx: number,
    patch: Partial<ImagePrompt>,
  ) => void
  onProgress?: (
    done: number,
    failed: number,
    total: number,
    retries: number,
  ) => void
}

interface Target {
  sIdx: number
  iIdx: number
  prompt: ImagePrompt
}

function collectTargets(pack: LandingPagePack, predicate: (p: ImagePrompt) => boolean): Target[] {
  const out: Target[] = []
  pack.sections.forEach((s, sIdx) => {
    s.imagePrompts?.forEach((p, iIdx) => {
      if (predicate(p)) out.push({ sIdx, iIdx, prompt: p })
    })
  })
  return out
}

async function runSingle(
  target: Target,
  pack: LandingPagePack,
  apiKey: string,
  signal: AbortSignal | undefined,
  onUpdate: BatchOptions['onTaskUpdate'],
): Promise<'done' | 'failed'> {
  const { sIdx, iIdx, prompt } = target
  const section = pack.sections[sIdx]
  const referenceAssetRefs = pack.visualMemory.slice(0, 3).map((v) => v.ref)

  const providerArgs = {
    apiKey,
    prompt: prompt.prompt,
    aspectRatio: (prompt.aspectRatio as '1:1' | '4:5' | '16:9' | '9:16') || (section.imageAspectRatio as '1:1' | '4:5' | '16:9' | '9:16') || '4:5',
    referenceAssetRefs,
    // P5 hybrid routing — derive ở orchestrator từ spec.productPolicy.
    // Default true (gpt-4o-image i2i) cho fail-safe nếu field missing.
    useImageToImage: prompt.useImageToImage ?? true,
    signal,
  }

  // P10 watchdog: race provider call against 180s timer. If stall (no
  // callback / ghost job), reject with WATCHDOG_STALL — caller retries once.
  const tryOnce = (label: string) =>
    new Promise<{ assetRef: string }>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`WATCHDOG_STALL ${label}`))
      }, WATCHDOG_TIMEOUT_MS)
      generateImageGptImage1(providerArgs).then(
        (val) => { clearTimeout(timer); resolve(val) },
        (err) => { clearTimeout(timer); reject(err) },
      )
    })

  onUpdate?.(sIdx, iIdx, { status: 'generating', error: undefined })

  // Attempt 1
  try {
    const { assetRef } = await tryOnce(`s${sIdx}/i${iIdx}`)
    onUpdate?.(sIdx, iIdx, { status: 'done', generatedAssetRef: assetRef, error: undefined })
    return 'done'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Only retry on watchdog stall. Real provider errors (Policy/4xx/5xx)
    // → no double-retry (provider has internal retry; doubling burns credit).
    if (!msg.startsWith('WATCHDOG_STALL')) {
      onUpdate?.(sIdx, iIdx, { status: 'failed', error: msg })
      return 'failed'
    }
    // fall through to retry
    console.warn(`[watchdog] s${sIdx}/i${iIdx} stalled >${WATCHDOG_TIMEOUT_MS / 1000}s — retrying once`)
  }

  // Attempt 2 — same payload, fresh watchdog
  try {
    const { assetRef } = await tryOnce(`s${sIdx}/i${iIdx} (retry)`)
    onUpdate?.(sIdx, iIdx, { status: 'done', generatedAssetRef: assetRef, error: undefined })
    return 'done'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onUpdate?.(sIdx, iIdx, { status: 'failed', error: `Watchdog: ${msg}` })
    return 'failed'
  }
}

async function runQueue(
  targets: Target[],
  pack: LandingPagePack,
  apiKey: string,
  opts: BatchOptions,
): Promise<{ done: number; failed: number }> {
  const concurrency = opts.concurrency ?? 2
  let done = 0
  let failed = 0
  let cursor = 0

  // Initial progress fire
  opts.onProgress?.(0, 0, targets.length, 0)

  return new Promise((resolve) => {
    let active = 0
    const pump = () => {
      while (active < concurrency && cursor < targets.length) {
        if (opts.signal?.aborted) {
          if (active === 0) resolve({ done, failed })
          return
        }
        const target = targets[cursor++]
        active++
        runSingle(target, pack, apiKey, opts.signal, opts.onTaskUpdate)
          .then((status) => {
            if (status === 'done') done++
            else failed++
          })
          .catch(() => { failed++ })
          .finally(() => {
            active--
            opts.onProgress?.(done, failed, targets.length, 0)
            if (cursor >= targets.length && active === 0) {
              resolve({ done, failed })
            } else {
              pump()
            }
          })
      }
    }
    pump()
  })
}

export async function generatePackImages(
  pack: LandingPagePack,
  opts: BatchOptions = {},
): Promise<void> {
  const settings = useSettingsStore.getState()
  if (!settings.hasApiKey()) {
    throw new Error('Vui lòng nhập kie.ai API key trong Cài đặt.')
  }
  const apiKey = settings.getApiKey()

  const targets = collectTargets(pack, () => true)
  if (targets.length === 0) return

  await runQueue(targets, pack, apiKey, opts)
}

export async function regenerateSingleImage(
  pack: LandingPagePack,
  sectionIdx: number,
  imageIdx: number,
  onTaskUpdate?: (
    sectionIdx: number,
    imageIdx: number,
    patch: Partial<ImagePrompt>,
  ) => void,
): Promise<void> {
  const settings = useSettingsStore.getState()
  if (!settings.hasApiKey()) {
    throw new Error('Vui lòng nhập kie.ai API key trong Cài đặt.')
  }
  const apiKey = settings.getApiKey()

  const section = pack.sections[sectionIdx]
  if (!section) throw new Error(`Section index ${sectionIdx} không tồn tại`)
  const stored = section.imagePrompts[imageIdx]
  if (!stored) throw new Error(`Image index ${imageIdx} trong section ${sectionIdx} không tồn tại`)
  // Nâng cấp prompt cũ (ảnh người nuốt chữ) TẠI CHỖ để regen 1 ảnh ăn fix, khỏi tạo pack mới.
  const prompt: ImagePrompt = { ...stored, prompt: hardenTextBake(stored.prompt) }

  await runSingle(
    { sIdx: sectionIdx, iIdx: imageIdx, prompt },
    pack,
    apiKey,
    undefined,
    onTaskUpdate,
  )
}
