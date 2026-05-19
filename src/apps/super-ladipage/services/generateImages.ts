import type { LandingPagePack, ImagePrompt } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { generateImageGptImage1 } from '../providers/kieGptImage1'

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — Pass 2: sinh ảnh thật.
//
// Single provider: KIE gpt-image-2 (1K, 6 credit/ảnh).
// Queue concurrency 6. Retry 1 lần được handle bởi provider.
// AbortSignal hỗ trợ user hủy.
// ─────────────────────────────────────────────────────────────────────

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

  onUpdate?.(sIdx, iIdx, { status: 'generating', error: undefined })

  try {
    const { assetRef } = await generateImageGptImage1({
      apiKey,
      prompt: prompt.prompt,
      aspectRatio: (prompt.aspectRatio as '1:1' | '4:5' | '16:9' | '9:16') || (section.imageAspectRatio as '1:1' | '4:5' | '16:9' | '9:16') || '4:5',
      referenceAssetRefs,
      signal,
    })
    onUpdate?.(sIdx, iIdx, {
      status: 'done',
      generatedAssetRef: assetRef,
      error: undefined,
    })
    return 'done'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onUpdate?.(sIdx, iIdx, {
      status: 'failed',
      error: msg,
    })
    return 'failed'
  }
}

async function runQueue(
  targets: Target[],
  pack: LandingPagePack,
  apiKey: string,
  opts: BatchOptions,
): Promise<{ done: number; failed: number }> {
  const concurrency = opts.concurrency ?? 6
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
  const prompt = section.imagePrompts[imageIdx]
  if (!prompt) throw new Error(`Image index ${imageIdx} trong section ${sectionIdx} không tồn tại`)

  await runSingle(
    { sIdx: sectionIdx, iIdx: imageIdx, prompt },
    pack,
    apiKey,
    undefined,
    onTaskUpdate,
  )
}
