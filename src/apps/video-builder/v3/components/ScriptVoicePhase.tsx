// ── ScriptVoicePhase (merged Input) ──────────────────────────────────────────
// Z37 — ONE input screen. Was two steps (Bước 1 "Chọn input" + Bước 2
// "Script + Voice / Ad Brain"); merged into a single phase because the
// 5-block breakdown is an INTERNAL data contract the user never needs to see
// or edit (it only drives B-roll placement + timing).
//
// What the user sees here:
//   • Avatar + Product pickers
//   • One big Script textarea (the MAIN input) + auto-detected output language
//   • Voice picker (custom/clone + ElevenLabs library) + auto-suggested category
//   • If script is empty → a small "AI tự viết" panel (structure/angle/length)
//
// One primary button "Tạo & tiếp tục" runs the 5-block segmentation (own
// script) or full generation (empty script) BEHIND THE SCENES, then advances
// to the creator-video phase. The 5 blocks are never rendered. The cert
// compliance guard is preserved (blocks advancing until the user acknowledges).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useEffect, useState } from 'react'
import {
  Loader2, Sparkles, Wand2, RefreshCw, ChevronRight, AlertCircle,
  Clock, Mic2, Lightbulb, Globe, Package, UserRound,
  Library, UserCircle2, Search, Check, Play, Plus, X,
} from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import BankPicker from '../../../../components/BankPicker'
import type { Model, Product } from '../../../../stores/types'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import {
  SCRIPT_LANG_LABEL_VI,
  type AdStructure, type AdAngle, type ScriptTargetDurationSec,
  type VoiceCategoryId, type ScriptLang,
} from '../types'
import { AD_STRUCTURES, AD_STRUCTURE_ORDER } from '../services/adStructures'
import { AD_ANGLES, AD_ANGLE_ORDER } from '../services/adAngles'
import { VOICE_CATEGORIES, VOICE_CATEGORY_ORDER } from '../services/voiceCategories'
import { matchVoiceForAvatar } from '../services/voiceCreatorMatcher'
import { recomputeBlockDurations, estimateReadDurationForVoice } from '../services/voiceTimingEstimator'
import { generateScript, detectCertClaims } from '../services/scriptGenerator'
import {
  listVoices, listSharedVoices, addSharedVoice,
  type ElevenLabsVoice, type SharedVoice,
} from '../../../../utils/elevenlabs'

const TONE_BG: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  violet:  'bg-violet-100 text-violet-800 border-violet-300',
  amber:   'bg-amber-100 text-amber-800 border-amber-300',
  pink:    'bg-pink-100 text-pink-800 border-pink-300',
  sky:     'bg-sky-100 text-sky-800 border-sky-300',
  rose:    'bg-rose-100 text-rose-800 border-rose-300',
}

/** Best-effort language guess so the user rarely has to touch the dropdown.
 *  Vietnamese is unmistakable (diacritics); Malay vs English by common words. */
