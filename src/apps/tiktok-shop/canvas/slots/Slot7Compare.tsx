// Slot 7 — Comparison.
// Composition: cert-lab-report-stack (we use a comparison TABLE instead of cert
// stack to be SAFE legally — no fake certs per [[feedback-no-fake-certs]]).
// Atmosphere: energetic. Canvas overlay: title + 2-column table.

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

export default function Slot7Compare({ overlay, textColor, accentColor }: Props) {
  const headlineY = CONTENT_TOP + 30
  const headlineText = overlay.headline ?? 'PILIH YANG BAIK'

  const cmp = overlay.comparison
  const rows = cmp?.rows ?? []
  const headers = cmp?.headers ?? ['', '']

  const tableTop = CONTENT_TOP + 200
  const tableWidth = SAFE_INNER_WIDTH
  const colWidth = tableWidth / 2
  const rowHeight = 64
  const headerHeight = 76
  const tableHeight = headerHeight + rows.length * rowHeight

  // Visual: left column = OUR product (highlighted accent), right = competitor
  return (
    <Group>
      <Text
        text={headlineText}
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

      {/* Card backdrop for the table */}
      <Rect
        x={SAFE_X_LEFT}
        y={tableTop}
        width={tableWidth}
        height={tableHeight}
        cornerRadius={16}
        fill="rgba(255,255,255,0.96)"
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={24}
        shadowOffsetY={10}
        shadowOpacity={0.5}
      />

      {/* Highlight left column (our product) */}
      <Rect
        x={SAFE_X_LEFT}
        y={tableTop}
        width={colWidth}
        height={tableHeight}
        cornerRadius={16}
        fill={accentColor}
        opacity={0.10}
      />

      {/* Header row */}
      <Group>
        <Text
          text={headers[0]}
          x={SAFE_X_LEFT}
          y={tableTop + 20}
          width={colWidth}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={26}
          fontStyle="800"
          fill={accentColor}
        />
        <Text
          text={headers[1]}
          x={SAFE_X_LEFT + colWidth}
          y={tableTop + 20}
          width={colWidth}
          align="center"
          fontFamily={FONT_FAMILY}
          fontSize={22}
          fontStyle="500"
          fill="#6B7280"
        />
        {/* Header underline */}
        <Rect
          x={SAFE_X_LEFT + 16}
          y={tableTop + headerHeight - 1}
          width={tableWidth - 32}
          height={1}
          fill="#E5E7EB"
        />
      </Group>

      {/* Rows */}
      <Group>
        {rows.slice(0, 5).map((row, i) => {
          const rowY = tableTop + headerHeight + i * rowHeight
          return (
            <Group key={i}>
              <Text
                text={row[0]}
                x={SAFE_X_LEFT}
                y={rowY + 18}
                width={colWidth}
                align="center"
                fontFamily={FONT_FAMILY}
                fontSize={22}
                fontStyle="700"
                fill="#0A2540"
              />
              <Text
                text={row[1]}
                x={SAFE_X_LEFT + colWidth}
                y={rowY + 18}
                width={colWidth}
                align="center"
                fontFamily={FONT_FAMILY}
                fontSize={22}
                fontStyle="500"
                fill="#6B7280"
              />
              {/* Row separator */}
              {i < rows.length - 1 && (
                <Rect
                  x={SAFE_X_LEFT + 16}
                  y={rowY + rowHeight - 1}
                  width={tableWidth - 32}
                  height={1}
                  fill="#F3F4F6"
                />
              )}
            </Group>
          )
        })}
      </Group>
    </Group>
  )
}
