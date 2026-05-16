import { useState } from 'react'
import { Copy, Check, Save, RotateCcw, Loader2, GraduationCap, PenLine } from 'lucide-react'
import type { ScriptGenerationResult } from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { TONE_OPTIONS } from '../services/presets'

interface OutputPanelProps {
  result: ScriptGenerationResult | null
  productId: string | null
  productName: string | null
  isGenerating: boolean
  onRegenerate: () => void
}

export default function OutputPanel({
  result, productId, productName, isGenerating, onRegenerate,
}: OutputPanelProps) {
  const [copied, setCopied] = useState<'vietnamese' | 'malay' | null>(null)
  const [saved, setSaved] = useState(false)
  const [savedTitle, setSavedTitle] = useState('')

  const addScript = useBankStore((s) => s.addScript)
  const addToast  = useAppStore((s) => s.addToast)

  const handleCopy = async (which: 'vietnamese' | 'malay') => {
    if (!result) return
    const text = which === 'vietnamese' ? result.vietnamese : result.malay
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      addToast('Không sao chép được', 'error')
    }
  }

  const handleSave = async () => {
    if (!result || !productId) return
    const title = (savedTitle.trim() || `${productName ?? 'Script'} — ${result.presetLabel}`).slice(0, 120)
    try {
      // Only persist the Bahasa Melayu version — that's the one the
      // downstream UGC video pipeline (voice / video builder) uses for the
      // Malaysian market. English is reference-only and can be re-derived
      // anytime by regenerating from the same product + preset.
      await addScript({
        title,
        scriptText: result.malay,
        linkedProductId: productId,
        source: 'script-architect',
      })
      setSaved(true)
      setSavedTitle('')
      setTimeout(() => setSaved(false), 2500)
      addToast(`✓ Đã lưu "${title}" vào Project → Kịch bản`)
    } catch (err) {
      addToast(`Lưu thất bại: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error')
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (isGenerating && !result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-gray-700">Đang viết kịch bản UGC...</p>
        <p className="text-xs text-gray-400 max-w-sm">
          Gemini đang dùng công thức preset + dữ liệu sản phẩm để viết script tiếng Anh + Bahasa Melayu
        </p>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <PenLine className="h-10 w-10 text-gray-200" strokeWidth={1.5} />
        <p className="text-sm text-gray-400">Chọn sản phẩm + công thức rồi nhấn "Tạo kịch bản UGC"</p>
        <p className="text-xs text-gray-300 max-w-sm">
          Output gồm 2 box: kịch bản tiếng Anh + Bahasa Melayu, sẵn sàng dùng cho TikTok Ads / Reels / advertorial
        </p>
      </div>
    )
  }

  // ── Result state ──────────────────────────────────────────────────────
  const activeTones = TONE_OPTIONS.filter((t) => result.toneModifiers.includes(t.id))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Meta header */}
      <div className="shrink-0 border-b border-black/8 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge color="blue">{result.presetLabel}</Badge>
          <Badge color="gray">{result.lengthSec}s</Badge>
          <Badge color={result.hookStrength === 'aggressive' ? 'rose' : result.hookStrength === 'safe' ? 'emerald' : 'blue'}>
            Hook: {result.hookStrength === 'aggressive' ? 'Gắt' : result.hookStrength === 'safe' ? 'An toàn' : 'Cân bằng'}
          </Badge>
          {result.educationalMode && (
            <Badge color="emerald">
              <GraduationCap className="h-2.5 w-2.5" /> Educational
            </Badge>
          )}
          {activeTones.map((t) => (
            <Badge key={t.id} color="gray">{t.label}</Badge>
          ))}
        </div>
      </div>

      {/* 2 boxes side-by-side */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 lg:grid-cols-2">
        <ScriptBox
          flag="🇻🇳"
          label="Vietnamese script"
          text={result.vietnamese}
          copied={copied === 'vietnamese'}
          onCopy={() => handleCopy('vietnamese')}
        />
        <ScriptBox
          flag="🇲🇾"
          label="Bahasa Melayu"
          text={result.malay}
          copied={copied === 'malay'}
          onCopy={() => handleCopy('malay')}
        />
      </div>

      {/* Actions footer */}
      <div className="shrink-0 border-t border-black/8 bg-gray-50/60 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={savedTitle}
            onChange={(e) => setSavedTitle(e.target.value)}
            placeholder={`Tên preset (vd: "${productName ?? 'Script'} — ${result.presetLabel}")`}
            className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500/40"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-black/[0.04] disabled:opacity-40"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Tạo lại
            </button>
            <button
              onClick={handleSave}
              disabled={!productId || saved}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                saved
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400'
              }`}
            >
              {saved ? <><Check className="h-3.5 w-3.5" /> Đã lưu</> : <><Save className="h-3.5 w-3.5" /> Lưu vào Kịch bản</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function ScriptBox({
  flag, label, text, copied, onCopy,
}: {
  flag: string
  label: string
  text: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-gray-50/60 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600">
          {flag} {label}
        </span>
        <button
          onClick={onCopy}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
            copied
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Đã chép' : 'Sao chép'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{text}</p>
      </div>
    </div>
  )
}

function Badge({ color, children }: { color: 'blue' | 'gray' | 'rose' | 'emerald'; children: React.ReactNode }) {
  const cls =
    color === 'blue' ? 'bg-blue-100 text-blue-700' :
    color === 'rose' ? 'bg-rose-100 text-rose-700' :
    color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
    'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  )
}
