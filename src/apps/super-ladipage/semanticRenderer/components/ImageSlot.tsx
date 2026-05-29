// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — ImageSlot (P7 placeholder)
//
// Renders dotted-border placeholder for where image would go. No image
// generation. Shows imageRole + aspect ratio for renderer validation.
// ─────────────────────────────────────────────────────────────────────

import { ImageIcon } from 'lucide-react'
import type { ImageRole } from '../../composer'
import type { ImageAspectRatio } from '../../renderContract'

interface ImageSlotProps {
  imageRole: ImageRole
  aspectRatio?: ImageAspectRatio
  characterName?: string
}

/** Convert aspect ratio to padding-bottom % for CSS aspect-ratio fallback. */
function aspectRatioToPaddingBottom(ratio: ImageAspectRatio | undefined): string {
  if (!ratio) return '125%'  // 4:5 default
  const [w, h] = ratio.split(':').map(Number)
  return `${(h / w) * 100}%`
}

/** Plain English label for image role. */
function imageRoleLabel(role: ImageRole): string {
  switch (role) {
    case 'hero-anchor':       return 'Hero — anchor face / identity'
    case 'mood-supporting':   return 'Mood — emotional supporting frame'
    case 'object-trace':      return 'Object — failed attempts flat-lay'
    case 'lifestyle-context': return 'Lifestyle — wide context, daily life'
    case 'proof-callout':     return 'Proof — inline callout (no image)'
    case 'none':              return 'No image — text-only section'
  }
}

export function ImageSlot({ imageRole, aspectRatio, characterName }: ImageSlotProps) {
  // No image for proof-callout or 'none' roles
  if (imageRole === 'none' || imageRole === 'proof-callout') return null

  const paddingBottom = aspectRatioToPaddingBottom(aspectRatio)
  const label = imageRoleLabel(imageRole)

  return (
    <div className="mb-6">
      <div
        className="relative w-full bg-stone-100 border border-dashed border-stone-300 rounded-sm overflow-hidden"
        style={{ paddingBottom }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-500 text-xs gap-2 px-4 text-center">
          <ImageIcon className="h-5 w-5 opacity-60" />
          <span className="font-mono">{label}</span>
          {aspectRatio && <span className="font-mono opacity-60">{aspectRatio}</span>}
          {characterName && imageRole === 'hero-anchor' && (
            <span className="opacity-60 italic">char: {characterName}</span>
          )}
        </div>
      </div>
    </div>
  )
}
