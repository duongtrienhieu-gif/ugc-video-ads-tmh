// Research — entry component (P1, data mẫu).
// Header (market + thời gian + preset) | FilterPanel | lưới thẻ cơ hội | drawer chi tiết.
import { useEffect, useState } from 'react'
import { Search, Sparkles, X } from 'lucide-react'
import { useResearchStore } from './store'
import { useWatchlistStore } from './watchlistStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { directGeminiText } from '../../utils/gemini'
import { MARKETS, PRESETS, NICHE_PRESETS, MARKET_CURRENCY } from './constants'
import OpportunityCard from './components/OpportunityCard'
import FilterPanel from './components/FilterPanel'
import ProductDetail from './components/ProductDetail'
import ShopList from './components/ShopList'
import CrossMarketPanel from './components/CrossMarketPanel'
import WatchlistPanel from './components/WatchlistPanel'
import SourceFinder from './components/SourceFinder'
import type { Market, ScoredProduct } from './types'

const MARKET_LANG: Record<string, string> = { MY: 'Malay', ID: 'Indonesia', VN: 'Việt', TH: 'Thái', PH: 'English/Tagalog' }

const segCls = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
    active ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:text-slate-700'
  }`

export default function Research() {
  const { market, setMarket, activePreset, applyPreset, getScored, selectedId, select, getSelected, realProducts } = useResearchStore()
  const { isLive, scanning, scanError, scanCredits, scanKeywords, setScanKeywords, scanLive } = useResearchStore()
  const { scanNiche, setScanNiche } = useResearchStore()
  const { scanCross, clearCross, crossData, crossLoading, crossError, crossQuery } = useResearchStore()
  const watchItems = useWatchlistStore((s) => s.items)
  const loadWatch = useWatchlistStore((s) => s.load)
  const removeWatch = useWatchlistStore((s) => s.remove)
  const updateWatch = useWatchlistStore((s) => s.update)
  const [view, setView] = useState<'products' | 'shops'>('products')
  const [showWatch, setShowWatch] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const [sourceInit, setSourceInit] = useState<{ name: string; imageUrl?: string } | null>(null)
  const openSource = (p?: ScoredProduct) => { setSourceInit(p ? { name: p.title, imageUrl: p.imageUrl } : null); setShowSource(true) }
  const activeNichePreset = NICHE_PRESETS.find((n) => n.label === scanNiche)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const scored = getScored()
  const selected = getSelected()

  // AI Bản tin phiên quét: đọc top SP đã chấm điểm → chọn SP nên đánh hôm nay + lý do.
  const [brief, setBrief] = useState<string | null>(null)
  const [briefBusy, setBriefBusy] = useState(false)
  const runBrief = async () => {
    if (!geminiApiKey) { setBrief('⚠️ Cần Gemini API key trong Cài đặt.'); return }
    if (!scored.length) return
    setBriefBusy(true)
    try {
      const cur = MARKET_CURRENCY[market] ?? ''
      const list = scored.slice(0, 15).map((p, i) =>
        `${i + 1}. ${p.title.slice(0, 60)} — ${p.sale.toLocaleString('vi-VN')} bán · ${cur}${p.unitPrice} · ${p.rating || '—'}★ · điểm ${p.score}${p.isTracked ? ` · +${p.growthRate}%/ngày` : ''}`,
      ).join('\n')
      const prompt = `Bạn là chuyên gia COD chọn SP để TEST ADS hôm nay ở thị trường ${market}. Dưới đây là SP đang bán chạy trên TikTok Shop (đã chấm điểm). Chọn 3 SP ĐÁNG TEST NHẤT, mỗi SP 1 dòng: tên ngắn — vì sao đáng đánh (nhu cầu/biên/đối thủ), gạch đầu dòng. Cuối thêm 1 dòng "Lưu ý" nếu thấy rủi ro. Tiếng Việt, ngắn gọn, thực chiến.
