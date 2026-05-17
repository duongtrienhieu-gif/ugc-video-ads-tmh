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
import type { AnalysisResult, Variation, GeneratedScript, PipelineMode } from '../types'
import {
  AD_ANGLE_LABEL_VI,
  MARKET_AWARENESS_LABEL_VI,
  FUNNEL_LABEL_VI,
  VERDICT_LABEL_VI,
  RETENTION_RISK_COLOR,
  RETENTION_RISK_LABEL_VI,
  VARIATION_LABEL_VI,
  VARIATION_ACCENT,
} from '../types'
import { generateVariations } from '../services/generateVariations'
import { computeBenchmark, computePatternStats } from '../services/winningPatternStats'
import { useAppStore } from '../../../stores/appStore'
import { useBankStore } from '../../../stores/bankStore'
import { useAdTemplateStore } from '../../../stores/adTemplateStore'
import InlineScriptModal, { type InlineModalContext } from './InlineScriptModal'
import GeneratedScriptCard from './GeneratedScriptCard'

/**
 * Z7 — Inline creative pipeline glue.
 * Every "Tạo …" button across the page calls `openModal(key, mode, sourceContext)`.
 * Generated outputs are stored under `key` and rendered below the calling module
 * by `scriptsFor(key)`. No cross-app redirects for the generation step.
 */
export interface ScriptPipelineHooks {
  openModal: (key: string, mode: PipelineMode, sourceContext: string) => void
  scriptsFor: (key: string) => GeneratedScript[]
  removeScript: (key: string, id: string) => void
  duplicateScript: (key: string, script: GeneratedScript) => void
}

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
  /** Z4: parent persists updated result (with variations) into cache. */
  onResultUpdate?: (next: AnalysisResult) => void
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

