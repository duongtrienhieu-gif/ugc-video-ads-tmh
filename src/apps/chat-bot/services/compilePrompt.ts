// ─────────────────────────────────────────────────────────────────────────
// CHAT BOT — compile prompt cho 1 call Gemini.
//
// Gộp GỌN: playbook (system) + fact sản phẩm + Sales Config + danh sách media
// (id ngắn m1,m2 để tiết kiệm token + tránh model bịa UUID) + lịch sử cắt 8 lượt
// + tin khách mới. Trả { system, prompt, mediaIndex }.
// ─────────────────────────────────────────────────────────────────────────

import type { Product } from '../../../stores/types'
import type { ChatTurn, MediaRole, MediaSlot, SalesConfig } from '../types'
import { ROLE_LABELS } from '../labels'
import { buildSystemPrompt } from './playbook'

/** Gợi ý DÙNG KHI NÀO cho từng VAI ảnh (thay trục "giai đoạn" cứng đã bỏ —
 *  1 ảnh dùng được nhiều thời điểm; bot quyết theo vai + caption + ngữ cảnh). */
const ROLE_USAGE_HINTS: Partial<Record<MediaRole, string>> = {
  hook: 'giật chú ý — hợp mở màn',
  pain: 'đồng cảm khi khách kể triệu chứng/vấn đề — mở màn/đào bệnh',
  feature: 'tính năng/thành phần — trao giá trị',
  mechanism: 'giải thích VÌ SAO hiệu quả — tư vấn sâu + phủ vai 3 lượt đầu',
  usage: 'cách dùng — sau chốt hoặc khách hỏi cách dùng',
  compare: 'so sánh/before-after — khách chê đắt/chưa tin',
  proof: 'review khách thật — khách do dự/im + follow-up + phủ vai 3 lượt đầu',
  authority: 'báo chí/chuyên gia/chứng nhận — gỡ nghi "scam/hàng giả" + phủ vai uy tín',
  promo: 'khuyến mãi/gói — lúc chốt/upsell',
  unboxing: 'mở hộp/dùng thử — tăng cảm giác hàng thật',
}

export const MAX_HISTORY_TURNS = 14

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

