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

const FIELDS: { key: keyof Product; label: string; type: 'text' | 'textarea'; required?: boolean }[] = [
  { key: 'productName', label: 'Tên sản phẩm', type: 'text', required: true },
  { key: 'productDescription', label: 'Mô tả sản phẩm', type: 'textarea', required: true },
  { key: 'targetMarket', label: 'Khách hàng mục tiêu', type: 'text', required: true },
  { key: 'painPoints', label: 'Các pain point', type: 'textarea' },
  { key: 'usps', label: 'USP - lợi thế độc nhất / khác biệt của sản phẩm', type: 'textarea' },
  { key: 'benefits', label: 'Lợi ích', type: 'textarea' },
  { key: 'offer', label: 'Giá bán và Khuyến mãi', type: 'text' },
  { key: 'cta', label: 'CTA', type: 'text' },
]

const JSON_SCHEMA = `{"productName":"","productDescription":"","targetMarket":"","painPoints":"","usps":"","benefits":"","offer":"","cta":""}`

const EXTRACT_SYSTEM = `Bạn là trợ lý trích xuất thông tin sản phẩm. Trang web có thể viết bằng Tiếng Malay, Tiếng Anh, hoặc Tiếng Việt — bất kể ngôn ngữ nào, bạn PHẢI dịch và trả kết quả HOÀN TOÀN bằng TIẾNG VIỆT. Phản hồi chỉ là JSON object thuần — không markdown, không code fence, không giải thích.`

const EXTRACT_PROMPT = (pageText: string) =>
  `Đọc nội dung trang sản phẩm bên dưới (có thể là Tiếng Malay, Tiếng Anh hoặc Tiếng Việt). Trích xuất thông tin và điền vào JSON này. TẤT CẢ các giá trị phải viết bằng TIẾNG VIỆT — dịch nếu cần. Chỉ trả JSON, không thêm gì khác:
${JSON_SCHEMA}

Hướng dẫn từng trường (viết bằng tiếng Việt):
- productName: tên sản phẩm chính
- productDescription: mô tả ngắn gọn sản phẩm là gì, dùng để làm gì
- targetMarket: khách hàng mục tiêu (ai nên dùng sản phẩm này)
- painPoints: các vấn đề/nỗi đau của khách hàng mà sản phẩm giải quyết
- usps: điểm khác biệt/lợi thế độc nhất của sản phẩm so với đối thủ
- benefits: lợi ích cụ thể khi dùng sản phẩm
- offer: giá bán và khuyến mãi đang có
- cta: lời kêu gọi hành động (ví dụ: Mua ngay, Đặt hàng, Nhận ưu đãi)

NỘI DUNG TRANG WEB:
${pageText.slice(0, 8000)}`

const IMAGE_EXTRACT_PROMPT = `Đọc ảnh chụp màn hình trang sản phẩm này (có thể là Tiếng Malay, Tiếng Anh hoặc Tiếng Việt). Trích xuất thông tin và điền vào JSON. TẤT CẢ các giá trị phải viết bằng TIẾNG VIỆT — dịch nếu cần. Chỉ trả JSON, không thêm gì khác:
${JSON_SCHEMA}

Hướng dẫn từng trường (viết bằng tiếng Việt):
- productName: tên sản phẩm chính
- productDescription: mô tả ngắn gọn sản phẩm là gì, dùng để làm gì
- targetMarket: khách hàng mục tiêu (ai nên dùng sản phẩm này)
- painPoints: các vấn đề/nỗi đau của khách hàng mà sản phẩm giải quyết
- usps: điểm khác biệt/lợi thế độc nhất của sản phẩm so với đối thủ
- benefits: lợi ích cụ thể khi dùng sản phẩm
- offer: giá bán và khuyến mãi đang có
- cta: lời kêu gọi hành động (ví dụ: Mua ngay, Đặt hàng, Nhận ưu đãi)`

// Jina Reader — renders JS pages and returns clean markdown. Handles LadiPage, Shopee, etc.
async function fetchViaJina(url: string): Promise<string> {
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return ''
    const text = await r.text()
    return text.slice(0, 8000)
  } catch {
    return ''
  }
}

function parseExtracted(raw: string): Record<string, string> | null {
  // Strip code fences
  const cleaned = raw.trim().replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

  // Strategy 1: direct parse
  try { return JSON.parse(cleaned) as Record<string, string> } catch { /* continue */ }

  // Strategy 2: depth-tracking bracket extractor (handles JSON buried in prose)
  let depth = 0, start = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (cleaned[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(cleaned.slice(start, i + 1)) as Record<string, string> } catch { start = -1 }
      }
    }
  }

  console.error('[parseExtracted] failed, raw:', raw.slice(0, 300))
  return null
}

type FormState = { productImage: string; productName: string; productDescription: string; targetMarket: string; painPoints: string; usps: string; benefits: string; offer: string; cta: string }

function applyExtracted(extracted: Record<string, string>, prev: FormState): { next: FormState; count: number } {
  const next = { ...prev }
  let count = 0
  for (const [key, value] of Object.entries(extracted)) {
    if (key in next && typeof value === 'string') {
      const v = value.trim()
      if (v) { (next as Record<string, string>)[key] = v; count++ }
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
    offer: item?.offer ?? '',
    cta: item?.cta ?? '',
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
        offer: item.offer,
        cta: item.cta,
      })
    }
  }, [item])

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
        maxOutputTokens: 1024,
      })

      const extracted = parseExtracted(response)
      if (!extracted) throw new Error(`AI trả về sai định dạng: "${response.slice(0, 120)}"`)

      let filledCount = 0
      setForm((prev) => {
        const { next, count } = applyExtracted(extracted, prev)
        filledCount = count
        return next
      })

      if (filledCount === 0) throw new Error('Không trích xuất được thông tin. Thử tải ảnh chụp màn hình.')
      addToast(`Đã tự động điền ${filledCount} trường thông tin`)
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
        maxOutputTokens: 1024,
      })

      const extracted = parseExtracted(response)
      if (!extracted) throw new Error('AI không trả về JSON hợp lệ')

      let filledCount = 0
      setForm((prev) => {
        const { next, count } = applyExtracted(extracted, prev)
        filledCount = count
        return next
      })

      if (filledCount === 0) throw new Error('Không trích xuất được thông tin, thử ảnh khác')
      addToast(`Đã tự động điền ${filledCount} trường từ ảnh`)
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

      {FIELDS.map(({ key, label, type, required }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
            {label}{required && ' *'}
          </span>
          {type === 'textarea' ? (
            <textarea
              value={form[key as keyof typeof form] as string}
              onChange={(e) => set(key, e.target.value)}
              rows={2}
              className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15 resize-none"
            />
          ) : (
            <input
              value={form[key as keyof typeof form] as string}
              onChange={(e) => set(key, e.target.value)}
              className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15"
            />
          )}
        </label>
      ))}

      <button
        type="submit"
        className="mt-1 rounded-full bg-black/8 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-black/10"
      >
        {item ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
      </button>
    </form>
  )
}
