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

import { useState, useRef, useEffect } from 'react'
import {
  Loader2, Sparkles, AlertCircle, ChevronRight, Play, Pause, RotateCcw,
  Check, ThumbsDown, Lock, Unlock, X, Plus, Trash2, Lightbulb, Zap, Wand2,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import {
  COST_MODE_CONFIG, INSERT_STAGE_LABEL_VI,
  estimateInsertCredits, formatCredits, defaultInsertRenderMode,
  type ActionPresetId, type ActionInsertClip, type InsertRenderStage,
  type InsertRenderMode, type V3ClipStatus,
} from '../types'
import { ACTION_PRESETS, ACTION_PRESET_ORDER } from '../services/actionPresets'
import {
  pickTopInsertsForBudget, directScenesWithGemini,
  type InsertSuggestion,
} from '../services/insertSuggester'
import { renderInsert, resumeInsertVideo, listEligibleInsertsForBulk } from '../services/insertRenderer'
import { computeBlockStartTimestamps, computeQuoteTimestamp } from '../services/insertTimingEngine'

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
  const geminiKey   = useSettingsStore((s) => s.geminiApiKey)
  const addToast    = useAppStore((s) => s.addToast)

  const inserts = state.inserts
  const costModeCfg = COST_MODE_CONFIG[state.costMode]
  const maxInserts = costModeCfg.insertCount.max
  const minInserts = costModeCfg.insertCount.min
  const insertResolution =
    state.costMode === 'FULL' ? '1080p' :
    state.costMode === 'STANDARD' ? '720p' :
    '480p'
  // Z39/Z46 — per-insert credit is mode-aware: 'video' = keyframe + 5s Veo i2v
  // (~66cr); 'ken_burns' = keyframe-only (~6cr, the motion is a free local
  // ffmpeg zoom). Default chip shows the Veo price as the headline number.
  const insertCredits = estimateInsertCredits('video')
  // Eligible inserts a "Bulk render" would actually pay for (skips
  // locked/approved/rejected per the Z26 lesson) — and their real summed cost,
  // honouring each card's render mode.
  const bulkEligible = listEligibleInsertsForBulk(inserts)
  const bulkPendingCount = bulkEligible.length
  const bulkCredits = bulkEligible.reduce(
    (sum, it) => sum + estimateInsertCredits(it.renderMode ?? 'video'), 0,
  )

  const overBudget = inserts.length > maxInserts

  // ── Smart suggestions (Gemini semantic, script-language aware) ────────────
  const [suggestions, setSuggestions] = useState<InsertSuggestion[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)

  // ── Free-scene composer (Z42) — the 2 AI presets (CONCEPT_SCENE +
  // PRODUCT_IN_ACTION) need a written scene description, so the manual library
  // opens an inline textarea instead of adding instantly like the 12 fixed
  // presets. `composerPreset` = which free preset's box is open (null = closed).
  const [composerPreset, setComposerPreset] = useState<ActionPresetId | null>(null)
  const [composerText, setComposerText] = useState('')

  // Fetch the director's scene breakdown for the current script. Gemini path
  // when a key exists (reads meaning), keyword fallback otherwise.
  const fetchSuggestions = async (): Promise<InsertSuggestion[]> => {
    const script = state.scriptBrain.script
    if (!script) return []
    if (geminiKey) {
      return directScenesWithGemini({
        geminiKey,
        script,
        lang: state.scriptBrain.outputLang,
        budget: maxInserts,
        floor: minInserts,
      })
    }
    // Offline fallback — keyword match, no padding.
    return pickTopInsertsForBudget(script, maxInserts)
  }

  // Apply a suggestion list straight into the store (replaces current inserts).
  // Anchors each scene to its block's start second so the auto-edit planner
  // places it at the right moment (semantic match → timeline).
  const applySuggestions = (result: InsertSuggestion[]) => {
    if (result.length === 0) return
    const script = state.scriptBrain.script
    const blockStarts = script ? computeBlockStartTimestamps(script) : null
    const items = result.map((s) => {
      // Z42 — anchor to the EXACT second the quoted line is spoken; fall back to
      // the coarse block-start only when the quote can't be located.
      const quoteTs = script ? computeQuoteTimestamp(script, s.quote) : null
      const blockTs = blockStarts && s.anchorBlock ? blockStarts[s.anchorBlock] : null
      return {
        presetId: s.presetId,
        durationSec: s.durationSec ?? ACTION_PRESETS[s.presetId].durationPreset,
        scriptKeyword: s.matchedKeywords[0],
        voiceTimestampSec: quoteTs ?? blockTs,
        conceptPrompt: s.conceptPrompt,
        renderMode: s.renderMode,
      }
    })
    clearAllInserts()
    bulkAddInsertsFromPresets(items)
  }

  // Manual re-run ("Đạo diễn lại"). Fetches + applies + shows the result chips.
  const handleSuggest = async () => {
    const script = state.scriptBrain.script
    if (!script) {
      addToast('Chưa có script — quay lại Bước 1', 'error')
      return
    }
    setIsSuggesting(true)
    try {
      const result = await fetchSuggestions()
      setSuggestions(result)
      if (result.length > 0) {
        applySuggestions(result)
        // Z42 — honest path signal. The Gemini DIRECTOR always sets matchCount=0;
        // the offline KEYWORD path sets matchCount>0. If every result came from
        // keyword matching, the AI director did NOT run (no key, or it failed) —
        // say so instead of falsely claiming "AI đạo diễn".
        const usedKeyword = result.every((r) => r.matchCount > 0)
        if (usedKeyword) {
          addToast(
            geminiKey
              ? '⚠ AI đạo diễn chưa trả được kết quả — đang tạm dò từ khoá (không có cảnh concept/cơ chế). Bấm Đạo diễn lại để thử lại.'
              : '⚠ Chưa có Gemini key trong Cài đặt — chỉ dò từ khoá (không tách được cảnh cơ chế/cảm xúc). Thêm key để AI đạo diễn thật.',
            'info',
          )
        } else {
          const freeCount = result.filter(
            (r) => r.presetId === 'CONCEPT_SCENE' || r.presetId === 'PRODUCT_IN_ACTION',
          ).length
          addToast(
            `✓ AI đạo diễn ${result.length} cảnh theo kịch bản${freeCount > 0 ? ` (${freeCount} cảnh tự do)` : ''}`,
            'success',
          )
        }
      } else {
        addToast(
          geminiKey
            ? 'Kịch bản hơi ngắn — AI chưa tách được cảnh, bạn thêm từ thư viện bên dưới nhé'
            : 'Chưa match được cảnh nào — thêm Gemini key hoặc thêm từ thư viện bên dưới',
          'info',
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Đạo diễn lỗi: ${msg.slice(0, 160)}`, 'error')
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleApplySuggestions = () => {
    if (suggestions.length === 0) return
    applySuggestions(suggestions)
    addToast(`✓ Đã thêm ${suggestions.length} insert từ gợi ý`, 'success')
  }

  // ── Full-auto: direct the scenes ONCE on entry ───────────────────────────
  // The engine is AI-first — landing on this step with a script and no inserts
  // yet auto-runs the director and fills the list. The user only reviews/edits;
  // the preset library below is for manual tweaks, not the starting point.
  // This is a single cheap Gemini text call — NO KIE credits are spent (nothing
  // is rendered until the user explicitly triggers a render).
  const autoRanRef = useRef(false)
  useEffect(() => {
    if (autoRanRef.current) return
    const script = state.scriptBrain.script
    if (!script) return
    // Respect existing work (restored from store / added manually) — don't wipe.
    if (inserts.length > 0) { autoRanRef.current = true; return }
    autoRanRef.current = true
    void (async () => {
      setIsSuggesting(true)
      try {
        const result = await fetchSuggestions()
        if (result.length > 0) {
          setSuggestions(result)
          applySuggestions(result)
          const usedKeyword = result.every((r) => r.matchCount > 0)
          if (usedKeyword) {
            addToast(
              geminiKey
                ? '⚠ AI đạo diễn chưa trả được kết quả — đang tạm dò từ khoá. Bấm Đạo diễn lại để thử lại.'
                : '⚠ Chưa có Gemini key trong Cài đặt — chỉ dò từ khoá. Thêm key để AI đạo diễn thật theo kịch bản.',
              'info',
            )
          } else {
            const freeCount = result.filter(
              (r) => r.presetId === 'CONCEPT_SCENE' || r.presetId === 'PRODUCT_IN_ACTION',
            ).length
            addToast(
              `✓ AI tự đạo diễn ${result.length} cảnh theo kịch bản${freeCount > 0 ? ` (${freeCount} cảnh tự do)` : ''} — soát lại / sửa bên dưới`,
              'success',
            )
          }
        }
      } catch (err) {
        // Z42 — surface the failure (was silent) so a bad Gemini key / network
        // error is visible instead of looking like "AI did nothing".
        const msg = err instanceof Error ? err.message : String(err)
        addToast(`AI đạo diễn lỗi: ${msg.slice(0, 140)} — bấm Đạo diễn lại để thử`, 'error')
      } finally {
        setIsSuggesting(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scriptBrain.script])

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
      renderMode: defaultInsertRenderMode(presetId),
    })
  }

  // Z42 — add one of the 2 free presets (CONCEPT_SCENE / PRODUCT_IN_ACTION)
  // with the user's typed scene description. These need a conceptPrompt, so
  // they come from the composer textarea instead of an instant click.
  const handleAddFreeScene = () => {
    if (!composerPreset) return
    if (inserts.length >= maxInserts) {
      addToast(`Đã đạt giới hạn ${maxInserts} insert cho ${costModeCfg.labelVi} mode`, 'error')
      return
    }
    const text = composerText.trim()
    if (text.length < 4) {
      addToast('Hãy mô tả cảnh bạn muốn (tối thiểu vài từ)', 'error')
      return
    }
    const preset = ACTION_PRESETS[composerPreset]
    addInsert({
      presetId: composerPreset,
      order: inserts.length,
      stage: 'idle',
      status: 'idle',
      durationSec: preset.durationPreset,
      resolution: insertResolution,
      voiceTimestampSec: null,
      renderMode: defaultInsertRenderMode(composerPreset),
      conceptPrompt: text,
    })
    setComposerPreset(null)
    setComposerText('')
  }

  // ── Per-insert render ────────────────────────────────────────────────────

  // Z44 — Render concurrency gate. Manual clicks fire in parallel by default;
  // bursting 5+ Kling submissions at once gets KIE rate-limited (422 / 429 /
  // queue-stuck timeouts). Hard cap at 2 in-flight; additional clicks queue up
  // and start as the earlier ones finish. The user can spam every "Render"
  // button — the gate keeps KIE happy.
  const RENDER_CONCURRENCY = 2
  const renderSlotRef = useRef<{ active: number; queue: Array<() => void> }>({ active: 0, queue: [] })
  const acquireRenderSlot = (insertId: number): Promise<void> => new Promise((resolve) => {
    const ref = renderSlotRef.current
    if (ref.active < RENDER_CONCURRENCY) {
      ref.active++
      resolve()
    } else {
      addToast(`Đã có ${RENDER_CONCURRENCY} render đang chạy — insert #${insertId} xếp hàng đợi`, 'info')
      ref.queue.push(() => { ref.active++; resolve() })
    }
  })
  const releaseRenderSlot = () => {
    const ref = renderSlotRef.current
    ref.active = Math.max(0, ref.active - 1)
    const next = ref.queue.shift()
    if (next) next()
  }

  const handleRenderInsert = async (insertId: number) => {
    if (!kieApiKey) { addToast('Thiếu KIE API key', 'error'); return }
    const insert = inserts.find((it) => it.insertId === insertId)
    if (!insert) return
    const preset = ACTION_PRESETS[insert.presetId]

    // Mark queued state if we have to wait
    patchInsert(insertId, { stage: 'keyframe', status: 'rendering', startedAt: now(), error: undefined })
    await acquireRenderSlot(insertId)

    try {
      const result = await renderInsert({
        kieApiKey,
        presetId: insert.presetId,
        product: preset.needsProduct ? state.inputs.product : null,
        avatar: state.inputs.avatar,
        creatorKeyframeRef: state.creatorVideo?.keyframeRef,
        resolution: insert.resolution,
        conceptPrompt: insert.conceptPrompt,
        renderMode: insert.renderMode ?? 'video',
        durationSec: insert.durationSec,
        onStageUpdate: (update) => {
          patchInsert(insertId, {
            stage: update.stage,
            ...(update.keyframeRef !== undefined        && { keyframeRef: update.keyframeRef }),
            ...(update.keyframePromptUsed !== undefined && { keyframePromptUsed: update.keyframePromptUsed }),
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
      const stack = err instanceof Error ? err.stack : undefined
      console.error(`[INSERT_FAIL insertId=${insertId} presetId=${insert.presetId}] full message:`, msg)
      if (stack) console.error(`[INSERT_FAIL insertId=${insertId}] stack:`, stack)
      patchInsert(insertId, {
        stage: 'failed',
        status: 'failed',
        error: msg.slice(0, 240),
        finishedAt: now(),
      })
      addToast(`Insert lỗi: ${msg}`, 'error')
    } finally {
      releaseRenderSlot()
    }
  }

  // Z38 — RESUME a paid-but-unfinished insert. When a render timed out (or the
  // tab was refreshed) the Kling job kept running on KIE and was already
  // charged. Re-poll the SAME taskId instead of re-submitting → 0 extra credit.
  const handleResumeInsert = async (insertId: number) => {
    if (!kieApiKey) { addToast('Thiếu KIE API key', 'error'); return }
    const insert = inserts.find((it) => it.insertId === insertId)
    if (!insert?.fullTaskId) return
    patchInsert(insertId, { stage: 'video_full', status: 'rendering', error: undefined })
    try {
      const { videoRef } = await resumeInsertVideo({
        kieApiKey,
        taskId: insert.fullTaskId,
        onStageUpdate: (update) => {
          patchInsert(insertId, {
            stage: update.stage,
            ...(update.videoRef !== undefined && { videoRef: update.videoRef }),
          })
        },
      })
      patchInsert(insertId, {
        stage: 'completed',
        status: 'completed',
        videoRef,
        finishedAt: now(),
      })
      addToast('✓ Khôi phục insert thành công (0 credit)', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      patchInsert(insertId, { stage: 'failed', status: 'failed', error: msg.slice(0, 240), finishedAt: now() })
      addToast(`Khôi phục lỗi: ${msg}`, 'error')
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
          <h2 className="text-lg font-bold text-gray-900">Bước 2 — Action Inserts</h2>
          <p className="text-[12px] text-gray-500">
            AI tự đạo diễn cảnh từ kịch bản và đổ danh sách sẵn — bạn chỉ soát lại. Đây là clip ngắn hỗ trợ
            (cầm sản phẩm, mở nắp, point label, cảnh minh hoạ) — không phải B-roll cinematic.
            Giới hạn {minInserts}-{maxInserts} insert · {insertResolution} · mỗi insert {formatCredits(insertCredits)}.
          </p>
          <p className="mt-1 text-[11px] text-amber-700">
            Mỗi insert chỉ render 1 lần (đã bỏ bước preview tốn credit thừa). Nếu render timeout, bấm
            <strong> Khôi phục</strong> trên thẻ để lấy lại video đã trả tiền — không tốn thêm credit.
          </p>
        </div>

        {/* ── Smart suggestions (Gemini semantic) ─────────────────────────── */}
        {state.scriptBrain.script && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  AI đạo diễn — tự tách cảnh theo kịch bản
                </p>
                <p className="mt-0.5 text-[11px] text-gray-600">
                  AI <strong>tự chạy</strong> ngay khi bạn vào bước này: đọc <strong>nghĩa</strong> cả kịch bản,
                  tách cảnh (3-5s/cảnh) và <strong>đổ sẵn danh sách insert bên dưới</strong>. Bạn chỉ soát lại / sửa / xoá.
                  Bấm <strong>Đạo diễn lại</strong> nếu muốn AI thử lại. (Chưa render gì — không tốn KIE credit.)
                </p>
                {suggestions.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {suggestions.map((sug, i) => {
                      const preset = ACTION_PRESETS[sug.presetId]
                      const isConcept = sug.presetId === 'CONCEPT_SCENE' || sug.presetId === 'PRODUCT_IN_ACTION'
                      return (
                        <div
                          key={`${sug.presetId}-${i}`}
                          title={isConcept ? sug.conceptPrompt : sug.reason}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${TONE_BG[preset.tone]}`}
                        >
                          <span className="shrink-0 opacity-50">#{i + 1}</span>
                          <span className="shrink-0">{preset.emoji}</span>
                          <span className="shrink-0">{preset.labelVi}</span>
                          <span className="shrink-0 rounded bg-black/10 px-1 text-[8px]">~{sug.durationSec ?? preset.durationPreset}s</span>
                          {(isConcept ? sug.conceptPrompt : sug.reason) && (
                            <span className="min-w-0 flex-1 truncate font-normal opacity-80">
                              {isConcept ? sug.conceptPrompt : sug.reason}
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-[8px] opacity-70">{Math.round(sug.confidence * 100)}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  onClick={handleSuggest}
                  disabled={isSuggesting}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[12px] font-bold text-amber-700 shadow-sm hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSuggesting
                    ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Đang đạo diễn...</>
                    : <><Wand2 className="mr-1 inline h-3.5 w-3.5" /> {suggestions.length > 0 ? 'Đạo diễn lại' : 'Gợi ý AI'}</>}
                </button>
                {suggestions.length > 0 && (
                  <button
                    onClick={handleApplySuggestions}
                    className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-[12px] font-bold text-white shadow-sm hover:from-amber-600 hover:to-orange-600"
                  >
                    <Zap className="mr-1 inline h-3.5 w-3.5" /> Apply {suggestions.length}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Insert library (12 preset cards) ─────────────────────────────── */}
        <div className="mb-4 rounded-xl border border-black/10 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Thêm thủ công — thư viện preset ({ACTION_PRESET_ORDER.length})
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

          {/* ── 2 AI free presets — need a written scene description (Z42) ──── */}
          <div className="mt-4 border-t border-dashed border-black/10 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Cảnh tự do (bạn tự mô tả)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['CONCEPT_SCENE', 'PRODUCT_IN_ACTION'] as ActionPresetId[]).map((p) => {
                const preset = ACTION_PRESETS[p]
                const isOpen = composerPreset === p
                return (
                  <button
                    key={p}
                    onClick={() => {
                      setComposerPreset(isOpen ? null : p)
                      setComposerText('')
                    }}
                    disabled={inserts.length >= maxInserts}
                    title={preset.descriptionVi}
                    className={`flex items-start gap-2 rounded-lg border p-2 text-left transition-all ${
                      isOpen
                        ? TONE_BG[preset.tone]
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span className="text-xl leading-none">{preset.emoji}</span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold leading-tight">{preset.labelVi}</span>
                      <span className="block text-[10px] leading-tight text-gray-500">{preset.descriptionVi}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {composerPreset && (
              <div className="mt-2 rounded-lg border border-black/10 bg-gray-50 p-2">
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  rows={2}
                  placeholder={
                    composerPreset === 'PRODUCT_IN_ACTION'
                      ? 'Mô tả cảnh sản phẩm hoạt động thật — ví dụ: máy xay đang xay đá, kem được thoa lên da, máy khoan bắt vít…'
                      : 'Mô tả cảnh minh hoạ (không có sản phẩm) — ví dụ: ruột khoẻ mạnh nhìn từ bên trong, người mệt mỏi buổi sáng, cánh đồng nguyên liệu…'
                  }
                  className="w-full resize-none rounded-md border border-gray-200 bg-white p-2 text-[12px] text-gray-800 outline-none focus:border-violet-400"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setComposerPreset(null); setComposerText('') }}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-100"
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleAddFreeScene}
                    disabled={composerText.trim().length < 4 || inserts.length >= maxInserts}
                    className="rounded-md bg-violet-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="mr-0.5 inline h-3 w-3" /> Thêm cảnh
                  </button>
                </div>
              </div>
            )}
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
                  onSetMode={(mode) => patchInsert(insert.insertId, { renderMode: mode })}
                  onRender={() => handleRenderInsert(insert.insertId)}
                  onResume={() => handleResumeInsert(insert.insertId)}
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
                  <Sparkles className="h-3.5 w-3.5" /> Bulk render{bulkPendingCount > 0 ? ` · ${formatCredits(bulkCredits)}` : ''}
                </button>
                <button
                  onClick={onContinue}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
                >
                  Tiếp tục → Video Creator <ChevronRight className="h-3.5 w-3.5" />
                </button>
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
  onSetMode, onRender, onResume, onApprove, onReject, onLock, onUnlock, onRemove,
}: {
  insert: ActionInsertClip
  onSetMode: (mode: InsertRenderMode) => void
  onRender: () => void
  onResume: () => void
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
  const mode: InsertRenderMode = insert.renderMode ?? 'video'
  const canEditMode = !isLoading && !hasVideo && insert.status !== 'locked'
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
              autoPlay
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
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
          <>
            <img src={keyframeUrl} alt={preset.labelVi} className="h-full w-full object-cover opacity-90" />
            {/* Z45 — when keyframe is done but video FAILED, the card otherwise
                looks identical to "not yet rendered" (just an image + Render
                button), which made users think the still image WAS the final
                result. Overlay a clear failure banner so the retry intent is
                obvious. */}
            {insert.stage === 'failed' && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-red-600/85 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                <AlertCircle className="h-3 w-3" />
                <span className="line-clamp-1">Video lỗi — bấm Render để thử lại</span>
              </div>
            )}
            {insert.stage !== 'failed' && !hasVideo && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-amber-500/85 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                <span>Mới có ảnh keyframe · bấm Render để tạo video</span>
              </div>
            )}
          </>
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
        {(insert.presetId === 'CONCEPT_SCENE' || insert.presetId === 'PRODUCT_IN_ACTION') && insert.conceptPrompt && (
          <p
            title={insert.conceptPrompt}
            className="mt-0.5 line-clamp-2 font-normal italic leading-tight text-sky-700"
          >
            {insert.conceptPrompt}
          </p>
        )}
        <div className="mt-0.5 flex items-center justify-between text-gray-500">
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[insert.status]}`} />
            {insert.durationSec.toFixed(1)}s
          </span>
          {insert.voiceTimestampSec != null && (
            <span className="text-violet-600">@{insert.voiceTimestampSec.toFixed(1)}s</span>
          )}
        </div>

        {/* Z39/Z46 — render-mode toggle: Ken Burns still (cheap, ~6cr, free
            local zoom) vs Veo i2v (~66cr). Editable only before render. */}
        <div className="mt-1 flex items-center gap-1">
          {canEditMode ? (
            <div className="inline-flex overflow-hidden rounded-md border border-gray-200">
              <button
                onClick={() => onSetMode('ken_burns')}
                title="Ảnh tĩnh + zoom nhẹ (ffmpeg local, ~6 credit). Hợp cảnh concept/thành phần."
                className={`px-1.5 py-0.5 text-[9px] font-bold ${
                  mode === 'ken_burns' ? 'bg-sky-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                🖼 Ảnh
              </button>
              <button
                onClick={() => onSetMode('video')}
                title="Video Veo 3.1 Fast 5s (~66 credit). Hợp cảnh có chuyển động/người thật."
                className={`px-1.5 py-0.5 text-[9px] font-bold ${
                  mode === 'video' ? 'bg-pink-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                🎬 Video
              </button>
            </div>
          ) : (
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
              mode === 'ken_burns' ? 'bg-sky-100 text-sky-700' : 'bg-pink-100 text-pink-700'
            }`}>
              {mode === 'ken_burns' ? '🖼 Ảnh (Ken Burns)' : '🎬 Video (Veo)'}
            </span>
          )}
          <span className="ml-auto text-[9px] font-semibold text-gray-400">
            {formatCredits(estimateInsertCredits(mode)).replace(/ \(.*\)$/, '')}
          </span>
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
            {!hasVideo && insert.fullTaskId && (
              <button
                onClick={onResume}
                title="Khôi phục video đã trả tiền (re-poll taskId, 0 credit)"
                className="flex items-center justify-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50"
              >
                <RotateCcw className="h-3 w-3" /> Khôi phục
              </button>
            )}
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
