// ── B-roll Studio (Mode 2) — Phase 2 UI (reworked: clean toggles + real pickers) ─
// "Tạo xưởng" → 11 grounded idea cards + a free-form card. Each card is a mini-studio.
// Toggle UX (user feedback): locked-OFF toggles are HIDDEN (no clutter); locked-ON shows a
// static "✓" chip; AVATAR opens a project picker / upload; GIỌNG opens an ElevenLabs voice
// picker. A voice → reveals the spoken-line box (the line is VOICED at render, never drawn
// into the clip). Render + trim + download land in Phase 3 (the button shows exact credit).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { Loader2, ArrowLeft, Sparkles, Wand2, Package, Mic, Upload, X, Check, Play } from 'lucide-react'
import { useBrollStudioStore } from '../stores/brollStudioStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAppStore } from '../../../../stores/appStore'
import BankPicker from '../../../../components/BankPicker'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { saveAsset } from '../../../../utils/assetStore'
import { listVoices, listSharedVoices } from '../../../../utils/elevenlabs'
import {
  STUDIO_ANGLES, generateStudioIdeas, engineerScenePrompt, resolveSceneSpec,
  type StudioIdea, type StudioAngle, type SceneToggles,
} from '../services/brollStudioBrain'
import { estimateSceneCredit, FAITHFUL_FRAME_CR, type StudioResolution } from '../services/brollStudioModels'
import type { Product, Model } from '../../../../stores/types'
import type { ScriptLang } from '../types'

const lockOn = (s: string) => s === 'on' || s === 'lock-on'

function sceneCredit(angle: StudioAngle, t: SceneToggles, res: StudioResolution, dur: number): number {
  const spec = resolveSceneSpec(angle, t)
  if (spec.isCard) return FAITHFUL_FRAME_CR    // social-proof = one gpt-4o-image card
  return estimateSceneCredit({ tier: spec.tier, resolution: res, durationSec: dur, withFaithfulFrame: spec.withFaithfulFrame })
}

// ── Voice picker (Mode 2 only) — cloned voices + Malaysian library, like mode-1 ──
interface PickVoice { id: string; name: string; preview?: string; tag: string }

function VoicePickerModal({ apiKey, onSelect, onClose }: {
  apiKey: string; onSelect: (id: string, name: string) => void; onClose: () => void
}) {
  const [voices, setVoices] = useState<PickVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!apiKey) { setLoading(false); return }
    let cancelled = false
    Promise.all([
      listVoices(apiKey),
      listSharedVoices({ apiKey, language: 'ms', pageSize: 40 }),
      listSharedVoices({ apiKey, accent: 'malaysian', pageSize: 40 }),
    ]).then(([user, ms, accent]) => {
      if (cancelled) return
      const cloned: PickVoice[] = user.filter((v) => v.category === 'cloned')
        .map((v) => ({ id: v.voice_id, name: v.name, preview: v.preview_url, tag: 'Của bạn' }))
      const libMap = new Map<string, PickVoice>()
      for (const v of [...ms, ...accent]) libMap.set(v.voice_id, { id: v.voice_id, name: v.name, preview: v.preview_url, tag: 'MY' })
      setVoices([...cloned, ...Array.from(libMap.values())])
    }).catch(() => { /* keep empty */ }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; audioRef.current?.pause() }
  }, [apiKey])

  const filtered = q.trim() ? voices.filter((v) => v.name.toLowerCase().includes(q.toLowerCase())) : voices
  const play = (url?: string) => {
    if (!url) return
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(url); audioRef.current = a; a.play().catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Mic className="h-4 w-4 text-violet-600" /> Chọn giọng (ElevenLabs)</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="border-b border-black/8 p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm giọng…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {!apiKey ? (
            <p className="py-8 text-center text-sm text-rose-500">Thiếu ElevenLabs API key trong Cài đặt.</p>
          ) : loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Không có giọng nào.</p>
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

