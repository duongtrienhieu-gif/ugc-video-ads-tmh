import { useState, useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import UploadView from './components/UploadView'
import ResultsView from './components/ResultsView'
import { analyzeAd } from './services/analyzeAd'
import type { AnalysisResult } from './types'

type ViewState = 'upload' | 'loading' | 'results'

export default function AdAnatomy() {
  const [view, setView] = useState<ViewState>('upload')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const videoUrlRef = useRef<string | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

    // Create a preview URL for the video
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    const url = URL.createObjectURL(file)
    videoUrlRef.current = url
    setVideoSrc(url)

    try {
      const analysis = await analyzeAd(file)
      setResult(analysis)
      setView('results')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Phân tích thất bại: ${msg}`)
      setView('upload')
    }
  }

  const handleReset = () => {
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

  if (view === 'results' && result && videoSrc) {
    return (
      <ResultsView
        result={result}
        videoSrc={videoSrc}
        fileName={fileName}
        onReset={handleReset}
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
