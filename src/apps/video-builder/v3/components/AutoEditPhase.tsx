// ── AutoEditPhase ────────────────────────────────────────────────────────────
// Z34 Phase 5 UI — the "conversion layer". Pick a style, click Generate,
// see the edit plan visualised as a timeline, then Export (Phase 6).
//
// Layout (top-to-bottom):
//   1. Style picker — 7 editing styles in a card grid
//   2. Subtitle + BGM secondary pickers
//   3. Generate plan button + status
//   4. Plan summary KPI strip — segment count / caption count / zoom
//      count / SFX count / total duration
//   5. Timeline visualiser — colored bars per segment with caption /
//      zoom / SFX markers
//   6. Warnings panel — if planner detected anything off
//   7. Export button (stub — Phase 6 wires ffmpeg.wasm)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import {
  Loader2, Sparkles, AlertCircle, ChevronRight, RotateCcw, Wand2,
  Type, Music2, Zap, Play, Volume2, Megaphone, Download,
  CheckCircle2, XCircle, Eye,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import type {
  AutoEditPlan, EditingStyleId, SubtitleStyleId, BgmStyleId,
} from '../types'
import {
  EDITING_STYLES, EDITING_STYLE_ORDER, SUBTITLE_STYLES,
} from '../services/editingStyles'
import { BGM_CATALOG, BGM_ORDER } from '../services/bgmCatalog'
import { buildAutoEditPlan, validatePlan } from '../services/autoEditPlanner'

const TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  violet:  'bg-violet-100 text-violet-800 border-violet-300',
  amber:   'bg-amber-100 text-amber-800 border-amber-300',
  pink:    'bg-pink-100 text-pink-800 border-pink-300',
  sky:     'bg-sky-100 text-sky-800 border-sky-300',
  rose:    'bg-rose-100 text-rose-800 border-rose-300',
}

interface Props {
  onContinue: () => void
}

