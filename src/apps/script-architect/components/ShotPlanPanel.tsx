import { useState, useRef } from 'react'
import { ArrowLeft, RotateCcw, Loader2, Scissors, ArrowDownToLine, Trash2, ChevronUp, ChevronDown, Clapperboard, Film, Sparkles, Search, Play, RefreshCw, X, ImageIcon, Video, AlertTriangle, Plus, Star, Crosshair, Package, Lock, Languages, SlidersHorizontal } from 'lucide-react'
import type { Shot, ShotPlan, ShotBlock, ShotFill, ScriptLanguage, SourceClip, ShotClip, CtaRender, ProductLock1688 } from '../types'
import type { Product } from '../../../stores/types'
import { estimateDuration, DEFAULT_FILL_BY_BLOCK } from '../services/splitIntoShots'
import { renderCtaImage, renderCtaVideo, CTA_IMAGE_CREDITS, CTA_VIDEO_CREDITS } from '../services/renderCtaShot'
import { exportCapcutBundle, type ExportProgress, type ExportCutMode } from '../services/exportBundle'
import { viToZhTerms, hasHan, productImageDataUrl, searchProduct1688, toMsTerms } from '../services/sourceFinding'
import { warmUpFFmpeg } from '../../video-builder/v3/services/ffmpegLoader'
import { useSettingsStore } from '../../../stores/settingsStore'

// ── Co-pilot scene-split table (Phase B / B2) ────────────────────────────
// Controlled: parent owns the ShotPlan and re-persists on every onChange.
// One card per SHOT. The PRIMARY-language line is the big editable line; the
// other language is a smaller gloss underneath. Operator can edit every field,
// change block/fill, merge a shot into the next, split one in two, reorder, or
// delete. The Chinese keyword (zhQuery) is what Source Finder will search on
// Douyin/RED/Kuaishou in B3 — so it's first-class and editable here.

interface ShotPlanPanelProps {
  plan: ShotPlan
  productName: string | null
  /** Full product — needed by B4 CTA render (images + offer + visual brief). */
  product: Product | null
  isBuilding: boolean
  onChange: (plan: ShotPlan) => void
  onRebuild: () => void
  onLanguageChange: (lang: ScriptLanguage) => void
  onBack: () => void
}

const BLOCK_META: Record<ShotBlock, { label: string }> = {
  'van-de':    { label: 'Vấn đề' },
  'noi-dau':   { label: 'Nỗi đau' },
  'san-pham':  { label: 'Sản phẩm' },
  'loi-ich-sp':{ label: 'Lợi ích SP' },
  'thanh-phan':{ label: 'Thành phần' },
  'co-che':    { label: 'Cơ chế' },
  'loi-ich-kh':{ label: '★ Lợi ích KH' },
  'proof':     { label: 'Proof' },
  'cta':       { label: 'CTA' },
}
const BLOCK_ORDER: ShotBlock[] = ['van-de', 'noi-dau', 'san-pham', 'loi-ich-sp', 'thanh-phan', 'co-che', 'loi-ich-kh', 'proof', 'cta']

const FILL_META: Record<ShotFill, { label: string; hint: string; cls: string }> = {
  'source-broad':     { label: 'Source rộng',   hint: 'Clip đời thường / cảm xúc — tìm theo từ khóa triệu chứng (tiếng Trung)', cls: 'bg-sky-100 text-sky-700' },
  'source-product':   { label: 'Source SP',     hint: 'Tìm ĐÚNG clip sản phẩm — khóa ảnh SP qua 1688 rồi tìm theo tên thật',  cls: 'bg-violet-100 text-violet-700' },
  'source-ingredient':{ label: 'Source thành phần', hint: 'Cảnh nhắc nhiều thành phần — mỗi thành phần tìm riêng rồi gộp',     cls: 'bg-teal-100 text-teal-700' },
  'ai-render':        { label: 'AI render',     hint: 'CTA tạo bằng AI (SP + ưu đãi + hộp quà) — không giá', cls: 'bg-amber-100 text-amber-700' },
}

const fmtSec = (n: number) => `~${n}s`

// ── Source clip plumbing (mirrors Research → SourceFinder) ───────────────
type Platform = 'douyin' | 'xhs' | 'kuaishou' | 'tiktok'
// No global priority merge anymore. Each shot picks ONE platform tab at a time
// (RED / Kuaishou / Douyin / TikTok) and searches just that one — so the operator
// judges each platform's quality. Switching tabs keeps the previous platform's
// cached results (lanes are keyed by platform), so no reload. TikTok is the only
// non-Chinese tab: it searches in EN/Malay (auto-generated), not in 中文.
const TIKTOK: Platform = 'tiktok'
const PLATS: { id: Platform; label: string; emoji: string }[] = [
  { id: 'xhs', label: 'RED', emoji: '📕' },
  { id: 'kuaishou', label: 'Kuaishou', emoji: '⚡' },
  { id: 'douyin', label: 'Douyin', emoji: '🎵' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎶' },
]
const platLabel = (p: string) => PLATS.find((x) => x.id === p)?.label ?? p
// How many clips each "Tải thêm" press reveals.
const SOURCE_PAGE = 10
const proxyInline = (url: string) => `/api/dl-video?url=${encodeURIComponent(url)}&inline=1`
const proxyDownload = (url: string, name: string) => {
  const href = `/api/dl-video?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
  const el = document.createElement('a'); el.href = href; el.download = name
  document.body.appendChild(el); el.click(); el.remove()
}
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))
const safeName = (s: string) => (s || 'shot').replace(/[^\w]+/g, '-').slice(0, 24)

// Stable identity for a clip across platforms (same id can exist on two platforms).
const clipKey = (c: { id: string; platform: string }) => `${c.platform}_${c.id}`
// seconds → m:ss.s (one decimal — fine enough for a manual CapCut cut hint).
const mmss = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`
}

// Context passed to the preview popup when the clip is already PICKED — lets the
// operator scrub and stamp an in-point (the 4-5s window out of a long spy clip).
interface TrimCtx {
  shotId: string
  clipId: string
  platform: string
  shotDurationSec: number
  inSec?: number
  outSec?: number
}
interface PreviewState {
  clip: SourceClip
  /** Present only for picked clips → enables the in-point setter. */
  trim?: TrimCtx
}

// Native <select> popups render with the OS default (white) background, which
// makes our light option text invisible on the dark theme. Force readable
// colors on every <option> via theme tokens (works on both dark & studio).
const OPT_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--color-card)',
  color: 'var(--color-text-primary)',
}

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `shot_${crypto.randomUUID().slice(0, 8)}`
  } catch { /* */ }
  return `shot_${Math.round(performance.now())}_${Math.floor(Math.random() * 1e4)}`
}

const matchForFill = (fill: ShotFill): Shot['matchMode'] => (fill === 'source-product' ? 'product-exact' : 'broad')

