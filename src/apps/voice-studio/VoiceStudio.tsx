import { useState, useEffect, useRef } from 'react'
import { Sliders, X as XIcon } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import type { VoicePreset, Script } from '../../stores/types'
import type { VoiceSettings } from './types'
import { createDefaultSettings } from './types'
import { generateVoice } from './services/generateVoice'
import ControlsSidebar from './components/ControlsSidebar'
import EditorPanel from './components/EditorPanel'
import HistoryPanel from './components/HistoryPanel'
import CloneVoiceModal from './components/CloneVoiceModal'
import VoiceLibraryModal from './components/VoiceLibraryModal'
import BankPicker from '../../components/BankPicker'
import AutoSaveIndicator from '../../components/AutoSaveIndicator'
import { useSessionPersist } from '../../services/sessionPersistence'

interface VoiceStudioSnapshot {
  settings: VoiceSettings
  scriptText: string
}

type PickerMode = 'voices' | 'scripts' | null

export default function VoiceStudio() {
  const [settings, setSettings] = useState<VoiceSettings>(createDefaultSettings)
  const [scriptText, setScriptText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [voicesRefreshKey, setVoicesRefreshKey] = useState(0)
  const [highlightField, setHighlightField] = useState<string | null>(null)

  const history = useBankStore((s) => s.voiceHistory)
  const addVoiceHistory = useBankStore((s) => s.addVoiceHistory)
  const deleteVoiceHistory = useBankStore((s) => s.deleteVoiceHistory)
  const addToast = useAppStore((s) => s.addToast)

  const sessionApi = useSessionPersist<VoiceStudioSnapshot>({
    moduleId: 'voice-studio',
    version: 1,
    snapshot: () => ({ settings, scriptText }),
    hydrate: (data) => {
      if (data.settings) setSettings(data.settings)
      if (typeof data.scriptText === 'string') setScriptText(data.scriptText)
      addToast('✓ Đã khôi phục Giọng đọc từ phiên trước', 'success')
    },
    getStatus: () => (isGenerating ? 'in-progress' : scriptText.trim() ? 'paused' : 'completed'),
    getProgressVi: () => {
      const words = scriptText.trim().split(/\s+/).filter(Boolean).length
      if (isGenerating) return 'Đang gen voice...'
      if (words > 0) return `Đã nhập ${words} từ trong editor`
      return undefined
    },
    getTitleVi: () => settings.voiceName || undefined,
    shouldPersist: () => scriptText.trim().length > 0 || isGenerating,
    deps: [settings, scriptText, isGenerating],
  })

  const interAppPayload = useAppStore((s) => s.interAppPayload)
  const consumePayload = useAppStore((s) => s.consumePayload)
  const activeApp = useAppStore((s) => s.activeApp)

  // Consume inter-app payload (from Script Architect "Send to Voice Studio")
  useEffect(() => {
    if (activeApp !== 'voice-studio') return
    if (!interAppPayload || interAppPayload.targetApp !== 'voice-studio') return

    const { targetField, data } = interAppPayload

    if (targetField === 'scriptText' && typeof data === 'string') {
      setScriptText(data)
      setHighlightField('script')
      setTimeout(() => setHighlightField(null), 800)
    }

    consumePayload()
  }, [interAppPayload, activeApp, consumePayload])

  const handleSettingsChange = (next: VoiceSettings) => {
    setSettings(next)
  }

  const handleStyleChange = (value: string) => {
    setSettings((prev) => ({ ...prev, styleInstructions: value }))
  }

  const handleLoadVoicePreset = (item: unknown) => {
    const preset = item as VoicePreset
    setSettings((prev) => ({
      ...prev,
      // linkedModelId stores the ElevenLabs voice_id when preset comes from history Save
      voiceId: preset.linkedModelId || prev.voiceId,
      voiceName: preset.voiceName,
      gender: preset.gender,
      creativity: preset.creativity,
      ambience: preset.ambience,
      styleInstructions: preset.styleInstructions,
    }))
    setPickerMode(null)
  }

  const handleLoadScript = (item: unknown) => {
    const script = item as Script
    setScriptText(script.scriptText)
    setPickerMode(null)
  }

  const handleGenerate = async () => {
    if (!scriptText.trim()) return
    setIsGenerating(true)
    try {
      const item = await generateVoice(settings, scriptText)
      addVoiceHistory(item)
      addToast('Đã tạo giọng đọc')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast(`Tạo giọng đọc thất bại: ${msg}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteHistoryItem = (id: string) => {
    deleteVoiceHistory(id)
  }

  const handleCloned = (voiceId: string) => {
    // Bump refresh key so sidebar re-fetches voices, auto-selecting the new one
    setVoicesRefreshKey((k) => k + 1)
    // Optimistically select the just-cloned voice
    setSettings((prev) => ({ ...prev, voiceId }))
  }

  // Mobile output-first (M5): on mobile, collapse the left controls panel
  // once the user has generated their first clip (history.length > 0). The
  // editor + history then own the viewport. FAB re-opens controls. Desktop
  // keeps the 3-column layout untouched.
  const [mobileControlsVisible, setMobileControlsVisible] = useState(true)
  const prevHistoryLenRef = useRef(history.length)
  useEffect(() => {
    if (prevHistoryLenRef.current === 0 && history.length > 0) {
      setMobileControlsVisible(false)
    }
    prevHistoryLenRef.current = history.length
  }, [history.length])
  const showControlsOnMobile = history.length === 0 || mobileControlsVisible

  return (
    <div className="flex flex-col lg:flex-row h-full bg-slate-50/50 relative">
      <div className="absolute right-4 top-3 z-30">
        <AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />
      </div>
      {/* Left sidebar — controls */}
      <div className={`${showControlsOnMobile ? 'flex' : 'hidden'} lg:flex w-full lg:w-[300px] shrink-0 flex-col border-b border-slate-200 bg-white lg:border-b-0 lg:border-r`}>
        <ControlsSidebar
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onLoadPreset={() => setPickerMode('voices')}
          onOpenClone={() => setCloneOpen(true)}
          onOpenLibrary={() => setLibraryOpen(true)}
          refreshKey={voicesRefreshKey}
        />
      </div>

      {/* Center — editor */}
      <div className="flex min-h-[420px] lg:min-h-0 flex-1 flex-col overflow-hidden">
        <EditorPanel
          styleInstructions={settings.styleInstructions}
          onStyleChange={handleStyleChange}
          scriptText={scriptText}
          onScriptChange={setScriptText}
          onSelectScript={() => setPickerMode('scripts')}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          canGenerate={scriptText.trim().length > 0 && !!settings.voiceId}
          highlightField={highlightField}
          selectedVoiceName={settings.voiceName}
        />
      </div>

      {/* Right sidebar — history */}
      <div className="flex w-full lg:w-[440px] shrink-0 flex-col border-t border-slate-200 bg-white lg:border-t-0 lg:border-l max-h-[50vh] lg:max-h-none">
        <HistoryPanel
          items={history}
          onDelete={handleDeleteHistoryItem}
        />
      </div>

      {/* Clone Voice Modal */}
      <CloneVoiceModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        onCloned={handleCloned}
      />

      {/* Voice Library Modal */}
      <VoiceLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAdded={handleCloned}
      />

      {/* Bank Pickers */}
      <BankPicker
        bankType="voices"
        isOpen={pickerMode === 'voices'}
        onSelect={handleLoadVoicePreset}
        onClose={() => setPickerMode(null)}
      />
      <BankPicker
        bankType="scripts"
        isOpen={pickerMode === 'scripts'}
        onSelect={handleLoadScript}
        onClose={() => setPickerMode(null)}
      />

      {/* Mobile-only FAB — toggles the left controls panel once user has
          a generation in history. Same UX as landing-page / creative-studio. */}
      {history.length > 0 && (
        <button
          onClick={() => setMobileControlsVisible((v) => !v)}
          aria-label={showControlsOnMobile ? 'Đóng cài đặt giọng' : 'Mở cài đặt giọng'}
          title={showControlsOnMobile ? 'Đóng cài đặt giọng' : 'Mở cài đặt giọng'}
          className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-3 text-[12px] font-bold text-white shadow-lg shadow-violet-900/30 hover:bg-violet-700 active:scale-95 transition-transform"
        >
          {showControlsOnMobile
            ? <><XIcon className="h-4 w-4" /> Đóng</>
            : <><Sliders className="h-4 w-4" /> Cài đặt</>}
        </button>
      )}
    </div>
  )
}
