// ─────────────────────────────────────────────────────────────────────
// Gift Studio — Xưởng Quà Tặng Kèm (standalone, chạy riêng).
//
// Input: 1 sản phẩm (bank) + ảnh quà + tên quà + giá trị RM + ngôn ngữ.
// Output: 3 ảnh AI (banner / combo giá / thẻ thông tin quà) — chữ nướng
// trong ảnh, song ngữ ms (chính) / vi (phụ). Không đụng app nào khác.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Gift, Upload, RefreshCw, Sparkles, Download, X, AlertCircle, Wand2 } from 'lucide-react'
import { useGiftStudioStore } from './store'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { saveAsset } from '../../utils/assetStore'
import type { Market } from '../../types/brandKit'
import { langDisplayName, giftLabels } from './labels'
import {
  GIFT_IMAGE_KINDS,
  GIFT_TOTAL_CREDITS,
  computeTierPricing,
  offerSig,
  type GiftImageKind,
  type GiftBenefits,
  type GiftTier,
} from './types'
import { generateGiftBenefits, benefitsSig } from './services/generateGiftBenefits'
import { generateGiftImage, friendlyGiftError } from './services/generateGiftImage'
import { parseOffer } from './services/parseOffer'

const KIND_LABEL: Record<GiftImageKind, string> = {
  banner: 'Banner có quà',
  combo: 'Combo giá có quà',
  info: 'Thẻ thông tin quà',
}

const KIND_HINT: Record<GiftImageKind, string> = {
  banner: 'Sản phẩm hero + teaser quà tặng kèm',
  combo: 'Sản phẩm + quà như một combo ưu đãi',
  info: 'Quà là hero + tên + giá trị + công dụng',
}

function AssetImg({ refId, alt }: { refId: string | undefined | null; alt: string }) {
  const url = useAssetUrl(refId)
  if (!url) return <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">…</div>
  return <img src={url} alt={alt} className="h-full w-full object-cover" />
}

