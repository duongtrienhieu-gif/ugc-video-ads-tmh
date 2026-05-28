// Slot 8 — Offer / Combo.
// Composition: pill-bottle-hero-centered (AI renders product hero, same
// composition as slot 1 but warmer/energetic mood). Canvas overlay: big
// striked-through original price + giant current price + discount badge +
// CTA button + combo line.

import { Group, Rect, Text } from 'react-konva'
import type { OverlayConfig } from '../../types'
import {
  CANVAS_SIZE,
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

export default function Slot8Offer({ overlay, textColor, accentColor }: Props) {
  const p = overlay.price

  // Position price block at upper third (AI bottle below), CTA at bottom
  const priceCenterY = CONTENT_TOP + 80
  const ctaY = CONTENT_TOP + CONTENT_HEIGHT - 180
  const ctaHeight = 96
  const ctaWidth = SAFE_INNER_WIDTH - 80
  const ctaX = (CANVAS_SIZE - ctaWidth) / 2
  const comboY = ctaY - 80

  return (
    <Group>
      {/* Original price striked through (small) */}
      {p?.original && (
        <Text
          text={p.original}
          x={SAFE_X_LEFT}
          y={priceCenterY}
          width={SAFE_INNER_WIDTH}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={28}
          fontStyle="500"
          textDecoration="line-through"
          fill={textColor}
          opacity={0.6}
        />
      )}

      {/* Current price (GIANT) */}
      {p?.current && (
        <Text
          text={p.current}
          x={SAFE_X_LEFT}
          y={priceCenterY + 40}
          width={SAFE_INNER_WIDTH}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={FONT_SIZE.numericHuge}
          fontStyle="800"
          letterSpacing={-3}
          fill={textColor}
          shadowColor="rgba(0,0,0,0.30)"
          shadowBlur={16}
          shadowOpacity={0.7}
        />
      )}

      {/* Discount badge (pill) below price */}
      {p?.discount && (
        <Group x={(CANVAS_SIZE - 200) / 2} y={priceCenterY + 200}>
          <Rect
            width={200}
            height={48}
            cornerRadius={24}
            fill="#FBBF24"  // amber-400 — universal "deal" color, NOT red (avoid scammy feel)
            shadowColor="rgba(0,0,0,0.30)"
            shadowBlur={12}
            shadowOpacity={0.5}
          />
          <Text
            text={p.discount}
            x={0} y={0}
            width={200} height={48}
            align="center" verticalAlign="middle"
            fontFamily={FONT_FAMILY}
            fontSize={24}
            fontStyle="800"
            fill="#7C2D12"
          />
        </Group>
      )}

      {/* Combo line ("+ FREE ...") */}
      {overlay.headline && (
        <Text
          text={overlay.headline}
          x={SAFE_X_LEFT}
          y={comboY}
          width={SAFE_INNER_WIDTH}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={28}
          fontStyle="700"
          fill={textColor}
        />
      )}

      {/* CTA button (rounded RECT — not pill — medical feel) */}
      {overlay.cta && (
        <Group x={ctaX} y={ctaY}>
          <Rect
            width={ctaWidth}
            height={ctaHeight}
            cornerRadius={16}
            fill={accentColor}
            shadowColor="rgba(0,0,0,0.40)"
            shadowBlur={24}
            shadowOffsetY={8}
            shadowOpacity={0.7}
          />
          <Text
            text={overlay.cta}
            x={0} y={0}
            width={ctaWidth} height={ctaHeight}
            align="center" verticalAlign="middle"
            fontFamily={FONT_FAMILY}
            fontSize={36}
            fontStyle="800"
            letterSpacing={1}
            fill="#FFFFFF"
          />
        </Group>
      )}
    </Group>
  )
}
