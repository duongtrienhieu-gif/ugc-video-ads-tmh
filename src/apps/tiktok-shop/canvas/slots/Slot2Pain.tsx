// Slot 2 — Pain Point.
// Composition: split-screen-before-after (we show only "before" side here —
// the AI scene depicts the painful state). Atmosphere: soft (lighter bg).
// Canvas overlay: question headline top + 3 pain bullets stacked.

import { Group, Text } from 'react-konva'
import type { OverlayConfig } from '../../types'
import {
  CONTENT_TOP,
  CONTENT_HEIGHT,
  SAFE_X_LEFT,
  SAFE_INNER_WIDTH,
  FONT_FAMILY,
  FONT_SIZE,
} from '../layout'

interface Props {
  overlay: OverlayConfig
  textColor: string
  accentColor: string
}

export default function Slot2Pain({ overlay, textColor, accentColor }: Props) {
  const headlineY = CONTENT_TOP + 30
  const bulletsStartY = CONTENT_TOP + CONTENT_HEIGHT - 280

  return (
    <Group>
      {overlay.headline && (
        <Text
          text={overlay.headline}
          x={SAFE_X_LEFT}
          y={headlineY}
          width={SAFE_INNER_WIDTH}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={FONT_SIZE.headline}
          fontStyle="700"
          letterSpacing={-1}
          lineHeight={1.1}
          fill={textColor}
          shadowColor="rgba(0,0,0,0.20)"
          shadowBlur={6}
          shadowOpacity={0.55}
        />
      )}

      {overlay.bullets && overlay.bullets.length > 0 && (
        <Group>
          {overlay.bullets.slice(0, 4).map((b, i) => (
            <Group key={i}>
              <Text
                text="✗"
                x={SAFE_X_LEFT + 40}
                y={bulletsStartY + i * 64}
                fontFamily={FONT_FAMILY}
                fontSize={36}
                fontStyle="700"
                fill={accentColor}
              />
              <Text
                text={b}
                x={SAFE_X_LEFT + 90}
                y={bulletsStartY + i * 64 + 4}
                width={SAFE_INNER_WIDTH - 130}
                fontFamily={FONT_FAMILY}
                fontSize={28}
                fontStyle="500"
                fill={textColor}
                lineHeight={1.2}
              />
            </Group>
          ))}
        </Group>
      )}
    </Group>
  )
}
