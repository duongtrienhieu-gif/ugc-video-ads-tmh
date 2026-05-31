// ── ScriptVoicePhase ─────────────────────────────────────────────────────────
// Z31 §9 — Ad Brain UI. Pick structure + angle + duration, click Generate,
// edit blocks, pick a hook variant, see voice category match, preview timing.
//
// Flow:
//   1. Top: 3 pickers (Structure / Angle / Duration)
//   2. Click [Tạo script] → Gemini call → fill 5 blocks + 3 hook variants
//   3. Hook chooser: 3 variant cards, click to swap into HOOK block
//   4. 5 block cards: editable textareas with per-block target vs est duration
//   5. Voice match card: shows auto-suggested category, user can override
//   6. Bottom: total duration + target vs actual + Continue button
//
// NO voice TTS yet (deferred to later — needs ElevenLabs wiring). The
// VOICE step in this phase is currently SUGGESTED CATEGORY only.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useEffect } from 'react'
import {
  Loader2, Sparkles, Wand2, RefreshCw, ChevronRight, AlertCircle,
  Clock, Mic2, FileText, Lightbulb, Edit3, Globe, PenLine,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import {
  SCRIPT_BLOCK_ORDER, SCRIPT_BLOCK_LABEL_VI, HOOK_STYLE_LABEL_VI,
  SCRIPT_LANG_LABEL_VI,
  type AdStructure, type AdAngle, type ScriptTargetDurationSec,
  type VoiceCategoryId, type ScriptLang,
} from '../types'
import { AD_STRUCTURES, AD_STRUCTURE_ORDER } from '../services/adStructures'
import { AD_ANGLES, AD_ANGLE_ORDER } from '../services/adAngles'
import { VOICE_CATEGORIES, VOICE_CATEGORY_ORDER } from '../services/voiceCategories'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'
import {
  recomputeBlockDurations, estimateReadDurationForVoice,
  computeDurationVariance, blockTargetDuration,
} from '../services/voiceTimingEstimator'
import { generateScript, detectCertClaims } from '../services/scriptGenerator'

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

export default function ScriptVoicePhase({ onContinue }: Props) {
  const state    = useAdsVideoStore((s) => s.state)
  const setAdStructure = useAdsVideoStore((s) => s.setAdStructure)
  const setAdAngle     = useAdsVideoStore((s) => s.setAdAngle)
  const setTargetDurationSec = useAdsVideoStore((s) => s.setTargetDurationSec)
  const setOutputLang        = useAdsVideoStore((s) => s.setOutputLang)
  const setUseOwnScript      = useAdsVideoStore((s) => s.setUseOwnScript)
  const setScript            = useAdsVideoStore((s) => s.setScript)
  const setGeneratedScript   = useAdsVideoStore((s) => s.setGeneratedScript)
  const setHookVariants      = useAdsVideoStore((s) => s.setHookVariants)
  const pickHookVariant      = useAdsVideoStore((s) => s.pickHookVariant)
  const patchScriptBlock     = useAdsVideoStore((s) => s.patchScriptBlock)
  const setScriptTotalDuration = useAdsVideoStore((s) => s.setScriptTotalDuration)
  const setVoiceCategory     = useAdsVideoStore((s) => s.setVoiceCategory)
  const setIsGeneratingScript = useAdsVideoStore((s) => s.setIsGeneratingScript)
  const setScriptBrainError  = useAdsVideoStore((s) => s.setScriptBrainError)

  const geminiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast  = useAppStore((s) => s.addToast)

  const brain = state.scriptBrain

  // Phase 1 — kịch bản là MỘT nguồn duy nhất: state.inputs.script (chọn/dán ở
  // Bước 1). Nếu người dùng mang sẵn kịch bản sang đây thì mặc định BẬT chế độ
  // "Dùng kịch bản của tôi" để khỏi phải gõ lại. Chỉ chạy 1 lần khi vào bước —
  // người dùng vẫn có thể tắt để cho AI tự viết.
  useEffect(() => {
    if (state.inputs.script.trim().length > 0 && !brain.useOwnScript) {
      setUseOwnScript(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-suggest voice category whenever avatar or angle changes — but only
  // overwrite if user hasn't explicitly picked one yet.
  const suggestedCategory = useMemo(
    () => matchVoiceForAvatar(state.inputs.avatar, brain.angle),
    [state.inputs.avatar, brain.angle],
  )
  const effectiveCategory: VoiceCategoryId = brain.voiceCategory ?? suggestedCategory

  // Recompute block durations whenever voice category changes (different
  // WPM → different read durations).
  const variance = brain.script ? computeDurationVariance(brain.script) : null
  const certClaims = brain.script ? detectCertClaims(brain.script) : []

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!geminiKey) {
      addToast('Chưa có Gemini API key trong Settings', 'error')
      return
    }
    if (!state.inputs.product) {
      addToast('Chưa pick product — quay lại bước 1', 'error')
      return
    }
    if (brain.useOwnScript && state.inputs.script.trim().length === 0) {
      addToast('Bạn đã bật "Dùng kịch bản của tôi" nhưng chưa có nội dung — dán/chọn kịch bản ở Bước 1 hoặc ngay bên dưới', 'error')
      return
    }

    setIsGeneratingScript(true)
    setScriptBrainError(null)
    try {
      const productPitch =
        (state.inputs.product as { jsonProfile?: { pitch?: string } }).jsonProfile?.pitch ??
        'Premium UGC product for Malaysian/Vietnamese market.'
      const creatorDescription = state.inputs.avatar
        ? `${state.inputs.avatar.name ?? 'Creator'} — ${state.inputs.avatar.notes ?? 'natural casual UGC vibe'}`
        : undefined

      const result = await generateScript({
        geminiKey,
        structure: brain.structure,
        angle: brain.angle,
        targetDurationSec: brain.targetDurationSec,
        productName: state.inputs.product.productName ?? 'Product',
        productPitch,
        creatorDescription,
        lang: brain.outputLang,
        useOwnScript: brain.useOwnScript,
        ownScriptText: state.inputs.script,
      })

      // Recompute block durations against the effective voice category
      const refined = recomputeBlockDurations(result.script, effectiveCategory)
      setGeneratedScript(refined)
      setHookVariants(result.hookVariants)
      pickHookVariant(-1)  // start with the script's own HOOK
      addToast(
        `✓ Script ${refined.totalDurationSec.toFixed(1)}s / target ${refined.targetDurationSec}s · ${result.hookVariants.length} hook variants`,
        'success',
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setScriptBrainError(msg.slice(0, 240))
      addToast(`Tạo script lỗi: ${msg}`, 'error')
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const handleBlockEdit = (blockIdx: number, text: string) => {
    if (!brain.script) return
    const est = estimateReadDurationForVoice(text, effectiveCategory)
    patchScriptBlock(blockIdx, { text, estDurationSec: est })
    // Recompute total
    const newBlocks = brain.script.blocks.map((b, i) =>
      i === blockIdx ? { ...b, text, estDurationSec: est } : b,
    )
    const total = Number(newBlocks.reduce((sum, b) => sum + b.estDurationSec, 0).toFixed(2))
    setScriptTotalDuration(total)
  }

  const handleSwapVoiceCategory = (cat: VoiceCategoryId) => {
    setVoiceCategory(cat)
    // Recompute block durations with new WPM
    if (brain.script) {
      const refined = recomputeBlockDurations(brain.script, cat)
      setGeneratedScript(refined)
    }
  }

  const canContinue = !!brain.script && brain.script.blocks.every((b) => b.text.trim().length > 0)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 2 — Script + Voice (Ad Brain)</h2>
          <p className="text-[12px] text-gray-500">
            Chọn structure + angle + thời lượng + ngôn ngữ → Gemini sinh script TikTok-native + 3 hook variants.
            Hoặc bật "Dùng kịch bản của tôi" để giữ nguyên 100% câu chữ của bạn.
            Voice (TTS thực) sẽ render ở Phase 3 — phase này chỉ chốt timing.
          </p>
        </div>

        {/* ── Pickers row: Structure + Angle + Duration ─────────────────── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <PickerCard title="Cấu trúc ad" icon={Lightbulb}>
            <div className="grid grid-cols-2 gap-1.5">
              {AD_STRUCTURE_ORDER.map((s) => {
                const cfg = AD_STRUCTURES[s]
                const isActive = brain.structure === s
                return (
                  <button
                    key={s}
                    onClick={() => setAdStructure(s as AdStructure)}
                    title={cfg.descriptionVi}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition-all ${
                      isActive ? TONE_BG[cfg.tone] : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm">{cfg.emoji}</span>
                    <span className="truncate">{cfg.labelVi}</span>
                  </button>
                )
              })}
            </div>
          </PickerCard>

          <PickerCard title="Ad Angle (tone)" icon={Wand2}>
            <div className="grid grid-cols-2 gap-1.5">
              {AD_ANGLE_ORDER.map((a) => {
                const cfg = AD_ANGLES[a]
                const isActive = brain.angle === a
                return (
                  <button
                    key={a}
                    onClick={() => setAdAngle(a as AdAngle)}
                    title={cfg.descriptionVi}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition-all ${
                      isActive ? TONE_BG[cfg.tone] : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm">{cfg.emoji}</span>
                    <span className="truncate">{cfg.labelVi}</span>
                  </button>
                )
              })}
            </div>
          </PickerCard>

          <PickerCard title="Thời lượng target" icon={Clock}>
            <div className="grid grid-cols-4 gap-1.5">
              {([15, 30, 45, 60] as ScriptTargetDurationSec[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setTargetDurationSec(d)}
                  className={`rounded-lg border px-2 py-2 text-center text-[12px] font-bold transition-all ${
                    brain.targetDurationSec === d
                      ? 'border-violet-400 bg-violet-100 text-violet-800'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              Voice = master timeline — mọi clip sau sẽ sync vào thời lượng này.
            </p>
          </PickerCard>
        </div>

        {/* ── Output language + own-script source ─────────────────────────── */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-white p-3">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ngôn ngữ output</p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(['ms', 'vi', 'en'] as ScriptLang[]).map((lng) => (
                <button
                  key={lng}
                  onClick={() => setOutputLang(lng)}
                  className={`rounded-lg border px-2 py-2 text-center text-[12px] font-bold transition-all ${
                    brain.outputLang === lng
                      ? 'border-violet-400 bg-violet-100 text-violet-800'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {SCRIPT_LANG_LABEL_VI[lng]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              Mỗi lần tạo chỉ dùng 1 ngôn ngữ — script, voice và keyword B-Roll đều khóa theo ngôn ngữ này. Không trộn ngôn ngữ.
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-3">
            <button
              onClick={() => setUseOwnScript(!brain.useOwnScript)}
              className="flex w-full items-center gap-2 text-left"
            >
              <PenLine className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Dùng kịch bản của tôi</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                brain.useOwnScript ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {brain.useOwnScript ? 'BẬT' : 'TẮT'}
              </span>
            </button>
            {brain.useOwnScript ? (
              <>
                <textarea
                  value={state.inputs.script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={5}
                  placeholder="Kịch bản từ Bước 1 sẽ hiện ở đây. Hoặc dán nguyên văn vào — Gemini chỉ chia thành 5 phần (hook / pain / discovery / benefit / cta), KHÔNG viết lại, KHÔNG dịch, giữ nguyên từng chữ."
                  className="mt-2 w-full resize-y rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[12px] leading-relaxed focus:border-violet-400 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  Đây là cùng một kịch bản với Bước 1 — sửa ở đây cũng cập nhật ở đó. Giữ nguyên 100% câu chữ; nhớ chọn đúng ngôn ngữ output bên trái cho khớp.
                </p>
              </>
            ) : (
              <p className="mt-2 text-[10px] text-gray-400">
                Đang tắt — Gemini tự viết script mới theo cấu trúc + angle + thời lượng bạn chọn ở trên.
              </p>
            )}
          </div>
        </div>

        {/* ── Generate button + error ────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {brain.script ? 'Đã có script — bạn có thể tạo lại để thử variant khác' : 'Chưa có script — bấm "Tạo script" để Gemini sinh'}
            </p>
            <p className="text-[11px] text-gray-500">
              {AD_STRUCTURES[brain.structure].labelVi} · {AD_ANGLES[brain.angle].labelVi} · {brain.targetDurationSec}s
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={
              brain.isGeneratingScript || !geminiKey || !state.inputs.product ||
              (brain.useOwnScript && state.inputs.script.trim().length === 0)
            }
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {brain.isGeneratingScript ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</>
            ) : brain.useOwnScript ? (
              <><PenLine className="h-4 w-4" /> Tách kịch bản của tôi</>
            ) : brain.script ? (
              <><RefreshCw className="h-4 w-4" /> Tạo lại</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Tạo script</>
            )}
          </button>
        </div>

        {brain.error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>Lỗi:</strong> {brain.error}
            </div>
          </div>
        )}

        {/* ── Hook variants ───────────────────────────────────────────────── */}
        {brain.hookVariants.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-500">
              3 Hook variants — click để swap vào block HOOK
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              {brain.hookVariants.map((hv, i) => {
                const isActive = brain.pickedHookIdx === i
                return (
                  <button
                    key={i}
                    onClick={() => pickHookVariant(i)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isActive
                        ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                        : 'border-gray-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                        {HOOK_STYLE_LABEL_VI[hv.style]}
                      </span>
                      <span className="text-[10px] text-gray-400">~{hv.estDurationSec.toFixed(1)}s</span>
                    </div>
                    <p className="mt-2 text-[12px] leading-snug text-gray-800">{hv.text}</p>
                  </button>
                )
              })}
              <button
                onClick={() => pickHookVariant(-1)}
                className={`rounded-xl border p-3 text-left text-[11px] transition-all ${
                  brain.pickedHookIdx === -1
                    ? 'border-gray-400 bg-gray-100 ring-2 ring-gray-300'
                    : 'border-dashed border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
                style={{ gridColumn: 'span 1' }}
              >
                <span className="font-bold">↺ Quay lại hook gốc</span>
                <p className="mt-1 text-gray-500">Bỏ override, dùng HOOK block Gemini sinh ban đầu.</p>
              </button>
            </div>
          </div>
        )}

        {/* ── Compliance warning: cert / authority claims ─────────────────── */}
        {certClaims.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold">
                Cảnh báo tuân thủ — script đang nhắc đến: {certClaims.join(', ')}
              </p>
              <p className="mt-0.5 text-amber-800">
                Theo Trade Descriptions Act (Malaysia), chỉ giữ các tuyên bố chứng nhận / phê duyệt
                này nếu bạn có bằng chứng hợp lệ. App không gắn badge chứng nhận. Nên sửa thành trải
                nghiệm cá nhân thay vì tuyên bố được cơ quan công nhận.
              </p>
            </div>
          </div>
        )}

        {/* ── Script blocks (editable) ────────────────────────────────────── */}
        {brain.script && (
          <div className="mt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-500">
              Script — 5 blocks (sửa được)
            </h3>
            <div className="mt-2 space-y-2">
              {brain.script.blocks.map((block, i) => {
                const target = blockTargetDuration(block.id, brain.structure, brain.targetDurationSec)
                const overTarget = block.estDurationSec > target * 1.2
                return (
                  <div key={block.id} className="rounded-xl border border-black/10 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Edit3 className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          {SCRIPT_BLOCK_LABEL_VI[block.id]}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          mục tiêu ~{target.toFixed(1)}s
                        </span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        overTarget ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        ước tính {block.estDurationSec.toFixed(1)}s
                      </span>
                    </div>
                    <textarea
                      value={block.text}
                      onChange={(e) => handleBlockEdit(i, e.target.value)}
                      rows={Math.max(2, Math.ceil(block.text.length / 80))}
                      className="mt-2 w-full resize-y rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[13px] leading-relaxed focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Voice category match ────────────────────────────────────────── */}
        {brain.script && (
          <div className="mt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-gray-500">
              Voice match (AI suggest)
            </h3>
            <div className="mt-2 rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-center gap-3">
                <Mic2 className="h-5 w-5 text-violet-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900">
                    {VOICE_CATEGORIES[effectiveCategory].emoji} {VOICE_CATEGORIES[effectiveCategory].labelVi}
                    {brain.voiceCategory == null && (
                      <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">AUTO</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {VOICE_CATEGORIES[effectiveCategory].descriptionVi}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="self-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Đổi voice:</span>
                {VOICE_CATEGORY_ORDER.map((c) => {
                  const cfg = VOICE_CATEGORIES[c]
                  const isActive = effectiveCategory === c
                  return (
                    <button
                      key={c}
                      onClick={() => handleSwapVoiceCategory(c)}
                      title={cfg.descriptionVi}
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                        isActive ? TONE_BG[cfg.tone] : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {cfg.emoji} {cfg.labelVi}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[10px] text-gray-400">
                ElevenLabs TTS thực sẽ chạy ở Phase 3 khi render creator video. Lúc này chỉ pick category để estimator dùng WPM phù hợp.
              </p>
            </div>
          </div>
        )}

        {/* ── Total duration summary + Continue ───────────────────────────── */}
        {brain.script && variance && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">
                Tổng: {brain.script.totalDurationSec.toFixed(1)}s
                <span className="ml-2 text-[12px] text-gray-500">/ target {brain.script.targetDurationSec}s</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  variance.status === 'on-target' ? 'bg-emerald-100 text-emerald-700' :
                  variance.status === 'over'      ? 'bg-amber-100 text-amber-800' :
                                                    'bg-sky-100 text-sky-800'
                }`}>
                  {variance.status === 'on-target' ? 'Vừa khớp' :
                   variance.status === 'over'      ? `Dài ${variance.deltaSec > 0 ? '+' : ''}${variance.deltaSec.toFixed(1)}s` :
                                                     `Ngắn ${variance.deltaSec.toFixed(1)}s`}
                </span>
              </p>
              <p className="text-[11px] text-gray-500">
                Voice timeline locked ở giá trị này — Phase 3 sẽ render TTS đúng độ dài.
              </p>
            </div>
            <button
              onClick={onContinue}
              disabled={!canContinue}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tiếp tục → Creator video <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Small picker card wrapper ──────────────────────────────────────────────
function PickerCard({
  title, icon: Icon, children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{title}</p>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

// Suppress unused-warning for icons referenced only via dynamic imports
void FileText
void SCRIPT_BLOCK_ORDER
