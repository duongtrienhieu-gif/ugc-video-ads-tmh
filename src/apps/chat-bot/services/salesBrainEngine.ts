// ─────────────────────────────────────────────────────────────────────────
// CHAT BOT — Engine: 1 call Gemini → ActionPacket (channel-agnostic).
//
// Dùng được cho Simulator (P3) lẫn adapter WhatsApp/Pancake (P5/P6) — chỉ cần
// truyền history + tin khách. TIẾT KIỆM: đúng 1 call/lượt, maxOutputTokens thấp,
// thinkingBudget=0, JSON schema-constrained (gần như không lỗi parse). Lỗi nặng
// mới re-call 1 lần.
// ─────────────────────────────────────────────────────────────────────────

import type { Product } from '../../../stores/types'
import { directGeminiText } from '../../../utils/gemini'
import { STAGE_ORDER } from '../labels'
import type { ActionPacket, BotMessage, CapturedOrder, ChatTurn, MediaSlot, SalesConfig, Stage } from '../types'
import { compilePrompt } from './compilePrompt'

const ACTION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['text', 'image', 'video'] },
          contentTarget: { type: 'string' },
          contentVi: { type: 'string' },
          assetRef: { type: 'string' }, // id ngắn (m1…) từ danh sách media
        },
        required: ['type'],
      },
    },
    awaitCustomer: { type: 'boolean' },
    nextStage: { type: 'string', enum: STAGE_ORDER },
    intent: { type: 'string' },
    captured: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, value: { type: 'string' } },
        required: ['key', 'value'],
      },
    },
    handover: { type: 'boolean' },
    handoverReason: { type: 'string' },
    order: {
      type: 'object',
      properties: {
        customerName: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, qty: { type: 'number' } },
          },
        },
        total: { type: 'string' },
        note: { type: 'string' },
      },
    },
    orderComplete: { type: 'boolean' },
    followupAfterMinutes: { type: 'number' },
    followupNote: { type: 'string' },
    sessionSummary: { type: 'string' },
    customerVi: { type: 'string' },
  },
  required: ['messages', 'awaitCustomer', 'nextStage', 'intent', 'handover'],
}

interface RawPacket {
  messages?: Array<{ type?: string; contentTarget?: string; contentVi?: string; assetRef?: string }>
  awaitCustomer?: boolean
  nextStage?: string
  intent?: string
  captured?: Array<{ key?: string; value?: string }>
  handover?: boolean
  handoverReason?: string
  order?: {
    customerName?: string; phone?: string; address?: string
    items?: Array<{ name?: string; qty?: number }>
    total?: string; note?: string
  }
  orderComplete?: boolean
  customerVi?: string
  followupAfterMinutes?: number
  followupNote?: string
  sessionSummary?: string
}

/** Gom order từ model → CapturedOrder sạch (bỏ field rỗng, ép qty number). */
function normalizeOrder(o: RawPacket['order']): CapturedOrder | undefined {
  if (!o) return undefined
  const items = (o.items ?? [])
    .map((it) => ({ name: it.name?.trim() || undefined, qty: typeof it.qty === 'number' ? it.qty : undefined }))
    .filter((it) => it.name || typeof it.qty === 'number')
  const order: CapturedOrder = {
    customerName: o.customerName?.trim() || undefined,
    phone: o.phone?.trim() || undefined,
    address: o.address?.trim() || undefined,
    items: items.length ? items : undefined,
    total: o.total?.trim() || undefined,
    note: o.note?.trim() || undefined,
  }
  return Object.values(order).some((v) => v !== undefined) ? order : undefined
}

// Hạ chữ HOA đầu câu/đầu tin cho văn phong chat thật (Flash hay tự viết hoa lại).
// Chỉ hạ khi chữ hoa đứng trước 1 chữ THƯỜNG (Capitalized word) → acronym/thương hiệu
// viết HOA-HOA (LANZF, RM, KKM, COD) KHÔNG khớp nên được giữ nguyên.
function lowerSentenceStarts(text: string): string {
  return text.replace(/(^|[.!?]\s+|\n+)([A-ZÀ-Ỹ])(?=[a-zà-ỹ])/gu, (_m, pre: string, c: string) => pre + c.toLowerCase())
}

