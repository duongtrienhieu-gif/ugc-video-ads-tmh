// generateRebrandImage — TẤT CẢ 4 ảnh rebrand qua gpt-4o-image i2i (100% AI):
//   • label-front / label-back : thiết kế NHÃN hoàn chỉnh (có sản phẩm + chữ),
//     tỉ lệ gần kích thước thật (chọn size gpt gần nhất từ cm).
//   • product / set            : ảnh bán giữ form, thay nhãn brand mới.
// Giữ FORM gốc + palette gốc, thay brand sang tên mới. Có retry transient.

import { generateGpt4oImage, type ImageStatus, type Gpt4oSize } from '../../../utils/kieai'
import { getUrl, saveAsset } from '../../../utils/assetStore'
import { type RebrandIdentity, type RebrandImageKind, labelLangName } from '../types'

export interface GenerateRebrandImageParams {
  apiKey: string
  kind: RebrandImageKind
  identity: RebrandIdentity
  chosenName: string
  originalImageRefs: string[]
  /** Kích thước nhãn thật — để chọn tỉ lệ ảnh nhãn gần nhất. */
  widthCm?: number | null
  heightCm?: number | null
  /** asset:xxx nhãn front đã sinh — dùng cho product/set để pouch mặc ĐÚNG nhãn. */
  labelRef?: string | null
  onStatus?: (status: ImageStatus) => void
  signal?: AbortSignal
}

const TIMEOUT_MS = 5 * 60 * 1000

function isHardError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return m.includes('INSUFFICIENT_CREDITS') || m.toLowerCase().includes('policy') || m.includes('CANCELLED')
}
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (err) { lastErr = err; if (isHardError(err)) throw err }
  }
  throw lastErr
}
async function resolveUrls(refs: string[], max: number): Promise<string[]> {
  const urls: string[] = []
  for (const ref of refs.slice(0, max)) {
    try { const u = await getUrl(ref); if (u) urls.push(u) } catch { /* skip */ }
  }
  return urls
}

/** Chọn tỉ lệ gpt gần nhất với kích thước nhãn thật (cm). */
function pickLabelSize(widthCm?: number | null, heightCm?: number | null): Gpt4oSize {
  if (!widthCm || !heightCm || heightCm <= 0) return '3:2'
  const r = widthCm / heightCm
  const cands: Array<[Gpt4oSize, number]> = [['3:2', 1.5], ['1:1', 1], ['2:3', 2 / 3]]
  return cands.reduce((best, c) => (Math.abs(c[1] - r) < Math.abs(best[1] - r) ? c : best))[0]
}