export default function ShotPlanPanel({
  plan, productName, product, isBuilding, onChange, onRebuild, onLanguageChange, onBack,
}: ShotPlanPanelProps) {
  // Source-clip controls (panel-wide): length filter + the full-screen preview
  // popup. Platform is chosen per-shot (a tab in each ShotSourcePicker), not here.
  const [onlyShort, setOnlyShort] = useState(true)
  const [optsOpen, setOptsOpen] = useState(false) // popover "Tùy chọn" (lọc <60s + cắt khi export)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const [exporting, setExporting] = useState<ExportProgress | null>(null)

  // Hướng B — cắt thật khi export (ffmpeg.wasm trong trình duyệt). Mặc định tắt.
  // Nặng trên điện thoại nên cảnh báo khi màn hình nhỏ (vẫn cho chạy nếu muốn).
  const [cutEnabled, setCutEnabled] = useState(false)
  const [cutMode, setCutMode] = useState<'fast' | 'accurate'>('accurate')
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const effectiveCut: ExportCutMode = cutEnabled ? cutMode : 'none'
  // How many picked clips actually have an in-point → would get pre-cut.
  const cutableCount = plan.shots.reduce(
    (n, s) => n + (s.fill === 'ai-render' ? 0 : (s.clips ?? []).filter((c) => c.inSec != null).length),
    0,
  )
  const enableCut = (on: boolean) => {
    setCutEnabled(on)
    if (on) warmUpFFmpeg() // fetch ~30MB wasm in background while operator tweaks
  }

  // Gemini key (panel-wide) — needed for the VN→ZH keyword translation.
  const geminiKey = useSettingsStore((s) => s.geminiApiKey)

  // ── Product lock (issue 1) — reverse-image the product on 1688 so every
  //    source-product shot searches by the REAL Chinese title, not a guess. ──
  const productZh = plan.productZh ?? null
  const [lockOpen, setLockOpen] = useState(false)
  const [lockBusy, setLockBusy] = useState(false)
  const [lockErr, setLockErr] = useState<string | null>(null)
  const [lockMatches, setLockMatches] = useState<ProductLock1688[] | null>(null)

  const openLock = async () => {
    setLockOpen(true); setLockErr(null)
    // Re-run the reverse-image search every time the modal opens (cheap, and the
    // product image may have changed). Skip if matches are already loaded.
    if (lockMatches) return
    setLockBusy(true)
    try {
      const img = await productImageDataUrl(product)
      if (!img) { setLockErr('Sản phẩm chưa có ảnh trong Kho — thêm ảnh SP để khóa theo hình.'); setLockBusy(false); return }
      const matches = await searchProduct1688(img)
      setLockMatches(matches)
      if (!matches.length) setLockErr('Không tìm thấy SP khớp ảnh trên 1688 — thử ảnh nền sạch hơn.')
    } catch (e) {
      setLockErr(e instanceof Error ? e.message : String(e))
    } finally { setLockBusy(false) }
  }
  const lockProduct = (m: ProductLock1688) => {
    onChange({ ...plan, productZh: m })
    setLockOpen(false)
  }
  const clearLock = () => onChange({ ...plan, productZh: null })

  // How many assets the export would bundle (picked source clips + rendered CTA).
  const exportableCount = plan.shots.reduce(
    (n, s) => n + (s.fill === 'ai-render' ? (s.ctaRender?.videoUrl ? 1 : 0) : (s.clips?.length ?? 0)),
    0,
  )

  const handleExport = async () => {
    if (exporting) return
    setExporting({ done: 0, total: 0, label: 'Chuẩn bị…' })
    try {
      await exportCapcutBundle(plan, product, setExporting, effectiveCut)
      setTimeout(() => setExporting(null), 1800)
    } catch (e) {
      setExporting({ done: 0, total: 0, label: `Lỗi export: ${e instanceof Error ? e.message : String(e)}` })
      setTimeout(() => setExporting(null), 4000)
    }
  }

  const lang = plan.language
  const primaryOf = (s: Shot) => (lang === 'my' ? s.my : s.vi)
  const glossOf   = (s: Shot) => (lang === 'my' ? s.vi : s.my)
  const primaryFlag = lang === 'my' ? '🇲🇾' : '🇻🇳'
  const glossFlag   = lang === 'my' ? '🇻🇳' : '🇲🇾'

  const commit = (shots: Shot[]) =>
    onChange({ ...plan, shots, totalDurationSec: shots.reduce((sum, s) => sum + s.durationSec, 0) })

  const patchShot = (id: string, patch: Partial<Shot>) =>
    commit(plan.shots.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  // Edit primary line → also recompute duration from its word count.
  const editPrimary = (id: string, value: string) =>
    patchShot(id, lang === 'my' ? { my: value, durationSec: estimateDuration(value) } : { vi: value, durationSec: estimateDuration(value) })
  const editGloss = (id: string, value: string) =>
    patchShot(id, lang === 'my' ? { vi: value } : { my: value })

  // Product & ai-render shots carry no search terms (product = 1688 lock; ai = generated).
  const termsForFill = (fill: ShotFill, current: string[]): string[] =>
    (fill === 'ai-render' || fill === 'source-product') ? [] : current

  const changeBlock = (id: string, block: ShotBlock) => {
    const shot = plan.shots.find((s) => s.id === id)
    if (!shot) return
    // CTA is always ai-render (no source); leaving CTA reverts to the block default.
    let fill = shot.fill
    if (block === 'cta') fill = 'ai-render'
    else if (fill === 'ai-render') fill = DEFAULT_FILL_BY_BLOCK[block]
    patchShot(id, { block, fill, matchMode: matchForFill(fill), zhTerms: termsForFill(fill, shot.zhTerms) })
  }

  const changeFill = (id: string, fill: ShotFill) => {
    const shot = plan.shots.find((s) => s.id === id)
    if (!shot) return
    patchShot(id, { fill, matchMode: matchForFill(fill), zhTerms: termsForFill(fill, shot.zhTerms) })
  }

  const setZhTerms = (id: string, zhTerms: string[]) => patchShot(id, { zhTerms })

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= plan.shots.length) return
    const next = [...plan.shots]
    ;[next[index], next[j]] = [next[j], next[index]]
    commit(next)
  }

  // Merge shot[index] into shot[index+1] → one shot. Keep the FIRST shot's
  // block/fill/zhQuery; concatenate the two lines; recompute duration.
  const mergeDown = (index: number) => {
    if (index >= plan.shots.length - 1) return
    const a = plan.shots[index], b = plan.shots[index + 1]
    const my = `${a.my} ${b.my}`.trim()
    const vi = `${a.vi} ${b.vi}`.trim()
    const merged: Shot = {
      ...a,
      my, vi,
      visualIdea: [a.visualIdea, b.visualIdea].filter(Boolean).join(' + '),
      durationSec: estimateDuration(lang === 'my' ? my : vi),
    }
    const next = [...plan.shots]
    next.splice(index, 2, merged)
    commit(next)
  }

  // Split shot[index] in two at the midpoint of its PRIMARY line (word-wise).
  // Both halves inherit block/fill/zhQuery; operator edits afterwards.
  const splitShot = (index: number) => {
    const s = plan.shots[index]
    const splitWords = (txt: string): [string, string] => {
      const w = txt.trim().split(/\s+/).filter(Boolean)
      if (w.length < 2) return [txt, '']
      const mid = Math.ceil(w.length / 2)
      return [w.slice(0, mid).join(' '), w.slice(mid).join(' ')]
    }
    const [myA, myB] = splitWords(s.my)
    const [viA, viB] = splitWords(s.vi)
    const first: Shot  = { ...s, id: genId(), my: myA, vi: viA, durationSec: estimateDuration(lang === 'my' ? myA : viA) }
    const second: Shot = { ...s, id: genId(), my: myB, vi: viB, durationSec: estimateDuration(lang === 'my' ? myB : viB) }
    const next = [...plan.shots]
    next.splice(index, 1, first, second)
    commit(next)
  }

  const removeShot = (id: string) => commit(plan.shots.filter((s) => s.id !== id))

  // ── Multi-clip ops (B3 v3) — a shot can carry several picked clips ─────────
  const clipsOf = (shotId: string) => plan.shots.find((s) => s.id === shotId)?.clips ?? []
  const setClips = (shotId: string, clips: ShotClip[]) => patchShot(shotId, { clips })

  // Add a search result to the shot. First pick = main, the rest = backup.
  const addClip = (shotId: string, c: SourceClip) => {
    const cur = clipsOf(shotId)
    if (cur.some((x) => clipKey(x) === clipKey(c))) return // already picked
    setClips(shotId, [...cur, { ...c, role: cur.length === 0 ? 'main' : 'backup' }])
  }
  const removeClip = (shotId: string, key: string) => {
    let next = clipsOf(shotId).filter((x) => clipKey(x) !== key)
    // Keep exactly one main when clips remain.
    if (next.length && !next.some((x) => x.role === 'main')) {
      next = next.map((x, i) => (i === 0 ? { ...x, role: 'main' } : x))
    }
    setClips(shotId, next)
  }
  const setMainClip = (shotId: string, key: string) =>
    setClips(shotId, clipsOf(shotId).map((x) => ({ ...x, role: clipKey(x) === key ? 'main' : 'backup' })))
  const toggleNeedsReplace = (shotId: string, key: string) =>
    setClips(shotId, clipsOf(shotId).map((x) => (clipKey(x) === key ? { ...x, needsReplace: !x.needsReplace } : x)))
  const setClipTrim = (shotId: string, key: string, inSec: number | undefined, outSec: number | undefined) =>
    setClips(shotId, clipsOf(shotId).map((x) => (clipKey(x) === key ? { ...x, inSec, outSec } : x)))

  // "Đặt điểm bắt đầu tại đây" — stamp the popup video's current time as in-point.
  // out = in + the shot's spoken duration, capped at the clip length. Hint only.
  const stampInPoint = () => {
    if (!preview?.trim) return
    const v = previewVideoRef.current
    if (!v) return
    const t = preview.trim
    const inSec = Math.max(0, Math.round(v.currentTime * 10) / 10)
    const outSec = Math.min(preview.clip.durationSec || inSec + t.shotDurationSec, inSec + t.shotDurationSec)
    setClipTrim(t.shotId, clipKey({ id: t.clipId, platform: t.platform }), inSec, outSec)
    setPreview({ ...preview, trim: { ...t, inSec, outSec } })
  }
  const clearInPoint = () => {
    if (!preview?.trim) return
    const t = preview.trim
    setClipTrim(t.shotId, clipKey({ id: t.clipId, platform: t.platform }), undefined, undefined)
    setPreview({ ...preview, trim: { ...t, inSec: undefined, outSec: undefined } })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-app-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-full border border-app-border bg-app-card px-3 py-1.5 text-xs font-bold text-app-muted hover:bg-app-card-elevated"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kịch bản
          </button>
          <div className="flex items-center gap-1.5">
            <Clapperboard className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            <span className="text-sm font-bold text-app-text">Tách cảnh &amp; Source</span>
            {productName && <span className="hidden text-[11px] text-app-subtle sm:inline">· {productName}</span>}
          </div>

          {/* Product lock — inline với tiêu đề; mọi cảnh "Source SP" tìm theo tên 1688 đã khóa */}
          {productZh ? (
            <div className="flex items-center gap-1.5 rounded-lg border px-2 py-0.5" style={{ borderColor: 'var(--color-accent)' }} title="Sản phẩm nguồn đã khóa — cảnh Source SP tìm theo tên này">
              {productZh.image && <img src={productZh.image} alt="" className="h-5 w-5 rounded object-cover" />}
              <Lock className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
              <span className="max-w-[140px] truncate text-[11px] font-bold text-app-text" title={`${productZh.name}${productZh.nameVi ? ` — ${productZh.nameVi}` : ''}`}>
                {productZh.nameVi || productZh.name}
              </span>
              <button onClick={() => void openLock()} className="rounded p-0.5 text-app-muted hover:bg-app-card-elevated" title="Đổi sản phẩm khóa"><RefreshCw className="h-3 w-3" /></button>
              <button onClick={clearLock} className="rounded p-0.5 text-app-muted hover:bg-rose-500/10 hover:text-rose-500" title="Bỏ khóa"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => void openLock()}
              className="ui-accent-soft flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[11px] font-bold"
              title="Đẩy ảnh SP lên 1688, chọn đúng SP → các cảnh Source SP tìm theo tên thật (chính xác)"
            >
              <Lock className="h-3 w-3" /> Khóa SP nguồn
            </button>
          )}

          {/* Right group */}
          <div className="ml-auto flex items-center gap-2">
            {/* Options popover — gom lọc <60s + cắt khi export cho gọn thanh */}
            <div className="relative">
              <button
                onClick={() => setOptsOpen((o) => !o)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold hover:bg-app-card-elevated ${optsOpen || effectiveCut || !onlyShort ? 'ui-accent-soft border-transparent' : 'border-app-border bg-app-card text-app-muted'}`}
                title="Tùy chọn nguồn clip & cắt khi export"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Tùy chọn
              </button>
              {optsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOptsOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-app-border bg-app-card p-3 text-left shadow-xl">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-app-text" title="Chỉ lấy clip ngắn, hợp cắt ghép">
                      <input type="checkbox" checked={onlyShort} onChange={(e) => setOnlyShort(e.target.checked)} /> ⏱ Chỉ tìm clip &lt;60s
                    </label>
                    <div className="my-2.5 border-t border-app-border" />
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-app-text" title="Cắt sẵn các clip ĐÃ chấm điểm cắt ngay trong trình duyệt (ffmpeg). Clip chưa chấm vẫn giữ full.">
                      <input type="checkbox" checked={cutEnabled} onChange={(e) => enableCut(e.target.checked)} />
                      <Scissors className="h-3 w-3" /> Cắt sẵn khúc đã chọn khi export
                      {cutableCount > 0 && <span className="opacity-60">· {cutableCount} clip</span>}
                    </label>
                    {cutEnabled && (
                      <div className="mt-2 flex items-center gap-0.5 rounded-lg border border-app-border bg-app-card-elevated p-0.5">
                        {([['fast', 'Nhanh'], ['accurate', 'Chuẩn']] as const).map(([m, lbl]) => (
                          <button
                            key={m}
                            onClick={() => setCutMode(m)}
                            className={`flex-1 rounded px-2 py-0.5 text-[11px] font-bold ${cutMode === m ? 'ui-accent-soft' : 'text-app-muted hover:bg-app-card'}`}
                            title={m === 'fast' ? 'Cắt -c copy: rất nhanh nhưng điểm bắt đầu có thể lệch ~1-2s' : 'Re-encode: đúng từng frame, chậm hơn chút (clip ngắn nên vẫn nhanh)'}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    )}
                    {cutEnabled && cutableCount === 0 && (
                      <p className="mt-1.5 text-[10px] text-amber-500">Chưa cảnh nào chấm điểm cắt — bấm ▶ clip đã chọn rồi “Đặt điểm bắt đầu”.</p>
                    )}
                    {cutEnabled && !isDesktop && (
                      <p className="mt-1.5 text-[10px] text-amber-500">⚠ Trên điện thoại có thể chậm/lỗi bộ nhớ — nên cắt trên máy tính.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Primary-language toggle — re-splits on the chosen language */}
            <div className="flex items-center gap-0.5 rounded-lg border border-app-border bg-app-card-elevated p-0.5" title="Ngôn ngữ dòng chính (tách lại theo ngôn ngữ này)">
              {(['my', 'vi'] as ScriptLanguage[]).map((l) => (
                <button
                  key={l}
                  onClick={() => l !== lang && onLanguageChange(l)}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold ${l === lang ? 'ui-accent-soft' : 'text-app-muted hover:bg-app-card'}`}
                >
                  {l === 'my' ? '🇲🇾 MY chính' : '🇻🇳 VN chính'}
                </button>
              ))}
            </div>
            <button
              onClick={onRebuild}
              disabled={isBuilding}
              className="flex items-center gap-1.5 rounded-full border border-app-border bg-app-card px-3 py-1.5 text-xs font-bold text-app-muted hover:bg-app-card-elevated disabled:opacity-40"
            >
              {isBuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Tách lại
            </button>
            <button
              onClick={handleExport}
              disabled={isBuilding || exporting != null || exportableCount === 0}
              className="ui-accent-soft flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-40"
              title={exportableCount === 0 ? 'Chưa có clip/CTA nào để export' : `Đóng gói ${exportableCount} clip + phụ đề cho CapCut`}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              Export CapCut
              {exportableCount > 0 && <span className="opacity-70">· {exportableCount}</span>}
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-app-subtle">
          <span><b className="text-app-muted">{plan.shots.length}</b> cảnh</span>
          <span>· tổng <b className="text-app-muted">{fmtSec(plan.totalDurationSec)}</b></span>
          <span className="hidden sm:inline">· dòng <b>{primaryFlag}</b> = chính, <b>{glossFlag}</b> = phụ · từ khóa source = <b className="text-app-muted">tiếng Trung 🇨🇳</b> <span className="opacity-70">(TikTok: EN/Malay)</span> · mỗi cảnh tự chọn nền 📕⚡🎵🎶</span>
        </div>
      </div>

      {/* Building overlay */}
      {isBuilding && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-app-muted">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--color-accent)' }} />
          <p className="text-sm font-bold text-app-text">Đang tách cảnh…</p>
          <p className="max-w-xs text-xs text-app-subtle">AI đang gom thoại thành các beat hình, gán block + cách lấy clip + từ khóa tiếng Trung.</p>
        </div>
      )}

      {/* Shot list */}
      {!isBuilding && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
            {plan.shots.map((s, i) => (
              <ShotCard
                key={s.id}
                index={i}
                total={plan.shots.length}
                shot={s}
                primaryText={primaryOf(s)}
                glossText={glossOf(s)}
                primaryFlag={primaryFlag}
                glossFlag={glossFlag}
                onEditPrimary={(v) => editPrimary(s.id, v)}
                onEditGloss={(v) => editGloss(s.id, v)}
                onEditVisualIdea={(v) => patchShot(s.id, { visualIdea: v })}
                onSetZhTerms={(t) => setZhTerms(s.id, t)}
                onChangeBlock={(b) => changeBlock(s.id, b)}
                onChangeFill={(f) => changeFill(s.id, f)}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
                onMergeDown={() => mergeDown(i)}
                onSplit={() => splitShot(i)}
                onRemove={() => removeShot(s.id)}
                onlyShort={onlyShort}
                onPlay={setPreview}
                onAddClip={(c) => addClip(s.id, c)}
                onRemoveClip={(key) => removeClip(s.id, key)}
                onSetMainClip={(key) => setMainClip(s.id, key)}
                onToggleNeedsReplace={(key) => toggleNeedsReplace(s.id, key)}
                product={product}
                lang={lang}
                onChangeCta={(r) => patchShot(s.id, { ctaRender: r })}
                productZh={productZh}
                geminiKey={geminiKey}
                onRequestLock={() => void openLock()}
              />
            ))}
          </div>
        </div>
      )}

      {/* Product-lock modal — pick the correct 1688 match to lock */}
      {lockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={() => setLockOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-base" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center gap-2 border-b border-app-border bg-app-card px-4 py-3">
              <Lock className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-app-text">Khóa sản phẩm từ ảnh (1688)</h3>
                <p className="truncate text-[11px] text-app-muted">Chọn đúng sản phẩm → các cảnh “Source SP” tìm theo TÊN THẬT (chính xác hơn từ khóa đoán)</p>
              </div>
              <button onClick={() => setLockOpen(false)} className="ml-auto rounded-full p-1 text-app-muted hover:bg-app-card-elevated"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {lockBusy && <div className="py-10 text-center text-sm text-app-muted">🔍 Đang khớp ảnh sản phẩm trên 1688…</div>}
              {lockErr && !lockBusy && <p className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-xs text-rose-500">{lockErr}</p>}
              {!lockBusy && lockMatches && lockMatches.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {lockMatches.map((m) => (
                    <button
                      key={m.itemId}
                      onClick={() => lockProduct(m)}
                      className={`flex flex-col overflow-hidden rounded-xl border bg-app-card text-left hover:bg-app-card-elevated ${productZh?.itemId === m.itemId ? 'ring-1 ring-accent' : ''}`}
                      style={{ borderColor: productZh?.itemId === m.itemId ? 'var(--color-accent)' : 'var(--color-border)' }}
                    >
                      <div className="aspect-square w-full bg-black/30">
                        {m.image && <img src={m.image} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 p-2">
                        <p className="line-clamp-2 text-[11px] font-bold text-app-text">{m.nameVi || m.name}</p>
                        <p className="line-clamp-1 text-[10px] text-app-subtle" lang="zh">{m.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export progress toast */}
      {exporting && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-card px-4 py-3 shadow-xl">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: 'var(--color-accent)' }} />
            <div className="min-w-[200px]">
              <p className="text-xs font-bold text-app-text">{exporting.label}</p>
              {exporting.total > 0 && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-app-surface">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.round((exporting.done / exporting.total) * 100)}%`, backgroundColor: 'var(--color-accent)' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-screen clip preview (+ in-point setter when the clip is picked) */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-10 right-0 flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" /> Đóng
            </button>
            <video
              ref={previewVideoRef}
              src={proxyInline(preview.clip.videoUrl)}
              poster={preview.clip.platform === 'douyin' ? preview.clip.cover : proxyInline(preview.clip.cover)}
              controls
              autoPlay
              playsInline
              className="max-h-[72vh] w-full rounded-2xl bg-black"
            />

            {/* In-point setter — only for already-picked clips (we know the shot) */}
            {preview.trim && (
              <div className="mt-2 rounded-xl border border-white/15 bg-white/5 p-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/80">
                  <Crosshair className="h-3.5 w-3.5" /> Điểm cắt (chỉ là gợi ý — clip đầy đủ vẫn được tải về)
                </div>
                <p className="mt-1 text-[11px] text-white/70">
                  {preview.trim.inSec != null
                    ? <>Cắt từ <b className="text-white">{mmss(preview.trim.inSec)}</b> → <b className="text-white">{mmss(preview.trim.outSec ?? preview.trim.inSec + preview.trim.shotDurationSec)}</b> <span className="opacity-60">(~{preview.trim.shotDurationSec}s cho cảnh này)</span></>
                    : <span className="opacity-70">Chưa đặt — tua tới khúc cần rồi bấm “Đặt điểm bắt đầu”.</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={stampInPoint}
                    className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/25"
                  >
                    <Crosshair className="h-3 w-3" /> Đặt điểm bắt đầu tại đây
                  </button>
                  {preview.trim.inSec != null && (
                    <button
                      onClick={clearInPoint}
                      className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/20"
                    >
                      <X className="h-3 w-3" /> Xóa điểm cắt
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="line-clamp-1 flex-1 text-xs text-white/70">{preview.clip.desc || preview.clip.author}</p>
              <button
                onClick={() => proxyDownload(preview.clip.videoUrl, `${safeName(preview.clip.author)}-${preview.clip.id}.mp4`)}
                className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" /> Tải
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── One shot card ────────────────────────────────────────────────────────

interface ShotCardProps {
  index: number
  total: number
  shot: Shot
  primaryText: string
  glossText: string
  primaryFlag: string
  glossFlag: string
  onEditPrimary: (v: string) => void
  onEditGloss: (v: string) => void
  onEditVisualIdea: (v: string) => void
  onSetZhTerms: (terms: string[]) => void
  onChangeBlock: (b: ShotBlock) => void
  onChangeFill: (f: ShotFill) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMergeDown: () => void
  onSplit: () => void
  onRemove: () => void
  // Source-clip wiring (B3 v3 — multiple clips per shot)
  onlyShort: boolean
  onPlay: (p: PreviewState) => void
  onAddClip: (c: SourceClip) => void
  onRemoveClip: (key: string) => void
  onSetMainClip: (key: string) => void
  onToggleNeedsReplace: (key: string) => void
  // CTA AI render wiring (B4)
  product: Product | null
  lang: ScriptLanguage
  onChangeCta: (r: CtaRender) => void
  // Product lock (issue 1) + VN→ZH translate (issue 3)
  productZh: ProductLock1688 | null
  geminiKey: string
  onRequestLock: () => void
}

function ShotCard(p: ShotCardProps) {
  const { shot } = p
  const isCta = shot.block === 'cta'
  const isAiRender = shot.fill === 'ai-render'
  const fillMeta = FILL_META[shot.fill]

  return (
    <div
      className="rounded-2xl border bg-app-card p-3 sm:p-3.5"
      style={isAiRender ? { borderColor: 'var(--color-accent)' } : { borderColor: 'var(--color-border)' }}
    >
      {/* Row header: order · duration · block · fill · reorder */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
        >
          {p.index + 1}
        </span>
        <span className="rounded-full bg-app-surface px-2 py-0.5 text-[10px] font-bold text-app-muted">{fmtSec(shot.durationSec)}</span>

        {/* Block select */}
        <select
          value={shot.block}
          onChange={(e) => p.onChangeBlock(e.target.value as ShotBlock)}
          className="rounded-full border border-app-border bg-app-card px-2 py-0.5 text-[10px] font-bold text-app-text outline-none focus:border-app-border-strong"
          title="Khối trong mạch bán hàng"
        >
          {BLOCK_ORDER.map((b) => (
            <option key={b} value={b} style={OPT_STYLE}>{BLOCK_META[b].label}</option>
          ))}
        </select>

        {/* Fill badge / select — CTA is locked to AI render */}
        {isCta ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${fillMeta.cls}`} title={fillMeta.hint}>
            <Sparkles className="h-2.5 w-2.5" /> {fillMeta.label}
          </span>
        ) : (
          <select
            value={shot.fill}
            onChange={(e) => p.onChangeFill(e.target.value as ShotFill)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold outline-none ${fillMeta.cls}`}
            title={fillMeta.hint}
          >
            <option value="source-broad" style={OPT_STYLE}>Source rộng</option>
            <option value="source-product" style={OPT_STYLE}>Source SP</option>
            <option value="source-ingredient" style={OPT_STYLE}>Source thành phần</option>
          </select>
        )}

        {/* Reorder + delete */}
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={p.onMoveUp} disabled={p.index === 0} className="rounded p-1 text-app-muted hover:bg-app-card-elevated disabled:opacity-30" title="Lên"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button onClick={p.onMoveDown} disabled={p.index === p.total - 1} className="rounded p-1 text-app-muted hover:bg-app-card-elevated disabled:opacity-30" title="Xuống"><ChevronDown className="h-3.5 w-3.5" /></button>
          <button onClick={p.onRemove} className="rounded p-1 text-app-muted hover:bg-rose-500/10 hover:text-rose-500" title="Xóa cảnh"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Primary line (big) + gloss (sub) */}
      <div className="flex items-start gap-2">
        <span className="mt-1 text-sm leading-none">{p.primaryFlag}</span>
        <div className="flex-1">
          <textarea
            value={p.primaryText}
            onChange={(e) => p.onEditPrimary(e.target.value)}
            rows={1}
            className="w-full resize-y rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[15px] font-semibold leading-snug text-app-text outline-none focus:border-app-border focus:bg-app-surface"
            placeholder="Lời thoại (dòng chính)"
          />
          <div className="mt-0.5 flex items-start gap-1.5">
            <span className="mt-1 text-[11px] leading-none opacity-70">{p.glossFlag}</span>
            <textarea
              value={p.glossText}
              onChange={(e) => p.onEditGloss(e.target.value)}
              rows={1}
              className="w-full resize-y rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[12px] leading-snug text-app-muted outline-none focus:border-app-border focus:bg-app-surface"
              placeholder="Bản dịch (phụ)"
            />
          </div>
        </div>
      </div>

      {/* Visual idea */}
      <div className="mt-2">
        <label className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1">
          <Film className="h-3 w-3 shrink-0 text-app-subtle" />
          <input
            value={shot.visualIdea}
            onChange={(e) => p.onEditVisualIdea(e.target.value)}
            placeholder="Ý hình — cảnh quay gì"
            className="w-full bg-transparent text-[11px] text-app-text outline-none placeholder:text-app-faint"
          />
        </label>
      </div>

      {/* Search-term editor — varies by fill mode (issues 2, 3, 4) */}
      {isAiRender ? (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-dashed border-app-border bg-app-surface px-2 py-1 text-[11px] text-app-subtle">
          <Sparkles className="h-3 w-3 shrink-0" /> AI render — không cần tìm source
        </div>
      ) : shot.fill === 'source-product' ? (
        <div className="mt-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1.5">
          {p.productZh ? (
            <div className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--color-accent)' }} />
              <span className="text-[11px] text-app-muted">Tìm theo SP đã khóa:</span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-app-text" lang="zh" title={p.productZh.name}>{p.productZh.name}</span>
            </div>
          ) : (
            <button onClick={p.onRequestLock} className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--color-accent)' }}>
              <Lock className="h-3 w-3" /> Khóa SP từ ảnh (1688) để tìm đúng clip sản phẩm
            </button>
          )}
        </div>
      ) : (
        <KeywordEditor terms={shot.zhTerms} geminiKey={p.geminiKey} onSetTerms={p.onSetZhTerms} />
      )}

      {/* Card actions: merge / split */}
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={p.onMergeDown}
          disabled={p.index === p.total - 1}
          className="flex items-center gap-1 rounded-lg border border-app-border bg-app-card px-2 py-1 text-[10px] font-bold text-app-muted hover:bg-app-card-elevated disabled:opacity-30"
          title="Gộp cảnh này với cảnh ngay dưới"
        >
          <ArrowDownToLine className="h-3 w-3" /> Gộp xuống
        </button>
        <button
          onClick={p.onSplit}
          className="flex items-center gap-1 rounded-lg border border-app-border bg-app-card px-2 py-1 text-[10px] font-bold text-app-muted hover:bg-app-card-elevated"
          title="Tách cảnh này làm đôi"
        >
          <Scissors className="h-3 w-3" /> Tách đôi
        </button>
      </div>

      {/* Source section */}
      <div className="mt-2.5 border-t border-app-border pt-2.5">
        {isAiRender ? (
          <CtaRenderPanel
            shot={shot}
            product={p.product}
            lang={p.lang}
            ctaLine={p.primaryText}
            onChangeCta={p.onChangeCta}
          />
        ) : (
          <ShotSourcePicker
            shot={shot}
            productZh={p.productZh}
            onlyShort={p.onlyShort}
            onPlay={p.onPlay}
            onAddClip={p.onAddClip}
            onRemoveClip={p.onRemoveClip}
            onSetMainClip={p.onSetMainClip}
            onToggleNeedsReplace={p.onToggleNeedsReplace}
            onRequestLock={p.onRequestLock}
            geminiKey={p.geminiKey}
          />
        )}
      </div>
    </div>
  )
}

// ── Chinese search-term editor (issues 2, 3, 4) ───────────────────────────
// The shot carries an ARRAY of short Chinese symptom/ingredient terms. The
// operator sees them as removable chips and can add more by typing VIETNAMESE
// (the mandatory VN→ZH bridge: the source platforms search in Chinese) or raw
// Chinese. The picker below searches EACH term separately and merges, so a
// multi-ingredient beat doesn't collapse to one dominant clip.
interface KeywordEditorProps {
  terms: string[]
  geminiKey: string
  onSetTerms: (terms: string[]) => void
}

function KeywordEditor({ terms, geminiKey, onSetTerms }: KeywordEditorProps) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const addUnique = (incoming: string[]) => {
    const next = [...terms]
    for (const t of incoming) {
      const v = t.trim()
      if (v && !next.includes(v)) next.push(v)
    }
    onSetTerms(next)
  }

  const addFromInput = async () => {
    const raw = input.trim()
    if (!raw || busy) return
    setErr(null)
    // Already Chinese → add verbatim. Vietnamese → translate to SHORT ZH terms.
    if (hasHan(raw)) { addUnique([raw]); setInput(''); return }
    if (!geminiKey) { setErr('Cần Google Gemini API key trong Cài đặt để dịch sang tiếng Trung.'); return }
    setBusy(true)
    try {
      const zh = await viToZhTerms(raw, geminiKey)
      if (zh.length) { addUnique(zh); setInput('') }
      else setErr('Không dịch được — thử gõ ngắn gọn hơn (vd: "tai bị ngứa").')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const removeTerm = (i: number) => onSetTerms(terms.filter((_, idx) => idx !== i))

  return (
    <div className="mt-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Search className="h-3 w-3 shrink-0 text-app-subtle" />
        {terms.length === 0 && <span className="text-[10px] text-app-faint">Chưa có từ khóa — gõ tiếng Việt bên dưới để thêm</span>}
        {terms.map((t, i) => (
          <span key={`${t}_${i}`} className="inline-flex items-center gap-1 rounded-full bg-app-card px-2 py-0.5 text-[11px] font-bold text-app-text" lang="zh">
            {t}
            <button onClick={() => removeTerm(i)} className="rounded-full text-app-muted hover:text-rose-500" title="Bỏ từ khóa"><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Languages className="h-3 w-3 shrink-0 text-app-subtle" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addFromInput() } }}
          placeholder="Gõ tiếng Việt (vd: tai bị ngứa) → dịch sang tiếng Trung"
          className="w-full bg-transparent text-[11px] text-app-text outline-none placeholder:text-app-faint"
        />
        <button
          onClick={() => void addFromInput()}
          disabled={busy || !input.trim()}
          className="ui-accent-soft flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold disabled:opacity-40"
          title="Dịch tiếng Việt sang từ khóa tiếng Trung ngắn rồi thêm"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Dịch &amp; thêm
        </button>
      </div>
      {err && <p className="mt-1 text-[10px] text-rose-500">{err}</p>}
    </div>
  )
}

// ── Per-shot source picker (B3) ──────────────────────────────────────────
// Each shot has a 3-platform TAB selector (RED / Kuaishou / Douyin). The operator
// picks ONE platform and searches just it via /api/tikhub-search — searching each
// of the shot's terms separately and merging round-robin so every term (e.g. each
// ingredient) is represented. Switching tabs does NOT refetch: each platform's
// results are cached in `lanes` (keyed by platform) and pagination/shown state is
// per-platform, so the previous platform's results stay put. For source-product
// shots the single "term" is the locked 1688 product title. Falls back to
// visualIdea only if a term list is empty. Results strip = play / pick / download;
// a picked clip is pinned on the shot.

interface TikhubResponse {
  clips: SourceClip[]
  /** Opaque next-page token — STRING (Kuaishou pcursor token, XHS page no., Douyin cursor). */
  cursor?: string
  hasMore?: boolean
  error?: string
  detail?: string
  note?: string
}

interface ShotSourcePickerProps {
  shot: Shot
  /** Locked 1688 product — the query for source-product shots. */
  productZh: ProductLock1688 | null
  onlyShort: boolean
  onPlay: (p: PreviewState) => void
  onAddClip: (c: SourceClip) => void
  onRemoveClip: (key: string) => void
  onSetMainClip: (key: string) => void
  onToggleNeedsReplace: (key: string) => void
  onRequestLock: () => void
  /** Needed to auto-translate source keywords → EN/Malay for the TikTok tab. */
  geminiKey: string
}

// Lane = one (term, platform) search stream. Keyed by the term TEXT (not its
// index) so editing the keyword chips — remove / reorder — never mis-maps cached
// results onto a different keyword. '::' can't appear in a ZH/VN search term.
const laneKey = (term: string, plat: Platform) => `${plat}::${term}`

// Build the result pool for ONE platform: round-robin across terms (so every
// term — e.g. each ingredient — is represented), deduped by clipKey. Per-platform
// now (no cross-platform merge) so each tab shows only its own platform's clips.
function buildPool(terms: string[], lanes: Record<string, SourceClip[]>, plat: Platform): SourceClip[] {
  const perTerm: SourceClip[][] = terms.map((term) => lanes[laneKey(term, plat)] ?? [])
  const pool: SourceClip[] = []
  const seen = new Set<string>()
  let depth = 0
  let more = true
  while (more) {
    more = false
    for (const arr of perTerm) {
      if (depth < arr.length) {
        more = true
        const c = arr[depth]
        const k = clipKey(c)
        if (!seen.has(k)) { seen.add(k); pool.push(c) }
      }
    }
    depth++
  }
  return pool
}

function ShotSourcePicker(p: ShotSourcePickerProps) {
  const { shot } = p
  const isProduct = shot.fill === 'source-product'

  // The Chinese search terms for this shot (Douyin/RED/Kuaishou). Product shots
  // search by the locked 1688 title (one term); other shots search each zhTerm
  // separately. Fall back to visualIdea only when a non-product shot has no terms.
  const zhTermsForShot: string[] = isProduct
    ? (p.productZh ? [p.productZh.name] : [])
    : (shot.zhTerms.length ? shot.zhTerms : (shot.visualIdea.trim() ? [shot.visualIdea.trim()] : []))

  const [plat, setPlat] = useState<Platform>('xhs') // default RED

  // TikTok tab searches in EN/Malay, NOT Chinese — auto-generated from the shot's
  // meaning (zhTerms, else the VN line / locked product). Kept in local state
  // (regenerated per mount, like lanes) so no Shot-type/migration change.
  const [msTerms, setMsTerms] = useState<string[]>([])
  const [msBusy, setMsBusy] = useState(false)
  const [msErr, setMsErr] = useState<string | null>(null)
  // What to feed the MS translator: prefer the distilled zhTerms; for product
  // shots use the readable name; else the VN line / visual idea.
  const msSource: string[] = isProduct
    ? (p.productZh ? [p.productZh.nameVi || p.productZh.name] : [])
    : (shot.zhTerms.length ? shot.zhTerms : (shot.vi.trim() ? [shot.vi.trim()] : (shot.visualIdea.trim() ? [shot.visualIdea.trim()] : [])))

  const genMsTerms = async () => {
    if (msBusy) return
    if (!msSource.length) { setMsErr('Chưa có từ khóa nguồn để tạo từ khóa TikTok.'); return }
    if (!p.geminiKey) { setMsErr('Cần Gemini API key trong Cài đặt để tạo từ khóa EN/Malay.'); return }
    setMsBusy(true); setMsErr(null)
    try {
      const t = await toMsTerms(msSource, p.geminiKey)
      if (t.length) setMsTerms(t)
      else setMsErr('Không tạo được từ khóa — thử lại.')
    } catch (e) {
      setMsErr(e instanceof Error ? e.message : String(e))
    } finally { setMsBusy(false) }
  }

  // Lanes are platform-keyed, so the term list that drives them MUST switch with
  // the tab: TikTok uses the EN/Malay terms, every other tab the Chinese terms.
  // termsFor(pl) lets per-tab counts use the right term set (not the active tab's).
  const termsFor = (pl: Platform): string[] => (pl === TIKTOK ? msTerms : zhTermsForShot)
  const terms: string[] = termsFor(plat)

  // Per-lane fetched clips + pagination (lane = term × platform). The visible
  // pool is derived PER selected platform tab. shown/searched are per-platform so
  // switching tabs keeps each platform's reveal state (no reload).
  const [lanes, setLanes] = useState<Record<string, SourceClip[]>>({})
  const [cursor, setCursor] = useState<Record<string, string | undefined>>({})
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({})
  const [shownByPlat, setShownByPlat] = useState<Record<string, number>>({})
  const [searched, setSearched] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const shown = shownByPlat[plat] ?? 0
  const pool = buildPool(terms, lanes, plat)
  const poolLen = pool.length
  const visible = pool.slice(0, shown)
  const platOpen = !!searched[plat]
  // Only the CURRENT terms' lanes (for THIS platform) count — a removed term's
  // stale lane must not keep the "load more" button alive.
  const anyHasMore = terms.some((term) => hasMore[laneKey(term, plat)])

  const fetchLane = async (term: string, pl: Platform, cur: string | undefined): Promise<TikhubResponse> => {
    const curParam = cur ? `&cursor=${encodeURIComponent(cur)}` : ''
    const url = `/api/tikhub-search?q=${encodeURIComponent(term)}&platform=${pl}&sort=like&maxSec=${p.onlyShort ? 60 : 0}${curParam}`
    const res = await fetch(url)
    return (await res.json()) as TikhubResponse
  }

  // Fetch the next page for EACH term of the SELECTED platform in parallel until
  // that platform's pool holds `target` clips or its lanes are dry, then reveal.
  // reset=true re-searches only THIS platform (other platforms' caches persist).
  const ensureAndShow = async (reset: boolean) => {
    if (terms.length === 0) {
      setErr(isProduct ? 'Chưa khóa SP — bấm "Khóa SP từ ảnh (1688)" ở thanh trên.' : 'Chưa có từ khóa tiếng Trung để tìm.')
      return
    }
    setBusy(true); setErr(null)
    setSearched((s) => ({ ...s, [plat]: true }))
    try {
      const keys = terms.map((term) => ({ term, key: laneKey(term, plat) }))
      let nLanes: Record<string, SourceClip[]> = { ...lanes }
      const nCursor: Record<string, string | undefined> = { ...cursor }
      const nHasMore: Record<string, boolean> = { ...hasMore }
      keys.forEach(({ key }) => {
        // reset clears only this platform's lanes; other platforms untouched.
        if (reset || !nLanes[key]) nLanes[key] = []
        if (reset) { nCursor[key] = undefined; nHasMore[key] = true }
        else if (nHasMore[key] === undefined) nHasMore[key] = true
      })
      const target = (reset ? 0 : shown) + SOURCE_PAGE
      let sawError: string | null = null
      let guard = 0
      while (buildPool(terms, nLanes, plat).length < target && keys.some(({ key }) => nHasMore[key]) && guard < 6) {
        guard++
        const rounds = await Promise.all(
          keys.map(async ({ term, key }) => {
            if (!nHasMore[key]) return null
            try {
              return { key, data: await fetchLane(term, plat, nCursor[key]) }
            } catch (e) {
              return { key, data: { clips: [], error: e instanceof Error ? e.message : String(e) } as TikhubResponse }
            }
          }),
        )
        for (const r of rounds) {
          if (!r) continue
          const { key, data } = r
          if (data.error) { nHasMore[key] = false; sawError = data.detail || data.error || sawError; continue }
          const existing = nLanes[key] ?? []
          const fresh = (Array.isArray(data.clips) ? data.clips : []).filter((c) => !existing.some((x) => x.id === c.id))
          nLanes = { ...nLanes, [key]: [...existing, ...fresh] }
          nCursor[key] = data.cursor
          nHasMore[key] = !!data.hasMore && fresh.length > 0
        }
      }
      setLanes(nLanes); setCursor(nCursor); setHasMore(nHasMore)
      const newPool = buildPool(terms, nLanes, plat)
      setShownByPlat((s) => ({ ...s, [plat]: Math.min(target, newPool.length) }))
      if (newPool.length === 0 && sawError) setErr(sawError)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const search = () => void ensureAndShow(true)
  // Reveal +10 from this platform's pool if hidden clips remain; else fetch more.
  const loadMore = () => {
    if (shown < poolLen) setShownByPlat((s) => ({ ...s, [plat]: Math.min(shown + SOURCE_PAGE, poolLen) }))
    else void ensureAndShow(false)
  }

  // Switch platform tab — pure view change, no refetch (cache stays in lanes).
  // First time onto TikTok, auto-generate its EN/Malay keywords (let AI create).
  const switchPlat = (next: Platform) => {
    if (next === plat) return
    setPlat(next); setErr(null)
    if (next === TIKTOK && msTerms.length === 0 && !msBusy) void genMsTerms()
  }
  // Clip count already cached per platform tab (for the badge) — uses each tab's
  // own term set so the TikTok badge (EN/Malay lanes) counts correctly.
  const platCount = (pl: Platform) => buildPool(termsFor(pl), lanes, pl).length

  const dlName = (shot.zhTerms[0] || shot.visualIdea)
  const picked = shot.clips ?? []
  const pickedKeys = new Set(picked.map(clipKey))

  return (
    <div className="flex flex-col gap-2">
      {/* Picked clips — one row each. Multiple allowed; all ship to CapCut. */}
      {picked.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {picked.map((c) => {
            const k = clipKey(c)
            const isMain = c.role === 'main'
            return (
              <div
                key={k}
                className="flex items-center gap-2 rounded-lg border bg-app-surface p-1.5"
                style={{ borderColor: c.needsReplace ? 'var(--color-amber-500, #f59e0b)' : isMain ? 'var(--color-accent)' : 'var(--color-border)' }}
              >
                <button
                  onClick={() => p.onPlay({ clip: c, trim: { shotId: shot.id, clipId: c.id, platform: c.platform, shotDurationSec: shot.durationSec, inSec: c.inSec, outSec: c.outSec } })}
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/40"
                  title="Xem clip / đặt điểm cắt"
                >
                  {c.cover && (
                    <img
                      src={c.platform === 'douyin' ? c.cover : proxyInline(c.cover)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center"><Play className="h-4 w-4 text-white drop-shadow" /></span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[11px] font-bold text-app-text">
                    {isMain && <span style={{ color: 'var(--color-accent)' }}>★ </span>}
                    {c.desc || c.author || 'Clip đã chọn'}
                  </p>
                  <p className="text-[10px] text-app-subtle">
                    {platLabel(c.platform)} · {fmtK(c.likes)} ♥ · {Math.round(c.durationSec)}s
                    {c.inSec != null && <span style={{ color: 'var(--color-accent)' }}> · ✂ {mmss(c.inSec)}→{mmss(c.outSec ?? c.inSec + shot.durationSec)}</span>}
                    {c.needsReplace && <span className="text-amber-500"> · ⚠ cần thay</span>}
                  </p>
                </div>
                {!isMain && (
                  <button
                    onClick={() => p.onSetMainClip(k)}
                    className="shrink-0 rounded-md p-1.5 text-app-muted hover:bg-app-card-elevated"
                    title="Đặt làm clip chính (★)"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => p.onToggleNeedsReplace(k)}
                  className={`shrink-0 rounded-md p-1.5 hover:bg-app-card-elevated ${c.needsReplace ? 'text-amber-500' : 'text-app-muted'}`}
                  title='Đánh dấu "cần thay" (pick tạm, cần clip tốt hơn)'
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => proxyDownload(c.videoUrl, `${safeName(dlName)}-${c.id}.mp4`)}
                  className="shrink-0 rounded-md p-1.5 text-app-muted hover:bg-app-card-elevated"
                  title="Tải clip"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => p.onRemoveClip(k)}
                  className="shrink-0 rounded-md p-1.5 text-app-muted hover:bg-rose-500/10 hover:text-rose-500"
                  title="Bỏ clip này"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Product shot with no lock yet → can't search; point to the lock CTA. */}
      {isProduct && !p.productZh ? (
        <button
          onClick={p.onRequestLock}
          className="ui-accent-soft flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1 text-[11px] font-bold"
          title="Khóa ảnh sản phẩm trên 1688 để tìm đúng clip của SP"
        >
          <Lock className="h-3 w-3" /> Khóa SP từ ảnh (1688) để tìm clip
        </button>
      ) : (
        <>
          {/* Platform tabs — pick ONE platform & search just it. Switching tabs
              keeps each platform's cached results (no reload). */}
          <div className="flex flex-wrap items-center gap-1">
            {PLATS.map((pl) => {
              const n = platCount(pl.id)
              const active = pl.id === plat
              return (
                <button
                  key={pl.id}
                  onClick={() => switchPlat(pl.id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? 'ui-accent-soft' : 'border border-app-border bg-app-card text-app-muted hover:bg-app-card-elevated'}`}
                  title={`Tìm trên ${pl.label}`}
                >
                  {pl.emoji} {pl.label}
                  {n > 0 && <span className="opacity-60">· {n}</span>}
                </button>
              )
            })}
          </div>

          {/* Search trigger — searches the SELECTED platform only. */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={search}
              disabled={busy || msBusy || terms.length === 0}
              className="ui-accent-soft flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
              title={terms.length ? `Tìm trên ${platLabel(plat)}: ${terms.join(' · ')}` : 'Chưa có từ khóa'}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : platOpen ? <RefreshCw className="h-3 w-3" /> : <Search className="h-3 w-3" />}
              {platOpen ? `Tìm lại trên ${platLabel(plat)}` : `Tìm clip trên ${platLabel(plat)}`}
            </button>
            {plat === TIKTOK ? (
              msBusy ? (
                <span className="flex items-center gap-1 text-[10px] text-app-subtle"><Loader2 className="h-3 w-3 animate-spin" /> Đang tạo từ khóa EN/Malay…</span>
              ) : terms.length > 0 ? (
                <span className="flex min-w-0 items-center gap-1 text-[10px] text-app-subtle">
                  <span className="line-clamp-1">🇲🇾/EN {terms.join(' · ')}</span>
                  <button onClick={() => void genMsTerms()} className="shrink-0 rounded p-0.5 text-app-muted hover:bg-app-card-elevated" title="Tạo lại từ khóa TikTok"><RefreshCw className="h-2.5 w-2.5" /></button>
                </span>
              ) : (
                <button onClick={() => void genMsTerms()} className="flex items-center gap-1 rounded text-[10px] font-bold" style={{ color: 'var(--color-accent)' }}>
                  <Languages className="h-3 w-3" /> Tạo từ khóa EN/Malay
                </button>
              )
            ) : terms.length > 0 && (
              <span className="line-clamp-1 text-[10px] text-app-subtle">
                🇨🇳 {terms.join(' · ')}{terms.length > 1 ? ` · ${terms.length} từ khóa` : ''}
              </span>
            )}
          </div>
          {plat === TIKTOK && msErr && <p className="text-[10px] text-rose-500">{msErr}</p>}
        </>
      )}

      {err && <p className="text-[10px] text-rose-500">{err}</p>}

      {/* Results strip (for the selected platform) */}
      {platOpen && !busy && !err && poolLen === 0 && (
        <p className="text-[10px] text-app-subtle">Không tìm thấy clip trên {platLabel(plat)}. Thử nền khác hoặc đổi từ khóa.</p>
      )}
      {platOpen && visible.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visible.map((c) => {
            const isPicked = pickedKeys.has(clipKey(c))
            return (
              <div key={`${c.platform}_${c.id}`} className="w-28 shrink-0">
                <button
                  onClick={() => p.onPlay({ clip: c })}
                  className="relative block aspect-[9/16] w-full overflow-hidden rounded-lg bg-black/40"
                  title="Xem trước"
                >
                  {c.cover && (
                    <img
                      src={c.platform === 'douyin' ? c.cover : proxyInline(c.cover)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center"><Play className="h-5 w-5 text-white drop-shadow" /></span>
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{platLabel(c.platform)}</span>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{Math.round(c.durationSec)}s · {fmtK(c.likes)}♥</span>
                </button>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    onClick={() => (isPicked ? p.onRemoveClip(clipKey(c)) : p.onAddClip(c))}
                    className={`flex flex-1 items-center justify-center gap-0.5 rounded px-1.5 py-1 text-[10px] font-bold ${isPicked ? 'bg-emerald-500/15 text-emerald-500' : 'ui-accent-soft'}`}
                  >
                    {isPicked ? '✓ Đã thêm' : <><Plus className="h-2.5 w-2.5" /> Thêm</>}
                  </button>
                  <button
                    onClick={() => proxyDownload(c.videoUrl, `${safeName(dlName)}-${c.id}.mp4`)}
                    className="rounded p-1 text-app-muted hover:bg-app-card-elevated"
                    title="Tải"
                  >
                    <ArrowDownToLine className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more — reveals +10 each press (fetches next pages when pool runs out) */}
      {platOpen && visible.length > 0 && (shown < poolLen || anyHasMore) && (
        <button
          onClick={loadMore}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 self-start rounded-lg border border-app-border bg-app-card px-2.5 py-1 text-[11px] font-bold text-app-muted hover:bg-app-card-elevated disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />}
          Tải thêm 10 video
          <span className="opacity-60">· đang xem {visible.length}</span>
        </button>
      )}
    </div>
  )
}

// ── CTA AI render panel (B4) ──────────────────────────────────────────────
// Only the single ai-render (CTA) shot uses this. Two-step, credit-aware:
//   1) Tạo ảnh CTA  — gpt-4o-image still (product-locked + offer badge + closed
//      mystery gift box, NO price). Operator approves the look.
//   2) Làm động → video — Seedance i2v animates that still into a 9:16 clip.
// The offer text defaults to the product's bank offer and is editable. Rendered
// asset URLs are pinned on the shot (shot.ctaRender) so they persist + feed B5.

interface CtaRenderPanelProps {
  shot: Shot
  product: Product | null
  lang: ScriptLanguage
  ctaLine: string
  onChangeCta: (r: CtaRender) => void
}

function CtaRenderPanel(p: CtaRenderPanelProps) {
  const hasKie = useSettingsStore((s) => s.hasApiKey())
  const getKie = useSettingsStore((s) => s.getApiKey)

  const existing = p.shot.ctaRender ?? null
  const [offer, setOffer] = useState(existing?.offer ?? p.product?.offer ?? '')
  const [busy, setBusy] = useState<null | 'image' | 'video'>(null)
  const [stage, setStage] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const imageUrl = existing?.imageUrl
  const videoUrl = existing?.videoUrl

  const doImage = async () => {
    if (!p.product) { setErr('Chưa chọn sản phẩm.'); return }
    if (!hasKie) { setErr('Chưa có API key kie.ai trong Cài đặt.'); return }
    setBusy('image'); setErr(null); setStage('Bắt đầu…')
    try {
      const url = await renderCtaImage({
        kieApiKey: getKie(),
        product: p.product,
        lang: p.lang,
        ctaLine: p.ctaLine,
        offer,
        onStatus: setStage,
      })
      // New image invalidates any previously rendered video.
      p.onChangeCta({ offer, imageUrl: url, videoUrl: undefined })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null); setStage('')
    }
  }

  const doVideo = async () => {
    if (!imageUrl) return
    if (!hasKie) { setErr('Chưa có API key kie.ai trong Cài đặt.'); return }
    setBusy('video'); setErr(null); setStage('Bắt đầu…')
    try {
      const url = await renderCtaVideo({ kieApiKey: getKie(), imageUrl, onStatus: setStage })
      p.onChangeCta({ offer, imageUrl, videoUrl: url })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null); setStage('')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted">
        <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
        Cảnh CTA — tạo bằng AI (sản phẩm + ưu đãi + hộp quà bí mật, không giá)
      </div>

      {/* Offer input */}
      <label className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1" title="Ưu đãi / mốc khuyến mãi nướng vào ảnh — KHÔNG hiện giá">
        <span className="shrink-0 text-[11px] text-app-subtle">Ưu đãi:</span>
        <input
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          placeholder="VD: Beli 2 Percuma 1 (không ghi giá)"
          className="w-full bg-transparent text-[11px] text-app-text outline-none placeholder:text-app-faint"
        />
      </label>

      {!hasKie && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-600">
          <AlertTriangle className="h-3 w-3 shrink-0" /> Cần API key kie.ai trong Cài đặt để render.
        </div>
      )}

      {/* Render previews */}
      {(imageUrl || videoUrl) && (
        <div className="flex gap-2">
          {imageUrl && (
            <div className="w-28 shrink-0">
              <div className="aspect-[9/16] w-full overflow-hidden rounded-lg bg-black/40">
                <img src={imageUrl} alt="CTA" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <button
                onClick={() => proxyDownload(imageUrl, `cta-${safeName(p.product?.productName ?? 'sp')}.png`)}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded px-1.5 py-1 text-[10px] font-bold text-app-muted hover:bg-app-card-elevated"
              >
                <ArrowDownToLine className="h-3 w-3" /> Ảnh
              </button>
            </div>
          )}
          {videoUrl && (
            <div className="min-w-0 flex-1">
              <video src={proxyInline(videoUrl)} controls playsInline className="aspect-[9/16] max-h-64 rounded-lg bg-black" />
              <button
                onClick={() => proxyDownload(videoUrl, `cta-${safeName(p.product?.productName ?? 'sp')}.mp4`)}
                className="mt-1 flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-bold text-app-muted hover:bg-app-card-elevated"
              >
                <ArrowDownToLine className="h-3 w-3" /> Tải video
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={doImage}
          disabled={!!busy || !p.product || !hasKie}
          className="ui-accent-soft flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
        >
          {busy === 'image' ? <Loader2 className="h-3 w-3 animate-spin" /> : imageUrl ? <RefreshCw className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          {imageUrl ? 'Tạo lại ảnh' : 'Tạo ảnh CTA'}
          <span className="opacity-70">· {CTA_IMAGE_CREDITS} cr</span>
        </button>
        {imageUrl && (
          <button
            onClick={doVideo}
            disabled={!!busy || !hasKie}
            className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-card px-2.5 py-1 text-[11px] font-bold text-app-text hover:bg-app-card-elevated disabled:opacity-40"
          >
            {busy === 'video' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />}
            {videoUrl ? 'Làm động lại' : 'Làm động → video'}
            <span className="opacity-70">· {CTA_VIDEO_CREDITS} cr</span>
          </button>
        )}
      </div>

      {busy && stage && (
        <p className="flex items-center gap-1.5 text-[10px] text-app-subtle">
          <Loader2 className="h-3 w-3 animate-spin" /> {stage}
        </p>
      )}
      {err && <p className="text-[10px] text-rose-500">{err}</p>}
    </div>
  )
}
