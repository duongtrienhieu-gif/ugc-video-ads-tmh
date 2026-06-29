// ── MKT Agent — UI (P1, Mô hình A) ───────────────────────────────────────────
// Stage 0: Research tìm SP win GENERIC sourceable (MY) + lọc branded/generic +
// link kiểm chứng (free) + Soi sâu (video/ads/1688). Xem MKT_AGENT_SPEC.md.
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useMktAgentStore, type CheckpointMode, type SpCandidate } from './store'
import { scanWinningProducts } from './services/researchStage'
import { classifyBranding } from './services/brandingFilter'
import { buildVerifyLinks, deepDive, searchKeyword } from './services/enrichStage'

const MODE_OPTS: { key: CheckpointMode; label: string }[] = [
  { key: 'every', label: '🔴 Duyệt mọi bước (debug)' },
  { key: 'key',   label: '🟡 Duyệt 3 chốt chính' },
  { key: 'auto',  label: '🟢 Tự động' },
]

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))
const compact = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n)

function verdictOf(c: SpCandidate): { label: string; cls: string } {
  if (c.isBranded === true) return { label: '🔴 BRANDED · bỏ', cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/40' }
  if (c.isBranded === false) {
    if (c.sale >= 50000) return { label: '🟢 TEST ĐƯỢC', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' }
    if (c.sale >= 5000)  return { label: '🟡 TEST · cầu vừa', cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/40' }
    return { label: '⚪ generic · cầu yếu', cls: 'bg-zinc-700/40 text-zinc-300 border border-zinc-600/40' }
  }
  return { label: '⚪ chưa lọc', cls: 'bg-zinc-700/40 text-zinc-400 border border-zinc-600/40' }
}

function shipHint(s?: string): { label: string; cls: string } | null {
  if (!s) return null
  const local = /\b(MY|malaysia|kuala|selangor|johor)\b/i.test(s)
  return local
    ? { label: '📦 nội địa', cls: 'text-emerald-400' }
    : { label: '✈️ cross-border', cls: 'text-amber-400' }
}

function LinkBtn({ href, label, title }: { href: string; label: string; title: string }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title}
      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 border border-zinc-700">
      {label}
    </a>
  )
}

export default function MktAgent() {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const {
    checkpointMode, niches, amount, scanning, classifying, error, candidates, onlyGeneric, selectedSp,
    setCheckpointMode, setNiches, setAmount, setScanning, setClassifying, setError,
    setCandidates, setBranding, patchCandidate, setOnlyGeneric, selectSp,
  } = useMktAgentStore()

  const scan = async () => {
    setScanning(true); setError(null); selectSp(null); setCandidates([])
    try {
      const res = await scanWinningProducts(niches.split(','), amount)
      setCandidates(res.candidates)
      if (!res.candidates.length) { setError('Không tìm thấy SP — thử đổi/thêm ngách.'); return }
      if (!geminiApiKey) { setError('Có SP rồi — nhưng cần Gemini key (Cài đặt) để lọc branded/generic.'); return }
      setClassifying(true)
      try {
        const map = await classifyBranding(geminiApiKey, res.candidates.map((c) => ({ id: c.productId, title: c.title })))
        setBranding(map)
      } catch {
        setError('Quét xong nhưng lọc branded lỗi (thử lại). Vẫn xem được danh sách thô.')
      } finally {
        setClassifying(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setScanning(false)
    }
  }

  const runDeep = async (c: SpCandidate) => {
    patchCandidate(c.productId, { diving: true, deepError: undefined })
    try {
      const deep = await deepDive(c)
      patchCandidate(c.productId, { deep, diving: false })
    } catch (e) {
      patchCandidate(c.productId, { diving: false, deepError: (e as Error).message })
    }
  }

  const genericCount = candidates.filter((c) => c.isBranded === false).length
  const brandedCount = candidates.filter((c) => c.isBranded === true).length
  const shown = onlyGeneric ? candidates.filter((c) => c.isBranded !== true) : candidates

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-medium text-amber-400">🤖 MKT Agent</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            Tìm <b className="text-zinc-200">SP win GENERIC</b> (clone-test được, sẵn 1688) + kiểm chứng đa nền tảng.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-zinc-400">
          Chế độ duyệt
          <select value={checkpointMode} onChange={(e) => setCheckpointMode(e.target.value as CheckpointMode)}
            className="bg-zinc-900 border border-amber-500/50 rounded-md px-2.5 py-1.5 text-amber-300 text-[13px]">
            {MODE_OPTS.map((o) => (
              <option key={o.key} value={o.key} style={{ background: '#0a0a0a', color: '#fcd34d' }}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-amber-400 font-medium">Giai đoạn 0 · Quét SP win (Malaysia)</span>
          <span className="text-[11px] text-zinc-500">lọc branded/generic · link kiểm chứng free · Soi sâu video/ads/1688</span>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="text-[13px] text-zinc-400">
            Ngách (cách nhau dấu phẩy — tiếng Malay)
            <input value={niches} onChange={(e) => setNiches(e.target.value)}
              placeholder="minyak urut, sakit sendi, jerawat..."
              className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm" />
          </label>
          <label className="text-[13px] text-zinc-400">
            SP/ngách
            <input type="number" min={5} max={50} value={amount}
              onChange={(e) => setAmount(Math.max(5, Math.min(50, Number(e.target.value) || 30)))}
              className="mt-1 w-24 bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100 text-sm" />
          </label>
          <button onClick={scan} disabled={scanning || classifying}
            className="h-[42px] px-5 rounded-md font-medium bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:bg-amber-500 disabled:cursor-wait">
            {scanning ? 'Đang quét…' : classifying ? 'Đang lọc…' : '⚡ Quét MY'}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-[13px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">{error}</div>
        )}

        {candidates.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <p className="text-[12px] text-zinc-500">
                {candidates.length} SP · {classifying ? 'đang lọc branded…' : <><span className="text-emerald-400">{genericCount} generic</span> · <span className="text-rose-400">{brandedCount} branded</span></>} · sort theo số bán
              </p>
              <label className="flex items-center gap-1.5 text-[12px] text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={onlyGeneric} onChange={(e) => setOnlyGeneric(e.target.checked)} />
                Chỉ hiện generic (ẩn branded)
              </label>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => {
                const v = verdictOf(p)
                const ship = shipHint(p.shipFrom)
                const picked = selectedSp?.productId === p.productId
                const links = buildVerifyLinks(p)
                return (
                  <div key={p.productId}
                    className={`rounded-lg border bg-zinc-950 p-3 flex flex-col gap-2 ${picked ? 'border-amber-500' : 'border-zinc-800'}`}>
                    <div className="flex gap-3">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" className="w-16 h-16 rounded-md object-cover bg-zinc-800 shrink-0" loading="lazy" />
                        : <div className="w-16 h-16 rounded-md bg-zinc-800 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-[13px] text-zinc-100 line-clamp-2">{p.title}</p>
                        <p className="text-[11px] text-zinc-500 mt-1 truncate">
                          {p.seller || '—'}{p.brand ? ` · brand: ${p.brand}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[12px]">
                      <span className={`px-2 py-0.5 rounded ${v.cls}`}>{v.label}</span>
                      {ship && <span className={`text-[11px] ${ship.cls}`}>{ship.label}</span>}
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-zinc-400">
                      <span>{fmt(p.sale)} bán{p.rating ? ` · ⭐${p.rating.toFixed(1)}` : ''}</span>
                      <span>{p.price > 0 ? `RM${fmt(p.price)}` : 'giá —'}{p.revenue > 0 ? ` · DT RM${fmt(p.revenue)}` : ''}</span>
                    </div>

                    {/* Link kiểm chứng (free) */}
                    <div className="flex flex-wrap gap-1.5">
                      <LinkBtn href={links.tiktokShop} label="🛒 TikTok" title="Xem trên TikTok Shop / search" />
                      <LinkBtn href={links.googleLens} label="🔍 Lens" title="Google Lens reverse-image (1688/web/branding)" />
                      <LinkBtn href={links.fbAds} label="📣 FB Ads" title="FB Ad Library — đối thủ chạy ads?" />
                      <LinkBtn href={links.tiktokVideo} label="🎬 Video" title="Search video TikTok" />
                    </div>

                    {/* Mở app NỘI BỘ + tự điền SP */}
                    <div className="flex flex-wrap gap-1.5">
                      <button title="Mở Spy Ads + tự search ad đối thủ"
                        onClick={() => sendToApp({ targetApp: 'spy-ads', targetField: 'query', data: searchKeyword(p) })}
                        className="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-[11px] text-sky-300 border border-sky-500/40">📣 Spy Ads</button>
                      <button title="Mở Tìm nguồn 1688 + tự điền ảnh SP"
                        onClick={() => sendToApp({ targetApp: 'research', targetField: 'source', data: { name: p.title, imageUrl: p.imageUrl } })}
                        className="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-[11px] text-sky-300 border border-sky-500/40">🏭 Tìm nguồn</button>
                      <button title="Mở Research + quét ngách SP này"
                        onClick={() => sendToApp({ targetApp: 'research', targetField: 'niche', data: searchKeyword(p) })}
                        className="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-[11px] text-sky-300 border border-sky-500/40">📊 Research</button>
                    </div>

                    {/* Soi sâu */}
                    {p.deep ? (
                      <div className="text-[11px] text-zinc-300 bg-zinc-900 rounded-md px-2 py-1.5 space-y-0.5">
                        <div>🎬 {p.deep.videoCount} video{p.deep.maxViews > 0 ? ` · ${compact(p.deep.maxViews)} view` : ''}</div>
                        <div>📣 {p.deep.adCount} ads{p.deep.adTopDays > 0 ? ` · chạy ${p.deep.adTopDays}d` : ''}{p.deep.adTopScale > 1 ? ` · x${p.deep.adTopScale} biến thể` : ''}</div>
                        <div>
                          🏭 1688: {p.deep.on1688
                            ? <>✓ {p.deep.count1688} khớp{p.deep.cost1688 ? ` · từ ¥${p.deep.cost1688}` : ''}{p.deep.link1688 ? <> · <a href={p.deep.link1688} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">xem</a></> : ''}</>
                            : <span className="text-amber-400">✗ không khớp ảnh</span>}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => runDeep(p)} disabled={p.diving}
                        className="h-7 rounded-md text-[12px] bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50">
                        {p.diving ? 'Đang soi…' : '🔬 Soi sâu (video·ads·1688 — quota API ngoài)'}
                      </button>
                    )}
                    {p.deepError && <p className="text-[11px] text-rose-400">Soi sâu lỗi: {p.deepError}</p>}

                    <button onClick={() => selectSp(picked ? null : p)}
                      className={`h-8 rounded-md text-[13px] font-medium ${picked ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}>
                      {picked ? '✓ Đã chọn' : 'Chọn SP này'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {selectedSp && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-[13px] text-amber-300">✅ Đã chọn: <b>{selectedSp.title}</b></p>
          <p className="text-[12px] text-zinc-400 mt-1">
            Bước tới: Brief → Kịch bản → Video → Landing (theo checkpoint cheap→expensive).
          </p>
        </div>
      )}
    </div>
  )
}
