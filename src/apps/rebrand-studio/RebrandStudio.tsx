// ─────────────────────────────────────────────────────────────────────
// Re-Branding Sản phẩm — Mode 3 của Xưởng Ảnh.
// Bước 1: chọn SP + upload ảnh gốc + nhập kích thước (cm) + thị trường →
//         "Phân tích & gợi ý tên" → AI trả 3 tên + palette + copy nhãn.
// Bước 2: chọn 1 tên → "Tạo bộ rebrand" → 4 ảnh:
//   label-front, label-back (canvas, kích thước thật, để IN) + product, set (AI).
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Tags, Upload, RefreshCw, Sparkles, Download, X, AlertCircle, Check, Wand2, Save, FolderOpen, Plus } from 'lucide-react'
import { useRebrandStore } from './store'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { saveAsset } from '../../utils/assetStore'
import type { Market } from '../../types/brandKit'
import {
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
  'label': 'Nhãn (gộp, để in)',
  'product': 'Sản phẩm nhãn mới',
  'set': 'Bao bì + sản phẩm bên trong',
  'combo': 'Tháp combo (ads)',
}
const KIND_HINT: Record<RebrandImageKind, string> = {
  'label': 'AI · gộp front+back, đúng tỉ lệ',
  'product': 'AI giữ form, thay nhãn',
  'set': 'AI · đúng 1 bao bì + sản phẩm',
  'combo': 'AI · tháp chính diện + nguyên liệu',
}

function AssetImg({ refId, alt }: { refId: string | undefined | null; alt: string }) {
  const url = useAssetUrl(refId)
  if (!url) return <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">…</div>
  return <img src={url} alt={alt} className="h-full w-full object-contain" />
}

