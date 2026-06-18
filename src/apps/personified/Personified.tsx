// ── Mode 3 — Xưởng Nhân Vật Hoá 3D — Simulator (P1, text-only) ────────────────
// Pick sản phẩm → phân tích insight → chọn Kiểu kịch bản + cấu hình → sinh
// Storyboard + Full-text Voice Script SONG NGỮ + ước credit. CHƯA render ảnh/video.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Loader2, AlertCircle, RefreshCw, Wand2 } from 'lucide-react'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  type TargetMarket, type PersonifiedConfig, type ProductInsight,
  type PersonifiedScript, type ArchetypeId, type HeroType, type CtaStyle, type VideoLength,
  TARGET_MARKET_LABEL,
} from './types'
import {
  ARCHETYPES, ARCHETYPE_ORDER, HERO_TYPE_LABEL, HERO_TYPE_DESC, FALSE_SOLUTION_DESC,
  CTA_STYLE_LABEL, LENGTH_LABEL, LENGTH_TARGET_SEC, SCENE_TYPE_LABEL, RENDER_TIER_LABEL, type RenderTier,
  estimateProjectCredits, formatCreditEstimate,
} from './constants'
import { analyzeInsight, generateScript } from './services/personifiedBrain'

const DEFAULT_CONFIG: PersonifiedConfig = {
  archetype: 'KB1_invader', length: 'medium', heroType: 'product_knight',
  falseSolution: true, ctaStyle: 'villain_flees',
}

// Persist toàn bộ input + kết quả vào localStorage → chuyển tab mode (unmount) /
// F5 không mất việc. KHÔNG lưu cờ loading (analyzing/generating) — chúng là transient.
const CACHE_KEY = 'personified-state-v1'
interface PersistedState {
  v: 1
  productId: string
  market: TargetMarket
  problemHint: string
  insight: ProductInsight | null
  config: PersonifiedConfig
  script: PersonifiedScript | null
  variant: number
  tier: RenderTier
}

