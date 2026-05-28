// AtmosphereBackground — Tier 2 visual variation.
// Renders the background gradient for the entire canvas. 3 variants:
//   • classic    — diagonal primary → secondary (default, used by slot 1, 4)
//   • soft       — radial secondary → neutral (used by slot 2, 5, 6, 9)
//   • energetic  — vertical primary → cta (used by slot 3, 7, 8)

import { Rect } from 'react-konva'
import type { AtmosphereVariant } from '../types'
import type { PaletteSpec } from '../constants'
import { CANVAS_SIZE } from './layout'

interface Props {
  atmosphere: AtmosphereVariant
  palette: PaletteSpec
}

export default function AtmosphereBackground({ atmosphere, palette }: Props) {
  switch (atmosphere) {
    case 'classic':
      return (
        <Rect
          x={0} y={0}
          width={CANVAS_SIZE} height={CANVAS_SIZE}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: CANVAS_SIZE, y: CANVAS_SIZE }}
          fillLinearGradientColorStops={[0, palette.primary, 1, palette.secondary]}
        />
      )

    case 'soft':
      return (
        <Rect
          x={0} y={0}
          width={CANVAS_SIZE} height={CANVAS_SIZE}
          fillRadialGradientStartPoint={{ x: CANVAS_SIZE / 2, y: CANVAS_SIZE * 0.25 }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndPoint={{ x: CANVAS_SIZE / 2, y: CANVAS_SIZE * 0.25 }}
          fillRadialGradientEndRadius={CANVAS_SIZE * 0.85}
          fillRadialGradientColorStops={[0, palette.secondary, 1, palette.neutral]}
        />
      )

    case 'energetic':
      return (
        <Rect
          x={0} y={0}
          width={CANVAS_SIZE} height={CANVAS_SIZE}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: 0, y: CANVAS_SIZE }}
          fillLinearGradientColorStops={[0, palette.primary, 1, palette.cta]}
        />
      )
  }
}

/** Whether overlay text should default to light or dark color on this atmosphere.
 *  Used by content components to pick contrast-safe text fill without re-deciding
 *  per slot. */
export function getAtmosphereTextMode(atmosphere: AtmosphereVariant): 'light' | 'dark' {
  // classic + energetic = dark bg → light text
  // soft = light bg → dark text
  return atmosphere === 'soft' ? 'dark' : 'light'
}
