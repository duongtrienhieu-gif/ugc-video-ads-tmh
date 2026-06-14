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
  Loader2, Sparkles, RefreshCw, ChevronRight, AlertCircle,
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
  SCRIPT_LANG_LABEL_VI, HOOK_ARCHETYPES,
  type AdStructure, type ScriptTargetDurationSec, type ScriptLang,
} from '../types'
import { AD_STRUCTURES, AD_STRUCTURES_BY_GROUP } from '../services/adStructures'
import { SHAPE_CONFIGS, SCRIPT_SHAPE_ORDER } from '../services/scriptShapes'
import { recomputeBlockDurations, estimateReadDurationForVoice } from '../services/voiceTimingEstimator'
import { generateScript, generateHooks, translateScriptToVietnamese, detectCertClaims } from '../services/scriptGenerator'
import {
  listVoices, listSharedVoices, addSharedVoice,
  type ElevenLabsVoice, type SharedVoice,
} from '../../../../utils/elevenlabs'

// VN translation cache (display-only). Module-level so it SURVIVES this phase
// unmounting when the user navigates to Bước 2 and back — keyed by lang|scriptText.
const VI_TRANSLATION_CACHE = new Map<string, string>()

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
  const setAdShape = useAdsVideoStore((s) => s.setAdShape)
  const setTargetDurationSec = useAdsVideoStore((s) => s.setTargetDurationSec)
  const setOutputLang        = useAdsVideoStore((s) => s.setOutputLang)
  const setUseOwnScript      = useAdsVideoStore((s) => s.setUseOwnScript)
  const setScript            = useAdsVideoStore((s) => s.setScript)
  const setGeneratedScript   = useAdsVideoStore((s) => s.setGeneratedScript)
  const setHookVariants      = useAdsVideoStore((s) => s.setHookVariants)
  const pickHookVariant      = useAdsVideoStore((s) => s.pickHookVariant)
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
  // #6 — Tab A "⚡ Tạo nhanh" (AI viết, default) vs Tab B "📝 Dán" (own script).
  const [genTab, setGenTab] = useState<'quick' | 'own'>('quick')
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false)
  // #6 — Vietnamese translation for DISPLAY only (target lang ≠ vi). Never written
  // into state.inputs.script — the real script stays in the target language.
  const [viTranslation, setViTranslation] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)

  const runViTranslation = (text: string) => {
    if (!geminiKey || brain.outputLang === 'vi' || !text.trim()) { setViTranslation(null); return }
    const key = `${brain.outputLang}|${text.trim()}`
    const cached = VI_TRANSLATION_CACHE.get(key)
    if (cached) { setViTranslation(cached); return }   // instant on revisit — no re-call
    setIsTranslating(true)
    setViTranslation(null)
    translateScriptToVietnamese(geminiKey, text, brain.outputLang)
      .then((vi) => { VI_TRANSLATION_CACHE.set(key, vi); setViTranslation(vi) })
      .catch(() => {})
      .finally(() => setIsTranslating(false))
  }

  // Re-show the VN translation when the user returns to Bước 1 (local state is lost
  // on unmount). The module cache makes this instant if it was translated before;
  // otherwise it re-fetches once.
  useEffect(() => {
    const text = state.inputs.script
    if (brain.outputLang !== 'vi' && text && text.trim() && !viTranslation && !isTranslating) {
      runViTranslation(text)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.inputs.script, brain.outputLang])

  // #6 — app-suggested framework from the product fields (universal keyword
  // heuristic across vi/ms/en; just a highlight, the user can pick any).
  const suggestedFramework = useMemo<AdStructure>(() => {
    const p = state.inputs.product
    // P3j — INSTANT is the default cold-reach winner for most niches; LEAD is
    // suggested when the brief leans on emotional pain / story / clinical
    // mechanism that needs build-up before the product lands.
    if (!p) return 'INSTANT'
    const txt = `${p.benefits ?? ''} ${p.usps ?? ''} ${p.painPoints ?? ''} ${p.productDescription ?? ''} ${p.ingredients ?? ''}`.toLowerCase()
    // Heavy emotional / clinical / story-driven niches → LEAD lets the script breathe.
    if (/đau|nhức|mệt|chóng mặt|ợ chua|táo bón|mất ngủ|stress|trầm cảm|nhạy cảm|tổn thương|hậu sản|sau sinh|kén ăn|ám ảnh|mặc cảm/.test(txt)) return 'LEAD'
    return 'INSTANT'
  }, [state.inputs.product])

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

  // Live duration estimate from the raw script (own-script path) so the user
  // sees "ad dài ~Xs" before generating — no 5-block view needed.
  const liveDurationSec = useMemo(() => {
    if (!hasScriptText) return null
    return estimateReadDurationForVoice(state.inputs.script, brain.outputLang)
  }, [state.inputs.script, hasScriptText, brain.outputLang])

  const certClaims = brain.script ? detectCertClaims(brain.script) : []

  // ── Asset pickers (BankPicker union → safe cast, one picker open at a time) ──
  const handlePickAvatar  = (item: unknown) => setAvatar(item as Model)
  const handlePickProduct = (item: unknown) => setProduct(item as Product)
  const handlePickScript  = (item: unknown) => {
    const sc = item as { scriptText?: string }
    setScript(sc.scriptText ?? '')
    setLangTouched(false)  // re-detect language for the new script
  }

  // Build a RICH product brief from the real bank fields so the AI actually
  // understands the product (painPoints/benefits/ingredients/usageGuide/offer).
  // The AI reads + understands this brief; it is not recited verbatim. Shared by
  // the hook generator and the script generator.
  const buildProductBrief = () => {
    const p = state.inputs.product
    const pitchParts: string[] = []
    if (p?.productDescription) pitchParts.push(p.productDescription)
    if (p?.targetMarket)       pitchParts.push(`Target market: ${p.targetMarket}`)
    if (p?.painPoints)         pitchParts.push(`Pain points: ${p.painPoints}`)
    if (p?.benefits)           pitchParts.push(`Benefits: ${p.benefits}`)
    if (p?.usps)               pitchParts.push(`USPs: ${p.usps}`)
    if (p?.ingredients)        pitchParts.push(`Ingredients & how they work: ${p.ingredients}`)
    if (p?.usageGuide)         pitchParts.push(`How to use: ${p.usageGuide}`)
    if (p?.offer)              pitchParts.push(`Offer: ${p.offer}`)
    const legacyPitch = (p as { jsonProfile?: { pitch?: string } } | null)?.jsonProfile?.pitch
    const productPitch = pitchParts.length > 0
      ? pitchParts.join('\n')
      : (legacyPitch ?? 'Premium UGC product for Malaysian/Vietnamese market.')
    const creatorDescription = state.inputs.avatar
      ? `${state.inputs.avatar.name ?? 'Creator'} — ${state.inputs.avatar.notes ?? 'natural casual UGC vibe'}`
      : undefined
    return { productName: p?.productName ?? 'Product', productPitch, creatorDescription }
  }

  // ── #6 hook layer — generate 6 hooks (one per archetype) for the user to pick ─
  const handleGenerateHooks = async () => {
    if (!geminiKey) { addToast('Chưa có Gemini API key trong Settings', 'error'); return }
    if (!state.inputs.product) { addToast('Chưa chọn sản phẩm', 'error'); return }
    setIsGeneratingHooks(true)
    setScriptBrainError(null)
    try {
      const brief = buildProductBrief()
      // P3i — pass the PREVIOUS batch when re-rolling so Gemini is forced to break
      // out of the same template (the user pressed "Đổi" because they didn't like
      // those exact ones).
      const previousBatch = brain.hookVariants.length > 0
        ? brain.hookVariants.map((h) => h.text)
        : undefined
      const hooks = await generateHooks({
        geminiKey,
        lang: brain.outputLang,
        framework: brain.structure,
        productName: brief.productName,
        productPitch: brief.productPitch,
        creatorDescription: brief.creatorDescription,
        previousBatch,
        shape: brain.shape,
      })
      setHookVariants(hooks)
      pickHookVariant(-1)
      addToast(`✓ ${hooks.length} hook — chọn 1 cái rồi tạo kịch bản`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setScriptBrainError(msg.slice(0, 240))
      addToast(`Tạo hook lỗi: ${msg}`, 'error')
    } finally {
      setIsGeneratingHooks(false)
    }
  }

  // ── Generate (quick AI-write around the picked hook, OR segment own-script) ──
  const handleGenerateAndContinue = async () => {
    if (!geminiKey) { addToast('Chưa có Gemini API key trong Settings', 'error'); return }
    if (!state.inputs.product) { addToast('Chưa chọn sản phẩm', 'error'); return }
    if (!state.inputs.avatar)  { addToast('Chưa chọn avatar', 'error'); return }

    const isQuick = genTab === 'quick'
    const chosenHook = isQuick && brain.pickedHookIdx >= 0
      ? brain.hookVariants[brain.pickedHookIdx]?.text
      : undefined
    if (isQuick && !chosenHook) { addToast('Tạo hook và chọn 1 cái trước', 'error'); return }

    setIsGeneratingScript(true)
    setScriptBrainError(null)
    try {
      const brief = buildProductBrief()
      const result = await generateScript({
        geminiKey,
        structure: brain.structure,
        angle: brain.angle,
        targetDurationSec: brain.targetDurationSec,
        productName: brief.productName,
        productPitch: brief.productPitch,
        creatorDescription: brief.creatorDescription,
        lang: brain.outputLang,
        shape: brain.shape,
        useOwnScript: !isQuick && hasScriptText,
        ownScriptText: state.inputs.script,
        chosenHook,
      })

      // Quick mode: DON'T jump to the next step. Drop the generated script into the
      // editable box (switch to the Dán/Edit tab) so the user can READ + tweak it
      // first, then press "Tiếp tục" themselves. The blocks join into plain text
      // (no labels) — the hook is the first line. Re-segmentation happens on continue.
      if (isQuick) {
        // One continuous paragraph (no line breaks): blank lines between blocks
        // make ElevenLabs insert long pauses that break the reading rhythm. Collapse
        // all internal whitespace and join blocks with a single space.
        const draft = result.script.blocks
          .map((b) => b.text.trim().replace(/\s+/g, ' '))
          .filter(Boolean)
          .join(' ')
        setScript(draft)
        setLangTouched(true)   // keep the chosen language; don't auto-detect over it
        setGenTab('own')
        runViTranslation(draft)   // VN translation for display (no-op when lang = vi)
        addToast('✓ Đã tạo kịch bản — xem lại & chỉnh sửa, rồi bấm Tiếp tục', 'success')
        return
      }

      // Own-script path: segment verbatim, then advance (cert guard first).
      const refined = recomputeBlockDurations(result.script, brain.outputLang)
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
  // Quick tab needs a picked hook; own tab needs pasted text.
  const canGenerateScript = canGenerate && (
    genTab === 'own' ? hasScriptText : brain.pickedHookIdx >= 0
  )

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

        {/* ── Kịch bản — Tab ⚡ Tạo nhanh (AI viết) / 📝 Dán ────────────────── */}
        <div className="mt-3 flex items-center gap-1.5">
          <button
            onClick={() => setGenTab('quick')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
              genTab === 'quick' ? 'bg-violet-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            ⚡ Tạo nhanh
          </button>
          <button
            onClick={() => setGenTab('own')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
              genTab === 'own' ? 'bg-violet-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            📝 Dán kịch bản
          </button>
          <button
            onClick={() => setPickerMode('script')}
            className="ml-auto text-[10px] font-semibold text-violet-600 hover:text-violet-700"
          >
            Chọn kịch bản có sẵn →
          </button>
        </div>

        {genTab === 'own' ? (
          /* ── Tab B: dán kịch bản của bạn (giữ nguyên câu chữ) ── */
          <>
          <div className="mt-2 rounded-xl border border-black/10 bg-white p-3">
            <div className="flex items-center gap-2">
              {hasScriptText && (
                <button onClick={() => { setScript(''); setLangTouched(false) }} className="text-[10px] text-gray-400 hover:text-red-500">
                  Xoá
                </button>
              )}
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
              placeholder="Dán kịch bản của bạn vào đây — app giữ nguyên 100% câu chữ, chỉ chia phân đoạn ngầm để dựng video."
              className="mt-2 w-full resize-y rounded-lg border border-black/10 bg-black/[0.02] p-2 text-[13px] leading-relaxed focus:border-violet-400 focus:outline-none"
            />
            <p className="mt-1.5 text-[10px] text-gray-500">
              {hasScriptText ? (
                <>Giữ nguyên câu chữ · ngôn ngữ đã đoán: <b>{SCRIPT_LANG_LABEL_VI[brain.outputLang]}</b>
                  {liveDurationSec != null && <> · ~{liveDurationSec.toFixed(1)}s</>}
                  {liveDurationSec != null && liveDurationSec > 60 && (
                    <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                      Ad dài — TikTok thường &lt;60s
                    </span>
                  )}
                </>
              ) : 'Dán kịch bản hoàn chỉnh của bạn, hoặc chuyển sang ⚡ Tạo nhanh để AI viết.'}
            </p>
          </div>
          {/* #6 — VN translation for understanding only (target lang ≠ vi). The
              script above STAYS in the target language; this is never used as input. */}
          {brain.outputLang !== 'vi' && (viTranslation || isTranslating) && (
            <div className="mt-2 rounded-xl border border-sky-300 bg-white p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-sky-700">
                  🇻🇳 Bản dịch để hiểu — KHÔNG dùng cho video
                </p>
                <button
                  onClick={() => runViTranslation(state.inputs.script)}
                  disabled={isTranslating || !hasScriptText}
                  className="shrink-0 text-[11px] font-semibold text-sky-600 hover:text-sky-700 disabled:opacity-50"
                >
                  Dịch lại
                </button>
              </div>
              {isTranslating ? (
                <p className="flex items-center gap-1.5 text-[13px] text-sky-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang dịch...
                </p>
              ) : (
                <p className="whitespace-pre-wrap text-[14px] leading-7 text-gray-800">{viTranslation}</p>
              )}
            </div>
          )}
          </>
        ) : (
          /* ── Tab A: ⚡ Tạo nhanh — AI viết quanh hook bạn chọn ── */
          <div className="mt-2 flex flex-col gap-3">
            <PickerCard title="Ngôn ngữ đích" icon={Globe}>
              <div className="grid grid-cols-3 gap-1.5">
                {(['vi', 'ms', 'en'] as ScriptLang[]).map((lng) => (
                  <button
                    key={lng}
                    onClick={() => { setLangTouched(true); setOutputLang(lng) }}
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
            </PickerCard>

            <div className="grid gap-3 lg:grid-cols-2">
              <PickerCard title="Kiểu kịch bản (framework)" icon={Lightbulb}>
                {(['instant', 'lead'] as const).map((g) => {
                  const groupLabel = g === 'instant' ? '🚀 Vào thẳng sản phẩm' : '📖 Dẫn dắt sản phẩm'
                  const groupHint = g === 'instant'
                    ? 'Sản phẩm xuất hiện ngay trong hook (giây 0-2). Tốt cho cold reach.'
                    : 'Sản phẩm reveal giữa video sau khi build cảm xúc / niềm tin.'
                  return (
                    <div key={g} className={g === 'lead' ? 'mt-3' : ''}>
                      <div className="mb-1 flex items-baseline gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{groupLabel}</p>
                        <p className="text-[9px] text-gray-400">{groupHint}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {AD_STRUCTURES_BY_GROUP[g].map((s) => {
                          const cfg = AD_STRUCTURES[s]
                          const isActive = brain.structure === s
                          const isSuggested = suggestedFramework === s
                          return (
                            <button
                              key={s}
                              onClick={() => setAdStructure(s)}
                              title={`${cfg.descriptionVi}\n\nQuy tắc sản phẩm: ${cfg.productRevealRule}`}
                              className={`relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition-all ${
                                isActive ? TONE_BG[cfg.tone] : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <span className="text-sm">{cfg.emoji}</span>
                              <span className="truncate">{cfg.labelVi}</span>
                              {isSuggested && !isActive && (
                                <span className="absolute -right-1 -top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-white">Gợi ý</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </PickerCard>

              <PickerCard title="Thời lượng" icon={Clock}>
                <div className="grid grid-cols-3 gap-1.5">
                  {([40, 50, 60] as ScriptTargetDurationSec[]).map((d) => (
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

            <PickerCard title="Dạng kịch bản (shape)" icon={Lightbulb}>
              <p className="mb-2 text-[10px] text-gray-500">
                Cấu trúc thân kịch bản. Mặc định "Kể chuyện" — đổi sang Liệt kê / So sánh / Hành trình nếu nội dung hợp hơn.
              </p>
              <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
                {SCRIPT_SHAPE_ORDER.map((sh) => {
                  const cfg = SHAPE_CONFIGS[sh]
                  const isActive = brain.shape === sh
                  return (
                    <button
                      key={sh}
                      onClick={() => setAdShape(sh)}
                      title={cfg.descriptionVi}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold transition-all ${
                        isActive
                          ? 'border-violet-400 bg-violet-100 text-violet-800'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-sm">{cfg.emoji}</span>
                      <span className="truncate">{cfg.labelVi}</span>
                    </button>
                  )
                })}
              </div>
            </PickerCard>

            <PickerCard title="Hook · 3 giây đầu (quyết định giữ chân)" icon={Sparkles}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] text-gray-500">
                  {brain.hookVariants.length === 0
                    ? 'Bấm tạo → chọn 1 hook mạnh nhất, AI viết kịch bản bám hook đó.'
                    : 'Chọn 1 hook — kịch bản sẽ được viết bám theo nó.'}
                </p>
                <button
                  onClick={handleGenerateHooks}
                  disabled={!inputsOk || !geminiKey || isGeneratingHooks}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGeneratingHooks
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang tạo...</>
                    : <><RefreshCw className="h-3 w-3" /> {brain.hookVariants.length ? 'Đổi 6 hook' : 'Tạo 6 hook'}</>}
                </button>
              </div>
              {brain.hookVariants.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {brain.hookVariants.map((h, i) => {
                    const picked = brain.pickedHookIdx === i
                    const arche = h.archetype ? HOOK_ARCHETYPES[h.archetype] : null
                    return (
                      <button
                        key={i}
                        onClick={() => pickHookVariant(i)}
                        className={`rounded-lg border p-2 text-left transition-all ${
                          picked ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-300' : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          {arche && (
                            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">
                              {arche.emoji} {arche.labelVi}
                            </span>
                          )}
                          {picked && <Check className="h-3.5 w-3.5 text-violet-600" />}
                        </div>
                        <p className="text-[12px] leading-snug text-gray-800">{h.text}</p>
                        {brain.outputLang !== 'vi' && h.viGloss && (
                          <p className="mt-1 text-[12px] leading-snug text-gray-600">🇻🇳 {h.viGloss}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </PickerCard>
          </div>
        )}

        {/* ── Specific voice picker ─────────────────────────────────────────
            Tone preset row removed — engine reads at one realistic TikTok
            pace (1.2× via atempo, Z81) for everyone. User only picks the voice. */}
        <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
          <div className="flex items-center gap-3">
            <Mic2 className="h-5 w-5 text-violet-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-gray-900">Giọng đọc</p>
              <p className="text-[11px] text-gray-500">
                Tốc độ chuẩn TikTok creator (1.2×) — nhanh, tự nhiên, tiết kiệm credit lipsync.
              </p>
            </div>
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
                    onClick={() => { setVoiceId(null); addToast('Đã trở về giọng mặc định', 'info') }}
                    title="Bỏ chọn — dùng giọng mặc định"
                    className="ml-1 rounded-full p-0.5 hover:bg-emerald-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <span className="text-[11px] text-gray-500">Đang dùng giọng mặc định.</span>
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
              {genTab === 'own' ? 'Dùng kịch bản của bạn' : 'AI viết kịch bản nhanh'}
            </p>
            <p className="text-[11px] text-gray-500">
              {genTab === 'own'
                ? `Giữ nguyên câu chữ · ${SCRIPT_LANG_LABEL_VI[brain.outputLang]}${liveDurationSec != null ? ` · ~${liveDurationSec.toFixed(1)}s` : ''}`
                : `${SCRIPT_LANG_LABEL_VI[brain.outputLang]} · ${AD_STRUCTURES[brain.structure].labelVi} · ${brain.targetDurationSec}s · ${brain.pickedHookIdx >= 0 ? 'đã chọn hook ✓' : 'chưa chọn hook'}`}
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
              disabled={!canGenerateScript}
              title={genTab === 'quick' && brain.pickedHookIdx < 0 ? 'Tạo hook và chọn 1 cái trước' : undefined}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {brain.isGeneratingScript
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</>
                : genTab === 'quick'
                  ? <><Sparkles className="h-4 w-4" /> Tạo kịch bản</>
                  : <>Tiếp tục → Action Inserts <ChevronRight className="h-4 w-4" /></>}
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