/* ─── Z5: CollapsibleSection — text-heavy sections collapse to title + quick-copy ─── */
function CollapsibleSection({
  icon: Icon,
  title,
  subtitle,
  defaultOpen = true,
  copyText,
  copyLabel = 'Copy section',
  className = '',
  badge,
  children,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  defaultOpen?: boolean
  /** When provided, renders a Copy button next to the chevron. */
  copyText?: string
  copyLabel?: string
  className?: string
  /** Optional small badge shown next to title (eg. "Z5", "NEW") */
  badge?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const { copied, copy } = useCopy()

  return (
    <div className={`rounded-xl border border-black/8 bg-black/[0.02] ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <Icon className="h-4 w-4 text-[#FB2B37]/80" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold tracking-tight text-gray-800">{title}</h3>
          {badge && (
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">{badge}</span>
          )}
          {subtitle && (
            <span className="text-[11px] text-gray-400 truncate">· {subtitle}</span>
          )}
        </button>
        {copyText && (
          <button
            onClick={(e) => { e.stopPropagation(); copy(copyText) }}
            title={copyLabel}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">{copied ? 'Đã copy' : copyLabel}</span>
          </button>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-1 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
          aria-label={open ? 'Thu gọn' : 'Mở rộng'}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="border-t border-black/8 px-5 py-4">
          {children}
        </div>
      )}
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
function CreativeActionBar({ result, pipeline }: { result: AnalysisResult; pipeline: ScriptPipelineHooks }) {
  const transcriptText = result.transcript.map((l) => l.text).join('\n')
  const hookText = result.hookBreakdown?.hookText ?? ''
  const visualPlaybookText = (result.visualPlaybook ?? [])
    .slice(0, 10)
    .map((v, i) => `Shot ${i + 1} (${v.timestamp}) — ${v.description}\n${v.prompt}`)
    .join('\n\n')
  const reconstructionPrompt = result.reconstructionPrompt ?? ''

  // ── Source context per mode — fed to Gemini inside the modal ─────────
  const ctxScriptSimilar = `# TRANSCRIPT\n${transcriptText}\n\n# HOOK\n${hookText}\n\n# RECONSTRUCTION\n${reconstructionPrompt}`
  const ctxHookVariants  = `# WINNING HOOK\n${hookText}\n\n# KỸ THUẬT\n${result.hookBreakdown?.technique ?? ''}\n\n# TẠI SAO HIỆU QUẢ\n${result.hookBreakdown?.whyItWorks ?? ''}\n\n# MẪU ÁP DỤNG\n${result.hookBreakdown?.adaptableTemplate ?? ''}`
  const ctxCtaVariants   = `# ORIGINAL HOOK\n${hookText}\n\n# PERSUASION LEVERS\n${(result.psychology?.primaryLevers ?? []).map((l) => `- ${l}`).join('\n')}\n\n# TARGET AUDIENCE\n${(result.psychology?.targetingSignals ?? []).map((l) => `- ${l}`).join('\n')}`
  const ctxStoryboard    = `# RECONSTRUCTION DIRECTIVE\n${reconstructionPrompt}\n\n# STRUCTURE BEATS\n${(result.structureMap?.beats ?? []).map((b) => `${b.timestamp} ${b.beat}: ${b.description}`).join('\n')}`
  const ctxLanding       = `# HOOK\n${hookText}\n\n# STRUCTURE\n${(result.structureMap?.beats ?? []).map((b) => `- ${b.timestamp} ${b.beat}: ${b.description}`).join('\n')}\n\n# RECONSTRUCTION\n${reconstructionPrompt}`
  const ctxScenes        = `# VISUAL PLAYBOOK\n${visualPlaybookText}\n\n# RECONSTRUCTION\n${reconstructionPrompt}`

  const BUTTONS: Array<{ key: string; mode: PipelineMode; icon: React.ElementType; label: string; hint: string; accent: 'violet' | 'emerald' | 'cyan' | 'amber' | 'blue' | 'rose'; context: string }> = [
    { key: 'pipeline:script-similar', mode: 'script-similar', icon: PenLine,        label: 'Tạo script tương tự',  hint: 'Full script — Hook/Body/CTA',         accent: 'violet',  context: ctxScriptSimilar },
    { key: 'pipeline:hook-variants',  mode: 'hook-variants',  icon: Anchor,         label: 'Tạo hook variants',    hint: '5 hook mới từ hook gốc',              accent: 'emerald', context: ctxHookVariants },
    { key: 'pipeline:cta-variants',   mode: 'cta-variants',   icon: Megaphone,      label: 'Tạo CTA variants',     hint: '5 FB primary text',                   accent: 'amber',   context: ctxCtaVariants },
    { key: 'pipeline:storyboard',     mode: 'storyboard',     icon: Film,           label: 'Tạo storyboard',       hint: 'Shot list theo cấu trúc gốc',         accent: 'cyan',    context: ctxStoryboard },
    { key: 'pipeline:landing-page',   mode: 'landing-page',   icon: LayoutTemplate, label: 'Tạo Landing Page',     hint: 'Outline 8 section advertorial',       accent: 'blue',    context: ctxLanding },
    { key: 'pipeline:product-scenes', mode: 'product-scenes', icon: ImageLucide,    label: 'Tạo Product AI scenes',hint: '4 scene briefs lifestyle UGC',        accent: 'rose',    context: ctxScenes },
  ]

  return (
    <Section className="border-pink-200 bg-gradient-to-br from-pink-50/60 to-violet-50/40">
      <div className="mb-3 flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-pink-600" strokeWidth={1.8} />
        <h3 className="text-sm font-bold tracking-tight text-gray-900">AI Creative Control Center — tạo trực tiếp tại đây</h3>
        <span className="ml-auto rounded-full bg-pink-100 px-2 py-0.5 text-[9px] font-bold text-pink-700">
          Z7
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {BUTTONS.map((b) => (
          <ActionTile
            key={b.key}
            icon={b.icon}
            label={b.label}
            hint={b.hint}
            accent={b.accent}
            onClick={() => pipeline.openModal(b.key, b.mode, b.context)}
          />
        ))}
      </div>
      <p className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
        <Zap className="h-3 w-3 text-amber-500" />
        Mỗi nút mở popup chọn sản phẩm + ngôn ngữ + tone — output render NGAY bên dưới, không chuyển trang.
      </p>

      {/* Inline output cards — one stack per pipeline button */}
      {BUTTONS.map((b) => {
        const scripts = pipeline.scriptsFor(b.key)
        if (scripts.length === 0) return null
        return (
          <div key={`out-${b.key}`} className="mt-3 space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-700">
              <Sparkles className="h-3 w-3" /> Output · {b.label} ({scripts.length})
            </p>
            {scripts.map((s) => (
              <GeneratedScriptCard
                key={s.id}
                script={s}
                onRemove={() => pipeline.removeScript(b.key, s.id)}
                onDuplicate={() => pipeline.duplicateScript(b.key, s)}
              />
            ))}
          </div>
        )
      })}
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

/* ─── Z6: Winning Pattern Benchmark ─── */
/**
 * Compares the current analysis against the user's saved Ad Win Templates
 * (adTemplateStore). Shows: percentile rank, score deltas vs baseline,
 * how many saved templates share the same angle/awareness/hook technique,
 * and top patterns across the user's whole database.
 *
 * Empty state when user has 0 saved templates with structured analysis
 * encourages them to start building their Win DB.
 */
function WinningPatternSection({ result }: { result: AnalysisResult }) {
  const templates = useAdTemplateStore((s) => s.templates)
  const benchmark = computeBenchmark(result, templates)
  const stats = computePatternStats(templates)

  // Empty state — user has no saved templates with structured analysis
  if (!benchmark || stats.sampleSize === 0) {
    return (
      <Section className="border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/30">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-amber-600" strokeWidth={1.8} />
          <h3 className="text-sm font-bold tracking-tight text-gray-900">Winning Pattern Database</h3>
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">Z6</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-600">
          Lưu các ads winning bạn phân tích để build database riêng. Mỗi template đóng góp vào benchmark — biết hook nào lặp lại nhiều lần, angle nào win, scaling tier trung bình.
        </p>
        <p className="mt-1 text-[11px] text-amber-700 font-semibold">
          Bấm "Lưu thành Mẫu ADS Win" ở cột trái để bắt đầu DB.
        </p>
      </Section>
    )
  }

  const totalTemplates = templates.length
  const withStructured = stats.sampleSize

  return (
    <Section className="border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/30">
      <div className="mb-3 flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-amber-600" strokeWidth={1.8} />
        <h3 className="text-sm font-bold tracking-tight text-gray-900">Benchmark vs Winning DB</h3>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
          {withStructured} mẫu DB
        </span>
      </div>

      <div className="space-y-3">
        {/* Percentile callout */}
        {benchmark.percentileVsSaved !== null && (
          <div className="rounded-lg border border-amber-200 bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Vị trí ad này trong DB</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-amber-700">{benchmark.percentileVsSaved}%</span>
              <span className="text-xs text-gray-600">
                ads đã lưu có Overall thấp hơn ad này
              </span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500">
              {benchmark.percentileVsSaved >= 75 ? '🚀 Top 25% — scale ngay' :
               benchmark.percentileVsSaved >= 50 ? '✓ Trên trung bình — đáng test' :
               benchmark.percentileVsSaved >= 25 ? '⚠ Dưới trung bình — nên iterate' :
               '⛔ Quá thấp — review trước khi chạy'}
            </p>
          </div>
        )}

        {/* Score deltas vs DB average */}
        {benchmark.scoreDeltas.length > 0 && (
          <div className="rounded-lg border border-black/8 bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              So với trung bình DB ({withStructured} mẫu)
            </p>
            <div className="space-y-1">
              {benchmark.scoreDeltas.map((d) => {
                const isAbove = d.delta > 0
                const isFlat = Math.abs(d.delta) < 0.1
                const color = isFlat ? 'text-gray-500' : isAbove ? 'text-emerald-600' : 'text-red-600'
                const arrow = isFlat ? '·' : isAbove ? '▲' : '▼'
                return (
                  <div key={d.label} className="flex items-center gap-2 text-[11px]">
                    <span className="flex-1 text-gray-700">{d.label}</span>
                    <span className="tabular-nums text-gray-500">{d.current.toFixed(1)} / {d.average.toFixed(1)}</span>
                    <span className={`tabular-nums font-bold ${color} w-12 text-right`}>
                      {arrow} {Math.abs(d.delta).toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pattern matches */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {result.adAngle && (
            <div className="rounded-lg border border-cyan-200 bg-white px-3 py-2.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-700">Angle này</span>
              <p className="mt-1 text-lg font-bold tabular-nums text-cyan-700">
                {benchmark.matchingAngleCount}<span className="text-[10px] text-gray-400">/{withStructured}</span>
              </p>
              <p className="text-[10px] text-gray-500">ads cùng angle trong DB</p>
            </div>
          )}
          {result.hookBreakdown?.technique && benchmark.matchingHookCount > 0 && (
            <div className="rounded-lg border border-violet-200 bg-white px-3 py-2.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-violet-700">Hook pattern</span>
              <p className="mt-1 text-lg font-bold tabular-nums text-violet-700">
                {benchmark.matchingHookCount}<span className="text-[10px] text-gray-400">/{withStructured}</span>
              </p>
              <p className="text-[10px] text-gray-500">ads dùng kỹ thuật tương tự</p>
            </div>
          )}
          {result.marketAwareness && (
            <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700">Awareness</span>
              <p className="mt-1 text-lg font-bold tabular-nums text-amber-700">
                {benchmark.matchingAwarenessCount}<span className="text-[10px] text-gray-400">/{withStructured}</span>
              </p>
              <p className="text-[10px] text-gray-500">ads cùng awareness level</p>
            </div>
          )}
        </div>

        {/* Top patterns across whole DB */}
        {stats.topHookTechniques.length > 0 && (
          <div className="rounded-lg border border-black/8 bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Top hook patterns trong DB</p>
            <ol className="mt-1.5 space-y-0.5">
              {stats.topHookTechniques.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px] text-gray-700">
                  <span className="font-bold tabular-nums text-violet-600 w-5">#{i + 1}</span>
                  <span className="flex-1 truncate">{h.technique}</span>
                  <span className="tabular-nums text-gray-400">{h.count}× xuất hiện</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="text-[10px] text-gray-400 text-center">
          Database hiện có {totalTemplates} mẫu ({withStructured} có analysis đầy đủ) — local-only.
          {totalTemplates < 5 && ' Lưu thêm mẫu để stats chính xác hơn.'}
        </p>
      </div>
    </Section>
  )
}

/* ─── Z4: Variation Engine ─── */
/**
 * Lazy second Gemini call. User clicks "Tạo 5 variations" → ~30-40s gen →
 * 5 paste-ready variant cards (softer / aggressive / luxury / etc.). Each
 * card has copy actions + "Gửi tới Kịch bản". Variations persist into the
 * AnalysisResult via onResultUpdate so they survive F5.
 */
function VariationsSection({
  result, onResultUpdate, pipeline,
}: {
  result: AnalysisResult
  onResultUpdate?: (next: AnalysisResult) => void
  pipeline: ScriptPipelineHooks
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const addToast = useAppStore((s) => s.addToast)

  const variations = result.variations ?? []
  const hasVariations = variations.length > 0

  const runGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const v = await generateVariations(result)
      const nextResult: AnalysisResult = { ...result, variations: v }
      onResultUpdate?.(nextResult)
      addToast(`✨ Đã sinh ${v.length} biến thể script`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      addToast(`Variations lỗi: ${msg}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleSendToScriptArchitect = (variation: Variation) => {
    const blob = `# ${variation.nameVi}\n\n## HOOK\n${variation.hookText}\n\n## SCRIPT\n${variation.scriptText}\n\n## CTA\n${variation.ctaText}\n\n## TONE\n${variation.toneBreakdown}\n\n## PHÙ HỢP\n${variation.recommendedFor}`
    sendToApp({
      targetApp: 'script-architect',
      targetField: 'winningTranscript',
      data: blob,
    })
    addToast(`✨ Đã gửi "${variation.nameVi}" sang Kịch bản`)
  }

  return (
    <Section className="border-fuchsia-200 bg-gradient-to-br from-fuchsia-50/40 to-violet-50/30">
      <div className="mb-3 flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-fuchsia-600" strokeWidth={1.8} />
        <h3 className="text-sm font-bold tracking-tight text-gray-900">Variation Engine — 5 biến thể script khác tone</h3>
        <span className="ml-auto rounded-full bg-fuchsia-100 px-2 py-0.5 text-[9px] font-bold text-fuchsia-700">Z4</span>
      </div>

      {!hasVariations && !generating && (
        <button
          onClick={runGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-fuchsia-300 bg-white px-4 py-6 text-sm font-bold text-fuchsia-700 transition-all hover:bg-fuchsia-50 hover:border-fuchsia-400"
        >
          <Sparkles className="h-4 w-4" />
          Tạo 5 biến thể (softer / aggressive / luxury / scientific / emotional / etc.)
        </button>
      )}

      {generating && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-fuchsia-200 bg-white px-4 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-fuchsia-600" />
          <p className="text-sm font-medium text-gray-700">AI Copywriter đang viết 5 biến thể...</p>
          <p className="text-[11px] text-gray-500">~30-40s · cost ~50% phân tích chính</p>
        </div>
      )}

      {error && !generating && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <p className="font-bold">Lỗi sinh variations</p>
          <p className="mt-0.5">{error}</p>
          <button
            onClick={runGenerate}
            className="mt-2 rounded-md bg-red-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {hasVariations && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {variations.map((v) => (
              <VariationCard
                key={v.id}
                variation={v}
                onSendToScript={() => handleSendToScriptArchitect(v)}
                pipeline={pipeline}
              />
            ))}
          </div>
          <button
            onClick={runGenerate}
            disabled={generating}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-fuchsia-200 bg-white px-3 py-2 text-[11px] font-semibold text-fuchsia-700 hover:bg-fuchsia-50 disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            Tạo lại 5 biến thể khác
          </button>
        </div>
      )}
    </Section>
  )
}

function VariationCard({
  variation, onSendToScript, pipeline,
}: {
  variation: Variation
  onSendToScript: () => void
  pipeline: ScriptPipelineHooks
}) {
  const [expanded, setExpanded] = useState(false)
  const { copied, copy } = useCopy()
  const accent = VARIATION_ACCENT[variation.type] ?? 'border-gray-200 bg-white'

  const copyAll = () => {
    const blob = `${variation.nameVi}\n\nHOOK: ${variation.hookText}\n\nSCRIPT:\n${variation.scriptText}\n\nCTA: ${variation.ctaText}`
    copy(blob)
  }

  return (
    <div className={`rounded-xl border-2 ${accent} p-3`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-900">{VARIATION_LABEL_VI[variation.type]}</p>
          <p className="mt-0.5 text-[10px] text-gray-500 italic">{variation.nameVi}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={copyAll}
            title="Copy toàn bộ"
            className="rounded-md border border-black/10 bg-white p-1 text-gray-600 hover:bg-gray-50"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <button
            onClick={onSendToScript}
            title="Gửi sang Kịch bản"
            className="rounded-md bg-violet-600 p-1 text-white shadow-sm hover:bg-violet-700"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Hook */}
      <div className="mt-2 border-l-2 border-emerald-400/40 pl-2 py-0.5">
        <p className="text-[11px] font-medium italic text-gray-800" style={{ fontFamily: 'Georgia, serif' }}>
          &ldquo;{variation.hookText}&rdquo;
        </p>
      </div>

      {/* Tone + recommendedFor — always shown, compact */}
      <div className="mt-2 grid grid-cols-1 gap-1">
        <p className="text-[10px] leading-snug text-gray-600">
          <span className="font-bold text-gray-700">Tone · </span>{variation.toneBreakdown}
        </p>
        <p className="text-[10px] leading-snug text-violet-700">
          <span className="font-bold">Phù hợp · </span>{variation.recommendedFor}
        </p>
      </div>

      {/* Script + CTA — expandable */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex w-full items-center justify-between text-[10px] font-semibold text-gray-500 hover:text-gray-700"
      >
        <span>{expanded ? '− Thu gọn' : '+ Xem script đầy đủ'}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <div className="rounded bg-white px-2.5 py-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Script</span>
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-700">{variation.scriptText}</p>
          </div>
          <div className="rounded bg-emerald-50 px-2.5 py-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">CTA</span>
            <p className="mt-1 text-[11px] font-semibold text-emerald-800">{variation.ctaText}</p>
          </div>
        </div>
      )}

      {/* Z7: "Dùng cho sản phẩm" — open inline modal pre-loaded with this variant */}
      <button
        onClick={() => {
          const ctx = `# VARIATION TONE: ${VARIATION_LABEL_VI[variation.type]}\n\n# HOOK\n${variation.hookText}\n\n# SCRIPT\n${variation.scriptText}\n\n# CTA\n${variation.ctaText}\n\n# TONE BREAKDOWN\n${variation.toneBreakdown}\n\n# RECOMMENDED FOR\n${variation.recommendedFor}`
          pipeline.openModal(`variation:${variation.id}`, 'variation-script', ctx)
        }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-violet-700"
      >
        <Sparkles className="h-3 w-3" />
        Dùng cho sản phẩm — sinh script đầy đủ
      </button>

      {/* Z7: inline generated outputs for THIS variation */}
      {(() => {
        const out = pipeline.scriptsFor(`variation:${variation.id}`)
        if (out.length === 0) return null
        return (
          <div className="mt-2 space-y-2">
            {out.map((s) => (
              <GeneratedScriptCard
                key={s.id}
                script={s}
                onRemove={() => pipeline.removeScript(`variation:${variation.id}`, s.id)}
                onDuplicate={() => pipeline.duplicateScript(`variation:${variation.id}`, s)}
              />
            ))}
          </div>
        )
      })()}
    </div>
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
function TranscriptSection({ result, pipeline }: { result: AnalysisResult; pipeline: ScriptPipelineHooks }) {
  const { copied, copy } = useCopy()
  const [savingTitle, setSavingTitle] = useState<string | null>(null)
  const addToast = useAppStore((s) => s.addToast)
  const addScript = useBankStore((s) => s.addScript)

  const withoutTimestamps = result.transcript.map((l) => l.text).join('\n')

  const handleCreateSimilarScript = () => {
    const ctx = `# TRANSCRIPT\n${withoutTimestamps}\n\n# HOOK\n${result.hookBreakdown?.hookText ?? ''}\n\n# STRUCTURE\n${(result.structureMap?.beats ?? []).map((b) => `- ${b.timestamp} ${b.beat}: ${b.description}`).join('\n')}\n\n# CTA / RECONSTRUCTION\n${result.reconstructionPrompt ?? ''}`
    pipeline.openModal('transcript', 'transcript-similar', ctx)
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
            Lưu transcript vào PROJECT
          </button>
          <button
            onClick={handleCreateSimilarScript}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-600 to-violet-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition-all hover:from-pink-700 hover:to-violet-700"
          >
            <Sparkles className="h-3 w-3" />
            Chọn sản phẩm + Tạo kịch bản tương tự
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

      {/* Z7: inline generated outputs from "Tạo kịch bản tương tự" */}
      {(() => {
        const out = pipeline.scriptsFor('transcript')
        if (out.length === 0) return null
        return (
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-700">
              <Sparkles className="h-3 w-3" /> Kịch bản tương tự đã tạo ({out.length})
            </p>
            {out.map((s) => (
              <GeneratedScriptCard
                key={s.id}
                script={s}
                onRemove={() => pipeline.removeScript('transcript', s.id)}
                onDuplicate={() => pipeline.duplicateScript('transcript', s)}
              />
            ))}
          </div>
        )
      })()}
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
  const copyText = `# CẤU TRÚC\nThời lượng: ${structureMap.runtime} · Nhịp độ: ${structureMap.pacing}\n\n${structureMap.beats.map((b) => `${b.timestamp} · ${b.beat} (${b.duration}): ${b.description}`).join('\n')}`
  return (
    <CollapsibleSection
      icon={Map}
      title="Sơ đồ cấu trúc"
      subtitle={`${structureMap.runtime} · ${structureMap.beats.length} beats`}
      copyText={copyText}
      copyLabel="Copy structure"
    >
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
    </CollapsibleSection>
  )
}

/* ─── 5. Psychology & Persuasion ─── */
function PsychologySection({ result }: { result: AnalysisResult }) {
  const { psychology } = result
  const copyText = `# TÂM LÝ & THUYẾT PHỤC\n\n## ĐÒN TÂM LÝ\n${psychology.primaryLevers.map((l) => `- ${l}`).join('\n')}\n\n## TÍN HIỆU TARGET\n${psychology.targetingSignals.map((s) => `- ${s}`).join('\n')}`
  return (
    <CollapsibleSection
      icon={Brain}
      title="Tâm lý & Thuyết phục"
      subtitle={`${psychology.primaryLevers.length} đòn · ${psychology.targetingSignals.length} target`}
      copyText={copyText}
      copyLabel="Copy psychology"
    >
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
    </CollapsibleSection>
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
  const copyText = `# KỊCH BẢN HÌNH ẢNH\n\n${result.visualPlaybook.map((f, i) => `## Shot ${i + 1} — ${f.timestamp}\n${f.description}\n\nPrompt: ${f.prompt}`).join('\n\n')}`
  return (
    <CollapsibleSection
      icon={Eye}
      title="Kịch bản hình ảnh"
      subtitle={`${result.visualPlaybook.length} shots`}
      copyText={copyText}
      copyLabel="Copy visual playbook"
      defaultOpen={false}
    >
      <div className="flex flex-col gap-3">
        {result.visualPlaybook.map((frame, i) => (
          <VisualFrameCard key={i} frame={frame} />
        ))}
      </div>
    </CollapsibleSection>
  )
}

/* ─── 7. Opportunities for Improvement ─── */
function ImprovementsSection({ result }: { result: AnalysisResult }) {
  const copyText = `# CƠ HỘI CẢI THIỆN\n\n${result.improvements.map((i, idx) => `${idx + 1}. ĐIỂM YẾU: ${i.weakness}\n   FIX: ${i.fix}`).join('\n\n')}`
  return (
    <CollapsibleSection
      icon={Lightbulb}
      title="Cơ hội cải thiện"
      subtitle={`${result.improvements.length} điểm`}
      copyText={copyText}
      copyLabel="Copy improvements"
    >
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
    </CollapsibleSection>
  )
}

/* ─── 8. Creative Blueprint (was: AI Reconstruction Prompt) — Z5 rename ─── */
function ReconstructionSection({ result }: { result: AnalysisResult }) {
  return (
    <CollapsibleSection
      icon={Bot}
      title="Creative Blueprint"
      subtitle="Directive đầy đủ để tái tạo cho sản phẩm bất kỳ"
      copyText={result.reconstructionPrompt}
      copyLabel="Copy blueprint"
      badge="Z5"
      defaultOpen={false}
    >
      <pre className="whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-xs leading-relaxed text-gray-500">
        {result.reconstructionPrompt}
      </pre>
    </CollapsibleSection>
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
export default function ResultsView({ result, videoSrc, fileName, onReset, onResultUpdate }: ResultsViewProps) {
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState(fileName.replace(/\.[^.]+$/, '') || 'Ad Win Template')
  const [saved, setSaved] = useState(false)
  const addTemplate = useAdTemplateStore((s) => s.addTemplate)
  const addToast = useAppStore((s) => s.addToast)

  // ── Z7: inline creative pipeline state ─────────────────────────────────
  const [modalState, setModalState] = useState<{ key: string; context: InlineModalContext } | null>(null)
  const [scriptsByKey, setScriptsByKey] = useState<Record<string, GeneratedScript[]>>({})

  const pipeline: ScriptPipelineHooks = {
    openModal: (key, mode, sourceContext) => {
      setModalState({ key, context: { mode, sourceContext, sourceFileName: fileName } })
    },
    scriptsFor: (key) => scriptsByKey[key] ?? [],
    removeScript: (key, id) => {
      setScriptsByKey((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).filter((s) => s.id !== id),
      }))
    },
    duplicateScript: (key, script) => {
      const copy: GeneratedScript = {
        ...script,
        id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : `dup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        generatedAt: Date.now(),
      }
      setScriptsByKey((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), copy],
      }))
      addToast('Đã duplicate script')
    },
  }

  const handleGenerated = (script: GeneratedScript) => {
    if (!modalState) return
    const key = modalState.key
    setScriptsByKey((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), script],
    }))
    setModalState(null)
  }

  const handleSaveTemplate = () => {
    const trimmed = templateName.trim()
    if (!trimmed) { addToast('Đặt tên cho template', 'error'); return }
    const analysisText = analysisToPromptText(result)
    const transcript = result.transcript.map((l) => `${l.timestamp} ${l.text}`).join('\n')
    // Z6: persist the FULL structured analysis so it contributes to benchmark stats
    addTemplate(trimmed, analysisText, { videoFileName: fileName, sourceTranscript: transcript, analysis: result })
    setSaved(true)
    setSavingTemplate(false)
    addToast(`✓ Đã lưu Mẫu ADS Win "${trimmed}" — đóng góp vào Winning Pattern DB`)
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
          {/* Z7: AI Creative Control Center — inline generation, no redirect */}
          <CreativeActionBar result={result} pipeline={pipeline} />
          {/* Z6: Winning Pattern benchmark — compare vs user's saved templates */}
          <WinningPatternSection result={result} />
          {/* Z4: Variation Engine — lazy 2nd Gemini call, persisted to cache */}
          <VariationsSection result={result} onResultUpdate={onResultUpdate} pipeline={pipeline} />
          <ScorecardSection result={result} />
          {/* Z2: Retention heatmap — visual timeline */}
          <RetentionHeatmapSection result={result} />
          <TranscriptSection result={result} pipeline={pipeline} />
          <HookSection result={result} />
          <StructureSection result={result} />
          <PsychologySection result={result} />
          <VisualSection result={result} />
          <ImprovementsSection result={result} />
          <ReconstructionSection result={result} />
        </div>
      </div>

      {/* Z7: shared inline modal — opened from every "Tạo …" button */}
      <InlineScriptModal
        open={modalState !== null}
        context={modalState?.context ?? null}
        onClose={() => setModalState(null)}
        onGenerated={handleGenerated}
      />
    </div>
  )
}
