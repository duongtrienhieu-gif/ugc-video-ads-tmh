// Slot 4 — USP / Mechanism.
// Composition: floating-ingredients-bottle (AI renders bottle + ingredients
// floating around). Atmosphere: classic. Canvas overlay: title + 4-5
// ingredient labels with percentages.

import { Group, Rect, Text } from 'react-konva'
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

export default function Slot4USP({ overlay, textColor, accentColor }: Props) {
  const headlineY = CONTENT_TOP + 30

  // Ingredient labels run down the right edge so they don't cover the
  // centered bottle that AI generates in the middle.
  const labelsStartY = CONTENT_TOP + CONTENT_HEIGHT - 380
  const labelHeight = 56
  const labels = overlay.bullets ?? []

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
          fontStyle="800"
          letterSpacing={-1}
          fill={textColor}
          shadowColor="rgba(0,0,0,0.25)"
          shadowBlur={6}
          shadowOpacity={0.6}
        />
      )}

      {/* Ingredient labels — pill-style chips, stacked vertically near bottom */}
      <Group>
        {labels.slice(0, 5).map((label, i) => (
          <Group key={i} x={SAFE_X_LEFT} y={labelsStartY + i * (labelHeight + 12)}>
            <Rect
              width={SAFE_INNER_WIDTH}
              height={labelHeight}
              cornerRadius={labelHeight / 2}
              fill="rgba(255,255,255,0.92)"
              shadowColor="rgba(0,0,0,0.18)"
              shadowBlur={12}
              shadowOpacity={0.5}
            />
            {/* Numbered accent circle on left */}
            <Group x={12} y={(labelHeight - 36) / 2}>
              <Rect
                width={36}
                height={36}
                cornerRadius={18}
                fill={accentColor}
              />
              <Text
                text={String(i + 1)}
                x={0} y={0}
                width={36} height={36}
                align="center" verticalAlign="middle"
                fontFamily={FONT_FAMILY}
                fontSize={20}
                fontStyle="800"
                fill="#FFFFFF"
              />
            </Group>
            <Text
              text={label}
              x={64}
              y={0}
              width={SAFE_INNER_WIDTH - 80}
              height={labelHeight}
              verticalAlign="middle"
              fontFamily={FONT_FAMILY}
              fontSize={22}
              fontStyle="600"
              fill="#0A2540"
            />
          </Group>
        ))}
      </Group>
    </Group>
  )
}
