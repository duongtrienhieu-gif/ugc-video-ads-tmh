// ─────────────────────────────────────────────────────────────────────
// Re-Branding Sản phẩm — Mode 3 của Xưởng Ảnh.
// Bước 1: chọn SP + upload ảnh gốc + nhập kích thước (cm) + thị trường →
//         "Phân tích & gợi ý tên" → AI trả 3 tên + palette + copy nhãn.
// Bước 2: chọn 1 tên → "Tạo bộ rebrand" → 4 ảnh:
//   label-front, label-back (canvas, kích thước thật, để IN) + product, set (AI).
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Tags, Upload, RefreshCw, Sparkles, Download, X, AlertCircle, Check, Wand2 } from 'lucide-react'
import { useRebrandStore } from './store'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { saveAsset } from '../../utils/assetStore'
import type { Market } from '../../types/brandKit'
import {
  REBRAND_IMAGE_KINDS,
  REBRAND_TOTAL_CREDITS,
  MAX_ORIGINAL_IMAGES,
  cmToPx,
  rebrandSig,
  labelLangName,
  type RebrandImageKind,
  type RebrandIdentity,
} from './types'
import { analyzeRebrand } from './services/analyzeRebrand'
import { generateRebrandImage, friendlyRebrandError } from './services/generateRebrandImage'

const KIND_LABEL: Record<RebrandImageKind, string> = {
  'label-front': 'Nhãn mặt trước (in)',
  'label-back': 'Nhãn mặt sau (in)',
  'product': 'Sản phẩm nhãn mới',
  'set': 'Bao bì + sản phẩm bên trong',
}
const KIND_HINT: Record<RebrandImageKind, string> = {
  'label-front': 'AI · tỉ lệ gần kích thước thật',
  'label-back': 'AI · thành phần / HDSD',
  'product': 'AI giữ form, thay nhãn',
  'set': 'AI · đúng 1 bao bì + sản phẩm',
}

function AssetImg({ refId, alt }: { refId: string | undefined | null; alt: string }) {
  const url = useAssetUrl(refId)
  if (!url) return <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">…</div>
  return <img src={url} alt={alt} className="h-full w-full object-contain" />
}

