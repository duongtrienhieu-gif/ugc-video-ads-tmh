// generateRebrandImage — TẤT CẢ 4 ảnh rebrand qua gpt-4o-image i2i (100% AI):
//   • label-front / label-back : thiết kế NHÃN hoàn chỉnh (có sản phẩm + chữ),
//     tỉ lệ gần kích thước thật (chọn size gpt gần nhất từ cm).
//   • product / set            : ảnh bán giữ form, thay nhãn brand mới.
// Giữ FORM gốc + palette gốc, thay brand sang tên mới. Có retry transient.

import { generateGpt4oImage, generateNanoBanana2, type ImageStatus, type Gpt4oSize } from '../../../utils/kieai'
import { getUrl, saveAsset } from '../../../utils/assetStore'
import { type RebrandIdentity, type RebrandImageKind, type PackagingType, type LabelModel, labelLangName, formatLabelDate } from '../types'

export interface GenerateRebrandImageParams {
  apiKey: string
  kind: RebrandImageKind
  identity: RebrandIdentity
  chosenName: string
  originalImageRefs: string[]
  /** Kích thước nhãn thật — để chọn tỉ lệ ảnh nhãn gần nhất. */
  widthCm?: number | null
  heightCm?: number | null
  /** Kiểu dán nhãn (flat = 1 mặt · round = quấn tròn). */
  packagingType?: PackagingType
  /** Model render nhãn (chỉ áp cho kind 'label'). */
  labelModel?: LabelModel
  /** asset:xxx nhãn front đã sinh — dùng cho product/set để pouch mặc ĐÚNG nhãn. */
  labelRef?: string | null
  /** NSX / HSD — in lên nhãn (kind 'label'). */
  mfgDate?: string
  expDate?: string
  /** Mã lô + số barcode — in lên nhãn (kind 'label'). */
  batchCode?: string
  barcodeNum?: string
  onStatus?: (status: ImageStatus) => void
  signal?: AbortSignal
}

const TIMEOUT_MS = 3.5 * 60 * 1000 // fail nhanh hơn để khỏi treo lâu