export default function GiftStudio() {
  const {
    draft, images, benefits, isPreparing, isParsing,
    setProductId, setGiftName, setGiftValueRM, setGiftImageRef, setLang,
    setOfferText, setTiers, setParsing,
    setBenefits, setPreparing, patchImage,
  } = useGiftStudioStore()

  const products = useBankStore((s) => s.products)
  const getProductById = useBankStore((s) => s.getProductById)
  const { kieApiKey, geminiApiKey } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)

  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  const selectedProduct = draft.productId ? getProductById(draft.productId) : undefined
  const productImages = (selectedProduct?.productImages ?? []).filter((r) => !!r && r.trim() !== '')

  const L = giftLabels(draft.lang)
  // Tiers còn "tươi" khi đã parse đúng ô dán + ngôn ngữ hiện tại.
  const tiersFresh = draft.tiers.length > 0 && draft.tiersSig === offerSig(draft.offerText, draft.lang)

  const missing: string[] = []
  if (!geminiApiKey) missing.push('Gemini API key (Cài đặt)')
  if (!kieApiKey) missing.push('KIE API key (Cài đặt)')
  if (!draft.productId) missing.push('Chọn sản phẩm')
  else if (productImages.length === 0) missing.push('Sản phẩm cần có ít nhất 1 ảnh')
  if (!draft.giftName.trim()) missing.push('Tên quà')
  if (draft.giftValueRM == null) missing.push('Giá trị 1 món quà (RM)')
  if (!draft.giftImageRef) missing.push('Ảnh quà')
  if (!draft.offerText.trim()) missing.push('Dán nội dung offer (mốc tặng)')
  else if (!tiersFresh) missing.push('Bấm “Phân tích mốc” để AI đọc offer')
  const ready = missing.length === 0

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép upload lại cùng file
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

  /** Parse ô dán offer → tiers (AI). Trả về tiers vừa parse. */
  async function handleParse(): Promise<GiftTier[]> {
    if (!draft.offerText.trim() || isParsing) return draft.tiers
    setParsing(true)
    try {
      const tiers = await parseOffer({ apiKey: geminiApiKey, offerText: draft.offerText })
      setTiers(tiers)
      addToast(`Đã đọc ${tiers.length} mốc tặng.`, 'success')
      return tiers
    } catch (err) {
      addToast(`Phân tích mốc thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
      throw err
    } finally {
      setParsing(false)
    }
  }

  /** Đảm bảo tiers tươi với ô dán hiện tại (parse nếu stale). */
  async function ensureTiers(): Promise<GiftTier[]> {
    if (tiersFresh) return draft.tiers
    return handleParse()
  }

  /** Đảm bảo có benefits đúng với input hiện tại (sinh nếu thiếu/stale). */
  async function ensureBenefits(): Promise<GiftBenefits> {
    const wantSig = benefitsSig(draft.giftImageRef!, draft.giftName, draft.giftValueRM, draft.lang)
    if (benefits && benefits.sig === wantSig) return benefits
    setPreparing(true)
    try {
      const b = await generateGiftBenefits({
        apiKey: geminiApiKey,
        giftImageRef: draft.giftImageRef!,
        giftName: draft.giftName,
        giftValueRM: draft.giftValueRM,
        lang: draft.lang,
      })
      setBenefits(b)
      return b
    } finally {
      setPreparing(false)
    }
  }

  async function generateOne(kind: GiftImageKind, b: GiftBenefits, tiers: GiftTier[]) {
    patchImage(kind, { status: 'generating', error: undefined })
    try {
      const res = await generateGiftImage({
        apiKey: kieApiKey,
        kind,
        product: selectedProduct!,
        giftName: draft.giftName,
        giftValueRM: draft.giftValueRM,
        tiers,
        giftImageRef: draft.giftImageRef!,
        benefits: b,
        lang: draft.lang,
      })
      patchImage(kind, { status: 'completed', assetRef: res.assetRef, prompt: res.prompt })
    } catch (err) {
      patchImage(kind, { status: 'failed', error: friendlyGiftError(err) })
      addToast(`${KIND_LABEL[kind]}: ${friendlyGiftError(err)}`, 'error')
    }
  }

  async function handleGenerateAll() {
    if (!ready || busy) return
    setBusy(true)
    try {
      const tiers = await ensureTiers()
      const b = await ensureBenefits()
      // Tuần tự cho ổn định + tránh spike rate (chỉ 3 ảnh).
      for (const kind of GIFT_IMAGE_KINDS) {
        await generateOne(kind, b, tiers)
      }
    } catch (err) {
      addToast(`Tạo ảnh thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate(kind: GiftImageKind) {
    if (!ready || busy) return
    setBusy(true)
    try {
      const tiers = await ensureTiers()
      const b = await ensureBenefits()
      await generateOne(kind, b, tiers)
    } catch (err) {
      addToast(`Tạo ảnh thất bại: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  function handleDownload(kind: GiftImageKind, url: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = `qua-tang-${kind}.jpg`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="flex h-full flex-col bg-[#F6F6F8]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-black/10 bg-white px-5 py-3">
        <Gift className="h-5 w-5 text-rose-500" />
        <h1 className="text-base font-bold text-gray-900">Xưởng Quà Tặng Kèm</h1>
        <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
          {GIFT_IMAGE_KINDS.length} ảnh / lần · ~{GIFT_TOTAL_CREDITS} credit
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 lg:flex-row">
        {/* ── Input panel ── */}
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
                    draft.lang === m
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : 'border-black/10 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {langDisplayName(m)}{m === 'ms' ? ' (chính)' : ' (phụ)'}
                </button>
              ))}
            </div>
          </div>

          {/* Sản phẩm */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-2 block text-xs font-semibold text-gray-700">Sản phẩm chính</label>
            {products.length === 0 ? (
              <p className="text-xs text-gray-500">Chưa có sản phẩm trong bank. Thêm sản phẩm ở mục “Sản phẩm”.</p>
            ) : (
              <select
                value={draft.productId ?? ''}
                onChange={(e) => setProductId(e.target.value || null)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800"
              >
                <option value="">— Chọn sản phẩm —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.productName}</option>
                ))}
              </select>
            )}
            {selectedProduct && (
              <div className="mt-3 flex gap-1.5">
                {productImages.slice(0, 4).map((ref) => (
                  <div key={ref} className="h-12 w-12 overflow-hidden rounded-md border border-black/10 bg-gray-50">
                    <AssetImg refId={ref} alt="ảnh sản phẩm" />
                  </div>
                ))}
                {productImages.length === 0 && (
                  <p className="text-[11px] text-amber-600">Sản phẩm này chưa có ảnh tham chiếu.</p>
                )}
              </div>
            )}
          </div>

          {/* Quà */}
          <div className="space-y-3 rounded-xl border border-black/10 bg-white p-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Tên quà</label>
              <input
                type="text"
                value={draft.giftName}
                onChange={(e) => setGiftName(e.target.value)}
                placeholder="VD: Túi đựng mỹ phẩm chống thấm"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Giá trị 1 món quà (RM)</label>
              <input
                type="number"
                min={0}
                value={draft.giftValueRM ?? ''}
                onChange={(e) => setGiftValueRM(e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))}
                placeholder="VD: 49"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">Ảnh quà</label>
              {draft.giftImageRef ? (
                <div className="relative h-32 w-full overflow-hidden rounded-lg border border-black/10 bg-gray-50">
                  <AssetImg refId={draft.giftImageRef} alt="ảnh quà" />
                  <button
                    onClick={() => setGiftImageRef(null)}
                    title="Xoá ảnh quà"
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-black/20 bg-gray-50 text-gray-500 hover:bg-gray-100">
                  {uploading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span className="text-xs">Tải ảnh quà lên</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
          </div>

          {/* Mốc tặng — dán offer, AI tự đọc */}
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <label className="mb-1 block text-xs font-semibold text-gray-700">Mốc tặng (dán offer combo)</label>
            <p className="mb-2 text-[10px] text-gray-400">
              Dán nguyên offer (bất kỳ ngôn ngữ). AI tự hiểu: mua mấy SP chính · tặng mấy SP chính · tặng mấy quà · giá. Freeship sẽ bỏ qua.
            </p>
            <textarea
              value={draft.offerText}
              onChange={(e) => setOfferText(e.target.value)}
              rows={5}
              placeholder={'VD:\nBELI 1 KOTAK FREE 1 KOTAK: RM59\nBELI 2 KOTAK FREE 2 KOTAK: RM89 + 1 SNACK\nBELI 3 KOTAK FREE 3 KOTAK: RM119 + 2 SNACK'}
              className="w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 text-xs leading-relaxed text-gray-800"
            />
            <button
              onClick={() => { void handleParse() }}
              disabled={!draft.offerText.trim() || isParsing}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isParsing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {isParsing ? 'Đang đọc offer…' : 'Phân tích mốc'}
            </button>

            {/* Preview mốc đã parse */}
            {draft.tiers.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500">
                  {tiersFresh ? 'Mốc AI đã hiểu:' : '⚠ Ô dán đã đổi — bấm phân tích lại:'}
                </div>
                {draft.tiers.map((t, i) => {
                  const p = computeTierPricing(t, draft.giftValueRM)
                  return (
                    <div key={i} className="rounded-md border border-black/10 bg-gray-50 px-2 py-1.5 text-[11px]">
                      <div className="flex items-center justify-between font-semibold text-gray-700">
                        <span>{L.packageBadge(i + 1)} · {L.mainDealLabel(t.buyMainQty, t.freeMainQty)}</span>
                        <span className="text-rose-600">RM{t.price}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                        {p.jimat > 0 && <span className="text-emerald-600">{L.savingsLabel(p.jimat)} (gốc RM{p.originalPrice})</span>}
                        {t.giftQty > 0
                          ? <span>🎁 {t.giftQty}× {draft.giftName || 'quà'}{p.giftTotalValue > 0 ? ` · ${L.valueLabel(p.giftTotalValue)}` : ''}</span>
                          : <span className="text-gray-400">không tặng quà</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Readiness + Generate */}
          {!ready && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" /> Cần bổ sung:
              </div>
              <ul className="space-y-0.5 text-[11px] text-amber-700">
                {missing.map((m) => <li key={m}>• {m}</li>)}
              </ul>
            </div>
          )}

          <button
            onClick={handleGenerateAll}
            disabled={!ready || busy}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
              ready && !busy
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
          >
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isParsing ? 'Đang đọc offer…' : isPreparing ? 'Đang phân tích quà…' : busy ? 'Đang tạo ảnh…' : `Tạo ${GIFT_IMAGE_KINDS.length} ảnh quà`}
          </button>
        </div>

        {/* ── Output grid ── */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((im) => {
            return (
              <GiftCell
                key={im.kind}
                kind={im.kind}
                status={im.status}
                assetRef={im.assetRef}
                error={im.error}
                busy={busy}
                onRegenerate={() => handleRegenerate(im.kind)}
                onDownload={handleDownload}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GiftCell(props: {
  kind: GiftImageKind
  status: string
  assetRef?: string
  error?: string
  busy: boolean
  onRegenerate: () => void
  onDownload: (kind: GiftImageKind, url: string) => void
}) {
  const { kind, status, assetRef, error, busy, onRegenerate, onDownload } = props
  const url = useAssetUrl(assetRef)
  const aspect = kind === 'banner' ? 'aspect-[3/2]' : 'aspect-[2/3]' // combo + info dọc 9:16/2:3

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-gray-800">{KIND_LABEL[kind]}</div>
          <div className="text-[10px] text-gray-400">{KIND_HINT[kind]}</div>
        </div>
        <div className="flex items-center gap-1">
          {status === 'completed' && url && (
            <button
              onClick={() => onDownload(kind, url)}
              title="Tải ảnh"
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onRegenerate}
            disabled={busy}
            title="Tạo lại ảnh này"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status === 'generating' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className={`relative ${aspect} w-full bg-gray-50`}>
        {status === 'generating' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="text-xs">Đang tạo…</span>
          </div>
        ) : status === 'failed' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-red-400">
            <AlertCircle className="h-6 w-6" />
            <span className="text-[11px]">{error ?? 'Lỗi'}</span>
          </div>
        ) : url ? (
          <img src={url} alt={KIND_LABEL[kind]} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-300">Chưa có ảnh</div>
        )}
      </div>
    </div>
  )
}