interface PricingTierLite { qty?: number; freeQty?: number; price?: string; label?: string }
/** Bóc số tiền từ chuỗi tự do ("RM 65", "RM1,299", "89k") → number|null. */
function parsePrice(s: string): number | null {
  const m = (s || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}
/** Tính SẴN đơn giá/hộp, % rẻ, tiết kiệm RM, chênh cận biên — bot KHỎI tự tính
 *  (Gemini chia sai giá là mất khách). Neo "gói nhỏ nhất" (KHÔNG giả định giá lẻ:
 *  gói nhỏ nhất của SP có thể đã là 1+1). Làm tròn RM nguyên khi nói với khách. */
interface TierCalc { qty: number; freeQty: number; units: number; price: number; label?: string }
function analyzePricing(tiers: PricingTierLite[]): string {
  const calc: TierCalc[] = []
  for (const t of tiers) {
    const price = parsePrice(t.price ?? '')
    const units = (t.qty ?? 0) + (t.freeQty ?? 0)
    if (price && units > 0) calc.push({ qty: t.qty ?? 0, freeQty: t.freeQty ?? 0, units, price, label: t.label?.trim() || undefined })
  }
  calc.sort((a, b) => a.units - b.units)
  if (calc.length === 0) return ''
  const base = calc[0]!
  const basePer = base.price / base.units
  let best: TierCalc = base
  const lines = calc.map((t, i) => {
    if (t.units > best.units) best = t
    const per = t.price / t.units
    const name = `mua ${t.qty}${t.freeQty ? ` tặng ${t.freeQty}` : ''}${t.label ? ` (${t.label})` : ''}`
    const bits = [`nhận ${t.units} hộp, ~RM${Math.round(per)}/hộp`]
    if (i > 0) {
      const savePct = Math.round((1 - per / basePer) * 100)
      const saveRm = Math.round(t.units * basePer - t.price)
      if (savePct >= 3) bits.push(`rẻ hơn ~${savePct}% mỗi hộp`)
      if (saveRm >= 1) bits.push(`tiết kiệm ~RM${saveRm} so mua lẻ cùng số hộp`)
      const prev = calc[i - 1]!
      const dP = Math.round(t.price - prev.price)
      const dU = t.units - prev.units
      if (dU > 0 && dP >= 0) bits.push(`chỉ +RM${dP} so gói trước mà thêm ${dU} hộp`)
    }
    return `- ${name}: ${t.price} → ${bits.join(' · ')}`
  })
  const bestSaveRm = Math.round(best.units * basePer - best.price)
  return `${lines.join('\n')}\n➡ GÓI LỢI NHẤT = ${best.qty}${best.freeQty ? `+${best.freeQty}` : ''} (${best.units} hộp): rẻ nhất ~RM${Math.round(best.price / best.units)}/hộp${bestSaveRm >= 1 ? `, tiết kiệm ~RM${bestSaveRm}` : ''} — vừa ĐỦ LIỆU TRÌNH vừa lời nhất.`
}

export function compilePrompt(args: {
  config: SalesConfig
  product: Product | undefined
  history: ChatTurn[]
  customerText: string
  /** Thông tin đã moi được tích luỹ XUYÊN PHIÊN (sđt/địa chỉ/tên/số lượng…) —
   *  để bot KHÔNG hỏi lại cái khách đã cung cấp. */
  knownInfo?: Record<string, string>
  /** Tóm tắt phiên ở lượt trước — nhớ tổng hợp khi chat dài. */
  priorSummary?: string
}): CompiledPrompt {
  const { config, product, history, customerText, knownInfo, priorSummary } = args

  // ── Media: gán id ngắn + GOM THEO LOẠI (để bot biết cụm cùng loại có thể gửi chung) ──
  const mediaIndex = new Map<string, MediaSlot>()
  const byRole = new Map<MediaRole, { lines: string[]; total: number; sent: number }>()
  const refToId = new Map<string, string>() // assetRef thật → id ngắn (để đánh dấu ảnh đã gửi)
  // Ảnh ĐÃ GỬI (bóc từ lịch sử) — đánh dấu THẲNG vào danh sách + đếm tồn kho từng vai,
  // để bot thấy ngay còn bao nhiêu đạn mà bung CỤM, khỏi tự dò lịch sử (hay dò sót).
  const sentRefs = new Set(
    history
      .flatMap((t) => t.packet?.messages ?? [])
      .map((m) => m.assetRef)
      .filter((x): x is string => !!x),
  )
  // KHỬ ẢNH SINH ĐÔI: config bẩn hay có cùng 1 ảnh gắn 2+ slot → 2 id khác nhau.
  // Hệ quả kép: bot gửi "m9" nhưng map đánh-dấu-đã-gửi trỏ id sau ("m17") → lịch sử
  // ghi sai id, luật chống-lặp bị mù → khách nhận ảnh trùng. Chỉ giữ slot ĐẦU mỗi assetRef.
  const seenRefs = new Set<string>()
  let mNo = 0
  config.mediaMap.forEach((slot) => {
    if (seenRefs.has(slot.assetRef)) return
    seenRefs.add(slot.assetRef)
    const id = `m${++mNo}`
    mediaIndex.set(id, slot)
    refToId.set(slot.assetRef, id)
    const sent = sentRefs.has(slot.assetRef)
    const desc = slot.caption?.trim() ? slot.caption.trim() : `(${slot.mediaType})`
    const g = byRole.get(slot.role) ?? { lines: [], total: 0, sent: 0 }
    g.lines.push(`  ${id}: ${desc}${sent ? ' [ĐÃ GỬI]' : ''}`)
    g.total++
    if (sent) g.sent++
    byRole.set(slot.role, g)
  })
  const mediaLines: string[] = []
  for (const [role, g] of byRole) {
    const hint = ROLE_USAGE_HINTS[role]
    const remain = g.total - g.sent
    mediaLines.push(`• ${ROLE_LABELS[role]}${hint ? ` (${hint})` : ''} — còn ${remain}/${g.total} CHƯA GỬI:`)
    mediaLines.push(...g.lines)
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

  // ── BẢNG GIÁ = nguồn giá DUY NHẤT (mua X tặng Y = giá). Config cũ chưa có bảng
  //    → fallback bộ field legacy (chatPrice/chatPromo/discountFloor) để không vỡ. ──
  const comboMath = analyzePricing(config.pricingTiers ?? [])
  const combos = (config.pricingTiers ?? [])
    .filter((t) => t.qty && t.price.trim())
    .map((t) => {
      const free = t.freeQty && t.freeQty > 0 ? ` tặng ${t.freeQty}` : ''
      const note = t.label?.trim() ? ` (${t.label.trim()})` : ''
      return `- mua ${t.qty}${free}${note}: ${t.price.trim()}`
    })
    .join('\n')

  const sales = [
    ...(combos
      ? [] // có bảng giá → giá nói chuyện DUY NHẤT theo bảng, bỏ field legacy
      : [
          line('Giá chat (1 sản phẩm)', config.chatPrice),
          line('Khuyến mãi chat', config.chatPromo),
          line('Trần giảm giá (KHÔNG bán dưới mức này)', config.discountFloor),
        ]),
    line('Ghi chú giọng/playbook', config.playbookNote),
  ].filter(Boolean).join('\n')

  const variants = (config.variants ?? [])
    .filter((v) => v.name.trim() && v.options.trim())
    .map((v) => `- ${v.name.trim()}: ${v.options.trim()}`)
    .join('\n')

  const cp = config.codPolicy
  const policy = cp
    ? [
        line('Phí ship', cp.shippingFee),
        line('Thời gian giao', cp.deliveryTime),
        line('Khu vực COD', cp.coverage),
        line('Đổi trả / bảo hành', cp.returnPolicy),
        line('Ghi chú COD', cp.note),
      ].filter(Boolean).join('\n')
    : ''

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

  // ── Thông tin đã thu thập (tích luỹ xuyên phiên) ──
  const knownLines = Object.entries(knownInfo ?? {})
    .filter(([, v]) => (v ?? '').trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const prompt = [
    priorSummary?.trim() ? `=== TÓM TẮT PHIÊN (nhớ tổng hợp — bám để trả lời nhất quán) ===\n${priorSummary.trim()}\n` : '',
    '=== KHO THÔNG TIN SẢN PHẨM (nguyên liệu để CHỌN LỌC + diễn lại, ĐỪNG đọc nguyên văn) ===',
    facts || '(không có dữ liệu sản phẩm)',
    '',
    combos
      ? `=== BẢNG GIÁ (nguồn giá DUY NHẤT — bán ĐÚNG bảng, CẤM tự giảm/CẤM giá ngoài bảng; upsell gói lợi nhất + tính TỔNG đơn theo đây) ===\n${combos}${sales ? `\n${sales}` : ''}`
      : `=== GIÁ & BÁN (kênh chat) ===\n${sales || '(chưa cấu hình giá)'}`,
    comboMath ? `\n=== PHÂN TÍCH GÓI (SỐ ĐÃ TÍNH SẴN — nói ĐÚNG số này, TUYỆT ĐỐI KHÔNG tự tính lại; dùng để upsell combo=liệu trình+tiết kiệm RM tạo FOMO chốt) ===\n${comboMath}` : '',
    variants ? `\n=== BIẾN THỂ (bắt buộc xác nhận đúng khi chốt đơn) ===\n${variants}` : '',
    policy ? `\n=== CHÍNH SÁCH COD & GIAO HÀNG (fact CỨNG — trả đúng cái này, CẤM bịa; thiếu → handover) ===\n${policy}` : '',
    objections ? `\n=== XỬ LÝ TỪ CHỐI ĐẶC THÙ ===\n${objections}` : '',
    examples ? `\n=== HỘI THOẠI MẪU (bắt chước giọng này) ===\n${examples}` : '',
    mediaLines.length ? `\n=== DANH SÁCH MEDIA (gửi bằng id, vd assetRef="m1") ===\n${mediaLines.join('\n')}` : '\n(Chưa gắn media — chỉ trả lời text)',
    knownLines ? `\n=== ĐÃ THU THẬP TỪ KHÁCH (đã có sẵn — TUYỆT ĐỐI KHÔNG hỏi lại) ===\n${knownLines}` : '',
    historyText ? `\n=== LỊCH SỬ CHAT ===\n${historyText}` : '',
    `\n=== TIN MỚI CỦA KHÁCH ===\n${customerText}`,
    '\nHãy trả về JSON gói hành động cho lượt này.',
  ].filter(Boolean).join('\n')

  return { system: buildSystemPrompt(config.market), prompt, mediaIndex }
}
