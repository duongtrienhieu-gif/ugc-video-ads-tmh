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

const FIELDS_SPEC = `Fields:
- productName: main product name
- productDescription: short description of what it is and does
- targetMarket: target customers (who should use this)
- painPoints: customer problems/pain points this product solves
- usps: unique selling points / competitive advantages
- benefits: specific benefits of using the product
- offer: ONLY the main product price and any discount/promotion (e.g. "RM59, 50% off for first 50 customers"). Do NOT include shipping fees, shipping conditions, regional shipping surcharges, delivery times, COD info, or address-related text. Keep this field FOCUSED on price + discount only.
- ingredients: PHYSICAL substances / compounds / active components actually INSIDE the product. Examples: "Vitamin B12, A, E, biotin, iron, magnesium" or "Inulin prebiotic, FloraFit probiotic strains, Lactobacillus acidophilus" or "Angelica sinensis, Motherwort herb, Dong Quai root".
  ❌ NEVER put marketing slogans, CTAs, or promotional text in ingredients. If no actual ingredients are listed, return "".`

const EXTRACT_PROMPT = (pageText: string) =>
  `Extract product information from the webpage text below and fill in this JSON. ALL VALUES MUST BE IN ENGLISH (translate from source language if needed). Return ONLY the JSON, nothing else, all on one line:
${JSON_SCHEMA}

${FIELDS_SPEC}

WEBPAGE TEXT:
${pageText.slice(0, 10000)}`

/** Used when images are also sent — tells Gemini to read both sources and synthesize. */
const EXTRACT_PROMPT_HYBRID = (pageText: string, imageCount: number) =>
  `You are analyzing a product page. You have been given BOTH the page text (below) AND ${imageCount} screenshot(s)/image(s) from the page (above).

WORKS FOR: LadiPage landings, Amazon listings, Shopee/Lazada/TikTok Shop product pages, Shopify stores, any e-commerce product page.

YOUR TASK — HYBRID SYNTHESIS:
1. SCAN BOTH SOURCES in parallel: read the text AND look at every image carefully.
2. EXTRACT key product info from each source independently — text often has descriptions/reviews/specs, images often have prices on banners, ingredient lists on packshots, benefit claims on infographics, customer testimonials.
3. MERGE & DEDUPLICATE: if both text and an image say the same thing, list it ONCE (don't repeat). If they disagree, prefer the more specific / detailed value.
4. FILL EVERY FIELD you can — do NOT leave fields blank when info exists in EITHER source. Common mistakes to avoid:
   • targetMarket is often INFERRED from product type + imagery (e.g. cough gel for kids = "Parents of young children with coughs"; anti-aging cream = "Women 35+ concerned about wrinkles").
   • usps come from images of comparison charts, badges ("100% natural", "Doctor approved"), or repeated claims.
   • offer/price is almost always shown in a banner image, NOT in text. LOOK at the images for prices like "RM59", "₫299,000", "$29.99", discount stickers ("50% OFF").
   • ingredients come from packshot photos showing the back label, or from "What's inside" infographics — read the image carefully.
5. ALL VALUES MUST BE IN ENGLISH (translate from source language if needed).
6. Return ONLY the JSON object, nothing else, all on one line:
${JSON_SCHEMA}

${FIELDS_SPEC}

WEBPAGE TEXT (combine with the ${imageCount} image(s) above):
${pageText.slice(0, 10000)}`

