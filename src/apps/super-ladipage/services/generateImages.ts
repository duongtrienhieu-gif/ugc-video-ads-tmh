import type { LandingPagePack, ImagePrompt } from '../types'

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — Pass 2: sinh ảnh thật từ image prompts.
//
// PHASE 2 STUB — sẽ rebuild đầy đủ ở Phase 3.
//
// Plan Phase 3:
//   1. Queue concurrency (vd 6 song song)
//   2. Primary provider: KIE (giữ pattern cũ vì có key sẵn)
//   3. Fallback: FAL (utils/falai.ts đã có wrapper) — auto switch khi
//      KIE fail 2 lần
//   4. Credit reserve trước call, refund khi fail
//   5. Update từng asset real-time qua onTaskUpdate
//   6. Cancellable qua AbortSignal
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

export async function generatePackImages(
  _pack: LandingPagePack,
  _opts: BatchOptions = {},
): Promise<void> {
  throw new Error(
    'Super Ladipage Pass 2 (batch image generation) chưa được implement. ' +
    'Phase 3 sẽ rebuild với queue + KIE primary + FAL fallback.',
  )
}

export async function regenerateSingleImage(
  _pack: LandingPagePack,
  _sectionIdx: number,
  _imageIdx: number,
  _onTaskUpdate?: (
    sectionIdx: number,
    imageIdx: number,
    patch: Partial<ImagePrompt>,
  ) => void,
): Promise<void> {
  throw new Error(
    'Super Ladipage regenerateSingleImage chưa được implement. ' +
    'Phase 3 sẽ rebuild với KIE + FAL fallback.',
  )
}
