import { useState, useEffect, useRef } from 'react'
import { X, ImagePlus, Sparkles, Loader2, ScanSearch } from 'lucide-react'
import type { Product } from '../../stores/types'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { directGeminiVision } from '../../utils/gemini'
import { blobToSmallBase64 } from '../../utils/kieai'

interface ProductFormProps {
  item?: Product | null
  onSave: (data: Omit<Product, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

const FIELDS: { key: keyof Product; label: string; type: 'text' | 'textarea'; required?: boolean; placeholder?: string }[] = [
  { key: 'productName', label: 'Product Name', type: 'text', required: true },
  { key: 'productDescription', label: 'Product Description', type: 'textarea', required: true },
  { key: 'targetMarket', label: 'Target Market', type: 'text', required: true },
  { key: 'painPoints', label: 'Pain Points', type: 'textarea' },
  { key: 'usps', label: 'USP - Unique Selling Points', type: 'textarea' },
  { key: 'benefits', label: 'Benefits', type: 'textarea' },
  { key: 'offer', label: 'Offer & Pricing', type: 'text' },
  { key: 'ingredients', label: 'Ingredients', type: 'textarea', placeholder: 'e.g. Vitamin B12, Inulin (prebiotic), FloraFit probiotic strains, Angelica sinensis, Motherwort...' },
]

const JSON_SCHEMA = `{"productName":"","productDescription":"","targetMarket":"","painPoints":"","usps":"","benefits":"","offer":"","ingredients":""}`

const EXTRACT_SYSTEM = 'You are a product info extraction assistant. Return ONLY a raw minified JSON object on a single line — no markdown, no code fences, no explanation, no newlines inside values. Always respond in English.'

const EXTRACT_PROMPT = (pageText: string) =>
  `Extract product information from the webpage text below and fill in this JSON. ALL VALUES MUST BE IN ENGLISH (translate from source language if needed). Return ONLY the JSON, nothing else, all on one line:
${JSON_SCHEMA}

Fields:
- productName: main product name
- productDescription: short description of what it is and does
- targetMarket: target customers (who should use this)
- painPoints: customer problems/pain points this product solves
- usps: unique selling points / competitive advantages
- benefits: SPECIFIC benefits of using the product. CRITICAL for dual-category
  products (functional foods, health snacks, beauty supplements, fortified
  beverages, functional cosmetics) — EXTRACT BOTH layers:
    (a) Surface benefits: "delicious", "convenient", "easy to eat", "no mess"
    (b) FUNCTIONAL/HEALTH benefits with ingredient linkage if mentioned:
        e.g. "Black sesame supports heart health", "Walnut + cranberry lower
        cholesterol", "Fig provides natural fiber for blood sugar control",
        "Collagen-infused for skin elasticity", "B vitamins for energy metabolism"
  If the page mentions health claims, regulatory approvals (HALAL/KKM/FDA),
  ingredient functional purposes, or scientific backing → EXTRACT ALL of them.
  These are often the KEY SELLING POINTS hidden behind the surface description.
  Do NOT just paraphrase surface description — dig for functional value-prop
- offer: Product pricing — base price + ALL combo/bundle tiers visible on page. Extract EVERY pricing tier the page offers, no matter how many. Format CONCISE, comma-separated, no "for"/"FREE" filler words.
  ⚠️ EXTRACT 100% OF TIERS — if page shows 4 tiers ("BELI 1 PERCUMA 1", "BELI 2 PERCUMA 2", "BELI 3 PERCUMA 3", "BELI 5 PERCUMA 5"), output ALL 4. Do NOT stop at 2.
  ⚠️ INCLUDE originalPrice (gạch) when page shows "was RMxxx" or strikethrough price near the sale price — this is critical for the savings calculation.
  CONCISE FORMAT examples:
    • single tier: "RM59" or "RM55 (was RM109)"
    • multi-tier: "RM55 (was RM109), BUY 2 RM95, BUY 3 RM145"
    • bundle (NO "FREE for" filler — use "GET" only):
        "BUY 1 GET 1 RM59 (was RM129), BUY 2 GET 2 RM99, BUY 3 GET 3 RM129, BUY 5 GET 5 RM149"
    • with discount: "RM59, 50% off for first 50 customers"
  Do NOT include: shipping fees, COD info, delivery times, regional surcharges (e.g. "Sabah +RM5"), address fields, "FREESHIP" word (shipping is implied for bundle, not part of price text).

E-COMMERCE PLATFORM HANDLING:
Supported platforms include:
  - SEA: Shopee, Lazada, TikTok Shop, Tiki, Sendo
  - Chinese: 1688, Alibaba, AliExpress, Taobao, Tmall, Pinduoduo, JD.com
  - Western: Amazon, eBay, Walmart, Target, Best Buy, Etsy
The webpage may contain MULTIPLE products mixed together. Common noise sections to IGNORE (any language):
  - "Sản phẩm khác của shop" / "Other products from this shop" / "More from this seller"
  - "Có thể bạn cũng thích" / "You may also like" / "Customers also bought" / "Frequently bought together"
  - "Sản phẩm liên quan" / "Related products" / "Similar items" / "Recommended for you"
  - "Đã xem gần đây" / "Recently viewed" / "Browsing history"
  - "Sponsored" / "Quảng cáo" / "广告" / "推荐商品"
  - "你可能还喜欢" / "店铺其他商品" / "猜你喜欢"
⚠️ EXTRACT ONLY THE MAIN PRODUCT. Ignore ALL related/recommended/other-shop/sponsored sections completely.
Identify the main product by: appears FIRST in page text + has price + has detailed description + has main image gallery + has add-to-cart button. If multiple products with similar prominence exist → still pick the first (top of page).
For 1688/Alibaba B2B pages: focus on the main listing's price range / MOQ / specifications. Ignore "Recommended suppliers" / "Same category products".
- ingredients: PHYSICAL substances / compounds / active components actually INSIDE the product. Examples of CORRECT values: "Vitamin B12, A, E, biotin, iron, magnesium" or "Inulin prebiotic, FloraFit probiotic strains, Lactobacillus acidophilus, Bifidobacterium" or "Angelica sinensis, Motherwort herb, Dong Quai root" or "Hyaluronic acid, niacinamide, vitamin C, peptides".
  ❌ ABSOLUTE PROHIBITION: NEVER put marketing slogans, CTAs, call-to-action phrases, or promotional text here. The following are NOT ingredients and MUST NEVER appear in this field: "DAFTAR UNTUK DAPATKAN HARGA TAWARAN SEKARANG", "REGISTER TO GET THE OFFER PRICE NOW", "BUY NOW", "ORDER TODAY", "CLICK HERE", "SUBSCRIBE", "JOM BELI", "MUA NGAY", "ĐẶT HÀNG NGAY", "ĐĂNG KÝ", "Get yours now", "Shop now", etc.
  Ingredients = PHYSICAL THINGS inside the bottle/box (vitamins, herbs, probiotic strains, compounds, active molecules). CTAs = marketing actions for the customer to take. These are DIFFERENT.
  If the page does NOT list any actual ingredients/compounds and you cannot reasonably infer them from product type, return an EMPTY STRING "" — do NOT fill this field with marketing text, offer text, or CTAs.

WEBPAGE TEXT:
${pageText.slice(0, 16000)}`

const IMAGE_EXTRACT_PROMPT = `Extract product information from this product page screenshot and fill in this JSON. ALL VALUES MUST BE IN ENGLISH (translate from source language if needed). Return ONLY the JSON, nothing else, all on one line:
${JSON_SCHEMA}

Fields:
- productName: main product name
- productDescription: short description of what it is and does
- targetMarket: target customers (who should use this)
- painPoints: customer problems/pain points this product solves
- usps: unique selling points / competitive advantages
- benefits: SPECIFIC benefits of using the product. CRITICAL for dual-category
  products (functional foods, health snacks, beauty supplements, fortified
  beverages, functional cosmetics) — EXTRACT BOTH layers:
    (a) Surface benefits: "delicious", "convenient", "easy to eat", "no mess"
    (b) FUNCTIONAL/HEALTH benefits with ingredient linkage if mentioned:
        e.g. "Black sesame supports heart health", "Walnut + cranberry lower
        cholesterol", "Fig provides natural fiber for blood sugar control",
        "Collagen-infused for skin elasticity", "B vitamins for energy metabolism"
  If the page mentions health claims, regulatory approvals (HALAL/KKM/FDA),
  ingredient functional purposes, or scientific backing → EXTRACT ALL of them.
  These are often the KEY SELLING POINTS hidden behind the surface description.
  Do NOT just paraphrase surface description — dig for functional value-prop
- offer: Product pricing — base price + ALL combo/bundle tiers visible in screenshot. Extract EVERY tier shown, no matter how many (4-5 tiers OK). Format CONCISE, comma-separated.
  ⚠️ EXTRACT 100% OF TIERS — do NOT stop at 2. Include originalPrice (gạch) when shown.
  Format examples:
    • single: "RM59" or "RM55 (was RM109)"
    • multi: "RM55 (was RM109), BUY 2 RM95, BUY 3 RM145"
    • bundle (NO "FREE for" filler): "BUY 1 GET 1 RM59 (was RM129), BUY 2 GET 2 RM99, BUY 3 GET 3 RM129"
  Do NOT include: shipping fees, COD info, delivery times, regional surcharges, "FREESHIP" word.
- ingredients: SPECIFIC ingredients / active components / key compounds in this product (e.g. "Vitamin B12, A, E, biotin, iron", "Inulin prebiotic, FloraFit probiotic strains, Lactobacillus acidophilus", "Angelica sinensis, Motherwort herb"). List the actual ingredient names — do not write generic descriptions. If the screenshot doesn't list ingredients explicitly, infer the most likely active components from product type.`

// Jina Reader — renders JS pages and returns clean markdown. Handles LadiPage, Shopee, etc.
// 2026-05-20: limit 8000 → 16000 chars. Lý do: Ladipage thường có hero + marketing
// content dài, form order với multi-tier combo nằm cuối page. 8000 chars cắt mất phần
// form → chỉ extract được 1-2 tier đầu. 16000 chars (~4K tokens) đủ cover toàn page,
// vẫn an toàn cho Gemini 2.5 Flash context window.
async function fetchViaJina(url: string): Promise<string> {
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return ''
    const text = await r.text()
    return text.slice(0, 16000)
  } catch {
    return ''
  }
}

/** Escape raw control chars inside JSON string values so JSON.parse doesn't choke */
function repairJsonStrings(s: string): string {
  let out = ''
  let inStr = false
  let esc = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (esc) { out += ch; esc = false; continue }
    if (ch === '\\') { out += ch; esc = true; continue }
    if (ch === '"') { inStr = !inStr; out += ch; continue }
    if (inStr) {
      if      (ch === '\n') out += '\\n'
      else if (ch === '\r') out += '\\r'
      else if (ch === '\t') out += '\\t'
      else if (ch.charCodeAt(0) < 0x20) out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
      else out += ch
    } else {
      // remove trailing commas before } or ]
      out += ch
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

function parseExtracted(raw: string): Record<string, string> | null {
  let cleaned = raw.trim()

  // Strip ALL backtick/code-fence variants
  cleaned = cleaned
    .replace(/^`{1,3}(?:json)?\s*/i, '')
    .replace(/`{1,3}\s*$/i, '')
    .replace(/```(?:json)?\s*/gi, '')
    .trim()

  // Strategy 1: direct parse
  try { return JSON.parse(cleaned) as Record<string, string> } catch { /* continue */ }

  // Strategy 2: repair control chars then parse
  try { return JSON.parse(repairJsonStrings(cleaned)) as Record<string, string> } catch { /* continue */ }

  // Strategy 3: extract first { ... } block then repair + parse
  let depth = 0, start = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (cleaned[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        const slice = cleaned.slice(start, i + 1)
        try { return JSON.parse(slice) as Record<string, string> } catch { /* try repair */ }
        try { return JSON.parse(repairJsonStrings(slice)) as Record<string, string> } catch { start = -1 }
      }
    }
  }

  console.error('[parseExtracted] failed, raw:', raw.slice(0, 400))
  return null
}

type FormState = { productImage: string; productName: string; productDescription: string; targetMarket: string; painPoints: string; usps: string; benefits: string; offer: string; ingredients: string }

/** Detect CTA/marketing text that should NEVER appear in the ingredients field. */
export function looksLikeCTA(text: string): boolean {
  if (!text) return false
  const upper = text.trim().toUpperCase()
  if (!upper) return false
  const ctaKeywords = [
    // Malay
    'DAFTAR', 'BELI SEKARANG', 'BELI NOW', 'TEMPAH', 'TAWARAN', 'JOM BELI', 'KLIK',
    'DAPATKAN', 'HARGA PROMOSI', 'HARGA TAWARAN', 'OFFER PRICE',
    // Vietnamese
    'MUA NGAY', 'ĐẶT HÀNG', 'ĐĂNG KÝ', 'NHẬN NGAY', 'NHẤN VÀO', 'NHẬN ƯU ĐÃI',
    'GIÁ ƯU ĐÃI', 'KHUYẾN MÃI HÔM NAY',
    // English
    'BUY NOW', 'ORDER NOW', 'ORDER TODAY', 'CLICK HERE', 'REGISTER NOW',
    'REGISTER TO', 'REGISTER TODAY', 'SUBSCRIBE', 'SHOP NOW',
    'GET IT NOW', 'GET YOURS', 'GET THE OFFER', 'SIGN UP',
    'JOIN NOW', 'LEARN MORE', 'CLAIM NOW', 'CLAIM YOUR',
    'ADD TO CART', 'CHECKOUT', 'LIMITED TIME', 'HURRY',
  ]
  return ctaKeywords.some((kw) => upper.includes(kw))
}

/** Strip shipping/delivery text from offer field. Keeps only price + discount.
 *
 *  SAFETY: nếu strip làm string empty hoặc chỉ còn whitespace → ABORT,
 *  return original. Tránh edge case offer có combo tier kèm "FREESHIP"
 *  bị wipe toàn bộ (vd "BUY 1 RM55 + RM10 SHIP, BUY 2 RM95 FREESHIP"
 *  bị regex match toàn bộ vì không có dấu chấm câu chia). */
export function stripShippingFromOffer(text: string): string {
  if (!text) return ''
  const shippingPatterns = [
    // English
    /[^.!?\n]*(?:shipping|delivery|deliver to|cod\b|cash on delivery|free ship|additional[^.!?\n]*RM|extra cost|surcharge)[^.!?\n]*[.!?\n]?/gi,
    // Malay
    /[^.!?\n]*(?:penghantaran|kos hantar|tambahan untuk Sabah|tambahan untuk Sarawak|bayar bila terima)[^.!?\n]*[.!?\n]?/gi,
    // Vietnamese
    /[^.!?\n]*(?:phí ship|ship cod|giao hàng|miễn phí ship|phí vận chuyển)[^.!?\n]*[.!?\n]?/gi,
  ]
  let cleaned = text
  for (const pat of shippingPatterns) cleaned = cleaned.replace(pat, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim()

  // SAFETY NET: nếu strip xóa hết → giữ original (có thể combo deal có
  // "FREESHIP" kèm price, không muốn wipe). Re-check: nếu original có
  // dấu hiệu price (RM/Rp/$/đ + số) mà cleaned không có → abort.
  const hasPrice = (s: string) => /(?:RM|Rp|\$|đ|VND|IDR)\s*\d/i.test(s)
  if (!cleaned || (hasPrice(text) && !hasPrice(cleaned))) {
    console.warn('[stripShippingFromOffer] strip would wipe price info — keeping original:', text.slice(0, 100))
    return text
  }

  return cleaned
}

function applyExtracted(extracted: Record<string, string>, prev: FormState): { next: FormState; count: number } {
  const next = { ...prev }
  let count = 0
  for (const [key, value] of Object.entries(extracted)) {
    if (key in next && typeof value === 'string') {
      let v = value.trim()
      if (!v) continue
      // Safety net: if AI puts CTA text into ingredients field, drop it
      if (key === 'ingredients' && looksLikeCTA(v)) {
        console.warn('[applyExtracted] AI returned CTA in ingredients, dropping:', v.slice(0, 80))
        continue
      }
      // Safety net: strip shipping/delivery text from offer field
      if (key === 'offer') {
        const stripped = stripShippingFromOffer(v)
        if (stripped !== v) {
          console.info('[applyExtracted] stripped shipping from offer:', v.slice(0, 80), '→', stripped.slice(0, 80))
        }
        v = stripped
        if (!v) continue
      }
      ;(next as Record<string, string>)[key] = v
      count++
    }
  }
  return { next, count }
}

export default function ProductForm({ item, onSave, onCancel }: ProductFormProps) {
  const [form, setForm] = useState({
    productImage: item?.productImage ?? '',
    productName: item?.productName ?? '',
    productDescription: item?.productDescription ?? '',
    targetMarket: item?.targetMarket ?? '',
    painPoints: item?.painPoints ?? '',
    usps: item?.usps ?? '',
    benefits: item?.benefits ?? '',
    offer: stripShippingFromOffer(item?.offer ?? ''),
    ingredients: looksLikeCTA(item?.ingredients ?? '') ? '' : (item?.ingredients ?? ''),
  })
  const [productUrl, setProductUrl] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const screenshotRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const resolvedAssetUrl = useAssetUrl(form.productImage)
  const displayImage = localPreview ?? resolvedAssetUrl

  const addToast = useAppStore((s) => s.addToast)

  useEffect(() => {
    if (item) {
      setForm({
        productImage: item.productImage,
        productName: item.productName,
        productDescription: item.productDescription,
        targetMarket: item.targetMarket,
        painPoints: item.painPoints,
        usps: item.usps,
        benefits: item.benefits,
        // Auto-strip shipping/delivery text from offer field on load
        offer: stripShippingFromOffer(item.offer),
        // Clear legacy CTA text that leaked from the old `cta` column rename
        ingredients: looksLikeCTA(item.ingredients) ? '' : item.ingredients,
      })
    }
  }, [item])

  /** Force-clean all promotional / shipping noise from the form right now. */
  const handleCleanGarbage = () => {
    setForm((f) => ({
      ...f,
      offer: stripShippingFromOffer(f.offer),
      ingredients: looksLikeCTA(f.ingredients) ? '' : f.ingredients,
    }))
    addToast('✓ Đã dọn text quảng cáo / shipping khỏi các trường')
  }

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const getGeminiKey = () => {
    const store = useSettingsStore.getState()
    if (!store.hasGeminiKey()) throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → lấy key miễn phí')
    return store.getGeminiApiKey()
  }

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      set('productImage', dataUrl)
      setLocalPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleFetchInfo = async () => {
    let url = productUrl.trim()
    if (!url) return

    // Auto-prepend https:// if missing
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url

    setIsFetching(true)
    try {
      const geminiKey = getGeminiKey()

      // Jina Reader handles JS-rendered pages (LadiPage, Shopee, etc.)
      addToast('Đang đọc trang sản phẩm...')
      const pageText = await fetchViaJina(url)
      if (!pageText) throw new Error('Không đọc được nội dung trang. Thử tải ảnh chụp màn hình thay thế.')

      const response = await directGeminiVision({
        apiKey: geminiKey,
        parts: [{ text: EXTRACT_PROMPT(pageText) }],
        systemInstruction: EXTRACT_SYSTEM,
        maxOutputTokens: 2048,
      })

      const extracted = parseExtracted(response)
      if (!extracted) throw new Error('AI không trích xuất được thông tin. Thử tải ảnh chụp màn hình thay thế.')

      const { next, count } = applyExtracted(extracted, form)
      if (count === 0) throw new Error('Không trích xuất được thông tin. Thử tải ảnh chụp màn hình.')
      setForm(next)
      addToast(`Đã tự động điền ${count} trường thông tin`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Không thể lấy thông tin: ${msg}`, 'error')
    } finally {
      setIsFetching(false)
    }
  }

  const handleScreenshotAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setIsAnalyzing(true)
    try {
      const geminiKey = getGeminiKey()
      const base64 = await blobToSmallBase64(file, 1024)

      const response = await directGeminiVision({
        apiKey: geminiKey,
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: IMAGE_EXTRACT_PROMPT },
        ],
        maxOutputTokens: 2048,
      })

