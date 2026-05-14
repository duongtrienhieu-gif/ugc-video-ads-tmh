import { useState, useEffect, useRef, useCallback } from 'react'
import { User, MapPin, Move, Camera, Upload, X, Loader2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import type { CharacterProfile, TabId } from './types'
import { createEmptyProfile, TABS } from './types'
import ControlsPanel from './components/ControlsPanel'
import OutputPanel from './components/OutputPanel'
import { generateCharacter } from './services/generateCharacter'
import type { GenerationResult } from './services/generateCharacter'
import { geminiAnalyzeImage, fileToBase64 } from '../../utils/gemini'
import { useSettingsStore } from '../../stores/settingsStore'
import type { ImageResolution } from '../../utils/kieai'

const TAB_ICONS: Record<TabId, React.ElementType> = {
  physical: User,
  scene: MapPin,
  pose: Move,
  camera: Camera,
}

const AUTO_FILL_PROMPT = `Analyze this person's image and extract visual character parameters for UGC content creation.
Return ONLY a flat JSON object with the fields you can clearly identify. Skip fields you cannot determine.
Use these exact field names:

gender, age, ethnicity, bodyType, skinTone, skinTexture, eyeColor, eyeShape, hairColor, hairStyle, hairTexture, facialFeatures, facialHair, distinguishingMarks, clothingStyle, accessories, makeup, expression

Use natural English descriptions. No nested objects. Example:
{"gender":"Female","age":"25-30","hairColor":"Brunette","clothingStyle":"Casual athleisure"}`

export default function CharacterStudio() {
  const [profile, setProfile] = useState<CharacterProfile>(createEmptyProfile)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('physical')

  const [refImage, setRefImage] = useState<{ file: File; preview: string } | null>(null)
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false)
  const [refDragOver, setRefDragOver] = useState(false)
  const refInputRef = useRef<HTMLInputElement>(null)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload = useAppStore((s) => s.consumePayload)
  const activeApp = useAppStore((s) => s.activeApp)
  const addToast = useAppStore((s) => s.addToast)

  const kieApiKey = useSettingsStore((s) => s.kieApiKey)

  useEffect(() => {
    if (activeApp !== 'character-studio') return
    if (!interAppPayload || interAppPayload.targetApp !== 'character-studio') return

    const { targetField, data } = interAppPayload
    if (targetField === 'profile' && typeof data === 'object' && data !== null) {
      const incoming = data as Record<string, string>
      const newProfile = createEmptyProfile()
      for (const [key, value] of Object.entries(incoming)) {
        if (key in newProfile && typeof value === 'string') {
          newProfile[key] = value
        }
      }
      setProfile(newProfile)
    }
    consumePayload()
  }, [interAppPayload, activeApp, consumePayload])

  const handleSetRefImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) return
    const preview = URL.createObjectURL(file)
    setRefImage({ file, preview })
    analyzeRefImage(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const analyzeRefImage = async (file: File) => {
    setIsAnalyzingRef(true)
    try {
      const apiKey = useSettingsStore.getState().getApiKey()
      const { base64, mimeType } = await fileToBase64(file)
      const responseText = await geminiAnalyzeImage(apiKey, AUTO_FILL_PROMPT, base64, mimeType)
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const extracted = JSON.parse(cleaned) as Record<string, string>
      setProfile((prev) => {
        const next = { ...prev }
        for (const [key, value] of Object.entries(extracted)) {
          if (typeof value === 'string' && value.trim()) {
            next[key] = value.trim()
          }
        }
        return next
      })
    } catch {
      // Silent fail — user's existing profile is unchanged
    } finally {
      setIsAnalyzingRef(false)
    }
  }

  const clearRefImage = () => {
    if (refImage?.preview) URL.revokeObjectURL(refImage.preview)
    setRefImage(null)
    if (refInputRef.current) refInputRef.current.value = ''
  }

  const handleGenerate = async (modelId: string, resolution: ImageResolution) => {
    if (!kieApiKey.trim()) {
      addToast('Vui lòng nhập kie.ai API key trong Cài đặt', 'error')
      return
    }
    setIsGenerating(true)
    try {
      const gen = await generateCharacter(profile, modelId, resolution)
      setResult(gen)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'INSUFFICIENT_CREDITS') addToast('Không đủ Credit kie.ai', 'error')
      else if (msg === 'TIMEOUT') addToast('Tạo ảnh quá thời gian. Vui lòng thử lại.', 'error')
      else addToast('Tạo ảnh thất bại. Vui lòng thử lại.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const tabCompletion = (tabId: TabId) => {
    const tab = TABS.find((t) => t.id === tabId)!
    const filled = tab.fields.filter((f) => (profile[f.key] ?? '').trim() !== '').length
    return { filled, total: tab.fields.length }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Auto-fill banner ── */}
      <div className="shrink-0 border-b border-black/8 px-4 py-3">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-gray-400">
          Tự động điền từ ảnh tham chiếu
        </p>

        {refImage ? (
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-black/10">
              <img src={refImage.preview} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-1 items-center gap-2">
              {isAnalyzingRef ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                  <span className="text-xs text-gray-500">Đang phân tích ảnh...</span>
                </>
              ) : (
                <span className="text-xs text-gray-500">Đã điền thông số từ ảnh tham chiếu</span>
              )}
            </div>
            <button
              onClick={clearRefImage}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => refInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setRefDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleSetRefImage(f) }}
            onDragOver={(e) => { e.preventDefault(); setRefDragOver(true) }}
            onDragLeave={() => setRefDragOver(false)}
            className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-all ${refDragOver ? 'border-sky-500/40 bg-sky-500/5' : 'border-black/10 bg-black/[0.02] hover:border-black/15 hover:bg-black/[0.03]'}`}
          >
            <Upload className={`h-4 w-4 shrink-0 transition-colors ${refDragOver ? 'text-sky-400' : 'text-gray-400'}`} />
            <span className="text-xs text-gray-400">
              Thả ảnh tham chiếu vào đây để tự động điền thông số — JPG, PNG, WebP — tối đa 10MB hoặc nhấn để duyệt
            </span>
          </button>
        )}

        <input
          ref={refInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSetRefImage(f) }}
        />
      </div>

      {/* ── Main 3-column layout ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Side tabs */}
        <div className="flex lg:w-44 shrink-0 flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible border-b lg:border-b-0 lg:border-r border-black/8 bg-black/[0.02] px-2 py-2 lg:py-3">
          {TABS.map((tab) => {
            const Icon = TAB_ICONS[tab.id]
            const isActive = activeTab === tab.id
            const { filled, total } = tabCompletion(tab.id)
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors ${isActive
                  ? 'bg-sky-500/15 text-sky-400'
                  : 'text-gray-500 hover:bg-black/[0.04] hover:text-gray-700'
                  }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{tab.label}</span>
                <span className={`ml-auto text-[10px] tabular-nums ${isActive ? 'text-sky-400/60' : 'text-gray-300'}`}>
                  {filled}/{total}
                </span>
              </button>
            )
          })}
        </div>

        {/* Controls panel */}
        <div className="flex w-full lg:w-1/2 shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-black/8">
          <ControlsPanel
            profile={profile}
            onProfileChange={setProfile}
            activeTab={activeTab}
          />
        </div>

        {/* Output panel */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden min-h-[300px] lg:min-h-0">
          <OutputPanel
            result={result}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            canGenerate={Object.values(profile).some((v) => v.trim() !== '') && kieApiKey.trim() !== ''}
            aspectRatio={profile.aspectRatio || 'Portrait (9:16)'}
            onAspectRatioChange={(v) => setProfile((prev) => ({ ...prev, aspectRatio: v }))}
          />
        </div>
      </div>
    </div>
  )
}