export default function RebrandStudio({ embedded = false }: { embedded?: boolean }) {
  const {
    draft, images, identity, isAnalyzing,
    setProductId, addOriginalImage, removeOriginalImage, setWidthCm, setHeightCm, setMarket, setChosenName,
    setIdentity, setAnalyzing, patchImage,
  } = useRebrandStore()

  const products = useBankStore((s) => s.products)
  const getProductById = useBankStore((s) => s.getProductById)
  const { kieApiKey, geminiApiKey } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)

  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  const selectedProduct = draft.productId ? getProductById(draft.productId) : undefined
  // Reference = ẢNH UPLOAD (quyết định FORM bao bì thật) + 4 ẢNH BANK (nội dung/
  // sản phẩm thật). Upload đứng TRƯỚC để form bám bao bì user cung cấp. AI đọc cả
  // cụm → không bịa.
  const bankImages = (selectedProduct?.productImages ?? []).filter((r) => !!r && r.trim() !== '')
  const sourceRefs = Array.from(new Set([...draft.originalImageRefs, ...bankImages]))

  // Gom MỌI field sản phẩm cho AI đọc hiểu (không chỉ tên).
  const productContext = selectedProduct
    ? [
        `Name: ${selectedProduct.productName}`,
        selectedProduct.productDescription && `Description: ${selectedProduct.productDescription}`,
        selectedProduct.targetMarket && `Target market: ${selectedProduct.targetMarket}`,
        selectedProduct.benefits && `Benefits: ${selectedProduct.benefits}`,
        selectedProduct.usps && `USPs: ${selectedProduct.usps}`,
        selectedProduct.ingredients && `Ingredients: ${selectedProduct.ingredients}`,
        selectedProduct.usageGuide && `Usage: ${selectedProduct.usageGuide}`,
        selectedProduct.painPoints && `Pain points: ${selectedProduct.painPoints}`,
      ].filter(Boolean).join('\n')
    : ''

  const identityFresh = !!identity && identity.sig === rebrandSig({ productId: draft.productId, originalImageRefs: sourceRefs, market: draft.market })
  const namesValid = identityFresh && !!draft.chosenName && (identity?.names.includes(draft.chosenName) ?? false)

  const missing: string[] = []
  if (!geminiApiKey) missing.push('Gemini API key (Cài đặt)')
  if (!kieApiKey) missing.push('KIE API key (Cài đặt)')
  if (!draft.productId) missing.push('Chọn sản phẩm')
  if (sourceRefs.length === 0) missing.push('Sản phẩm cần có ảnh (4 ảnh bank) hoặc tải ảnh gốc')
  if (!(draft.widthCm && draft.widthCm > 0) || !(draft.heightCm && draft.heightCm > 0)) missing.push('Nhập kích thước nhãn (cm)')
  const canAnalyze = missing.length === 0
  const canGenerate = canAnalyze && namesValid

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      for (const f of files) {
        if (draft.originalImageRefs.length >= MAX_ORIGINAL_IMAGES) break
        const ref = await saveAsset(f, f.type)
        addOriginalImage(ref)
      }
    } catch (err) {
      addToast(`Tải ảnh gốc thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleAnalyze(): Promise<RebrandIdentity | null> {
    if (!canAnalyze || isAnalyzing) return identity
    setAnalyzing(true)
    try {
      const d = await analyzeRebrand({
        apiKey: geminiApiKey,
        productId: draft.productId,
        originalImageRefs: sourceRefs,
        uploadedCount: draft.originalImageRefs.length,
        productName: selectedProduct?.productName ?? '',
        productContext,
        market: draft.market,
      })
      setIdentity(d)
      setChosenName(d.names[0] ?? null) // mặc định chọn tên đầu
      addToast(`AI gợi ý ${d.names.length} tên brand.`, 'success')
      return d
    } catch (err) {
      addToast(`Phân tích thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
      return null
    } finally {
      setAnalyzing(false)
    }
  }

  async function generateOne(kind: RebrandImageKind, id: RebrandIdentity, name: string) {
    patchImage(kind, { status: 'generating', error: undefined })
    try {
      const res = await generateRebrandImage({
        apiKey: kieApiKey, kind, identity: id, chosenName: name,
        originalImageRefs: sourceRefs,
        widthCm: draft.widthCm, heightCm: draft.heightCm,
      })
      patchImage(kind, { status: 'completed', assetRef: res.assetRef })
    } catch (err) {
      patchImage(kind, { status: 'failed', error: friendlyRebrandError(err) })
      addToast(`${KIND_LABEL[kind]}: ${friendlyRebrandError(err)}`, 'error')
    }
  }

  async function handleGenerateAll() {
    if (!canGenerate || busy) return
    setBusy(true)
    try {
      const id = identity!
      const name = draft.chosenName!
      await Promise.all(REBRAND_IMAGE_KINDS.map((k) => generateOne(k, id, name)))
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate(kind: RebrandImageKind) {
    if (!canGenerate || busy) return
    setBusy(true)
    try { await generateOne(kind, identity!, draft.chosenName!) } finally { setBusy(false) }
  }

  function handleDownload(kind: RebrandImageKind, url: string) {
    const dims = kind.startsWith('label') ? `_${draft.widthCm}x${draft.heightCm}cm_300dpi` : ''
    const a = document.createElement('a')
    a.href = url
    a.download = `rebrand-${draft.chosenName ?? 'brand'}-${kind}${dims}.jpg`
    document.body.appendChild(a); a.click(); a.remove()
  }

  const pxHint = draft.widthCm && draft.heightCm
    ? `${cmToPx(draft.widthCm)}×${cmToPx(draft.heightCm)} px @300DPI`
    : ''

  return (
    <div className="flex h-full flex-col bg-[#F6F6F8]">
      {!embedded && (
        <div className="flex items-center gap-2 border-b border-black/10 bg-white px-5 py-3">
          <Tags className="h-5 w-5 text-indigo-500" />
          <h1 className="text-base font-bold text-gray-900">Re-Branding Sản phẩm</h1>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 lg:flex-row">
        {/* Input */}
        <div className="w-full shrink-0 space-y-4 lg:w-[380px]">
          {/* Thị trường */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-2 block text-xs font-semibold text-gray-700">Thị trường (ngôn ngữ nhãn)</label>
            <div className="flex gap-2">
              {(['vi', 'ms'] as Market[]).map((m) => (
                <button key={m} onClick={() => setMarket(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${draft.market === m ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-black/10 bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {m === 'vi' ? 'VN · Tiếng Việt' : 'MY · English'}
                </button>
              ))}
            </div>
          </div>

          {/* Sản phẩm + ảnh gốc */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-2 block text-xs font-semibold text-gray-700">Sản phẩm (từ project — AI đọc hiểu)</label>
            {products.length === 0 ? (
              <p className="text-xs text-gray-500">Chưa có sản phẩm trong bank.</p>
            ) : (
              <select value={draft.productId ?? ''} onChange={(e) => setProductId(e.target.value || null)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800">
                <option value="">— Chọn sản phẩm —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
              </select>
            )}
            {selectedProduct && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-medium text-gray-500">{bankImages.length} ảnh sản phẩm từ project (AI đọc + dùng làm gốc)</div>
                <div className="flex flex-wrap gap-1.5">
                  {bankImages.map((ref) => (
                    <div key={ref} className="h-12 w-12 overflow-hidden rounded-md border border-black/10 bg-gray-50">
                      <AssetImg refId={ref} alt="ảnh bank" />
                    </div>
                  ))}
                  {bankImages.length === 0 && <span className="text-[11px] text-amber-600">SP này chưa có ảnh — hãy tải ảnh gốc bên dưới.</span>}
                </div>
              </div>
            )}
            <label className="mb-1 mt-3 block text-xs font-semibold text-gray-700">Ảnh upload thêm — quyết định hình dáng bao bì (tuỳ chọn)</label>
            <div className="flex flex-wrap gap-1.5">
              {draft.originalImageRefs.map((ref) => (
                <div key={ref} className="relative h-16 w-16 overflow-hidden rounded-md border border-black/10 bg-gray-50">
                  <AssetImg refId={ref} alt="ảnh gốc" />
                  <button onClick={() => removeOriginalImage(ref)} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
                </div>
              ))}
              {draft.originalImageRefs.length < MAX_ORIGINAL_IMAGES && (
                <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-black/20 bg-gray-50 text-gray-500 hover:bg-gray-100">
                  {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /><span className="text-[9px]">Tải lên</span></>}
                  <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
          </div>

          {/* Kích thước */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-1 block text-xs font-semibold text-gray-700">Kích thước nhãn thật (cm)</label>
            <p className="mb-2 text-[10px] text-gray-400">Đo thực tế ngoài đời — dùng để xuất file in đúng size.</p>
            <div className="flex items-center gap-2">
              <input type="number" min={0} step="0.1" value={draft.widthCm ?? ''} placeholder="Rộng"
                onChange={(e) => setWidthCm(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800" />
              <span className="text-gray-400">×</span>
              <input type="number" min={0} step="0.1" value={draft.heightCm ?? ''} placeholder="Cao"
                onChange={(e) => setHeightCm(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800" />
            </div>
            {pxHint && <p className="mt-1.5 text-[10px] text-gray-400">{pxHint}</p>}
          </div>

          {/* Bước 1: phân tích + chọn tên */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <button onClick={() => { void handleAnalyze() }} disabled={!canAnalyze || isAnalyzing}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40">
              {isAnalyzing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {isAnalyzing ? 'Đang phân tích…' : '1 · Phân tích & gợi ý tên'}
            </button>
            {identityFresh && identity && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold text-gray-600">Chọn tên brand mới:</div>
                <div className="space-y-1.5">
                  {identity.names.map((n) => {
                    const active = draft.chosenName === n
                    return (
                      <button key={n} onClick={() => setChosenName(n)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${active ? 'border-indigo-400 bg-indigo-50 font-semibold text-indigo-700' : 'border-black/10 bg-white text-gray-700 hover:bg-gray-50'}`}>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${active ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>{active && <Check className="h-3 w-3 text-white" />}</span>
                        {n}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded-sm border border-black/10" style={{ background: identity.palette.primary }} />
                  <span className="h-3.5 w-3.5 rounded-sm border border-black/10" style={{ background: identity.palette.accent }} />
                  <span className="text-[10px] text-gray-400">palette giữ từ bản gốc · nhãn {labelLangName(identity.market)}</span>
                </div>
              </div>
            )}
          </div>

          {!canAnalyze && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertCircle className="h-3.5 w-3.5" /> Cần bổ sung:</div>
              <ul className="space-y-0.5 text-[11px] text-amber-700">{missing.map((m) => <li key={m}>• {m}</li>)}</ul>
            </div>
          )}

          {/* Bước 2: tạo */}
          <button onClick={handleGenerateAll} disabled={!canGenerate || busy}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${canGenerate && !busy ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'cursor-not-allowed bg-gray-200 text-gray-400'}`}>
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'Đang tạo bộ rebrand…' : `2 · Tạo bộ rebrand · ~${REBRAND_TOTAL_CREDITS} credit`}
          </button>
          <p className="text-[10px] text-gray-400">4 ảnh AI (~{REBRAND_TOTAL_CREDITS} credit): nhãn trước/sau + sản phẩm + hộp. Nhãn tải về đưa bên in (tỉ lệ ~{draft.widthCm ?? '?'}×{draft.heightCm ?? '?'}cm), dán đè mã cũ.</p>
        </div>

        {/* Output */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          {images.map((im) => (
            <RebrandCell key={im.kind} kind={im.kind} status={im.status} assetRef={im.assetRef} error={im.error}
              busy={busy} onRegenerate={() => handleRegenerate(im.kind)} onDownload={handleDownload} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RebrandCell(props: {
  kind: RebrandImageKind
  status: string
  assetRef?: string
  error?: string
  busy: boolean
  onRegenerate: () => void
  onDownload: (kind: RebrandImageKind, url: string) => void
}) {
  const { kind, status, assetRef, error, busy, onRegenerate, onDownload } = props
  const url = useAssetUrl(assetRef)
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-gray-800">{KIND_LABEL[kind]}</div>
          <div className="text-[10px] text-gray-400">{KIND_HINT[kind]}</div>
        </div>
        <div className="flex items-center gap-1">
          {status === 'completed' && url && (
            <button onClick={() => onDownload(kind, url)} title="Tải ảnh" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><Download className="h-3.5 w-3.5" /></button>
          )}
          <button onClick={onRegenerate} disabled={busy} title="Tạo lại" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${status === 'generating' ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>
      <div className="w-full bg-gray-50">
        {status === 'generating' ? (
          <div className="flex min-h-[180px] w-full flex-col items-center justify-center gap-2 text-gray-400"><RefreshCw className="h-6 w-6 animate-spin" /><span className="text-xs">Đang tạo…</span></div>
        ) : status === 'failed' ? (
          <div className="flex min-h-[180px] w-full flex-col items-center justify-center gap-1 p-3 text-center text-red-400"><AlertCircle className="h-6 w-6" /><span className="text-[11px]">{error ?? 'Lỗi'}</span></div>
        ) : url ? (
          <img src={url} alt={KIND_LABEL[kind]} className="block h-auto w-full" />
        ) : (
          <div className="flex min-h-[180px] w-full items-center justify-center text-xs text-gray-300">Chưa có ảnh</div>
        )}
      </div>
    </div>
  )
}