      const extracted = parseExtracted(response)
      if (!extracted) throw new Error('AI không trích xuất được thông tin từ ảnh, thử ảnh khác')

      const { next, count } = applyExtracted(extracted, form)
      if (count === 0) throw new Error('Không trích xuất được thông tin, thử ảnh khác')
      setForm(next)
      addToast(`Đã tự động điền ${count} trường từ ảnh`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Phân tích ảnh thất bại: ${msg}`, 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.productName.trim() || !form.productDescription.trim() || !form.targetMarket.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-gray-800">
          {item ? 'Chỉnh sửa sản phẩm' : 'Sản phẩm mới'}
        </h3>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Auto-fill */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 flex flex-col gap-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400/80">
          Tự động điền thông tin
        </p>
        {/* URL input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchInfo() } }}
            placeholder="ladipage.vn/... hoặc link sản phẩm bất kỳ"
            className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-sky-400/40"
          />
          <button
            type="button"
            onClick={handleFetchInfo}
            disabled={isFetching || isAnalyzing || !productUrl.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isFetching
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang lấy...</>
              : <><Sparkles className="h-3.5 w-3.5" />Lấy từ link</>
            }
          </button>
        </div>
        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-sky-500/15" />
          <span className="text-[10px] text-sky-400/60">hoặc</span>
          <div className="h-px flex-1 bg-sky-500/15" />
        </div>
        {/* Screenshot upload */}
        <button
          type="button"
          onClick={() => screenshotRef.current?.click()}
          disabled={isFetching || isAnalyzing}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-sky-400/30 bg-white/50 py-2.5 text-xs font-medium text-sky-500 transition-colors hover:bg-sky-500/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isAnalyzing
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang phân tích ảnh...</>
            : <><ScanSearch className="h-3.5 w-3.5" />Tải ảnh chụp màn hình trang sản phẩm</>
          }
        </button>
        <input ref={screenshotRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshotAnalyze} />
      </div>

      {/* Product image upload */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-black/10 bg-black/[0.02] transition-colors hover:border-black/15 overflow-hidden"
      >
        {displayImage ? (
          <img src={displayImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-5 w-5 text-gray-400 transition-colors group-hover:text-gray-600" />
        )}
      </button>
      <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="hidden" onChange={handleImage} />

      {FIELDS.map(({ key, label, type, required, placeholder }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
            {label}{required && ' *'}
          </span>
          {type === 'textarea' ? (
            <textarea
              value={form[key as keyof typeof form] as string}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15 resize-none"
            />
          ) : (
            <input
              value={form[key as keyof typeof form] as string}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
              className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15"
            />
          )}
        </label>
      ))}

      <button
        type="button"
        onClick={handleCleanGarbage}
        className="mt-1 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
        title="Strip CTA text khỏi Ingredients + shipping text khỏi Offer"
      >
        🧹 Dọn text quảng cáo / shipping khỏi các trường
      </button>

      <button
        type="submit"
        className="mt-1 rounded-full bg-black/8 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-black/10"
      >
        {item ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
      </button>
    </form>
  )
}
