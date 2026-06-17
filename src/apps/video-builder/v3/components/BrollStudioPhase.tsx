// ── B-roll Studio (Mode 2) — Phase 2 UI ──────────────────────────────────────
// "Tạo xưởng" sinh Ý TƯỞNG cho 11 thẻ (1 call). Mỗi thẻ là 1 mini-studio:
//  • toggle gọn: khoá-tắt ẩn hẳn, lock-on = chip tĩnh, avatar/giọng mở picker thật;
//  • giọng lọc theo NGÔN NGỮ toàn cục + giới tính (không chọn thị trường 2 lần);
//  • câu thoại (lồng tiếng) chỉ hiện khi đã chọn giọng;
//  • prompt là chi tiết kỹ thuật → giấu trong expander "⚙️ Xem/sửa prompt" (sinh khi cần,
//    có nút biến thể), note mô tả ĐÚNG cấu hình thẻ (không còn ra y chang);
//  • 480p·Nháp / 720p·Final hiện rõ credit + giải thích đánh đổi.
// Render + trim + tải về = Phase 3 (nút Render hiện credit chính xác sẵn).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { Loader2, ArrowLeft, Sparkles, Package, Mic, Upload, X, Check, Play, RotateCcw, Download } from 'lucide-react'
import { useBrollStudioStore } from '../stores/brollStudioStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAppStore } from '../../../../stores/appStore'
import BankPicker from '../../../../components/BankPicker'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { saveAsset, getUrl } from '../../../../utils/assetStore'
import { listVoices, listSharedVoices, textToSpeech } from '../../../../utils/elevenlabs'
import {
  STUDIO_ANGLES, FREEFORM_ANGLE, generateStudioIdeas, engineerScenePrompt, resolveSceneSpec, translateLineForMarket,
  type StudioIdea, type StudioAngle, type SceneToggles,
} from '../services/brollStudioBrain'
import { renderStudioScene, inferCreatorGender, getSyntheticCreatorUrl } from '../services/brollStudioRenderer'
import { muxAudioIntoVideo } from '../../../video-translate/muxAudioVideo'
import { estimateSceneCredit, FAITHFUL_FRAME_CR, type StudioResolution } from '../services/brollStudioModels'
import type { Product, Model } from '../../../../stores/types'
import type { ScriptLang } from '../types'

const lockOn = (s: string) => s === 'on' || s === 'lock-on'
const LANG_TAG: Record<ScriptLang, string> = { vi: 'VN', ms: 'MY', en: 'EN' }
// Product used ON THE BODY (apply/wear/eat/drink) → needs the avatar/person; a head-less
// hands-only render of a body part deforms. Runs on the English conceptPrompt.
const APPLIES_TO_BODY_RE = /\b(neck|throat|face|cheeks?|forehead|chin|jaw|lips?|mouth|teeth|hair|scalp|ears?|eyes?|nose|skin|chest|shoulders?|back|waist|belly|stomach|arms?|wrists?|knees?|legs?|thighs?|ankles?|feet|foot)\b|\b(wear|wears|wearing|worn|strap|straps|strapped|fasten|buckle|eat|eats|eating|bite|bites|chew|drink|drinks|sip|swallow)\b/i

/** Decode an audio blob's duration (sec) so we can pick the right mux mode. */
async function audioBlobDuration(blob: Blob): Promise<number> {
  const buf = await blob.arrayBuffer()
  const ctx = new AudioContext()
  try { const dec = await ctx.decodeAudioData(buf); return dec.duration }
  finally { ctx.close().catch(() => {}) }
}

function sceneCredit(angle: StudioAngle, t: SceneToggles, res: StudioResolution, dur: number): number {
  const spec = resolveSceneSpec(angle, t)
  if (spec.isCard) return FAITHFUL_FRAME_CR
  return estimateSceneCredit({ tier: spec.tier, resolution: res, durationSec: dur, withFaithfulFrame: spec.withFaithfulFrame })
}

// ── Voice picker (Mode 2) — filtered by the GLOBAL language + a gender filter ────
interface PickVoice { id: string; name: string; preview?: string; tag: string; gender: string }

