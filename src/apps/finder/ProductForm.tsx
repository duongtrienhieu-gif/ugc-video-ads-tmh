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

const EXTRACT_SYSTEM = 'You are a product info extraction assistant. Return ONLY a raw minified JSON object on a single line — no markdown, no code fences, no explanation, no newlines inside values. Always respond in VIETNAMESE.'

const FIELDS_SPEC = `Fields (ALL values must be written in NATURAL VIETNAMESE — translate from any source language; keep brand/product proper nouns as-is, keep original currency tokens like RM, ₫, $, ฿):
- productName: tên chính của sản phẩm (giữ nguyên tên thương hiệu nếu là proper noun, vd "LANZF", "Manuka")
- productDescription: mô tả ngắn về sản phẩm và công dụng
- targetMarket: khách hàng mục tiêu (ai nên dùng sản phẩm này)
- painPoints: vấn đề / nỗi đau khách hàng mà sản phẩm giải quyết
- usps: điểm bán hàng độc đáo / lợi thế cạnh tranh
- benefits: lợi ích cụ thể khi sử dụng sản phẩm. QUAN TRỌNG với sản phẩm dual-category (TPCN, snack sức khoẻ, supplement làm đẹp, đồ uống bổ sung, mỹ phẩm functional) — TRÍCH XUẤT CẢ 2 LỚP:
    (a) Lợi ích bề mặt: "ngon miệng", "tiện lợi", "dễ ăn", "không lem"
    (b) Lợi ích FUNCTIONAL/SỨC KHOẺ kèm liên kết thành phần: vd "Mè đen hỗ trợ tim mạch", "Óc chó + cranberry giảm cholesterol", "Bổ sung collagen cho đàn hồi da", "Vitamin B chuyển hoá năng lượng"
  Nếu trang đề cập health claim, chứng nhận (HALAL/KKM/FDA), tác dụng functional thành phần, bằng chứng khoa học → TRÍCH XUẤT HẾT. Đây thường là điểm bán quan trọng ẩn dưới mô tả bề mặt. KHÔNG chỉ paraphrase mô tả bề mặt — đào sâu functional value-prop.
- offer: giá sản phẩm — giá gốc + TẤT CẢ tier combo/bundle hiện trên trang. Trích MỌI tier (4-5 tier cũng OK). Format CONCISE, comma-separated, KHÔNG dùng "for"/"FREE" thừa.
  ⚠️ TRÍCH 100% TIERS — nếu có 4 tier ("BELI 1 PERCUMA 1", "BELI 2 PERCUMA 2", "BELI 3 PERCUMA 3", "BELI 5 PERCUMA 5"), output ĐỦ 4. KHÔNG dừng ở 2.
  ⚠️ GIỮ originalPrice (giá gạch) khi trang hiện "was RMxxx" — quan trọng để tính savings.
  Format ví dụ:
    • single: "RM59" hoặc "RM55 (was RM109)"
    • multi-tier: "RM55 (was RM109), BUY 2 RM95, BUY 3 RM145"
    • bundle (chỉ "GET", không "FREE for"): "BUY 1 GET 1 RM59 (was RM129), BUY 2 GET 2 RM99, BUY 3 GET 3 RM129, BUY 5 GET 5 RM149"
    • có giảm giá: "RM59, giảm 50% cho 50 khách đầu"
  KHÔNG bao gồm: phí ship, COD, thời gian giao, phụ phí vùng (vd "Sabah +RM5"), địa chỉ, từ "FREESHIP".
- ingredients: thành phần vật lý / hoạt chất CÓ THẬT trong sản phẩm. Ví dụ: "Vitamin B12, A, E, biotin, sắt, magie" hoặc "Inulin prebiotic, chủng probiotic FloraFit, Lactobacillus acidophilus" hoặc "Đương quy, Ích mẫu thảo, rễ Dong Quai". GIỮ NGUYÊN tên khoa học chuẩn quốc tế (Latin/English).
  ❌ TUYỆT ĐỐI KHÔNG đưa slogan marketing, CTA, lời kêu gọi hành động vào ingredients ("DAFTAR", "REGISTER", "BUY NOW", "ORDER TODAY", "MUA NGAY", "ĐẶT HÀNG", "ĐĂNG KÝ"... đều KHÔNG phải ingredients). Ingredients = THÀNH PHẦN VẬT LÝ trong chai/hộp. CTA = hành động marketing cho khách. Khác nhau hoàn toàn. Nếu trang không liệt kê thành phần thật và không suy luận được từ loại sản phẩm, trả "" (chuỗi rỗng).

E-COMMERCE PLATFORM HANDLING:
Hỗ trợ: SEA (Shopee, Lazada, TikTok Shop, Tiki, Sendo), Chinese (1688, Alibaba, AliExpress, Taobao, Tmall, Pinduoduo, JD.com), Western (Amazon, eBay, Walmart, Target, Best Buy, Etsy).
Trang có thể chứa NHIỀU sản phẩm trộn. Section nhiễu cần BỎ QUA (mọi ngôn ngữ):
  - "Sản phẩm khác của shop" / "Other products from this shop" / "More from this seller"
  - "Có thể bạn cũng thích" / "You may also like" / "Customers also bought" / "Frequently bought together"
  - "Sản phẩm liên quan" / "Related products" / "Similar items" / "Recommended for you"
  - "Đã xem gần đây" / "Recently viewed" / "Browsing history"
  - "Sponsored" / "Quảng cáo" / "广告" / "推荐商品" / "你可能还喜欢" / "店铺其他商品" / "猜你喜欢"
⚠️ CHỈ TRÍCH XUẤT SẢN PHẨM CHÍNH. Bỏ HOÀN TOÀN mọi section related/recommended/other-shop/sponsored.
Xác định sản phẩm chính: xuất hiện ĐẦU TIÊN + có giá + mô tả chi tiết + gallery ảnh chính + nút add-to-cart. Nhiều SP cùng prominence → lấy cái đầu (top of page).
Với 1688/Alibaba B2B: tập trung main listing's price range / MOQ / specifications. Bỏ qua "Recommended suppliers" / "Same category products".`

