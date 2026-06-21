// ─────────────────────────────────────────────────────────────────────
// Form BG Studio — Xưởng Nền Form Đặt Hàng (standalone).
// Input: SP (bank) + ảnh quà (optional, cho abundance) + preset + ngôn ngữ.
// AI: đọc 4 ảnh SP → chọn hero + palette + copy → render 2 biến thể nền 2:3
// có VÙNG FORM TRỐNG ở giữa. Không đụng app khác.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { LayoutTemplate, Upload, RefreshCw, Sparkles, Download, X, AlertCircle, Check } from 'lucide-react'
import { useFormBgStore } from './store'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { saveAsset } from '../../utils/assetStore'
import type { Market } from '../../types/brandKit'
import { langDisplayName } from './labels'
import {
  FORM_BG_PRESETS,
  FORM_BG_VARIANTS,
  FORM_BG_TOTAL_CREDITS,
  directionSig,
  type FormBgPreset,
  type ProductDirection,
} from './types'
import { analyzeProduct } from './services/analyzeProduct'
import { generateFormBg, friendlyFormBgError } from './services/generateFormBg'

function AssetImg({ refId, alt }: { refId: string | undefined | null; alt: string }) {
  const url = useAssetUrl(refId)
  if (!url) return <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">…</div>
  return <img src={url} alt={alt} className="h-full w-full object-cover" />
}

