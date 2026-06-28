import { useState } from 'react'
import { ArrowLeft, RotateCcw, Loader2, Scissors, ArrowDownToLine, Trash2, ChevronUp, ChevronDown, Clapperboard, Film, Sparkles, Search, Play, RefreshCw, X, ImageIcon, Video, AlertTriangle } from 'lucide-react'
import type { Shot, ShotPlan, ShotBlock, ShotFill, ScriptLanguage, SourceClip, CtaRender } from '../types'
import type { Product } from '../../../stores/types'
import { estimateDuration, DEFAULT_FILL_BY_BLOCK } from '../services/splitIntoShots'
import { renderCtaImage, renderCtaVideo, CTA_IMAGE_CREDITS, CTA_VIDEO_CREDITS } from '../services/renderCtaShot'
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
  'source-broad':   { label: 'Source rộng',   hint: 'Clip đời thường / cảm xúc — không cần trúng SP', cls: 'bg-sky-100 text-sky-700' },
  'source-product': { label: 'Source SP',     hint: 'Tìm đúng clip sản phẩm trên Douyin/RED',          cls: 'bg-violet-100 text-violet-700' },
  'ai-render':      { label: 'AI render',     hint: 'CTA tạo bằng AI (SP + ưu đãi + hộp quà) — không giá', cls: 'bg-amber-100 text-amber-700' },
}

const fmtSec = (n: number) => `~${n}s`