DANH SÁCH:
${list}`
      const raw = await directGeminiText({ apiKey: geminiApiKey, prompt, responseMimeType: 'text/plain', temperature: 0.5 })
      setBrief(raw.trim())
    } catch (e) {
      setBrief('Lỗi AI: ' + ((e as Error).message || '').slice(0, 80))
    } finally {
      setBriefBusy(false)
    }
  }

  useEffect(() => { void loadWatch() }, [loadWatch])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#EEEEF2]">
      {/* Header */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-black/10 bg-white px-5 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Search className="h-4 w-4 text-violet-600" />
            </div>
            <h1 className="text-base font-bold text-slate-800">Research</h1>
            {realProducts && realProducts.length > 0 ? (
              <span
                className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600"
                title="Data LIVE từ TikTok Shop (ScrapeCreators) theo thị trường + từ khóa. Chấm điểm theo SỐ ĐÃ BÁN."
              >
                ✓ {realProducts.length} SP · TikTok Shop LIVE
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                Chọn ngách hoặc gõ từ khóa → bấm Quét
              </span>
            )}
            {activeNichePreset && (
              <span
                className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
                title="Ngách đang quét"
              >
                {activeNichePreset.emoji} {activeNichePreset.label}
              </span>
            )}
          </div>

          {/* Ô chọn đưa ra GIỮA để không bị badge Gemini/Credit (góc phải) che */}
          <div className="flex items-center justify-self-center gap-2">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as Market)}
              className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-medium"
            >
              {MARKETS.map((m) => (
                <option key={m.key} value={m.key}>{m.flag} {m.label}</option>
              ))}
            </select>
            {!isLive && (
              <select className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-medium" defaultValue="30">
                <option value="7">7 ngày</option>
                <option value="30">30 ngày</option>
                <option value="90">90 ngày</option>
              </select>
            )}
          </div>

          <div aria-hidden />
        </div>

        {/* Quét LIVE — chọn NGÁCH (tự điền từ khóa + quét) hoặc gõ từ khóa tùy chỉnh */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scanNiche}
            onChange={(e) => {
              const preset = NICHE_PRESETS.find((n) => n.label === e.target.value)
              if (!preset) { setScanNiche(''); return }
              setScanNiche(preset.label)
              setScanKeywords(preset.keywords.join(', '))
              void scanLive()
            }}
            disabled={scanning}
            className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-medium disabled:opacity-50"
            title="Chọn ngách → tự điền từ khóa + quét ngay"
          >
            <option value="">⚡ Chọn ngách → quét ngay</option>
            {NICHE_PRESETS.map((n) => (
              <option key={n.label} value={n.label}>{n.emoji} {n.label}</option>
            ))}
          </select>
          <input
            value={scanKeywords}
            onChange={(e) => { setScanKeywords(e.target.value); setScanNiche('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') void scanLive() }}
            placeholder={`hoặc gõ từ khóa (tiếng ${MARKET_LANG[market] ?? ''}) — vd: garam bawang, suplemen...`}
            className="min-w-[220px] flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => void scanLive()}
            disabled={scanning}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {scanning ? 'Đang quét…' : '🔎 Quét'}
          </button>
          <button
            onClick={() => void scanCross((scanKeywords.split(',')[0] || '').trim())}
            disabled={crossLoading || scanning}
            className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
            title="So từ khóa đầu tiên giữa 5 thị trường (MY/ID/TH/VN/PH)"
          >
            {crossLoading ? '🌏 Đang so…' : '🌏 So 5 nước'}
          </button>
          {scanCredits != null && <span className="text-xs text-slate-400">credit: {scanCredits}</span>}
          {scanError && <span className="text-xs text-red-500">{scanError}</span>}
          {crossError && <span className="text-xs text-red-500">{crossError}</span>}
        </div>

        {/* Preset chọn nhanh — chỉ ở chế độ data Kalodata (không live) */}
        {!isLive && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Chọn nhanh:</span>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  activePreset === p.key
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-black/10 bg-white text-slate-600 hover:bg-black/[0.02]'
                }`}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <FilterPanel />

        <main className="flex-1 overflow-y-auto p-5">
          {(crossData || crossLoading) && (
            <CrossMarketPanel rows={crossData} query={crossQuery} loading={crossLoading} onClose={clearCross} />
          )}

          {/* Toggle: Sản phẩm / Shop đối thủ / Danh sách Test */}
          <div className="mb-3 flex items-center gap-3">
            {!isLive && !showWatch && (
              <div className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white p-0.5">
                <button onClick={() => setView('products')} className={segCls(view === 'products')}>🛍 Sản phẩm</button>
                <button onClick={() => setView('shops')} className={segCls(view === 'shops')}>🏪 Shop đối thủ</button>
              </div>
            )}
            {!showWatch && view === 'products' && (
              <span className="text-sm font-semibold text-slate-500">{scored.length} cơ hội</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {isLive && !showWatch && scored.length > 0 && (
                <button
                  onClick={() => void runBrief()}
                  disabled={briefBusy}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {briefBusy ? 'Đang tóm tắt…' : '🌅 Bản tin AI'}
                </button>
              )}
              <button
                onClick={() => openSource()}
                className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50"
                title="Tìm nguyên liệu video (clip có SP + cảnh B-roll) cho 1 sản phẩm"
              >
                🎬 Tìm Source
              </button>
              <button
                onClick={() => setShowWatch((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showWatch
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-black/10 bg-white text-slate-600 hover:bg-black/[0.02]'
                }`}
              >
                📌 Danh sách Test ({watchItems.length})
              </button>
            </div>
          </div>

          {/* Bản tin AI — SP nên đánh hôm nay */}
          {brief && !showWatch && (
            <div className="mb-3 rounded-2xl border border-violet-200 bg-violet-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-violet-700"><Sparkles className="h-3.5 w-3.5" /> Bản tin AI — SP nên đánh hôm nay</span>
                <button onClick={() => setBrief(null)} className="rounded-full p-0.5 text-violet-400 hover:bg-violet-100"><X className="h-3.5 w-3.5" /></button>
              </div>
              <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">{brief}</p>
            </div>
          )}

          {showWatch ? (
            <WatchlistPanel
              items={watchItems}
              onOpen={select}
              onRemove={(id) => void removeWatch(id)}
              onUpdate={(id, patch) => void updateWatch(id, patch)}
            />
          ) : view === 'shops' ? (
            <ShopList />
          ) : scored.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 text-center text-slate-400">
              <Search className="h-8 w-8" />
              <p className="text-sm">Chưa có sản phẩm.</p>
              <p className="text-xs">Chọn <b>thị trường</b> + <b>ngách</b> (hoặc gõ từ khóa) rồi bấm <b>🔎 Quét</b> để tìm SP win.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {scored.map((p) => (
                <OpportunityCard key={p.productId} product={p} onOpen={select} />
              ))}
            </div>
          )}
        </main>
      </div>

      {selected && selectedId && <ProductDetail product={selected} onClose={() => select(null)} onFindSource={openSource} />}
      {showSource && <SourceFinder initial={sourceInit} onClose={() => setShowSource(false)} />}
    </div>
  )
}
