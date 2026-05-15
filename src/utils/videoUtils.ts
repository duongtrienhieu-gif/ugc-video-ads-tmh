/**
 * Extract a frame from a video File at the given time (in seconds).
 * Returns a JPEG Blob suitable for upload to image-based APIs (e.g. lip-sync).
 */
export async function extractFrameFromVideo(
  file: File,
  timeSec: number = 0.5,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video    = document.createElement('video')
    const blobUrl  = URL.createObjectURL(file)
    video.src      = blobUrl
    video.muted    = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'

    const cleanup = () => URL.revokeObjectURL(blobUrl)

    video.onloadedmetadata = () => {
      // Clamp to safe time inside duration
      const t = Math.min(timeSec, Math.max(0, (video.duration || 1) - 0.1))
      video.currentTime = t
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { cleanup(); reject(new Error('Không khởi tạo được canvas')); return }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          cleanup()
          if (!blob) { reject(new Error('Không trích được khung hình')); return }
          resolve(blob)
        }, 'image/jpeg', 0.92)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    video.onerror = () => {
      cleanup()
      reject(new Error('Không đọc được file video'))
    }
  })
}

/**
 * Extract a frame from a video accessible by URL (e.g. signed Supabase URL).
 */
export async function extractFrameFromVideoUrl(
  url: string,
  timeSec: number = 0.5,
): Promise<Blob> {
  const res = await fetch(url)
  const blob = await res.blob()
  const file = new File([blob], 'video.mp4', { type: blob.type || 'video/mp4' })
  return extractFrameFromVideo(file, timeSec)
}
