import { useState } from 'react'
import { Copy, Check, ChevronDown, Image as ImageIcon, Loader2, RotateCcw, Download, AlertCircle } from 'lucide-react'
import type { LandingSection, ImagePrompt, SectionType } from '../types'
import { useAssetUrl } from '../../../hooks/useAssetUrl'

// ─────────────────────────────────────────────────────────────────────
// Renders one advertorial section as a copy-paste-friendly card. Each
// piece (copy / image prompt / FAQ answer) has its own copy button so
// the user can drop chunks into Ladipage one at a time.
// ─────────────────────────────────────────────────────────────────────

const SECTION_GLYPH: Record<SectionType, string> = {
  hero:                    '🚀',
  pain:                    '😩',
  'why-happens':           '🔬',
  'failed-solutions':      '❌',
  'product-discovery':     '✨',
  ingredients:             '🧪',
  mechanism:               '⚙️',
  benefits:                '✅',
  lifestyle:               '🌅',
  'social-proof':          '💬',
  'whatsapp-testimonials': '📱',
  offer:                   '🎁',
  faq:                     '❓',
  'final-cta':             '📣',
}

const SECTION_ACCENT: Record<SectionType, string> = {
  hero:                    'border-violet-300 bg-violet-50/40',
  pain:                    'border-rose-200 bg-rose-50/40',
  'why-happens':           'border-blue-200 bg-blue-50/40',
  'failed-solutions':      'border-red-200 bg-red-50/40',
  'product-discovery':     'border-cyan-200 bg-cyan-50/40',
  ingredients:             'border-emerald-200 bg-emerald-50/40',
  mechanism:               'border-sky-200 bg-sky-50/40',
  benefits:                'border-teal-200 bg-teal-50/40',
  lifestyle:               'border-pink-200 bg-pink-50/40',
  'social-proof':          'border-amber-200 bg-amber-50/40',
  'whatsapp-testimonials': 'border-green-200 bg-green-50/40',
  offer:                   'border-orange-200 bg-orange-50/40',
  faq:                     'border-gray-200 bg-gray-50/40',
  'final-cta':             'border-violet-300 bg-violet-50/40',
}

interface SectionCardProps {
  index: number
  section: LandingSection
  /** Optional — when provided, image cards expose a per-image regen button. */
  onRegenerateImage?: (sectionIdx: number, imageIdx: number) => void
}

export default function SectionCard({ index, section, onRegenerateImage }: SectionCardProps) {
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.imagePrompts.map((p, i) => (
                  <ImagePromptCard
                    key={i}
                    prompt={p}
                    onRegenerate={onRegenerateImage ? () => onRegenerateImage(index, i) : undefined}
                  />
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

function ImagePromptCard({
  prompt, onRegenerate,
}: {
  prompt: ImagePrompt
  onRegenerate?: () => void
}) {
  const [showPrompt, setShowPrompt] = useState(false)
  const resolvedUrl = useAssetUrl(prompt.generatedAssetRef ?? undefined)

  const isLoading = prompt.status === 'queued' || prompt.status === 'generating'
  const hasImage = prompt.status === 'done' && prompt.generatedAssetRef
  const hasError = prompt.status === 'failed'

  const handleDownload = () => {
    if (!resolvedUrl) return
    const a = document.createElement('a')
    a.href = resolvedUrl
    a.download = prompt.filename || 'landing-image.png'
    a.click()
  }

  // Map aspect ratio → CSS aspect (preview thumbnails)
  const aspectClass =
    prompt.aspectRatio === '1:1' ? 'aspect-square' :
    prompt.aspectRatio === '16:9' ? 'aspect-video' :
    prompt.aspectRatio === '9:16' ? 'aspect-[9/16]' :
    'aspect-[4/5]'  // default 4:5

  return (
    <div className="rounded-md border border-black/8 bg-white overflow-hidden">
      {/* Image / state area */}
      <div className={`group relative ${aspectClass} w-full bg-gray-100`}>
        {hasImage && resolvedUrl ? (
          <img src={resolvedUrl} alt={prompt.filename} className="h-full w-full object-cover" />
        ) : isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-violet-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[9px] font-medium">
              {prompt.status === 'queued' ? 'Hàng chờ' : 'Đang sinh ảnh…'}
            </span>
          </div>
        ) : hasError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="line-clamp-2 text-[9px] leading-tight">{prompt.error ?? 'Lỗi'}</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-300">
            <ImageIcon className="h-5 w-5 opacity-40" />
            <span className="text-[9px]">Chưa sinh</span>
          </div>
        )}

        {/* Hover overlay actions — only when image exists */}
        {hasImage && (
          <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
            <IconButton onClick={handleDownload} title="Tải xuống" color="black">
              <Download className="h-3 w-3" />
            </IconButton>
            {onRegenerate && (
              <IconButton onClick={onRegenerate} title="Sinh lại ảnh" color="violet">
                <RotateCcw className="h-3 w-3" />
              </IconButton>
            )}
          </div>
        )}

        {/* Always-visible retry on failed */}
        {hasError && onRegenerate && (
          <button
            onClick={onRegenerate}
            className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-md bg-red-500/85 px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-red-600"
          >
            <RotateCcw className="h-3 w-3" /> Sinh lại
          </button>
        )}

        {/* Aspect + style badges */}
        <div className="absolute left-1.5 top-1.5 flex gap-1">
          <span className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
            {prompt.aspectRatio}
          </span>
        </div>
      </div>

      {/* Footer: filename + style + prompt toggle */}
      <div className="px-2 py-1.5 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-mono text-[9px] text-gray-500">{prompt.filename}</span>
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 shrink-0">
            {prompt.style}
          </span>
        </div>
        <button
          onClick={() => setShowPrompt((v) => !v)}
          className="flex w-full items-center justify-between gap-1 text-left text-[10px] text-gray-500 hover:text-gray-700"
        >
          <span>{showPrompt ? '− Ẩn prompt' : '+ Xem prompt'}</span>
          <CopyAllButton text={prompt.prompt} compact />
        </button>
        {showPrompt && (
          <p className="whitespace-pre-wrap rounded bg-gray-50 p-1.5 text-[10px] leading-snug text-gray-600">
            {prompt.prompt}
          </p>
        )}
      </div>
    </div>
  )
}

// Tiny icon button for hover overlay
function IconButton({
  onClick, title, color, children,
}: {
  onClick: () => void
  title: string
  color: 'black' | 'violet'
  children: React.ReactNode
}) {
  const cls = color === 'violet' ? 'bg-violet-500 hover:bg-violet-600' : 'bg-black/70 hover:bg-black/90'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-white shadow-sm backdrop-blur-sm transition-colors ${cls}`}
    >
      {children}
    </button>
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