const EXTRACT_PROMPT = (pageText: string) =>
  `Trích xuất thông tin sản phẩm từ nội dung trang web bên dưới và điền vào JSON. TẤT CẢ giá trị PHẢI viết bằng TIẾNG VIỆT TỰ NHIÊN (dịch từ ngôn ngữ gốc nếu cần). Chỉ trả về JSON, không gì khác, tất cả trên 1 dòng:
${JSON_SCHEMA}

${FIELDS_SPEC}

NỘI DUNG TRANG WEB:
${pageText.slice(0, 16000)}`

/** Used when images are also sent — tells Gemini to read both sources and synthesize. */
const EXTRACT_PROMPT_HYBRID = (pageText: string, imageCount: number) =>
  `Bạn đang phân tích một trang sản phẩm. Bạn nhận được CẢ nội dung text trang web (bên dưới) VÀ ${imageCount} ảnh/screenshot từ trang (bên trên).

HOẠT ĐỘNG VỚI: LadiPage landings, Amazon listings, Shopee/Lazada/TikTok Shop, Shopify stores, mọi trang sản phẩm e-commerce.

NHIỆM VỤ — HYBRID SYNTHESIS:
1. SCAN CẢ HAI NGUỒN song song: đọc text VÀ nhìn kỹ TỪNG ảnh.
2. TRÍCH XUẤT thông tin sản phẩm từ mỗi nguồn độc lập — text thường có mô tả/review/spec; ảnh thường có giá trên banner, danh sách thành phần trên bao bì, claim lợi ích trên infographic, testimonial khách hàng.
3. MERGE & LOẠI BỎ TRÙNG: nếu cả text và ảnh nói cùng 1 thông tin, ghi 1 LẦN duy nhất. Nếu mâu thuẫn, ưu tiên giá trị cụ thể/chi tiết hơn.
4. ĐIỀN MỌI FIELD có thể — KHÔNG để field trống nếu thông tin có ở 1 trong 2 nguồn. Lưu ý sai lầm phổ biến:
   • targetMarket thường SUY LUẬN từ loại sản phẩm + hình ảnh (vd gel ho cho trẻ em = "Phụ huynh có con nhỏ bị ho"; kem chống lão hoá = "Phụ nữ 35+ quan tâm nếp nhăn").
   • usps đến từ ảnh bảng so sánh, badge ("100% tự nhiên", "Được bác sĩ khuyên dùng"), hoặc claim lặp lại.
   • offer/giá hầu như luôn ở banner ảnh, KHÔNG ở text. NHÌN ảnh để tìm giá kiểu "RM59", "₫299.000", "$29.99", sticker giảm giá ("50% OFF").
   • ingredients đến từ ảnh bao bì hiển thị nhãn sau, hoặc infographic "Thành phần" — đọc ảnh kỹ.
5. TẤT CẢ GIÁ TRỊ PHẢI VIẾT BẰNG TIẾNG VIỆT TỰ NHIÊN (dịch từ ngôn ngữ gốc nếu cần). Giữ nguyên tên thương hiệu, đơn vị tiền tệ, tên khoa học chuẩn quốc tế.
6. Chỉ trả về JSON, không gì khác, tất cả trên 1 dòng:
${JSON_SCHEMA}

${FIELDS_SPEC}

NỘI DUNG TRANG WEB (kết hợp với ${imageCount} ảnh ở trên):
${pageText.slice(0, 16000)}`