export async function generateRebrandImage(params: GenerateRebrandImageParams): Promise<{ assetRef: string; prompt: string }> {
  const { kind, identity, chosenName } = params
  const baseRefUrls = await resolveUrls(params.originalImageRefs, 4)
  if (baseRefUrls.length === 0) throw new Error('Cần ít nhất 1 ảnh gốc hợp lệ.')
  // product/set: chèn nhãn front đã sinh lên ĐẦU ref → pouch mặc đúng nhãn in.
  const hasLabelRef = (kind === 'product' || kind === 'set') && !!params.labelRef
  let refUrls = baseRefUrls
  if (hasLabelRef) {
    const lu = await resolveUrls([params.labelRef as string], 1)
    if (lu.length) refUrls = [...lu, ...baseRefUrls].slice(0, 5)
  }
  const langName = labelLangName(identity.market)
  const P = identity.palette
  const bgRule = `BACKGROUND: a soft NON-WHITE light backdrop (warm beige or light grey gradient) + a soft drop shadow, so the product separates easily for background removal. Do NOT use a pure white background.`
  const labelApply = hasLabelRef ? `Apply the EXACT finished front-label design shown in the FIRST reference image onto the packaging (same layout, text and colours). ` : ''

  const baseBrand =
    `NEW BRAND: "${chosenName}". Render "${chosenName}" large, clean and spelled EXACTLY. ` +
    `Colour scheme similar to the original: background ${P.bg}, primary ${P.primary}, accent ${P.accent}. ` +
    `Label text language: ${langName}. Do NOT show any old brand name. Do NOT invent certification badges (Halal/KKM/FDA). Crisp, professional, readable.`
  const productLock =
    `USE THE REAL PRODUCT shown in the reference photos (the actual item + its packaging form ${identity.productForm}). Do NOT invent a different product or packaging. `
  // Nhãn = artwork PHẲNG để in dán — TUYỆT ĐỐI không vẽ bao bì 3D.
  const flatLabelLock =
    `This is a FLAT printed LABEL / STICKER ARTWORK ONLY (it will be printed and stuck onto the packaging). ` +
    `Do NOT depict any pouch, bag, box, carton, jar, bottle or ANY 3D packaging / product mockup anywhere in the image. ` +
    `Show ONLY the product's FOOD/ingredient imagery (the actual ${identity.productType}, e.g. the snack/fruit itself) + brand + text, as a flat full-bleed graphic, edge-to-edge. `

  let prompt: string
  let size: Gpt4oSize

  if (kind === 'label-front') {
    size = pickLabelSize(params.widthCm, params.heightCm)
    prompt =
      `TASK: Design a FINISHED, attractive, print-ready PRODUCT LABEL — FRONT — for a ${identity.productType}. ${flatLabelLock}` +
      `Layout: big brand name at top, tagline ${q(identity.tagline)}, 2-3 benefit highlights (${identity.benefits.map(q).join(', ')})` +
      `${identity.netWeight ? `, and net weight ${q(identity.netWeight)}` : ''}, plus appetising imagery of the food itself. ${baseBrand}`
  } else if (kind === 'label-back') {
    size = pickLabelSize(params.widthCm, params.heightCm)
    prompt =
      `TASK: Design the BACK product LABEL for a ${identity.productType} — tidy professional panel layout. ${flatLabelLock}` +
      `Sections: Ingredients (${q(identity.ingredients)}), Directions (${q(identity.usage)}), Caution & storage (${q(identity.caution)})` +
      `${identity.nutrition ? `, AND a clear NUTRITION INFORMATION table (per 100g): ${q(identity.nutrition)}` : ''}` +
      `${identity.netWeight ? `, net weight ${q(identity.netWeight)}` : ''}, with the brand name. ${baseBrand}`
  } else if (kind === 'product') {
    size = '1:1'
    prompt =
      `TASK: A clean studio PRODUCT SHOT of the re-branded ${identity.productType}. Single hero product, centered. ${bgRule} ${labelApply}` +
      `FORM LOCK: keep the EXACT physical form/shape from the reference (${identity.productForm}); only replace the label/branding. ${productLock}${baseBrand}`
  } else {
    size = '1:1'
    prompt =
      `TASK: A retail packshot of the re-branded ${identity.productType}: show EXACTLY ONE packaging — the SAME single ${identity.productForm} as the reference — together with the ACTUAL product item visible (spilling out of the open pack, or a small portion on a plate beside it). ` +
      `STRICT: do NOT add any second/extra packaging; do NOT invent a box if the real packaging is a pouch (or vice-versa). Only the real packaging form + the real product. Premium e-commerce look. ${bgRule} ${labelApply}` +
      `FORM LOCK: exactly one packaging matching the reference (${identity.productForm}); only replace branding. ${productLock}${baseBrand}`
  }

  if (typeof console !== 'undefined') {
    console.log(`[rebrand] ${kind} size=${size} name="${chosenName}" promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  const kieImageUrl = await withRetry(() => generateGpt4oImage({
    apiKey: params.apiKey, prompt, filesUrl: refUrls, size,
    onStatusChange: params.onStatus, timeoutMs: TIMEOUT_MS, signal: params.signal,
  }))
  const blob = await withRetry(async () => {
    const resp = await fetch(kieImageUrl)
    if (!resp.ok) throw new Error(`Tải ảnh AI thất bại (HTTP ${resp.status}).`)
    return resp.blob()
  })
  const assetRef = await saveAsset(blob, 'image/jpeg')
  return { assetRef, prompt }
}

function q(s: string): string {
  return `"${(s ?? '').replace(/"/g, "'").trim()}"`
}

export function friendlyRebrandError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('INSUFFICIENT_CREDITS')) return 'Hết credit kie.ai — nạp thêm để tiếp tục.'
  if (msg.toLowerCase().includes('policy')) return 'kie.ai từ chối prompt vì policy. Thử ảnh khác.'
  if (msg.includes('TIMEOUT')) return 'kie.ai quá lâu chưa xong — thử lại.'
  if (msg.includes('CANCELLED')) return 'Đã huỷ.'
  if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) return 'Lỗi mạng — đã thử lại nhưng chưa được. Bấm tạo lại.'
  return msg
}
