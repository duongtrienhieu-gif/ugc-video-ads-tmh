import { useState, useEffect, useRef } from 'react'
import { Mic } from 'lucide-react'
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
import AppHeader from '../../components/shell/AppHeader'
import SegmentTabs from '../../components/shell/SegmentTabs'
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

  // Mobile: 3 panes → a [Cài đặt · Soạn · Lịch sử] segmented (one at a time).
  // Auto-jump to "Lịch sử" when a new clip lands so the user hears the result.
  const [mobileTab, setMobileTab] = useState<'controls' | 'editor' | 'history'>('editor')
  const prevHistoryLenRef = useRef(history.length)
  useEffect(() => {
    if (history.length > prevHistoryLenRef.current) setMobileTab('history')
    prevHistoryLenRef.current = history.length
  }, [history.length])

  return (
    <div className="flex h-full flex-col bg-app-base">
      <AppHeader
        icon={Mic}
        eyebrow="VOICE STUDIO · TTS"
        title="Giọng đọc"
        subtitle="Voice Việt + clone · ElevenLabs"
        actions={<AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />}
      />

      {/* Mobile segmented — replaces the floating FAB */}
      <div className="shrink-0 border-b border-app-border px-3 py-2 lg:hidden">
        <SegmentTabs
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'controls', label: 'Cài đặt' },
            { value: 'editor', label: 'Soạn' },
            { value: 'history', label: 'Lịch sử', badge: history.length },
          ]}
        />
      </div>

      <div className="flex min-h-0 w-full flex-1 overflow-hidden lg:flex-row">
      {/* Left sidebar — controls */}
      <div className={`${mobileTab === 'controls' ? 'flex' : 'hidden'} w-full min-h-0 shrink-0 flex-col bg-app-surface lg:flex lg:w-[300px] lg:border-r lg:border-app-border`}>
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
      <div className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden lg:flex`}>
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
      <div className={`${mobileTab === 'history' ? 'flex' : 'hidden'} w-full min-h-0 shrink-0 flex-col bg-app-surface lg:flex lg:w-[440px] lg:border-l lg:border-app-border`}>
        <HistoryPanel
          items={history}
          onDelete={handleDeleteHistoryItem}
        />
      </div>
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
    </div>
  )
}
