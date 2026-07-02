import { memo, useState, useSyncExternalStore } from 'react'
import { Copy, Check, ChevronDown, Image as ImageIcon, Loader2, RotateCcw, Download, AlertCircle, AlertTriangle, Sparkles, Trash2, Globe2, Bug, Pencil, Undo2 } from 'lucide-react'
import type { LandingSection, ImagePrompt, SectionType } from '../types'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import {
  getAttemptsForAsset, subscribeDebug, isDebugMode,
  type DebugAttempt,
} from '../debugStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { IMAGE_MODEL_INFO } from '../../../utils/imageModelInfo'

const SECTION_GLYPH: Record<SectionType, string> = {
  hero:                    '🚀',
  pain:                    '😩',
  'why-happens':           '🔬',
  'failed-solutions':      '❌',
  'product-discovery':     '✨',
  ingredients:             '🧪',
  mechanism:               '⚙️',
  benefits:                '✅',
  comparison:              '⚖️',
  lifestyle:               '🌅',
  'expert-feedback':       '🩺',
  'expert-kol':            '🎓',
  'magazine-feature':      '📖',
  'stat-proof':            '📈',
  'web-authority-proof':   '🔎',
  'social-proof':          '💬',
  'whatsapp-testimonials': '📱',
  'news-proof':            '📰',
  'before-after':          '🔄',
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
  comparison:              'border-indigo-200 bg-indigo-50/40',
  lifestyle:               'border-pink-200 bg-pink-50/40',
  'expert-feedback':       'border-stone-300 bg-stone-50/40',
  'expert-kol':            'border-amber-300 bg-amber-50/40',
  'magazine-feature':      'border-emerald-300 bg-emerald-50/40',
  'stat-proof':            'border-fuchsia-300 bg-fuchsia-50/40',
  'web-authority-proof':   'border-blue-200 bg-blue-50/40',
  'social-proof':          'border-amber-200 bg-amber-50/40',
  'whatsapp-testimonials': 'border-green-200 bg-green-50/40',
  'news-proof':            'border-slate-200 bg-slate-50/40',
  'before-after':          'border-purple-200 bg-purple-50/40',
  offer:                   'border-orange-200 bg-orange-50/40',
  faq:                     'border-gray-200 bg-gray-50/40',
  'final-cta':             'border-violet-300 bg-violet-50/40',
}

const NEW_SECTION_BADGE: Partial<Record<SectionType, string>> = {
  comparison:   'bg-indigo-100 text-indigo-700',
  'news-proof': 'bg-slate-100 text-slate-700',
  'before-after': 'bg-purple-100 text-purple-700',
  'expert-feedback': 'bg-stone-100 text-stone-700',
  'magazine-feature': 'bg-emerald-100 text-emerald-700',
  'stat-proof': 'bg-fuchsia-100 text-fuchsia-700',
  'web-authority-proof': 'bg-blue-100 text-blue-700',
}

interface SectionCardProps {
  index: number
  section: LandingSection
  onRegenerateImage?: (sectionIdx: number, imageIdx: number) => void
  onDeleteImage?: (sectionIdx: number, imageIdx: number) => void
  onUpdatePrompt?: (sectionIdx: number, imageIdx: number, newPrompt: string) => void
  onRestorePrompt?: (sectionIdx: number, imageIdx: number) => void
}