export default function RebrandStudio({ embedded = false }: { embedded?: boolean }) {
  const {
    draft, images, identity, isAnalyzing,
    setProductId, addOriginalImage, removeOriginalImage, setWidthCm, setHeightCm, setPackagingType, setLabelModel, setMfgDate, setExpDate, ensureCode, regenCode, setMarket, setChosenName,
    setIdentity, setAnalyzing, patchImage,
    savedSets, saveCurrentSet, newSet, openSet,
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
  // Tên hợp lệ = identity tươi + có tên (chọn từ AI HOẶC tự nhập). Không bắt buộc nằm trong list AI.
  const namesValid = identityFresh && !!draft.chosenName && draft.chosenName.trim().length > 0

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
    // Tên user TỰ NHẬP (không thuộc list AI cũ) → giữ nguyên qua các lần roll lại.
    const prevNames = identity?.names ?? []
    const hasCustomName = !!draft.chosenName?.trim() && !prevNames.includes(draft.chosenName)
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
      if (!hasCustomName) setChosenName(d.names[0] ?? null) // chỉ auto-chọn tên đầu nếu user chưa tự nhập
      addToast(`AI gợi ý ${d.names.length} tên brand.`, 'success')
      return d
    } catch (err) {
      addToast(`Phân tích thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
      return null
    } finally {
      setAnalyzing(false)
    }
  }

  async function generateOne(kind: RebrandImageKind, id: RebrandIdentity, name: string, labelRef?: string, comboBaseRef?: string, codes?: { batchCode: string; barcodeNum: string }): Promise<string | undefined> {
    patchImage(kind, { status: 'generating', error: undefined })
    try {
      // Nhãn (flat artwork): ref ảnh món ăn bank (không dùng pouch upload).
      // product/set: full ref + labelRef.
      // combo: ref = ảnh "Sản phẩm nhãn mới" SẠCH (comboBaseRef) — KHÔNG dùng ảnh
      // gốc nhãn cũ → tránh rò rỉ nhãn cũ lên 1 trong nhiều pouch.
      const isLabel = kind === 'label'
      const isCombo = kind === 'combo'
      const refsForKind = isLabel
        ? (bankImages.length ? bankImages : sourceRefs)
        : (isCombo && comboBaseRef) ? [comboBaseRef] : sourceRefs
      const res = await generateRebrandImage({
        apiKey: kieApiKey, kind, identity: id, chosenName: name,
        originalImageRefs: refsForKind,
        widthCm: draft.widthCm, heightCm: draft.heightCm,
        packagingType: draft.packagingType,
        labelModel: draft.labelModel,
        mfgDate: draft.mfgDate, expDate: draft.expDate,
        batchCode: codes?.batchCode, barcodeNum: codes?.barcodeNum,
        labelRef: isLabel ? undefined : labelRef,
      })
      patchImage(kind, { status: 'completed', assetRef: res.assetRef })
      return res.assetRef
    } catch (err) {
      patchImage(kind, { status: 'failed', error: friendlyRebrandError(err) })
      addToast(`${KIND_LABEL[kind]}: ${friendlyRebrandError(err)}`, 'error')
      return undefined
    }
  }

  async function handleGenerateAll() {
    if (!canGenerate || busy) return
    setBusy(true)
    try {
      const id = identity!
      const name = draft.chosenName!
      const codes = ensureCode()
      // Sinh NHÃN gộp trước → lấy làm ref cho product/set (pouch mặc đúng nhãn).
      const labelRef = await generateOne('label', id, name, undefined, undefined, codes)
      // product + set song song; combo CHỜ product xong để lấy pouch sạch làm ref.
      const [productRef] = await Promise.all([
        generateOne('product', id, name, labelRef),
        generateOne('set', id, name, labelRef),
      ])
      await generateOne('combo', id, name, labelRef, productRef)
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate(kind: RebrandImageKind) {
    if (!canGenerate || busy) return
    setBusy(true)
    try {
      // product/set/combo tạo lại → dùng nhãn gộp hiện có; combo thêm pouch sạch (#2).
      const labelRef = images.find((im) => im.kind === 'label')?.assetRef
      const comboBaseRef = kind === 'combo' ? images.find((im) => im.kind === 'product')?.assetRef : undefined
      const codes = kind === 'label' ? ensureCode() : undefined
      await generateOne(kind, identity!, draft.chosenName!, labelRef, comboBaseRef, codes)
    } finally { setBusy(false) }
  }

  function handleSaveSet() {
    const def = draft.chosenName ?? selectedProduct?.productName ?? 'Bộ rebrand'
    const name = window.prompt('Tên bộ ảnh:', def)
    if (name === null) return
    saveCurrentSet(name)
    addToast('Đã lưu bộ ảnh.', 'success')
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
  const labelCredit = draft.labelModel === 'nano4k' ? 20 : 6
  const totalCredit = labelCredit + 18 // product 6 + set 6 + combo 6

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
          {/* Thư viện bộ ảnh */}
          <div className="rounded-xl border border-black/10 bg-white p-3">
            <div className="flex gap-2">
              <button onClick={() => { if (window.confirm('Tạo bộ mới? Bộ hiện tại nên Lưu trước khi tạo mới.')) newSet() }}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-black/10 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <Plus className="h-3.5 w-3.5" /> Bộ mới
              </button>
              <button onClick={handleSaveSet}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100">
                <Save className="h-3.5 w-3.5" /> Lưu bộ
              </button>
            </div>
            {savedSets.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <select value="" onChange={(e) => { if (e.target.value) openSet(e.target.value) }}
                  className="w-full rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-gray-700">
                  <option value="">Mở bộ đã lưu ({savedSets.length})…</option>
                  {savedSets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {new Date(s.savedAt).toLocaleDateString('vi-VN')}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

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

          {/* Kiểu dán nhãn */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-2 block text-xs font-semibold text-gray-700">Kiểu dán nhãn</label>
            <div className="flex gap-2">
              {([['flat', 'Dán 1 mặt'], ['round', 'Quấn quanh lọ tròn']] as const).map(([t, lbl]) => (
                <button key={t} onClick={() => setPackagingType(t)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${draft.packagingType === t ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-black/10 bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {lbl}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              {draft.packagingType === 'round'
                ? 'Nhãn dài quấn từ trước ra sau, chừa khoảng trống giữa. Tỉ lệ quấn rộng → AI ra ~gần nhất (3:2).'
                : 'Gộp toàn bộ front + back lên 1 mặt (1 nhãn dán nhanh).'}
            </p>
          </div>

          {/* Kích thước */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              {draft.packagingType === 'round' ? 'Kích thước quấn (cm): chu vi × cao' : 'Kích thước nhãn thật (cm)'}
            </label>
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

          {/* NSX / HSD */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-1 block text-xs font-semibold text-gray-700">NSX / HSD (in lên nhãn, tuỳ chọn)</label>
            <div className="flex items-center gap-2">
              <input type="text" value={draft.mfgDate} placeholder="NSX (vd 01/2026)"
                onChange={(e) => setMfgDate(e.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800" />
              <input type="text" value={draft.expDate} placeholder="HSD (vd 04/12/2027)"
                onChange={(e) => setExpDate(e.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800" />
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Nhập DD/MM/YYYY. Nhãn MY tự đổi sang "04 Sep 2026"; VN giữ 04/09/2026.</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-gray-500">Mã (random): <span className="font-mono text-gray-700">{draft.batchCode || '—'}</span> · <span className="font-mono text-gray-700">{draft.barcodeNum || '—'}</span></span>
              <button onClick={regenCode} className="ml-auto rounded-md border border-black/10 px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-50">Đổi mã</button>
            </div>
          </div>

          {/* Model nhãn (in) */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-2 block text-xs font-semibold text-gray-700">Model render nhãn (để in)</label>
            <div className="flex gap-2">
              {([['gpt4o', 'GPT-4o · 1K', '6cr · look quen'], ['nano4k', 'Nano · 4K', '20cr · nét, để in']] as const).map(([m, lbl, sub]) => (
                <button key={m} onClick={() => setLabelModel(m)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-left transition-colors ${draft.labelModel === m ? 'border-indigo-400 bg-indigo-50' : 'border-black/10 bg-white hover:bg-gray-50'}`}>
                  <div className={`text-xs font-medium ${draft.labelModel === m ? 'text-indigo-700' : 'text-gray-800'}`}>{lbl}</div>
                  <div className="text-[10px] text-gray-400">{sub}</div>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">Nano 4K nét hơn cho bản in nhưng bố cục/chữ có thể khác GPT-4o — thử rồi đổi lại nếu không ưng.</p>
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
                {/* Tự nhập tên brand — hoặc dùng tên AI ở trên. Giữ qua các lần roll. */}
                <div className="mt-2">
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">Hoặc tự nhập tên brand:</label>
                  <input
                    type="text"
                    value={draft.chosenName ?? ''}
                    placeholder="Gõ tên brand của bạn…"
                    onChange={(e) => setChosenName(e.target.value)}
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-gray-800 placeholder:font-normal placeholder:text-gray-400" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(identity.palette.colors.length ? identity.palette.colors : [identity.palette.primary, identity.palette.accent, identity.palette.bg]).map((c, i) => (
                    <span key={`${c}-${i}`} title={c} className="h-4 w-4 rounded-sm border border-black/10" style={{ background: c }} />
                  ))}
                  <span className="text-[10px] text-gray-400">palette ~85% vibe gốc · nhãn {labelLangName(identity.market)}</span>
                </div>
                {identity.vibe && <div className="mt-1 text-[10px] italic text-gray-400">Vibe: {identity.vibe}</div>}
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
            {busy ? 'Đang tạo bộ rebrand…' : `2 · Tạo bộ rebrand · ~${totalCredit} credit`}
          </button>
          <p className="text-[10px] text-gray-400">4 ảnh AI (~{totalCredit} credit): nhãn gộp + sản phẩm + bao bì + tháp combo (ads). Pouch/combo mặc đúng nhãn. Nhãn tải về đưa bên in (~{draft.widthCm ?? '?'}×{draft.heightCm ?? '?'}cm). ⚠️ Số bảng dinh dưỡng là AI ước lượng — kiểm tra lại trước khi in.</p>
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
