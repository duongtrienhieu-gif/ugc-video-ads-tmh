// ListingCanvas — Konva Stage wrapper that composes ALL layers of one slot.
// Tier 1 (header + footer)  always on.
// Tier 2 (atmosphere)       chosen per slot via image.config.atmosphere.
// Tier 3 (slot content)     dispatched to the slot-specific component.
//
// Native render size is 1080×1080 — `displayWidth` prop scales the visible
// stage down for previews without losing internal coordinate fidelity.

import { forwardRef, useEffect, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import type Konva from 'konva'
import type { ListingImage, PaletteFamily } from '../types'
import type { ResolvedBrandKit } from '../../../types/brandKit'
import { TPCN_PALETTES } from '../constants'
import { ensureCanvasFontsLoaded } from '../services/fonts'
import { CANVAS_SIZE } from './layout'
import AtmosphereBackground, { getAtmosphereTextMode } from './AtmosphereBackground'
import HeaderStrip from './HeaderStrip'
import FooterTrustBar from './FooterTrustBar'
import Slot1Hero from './slots/Slot1Hero'

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

  const palette = TPCN_PALETTES[paletteFamily]
  const textMode = getAtmosphereTextMode(image.config.atmosphere)
  const textColor = textMode === 'light' ? '#FFFFFF' : palette.primary
  const accentColor = textMode === 'light' ? '#FFFFFF' : palette.primary

  // Scene source priority: AI-generated assetId (Phase 3+) → fallback (ref photo)
  // The scene is consumed by slot-specific components, not rendered here directly.
  const sceneImageUrl = fallbackSceneUrl ?? null

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
        {/* Tier 2 — atmosphere background */}
        <AtmosphereBackground atmosphere={image.config.atmosphere} palette={palette} />

        {/* Tier 3 — slot-specific content (only slot 1 implemented in Phase 2) */}
        {image.config.slot === 1 && (
          <Slot1Hero
            overlay={image.overlay}
            textColor={textColor}
            accentColor={accentColor}
            sceneImageUrl={sceneImageUrl}
          />
        )}

        {/* Other slots fall through to a placeholder so the grid still
            renders something during Phase 2. Phase 4 replaces this with
            slot-specific renderers (Slot2Pain, Slot3Result, etc.) */}
        {image.config.slot !== 1 && (
          <SlotPlaceholder slot={image.config.slot} textColor={textColor} />
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

// ── Placeholder for slots 2-9 during Phase 2 ─────────────────────────────
import { Text } from 'react-konva'

function SlotPlaceholder({ slot, textColor }: { slot: number; textColor: string }) {
  return (
    <Text
      text={`Slot ${slot}\n(Phase 4)`}
      x={0}
      y={CANVAS_SIZE / 2 - 60}
      width={CANVAS_SIZE}
      align="center"
      fontFamily="Plus Jakarta Sans"
      fontSize={48}
      fontStyle="600"
      fill={textColor}
      opacity={0.35}
    />
  )
}
