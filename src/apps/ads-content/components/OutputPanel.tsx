import { useState } from 'react'
import {
  Copy, Check, Save, RotateCcw, Loader2, GraduationCap, Megaphone,
  Trash2,
} from 'lucide-react'
import type { AdsContentResult, AdsContentVariation } from '../types'
import { useAdsContentStore } from '../store'
import { useAppStore } from '../../../stores/appStore'
import { TONE_OPTIONS, getPlatformById } from '../services/presets'

interface OutputPanelProps {
  result: AdsContentResult | null
  isGenerating: boolean
  onRegenerate: () => void
}

export default function OutputPanel({ result, isGenerating, onRegenerate }: OutputPanelProps) {
  if (isGenerating && !result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
        <p className="text-sm font-medium text-gray-700">Đang viết 3 variations content...</p>
        <p className="text-xs text-gray-400 max-w-sm">
          Gemini đang viết caption đa biến thể bằng VN + Bahasa Melayu cho post của bạn
        </p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Megaphone className="h-10 w-10 text-gray-200" strokeWidth={1.5} />
        <p className="text-sm text-gray-400">Chọn sản phẩm + preset rồi nhấn "Tạo content"</p>
        <p className="text-xs text-gray-300 max-w-sm">
          3 variations caption với góc hook khác nhau, mỗi cái có VN + Bahasa Melayu, sẵn sàng paste vào Facebook / TikTok / IG ads
        </p>
      </div>
    )
  }

  const activeTones = TONE_OPTIONS.filter((t) => result.toneIds.includes(t.id))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Meta header */}
      <div className="shrink-0 border-b border-black/8 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge color="pink"><span>{result.presetGlyph}</span> {result.presetLabel}</Badge>
          <Badge color="gray">{result.platformLabel}</Badge>
          <Badge color="gray">{result.lengthMode}</Badge>
          <Badge color={result.ctaStrength === 'hard' ? 'rose' : result.ctaStrength === 'soft' ? 'emerald' : 'blue'}>
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

      {/* Variations + history grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {result.variations.map((v, idx) => (
          <VariationCard
            key={v.id}
            variation={v}
            index={idx}
            result={result}
          />
        ))}

        {/* Footer actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-black/[0.04] disabled:opacity-40"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Tạo lại tất cả 3 variations
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
      <div className="flex items-center justify-between gap-2 border-b border-black/8 bg-gradient-to-r from-pink-50/60 to-rose-50/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-pink-600 px-2 py-0.5 text-[10px] font-bold text-white">
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

      <div className={`grid grid-cols-1 gap-3 p-3 ${variation.vietnamese && variation.malay ? 'lg:grid-cols-2' : ''}`}>
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
              <div className="rounded-xl border border-dashed border-black/10 bg-gray-50/60 p-2.5">
                <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                  🇻🇳 Bản dịch VN (để bạn hiểu)
                </p>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-gray-600">{variation.malayGlossVi}</p>
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
              : 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-200 disabled:text-gray-400'
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
        <span className="block text-[12px] font-semibold text-gray-800">{title}</span>
        {gloss && <span className="block text-[10px] italic text-gray-400">{gloss}</span>}
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
        <button onClick={onCopy} className="text-[10px] text-pink-600 hover:underline">
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

function Badge({ color, children }: { color: 'pink' | 'gray' | 'rose' | 'emerald' | 'blue'; children: React.ReactNode }) {
  const cls =
    color === 'pink'    ? 'bg-pink-100 text-pink-700' :
    color === 'rose'    ? 'bg-rose-100 text-rose-700' :
    color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
    color === 'blue'    ? 'bg-blue-100 text-blue-700' :
    'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  )
}

// ── Suppress unused import for getPlatformById (kept for future) ─────────
void getPlatformById
