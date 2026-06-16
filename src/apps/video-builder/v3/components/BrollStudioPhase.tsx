// ── B-roll Studio (Mode 2) — Phase 1 UI shell ────────────────────────────────
// Standalone "Xưởng B-roll": reuse the existing product/avatar/voice/lang inputs, press
// "Tạo xưởng" → ONE batch call produces 11 grounded scene ideas (+ a free-form card).
// Phase 1 shows the idea cards + previews which toggles each scene will expose (the lock
// table). Per-scene config (toggles + slider + credit + Tạo prompt + render/download)
// lands in Phase 2/3 — cards show a "sắp có" note for now.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Loader2, ArrowLeft, Sparkles, Wand2, Lock } from 'lucide-react'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAppStore } from '../../../../stores/appStore'
import { STUDIO_ANGLES, generateStudioIdeas, type StudioIdea, type ToggleState } from '../services/brollStudioBrain'

const TOGGLE_LABEL: Record<string, string> = { avatar: 'Avatar', voice: 'Giọng', product: 'Sản phẩm', line: 'Lời thoại' }

function ToggleChip({ name, state }: { name: string; state: ToggleState }) {
  const locked = state === 'lock-on' || state === 'lock-off'
  const on = state === 'on' || state === 'lock-on'
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
      on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
    }`}>
      {locked && <Lock className="h-2.5 w-2.5" />}{TOGGLE_LABEL[name]}{state === 'lock-off' ? ' ✕' : ''}
    </span>
  )
}

export default function BrollStudioPhase({ onBack }: { onBack: () => void }) {
  const state = useAdsVideoStore((s) => s.state)
  const geminiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast = useAppStore((s) => s.addToast)
  const product = state.inputs.product
  const lang = state.scriptBrain.outputLang
  const [ideas, setIdeas] = useState<Record<string, StudioIdea>>({})
  const [loading, setLoading] = useState(false)
  const [freeText, setFreeText] = useState('')

  const buildStudio = async () => {
    if (!product) { addToast('Chưa chọn sản phẩm — vào Input chọn trước', 'error'); return }
    if (!geminiKey) { addToast('Thiếu Gemini API key trong Settings', 'error'); return }
    setLoading(true)
    try {
      const res = await generateStudioIdeas(product, lang, geminiKey)
      setIdeas(res.ideas)
      addToast('✓ Đã tạo ý tưởng cho 11 cảnh', 'success')
    } catch (e) {
      addToast(`Tạo xưởng lỗi: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`, 'error')
    } finally { setLoading(false) }
  }

  const hasIdeas = Object.keys(ideas).length > 0

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🎬 Xưởng B-roll</h2>
            <p className="text-[12px] text-gray-500">
              Tạo cảnh rời xoay quanh sản phẩm để tự cắt ghép — chọn cảnh, cấu hình, render, tải về.
              {product ? ` Sản phẩm: ${product.productName}` : ' (chưa chọn sản phẩm)'}
            </p>
          </div>
          <button onClick={onBack}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50">
            <ArrowLeft className="h-3.5 w-3.5" /> Về chế độ Kịch bản
          </button>
        </div>

        {/* Build button */}
        <button onClick={buildStudio} disabled={loading || !product}
          className="mb-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {hasIdeas ? 'Tạo lại ý tưởng' : 'Tạo xưởng (gợi ý 11 cảnh)'}
        </button>

        {/* 11 angle cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STUDIO_ANGLES.map((a) => {
            const idea = ideas[a.id]
            return (
              <div key={a.id} className="rounded-xl border border-black/10 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">{a.labelVi}</p>
                  {a.isCard && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Thẻ ảnh</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-gray-400">{a.descVi}</p>
                {idea
                  ? <p className="mt-2 rounded-lg bg-violet-50 p-2 text-[12px] text-violet-900">{idea.ideaVi}</p>
                  : <p className="mt-2 text-[12px] italic text-gray-400">Bấm "Tạo xưởng" để gợi ý ý tưởng cảnh này…</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {(['avatar', 'voice', 'product', 'line'] as const).map((t) => (
                    <ToggleChip key={t} name={t} state={a.toggles[t]} />
                  ))}
                </div>
                {idea && <p className="mt-2 text-[10px] text-gray-400">⚙️ Cấu hình + render (chọn giây, credit) — sắp có ở bước sau.</p>}
              </div>
            )
          })}

          {/* Free-form card */}
          <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-3 sm:col-span-2">
            <p className="text-sm font-bold text-gray-900"><Wand2 className="mr-1 inline h-4 w-4 text-violet-600" /> Cảnh tự do (mô tả bằng lời)</p>
            <p className="mt-0.5 text-[11px] text-gray-400">Gõ mô tả cảnh muốn tạo — AI tự dựng prompt chuẩn (góc máy/bối cảnh) bám sản phẩm.</p>
            <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={2}
              placeholder="VD: phụ nữ 50 tuổi đang đau đầu gối, chưa lộ sản phẩm, nền nhà bếp…"
              className="mt-2 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] focus:border-violet-400 focus:outline-none" />
            <p className="mt-1 text-[10px] text-gray-400">⚙️ Tạo prompt + render — sắp có ở bước sau.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