function StudioSceneCard({ angle, idea, product, lang, geminiKey, lastVoice, onVoicePicked }: {
  angle: StudioAngle; idea?: StudioIdea; product: Product | null; lang: ScriptLang; geminiKey: string
  lastVoice: { id: string; name: string } | null
  onVoicePicked: (v: { id: string; name: string }) => void
}) {
  const addToast = useAppStore((s) => s.addToast)
  const elevenKey = useSettingsStore((s) => s.elevenLabsApiKey)

  // Per-scene selections. avatar/voice start UNSET (the user opts in by picking — keeps the
  // card clean); product follows the angle's lock table.
  const [avatarRef, setAvatarRef] = useState<string | null>(null)
  const [avatarName, setAvatarName] = useState('')
  const [voiceId, setVoiceId] = useState(lastVoice?.id ?? '')
  const [voiceName, setVoiceName] = useState(lastVoice?.name ?? '')
  const [productOn, setProductOn] = useState(() => lockOn(angle.toggles.product))
  const [res, setRes] = useState<StudioResolution>('720p')
  const [dur, setDur] = useState(6)
  const [line, setLine] = useState(idea?.suggestedLine ?? '')
  const [prompt, setPrompt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const avatarThumb = useAssetUrl(avatarRef ?? undefined)
  const avatarAllowed = angle.toggles.avatar !== 'lock-off'
  const productLock = angle.toggles.product   // 'on' | 'off' | 'lock-on' | 'lock-off'

  const toggles: SceneToggles = { avatar: !!avatarRef, voice: !!voiceId, product: productOn }
  const spec = resolveSceneSpec(angle, toggles)
  const credit = sceneCredit(angle, toggles, res, dur)
  const voiceNeedsLine = !!voiceId && !line.trim()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const id = await saveAsset(file, file.type || 'image/jpeg')
      setAvatarRef(id); setAvatarName(file.name.replace(/\.[^.]+$/, ''))
    } catch { addToast('Tải ảnh avatar lỗi', 'error') }
  }

  const makePrompt = async () => {
    if (!product) { addToast('Chưa chọn sản phẩm', 'error'); return }
    if (voiceNeedsLine) { addToast('Đã chọn giọng thì phải điền Câu thoại', 'error'); return }
    setBusy(true)
    try {
      const r = await engineerScenePrompt({ angle, idea, toggles, line, durationSec: dur, product, lang, geminiKey })
      const spoken = !!voiceId && line.trim()
        ? ` · Câu thoại "${line.trim()}" sẽ được ${avatarRef ? 'lồng tiếng + nhép môi' : 'lồng tiếng'} khi render (model video không vẽ chữ).`
        : ''
      setPrompt(r.conceptPromptEn); setNote(r.noteVi + spoken)
    } catch (e) {
      addToast(`Tạo prompt lỗi: ${(e instanceof Error ? e.message : String(e)).slice(0, 100)}`, 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-900">{angle.labelVi}</p>
        {spec.isCard && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Thẻ ảnh</span>}
        {spec.role === 'lips' && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Lipsync</span>}
      </div>
      {idea ? <p className="mt-1 rounded-lg bg-violet-50 p-2 text-[12px] text-violet-900">{idea.ideaVi}</p>
            : <p className="mt-1 text-[11px] italic text-gray-400">{angle.descVi}</p>}

      {/* ── Selections: only what's usable shows (no locked-off clutter) ─────── */}
      <div className="mt-2 flex flex-col gap-1.5">
        {/* Avatar — picker / upload, or hidden if the angle forbids a person */}
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
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-300">
                + Avatar (kho)
              </button>
              <button onClick={() => fileRef.current?.click()} title="Tải ảnh avatar riêng"
                className="rounded p-1 text-gray-500 ring-1 ring-gray-300 hover:bg-violet-50 hover:text-violet-700"><Upload className="h-3 w-3" /></button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
          )
        )}

        {/* Voice — opens the ElevenLabs picker; selecting reveals the spoken-line box */}
        {voiceId ? (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            <Mic className="h-3 w-3" /><span className="max-w-[110px] truncate">{voiceName}</span>
            <button onClick={() => setVoiceId('')} className="rounded-full p-0.5 hover:bg-emerald-200"><X className="h-2.5 w-2.5" /></button>
          </span>
        ) : (
          <button onClick={() => setVoicePickerOpen(true)}
            className="self-start rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-300 hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-300">
            + Giọng đọc
          </button>
        )}

        {/* Product — locked-off hidden; locked-on static chip; free → toggle */}
        {productLock === 'lock-on' ? (
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"><Check className="h-3 w-3" /> Có sản phẩm</span>
        ) : (productLock === 'on' || productLock === 'off') ? (
          <button onClick={() => setProductOn((v) => !v)}
            className={`self-start rounded px-1.5 py-0.5 text-[10px] font-semibold ${productOn ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'} ring-1 ring-transparent hover:ring-emerald-300`}>
            {productOn ? '✓ ' : ''}Sản phẩm
          </button>
        ) : null}
      </div>

      {/* Spoken line — only when a voice is chosen (it's VOICED, never drawn on screen) */}
      {voiceId && (
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Câu thoại (giọng sẽ đọc)…"
          className={`mt-2 w-full rounded-lg border px-2 py-1 text-[12px] focus:outline-none ${voiceNeedsLine ? 'border-rose-300' : 'border-gray-300 focus:border-violet-400'}`} />
      )}

      {/* Duration + resolution + live credit */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-gray-500">{dur}s</span>
        <input type="range" min={2} max={10} step={1} value={dur} onChange={(e) => setDur(Number(e.target.value))} className="flex-1" />
        <div className="flex overflow-hidden rounded-md border border-gray-200 text-[10px] font-semibold">
          {(['480p', '720p'] as const).map((r) => (
            <button key={r} onClick={() => setRes(r)} className={res === r ? 'bg-violet-600 px-1.5 py-0.5 text-white' : 'bg-white px-1.5 py-0.5 text-gray-500'}>{r === '480p' ? 'Rẻ' : 'Nét'}</button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button onClick={makePrompt} disabled={busy || !product || voiceNeedsLine}
          className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-[12px] font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Tạo prompt
        </button>
        <button disabled title="Render + tải — Phase 3"
          className="ml-auto rounded-lg bg-gray-200 px-2.5 py-1.5 text-[12px] font-bold text-gray-500">
          Render ~{credit}cr
        </button>
      </div>

      {note && <p className="mt-2 rounded bg-gray-50 p-2 text-[11px] text-gray-600">📝 {note}</p>}
      {prompt && <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
        className="mt-1 w-full rounded border border-gray-200 p-1.5 font-mono text-[10px] text-gray-500" />}

      {/* Pickers (mounted only while open) */}
      {avatarPickerOpen && (
        <BankPicker bankType="models" isOpen
          onSelect={(item) => { const m = item as Model; setAvatarRef(m.characterImage || null); setAvatarName(m.name); setAvatarPickerOpen(false) }}
          onClose={() => setAvatarPickerOpen(false)} />
      )}
      {voicePickerOpen && (
        <VoicePickerModal apiKey={elevenKey}
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
  // Mode-2 has its OWN input (separate store) — never touches mode-1 state.
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
  const [freeText, setFreeText] = useState('')
  // Remember the last-picked voice so the next scene defaults to it (less repetitive picking).
  const [lastVoice, setLastVoice] = useState<{ id: string; name: string } | null>(null)

  const buildStudio = async () => {
    if (!product) { addToast('Chưa chọn sản phẩm — vào Input chọn trước', 'error'); return }
    if (!geminiKey) { addToast('Thiếu Gemini API key trong Settings', 'error'); return }
    setLoading(true)
    try {
      const r = await generateStudioIdeas(product, lang, geminiKey)
      setIdeas(r.ideas)
      addToast('✓ Đã tạo ý tưởng cho 11 cảnh', 'success')
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

        {/* GLOBAL input (Mode 2 standalone) — only PRODUCT + language; avatar/voice are
            picked per-scene. Reads its own store, never mode-1's state. */}
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
        </div>

        <button onClick={buildStudio} disabled={loading || !product}
          className="mb-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {Object.keys(ideas).length > 0 ? 'Tạo lại ý tưởng' : 'Tạo xưởng (gợi ý 11 cảnh)'}
        </button>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {STUDIO_ANGLES.map((a) => (
            <StudioSceneCard key={a.id} angle={a} idea={ideas[a.id]} product={product} lang={lang} geminiKey={geminiKey}
              lastVoice={lastVoice} onVoicePicked={setLastVoice} />
          ))}
          <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-3">
            <p className="text-sm font-bold text-gray-900"><Wand2 className="mr-1 inline h-4 w-4 text-violet-600" /> Cảnh tự do (mô tả bằng lời)</p>
            <p className="mt-0.5 text-[11px] text-gray-400">Gõ mô tả — AI tự dựng prompt chuẩn bám sản phẩm.</p>
            <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={2}
              placeholder="VD: phụ nữ 50 tuổi đang đau đầu gối, chưa lộ sản phẩm, nền bếp…"
              className="mt-2 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] focus:border-violet-400 focus:outline-none" />
            <p className="mt-1 text-[10px] text-gray-400">⚙️ Tạo prompt + render — sắp có ở Phase tiếp.</p>
          </div>
        </div>
      </div>

      <BankPicker bankType="products" isOpen={pickerOpen}
        onSelect={(item) => { setProduct(item as Product); setPickerOpen(false) }}
        onClose={() => setPickerOpen(false)} />
    </div>
  )
}
