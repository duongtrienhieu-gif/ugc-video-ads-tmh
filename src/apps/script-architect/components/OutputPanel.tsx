import { useEffect, useRef, useState } from 'react'
import { Copy, Check, Save, RotateCcw, Loader2, GraduationCap, Sparkles, X, Package, Wand2, ArrowLeftRight, Clapperboard } from 'lucide-react'
import type { ScriptGenerationResult } from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { TONE_OPTIONS } from '../services/presets'
import { EyebrowLabel } from '../../../components/cinematic'

interface OutputPanelProps {
  result: ScriptGenerationResult | null
  productId: string | null
  productName: string | null
  isGenerating: boolean
  onRegenerate: () => void
  /** Phase B — go to / build the "Tách cảnh & Source" view. */
  onOpenShotPlan: () => void
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

export default function OutputPanel({
  result, productId, productName, isGenerating, onRegenerate, onOpenShotPlan,
}: OutputPanelProps) {
  const [copied, setCopied] = useState<'vietnamese' | 'malay' | null>(null)
  const [saved, setSaved] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Bản Malay sửa được — khởi từ result.malay, đồng bộ lại mỗi khi tạo/tạo-lại kịch bản.
  const [editedMalay, setEditedMalay] = useState('')
  useEffect(() => { setEditedMalay(result?.malay ?? '') }, [result])

  const addScript = useBankStore((s) => s.addScript)
  const addToast  = useAppStore((s) => s.addToast)

  const handleCopy = async (which: 'vietnamese' | 'malay') => {
    if (!result) return
    const text = which === 'vietnamese' ? result.vietnamese : editedMalay
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      addToast('Không sao chép được', 'error')
    }
  }

  const openSaveModal = () => {
    if (!result || !productId) return
    setDraftTitle(`${productName ?? 'Script'} — ${result.presetLabel}`)
    setSaveModalOpen(true)
  }

