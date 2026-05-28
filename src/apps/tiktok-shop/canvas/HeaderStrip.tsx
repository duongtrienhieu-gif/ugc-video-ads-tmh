// HeaderStrip — Tier 1 brand signature (identical across all 9 slots).
// Top 100px: logo top-left, store name center, optional country flag chip top-right.

import { Group, Rect, Text, Image as KonvaImage } from 'react-konva'
import {
  HEADER_HEIGHT,
  SAFE_X_LEFT,
  SAFE_X_RIGHT,
  FONT_FAMILY,
} from './layout'
import { useLoadedImage } from './useLoadedImage'

interface Props {
  logoUrl: string | null              // signed URL from Supabase Storage
  storeName: string
  tagline?: string
  flagOrigin?: string                 // ISO country code; renders chip with code
  textColor: string                   // chosen by parent based on atmosphere
  accentColor: string                 // for the divider line
}

const LOGO_SIZE = 64
const LOGO_PADDING = 18                       // distance from top + left
const FLAG_CHIP_HEIGHT = 36

export default function HeaderStrip({
  logoUrl,
  storeName,
  tagline,
  flagOrigin,
  textColor,
  accentColor,
}: Props) {
  const logoImg = useLoadedImage(logoUrl)

  const flagText = flagOrigin ? flagEmoji(flagOrigin) + ' ' + flagOrigin.toUpperCase() : null

  return (
    <Group>
      {/* Subtle divider line at bottom of header — only 1px, alpha 30% */}
      <Rect
        x={SAFE_X_LEFT}
        y={HEADER_HEIGHT - 1}
        width={SAFE_X_RIGHT - SAFE_X_LEFT}
        height={1}
        fill={accentColor}
        opacity={0.18}
      />

      {/* Logo top-left */}
      {logoImg && (
        <KonvaImage
          image={logoImg}
          x={LOGO_PADDING}
          y={(HEADER_HEIGHT - LOGO_SIZE) / 2}
          width={LOGO_SIZE}
          height={LOGO_SIZE}
        />
      )}

      {/* Store name + tagline center */}
      <Text
        text={storeName}
        x={LOGO_PADDING + LOGO_SIZE + 16}
        y={tagline ? (HEADER_HEIGHT / 2) - 22 : (HEADER_HEIGHT - 22) / 2}
        width={SAFE_X_RIGHT - (LOGO_PADDING + LOGO_SIZE + 16) - 140 /* flag space */}
        fontFamily={FONT_FAMILY}
        fontSize={22}
        fontStyle="700"
        fill={textColor}
        ellipsis
      />
      {tagline && (
        <Text
          text={tagline}
          x={LOGO_PADDING + LOGO_SIZE + 16}
          y={(HEADER_HEIGHT / 2) + 4}
          width={SAFE_X_RIGHT - (LOGO_PADDING + LOGO_SIZE + 16) - 140}
          fontFamily={FONT_FAMILY}
          fontSize={14}
          fontStyle="500"
          fill={textColor}
          opacity={0.78}
          ellipsis
        />
      )}

      {/* Country flag chip top-right */}
      {flagText && (
        <Group x={SAFE_X_RIGHT - 124} y={(HEADER_HEIGHT - FLAG_CHIP_HEIGHT) / 2}>
          <Rect
            width={124}
            height={FLAG_CHIP_HEIGHT}
            cornerRadius={FLAG_CHIP_HEIGHT / 2}
            fill={textColor}
            opacity={0.12}
          />
          <Text
            text={flagText}
            x={0} y={0}
            width={124} height={FLAG_CHIP_HEIGHT}
            align="center" verticalAlign="middle"
            fontFamily={FONT_FAMILY}
            fontSize={14}
            fontStyle="600"
            fill={textColor}
          />
        </Group>
      )}
    </Group>
  )
}

// ISO 3166-1 alpha-2 → flag emoji (browser auto-renders pairs of regional
// indicator symbols into a flag glyph). Safe fallback if code is unknown.
function flagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🏳️'
  const A = 0x1F1E6  // regional indicator A
  const code = iso.toUpperCase()
  return String.fromCodePoint(A + (code.charCodeAt(0) - 65)) +
         String.fromCodePoint(A + (code.charCodeAt(1) - 65))
}
