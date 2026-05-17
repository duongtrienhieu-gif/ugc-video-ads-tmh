import { useState, useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import UploadView from './components/UploadView'
import ResultsView from './components/ResultsView'
import { analyzeAd } from './services/analyzeAd'
import { sanitizeAnalysisResult, safeParseLocalStorage } from './services/sanitizeAnalysisResult'
import { getUrl, saveAsset } from '../../utils/assetStore'
import type { AnalysisResult } from './types'

type ViewState = 'upload' | 'loading' | 'results'

// Cache version — bump to invalidate older cached analyses when the shape changes
// v2 = Z1+Z2 Creative Director upgrade (decisionLayer / adAngle / retentionTimeline / etc.)
const CACHE_KEY = 'ugc-ad-anatomy-cache'
const CACHE_VERSION = 2

interface AdAnatomyCache {
  /** Optional for back-compat — entries without `version` are treated as v1 (stale) */
  version?: number
  result: AnalysisResult
  fileName: string
  videoAssetId: string | null
}

export default function AdAnatomy() {
  const [view, setView] = useState<ViewState>('upload')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const videoUrlRef = useRef<string | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Restore cached result on mount ────────────────────────────────────────
  // Z20: safeParseLocalStorage + sanitizeAnalysisResult so malformed /
  // partial / pre-v2 cached data NEVER crashes the page. Missing required
  // fields get filled with safe defaults; UI renders empty-but-functional
  // state instead of throwing on direct destructure access.
  useEffect(() => {
    const cache = safeParseLocalStorage<AdAnatomyCache | null>(CACHE_KEY, null)
    if (!cache) return
    if (!cache.result || !cache.fileName) {
      localStorage.removeItem(CACHE_KEY)
      return
    }
    // Drop stale cache from before the Creative Director upgrade
    if (cache.version !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_KEY)
      return
    }
    setResult(sanitizeAnalysisResult(cache.result))
    setFileName(cache.fileName)
    setView('results')
    // Restore video URL from Supabase asynchronously
    if (cache.videoAssetId) {
      getUrl(cache.videoAssetId)
        .then((url) => { if (url) setVideoSrc(url) })
        .catch(() => {})
    }
  }, [])

  // ── Progress bar ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (view === 'loading') {
      setProgress(0)
      progressRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev
          const increment = prev < 40 ? 2.5 : prev < 70 ? 1.2 : prev < 90 ? 0.4 : 0.15
          return Math.min(prev + increment, 95)
        })
      }, 600)
    } else {
      if (progressRef.current) clearInterval(progressRef.current)
      if (view === 'results') {
        setProgress(100)
        setTimeout(() => setProgress(0), 400)
      }
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [view])

  const handleAnalyze = async (file: File) => {
    setView('loading')
    setFileName(file.name)
    setError(null)

    // Create a local preview URL for the video
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    const localUrl = URL.createObjectURL(file)
    videoUrlRef.current = localUrl
    setVideoSrc(localUrl)

    try {
      const rawAnalysis = await analyzeAd(file)
      // Z20: sanitize before storing in state OR localStorage — guarantees
      // every required field is present so HookSection etc. can't crash on
      // a malformed Gemini response.
      const analysis = sanitizeAnalysisResult(rawAnalysis)
      setResult(analysis)
      setView('results')

      // ── Persist result immediately (video will be added async) ──────────
      const cache: AdAnatomyCache = { version: CACHE_VERSION, result: analysis, fileName: file.name, videoAssetId: null }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))

      // Upload video to Supabase in background for persistent URL
      saveAsset(file, file.type || 'video/mp4')
        .then((assetId) => {
          cache.videoAssetId = assetId
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
        })
        .catch(() => { /* silent — video stays as blob URL for this session */ })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Phân tích thất bại: ${msg}`)
      setView('upload')
    }
  }

  const handleReset = () => {
    // Clear persisted cache — this is the ONLY place we wipe it
    localStorage.removeItem(CACHE_KEY)
    setResult(null)
    setView('upload')
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current)
      videoUrlRef.current = null
    }
    setVideoSrc(null)
    setFileName('')
    setError(null)
  }

  if (view === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        {videoSrc && (
          <div className="max-h-80 max-w-72 overflow-hidden rounded-xl border border-black/10 opacity-40 grayscale">
            <video src={videoSrc} className="h-full w-full object-contain" muted autoPlay loop />
          </div>
        )}
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#FB2B37]" />
            <p className="text-sm font-medium tracking-tight text-gray-600">
              AI đang phân tích quảng cáo...
            </p>
          </div>
          <div className="w-full">
            <div className="mb-1.5 flex justify-between">
              <span className="text-xs text-gray-400">Đang xử lý</span>
              <span className="text-xs font-semibold tabular-nums text-[#FB2B37]">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#FB2B37] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Z4: persist child-driven result updates (variations, future fields) ──
  const handleResultUpdate = (next: AnalysisResult) => {
    // Z20: sanitize updates too — variations from a 2nd Gemini call could
    // arrive malformed; this guarantees the state never holds an unrender-
    // able object.
    const clean = sanitizeAnalysisResult(next)
    setResult(clean)
    // Re-write cache with the same fileName / videoAssetId, just new result
    const prev = safeParseLocalStorage<AdAnatomyCache | null>(CACHE_KEY, null)
    const merged: AdAnatomyCache = {
      version: CACHE_VERSION,
      result: clean,
      fileName: prev?.fileName ?? fileName,
      videoAssetId: prev?.videoAssetId ?? null,
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged))
    } catch { /* silent — quota / Safari private mode */ }
  }

  if (view === 'results' && result) {
    return (
      <ResultsView
        result={result}
        videoSrc={videoSrc}
        fileName={fileName}
        onReset={handleReset}
        onResultUpdate={handleResultUpdate}
      />
    )
  }

  return (
    <>
      <UploadView onAnalyze={handleAnalyze} />
      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-lg bg-[#FB2B37]/15 px-4 py-2 text-sm text-[#FB2B37]">
          {error}
        </div>
      )}
    </>
  )
}