const IMAGE_EXTRACT_PROMPT = `Extract product information from this product page screenshot and fill in this JSON. ALL VALUES MUST BE IN ENGLISH (translate from source language if needed). Return ONLY the JSON, nothing else, all on one line:
${JSON_SCHEMA}

Fields:
- productName: main product name
- productDescription: short description of what it is and does
- targetMarket: target customers (who should use this)
- painPoints: customer problems/pain points this product solves
- usps: unique selling points / competitive advantages
- benefits: specific benefits of using the product
- offer: ONLY the main product price and any discount/promotion (e.g. "RM59, 50% off for first 50 customers"). Do NOT include shipping fees, shipping conditions, regional shipping surcharges, delivery times, COD info, or address-related text. If the page has "Additional RM5 shipping cost for Sabah and Sarawak" or similar, OMIT it entirely. Keep this field FOCUSED on price + discount only.
- ingredients: SPECIFIC ingredients / active components / key compounds in this product (e.g. "Vitamin B12, A, E, biotin, iron", "Inulin prebiotic, FloraFit probiotic strains, Lactobacillus acidophilus", "Angelica sinensis, Motherwort herb"). List the actual ingredient names — do not write generic descriptions. If the screenshot doesn't list ingredients explicitly, infer the most likely active components from product type.`

interface JinaJsonData {
  data?: { content?: string; images?: Record<string, string> }
}

/**
 * Fetch page via Jina Reader — returns page text AND image URLs found on the page.
 * Tries JSON format first (gives structured images map); falls back to plain text.
 * X-With-Images-Summary tells Jina to AI-caption every image server-side so text
 * output includes descriptions of banner/infographic content even without direct OCR.
 */
async function fetchPageContent(url: string): Promise<{ text: string; imageUrls: string[] }> {
  // Tier 1: JSON format + image summaries → structured text + image URL list
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: 'application/json',
        'X-With-Images-Summary': 'true',
      },
      signal: AbortSignal.timeout(35000),
    })
    if (r.ok) {
      const json = await r.json() as JinaJsonData
      const content = json.data?.content ?? ''
      const imageUrls = extractUrlsFromJinaImages(json.data?.images)
      if (content.trim()) {
        return { text: content.slice(0, 14000), imageUrls }
      }
    }
  } catch { /* fall through */ }

  // Tier 2: plain text + image summaries → extract image URLs from markdown
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain', 'X-With-Images-Summary': 'true' },
      signal: AbortSignal.timeout(30000),
    })
    if (r.ok) {
      const text = await r.text()
      if (text.trim()) {
        const imageUrls = extractImageUrlsFromMarkdown(text)
        return { text: text.slice(0, 12000), imageUrls }
      }
    }
  } catch { /* fall through */ }

  // Tier 3: plain text, no image processing
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return { text: '', imageUrls: [] }
    const text = await r.text()
    return { text: text.slice(0, 8000), imageUrls: extractImageUrlsFromMarkdown(text) }
  } catch {
    return { text: '', imageUrls: [] }
  }
}

/**
 * Jina returns `images` as { [label]: url } e.g. { "Image 1": "https://...jpg" }.
 * But some pages return { [url]: description }. Extract URLs from BOTH possible
 * shapes — check keys + values, keep anything that looks like a URL.
 */
function extractUrlsFromJinaImages(images: Record<string, string> | undefined): string[] {
  if (!images) return []
  const seen = new Set<string>()
  const urls: string[] = []
  for (const [k, v] of Object.entries(images)) {
    if (typeof k === 'string' && /^https?:\/\//.test(k) && !seen.has(k)) { seen.add(k); urls.push(k) }
    if (typeof v === 'string' && /^https?:\/\//.test(v) && !seen.has(v)) { seen.add(v); urls.push(v) }
  }
  return urls
}

/** Extract image URLs from Jina markdown (![alt](url) syntax + bare image extension URLs). */
function extractImageUrlsFromMarkdown(markdown: string): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  const mdImg = /!\[[^\]]*\]\((https?:\/\/[^)\s"]+)\)/g
  let m: RegExpExecArray | null
  while ((m = mdImg.exec(markdown)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); urls.push(m[1]) }
  }
  const bareImg = /https?:\/\/[^\s")\]]+\.(?:jpg|jpeg|png|webp|gif)(?:[?#][^\s")\]]*)?/gi
  while ((m = bareImg.exec(markdown)) !== null) {
    if (!seen.has(m[0])) { seen.add(m[0]); urls.push(m[0]) }
  }
  return urls
}