  const handleConfirmSave = async () => {
    if (!result || !productId || isSaving) return
    const title = (draftTitle.trim() || `${productName ?? 'Script'} — ${result.presetLabel}`).slice(0, 120)
    setIsSaving(true)
    try {
      // Only persist the Bahasa Melayu version — that's the one the downstream
      // UGC video pipeline (voice / video builder) uses for the Malaysian
      // market. Vietnamese box is reference-only and can be re-derived
      // anytime by regenerating from the same product + preset.
      await addScript({
        title,
        scriptText: editedMalay,
        linkedProductId: productId,
        source: 'script-architect',
      })
      setSaved(true)
      setSaveModalOpen(false)
      setTimeout(() => setSaved(false), 2500)
      addToast('✅ Đã lưu kịch bản Bahasa Melayu vào Project', 'success')
    } catch (err) {
      addToast(`Lưu thất bại: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (isGenerating && !result) {
    return (
      <div className="flex h-full flex-col p-5 sm:p-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2 pt-6 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--color-accent-dim)' }}
          >
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--color-accent)' }} />
          </span>
          <p className="mt-2 text-sm font-bold text-app-text">Đang viết kịch bản UGC…</p>
          <p className="max-w-sm text-xs text-app-subtle">
            Gemini đang dùng công thức preset + dữ liệu sản phẩm để viết script 🇻🇳 tiếng Việt + 🇲🇾 Bahasa Melayu
          </p>
        </div>
        {/* Twin skeleton boxes mimic the result layout */}
        <div className="mx-auto mt-6 grid w-full max-w-3xl flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-app-border bg-app-card p-4">
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-2.5 w-full" />
              <div className="skeleton h-2.5 w-[92%]" />
              <div className="skeleton h-2.5 w-[88%]" />
              <div className="skeleton h-2.5 w-3/4" />
              <div className="skeleton mt-2 h-2.5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (!result) {
    const steps = [
      { n: 1, icon: Package, label: 'Chọn sản phẩm', hint: 'từ kho Project' },
      { n: 2, icon: Wand2, label: 'Chọn công thức', hint: '12 preset thực chiến' },
      { n: 3, icon: Sparkles, label: 'Tạo kịch bản', hint: '1 cú nhấn' },
    ]
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-xl text-center">
          <div className="mb-3 flex justify-center">
            <EyebrowLabel rec>SCRIPT ENGINE · UGC</EyebrowLabel>
          </div>
          <span
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--color-accent-dim)' }}
          >
            <Sparkles className="h-8 w-8" style={{ color: 'var(--color-accent)' }} strokeWidth={1.75} />
          </span>
          <h2 className="text-xl font-bold leading-tight text-app-text sm:text-2xl">
            Kịch bản UGC chuẩn chuyển đổi,
            <br />
            <span style={{ color: 'var(--color-accent)' }}>trong 3 bước</span>
          </h2>

          <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-3">
            {steps.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.n} className="flex flex-col items-center gap-2 rounded-2xl border border-app-border bg-app-card px-3 py-4">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-app-card-elevated">
                    <Icon className="h-5 w-5 text-app-muted" />
                    <span
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
                    >
                      {s.n}
                    </span>
                  </span>
                  <span className="text-[13px] font-bold text-app-text">{s.label}</span>
                  <span className="text-[10px] text-app-subtle">{s.hint}</span>
                </div>
              )
            })}
          </div>

          <p className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-1.5 text-[11px] text-app-subtle">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Output 2 ngôn ngữ: 🇻🇳 tiếng Việt + 🇲🇾 Bahasa Melayu — chuẩn TikTok Ads / Reels / advertorial
          </p>
        </div>
      </div>
    )
  }

  // ── Result state ──────────────────────────────────────────────────────
  const activeTones = TONE_OPTIONS.filter((t) => result.toneModifiers.includes(t.id))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Meta header */}
      <div className="shrink-0 border-b border-app-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge color="accent">{result.presetLabel}</Badge>
          <Badge color="gray">{result.lengthSec}s</Badge>
          <Badge color={result.hookStrength === 'aggressive' ? 'rose' : result.hookStrength === 'safe' ? 'emerald' : 'accent'}>
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
          label="Vietnamese"
          sub="tham khảo"
          text={result.vietnamese}
          copied={copied === 'vietnamese'}
          onCopy={() => handleCopy('vietnamese')}
        />
        <ScriptBox
          flag="🇲🇾"
          label="Bahasa Melayu"
          sub="bản chính · sửa được · sẽ lưu"
          primary
          text={editedMalay}
          editable
          onChange={(v) => { setEditedMalay(v); if (saved) setSaved(false) }}
          copied={copied === 'malay'}
          onCopy={() => handleCopy('malay')}
        />
      </div>

      {/* Actions footer */}
      <div className="shrink-0 border-t border-app-border bg-app-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-app-subtle">
            🇲🇾 Lưu sẽ chỉ giữ bản <strong className="text-app-muted">Bahasa Melayu</strong> — bản tiếng Việt là tham khảo.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 rounded-full border border-app-border bg-app-card px-3 py-2 text-xs font-bold text-app-muted hover:bg-app-card-elevated disabled:opacity-40"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Tạo lại
            </button>
            <button
              onClick={onOpenShotPlan}
              className="ui-accent-soft flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold"
              title="Tách kịch bản thành các cảnh + tìm/tạo clip"
            >
              <Clapperboard className="h-3.5 w-3.5" /> Tách cảnh &amp; Source
            </button>
            <button
              onClick={openSaveModal}
              disabled={!productId || saved}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                saved ? 'bg-emerald-500/15 text-emerald-600' : 'ui-accent-solid disabled:opacity-40'
              }`}
            >
              {saved ? <><Check className="h-3.5 w-3.5" /> Đã lưu</> : <><Save className="h-3.5 w-3.5" /> Lưu vào Kịch bản</>}
            </button>
          </div>
        </div>
      </div>

      {saveModalOpen && (
        <SaveScriptModal
          title={draftTitle}
          onTitleChange={setDraftTitle}
          onCancel={() => setSaveModalOpen(false)}
          onConfirm={handleConfirmSave}
          isSaving={isSaving}
          presetLabel={result.presetLabel}
          lengthSec={result.lengthSec}
          hookStrength={result.hookStrength}
          previewText={editedMalay.slice(0, 140)}
        />
      )}
    </div>
  )
}

// ── Save modal ──────────────────────────────────────────────────────────

function SaveScriptModal({
  title, onTitleChange, onCancel, onConfirm, isSaving,
  presetLabel, lengthSec, hookStrength, previewText,
}: {
  title: string
  onTitleChange: (s: string) => void
  onCancel: () => void
  onConfirm: () => void
  isSaving: boolean
  presetLabel: string
  lengthSec: number
  hookStrength: string
  previewText: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && !isSaving && title.trim()) onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, onConfirm, isSaving, title])

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-app-border bg-app-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-app-border px-5 py-4" style={{ backgroundColor: 'var(--color-accent-dim)' }}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
          >
            <Save className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-app-text">Lưu Kịch Bản</h2>
            <p className="mt-0.5 text-[11px] text-app-muted">
              🇲🇾 Chỉ lưu bản <strong>Bahasa Melayu</strong> — bản tiếng Việt sẽ không được lưu.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-app-subtle transition-colors hover:bg-black/10 hover:text-app-text"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-app-subtle">
            Tên kịch bản
          </label>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="INFINITY PROBIOTICS — Emotional Storytelling"
            className="mt-1.5 w-full rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm text-app-text placeholder-app-faint outline-none focus:border-app-border-strong"
            maxLength={120}
          />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge color="accent">{presetLabel}</Badge>
            <Badge color="gray">{lengthSec}s</Badge>
            <Badge color={hookStrength === 'aggressive' ? 'rose' : hookStrength === 'safe' ? 'emerald' : 'accent'}>
              Hook: {hookStrength === 'aggressive' ? 'Gắt' : hookStrength === 'safe' ? 'An toàn' : 'Cân bằng'}
            </Badge>
            <Badge color="emerald">🇲🇾 Bahasa Melayu</Badge>
          </div>

          {previewText && (
            <div className="mt-3 rounded-lg border border-app-border bg-app-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-app-faint">Xem trước</p>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-app-muted">{previewText}…</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-app-border bg-app-surface px-5 py-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-app-border bg-app-card px-4 py-2 text-xs font-bold text-app-muted hover:bg-app-card-elevated disabled:opacity-40"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving || !title.trim()}
            className="ui-accent-solid flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function ScriptBox({
  flag, label, sub, text, copied, onCopy, primary = false, editable = false, onChange,
}: {
  flag: string
  label: string
  sub: string
  text: string
  copied: boolean
  onCopy: () => void
  primary?: boolean
  editable?: boolean
  onChange?: (s: string) => void
}) {
  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-app-card"
      style={primary ? { borderColor: 'var(--color-accent)' } : { borderColor: 'var(--color-border)' }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-app-border bg-app-surface px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{flag}</span>
          <div className="leading-tight">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-app-text">{label}</span>
            <span className="block text-[9px] font-medium uppercase tracking-wide" style={primary ? { color: 'var(--color-accent)' } : undefined}>
              {sub} · {wordCount(text)} từ
            </span>
          </div>
        </div>
        <button
          onClick={onCopy}
          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
            copied ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-app-border bg-app-card text-app-muted hover:bg-app-card-elevated'
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Đã chép' : 'Sao chép'}
        </button>
      </div>
      {editable ? (
        <textarea
          value={text}
          onChange={(e) => onChange?.(e.target.value)}
          spellCheck={false}
          placeholder="Sửa kịch bản Bahasa Melayu tại đây rồi bấm Lưu…"
          className="min-h-0 flex-1 resize-none whitespace-pre-wrap bg-transparent p-4 text-sm leading-relaxed text-app-text outline-none placeholder-app-faint"
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-app-text">{text}</p>
        </div>
      )}
    </div>
  )
}

function Badge({ color, children }: { color: 'accent' | 'gray' | 'rose' | 'emerald'; children: React.ReactNode }) {
  if (color === 'accent') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
      >
        {children}
      </span>
    )
  }
  const cls =
    color === 'rose' ? 'bg-rose-100 text-rose-700' :
    color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
    'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  )
}
