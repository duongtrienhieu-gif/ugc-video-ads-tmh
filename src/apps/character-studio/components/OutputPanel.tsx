import { useState, useEffect, useRef } from 'react'
import { Copy, Check, Save, ChevronDown, UserRound, Loader2, Braces, Download, X, Sparkles } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import type { GenerationResult } from '../services/generateCharacter'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import { IMAGE_MODELS } from '../../../utils/kieai'
import type { ImageResolution } from '../../../utils/kieai'
import VariantsModal from '../../finder/VariantsModal'
import type { Model } from '../../../stores/types'

interface OutputPanelProps {
  result: GenerationResult | null
  isGenerating: boolean
  onGenerate: (modelId: string, resolution: ImageResolution) => void
  onCancel?: () => void
  canGenerate: boolean
  aspectRatio: string
  onAspectRatioChange: (v: string) => void
  onAutoSave?: () => Promise<void>
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'Google') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[9px] font-bold text-blue-400">
        G
      </span>
    )
  }
  if (provider === 'Black Forest Labs') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[9px] font-bold text-violet-400">
        F
      </span>
    )
  }
  if (provider === 'ByteDance') {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-[9px] font-bold text-cyan-400">
        B
      </span>
    )
  }
  // OpenAI
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/6 text-[9px] font-bold text-gray-700">
      O
    </span>
  )
}

