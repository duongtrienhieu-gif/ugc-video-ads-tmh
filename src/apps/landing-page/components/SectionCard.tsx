import { useState } from 'react'
import { Copy, Check, ChevronDown, Image as ImageIcon } from 'lucide-react'
import type { LandingSection, ImagePrompt, SectionType } from '../types'

// ─────────────────────────────────────────────────────────────────────
// Renders one advertorial section as a copy-paste-friendly card. Each
// piece (copy / image prompt / FAQ answer) has its own copy button so
// the user can drop chunks into Ladipage one at a time.
// ─────────────────────────────────────────────────────────────────────

const SECTION_GLYPH: Record<SectionType, string> = {
  hero:           '🚀',
  pain:           '😩',
  'why-happens':  '🔬',
  ingredients:    '🧪',
  'social-proof': '💬',
  'before-after': '↔️',
  benefits:       '✅',
  offer:          '🎁',
  faq:            '❓',
  'final-cta':    '📣',
}

const SECTION_ACCENT: Record<SectionType, string> = {
  hero:           'border-violet-300 bg-violet-50/40',
  pain:           'border-rose-200 bg-rose-50/40',
  'why-happens':  'border-blue-200 bg-blue-50/40',
  ingredients:    'border-emerald-200 bg-emerald-50/40',
  'social-proof': 'border-amber-200 bg-amber-50/40',
  'before-after': 'border-pink-200 bg-pink-50/40',
  benefits:       'border-teal-200 bg-teal-50/40',
  offer:          'border-orange-200 bg-orange-50/40',
  faq:            'border-gray-200 bg-gray-50/40',
  'final-cta':    'border-violet-300 bg-violet-50/40',
}

interface SectionCardProps {
  index: number
  section: LandingSection
}

export default function SectionCard({ index, section }: SectionCardProps) {
  const [expanded, setExpanded] = useState(true)
  const glyph = SECTION_GLYPH[section.type] ?? '📄'
  const accent = SECTION_ACCENT[section.type] ?? 'border-black/10 bg-white'

  return (
    <div className={`rounded-xl border ${accent} shadow-sm overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 shadow-sm">
            {index + 1}
          </span>
          <span className="text-base">{glyph}</span>
          <h3 className="text-sm font-bold text-gray-900">{section.title}</h3>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-black/8 bg-white p-4">
          {/* Layout guide */}
          {section.layoutGuide && (
            <InfoBlock label="Hướng dẫn layout" tone="violet">
              {section.layoutGuide}
            </InfoBlock>
          )}

          {/* Structured header fields */}
          {section.headline && (
            <FieldRow label="Headline" value={section.headline} />
          )}
          {section.subheadline && (
            <FieldRow label="Subheadline" value={section.subheadline} />
          )}
          {section.cta && (
            <FieldRow label="CTA button" value={section.cta} highlight="orange" />
          )}
          {section.offerStrip && (
            <FieldRow label="Offer strip" value={section.offerStrip} highlight="rose" />
          )}
          {section.urgencyText && (
            <FieldRow label="Urgency" value={section.urgencyText} highlight="amber" />
          )}

          {/* Main copy */}
          {section.copy && (
            <BlockField label="Copy chính" body={section.copy} />
          )}

          {/* Bullets */}
          {section.bullets && section.bullets.length > 0 && (
            <BlockField label="Bullets" body={section.bullets.map((b) => `• ${b}`).join('\n')} />
          )}

          {/* FAQs */}
          {section.faqs && section.faqs.length > 0 && (
            <div className="rounded-lg border border-black/8 bg-gray-50/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Câu hỏi thường gặp</p>
                <CopyAllButton text={section.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')} />
              </div>
              <div className="space-y-2">
                {section.faqs.map((f, i) => (
                  <div key={i} className="rounded-md border border-black/8 bg-white p-2.5">
                    <p className="text-[12px] font-semibold text-gray-900">{f.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-700">{f.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {section.reviews && section.reviews.length > 0 && (
            <div className="rounded-lg border border-black/8 bg-gray-50/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Review / Social proof</p>
                <CopyAllButton
                  text={section.reviews.map((r) =>
                    `${r.author}${r.meta ? ` · ${r.meta}` : ''}${r.rating ? ` (${r.rating}/5)` : ''}\n${r.quote}`,
                  ).join('\n\n')}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {section.reviews.map((r, i) => (
                  <div key={i} className="rounded-md border border-black/8 bg-white p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-semibold text-gray-900">{r.author}</p>
                      {r.rating && (
                        <span className="text-[10px] text-amber-500">{'★'.repeat(Math.max(1, Math.min(5, r.rating)))}</span>
                      )}
                    </div>
                    {r.meta && <p className="text-[10px] text-gray-400">{r.meta}</p>}
                    <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-700">{r.quote}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image prompts */}
          {section.imagePrompts && section.imagePrompts.length > 0 && (
            <div className="rounded-lg border border-black/8 bg-gradient-to-br from-gray-50/60 to-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Image prompts ({section.imagePrompts.length})
                </p>
                {section.imageSizeHint && (
                  <span className="ml-auto text-[10px] text-gray-400">{section.imageSizeHint}</span>
                )}
              </div>
              <div className="space-y-2">
                {section.imagePrompts.map((p, i) => (
                  <ImagePromptCard key={i} prompt={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function ImagePromptCard({ prompt }: { prompt: ImagePrompt }) {
  return (
    <div className="rounded-md border border-black/8 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-gray-500">{prompt.filename}</span>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">
            {prompt.style}
          </span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-600">
            {prompt.aspectRatio}
          </span>
          <CopyAllButton text={prompt.prompt} compact />
        </div>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-700">{prompt.prompt}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function FieldRow({ label, value, highlight }: { label: string; value: string; highlight?: 'orange' | 'rose' | 'amber' }) {
  const valueCls =
    highlight === 'orange' ? 'bg-orange-50 text-orange-800 border-orange-200' :
    highlight === 'rose'   ? 'bg-rose-50 text-rose-800 border-rose-200'       :
    highlight === 'amber'  ? 'bg-amber-50 text-amber-800 border-amber-200'    :
    'bg-gray-50 text-gray-800 border-black/8'
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
      <span className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <div className={`flex flex-1 items-start gap-2 rounded-md border px-2.5 py-1.5 text-[12px] ${valueCls}`}>
        <span className="flex-1">{value}</span>
        <CopyAllButton text={value} compact />
      </div>
    </div>
  )
}

function BlockField({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-lg border border-black/8 bg-gray-50/40 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
        <CopyAllButton text={body} />
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">{body}</p>
    </div>
  )
}

function InfoBlock({ label, tone, children }: { label: string; tone: 'violet'; children: React.ReactNode }) {
  const cls = tone === 'violet' ? 'border-violet-200 bg-violet-50 text-violet-900' : 'border-black/8 bg-gray-50 text-gray-800'
  return (
    <div className={`rounded-lg border p-2.5 text-[12px] leading-relaxed ${cls}`}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
      <div className="whitespace-pre-wrap">{children}</div>
    </div>
  )
}

function CopyAllButton({ text, compact }: { text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* silent */ }
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onCopy() }}
      className={`flex items-center gap-1 rounded-md border border-black/10 bg-white text-gray-600 transition-colors hover:bg-black/[0.04] ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[10px] font-medium'
      } ${copied ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {compact ? '' : (copied ? 'Đã chép' : 'Chép')}
    </button>
  )
}