export default function AutoEditPhase({ onContinue }: Props) {
  const state = useAdsVideoStore((s) => s.state)
  const setEditingStyle    = useAdsVideoStore((s) => s.setEditingStyle)
  const setSubtitleStyle   = useAdsVideoStore((s) => s.setSubtitleStyle)
  const setBgmStyle        = useAdsVideoStore((s) => s.setBgmStyle)
  const setAutoEditPlan    = useAdsVideoStore((s) => s.setAutoEditPlan)
  const setIsGeneratingPlan = useAdsVideoStore((s) => s.setIsGeneratingPlan)
  const setAutoEditError   = useAdsVideoStore((s) => s.setAutoEditError)
  const addToast           = useAppStore((s) => s.addToast)

  const autoEdit = state.autoEdit
  const styleConfig = EDITING_STYLES[autoEdit.styleId]
  const patchInsert = useAdsVideoStore((s) => s.patchInsert)

  // Review acknowledgment — the user must confirm they watched the rendered
  // clips before a plan can be built. This is the gate that used to be the
  // (removed) standalone "Duyệt / Loại" phase.
  const [reviewedAck, setReviewedAck] = useState(false)

  // Effective BGM = override OR style default
  const effectiveBgmId: BgmStyleId = autoEdit.bgmStyleId ?? styleConfig.defaultBgmStyle

  // ── Pre-flight: do we have what we need? ──────────────────────────────
  const hasCreatorVideo = !!state.creatorVideo?.videoRef
  const hasScript = !!state.scriptBrain.script

  // Every insert that finished rendering (has a videoRef) must be explicitly
  // triaged — approved/locked (included) or rejected (dropped). A freshly
  // rendered insert sits in 'completed' limbo until the user decides; we do
  // NOT silently feed 'completed' clips into the final MP4.
  const renderedInserts = state.inserts.filter((it) => !!it.videoRef)
  const approvedInserts = state.inserts.filter(
    (it) => it.status === 'approved' || it.status === 'locked',
  )
  const untriagedInserts = renderedInserts.filter(
    (it) => it.status !== 'approved' && it.status !== 'locked' && it.status !== 'rejected',
  )
  const allInsertsTriaged = untriagedInserts.length === 0

  // Hard inputs required just to enter the phase.
  const hasInputs = hasCreatorVideo && hasScript
  // Plan can be built only after: inputs present + every rendered insert
  // triaged + the user acknowledged the review.
  const canGenerate = hasInputs && allInsertsTriaged && reviewedAck

  const warnings = useMemo(() => {
    return autoEdit.plan ? validatePlan(autoEdit.plan) : []
  }, [autoEdit.plan])

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleGenerate = () => {
    if (!canGenerate || !state.creatorVideo || !state.scriptBrain.script) return
    setIsGeneratingPlan(true)
    setAutoEditError(null)
    // setTimeout 0 so the spinner gets to paint before the synchronous planner runs
    setTimeout(() => {
      try {
        const plan = buildAutoEditPlan({
          creatorVideo: state.creatorVideo!,
          inserts: approvedInserts,
          script: state.scriptBrain.script!,
          styleId: autoEdit.styleId,
          subtitleStyleId: autoEdit.subtitleStyleId,
          bgmStyleId: autoEdit.bgmStyleId,
        })
        setAutoEditPlan(plan)
        addToast(
          `✓ Edit plan: ${plan.segments.length} segments · ${plan.captions.length} captions · ${plan.punchZooms.length} zooms · ${plan.totalDurationSec.toFixed(1)}s`,
          'success',
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setAutoEditError(msg.slice(0, 240))
        addToast(`Build plan lỗi: ${msg}`, 'error')
      } finally {
        setIsGeneratingPlan(false)
      }
    }, 50)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!hasInputs) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Wand2 className="h-10 w-10 text-gray-300" />
        <h3 className="text-lg font-bold text-gray-900">Chưa đủ input cho Auto Edit</h3>
        <ul className="text-[12px] text-gray-500">
          {!hasCreatorVideo && <li>• Cần creator video (bước 3)</li>}
          {!hasScript && <li>• Cần script (bước 2)</li>}
        </ul>
        <p className="mt-2 text-[11px] text-amber-700">
          Action inserts không bắt buộc (0 inserts cũng OK), nhưng càng nhiều insert đã duyệt thì plan càng đa dạng.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 4 — Auto Edit (conversion layer)</h2>
          <p className="text-[12px] text-gray-500">
            Tạo edit plan TikTok-native: cuts, captions, punch zooms, SFX, BGM, CTA overlay.
            Plan deterministic — không gọi AI ở phase này, free re-roll.
          </p>
        </div>

        {/* ── Clip approval gate (replaces the old Duyệt / Loại phase) ────── */}
        <div className="mb-4 rounded-xl border border-black/10 bg-white p-3">
          <h3 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <Eye className="h-3.5 w-3.5" /> Duyệt clip trước khi dựng
          </h3>

          {/* Creator video — always included, shown for confirmation */}
          <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
            <span className="text-[12px] font-semibold text-violet-900">
              🎬 Video creator chính {state.creatorVideo?.videoRef ? '· đã render' : ''}
            </span>
            <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-800">
              Bắt buộc
            </span>
          </div>

          {/* Rendered inserts — each must be approved or excluded */}
          {renderedInserts.length === 0 ? (
            <p className="px-1 py-1 text-[11px] text-gray-400">
              Chưa có action insert nào được render — plan sẽ chỉ dùng video creator (vẫn OK).
            </p>
          ) : (
            <ul className="space-y-1.5">
              {renderedInserts.map((it) => {
                const included = it.status === 'approved' || it.status === 'locked'
                const excluded = it.status === 'rejected'
                return (
                  <li
                    key={it.insertId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-[12px] text-gray-700">
                      🎞️ Insert #{it.insertId}
                      {excluded && <span className="ml-1 text-[10px] text-gray-400">(đã loại)</span>}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => patchInsert(it.insertId, { status: 'approved' })}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                          included
                            ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Duyệt
                      </button>
                      <button
                        onClick={() => patchInsert(it.insertId, { status: 'rejected' })}
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                          excluded
                            ? 'border-rose-400 bg-rose-100 text-rose-800'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-rose-50'
                        }`}
                      >
                        <XCircle className="h-3 w-3" /> Loại
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {!allInsertsTriaged && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              Còn {untriagedInserts.length} insert chưa duyệt/loại — xử lý hết trước khi dựng.
            </p>
          )}

          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md bg-black/[0.03] px-2 py-1.5 text-[12px] text-gray-700">
            <input
              type="checkbox"
              checked={reviewedAck}
              onChange={(e) => setReviewedAck(e.target.checked)}
              className="h-3.5 w-3.5 accent-violet-600"
            />
            Tôi đã xem và xác nhận các clip ở trên trước khi dựng video cuối.
          </label>
        </div>

        {/* ── 7 Editing styles ───────────────────────────────────────────── */}
        <div className="mb-4">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <Wand2 className="mr-1 inline h-3.5 w-3.5" /> Editing style ({EDITING_STYLE_ORDER.length})
          </h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {EDITING_STYLE_ORDER.map((sid) => {
              const cfg = EDITING_STYLES[sid]
              const isActive = autoEdit.styleId === sid
              return (
                <button
                  key={sid}
                  onClick={() => setEditingStyle(sid as EditingStyleId)}
                  disabled={autoEdit.isGenerating}
                  title={cfg.descriptionVi}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-2 text-left transition-all ${
                    isActive ? `${TONE_BG[cfg.tone]} ring-2 ring-offset-1` : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="flex items-center gap-1 text-sm font-bold">
                    <span className="text-lg">{cfg.emoji}</span> {cfg.labelVi}
                  </span>
                  <span className="line-clamp-2 text-[10px] leading-snug text-gray-500">
                    {cfg.descriptionVi}
                  </span>
                  <span className="flex flex-wrap gap-1 text-[9px] font-bold uppercase tracking-wide opacity-70">
                    <span>cuts {cfg.cutEverySec}s</span>
                    <span>· zoom {Math.round(cfg.zoomIntensity * 100)}%</span>
                    <span>· SFX {Math.round(cfg.sfxDensity * 100)}%</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Subtitle + BGM secondary pickers ───────────────────────────── */}
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-white p-3">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <Type className="h-3.5 w-3.5" /> Subtitle style
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(['bold_creator', 'minimal', 'aggressive_tiktok', 'clean_ugc', 'none'] as SubtitleStyleId[]).map((s) => {
                const cfg = SUBTITLE_STYLES[s]
                const isActive = autoEdit.subtitleStyleId === s
                return (
                  <button
                    key={s}
                    onClick={() => setSubtitleStyle(s)}
                    disabled={autoEdit.isGenerating}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all ${
                      isActive ? 'border-violet-400 bg-violet-100 text-violet-800' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {cfg.labelVi}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-3">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <Music2 className="h-3.5 w-3.5" /> BGM
              <span className="ml-auto text-[9px] normal-case tracking-normal text-gray-400">
                hiện: {BGM_CATALOG[effectiveBgmId].emoji} {BGM_CATALOG[effectiveBgmId].labelVi}
                {autoEdit.bgmStyleId == null && (
                  <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[8px] font-bold text-violet-700">AUTO</span>
                )}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BGM_ORDER.map((b) => {
                const cfg = BGM_CATALOG[b]
                const isActive = autoEdit.bgmStyleId === b
                return (
                  <button
                    key={b}
                    onClick={() => setBgmStyle(b)}
                    disabled={autoEdit.isGenerating}
                    title={cfg.descriptionVi}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                      isActive ? TONE_BG[cfg.tone] : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {cfg.emoji} {cfg.labelVi}
                  </button>
                )
              })}
              <button
                onClick={() => setBgmStyle(null)}
                disabled={autoEdit.isGenerating}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                  autoEdit.bgmStyleId == null ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-dashed border-gray-200 bg-white text-gray-400'
                }`}
              >
                ↺ Auto (theo style)
              </button>
            </div>
          </div>
        </div>

        {/* ── Generate banner ────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {autoEdit.plan ? 'Đã có plan — regenerate để thử style khác' : 'Build edit plan'}
            </p>
            <p className="text-[11px] text-gray-500">
              {approvedInserts.length} insert đã duyệt · {state.scriptBrain.script?.totalDurationSec.toFixed(1)}s voice · {styleConfig.labelVi}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={autoEdit.isGenerating || !canGenerate}
            title={!canGenerate ? 'Duyệt clip + tick xác nhận trước khi dựng' : undefined}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {autoEdit.isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang tính plan...</>
            ) : autoEdit.plan ? (
              <><RotateCcw className="h-4 w-4" /> Build lại</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Build plan</>
            )}
          </button>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {autoEdit.error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div><strong>Lỗi:</strong> {autoEdit.error}</div>
          </div>
        )}

        {/* ── Plan summary + visualiser ───────────────────────────────────── */}
        {autoEdit.plan && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Duration"  value={`${autoEdit.plan.totalDurationSec.toFixed(1)}s`} icon={Play} tone="violet" />
              <Kpi label="Segments"  value={autoEdit.plan.segments.length} icon={Zap} tone="emerald" />
              <Kpi label="Captions"  value={autoEdit.plan.captions.length} icon={Type} tone="amber" />
              <Kpi label="Zooms"     value={autoEdit.plan.punchZooms.length} icon={Zap} tone="pink" />
              <Kpi label="SFX cues"  value={autoEdit.plan.sfxCues.length} icon={Volume2} tone="sky" />
              <Kpi label="CTA"       value={autoEdit.plan.cta ? 'YES' : 'NO'} icon={Megaphone} tone={autoEdit.plan.cta ? 'rose' : 'sky'} />
            </div>

            {warnings.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">Cảnh báo</p>
                <ul className="space-y-0.5 text-[11px] text-amber-900">
                  {warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            <EditTimelineViewer plan={autoEdit.plan} />

            {/* ── Export stub + Continue ─────────────────────────────────── */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-900">
                  ✓ Plan sẵn sàng — sang Export để render MP4 cuối
                </p>
                <p className="text-[11px] text-emerald-700">
                  Plan này deterministic — sửa style + click "Build lại" để re-roll (free, không tốn credit).
                </p>
              </div>
              <button
                onClick={onContinue}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
              >
                <Download className="h-4 w-4" /> Sang Export <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── KPI chip ─────────────────────────────────────────────────────────────

function Kpi({
  label, value, icon: Icon, tone,
}: {
  label: string; value: string | number; icon: React.ElementType; tone: string
}) {
  return (
    <div className={`rounded-xl border p-2 ${TONE_BG[tone] ?? 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <p className="mt-0.5 text-base font-extrabold leading-tight">{value}</p>
    </div>
  )
}

// ── Timeline visualiser ──────────────────────────────────────────────────
// Renders the edit plan as a horizontal ruler with colored segment bars
// + caption ticks + zoom triangles + SFX dots. 100% width = totalDuration.

function EditTimelineViewer({ plan }: { plan: AutoEditPlan }) {
  const total = plan.totalDurationSec
  const pctOf = (sec: number) => `${Math.min(100, (sec / total) * 100)}%`

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        Timeline ({total.toFixed(1)}s)
      </p>

      {/* Segments row */}
      <div className="relative h-8 w-full overflow-hidden rounded-md bg-gray-100">
        {plan.segments.map((seg) => {
          const isInsert = seg.source.kind === 'action_insert'
          return (
            <div
              key={seg.segmentId}
              className={`absolute top-0 h-full ${
                isInsert ? 'bg-pink-400/80 border-x border-pink-600' : 'bg-violet-300/60'
              }`}
              style={{ left: pctOf(seg.startSec), width: pctOf(seg.durationSec) }}
              title={`#${seg.segmentId} ${seg.source.kind === 'action_insert' ? `insert ${seg.source.insertId}` : 'creator'} · ${seg.startSec.toFixed(1)}s → ${(seg.startSec + seg.durationSec).toFixed(1)}s`}
            />
          )
        })}
      </div>
      <p className="mt-1 text-[9px] text-gray-400">
        <span className="inline-block h-2 w-2 rounded bg-violet-300/80 mr-1"></span>Creator
        <span className="ml-3 inline-block h-2 w-2 rounded bg-pink-400/80 mr-1"></span>Insert
      </p>

      {/* Punch zooms row */}
      {plan.punchZooms.length > 0 && (
        <div className="mt-2">
          <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">Punch zooms</p>
          <div className="relative h-3 w-full overflow-visible">
            {plan.punchZooms.map((z, i) => (
              <div
                key={i}
                className="absolute -top-1 h-5 w-px bg-amber-500"
                style={{ left: pctOf(z.startSec) }}
                title={`${z.reason} @ ${z.startSec.toFixed(1)}s · scale ${z.targetScale.toFixed(2)}x`}
              >
                <span className="absolute -top-0.5 -translate-x-1/2 text-[10px]">🔍</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SFX cues row */}
      {plan.sfxCues.length > 0 && (
        <div className="mt-3">
          <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">SFX</p>
          <div className="relative h-3 w-full">
            {plan.sfxCues.map((s, i) => (
              <div
                key={i}
                className="absolute top-0 h-3 w-1 rounded bg-sky-500"
                style={{ left: pctOf(s.startSec) }}
                title={`${s.sfxId} @ ${s.startSec.toFixed(1)}s · vol ${s.volume.toFixed(2)}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Captions row */}
      {plan.captions.length > 0 && (
        <div className="mt-3">
          <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
            Captions ({plan.captions.length})
          </p>
          <div className="relative h-2 w-full overflow-hidden rounded-md bg-gray-50">
            {plan.captions.map((c, i) => (
              <div
                key={i}
                className={`absolute top-0 h-full ${c.emphasised ? 'bg-amber-400' : 'bg-emerald-300'}`}
                style={{
                  left: pctOf(c.startSec),
                  width: `${Math.max(0.2, ((c.endSec - c.startSec) / total) * 100)}%`,
                }}
                title={`"${c.text}" @ ${c.startSec.toFixed(1)}-${c.endSec.toFixed(1)}s${c.emphasised ? ' ★' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* CTA marker */}
      {plan.cta && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-rose-700">
            CTA overlay @ {plan.cta.startSec.toFixed(1)}s — {plan.cta.durationSec.toFixed(1)}s
          </p>
          <p className="mt-0.5 text-[12px] font-bold text-rose-900">"{plan.cta.text}"</p>
          <p className="text-[10px] text-rose-700">
            Animation: {plan.cta.animation} · Style: {plan.cta.style}
          </p>
        </div>
      )}

      {/* BGM row */}
      {plan.bgm && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 p-2 text-[10px]">
          <Music2 className="h-3 w-3 text-violet-700" />
          <span className="font-bold text-violet-900">
            {BGM_CATALOG[plan.bgm.styleId].emoji} {BGM_CATALOG[plan.bgm.styleId].labelVi}
          </span>
          <span className="text-violet-700">
            vol {Math.round(plan.bgm.volume * 100)}% · fade-in {plan.bgm.fadeInSec}s · fade-out {plan.bgm.fadeOutSec}s
          </span>
        </div>
      )}
    </div>
  )
}
