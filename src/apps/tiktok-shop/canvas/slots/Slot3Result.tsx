// Slot 3 — Transformation / Result.
// Composition: split-screen-before-after (AI renders both halves).
// Atmosphere: energetic (deeper bg). Canvas overlay: GIANT metric center +
// disclaimer at bottom for legal compliance.

import { Group, Text } from 'react-konva'
import type { OverlayConfig } from '../../types'
import {
  CANVAS_SIZE,
  CONTENT_TOP,
  CONTENT_HEIGHT,
  FOOTER_HEIGHT,
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

export default function Slot3Result({ overlay, textColor, accentColor }: Props) {
  // GIANT metric vertically centered in content area
  const metricCenterY = CONTENT_TOP + CONTENT_HEIGHT / 2

  return (
    <Group>
      {/* SEBELUM / SELEPAS labels at top — small but visible */}
      <Group>
        <Text
          text="SEBELUM"
          x={SAFE_X_LEFT}
          y={CONTENT_TOP + 24}
          width={SAFE_INNER_WIDTH / 2 - 30}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={24}
          fontStyle="700"
          letterSpacing={2}
          fill={textColor}
          opacity={0.85}
        />
        <Text
          text="SELEPAS"
          x={SAFE_X_LEFT + SAFE_INNER_WIDTH / 2 + 30}
          y={CONTENT_TOP + 24}
          width={SAFE_INNER_WIDTH / 2 - 30}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={24}
          fontStyle="700"
          letterSpacing={2}
          fill={textColor}
          opacity={0.85}
        />
      </Group>

      {/* Giant metric value */}
      {overlay.metric && (
        <Group>
          <Text
            text={overlay.metric.value}
            x={SAFE_X_LEFT}
            y={metricCenterY - 60}
            width={SAFE_INNER_WIDTH}
            align="center"
            fontFamily={FONT_FAMILY}
            fontSize={FONT_SIZE.numericHuge}
            fontStyle="800"
            letterSpacing={-4}
            fill={accentColor}
            shadowColor="rgba(0,0,0,0.35)"
            shadowBlur={20}
            shadowOpacity={0.7}
          />
          {overlay.metric.label && (
            <Text
              text={overlay.metric.label}
              x={SAFE_X_LEFT}
              y={metricCenterY + 100}
              width={SAFE_INNER_WIDTH}
              align="center"
              fontFamily={FONT_FAMILY}
              fontSize={FONT_SIZE.subheadline}
              fontStyle="700"
              letterSpacing={1}
              fill={textColor}
              shadowColor="rgba(0,0,0,0.20)"
              shadowBlur={4}
              shadowOpacity={0.5}
            />
          )}
        </Group>
      )}

      {/* Mandatory disclaimer for "result" claims — per [[feedback-no-fake-certs]]
          + general TPCN compliance. Always rendered if metric is shown. */}
      <Text
        text={overlay.disclaimer ?? '*Hasil mungkin berbeza individu'}
        x={SAFE_X_LEFT}
        y={CANVAS_SIZE - FOOTER_HEIGHT - 32}
        width={SAFE_INNER_WIDTH}
        align="center"
        fontFamily={FONT_FAMILY}
        fontSize={FONT_SIZE.disclaimer}
        fontStyle="400"
        fill={textColor}
        opacity={0.75}
      />
    </Group>
  )
}
