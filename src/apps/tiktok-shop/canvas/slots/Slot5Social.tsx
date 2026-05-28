// Slot 5 — Social Proof (CANVAS-ONLY, no AI scene).
// Atmosphere: soft (lighter bg via gradient — drawn by AtmosphereBackground
// since hasAiScene=false). Composition: testimonial-card-overlay.
// Center: card with star rating + quote + author. Optional avatar circle.

import { Group, Rect, Text } from 'react-konva'
import type { OverlayConfig } from '../../types'
import {
  CANVAS_SIZE,
  CONTENT_TOP,
  CONTENT_HEIGHT,
  SAFE_X_LEFT,
  SAFE_INNER_WIDTH,
  FONT_FAMILY,
} from '../layout'

interface Props {
  overlay: OverlayConfig
  textColor: string
  accentColor: string
}

const STAR_FULL = '★'

export default function Slot5Social({ overlay, textColor, accentColor }: Props) {
  const t = overlay.testimonial

  // Card centered in content area
  const cardWidth = SAFE_INNER_WIDTH - 60
  const cardHeight = 480
  const cardX = (CANVAS_SIZE - cardWidth) / 2
  const cardY = CONTENT_TOP + (CONTENT_HEIGHT - cardHeight) / 2

  // Quotation mark behind card — subtle brand accent
  const bigQuoteY = cardY - 60

  return (
    <Group>
      {/* Decorative giant quotation mark (subtle, behind card) */}
      <Text
        text="“"
        x={SAFE_X_LEFT}
        y={bigQuoteY}
        width={SAFE_INNER_WIDTH}
        align="center"
        fontFamily={FONT_FAMILY}
        fontSize={280}
        fontStyle="800"
        fill={accentColor}
        opacity={0.15}
      />

      {/* Card */}
      <Rect
        x={cardX}
        y={cardY}
        width={cardWidth}
        height={cardHeight}
        cornerRadius={20}
        fill="rgba(255,255,255,0.96)"
        shadowColor="rgba(0,0,0,0.18)"
        shadowBlur={32}
        shadowOffsetY={12}
        shadowOpacity={0.6}
      />

      {/* Star rating */}
      <Text
        text={STAR_FULL.repeat(t?.rating ?? 5)}
        x={cardX}
        y={cardY + 40}
        width={cardWidth}
        align="center"
        fontFamily={FONT_FAMILY}
        fontSize={56}
        fontStyle="700"
        fill="#F59E0B"  // amber-500 — universal star color
      />

      {/* Quote */}
      {t?.quote && (
        <Text
          text={`"${t.quote}"`}
          x={cardX + 50}
          y={cardY + 130}
          width={cardWidth - 100}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={32}
          fontStyle="italic 500"
          lineHeight={1.4}
          fill="#1F2937"
        />
      )}

      {/* Author */}
      {t?.author && (
        <Text
          text={`— ${t.author}`}
          x={cardX}
          y={cardY + cardHeight - 80}
          width={cardWidth}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={22}
          fontStyle="600"
          fill="#6B7280"
        />
      )}

      {/* Verified-customer disclaimer — soft trust signal */}
      <Text
        text="Ulasan pelanggan sebenar"
        x={SAFE_X_LEFT}
        y={cardY + cardHeight + 30}
        width={SAFE_INNER_WIDTH}
        align="center"
        fontFamily={FONT_FAMILY}
        fontSize={16}
        fontStyle="500"
        fill={textColor}
        opacity={0.6}
      />
    </Group>
  )
}