// ── Source clip plumbing (mirrors Research → SourceFinder) ───────────────
type Platform = 'douyin' | 'xhs' | 'kuaishou'
const PLATS: { id: Platform; label: string; emoji: string }[] = [
  { id: 'douyin', label: 'Douyin', emoji: '🎵' },
  { id: 'xhs', label: 'RED', emoji: '📕' },
  { id: 'kuaishou', label: 'Kuaishou', emoji: '⚡' },
]
const platLabel = (p: string) => PLATS.find((x) => x.id === p)?.label ?? 'Douyin'
const proxyInline = (url: string) => `/api/dl-video?url=${encodeURIComponent(url)}&inline=1`
const proxyDownload = (url: string, name: string) => {
  const href = `/api/dl-video?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
  const el = document.createElement('a'); el.href = href; el.download = name
  document.body.appendChild(el); el.click(); el.remove()
}
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))
const safeName = (s: string) => (s || 'shot').replace(/[^\w]+/g, '-').slice(0, 24)

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
  // Source-clip controls (panel-wide): which platform to search, length filter,
  // and the full-screen video preview popup.
  const [platform, setPlatform] = useState<Platform>('douyin')
  const [onlyShort, setOnlyShort] = useState(true)
  const [playClip, setPlayClip] = useState<SourceClip | null>(null)

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

  const changeBlock = (id: string, block: ShotBlock) => {
    const shot = plan.shots.find((s) => s.id === id)
    if (!shot) return
    // CTA is always ai-render (no source); leaving CTA reverts to the block default.
    let fill = shot.fill
    if (block === 'cta') fill = 'ai-render'
    else if (fill === 'ai-render') fill = DEFAULT_FILL_BY_BLOCK[block]
    patchShot(id, { block, fill, matchMode: matchForFill(fill), zhQuery: fill === 'ai-render' ? '' : shot.zhQuery })
  }

  const changeFill = (id: string, fill: ShotFill) => {
    const shot = plan.shots.find((s) => s.id === id)
    if (!shot) return
    patchShot(id, { fill, matchMode: matchForFill(fill), zhQuery: fill === 'ai-render' ? '' : shot.zhQuery })
  }

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

          {/* Primary-language toggle — re-splits on the chosen language */}
          <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-app-border bg-app-card-elevated p-0.5" title="Ngôn ngữ dòng chính (tách lại theo ngôn ngữ này)">
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
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-app-subtle">
          <span><b className="text-app-muted">{plan.shots.length}</b> cảnh</span>
          <span>· tổng <b className="text-app-muted">{fmtSec(plan.totalDurationSec)}</b></span>
          <span className="hidden sm:inline">· dòng <b>{primaryFlag}</b> = chính, <b>{glossFlag}</b> = phụ · từ khóa source = <b className="text-app-muted">tiếng Trung 🇨🇳</b></span>
        </div>

        {/* Source-clip controls */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-app-subtle">Nguồn clip:</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-app-border bg-app-card-elevated p-0.5">
            {PLATS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${platform === p.id ? 'ui-accent-soft' : 'text-app-muted hover:bg-app-card'}`}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-app-muted" title="Chỉ lấy clip ngắn, hợp cắt ghép">
            <input type="checkbox" checked={onlyShort} onChange={(e) => setOnlyShort(e.target.checked)} /> ⏱ Chỉ clip &lt;60s
          </label>
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
                onEditZhQuery={(v) => patchShot(s.id, { zhQuery: v })}
                onChangeBlock={(b) => changeBlock(s.id, b)}
                onChangeFill={(f) => changeFill(s.id, f)}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
                onMergeDown={() => mergeDown(i)}
                onSplit={() => splitShot(i)}
                onRemove={() => removeShot(s.id)}
                platform={platform}
                onlyShort={onlyShort}
                onPlay={setPlayClip}
                onPickClip={(c) => patchShot(s.id, { clip: c })}
                onClearClip={() => patchShot(s.id, { clip: null })}
                product={product}
                lang={lang}
                onChangeCta={(r) => patchShot(s.id, { ctaRender: r })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Full-screen clip preview */}
      {playClip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPlayClip(null)}
        >
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPlayClip(null)}
              className="absolute -top-10 right-0 flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" /> Đóng
            </button>
            <video
              src={proxyInline(playClip.videoUrl)}
              poster={playClip.platform === 'douyin' ? playClip.cover : proxyInline(playClip.cover)}
              controls
              autoPlay
              playsInline
              className="max-h-[80vh] w-full rounded-2xl bg-black"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="line-clamp-1 flex-1 text-xs text-white/70">{playClip.desc || playClip.author}</p>
              <button
                onClick={() => proxyDownload(playClip.videoUrl, `${safeName(playClip.author)}-${playClip.id}.mp4`)}
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
  onEditZhQuery: (v: string) => void
  onChangeBlock: (b: ShotBlock) => void
  onChangeFill: (f: ShotFill) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMergeDown: () => void
  onSplit: () => void
  onRemove: () => void
  // Source-clip wiring (B3)
  platform: Platform
  onlyShort: boolean
  onPlay: (c: SourceClip) => void
  onPickClip: (c: SourceClip) => void
  onClearClip: () => void
  // CTA AI render wiring (B4)
  product: Product | null
  lang: ScriptLanguage
  onChangeCta: (r: CtaRender) => void
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

      {/* Visual idea + Chinese keyword */}
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <label className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1">
          <Film className="h-3 w-3 shrink-0 text-app-subtle" />
          <input
            value={shot.visualIdea}
            onChange={(e) => p.onEditVisualIdea(e.target.value)}
            placeholder="Ý hình — cảnh quay gì"
            className="w-full bg-transparent text-[11px] text-app-text outline-none placeholder:text-app-faint"
          />
        </label>
        {isAiRender ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-app-border bg-app-surface px-2 py-1 text-[11px] text-app-subtle">
            <Sparkles className="h-3 w-3 shrink-0" /> AI render — không cần tìm source
          </div>
        ) : (
          <label className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1" title="Từ khóa tiếng Trung dùng tìm clip trên Douyin / RED / Kuaishou">
            <Search className="h-3 w-3 shrink-0 text-app-subtle" />
            <input
              value={shot.zhQuery}
              onChange={(e) => p.onEditZhQuery(e.target.value)}
              placeholder="从关键词 (tiếng Trung)"
              className="w-full bg-transparent text-[11px] text-app-text outline-none placeholder:text-app-faint"
              lang="zh"
            />
          </label>
        )}
      </div>

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
            platform={p.platform}
            onlyShort={p.onlyShort}
            onPlay={p.onPlay}
            onPickClip={p.onPickClip}
            onClearClip={p.onClearClip}
          />
        )}
      </div>
    </div>
  )
}

// ── Per-shot source picker (B3) ──────────────────────────────────────────
// Queries /api/tikhub-search by the shot's CHINESE keyword (zhQuery) — the 3
// source platforms are Chinese, so a Chinese query returns far better clips.
// Falls back to visualIdea only if zhQuery is empty. Shows a results strip with
// play / pick / download; once an operator picks a clip it's pinned on the shot.

interface TikhubResponse {
  clips: SourceClip[]
  cursor?: number
  hasMore?: boolean
  error?: string
  detail?: string
  note?: string
}

interface ShotSourcePickerProps {
  shot: Shot
  platform: Platform
  onlyShort: boolean
  onPlay: (c: SourceClip) => void
  onPickClip: (c: SourceClip) => void
  onClearClip: () => void
}

