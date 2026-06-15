import { Film, ImageOff } from 'lucide-react'
import { useAssetUrl } from '../../../hooks/useAssetUrl'

// Thumbnail nhỏ cho 1 asset (ảnh/video). Resolve assetRef → signed URL qua
// useAssetUrl (xử lý cả asset-UUID lẫn URL trực tiếp).
export default function MediaThumb({
  assetRef, mediaType = 'image', className = '',
}: {
  assetRef: string
  mediaType?: 'image' | 'video'
  className?: string
}) {
  const url = useAssetUrl(assetRef)

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-black/[0.04] text-gray-300 ${className}`}>
        <ImageOff className="h-5 w-5" strokeWidth={1.5} />
      </div>
    )
  }

  if (mediaType === 'video') {
    return (
      <div className={`relative overflow-hidden bg-black ${className}`}>
        <video src={url} className="h-full w-full object-cover" muted playsInline />
        <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white">
          <Film className="h-2.5 w-2.5" /> Video
        </span>
      </div>
    )
  }

  return (
    <img src={url} alt="" className={`object-cover ${className}`} />
  )
}