const IMAGE_EXTRACT_PROMPT = `Trích xuất thông tin sản phẩm từ screenshot trang sản phẩm này và điền vào JSON. TẤT CẢ giá trị PHẢI viết bằng TIẾNG VIỆT TỰ NHIÊN (dịch từ ngôn ngữ gốc nếu cần). Chỉ trả về JSON, không gì khác, tất cả trên 1 dòng:
${JSON_SCHEMA}

${FIELDS_SPEC}

Nếu screenshot không liệt kê thành phần rõ ràng, suy luận hoạt chất khả thi nhất từ loại sản phẩm.`

// ── Shopee marketplace fetch ────────────────────────────────────────────
// Jina/Cloudflare can't read Shopee SPA pages (anti-bot wall). Instead we
// parse the shop_id + item_id out of the URL, then hit Shopee's internal
// public API (`api/v4/item/get`) via a CORS proxy. Returns structured JSON
// with name/description/price/attributes — much cleaner than scraping.
//
// Reliability ~30-60%: Shopee rotates auth headers + blocks proxy IPs.
// On failure we throw a Shopee-specific error pointing the user to the
// screenshot upload fallback.

interface ShopeeItem {
  name?: string
  description?: string
  price?: number              // micro units (×100,000)
  price_min?: number
  price_max?: number
  price_before_discount?: number
  raw_discount?: number       // 0-100 percent
  historical_sold?: number
  item_rating?: { rating_star?: number; rating_count?: number[] }
  categories?: Array<{ display_name?: string }>
  attributes?: Array<{ name?: string; value?: string }>
  brand?: string
}

interface ShopeeApiResponse {
  data?: { item?: ShopeeItem }
  error?: number
}

/** Parse `shopee.vn/<slug>-i.<shop_id>.<item_id>(?...)` → { shopId, itemId }. */
function parseShopeeUrl(url: string): { shopId: string; itemId: string } | null {
  try {
    const u = new URL(url)
    const hostnameOk = /(^|\.)shopee\./i.test(u.hostname)
    const m = u.pathname.match(/-i\.(\d+)\.(\d+)/)
    console.log('[SHOPEE-PARSE]', { hostname: u.hostname, pathname: u.pathname.slice(0, 100), hostnameOk, match: m })
    if (!hostnameOk) return null
    if (!m) return null
    return { shopId: m[1], itemId: m[2] }
  } catch (err) {
    console.warn('[SHOPEE-PARSE] threw', err)
    return null
  }
}

/** Format Shopee API price (micro units) → display string like "430.000đ". */
function formatShopeePrice(micro?: number): string {
  if (typeof micro !== 'number' || micro <= 0) return ''
  const vnd = Math.round(micro / 100000)
  return `${vnd.toLocaleString('vi-VN')}đ`
}

/**
 * Fetch Shopee item via CORS proxy chain. Tries 2 proxies in order; returns
 * the first successful response or null. Shopee API is brittle — sometimes
 * a proxy IP gets blacklisted, so we fall back to a second.
 */
