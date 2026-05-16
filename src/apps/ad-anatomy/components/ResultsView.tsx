import { useState } from 'react'
import {
  RotateCcw,
  Copy,
  Check,
  Send,
  BarChart3,
  FileText,
  Anchor,
  Map,
  Brain,
  Eye,
  Lightbulb,
  Bot,
  Film,
  Save,
  Loader2,
  Bookmark,
  Target,
  TrendingUp,
  Activity,
  Rocket,
  AlertTriangle,
  ChevronDown,
  Sparkles,
  PenLine,
  LayoutTemplate,
  Image as ImageLucide,
  Megaphone,
  Wand2,
  Zap,
} from 'lucide-react'
import type { AnalysisResult } from '../types'
import {
  AD_ANGLE_LABEL_VI,
  MARKET_AWARENESS_LABEL_VI,
  FUNNEL_LABEL_VI,
  VERDICT_LABEL_VI,
  RETENTION_RISK_COLOR,
  RETENTION_RISK_LABEL_VI,
} from '../types'
import { useAppStore } from '../../../stores/appStore'
import { useBankStore } from '../../../stores/bankStore'
import { useAdTemplateStore } from '../../../stores/adTemplateStore'

/**
 * Convert an AnalysisResult into a single text block suitable for injecting
 * into the UGC Builder's storyboard prompt as a "winning ad reference".
 * Combines the reconstructionPrompt (full AI directive), the structure beats,
 * and a brief visual playbook into one consolidated reference document.
 */
function analysisToPromptText(result: AnalysisResult): string {
  const parts: string[] = []

  parts.push('═══════════════════════════════════════════════════════════════')
  parts.push('WINNING UGC AD ANALYSIS — STYLE / STRUCTURE / PACING REFERENCE')
  parts.push('═══════════════════════════════════════════════════════════════\n')

  parts.push('## TRANSCRIPT WITH TIMING')
  result.transcript.forEach((line) => {
    parts.push(`${line.timestamp} ${line.text}`)
  })

  parts.push('\n## STRUCTURE / BEATS')
  result.structureMap.beats?.forEach((beat) => {
    parts.push(`- ${beat.timestamp}  ${beat.beat}: ${beat.description}`)
  })

  if (result.psychology?.primaryLevers?.length) {
    parts.push('\n## PSYCHOLOGY / PERSUASION LEVERS')
    result.psychology.primaryLevers.forEach((p) => parts.push(`- ${p}`))
  }

  if (result.visualPlaybook?.length) {
    parts.push('\n## VISUAL PLAYBOOK (per-shot composition)')
    result.visualPlaybook.slice(0, 10).forEach((v, i) => {
      parts.push(`Shot ${i + 1} (${v.timestamp}):  ${v.description}`)
    })
  }

  parts.push('\n## AI RECONSTRUCTION PROMPT')
  parts.push(result.reconstructionPrompt)

  return parts.join('\n')
}

