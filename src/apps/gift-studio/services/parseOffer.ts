// parseOffer — AI đọc-hiểu ô dán offer (BẤT KỲ ngôn ngữ) → tiers có cấu trúc.
//
// Mỗi dòng offer kiểu "BELI 2 KOTAK FREE 2 KOTAK: RM89 + FREE SHIPPING +
// 1 SNACK HAWTHORN" tách thành:
//   - buyMainQty  : mua mấy SẢN PHẨM CHÍNH (KOTAK/box/hộp)
//   - freeMainQty : tặng kèm mấy SẢN PHẨM CHÍNH (buy X free X)
//   - giftQty     : tặng mấy món QUÀ kèm (SP khác, vd SNACK) — 0 nếu mốc không tặng
//   - price       : giá bán (số RM)
//
// BỎ shipping (thừa, không lên ảnh). Định danh món quà KHÔNG lấy ở đây —
// dùng ảnh + tên quà user upload; ô dán chỉ cho SỐ LƯỢNG quà mỗi mốc.

import { directGeminiText } from '../../../utils/gemini'
import { MAX_GIFT_TIERS, type GiftTier } from '../types'

export interface ParseOfferParams {
  apiKey: string
  offerText: string
}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    tiers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          buyMainQty: { type: 'integer' },
          freeMainQty: { type: 'integer' },
          giftQty: { type: 'integer' },
          price: { type: 'number' },
        },
        required: ['buyMainQty', 'freeMainQty', 'giftQty', 'price'],
      },
    },
  },
  required: ['tiers'],
}

const SYSTEM =
  `You parse a pasted COD combo-offer (Malaysian/Vietnamese/English — understand ANY language) ` +
  `into structured pricing tiers. Each line/row is ONE tier.\n` +
  `For each tier extract EXACTLY:\n` +
  `- buyMainQty: how many MAIN products the customer BUYS (the boxes/kotak/hộp/units being purchased).\n` +
  `- freeMainQty: how many MAIN products are given FREE (the "buy X free X" / "FREE N KOTAK" part). 0 if none.\n` +
  `- giftQty: how many BONUS GIFT items (a DIFFERENT product, e.g. a snack/sample/accessory) are given. 0 if the tier gives no bonus gift.\n` +
  `- price: the PRODUCT selling price as a NUMBER only — take the FIRST RM amount on the line (the combo's product price), e.g. "RM89" -> 89.\n` +
  `RULES:\n` +
  `- CRITICAL: shipping is NOT part of the price. IGNORE shipping completely — whether it is free shipping / freeship OR a numeric fee like "+ RM10 Shipping". NEVER add a shipping amount into price. Examples: "RM49 + RM10 Shipping" -> price = 49 (NOT 59); "RM79 + FREESHIP" -> price = 79.\n` +
  `- The MAIN product is the primary item being bought repeatedly; the BONUS GIFT is a smaller, different add-on item named in the line.\n` +
  `- If a tier clearly has no separate bonus gift, giftQty = 0.\n` +
  `- Preserve tier order as written. Output ONLY the JSON.`

export async function parseOffer(params: ParseOfferParams): Promise<GiftTier[]> {
  const raw = await directGeminiText({
    apiKey: params.apiKey,
    prompt: `Parse this offer into tiers JSON:\n\n${params.offerText.trim()}`,
    systemInstruction: SYSTEM,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    thinkingBudget: 0,
    temperature: 0,
    maxOutputTokens: 2048,
  })

  let parsed: { tiers?: Array<Partial<GiftTier>> }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI trả về không phải JSON hợp lệ khi phân tích mốc tặng.')
  }

  const tiers: GiftTier[] = (parsed.tiers ?? [])
    .map((t) => ({
      buyMainQty: Math.max(1, Math.round(Number(t.buyMainQty ?? 1))),
      freeMainQty: Math.max(0, Math.round(Number(t.freeMainQty ?? 0))),
      giftQty: Math.max(0, Math.round(Number(t.giftQty ?? 0))),
      price: Math.max(0, Math.round(Number(t.price ?? 0))),
    }))
    .filter((t) => t.price > 0)
    .slice(0, MAX_GIFT_TIERS)

  if (tiers.length === 0) {
    throw new Error('Không đọc được mốc nào từ ô dán — kiểm tra lại nội dung offer.')
  }
  return tiers
}
