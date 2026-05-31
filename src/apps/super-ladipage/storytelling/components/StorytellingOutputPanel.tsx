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

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BookOpen, Check, FilePlus, ImageIcon, Loader2,
  RotateCcw, Save, ShieldCheck, ShieldAlert, FileText,
  Sparkles, X,
} from 'lucide-react'
import type { LandingSection } from '../../types'
import type {
  AllowedOverlayType, BlockId, SectionGenStatus, StorytellingPack, VisualTreatment,
} from '../types'
import { BLOCK_POOL } from '../config/blockPool'
import { SECTION_VISUAL_MAP } from '../config/visualLanguage'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { SemanticMobilePage } from '../../semanticRenderer'
import {
  createLandingSession,
  saveSession,
  setRegenStatus,
  setReviewVerdict,
  toggleReviewFlag,
  type LandingSession,
  type ReviewFlag,
} from '../../sessionRuntime'
import {
  createKieGptImageExecutor,
  createKieGpt4oImageExecutor,
  useImageGeneration,
  type ExecutorRegistry,
  type GeneratedAsset,
  type PageGenerationContext,
} from '../../generationOrchestration'

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
  // FIX 2026-05-27 — Semantic view removed per user request. Pack view
  // (article) is the only view now. Keeping state stub for minimal diff
  // to legacy conditional render path below; always 'pack'.
  const [viewMode] = useState<'pack' | 'semantic'>('pack')

  const addToast = useAppStore((s) => s.addToast)

  const meta = pack.storytellingMeta
  const character = pack.characterProfile
  const hasSemantic = Boolean(meta.exportablePage)

  // ── P16A — Landing session state ─────────────────────────────────
  // Auto-create session when pack becomes available. Persist to IDB
  // best-effort. Mutations are in-memory; persistence happens on
  // significant events (regen / review).
  const [session, setSession] = useState<LandingSession | null>(null)

  // ── UI-FIX5 (2026-05-28) — Local asset overlay map ───────────────
  // CRITICAL fix for the "click 4-5 lần ko ra ảnh" silent-fail.
  // meta.exportablePage is captured at pack-gen time and never
  // re-built when an image is generated, so the URL coming back from
  // executePageGeneration → onSectionComplete had nowhere to land.
  // We keep a per-section overlay map keyed by composed section id;
  // useImageGeneration.onAssetUpdated writes into it, and the render
  // path below prefers this overlay over the stale meta asset.
  // (Reset effect lives below — once packKey is in scope.)
  const [assetOverlay, setAssetOverlay] = useState<Record<string, GeneratedAsset>>({})

  // Initial session creation (and re-creation if pack identity changes)
  const packKey = useMemo(() => {
    if (!meta.exportablePage) return null
    return `${pack.productName}::${meta.niche}::${meta.exportablePage.sourcePackBlockCount}`
  }, [pack.productName, meta.niche, meta.exportablePage])

  useEffect(() => {
    if (!meta.exportablePage || !packKey) return
    // Skip if session already matches this pack
    if (session && session.packIdentity.productName === pack.productName &&
        session.packIdentity.niche === meta.niche) return
    const fresh = createLandingSession(meta.exportablePage, {
      productName: pack.productName,
      niche: meta.niche,
    })
    setSession(fresh)
    void saveSession(fresh)
  }, [packKey, meta.exportablePage, meta.niche, pack.productName, session])

  // UI-FIX5 (2026-05-28) — clear the asset overlay when pack identity
  // changes so a fresh pack doesn't reuse the previous pack's image URLs.
  useEffect(() => {
    setAssetOverlay({})
  }, [packKey])

  // ── POST-REBUILD — KIE executors + live image generation hook ──
  // Two renderers routed per imageRole inside the orchestrator:
  //   - gptImage = KIE gpt-image-2 (cheap no-ref flat-lays)
  //   - gpt4o    = KIE gpt-4o-image (character + product reference lock)
  // Scene synthesis (Gemini) generates ONE prompt per image at exec time.
  const kieApiKey = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const executors = useMemo<ExecutorRegistry>(() => {
    if (!kieApiKey) return {}
    return {
      gptImage: createKieGptImageExecutor({ apiKey: kieApiKey }),
      gpt4o:    createKieGpt4oImageExecutor({ apiKey: kieApiKey }),
    }
  }, [kieApiKey])

  // ── Scene synthesis context — niche + protagonist + product brief ──
  // POST-REBUILD: KIE key is the hard requirement (image gen). Gemini key
  // is SOFT — when missing, scene synthesis falls back to static prompts.
  // OPT.1 (2026-05-28): pass meta.imageScenes as preComputedScenes so
  // executePageGeneration can skip duplicate Gemini synthesis at exec time.
  const generationContext = useMemo<PageGenerationContext | null>(() => {
    if (!kieApiKey) return null
    return {
      niche: meta.niche,
      protagonist: {
        archetype: character.archetype,
        appearanceLock: character.appearanceLock,
        environmentLock: character.environmentLock,
      },
      productContext: meta.productIdentityForImage
        ? { productIdentityForImage: meta.productIdentityForImage }
        : null,
      targetLanguage: pack.language,
      geminiApiKey: geminiApiKey ?? '',   // soft — empty triggers fallback path
      kieApiKey,
      preComputedScenes: meta.imageScenes,
    }
  }, [
    geminiApiKey, kieApiKey, meta.niche, meta.productIdentityForImage,
    character.archetype, character.appearanceLock, character.environmentLock,
    pack.language, meta.imageScenes,
  ])

  const imageGen = useImageGeneration({
    page: meta.exportablePage ?? null,
    session,
    setSession,
    executors,
    context: generationContext,
    concurrency: 2,
    // OPT.4 (2026-05-28) — surface failure reason to user via toast
    onFailureToast: (sectionId, reason) => {
      addToast(`⚠ Tạo ảnh thất bại (${sectionId.slice(0, 20)}): ${reason.slice(0, 120)}`)
    },
    // UI-FIX5 (2026-05-28) — receive the full updated asset (with
    // outputImages[].url) so the UI can actually display the image.
    // Without this the URL was discarded silently every time.
    onAssetUpdated: (sectionId, asset) => {
      setAssetOverlay((prev) => ({ ...prev, [sectionId]: asset }))
    },
  })

  // ── Session callback handlers ────────────────────────────────────
  const handleRegenerateImage = (sectionId: string) => {
    if (!session) return
    if (!kieApiKey) {
      addToast('Chưa có KIE API key — nhập trong Settings để generate ảnh.')
      return
    }
    void imageGen.generateSection(sectionId)
  }
  const handleRegenerateSection = (sectionId: string) => {
    // For now 'regenerate section' = 'regenerate image' (text is locked
    // post-storytelling generation per architectural lock).
    handleRegenerateImage(sectionId)
  }
  const handleRegenerateProof = (sectionId: string) => {
    if (!session) return
    // Proof regen requires text-level rerun (storytelling layer) which is
    // out of scope for INT — queue the request so consumer/future P17
    // can wire it without breaking session state.
    const next = setRegenStatus(session, sectionId, 'queued', 'proof')
    setSession(next)
    void saveSession(next)
    addToast(`Đã đặt regen proof cho section "${sectionId}". Cần text-level rerun (P17+).`)
  }
  const handleApproveSection = (sectionId: string) => {
    if (!session) return
    const next = setReviewVerdict(session, sectionId, 'approved')
    setSession(next)
    void saveSession(next)
  }
  const handleRejectSection = (sectionId: string) => {
    if (!session) return
    const next = setReviewVerdict(session, sectionId, 'rejected')
    setSession(next)
    void saveSession(next)
  }
  const handleToggleReviewFlag = (sectionId: string, flag: ReviewFlag) => {
    if (!session) return
    const next = toggleReviewFlag(session, sectionId, flag)
    setSession(next)
    void saveSession(next)
  }
  const handleRetryFailed = (sectionId: string) => {
    handleRegenerateImage(sectionId)
  }
  const handleGenerateAll = () => {
    if (!kieApiKey) {
      addToast('Chưa có KIE API key — nhập trong Settings để generate ảnh.')
      return
    }
    void imageGen.generateAll()
  }
  /** UI-FIX8 (2026-05-28) — Retry only the sections whose regenStatus
   *  is 'failed'. Iterates over session.sections and triggers
   *  generateSection one-by-one (sequential so we don't spam the API).
   *  Without this the user had to click each failed section's "Thử lại"
   *  button individually — for a 7-section pack with 5 failures that
   *  is 5 clicks just to recover. */
  const handleRetryAllFailed = async () => {
    if (!kieApiKey) {
      addToast('Chưa có KIE API key — nhập trong Settings để generate ảnh.')
      return
    }
    if (!session) return
    const failedIds = Object.values(session.sections)
      .filter((s) => s.regenStatus === 'failed')
      .map((s) => s.sectionId)
    if (failedIds.length === 0) return
    addToast(`Đang thử lại ${failedIds.length} ảnh thất bại...`)
    for (const id of failedIds) {
      await imageGen.generateSection(id)
    }
  }

  // UI-FIX8 (2026-05-28) — Live image-gen counters.
  // - imageTotalCount  = number of composed sections that have an image plan
  // - imageDoneCount   = how many of those now have a real outputImage URL
  // - imageFailedCount = how many landed in regenStatus === 'failed'
  // Surfaces these in the header so the user always knows where they
  // stand without scrolling through every section.
  const imageCounters = useMemo(() => {
    if (!meta.exportablePage) return { total: 0, done: 0, failed: 0 }
    const sections = meta.exportablePage.sections.filter((s) => s.generatedAsset)
    const total = sections.length
    let done = 0
    let failed = 0
    for (const s of sections) {
      const overlay = assetOverlay[s.id]
      const url = overlay?.outputImages?.[0]?.url ?? s.generatedAsset?.outputImages?.[0]?.url
      const regen = session?.sections[s.id]?.regenStatus
      if (url) done++
      else if (regen === 'failed') failed++
    }
    return { total, done, failed }
  }, [meta.exportablePage, assetOverlay, session])

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
      {/* ── HEADER — title row + action row layout ────────────────────────────
           UI-FIX (2026-05-28): action buttons moved to SECOND ROW to avoid
           overlap with absolute-positioned Gemini + KIE Credit badges
           (top-right z-50 in App.tsx). Title + meta on row 1 with truncation,
           action buttons stacked on row 2 below. */}
      <div className="shrink-0 border-b border-stone-200 bg-stone-50/95 backdrop-blur px-4 md:px-6 py-2.5 pr-32 md:pr-72">
        {/* ROW 1 — title + meta + status badge */}
        <div className="flex items-center gap-2 min-w-0">
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

        {/* ROW 2 — action buttons (below row 1, no badge overlap) */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {hasSemantic && kieApiKey && (
            imageGen.isGenerating ? (
              <button
                onClick={imageGen.cancel}
                className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800 hover:bg-amber-100"
                title="Hủy generation đang chạy"
              >
                <X className="h-3 w-3" />
                Hủy ({imageGen.progress.done}/{imageGen.progress.total})
              </button>
            ) : (
              <button
                onClick={handleGenerateAll}
                className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800 hover:bg-emerald-100"
                title="Tạo ảnh cho tất cả section (KIE)"
              >
                <Sparkles className="h-3 w-3" />
                Tạo tất cả ảnh
              </button>
            )
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[11px] text-stone-700 hover:bg-stone-100"
              title="Tạo lại pack"
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

        {/* UX.2 (2026-05-27) — Image gen diagnostics. Tells marketer which
            keys are configured + degraded mode active. */}
        {hasSemantic && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
            {!kieApiKey ? (
              <span className="text-amber-600">
                ⚠ Chưa cấu hình KIE API key — vào Cài đặt để bật tạo ảnh
              </span>
            ) : !geminiApiKey ? (
              <span className="text-amber-600">
                ⚠ Thiếu Gemini key — ảnh sẽ dùng prompt tổng quát (không khớp text từng section).
                Bật Gemini key trong Cài đặt để có scene synthesis đầy đủ.
              </span>
            ) : (
              <span className="text-emerald-600">
                ✓ Tạo ảnh sẵn sàng — Gemini scene synthesis + KIE renderer
              </span>
            )}
            {imageGen.isGenerating && imageGen.progress.isSynthesizing && (
              <>
                <span className="text-stone-400">·</span>
                <span className="text-stone-500 italic">
                  Đang phân tích nội dung từng section để tạo prompt ảnh khớp...
                </span>
              </>
            )}
          </div>
        )}

        {/* UI-FIX8 (2026-05-28) — Image gen counter strip.
            Shows total composed sections (= total image slots), how
            many have a URL now, how many failed, and offers a one-
            click "Thử lại các ảnh thất bại" action. Hidden when there
            are no image plans at all. */}
        {hasSemantic && kieApiKey && imageCounters.total > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-stone-600">
              📷 Ảnh:{' '}
              <span className="font-semibold text-emerald-700">{imageCounters.done}</span>
              <span className="text-stone-400">/</span>
              <span className="text-stone-700">{imageCounters.total}</span>
              {' '}thành công
              {imageCounters.failed > 0 && (
                <>
                  <span className="text-stone-400"> · </span>
                  <span className="font-semibold text-rose-700">{imageCounters.failed}</span>
                  {' '}thất bại
                </>
              )}
              {imageGen.isGenerating && (
                <>
                  <span className="text-stone-400"> · </span>
                  <span className="italic text-stone-500">
                    đang chạy {imageGen.progress.done}/{imageGen.progress.total}
                  </span>
                </>
              )}
            </span>
            {imageCounters.failed > 0 && !imageGen.isGenerating && (
              <button
                onClick={handleRetryAllFailed}
                className="flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-800 hover:bg-rose-100"
                title={`Thử lại ${imageCounters.failed} ảnh thất bại`}
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Thử lại {imageCounters.failed} ảnh thất bại
              </button>
            )}
            <span className="text-stone-400 italic">
              {imageCounters.total < pack.sections.length && (
                <>· Pack có {pack.sections.length} chương; {imageCounters.total} ảnh
                  (các chương khác chia sẻ ảnh với chương đầu cùng nhóm)
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── READING COLUMN ──────────────────────────────────────────── */}
      {/* UI-FIX (2026-05-28): added overflow-x-hidden so long unbroken
          strings can't push content past viewport. w-full ensures column
          fills available width before max-w-prose centers article. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">
        {viewMode === 'semantic' && meta.exportablePage ? (
          // P7 — Semantic mobile preview renderer (consumes ExportablePage
          // via subtype assignability to VisualSemanticsPage prop, P14).
          // P16A — Session-driven regenerate + review callbacks wired in.
          // Real execution stays in caller's domain (P12 mock for now).
          <SemanticMobilePage
            page={meta.exportablePage}
            characterName={character?.name}
            session={session ?? undefined}
            onRegenerateImage={handleRegenerateImage}
            onRegenerateSection={handleRegenerateSection}
            onRegenerateProof={handleRegenerateProof}
            onApproveSection={handleApproveSection}
            onRejectSection={handleRejectSection}
            onToggleReviewFlag={handleToggleReviewFlag}
            onRetryFailedSection={handleRetryFailed}
          />
        ) : (
          // Legacy pack view (default). FIX 2026-05-27: storytelling-article
          // class enables Lora + Be Vietnam Pro fonts that render VN/MS
          // diacritics cleanly (was broken with browser default serif).
          // UI-FIX6 (2026-05-28) — Per user feedback (3rd time fixing
          // this): drop mx-auto so the article hugs the LEFT edge of
          // the panel, drop max-w from 4xl→3xl so the column never
          // creeps past the panel's right edge (especially with the
          // html { font-size: 20px } rem scaling), and add w-full so
          // the article fills available space up to the cap without
          // forcing a horizontal scroll.
          <article className="storytelling-article w-full max-w-3xl px-5 md:px-8 py-12 md:py-20">
            {(() => {
              // POST-PI lookup fix (2026-05-27):
              // pack.sections is 13-15 storytelling blocks + 5 PI blocks.
              // exportablePage.sections is ~7 COMPOSED sections (composer merges
              // multiple storytelling blocks into 1 composed section by role).
              // For each pack section, find its composed section by checking if
              // the storytelling blockId appears in any sourceBlockIds list.
              // Image attaches at the FIRST pack section that maps to each
              // composed section (avoids duplicate image renders for merged groups).
              const seenComposedIds = new Set<string>()
              return pack.sections.map((section, idx) => {
              const currentSectionId = meta.sectionIds[idx] as string | undefined
              const isPIBlock = typeof currentSectionId === 'string' && currentSectionId.startsWith('pi-')
              const composedSection = isPIBlock || !currentSectionId
                ? undefined
                : meta.exportablePage?.sections.find(
                    (s) => s.sourceBlockIds.some((bid) => bid === currentSectionId),
                  )
              // Only attach image to the FIRST pack section per composed section
              const isPrimaryForComposed = composedSection
                ? !seenComposedIds.has(composedSection.id)
                : false
              if (composedSection && isPrimaryForComposed) {
                seenComposedIds.add(composedSection.id)
              }
              const exportSection = isPrimaryForComposed ? composedSection : undefined
              // UI-FIX5 (2026-05-28): prefer the live overlay (populated
              // by onAssetUpdated after each gen) over the stale
              // meta.exportablePage asset — that's the only path that
              // carries the actual KIE outputImages[].url back to the UI.
              const generatedAsset = exportSection
                ? assetOverlay[exportSection.id] ?? exportSection.generatedAsset
                : undefined
              const sectionRegenState = session?.sections[exportSection?.id ?? '']
              const isThisSectionGenerating =
                imageGen.isGenerating &&
                imageGen.progress.currentSectionId === exportSection?.id
              // UI-FIX (2026-05-28): pre-computed scene prompt from pack-gen
              // time. Shown in "Xem prompt" expandable even BEFORE user clicks
              // "Tạo ảnh" (matches UGC pattern). Falls back to generated
              // prompt after actual gen completes.
              const preComputedScenePrompt = exportSection
                ? meta.imageScenes?.[exportSection.id]?.prompt
                : undefined
              const promptForUI = generatedAsset?.promptUsed?.prompt || preComputedScenePrompt
              // UI-FIX9 (2026-05-29) — canGenerate also requires the
              // section to have a generatedAsset (image plan from composer).
              // Previously a section with imageRole but no plan would
              // show an active "Tạo ảnh" button that silently no-op'd
              // because the orchestrator filter dropped it. Now button
              // hides when there's no plan, eliminating false-positive
              // click target.
              const canGen = Boolean(
                kieApiKey && exportSection && exportSection.generatedAsset,
              )
              // UI-FIX10 (2026-05-29) — If composer didn't plan an image
              // for this section (imageRole='none' → no generatedAsset),
              // hide the placeholder card entirely. User feedback: seeing
              // 4 "[Section này chưa có plan tạo ảnh]" cards on a 6-image
              // pack is confusing — those sections are TEXT-ONLY BY DESIGN
              // (reframe-moment + close-invitation per density profile),
              // not broken. Pass-through to hasNoOwnImage to suppress.
              const exportHasPlan = Boolean(exportSection?.generatedAsset)
              return (
                <StorytellingSectionView
                  key={idx}
                  section={section}
                  sectionId={meta.sectionIds[idx]}
                  overlayType={meta.overlayPerSection[idx]}
                  chapterNumber={idx + 1}
                  isLast={idx === pack.sections.length - 1}
                  characterName={character?.name}
                  status={meta.sectionStatus?.[idx]}
                  imageUrl={generatedAsset?.outputImages?.[0]?.url}
                  imagePrompt={promptForUI}
                  isImageGenerating={
                    isThisSectionGenerating ||
                    sectionRegenState?.regenStatus === 'generating' ||
                    sectionRegenState?.regenStatus === 'queued'
                  }
                  canGenerateImage={canGen}
                  onGenerateImage={
                    canGen && exportSection ? () => handleRegenerateImage(exportSection.id) : undefined
                  }
                  isPIBlock={isPIBlock}
                  hasNoOwnImage={!isPIBlock && (!exportSection || !exportHasPlan)}
                  imageFailureReason={
                    sectionRegenState?.regenStatus === 'failed'
                      ? sectionRegenState.lastFailureReason
                      : undefined
                  }
                />
              )
            })
            })()}

            {/* Footer breathing space */}
            <div className="mt-32 mb-8 text-center">
              <p className="font-serif italic text-xs text-stone-400">
                — hết —
              </p>
            </div>

            {/* UI-FIX7 (2026-05-28) — Simplified export footer.
                Replaced the old multi-format export (Markdown / Ladipage
                guide / Ladipage HTML / JSON / Ladipage bundle) with two
                plain-text copy buttons per user request:
                  - "COPY toàn bộ bản gốc"  → original-language copy
                  - "COPY toàn bộ bản dịch (VN)" → VN translation copy
                Hidden when pack is already VN (no separate dịch needed). */}
            <PackExportFooter pack={pack} />
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
// PackExportFooter — UI-FIX7 (2026-05-28)
//
// Replaced the previous 5-button Ladipage export panel (Markdown /
// Ladipage HTML / Ladipage guide / JSON / Ladipage bundle) with two
// plain-text clipboard buttons per user request:
//
//   - COPY toàn bộ bản gốc       — original-language stitch of every
//                                   section (title + body), joined with
//                                   blank lines between sections.
//   - COPY toàn bộ bản dịch (VN) — Vietnamese-translation stitch using
//                                   each section's viTranslation / titleVi
//                                   when available, falling back to the
//                                   original copy so the output is never
//                                   empty. Hidden when pack.language is
//                                   already 'vi' (no separate dịch needed).
// ═════════════════════════════════════════════════════════════════════

interface PackExportFooterProps {
  pack: StorytellingPack
}

function PackExportFooter({ pack }: PackExportFooterProps) {
  const [toast, setToast] = useState<string | null>(null)
  const flash = (label: string) => {
    setToast(label)
    setTimeout(() => setToast(null), 1500)
  }

  const isVnPack = pack.language === 'vi'
  const langLabel = pack.language === 'ms' ? 'MY'
                  : pack.language === 'en' ? 'EN'
                  : 'VN'

  /** Stitch every section as "title\n\nbody" joined by blank lines.
   *  Skips empty sections defensively. */
  const buildOriginalText = (): string => {
    return pack.sections
      .map((s) => {
        const title = (s.title || '').trim()
        const body = (s.copy || '').trim()
        if (!title && !body) return ''
        return title ? `${title}\n\n${body}` : body
      })
      .filter((block) => block.length > 0)
      .join('\n\n')
  }

  /** Same shape as original, but each field prefers its VN sibling.
   *  Falls back to the original field when the translation is missing
   *  so partial coverage still produces useful output. */
  const buildVnText = (): string => {
    return pack.sections
      .map((s) => {
        const title = (s.titleVi || s.title || '').trim()
        const body = (s.viTranslation || s.copy || '').trim()
        if (!title && !body) return ''
        return title ? `${title}\n\n${body}` : body
      })
      .filter((block) => block.length > 0)
      .join('\n\n')
  }

  const copyOriginal = async () => {
    const text = buildOriginalText()
    if (!text) return
    await navigator.clipboard.writeText(text).catch(() => {})
    flash('original')
  }

  const copyVn = async () => {
    const text = buildVnText()
    if (!text) return
    await navigator.clipboard.writeText(text).catch(() => {})
    flash('vn')
  }

  return (
    <div className="mt-16 w-full max-w-2xl rounded-lg border border-stone-200 bg-stone-50 p-5">
      <p className="text-[11px] uppercase tracking-wider text-stone-500 mb-3">
        Xuất pack
      </p>
      <div className="flex flex-wrap gap-2">
        <ExportCopyButton
          onClick={copyOriginal}
          label={`COPY toàn bộ bản gốc (${langLabel})`}
          success={toast === 'original'}
        />
        {!isVnPack && (
          <ExportCopyButton
            onClick={copyVn}
            label="COPY toàn bộ bản dịch (VN)"
            success={toast === 'vn'}
            tone="vn"
          />
        )}
      </div>
      <p className="mt-3 text-[10px] italic text-stone-400 leading-relaxed">
        Copy thẳng vào Ladipage / Notion / Word — text thuần,
        giữ thứ tự section + xuống dòng giữa các chương.
      </p>
    </div>
  )
}

function ExportCopyButton({ onClick, label, success, tone = 'default' }: {
  onClick: () => void
  label: string
  success?: boolean
  tone?: 'default' | 'vn'
}) {
  const baseClasses = success
    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : tone === 'vn'
      ? 'border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
      : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${baseClasses}`}
    >
      {success ? <Check className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
      {success ? 'Đã copy' : label}
    </button>
  )
}

// ═════════════════════════════════════════════════════════════════════
// SectionCopyButtons — per-section dual-language copy actions (FIX 2026-05-27)
//
// Native always present. VN only shown when section has viTranslation
// (i.e., source language was MY/EN and translatePackToVi ran).
// ═════════════════════════════════════════════════════════════════════

interface SectionCopyButtonsProps {
  nativeText: string
  vnText?: string
  /** Label for accessibility / tooltip. */
  nativeLabel: string
}

function SectionCopyButtons({ nativeText, vnText, nativeLabel }: SectionCopyButtonsProps) {
  const [copiedNative, setCopiedNative] = useState(false)
  const [copiedVn, setCopiedVn] = useState(false)
  const hasVn = Boolean(vnText && vnText.trim() !== nativeText.trim())

  const copyText = async (text: string, kind: 'native' | 'vn') => {
    try {
      await navigator.clipboard.writeText(text.replace(MOCK_MARKER_REGEX, ''))
      if (kind === 'native') {
        setCopiedNative(true)
        setTimeout(() => setCopiedNative(false), 1500)
      } else {
        setCopiedVn(true)
        setTimeout(() => setCopiedVn(false), 1500)
      }
    } catch { /* clipboard blocked — silent */ }
  }

  return (
    // UI-FIX8 (2026-05-28): trimmed mb-4 + slimmer padding so the
    // buttons fit cleanly inside the new section-text box header.
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => copyText(nativeText, 'native')}
        className={
          copiedNative
            ? 'flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-mono text-emerald-800'
            : 'flex items-center gap-1 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[10px] font-mono text-stone-700 hover:bg-stone-100'
        }
        title={`Copy native: ${nativeLabel.slice(0, 40)}`}
      >
        {copiedNative ? <Check className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
        {copiedNative ? 'Đã copy' : 'Copy gốc'}
      </button>
      {hasVn && (
        <button
          onClick={() => copyText(vnText!, 'vn')}
          className={
            copiedVn
              ? 'flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-mono text-emerald-800'
              : 'flex items-center gap-1 rounded border border-rose-300 bg-white px-1.5 py-0.5 text-[10px] font-mono text-rose-700 hover:bg-rose-50'
          }
          title="Copy bản dịch tiếng Việt"
        >
          {copiedVn ? <Check className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          {copiedVn ? 'Đã copy VN' : '🇻🇳 Copy VN'}
        </button>
      )}
    </div>
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
  // FIX 2026-05-27 — per-section image gen integration
  imageUrl?: string
  imagePrompt?: string
  isImageGenerating?: boolean
  canGenerateImage?: boolean
  onGenerateImage?: () => void
  /** PI-LAYER 2026-05-27 — true when this section is a product-info block
   *  (id starts with 'pi-'). Renders with subtle visual marker, no image. */
  isPIBlock?: boolean
  /** Storytelling section that's PART of a composed group but NOT the primary.
   *  Its image already appears at the primary section above — skip placeholder. */
  hasNoOwnImage?: boolean
  /** OPT.4 (2026-05-28) — Last image gen failure reason. When set, shows
   *  inline error box with retry button so user knows WHY gen failed. */
  imageFailureReason?: string
}

// ── PI-LAYER visual marker icon + label per type ─────────────────────
const PI_BLOCK_MARKERS: Record<string, { icon: string; label: string }> = {
  'pi-mechanism-personal':      { icon: '🔬', label: 'Cơ chế tôi mới hiểu' },
  'pi-ingredients-usp-woven':   { icon: '📋', label: 'Cái tôi check kỹ trước khi dùng' },
  'pi-usage-faq-personal':      { icon: '💬', label: 'Cách tôi dùng + câu hỏi thường gặp' },
  'pi-social-proof-collective': { icon: '👥', label: 'Người quen tôi cũng đang dùng' },
  'pi-pricing-narrator':        { icon: '🛒', label: 'Lúc tôi đặt' },
}

function StorytellingSectionView({
  section, sectionId, overlayType, chapterNumber, isLast, characterName, status,
  imageUrl, imagePrompt, isImageGenerating, canGenerateImage, onGenerateImage,
  isPIBlock, hasNoOwnImage, imageFailureReason,
}: SectionViewProps) {
  const blueprint = isPIBlock ? undefined : BLOCK_POOL[sectionId]
  const treatments = isPIBlock ? [] : (SECTION_VISUAL_MAP[sectionId] ?? [])
  const piMarker = isPIBlock ? PI_BLOCK_MARKERS[sectionId as string] : undefined

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
  // UI-FIX2 (2026-05-28) — Language mismatch detection.
  //
  // BUG: when translateFallbackToTarget fails for a section, section.copy
  // stays in VN (the hardcoded fallback language) even though pack.language
  // is 'ms'/'en'. Then translatePackToVi creates a viTranslation that is
  // ALSO VN (slightly reworded). hasVnTranslation = true → UI renders
  // duplicate VN content (primary + expandable both VN). Confusing.
  //
  // FIX: detect Vietnamese diacritics density in section.copy. If pack
  // target is MS/EN but copy IS Vietnamese-looking → suppress the VN
  // expandable (no point — primary already VN).
  const sectionCopyLooksVietnamese = (() => {
    // Vietnamese-specific diacritics: ă â đ ê ô ơ ư + tone marks
    const text = section.copy.toLowerCase()
    if (text.length < 30) return false
    const viChars = (text.match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/g) || []).length
    const ratio = viChars / text.length
    return ratio > 0.04   // ≥4% chars are VN-specific diacritics → likely VN
  })()
  // Render VN expandable only when:
  //  - viTranslation exists + differs from copy (existing rule)
  //  - copy is NOT already Vietnamese (new rule — language mismatch guard)
  const hasVnTranslation = Boolean(
    section.viTranslation &&
    section.viTranslation.trim() !== section.copy.trim() &&
    !sectionCopyLooksVietnamese,
  )
  const vnParagraphs = hasVnTranslation
    ? section.viTranslation!
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    : []
  // Image presence:
  //  - PI blocks: hidden (text-only by design)
  //  - Non-primary storytelling blocks (already represented by an earlier
  //    block's image in the same composed group): hidden too
  //  - Otherwise: show placeholder/image
  const hasImage = !isPIBlock && !hasNoOwnImage

  return (
    // UI-FIX4 (2026-05-28): trimmed section spacing mb-20/mb-28 → mb-10/mb-14
    // (cut ~50%) per user feedback "khoảng cách giữa các chương quá lớn,
    // tốn diện tích". Chapters still have visible separation but the page
    // no longer wastes half the vertical real estate on whitespace.
    <section className={isLast ? '' : 'mb-10 md:mb-14'}>
      {/* Chapter marker — tiny tracking-widest. PI-blocks get a different
          marker (small icon + label) to signal "narrator now sharing
          knowledge" — same diary tone, just different beat. */}
      {isPIBlock && piMarker ? (
        <p className="text-[11px] tracking-wide text-stone-500 mb-3 flex items-center gap-2 italic">
          <span className="text-base not-italic">{piMarker.icon}</span>
          <span>{piMarker.label}</span>
        </p>
      ) : (
        <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-3 flex items-center gap-2 flex-wrap">
          <span>Chương {chapterNumber}</span>
          <span className="text-stone-300 normal-case tracking-normal italic">
            · {blueprint?.phase ?? sectionId}
          </span>
          {status && status.kind !== 'pass' && (
            <SectionStatusInlineBadge status={status} />
          )}
        </p>
      )}

      {/* Title — serif italic, diary-like. FIX 2026-05-27: show NATIVE
          first, VN translation as small italic hint below (was previously
          showing VN as primary which confused MY/EN marketers). */}
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 leading-tight mb-2">
        {section.title}
      </h2>
      {hasVnTranslation && section.titleVi && section.titleVi !== section.title && (
        <p className="text-sm italic text-stone-500 mb-4">
          🇻🇳 {section.titleVi}
        </p>
      )}
      {!hasVnTranslation && <div className="mb-4" />}

      {/* UI-FIX8 (2026-05-28) — Per-section copy buttons MOVED INSIDE
          the body text box below (so they sit with the content they
          copy, not floating above the image). The old position above
          the image meant marketers had to scroll up to find the copy
          action — now the buttons are right where the text is. */}

      {/* Image placeholder — appears ABOVE body cho blocks has image.
          FIX 2026-05-27: passes generated image URL + prompt + KIE gen
          callbacks. Per-section "Tạo ảnh"/"Tạo lại" buttons live inside
          ImagePlaceholder now. */}
      {hasImage && (
        <>
          <ImagePlaceholder
            chapterNumber={chapterNumber}
            characterName={characterName}
            sectionTitle={section.title}
            overlayType={overlayType}
            treatments={treatments}
            continuityRequirement="optional"
            productVisibility="forbidden"
            imageUrl={imageUrl}
            promptText={imagePrompt}
            isGenerating={isImageGenerating}
            canGenerate={canGenerateImage}
            onGenerate={onGenerateImage}
          />
          {/* UI-FIX8 (2026-05-28) — Prompt viewer aligned left with the
              image figure (no more mx-auto so it sits under the image
              instead of drifting to the article centerline). Width
              matches the image figure (max-w-sm) for visual unity. */}
          {imagePrompt ? (
            <details className="mt-2 w-full max-w-sm rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-[10px]">
              <summary className="cursor-pointer text-stone-500 italic select-none">
                {imageUrl ? '👁 Xem prompt đã dùng để tạo ảnh' : '👁 Xem prompt sẽ dùng để tạo ảnh'}
              </summary>
              <div className="mt-2 font-mono text-stone-600 leading-relaxed whitespace-pre-wrap break-words">
                {imagePrompt}
              </div>
            </details>
          ) : (
            // UI-FIX9 (2026-05-29) — Surface missing-prompt state instead
            // of rendering nothing. Previously the section showed an active
            // "Tạo ảnh" button with NO visible explanation of why "Xem
            // prompt" didn't appear → user thought button was broken.
            canGenerateImage && (
              <div className="mt-2 w-full max-w-sm rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] italic text-amber-700">
                ⚠ Prompt chưa được sinh trước (pre-compute miss). Click "Tạo ảnh" — pipeline sẽ sinh prompt lúc đó.
              </div>
            )
          )}
          {/* OPT.4 (2026-05-28) — Inline error box when last gen failed.
              Surfaces the failure reason + retry button so user knows WHY
              and can take action (instead of clicking "Tạo ảnh" blindly). */}
          {imageFailureReason && !imageUrl && !isImageGenerating && (
            // UI-FIX6: left-align failure box with the rest of the column
            <div className="mt-2 max-w-sm rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px]">
              <div className="flex items-start gap-2 text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">Lỗi tạo ảnh lần trước</div>
                  <div className="mt-0.5 text-[10px] text-amber-700 break-words">
                    {imageFailureReason}
                  </div>
                  {canGenerateImage && onGenerateImage && (
                    <button
                      onClick={onGenerateImage}
                      className="mt-1.5 inline-flex items-center gap-1 rounded border border-amber-400 bg-white px-2 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
                    >
                      <RotateCcw className="h-2.5 w-2.5" /> Thử lại
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* UI-FIX8 (2026-05-28) — Wrap body copy in a box matching the
          VN translation box width (max-w-xl) so the original-language
          column doesn't sprawl wider than its VN counterpart below.
          The two boxes now share the same left edge AND the same right
          edge — clean vertical alignment for the whole pack column.
          Copy buttons sit at the TOP of this box for one-click access. */}
      <div className="mt-2 w-full max-w-xl rounded-lg border border-stone-200 bg-white px-5 py-4">
        {/* Header strip — section label + copy buttons */}
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
          <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
            Bản gốc
          </span>
          <SectionCopyButtons
            nativeText={section.copy}
            vnText={section.viTranslation}
            nativeLabel={section.title}
          />
        </div>
        {/* Body copy — each paragraph as its own <p> for proper breathing space.
            UI-FIX (2026-05-28): break-words to prevent long unbreakable strings
            from pushing column past viewport. */}
        <div className="font-serif text-base md:text-[17px] text-stone-700 leading-[1.95] break-words">
          {cleanParagraphs.map((p, i) => (
            <p key={i} className={i === cleanParagraphs.length - 1 ? '' : 'mb-5'}>{p}</p>
          ))}
        </div>
      </div>

      {/* VN translation box — collapsible. Only shows when target was MY/EN.
          UI-FIX3 (2026-05-28): switched from stone (gray) to rose (VN flag
          tone) so box is clearly distinguishable from article body in BOTH
          light mode (warm-red tint vs white) AND dark mode (rose glow vs
          dark surface). All rose-50 / border-rose-200 / text-rose-* tokens
          already have dark-mode overrides in src/index.css — no new CSS. */}
      {hasVnTranslation && (
        // UI-FIX6 (2026-05-28): drop mx-auto and clamp tighter to
        // max-w-xl so the VN aside hugs the LEFT edge in line with
        // the body column above it. User explicitly asked for "tất
        // cả nằm dọc thẳng hàng, sát lề trái, lề phải không mở rộng".
        <details className="mt-6 w-full max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-5 py-3 group">
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider font-semibold text-rose-700 select-none flex items-center gap-2">
            <span>🇻🇳 Bản dịch tiếng Việt</span>
            <span className="text-rose-500 italic normal-case tracking-normal font-normal group-open:hidden">
              (click để mở)
            </span>
          </summary>
          <div className="mt-3 font-serif text-[15px] text-stone-700 leading-[1.85]">
            {vnParagraphs.map((p, i) => (
              <p key={i} className={i === vnParagraphs.length - 1 ? '' : 'mb-4'}>{p}</p>
            ))}
          </div>
        </details>
      )}

      {/* UI-FIX2 (2026-05-28): removed debug strip (phase/function/balance/
          paragraphs target/visual) per user request — not user-facing info. */}
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
  // FIX 2026-05-27 — per-section image gen UI (matches UGC app pattern)
  imageUrl?: string
  promptText?: string
  isGenerating?: boolean
  canGenerate?: boolean
  onGenerate?: () => void
}

function ImagePlaceholder({
  chapterNumber, characterName, sectionTitle, overlayType, treatments,
  continuityRequirement, productVisibility,
  imageUrl, isGenerating, canGenerate, onGenerate,
}: PlaceholderProps) {
  const overlayText = renderOverlayText(overlayType, chapterNumber, characterName, sectionTitle)
  const aspectClass = productVisibility === 'still-life' ? 'aspect-square' : 'aspect-[4/5]'
  const hasImage = Boolean(imageUrl)

  return (
    <figure className="relative mb-8">
      {/* UI-FIX6 (2026-05-28): drop mx-auto so the image/placeholder
          left-aligns with the body column instead of centering inside
          the article. Keeps the whole pack visually flush against the
          left edge of the panel as user requested. */}
      <div
        className={`relative ${aspectClass} w-full max-w-sm rounded-sm border border-dashed border-stone-300 bg-stone-100/40 flex flex-col items-center justify-center text-center overflow-hidden`}
      >
        {hasImage ? (
          // ── REAL IMAGE ─────────────────────────────────────────────
          <>
            <img
              src={imageUrl}
              alt={sectionTitle}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            {/* Regenerate button — top-right, visible on hover */}
            {canGenerate && (
              <button
                onClick={onGenerate}
                disabled={isGenerating}
                className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-white/90 backdrop-blur-sm border border-stone-300 px-2 py-1 text-[10px] font-mono text-stone-700 hover:bg-white shadow-sm disabled:opacity-50"
                title="Tạo lại ảnh"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                {isGenerating ? 'Đang tạo...' : 'Tạo lại'}
              </button>
            )}
            {/* Overlay caption — bottom-left documentary photo-essay style.
                2026-05-30: enlarged 11px → 13.5px + bumped padding so the
                title is readable while scanning the page; bg opacity raised
                from 0.85 to 0.92 for stronger contrast against varied photo
                backgrounds; max-w 70%→80% so most titles fit one line. */}
            {overlayText && (
              <span className="absolute bottom-3 left-3 max-w-[80%] rounded-sm bg-stone-50/92 backdrop-blur-sm px-2.5 py-1 font-serif italic text-[13.5px] leading-snug text-stone-800 shadow-sm line-clamp-2">
                {overlayText}
              </span>
            )}
          </>
        ) : (
          // ── PLACEHOLDER (no image yet) ─────────────────────────────
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
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
            {/* Generate button — center, prominent */}
            {canGenerate && onGenerate && (
              <button
                onClick={onGenerate}
                disabled={isGenerating}
                className="mt-3 flex items-center gap-1 rounded-md bg-stone-800 px-3 py-1.5 text-[11px] font-mono text-white hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-3 w-3" />
                    Tạo ảnh
                  </>
                )}
              </button>
            )}
            {!canGenerate && (
              <p className="mt-3 text-[10px] text-stone-300">
                [Section này chưa có plan tạo ảnh — kiểm tra KIE key trong Cài đặt]
              </p>
            )}
            {overlayText && (
              <span className="absolute bottom-3 left-3 max-w-[80%] rounded-sm bg-stone-50/92 backdrop-blur-sm px-2.5 py-1 font-serif italic text-[13.5px] leading-snug text-stone-800 shadow-sm line-clamp-2">
                {overlayText}
              </span>
            )}
          </div>
        )}
      </div>

      {/* UI-FIX8 (2026-05-28) — Removed the duplicate "Prompt ↓"
          expandable that used to live here. The descriptive version
          ("Xem prompt đã/sẽ dùng để tạo ảnh") rendered by the section
          view immediately below the figure is now the single source. */}
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
      // 2026-05-30 — Use the section title verbatim. The previous
      // "characterName, title.toLowerCase()." compose pattern produced
      // awkward results like "Nhân vật chính, sakit lutut menghalang." —
      // wrong-case for MS/EN packs and added redundant author info that
      // belongs in the chapter byline, not the image caption. Title
      // alone reads as a documentary photo-essay label.
      return sectionTitle
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
      title="All 6 validators passed on first attempt"
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