/** Cố parse JSON, gỡ fence nếu có. Không tốn call. */
function parseJson(text: string): RawPacket | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned) as RawPacket
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) as RawPacket } catch { /* fall through */ }
    }
    return null
  }
}

function normalize(raw: RawPacket, mediaIndex: Map<string, MediaSlot>): ActionPacket {
  const stage: Stage = STAGE_ORDER.includes(raw.nextStage as Stage) ? (raw.nextStage as Stage) : 'value'

  const messages: BotMessage[] = (raw.messages ?? []).map((m): BotMessage | null => {
    const type = m.type === 'image' || m.type === 'video' ? m.type : 'text'
    if (type === 'text') {
      if (!m.contentTarget?.trim()) return null
      return { type: 'text', contentTarget: lowerSentenceStarts(m.contentTarget), contentVi: m.contentVi }
    }
    // image/video — resolve id ngắn (m1) → assetRef thật
    const slot = m.assetRef ? mediaIndex.get(m.assetRef) : undefined
    if (!slot) {
      // bot tham chiếu ảnh không có → hạ về text nếu có chữ, không thì bỏ
      return m.contentTarget?.trim() ? { type: 'text', contentTarget: lowerSentenceStarts(m.contentTarget), contentVi: m.contentVi } : null
    }
    return {
      type: slot.mediaType,
      assetRef: slot.assetRef,
      contentTarget: m.contentTarget ? lowerSentenceStarts(m.contentTarget) : undefined,
      contentVi: m.contentVi,
    }
  }).filter((m): m is BotMessage => m !== null)

  const captured: Record<string, string> = {}
  for (const c of raw.captured ?? []) {
    if (c.key?.trim()) captured[c.key.trim()] = c.value ?? ''
  }

  return {
    messages,
    awaitCustomer: raw.awaitCustomer ?? true,
    nextStage: stage,
    intent: raw.intent ?? 'unknown',
    captured,
    handover: raw.handover ?? false,
    handoverReason: raw.handoverReason?.trim() || undefined,
    order: normalizeOrder(raw.order),
    orderComplete: raw.orderComplete ?? false,
    suggestedFollowup:
      typeof raw.followupAfterMinutes === 'number'
        ? { afterMinutes: raw.followupAfterMinutes, note: raw.followupNote ?? '' }
        : undefined,
    sessionSummary: raw.sessionSummary?.trim() || undefined,
    customerVi: raw.customerVi?.trim() || undefined,
  }
}

export interface SalesBrainInput {
  config: SalesConfig
  product: Product | undefined
  history: ChatTurn[]
  customerText: string
  apiKey: string
  /** Thông tin đã moi tích luỹ xuyên phiên (sđt/địa chỉ/tên/số lượng…). */
  knownInfo?: Record<string, string>
  /** Tóm tắt phiên ở lượt trước (running summary) — để nhớ tổng hợp khi chat dài. */
  priorSummary?: string
}

/** Chạy engine 1 lượt: tin khách → ActionPacket. ĐÚNG 1 call Gemini (re-call tối đa 1
 *  lần nếu parse hỏng hoàn toàn). */
export async function runSalesBrain(input: SalesBrainInput): Promise<ActionPacket> {
  const { system, prompt, mediaIndex } = compilePrompt(input)

  const call = () => directGeminiText({
    apiKey: input.apiKey,
    prompt,
    systemInstruction: system,
    responseMimeType: 'application/json',
    responseSchema: ACTION_SCHEMA,
    temperature: 0.7,
    maxOutputTokens: 2048, // ngách tư vấn sâu: 2-4 tin + captions + gloss VN — 1024 bị bóp cụt
    thinkingBudget: 0, // tắt thinking: tiết kiệm token + tránh JSON bị cắt cụt
  })

  let raw = parseJson(await call())
  if (!raw) raw = parseJson(await call()) // re-call 1 lần duy nhất
  if (!raw) throw new Error('Engine: không đọc được phản hồi JSON từ Gemini')

  return normalize(raw, mediaIndex)
}