function isHardError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return m.includes('INSUFFICIENT_CREDITS') || m.toLowerCase().includes('policy') || m.includes('CANCELLED')
}
async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
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
  const isRound = params.packagingType === 'round'
  const bgRule = `BACKGROUND: a soft NON-WHITE light backdrop (warm beige or light grey gradient) + a soft drop shadow, so the product separates easily for background removal. Do NOT use a pure white background.`
  const adBgRule = `BACKGROUND: a rich, finished ADVERTISING backdrop — a soft gradient / lightly styled scene in the brand palette with a gentle glow. This image is used directly in ads/banners, so NO need for background removal.`
  const roundFormHint = isRound ? `The packaging is a ROUND jar/bottle/can with a wrap-around label. ` : ''
  const labelApply = hasLabelRef
    ? (isRound
        ? `The FIRST reference image is a WRAP-AROUND label strip (front · blank middle · back). Show the container with this label WRAPPED around it so ONLY the FRONT portion of the design faces the camera; the back-info and the middle blank gap curve away out of sight. Do NOT lay the whole flat strip (with back info / gap) flat on the front. `
        : `Apply the EXACT finished front-label design shown in the FIRST reference image onto the packaging (same layout, text and colours). `)
    : ''

  const colorsStr = (P.colors && P.colors.length ? P.colors : [P.bg, P.primary, P.accent]).join(', ')
  // baseBrand = quy tắc brand DÙNG CHUNG mọi ảnh (tên + palette + ngôn ngữ + cấm nhãn cũ).
  const baseBrand =
    `NEW BRAND: "${chosenName}". Render "${chosenName}" large, clean and spelled EXACTLY. ` +
    `COLOUR PALETTE — use the FULL rich set, do NOT reduce to 1-2 colours: ${colorsStr}. ` +
    `Label text language: ${langName}. Do NOT show any old brand name. Do NOT invent certification badges (Halal/KKM/FDA). Crisp, professional, readable.`
  // sceneMatch = bám bối cảnh/vibe bản gốc — CHỈ cho NHÃN + COMBO (artwork & ads).
  // KHÔNG dùng cho product/set: chúng là packshot studio sạch (theo bgRule); ép bám
  // "scene gốc" sẽ chọi bgRule → AI rải đồ ăn/đạo cụ lung tung ("bịa", lệch nhãn #1).
  const sceneMatch =
    ` MATCH ~85% the LOOK & FEEL of the reference design: closely follow its background style/scene, colour richness and decorative motifs` +
    `${identity.vibe ? ` (${identity.vibe})` : ''}; clearly inspired by it but NOT an identical copy.`
  const productLock =
    `USE THE REAL PRODUCT shown in the reference photos (the actual item + its packaging form ${identity.productForm}). Do NOT invent a different product or packaging. `
  // Nhãn = artwork PHẲNG để in dán — TUYỆT ĐỐI không vẽ bao bì 3D.
  const flatLabelLock =
    `This is a FLAT printed LABEL / STICKER ARTWORK ONLY (it will be printed and stuck onto the packaging). ` +
    `Do NOT depict any pouch, bag, box, carton, jar, bottle or ANY 3D packaging / product mockup anywhere in the image. ` +
    `Show ONLY the product's FOOD/ingredient imagery (the actual ${identity.productType}, e.g. the snack/fruit itself) + brand + text, as a flat full-bleed graphic, edge-to-edge. ` +
    `SAFE AREA: keep ALL text, logo and key elements within the central area with a generous margin from every edge; only the background/decoration extends fully to the edges (full bleed), so the artwork can be trimmed to the exact print ratio WITHOUT cutting any text. `

  // Khối nội dung gộp (front + back) dùng chung cho nhãn 1 nhãn.
  const frontContent =
    `FRONT content: the BRAND NAME ${q(chosenName)} must be the BIGGEST, most prominent text on the label (the hero). ` +
    `The product category "${identity.productType}" appears only as a SMALLER secondary line BELOW the brand — it must NOT be larger than the brand name and must NOT replace it. ` +
    `Plus tagline ${q(identity.tagline)}, 2-3 benefit highlights (${identity.benefits.map(q).join(', ')})` +
    `${identity.netWeight ? `, net weight ${q(identity.netWeight)}` : ''}, plus appetising imagery of the food itself.`
  const nutriTitle = (identity.nutritionTitle || 'NUTRITION INFORMATION').trim()
  const backContent =
    `BACK / INFO content: Ingredients (${q(identity.ingredients)}), Directions (${q(identity.usage)}), Caution & storage (${q(identity.caution)})` +
    `${identity.nutrition ? `, a clear panel titled ${q(nutriTitle)} containing EXACTLY this data (render every row + any "† Daily Value not established" footnote faithfully; do NOT swap in generic food macros and NEVER print placeholder asterisks like "**"): ${q(identity.nutrition)}` : ''}.`
  // Ngày format theo thị trường: ms → "04 Sep 2026" (MFG/EXP), vi → "04/09/2026" (NSX/HSD).
  const mfg = formatLabelDate(params.mfgDate ?? '', identity.market)
  const exp = formatLabelDate(params.expDate ?? '', identity.market)
  const dLbl = identity.market === 'ms' ? { mfg: 'MFG', exp: 'EXP' } : { mfg: 'NSX', exp: 'HSD' }
  const dateLine = (mfg || exp)
    ? ` In the info area print a small date block; render BOTH dates character-for-character EXACTLY as written below, in the SAME format, with NO slashes added, NO extra digits, NO reformatting: ${mfg ? `${dLbl.mfg} ${q(mfg)}` : ''}${mfg && exp ? ' , ' : ''}${exp ? `${dLbl.exp} ${q(exp)}` : ''}.`
    : ''
  const batch = (params.batchCode ?? '').trim(), barcode = (params.barcodeNum ?? '').trim()
  const codeLine = (batch || barcode)
    ? `${batch ? ` Print a small batch/lot code "LOT: ${batch}".` : ''}${barcode ? ` Render a realistic EAN-13 BARCODE graphic (sharp black bars on white) with the digits ${barcode} printed beneath it, in the info area.` : ''}`
    : ''

  let prompt: string
  let size: Gpt4oSize

  if (kind === 'label') {
    const isRound = params.packagingType === 'round'
    if (isRound) {
      size = '3:2' // nhãn quấn dài → dùng landscape rộng nhất của gpt + gap giữa
      prompt =
        `TASK: Design ONE long WRAP-AROUND product LABEL for a ${identity.productType} packaged in a ROUND jar/can (the label wraps from front to back). ${flatLabelLock}` +
        `LAYOUT (left→right): the FRONT design on the LEFT (~45%) [${frontContent}], then a CLEAR BLANK / neutral background BAND in the MIDDLE (~10%, no text — this is the wrap seam / side), then the BACK INFO on the RIGHT (~45%) [${backContent}].${dateLine}${codeLine} ${baseBrand}${sceneMatch}`
    } else {
      size = pickLabelSize(params.widthCm, params.heightCm)
      prompt =
        `TASK: Design ONE single-face product LABEL (everything on ONE sticker) for a ${identity.productType} on a flat pouch/box. ${flatLabelLock}` +
        `LAYOUT: TOP HALF = hero [${frontContent}]; BOTTOM HALF = a tidy info panel [${backContent}]. Balanced, readable, not cramped.${dateLine}${codeLine} ${baseBrand}${sceneMatch}`
    }
  } else if (kind === 'product') {
    size = '1:1'
    prompt =
      `TASK: A clean studio PRODUCT SHOT of the re-branded ${identity.productType}. Single hero product, centered, wearing the EXACT new label shown in the FIRST reference image. ${roundFormHint}${bgRule} ${labelApply}` +
      `Plain clean studio backdrop ONLY — do NOT scatter loose food, ingredients, herbs or props around the product, and do NOT recreate the original packaging's busy scene. ` +
      `FORM LOCK: keep the EXACT physical form/shape from the reference (${identity.productForm}); only replace the label/branding. ${productLock}${baseBrand}`
  } else if (kind === 'set') {
    size = '1:1'
    prompt =
      `TASK: A retail packshot of the re-branded ${identity.productType}: show EXACTLY ONE packaging — the SAME single ${identity.productForm} as the reference — together with the ACTUAL product item visible (spilling out of the open pack, or a small portion on a plate beside it). ` +
      `STRICT: do NOT add any second/extra packaging; do NOT invent a box if the real packaging is a pouch (or vice-versa). Only the real packaging form + the real product. Premium e-commerce look. ${roundFormHint}${bgRule} ${labelApply}` +
      `FORM LOCK: exactly one packaging matching the reference (${identity.productForm}); only replace branding. ${productLock}${baseBrand}`
  } else {
    // combo — tháp chính diện + nguyên liệu, nền ads (không cần tách nền)
    size = '1:1'
    prompt =
      `TASK: An eye-catching ADVERTISING COMBO hero for the re-branded ${identity.productType}. Show MULTIPLE units (4-6) arranged FRONT-ON in a tiered PYRAMID (bottom row of 3, then 2, then 1), ALL front labels facing the camera straight-on (eye-level, not top-down). ` +
      (isRound
        ? `Since the packaging is a round bottle/jar, use a STABLE tiered/triangular arrangement on a small riser/box so it looks solid (not about to topple). ${roundFormHint}`
        : ``) +
      `EVERY unit must show the IDENTICAL new front label — same design, text, colours and ORIENTATION on ALL units (no rotated or mismatched labels). ` +
      `The reference image shows the FINISHED new-label product — replicate THAT exact label on EVERY single unit. NEVER copy any old, original or foreign-language (e.g. Chinese) label onto any unit. ` +
      `LAYOUT: the product pyramid sits in the CENTRE. On the LEFT, an info panel — the brand name ${q(chosenName)}, tagline ${q(identity.tagline)}, and 3-4 benefit points with small icons (${identity.benefits.map(q).join(', ')}). On the RIGHT, a panel titled "Formulated with…" listing the ingredients (${q(identity.ingredients)}). Keep these panels clean and readable. ` +
      `Heap and scatter the product's REAL raw ingredients (e.g. ${q(identity.ingredients || identity.productType)}) at the base and foreground — natural and appetising. ${adBgRule} ${labelApply}` +
      `FORM LOCK: same packaging form as the reference (${identity.productForm}); only the branding is the new one. ${baseBrand}${sceneMatch}`
  }

  if (typeof console !== 'undefined') {
    console.log(`[rebrand] ${kind} size=${size} name="${chosenName}" promptLen=${prompt.length} refs=${refUrls.length}`)
  }

  // Nhãn + nano4k → nano-banana-2 4K (PNG, bám ref). Còn lại → gpt-4o-image.
  const useNano = kind === 'label' && params.labelModel === 'nano4k'
  const kieImageUrl = await withRetry(() => useNano
    ? generateNanoBanana2({
        apiKey: params.apiKey, prompt, imageInput: refUrls, aspectRatio: size, resolution: '4K', outputFormat: 'png',
        onStatusChange: params.onStatus, timeoutMs: TIMEOUT_MS, signal: params.signal,
      })
    : generateGpt4oImage({
        apiKey: params.apiKey, prompt, filesUrl: refUrls, size,
        onStatusChange: params.onStatus, timeoutMs: TIMEOUT_MS, signal: params.signal,
      }))
  const blob = await withRetry(async () => {
    const resp = await fetch(kieImageUrl)
    if (!resp.ok) throw new Error(`Tải ảnh AI thất bại (HTTP ${resp.status}).`)
    return resp.blob()
  })

  // KHÔNG crop nữa: giữ NHÃN FULL (crop cũ cắt mép trên → mất brand). Chấp nhận
  // tỉ lệ ~gần (gpt 3:2/1:1/2:3) đổi lại không bao giờ cắt mất nội dung.
  const assetRef = await saveAsset(blob, blob.type || 'image/jpeg')
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
