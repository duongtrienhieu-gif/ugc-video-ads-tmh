// ── HybridExportPhase (P3e) — Bước "Export MP4" ──────────────────────────────
// Shows the assembled hybrid MP4 → play + download. "Ghép lại" re-assembles from the
// current rendered clips (0 credit) — useful after re-rendering a scene back in
// "Tạo Video". All inputs come from the persisted store (F5-safe).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Loader2, Download, RotateCcw, ArrowLeft, AlertCircle, Film } from 'lucide-react'
import { useAppStore } from '../../../../stores/appStore'
import { useAdsVideoStore } from '../stores/adsVideoStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { assembleFromHybridState } from '../services/hybridAssembleFlow'

const now = () => Date.now()

export default function HybridExportPhase() {
  const state          = useAdsVideoStore((s) => s.state)
  const setHybridFinal = useAdsVideoStore((s) => s.setHybridFinal)
  const setPhase       = useAdsVideoStore((s) => s.setPhase)
  const addToast       = useAppStore((s) => s.addToast)

  const hybrid = state.hybrid
  const script = state.scriptBrain.script
  const scenes = hybrid.scenes ?? []
  const doneCount = scenes.filter((_, i) => hybrid.clips[i]).length
  const allDone = scenes.length > 0 && doneCount === scenes.length
  const resolution = hybrid.resolution

  const [assembling, setAssembling] = useState(false)
  const [error, setError] = useState('')
  const finalUrl = useAssetUrl(hybrid.finalVideoRef ?? undefined)

  const reassemble = async () => {
    const h = useAdsVideoStore.getState().state.hybrid
    if (!script) return
    setAssembling(true); setError('')
    try {
      const videoRef = await assembleFromHybridState(h, script, resolution)
      setHybridFinal(videoRef)
      addToast('✓ Đã ghép lại', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg); addToast(`Ghép lỗi: ${msg.slice(0, 120)}`, 'error')
    } finally { setAssembling(false) }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Export MP4</h2>
            <p className="text-[12px] text-gray-500">Video hybrid hoàn chỉnh — xem + tải về. "Ghép lại" miễn phí nếu bạn vừa render lại cảnh.</p>
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

        {hybrid.finalVideoRef && finalUrl ? (
          <div className="rounded-xl border border-emerald-300 bg-white p-3">
            <video src={finalUrl} controls className="mx-auto max-h-[64vh] rounded-lg bg-black" />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <a href={finalUrl} download={`ugc-hybrid-${now()}.mp4`}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-violet-700">
                <Download className="h-3.5 w-3.5" /> Tải MP4
              </a>
              <button onClick={reassemble} disabled={assembling || !allDone}
                title={allDone ? 'Ghép lại từ các clip đã render (0 credit)' : 'Còn cảnh chưa render'}
                className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-[12px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {assembling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Ghép lại (0cr)
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <Film className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-semibold text-gray-500">Chưa có video</p>
            <p className="mt-1 text-[12px] text-gray-400">
              {allDone
                ? 'Các cảnh đã render — bấm "Ghép lại" để tạo MP4.'
                : `Quay lại "Tạo Video", render hết ${scenes.length || ''} cảnh rồi bấm "Tạo video →".`}
            </p>
            {allDone && (
              <button onClick={reassemble} disabled={assembling}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {assembling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />} Ghép video (0cr)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
