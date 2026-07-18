// ─────────────────────────────────────────────────────────────────────
// Combo Giá — mode trong Xưởng Ảnh. Poster combo GIÁ (KHÔNG quà, chỉ SP chính).
// Input: 1 sản phẩm (bank) + BẢNG GIÁ nhập tay (mua X · tặng Y · = RM · ship) + ngôn ngữ.
// Output: 1 ảnh combo poster 9:16 — tái dùng visual combo-vertical của Quà tặng,
// bỏ quà, mỗi tier có badge ship. Chữ nướng trong ảnh (gpt-4o-image i2i, khóa SP).
// ─────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Tag, RefreshCw, Sparkles, Download, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import type { Market } from '../../types/brandKit'
import { langDisplayName, giftLabels } from './labels'
import { computeTierPricing, MAX_GIFT_TIERS, type GiftTier, type GiftBenefits } from './types'
import { generateComboBenefits, comboBenefitsSig } from './services/generateComboBenefits'
import { generateGiftImage, friendlyGiftError } from './services/generateGiftImage'

interface PriceRow { buy: number; free: number; price: number; ship: string }
interface ComboDraft { productId: string | null; lang: Market; rows: PriceRow[] }

const STORE_KEY = 'price-combo-draft-v1'
const DEFAULT_ROWS: PriceRow[] = [
  { buy: 1, free: 1, price: 0, ship: '+RM6 Shipping' },
  { buy: 2, free: 1, price: 0, ship: 'FREESHIP' },
  { buy: 3, free: 2, price: 0, ship: 'FREESHIP' },
]
function loadDraft(): ComboDraft {
  try { const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (s && Array.isArray(s.rows)) return s } catch { /* ignore */ }
  return { productId: null, lang: 'ms', rows: DEFAULT_ROWS.map((r) => ({ ...r })) }
}

function AssetImg({ refId, alt }: { refId: string | undefined | null; alt: string }) {
  const url = useAssetUrl(refId)
  if (!url) return <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">…</div>
  return <img src={url} alt={alt} className="h-full w-full object-cover" />
}

