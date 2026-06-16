// ── B-roll Studio (Mode 2) — Phase 2 UI ──────────────────────────────────────
// "Tạo xưởng" → 11 grounded idea cards + a free-form card. Each card is a mini-studio:
// conditional toggles (locked per angle so it can't be mis-configured) + a 2-10s duration
// slider + a resolution tier + LIVE exact credit + "Tạo prompt" (the brain resolves the
// spec, writes a drift-proof i2v prompt with a 2-step self-critique, returns a VN NOTE).
// Render + trim + download land in Phase 3 (the render button shows the exact credit now).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Loader2, ArrowLeft, Sparkles, Wand2, Lock, Package } from 'lucide-react'
import { useBrollStudioStore } from '../stores/brollStudioStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAppStore } from '../../../../stores/appStore'
import BankPicker from '../../../../components/BankPicker'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import {
  STUDIO_ANGLES, generateStudioIdeas, engineerScenePrompt, resolveSceneSpec,
  type StudioIdea, type StudioAngle, type SceneToggles, type ToggleState,
} from '../services/brollStudioBrain'
import { estimateSceneCredit, FAITHFUL_FRAME_CR, type StudioResolution } from '../services/brollStudioModels'
import type { Product } from '../../../../stores/types'
import type { ScriptLang } from '../types'

const TOGGLE_LABEL: Record<keyof SceneToggles, string> = { avatar: 'Avatar', voice: 'Giọng', product: 'Sản phẩm', line: 'Lời thoại' }

function initToggles(a: StudioAngle): SceneToggles {
  const on = (s: ToggleState) => s === 'on' || s === 'lock-on'
  return { avatar: on(a.toggles.avatar), voice: on(a.toggles.voice), product: on(a.toggles.product), line: on(a.toggles.line) }
}

function sceneCredit(angle: StudioAngle, t: SceneToggles, res: StudioResolution, dur: number): number {
  const spec = resolveSceneSpec(angle, t)
  if (spec.isCard) return FAITHFUL_FRAME_CR    // social-proof = one gpt-4o-image card
  return estimateSceneCredit({ tier: spec.tier, resolution: res, durationSec: dur, withFaithfulFrame: spec.withFaithfulFrame })
}

function StudioSceneCard({ angle, idea, product, lang, geminiKey }: {
  angle: StudioAngle; idea?: StudioIdea; product: Product | null; lang: ScriptLang; geminiKey: string
}) {
  const addToast = useAppStore((s) => s.addToast)
  const [toggles, setToggles] = useState<SceneToggles>(() => initToggles(angle))
  const [res, setRes] = useState<StudioResolution>('720p')
  const [dur, setDur] = useState(6)
  const [line, setLine] = useState(idea?.suggestedLine ?? '')
  const [prompt, setPrompt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const spec = resolveSceneSpec(angle, toggles)
  const credit = sceneCredit(angle, toggles, res, dur)
  const voiceNeedsLine = toggles.voice && !line.trim()

  const toggle = (k: keyof SceneToggles) => {
    const lock = angle.toggles[k]
    if (lock === 'lock-on' || lock === 'lock-off') return   // locked — brain enforces
    setToggles((p) => ({ ...p, [k]: !p[k] }))
  }

  const makePrompt = async () => {
    if (!product) { addToast('Chưa chọn sản phẩm', 'error'); return }
    if (voiceNeedsLine) { addToast('Bật Giọng thì phải điền Lời thoại', 'error'); return }
    setBusy(true)
    try {
      const r = await engineerScenePrompt({ angle, idea, toggles, line, durationSec: dur, product, lang, geminiKey })
      setPrompt(r.conceptPromptEn); setNote(r.noteVi)
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

      {/* Conditional toggles */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(['avatar', 'voice', 'product', 'line'] as const).map((k) => {
          const lock = angle.toggles[k]
          const locked = lock === 'lock-on' || lock === 'lock-off'
          const on = toggles[k]
          return (
            <button key={k} onClick={() => toggle(k)} disabled={locked}
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
              } ${locked ? 'cursor-not-allowed opacity-80' : 'hover:ring-1 hover:ring-emerald-300'}`}>
              {locked && <Lock className="h-2.5 w-2.5" />}{TOGGLE_LABEL[k]}
            </button>
          )
        })}
      </div>

      {/* Spoken line (when voice/line on) */}
      {(toggles.voice || toggles.line) && (
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Lời thoại / chữ trên màn…"
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
            <StudioSceneCard key={a.id} angle={a} idea={ideas[a.id]} product={product} lang={lang} geminiKey={geminiKey} />
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
