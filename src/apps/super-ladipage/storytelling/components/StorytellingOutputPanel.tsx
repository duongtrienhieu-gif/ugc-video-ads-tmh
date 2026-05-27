// ═════════════════════════════════════════════════════════════════════
// StorytellingOutputPanel — isolated renderer cho form 'advertorial'
//
// ⚠️ ZERO REUSE của UGC SectionCard / OutputPanel. Đây là isolated
// renderer riêng — diary / photo-book aesthetic, KHÔNG ecommerce vibe.
//
// Visual language:
//   - Reading column max-w-prose (vertical narrative flow)
//   - Background stone-50 (warm paper feel, không white sterile)
//   - Title font-serif italic (diary-like, không bold-sans UGC)
//   - Body text leading-loose, breathing whitespace
//   - Section spacing 20-28 (large vertical rhythm)
//   - Image placeholder = dotted-border modest box (không banner)
//   - Chapter/time-marker overlay simulation cho 2 section có budget
//
// P0.5 scope: render only — KHÔNG image gen, KHÔNG regen-image button.
// Image pipeline + identity lock sẽ đến ở Phase 3-4.
// ═════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import {
  AlertTriangle, BookOpen, Check, FilePlus, ImageIcon, Loader2,
  RotateCcw, Save, ShieldCheck, ShieldAlert, Smartphone, FileText,
} from 'lucide-react'
import type { LandingSection } from '../../types'
import type {
  AllowedOverlayType, BlockId, SectionGenStatus, StorytellingPack, VisualTreatment,
} from '../types'
import { BLOCK_POOL } from '../config/blockPool'
import { SECTION_VISUAL_MAP } from '../config/visualLanguage'
import { useAppStore } from '../../../../stores/appStore'
import { SemanticMobilePage } from '../../semanticRenderer'

const MOCK_MARKER_REGEX = /^\[MOCK P0\.5\]\s*\n+/

interface Props {
  pack: StorytellingPack
  isGenerating: boolean
  onRegenerate?: () => void
  onNewProject?: () => void
  onSaveAsProject?: (title?: string) => void
  loadedFromId?: string | null
  loadedProjectTitle?: string
}

