import { useState } from 'react'
import { Loader2, Sparkles, ArrowLeft } from 'lucide-react'
import {
  BRAND_CATEGORY_LABELS,
  MARKET_LABELS,
  type BrandCategory,
  type Market,
} from '../../../types/brandKit'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useDraftStore } from '../draftStore'
import {
  inferBrandIdentity,
  generateLogoConcepts,
} from '../service'

interface Props {
  onCancel: () => void
  onReady: () => void
}

const CATEGORIES: BrandCategory[] = [
  'beauty',
  'supplement',
  'tech',
  'fashion',
  'food',
  'home',
  'mom-baby',
  'other',
]

const MARKETS: Market[] = ['ms', 'vi']

export default function CreateForm({ onCancel, onReady }: Props) {
  const [brandName, setBrandName] = useState('')
  const [category, setCategory] = useState<BrandCategory>('beauty')
  const [market, setMarket] = useState<Market>('ms')
  const [isExistingBrand, setIsExistingBrand] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<'idle' | 'inferring' | 'rendering-logos'>('idle')
  const [error, setError] = useState<string | null>(null)

  const getGeminiApiKey = useSettingsStore((s) => s.getGeminiApiKey)
  const setSeed = useDraftStore((s) => s.setSeed)
  const setInferred = useDraftStore((s) => s.setInferred)
  const setLogoConcepts = useDraftStore((s) => s.setLogoConcepts)
  const resetDraft = useDraftStore((s) => s.reset)
  const addToast = useAppStore((s) => s.addToast)

  const handleGenerate = async () => {
    const trimmed = brandName.trim()
    if (!trimmed) {
      setError('Vui lòng nhập tên brand.')
      return
    }
    setError(null)
    setLoading(true)
    resetDraft()
    setSeed({ brandName: trimmed, category, isExistingBrand, market })

    try {
      const apiKey = getGeminiApiKey()

      setStage('inferring')
      const inferred = await inferBrandIdentity({
        apiKey,
        brandName: trimmed,
        category,
        market,
        isExistingBrand,
      })
      setInferred(inferred)

      if (!isExistingBrand) {
        setStage('rendering-logos')
        try {
          const concepts = await generateLogoConcepts({
            apiKey,
            brandName: trimmed,
            category,
            palette: inferred.palette,
            conceptPrompts: inferred.logoConceptPrompts,
            count: 3,
          })
          setLogoConcepts(concepts)
        } catch (e) {
          // Logo gen có thể fail (kie credit / vision overload).
          // Cho user vào editor để upload thủ công.
          console.warn('[StudioBrandKit] logo concept generation failed', e)
          addToast('Không gen được logo concept — bạn có thể upload thủ công.', 'info')
        }
      }

      onReady()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      addToast(`Tạo Brand Kit thất bại: ${msg}`, 'error')
    } finally {
      setLoading(false)
      setStage('idle')
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      <div className="flex shrink-0 items-center gap-3 border-b border-black/8 bg-white px-6 py-4">
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-black/5 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Tạo Brand Kit mới</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            AI suy luận trọn bộ nhận diện — bạn chỉ cần nhập 2 trường.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-xl space-y-5">
          {/* Brand Name */}
          <Field
            label="Tên brand"
            hint="VD: Auresta, Cleansy, NovaSkin… AI sẽ infer cá tính từ tên + ngách."
          >
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              disabled={loading}
              placeholder="Nhập tên brand"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-gray-900 disabled:bg-gray-50"
              maxLength={60}
              autoFocus
            />
          </Field>

          {/* Category */}
          <Field
            label="Ngách sản phẩm"
            hint="AI dùng ngách để chọn palette / typography / badges phù hợp."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  disabled={loading}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                    category === c
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-black/10 bg-white text-gray-700 hover:border-black/30'
                  }`}
                >
                  {BRAND_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </Field>

          {/* Market */}
          <Field
            label="Thị trường mục tiêu"
            hint="Mặc định Malaysia (Bahasa Malaysia). AI sẽ khoá 1 ngôn ngữ output để không trộn."
          >
            <div className="flex gap-2">
              {MARKETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarket(m)}
                  disabled={loading}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                    market === m
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-black/10 bg-white text-gray-700 hover:border-black/30'
                  }`}
                >
                  {MARKET_LABELS[m]}
                </button>
              ))}
            </div>
          </Field>

          {/* Existing brand toggle */}
          <Field
            label="Brand đã có thị trường?"
            hint="Bật nếu brand đã có logo gốc — bạn sẽ upload. Tắt để AI tự gen logo concepts."
          >
            <button
              type="button"
              role="switch"
              aria-checked={isExistingBrand}
              onClick={() => setIsExistingBrand((v) => !v)}
              disabled={loading}
              className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                isExistingBrand ? 'bg-gray-900' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isExistingBrand ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </Field>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || !brandName.trim()}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {stage === 'inferring' && 'Đang suy luận brand identity…'}
                  {stage === 'rendering-logos' && 'Đang vẽ logo concepts…'}
                  {stage === 'idle' && 'Đang xử lý…'}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Tạo bằng AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-800">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{hint}</p>}
    </div>
  )
}