function ShotSourcePicker(p: ShotSourcePickerProps) {
  const { shot } = p
  const [busy, setBusy] = useState(false)
  const [clips, setClips] = useState<SourceClip[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const query = (shot.zhQuery || '').trim() || (shot.visualIdea || '').trim()

  const search = async () => {
    if (!query) { setErr('Chưa có từ khóa tiếng Trung để tìm.'); return }
    setBusy(true); setErr(null); setOpen(true)
    try {
      const url = `/api/tikhub-search?q=${encodeURIComponent(query)}&platform=${p.platform}&sort=like&maxSec=${p.onlyShort ? 60 : 0}`
      const res = await fetch(url)
      const data = (await res.json()) as TikhubResponse
      if (data.error) { setErr(data.detail || data.error); setClips([]) }
      else setClips(Array.isArray(data.clips) ? data.clips : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); setClips([])
    } finally {
      setBusy(false)
    }
  }

  const picked = shot.clip ?? null

  return (
    <div className="flex flex-col gap-2">
      {/* Picked-clip summary */}
      {picked && (
        <div className="flex items-center gap-2 rounded-lg border bg-app-surface p-1.5" style={{ borderColor: 'var(--color-accent)' }}>
          <button
            onClick={() => p.onPlay(picked)}
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/40"
            title="Xem clip"
          >
            <img
              src={picked.platform === 'douyin' ? picked.cover : proxyInline(picked.cover)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center"><Play className="h-4 w-4 text-white drop-shadow" /></span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-[11px] font-bold text-app-text">{picked.desc || picked.author || 'Clip đã chọn'}</p>
            <p className="text-[10px] text-app-subtle">{platLabel(picked.platform)} · {fmtK(picked.likes)} ♥ · {Math.round(picked.durationSec)}s</p>
          </div>
          <button
            onClick={() => proxyDownload(picked.videoUrl, `${safeName(shot.zhQuery || shot.visualIdea)}-${picked.id}.mp4`)}
            className="shrink-0 rounded-md p-1.5 text-app-muted hover:bg-app-card-elevated"
            title="Tải clip"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { p.onClearClip(); }}
            className="shrink-0 rounded-md p-1.5 text-app-muted hover:bg-rose-500/10 hover:text-rose-500"
            title="Bỏ chọn"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search trigger */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={search}
          disabled={busy || !query}
          className="ui-accent-soft flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
          title={query ? `Tìm trên ${platLabel(p.platform)}: ${query}` : 'Chưa có từ khóa'}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : picked ? <RefreshCw className="h-3 w-3" /> : <Search className="h-3 w-3" />}
          {picked ? 'Đổi clip' : 'Tìm clip'}
        </button>
        {query && (
          <span className="line-clamp-1 text-[10px] text-app-subtle">🇨🇳 {query} · {platLabel(p.platform)}</span>
        )}
      </div>

      {err && <p className="text-[10px] text-rose-500">{err}</p>}

      {/* Results strip */}
      {open && !busy && !err && clips.length === 0 && (
        <p className="text-[10px] text-app-subtle">Không tìm thấy clip. Thử đổi từ khóa hoặc nền tảng.</p>
      )}
      {open && clips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {clips.map((c) => {
            const isPicked = picked?.id === c.id && picked?.platform === c.platform
            return (
              <div key={`${c.platform}_${c.id}`} className="w-28 shrink-0">
                <button
                  onClick={() => p.onPlay(c)}
                  className="relative block aspect-[9/16] w-full overflow-hidden rounded-lg bg-black/40"
                  title="Xem trước"
                >
                  <img
                    src={c.platform === 'douyin' ? c.cover : proxyInline(c.cover)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute inset-0 flex items-center justify-center"><Play className="h-5 w-5 text-white drop-shadow" /></span>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{Math.round(c.durationSec)}s · {fmtK(c.likes)}♥</span>
                </button>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    onClick={() => p.onPickClip(c)}
                    className={`flex-1 rounded px-1.5 py-1 text-[10px] font-bold ${isPicked ? 'bg-emerald-500/15 text-emerald-500' : 'ui-accent-soft'}`}
                  >
                    {isPicked ? '✓ Đã chọn' : 'Chọn'}
                  </button>
                  <button
                    onClick={() => proxyDownload(c.videoUrl, `${safeName(shot.zhQuery || shot.visualIdea)}-${c.id}.mp4`)}
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
