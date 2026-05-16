import { useState, useEffect, useRef } from 'react'
import { Copy, Check, Save, ChevronDown, UserRound, Loader2, Braces, Download, X, Sparkles, RotateCcw } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import type { GenerationResult } from '../services/generateCharacter'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import { IMAGE_MODELS } from '../../../utils/kieai'
import type { ImageResolution } from '../../../utils/kieai'
import { generateExtra3Angles, generateOneVariant, describeAvatarFromImage, EXTRA_3_RECIPES } from '../services/generateVariants'
import type { AvatarVariant } from '../../../stores/types'

interface OutputPanelProps {
  result: GenerationResult | null
  isGenerating: boolean
  onGenerate: (modelId: string, resolution: ImageResolution) => void
  onCancel?: () => void
  canGenerate: boolean
  aspectRatio: string
  onAspectRatioChange: (v: string) => void
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

export default function OutputPanel({ result, isGenerating, onGenerate, onCancel, canGenerate, aspectRatio, onAspectRatioChange }: OutputPanelProps) {
  const [copied, setCopied] = useState(false)
  const [jsonExpanded, setJsonExpanded] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saved, setSaved] = useState(false)
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0]) // Nano Banana 2 — reliable default
  const [resolution, setResolution] = useState<ImageResolution>('1K')
  const [modelDropOpen, setModelDropOpen] = useState(false)

  // ── Integrated 4-image workflow state ─────────────────────────────────────
  // After main avatar is generated, user can produce 3 extra face angles inline.
  // null slot = not yet generated; AvatarVariant = ready; isRegenerating tracks per-slot regen.
  const [extraAngles, setExtraAngles] = useState<(AvatarVariant | null)[]>([])
  const [isGeneratingExtras, setIsGeneratingExtras] = useState(false)
  const [extraProgress, setExtraProgress] = useState({ done: 0, total: 0, label: '' })
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [isSavingPreset, setIsSavingPreset] = useState(false)

  const kieApiKey = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast = useAppStore((s) => s.addToast)

  // Cached avatar description (Gemini Vision) — computed once on first gen, reused for regens
  const avatarDescRef = useRef<string | null>(null)

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
  const resolvedImageUrl = useAssetUrl(result?.imageUrl)

  const isPortrait = aspectRatio.includes('9:16') || aspectRatio.includes('1:1')
  const credits = selectedModel.credits[resolution]

  // Reset workflow when result changes (e.g. user generates new avatar)
  useEffect(() => {
    setExtraAngles([])
    setPresetName('')
    setSaved(false)
    avatarDescRef.current = null  // invalidate cached description for new avatar
  }, [result?.imageUrl])

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result.jsonPrompt, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Compute (or reuse cached) avatar description via Gemini Vision.
  // This is the PRIMARY identity anchor — without it the angle gen produces random people.
  const ensureAvatarDescription = async (): Promise<string | undefined> => {
    if (avatarDescRef.current) return avatarDescRef.current
    if (!resolvedImageUrl || !geminiApiKey) return undefined
    const desc = await describeAvatarFromImage(resolvedImageUrl, geminiApiKey)
    avatarDescRef.current = desc
    return desc ?? undefined
  }

  // ── Generate 3 extra face angles inline ───────────────────────────────────
  const handleGenerateExtras = async () => {
    if (!result || !resolvedImageUrl) return
    if (!kieApiKey) {
      addToast('Cần KIE.ai API key trong Cài đặt', 'error')
      return
    }
    setIsGeneratingExtras(true)
    setExtraAngles([null, null, null])
    setExtraProgress({ done: 0, total: 3, label: 'phân tích avatar' })

    try {
      // Step 1: Describe the avatar via Gemini Vision (identity anchor in prompt)
      const avatarDesc = await ensureAvatarDescription()
      if (!avatarDesc) {
        addToast('Gemini Vision không phân tích được avatar — vẫn thử gen', 'error')
      }

      // Step 2: Generate the 3 angles via KIE.ai GPT Image 2 (with reference)
      const angles = await generateExtra3Angles({
        apiKey: kieApiKey,
        originalImageUrl: resolvedImageUrl,
        avatarDescription: avatarDesc,
        onProgress: (done, total, label) => setExtraProgress({ done, total, label }),
      })
      // Pad to 3 slots in case some failed
      const padded: (AvatarVariant | null)[] = [angles[0] ?? null, angles[1] ?? null, angles[2] ?? null]
      setExtraAngles(padded)
      if (angles.length < 3) {
        addToast(`Chỉ tạo được ${angles.length}/3 góc — bạn có thể tạo lại từng ảnh`, 'error')
      } else {
        addToast('✓ Đã tạo 3 góc mặt thêm')
      }
    } catch (err) {
      console.error('[gen extras] failed:', err)
      addToast(`Lỗi: ${err instanceof Error ? err.message.slice(0, 80) : 'unknown'}`, 'error')
    } finally {
      setIsGeneratingExtras(false)
    }
  }

  // Regenerate one of the 3 angles — reuses cached avatar description
  const handleRegenAngle = async (idx: number) => {
    if (!resolvedImageUrl) return
    if (!kieApiKey) {
      addToast('Cần OpenAI API key trong Cài đặt', 'error')
      return
    }
    setRegenIdx(idx)
    try {
      const avatarDesc = await ensureAvatarDescription()
      const recipe = EXTRA_3_RECIPES[idx]
      const v = await generateOneVariant({
        apiKey: kieApiKey,
        originalImageUrl: resolvedImageUrl,
        recipe,
        avatarDescription: avatarDesc,
        mode: 'flex-outfit',
      })
      if (v) {
        setExtraAngles((prev) => {
          const next = [...prev]
          next[idx] = v
          return next
        })
      } else {
        addToast(`Tạo lại góc #${idx + 1} thất bại`, 'error')
      }
    } catch (err) {
      addToast(`Lỗi: ${err instanceof Error ? err.message.slice(0, 80) : 'unknown'}`, 'error')
    } finally {
      setRegenIdx(null)
    }
  }

  // Save the full preset: main image + 3 angles → 1 Model with variants
  const handleSavePreset = async () => {
    if (!result || !presetName.trim()) return
    setIsSavingPreset(true)
    try {
      const validVariants = extraAngles.filter((v): v is AvatarVariant => v !== null)
      await addModel({
        characterImage: result.imageUrl,
        name: presetName.trim(),
        notes: validVariants.length > 0 ? `Preset ${validVariants.length + 1} góc mặt` : '',
        jsonProfile: result.jsonPrompt as unknown as Record<string, unknown>,
        source: 'character-studio',
        variants: validVariants.length > 0 ? validVariants : undefined,
      })
      setSaved(true)
      addToast(`✓ Đã lưu preset "${presetName.trim()}" (${validVariants.length + 1} ảnh) vào Project`)
    } catch (err) {
      addToast(`Lưu thất bại: ${err instanceof Error ? err.message.slice(0, 80) : 'unknown'}`, 'error')
    } finally {
      setIsSavingPreset(false)
    }
  }

  const hasExtras = extraAngles.length > 0
  const allExtrasReady = hasExtras && extraAngles.every((v) => v !== null)

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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {/* ── Main image + 3 angle thumbnails (2x2 when extras present) ── */}
        {hasExtras ? (
          // 2x2 grid: main top-left + 3 angles
          <div className="grid grid-cols-2 gap-2">
            {/* Main (top-left) */}
            <div className="group relative aspect-[9/16] overflow-hidden rounded-xl border-2 border-sky-300 bg-black">
              <img src={resolvedImageUrl} alt="Main" className="h-full w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded bg-sky-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">CHÍNH</span>
            </div>
            {/* 3 angle slots */}
            {extraAngles.map((variant, idx) => (
              <AngleSlot
                key={idx}
                variant={variant}
                label={EXTRA_3_RECIPES[idx].angleType}
                isRegenerating={regenIdx === idx || (isGeneratingExtras && variant === null)}
                onRegen={() => handleRegenAngle(idx)}
              />
            ))}
          </div>
        ) : (
          // Single image full-size before extras
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
        )}

        {/* ── Actions ── */}
        <div className="mt-3 flex flex-col gap-2">
          {/* Collapsible JSON (compact) */}
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

          {/* Step 1: Generate 3 extra angles (only if not yet started) */}
          {!hasExtras && (
            <button
              onClick={handleGenerateExtras}
              disabled={isGeneratingExtras || !kieApiKey}
              title={!kieApiKey ? 'Cần KIE.ai API key trong Cài đặt' : 'Tạo 3 góc mặt cùng người qua KIE GPT Image 2'}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-violet-300 bg-violet-50 px-6 py-3.5 text-[13px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              ✨ Tạo 3 góc mặt thêm (cùng người, đa góc nhìn) {!kieApiKey && '— cần KIE key'}
            </button>
          )}

          {/* Progress bar while gen extras */}
          {isGeneratingExtras && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-violet-700">Đang tạo góc: {extraProgress.label}</span>
                <span className="font-bold tabular-nums text-violet-700">{extraProgress.done}/{extraProgress.total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-violet-100">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${(extraProgress.done / Math.max(extraProgress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Save preset (all 4) — visible after extras are generated */}
          {hasExtras && !isGeneratingExtras && (
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="text-xs font-semibold text-emerald-700">
                💾 Lưu preset {allExtrasReady ? '4' : `${1 + extraAngles.filter(Boolean).length}`} ảnh vào Project
              </p>
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && presetName.trim()) handleSavePreset() }}
                placeholder='Đặt tên preset, vd: "Sarah hijab - bếp"'
                disabled={saved}
                className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-emerald-500 disabled:opacity-60"
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim() || isSavingPreset || saved}
                className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-[13px] font-bold transition-colors ${saved
                  ? 'bg-green-500/15 text-green-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400'
                }`}
              >
                {saved ? (
                  <><Check className="h-4 w-4" /> Đã lưu vào Project</>
                ) : isSavingPreset ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
                ) : (
                  <><Save className="h-4 w-4" /> Lưu preset (cả {1 + extraAngles.filter(Boolean).length} ảnh)</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomControls />
    </div>
  )
}

// ── 3-angle slot thumbnail ────────────────────────────────────────────────
function AngleSlot({
  variant, label, isRegenerating, onRegen,
}: {
  variant: AvatarVariant | null
  label: string
  isRegenerating: boolean
  onRegen: () => void
}) {
  const url = useAssetUrl(variant?.imageUrl)
  return (
    <div className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-violet-200 bg-gray-100">
      {isRegenerating ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : variant && url ? (
        <>
          <img src={url} alt={label} className="h-full w-full object-cover" />
          <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {label}
          </span>
          <button
            onClick={onRegen}
            title={`Tạo lại góc ${label}`}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-violet-600 group-hover:opacity-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
          <X className="h-5 w-5" />
          <span className="text-[10px]">Lỗi — </span>
          <button
            onClick={onRegen}
            className="rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-700"
          >
            Tạo lại
          </button>
        </div>
      )}
    </div>
  )
}
