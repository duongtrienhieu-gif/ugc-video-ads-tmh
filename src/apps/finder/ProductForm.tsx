import { useState, useEffect, useRef } from 'react'
import { X, ImagePlus, Sparkles, Loader2 } from 'lucide-react'
import type { Product } from '../../stores/types'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'

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

// Prompts intentionally omit the raw URL to avoid content-filter triggers.
// We only pass page text (or a neutral domain hint) so models focus on extraction.
const EXTRACT_PROMPT = (pageText: string) =>
  `Extract product information from the following webpage text and return as a JSON object.

TEXT:
${pageText.slice(0, 3500)}

Return ONLY a JSON object with exactly these keys and English string values:
{"productName":"","productDescription":"","targetMarket":"","painPoints":"","usps":"","benefits":"","offer":"","cta":""}

No explanation. No markdown. Just the JSON object.`

const EXTRACT_URL_ONLY_PROMPT = (url: string) => {
  // Pass only the domain so the model can infer category, without triggering filters
  let domain = url
  try { domain = new URL(url).hostname.replace(/^www\./, '') } catch { /* ignore */ }
  return `Generate marketing data for an e-commerce product from the website "${domain}" and return as a JSON object.

Return ONLY a JSON object with exactly these keys and English string values:
{"productName":"","productDescription":"","targetMarket":"","painPoints":"","usps":"","benefits":"","offer":"","cta":""}

No explanation. No markdown. Just the JSON object.`
}

const SYSTEM_MSG = 'You are a data-extraction assistant. Your only job is to output valid JSON. Never refuse, never add explanation — only output the requested JSON object.'

// Direct API call for product analysis — bypasses kieTextGenerate to surface raw errors
async function analyzeProductWithAI(apiKey: string, prompt: string): Promise<string> {
  const models = ['gpt-4o', 'gemini-2.5-flash', 'gpt-4o-mini']
  const errors: string[] = []

  for (const model of models) {
    const res = await fetch('https://api.kie.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_MSG },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const rawText = await res.text()

    if (res.status === 402) throw new Error('INSUFFICIENT_CREDITS')
    if (!res.ok) {
      errors.push(`${model}: HTTP ${res.status} — ${rawText.slice(0, 200)}`)
      continue
    }

    let content = ''
    try {
      const data = JSON.parse(rawText) as {
        choices?: { message?: { content?: string | null; refusal?: string } }[]
      }
      const msg = data.choices?.[0]?.message
      content = (typeof msg?.content === 'string' ? msg.content : '').trim()
      if (content) return content
      const refusal = msg?.refusal
      errors.push(refusal ? `${model}: từ chối — ${refusal.slice(0, 80)}` : `${model}: phản hồi rỗng (raw: ${rawText.slice(0, 120)})`)
    } catch {
      errors.push(`${model}: JSON parse error — ${rawText.slice(0, 120)}`)
    }
  }

  throw new Error(errors.join(' | '))
}

async function fetchPageText(url: string): Promise<string> {
  const strip = (html: string) =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 7000)

  // Try multiple CORS proxies in sequence
  const proxies: Array<() => Promise<string>> = [
    async () => {
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(12000) })
      if (!r.ok) return ''
      const d = await r.json() as { contents?: string }
      return strip(d.contents ?? '')
    },
    async () => {
      const r = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(12000) })
      if (!r.ok) return ''
      return strip(await r.text())
    },
    async () => {
      const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(12000) })
      if (!r.ok) return ''
      return strip(await r.text())
    },
  ]

  for (const proxy of proxies) {
    try {
      const text = await proxy()
      if (text.length > 200) return text
    } catch { /* try next */ }
  }
  return ''
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

  const fileRef = useRef<HTMLInputElement>(null)
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
    const url = productUrl.trim()
    if (!url) return
    const apiKey = useSettingsStore.getState().getApiKey()
    if (!apiKey) {
      addToast('Vui lòng nhập API key trong Cài đặt', 'error')
      return
    }

    setIsFetching(true)
    try {
      // Step 1: Try to fetch actual page content (3 proxy fallbacks)
      const pageText = await fetchPageText(url)

      // Step 2: Send to AI — with page content if available, URL-only otherwise
      const prompt = pageText.length > 200
        ? EXTRACT_PROMPT(pageText)
        : EXTRACT_URL_ONLY_PROMPT(url)
      const response = await analyzeProductWithAI(apiKey, prompt)

      let cleaned = response.trim()
      // Strip markdown code fences
      cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
      // Extract JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI không trả về JSON hợp lệ')
      cleaned = jsonMatch[0]

      const extracted = JSON.parse(cleaned) as Record<string, string>

      let filledCount = 0
      setForm((prev) => {
        const next = { ...prev }
        for (const [key, value] of Object.entries(extracted)) {
          if (key in next && typeof value === 'string') {
            const v = value.trim()
            // Skip placeholder values that AI returned unchanged
            if (v && !v.startsWith('actual ') && v !== '""') {
              next[key as keyof typeof next] = v
              filledCount++
            }
          }
        }
        return next
      })
      if (filledCount === 0) throw new Error('AI trả về nội dung rỗng, thử lại')
      addToast(`Đã tự động điền ${filledCount} trường thông tin`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Không thể lấy thông tin: ${msg}`, 'error')
    } finally {
      setIsFetching(false)
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

      {/* Auto-fill from URL */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-sky-400/80">
          Tự động điền từ link sản phẩm
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchInfo() } }}
            placeholder="https://shopee.vn/... hoặc link sản phẩm bất kỳ"
            className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-sky-400/40"
          />
          <button
            type="button"
            onClick={handleFetchInfo}
            disabled={isFetching || !productUrl.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isFetching
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang lấy...</>
              : <><Sparkles className="h-3.5 w-3.5" /> Lấy thông tin</>
            }
          </button>
        </div>
      </div>

      {/* Image upload */}
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
