// ── HybridExportPhase (P3f) — Bước "Export MP4" ──────────────────────────────
// Where the final is MADE + downloaded (mode-1 ergonomics): press "Tạo video" to
// assemble the rendered scenes → play + download. Also generates AI thumbnails
// (ported back from the mode-1 Export step) from the creator + product.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { Loader2, Download, RotateCcw, ArrowLeft, AlertCircle, Film, Clapperboard, Sparkles } from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { assembleFromHybridState } from '../services/hybridAssembleFlow'
import { addExportedVideo } from '../services/exportedVideoLibrary'
import { FINAL_RES } from '../services/hybridConstants'
import { generateThumbnailHooks, generateAiThumbnail, THUMBNAIL_ARCHETYPES, THUMBNAIL_ARCHETYPE_ORDER } from '../services/thumbnailEngine'
import { CAPTION_PRESETS, CAPTION_PRESET_ORDER, DEFAULT_CAPTION_PRESET, type CaptionPresetId } from '../services/captionPresets'
import { renderCaptionBlob } from '../services/captionRenderer'
import { BANNER_PRESETS, BANNER_PRESET_ORDER, DEFAULT_BANNER_PRESET, type BannerPresetId } from '../services/bannerPresets'
import { renderBannerBlob, deriveBannerSlogan, localizeProductName, generateBannerHook, glossBannerToVietnamese } from '../services/bannerRenderer'
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

  const setHybridCaption = useAdsVideoStore((s) => s.setHybridCaption)
  const setHybridAssemble = useAdsVideoStore((s) => s.setHybridAssemble)
  const hybrid = state.hybrid
  const ev = state.exportVariation
  const script = state.scriptBrain.script
  const captionsOn = hybrid.captionsOn !== false           // default ON
  const captionPreset = hybrid.captionPreset ?? DEFAULT_CAPTION_PRESET
  const bannerOn = hybrid.bannerOn !== false               // default ON
  const bannerPreset = hybrid.bannerPreset ?? DEFAULT_BANNER_PRESET
  // P5z2 — banner = an EDITABLE hook. AI drafts one curiosity line in the OUTPUT language
  // (prefill); the user can edit it, ask for another suggestion, see a live preview + a VN
  // gloss (when not Vietnamese), then render. The user's text (persisted) wins.
  const outputLang = state.scriptBrain.outputLang
  const langName = SCRIPT_LANG_GEMINI_NAME[outputLang]
  const rawProductName = state.inputs.product?.productName ?? ''
  const scriptHookText = script?.blocks?.[0]?.text ?? ''
  // P6n — banner hook reads the WHOLE script (key/anchor + every block), not just the opener,
  // so it can pick the strongest sensational angle instead of riffing vaguely on line 1.
  const scriptContext = script
    ? [script.anchor ? `KEY: ${script.anchor}` : '', ...script.blocks.map((b) => b.text)].filter(Boolean).join('\n')
    : scriptHookText
  const [bannerHook, setBannerHook] = useState('')
  const [bannerName, setBannerName] = useState(rawProductName)
  const [suggesting, setSuggesting] = useState(false)
  const [hookHistory, setHookHistory] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    if (scriptContext) generateBannerHook(scriptContext, langName, geminiKey).then((h) => { if (alive) setBannerHook(h) }).catch(() => {})
    if (rawProductName) localizeProductName(rawProductName, langName, geminiKey).then((n) => { if (alive) setBannerName(n) }).catch(() => {})
    else setBannerName('')
    return () => { alive = false }
  }, [scriptContext, rawProductName, langName, geminiKey])
  // effective text the video uses: user edit > AI hook > product-name fallback.
  const aiDefaultBanner = bannerHook || deriveBannerSlogan(bannerName || rawProductName, script?.anchor, scriptHookText)
  const bannerText = (hybrid.bannerText ?? '').trim().length > 0 ? hybrid.bannerText! : aiDefaultBanner
  const bannerPreviewText = bannerText || 'Hook gây tò mò'
  const suggestBanner = async () => {
    if (!scriptContext || !geminiKey) return
    setSuggesting(true)
    try {
      // pass everything shown so far so the AI diverges (fixes the "4 lần ra 3 lần y chang" laziness)
      const avoid = [...new Set([bannerText, ...hookHistory].filter(Boolean))].slice(-6)
      const h = await generateBannerHook(scriptContext, langName, geminiKey, true, avoid)
      if (h) { setHybridCaption({ bannerText: h }); setHookHistory((prev) => [...prev, h].slice(-6)) }
    } finally { setSuggesting(false) }
  }
  // VN gloss of a non-VN banner (debounced; cached) so the user understands it.
  const [bannerGloss, setBannerGloss] = useState('')
  useEffect(() => {
    if (outputLang === 'vi' || !bannerText) { setBannerGloss(''); return }
    let alive = true
    const t = setTimeout(() => { glossBannerToVietnamese(bannerText, geminiKey).then((g) => { if (alive) setBannerGloss(g) }).catch(() => {}) }, 600)
    return () => { alive = false; clearTimeout(t) }
  }, [bannerText, outputLang, geminiKey])
  const scenes = hybrid.scenes ?? []
  const doneCount = scenes.filter((_, i) => hybrid.clips[i]).length
  const allDone = scenes.length > 0 && doneCount === scenes.length
  // Final assembled video is ALWAYS 720p — hard constant, not user-selectable.
  const resolution = FINAL_RES

  // P5s — assemble progress lives in the STORE (not local state) so switching the
  // stepper tab mid-ghép (which unmounts this component) doesn't lose it — the running
  // assemble promise keeps writing to the store and the bar reconnects on return.
  const assembling    = hybrid.assembling ?? false
  const assembleRatio = hybrid.assembleRatio ?? 0
  const assembleStage = hybrid.assembleStage ?? ''
  const [error, setError] = useState('')
  const finalUrl = useAssetUrl(hybrid.finalVideoRef ?? undefined)
  const pickedThumbUrl = useAssetUrl(ev.pickedThumbnailRef ?? undefined)

  const makeVideo = async () => {
    const h = useAdsVideoStore.getState().state.hybrid
    if (!script) return
    if (h.assembling) return   // P5s — already ghép (survives a tab switch) → don't double-start
    setError(''); setHybridAssemble({ assembling: true, assembleRatio: 0, assembleStage: 'Đang nạp ffmpeg…' })
    try {
      const videoRef = await assembleFromHybridState(h, script, resolution, {
        onProgress: (r) => setHybridAssemble({ assembleRatio: r }),
        onStage: (label) => setHybridAssemble({ assembleStage: label }),
        bannerSlogan: bannerText,
        // P5 reply-to-comment — burn the TikTok comment card over the opening when reply mode is on.
        replyComment: state.replyComment?.enabled ? (state.replyComment.comment ?? '').trim() : undefined,
      })
      setHybridFinal(videoRef)
      // P6y — auto-save the FINAL into the standalone library (survives "Tạo lại từ đầu") so a
      // forgotten download is always recoverable. Only the assembled MP4 — never broll/lips clips.
      addExportedVideo({
        assetRef: videoRef,
        productName: state.inputs.product?.productName ?? 'Sản phẩm',
        lang: state.scriptBrain.outputLang,
        resolution,
      })
      addToast('✓ Đã tạo video (đã lưu vào Thư viện video đã xuất)', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e); setError(msg); addToast(`Tạo video lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setHybridAssemble({ assembling: false }) }
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

  // P6c — tạo lại MỘT thumbnail (re-render ảnh với hook hiện tại — GPT-4o cho ra
  // biến thể mới). Cũng dùng để retry cái bị "Failed to fetch". ~6cr/ảnh.
  const regenThumb = async (i: number) => {
    const t = ev.aiThumbnails[i]
    if (!t) return
    if (!kieApiKey) { addToast('Thiếu KIE key', 'error'); return }
    const langName = SCRIPT_LANG_GEMINI_NAME[state.scriptBrain.outputLang]
    patchAiThumbnail(i, { status: 'rendering', error: undefined })
    try {
      const imageRef = await generateAiThumbnail({ kieApiKey, archetypeId: t.archetypeId, hook: t.hook, langName, avatar: state.inputs.avatar, product: state.inputs.product })
      patchAiThumbnail(i, { imageRef, status: 'completed' })
    } catch (err) {
      patchAiThumbnail(i, { status: 'failed', error: (err instanceof Error ? err.message : String(err)).slice(0, 160) })
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-5">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-app-subtle">Bấm <strong className="text-app-muted">Tạo video</strong> để ghép các cảnh đã render thành MP4 cuối, xem + tải. Ghép = 0 credit.</p>
          <button onClick={() => setPhase('action-inserts')}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-app-border bg-app-card px-3 py-2 text-[12px] font-bold text-app-muted hover:bg-app-card-elevated">
            <ArrowLeft className="h-3.5 w-3.5" /> Sửa cảnh
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {/* ── Caption (phụ đề cháy chữ) — applied at assemble, 0 credit ──────── */}
        <div className="mb-4 rounded-xl border border-black/10 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">💬 Phụ đề (caption)</p>
              <p className="text-[11px] text-gray-500">Cháy chữ vào video — đúng lời nói, 0 credit. Đổi xong bấm <strong>Ghép lại / Tạo video</strong>.</p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-gray-700">
              <input type="checkbox" checked={captionsOn} onChange={(e) => setHybridCaption({ captionsOn: e.target.checked })} />
              Bật phụ đề
            </label>
          </div>
          {captionsOn && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {CAPTION_PRESET_ORDER.map((id) => (
                <button key={id} onClick={() => setHybridCaption({ captionPreset: id })}
                  className={`flex flex-col items-stretch gap-1 rounded-lg border p-1.5 text-[11px] font-bold transition-all ${
                    captionPreset === id
                      ? 'ui-accent-soft'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}>
                  <CaptionPresetPreview presetId={id} />
                  <span className="text-center leading-tight">{CAPTION_PRESETS[id].labelVi}
                    <span className="block text-[9px] font-normal text-gray-400">{CAPTION_PRESETS[id].fontLabel}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {/* P6o — karaoke giờ MẶC ĐỊNH BẬT cho mọi video (ẩn toggle). Cờ ở assemble đọc
              `captionKaraoke !== false` nên absent = ON. */}
        </div>

        {/* ── Banner hook (dải trên cùng) — applied at assemble, 0 credit ──────── */}
        <div className="mb-4 rounded-xl border border-black/10 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">🏷️ Banner hook (dải trên)</p>
              <p className="text-[11px] text-gray-500">Câu hook gây tò mò trên đầu video — sửa tự do, xem trước rồi mới ghép. 0 credit.</p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-gray-700">
              <input type="checkbox" checked={bannerOn} onChange={(e) => setHybridCaption({ bannerOn: e.target.checked })} />
              Bật banner
            </label>
          </div>
          {bannerOn && (
            <div className="mt-2">
              {/* Editable hook text + suggest button (AI gợi ý ở ĐÚNG ngôn ngữ đích) */}
              <div className="flex items-center gap-2">
                <input type="text" value={hybrid.bannerText ?? bannerText}
                  onChange={(e) => setHybridCaption({ bannerText: e.target.value })}
                  placeholder="Nhập câu hook cho banner…"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-900 focus:border-violet-400 focus:outline-none" />
                <button onClick={suggestBanner} disabled={suggesting || !scriptHookText}
                  className="ui-accent-soft flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-50">
                  {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Gợi ý
                </button>
              </div>
              {/* VN gloss when the output language isn't Vietnamese */}
              {outputLang !== 'vi' && bannerGloss && (
                <p className="mt-1 text-[11px] text-gray-500">🇻🇳 Nghĩa: <span className="font-semibold text-gray-700">{bannerGloss}</span></p>
              )}
              {/* Live banner RESULT preview (selected preset) — judge it BEFORE rendering video */}
              <div className="mt-2 flex items-center justify-center rounded-lg bg-gray-800 p-3">
                <BannerLivePreview presetId={bannerPreset} text={bannerPreviewText} />
              </div>
              {/* Pick a style */}
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {BANNER_PRESET_ORDER.map((id) => (
                <button key={id} onClick={() => setHybridCaption({ bannerPreset: id })}
                  className={`flex flex-col items-stretch gap-1 rounded-lg border p-1.5 text-[11px] font-bold transition-all ${
                    bannerPreset === id
                      ? 'ui-accent-soft'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                  }`}>
                  <BannerPresetPreview presetId={id} slogan={bannerPreviewText} />
                  <span className="text-center">{BANNER_PRESETS[id].labelVi}</span>
                </button>
              ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Final video ───────────────────────────────────────────────────── */}
        {hybrid.finalVideoRef && finalUrl ? (
          <div className="rounded-xl border border-emerald-300 bg-white p-3">
            <video src={finalUrl} controls className="mx-auto max-h-[60vh] rounded-lg bg-black" />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <a href={finalUrl} download={`ugc-hybrid-${now()}.mp4`}
                className="ui-accent-solid flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold">
                <Download className="h-3.5 w-3.5" /> Tải MP4 ({resolution})
              </a>
              <button onClick={makeVideo} disabled={assembling || !allDone}
                title={allDone ? 'Ghép lại từ clip hiện tại (0 credit)' : 'Còn cảnh chưa render'}
                className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {assembling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Ghép lại (0cr)
              </button>
            </div>
            {/* P5x — show the SAME % bar while re-assembling an existing final (was only
                in the "no final yet" state → "Ghép lại" looked frozen with no progress). */}
            {assembling && (
              <div className="mx-auto mt-3 max-w-md">
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-500">
                  <span className="truncate">{assembleStage || 'Đang ghép…'}</span>
                  <span className="tabular-nums">{Math.round(assembleRatio * 100)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                    style={{ width: `${Math.max(2, Math.round(assembleRatio * 100))}%` }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <Film className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-semibold text-gray-500">Chưa có video</p>
            <p className="mt-1 mb-3 text-[12px] text-gray-400">
              {allDone ? `Đã render ${doneCount}/${scenes.length} cảnh — bấm Tạo video để ghép.` : `Quay lại "Tạo Video", render hết ${scenes.length || ''} cảnh trước.`}
            </p>
            <button onClick={makeVideo} disabled={assembling || !allDone}
              className="ui-accent-solid inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-bold shadow-sm disabled:opacity-50">
              {assembling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />} Tạo video (0cr)
            </button>

            {/* P4b — real ffmpeg assemble progress (% + stage). Not fake: the bar
                follows the per-clip normalize ratio the assembler emits. */}
            {assembling && (
              <div className="mx-auto mt-4 max-w-md">
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-500">
                  <span className="truncate">{assembleStage || 'Đang ghép…'}</span>
                  <span className="tabular-nums">{Math.round(assembleRatio * 100)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                    style={{ width: `${Math.max(2, Math.round(assembleRatio * 100))}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI thumbnails ─────────────────────────────────────────────────── */}
        <div className="mt-6 rounded-xl border border-black/10 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">🖼 Ảnh thumbnail (cover)</p>
              <p className="text-[11px] text-gray-500">{THUMBNAIL_ARCHETYPE_ORDER.length} kiểu hook — chọn 1 cái để tải làm ảnh bìa.</p>
            </div>
            <div className="flex items-center gap-2">
              {pickedThumbUrl && (
                <a href={pickedThumbUrl} download={`thumb-${now()}.jpg`}
                  className="ui-accent-solid flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold">
                  <Download className="h-3 w-3" /> Tải thumbnail
                </a>
              )}
              <button onClick={genThumbnails} disabled={ev.isGeneratingThumbnails}
                className="ui-accent-soft flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold disabled:opacity-50">
                {ev.isGeneratingThumbnails ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {ev.aiThumbnails.length ? `Tạo lại ${THUMBNAIL_ARCHETYPE_ORDER.length}` : `Tạo ${THUMBNAIL_ARCHETYPE_ORDER.length} thumbnail`} (~{THUMBNAIL_ARCHETYPE_ORDER.length * 6}cr)
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
                  onPick={() => t.imageRef && pickThumbnail(t.imageRef)}
                  onRegen={() => regenThumb(i)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// P5t — live preview of a caption preset's look, rendered by the SAME captionRenderer
// the final video uses (so it's accurate, not a mockup) on a dark chip. 0 credit.
function CaptionPresetPreview({ presetId }: { presetId: CaptionPresetId }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    renderCaptionBlob('Đỉnh · RM79', presetId)   // short sample → renders LARGER in the chip so the font is visible
      .then((b) => { if (!alive) return; made = URL.createObjectURL(b); setUrl(made) })
      .catch(() => {})
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [presetId])
  return (
    <div className="flex h-14 items-center justify-center overflow-hidden rounded bg-gray-900">
      {url && <img src={url} alt="" className="max-h-12 w-auto object-contain px-1" />}
    </div>
  )
}

// Live banner preview chip — renders the real slogan in the preset's style, FREE.
function BannerPresetPreview({ presetId, slogan }: { presetId: BannerPresetId; slogan: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    renderBannerBlob(slogan, presetId)
      .then((b) => { if (!alive) return; made = URL.createObjectURL(b); setUrl(made) })
      .catch(() => {})
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [presetId, slogan])
  return (
    <div className="flex h-9 items-center justify-center overflow-hidden rounded bg-gray-200">
      {url && <img src={url} alt="" className="max-h-8 w-auto object-contain px-1" />}
    </div>
  )
}

// Big live banner RESULT preview (selected preset + current text) so the user judges the
// banner BEFORE rendering the whole video — instant + free (canvas, 0 credit).
function BannerLivePreview({ presetId, text }: { presetId: BannerPresetId; text: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    renderBannerBlob(text, presetId)
      .then((b) => { if (!alive) return; made = URL.createObjectURL(b); setUrl(made) })
      .catch(() => {})
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [presetId, text])
  return url
    ? <img src={url} alt="" className="max-h-12 w-auto max-w-full object-contain" />
    : <span className="text-[11px] text-gray-400">Đang dựng banner…</span>
}

// ── AI thumbnail card (one archetype) — ported from mode-1 ExportPhase ────────
function AiThumbCard({ thumb, picked, onPick, onRegen }: { thumb: AiThumbnail; picked: boolean; onPick: () => void; onRegen: () => void }) {
  const cfg = THUMBNAIL_ARCHETYPES[thumb.archetypeId]
  const url = useAssetUrl(thumb.imageRef ?? undefined)
  const busy = thumb.status === 'rendering'
  return (
    <div className={`overflow-hidden rounded-lg border-2 transition-all ${picked ? 'ui-accent-soft' : 'border-gray-200'}`}>
      <button onClick={onPick} disabled={thumb.status !== 'completed'} className="block aspect-[9/16] w-full bg-gray-100">
        {busy && <span className="flex h-full items-center justify-center text-[10px] text-gray-400"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Đang tạo...</span>}
        {thumb.status === 'failed' && <span className="flex h-full items-center justify-center px-1 text-center text-[9px] text-rose-500">Lỗi: {thumb.error?.slice(0, 40)}</span>}
        {thumb.status === 'completed' && url && <img src={url} alt={cfg.labelVi} className="h-full w-full object-cover" />}
      </button>
      <div className="p-1.5">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[10px] font-bold text-gray-800">{cfg.emoji} {cfg.labelVi}{picked && ' ✓'}</p>
          {/* P6c — tạo lại riêng ảnh này (ra biến thể mới / retry khi lỗi). ~8cr */}
          <button onClick={onRegen} disabled={busy} title="Tạo lại ảnh này (~8cr)"
            className="flex shrink-0 items-center gap-0.5 rounded border border-gray-200 bg-white px-1 py-0.5 text-[9px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <RotateCcw className="h-2.5 w-2.5" /> Tạo lại
          </button>
        </div>
        {thumb.hook && <p className="mt-0.5 truncate text-[9px] font-semibold text-violet-700">"{thumb.hook}"</p>}
      </div>
    </div>
  )
}
