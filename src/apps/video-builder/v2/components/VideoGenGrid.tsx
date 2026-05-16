// ── VideoGenGrid ────────────────────────────────────────────────────────────
// 5-col compact grid showing one card per scene clip.
//
// Card states:
//   • pending / queued  → keyframe still + "Trong hàng chờ" spinner
//   • generating        → keyframe + spinner + "Đang sinh video…"
//   • completed         → <video> autoplay-on-hover, download, regen buttons
//   • failed            → keyframe + AlertCircle + "Thử lại" button
//
// Subscribes to videoGenJobStore so the grid re-renders reactively as
// workers finish.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react'
import { Loader2, AlertCircle, RotateCcw, Download, Play, Pause, Maximize2 } from 'lucide-react'
import { useVideoGenJobStore } from '../stores/videoGenJobStore'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import { VIDEO_STATUS_LABEL_VI } from '../types'
import type { VideoGenItem, SceneBlueprint } from '../types'

// Reuse sceneType colour vocab from SceneGenGrid so the emotional arc is
// scannable across both phases.
const SCENE_TYPE_BG: Partial<Record<NonNullable<SceneBlueprint['sceneType']>, string>> = {
  hook:            'bg-fuchsia-500/85',
  pain:            'bg-slate-700/85',
  frustration:     'bg-red-600/85',
  failed_solution: 'bg-orange-600/85',
  discovery:       'bg-cyan-500/85',
  explanation:     'bg-blue-500/85',
  recovery:        'bg-emerald-500/85',
  lifestyle:       'bg-teal-500/85',
  social_proof:    'bg-amber-500/85',
  cta:             'bg-pink-600/90',
}

const SCENE_TYPE_LABEL: Partial<Record<NonNullable<SceneBlueprint['sceneType']>, string>> = {
  hook:            'HOOK',
  pain:            'PAIN',
  frustration:     'FRUST',
  failed_solution: 'FAIL',
  discovery:       'DISCO',
  explanation:     'EXPL',
  recovery:        'RECOV',
  lifestyle:       'LIFE',
  social_proof:    'PROOF',
  cta:             'CTA',
}

interface VideoGenGridProps {
  blueprintBySceneId: Map<number, SceneBlueprint>
  onRetry: (idx: number) => void
  onCancelQueue: () => void
}