/**
 * Fetch an image URL and return { mimeType, data } for Gemini inlineData.
 *
 * Two-tier fetch:
 *   1. Direct fetch — fast path for CORS-friendly CDNs (Cloudinary etc.)
 *   2. images.weserv.nl CORS proxy — bypasses CORS for any 3rd-party image
 *      host (Amazon, Shopee, LadiPage CDN, raw shop CDNs). Free public
 *      service that re-encodes to JPG with proper CORS headers, and resizes
 *      to max 1024px so we stay under Gemini's inline image budget.
 *
 * Returns null only when BOTH tiers fail (truly unreachable image).
 */
async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  // Tier 1: direct fetch (no CORS issues on friendly CDNs, faster)
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (r.ok) {
      const result = await responseToBase64(r)
      if (result) return result
    }
  } catch { /* CORS block or net error — try proxy */ }

  // Tier 2: CORS proxy (works for any public image URL)
  try {
    // weserv expects URL without scheme prefix; resize to 1024px max + JPG
    const cleanUrl = url.replace(/^https?:\/\//, '')
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=1024&output=jpg`
    const r = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return null
    return await responseToBase64(r)
  } catch {
    return null
  }
}

/** Convert a fetched image Response → Gemini inlineData payload (base64-encoded). */
async function responseToBase64(r: Response): Promise<{ mimeType: string; data: string } | null> {
  const contentType = r.headers.get('content-type') ?? 'image/jpeg'
  const mime = contentType.split(';')[0].trim()
  if (!mime.startsWith('image/')) return null
  const buf = await r.arrayBuffer()
  if (buf.byteLength > 2_500_000) return null
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return { mimeType: mime, data: btoa(binary) }
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

/** Strip shipping/delivery text from offer field. Keeps only price + discount. */
export function stripShippingFromOffer(text: string): string {
  if (!text) return ''
  // Common shipping phrases across languages — remove the entire sentence containing them
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
  // Collapse whitespace + remove dangling punctuation
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim()
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

      // Step 1: fetch page text + image URL list in parallel with image downloads
      addToast('Đang đọc trang sản phẩm...')
      const { text: pageText, imageUrls } = await fetchPageContent(url)
      if (!pageText) throw new Error('Không đọc được nội dung trang. Thử tải ảnh chụp màn hình thay thế.')

      // Step 2: fetch page images in parallel (best-effort — CORS-friendly CDNs succeed)
      type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }
      let imageParts: GeminiPart[] = []
      if (imageUrls.length > 0) {
        addToast(`Đang tải ${Math.min(imageUrls.length, 6)} ảnh để phân tích...`)
        const results = await Promise.allSettled(
          imageUrls.slice(0, 6).map(fetchImageAsBase64)
        )
        imageParts = results
          .filter((r): r is PromiseFulfilledResult<{ mimeType: string; data: string }> =>
            r.status === 'fulfilled' && r.value !== null)
          .map((r) => ({ inlineData: r.value }))
      }

      // Step 3: single Gemini call — images first so Gemini has visual context,
      // then text. Use the hybrid prompt when we actually have images.
      const hasImages = imageParts.length > 0
      const parts: GeminiPart[] = [
        ...imageParts,
        { text: hasImages ? EXTRACT_PROMPT_HYBRID(pageText) : EXTRACT_PROMPT(pageText) },
      ]

      const response = await directGeminiVision({
        apiKey: geminiKey,
        parts,
        systemInstruction: EXTRACT_SYSTEM,
        maxOutputTokens: 2048,
      })

      const extracted = parseExtracted(response)
      if (!extracted) throw new Error('AI không trích xuất được thông tin. Thử tải ảnh chụp màn hình thay thế.')

      const { next, count } = applyExtracted(extracted, form)
      if (count === 0) throw new Error('Không trích xuất được thông tin. Thử tải ảnh chụp màn hình.')
      setForm(next)
      const imgNote = imageParts.length > 0 ? ` (text + ${imageParts.length} ảnh)` : ''
      addToast(`Đã tự động điền ${count} trường thông tin${imgNote}`)
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
