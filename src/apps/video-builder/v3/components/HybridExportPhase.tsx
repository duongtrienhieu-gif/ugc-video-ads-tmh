// ── HybridExportPhase (P3f) — Bước "Export MP4" ──────────────────────────────
// Where the final is MADE + downloaded (mode-1 ergonomics): press "Tạo video" to
// assemble the rendered scenes → play + download. Also generates AI thumbnails
// (ported back from the mode-1 Export step) from the creator + product.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Loader2, Download, RotateCcw, ArrowLeft, AlertCircle, Film, Clapperboard, Sparkles } from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { assembleFromHybridState } from '../services/hybridAssembleFlow'
import { FINAL_RES } from '../services/hybridConstants'
import { generateThumbnailHooks, generateAiThumbnail, THUMBNAIL_ARCHETYPES, THUMBNAIL_ARCHETYPE_ORDER } from '../services/thumbnailEngine'
import { SCRIPT_LANG_GEMINI_NAME, type AiThumbnail } from '../types'

const now = () => Date.now()

export default function HybridExportPhase() {
  const state          = useAdsVideoStore((s) => s.state)
  const setHybridFinal = useAdsVideoStore((s) => s.setHybridFinal)
  const setPhase       = useAdsVideoStore((s) => s.setPhase)
  const setAiThumbnails = useAdsVideoStore((s) => s.setAiThumbnails)
  const patchAiThumbnail = useAdsVideoStore((s) => s.patchAiThumbnail)
  const pickThumbnail   = useAdsVideoStore((s) => s.pickThumbnail)
  const setIsGenThumbs  = useAdsVideoStore((s) => s.setIsGeneratingThumbnails)
  const addToast        = useAppStore((s) => s.addToast)
  const geminiKey       = useSettingsStore((s) => s.geminiApiKey)
  const kieApiKey       = useSettingsStore((s) => s.kieApiKey)

  const hybrid = state.hybrid
  const ev = state.exportVariation
  const script = state.scriptBrain.script
  const scenes = hybrid.scenes ?? []
  const doneCount = scenes.filter((_, i) => hybrid.clips[i]).length
  const allDone = scenes.length > 0 && doneCount === scenes.length
  // Final assembled video is ALWAYS 720p — hard constant, not user-selectable.
  const resolution = FINAL_RES

  const [assembling, setAssembling] = useState(false)
  const [error, setError] = useState('')
  const finalUrl = useAssetUrl(hybrid.finalVideoRef ?? undefined)
  const pickedThumbUrl = useAssetUrl(ev.pickedThumbnailRef ?? undefined)

  const makeVideo = async () => {
    const h = useAdsVideoStore.getState().state.hybrid
    if (!script) return
    setAssembling(true); setError('')
    try {
      const videoRef = await assembleFromHybridState(h, script, resolution)
      setHybridFinal(videoRef)
      addToast('✓ Đã tạo video', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); setError(msg); addToast(`Tạo video lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setAssembling(false) }
  }

  const genThumbnails = async () => {
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    if (!script) { addToast('Chưa có kịch bản', 'error'); return }
    setIsGenThumbs(true); setError('')
    try {
      const lang = state.scriptBrain.outputLang
      const langName = SCRIPT_LANG_GEMINI_NAME[lang]
      const hooks = await generateThumbnailHooks({ geminiKey, script, product: state.inputs.product, lang })
      const seeds: AiThumbnail[] = THUMBNAIL_ARCHETYPE_ORDER.map((id, i) => ({
        archetypeId: id, hook: hooks[i] ?? '', imageRef: null, status: 'rendering', generatedAt: now(),
      }))
      setAiThumbnails(seeds)
      await Promise.all(THUMBNAIL_ARCHETYPE_ORDER.map(async (id, i) => {
        try {
          const imageRef = await generateAiThumbnail({ kieApiKey, archetypeId: id, hook: hooks[i] ?? '', langName, avatar: state.inputs.avatar, product: state.inputs.product })
          patchAiThumbnail(i, { imageRef, status: 'completed' })
        } catch (err) {
          patchAiThumbnail(i, { status: 'failed', error: (err instanceof Error ? err.message : String(err)).slice(0, 160) })
        }
      }))
      addToast('✓ Đã tạo thumbnail — chọn 1 cái', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); setError(msg); addToast(`Tạo thumbnail lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setIsGenThumbs(false) }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Export MP4</h2>
            <p className="text-[12px] text-gray-500">Bấm <strong>Tạo video</strong> để ghép các cảnh đã render thành MP4 cuối, xem + tải. Ghép = 0 credit.</p>
          </div>
          <button onClick={() => setPhase('action-inserts')}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50">
            <ArrowLeft className="h-3.5 w-3.5" /> Sửa cảnh
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {/* ── Final video ───────────────────────────────────────────────────── */}
        {hybrid.finalVideoRef && finalUrl ? (
          <div className="rounded-xl border border-emerald-300 bg-white p-3">
            <video src={finalUrl} controls className="mx-auto max-h-[60vh] rounded-lg bg-black" />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <a href={finalUrl} download={`ugc-hybrid-${now()}.mp4`}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-violet-700">
                <Download className="h-3.5 w-3.5" /> Tải MP4 ({resolution})
              </a>
              <button onClick={makeVideo} disabled={assembling || !allDone}
                title={allDone ? 'Ghép lại từ clip hiện tại (0 credit)' : 'Còn cảnh chưa render'}
                className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {assembling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Ghép lại (0cr)
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <Film className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-semibold text-gray-500">Chưa có video</p>
            <p className="mt-1 mb-3 text-[12px] text-gray-400">
              {allDone ? `Đã render ${doneCount}/${scenes.length} cảnh — bấm Tạo video để ghép.` : `Quay lại "Tạo Video", render hết ${scenes.length || ''} cảnh trước.`}
            </p>
            <button onClick={makeVideo} disabled={assembling || !allDone}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50">
              {assembling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />} Tạo video (0cr)
            </button>
          </div>
        )}

        {/* ── AI thumbnails ─────────────────────────────────────────────────── */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">🖼 Ảnh thumbnail (cover)</p>
              <p className="text-[11px] text-gray-500">4 kiểu hook — chọn 1 cái để tải làm ảnh bìa.</p>
            </div>
            <div className="flex items-center gap-2">
              {pickedThumbUrl && (
                <a href={pickedThumbUrl} download={`thumb-${now()}.jpg`}
                  className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700">
                  <Download className="h-3 w-3" /> Tải thumbnail
                </a>
              )}
              <button onClick={genThumbnails} disabled={ev.isGeneratingThumbnails}
                className="flex items-center gap-1.5 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-50">
                {ev.isGeneratingThumbnails ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {ev.aiThumbnails.length ? 'Tạo lại 4' : 'Tạo 4 thumbnail'} (~24cr)
              </button>
            </div>
          </div>
          {ev.aiThumbnails.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-gray-400">Chưa có thumbnail — bấm "Tạo 4 thumbnail".</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ev.aiThumbnails.map((t, i) => (
                <AiThumbCard key={i} thumb={t}
                  picked={!!t.imageRef && ev.pickedThumbnailRef === t.imageRef}
                  onPick={() => t.imageRef && pickThumbnail(t.imageRef)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AI thumbnail card (one archetype) — ported from mode-1 ExportPhase ────────
function AiThumbCard({ thumb, picked, onPick }: { thumb: AiThumbnail; picked: boolean; onPick: () => void }) {
  const cfg = THUMBNAIL_ARCHETYPES[thumb.archetypeId]
  const url = useAssetUrl(thumb.imageRef ?? undefined)
  return (
    <div className={`overflow-hidden rounded-lg border transition-all ${picked ? 'border-violet-500 ring-2 ring-violet-300' : 'border-gray-200'}`}>
      <button onClick={onPick} disabled={thumb.status !== 'completed'} className="block aspect-[9/16] w-full bg-gray-100">
        {thumb.status === 'rendering' && <span className="flex h-full items-center justify-center text-[10px] text-gray-400"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Đang tạo...</span>}
        {thumb.status === 'failed' && <span className="flex h-full items-center justify-center px-1 text-center text-[9px] text-rose-500">Lỗi: {thumb.error?.slice(0, 40)}</span>}
        {thumb.status === 'completed' && url && <img src={url} alt={cfg.labelVi} className="h-full w-full object-cover" />}
      </button>
      <div className="p-1.5">
        <p className="text-[10px] font-bold text-gray-800">{cfg.emoji} {cfg.labelVi}{picked && ' ✓'}</p>
        {thumb.hook && <p className="mt-0.5 truncate text-[9px] font-semibold text-violet-700">"{thumb.hook}"</p>}
      </div>
    </div>
  )
}
