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
  BookOpen, Check, FilePlus, ImageIcon, Loader2, RotateCcw, Save,
} from 'lucide-react'
import type { LandingSection } from '../../types'
import type {
  AllowedOverlayType, SectionId, StorytellingPack, VisualTreatment,
} from '../types'
import { SECTION_BLUEPRINTS } from '../config/sectionBlueprints'
import { SECTION_VISUAL_MAP } from '../config/visualLanguage'
import { useAppStore } from '../../../../stores/appStore'

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

  const addToast = useAppStore((s) => s.addToast)

  const meta = pack.storytellingMeta
  const character = pack.characterProfile

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
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-700 shrink-0"
              title="Mock data — Phase P0.5. AI generation chưa wired."
            >
              MOCK P0.5
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
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
          {loadedFromId && loadedProjectTitle && (
            <>
              <span>·</span>
              <span className="italic">đã mở: {loadedProjectTitle}</span>
            </>
          )}
        </div>
      </div>

      {/* ── READING COLUMN ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
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
            />
          ))}

          {/* Footer breathing space */}
          <div className="mt-32 mb-8 text-center">
            <p className="font-serif italic text-xs text-stone-400">
              — hết —
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// Section view — text-led layout, image as supporting (not dominant)
// ═════════════════════════════════════════════════════════════════════

interface SectionViewProps {
  section: LandingSection
  sectionId: SectionId
  overlayType: AllowedOverlayType | null
  chapterNumber: number
  isLast: boolean
  characterName?: string
}

function StorytellingSectionView({
  section, sectionId, overlayType, chapterNumber, isLast, characterName,
}: SectionViewProps) {
  const blueprint = SECTION_BLUEPRINTS[sectionId]
  const treatments = SECTION_VISUAL_MAP[sectionId] ?? []
  const cleanCopy = section.copy.replace(MOCK_MARKER_REGEX, '')
  const hasImage = blueprint.imageRequirement.countDefault > 0

  return (
    <section className={isLast ? '' : 'mb-20 md:mb-28'}>
      {/* Chapter marker — tiny tracking-widest */}
      <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-3">
        Chương {chapterNumber}
        <span className="ml-2 text-stone-300 normal-case tracking-normal italic">
          · {blueprint.role}
        </span>
      </p>

      {/* Title — serif italic, diary-like */}
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 leading-tight mb-6">
        {section.titleVi ?? section.title}
      </h2>

      {/* Image placeholder — appears ABOVE body cho sections has image */}
      {hasImage && (
        <ImagePlaceholder
          chapterNumber={chapterNumber}
          characterName={characterName}
          sectionTitle={section.titleVi ?? section.title}
          overlayType={overlayType}
          treatments={treatments}
          continuityRequirement={blueprint.continuityRequirement}
          productVisibility={blueprint.productVisibility}
        />
      )}

      {/* Body copy — generous leading, serif feel matches title */}
      <div className="font-serif text-base md:text-[17px] text-stone-700 leading-[1.95] whitespace-pre-line">
        {cleanCopy}
      </div>

      {/* Debug hint — emotional beat + treatment + product visibility */}
      <p className="mt-6 text-[10px] italic text-stone-400">
        beat: {blueprint.emotionalBeat}
        {treatments.length > 0 && <> · visual: {treatments.join(' / ')}</>}
        {' · '}sản phẩm: {blueprint.productVisibility}
        {blueprint.curiosityGapAfter && <> · ↻ curiosity gap</>}
      </p>
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