function SectionCardImpl({ index, section, onRegenerateImage, onDeleteImage, onUpdatePrompt, onRestorePrompt }: SectionCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [showViTranslation, setShowViTranslation] = useState(false)
  const glyph = SECTION_GLYPH[section.type] ?? '📄'
  const accent = SECTION_ACCENT[section.type] ?? 'border-black/10 bg-white'
  const isNewSection =
    section.type === 'comparison' ||
    section.type === 'news-proof' ||
    section.type === 'before-after' ||
    section.type === 'expert-feedback' ||
    section.type === 'magazine-feature' ||
    section.type === 'stat-proof' ||
    section.type === 'web-authority-proof'

  return (
    <div className={`rounded-xl border ${accent} shadow-sm overflow-hidden`}>
      <div className="flex w-full items-start justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-start gap-2 text-left min-w-0"
        >
          <span className="mt-0.5 shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 shadow-sm">
            {index + 1}
          </span>
          <span className="text-base leading-tight">{glyph}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900 leading-snug">{section.title}</h3>
              {isNewSection && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${NEW_SECTION_BADGE[section.type] ?? 'bg-gray-100 text-gray-600'}`}>
                  MỚI
                </span>
              )}
            </div>
            {section.titleVi
              && section.titleVi.trim().toLowerCase() !== section.title.trim().toLowerCase() && (
              <p className="mt-0.5 flex items-start gap-1 text-[11px] italic leading-snug text-blue-700/85">
                <span className="shrink-0 text-[10px] pt-px">🇻🇳</span>
                <span>{section.titleVi}</span>
              </p>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <CopyAllButton
            text={section.titleVi ? `${section.title}\n🇻🇳 ${section.titleVi}` : section.title}
            compact
            title="Chép tiêu đề section (kèm bản dịch nếu có)"
          />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md p-1 text-gray-400 hover:bg-black/[0.04]"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-black/8 bg-white p-2.5 md:p-4">
          {section.layoutGuide && (
            <InfoBlock label="Hướng dẫn layout" tone="violet">
              {section.layoutGuide}
            </InfoBlock>
          )}

          {section.headline && (
            <FieldRow label="Headline" value={section.headline} valueVi={section.headlineVi} />
          )}
          {section.subheadline && (
            <FieldRow label="Subheadline" value={section.subheadline} valueVi={section.subheadlineVi} />
          )}
          {section.cta && (
            <FieldRow label="CTA button" value={section.cta} valueVi={section.ctaVi} highlight="orange" />
          )}
          {section.offerStrip && (
            <FieldRow label="Offer strip" value={section.offerStrip} valueVi={section.offerStripVi} highlight="rose" />
          )}
          {section.urgencyText && (
            <FieldRow label="Urgency" value={section.urgencyText} valueVi={section.urgencyTextVi} highlight="amber" />
          )}

          {section.copy && (
            <BlockField label="Copy chính" body={section.copy} />
          )}

          {section.viTranslation && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/40">
              <button
                type="button"
                onClick={() => setShowViTranslation((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-blue-700 hover:bg-blue-50/60"
              >
                <Globe2 className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">
                  {showViTranslation ? '− Ẩn bản dịch tiếng Việt' : '🇻🇳 Xem bản dịch tiếng Việt'}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showViTranslation ? 'rotate-180' : ''}`} />
              </button>
              {showViTranslation && (
                <div className="border-t border-blue-100 px-3 pb-3 pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">🇻🇳 Bản dịch tiếng Việt</p>
                    <CopyAllButton text={section.viTranslation} />
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-blue-900">{section.viTranslation}</p>
                </div>
              )}
            </div>
          )}

          {section.bullets && section.bullets.length > 0 && (
            section.bulletsVi && section.bulletsVi.length > 0
              ? <BilingualBullets bullets={section.bullets} bulletsVi={section.bulletsVi} />
              : <BlockField label="Bullets" body={section.bullets.map((b) => `• ${b}`).join('\n')} />
          )}

          {section.faqs && section.faqs.length > 0 && (
            <div className="rounded-lg border border-black/8 bg-gray-50/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Câu hỏi thường gặp</p>
                <CopyAllButton text={section.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')} />
              </div>
              <div className="space-y-2">
                {section.faqs.map((f, i) => (
                  <FaqItemBilingual
                    key={i}
                    question={f.question}
                    answer={f.answer}
                    vi={section.faqsVi?.[i]}
                  />
                ))}
              </div>
            </div>
          )}

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

          {section.imagePrompts && section.imagePrompts.length > 0 && (
            <div className="rounded-lg border border-black/8 bg-gradient-to-br from-gray-50/60 to-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Assets ({section.imagePrompts.length})
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
                    assetKey={`${index}:${i}`}
                    onRegenerate={onRegenerateImage ? () => onRegenerateImage(index, i) : undefined}
                    onDelete={onDeleteImage ? () => onDeleteImage(index, i) : undefined}
                    onUpdatePrompt={onUpdatePrompt ? (newPrompt: string) => onUpdatePrompt(index, i, newPrompt) : undefined}
                    onRestorePrompt={onRestorePrompt ? () => onRestorePrompt(index, i) : undefined}
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

const SectionCard = memo(SectionCardImpl)
export default SectionCard

// ─────────────────────────────────────────────────────────────────────

function ImagePromptCardImpl({
  prompt, assetKey, onRegenerate, onDelete, onUpdatePrompt, onRestorePrompt,
}: {
  prompt: ImagePrompt
  assetKey: string
  onRegenerate?: () => void
  onDelete?: () => void
  onUpdatePrompt?: (newPrompt: string) => void
  onRestorePrompt?: () => void
}) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [advancedEdit, setAdvancedEdit] = useState(false)
  const [draftPrompt, setDraftPrompt] = useState(prompt.prompt)
  const resolvedUrl = useAssetUrl(prompt.generatedAssetRef ?? undefined)
  const debugMode = isDebugMode()
  const imageModel = useSettingsStore((s) => s.imageModel)
  const CREDIT_PER_IMAGE = IMAGE_MODEL_INFO[imageModel].creditsPerImage   // theo model đang chọn

  const wasEdited = !!prompt.originalPrompt && prompt.originalPrompt !== prompt.prompt
  const draftDiffers = draftPrompt !== prompt.prompt
  const canEdit = !!onUpdatePrompt

  const isLoading = prompt.status === 'queued' || prompt.status === 'generating' || prompt.status === 'retrying'
  const hasImage = prompt.status === 'done' && prompt.generatedAssetRef
  const hasError = prompt.status === 'failed'
  const isEmpty = !isLoading && !hasImage && !hasError

  const handleDownload = () => {
    if (!resolvedUrl) return
    const a = document.createElement('a')
    a.href = resolvedUrl
    a.download = prompt.filename || 'landing-image.png'
    a.click()
  }

  const aspectClass =
    prompt.aspectRatio === '1:1' ? 'aspect-square' :
    prompt.aspectRatio === '16:9' ? 'aspect-video' :
    prompt.aspectRatio === '9:16' ? 'aspect-[9/16]' :
    'aspect-[4/5]'

  const styleBadgeCls = prompt.style.toLowerCase().includes('whatsapp') ? 'bg-green-100 text-green-700' :
    prompt.style.toLowerCase().includes('facebook') ? 'bg-blue-100 text-blue-700' :
    prompt.style.toLowerCase().includes('tiktok') ? 'bg-pink-100 text-pink-700' :
    prompt.style.toLowerCase().includes('shopee') ? 'bg-orange-100 text-orange-700' :
    prompt.style.toLowerCase().includes('news') || prompt.style.toLowerCase().includes('authority') ? 'bg-slate-100 text-slate-700' :
    prompt.style.toLowerCase().includes('before') || prompt.style.toLowerCase().includes('after') ? 'bg-purple-100 text-purple-700' :
    prompt.style.toLowerCase().includes('comparison') ? 'bg-indigo-100 text-indigo-700' :
    prompt.style.toLowerCase().includes('text overlay') ? 'bg-rose-100 text-rose-700' :
    prompt.style.toLowerCase().includes('selfie') || prompt.style.toLowerCase().includes('crowd') ? 'bg-amber-100 text-amber-700' :
    'bg-violet-100 text-violet-700'

  return (
    <div className="rounded-md border border-black/8 bg-white overflow-hidden">
      <div className={`group relative ${aspectClass} w-full bg-gray-100`}>
        {hasImage && resolvedUrl ? (
          <img src={resolvedUrl} alt={prompt.filename} className="h-full w-full object-cover" />
        ) : isLoading ? (
          <div className={`flex h-full flex-col items-center justify-center gap-1.5 ${prompt.status === 'retrying' ? 'text-amber-500' : 'text-violet-400'}`}>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[9px] font-medium">
              {prompt.status === 'queued'    ? 'Hàng chờ' :
               prompt.status === 'retrying'  ? 'Thử lại…' :
                                               'Đang sinh…'}
            </span>
          </div>
        ) : hasError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="line-clamp-2 text-[9px] leading-tight">{prompt.error ?? 'Lỗi'}</span>
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-gray-400">
            <ImageIcon className="h-5 w-5 opacity-40" />
            <span className="text-[9px] text-gray-400">Chưa sinh</span>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                title={`Tạo ảnh này (~${CREDIT_PER_IMAGE} credit)`}
                className="flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-violet-700"
              >
                <Sparkles className="h-3 w-3" /> Tạo ảnh
              </button>
            )}
            <span className="text-[9px] text-gray-300">~{CREDIT_PER_IMAGE} credit</span>
          </div>
        ) : null}

        {hasImage && (
          <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100">
            <IconButton onClick={handleDownload} title="Tải xuống" color="black">
              <Download className="h-3 w-3" />
            </IconButton>
            {onRegenerate && (
              <IconButton onClick={onRegenerate} title={`Tạo lại (~${CREDIT_PER_IMAGE} credit)`} color="violet">
                <RotateCcw className="h-3 w-3" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton onClick={onDelete} title="Xoá ảnh" color="red">
                <Trash2 className="h-3 w-3" />
              </IconButton>
            )}
          </div>
        )}

        {hasError && onRegenerate && (
          <button
            onClick={onRegenerate}
            className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-md bg-red-500/85 px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-red-600"
          >
            <RotateCcw className="h-3 w-3" /> Thử lại
          </button>
        )}

        <div className="absolute left-1.5 top-1.5">
          <span className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
            {prompt.aspectRatio}
          </span>
        </div>
      </div>

      <div className="px-2 py-1.5 space-y-1">
        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${styleBadgeCls}`}>
          {prompt.style}
        </span>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-mono text-[9px] text-gray-400">{prompt.filename}</span>
          {hasImage && (
            <button
              onClick={handleDownload}
              title="Tải xuống"
              className="flex items-center gap-0.5 rounded border border-black/10 px-1.5 py-0.5 text-[9px] text-gray-500 hover:bg-black/[0.04]"
            >
              <Download className="h-2.5 w-2.5" /> Tải
            </button>
          )}
        </div>
        {/* Fix nested-button bug (HTML invalid): tách CopyAllButton thành
            sibling thay vì nest trong outer toggle button. Trước đây
            <button><span/><CopyAllButton/></button> khiến browser parser
            auto-spit-out inner button → layout vỡ + click copy không fire. */}
        <div className="flex w-full items-center justify-between gap-1 text-[10px] text-gray-500">
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="flex flex-1 items-center gap-1 text-left hover:text-gray-700"
          >
            <span className="flex items-center gap-1">
              {showPrompt ? '− Ẩn prompt' : '+ Xem prompt'}
              {wasEdited && (
                <span
                  className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700"
                  title="Prompt đã bị sửa khỏi bản gốc"
                >
                  đã sửa
                </span>
              )}
            </span>
          </button>
          <CopyAllButton text={prompt.prompt} compact />
        </div>
        {showPrompt && !advancedEdit && (
          <p className="whitespace-pre-wrap rounded bg-gray-50 p-1.5 text-[10px] leading-snug text-gray-600">
            {prompt.prompt}
          </p>
        )}
        {showPrompt && advancedEdit && (
          <div className="space-y-1.5">
            <div className="flex items-start gap-1.5 rounded border border-red-300 bg-red-50 p-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
              <p className="text-[10px] leading-snug text-red-800">
                <span className="font-bold">⚠️ Cảnh báo:</span> Sửa prompt có thể phá identity lock
                (sản phẩm, nhân vật, brand badge, dáng bao bì, recipe layout) — ảnh sinh ra có thể
                lệch khỏi thiết kế gốc. Chỉ nên sửa phần <span className="font-semibold">scene description</span>,
                <span className="font-semibold"> mood/lighting</span>, hoặc <span className="font-semibold">text overlay nội dung</span>.
                Sau khi sửa, bấm "Tạo lại" để render lại ảnh.
              </p>
            </div>
            <textarea
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              spellCheck={false}
              rows={8}
              className="w-full resize-y rounded border border-red-200 bg-white p-1.5 font-mono text-[10px] leading-snug text-gray-800 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => { onUpdatePrompt?.(draftPrompt) }}
                disabled={!draftDiffers}
                className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                title="Lưu prompt đã sửa (tự đồng bộ vào project)"
              >
                <Check className="h-2.5 w-2.5" /> Lưu prompt
              </button>
              <button
                type="button"
                onClick={() => setDraftPrompt(prompt.prompt)}
                disabled={!draftDiffers}
                className="flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-black/[0.04] disabled:opacity-40"
                title="Bỏ thay đổi chưa lưu"
              >
                Bỏ thay đổi
              </button>
              {wasEdited && onRestorePrompt && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Khôi phục prompt về bản gốc lúc tạo pack? Mọi sửa đổi sẽ bị xoá.')) {
                      onRestorePrompt()
                      setDraftPrompt(prompt.originalPrompt ?? prompt.prompt)
                    }
                  }}
                  className="ml-auto flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100"
                  title="Khôi phục prompt về bản gốc lúc pack được tạo"
                >
                  <Undo2 className="h-2.5 w-2.5" /> Khôi phục gốc
                </button>
              )}
            </div>
          </div>
        )}
        {showPrompt && canEdit && (
          <button
            type="button"
            onClick={() => {
              setAdvancedEdit((v) => {
                if (!v) setDraftPrompt(prompt.prompt)
                return !v
              })
            }}
            className={`flex w-full items-center gap-1 text-[10px] ${
              advancedEdit ? 'text-red-600 hover:text-red-700' : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Chỉnh sửa prompt tay (nâng cao — rủi ro phá identity lock)"
          >
            <Pencil className="h-2.5 w-2.5" />
            <span>{advancedEdit ? '− Đóng chỉnh sửa nâng cao' : '+ Chỉnh sửa nâng cao'}</span>
          </button>
        )}

        {debugMode && (
          <>
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="flex w-full items-center gap-1 text-[10px] text-violet-600 hover:text-violet-700"
              title="Hiển thị log debug — raw prompt, retry history, fail reason"
            >
              <Bug className="h-3 w-3" />
              <span>{showDebug ? '− Ẩn debug log' : '+ Debug log'}</span>
            </button>
            {showDebug && <DebugAttemptsList assetKey={assetKey} />}
          </>
        )}
      </div>
    </div>
  )
}

