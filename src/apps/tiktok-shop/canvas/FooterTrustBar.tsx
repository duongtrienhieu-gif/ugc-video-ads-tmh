// FooterTrustBar — Tier 1 brand signature (identical across all 9 slots).
// Bottom 90px: small logo + service assurance items (logistics, return,
// packaging). All SAFE trust signals — NO cert badges per [[feedback-no-fake-certs]]
// memory rule (Halal/KKM/GMP must be user-uploaded; we never auto-render them).

import { Group, Rect, Text } from 'react-konva'
import {
  CANVAS_SIZE,
  FOOTER_HEIGHT,
  SAFE_X_LEFT,
  SAFE_X_RIGHT,
  FONT_FAMILY,
} from './layout'

interface Props {
  storeName: string
  textColor: string
  accentColor: string                 // for divider + dot separators
  market: 'vi' | 'ms'                 // VN vs MS labels
}

export default function FooterTrustBar({
  storeName,
  textColor,
  accentColor,
  market,
}: Props) {
  // Service assurance — safe claims only (logistics + return + packaging).
  // These are factual service commitments the seller chooses, not regulatory
  // certifications. Localized per market.
  const items = market === 'ms'
    ? ['📦  Stok Malaysia', '🚚  Penghantaran 1-3 hari', '↩️  Pulangan 7 hari', '🤫  Pembungkusan diskret']
    : ['📦  Stock Việt Nam',  '🚚  Giao 1-3 ngày',         '↩️  Đổi trả 7 ngày', '🤫  Đóng gói kín đáo']

  const footerY = CANVAS_SIZE - FOOTER_HEIGHT

  return (
    <Group>
      {/* Divider line at top of footer */}
      <Rect
        x={SAFE_X_LEFT}
        y={footerY}
        width={SAFE_X_RIGHT - SAFE_X_LEFT}
        height={1}
        fill={accentColor}
        opacity={0.18}
      />

      {/* Background tint for the footer strip — subtle, just for separation */}
      <Rect
        x={0}
        y={footerY + 1}
        width={CANVAS_SIZE}
        height={FOOTER_HEIGHT - 1}
        fill={accentColor}
        opacity={0.06}
      />

      {/* Store name LEFT */}
      <Text
        text={storeName}
        x={SAFE_X_LEFT}
        y={footerY + (FOOTER_HEIGHT / 2) - 9}
        fontFamily={FONT_FAMILY}
        fontSize={16}
        fontStyle="700"
        fill={textColor}
      />

      {/* Service assurance items center→right */}
      <Group>
        {items.map((label, i) => {
          // Distribute items evenly across the right ~70% of the footer
          const startX = SAFE_X_LEFT + 220
          const usableWidth = SAFE_X_RIGHT - startX
          const step = usableWidth / items.length
          const x = startX + step * i + step / 2
          return (
            <Text
              key={i}
              text={label}
              x={x - 100}
              y={footerY + (FOOTER_HEIGHT / 2) - 9}
              width={200}
              align="center"
              fontFamily={FONT_FAMILY}
              fontSize={14}
              fontStyle="500"
              fill={textColor}
              opacity={0.92}
            />
          )
        })}
      </Group>
    </Group>
  )
}