export default function Personified() {
  const products = useBankStore((s) => s.products)
  const geminiKey = useSettingsStore((s) => s.geminiApiKey)

  const [productId, setProductId] = useState('')
  const [market, setMarket] = useState<TargetMarket>('MY')
  const [problemHint, setProblemHint] = useState('')

  const [insight, setInsight] = useState<ProductInsight | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [config, setConfig] = useState<PersonifiedConfig>(DEFAULT_CONFIG)

  const [script, setScript] = useState<PersonifiedScript | null>(null)
  const [generating, setGenerating] = useState(false)
  const [variant, setVariant] = useState(0)

  const [tier, setTier] = useState<RenderTier>('seedance720')
  const [error, setError] = useState('')

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId])
  const credit = useMemo(
    () => script ? estimateProjectCredits(script.scenes.map((s) => s.clipDuration), tier) : null,
    [script, tier],
  )

  const noKey = !geminiKey
  const isVN = market === 'VN'

  // ── Persistence: restore once on mount ────────────────────────────────────
  const hydrated = useRef(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const s = JSON.parse(raw) as Partial<PersistedState>
        if (s.v === 1) {
          if (s.productId) setProductId(s.productId)
          if (s.market) setMarket(s.market)
          if (s.problemHint) setProblemHint(s.problemHint)
          if (s.insight) setInsight(s.insight)
          if (s.config) {
            // Sanitize: cache cũ có thể chứa heroType/ctaStyle đã bỏ → rơi về default.
            const c = s.config
            setConfig({
              ...DEFAULT_CONFIG, ...c,
              heroType: HERO_TYPE_LABEL[c.heroType] ? c.heroType : DEFAULT_CONFIG.heroType,
              ctaStyle: CTA_STYLE_LABEL[c.ctaStyle] ? c.ctaStyle : DEFAULT_CONFIG.ctaStyle,
            })
          }
          if (s.script) setScript(s.script)
          if (typeof s.variant === 'number') setVariant(s.variant)
          if (s.tier) setTier(s.tier)
        }
      }
    } catch { /* ignore corrupt cache */ }
    hydrated.current = true
  }, [])

  // ── Persistence: save on meaningful change (skip until hydrated to avoid
  //    overwriting the restore with the initial empty state) ─────────────────
  useEffect(() => {
    if (!hydrated.current) return
    // Skip the initial empty commit (right after restore the closure still holds the
    // pre-restore empty state) — never overwrite a good cache with nothing.
    if (!productId && !insight && !script && !problemHint) return
    try {
      const s: PersistedState = { v: 1, productId, market, problemHint, insight, config, script, variant, tier }
      localStorage.setItem(CACHE_KEY, JSON.stringify(s))
    } catch { /* quota / serialization — non-fatal */ }
  }, [productId, market, problemHint, insight, config, script, variant, tier])

  async function handleAnalyze() {
    if (!product || analyzing) return
    setError(''); setAnalyzing(true); setInsight(null); setScript(null)
    try {
      const ins = await analyzeInsight(product, market, problemHint, geminiKey)
      setInsight(ins)
      setConfig((c) => ({ ...c, archetype: ins.recommendedArchetype }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phân tích lỗi')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleGenerate(nextVariant: number) {
    if (!product || !insight || generating) return
    setError(''); setGenerating(true)
    try {
      const sc = await generateScript(product, market, config, insight, geminiKey, nextVariant)
      setScript(sc); setVariant(nextVariant)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo kịch bản lỗi')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#FAFAFA]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/10 bg-white px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
          <Sparkles className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900">Xưởng Nhân Vật Hoá 3D</h1>
          <p className="text-[11px] text-gray-500">Video nhân cách hóa vấn đề · simulator kịch bản (P1)</p>
        </div>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          TEXT-ONLY · chưa render
        </span>
      </div>

      {noKey && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Chưa có Gemini API key — vào Cài đặt để nhập trước khi phân tích.
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
        {/* ── Bước 1 — Input ── */}
        <Section step={1} title="Chọn sản phẩm & thị trường">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Sản phẩm (từ kho)</span>
              <select
                value={productId} onChange={(e) => { setProductId(e.target.value); setInsight(null); setScript(null) }}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
              >
                <option value="">— Chọn sản phẩm —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productName || '(chưa đặt tên)'}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Thị trường đích</span>
              <div className="flex gap-2">
                {(['MY', 'VN'] as TargetMarket[]).map((m) => (
                  <button key={m} onClick={() => { setMarket(m); setInsight(null); setScript(null) }}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      market === m ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-black/10 bg-white text-gray-600 hover:bg-black/5'
                    }`}>
                    {TARGET_MARKET_LABEL[m]}{m === 'MY' && ' (chính)'}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Vấn đề cần nhân cách hóa <span className="font-normal text-gray-400">(tùy chọn — để trống thì AI tự suy)</span></span>
            <input value={problemHint} onChange={(e) => setProblemHint(e.target.value)}
              placeholder="vd: viêm xoang, mụn lưng, mất ngủ…"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />
          </label>
          <button onClick={handleAnalyze} disabled={!product || analyzing || noKey}
            className="mt-3 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Phân tích & lên ý tưởng
          </button>
        </Section>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {/* ── Bước 2 — Insight + config ── */}
        {insight && (
          <Section step={2} title="Insight & chọn Kiểu kịch bản">
            <div className="grid gap-2 rounded-lg bg-violet-50/60 p-3 text-xs text-gray-700 md:grid-cols-2">
              <InsightRow label="Insight sản phẩm" value={insight.productInsight} />
              <InsightRow label="Insight khách hàng" value={insight.customerInsight} />
              <InsightRow label="Nỗi đau cốt lõi" value={insight.painCore} />
              <InsightRow label="Ẩn dụ đề xuất" value={insight.metaphor} />
            </div>

            <p className="mt-4 mb-2 text-xs font-semibold text-gray-600">Kiểu kịch bản {insight && <span className="font-normal text-violet-600">· AI gợi ý: {ARCHETYPES[insight.recommendedArchetype].labelVi}</span>}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {ARCHETYPE_ORDER.map((id: ArchetypeId) => {
                const a = ARCHETYPES[id]; const active = config.archetype === id
                return (
                  <button key={id} onClick={() => setConfig((c) => ({ ...c, archetype: id }))}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active ? 'border-violet-500 bg-violet-50' : 'border-black/10 bg-white hover:bg-black/5'
                    }`}>
                    <div className="text-sm font-bold text-gray-900">{a.emoji} {a.labelVi}{id === insight.recommendedArchetype && <span className="ml-1 text-[10px] text-violet-600">★</span>}</div>
                    <div className="mt-0.5 text-[11px] text-gray-600">{a.taglineVi}</div>
                    <div className="mt-1 text-[10px] text-gray-400">{a.whenVi}</div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 grid items-start gap-3 md:grid-cols-2">
              <Picker label="Độ dài" value={config.length} options={Object.keys(LENGTH_LABEL) as VideoLength[]}
                labels={LENGTH_LABEL} onChange={(v) => setConfig((c) => ({ ...c, length: v }))}
                hint="Tổng giây thực tế hiện ở bước 3 (mỗi cảnh chỉ 4/8/12s nên có thể lệch nhẹ)." />
              <Picker label="Sản phẩm thật ra tay kiểu gì?" value={config.heroType} options={Object.keys(HERO_TYPE_LABEL) as HeroType[]}
                labels={HERO_TYPE_LABEL} onChange={(v) => setConfig((c) => ({ ...c, heroType: v }))}
                hint={HERO_TYPE_DESC[config.heroType]} />
              <Picker label="Kiểu CTA" value={config.ctaStyle} options={Object.keys(CTA_STYLE_LABEL) as CtaStyle[]}
                labels={CTA_STYLE_LABEL} onChange={(v) => setConfig((c) => ({ ...c, ctaStyle: v }))} />
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={config.falseSolution}
                    onChange={(e) => setConfig((c) => ({ ...c, falseSolution: e.target.checked }))} />
                  Cảnh "đồ thường thất bại" <span className="text-xs font-normal text-violet-600">(khuyên bật)</span>
                </label>
                <span className="mt-1 block text-[11px] leading-snug text-gray-400">{FALSE_SOLUTION_DESC}</span>
              </div>
            </div>

            <button onClick={() => handleGenerate(0)} disabled={generating || noKey}
              className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Tạo kịch bản
            </button>
          </Section>
        )}

        {/* ── Bước 3 — Kịch bản ── */}
        {script && (
          <Section step={3} title="Kịch bản — Storyboard + Full-text Voice Script">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700">{script.scenes.length} cảnh · ~{script.totalSec}s <span className="font-normal text-gray-400">(mục tiêu ~{LENGTH_TARGET_SEC[config.length]}s)</span></span>
              <label className="flex items-center gap-1">
                <span className="text-gray-500">Tier render:</span>
                <select value={tier} onChange={(e) => setTier(e.target.value as RenderTier)}
                  className="rounded border border-black/10 bg-white px-2 py-1 text-xs">
                  {(Object.keys(RENDER_TIER_LABEL) as RenderTier[]).map((t) => <option key={t} value={t}>{RENDER_TIER_LABEL[t]}</option>)}
                </select>
              </label>
              {credit && <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{formatCreditEstimate(credit)}</span>}
              <button onClick={() => handleGenerate(variant + 1)} disabled={generating}
                className="ml-auto flex items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 font-semibold text-gray-700 transition-colors hover:bg-black/5 disabled:opacity-40">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Tạo lại
              </button>
            </div>

            {/* Characters */}
            {script.characters.length > 0 && (
              <div className="mb-4 grid gap-2 md:grid-cols-2">
                {script.characters.map((ch, i) => (
                  <div key={i} className="rounded-lg border border-black/10 bg-white p-3 text-xs">
                    <div className="font-bold text-gray-900">{ch.name} <span className="font-normal text-gray-400">· {ch.role}</span></div>
                    <div className="mt-0.5 text-gray-600">{ch.represents}</div>
                    {ch.voice.vungMien && !/không có/i.test(ch.voice.vungMien) && (
                      <div className="mt-1 text-[10px] text-gray-400">Giọng: {ch.voice.vungMien} · {ch.voice.gioiTinh} · {ch.voice.tuoi} · {ch.voice.texture}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              {/* Storyboard */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">Storyboard</p>
                {script.scenes.map((s) => (
                  <div key={s.idx} className="rounded-lg border border-black/10 bg-white p-3">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700">{s.idx}</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-600">{SCENE_TYPE_LABEL[s.sceneType]}</span>
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">{s.clipDuration}s</span>
                      {s.hasProduct && <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700" title="Cảnh có sản phẩm thật — P2 sẽ khóa bằng 4 ảnh">📦 SP thật</span>}
                      <span className="text-gray-400">· {s.speaker}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-900">"{s.dialoguePrimary}"</div>
                    {!isVN && s.dialogueVi && <div className="mt-0.5 text-xs italic text-gray-500">↳ {s.dialogueVi}</div>}
                    <div className="mt-1.5 text-[11px] text-gray-500">{s.action}</div>
                    <div className="mt-1 text-[10px] text-gray-400">🎥 {s.camera}{s.sfx.length > 0 && ` · 🔊 ${s.sfx.join(', ')}`}</div>
                  </div>
                ))}
              </div>

              {/* Full-text voice script (song ngữ) — tự giãn full nội dung, không scroll */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">Full-text Voice Script {!isVN && '(đích)'}</p>
                <div className="w-full whitespace-pre-wrap rounded-lg border border-black/10 bg-white p-3 text-sm leading-relaxed text-gray-800">
                  {script.fullVoiceScriptPrimary}
                </div>
                {!isVN && (
                  <>
                    <p className="text-xs font-semibold text-gray-600">↳ Bản dịch nghĩa VN (duyệt)</p>
                    <div className="w-full whitespace-pre-wrap rounded-lg border border-black/10 bg-gray-50 p-3 text-sm leading-relaxed text-gray-600">
                      {script.fullVoiceScriptVi}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ── small UI helpers ─────────────────────────────────────────────────────────
function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div><span className="font-semibold text-gray-500">{label}: </span><span>{value}</span></div>
  )
}

function Picker<T extends string>({ label, value, options, labels, onChange, hint }: {
  label: string; value: T; options: T[]; labels: Record<T, string>; onChange: (v: T) => void; hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
        {options.map((o) => <option key={o} value={o}>{labels[o]}</option>)}
      </select>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-gray-400">{hint}</span>}
    </label>
  )
}
