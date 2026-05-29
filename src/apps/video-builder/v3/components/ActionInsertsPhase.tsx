// ── ActionInsertsPhase ───────────────────────────────────────────────────────
// Z33 Phase 4 UI — pick + render action inserts.
//
// Layout (top-to-bottom):
//   1. Smart Suggestions banner — Gemini-free, keyword-based. Scans the
//      Phase 2 script for trigger keywords and recommends preset inserts.
//      One click "Apply N suggestions" bulk-adds them to the inserts list.
//   2. Insert budget chip — cost mode dictates max (TEST=3 / STD=5 / FULL=8).
//   3. 12-preset library — clickable cards. Click = add one insert.
//   4. Per-insert cards — render individually (preview-first). Approve /
//      reject / lock / skip / rerender per Z26 lessons.
//   5. Bulk render banner — renders all idle/failed inserts that haven't
//      been locked or approved.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, useRef, useEffect } from 'react'
import {
  Loader2, Sparkles, AlertCircle, ChevronRight, Play, Pause, RotateCcw,
  Check, ThumbsDown, Lock, Unlock, X, Plus, Trash2, Lightbulb, Zap,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import {
  COST_MODE_CONFIG, INSERT_STAGE_LABEL_VI,
  type ActionPresetId, type ActionInsertClip, type InsertRenderStage,
  type V3ClipStatus,
} from '../types'
import { ACTION_PRESETS, ACTION_PRESET_ORDER } from '../services/actionPresets'
import { pickTopInsertsForBudget } from '../services/insertSuggester'
import { renderInsert, listEligibleInsertsForBulk } from '../services/insertRenderer'

// Wrap Date.now in a non-render-pure call site so react-hooks/purity lint
// doesn't false-positive on usage inside async event handlers below.
const now = () => Date.now()

const TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  violet:  'bg-violet-100 text-violet-800 border-violet-300',
  amber:   'bg-amber-100 text-amber-800 border-amber-300',
  pink:    'bg-pink-100 text-pink-800 border-pink-300',
  sky:     'bg-sky-100 text-sky-800 border-sky-300',
  rose:    'bg-rose-100 text-rose-800 border-rose-300',
}

const STATUS_DOT: Record<V3ClipStatus, string> = {
  idle:      'bg-slate-300',
  rendering: 'bg-violet-500 animate-pulse',
  completed: 'bg-emerald-500',
  approved:  'bg-green-600',
  rejected:  'bg-rose-500',
  locked:    'bg-blue-600',
  failed:    'bg-red-500',
}

const STAGE_BAR_COLOR: Record<InsertRenderStage, string> = {
  idle:           'bg-slate-200',
  keyframe:       'bg-violet-400 animate-pulse',
  preview_motion: 'bg-amber-400 animate-pulse',
  video_full:     'bg-pink-500 animate-pulse',
  completed:      'bg-emerald-500',
  failed:         'bg-red-500',
}

interface Props {
  onContinue: () => void
}

