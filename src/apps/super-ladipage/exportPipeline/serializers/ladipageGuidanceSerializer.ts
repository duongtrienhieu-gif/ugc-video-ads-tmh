// ─────────────────────────────────────────────────────────────────────
// Export Pipeline — ladipageGuidanceSerializer (P14)
//
// ExportablePage → marketer-readable Ladipage assembly guide.
// Plain Vietnamese text instructing how to paste/assemble in Ladipage.
//
// LOCKED: NO HTML output, NO embedded code, NO automated builder.
// This is a HUMAN INSTRUCTION manual generated from semantic intent.
// ─────────────────────────────────────────────────────────────────────

import type { ExportablePage, ExportableSection } from '../types'

export function serializeToLadipageGuidance(page: ExportablePage): string {
  const lines: string[] = []

  lines.push(`# Hướng dẫn dựng landingpage trong Ladipage`)
  lines.push(``)
  lines.push(`Tổng số section: ${page.totalSections} · Số từ: ${page.totalWordCount} · Thời gian scroll ước tính: ~${page.estimatedScrollTimeSec}s`)
  lines.push(``)
  lines.push(`Mỗi section dưới đây tương ứng 1 khối Ladipage. Paste text theo thứ tự, áp dụng layout theo "Gợi ý layout" của từng section.`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  for (let i = 0; i < page.sections.length; i++) {
    appendSectionGuidance(lines, page.sections[i], i + 1)
    lines.push(``)
    lines.push(`---`)
    lines.push(``)
  }

  // Page-level recap
  lines.push(`## Tổng kết kiểm tra realism`)
  lines.push(``)
  const r = page.validationReport
  lines.push(`- Rủi ro realism: **${r.realismRisk}**`)
  lines.push(`- Polish drift: **${r.polishDrift}**`)
  lines.push(`- Độ tin cậy proof: **${r.proofAuthenticity}**`)
  lines.push(`- Fatigue mobile: **${r.scrollFatigue}**`)
  lines.push(`- Lặp lại visual: **${r.repetitionRisk}**`)
  if (r.warnings.length > 0) {
    lines.push(``)
    lines.push(`**${r.warnings.length} cảnh báo cần review trước khi publish.**`)
  }
  if (r.recommendedKnobAdjustments.length > 0) {
    lines.push(``)
    lines.push(`### Đề xuất chỉnh tuning trước khi xuất bản:`)
    for (const rec of r.recommendedKnobAdjustments) {
      const dir = rec.direction > 0 ? `+${rec.direction}` : `${rec.direction}`
      lines.push(`- \`${rec.knob}\` ${dir} — ${rec.reason}`)
    }
  }

  return lines.join('\n')
}

function appendSectionGuidance(lines: string[], s: ExportableSection, index: number): void {
  const title = s.role.replace(/-/g, ' ')
  lines.push(`## Section ${index} — ${title}`)
  lines.push(``)
  lines.push(`**Ý đồ:** ${s.exportGuide.sectionIntent}`)
  lines.push(``)

  // Gợi ý layout
  lines.push(`### Gợi ý layout Ladipage`)
  lines.push(``)
  lines.push(`- Padding container: **${translatePadding(s.exportGuide.suggestedPadding)}**`)
  lines.push(`- Spacing giữa các element: **${translateSpacing(s.exportGuide.recommendedSpacing)}**`)
  lines.push(`- Bề rộng text: **${translateTextWidth(s.exportGuide.textWidthMode)}**`)
  lines.push(`- Style typography: **${translateTypography(s.exportGuide.typographyMode)}**`)
  if (s.exportGuide.imageRatio) {
    lines.push(`- Tỷ lệ ảnh: **${s.exportGuide.imageRatio}**`)
  } else {
    lines.push(`- Ảnh: **không cần** (section text-only)`)
  }
  if (s.exportGuide.stickyCtaRecommended) {
    lines.push(`- ⚠ **Nên thêm sticky CTA bar cho section này.**`)
  }
  if (s.exportGuide.proofStyle !== 'none') {
    lines.push(`- Hiển thị proof: **${translateProofStyle(s.exportGuide.proofStyle)}**`)
  }
  lines.push(``)

  // Text copy
  lines.push(`### Text paste vào Ladipage`)
  lines.push(``)
  for (const para of s.paragraphs) {
    lines.push(para)
    lines.push(``)
  }

  if (s.inlineProof) {
    lines.push(`> ${s.inlineProof.quote}`)
    if (s.inlineProof.author) {
      lines.push(`> — ${s.inlineProof.author}${s.inlineProof.meta ? `, ${s.inlineProof.meta}` : ''}`)
    }
    lines.push(``)
  }

  // Image guidance
  if (s.generatedAsset) {
    lines.push(`### Ảnh`)
    lines.push(``)
    lines.push(`- Renderer được route: **${s.generatedAsset.renderer}**`)
    lines.push(`- Trạng thái: **${s.generatedAsset.generationStatus}**`)
    if (s.generatedAsset.outputImages.length > 0) {
      lines.push(`- Tải xuống và upload lên Ladipage. (${s.generatedAsset.outputImages.length} ảnh)`)
    } else {
      lines.push(`- ⚠ Chưa generate ảnh — chạy "Regenerate image" hoặc upload ảnh tự tạo.`)
    }
  }
}

// ─── translators (Vietnamese marketer-facing labels) ──────────────

function translatePadding(p: string): string {
  if (p === 'tight') return 'gọn (8-12px)'
  if (p === 'comfortable') return 'thoải mái (16-20px)'
  return 'rộng (24-32px)'
}

function translateSpacing(s: string): string {
  if (s === 'tight') return 'sát (8-12px giữa các block)'
  if (s === 'normal') return 'chuẩn (16-20px)'
  return 'rộng (24-40px) — cho cảm giác thở'
}

function translateTextWidth(w: string): string {
  if (w === 'narrow') return 'hẹp (max ~480px) — dòng ngắn, dễ đọc mobile'
  if (w === 'wide') return 'rộng (full container) — dòng dài, prose'
  return 'chuẩn (~560-640px)'
}

function translateTypography(t: string): string {
  if (t === 'headline-led') return 'tiêu đề lớn dẫn dắt'
  if (t === 'body-led') return 'body text dẫn dắt'
  if (t === 'quote-led') return 'quote dẫn dắt — proof làm visual hero'
  return 'cân bằng tiêu đề + body'
}

function translateProofStyle(p: string): string {
  if (p === 'subtle') return 'attribution nhẹ inline'
  if (p === 'standard') return 'inline quote callout'
  if (p === 'spotlight') return 'bordered block — proof làm visual hero'
  return 'không có proof'
}
