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
import type { ActionPacket, BotMessage, ChatTurn, MediaSlot, SalesConfig, Stage } from '../types'
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
    followupAfterMinutes: { type: 'number' },
    followupNote: { type: 'string' },
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
  followupAfterMinutes?: number
  followupNote?: string
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
      return { type: 'text', contentTarget: m.contentTarget, contentVi: m.contentVi }
    }
    // image/video — resolve id ngắn (m1) → assetRef thật
    const slot = m.assetRef ? mediaIndex.get(m.assetRef) : undefined
    if (!slot) {
      // bot tham chiếu ảnh không có → hạ về text nếu có chữ, không thì bỏ
      return m.contentTarget?.trim() ? { type: 'text', contentTarget: m.contentTarget, contentVi: m.contentVi } : null
    }
    return { type: slot.mediaType, assetRef: slot.assetRef, contentTarget: m.contentTarget, contentVi: m.contentVi }
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
    suggestedFollowup:
      typeof raw.followupAfterMinutes === 'number'
        ? { afterMinutes: raw.followupAfterMinutes, note: raw.followupNote ?? '' }
        : undefined,
  }
}

export interface SalesBrainInput {
  config: SalesConfig
  product: Product | undefined
  history: ChatTurn[]
  customerText: string
  apiKey: string
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
    maxOutputTokens: 1024,
    thinkingBudget: 0, // tắt thinking: tiết kiệm token + tránh JSON bị cắt cụt
  })

  let raw = parseJson(await call())
  if (!raw) raw = parseJson(await call()) // re-call 1 lần duy nhất
  if (!raw) throw new Error('Engine: không đọc được phản hồi JSON từ Gemini')

  return normalize(raw, mediaIndex)
}
