// Slot 6 — Usage Demo.
// Composition: step-infographic (AI optionally renders product backdrop).
// Atmosphere: soft. Canvas overlay: title + 3 numbered step circles + texts.

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

export default function Slot6Usage({ overlay, textColor, accentColor }: Props) {
  const headlineY = CONTENT_TOP + 40
  const stepsCenterY = CONTENT_TOP + CONTENT_HEIGHT / 2 + 40

  const steps = overlay.steps ?? []
  const stepCount = Math.min(steps.length, 3)
  const colWidth = SAFE_INNER_WIDTH / Math.max(stepCount, 1)
  const circleRadius = 50

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
          shadowColor="rgba(0,0,0,0.20)"
          shadowBlur={6}
          shadowOpacity={0.5}
        />
      )}

      {/* Steps row */}
      <Group>
        {steps.slice(0, 3).map((step, i) => {
          const colCenter = SAFE_X_LEFT + colWidth * i + colWidth / 2
          return (
            <Group key={i}>
              {/* Numbered circle */}
              <Rect
                x={colCenter - circleRadius}
                y={stepsCenterY - circleRadius - 20}
                width={circleRadius * 2}
                height={circleRadius * 2}
                cornerRadius={circleRadius}
                fill={accentColor}
                shadowColor="rgba(0,0,0,0.25)"
                shadowBlur={16}
                shadowOpacity={0.5}
              />
              <Text
                text={String(step.number ?? i + 1)}
                x={colCenter - circleRadius}
                y={stepsCenterY - circleRadius - 20}
                width={circleRadius * 2}
                height={circleRadius * 2}
                align="center" verticalAlign="middle"
                fontFamily={FONT_FAMILY}
                fontSize={48}
                fontStyle="800"
                fill="#FFFFFF"
              />

              {/* Step text */}
              <Text
                text={step.text}
                x={colCenter - colWidth / 2 + 10}
                y={stepsCenterY + circleRadius - 4}
                width={colWidth - 20}
                align="center"
                fontFamily={FONT_FAMILY}
                fontSize={22}
                fontStyle="600"
                lineHeight={1.2}
                fill={textColor}
              />
            </Group>
          )
        })}
      </Group>

      {/* Pagi → Malam pictogram below steps */}
      <Text
        text="🌅 Pagi    •    🌙 Malam"
        x={SAFE_X_LEFT}
        y={CONTENT_TOP + CONTENT_HEIGHT - 70}
        width={SAFE_INNER_WIDTH}
        align="center"
        fontFamily={FONT_FAMILY}
        fontSize={20}
        fontStyle="600"
        fill={textColor}
        opacity={0.8}
      />
    </Group>
  )
}
