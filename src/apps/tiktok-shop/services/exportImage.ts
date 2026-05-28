// Image export — Phase 6 simplified.
// Without canvas, "export" is just fetching the saved image URL and either
// triggering a browser download or returning the blob.

import { getUrl } from '../../../utils/assetStore'

/** Download the image at this assetId as a JPG file. */
export async function downloadAssetAsImage(assetId: string, filename: string): Promise<void> {
  const url = await getUrl(assetId)
  if (!url) throw new Error('Không tìm thấy ảnh trong storage')

  // Fetch the binary so we can give it a proper filename via Blob URL
  // (otherwise the download would inherit the supabase signed URL's name).
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Tải ảnh thất bại: ${res.status}`)
  const blob = await res.blob()

  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png')
      ? filename
      : `${filename}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