function detectScriptLang(text: string): ScriptLang | null {
  const t = text.trim()
  if (t.length < 8) return null
  if (/[ăâêôơưđàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i.test(t)) return 'vi'
  if (/\b(yang|dan|saya|untuk|dengan|tak|sangat|boleh|jadi|sebab|memang|kita|nak|lah|ni)\b/i.test(t)) return 'ms'
  return 'en'
}

interface Props {
  onContinue: () => void
}

export default function ScriptVoicePhase({ onContinue }: Props) {
  const state    = useAdsVideoStore((s) => s.state)
  const setAvatar  = useAdsVideoStore((s) => s.setAvatar)
  const setProduct = useAdsVideoStore((s) => s.setProduct)
  const setAdStructure = useAdsVideoStore((s) => s.setAdStructure)
  const setAdAngle     = useAdsVideoStore((s) => s.setAdAngle)
  const setTargetDurationSec = useAdsVideoStore((s) => s.setTargetDurationSec)
  const setOutputLang        = useAdsVideoStore((s) => s.setOutputLang)
  const setUseOwnScript      = useAdsVideoStore((s) => s.setUseOwnScript)
  const setScript            = useAdsVideoStore((s) => s.setScript)
  const setGeneratedScript   = useAdsVideoStore((s) => s.setGeneratedScript)
  const setHookVariants      = useAdsVideoStore((s) => s.setHookVariants)
  const pickHookVariant      = useAdsVideoStore((s) => s.pickHookVariant)
  const setVoiceCategory     = useAdsVideoStore((s) => s.setVoiceCategory)
  const setVoiceId           = useAdsVideoStore((s) => s.setVoiceId)
  const setIsGeneratingScript = useAdsVideoStore((s) => s.setIsGeneratingScript)
  const setScriptBrainError  = useAdsVideoStore((s) => s.setScriptBrainError)

  const geminiKey      = useSettingsStore((s) => s.geminiApiKey)
  const elevenLabsKey  = useSettingsStore((s) => s.elevenLabsApiKey)
  const addToast  = useAppStore((s) => s.addToast)

  const brain = state.scriptBrain
  const hasScriptText = state.inputs.script.trim().length > 0

  const [pickerMode, setPickerMode] = useState<'avatar' | 'product' | 'script' | null>(null)
  const [langTouched, setLangTouched] = useState(false)
  const [acknowledgedCerts, setAcknowledgedCerts] = useState(false)

  // useOwnScript follows the script box: text present → segment it verbatim;
  // empty → let the AI write. Keeps the two paths from needing a manual toggle.
  useEffect(() => {
    if (hasScriptText !== brain.useOwnScript) setUseOwnScript(hasScriptText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasScriptText])

  // Auto-detect output language from the pasted script (unless user overrode).
  useEffect(() => {
    if (langTouched || !hasScriptText) return
    const guess = detectScriptLang(state.inputs.script)
    if (guess && guess !== brain.outputLang) setOutputLang(guess)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.inputs.script, langTouched])

  // Auto-suggest voice category from avatar + angle (used for WPM + fallback voice).
  const suggestedCategory = useMemo(
    () => matchVoiceForAvatar(state.inputs.avatar, brain.angle),
    [state.inputs.avatar, brain.angle],
  )
  const effectiveCategory: VoiceCategoryId = brain.voiceCategory ?? suggestedCategory

  // Live duration estimate from the raw script (own-script path) so the user
  // sees "ad dài ~Xs" before generating — no 5-block view needed.
  const liveDurationSec = useMemo(() => {
    if (!hasScriptText) return null
    return estimateReadDurationForVoice(state.inputs.script, effectiveCategory)
  }, [state.inputs.script, hasScriptText, effectiveCategory])

  const certClaims = brain.script ? detectCertClaims(brain.script) : []

  // ── Asset pickers (BankPicker union → safe cast, one picker open at a time) ──
  const handlePickAvatar  = (item: unknown) => setAvatar(item as Model)
  const handlePickProduct = (item: unknown) => setProduct(item as Product)
  const handlePickScript  = (item: unknown) => {
    const sc = item as { scriptText?: string }
    setScript(sc.scriptText ?? '')
    setLangTouched(false)  // re-detect language for the new script
  }

  // ── Generate (segment own-script OR AI-write) then advance ─────────────────
  const handleGenerateAndContinue = async () => {
    if (!geminiKey) { addToast('Chưa có Gemini API key trong Settings', 'error'); return }
    if (!state.inputs.product) { addToast('Chưa chọn sản phẩm', 'error'); return }
    if (!state.inputs.avatar)  { addToast('Chưa chọn avatar', 'error'); return }

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
        useOwnScript: hasScriptText,
        ownScriptText: state.inputs.script,
      })

      const refined = recomputeBlockDurations(result.script, effectiveCategory)
      setGeneratedScript(refined)
      setHookVariants(result.hookVariants)
      pickHookVariant(-1)

      const claims = detectCertClaims(refined)
      if (claims.length === 0) {
        addToast(`✓ Sẵn sàng — ~${refined.totalDurationSec.toFixed(1)}s`, 'success')
        onContinue()
      } else {
        setAcknowledgedCerts(false)
        addToast('Có cảnh báo tuân thủ — xem lại trước khi tiếp tục', 'info')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setScriptBrainError(msg.slice(0, 240))
      addToast(`Tạo script lỗi: ${msg}`, 'error')
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const handleSwapVoiceCategory = (cat: VoiceCategoryId) => {
    setVoiceCategory(cat)
    if (brain.script) setGeneratedScript(recomputeBlockDurations(brain.script, cat))
  }

  // ── Voice picker (chọn giọng ElevenLabs cụ thể) ───────────────────────────
  const [voicePanelOpen, setVoicePanelOpen] = useState(false)
  const [voiceTab, setVoiceTab]   = useState<'mine' | 'library'>('mine')
  const [myVoices, setMyVoices]   = useState<ElevenLabsVoice[]>([])
  const [loadingMine, setLoadingMine] = useState(false)
  const [sharedVoices, setSharedVoices] = useState<SharedVoice[]>([])
  const [loadingShared, setLoadingShared] = useState(false)
  const [addingId, setAddingId]   = useState<string | null>(null)
  const [libLang, setLibLang]     = useState('ms')
  const [libGender, setLibGender] = useState<'' | 'male' | 'female'>('')
  const [libSearch, setLibSearch] = useState('')
  const [previewEl, setPreviewEl] = useState<HTMLAudioElement | null>(null)

  const selectedVoiceId = state.inputs.voiceId
  const selectedVoiceName = useMemo(() => {
    if (!selectedVoiceId) return null
    return myVoices.find((v) => v.voice_id === selectedVoiceId)?.name
      ?? sharedVoices.find((v) => v.voice_id === selectedVoiceId)?.name
      ?? null
  }, [selectedVoiceId, myVoices, sharedVoices])

  const playPreview = (url?: string) => {
    if (!url) return
    previewEl?.pause()
    const a = new Audio(url)
    setPreviewEl(a)
    a.play().catch(() => {})
  }

  const handleLoadMyVoices = async () => {
    if (!elevenLabsKey) { addToast('Thiếu ElevenLabs API key trong Settings', 'error'); return }
    setLoadingMine(true)
    try {
      const voices = await listVoices(elevenLabsKey)
      setMyVoices(voices)
      if (voices.length === 0) addToast('Tài khoản chưa có giọng nào — thử Thư viện ElevenLabs', 'info')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Tải giọng thất bại', 'error')
    } finally { setLoadingMine(false) }
  }

  const handleSearchLibrary = async () => {
    if (!elevenLabsKey) { addToast('Thiếu ElevenLabs API key trong Settings', 'error'); return }
    setLoadingShared(true)
    try {
      const voices = await listSharedVoices({
        apiKey: elevenLabsKey,
        language: libLang || undefined,
        gender: libGender || undefined,
        search: libSearch.trim() || undefined,
        pageSize: 30,
      })
      setSharedVoices(voices)
      if (voices.length === 0) addToast('Không tìm thấy giọng phù hợp — đổi bộ lọc', 'info')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Tìm giọng thất bại', 'error')
    } finally { setLoadingShared(false) }
  }

  const handleAddSharedVoice = async (v: SharedVoice) => {
    if (!elevenLabsKey) { addToast('Thiếu ElevenLabs API key trong Settings', 'error'); return }
    setAddingId(v.voice_id)
    try {
      const newId = await addSharedVoice({
        apiKey: elevenLabsKey,
        publicOwnerId: v.public_owner_id,
        voiceId: v.voice_id,
        newName: v.name,
      })
      setVoiceId(newId)
      addToast(`✓ Đã thêm & chọn giọng "${v.name}"`, 'success')
      handleLoadMyVoices()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Thêm giọng thất bại', 'error')
    } finally { setAddingId(null) }
  }

  const inputsOk = !!state.inputs.product && !!state.inputs.avatar
  const canGenerate = inputsOk && !!geminiKey && !brain.isGeneratingScript

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Bước 1 — Input</h2>
          <p className="text-[12px] text-gray-500">
            Chọn <strong>avatar</strong> + <strong>sản phẩm</strong>, dán <strong>kịch bản</strong> và chọn <strong>giọng</strong>.
            App tự chia kịch bản + ước tính nhịp phía sau — bạn không cần chỉnh tay.
          </p>
        </div>

        {/* ── Avatar + Product ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <AssetTile
            imageUrl={state.inputs.product?.productImage ?? null}
            label="Sản phẩm *"
            hint="Sản phẩm bạn muốn quảng cáo (bắt buộc)"
            icon={Package}
            onPick={() => setPickerMode('product')}
            onClear={() => setProduct(null)}
          />
          <AssetTile
            imageUrl={state.inputs.avatar?.characterImage ?? null}
            label="Avatar *"
            hint="Creator AI đóng vai trong video chính (bắt buộc)"
            icon={UserRound}
            onPick={() => setPickerMode('avatar')}
            onClear={() => setAvatar(null)}
          />
        </div>

        {/* ── Script (MAIN) + language ──────────────────────────────────────── */}
        <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Kịch bản</p>
            <button
              onClick={() => setPickerMode('script')}
              className="text-[10px] font-semibold text-violet-600 hover:text-violet-700"
            >
              Chọn kịch bản có sẵn →
            </button>
            {hasScriptText && (
              <button onClick={() => { setScript(''); setLangTouched(false) }} className="text-[10px] text-gray-400 hover:text-red-500">
                Xoá
              </button>
            )}
            {/* Language — auto-detected, editable */}
            <div className="ml-auto flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={brain.outputLang}
                onChange={(e) => { setLangTouched(true); setOutputLang(e.target.value as ScriptLang) }}
                className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold focus:border-violet-400 focus:outline-none"
                title="Ngôn ngữ output — khoá script, voice và keyword B-Roll. App tự đoán từ kịch bản, sửa nếu sai."
              >
                {(['ms', 'vi', 'en'] as ScriptLang[]).map((lng) => (
                  <option key={lng} value={lng}>{SCRIPT_LANG_LABEL_VI[lng]}</option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            value={state.inputs.script}
            onChange={(e) => setScript(e.target.value)}
            rows={6}
            placeholder="Dán kịch bản của bạn vào đây — app giữ nguyên 100% câu chữ, chỉ chia phân đoạn ngầm để dựng video. Để TRỐNG nếu muốn AI tự viết."
            className="mt-2 w-full resize-y rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[13px] leading-relaxed focus:border-violet-400 focus:outline-none"
          />
          {hasScriptText ? (
            <p className="mt-1.5 text-[10px] text-gray-500">
              Dùng kịch bản của bạn (giữ nguyên câu chữ) · ngôn ngữ đã đoán: <b>{SCRIPT_LANG_LABEL_VI[brain.outputLang]}</b>
              {liveDurationSec != null && <> · ~{liveDurationSec.toFixed(1)}s</>}
              {liveDurationSec != null && liveDurationSec > 60 && (
                <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                  Ad dài — TikTok thường &lt;60s
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-[10px] text-gray-400">
              Ô trống → AI sẽ tự viết theo cấu trúc + angle + thời lượng bên dưới.
            </p>
          )}
        </div>

        {/* ── AI-write controls (only when no script pasted) ────────────────── */}
        {!hasScriptText && (
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
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
            </PickerCard>
          </div>
        )}

        {/* ── Voice category (auto) + specific voice picker ─────────────────── */}
        <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
          <div className="flex items-center gap-3">
            <Mic2 className="h-5 w-5 text-violet-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-gray-900">
                {VOICE_CATEGORIES[effectiveCategory].emoji} {VOICE_CATEGORIES[effectiveCategory].labelVi}
                {brain.voiceCategory == null && (
                  <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">AUTO</span>
                )}
              </p>
              <p className="text-[11px] text-gray-500">{VOICE_CATEGORIES[effectiveCategory].descriptionVi}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="self-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Đổi tông:</span>
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

          {/* Specific voice */}
          <div className="mt-3 border-t border-black/5 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Giọng cụ thể:</span>
              {selectedVoiceId ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  <Check className="h-3 w-3" />
                  {selectedVoiceName ?? 'giọng đã chọn'}
                  <button
                    onClick={() => { setVoiceId(null); addToast('Đã trở về giọng mặc định của tông', 'info') }}
                    title="Bỏ chọn — dùng giọng mặc định của tông"
                    className="ml-1 rounded-full p-0.5 hover:bg-emerald-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <span className="text-[11px] text-gray-500">Đang dùng giọng mặc định của tông.</span>
              )}
              <button
                onClick={() => setVoicePanelOpen((o) => !o)}
                className="ml-auto rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700 transition-all hover:bg-violet-100"
              >
                {voicePanelOpen ? 'Đóng' : 'Chọn giọng…'}
              </button>
            </div>

            {voicePanelOpen && (
              <div className="mt-3 border-t border-black/5 pt-3">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setVoiceTab('mine')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                      voiceTab === 'mine' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <UserCircle2 className="h-3.5 w-3.5" /> Giọng của tôi
                  </button>
                  <button
                    onClick={() => setVoiceTab('library')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                      voiceTab === 'library' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Library className="h-3.5 w-3.5" /> Thư viện ElevenLabs
                  </button>
                </div>

                {!elevenLabsKey && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" /> Thiếu ElevenLabs API key — thêm trong Cài đặt để dùng tính năng này.
                  </p>
                )}

                {voiceTab === 'mine' && (
                  <div className="mt-3">
                    <button
                      onClick={handleLoadMyVoices}
                      disabled={loadingMine || !elevenLabsKey}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-gray-700 disabled:opacity-50"
                    >
                      {loadingMine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Tải giọng trong tài khoản
                    </button>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {myVoices.map((v) => {
                        const isSel = v.voice_id === selectedVoiceId
                        return (
                          <div
                            key={v.voice_id}
                            className={`flex items-center gap-2 rounded-lg border p-2 ${
                              isSel ? 'border-emerald-300 bg-emerald-50' : 'border-black/10 bg-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-bold text-gray-900">{v.name}</p>
                              <p className="text-[10px] text-gray-500">
                                {v.category}{v.labels?.gender ? ` · ${v.labels.gender}` : ''}{v.labels?.accent ? ` · ${v.labels.accent}` : ''}
                              </p>
                            </div>
                            {v.preview_url && (
                              <button onClick={() => playPreview(v.preview_url)} title="Nghe thử" className="rounded-full p-1 text-violet-600 hover:bg-violet-100">
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { setVoiceId(v.voice_id); addToast(`✓ Đã chọn giọng "${v.name}"`, 'success') }}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                                isSel ? 'bg-emerald-600 text-white' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                              }`}
                            >
                              {isSel ? 'Đang chọn' : 'Chọn'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {voiceTab === 'library' && (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={libLang}
                        onChange={(e) => setLibLang(e.target.value)}
                        className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px] focus:border-violet-400 focus:outline-none"
                      >
                        <option value="ms">Malay (ms)</option>
                        <option value="id">Indonesia (id)</option>
                        <option value="en">English (en)</option>
                        <option value="vi">Vietnamese (vi)</option>
                        <option value="">Mọi ngôn ngữ</option>
                      </select>
                      <select
                        value={libGender}
                        onChange={(e) => setLibGender(e.target.value as '' | 'male' | 'female')}
                        className="rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px] focus:border-violet-400 focus:outline-none"
                      >
                        <option value="">Mọi giới tính</option>
                        <option value="female">Nữ</option>
                        <option value="male">Nam</option>
                      </select>
                      <div className="relative flex-1 min-w-[140px]">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                          value={libSearch}
                          onChange={(e) => setLibSearch(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSearchLibrary() }}
                          placeholder="Tìm tên giọng…"
                          className="w-full rounded-lg border border-black/10 bg-white py-1 pl-7 pr-2 text-[11px] focus:border-violet-400 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleSearchLibrary}
                        disabled={loadingShared || !elevenLabsKey}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-gray-700 disabled:opacity-50"
                      >
                        {loadingShared ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                        Tìm
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {sharedVoices.map((v) => {
                        const isSel = v.voice_id === selectedVoiceId
                        return (
                          <div
                            key={`${v.public_owner_id}-${v.voice_id}`}
                            className={`flex items-center gap-2 rounded-lg border p-2 ${
                              isSel ? 'border-emerald-300 bg-emerald-50' : 'border-black/10 bg-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-bold text-gray-900">{v.name}</p>
                              <p className="truncate text-[10px] text-gray-500">
                                {v.language}{v.accent ? ` · ${v.accent}` : ''}{v.gender ? ` · ${v.gender}` : ''}{v.use_case ? ` · ${v.use_case}` : ''}
                              </p>
                            </div>
                            {v.preview_url && (
                              <button onClick={() => playPreview(v.preview_url)} title="Nghe thử" className="rounded-full p-1 text-violet-600 hover:bg-violet-100">
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleAddSharedVoice(v)}
                              disabled={addingId === v.voice_id || isSel}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all disabled:opacity-60 ${
                                isSel ? 'bg-emerald-600 text-white' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                              }`}
                            >
                              {addingId === v.voice_id ? <Loader2 className="h-3 w-3 animate-spin" /> : isSel ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                              {isSel ? 'Đã chọn' : 'Thêm & chọn'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-gray-400">
                      "Thêm & chọn" sẽ thêm giọng từ thư viện vào tài khoản ElevenLabs của bạn rồi chọn luôn cho video này.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Compliance warning: cert / authority claims ───────────────────── */}
        {certClaims.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold">Cảnh báo tuân thủ — script đang nhắc đến: {certClaims.join(', ')}</p>
              <p className="mt-0.5 text-amber-800">
                Theo Trade Descriptions Act (Malaysia), chỉ giữ các tuyên bố chứng nhận / phê duyệt này nếu bạn có bằng
                chứng hợp lệ. App không gắn badge chứng nhận. Nên sửa thành trải nghiệm cá nhân thay vì tuyên bố được cơ quan công nhận.
              </p>
              <label className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
                <input type="checkbox" checked={acknowledgedCerts} onChange={(e) => setAcknowledgedCerts(e.target.checked)} />
                Tôi hiểu và chịu trách nhiệm về các tuyên bố này.
              </label>
            </div>
          </div>
        )}

        {/* ── Action bar ────────────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-pink-50 p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {hasScriptText ? 'Dùng kịch bản của bạn' : 'AI tự viết kịch bản'}
            </p>
            <p className="text-[11px] text-gray-500">
              {hasScriptText
                ? `Giữ nguyên câu chữ · ${SCRIPT_LANG_LABEL_VI[brain.outputLang]}${liveDurationSec != null ? ` · ~${liveDurationSec.toFixed(1)}s` : ''}`
                : `${AD_STRUCTURES[brain.structure].labelVi} · ${AD_ANGLES[brain.angle].labelVi} · ${brain.targetDurationSec}s`}
            </p>
          </div>
          {brain.script && certClaims.length > 0 ? (
            <button
              onClick={onContinue}
              disabled={!acknowledgedCerts}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vẫn tiếp tục → Action Inserts <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleGenerateAndContinue}
              disabled={!canGenerate}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {brain.isGeneratingScript
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</>
                : <><Sparkles className="h-4 w-4" /> Tạo & tiếp tục</>}
            </button>
          )}
        </div>

        {brain.error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div><strong>Lỗi:</strong> {brain.error}</div>
          </div>
        )}
      </div>

      <BankPicker bankType="models"   isOpen={pickerMode === 'avatar'}  onSelect={handlePickAvatar}  onClose={() => setPickerMode(null)} />
      <BankPicker bankType="products" isOpen={pickerMode === 'product'} onSelect={handlePickProduct} onClose={() => setPickerMode(null)} />
      <BankPicker bankType="scripts"  isOpen={pickerMode === 'script'}  onSelect={handlePickScript}  onClose={() => setPickerMode(null)} />
    </div>
  )
}

// ── Asset picker tile ────────────────────────────────────────────────────────
function AssetTile({
  imageUrl, label, hint, icon: Icon, onPick, onClear,
}: {
  imageUrl: string | null | undefined
  label: string
  hint: string
  icon: React.ElementType
  onPick: () => void
  onClear?: () => void
}) {
  const resolvedUrl = useAssetUrl(imageUrl ?? undefined)
  const display = imageUrl?.startsWith('http') ? imageUrl : resolvedUrl
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
        {imageUrl && onClear && (
          <button onClick={onClear} className="text-[10px] text-gray-400 hover:text-red-500">Bỏ chọn</button>
        )}
      </div>
      <button
        onClick={onPick}
        className="group aspect-[4/3] w-full overflow-hidden rounded-lg border border-dashed border-black/10 bg-black/[0.02] transition-colors hover:border-violet-400 hover:bg-violet-50/30"
      >
        {display ? (
          <img src={display} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-300 group-hover:text-violet-400">
            <Icon className="h-8 w-8" strokeWidth={1.2} />
            <span className="text-[11px] font-semibold">Chọn từ Project</span>
          </div>
        )}
      </button>
      <p className="text-[10px] text-gray-400">{hint}</p>
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