function VoicePickerModal({ apiKey, lang, onSelect, onClose }: {
  apiKey: string; lang: ScriptLang; onSelect: (id: string, name: string) => void; onClose: () => void
}) {
  const [all, setAll] = useState<PickVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!apiKey) { setLoading(false); return }
    const langCode = lang === 'vi' ? 'vi' : lang === 'ms' ? 'ms' : 'en'
    let cancelled = false
    Promise.all([
      listVoices(apiKey),
      listSharedVoices({ apiKey, language: langCode, pageSize: 60 }),
    ]).then(([user, lib]) => {
      if (cancelled) return
      const cloned: PickVoice[] = user.filter((v) => v.category === 'cloned')
        .map((v) => ({ id: v.voice_id, name: v.name, preview: v.preview_url, tag: 'Của bạn', gender: '' }))
      const libMap = new Map<string, PickVoice>()
      for (const v of lib) libMap.set(v.voice_id, { id: v.voice_id, name: v.name, preview: v.preview_url, tag: LANG_TAG[lang], gender: (v.gender ?? '').toLowerCase() })
      setAll([...cloned, ...Array.from(libMap.values())])
    }).catch(() => { /* keep empty */ }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; audioRef.current?.pause() }
  }, [apiKey, lang])

  const filtered = all.filter((v) => {
    if (q.trim() && !v.name.toLowerCase().includes(q.toLowerCase())) return false
    // cloned voices have no gender → always pass the gender filter (they're your own)
    if (gender !== 'all' && v.gender && v.gender !== gender) return false
    return true
  })
  const play = (url?: string) => {
    if (!url) return
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(url); audioRef.current = a; a.play().catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Mic className="h-4 w-4 text-violet-600" /> Chọn giọng · {LANG_TAG[lang]}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2 border-b border-black/8 p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm giọng…"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-400 focus:outline-none" />
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-[11px] font-semibold">
            {([['all', 'Tất cả'], ['female', 'Nữ'], ['male', 'Nam']] as const).map(([g, label]) => (
              <button key={g} onClick={() => setGender(g)} className={gender === g ? 'bg-violet-600 px-2.5 py-2 text-white' : 'bg-white px-2.5 py-2 text-gray-500 hover:bg-gray-50'}>{label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {!apiKey ? (
            <p className="py-8 text-center text-sm text-rose-500">Thiếu ElevenLabs API key trong Cài đặt.</p>
          ) : loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Không có giọng phù hợp.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:border-violet-300 hover:bg-violet-50/40">
                  {v.preview && (
                    <button onClick={() => play(v.preview)} title="Nghe thử" className="rounded-full bg-gray-100 p-1.5 text-gray-500 hover:bg-violet-100 hover:text-violet-600">
                      <Play className="h-3 w-3" />
                    </button>
                  )}
                  <button onClick={() => onSelect(v.id, v.name)} className="flex flex-1 items-center justify-between gap-2 text-left">
                    <span className="truncate text-sm font-semibold text-gray-800">{v.name}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{v.tag}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StudioSceneCard({ angle, idea, product, lang, geminiKey, lastVoice, onVoicePicked, freeform }: {
  angle: StudioAngle; idea?: StudioIdea; product: Product | null; lang: ScriptLang; geminiKey: string
  lastVoice: { id: string; name: string } | null
  onVoicePicked: (v: { id: string; name: string }) => void
  freeform?: boolean
}) {
  const addToast = useAppStore((s) => s.addToast)
  const elevenKey = useSettingsStore((s) => s.elevenLabsApiKey)
  const kieKey = useSettingsStore((s) => s.kieApiKey)
  const sceneResult = useBrollStudioStore((s) => s.scenes[angle.id])
  const setSceneResult = useBrollStudioStore((s) => s.setSceneResult)

  const [avatarRef, setAvatarRef] = useState<string | null>(null)
  const [avatarName, setAvatarName] = useState('')
  const [voiceId, setVoiceId] = useState(lastVoice?.id ?? '')
  const [voiceName, setVoiceName] = useState(lastVoice?.name ?? '')
  const [productOn, setProductOn] = useState(() => lockOn(angle.toggles.product))
  const [res, setRes] = useState<StudioResolution>('720p')
  const [dur, setDur] = useState(8)   // Seedance chỉ nhận 4/8/12s
  const [line, setLine] = useState(idea?.suggestedLine ?? '')
  const [brief, setBrief] = useState('')   // free-form: Vietnamese scene description
  const [prompt, setPrompt] = useState('')
  const [promptSig, setPromptSig] = useState('')   // config the current prompt was built for
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [variant, setVariant] = useState(0)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [stage, setStage] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-hydrate a previously rendered clip for this angle (persisted in the store).
  useEffect(() => {
    if (sceneResult?.videoAssetId) getUrl(sceneResult.videoAssetId).then((u) => setVideoUrl(u ?? null))
  }, [sceneResult?.videoAssetId])

  const avatarThumb = useAssetUrl(avatarRef ?? undefined)
  const avatarAllowed = angle.toggles.avatar !== 'lock-off'
  const productLock = angle.toggles.product

  const toggles: SceneToggles = { avatar: !!avatarRef, voice: !!voiceId, product: productOn }
  const spec = resolveSceneSpec(angle, toggles)
  // Lipsync (InfiniteTalk) length is driven by the SPOKEN LINE (audio), NOT the 4/8/12
  // Seedance steps — so estimate seconds from the line (~13 chars/s) and bill on THAT, and
  // hide the 4/8/12 picker for lips. Seedance scenes still use the picked 4/8/12.
  const estLipsSec = Math.max(2, Math.min(15, Math.round((line.trim().length || 24) / 13)))
  const effDur = spec.role === 'lips' ? estLipsSec : dur
  const c480 = sceneCredit(angle, toggles, '480p', effDur)
  const c720 = sceneCredit(angle, toggles, '720p', effDur)
  const credit = res === '480p' ? c480 : c720
  const voiceNeedsLine = !!voiceId && !line.trim()
  const briefMissing = !!freeform && !brief.trim()
  // Signature of every input that changes the prompt → if it changed since the prompt was
  // generated, the cached prompt is STALE and must be re-made (fixes prompt≠config bug).
  const cfgSig = () => `${avatarRef ?? ''}|${voiceId}|${productOn}|${dur}|${line.trim()}|${freeform ? brief.trim() : ''}`
  // Prompt đã sinh nhưng cấu hình (avatar/giọng/SP/giây/thoại) đổi sau đó → prompt hiển thị
  // CŨ. Render vẫn đúng (tự sinh lại theo sig), nhưng cần báo để user khỏi tưởng app bỏ qua
  // avatar/SP. Hiện badge cảnh báo trong expander.
  const promptStale = !!prompt && promptSig !== cfgSig()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const id = await saveAsset(file, file.type || 'image/jpeg')
      setAvatarRef(id); setAvatarName(file.name.replace(/\.[^.]+$/, ''))
    } catch { addToast('Tải ảnh avatar lỗi', 'error') }
  }

  const makePrompt = async (nextVariant = 0) => {
    if (!product) { addToast('Chưa chọn sản phẩm', 'error'); return }
    if (voiceNeedsLine) { addToast('Đã chọn giọng thì phải điền Câu thoại', 'error'); return }
    if (briefMissing) { addToast('Nhập mô tả cảnh tự do trước', 'error'); return }
    setBusy(true)
    try {
      const r = await engineerScenePrompt({ angle, idea, toggles, line, durationSec: dur, product, lang, geminiKey, variant: nextVariant, briefVi: freeform ? brief.trim() : undefined })
      // Note mô tả ĐÚNG cấu hình thẻ này (đổi theo avatar/giọng/giây → không còn ra y chang).
      const who = spec.role === 'lips' ? `Avatar "${avatarName || 'đã chọn'}" nói trực tiếp`
        : avatarRef ? `Avatar "${avatarName || 'đã chọn'}" xuất hiện + dùng sản phẩm`
        : spec.role === 'mechanism3d' ? 'Animation 3D (không người)'
        : 'Cảnh tay/cận (không lộ mặt)'
      const spoken = voiceId && line.trim()
        ? ` · Câu thoại "${line.trim()}" được ${avatarRef ? 'lồng tiếng + nhép môi' : 'lồng tiếng'} (model không vẽ chữ)`
        : ''
      const meta = `${who} · ${productOn ? 'có sản phẩm' : 'không sản phẩm'} · ${dur}s · ${res}${voiceId ? ` · giọng ${voiceName}` : ''}${spoken}`
      setPrompt(r.conceptPromptEn); setNote(`${r.noteVi}\n${meta}`); setPromptSig(cfgSig())
    } catch (e) {
      addToast(`Tạo prompt lỗi: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`, 'error')
    } finally { setBusy(false) }
  }

  const doRender = async () => {
    if (!product) { addToast('Chưa chọn sản phẩm', 'error'); return }
    if (voiceNeedsLine) { addToast('Đã chọn giọng thì phải điền Câu thoại', 'error'); return }
    if (briefMissing) { addToast('Nhập mô tả cảnh tự do trước', 'error'); return }
    if (!kieKey) { addToast('Thiếu KIE API key trong Cài đặt', 'error'); return }
    if (voiceId && !elevenKey) { addToast('Cảnh có giọng đọc cần ElevenLabs key trong Cài đặt', 'error'); return }
    setRendering(true); setStage('Chuẩn bị…')
    try {
      // 1. Prompt — dùng lại prompt đã tạo CHỈ KHI cấu hình chưa đổi (sig khớp); nếu đổi
      //    avatar/giọng/giây/câu thoại sau khi tạo prompt → prompt cũ lệch → sinh lại.
      let promptEn = (prompt && promptSig === cfgSig()) ? prompt : ''
      if (!promptEn) {
        setStage('Viết prompt…')
        const r = await engineerScenePrompt({ angle, idea, toggles, line, durationSec: dur, product, lang, geminiKey, briefVi: freeform ? brief.trim() : undefined })
        promptEn = r.conceptPromptEn; setPrompt(r.conceptPromptEn); setNote(r.noteVi); setPromptSig(cfgSig())
      }
      // TỰ DO — KHÔNG ép user chọn avatar. Lấy avatar đã chọn (nếu có). Nếu CHƯA chọn
      // mà cảnh SHOW NGƯỜI (dùng SP trên người / on-body — APPLIES_TO_BODY_RE) thì app
      // TỰ dựng MỘT creator ảo NHẤT QUÁN (sinh 1 lần, cache theo SP+lang+giới) → identity
      // giống nhau mọi cảnh + hết méo thân cụt đầu. Cảnh product-only (avatar lock-off:
      // cận cảnh / thành phần / 3D) KHÔNG gọi → giữ nguyên không người.
      let avatarUrl = avatarRef ? ((await getUrl(avatarRef)) ?? undefined) : undefined
      let useFaithful = spec.withFaithfulFrame
      const avatarAllowed = angle.toggles.avatar !== 'lock-off'
      if (!avatarUrl && avatarAllowed && spec.role === 'broll' && APPLIES_TO_BODY_RE.test(promptEn)) {
        try {
          setStage('Tạo người mẫu ảo (1 lần, nhất quán)…')
          const gender = inferCreatorGender(product.productName, JSON.stringify(product.visualBrief ?? ''))
          avatarUrl = await getSyntheticCreatorUrl({
            kieApiKey: kieKey,
            productKey: product.productName || product.id || 'studio',
            lang, gender,
          })
          useFaithful = true   // có người → faithful-frame khoá mặt → nhất quán, hết méo
        } catch {
          addToast('Chưa tạo được người mẫu ảo — cảnh sẽ render dạng tay/cận (có thể kém tự nhiên).', 'error')
        }
      }
      // 2. Resolve ẢNH SẢN PHẨM → URL công khai (KIE fetch từ xa). Dùng TOÀN BỘ
      //    productImages (4 ảnh chuẩn) — `productImage` chỉ là alias cũ, thường RỖNG ở
      //    sản phẩm mới → nếu chỉ đọc nó thì faithful-frame không chạy → SẢN PHẨM BỊ DRIFT.
      const imageRefs = [...(product.productImages ?? []), product.productImage]
        .filter((r): r is string => !!r && r.trim() !== '')
      const seenRef = new Set<string>()
      const productUrls: string[] = []
      for (const ref of imageRefs) {
        if (seenRef.has(ref)) continue
        seenRef.add(ref)
        const u = await getUrl(ref)
        if (u) productUrls.push(u)
        if (productUrls.length >= 4) break
      }
      if (toggles.product && productUrls.length === 0) {
        addToast('⚠️ Sản phẩm chưa có ảnh trong Project → cảnh sẽ bị lệch sản phẩm. Thêm ảnh sản phẩm rồi render lại.', 'error')
      }
      // 3. TTS cho MỌI cảnh có giọng — câu thoại gõ tiếng Việt được DỊCH sang ngôn ngữ
      //    thị trường trước (translateLineForMarket). Lips → đẩy audio vào InfiniteTalk;
      //    cảnh khác (B-roll voiceover) → ghép audio đè lên clip ở bước 5.
      let audioUrl: string | undefined
      let audioBlob: Blob | undefined
      if (voiceId && line.trim()) {
        setStage('Dịch + tạo giọng đọc…')
        const spokenText = await translateLineForMarket(line.trim(), lang, geminiKey)
        const buf = await textToSpeech({ apiKey: elevenKey, voiceId, text: spokenText })
        audioBlob = new Blob([buf], { type: 'audio/mpeg' })
        const aId = await saveAsset(audioBlob, 'audio/mpeg')
        audioUrl = (await getUrl(aId)) ?? undefined
      }
      // Lipsync — exact-credit gate: InfiniteTalk độ dài = audio thật (chỉ biết sau TTS) +
      // là phần ĐẮT. Giờ đã có giọng → đo độ dài thật → tính credit CHÍNH XÁC → xác nhận
      // trước khi render. Huỷ thì chỉ mất bước TTS (rẻ), chưa tốn credit lipsync.
      if (spec.role === 'lips' && audioBlob) {
        const realSec = await audioBlobDuration(audioBlob).catch(() => effDur)
        const exact = sceneCredit(angle, toggles, res, realSec)
        if (!window.confirm(`Giọng đọc dài ${realSec.toFixed(1)}s → cảnh lipsync này tốn ~${exact}cr (${res}). Render?`)) {
          addToast('Đã huỷ — chưa render lipsync (mới tạo giọng, chưa tốn credit lipsync).', 'success')
          return
        }
      }
      // 4. Render (lips dùng audioUrl; B-roll/3D bỏ qua — Seedance không có audio)
      const remoteUrl = await renderStudioScene({
        kieApiKey: kieKey, conceptPromptEn: promptEn, role: spec.role,
        resolution: res, durationSec: effDur, withFaithfulFrame: useFaithful,
        // Toggle "Sản phẩm" TẮT → KHÔNG bơm ảnh sản phẩm vào faithful-frame/Seedance seed,
        // nếu không Seedance vẫn seed từ ảnh SP → sản phẩm lòi lại dù prompt đã sạch.
        productImageUrls: toggles.product ? productUrls : [],
        avatarImageUrl: avatarUrl, audioUrl,
        onStage: setStage,
      })
      setStage('Lưu clip…')
      let finalBlob = new Blob([await (await fetch(remoteUrl)).blob()], { type: 'video/mp4' })

      // 5. Voiceover trên cảnh KHÔNG lipsync → ghép giọng đè lên clip câm (ffmpeg).
      //    audio dài hơn clip → giữ khung cuối (extend); ngắn hơn → đệm im lặng (pad-audio).
      if (spec.role !== 'lips' && audioBlob) {
        setStage('Ghép lồng tiếng vào clip…')
        const aDur = await audioBlobDuration(audioBlob).catch(() => dur)
        const mode = aDur > dur + 0.3 ? 'extend' : 'pad-audio'
        finalBlob = await muxAudioIntoVideo({ videoBlob: finalBlob, audioBlob, mode })
      }

      // 6. Lưu thành asset (URL KIE chỉ tạm thời) + persist theo angle
      const vId = await saveAsset(finalBlob, 'video/mp4')
      setVideoUrl((await getUrl(vId)) ?? remoteUrl)
      setSceneResult(angle.id, { videoAssetId: vId, durationSec: dur, resolution: res, label: angle.labelVi, createdAt: Date.now() })
      addToast(`✓ Render xong: ${angle.labelVi}`, 'success')
    } catch (e) {
      addToast(`Render lỗi: ${(e instanceof Error ? e.message : String(e)).slice(0, 130)}`, 'error')
    } finally { setRendering(false); setStage('') }
  }

  const handleDownload = async () => {
    if (!videoUrl) return
    try {
      const blob = new Blob([await (await fetch(videoUrl)).blob()], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${angle.id}-${dur}s.mp4`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { addToast('Tải clip lỗi', 'error') }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-900">{angle.labelVi}</p>
        {spec.role === 'lips' && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Lipsync</span>}
      </div>
      {idea && <p className="mt-1 rounded-lg bg-violet-50 p-2 text-[12px] text-violet-900">{idea.ideaVi}</p>}
      {/* Hướng dẫn rõ: cảnh này để làm gì + nên cấu hình sao */}
      <p className="mt-1 text-[10.5px] leading-snug text-gray-400">{angle.howToVi}</p>
      {/* Free-form: ô mô tả cảnh bằng tiếng Việt (AI hiểu, tự ra prompt + thoại theo thị trường) */}
      {freeform && (
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2}
          placeholder="VD: phụ nữ 50 tuổi đang đau đầu gối, chưa lộ sản phẩm, nền bếp…"
          className={`mt-2 w-full rounded-lg border bg-white px-2 py-1.5 text-[12px] text-gray-900 focus:outline-none ${briefMissing ? 'border-rose-300' : 'border-gray-300 focus:border-violet-400'}`} />
      )}

      {/* ── Selections: chỉ hiện cái dùng được (khoá-tắt ẩn hẳn) ─────────────── */}
      <div className="mt-2 flex flex-col gap-1.5">
        {avatarAllowed && (
          avatarRef ? (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-100 py-0.5 pl-0.5 pr-1.5 text-[11px] font-semibold text-emerald-800">
              {avatarThumb ? <img src={avatarThumb} alt="" className="h-5 w-5 rounded-full object-cover" /> : <Check className="ml-1 h-3 w-3" />}
              <span className="max-w-[90px] truncate">{avatarName || 'Avatar'}</span>
              <button onClick={() => { setAvatarRef(null); setAvatarName('') }} className="rounded-full p-0.5 hover:bg-emerald-200"><X className="h-2.5 w-2.5" /></button>
            </span>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => setAvatarPickerOpen(true)}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-300">+ Avatar (kho)</button>
              <button onClick={() => fileRef.current?.click()} title="Tải ảnh avatar riêng"
                className="rounded p-1 text-gray-500 ring-1 ring-gray-300 hover:bg-violet-50 hover:text-violet-700"><Upload className="h-3 w-3" /></button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
          )
        )}

        {voiceId ? (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            <Mic className="h-3 w-3" /><span className="max-w-[110px] truncate">{voiceName}</span>
            <button onClick={() => setVoiceId('')} className="rounded-full p-0.5 hover:bg-emerald-200"><X className="h-2.5 w-2.5" /></button>
          </span>
        ) : (
          <button onClick={() => setVoicePickerOpen(true)}
            className="self-start rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-300">+ Giọng đọc</button>
        )}

        {productLock === 'lock-on' ? (
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"><Check className="h-3 w-3" /> Có sản phẩm</span>
        ) : (productLock === 'on' || productLock === 'off') ? (
          <button onClick={() => setProductOn((v) => !v)}
            className={`self-start rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-transparent hover:ring-emerald-300 ${productOn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
            {productOn ? '✓ ' : ''}Sản phẩm
          </button>
        ) : null}
      </div>

      {/* Câu thoại — chỉ khi đã chọn giọng (sẽ LỒNG TIẾNG, không vẽ lên hình) */}
      {voiceId && (
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Câu thoại (giọng sẽ đọc)…"
          className={`mt-2 w-full rounded-lg border bg-white px-2 py-1 text-[12px] text-gray-900 focus:outline-none ${voiceNeedsLine ? 'border-rose-300' : 'border-gray-300 focus:border-violet-400'}`} />
      )}

      {/* Độ dài — Seedance nhận 4/8/12s; nhưng LIPSYNC (InfiniteTalk) chạy theo CÂU THOẠI
          (audio) nên ẩn picker, chỉ hiện độ dài ước theo thoại để bám credit. */}
      {spec.role === 'lips' ? (
        <p className="mt-2 text-[11px] text-gray-500">⏱ Độ dài ≈ <b className="text-gray-700">{estLipsSec}s</b> — lipsync chạy theo <b>câu thoại</b> (audio), không cố định 4/8/12. Đây là ước; <b>số chính xác hiện khi bấm Render để anh xác nhận</b>.</p>
      ) : (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500">Dài</span>
          {[4, 8, 12].map((d) => (
            <button key={d} onClick={() => setDur(d)}
              className={`flex-1 rounded-md px-1.5 py-1 text-[11px] font-semibold ${dur === d ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{d}s</button>
          ))}
        </div>
      )}

      {/* Độ phân giải — nhãn + credit rõ ràng + giải thích đánh đổi */}
      <div className="mt-2 flex gap-1" title="Cùng chất lượng dựng cảnh & độ chống-lỗi, chỉ khác độ nét + giá. Dùng 480p để test rẻ, ưng rồi xuất 720p.">
        <button onClick={() => setRes('480p')} className={`flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold ${res === '480p' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>480p · Nháp · {c480}cr</button>
        <button onClick={() => setRes('720p')} className={`flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold ${res === '720p' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>720p · Final · {c720}cr</button>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <button onClick={doRender} disabled={rendering || !product || voiceNeedsLine || briefMissing}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 py-1.5 text-[12px] font-bold text-white hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50">
          {rendering && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {rendering ? (stage || 'Đang render…') : videoUrl ? `Render lại ~${credit}cr` : `Render ~${credit}cr`}
        </button>
        {videoUrl && (
          <>
            <div className="overflow-hidden rounded-lg border border-black/10 bg-black">
              <video src={videoUrl} controls playsInline className="max-h-56 w-full object-contain" />
            </div>
            <button onClick={handleDownload}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[12px] font-semibold text-violet-700 hover:bg-violet-100">
              <Download className="h-3.5 w-3.5" /> Tải clip
            </button>
          </>
        )}
      </div>

      {/* Prompt = chi tiết kỹ thuật → giấu trong expander, sinh khi cần */}
      <details className="mt-2 rounded-lg border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] font-semibold text-gray-600">
          ⚙️ Xem/sửa prompt {promptStale && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">⚠ cũ</span>}
        </summary>
        <div className="border-t border-gray-200 p-2">
          {!prompt ? (
            <button onClick={() => makePrompt(0)} disabled={busy || !product || voiceNeedsLine || briefMissing}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Tạo prompt nháp
            </button>
          ) : (
            <>
              {promptStale && (
                <p className="mb-1.5 rounded bg-amber-50 p-1.5 text-[10px] leading-snug text-amber-700">
                  ⚠ Anh đã đổi avatar/giọng/sản phẩm/độ dài sau khi tạo prompt — prompt dưới đây là <b>bản cũ</b>. Khi bấm <b>Render</b> hệ thống sẽ <b>tự sinh lại</b> đúng cấu hình mới (hoặc bấm "Tạo biến thể khác" để xem trước).
                </p>
              )}
              <p className="whitespace-pre-line rounded bg-white p-2 text-[11px] text-gray-600">📝 {note}</p>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                className="mt-1.5 w-full rounded border border-gray-200 bg-white p-1.5 font-mono text-[10px] text-gray-700" />
              <button onClick={() => { const n = variant + 1; setVariant(n); makePrompt(n) }} disabled={busy}
                className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Tạo biến thể khác
              </button>
            </>
          )}
        </div>
      </details>

      {avatarPickerOpen && (
        <BankPicker bankType="models" isOpen
          onSelect={(item) => {
            const m = item as Model
            // characterImage là ảnh chính; fallback sang variant đầu nếu rỗng (giống fix product).
            const img = m.characterImage || m.variants?.[0]?.imageUrl || null
            if (!img) addToast(`Avatar "${m.name}" chưa có ảnh — chọn avatar khác hoặc bấm 📎 tải ảnh lên`, 'error')
            setAvatarRef(img); setAvatarName(m.name); setAvatarPickerOpen(false)
          }}
          onClose={() => setAvatarPickerOpen(false)} />
      )}
      {voicePickerOpen && (
        <VoicePickerModal apiKey={elevenKey} lang={lang}
          onSelect={(id, name) => { setVoiceId(id); setVoiceName(name); onVoicePicked({ id, name }); setVoicePickerOpen(false) }}
          onClose={() => setVoicePickerOpen(false)} />
      )}
    </div>
  )
}

const LANGS: { id: ScriptLang; label: string }[] = [
  { id: 'vi', label: 'Tiếng Việt' }, { id: 'ms', label: 'Bahasa Malaysia' }, { id: 'en', label: 'English' },
]

export default function BrollStudioPhase({ onBack }: { onBack: () => void }) {
  const product = useBrollStudioStore((s) => s.product)
  const setProduct = useBrollStudioStore((s) => s.setProduct)
  const lang = useBrollStudioStore((s) => s.lang)
  const setLang = useBrollStudioStore((s) => s.setLang)
  const geminiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast = useAppStore((s) => s.addToast)
  const productThumb = useAssetUrl(product?.productImage ?? undefined)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [ideas, setIdeas] = useState<Record<string, StudioIdea>>({})
  const [loading, setLoading] = useState(false)
  const [lastVoice, setLastVoice] = useState<{ id: string; name: string } | null>(null)

  const buildStudio = async () => {
    if (!product) { addToast('Chưa chọn sản phẩm — chọn ở ô Sản phẩm trước', 'error'); return }
    if (!geminiKey) { addToast('Thiếu Gemini API key trong Settings', 'error'); return }
    setLoading(true)
    try {
      const r = await generateStudioIdeas(product, lang, geminiKey)
      setIdeas(r.ideas)
      addToast('✓ Đã gợi ý ý tưởng cho 11 cảnh', 'success')
    } catch (e) {
      addToast(`Tạo xưởng lỗi: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`, 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🎬 Xưởng B-roll</h2>
            <p className="text-[12px] text-gray-500">Tạo cảnh rời quanh sản phẩm để tự cắt ghép.{product ? ` Sản phẩm: ${product.productName}` : ' (chưa chọn sản phẩm)'}</p>
          </div>
          <button onClick={onBack} className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50">
            <ArrowLeft className="h-3.5 w-3.5" /> Về chế độ Kịch bản
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white p-3">
          <button onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-100">
            {productThumb ? <img src={productThumb} alt="" className="h-8 w-8 rounded object-cover" /> : <Package className="h-4 w-4 text-gray-400" />}
            {product ? product.productName : 'Chọn sản phẩm'}
          </button>
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-[12px] font-semibold">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => setLang(l.id)}
                className={lang === l.id ? 'bg-violet-600 px-3 py-2 text-white' : 'bg-white px-3 py-2 text-gray-500 hover:bg-gray-50'}>{l.label}</button>
            ))}
          </div>
          <span className="text-[11px] text-gray-400">Ngôn ngữ = câu thoại/ý tưởng + lọc giọng; bối cảnh chỉ đổi khi cảnh không có avatar.</span>
        </div>

        <button onClick={buildStudio} disabled={loading || !product}
          className="mb-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {Object.keys(ideas).length > 0 ? 'Tạo lại ý tưởng' : 'Tạo xưởng (gợi ý 11 cảnh)'}
        </button>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {/* Ô tự do — vị trí 1 (render qua đúng pipeline như các thẻ) */}
          <StudioSceneCard freeform angle={FREEFORM_ANGLE} product={product} lang={lang} geminiKey={geminiKey}
            lastVoice={lastVoice} onVoicePicked={setLastVoice} />

          {STUDIO_ANGLES.map((a) => (
            <StudioSceneCard key={a.id} angle={a} idea={ideas[a.id]} product={product} lang={lang} geminiKey={geminiKey}
              lastVoice={lastVoice} onVoicePicked={setLastVoice} />
          ))}
        </div>
      </div>

      <BankPicker bankType="products" isOpen={pickerOpen}
        onSelect={(item) => { setProduct(item as Product); setPickerOpen(false) }}
        onClose={() => setPickerOpen(false)} />
    </div>
  )
}