const ImagePromptCard = memo(ImagePromptCardImpl)

// ─────────────────────────────────────────────────────────────────────

function DebugAttemptsList({ assetKey }: { assetKey: string }) {
  const attempts = useSyncExternalStore(
    subscribeDebug,
    () => getAttemptsForAsset(assetKey),
    () => [] as DebugAttempt[],
  )
  if (attempts.length === 0) {
    return <p className="text-[10px] italic text-gray-400">Chưa có log — bấm Thử lại để chạy.</p>
  }
  return (
    <div className="space-y-1 rounded border border-violet-200 bg-violet-50/40 p-1.5">
      {attempts.map((a, i) => (
        <div key={i} className="text-[10px] leading-snug text-gray-700">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono">
              attempt {a.attempt}/{a.maxAttempts} · {a.provider} · {a.kieSize} · refs={a.filesUrlCount}
            </span>
            <span className={
              a.status === 'success'   ? 'rounded bg-green-100 px-1 font-bold text-green-700' :
              a.status === 'started'   ? 'rounded bg-blue-100 px-1 font-bold text-blue-700' :
              a.status === 'recovered' ? 'rounded bg-amber-100 px-1 font-bold text-amber-700' :
              a.status === 'timeout'   ? 'rounded bg-orange-100 px-1 font-bold text-orange-700' :
              a.status === 'cancelled' ? 'rounded bg-gray-100 px-1 font-bold text-gray-600' :
                                          'rounded bg-red-100 px-1 font-bold text-red-700'
            }>{a.status}</span>
          </div>
          <div className="font-mono text-[9px] text-gray-500">
            taskId: {a.taskId ?? '—'}
            {' · '}duration: {a.durationMs ? (a.durationMs / 1000).toFixed(1) + 's' : 'in-flight'}
            {' · '}started: {new Date(a.startedAt).toLocaleTimeString()}
          </div>
          {a.errorReason && (
            <div className="mt-0.5 rounded bg-red-50 px-1 py-0.5 font-mono text-[9px] leading-tight text-red-700 break-all">
              {a.errorReason.slice(0, 200)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────

function IconButton({
  onClick, title, color, children,
}: {
  onClick: () => void
  title: string
  color: 'black' | 'violet' | 'red'
  children: React.ReactNode
}) {
  const cls =
    color === 'violet' ? 'bg-violet-500 hover:bg-violet-600' :
    color === 'red'    ? 'bg-red-500 hover:bg-red-600' :
    'bg-black/70 hover:bg-black/90'
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

function FieldRow({
  label, value, valueVi, highlight,
}: {
  label: string
  value: string
  valueVi?: string
  highlight?: 'orange' | 'rose' | 'amber'
}) {
  const valueCls =
    highlight === 'orange' ? 'bg-orange-50 text-orange-800 border-orange-200' :
    highlight === 'rose'   ? 'bg-rose-50 text-rose-800 border-rose-200'       :
    highlight === 'amber'  ? 'bg-amber-50 text-amber-800 border-amber-200'    :
    'bg-gray-50 text-gray-800 border-black/8'

  const showVi = !!valueVi && valueVi.trim().toLowerCase() !== value.trim().toLowerCase()

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
      <span className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <div className="flex-1 space-y-1">
        <div className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[12px] ${valueCls}`}>
          <span className="flex-1">{value}</span>
          <CopyAllButton text={value} compact />
        </div>
        {showVi && (
          <div className="flex items-start gap-1.5 rounded-md border border-blue-100 bg-blue-50/30 px-2.5 py-1 pl-3">
            <span className="shrink-0 text-[10px] leading-tight pt-px">🇻🇳</span>
            <span className="flex-1 italic text-[11px] leading-snug text-blue-800/85">{valueVi}</span>
            <CopyAllButton text={valueVi!} compact />
          </div>
        )}
      </div>
    </div>
  )
}

function BilingualBullets({
  bullets, bulletsVi,
}: {
  bullets: string[]
  bulletsVi: string[]
}) {
  const copyBlob = bullets.map((b, i) => {
    const vi = bulletsVi[i]?.trim()
    return vi && vi.toLowerCase() !== b.trim().toLowerCase()
      ? `• ${b}\n   🇻🇳 ${vi}`
      : `• ${b}`
  }).join('\n')
  return (
    <div className="rounded-lg border border-black/8 bg-gray-50/40 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Bullets <span className="text-blue-500">· 🇻🇳 song ngữ</span>
        </p>
        <CopyAllButton text={copyBlob} />
      </div>
      <ul className="space-y-2">
        {bullets.map((b, i) => {
          const vi = bulletsVi[i]?.trim()
          const showVi = !!vi && vi.toLowerCase() !== b.trim().toLowerCase()
          return (
            <li key={i} className="space-y-0.5">
              <p className="text-[13px] leading-relaxed text-gray-800">• {b}</p>
              {showVi && (
                <p className="ml-3 border-l-2 border-blue-200 pl-2 text-[11px] italic leading-snug text-blue-800/85">
                  🇻🇳 {vi}
                </p>
              )}
            </li>
          )
        })}
      </ul>
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

interface CopyAllButtonProps {
  text: string
  compact?: boolean
  title?: string
}

/** P4 — FAQ item with bilingual VN translation toggle. Pattern mirrors
 *  the "Xem bản dịch tiếng Việt" toggle for copy chính. */
function FaqItemBilingual({
  question, answer, vi,
}: {
  question: string
  answer: string
  vi?: { question: string; answer: string }
}) {
  const [showVi, setShowVi] = useState(false)
  const hasVi = !!vi
    && (vi.question.trim().toLowerCase() !== question.trim().toLowerCase()
        || vi.answer.trim().toLowerCase() !== answer.trim().toLowerCase())

  return (
    <div className="rounded-md border border-black/8 bg-white p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-[12px] font-semibold text-gray-900">{question}</p>
        <CopyAllButton text={`Q: ${question}\nA: ${answer}${hasVi ? `\n\n🇻🇳 Q: ${vi!.question}\n🇻🇳 A: ${vi!.answer}` : ''}`} compact />
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-700">{answer}</p>

      {hasVi && (
        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/40">
          <button
            type="button"
            onClick={() => setShowVi((v) => !v)}
            className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[10px] font-semibold text-blue-700 hover:bg-blue-50/60"
          >
            <Globe2 className="h-3 w-3 shrink-0" />
            <span className="flex-1">
              {showVi ? '− Ẩn bản dịch tiếng Việt' : '🇻🇳 Xem bản dịch tiếng Việt'}
            </span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showVi ? 'rotate-180' : ''}`} />
          </button>
          {showVi && (
            <div className="border-t border-blue-100 px-2.5 pb-2 pt-1.5 space-y-1">
              <p className="text-[11px] font-semibold italic text-blue-900">🇻🇳 {vi!.question}</p>
              <p className="whitespace-pre-wrap text-[11px] italic leading-relaxed text-blue-800/90">{vi!.answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CopyAllButton({ text, compact, title: titleProp }: CopyAllButtonProps) {
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
      title={titleProp}
      className={`flex items-center gap-1 rounded-md border border-black/10 bg-white text-gray-600 transition-colors hover:bg-black/[0.04] ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[10px] font-medium'
      } ${copied ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {compact ? '' : (copied ? 'Đã chép' : 'Chép')}
    </button>
  )
}