export default function ActionInsertsPhase({ onContinue }: Props) {
  const state = useAdsVideoStore((s) => s.state)
  const bulkAddInsertsFromPresets = useAdsVideoStore((s) => s.bulkAddInsertsFromPresets)
  const addInsert        = useAdsVideoStore((s) => s.addInsert)
  const patchInsert      = useAdsVideoStore((s) => s.patchInsert)
  const removeInsert     = useAdsVideoStore((s) => s.removeInsert)
  const clearAllInserts  = useAdsVideoStore((s) => s.clearAllInserts)

  const kieApiKey   = useSettingsStore((s) => s.kieApiKey)
  const addToast    = useAppStore((s) => s.addToast)

  const inserts = state.inserts
  const costModeCfg = COST_MODE_CONFIG[state.costMode]
  const maxInserts = costModeCfg.insertCount.max
  const minInserts = costModeCfg.insertCount.min
  const insertResolution =
    state.costMode === 'FULL' ? '1080p' :
    state.costMode === 'STANDARD' ? '720p' :
    '480p'

  const overBudget = inserts.length > maxInserts

  // ── Smart suggestions ────────────────────────────────────────────────────
  const suggestions = useMemo(() => {
    if (!state.scriptBrain.script) return []
    return pickTopInsertsForBudget(state.scriptBrain.script, maxInserts)
  }, [state.scriptBrain.script, maxInserts])

  const handleApplySuggestions = () => {
    if (suggestions.length === 0) return
    const items = suggestions.map((s) => ({
      presetId: s.presetId,
      durationSec: ACTION_PRESETS[s.presetId].durationPreset,
      scriptKeyword: s.matchedKeywords[0],
    }))
    clearAllInserts()
    bulkAddInsertsFromPresets(items)
    addToast(`✓ Đã thêm ${items.length} insert từ gợi ý`, 'success')
  }

  const handleAddPreset = (presetId: ActionPresetId) => {
    if (inserts.length >= maxInserts) {
      addToast(`Đã đạt giới hạn ${maxInserts} insert cho ${costModeCfg.labelVi} mode`, 'error')
      return
    }
    const preset = ACTION_PRESETS[presetId]
    addInsert({
      presetId,
      order: inserts.length,
      stage: 'idle',
      status: 'idle',
      durationSec: preset.durationPreset,
      resolution: insertResolution,
      voiceTimestampSec: null,
    })
  }

  // ── Per-insert render ────────────────────────────────────────────────────

  const handleRenderInsert = async (insertId: number) => {
    if (!kieApiKey) { addToast('Thiếu KIE API key', 'error'); return }
    const insert = inserts.find((it) => it.insertId === insertId)
    if (!insert) return
    const preset = ACTION_PRESETS[insert.presetId]

    patchInsert(insertId, {
      stage: 'keyframe',
      status: 'rendering',
      startedAt: now(),
      error: undefined,
    })

    try {
      const result = await renderInsert({
        kieApiKey,
        presetId: insert.presetId,
        product: preset.needsProduct ? state.inputs.product : null,
        avatar: state.inputs.avatar,
        resolution: insert.resolution,
        onStageUpdate: (update) => {
          patchInsert(insertId, {
            stage: update.stage,
            ...(update.keyframeRef !== undefined        && { keyframeRef: update.keyframeRef }),
            ...(update.keyframePromptUsed !== undefined && { keyframePromptUsed: update.keyframePromptUsed }),
            ...(update.previewVideoRef !== undefined    && { previewVideoRef: update.previewVideoRef }),
            ...(update.fullTaskId !== undefined         && { fullTaskId: update.fullTaskId }),
            ...(update.videoRef !== undefined           && { videoRef: update.videoRef }),
          })
        },
      })
      patchInsert(insertId, {
        stage: 'completed',
        status: 'completed',
        videoRef: result.videoRef,
        finishedAt: now(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      patchInsert(insertId, {
        stage: 'failed',
        status: 'failed',
        error: msg.slice(0, 240),
        finishedAt: now(),
      })
      addToast(`Insert lỗi: ${msg}`, 'error')
    }
  }

  const handleApprove = (insertId: number) => patchInsert(insertId, { status: 'approved' })
  const handleReject  = (insertId: number) => patchInsert(insertId, { status: 'rejected' })
  const handleLock    = (insertId: number) => patchInsert(insertId, { status: 'locked' })
  const handleUnlock  = (insertId: number) => patchInsert(insertId, { status: 'completed' })

  const handleBulkRender = async () => {
    const eligible = listEligibleInsertsForBulk(inserts)
    if (eligible.length === 0) {
      addToast('Không có insert nào pending — tất cả đã render / locked / approved', 'info')
      return
    }
    addToast(`🎬 Bulk render ${eligible.length} insert...`)
    for (const it of eligible) {
      // Sequential — keeps cost predictable and avoids KIE rate limits
      await handleRenderInsert(it.insertId)
    }
    addToast(`✓ Bulk render xong ${eligible.length} insert`, 'success')
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const approvedCount = inserts.filter((it) => it.status === 'approved' || it.status === 'locked').length

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 4 — Action Inserts</h2>
          <p className="text-[12px] text-gray-500">
            3-8 clip ngắn hỗ trợ (cầm sản phẩm, mở nắp, point label, etc) — không phải B-roll cinematic.
            Cost mode <strong>{costModeCfg.labelVi}</strong> · giới hạn {minInserts}-{maxInserts} insert · resolution {insertResolution}.
          </p>
        </div>

        {/* ── Smart suggestions banner ────────────────────────────────────── */}
        {suggestions.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  Gợi ý từ script ({suggestions.length} insert tốt nhất)
                </p>
                <p className="mt-0.5 text-[11px] text-gray-600">
                  Quét keyword trong script Phase 2 → chọn preset phù hợp nhất.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestions.map((sug) => {
                    const preset = ACTION_PRESETS[sug.presetId]
                    return (
                      <span
                        key={sug.presetId}
                        title={sug.matchedKeywords.length > 0
                          ? `Match từ: ${sug.matchedKeywords.join(', ')}`
                          : 'Default fill (không có keyword match)'}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                          sug.matchCount > 0 ? TONE_BG[preset.tone] : 'border-gray-200 bg-white text-gray-500'
                        }`}
                      >
                        <span>{preset.emoji}</span>
                        <span>{preset.labelVi}</span>
                        {sug.matchCount > 0 && (
                          <span className="text-[8px] opacity-70">×{sug.matchCount}</span>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
              <button
                onClick={handleApplySuggestions}
                className="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-[12px] font-bold text-white shadow-sm hover:from-amber-600 hover:to-orange-600"
              >
                <Zap className="mr-1 inline h-3.5 w-3.5" /> Apply
              </button>
            </div>
          </div>
        )}

        {/* ── Insert library (12 preset cards) ─────────────────────────────── */}
        <div className="mb-4 rounded-xl border border-black/10 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Thư viện preset ({ACTION_PRESET_ORDER.length})
            </p>
            <p className="text-[10px] text-gray-400">
              Hiện có {inserts.length}/{maxInserts} insert
              {overBudget && <span className="ml-1 text-red-600">— vượt budget!</span>}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
            {ACTION_PRESET_ORDER.map((p) => {
              const preset = ACTION_PRESETS[p]
              const usedCount = inserts.filter((it) => it.presetId === p).length
              return (
                <button
                  key={p}
                  onClick={() => handleAddPreset(p)}
                  disabled={inserts.length >= maxInserts}
                  title={`${preset.descriptionVi}\n\nDuration ~${preset.durationPreset}s`}
                  className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all ${
                    usedCount > 0
                      ? TONE_BG[preset.tone]
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="text-xl">{preset.emoji}</span>
                  <span className="text-[10px] font-bold leading-tight">{preset.labelVi}</span>
                  {usedCount > 0 && (
                    <span className="absolute right-1 top-1 rounded-full bg-violet-600 px-1 text-[8px] font-bold text-white">
                      ×{usedCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Insert cards ─────────────────────────────────────────────────── */}
        {inserts.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Inserts ({inserts.length})
              </p>
              <button
                onClick={clearAllInserts}
                className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="mr-0.5 inline h-3 w-3" /> Xoá hết
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {inserts.map((insert) => (
                <InsertCard
                  key={insert.insertId}
                  insert={insert}
                  onRender={() => handleRenderInsert(insert.insertId)}
                  onApprove={() => handleApprove(insert.insertId)}
                  onReject={() => handleReject(insert.insertId)}
                  onLock={() => handleLock(insert.insertId)}
                  onUnlock={() => handleUnlock(insert.insertId)}
                  onRemove={() => removeInsert(insert.insertId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Bulk render + Continue ───────────────────────────────────────── */}
        {inserts.length > 0 && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  Đã duyệt: {approvedCount}/{inserts.length}
                </p>
                <p className="text-[11px] text-gray-500">
                  Bulk render skip những clip đã locked / approved / rejected (Z26 lesson).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkRender}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-violet-700 hover:to-pink-700"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Bulk render
                </button>
                {approvedCount >= minInserts && (
                  <button
                    onClick={onContinue}
                    className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
                  >
                    Tiếp tục → Preview <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {inserts.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <Plus className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-semibold text-gray-500">Chưa có insert nào</p>
            <p className="mt-1 text-[11px] text-gray-400">
              Pick từ "Thư viện preset" trên hoặc dùng "Apply gợi ý" để auto-fill.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Per-insert card ──────────────────────────────────────────────────────

function InsertCard({
  insert,
  onRender, onApprove, onReject, onLock, onUnlock, onRemove,
}: {
  insert: ActionInsertClip
  onRender: () => void
  onApprove: () => void
  onReject: () => void
  onLock: () => void
  onUnlock: () => void
  onRemove: () => void
}) {
  const preset = ACTION_PRESETS[insert.presetId]
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const resolvedKeyframe = useAssetUrl(insert.keyframeRef ?? undefined)
  const resolvedVideo    = useAssetUrl(insert.videoRef ?? undefined)
  const resolvedPreview  = useAssetUrl(insert.previewVideoRef ?? undefined)

  const keyframeUrl = insert.keyframeRef?.startsWith('http') ? insert.keyframeRef : resolvedKeyframe
  const videoUrl    = insert.videoRef?.startsWith('http')    ? insert.videoRef    : resolvedVideo
  const previewUrl  = insert.previewVideoRef?.startsWith('http') ? insert.previewVideoRef : resolvedPreview

  // Show full video if available; otherwise preview; otherwise keyframe still
  const displayVideoUrl = videoUrl ?? previewUrl

  const isLoading = insert.stage === 'keyframe' || insert.stage === 'preview_motion' || insert.stage === 'video_full'
  const hasVideo = !!insert.videoRef
  const isLocked = insert.status === 'locked'
  const isApproved = insert.status === 'approved'
  const isRejected = insert.status === 'rejected'

  // Auto-rebind src when ref changes
  useEffect(() => {
    if (videoRef.current && displayVideoUrl) {
      videoRef.current.load()
    }
  }, [displayVideoUrl])

  const toggle = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true) }
    else { videoRef.current.pause(); setPlaying(false) }
  }

  const borderCls =
    isLocked   ? 'border-blue-400 ring-2 ring-blue-200/60' :
    isApproved ? 'border-emerald-400 ring-1 ring-emerald-200/40' :
    isRejected ? 'border-rose-300 opacity-70' :
    insert.stage === 'failed' ? 'border-red-300' :
    'border-black/10'

  return (
    <div className={`group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${borderCls}`}>
      <div className="relative aspect-[9/16] bg-gray-100">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center text-violet-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[10px] font-medium">{INSERT_STAGE_LABEL_VI[insert.stage]}</span>
            <div className={`absolute inset-x-0 bottom-0 h-0.5 ${STAGE_BAR_COLOR[insert.stage]}`} />
          </div>
        ) : displayVideoUrl ? (
          <>
            <video
              ref={videoRef}
              src={displayVideoUrl}
              className="h-full w-full object-cover"
              playsInline
              loop
              muted
              onClick={toggle}
              onEnded={() => setPlaying(false)}
            />
            {!playing && (
              <button
                onClick={toggle}
                className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-0 transition-opacity hover:opacity-100"
              >
                <Play className="h-8 w-8 fill-white" />
              </button>
            )}
          </>
        ) : keyframeUrl ? (
          <img src={keyframeUrl} alt={preset.labelVi} className="h-full w-full object-cover opacity-90" />
        ) : insert.stage === 'failed' ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="line-clamp-3 text-[10px] leading-tight">{insert.error ?? 'Render lỗi'}</span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <span className="text-3xl opacity-40">{preset.emoji}</span>
          </div>
        )}

        <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          #{insert.order + 1} {preset.emoji}
        </span>
        {hasVideo && insert.stage === 'completed' && (
          <span className="absolute right-1.5 top-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            ✓ DONE
          </span>
        )}
        {isLocked && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-blue-600/90 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Lock className="h-3 w-3" /> Đã khoá
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="border-t border-black/5 px-2 py-1.5 text-[10px]">
        <p className="font-bold leading-tight text-gray-700">{preset.labelVi}</p>
        <div className="mt-0.5 flex items-center justify-between text-gray-500">
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[insert.status]}`} />
            {insert.durationSec.toFixed(1)}s
          </span>
          {insert.voiceTimestampSec != null && (
            <span className="text-violet-600">@{insert.voiceTimestampSec.toFixed(1)}s</span>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-1 border-t border-black/5 bg-gray-50 px-1.5 py-1.5">
        {isLocked ? (
          <button
            onClick={onUnlock}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-blue-300 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
          >
            <Unlock className="h-3 w-3" /> Mở khoá
          </button>
        ) : isLoading ? (
          <span className="flex-1 px-2 py-1 text-center text-[10px] italic text-gray-400">đang render...</span>
        ) : (
          <>
            <button
              onClick={onRender}
              title={hasVideo ? 'Render lại' : 'Render preview-first'}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
            >
              {hasVideo ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3 fill-white" />}
              {hasVideo ? 'Lại' : 'Render'}
            </button>
            {hasVideo && !isApproved && !isRejected && (
              <>
                <button
                  onClick={onApprove}
                  title="Approve"
                  className="flex items-center justify-center rounded-md border border-emerald-300 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={onReject}
                  title="Reject"
                  className="flex items-center justify-center rounded-md border border-rose-300 bg-white px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <ThumbsDown className="h-3 w-3" />
                </button>
              </>
            )}
            {isApproved && (
              <button
                onClick={onLock}
                title="Lock — không bao giờ rerender"
                className="flex items-center justify-center rounded-md border border-blue-300 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
              >
                <Lock className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={onRemove}
              title="Xoá insert"
              className="flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Suppress unused-warning for icons referenced only via JSX
void Pause