export default function FormBgStudio() {
  const {
    draft, images, direction, isAnalyzing,
    setProductId, setGiftImageRef, setPreset, setLang,
    setDirection, setAnalyzing, patchImage,
  } = useFormBgStore()

  const products = useBankStore((s) => s.products)
  const getProductById = useBankStore((s) => s.getProductById)
  const { kieApiKey, geminiApiKey } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)

  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  const selectedProduct = draft.productId ? getProductById(draft.productId) : undefined
  const productImages = (selectedProduct?.productImages ?? []).filter((r) => !!r && r.trim() !== '')
  const presetMeta = FORM_BG_PRESETS.find((p) => p.id === draft.preset)!
  const needsGift = presetMeta.needsGift

  const directionFresh = !!direction && direction.sig === directionSig(draft)

  const missing: string[] = []
  if (!geminiApiKey) missing.push('Gemini API key (Cài đặt)')
  if (!kieApiKey) missing.push('KIE API key (Cài đặt)')
  if (!draft.productId) missing.push('Chọn sản phẩm')
  else if (productImages.length === 0) missing.push('Sản phẩm cần có ảnh tham chiếu')
  if (needsGift && !draft.giftImageRef) missing.push('Preset “Mâm quà” cần tải ảnh quà')
  const ready = missing.length === 0

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const ref = await saveAsset(file, file.type)
      setGiftImageRef(ref)
    } catch (err) {
      addToast(`Tải ảnh quà thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function ensureDirection(): Promise<ProductDirection> {
    if (directionFresh && direction) return direction
    setAnalyzing(true)
    try {
      const d = await analyzeProduct({
        apiKey: geminiApiKey,
        productImageRefs: productImages,
        productName: selectedProduct!.productName,
        preset: draft.preset,
        lang: draft.lang,
        hasGift: needsGift && !!draft.giftImageRef,
        productId: draft.productId,
        giftImageRef: draft.giftImageRef,
      })
      setDirection(d)
      return d
    } finally {
      setAnalyzing(false)
    }
  }

  async function generateOne(index: number, d: ProductDirection) {
    patchImage(index, { status: 'generating', error: undefined })
    try {
      const res = await generateFormBg({
        apiKey: kieApiKey,
        variantIndex: index,
        product: selectedProduct!,
        direction: d,
        preset: draft.preset,
        lang: draft.lang,
        giftImageRef: draft.giftImageRef,
      })
      patchImage(index, { status: 'completed', assetRef: res.assetRef, prompt: res.prompt })
    } catch (err) {
      patchImage(index, { status: 'failed', error: friendlyFormBgError(err) })
      addToast(`Biến thể ${index + 1}: ${friendlyFormBgError(err)}`, 'error')
    }
  }

  async function handleGenerateAll() {
    if (!ready || busy) return
    setBusy(true)
    try {
      const d = await ensureDirection()
      for (let i = 0; i < FORM_BG_VARIANTS; i++) await generateOne(i, d)
    } catch (err) {
      addToast(`Phân tích sản phẩm thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate(index: number) {
    if (!ready || busy) return
    setBusy(true)
    try {
      const d = await ensureDirection()
      await generateOne(index, d)
    } catch (err) {
      addToast(`Phân tích sản phẩm thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  function handleDownload(index: number, url: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = `nen-form-${draft.preset}-${index + 1}.jpg`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="flex h-full flex-col bg-[#F6F6F8]">
      <div className="flex items-center gap-2 border-b border-black/10 bg-white px-5 py-3">
        <LayoutTemplate className="h-5 w-5 text-indigo-500" />
        <h1 className="text-base font-bold text-gray-900">Xưởng Nền Form Đặt Hàng</h1>
        <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
          {FORM_BG_VARIANTS} biến thể · ~{FORM_BG_TOTAL_CREDITS} credit
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 lg:flex-row">
        {/* Input panel */}
        <div className="w-full shrink-0 space-y-4 lg:w-[360px]">
          {/* Ngôn ngữ */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-2 block text-xs font-semibold text-gray-700">Ngôn ngữ chiến dịch</label>
            <div className="flex gap-2">
              {(['ms', 'vi'] as Market[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setLang(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    draft.lang === m ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-black/10 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {langDisplayName(m)}{m === 'ms' ? ' (chính)' : ' (phụ)'}
                </button>
              ))}
            </div>
          </div>

          {/* Sản phẩm */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-2 block text-xs font-semibold text-gray-700">Sản phẩm (AI đọc 4 ảnh, tự chọn ảnh hero)</label>
            {products.length === 0 ? (
              <p className="text-xs text-gray-500">Chưa có sản phẩm trong bank. Thêm ở mục “Sản phẩm”.</p>
            ) : (
              <select
                value={draft.productId ?? ''}
                onChange={(e) => setProductId(e.target.value || null)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800"
              >
                <option value="">— Chọn sản phẩm —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
              </select>
            )}
            {selectedProduct && (
              <div className="mt-3 flex gap-1.5">
                {productImages.slice(0, 4).map((ref) => (
                  <div key={ref} className="h-12 w-12 overflow-hidden rounded-md border border-black/10 bg-gray-50">
                    <AssetImg refId={ref} alt="ảnh sản phẩm" />
                  </div>
                ))}
                {productImages.length === 0 && <p className="text-[11px] text-amber-600">Sản phẩm chưa có ảnh.</p>}
              </div>
            )}
          </div>

          {/* Preset */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-2 block text-xs font-semibold text-gray-700">Phong cách (preset)</label>
            <div className="space-y-2">
              {FORM_BG_PRESETS.map((p) => {
                const active = draft.preset === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id as FormBgPreset)}
                    className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                      active ? 'border-indigo-400 bg-indigo-50' : 'border-black/10 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                      {active && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${active ? 'text-indigo-700' : 'text-gray-800'}`}>{p.label}</div>
                      <div className="text-[11px] text-gray-500">{p.hint}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ảnh quà (optional / required cho abundance) */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Ảnh quà {needsGift ? <span className="text-rose-500">(bắt buộc cho preset này)</span> : <span className="text-gray-400">(không bắt buộc)</span>}
            </label>
            {draft.giftImageRef ? (
              <div className="relative h-28 w-full overflow-hidden rounded-lg border border-black/10 bg-gray-50">
                <AssetImg refId={draft.giftImageRef} alt="ảnh quà" />
                <button onClick={() => setGiftImageRef(null)} title="Xoá ảnh quà" className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-black/20 bg-gray-50 text-gray-500 hover:bg-gray-100">
                {uploading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <><Upload className="h-5 w-5" /><span className="text-xs">Tải ảnh quà lên</span></>}
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>

          {!ready && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertCircle className="h-3.5 w-3.5" /> Cần bổ sung:</div>
              <ul className="space-y-0.5 text-[11px] text-amber-700">{missing.map((m) => <li key={m}>• {m}</li>)}</ul>
            </div>
          )}

          <button
            onClick={handleGenerateAll}
            disabled={!ready || busy}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
              ready && !busy ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
          >
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isAnalyzing ? 'Đang phân tích sản phẩm…' : busy ? 'Đang tạo nền…' : `Tạo ${FORM_BG_VARIANTS} biến thể nền`}
          </button>
          <p className="text-[10px] text-gray-400">Vùng giữa ảnh để trống cho anh đè form. Ảnh dọc 2:3 — đặt làm background section trong LadiPage.</p>
        </div>

        {/* Output */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((im) => (
            <FormBgCell
              key={im.index}
              index={im.index}
              status={im.status}
              assetRef={im.assetRef}
              error={im.error}
              busy={busy}
              onRegenerate={() => handleRegenerate(im.index)}
              onDownload={handleDownload}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function FormBgCell(props: {
  index: number
  status: string
  assetRef?: string
  error?: string
  busy: boolean
  onRegenerate: () => void
  onDownload: (index: number, url: string) => void
}) {
  const { index, status, assetRef, error, busy, onRegenerate, onDownload } = props
  const url = useAssetUrl(assetRef)
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
        <div className="text-xs font-semibold text-gray-800">Biến thể {index + 1}</div>
        <div className="flex items-center gap-1">
          {status === 'completed' && url && (
            <button onClick={() => onDownload(index, url)} title="Tải ảnh" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onRegenerate} disabled={busy} title="Tạo lại biến thể này" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${status === 'generating' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="relative aspect-[2/3] w-full bg-gray-50">
        {status === 'generating' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400"><RefreshCw className="h-6 w-6 animate-spin" /><span className="text-xs">Đang tạo…</span></div>
        ) : status === 'failed' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-red-400"><AlertCircle className="h-6 w-6" /><span className="text-[11px]">{error ?? 'Lỗi'}</span></div>
        ) : url ? (
          <img src={url} alt={`Biến thể ${index + 1}`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-300">Chưa có ảnh</div>
        )}
      </div>
    </div>
  )
}