export default function VideoGenGrid({ blueprintBySceneId, onRetry, onCancelQueue }: VideoGenGridProps) {
  const job = useVideoGenJobStore((s) => s.job)
  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-semibold text-gray-500">Chưa có queue sinh video</p>
        <p className="text-xs text-gray-400">Quay lại bước Gen B-Roll, duyệt các cảnh, rồi nhấn "Sinh video" để bắt đầu.</p>
      </div>
    )
  }

  const done   = job.items.filter((i) => i.status === 'completed').length
  const failed = job.items.filter((i) => i.status === 'failed').length
  const total  = job.items.length
  const overallPct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0

  return (
    <div className="flex h-full flex-col">
      {/* Sticky banner — progress + provider + cancel */}
      <div className="sticky top-0 z-20 border-b border-black/8 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">Bước 6: Sinh video từ B-Roll</h2>
            <p className="text-[11px] text-gray-500">
              {job.providerLabel} · ~{job.creditPerClip} credit/clip · {total} clip × {job.items[0]?.durationSec ?? 5}s
            </p>
          </div>
          {job.isRunning && (
            <button
              onClick={onCancelQueue}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
            >
              Huỷ queue
            </button>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-violet-500 transition-all duration-500 ease-out" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          {done}/{total} xong · {failed} lỗi {job.isRunning ? '· đang chạy 2 worker song song' : job.isPaused ? '· đã pause' : ''}
        </p>
      </div>

      {/* 5-col compact grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {job.items.map((item, idx) => (
            <VideoCard
              key={item.sceneId}
              item={item}
              blueprint={blueprintBySceneId.get(item.sceneId)}
              onRetry={() => onRetry(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────

function VideoCard({
  item, blueprint, onRetry,
}: {
  item: VideoGenItem
  blueprint: SceneBlueprint | undefined
  onRetry: () => void
}) {
  const keyframeUrl = useAssetUrl(item.keyframeRef)
  const videoUrl = useAssetUrl(item.videoRef ?? undefined)
  const videoRefDom = useRef<HTMLVideoElement | null>(null)
  const [isHovering, setIsHovering] = useState(false)

  const isLoading = item.status === 'queued' || item.status === 'generating'
  const isDone = item.status === 'completed' && item.videoRef
  const isFailed = item.status === 'failed'

  const sceneTypeBg = blueprint?.sceneType ? SCENE_TYPE_BG[blueprint.sceneType] : 'bg-gray-500/85'
  const sceneTypeLabel = blueprint?.sceneType ? SCENE_TYPE_LABEL[blueprint.sceneType] : ''

  // Autoplay muted on hover (UGC creative scan pattern)
  const handleEnter = () => {
    setIsHovering(true)
    if (isDone && videoRefDom.current) {
      videoRefDom.current.currentTime = 0
      void videoRefDom.current.play().catch(() => { /* autoplay blocked */ })
    }
  }
  const handleLeave = () => {
    setIsHovering(false)
    if (videoRefDom.current) videoRefDom.current.pause()
  }

  const handleDownload = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `scene-${item.sceneId}.mp4`
    a.click()
  }

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border transition-all ${
        isDone     ? 'border-emerald-300' :
        isFailed   ? 'border-red-300' :
        isLoading  ? 'border-violet-300' :
        'border-black/10'
      }`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Media area — keyframe still under video so failed/loading shows the keyframe */}
      <div className="relative aspect-[9/16] w-full bg-gray-100">
        {/* Always render keyframe as fallback */}
        {keyframeUrl && (
          <img src={keyframeUrl} alt={`Scene ${item.sceneId}`} className="absolute inset-0 h-full w-full object-cover" />
        )}

        {/* Video overlay when ready */}
        {isDone && videoUrl && (
          <video
            ref={videoRefDom}
            src={videoUrl}
            muted
            playsInline
            loop
            preload="metadata"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
              isHovering ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[9px] font-semibold">{VIDEO_STATUS_LABEL_VI[item.status]}</span>
            {item.taskId && <span className="text-[8px] opacity-60">{item.taskId.slice(0, 8)}</span>}
          </div>
        )}

        {/* Failed overlay */}
        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-red-900/70 px-2 text-center text-white backdrop-blur-sm">
            <AlertCircle className="h-5 w-5" />
            <span className="line-clamp-3 text-[9px] leading-tight">{item.error ?? 'Lỗi'}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRetry() }}
              className="mt-1 flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-100"
            >
              <RotateCcw className="h-3 w-3" /> Thử lại
            </button>
          </div>
        )}

        {/* Scene id + scene-type badge */}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          #{item.sceneId}
        </span>
        {sceneTypeLabel && (
          <span className={`absolute left-1.5 top-7 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white backdrop-blur-sm ${sceneTypeBg}`}>
            {sceneTypeLabel}
          </span>
        )}

        {/* Play indicator when video ready but not hovering */}
        {isDone && !isHovering && (
          <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/85 text-white shadow-sm backdrop-blur-sm">
            <Play className="h-3 w-3 ml-0.5" />
          </div>
        )}
        {isDone && isHovering && (
          <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white shadow-sm backdrop-blur-sm">
            <Pause className="h-3 w-3" />
          </div>
        )}

        {/* Hover overlay — quick actions (only when done) */}
        {isDone && (
          <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload() }}
              title="Tải clip"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white hover:bg-black/85"
            >
              <Download className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRetry() }}
              title="Sinh lại clip này"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500 text-white hover:bg-violet-600"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!videoRefDom.current) return
                if (videoRefDom.current.requestFullscreen) void videoRefDom.current.requestFullscreen()
              }}
              title="Phóng to"
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white hover:bg-black/85"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom strip — 1 line: status dot + duration + sceneGoal truncated */}
      <div className="flex items-center gap-1.5 border-t border-black/8 bg-white px-2 py-1.5">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
            isDone     ? 'bg-emerald-500' :
            isFailed   ? 'bg-red-500' :
            isLoading  ? 'bg-violet-500 animate-pulse' :
            'bg-gray-300'
          }`}
          title={VIDEO_STATUS_LABEL_VI[item.status]}
        />
        <span className="text-[9px] text-gray-400">{item.durationSec}s</span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-800" title={blueprint?.sceneGoal}>
          {blueprint?.sceneGoal ?? `Scene ${item.sceneId}`}
        </span>
      </div>
    </div>
  )
}

// Suppress unused param idx if we add per-idx debug later
export type { VideoGenGridProps }