export default function StorytellingOutputPanel({
  pack, isGenerating, onRegenerate, onNewProject, onSaveAsProject,
  loadedFromId, loadedProjectTitle,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // P7 — Toggle between legacy pack view and semantic mobile preview.
  // Semantic preview only available when pack has rendererAdaptedPage
  // (P11 superset of imagePromptPage — post-P4..P11 packs).
  const [viewMode, setViewMode] = useState<'pack' | 'semantic'>('pack')

  const addToast = useAppStore((s) => s.addToast)

  const meta = pack.storytellingMeta
  const character = pack.characterProfile
  const hasSemantic = Boolean(meta.rendererAdaptedPage)

  const handleSave = () => {
    if (saving || saved || !onSaveAsProject) return
    setSaving(true)
    try {
      const defaultTitle = `${pack.productName} — Hành Trình của ${character?.name ?? 'nhân vật'}`
      onSaveAsProject(defaultTitle.slice(0, 160))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      addToast(`✓ Đã lưu "${defaultTitle.slice(0, 60)}..."`)
    } finally {
      setSaving(false)
    }
  }

  if (isGenerating) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-stone-500" />
        <p className="font-serif italic text-sm text-stone-700">Đang viết câu chuyện...</p>
        <p className="text-xs text-stone-400 max-w-sm">
          AI đang lắp ráp 10 chương theo nhịp cảm xúc — không vội
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-stone-50">
      {/* ── HEADER — minimal, không dominate ─────────────────────────── */}
      <div className="shrink-0 border-b border-stone-200 bg-stone-50/95 backdrop-blur px-4 md:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <BookOpen className="h-4 w-4 text-stone-500 shrink-0" />
            <div className="min-w-0 truncate text-xs md:text-sm">
              <span className="font-serif italic text-stone-800">Kể Chuyện Hành Trình</span>
              <span className="text-stone-400 mx-2">·</span>
              <span className="text-stone-600">{pack.productName}</span>
              {character && (
                <>
                  <span className="text-stone-400 mx-2">·</span>
                  <span className="text-stone-500 italic">Nhân vật: {character.name}</span>
                </>
              )}
            </div>
            <PipelineStatusBadge meta={meta} />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* P7 — Semantic preview toggle (only if pack has rendererAdaptedPage / P11 superset) */}
            {hasSemantic && (
              <div className="flex items-center rounded-lg border border-stone-300 bg-white overflow-hidden">
                <button
                  onClick={() => setViewMode('pack')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] ${viewMode === 'pack' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-50'}`}
                  title="Xem pack đầy đủ"
                >
                  <FileText className="h-3 w-3" /> Pack
                </button>
                <button
                  onClick={() => setViewMode('semantic')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] border-l border-stone-300 ${viewMode === 'semantic' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-50'}`}
                  title="Xem semantic mobile preview (P7)"
                >
                  <Smartphone className="h-3 w-3" /> Semantic
                </button>
              </div>
            )}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700 hover:bg-stone-100"
                title="Tạo lại mock"
              >
                <RotateCcw className="h-3 w-3" /> Tạo lại
              </button>
            )}
            {onSaveAsProject && !loadedFromId && (
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                title="Lưu vào lịch sử"
              >
                {saved ? <Check className="h-3 w-3 text-emerald-600" /> : <Save className="h-3 w-3" />}
                {saved ? 'Đã lưu' : 'Lưu'}
              </button>
            )}
            {onNewProject && (
              <button
                onClick={onNewProject}
                className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700 hover:bg-stone-100"
                title="Tạo project mới"
              >
                <FilePlus className="h-3 w-3" /> Mới
              </button>
            )}
          </div>
        </div>

        {/* Meta strip (debug — helpful while engine wiring lên) */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-stone-400">
          <span>{pack.sections.length} chương</span>
          <span>·</span>
          <span>niche: {meta.niche}</span>
          <span>·</span>
          <span>nhịp: {meta.pacingType}</span>
          <span>·</span>
          <span>cảm xúc: {meta.emotionalIntensity}</span>
          <span>·</span>
          <span>sản phẩm xuất hiện: chương {meta.productRevealSection}</span>
          <span>·</span>
          <span>overlay used: {meta.overlayBudgetUsed}/2</span>
          {meta.attempts !== undefined && (
            <>
              <span>·</span>
              <span title={meta.validationSummary}>
                attempts: {meta.attempts}
              </span>
            </>
          )}
          {loadedFromId && loadedProjectTitle && (
            <>
              <span>·</span>
              <span className="italic">đã mở: {loadedProjectTitle}</span>
            </>
          )}
        </div>

        {/* Validation summary strip — only show if pipeline ran (P1+) */}
        {meta.validationSummary && (
          <div className={`mt-1 text-[10px] italic ${meta.validationSummary.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600'}`}>
            {meta.validationSummary}
          </div>
        )}
      </div>

      {/* ── READING COLUMN ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'semantic' && meta.rendererAdaptedPage ? (
          // P7 — Semantic mobile preview renderer (consumes RendererAdaptedPage
          // via subtype assignability to VisualSemanticsPage prop, P11)
          <SemanticMobilePage
            page={meta.rendererAdaptedPage}
            characterName={character?.name}
          />
        ) : (
          // Legacy pack view (default)
          <article className="max-w-prose mx-auto px-5 md:px-8 py-12 md:py-20">
            {pack.sections.map((section, idx) => (
              <StorytellingSectionView
                key={idx}
                section={section}
                sectionId={meta.sectionIds[idx]}
                overlayType={meta.overlayPerSection[idx]}
                chapterNumber={idx + 1}
                isLast={idx === pack.sections.length - 1}
                characterName={character?.name}
                status={meta.sectionStatus?.[idx]}
              />
            ))}

            {/* Footer breathing space */}
            <div className="mt-32 mb-8 text-center">
              <p className="font-serif italic text-xs text-stone-400">
                — hết —
              </p>
            </div>
          </article>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// Proof callout — P2 distributed proof rendering (mid-page quote callout)
//
// Renders proof piece as a quiet quote-style callout. No chapter header,
// no image, minimal visual chrome. Sits between story blocks at phase
// boundaries (proof-recognition / proof-solution / proof-future-self).
// ═════════════════════════════════════════════════════════════════════

interface ProofCalloutProps {
  section: LandingSection
  isLast: boolean
}

function ProofCalloutView({ section, isLast }: ProofCalloutProps) {
  const review = section.reviews?.[0]
  if (!review) return null  // no proof piece for this phase — render nothing
  return (
    <aside
      className={`${isLast ? '' : 'mb-20 md:mb-28'} border-l-2 border-stone-300 pl-5 py-3`}
    >
      <blockquote className="font-serif text-base md:text-[17px] text-stone-600 leading-[1.85] italic">
        <span className="text-stone-400 mr-1">"</span>
        {review.quote}
        <span className="text-stone-400 ml-1">"</span>
      </blockquote>
      {(review.author || review.meta) && (
        <figcaption className="mt-2 text-xs text-stone-500 not-italic">
          {review.author && <span>— {review.author}</span>}
          {review.meta && (
            <span className="text-stone-400">
              {review.author ? ' · ' : ''}{review.meta}
            </span>
          )}
        </figcaption>
      )}
    </aside>
  )
}

// ═════════════════════════════════════════════════════════════════════
// Section view — text-led layout, image as supporting (not dominant)
// ═════════════════════════════════════════════════════════════════════

interface SectionViewProps {
  section: LandingSection
  sectionId: BlockId
  overlayType: AllowedOverlayType | null
  chapterNumber: number
  isLast: boolean
  characterName?: string
  status?: SectionGenStatus
}

function StorytellingSectionView({
  section, sectionId, overlayType, chapterNumber, isLast, characterName, status,
}: SectionViewProps) {
  const blueprint = BLOCK_POOL[sectionId]
  const treatments = SECTION_VISUAL_MAP[sectionId] ?? []

  // P2 — Proof blocks (proof-recognition / proof-solution / proof-future-self):
  // render as quote-callout, not regular story section. No image, no chapter
  // header — minimal mid-page proof beat.
  const isProof = typeof sectionId === 'string' && sectionId.startsWith('proof-')

  if (isProof) {
    return <ProofCalloutView section={section} isLast={isLast} />
  }

  // Render each paragraph as a separate <p> for proper typography +
  // breathing rhythm. Engine outputs paragraphs[] joined into copy.
  const cleanParagraphs = section.copy
    .replace(MOCK_MARKER_REGEX, '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  // Image presence: Chunk E will redesign image plan per block.
  const hasImage = true

  return (
    <section className={isLast ? '' : 'mb-20 md:mb-28'}>
      {/* Chapter marker — tiny tracking-widest */}
      <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-3 flex items-center gap-2 flex-wrap">
        <span>Chương {chapterNumber}</span>
        <span className="text-stone-300 normal-case tracking-normal italic">
          · {blueprint?.phase ?? sectionId}
        </span>
        {status && status.kind !== 'pass' && (
          <SectionStatusInlineBadge status={status} />
        )}
      </p>

      {/* Title — serif italic, diary-like */}
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 leading-tight mb-6">
        {section.titleVi ?? section.title}
      </h2>

      {/* Image placeholder — appears ABOVE body cho blocks has image */}
      {hasImage && (
        <ImagePlaceholder
          chapterNumber={chapterNumber}
          characterName={characterName}
          sectionTitle={section.titleVi ?? section.title}
          overlayType={overlayType}
          treatments={treatments}
          continuityRequirement="optional"
          productVisibility="forbidden"
        />
      )}

      {/* Body copy — each paragraph as its own <p> for proper breathing space. */}
      <div className="font-serif text-base md:text-[17px] text-stone-700 leading-[1.95]">
        {cleanParagraphs.map((p, i) => (
          <p key={i} className={i === cleanParagraphs.length - 1 ? '' : 'mb-5'}>{p}</p>
        ))}
      </div>

      {/* Debug strip — block architecture. Helps verify phase/function
          assignment during Reader-Immersion engine development. */}
      {blueprint && (
        <div className="mt-6 space-y-1 text-[10px] italic text-stone-400">
          <p>
            phase: <span className="text-stone-500">{blueprint.phase}</span>
            {' · '}function: <span className="text-stone-500">{blueprint.psychologicalFunction}</span>
            {' · '}balance: <span className="text-stone-500">{blueprint.youIBalance}</span>
          </p>
          <p>
            paragraphs target: <span className="text-stone-500">{blueprint.paragraphTarget.min}-{blueprint.paragraphTarget.max}</span>
            {' · '}actual: <span className="text-stone-500">{cleanParagraphs.length}</span>
            {treatments.length > 0 && <> · visual: {treatments.join(' / ')}</>}
          </p>
        </div>
      )}
    </section>
  )
}

// ═════════════════════════════════════════════════════════════════════
// Image placeholder — modest, supports narrative (KHÔNG banner)
// ═════════════════════════════════════════════════════════════════════

interface PlaceholderProps {
  chapterNumber: number
  characterName?: string
  sectionTitle: string
  overlayType: AllowedOverlayType | null
  treatments: VisualTreatment[]
  continuityRequirement: 'anchor' | 'required' | 'optional' | 'none'
  productVisibility: 'forbidden' | 'mentioned-only' | 'subtle-background' | 'still-life'
}

function ImagePlaceholder({
  chapterNumber, characterName, sectionTitle, overlayType, treatments,
  continuityRequirement, productVisibility,
}: PlaceholderProps) {
  const overlayText = renderOverlayText(overlayType, chapterNumber, characterName, sectionTitle)
  const aspectClass = productVisibility === 'still-life' ? 'aspect-square' : 'aspect-[4/5]'

  return (
    <figure className="relative mb-8">
      <div
        className={`relative ${aspectClass} w-full max-w-sm mx-auto rounded-sm border border-dashed border-stone-300 bg-stone-100/40 flex flex-col items-center justify-center text-center px-4`}
      >
        <ImageIcon className="h-7 w-7 text-stone-300 mb-2" strokeWidth={1.5} />
        <p className="text-[11px] italic text-stone-500 leading-relaxed">
          {treatments.length > 0 ? treatments.join(' · ') : 'visual treatment'}
        </p>
        <p className="mt-1 text-[10px] text-stone-400">
          {continuityRequirement === 'anchor' && 'identity anchor — define lock'}
          {continuityRequirement === 'required' && 'continuity face required'}
          {continuityRequirement === 'optional' && 'face optional (peripheral OK)'}
          {continuityRequirement === 'none' && 'no face — object/landscape'}
        </p>
        <p className="mt-3 text-[10px] text-stone-300">[ảnh sẽ render ở Phase 3-4]</p>

        {/* Overlay simulation — italic serif, photo-book style */}
        {overlayText && (
          <span className="absolute bottom-3 left-3 max-w-[70%] rounded-sm bg-stone-50/85 backdrop-blur-sm px-2 py-0.5 font-serif italic text-[11px] text-stone-700">
            {overlayText}
          </span>
        )}
      </div>
    </figure>
  )
}

function renderOverlayText(
  overlayType: AllowedOverlayType | null,
  chapterNumber: number,
  characterName: string | undefined,
  sectionTitle: string,
): string | null {
  if (!overlayType) return null
  switch (overlayType) {
    case 'chapter-marker':
      // "Chương 1" — short, photo-book chapter style
      return `Chương ${chapterNumber}`
    case 'diary-timestamp':
      // Time-marker dùng section title (mock đã chứa "Ba tuần sau" / "Bây giờ"...)
      return sectionTitle
    case 'photobook-caption':
      return characterName
        ? `${characterName}, ${sectionTitle.toLowerCase()}.`
        : sectionTitle
    case 'film-subtitle':
      return `"${sectionTitle}"`
    default:
      return null
  }
}

// ═════════════════════════════════════════════════════════════════════
// Pipeline status badge — header strip
// ═════════════════════════════════════════════════════════════════════

interface PipelineStatusBadgeProps {
  meta: StorytellingPack['storytellingMeta']
}

function PipelineStatusBadge({ meta }: PipelineStatusBadgeProps) {
  // No pipeline meta = mock/legacy pack
  if (meta.attempts === undefined) {
    return (
      <span
        className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-700 shrink-0"
        title="Mock/legacy pack — không có pipeline meta"
      >
        MOCK
      </span>
    )
  }

  const fallbackCount = meta.sectionStatus?.filter((s) => s.kind === 'fallback').length ?? 0
  const retryPassCount = meta.sectionStatus?.filter((s) => s.kind === 'retry-pass').length ?? 0

  if (fallbackCount > 0) {
    return (
      <span
        className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 shrink-0"
        title={`${fallbackCount} section(s) downgraded to fallback after ${meta.attempts} attempts`}
      >
        <ShieldAlert className="h-3 w-3" />
        FALLBACK · {fallbackCount}
      </span>
    )
  }
  if (retryPassCount > 0 || meta.attempts > 1) {
    return (
      <span
        className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 shrink-0"
        title={`Passed on attempt ${meta.attempts}`}
      >
        <ShieldCheck className="h-3 w-3" />
        RETRY {meta.attempts}
      </span>
    )
  }
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shrink-0"
      title="All 5 validators passed on first attempt"
    >
      <ShieldCheck className="h-3 w-3" />
      CLEAN
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════
// Per-section status inline badge — only renders when status != 'pass'
// ═════════════════════════════════════════════════════════════════════

interface SectionStatusInlineBadgeProps {
  status: SectionGenStatus
}

function SectionStatusInlineBadge({ status }: SectionStatusInlineBadgeProps) {
  if (status.kind === 'pass') return null

  if (status.kind === 'retry-pass') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 normal-case tracking-normal"
        title={'First-attempt violations resolved on retry:\n' + status.firstAttemptViolations.join('\n')}
      >
        <Check className="h-2.5 w-2.5" />
        retry-pass
      </span>
    )
  }

  // fallback
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 normal-case tracking-normal"
      title={'Section downgraded to fallback after 2 failed attempts:\n' + status.violations.join('\n')}
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      fallback
    </span>
  )
}
