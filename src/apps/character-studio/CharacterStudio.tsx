import { useState, useEffect, useRef } from 'react'
import { User, MapPin, Move, Camera, X, Sliders } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import type { CharacterProfile, TabId } from './types'
import { createEmptyProfile, TABS } from './types'
import ControlsPanel from './components/ControlsPanel'
import OutputPanel from './components/OutputPanel'
import CloneStudio from './components/CloneStudio'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'
import { generateCharacter } from './services/generateCharacter'
import type { GenerationResult } from './services/generateCharacter'
import { useSettingsStore } from '../../stores/settingsStore'
import type { ImageResolution } from '../../utils/kieai'

// Snapshot — survives F5. Reference image (File + blobURL) is NOT persistable;
// user re-uploads after restore if they want auto-fill again. The rest (profile
// + generated result + active tab) is preserved.
interface CharacterStudioSnapshot {
  profile: CharacterProfile
  result: GenerationResult | null
  activeTab: TabId
}

const TAB_ICONS: Record<TabId, React.ElementType> = {
  physical: User,
  scene: MapPin,
  pose: Move,
  camera: Camera,
}

export default function CharacterStudio() {
  const [profile, setProfile] = useState<CharacterProfile>(createEmptyProfile)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('physical')
  const [mode, setMode] = useState<'random' | 'clone'>('random')
  const cancelledRef = useRef(false)

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload = useAppStore((s) => s.consumePayload)
  const activeApp = useAppStore((s) => s.activeApp)
  const addToast = useAppStore((s) => s.addToast)

  const kieApiKey = useSettingsStore((s) => s.kieApiKey)

  // ── Session persistence (R4) ───────────────────────────────────────────
  // Count filled profile fields to drive the progress text in the restore modal.
  const profileFilled = Object.values(profile).filter((v) => v && v.trim() !== '').length
  const profileTotal = TABS.reduce((sum, t) => sum + t.fields.length, 0)

  const sessionApi = useSessionPersist<CharacterStudioSnapshot>({
    moduleId: 'character-studio',
    version: 1,
    snapshot: () => ({ profile, result, activeTab }),
    hydrate: (data) => {
      if (data.profile) setProfile(data.profile)
      if (data.result) setResult(data.result)
      if (data.activeTab) setActiveTab(data.activeTab)
      addToast('✓ Đã khôi phục Avatar AI từ phiên trước', 'success')
    },
    getStatus: () => (isGenerating ? 'in-progress' : result || profileFilled > 0 ? 'paused' : 'completed'),
    getProgressVi: () => {
      if (result) return 'Đã sinh ảnh — sẵn sàng lưu vào Project'
      if (isGenerating) return 'Đang tạo ảnh avatar...'
      if (profileFilled > 0) return `${profileFilled}/${profileTotal} trường đã điền`
      return undefined
    },
    shouldPersist: () => profileFilled > 0 || !!result || isGenerating,
    deps: [profile, result, activeTab, isGenerating],
  })

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

  const handleGenerate = async (modelId: string, resolution: ImageResolution) => {
    if (!kieApiKey.trim()) {
      addToast('Vui lòng nhập kie.ai API key trong Cài đặt', 'error')
      return
    }
    cancelledRef.current = false
    setIsGenerating(true)
    try {
      const gen = await generateCharacter(profile, modelId, resolution)
      if (!cancelledRef.current) {
        setResult(gen)
        sessionApi.forceSave()
      }
    } catch (err) {
      if (cancelledRef.current) return
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'INSUFFICIENT_CREDITS') addToast('Không đủ Credit kie.ai', 'error')
      else if (msg === 'TIMEOUT') addToast('Tạo ảnh quá thời gian. Vui lòng thử lại.', 'error')
      else addToast(`Tạo ảnh thất bại: ${msg}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCancel = () => {
    cancelledRef.current = true
    setIsGenerating(false)
  }

  const tabCompletion = (tabId: TabId) => {
    const tab = TABS.find((t) => t.id === tabId)!
    const filled = tab.fields.filter((f) => (profile[f.key] ?? '').trim() !== '').length
    return { filled, total: tab.fields.length }
  }

  // Mobile output-first (M5): once a character has been generated, hide the
  // controls panel (long form across multiple tabs) so the output preview
  // owns the viewport. FAB toggles controls back open for re-tweaks.
  const [mobileControlsVisible, setMobileControlsVisible] = useState(true)
  const prevResultRef = useRef<GenerationResult | null>(null)
  useEffect(() => {
    if (!prevResultRef.current && result) setMobileControlsVisible(false)
    prevResultRef.current = result
  }, [result])
  const showControlsOnMobile = !result || mobileControlsVisible

  return (
    <div className="flex h-full flex-col relative">
      {/* Auto-save chip — top right, above everything */}
      <div className="absolute right-4 top-3 z-30">
        <AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />
      </div>

      {/* ── Mode toggle: Random (attribute-driven) vs Clone (keep uploaded face) ── */}
      <div className="shrink-0 border-b border-black/8 px-4 pt-3">
        <div className="inline-flex rounded-xl border border-black/10 bg-black/[0.02] p-0.5">
          <button
            onClick={() => setMode('random')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${mode === 'random' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Tạo Avatar Random
          </button>
          <button
            onClick={() => setMode('clone')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${mode === 'clone' ? 'bg-violet-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Tạo Avatar Clone
          </button>
        </div>
      </div>

      {/* Clone mode — kept MOUNTED (CSS-hidden when inactive) so an in-flight
          generation survives switching to Random mode and back. */}
      <div className={`min-h-0 flex-1 flex-col ${mode === 'clone' ? 'flex' : 'hidden'}`}>
        <CloneStudio />
      </div>

      {/* Random mode — also kept mounted; only one is visible at a time. */}
      <div className={`min-h-0 flex-1 flex-col ${mode === 'random' ? 'flex' : 'hidden'}`}>
      {/* ── Main 3-column layout ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Side tabs — hidden on mobile alongside controls (tabs are useless without the form) */}
        <div className={`${showControlsOnMobile ? 'flex' : 'hidden'} lg:flex lg:w-44 shrink-0 flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible border-b lg:border-b-0 lg:border-r border-black/8 bg-black/[0.02] px-2 py-2 lg:py-3`}>
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

        {/* Controls panel — hidden on mobile after first generation */}
        <div className={`${showControlsOnMobile ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/2 shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-black/8`}>
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
            onCancel={handleCancel}
            canGenerate={Object.values(profile).some((v) => v.trim() !== '') && kieApiKey.trim() !== ''}
            aspectRatio={profile.aspectRatio || 'Portrait (9:16)'}
            onAspectRatioChange={(v) => setProfile((prev) => ({ ...prev, aspectRatio: v }))}
          />
        </div>
      </div>
      {result && (
        <button
          onClick={() => setMobileControlsVisible((v) => !v)}
          aria-label={showControlsOnMobile ? 'Đóng tuỳ chỉnh' : 'Mở tuỳ chỉnh'}
          title={showControlsOnMobile ? 'Đóng tuỳ chỉnh' : 'Mở tuỳ chỉnh'}
          className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-3 text-[12px] font-bold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-700 active:scale-95 transition-transform"
        >
          {showControlsOnMobile
            ? <><X className="h-4 w-4" /> Đóng</>
            : <><Sliders className="h-4 w-4" /> Tuỳ chỉnh</>}
        </button>
      )}
      </div>
    </div>
  )
}
