// ─────────────────────────────────────────────────────────────────────────
// CHAT BOT — compile prompt cho 1 call Gemini.
//
// Gộp GỌN: playbook (system) + fact sản phẩm + Sales Config + danh sách media
// (id ngắn m1,m2 để tiết kiệm token + tránh model bịa UUID) + lịch sử cắt 8 lượt
// + tin khách mới. Trả { system, prompt, mediaIndex }.
// ─────────────────────────────────────────────────────────────────────────

import type { Product } from '../../../stores/types'
import type { ChatTurn, MediaRole, MediaSlot, SalesConfig } from '../types'
import { ROLE_LABELS, STAGE_LABELS } from '../labels'
import { buildSystemPrompt } from './playbook'

export const MAX_HISTORY_TURNS = 8

export interface CompiledPrompt {
  system: string
  prompt: string
  /** id ngắn (m1…) → MediaSlot, để engine map ngược assetRef thật. */
  mediaIndex: Map<string, MediaSlot>
}

function line(label: string, value?: string): string {
  const v = (value ?? '').trim()
  return v ? `- ${label}: ${v}` : ''
}

export function compilePrompt(args: {
  config: SalesConfig
  product: Product | undefined
  history: ChatTurn[]
  customerText: string
}): CompiledPrompt {
  const { config, product, history, customerText } = args

  // ── Media: gán id ngắn + GOM THEO LOẠI (để bot biết cụm cùng loại có thể gửi chung) ──
  const mediaIndex = new Map<string, MediaSlot>()
  const byRole = new Map<MediaRole, string[]>()
  const refToId = new Map<string, string>() // assetRef thật → id ngắn (để đánh dấu ảnh đã gửi)
  config.mediaMap.forEach((slot, i) => {
    const id = `m${i + 1}`
    mediaIndex.set(id, slot)
    refToId.set(slot.assetRef, id)
    const desc = slot.caption?.trim() ? slot.caption.trim() : `(${slot.mediaType})`
    const arr = byRole.get(slot.role) ?? []
    arr.push(`  ${id} [${STAGE_LABELS[slot.stage]}]: ${desc}`)
    byRole.set(slot.role, arr)
  })
  const mediaLines: string[] = []
  for (const [role, lines] of byRole) {
    const cluster = lines.length > 1 ? ' — CÙNG LOẠI, có thể gửi CỤM 2-4 ảnh một lần' : ''
    mediaLines.push(`• ${ROLE_LABELS[role]}${cluster}:`)
    mediaLines.push(...lines)
  }

  // ── Fact sản phẩm (từ bank) ──
  const facts = [
    line('Tên sản phẩm', product?.productName),
    line('Mô tả', product?.productDescription),
    line('Lợi ích', product?.benefits),
    line('USP', product?.usps),
    line('Pain points', product?.painPoints),
    line('Thành phần', product?.ingredients),
    line('Cách dùng', product?.usageGuide),
  ].filter(Boolean).join('\n')

  // ── Sales Config (riêng kênh chat) ──
  const sales = [
    line('Giá chat', config.chatPrice),
    line('Khuyến mãi chat', config.chatPromo),
    line('Trần giảm giá (KHÔNG bán dưới mức này)', config.discountFloor),
    line('Ghi chú giọng/playbook', config.playbookNote),
  ].filter(Boolean).join('\n')

  const objections = config.objectionBank
    .filter((o) => o.trigger.trim() || o.guidance.trim())
    .map((o) => `- Khi khách: "${o.trigger}" → ${o.guidance}`)
    .join('\n')

  const examples = (config.goldenExamples ?? [])
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e, i) => `[Mẫu ${i + 1}]\n${e}`)
    .join('\n\n')

  // ── Lịch sử (cắt 8 lượt gần nhất; bỏ ghi chú hệ thống) ──
  const recent = history.filter((t) => t.role !== 'system').slice(-MAX_HISTORY_TURNS)
  const historyText = recent
    .map((t) => {
      if (t.role === 'customer') return `Khách: ${t.customerText ?? ''}`
      const msgs = t.packet?.messages ?? []
      const botText = msgs.map((m) => m.contentTarget).filter(Boolean).join(' / ')
      // Đánh dấu ảnh đã gửi (map assetRef thật → id ngắn) để bot KHÔNG gửi lại
      const sentIds = msgs
        .map((m) => (m.assetRef ? refToId.get(m.assetRef) : undefined))
        .filter((x): x is string => !!x)
      return `Bot: ${botText}${sentIds.length ? ` [đã gửi ảnh: ${sentIds.join(', ')}]` : ''}`
    })
    .join('\n')

  const prompt = [
    '=== KHO THÔNG TIN SẢN PHẨM (nguyên liệu để CHỌN LỌC + diễn lại, ĐỪNG đọc nguyên văn) ===',
    facts || '(không có dữ liệu sản phẩm)',
    '',
    '=== GIÁ & BÁN (kênh chat) ===',
    sales || '(chưa cấu hình giá)',
    objections ? `\n=== XỬ LÝ TỪ CHỐI ĐẶC THÙ ===\n${objections}` : '',
    examples ? `\n=== HỘI THOẠI MẪU (bắt chước giọng này) ===\n${examples}` : '',
    mediaLines.length ? `\n=== DANH SÁCH MEDIA (gửi bằng id, vd assetRef="m1") ===\n${mediaLines.join('\n')}` : '\n(Chưa gắn media — chỉ trả lời text)',
    historyText ? `\n=== LỊCH SỬ CHAT ===\n${historyText}` : '',
    `\n=== TIN MỚI CỦA KHÁCH ===\n${customerText}`,
    '\nHãy trả về JSON gói hành động cho lượt này.',
  ].filter(Boolean).join('\n')

  return { system: buildSystemPrompt(config.market), prompt, mediaIndex }
}
