// Slot 1 — Hero Hook content.
// Tier 3 composition: pill-bottle-hero-centered.
// Layout:
//   top:    big hero claim headline (96px ExtraBold)
//   center: product image, slight angle (uses ref photo in Phase 2;
//           AI-generated scene replaces in Phase 3+)
//   below:  tagline (36px Medium Italic)
// Tier 1 header + footer rendered by parent ListingCanvas, not here.

import { Group, Rect, Text, Image as KonvaImage } from 'react-konva'
import type { OverlayConfig } from '../../types'
import { useLoadedImage } from '../useLoadedImage'
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
  /** Product reference photo (Phase 2 fallback). When AI scene is present,
   *  parent passes null + hidePlaceholder=true so this layer only draws text. */
  sceneImageUrl: string | null
  /** Skip the product placeholder rectangle when the AI scene already fills bg.
   *  Text overlays still render on top. */
  hidePlaceholder?: boolean
}

export default function Slot1Hero({ overlay, textColor, accentColor, sceneImageUrl, hidePlaceholder }: Props) {
  const sceneImg = useLoadedImage(sceneImageUrl)

  // Vertical layout within content area:
  //   headline:    CONTENT_TOP + 40  (height ~210 for 2-line wrap allowance)
  //   product:     CONTENT_TOP + 280 (centered, 460px square)
  //   tagline:     CONTENT_BOTTOM - 80
  const headlineY = CONTENT_TOP + 40
  const productY  = CONTENT_TOP + 280
  const productSize = 460
  const productX = (CANVAS_SIZE - productSize) / 2
  const taglineY = CONTENT_TOP + CONTENT_HEIGHT - 110

  return (
    <Group>
      {/* ── Hero headline ──────────────────────────────────────────── */}
      {overlay.headline && (
        <Text
          text={overlay.headline}
          x={SAFE_X_LEFT}
          y={headlineY}
          width={SAFE_INNER_WIDTH}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={FONT_SIZE.hero}
          fontStyle="800"
          letterSpacing={-2}
          lineHeight={1.05}
          fill={textColor}
          shadowColor="rgba(0,0,0,0.18)"
          shadowBlur={8}
          shadowOffsetY={2}
          shadowOpacity={0.6}
        />
      )}

      {/* ── Product image (centered, with subtle shadow & slight angle) ── */}
      {/* Only rendered when no AI scene exists. With AI scene, the product is
       *  already in the bg image — adding another product here would double up. */}
      {!hidePlaceholder && sceneImg && (
        <KonvaImage
          image={sceneImg}
          x={productX}
          y={productY}
          width={productSize}
          height={productSize}
          rotation={-3}
          offsetX={0}
          offsetY={0}
          shadowColor="rgba(0,0,0,0.35)"
          shadowBlur={28}
          shadowOffsetY={12}
          shadowOpacity={0.5}
        />
      )}
      {!hidePlaceholder && !sceneImg && (
        <Group>
          <Rect
            x={productX}
            y={productY}
            width={productSize}
            height={productSize}
            cornerRadius={20}
            fill={textColor}
            opacity={0.08}
            stroke={textColor}
            strokeWidth={2}
            dash={[10, 8]}
          />
          <Text
            text="Sản phẩm sẽ hiển thị ở đây"
            x={productX}
            y={productY + productSize / 2 - 16}
            width={productSize}
            align="center"
            fontFamily={FONT_FAMILY}
            fontSize={22}
            fontStyle="500"
            fill={textColor}
            opacity={0.55}
          />
          <Text
            text="(Tải ảnh tham chiếu ở panel trái)"
            x={productX}
            y={productY + productSize / 2 + 14}
            width={productSize}
            align="center"
            fontFamily={FONT_FAMILY}
            fontSize={16}
            fontStyle="400"
            fill={textColor}
            opacity={0.4}
          />
        </Group>
      )}

      {/* ── Tagline below product ──────────────────────────────────── */}
      {overlay.subheadline && (
        <Group>
          {/* Accent underline above tagline */}
          <Rect
            x={(CANVAS_SIZE - 80) / 2}
            y={taglineY - 18}
            width={80}
            height={3}
            cornerRadius={2}
            fill={accentColor}
            opacity={0.85}
          />
          <Text
            text={overlay.subheadline}
            x={SAFE_X_LEFT}
            y={taglineY}
            width={SAFE_INNER_WIDTH}
            align="center"
            fontFamily={FONT_FAMILY}
            fontSize={FONT_SIZE.subheadline}
            fontStyle="italic 500"
            fill={textColor}
            opacity={0.92}
          />
        </Group>
      )}
    </Group>
  )
}
