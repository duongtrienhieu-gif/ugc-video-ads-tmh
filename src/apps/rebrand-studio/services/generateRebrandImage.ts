// generateRebrandImage — ảnh BÁN (#2 product, #3 set) qua gpt-4o-image i2i.
// Giữ FORM sản phẩm từ ảnh gốc, THAY nhãn/brand sang tên mới + palette. Chữ
// brand do AI nướng (ảnh bán chấp nhận). Có retry transient.

import { generateGpt4oImage, type ImageStatus } from '../../../utils/kieai'
import { getUrl, saveAsset } from '../../../utils/assetStore'
import { type RebrandIdentity, type RebrandImageKind, labelLangName } from '../types'

export interface GenerateRebrandImageParams {
  apiKey: string
  kind: 'product' | 'set'
  identity: RebrandIdentity
  chosenName: string
  originalImageRefs: string[]
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

export async function generateRebrandImage(params: GenerateRebrandImageParams): Promise<{ assetRef: string; prompt: string }> {
  const { kind, identity, chosenName } = params
  const refUrls = await resolveUrls(params.originalImageRefs, 3)
  if (refUrls.length === 0) throw new Error('Cần ít nhất 1 ảnh gốc hợp lệ.')
  const langName = labelLangName(identity.market)
  const P = identity.palette

  const common =
    `FORM LOCK: keep the EXACT physical form/shape of the product from the reference photo (same ${identity.productForm}). ` +
    `RE-BRAND: replace ALL old branding/label with a NEW brand named "${chosenName}". Render "${chosenName}" + the tagline "${identity.tagline}" cleanly and correctly on the label. ` +
    `Keep a colour scheme similar to the original: background ${P.bg}, primary ${P.primary}, accent ${P.accent}. ` +
    `Label text language: ${langName}. Do NOT show the old brand name. Do NOT invent certification badges. ` +
    `Spell "${chosenName}" EXACTLY. Clean, professional e-commerce studio look, soft neutral background, sharp focus.`

  const prompt = kind === 'product'
    ? `TASK: A clean studio PRODUCT SHOT of the re-branded ${identity.productType}. Single hero product, centered.\n${common}`
    : `TASK: A retail SET shot — the re-branded ${identity.productType} STANDING NEXT TO its matching retail BOX/packaging (both same new brand "${chosenName}", consistent design), plus the actual product item visible. Premium unboxing/e-commerce look.\n${common}`

  if (typeof console !== 'undefined') {
    console.log(`[rebrand] ${kind} name="${chosenName}" promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  const kieImageUrl = await withRetry(() => generateGpt4oImage({
    apiKey: params.apiKey, prompt, filesUrl: refUrls, size: '1:1',
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

export function friendlyRebrandError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('INSUFFICIENT_CREDITS')) return 'Hết credit kie.ai — nạp thêm để tiếp tục.'
  if (msg.toLowerCase().includes('policy')) return 'kie.ai từ chối prompt vì policy. Thử ảnh khác.'
  if (msg.includes('TIMEOUT')) return 'kie.ai quá lâu chưa xong — thử lại.'
  if (msg.includes('CANCELLED')) return 'Đã huỷ.'
  if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) return 'Lỗi mạng — đã thử lại nhưng chưa được. Bấm tạo lại.'
  return msg
}

// Chỉ là alias gom kind cho UI (label-front/back render bằng canvas riêng).
export const REBRAND_AI_KINDS: RebrandImageKind[] = ['product', 'set']
