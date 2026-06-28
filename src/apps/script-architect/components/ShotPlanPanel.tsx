import { ArrowLeft, RotateCcw, Loader2, Scissors, ArrowDownToLine, Trash2, ChevronUp, ChevronDown, Clapperboard, Film, Sparkles, Search } from 'lucide-react'
import type { Shot, ShotPlan, ShotBlock, ShotFill, ScriptLanguage } from '../types'
import { estimateDuration, DEFAULT_FILL_BY_BLOCK } from '../services/splitIntoShots'

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
  plan, productName, isBuilding, onChange, onRebuild, onLanguageChange, onBack,
}: ShotPlanPanelProps) {
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
              />
            ))}
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
    </div>
  )
}
