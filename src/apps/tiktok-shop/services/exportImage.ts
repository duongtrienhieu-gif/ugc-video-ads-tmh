// Export a Konva Stage to a Blob (JPEG) and optionally save to Supabase Storage.
// Used by:
//   • SlotPreview "Download" button → triggers browser save
//   • Phase 3 generate flow → saves to IndexedDB-backed assetStore

import type Konva from 'konva'
import { saveAsset } from '../../../utils/assetStore'

export interface ExportOptions {
  quality?: number      // 0..1 — default 0.92
  mimeType?: string     // 'image/jpeg' | 'image/png' — default jpeg (smaller)
  pixelRatio?: number   // upscale factor; 1 = native stage size
}

/** Export the stage to a Blob. Caller decides what to do with it. */
export async function stageToBlob(
  stage: Konva.Stage,
  options: ExportOptions = {},
): Promise<Blob> {
  const { quality = 0.92, mimeType = 'image/jpeg', pixelRatio = 1 } = options

  // stage.toCanvas() returns the native canvas — toBlob is async via callback.
  const canvas = stage.toCanvas({ pixelRatio })
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob returned null'))
      },
      mimeType,
      quality,
    )
  })
}

/** Save the stage as an asset → returns assetId for storing in ListingImage. */
export async function stageToAsset(
  stage: Konva.Stage,
  options: ExportOptions = {},
): Promise<string> {
  const blob = await stageToBlob(stage, options)
  return saveAsset(blob, options.mimeType ?? 'image/jpeg')
}

/** Trigger a browser download of the stage as a JPEG file. */
export async function downloadStage(stage: Konva.Stage, filename: string, options: ExportOptions = {}): Promise<void> {
  const blob = await stageToBlob(stage, options)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png')
      ? filename
      : `${filename}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(url)
  }
}