export default function PriceComboStudio() {
  const [draft, setDraft] = useState<ComboDraft>(loadDraft)
  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(draft)) } catch { /* quota */ } }, [draft])

  const products = useBankStore((s) => s.products)
  const getProductById = useBankStore((s) => s.getProductById)
  const { kieApiKey, geminiApiKey } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'failed'>('idle')
  const [assetRef, setAssetRef] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [benefits, setBenefits] = useState<GiftBenefits | null>(null)
  const resultUrl = useAssetUrl(assetRef)

  const selectedProduct = draft.productId ? getProductById(draft.productId) : undefined
  const productImages = (selectedProduct?.productImages ?? []).filter((r) => !!r && r.trim() !== '')
  const L = giftLabels(draft.lang)

  const set = (patch: Partial<ComboDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const setRow = (i: number, patch: Partial<PriceRow>) => setDraft((d) => ({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }))
  const addRow = () => setDraft((d) => (d.rows.length >= MAX_GIFT_TIERS ? d : { ...d, rows: [...d.rows, { buy: d.rows.length + 1, free: 0, price: 0, ship: 'FREESHIP' }] }))
  const delRow = (i: number) => setDraft((d) => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }))

  const validRows = draft.rows.filter((r) => r.buy >= 1 && r.price > 0)
  const tiers: GiftTier[] = validRows.map((r) => ({ buyMainQty: r.buy, freeMainQty: Math.max(0, r.free), giftQty: 0, price: r.price, shippingNote: r.ship.trim() || undefined }))
  const hasFreeship = validRows.some((r) => /free\s*ship|freeship|percuma.*hantar/i.test(r.ship))

  const missing: string[] = []
  if (!geminiApiKey) missing.push('Gemini API key (Cài đặt)')
  if (!kieApiKey) missing.push('KIE API key (Cài đặt)')
  if (!draft.productId) missing.push('Chọn sản phẩm')
  else if (productImages.length === 0) missing.push('Sản phẩm cần có ít nhất 1 ảnh')
  if (validRows.length === 0) missing.push('Nhập ít nhất 1 dòng combo có giá (RM)')
  const ready = missing.length === 0

  async function ensureBenefits(): Promise<GiftBenefits> {
    const wantSig = comboBenefitsSig(draft.productId!, draft.lang, hasFreeship)
    if (benefits && benefits.sig === wantSig) return benefits
    const b = await generateComboBenefits({ apiKey: geminiApiKey, product: selectedProduct!, lang: draft.lang, hasFreeship })
    setBenefits(b)
    return b
  }

  async function handleGenerate() {
    if (!ready || busy) return
    setBusy(true); setStatus('generating'); setError(undefined)
    try {
      const b = await ensureBenefits()
      const res = await generateGiftImage({
        apiKey: kieApiKey, kind: 'combo', product: selectedProduct!,
        giftName: '', giftValueRM: null, tiers, giftImageRef: '', benefits: b, lang: draft.lang, noGift: true,
      })
      setAssetRef(res.assetRef); setStatus('completed')
    } catch (err) {
      const msg = friendlyGiftError(err)
      setStatus('failed'); setError(msg); addToast(`Combo giá: ${msg}`, 'error')
    } finally { setBusy(false) }
  }

  function handleDownload() {
    if (!resultUrl) return
    const a = document.createElement('a'); a.href = resultUrl; a.download = 'combo-gia.jpg'
    document.body.appendChild(a); a.click(); a.remove()
  }

  const numInput = 'w-full rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm text-gray-800'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 lg:flex-row">
      {/* ── Input ── */}
      <div className="w-full shrink-0 space-y-4 lg:w-[400px]">
        {/* Ngôn ngữ */}
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <label className="mb-2 block text-xs font-semibold text-gray-700">Ngôn ngữ chiến dịch</label>
          <div className="flex gap-2">
            {(['ms', 'vi'] as Market[]).map((m) => (
              <button key={m} onClick={() => set({ lang: m })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${draft.lang === m ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-black/10 bg-white text-gray-600 hover:bg-gray-50'}`}>
                {langDisplayName(m)}{m === 'ms' ? ' (chính)' : ' (phụ)'}
              </button>
            ))}
          </div>
        </div>

        {/* Sản phẩm */}
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <label className="mb-2 block text-xs font-semibold text-gray-700">Sản phẩm chính</label>
          {products.length === 0 ? (
            <p className="text-xs text-gray-500">Chưa có sản phẩm trong bank. Thêm ở mục “Sản phẩm”.</p>
          ) : (
            <select value={draft.productId ?? ''} onChange={(e) => set({ productId: e.target.value || null })}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800">
              <option value="">— Chọn sản phẩm —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
            </select>
          )}
          {selectedProduct && (
            <div className="mt-3 flex gap-1.5">
              {productImages.slice(0, 4).map((ref) => (
                <div key={ref} className="h-12 w-12 overflow-hidden rounded-md border border-black/10 bg-gray-50"><AssetImg refId={ref} alt="ảnh sản phẩm" /></div>
              ))}
              {productImages.length === 0 && <p className="text-[11px] text-amber-600">Sản phẩm này chưa có ảnh tham chiếu.</p>}
            </div>
          )}
        </div>

        {/* Bảng giá */}
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Bảng giá combo (nhập tay)</label>
            <span className="text-[10px] text-gray-400">giá gốc + JIMAT app tự tính</span>
          </div>
          <p className="mb-2 text-[10px] text-gray-400">Mỗi dòng = 1 mốc. “Tặng” là thêm chính sản phẩm này (không phải quà khác).</p>
          <div className="space-y-2">
            {draft.rows.map((r, i) => {
              const p = computeTierPricing({ buyMainQty: r.buy, freeMainQty: Math.max(0, r.free), giftQty: 0, price: r.price }, null)
              return (
                <div key={i} className="rounded-lg border border-black/10 bg-gray-50 p-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-gray-500">mua</span>
                    <input type="number" min={1} value={r.buy} onChange={(e) => setRow(i, { buy: Math.max(1, Math.round(+e.target.value)) })} className={`${numInput} w-14`} />
                    <span className="text-gray-500">tặng</span>
                    <input type="number" min={0} value={r.free} onChange={(e) => setRow(i, { free: Math.max(0, Math.round(+e.target.value)) })} className={`${numInput} w-14`} />
                    <span className="text-gray-500">= RM</span>
                    <input type="number" min={0} value={r.price || ''} onChange={(e) => setRow(i, { price: Math.max(0, Math.round(+e.target.value)) })} placeholder="0" className={`${numInput} w-20`} />
                    <button onClick={() => delRow(i)} title="Xoá dòng" className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                    <span className="text-gray-500">ship</span>
                    <input type="text" value={r.ship} onChange={(e) => setRow(i, { ship: e.target.value })} placeholder="FREESHIP / +RM6 Shipping" className={`${numInput} flex-1`} />
                  </div>
                  {r.price > 0 && p.jimat > 0 && (
                    <div className="mt-1 text-[10px] text-emerald-600">{L.mainDealLabel(r.buy, Math.max(0, r.free))} · {L.savingsLabel(p.jimat)} (gốc RM{p.originalPrice})</div>
                  )}
                </div>
              )
            })}
          </div>
          {draft.rows.length < MAX_GIFT_TIERS && (
            <button onClick={addRow} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-black/20 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
              <Plus className="h-3.5 w-3.5" /> Thêm mốc
            </button>
          )}
        </div>

        {!ready && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertCircle className="h-3.5 w-3.5" /> Cần bổ sung:</div>
            <ul className="space-y-0.5 text-[11px] text-amber-700">{missing.map((m) => <li key={m}>• {m}</li>)}</ul>
          </div>
        )}

        <button onClick={handleGenerate} disabled={!ready || busy}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${ready && !busy ? 'bg-rose-500 text-white hover:bg-rose-600' : 'cursor-not-allowed bg-gray-200 text-gray-400'}`}>
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? 'Đang tạo ảnh combo…' : 'Tạo ảnh Combo giá'}
        </button>
      </div>

      {/* ── Output ── */}
      <div className="min-w-0 flex-1">
        <div className="mx-auto flex max-w-[420px] flex-col overflow-hidden rounded-xl border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
            <div>
              <div className="text-xs font-semibold text-gray-800">Combo giá</div>
              <div className="text-[10px] text-gray-400">Poster combo 9:16 · chỉ sản phẩm chính, không quà</div>
            </div>
            {status === 'completed' && resultUrl && (
              <button onClick={handleDownload} title="Tải ảnh" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><Download className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <div className="relative aspect-[2/3] w-full bg-gray-50">
            {status === 'generating' ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400"><RefreshCw className="h-6 w-6 animate-spin" /><span className="text-xs">Đang tạo…</span></div>
            ) : status === 'failed' ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-red-400"><AlertCircle className="h-6 w-6" /><span className="text-[11px]">{error ?? 'Lỗi'}</span></div>
            ) : resultUrl ? (
              <img src={resultUrl} alt="Combo giá" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-300"><Tag className="h-8 w-8" /><span className="text-xs">Chưa có ảnh — điền bảng giá rồi bấm Tạo</span></div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