async function fetchShopeeItem(shopId: string, itemId: string): Promise<ShopeeItem | null> {
  const apiUrl = `https://shopee.vn/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`
  const proxies = [
    { name: 'corsproxy.io', wrap: (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}` },
    { name: 'allorigins',   wrap: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  ]
  for (const p of proxies) {
    try {
      const proxiedUrl = p.wrap(apiUrl)
      console.log(`[SHOPEE-FETCH] trying ${p.name}:`, proxiedUrl.slice(0, 120))
      const r = await fetch(proxiedUrl, { signal: AbortSignal.timeout(15000) })
      console.log(`[SHOPEE-FETCH] ${p.name} status:`, r.status, r.statusText)
      if (!r.ok) continue
      const json = await r.json() as ShopeeApiResponse
      console.log(`[SHOPEE-FETCH] ${p.name} json keys:`, Object.keys(json), '· error:', json.error, '· hasItem:', !!json.data?.item)
      if (json.error === 0 && json.data?.item) return json.data.item
    } catch (err) {
      console.warn(`[SHOPEE-FETCH] ${p.name} threw`, err)
    }
  }
  return null
}

/**
 * Convert Shopee item JSON → compact text block we feed to Gemini for
 * the same VN extraction prompt used elsewhere. Lets Gemini infer
 * targetMarket / painPoints / usps / benefits from name + description,
 * while we pre-format the price field.
 */
function shopeeItemToText(item: ShopeeItem): string {
  const lines: string[] = []
  if (item.name) lines.push(`Tên sản phẩm: ${item.name}`)
  if (item.brand) lines.push(`Thương hiệu: ${item.brand}`)
  if (item.description) lines.push(`Mô tả:\n${item.description}`)

  // Price + discount → one neat line
  const cur = formatShopeePrice(item.price ?? item.price_min)
  const before = formatShopeePrice(item.price_before_discount)
  const disc = item.raw_discount
  if (cur) {
    let priceLine = `Giá: ${cur}`
    if (before && disc) priceLine += ` (giảm ${disc}% từ ${before})`
    else if (before) priceLine += ` (giá gốc ${before})`
    lines.push(priceLine)
  }

  if (item.historical_sold) lines.push(`Đã bán: ${item.historical_sold.toLocaleString('vi-VN')}`)
  if (item.item_rating?.rating_star) lines.push(`Đánh giá: ${item.item_rating.rating_star.toFixed(1)}/5`)

  if (item.categories && item.categories.length > 0) {
    const cats = item.categories.map((c) => c.display_name).filter(Boolean).join(' › ')
    if (cats) lines.push(`Danh mục: ${cats}`)
  }

  if (item.attributes && item.attributes.length > 0) {
    lines.push('Thuộc tính:')
    for (const a of item.attributes) {
      if (a.name && a.value) lines.push(`  • ${a.name}: ${a.value}`)
    }
  }

  return lines.join('\n')
}

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

      // Shopee URLs bypass Jina (Cloudflare wall) — go straight to the
      // Shopee internal API via CORS proxy. Returns structured JSON we
      // then pass to Gemini for VN normalization + field inference.
      const shopeeIds = parseShopeeUrl(url)
      if (shopeeIds) {
        addToast('Đang đọc Shopee qua API...')
        const item = await fetchShopeeItem(shopeeIds.shopId, shopeeIds.itemId)
        if (!item) {
          throw new Error('Shopee API không phản hồi (anti-bot chặn ngẫu nhiên). Vui lòng dùng "Tải ảnh chụp màn hình" bên dưới.')
        }
        const pageText = shopeeItemToText(item)
        const response = await directGeminiVision({
          apiKey: geminiKey,
          parts: [{ text: EXTRACT_PROMPT(pageText) }],
          systemInstruction: EXTRACT_SYSTEM,
          maxOutputTokens: 2048,
        })
        const extracted = parseExtracted(response)
        if (!extracted) throw new Error('AI không trích xuất được thông tin từ dữ liệu Shopee.')
        const { next, count } = applyExtracted(extracted, form)
        if (count === 0) throw new Error('Không trích xuất được thông tin.')
        setForm(next)
        addToast(`Đã tự động điền ${count} trường từ Shopee`)
        return
      }

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
        { text: hasImages ? EXTRACT_PROMPT_HYBRID(pageText, imageParts.length) : EXTRACT_PROMPT(pageText) },
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