export default function OutputPanel({ result, isGenerating, onGenerate, onCancel, canGenerate, aspectRatio, onAspectRatioChange, onAutoSave }: OutputPanelProps) {
  const [copied, setCopied] = useState(false)
  const [jsonExpanded, setJsonExpanded] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedModel, setSavedModel] = useState<Model | null>(null)
  const [variantsOpen, setVariantsOpen] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const pendingVariantsOpenRef = useRef(false)
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0]) // Nano Banana 2 — reliable default
  const [resolution, setResolution] = useState<ImageResolution>('1K')
  const [modelDropOpen, setModelDropOpen] = useState(false)

  const [progress, setProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isGenerating) {
      setProgress(0)
      progressRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev
          // Fast at start, slow near end
          const increment = prev < 40 ? 3 : prev < 70 ? 1.5 : prev < 90 ? 0.5 : 0.2
          return Math.min(prev + increment, 95)
        })
      }, 600)
    } else {
      if (progressRef.current) clearInterval(progressRef.current)
      if (progress > 0) {
        setProgress(100)
        setTimeout(() => setProgress(0), 500)
      }
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating])

  const addModel = useBankStore((s) => s.addModel)
  const models = useBankStore((s) => s.models)
  const resolvedImageUrl = useAssetUrl(result?.imageUrl)

  const isPortrait = aspectRatio.includes('9:16') || aspectRatio.includes('1:1')
  const credits = selectedModel.credits[resolution]

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result.jsonPrompt, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // After saved=true, watch models reactively to find the newly saved model
  useEffect(() => {
    if (saved && result?.imageUrl && !savedModel) {
      const found = models.find((m) => m.characterImage === result.imageUrl)
      if (found) {
        setSavedModel(found)
        if (pendingVariantsOpenRef.current) {
          pendingVariantsOpenRef.current = false
          setVariantsOpen(true)
        }
      }
    }
  }, [models, saved, result?.imageUrl, savedModel])

  const handleSave = async () => {
    if (!saveName.trim() || !result) return
    await addModel({
      characterImage: result.imageUrl,
      name: saveName.trim(),
      notes: '',
      jsonProfile: result.jsonPrompt as unknown as Record<string, unknown>,
      source: 'character-studio',
    })
    setShowSaveForm(false)
    setSaveName('')
    setSaved(true)
  }

  // ── Shared bottom controls ────────────────────────────────────────────
  function BottomControls() {
    return (
      <div className="shrink-0 border-t border-black/8 p-4 space-y-3">
        {/* Aspect ratio selector */}
        <div className="flex gap-2">
          <button
            onClick={() => onAspectRatioChange('Portrait (9:16)')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${aspectRatio.includes('9:16') ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-black/10 text-gray-500 hover:border-black/15 hover:text-gray-700'}`}
          >
            <span>📱</span> Dọc 9:16
          </button>
          <button
            onClick={() => onAspectRatioChange('Square (1:1)')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${aspectRatio.includes('1:1') ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-black/10 text-gray-500 hover:border-black/15 hover:text-gray-700'}`}
          >
            <span>⬜</span> Vuông 1:1
          </button>
          <button
            onClick={() => onAspectRatioChange('Landscape (16:9)')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${aspectRatio === 'Landscape (16:9)' ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-black/10 text-gray-500 hover:border-black/15 hover:text-gray-700'}`}
          >
            <span>🖥</span> Ngang 16:9
          </button>
        </div>

        {/* Model selector card */}
        <div className="relative rounded-xl border border-black/10 bg-black/[0.02]">
          <button
            onClick={() => setModelDropOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
          >
            <ProviderIcon provider={selectedModel.provider} />
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-800">{selectedModel.name}</span>
                {selectedModel.starred && <span className="text-[10px] text-yellow-400">⭐</span>}
                <span className="ml-1 text-[10px] text-gray-400">{selectedModel.provider}</span>
              </div>
              <span className="text-[10px] text-gray-400">{resolution} — {credits} Credit</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${modelDropOpen ? 'rotate-180' : ''}`} />
          </button>

          {modelDropOpen && (
            <div className="border-t border-black/8 py-1">
              {IMAGE_MODELS.map((m) => {
                const isSelected = selectedModel.id === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m); setModelDropOpen(false) }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${isSelected ? 'bg-sky-500/10' : 'hover:bg-black/[0.03]'}`}
                  >
                    <ProviderIcon provider={m.provider} />
                    <span className={`flex-1 text-xs font-medium ${isSelected ? 'text-sky-400' : 'text-gray-700'}`}>
                      {m.name}
                    </span>
                    {m.starred && <span className="text-[10px] text-yellow-400">⭐</span>}
                    <span className="text-[10px] text-gray-400">{m.provider}</span>
                    <span className={`ml-2 text-[10px] tabular-nums ${isSelected ? 'text-sky-400/70' : 'text-gray-400'}`}>
                      {m.credits[resolution]} Credit
                    </span>
                    {isSelected && <Check className="ml-1 h-3 w-3 text-sky-400" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Resolution selector */}
        <div className="flex gap-2">
          {(['1K', '2K', '4K'] as ImageResolution[]).map((r) => (
            <button
              key={r}
              onClick={() => setResolution(r)}
              className={`flex flex-1 flex-col items-center rounded-lg border py-2 text-xs transition-colors ${resolution === r ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-black/10 text-gray-500 hover:border-black/15 hover:text-gray-700'}`}
            >
              <span className="font-semibold">{r}</span>
              <span className="text-[10px] opacity-70">{selectedModel.credits[r]} Credit</span>
            </button>
          ))}
        </div>

        {/* Generate button */}
        <button
          onClick={() => onGenerate(selectedModel.id, resolution)}
          disabled={!canGenerate || isGenerating}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-black/12 bg-sky-500 px-6 py-3.5 text-[13px] font-medium tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tạo...</span>
            </>
          ) : (
            <span>👤 Tạo Avatar AI ({credits} Credit)</span>
          )}
        </button>
      </div>
    )
  }

  // ── Generating state ──────────────────────────────────────────────────
  if (isGenerating) {
    return (
      <div className="flex h-full flex-col">
        {/* Dark image area */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className={`flex items-center justify-center overflow-hidden rounded-xl border border-black/8 bg-black ${isPortrait ? 'h-full' : 'w-full aspect-video'}`}>
            <Loader2 className="h-8 w-8 animate-spin text-white/20" />
          </div>
        </div>

        {/* Progress + Cancel at bottom */}
        <div className="shrink-0 border-t border-black/8 p-4 space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-gray-500">Đang tạo ảnh...</span>
              <span className="text-xs font-semibold tabular-nums text-sky-500">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-sky-400 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={onCancel}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-black/12 px-6 py-3 text-sm text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-700"
          >
            <X className="h-4 w-4" />
            Hủy
          </button>
        </div>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex h-full flex-col">
        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 p-8">
          <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1">
            <span className="text-[9px] font-medium uppercase tracking-widest text-gray-400">Powered by</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-sky-400">kie.ai</span>
          </div>
          <UserRound className="h-10 w-10 text-gray-200" strokeWidth={1.5} />
          <p className="text-sm text-gray-300">Điền thông tin để tạo Avatar AI</p>
          <p className="text-xs text-gray-200">Hình ảnh Avatar AI sẽ hiển thị ở đây</p>
        </div>
        <BottomControls />
      </div>
    )
  }

  // ── Result state ──────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col p-4">
        {/* Image */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className={`group relative overflow-hidden rounded-xl border border-black/10 bg-black ${isPortrait ? 'h-full max-h-full' : 'w-full'}`}>
            <img
              src={resolvedImageUrl}
              alt="Generated character"
              className={`${isPortrait ? 'h-full' : 'w-full'} object-contain`}
            />
            <button
              onClick={() => {
                if (!resolvedImageUrl) return
                const a = document.createElement('a')
                a.href = resolvedImageUrl
                a.download = `character-${Date.now()}.png`
                a.click()
              }}
              className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/70 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/80 hover:text-white"
              title="Tải xuống ảnh"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-col gap-2">
          {/* Collapsible JSON */}
          <div className="rounded-xl border border-black/8 bg-black/[0.02]">
            <button
              onClick={() => setJsonExpanded(!jsonExpanded)}
              className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-black/[0.03]"
            >
              <div className="flex items-center gap-2">
                <Braces className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-[11px] font-medium text-gray-700">JSON Prompt</span>
              </div>
              <div className="flex items-center gap-2">
                {jsonExpanded && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy() }}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Đã sao chép' : 'Sao chép JSON'}
                  </button>
                )}
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${jsonExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {jsonExpanded && (
              <div className="border-t border-black/8 px-3 py-2">
                <pre className="max-h-48 overflow-y-auto rounded-lg bg-gray-100 p-2 text-[10px] leading-relaxed text-gray-600">
                  {JSON.stringify(result.jsonPrompt, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Save to Model Bank */}
          {showSaveForm ? (
            <div className="flex gap-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                placeholder='vd: "Sarah - Phòng ngủ"'
                autoFocus
                className="flex-1 rounded-full border border-black/10 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-sky-500/30"
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="rounded-full bg-sky-500/15 px-5 py-3 text-sm font-medium text-sky-400 transition-colors hover:bg-sky-500/25 disabled:opacity-40"
              >
                Lưu
              </button>
              <button
                onClick={() => { setShowSaveForm(false); setSaveName('') }}
                className="rounded-full px-5 py-3 text-sm text-gray-500 transition-colors hover:text-gray-700"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveForm(true)}
              className={`flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3.5 text-[13px] font-medium tracking-tight transition-colors ${saved
                ? 'border-green-500/20 bg-green-500/10 text-green-400'
                : 'border-black/12 text-gray-700 hover:bg-black/[0.05] hover:text-gray-900'
                }`}
            >
              {saved ? (
                <><Check className="h-4 w-4" /> Đã lưu vào Project Avatar AI</>
              ) : (
                <><Save className="h-4 w-4" /> Lưu vào Project Avatar AI</>
              )}
            </button>
          )}

          {/* "Tạo 4 góc mặt" — visible as soon as result exists */}
          <button
            onClick={async () => {
              if (savedModel) {
                setVariantsOpen(true)
              } else {
                // Auto-save first, then wait for savedModel via useEffect
                pendingVariantsOpenRef.current = true
                setIsAutoSaving(true)
                try {
                  if (onAutoSave) {
                    await onAutoSave()
                  } else {
                    // Fallback: save with default name inline
                    if (!result) return
                    await addModel({
                      characterImage: result.imageUrl,
                      name: `Avatar ${new Date().toLocaleDateString('vi-VN')}`,
                      notes: '',
                      jsonProfile: result.jsonPrompt as unknown as Record<string, unknown>,
                      source: 'character-studio',
                    })
                    setSaved(true)
                  }
                } catch (err) {
                  pendingVariantsOpenRef.current = false
                  console.error('Auto-save failed:', err)
                } finally {
                  setIsAutoSaving(false)
                }
              }
            }}
            disabled={isAutoSaving}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-violet-300 bg-violet-50 px-6 py-3.5 text-[13px] font-medium tracking-tight text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
          >
            {isAutoSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> ✨ Tạo 4 góc mặt — identity lock B-roll</>
            )}
          </button>
        </div>
      </div>

      <BottomControls />
      {variantsOpen && savedModel && (
        <VariantsModal model={savedModel} onClose={() => setVariantsOpen(false)} />
      )}
    </div>
  )
}
