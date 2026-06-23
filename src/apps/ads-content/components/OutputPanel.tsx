import { useState } from 'react'
import {
  Copy, Check, Save, RotateCcw, Loader2, GraduationCap, Megaphone,
  Trash2,
} from 'lucide-react'
import type { AdsContentResult, AdsContentVariation } from '../types'
import { useAdsContentStore } from '../store'
import { useAppStore } from '../../../stores/appStore'
import { EyebrowLabel } from '../../../components/cinematic'
import { TONE_OPTIONS, getPlatformById } from '../services/presets'

interface OutputPanelProps {
  result: AdsContentResult | null
  isGenerating: boolean
  onRegenerate: () => void
}

export default function OutputPanel({ result, isGenerating, onRegenerate }: OutputPanelProps) {
  if (isGenerating && !result) {
    return (
      <div className="flex h-full flex-col p-5 sm:p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2 pt-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--color-accent-dim)' }}>
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--color-accent)' }} />
          </span>
          <p className="mt-2 text-sm font-bold text-app-text">Đang viết 4 variations content…</p>
          <p className="max-w-sm text-xs text-app-subtle">
            Gemini đang viết caption đa biến thể 🇻🇳 VN + 🇲🇾 Bahasa Melayu cho post của bạn
          </p>
        </div>
        <div className="mx-auto mt-6 grid w-full max-w-3xl flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-app-border bg-app-card p-4">
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-2.5 w-full" />
              <div className="skeleton h-2.5 w-[90%]" />
              <div className="skeleton h-2.5 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-xl text-center">
          <div className="mb-3 flex justify-center">
            <EyebrowLabel rec>ADS ENGINE · CAPTION</EyebrowLabel>
          </div>
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--color-accent-dim)' }}>
            <Megaphone className="h-8 w-8" style={{ color: 'var(--color-accent)' }} strokeWidth={1.75} />
          </span>
          <h2 className="text-xl font-bold leading-tight text-app-text sm:text-2xl">
            4 caption thực chiến,
            <br />
            <span style={{ color: 'var(--color-accent)' }}>mỗi góc một hook</span>
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-app-subtle">
            Chọn sản phẩm + góc tiếp cận → bấm <b className="text-app-muted">Tạo content</b>. Mỗi variation có
            🇻🇳 VN + 🇲🇾 Bahasa Melayu, sẵn sàng paste vào Facebook / TikTok / IG ads.
          </p>
        </div>
      </div>
    )
  }

  const activeTones = TONE_OPTIONS.filter((t) => result.toneIds.includes(t.id))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Meta header */}
      <div className="shrink-0 border-b border-black/8 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge color="accent"><span>{result.presetGlyph}</span> {result.presetLabel}</Badge>
          <Badge color="gray">{result.platformLabel}</Badge>
          <Badge color="gray">{result.lengthMode}</Badge>
          <Badge color={result.ctaStrength === 'hard' ? 'rose' : result.ctaStrength === 'soft' ? 'emerald' : 'accent'}>
            CTA: {result.ctaStrength === 'hard' ? 'Mạnh' : result.ctaStrength === 'soft' ? 'Mềm' : 'Cân bằng'}
          </Badge>
          {result.educationalMode && (
            <Badge color="emerald">
              <GraduationCap className="h-2.5 w-2.5" /> Mechanism
            </Badge>
          )}
          {activeTones.map((t) => (
            <Badge key={t.id} color="gray">{t.label}</Badge>
          ))}
        </div>
      </div>

      {/* Variations (2×2 grid on desktop) + history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {result.variations.map((v, idx) => (
            <VariationCard
              key={v.id}
              variation={v}
              index={idx}
              result={result}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-black/[0.04] disabled:opacity-40"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Tạo lại tất cả 4 variations
          </button>
        </div>

        <SavedHistorySection />
      </div>
    </div>
  )
}

// ── Variation card — VN + MY side-by-side ────────────────────────────

function VariationCard({
  variation, index, result,
}: {
  variation: AdsContentVariation
  index: number
  result: AdsContentResult
}) {
  const [copied, setCopied] = useState<'vn' | 'my' | null>(null)
  const [saved, setSaved] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const addToast = useAppStore((s) => s.addToast)
  const addToStore = useAdsContentStore((s) => s.add)

  const handleCopy = async (which: 'vn' | 'my') => {
    const text = which === 'vn' ? variation.vietnamese : variation.malay
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      addToast('Không sao chép được', 'error')
    }
  }

  const handleSave = () => {
    if (saving || saved) return
    setSaving(true)
    try {
      const t = (title.trim() || `${result.productName} — ${result.presetLabel}`).slice(0, 140)
      addToStore({
        productId: result.productId,
        productName: result.productName,
        presetId: result.presetId,
        presetLabel: result.presetLabel,
        presetGlyph: result.presetGlyph,
        platform: result.platform,
        platformLabel: result.platformLabel,
        vietnamese: variation.vietnamese,
        malay: variation.malay,
        hookLabel: variation.hookLabel,
        title: t,
      })
      setSaved(true)
      addToast(`✓ Đã lưu "${t}" vào Project → Ads Content`)
      setTimeout(() => setSaved(false), 2500)
      setTitle('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-app-border bg-app-surface px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}>
            Variation {index + 1}
          </span>
          <span className="text-[11px] font-medium text-gray-700">{variation.hookLabel}</span>
        </div>
      </div>

      {/* Titles / headlines to post alongside the video */}
      {variation.titles.length > 0 && (
        <div className="border-b border-black/8 bg-amber-50/40 px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
            ✍️ Tiêu đề đăng kèm video
          </p>
          <div className="space-y-1">
            {variation.titles.map((t, i) => (
              <TitleRow key={i} title={t} gloss={variation.titlesGlossVi?.[i]} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 p-3">
        {variation.vietnamese && (
          <CaptionBox
            flag="🇻🇳"
            label="Vietnamese"
            text={variation.vietnamese}
            copied={copied === 'vn'}
            onCopy={() => handleCopy('vn')}
          />
        )}
        {variation.malay && (
          <div className="flex flex-col gap-2">
            <CaptionBox
              flag="🇲🇾"
              label="Bahasa Melayu"
              text={variation.malay}
              copied={copied === 'my'}
              onCopy={() => handleCopy('my')}
            />
            {variation.malayGlossVi && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-sky-700">
                  🇻🇳 Bản dịch VN (để bạn hiểu)
                </p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-gray-900">{variation.malayGlossVi}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-black/8 bg-gray-50/60 p-3 sm:flex-row sm:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Tên (vd: "${result.productName} — ${result.presetLabel}")`}
          className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-pink-500/40"
        />
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
            saved
              ? 'bg-emerald-500/15 text-emerald-700'
              : 'ui-accent-solid disabled:bg-gray-200 disabled:text-gray-400'
          }`}
        >
          {saved ? <><Check className="h-3.5 w-3.5" /> Đã lưu</> : <><Save className="h-3.5 w-3.5" /> Lưu vào Project</>}
        </button>
      </div>
    </div>
  )
}

// ── Title row — one headline + optional VN gloss, click to copy ──────────

function TitleRow({ title, gloss }: { title: string; gloss?: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(title)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* silent */ }
  }
  return (
    <button
      onClick={onCopy}
      className="group flex w-full items-start gap-2 rounded-lg border border-black/8 bg-white px-2.5 py-1.5 text-left hover:bg-amber-50"
    >
      {copied
        ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
        : <Copy className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 group-hover:text-amber-600" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-gray-900">{title}</span>
        {gloss && <span className="block text-[12px] text-gray-600">{gloss}</span>}
      </span>
    </button>
  )
}

// ── Caption box — preserves Gemini's mobile-first formatting verbatim ───

function CaptionBox({
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
      <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-gray-50/60 px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
          {flag} {label}
        </span>
        <button
          onClick={onCopy}
          className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
            copied
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Đã chép' : 'Chép'}
        </button>
      </div>
      {/* Preserve blank-line paragraph breaks and emoji rhythm with whitespace-pre-wrap */}
      <div className="max-h-[500px] overflow-y-auto p-3.5">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">{text}</p>
      </div>
    </div>
  )
}

// ── Saved history — Project → Ads Content section ──────────────────────

function SavedHistorySection() {
  const items = useAdsContentStore((s) => s.items)
  const remove = useAdsContentStore((s) => s.remove)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <div className="mt-6 border-t border-black/8 pt-5">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
        📁 Project → Ads Content ({items.length})
      </h3>
      <p className="mb-3 text-[10px] text-gray-400">
        Tự động sync giữa các thiết bị qua Supabase (cùng email). Vẫn cache local để mở app nhanh khi offline.
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const isOpen = expandedId === item.id
          return (
            <div key={item.id} className="rounded-xl border border-black/10 bg-white overflow-hidden">
              <button
                onClick={() => setExpandedId(isOpen ? null : item.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-black/[0.02]"
              >
                <span className="text-base">{item.presetGlyph}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-800">{item.title}</p>
                  <p className="truncate text-[10px] text-gray-400">
                    {item.platformLabel} · {item.presetLabel} · {new Date(item.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-500">
                  {item.hookLabel.split(' ').slice(0, 3).join(' ')}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm('Xoá content này?')) remove(item.id) }}
                  className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Xoá"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>
              {isOpen && (
                <div className="grid grid-cols-1 gap-2 border-t border-black/8 bg-gray-50/40 p-3 lg:grid-cols-2">
                  <SavedTextBlock flag="🇻🇳" label="Vietnamese" text={item.vietnamese} />
                  <SavedTextBlock flag="🇲🇾" label="Bahasa Melayu" text={item.malay} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SavedTextBlock({ flag, label, text }: { flag: string; label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* silent */ }
  }
  return (
    <div className="rounded-lg border border-black/8 bg-white">
      <div className="flex items-center justify-between border-b border-black/8 px-2.5 py-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{flag} {label}</span>
        <button onClick={onCopy} style={{ color: 'var(--color-accent)' }} className="text-[10px] hover:underline">
          {copied ? '✓ Đã chép' : 'Chép'}
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-2.5">
        <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-gray-800">{text}</p>
      </div>
    </div>
  )
}

// ── Badge helper ────────────────────────────────────────────────────────

function Badge({ color, children }: { color: 'accent' | 'gray' | 'rose' | 'emerald'; children: React.ReactNode }) {
  if (color === 'accent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}>
        {children}
      </span>
    )
  }
  const cls =
    color === 'rose'    ? 'bg-rose-100 text-rose-700' :
    color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
    'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  )
}

// ── Suppress unused import for getPlatformById (kept for future) ─────────
void getPlatformById