interface ResultsViewProps {
  result: AnalysisResult
  videoSrc: string | null
  fileName: string
  onReset: () => void
}

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return { copied, copy }
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-[#FB2B37]/80" strokeWidth={1.5} />
      <h3 className="text-sm font-semibold tracking-tight text-gray-800">{title}</h3>
    </div>
  )
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-black/8 bg-black/[0.02] p-5 ${className}`}>
      {children}
    </div>
  )
}

/* ─── 1. Scorecard ─── */
function scoreColor(score: number) {
  if (score >= 9) return { text: 'text-cyan-400', border: 'border-cyan-400/20', bg: 'bg-cyan-400/10' }
  if (score >= 7) return { text: 'text-green-500', border: 'border-green-500/20', bg: 'bg-green-500/10' }
  if (score >= 5) return { text: 'text-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/10' }
  return { text: 'text-[#FB2B37]', border: 'border-[#FB2B37]/20', bg: 'bg-[#FB2B37]/10' }
}

/** Format 7.4 → "7.4", but 7 → "7.0" for consistent display. */
function fmtScore(n: number): string {
  return n.toFixed(1)
}

function ScorecardSection({ result }: { result: AnalysisResult }) {
  const { scorecard } = result
  return (
    <Section>
      <SectionHeader icon={BarChart3} title="Bảng điểm — có WHY + HOW TO IMPROVE" />
      <div className="flex flex-col gap-3">
        {scorecard.scores.map((s) => {
          const color = scoreColor(s.score)
          const isOverall = s.label === 'Overall Execution'
          return (
            <div key={s.label} className={`rounded-lg border ${color.border} ${color.bg} p-3`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-white text-sm font-bold tabular-nums tracking-tight ${color.text} shadow-sm`}>
                  {fmtScore(s.score)}
                </span>
                <span className={`text-sm ${isOverall ? 'font-bold text-gray-800' : 'font-semibold text-gray-700'}`}>{s.label}</span>
              </div>
              {(s.reason || s.howToImprove) && (
                <div className="mt-2 ml-[68px] space-y-1">
                  {s.reason && (
                    <p className="text-[11px] leading-relaxed text-gray-600">
                      <span className="font-bold text-gray-700">WHY · </span>{s.reason}
                    </p>
                  )}
                  {s.howToImprove && (
                    <p className="text-[11px] leading-relaxed text-violet-700">
                      <span className="font-bold">HOW · </span>{s.howToImprove}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div className="rounded-lg bg-black/[0.03] px-4 py-3">
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Nhận xét tổng quan</span>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{scorecard.analystNote}</p>
        </div>
      </div>
    </Section>
  )
}

/* ─── Z1: Decision Layer (Creative Director verdict + tests) ─── */
function DecisionSection({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState(true)
  const d = result.decisionLayer
  const angle = result.adAngle
  const aware = result.marketAwareness
  const funnel = result.funnelPosition
  const scaling = result.scalingPotential

  // Only render section if at least one decision-layer field exists (back-compat)
  if (!d && !angle && !aware && !funnel && !scaling) return null

  const verdictColor: Record<string, string> = {
    SCALE:     'bg-emerald-500 text-white',
    TEST_MORE: 'bg-amber-500 text-white',
    ITERATE:   'bg-violet-500 text-white',
    KILL:      'bg-red-500 text-white',
  }
  const scalingTierColor: Record<string, string> = {
    HIGH:   'text-emerald-600 bg-emerald-50 border-emerald-200',
    MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200',
    LOW:    'text-red-600 bg-red-50 border-red-200',
  }

  return (
    <Section className="border-violet-200 bg-gradient-to-br from-violet-50/60 to-pink-50/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 mb-3"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-600" strokeWidth={1.8} />
          <h3 className="text-sm font-bold tracking-tight text-gray-900">AI Creative Director — Verdict + Quyết định</h3>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3">
          {/* Top row — verdict + scaling */}
          {(d || scaling) && (
            <div className="flex flex-wrap items-center gap-2">
              {d && (
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${verdictColor[d.verdict] ?? 'bg-gray-500 text-white'}`}>
                  {VERDICT_LABEL_VI[d.verdict]}
                </span>
              )}
              {scaling && (
                <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${scalingTierColor[scaling.tier]}`}>
                  <Rocket className="h-3 w-3" />
                  Scaling: {scaling.tier} ({fmtScore(scaling.score)}/10)
                </span>
              )}
            </div>
          )}

          {/* Scale action — bold one-liner */}
          {d?.scaleAction && (
            <div className="rounded-lg border border-violet-200 bg-white px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Hành động ngay</span>
              <p className="mt-1 text-sm font-medium leading-relaxed text-gray-800">{d.scaleAction}</p>
            </div>
          )}

          {/* Angle + Awareness + Funnel — 3-col mini grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {angle && (
              <div className="rounded-lg border border-black/8 bg-white px-3 py-2.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Ad Angle</span>
                <p className="mt-1 text-xs font-bold text-cyan-700">{AD_ANGLE_LABEL_VI[angle.primary]}</p>
                {angle.secondary && (
                  <p className="text-[10px] text-gray-500">phụ: {AD_ANGLE_LABEL_VI[angle.secondary]}</p>
                )}
                <p className="mt-1 text-[10px] leading-snug text-gray-600">{angle.rationale}</p>
              </div>
            )}
            {aware && (
              <div className="rounded-lg border border-black/8 bg-white px-3 py-2.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Awareness</span>
                <p className="mt-1 text-xs font-bold text-amber-700">{MARKET_AWARENESS_LABEL_VI[aware.level]}</p>
                <p className="mt-1 text-[10px] leading-snug text-gray-600">{aware.recommendation}</p>
              </div>
            )}
            {funnel && (
              <div className="rounded-lg border border-black/8 bg-white px-3 py-2.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Funnel Position</span>
                <p className="mt-1 text-xs font-bold text-emerald-700">Best: {FUNNEL_LABEL_VI[funnel.bestFor]}</p>
                {funnel.weakFor.length > 0 && (
                  <p className="text-[10px] text-red-600">Yếu: {funnel.weakFor.map((f) => FUNNEL_LABEL_VI[f]).join(', ')}</p>
                )}
                <p className="mt-1 text-[10px] leading-snug text-gray-600">{funnel.reasoning}</p>
              </div>
            )}
          </div>

          {/* Recommended tests + Do not test */}
          {d && (d.recommendedTests.length > 0 || d.doNotTest.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {d.recommendedTests.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                    <Check className="h-3 w-3" /> NÊN TEST
                  </span>
                  <ul className="mt-1.5 space-y-0.5">
                    {d.recommendedTests.map((t, i) => (
                      <li key={i} className="text-[11px] leading-snug text-gray-700">• {t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {d.doNotTest.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-700">
                    <AlertTriangle className="h-3 w-3" /> KHÔNG TEST
                  </span>
                  <ul className="mt-1.5 space-y-0.5">
                    {d.doNotTest.map((t, i) => (
                      <li key={i} className="text-[11px] leading-snug text-gray-700">• {t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Fix priority — top 3 ranked */}
          {d && d.fixPriority.length > 0 && (
            <div className="rounded-lg border border-black/8 bg-white px-3 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Top 3 fix theo impact</span>
              <ol className="mt-2 space-y-1.5">
                {d.fixPriority.map((f) => (
                  <li key={f.rank} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                      {f.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{f.title}</p>
                      <p className="text-[10px] text-emerald-700">⇧ {f.expectedImpact}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Scaling factors + blockers */}
          {scaling && (scaling.scalingFactors.length > 0 || scaling.blockers.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {scaling.scalingFactors.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Yếu tố scale ✓</span>
                  <ul className="mt-1 space-y-0.5">
                    {scaling.scalingFactors.map((f, i) => (
                      <li key={i} className="text-[11px] leading-snug text-gray-700">• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {scaling.blockers.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Chặn scale ⚠</span>
                  <ul className="mt-1 space-y-0.5">
                    {scaling.blockers.map((b, i) => (
                      <li key={i} className="text-[11px] leading-snug text-gray-700">• {b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

/* ─── Z3: 1-Click Creative Action Bar ─── */
/**
 * Cross-app generation pipeline. Each button sends extracted analysis data
 * to the most-relevant downstream module + navigates. For apps that already
 * have a custom inter-app receiver (Script Architect: 'winningTranscript'),
 * we send the payload directly. For apps without receivers yet, we copy
 * the relevant snippet to clipboard + show toast — user pastes manually.
 *
 * Future commits will add proper receivers in each app so no clipboard
 * fallback is needed.
 */
function CreativeActionBar({ result }: { result: AnalysisResult }) {
  const sendToApp = useAppStore((s) => s.sendToApp)
  const openApp = useAppStore((s) => s.openApp)
  const addToast = useAppStore((s) => s.addToast)

  const transcriptText = result.transcript.map((l) => l.text).join('\n')
  const hookText = result.hookBreakdown?.hookText ?? ''
  const visualPlaybookText = (result.visualPlaybook ?? [])
    .slice(0, 10)
    .map((v, i) => `Shot ${i + 1} (${v.timestamp}) — ${v.description}\n${v.prompt}`)
    .join('\n\n')
  const reconstructionPrompt = result.reconstructionPrompt ?? ''

  // ── 1. Tạo script tương tự — direct receiver in Script Architect ─────
  const handleScriptSimilar = () => {
    sendToApp({
      targetApp: 'script-architect',
      targetField: 'winningTranscript',
      data: transcriptText,
    })
    addToast('✨ Đã gửi transcript sang Tạo Kịch bản UGC')
  }

  // ── 2. Tạo Hook variants — same target, focused intent ───────────────
  const handleHookVariants = () => {
    const hookContext = `# WINNING HOOK\n${hookText}\n\n# KỸ THUẬT\n${result.hookBreakdown?.technique ?? ''}\n\n# TẠI SAO HIỆU QUẢ\n${result.hookBreakdown?.whyItWorks ?? ''}\n\n# MẪU ÁP DỤNG\n${result.hookBreakdown?.adaptableTemplate ?? ''}\n\n=> Hãy viết 5 hook variants tương tự, đa dạng tone (emotional / authority / curiosity / urgency / pattern-interrupt).`
    sendToApp({
      targetApp: 'script-architect',
      targetField: 'winningTranscript',
      data: hookContext,
    })
    addToast('🪝 Đã gửi hook context — chọn preset hook trong Kịch bản')
  }

  // ── 3. Tạo Storyboard — copy reconstruction + navigate UGC Builder ───
  const handleStoryboard = async () => {
    try {
      await navigator.clipboard.writeText(reconstructionPrompt)
      addToast('🎬 Đã copy reconstruction prompt — paste vào "Kịch bản" của UGC Builder', 'success')
    } catch {
      addToast('🎬 Mở UGC Builder — dùng "Lưu thành Mẫu ADS Win" + reuse ở UGC Builder', 'info')
    }
    openApp('video-builder')
  }

  // ── 4. Tạo Landing Page — copy analysis snippet + navigate ───────────
  const handleLandingPage = async () => {
    const snippet = `# WINNING AD INSPIRATION\n\n## HOOK\n${hookText}\n\n## STRUCTURE\n${result.structureMap?.beats?.map((b) => `- ${b.timestamp} ${b.beat}: ${b.description}`).join('\n') ?? ''}\n\n## RECONSTRUCTION DIRECTIVE\n${reconstructionPrompt}`
    try {
      await navigator.clipboard.writeText(snippet)
      addToast('🌐 Đã copy ad blueprint — chọn sản phẩm + paste vào "Niche / inspiration" trong LandingPage AI', 'success')
    } catch {
      addToast('🌐 Mở LandingPage AI — chọn sản phẩm để bắt đầu', 'info')
    }
    openApp('landing-page')
  }

  // ── 5. Tạo Product AI scenes — copy visual playbook + navigate ───────
  const handleProductAIScenes = async () => {
    try {
      await navigator.clipboard.writeText(visualPlaybookText)
      addToast('📸 Đã copy visual playbook — paste vào "Scene custom" của Product AI', 'success')
    } catch {
      addToast('📸 Mở Product AI — chọn scene preset gần nhất với ad win', 'info')
    }
    openApp('broll-studio')
  }

  // ── 6. Tạo CTA variants — copy hook+reconstruction + navigate Ads ────
  const handleCTAVariants = async () => {
    const ctaContext = `# WINNING AD CTA CONTEXT\n\n## ORIGINAL HOOK\n${hookText}\n\n## PERSUASION LEVERS\n${(result.psychology?.primaryLevers ?? []).map((l) => `- ${l}`).join('\n')}\n\n## TARGET AUDIENCE\n${(result.psychology?.targetingSignals ?? []).map((l) => `- ${l}`).join('\n')}\n\n=> Hãy viết 5 CTA variants Facebook primary text, đa dạng angle (urgency / scarcity / soft / question / direct).`
    try {
      await navigator.clipboard.writeText(ctaContext)
      addToast('📣 Đã copy CTA context — paste vào Ads Content + chọn platform', 'success')
    } catch {
      addToast('📣 Mở Ads Content — chọn sản phẩm để viết CTA', 'info')
    }
    openApp('ads-content')
  }

  return (
    <Section className="border-pink-200 bg-gradient-to-br from-pink-50/60 to-violet-50/40">
      <div className="mb-3 flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-pink-600" strokeWidth={1.8} />
        <h3 className="text-sm font-bold tracking-tight text-gray-900">1-Click Creative Pipeline — tái sử dụng phân tích này</h3>
        <span className="ml-auto rounded-full bg-pink-100 px-2 py-0.5 text-[9px] font-bold text-pink-700">
          Z3
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <ActionTile
          icon={PenLine}
          label="Tạo script tương tự"
          hint="Gửi transcript → Kịch bản UGC"
          accent="violet"
          onClick={handleScriptSimilar}
        />
        <ActionTile
          icon={Anchor}
          label="Tạo hook variants"
          hint="5 hook khác nhau từ hook gốc"
          accent="emerald"
          onClick={handleHookVariants}
        />
        <ActionTile
          icon={Megaphone}
          label="Tạo CTA variants"
          hint="5 FB primary text cho Ads"
          accent="amber"
          onClick={handleCTAVariants}
        />
        <ActionTile
          icon={Film}
          label="Tạo storyboard"
          hint="Mở UGC Builder + reconstruction"
          accent="cyan"
          onClick={handleStoryboard}
        />
        <ActionTile
          icon={LayoutTemplate}
          label="Tạo Landing Page"
          hint="14-section advertorial pack"
          accent="blue"
          onClick={handleLandingPage}
        />
        <ActionTile
          icon={ImageLucide}
          label="Tạo Product AI scenes"
          hint="Visual playbook → 4 ảnh lifestyle"
          accent="rose"
          onClick={handleProductAIScenes}
        />
      </div>
      <p className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
        <Zap className="h-3 w-3 text-amber-500" />
        Mỗi nút mở module tương ứng + tự copy snippet vào clipboard nếu cần paste.
      </p>
    </Section>
  )
}

function ActionTile({
  icon: Icon, label, hint, accent, onClick,
}: {
  icon: React.ElementType
  label: string
  hint: string
  accent: 'violet' | 'emerald' | 'cyan' | 'amber' | 'blue' | 'rose'
  onClick: () => void
}) {
  const ACCENT: Record<string, string> = {
    violet:  'border-violet-200 bg-white hover:bg-violet-50 text-violet-700',
    emerald: 'border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700',
    cyan:    'border-cyan-200 bg-white hover:bg-cyan-50 text-cyan-700',
    amber:   'border-amber-200 bg-white hover:bg-amber-50 text-amber-700',
    blue:    'border-blue-200 bg-white hover:bg-blue-50 text-blue-700',
    rose:    'border-rose-200 bg-white hover:bg-rose-50 text-rose-700',
  }
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-xl border ${ACCENT[accent]} px-3 py-2.5 text-left transition-colors shadow-sm`}
    >
      <div className="flex w-full items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="text-xs font-bold">{label}</span>
        <Sparkles className="ml-auto h-3 w-3 opacity-60" />
      </div>
      <span className="text-[10px] text-gray-500 leading-tight">{hint}</span>
    </button>
  )
}

/* ─── Z2: Retention Heatmap Timeline ─── */
function RetentionHeatmapSection({ result }: { result: AnalysisResult }) {
  const r = result.retentionTimeline
  if (!r || r.segments.length === 0) return null

  return (
    <Section>
      <SectionHeader icon={Activity} title="Retention Heatmap — drop risk theo timeline" />
      <div className="space-y-3">
        {/* Bar timeline */}
        <div className="flex h-10 w-full overflow-hidden rounded-lg border border-black/10">
          {r.segments.map((seg, i) => (
            <div
              key={i}
              className={`relative flex-1 ${RETENTION_RISK_COLOR[seg.risk]} group cursor-help transition-opacity hover:opacity-80`}
              title={`${seg.timestamp} · ${seg.retentionScore}% retention · ${RETENTION_RISK_LABEL_VI[seg.risk]}\n${seg.note}`}
            >
              <span className="absolute inset-x-0 top-0 px-0.5 text-center text-[8px] font-bold leading-none text-white/90 truncate">
                {seg.retentionScore}
              </span>
              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 group-hover:block">
                <div className="whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white shadow-lg">
                  {seg.timestamp} · {seg.retentionScore}%
                  <div className="mt-0.5 text-[9px] font-normal text-white/80">{seg.note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Timestamp labels under bar */}
        <div className="flex w-full">
          {r.segments.map((seg, i) => (
            <span key={i} className="flex-1 text-center text-[9px] tabular-nums text-gray-500">
              {seg.timestamp.split('-')[0]}
            </span>
          ))}
        </div>

        {/* Overall diagnosis */}
        <div className="rounded-lg bg-black/[0.03] px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Chẩn đoán pacing</span>
          <p className="mt-1 text-xs leading-relaxed text-gray-700">{r.overallDiagnosis}</p>
        </div>

        {/* Critical drops */}
        {r.criticalDrops.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-700">Drop nguy hiểm</span>
            {r.criticalDrops.map((t, i) => (
              <span key={i} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-mono font-bold tabular-nums text-red-700 border border-red-200">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Giữ chân tốt</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Nguy cơ TB</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Drop cao</span>
          <span className="ml-auto flex items-center gap-1 text-gray-400">
            <TrendingUp className="h-3 w-3" /> Hover thanh để xem chi tiết segment
          </span>
        </div>
      </div>
    </Section>
  )
}

/* ─── 2. Transcript ─── */
function TranscriptSection({ result }: { result: AnalysisResult }) {
  const { copied, copy } = useCopy()
  const [savingTitle, setSavingTitle] = useState<string | null>(null)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const addToast = useAppStore((s) => s.addToast)
  const addScript = useBankStore((s) => s.addScript)

  const withoutTimestamps = result.transcript.map((l) => l.text).join('\n')

  const handleSendToScriptArchitect = () => {
    sendToApp({
      targetApp: 'script-architect',
      targetField: 'winningTranscript',
      data: withoutTimestamps,
    })
    addToast('Đã gửi lời thoại tới Kịch Bản')
  }

  const handleSaveToBank = () => {
    if (savingTitle !== null) {
      // Confirm save
      const title = savingTitle.trim()
      if (!title) return
      addScript({
        title,
        scriptText: withoutTimestamps,
        linkedProductId: '',
        source: 'manual',
      })
      setSavingTitle(null)
      addToast('Đã lưu lời thoại vào PROJECT kịch bản')
    } else {
      setSavingTitle('')
    }
  }

  return (
    <Section>
      <div className="mb-3 flex items-center justify-between">
        <SectionHeader icon={FileText} title="Lời thoại" />
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => copy(withoutTimestamps)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Đã sao chép' : 'Sao chép'}
          </button>
          <button
            onClick={handleSaveToBank}
            className="flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-black/8 hover:text-gray-800"
          >
            <Save className="h-3 w-3" />
            Lưu vào PROJECT kịch bản
          </button>
          <button
            onClick={handleSendToScriptArchitect}
            className="flex items-center gap-1 rounded-full bg-[#FB2B37]/10 px-2.5 py-1 text-[11px] font-medium text-[#FB2B37] transition-colors hover:bg-[#FB2B37]/20"
          >
            <Send className="h-3 w-3" />
            Gửi tới Kịch Bản
          </button>
        </div>
      </div>

      {/* Save title input */}
      {savingTitle !== null && (
        <div className="mb-3 flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-2">
          <input
            value={savingTitle}
            onChange={(e) => setSavingTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveToBank(); if (e.key === 'Escape') setSavingTitle(null) }}
            autoFocus
            placeholder="Nhập tiêu đề kịch bản..."
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
          />
          <button
            onClick={handleSaveToBank}
            disabled={!savingTitle.trim()}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-30"
          >
            Lưu
          </button>
          <button
            onClick={() => setSavingTitle(null)}
            className="rounded-full px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            Hủy
          </button>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {result.transcript.map((line, i) => (
          <div key={i} className="flex gap-3 rounded-lg px-3 py-1.5 transition-colors hover:bg-black/[0.03]">
            <span className="shrink-0 tabular-nums text-[11px] text-gray-300">{line.timestamp}</span>
            <span className="text-sm text-gray-600">{line.text}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ─── 3. Hook Breakdown ─── */
function HookSection({ result }: { result: AnalysisResult }) {
  const { hookBreakdown } = result
  return (
    <Section>
      <SectionHeader icon={Anchor} title="Phân tích Hook" />
      <div className="flex flex-col gap-4">
        {/* Large italic hook text with green left border */}
        <div className="border-l-2 border-emerald-400/40 pl-4 py-1">
          <p className="text-lg font-medium italic leading-relaxed text-gray-800" style={{ fontFamily: 'Georgia, serif' }}>
            &ldquo;{hookBreakdown.hookText}&rdquo;
          </p>
        </div>
        {/* Two columns: Technique + Why It Works */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Kỹ thuật</span>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{hookBreakdown.technique}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Tại sao hiệu quả</span>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{hookBreakdown.whyItWorks}</p>
          </div>
        </div>
        {/* Highlighted "How to Adapt" card */}
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-4 py-3">
          <span className="text-[11px] font-medium uppercase tracking-widest text-emerald-400/60">Cách áp dụng</span>
          <p className="mt-1.5 text-sm font-medium text-gray-700">{hookBreakdown.adaptableTemplate}</p>
        </div>
      </div>
    </Section>
  )
}

/* ─── 4. Structure Map ─── */
function StructureSection({ result }: { result: AnalysisResult }) {
  const { structureMap } = result
  return (
    <Section>
      <SectionHeader icon={Map} title="Sơ đồ cấu trúc" />
      <div className="mb-4 flex gap-4">
        <Pill label="Thời lượng" value={structureMap.runtime} />
        <Pill label="Nhịp độ" value={structureMap.pacing} />
      </div>
      <div className="overflow-hidden rounded-lg border border-black/8">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/8 bg-black/[0.03]">
              <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-gray-400">Thời gian</th>
              <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-gray-400">Beat</th>
              <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-gray-400">Mô tả</th>
              <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-widest text-gray-400">TL.</th>
            </tr>
          </thead>
          <tbody>
            {structureMap.beats.map((beat, i) => (
              <tr key={i} className="border-b border-white/[0.03] last:border-0">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-xs text-gray-400">{beat.timestamp}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-gray-700">{beat.beat}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{beat.description}</td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-400">{beat.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

/* ─── 5. Psychology & Persuasion ─── */
function PsychologySection({ result }: { result: AnalysisResult }) {
  const { psychology } = result
  return (
    <Section>
      <SectionHeader icon={Brain} title="Tâm lý & Thuyết phục" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Đòn tâm lý chính</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {psychology.primaryLevers.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FB2B37]/50" />
                {l}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">Tín hiệu nhắm mục tiêu</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {psychology.targetingSignals.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400/50" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}

/* ─── 6. Visual Playbook ─── */
function VisualFrameCard({ frame }: { frame: { timestamp: string; description: string; prompt: string } }) {
  const { copied, copy } = useCopy()
  return (
    <div className="rounded-lg border border-black/8 bg-black/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-black/5 px-2 py-0.5 tabular-nums text-[10px] text-gray-400">{frame.timestamp}</span>
          <span className="text-xs font-medium text-gray-700">{frame.description}</span>
        </div>
        <button
          onClick={() => copy(frame.prompt)}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>
      </div>
      <div className="rounded-lg bg-gray-100 px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-widest text-gray-300">Prompt ảnh</span>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">{frame.prompt}</p>
      </div>
    </div>
  )
}

function VisualSection({ result }: { result: AnalysisResult }) {
  return (
    <Section>
      <SectionHeader icon={Eye} title="Kịch bản hình ảnh" />
      <div className="flex flex-col gap-3">
        {result.visualPlaybook.map((frame, i) => (
          <VisualFrameCard key={i} frame={frame} />
        ))}
      </div>
    </Section>
  )
}

/* ─── 7. Opportunities for Improvement ─── */
function ImprovementsSection({ result }: { result: AnalysisResult }) {
  return (
    <Section>
      <SectionHeader icon={Lightbulb} title="Cơ hội cải thiện" />
      <div className="flex flex-col gap-3">
        {result.improvements.map((imp, i) => (
          <div key={i} className="rounded-lg border border-black/8 bg-black/[0.02] p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-md bg-[#FB2B37]/10 px-3 py-2 border border-[#FB2B37]/20">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FB2B37]" />
              <p className="text-sm font-medium text-[#FB2B37] leading-tight">{imp.weakness}</p>
            </div>
            <div className="rounded-md bg-green-500/5 border border-green-500/10 px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-green-500/60">Cách sửa</span>
              <p className="mt-0.5 text-xs text-gray-600">{imp.fix}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ─── 8. AI Reconstruction Prompt ─── */
function ReconstructionSection({ result }: { result: AnalysisResult }) {
  const { copied, copy } = useCopy()

  return (
    <Section>
      <div className="mb-3 flex items-center justify-between">
        <SectionHeader icon={Bot} title="Prompt tái tạo AI" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => copy(result.reconstructionPrompt)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Đã sao chép' : 'Sao chép prompt'}
          </button>
        </div>
      </div>
      <pre className="whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-xs leading-relaxed text-gray-500">
        {result.reconstructionPrompt}
      </pre>

    </Section>
  )
}

/* ─── Helpers ─── */

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/[0.03] px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">{label}</span>
      <p className="mt-0.5 text-sm text-gray-700">{value}</p>
    </div>
  )
}

/* ─── Main ResultsView ─── */
export default function ResultsView({ result, videoSrc, fileName, onReset }: ResultsViewProps) {
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState(fileName.replace(/\.[^.]+$/, '') || 'Ad Win Template')
  const [saved, setSaved] = useState(false)
  const addTemplate = useAdTemplateStore((s) => s.addTemplate)
  const addToast = useAppStore((s) => s.addToast)

  const handleSaveTemplate = () => {
    const trimmed = templateName.trim()
    if (!trimmed) { addToast('Đặt tên cho template', 'error'); return }
    const analysisText = analysisToPromptText(result)
    const transcript = result.transcript.map((l) => `${l.timestamp} ${l.text}`).join('\n')
    addTemplate(trimmed, analysisText, { videoFileName: fileName, sourceTranscript: transcript })
    setSaved(true)
    setSavingTemplate(false)
    addToast(`✓ Đã lưu Mẫu ADS Win "${trimmed}" — dùng trong UGC Builder`)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      {/* Left column — pinned video */}
      <div className="flex lg:h-full w-full lg:w-1/3 shrink-0 flex-col gap-4 border-b lg:border-b-0 lg:border-r border-black/8 p-4 lg:p-5 min-h-0">
        <div className="flex-1 min-h-0 max-h-48 lg:max-h-none w-full overflow-hidden rounded-xl border border-black/10 bg-black flex items-center justify-center">
          {videoSrc ? (
            <video
              src={videoSrc}
              className="max-h-full max-w-full object-contain"
              controls
            />
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              <p className="text-xs text-white/40">Đang tải lại video...</p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-2 min-w-0">
          <Film className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate text-xs text-gray-500">{fileName}</span>
        </div>

        {/* Save as Ad Win Template */}
        {!savingTemplate ? (
          <button
            onClick={() => setSavingTemplate(true)}
            disabled={saved}
            className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-500/20 disabled:opacity-60"
          >
            {saved ? (
              <><Check className="h-3.5 w-3.5" />Đã lưu Mẫu ADS Win</>
            ) : (
              <><Bookmark className="h-3.5 w-3.5" />Lưu thành Mẫu ADS Win</>
            )}
          </button>
        ) : (
          <div className="shrink-0 rounded-xl border border-violet-300 bg-violet-50 p-3 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
              Đặt tên cho Mẫu ADS Win
            </label>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="VD: BPC-157 Win Format, INFINITY style..."
              autoFocus
              className="w-full rounded-md border border-violet-200 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-violet-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveTemplate}
                className="flex flex-1 items-center justify-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
              >
                <Save className="h-3 w-3" /> Lưu
              </button>
              <button
                onClick={() => setSavingTemplate(false)}
                className="rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
            <p className="text-[10px] text-violet-600">
              Template sẽ dùng được trong UGC Builder — AI đọc analysis này để tạo storyboard cùng style.
            </p>
          </div>
        )}

        <button
          onClick={onReset}
          className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#FB2B37]/20 bg-[#FB2B37]/10 px-4 py-2.5 text-sm font-medium text-[#FB2B37] transition-colors hover:bg-[#FB2B37]/20"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Phân tích video khác
        </button>
      </div>

      {/* Right column — scrollable results */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex flex-col gap-5">
          {/* Z1: Decision Layer + Angle + Awareness + Funnel + Scaling — TOP of results */}
          <DecisionSection result={result} />
          {/* Z3: 1-click cross-app pipeline — directly under verdict so user
              can act immediately. */}
          <CreativeActionBar result={result} />
          <ScorecardSection result={result} />
          {/* Z2: Retention heatmap — visual timeline */}
          <RetentionHeatmapSection result={result} />
          <TranscriptSection result={result} />
          <HookSection result={result} />
          <StructureSection result={result} />
          <PsychologySection result={result} />
          <VisualSection result={result} />
          <ImprovementsSection result={result} />
          <ReconstructionSection result={result} />
        </div>
      </div>
    </div>
  )
}
