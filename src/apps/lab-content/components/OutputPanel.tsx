import { useMemo, useState } from 'react'
import { Sparkles, Save, RefreshCw, Brain, Target, Anchor, Compass, Layers, ScrollText, Layers3 } from 'lucide-react'
import type { ContentAngle, LabBriefResult } from '../types'
import { getGoalById, getToneById } from '../services/presets'
import PainPointCard from './PainPointCard'
import AngleCard from './AngleCard'
import HookCard from './HookCard'

interface OutputPanelProps {
  result: LabBriefResult | null
  isGenerating: boolean
  isAlreadySaved: boolean
  onRegenerate: () => void
  onSave: () => void
  onOpenCaption: (angle: ContentAngle) => void
  onOpenScript: (angle: ContentAngle) => void
  onOpenHookLab: () => void
  onOpenFunnel: () => void
  onOpenCoc: () => void
  onOpenSalesLetter: () => void
  onOpenMultiAngle: () => void
}

export default function OutputPanel({
  result, isGenerating, isAlreadySaved,
  onRegenerate, onSave, onOpenCaption, onOpenScript, onOpenHookLab, onOpenFunnel, onOpenCoc, onOpenSalesLetter, onOpenMultiAngle,
}: OutputPanelProps) {
  const [lang, setLang] = useState<'vi' | 'my'>('vi')

  const goal = useMemo(() => result ? getGoalById(result.goal) : null, [result])
  const tone = useMemo(() => result ? getToneById(result.toneId) : null, [result])

  if (!result && !isGenerating) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-50 ring-1 ring-violet-200">
          <Brain className="h-8 w-8 text-violet-500" />
        </div>
        <h3 className="mb-1 text-sm font-bold text-gray-900">Brief chiến lược chưa có</h3>
        <p className="max-w-sm text-[12px] leading-relaxed text-gray-500">
          Chọn sản phẩm + mục tiêu + tone bên trái → tạo brief. AI sẽ phân tích 5 nỗi đau, 3 góc tiếp cận, 7 hook ứng viên — kèm công thức và tâm lý học khuyến nghị.
        </p>
      </div>
    )
  }

  if (isGenerating && !result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <div className="relative">
          <div className="h-16 w-16 animate-pulse rounded-full bg-violet-100" />
          <Brain className="absolute inset-0 m-auto h-7 w-7 animate-pulse text-violet-600" />
        </div>
        <p className="text-sm font-semibold text-gray-900">Đang phân tích chiến lược...</p>
        <p className="text-[11px] text-gray-500">5 nỗi đau · 3 góc tiếp cận · 7 hook · ngôn ngữ VI/MY</p>
      </div>
    )
  }

  if (!result) return null

  const hooksByAngle = (idx: 1 | 2 | 3) => result.hooks.filter((h) => h.angleIndex === idx)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-black/8 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="truncate">Brief — {result.productName}</span>
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span>{goal?.glyph} {goal?.label}</span>
              <span>·</span>
              <span>{tone?.glyph} {tone?.label}</span>
            </div>
          </div>

          {/* Language toggle */}
          <div className="flex shrink-0 items-center rounded-full border border-black/10 bg-white p-0.5">
            <button
              onClick={() => setLang('vi')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                lang === 'vi' ? 'bg-violet-100 text-violet-700' : 'text-gray-500'
              }`}
            >
              🇻🇳 VI
            </button>
            <button
              onClick={() => setLang('my')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                lang === 'my' ? 'bg-violet-100 text-violet-700' : 'text-gray-500'
              }`}
            >
              🇲🇾 MY
            </button>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              title="Tạo lại brief"
              className="rounded-lg border border-black/10 bg-white p-1.5 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onSave}
              disabled={isAlreadySaved}
              title={isAlreadySaved ? 'Đã lưu' : 'Lưu brief vào History'}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                isAlreadySaved
                  ? 'cursor-default bg-emerald-50 text-emerald-700'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              {isAlreadySaved ? 'Đã lưu' : 'Lưu brief'}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Strategy Summary */}
        {(result.strategySummaryVi || result.strategySummaryMy) && (
          <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-700">
              <Compass className="h-3 w-3" />
              Chiến lược tổng
            </div>
            <p className="text-[13px] leading-relaxed text-gray-800">
              {lang === 'vi' ? result.strategySummaryVi : (result.strategySummaryMy || result.strategySummaryVi)}
            </p>
            {result.toneRationaleVi && lang === 'vi' && (
              <p className="mt-2 border-t border-violet-200 pt-2 text-[11px] italic text-violet-700">
                💡 Vì sao tone này hợp: {result.toneRationaleVi}
              </p>
            )}
          </section>
        )}

        {/* Pain Points */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <Anchor className="h-3 w-3" />
            5 nỗi đau chính · rank theo cường độ
          </div>
          <div className="space-y-2">
            {result.painPoints.map((pain, idx) => (
              <PainPointCard key={pain.id} pain={pain} rank={idx + 1} lang={lang} />
            ))}
          </div>
        </section>

        {/* Content Angles */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <Target className="h-3 w-3" />
            3 góc tiếp cận · pick 1 để viết content
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {result.angles.map((angle, idx) => {
              const i = (idx + 1) as 1 | 2 | 3
              const slot = result.angleOutputs?.[angle.id]
              return (
                <AngleCard
                  key={angle.id}
                  angle={angle}
                  index={i}
                  lang={lang}
                  hasCaption={!!slot?.caption}
                  hasScript={!!slot?.script}
                  onWriteCaption={() => onOpenCaption(angle)}
                  onWriteScript={() => onOpenScript(angle)}
                />
              )
            })}
          </div>
        </section>

        {/* Hook Candidates */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <Sparkles className="h-3 w-3" />
              7 hook ứng viên · phân theo góc
            </div>
            <button
              onClick={onOpenHookLab}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition-all hover:from-violet-700 hover:to-purple-700"
              title={result.hookLabOutput ? 'Mở Hook Lab — 30 hook đã tạo' : 'Mở Hook Lab — sinh 30 hook'}
            >
              <Sparkles className="h-3 w-3" />
              {result.hookLabOutput ? '🎣 Hook Lab (30)' : '🎣 Mở Hook Lab'}
            </button>
          </div>
          <div className="space-y-1.5">
            {([1, 2, 3] as const).map((angleIdx) => {
              const hooks = hooksByAngle(angleIdx)
              if (hooks.length === 0) return null
              return (
                <div key={angleIdx} className="space-y-1.5">
                  {hooks.map((hook) => (
                    <HookCard key={hook.id} hook={hook} lang={lang} />
                  ))}
                </div>
              )
            })}
          </div>
        </section>

        {/* Funnel Content (Phase 3) */}
        <section>
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-emerald-50/40 via-blue-50/40 to-rose-50/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <Layers className="h-3 w-3" />
                Phễu Content · TOFU / MOFU / BOFU
              </div>
              {result.funnelOutput && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  ✅ Đã tạo · {result.funnelOutput.pieces.length} caption
                </span>
              )}
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-gray-700">
              Sinh bộ <b>9 caption</b> trải đều 3 tầng phễu — đủ chạy campaign nhiều stage. Mỗi tầng dùng công thức + CTA phù hợp giai đoạn customer journey.
            </p>
            <button
              onClick={onOpenFunnel}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-rose-500 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:opacity-90"
            >
              <Target className="h-3.5 w-3.5" />
              {result.funnelOutput ? 'Mở Phễu Content (9 caption)' : 'Tạo Phễu Content'}
            </button>
          </div>
        </section>

        {/* Multi-Angle Ad Pack */}
        <section>
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-blue-50/40 via-violet-50/40 to-rose-50/40 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <Layers3 className="h-3 w-3" />
                Multi-Angle Ad Pack · 5 góc paid ads
              </div>
              {result.multiAngleOutput && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  ✅ Đã tạo · {result.multiAngleOutput.ads.length} ads
                </span>
              )}
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-gray-700">
              5 ad ready-to-run, mỗi cái 1 cửa tâm lý khác: <b>Logical · Emotional · Social Proof · Fear · Aspirational</b>. Mỗi ad có Hook + Body + CTA + Visual direction. Đủ test winner trên Meta/TikTok.
            </p>
            <button
              onClick={onOpenMultiAngle}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-rose-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:opacity-90"
            >
              <Layers3 className="h-3.5 w-3.5" />
              {result.multiAngleOutput ? 'Mở Multi-Angle Pack (5 ads)' : 'Tạo Multi-Angle Ad Pack'}
            </button>
          </div>
        </section>

        {/* Long-Form Sales Letter */}
        <section>
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <ScrollText className="h-3 w-3" />
                Long-Form Sales Letter · 1000-2500 từ
              </div>
              {result.salesLetterOutput && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  ✅ Đã tạo · {result.salesLetterOutput.targetLength} từ
                </span>
              )}
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-gray-700">
              Sinh <b>advertorial / sales letter dài</b> 14 section (Hero → Pain → Story → Mechanism → Proof → Offer → Bonus → Anchoring → Risk Reversal → Urgency → FAQ → Recap → CTA) cho landing page hoặc paid native traffic.
            </p>
            <button
              onClick={onOpenSalesLetter}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:from-amber-700 hover:to-orange-700"
            >
              <ScrollText className="h-3.5 w-3.5" />
              {result.salesLetterOutput ? 'Mở Sales Letter' : 'Tạo Long-Form Sales Letter'}
            </button>
          </div>
        </section>

        {/* COC Multiplier — 1 pillar → 7 platform-native micros */}
        <section>
          <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50/60 to-teal-50/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <Layers className="h-3 w-3" />
                COC Multiplier · 1 pillar → 7 micro-content
              </div>
              {result.cocOutput && (
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                  ✅ Đã tạo · {result.cocOutput.micros.length} micros
                </span>
              )}
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-gray-700">
              Nhân 1 pillar caption thành <b>7 micro-content native</b> cho FB / IG / TikTok / Threads / Zalo / Email / IG Story — mỗi nền tảng có rhythm + tone riêng, KHÔNG phải copy-paste.
            </p>
            <button
              onClick={onOpenCoc}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:from-cyan-700 hover:to-teal-700"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {result.cocOutput ? 'Mở COC Multiplier (7 micros)' : 'Mở COC Multiplier'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
