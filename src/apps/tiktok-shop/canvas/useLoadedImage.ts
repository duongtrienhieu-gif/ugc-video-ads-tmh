// Loads an image URL into a HTMLImageElement that React-Konva can render
// via <Image image={loaded}>. Returns null while loading or on error.

import { useEffect, useState } from 'react'

export function useLoadedImage(src: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) { setImg(null); return }
    const image = new window.Image()
    // Required for Supabase signed-URL images to be exportable via canvas.toBlob()
    // without tainting the canvas.
    image.crossOrigin = 'anonymous'
    let alive = true
    image.onload = () => { if (alive) setImg(image) }
    image.onerror = () => { if (alive) setImg(null) }
    image.src = src
    return () => {
      alive = false
      image.onload = null
      image.onerror = null
    }
  }, [src])

  return img
}
