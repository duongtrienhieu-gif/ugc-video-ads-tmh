// ListingCanvas — Konva Stage wrapper that composes ALL layers of one slot.
// Tier 1 (header + footer)  always on.
// Tier 2 (atmosphere)       chosen per slot via image.config.atmosphere.
// Tier 3 (slot content)     dispatched to the slot-specific component.
//
// Native render size is 1080×1080 — `displayWidth` prop scales the visible
// stage down for previews without losing internal coordinate fidelity.

import { forwardRef, useEffect, useState } from 'react'
import { Stage, Layer, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { ListingImage, PaletteFamily } from '../types'
import type { ResolvedBrandKit } from '../../../types/brandKit'
import { TPCN_PALETTES } from '../constants'
import { ensureCanvasFontsLoaded } from '../services/fonts'
import { getUrl } from '../../../utils/assetStore'
import { CANVAS_SIZE } from './layout'
import AtmosphereBackground, { getAtmosphereTextMode } from './AtmosphereBackground'
import HeaderStrip from './HeaderStrip'
import FooterTrustBar from './FooterTrustBar'
import Slot1Hero from './slots/Slot1Hero'
import Slot2Pain from './slots/Slot2Pain'
import Slot3Result from './slots/Slot3Result'
import Slot4USP from './slots/Slot4USP'
import Slot5Social from './slots/Slot5Social'
import Slot6Usage from './slots/Slot6Usage'
import Slot7Compare from './slots/Slot7Compare'
import Slot8Offer from './slots/Slot8Offer'
import Slot9FAQ from './slots/Slot9FAQ'
import { useLoadedImage } from './useLoadedImage'

interface Props {
  image: ListingImage
  paletteFamily: PaletteFamily
  brandKit: ResolvedBrandKit
  /** Optional override scene image — used in Phase 2 when no AI-gen yet:
   *  pass the first reference photo as a stand-in product. */
  fallbackSceneUrl?: string | null
  /** Visible width in CSS pixels. Defaults to native 1080. */
  displayWidth?: number
  /** Mount as listening (interactive) or non-listening (faster). */
  listening?: boolean
}

const ListingCanvas = forwardRef<Konva.Stage, Props>(function ListingCanvas(
  { image, paletteFamily, brandKit, fallbackSceneUrl, displayWidth = CANVAS_SIZE, listening = true },
  ref,
) {
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    let alive = true
    ensureCanvasFontsLoaded().then(() => { if (alive) setFontsReady(true) })
    return () => { alive = false }
  }, [])

  // Resolve AI-generated scene URL (Phase 3+). When present, it REPLACES the
  // atmosphere gradient and product placeholder — becomes the full background.
  const [aiSceneUrl, setAiSceneUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!image.imageAssetId) { setAiSceneUrl(null); return }
    let alive = true
    getUrl(image.imageAssetId)
      .then((u) => { if (alive) setAiSceneUrl(u) })
      .catch(() => { if (alive) setAiSceneUrl(null) })
    return () => { alive = false }
  }, [image.imageAssetId])
  const aiSceneImage = useLoadedImage(aiSceneUrl)
  const hasAiScene = !!aiSceneImage

  const palette = TPCN_PALETTES[paletteFamily]
  const textMode = getAtmosphereTextMode(image.config.atmosphere)
  // When AI scene exists we can't know its dominant tone — default to white text
  // with strong shadow for safety. Slot prompt asks AI to leave dark/light
  // areas in top/bottom for text overlay zones.
  const textColor = hasAiScene ? '#FFFFFF' : (textMode === 'light' ? '#FFFFFF' : palette.primary)
  const accentColor = hasAiScene ? palette.cta : (textMode === 'light' ? '#FFFFFF' : palette.primary)

  // Phase 2 fallback: when no AI scene yet, use first ref image as placeholder
  // product. When AI scene IS present, slot content skips its placeholder.
  const sceneImageUrl = hasAiScene ? null : (fallbackSceneUrl ?? null)

  const scale = displayWidth / CANVAS_SIZE

  // Don't render until fonts are loaded — otherwise first frame draws with
  // a system font and Konva caches the wrong metrics.
  if (!fontsReady) {
    return (
      <div
        style={{
          width: displayWidth,
          height: displayWidth,
          background: palette.secondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: palette.primary,
          fontSize: 12,
          fontFamily: 'system-ui',
        }}
      >
        Đang tải fonts…
      </div>
    )
  }

  return (
    <Stage
      ref={ref}
      width={displayWidth}
      height={displayWidth}
      scaleX={scale}
      scaleY={scale}
      listening={listening}
    >
      <Layer listening={listening}>
        {/* Tier 2 — background: AI scene if generated, else atmosphere gradient */}
        {hasAiScene ? (
          <KonvaImage
            image={aiSceneImage}
            x={0} y={0}
            width={CANVAS_SIZE} height={CANVAS_SIZE}
          />
        ) : (
          <AtmosphereBackground atmosphere={image.config.atmosphere} palette={palette} />
        )}

        {/* Tier 3 — slot-specific content overlays (text + decoration on top of bg) */}
        {image.config.slot === 1 && (
          <Slot1Hero
            overlay={image.overlay}
            textColor={textColor}
            accentColor={accentColor}
            sceneImageUrl={sceneImageUrl}
            hidePlaceholder={hasAiScene}
          />
        )}
        {image.config.slot === 2 && (
          <Slot2Pain overlay={image.overlay} textColor={textColor} accentColor={accentColor} />
        )}
        {image.config.slot === 3 && (
          <Slot3Result overlay={image.overlay} textColor={textColor} accentColor={accentColor} />
        )}
        {image.config.slot === 4 && (
          <Slot4USP overlay={image.overlay} textColor={textColor} accentColor={accentColor} />
        )}
        {image.config.slot === 5 && (
          <Slot5Social overlay={image.overlay} textColor={textColor} accentColor={accentColor} />
        )}
        {image.config.slot === 6 && (
          <Slot6Usage overlay={image.overlay} textColor={textColor} accentColor={accentColor} />
        )}
        {image.config.slot === 7 && (
          <Slot7Compare overlay={image.overlay} textColor={textColor} accentColor={accentColor} />
        )}
        {image.config.slot === 8 && (
          <Slot8Offer overlay={image.overlay} textColor={textColor} accentColor={accentColor} />
        )}
        {image.config.slot === 9 && (
          <Slot9FAQ overlay={image.overlay} textColor={textColor} accentColor={accentColor} />
        )}

        {/* Tier 1 — header + footer (always last so they layer ON TOP) */}
        <HeaderStrip
          logoUrl={brandKit.logo.blobUrl || null}
          storeName={brandKit.storeName}
          tagline={brandKit.tagline}
          flagOrigin={brandKit.flagOrigin}
          textColor={textColor}
          accentColor={accentColor}
        />

        <FooterTrustBar
          storeName={brandKit.storeName}
          textColor={textColor}
          accentColor={accentColor}
          market={brandKit.market}
        />
      </Layer>
    </Stage>
  )
})

export default ListingCanvas
