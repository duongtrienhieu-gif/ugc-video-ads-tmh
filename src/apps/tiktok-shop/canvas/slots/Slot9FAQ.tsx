// Slot 9 — FAQ & Assurance (CANVAS-ONLY, no AI scene).
// Atmosphere: soft (lighter gradient via AtmosphereBackground). Composition:
// cert-lab-report-stack (we use a clean Q/A list instead of real cert badges —
// per [[feedback-no-fake-certs]] never auto-render Halal/KKM/GMP).
// FooterTrustBar handles service assurance (logistics/return) globally.

import { Group, Rect, Text } from 'react-konva'
import type { OverlayConfig } from '../../types'
import {
  CONTENT_TOP,
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

export default function Slot9FAQ({ overlay, textColor, accentColor }: Props) {
  const headlineY = CONTENT_TOP + 40
  const headline = 'SOALAN LAZIM'
  const faqStartY = CONTENT_TOP + 160
  const itemHeight = 160

  const items = overlay.faq ?? []

  return (
    <Group>
      <Text
        text={headline}
        x={SAFE_X_LEFT}
        y={headlineY}
        width={SAFE_INNER_WIDTH}
        align="center"
        fontFamily={FONT_FAMILY}
        fontSize={FONT_SIZE.headline}
        fontStyle="800"
        letterSpacing={1}
        fill={textColor}
      />

      <Group>
        {items.slice(0, 3).map((item, i) => {
          const y = faqStartY + i * itemHeight
          return (
            <Group key={i}>
              {/* Q&A card */}
              <Rect
                x={SAFE_X_LEFT}
                y={y}
                width={SAFE_INNER_WIDTH}
                height={itemHeight - 24}
                cornerRadius={14}
                fill="rgba(255,255,255,0.94)"
                shadowColor="rgba(0,0,0,0.10)"
                shadowBlur={16}
                shadowOpacity={0.45}
              />

              {/* Q badge */}
              <Group x={SAFE_X_LEFT + 24} y={y + 24}>
                <Rect
                  width={32}
                  height={32}
                  cornerRadius={6}
                  fill={accentColor}
                />
                <Text
                  text="Q"
                  x={0} y={0}
                  width={32} height={32}
                  align="center" verticalAlign="middle"
                  fontFamily={FONT_FAMILY}
                  fontSize={20}
                  fontStyle="800"
                  fill="#FFFFFF"
                />
              </Group>

              {/* Question text */}
              <Text
                text={item.q}
                x={SAFE_X_LEFT + 72}
                y={y + 26}
                width={SAFE_INNER_WIDTH - 96}
                fontFamily={FONT_FAMILY}
                fontSize={22}
                fontStyle="700"
                fill="#0A2540"
                lineHeight={1.3}
              />

              {/* Answer text */}
              <Text
                text={`→ ${item.a}`}
                x={SAFE_X_LEFT + 72}
                y={y + 82}
                width={SAFE_INNER_WIDTH - 96}
                fontFamily={FONT_FAMILY}
                fontSize={20}
                fontStyle="500"
                fill="#374151"
                lineHeight={1.3}
              />
            </Group>
          )
        })}
      </Group>
    </Group>
  )
}
