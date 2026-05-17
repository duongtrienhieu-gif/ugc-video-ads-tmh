// ──────────────────────────────────────────────────────────────────────────
// Z7 — Inline script-generation modal.
// One shared modal opened from every "Tạo ..." button. Lets the user pick:
//   1. Product (from PROJECT bank)
//   2. Output language (MY default / VN / GB)
//   3. Tone (giống ads gốc / emotional / hard sell / testimonial / soft sell / scientific)
// → calls generateScriptFromAd, returns the result back to the caller.
// ──────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { X, Package, Sparkles, Loader2, Globe2, Mic2 } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import BankPicker from '../../../components/BankPicker'
import type { Product } from '../../../stores/types'
import type {
  PipelineMode, ScriptGenLanguage, ScriptGenTone, GeneratedScript,
} from '../types'
import { SCRIPT_TONE_LABEL_VI, SCRIPT_LANG_LABEL, PIPELINE_MODE_LABEL_VI } from '../types'
import { generateScriptFromAd } from '../services/generateScriptFromAd'

const LANG_OPTIONS: ScriptGenLanguage[] = ['ms', 'vi', 'en']
const TONE_OPTIONS: ScriptGenTone[] = [
  'original', 'emotional', 'hard-sell', 'testimonial', 'soft-sell', 'scientific',
]

export interface InlineModalContext {
  mode: PipelineMode
  /** Text dump fed to Gemini — transcript, hook, reconstruction, variation, etc. */
  sourceContext: string
  /** Original ad filename — saved in metadata header on the generated script. */
  sourceFileName?: string
}

interface Props {
  open: boolean
  context: InlineModalContext | null
  onClose: () => void
  onGenerated: (script: GeneratedScript) => void
}

export default function InlineScriptModal({ open, context, onClose, onGenerated }: Props) {
  const products = useBankStore((s) => s.products)
  const addToast = useAppStore((s) => s.addToast)

  const [productId, setProductId] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [language, setLanguage] = useState<ScriptGenLanguage>('ms')
  const [tone, setTone] = useState<ScriptGenTone>('original')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProduct = products.find((p) => p.id === productId) ?? null
  const productImageUrl = useAssetUrl(selectedProduct?.productImage)

  if (!open || !context) return null

  const handleGenerate = async () => {
    if (!productId || !context) return
    setGenerating(true)
    setError(null)
    try {
      const script = await generateScriptFromAd({
        mode: context.mode,
        productId,
        language,
        tone,
        sourceContext: context.sourceContext,
        sourceFileName: context.sourceFileName,
      })
      addToast(`✨ Đã tạo ${PIPELINE_MODE_LABEL_VI[context.mode]} cho ${script.productName}`)
      onGenerated(script)
      // Reset for next open
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      addToast(`Lỗi sinh script: ${msg}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleClose = () => {
    if (generating) return // don't allow closing during generation
    onClose()
  }

  const modeLabel = PIPELINE_MODE_LABEL_VI[context.mode]
  const canGenerate = !!productId && !generating

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-black/8 bg-gradient-to-r from-pink-50 to-violet-50 px-5 py-3">
          <Sparkles className="h-4 w-4 text-pink-600" />
          <h3 className="flex-1 text-sm font-bold text-gray-900">
            Tạo {modeLabel}
          </h3>
          <button
            onClick={handleClose}
            disabled={generating}
            className="rounded-full p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700 disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">

          {/* 1. Product */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              1 · Chọn sản phẩm
            </p>
            {selectedProduct ? (
              <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-2.5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {productImageUrl ? (
                    <img src={productImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <Package className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{selectedProduct.productName}</p>
                  <p className="truncate text-[10px] text-gray-400">{selectedProduct.targetMarket || 'Chưa rõ niche'}</p>
                </div>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-black/[0.04]"
                >
                  Đổi
                </button>
              </div>
            ) : (
              <button
                onClick={() => setPickerOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"
              >
                <Package className="h-4 w-4" />
                Chọn sản phẩm từ PROJECT
              </button>
            )}
          </div>

          {/* 2. Language */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              2 · Ngôn ngữ output
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {LANG_OPTIONS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[11px] transition-colors ${
                    language === l
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                  }`}
                >
                  <span className="text-base leading-none">{SCRIPT_LANG_LABEL[l].flag}</span>
                  <span className="font-medium">{SCRIPT_LANG_LABEL[l].label.split(' · ')[0]}</span>
                </button>
              ))}
            </div>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
              <Globe2 className="h-3 w-3" />
              Output viết hoàn toàn bằng ngôn ngữ đã chọn. Bản dịch tiếng Việt vẫn được tạo song song.
            </p>
          </div>

          {/* 3. Tone */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              3 · Chọn tone
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors ${
                    tone === t
                      ? 'border-pink-400 bg-pink-50 text-pink-700'
                      : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
                  }`}
                >
                  <Mic2 className="h-3 w-3 shrink-0" />
                  <span className="font-medium">{SCRIPT_TONE_LABEL_VI[t]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-black/8 bg-gray-50 px-5 py-3">
          <button
            onClick={handleClose}
            disabled={generating}
            className="rounded-full px-4 py-2 text-xs font-medium text-gray-600 hover:bg-black/5 disabled:opacity-40"
          >
            Hủy
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="ml-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:from-pink-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Tạo ngay</>
            )}
          </button>
        </div>
      </div>

      <BankPicker
        bankType="products"
        isOpen={pickerOpen}
        onSelect={(item) => {
          setProductId((item as Product).id)
          setPickerOpen(false)
        }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}
