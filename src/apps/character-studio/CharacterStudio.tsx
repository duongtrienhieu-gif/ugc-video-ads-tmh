import { useState, useEffect, useRef } from 'react'
import { User, MapPin, Move, Camera } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import type { Model } from '../../stores/types'
import type { CharacterProfile, TabId } from './types'
import { createEmptyProfile, TABS } from './types'
import ControlsPanel from './components/ControlsPanel'
import OutputPanel from './components/OutputPanel'
import CloneStudio from './components/CloneStudio'
import SegmentTabs from '../../components/shell/SegmentTabs'
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
  const [mode, setMode] = useState<'random' | 'clone' | 'library'>('random')
  const cancelledRef = useRef(false)
  const models = useBankStore((s) => s.models)   // avatar đã tạo (Thư viện)

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

  // Mobile flow: [Tùy chỉnh | Kết quả] segmented (replaces the old FAB). When a
  // character lands (null → set) auto-switch to "Kết quả". Desktop shows both.
  const [mobileTab, setMobileTab] = useState<'setup' | 'result'>('setup')
  const prevResultRef = useRef<GenerationResult | null>(null)
  useEffect(() => {
    if (!prevResultRef.current && result) setMobileTab('result')
    prevResultRef.current = result
  }, [result])

  // Đưa 1 avatar từ Thư viện vào studio: nạp làm result (ảnh + JSON) → OutputPanel hiện
  // → có thể tạo thêm góc mặt cùng người, tải, hoặc lưu lại. Reuse luồng Random.
  const loadAvatarFromLibrary = (m: Model) => {
    setResult({ imageUrl: m.characterImage, jsonPrompt: (m.jsonProfile ?? {}) as GenerationResult['jsonPrompt'] })
    setMode('random')
    setMobileTab('result')
    addToast(`✓ Đã đưa "${m.name || 'avatar'}" vào studio — tạo thêm góc mặt / tải / lưu lại`, 'success')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Ô tiêu đề GÓC NHỎ gộp vào hàng chọn mode (thay dải header full-width) —
          nhờ vậy khung tùy chỉnh + output kéo lên sát đỉnh. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-app-border px-4 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--color-accent-dim)' }}>
          <User className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} strokeWidth={2} />
        </span>
        <span className="truncate text-sm font-bold text-app-text">Avatar AI</span>
        {/* ── Mode toggle: Random (attribute-driven) vs Clone (keep uploaded face) ── */}
        <div className="inline-flex rounded-xl border border-app-border bg-app-card p-0.5">
          {([['random', 'Tạo Avatar Random'], ['clone', 'Tạo Avatar Clone'], ['library', 'Thư viện Avatar']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === m ? 'ui-accent-solid shadow' : 'text-app-muted hover:text-app-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <AutoSaveIndicator lastSavedAt={sessionApi.lastSavedAt} lastSaveOk={sessionApi.lastSaveOk} />
        </div>
      </div>

      {/* Clone mode — kept MOUNTED (CSS-hidden when inactive) so an in-flight
          generation survives switching to Random mode and back. */}
      <div className={`min-h-0 flex-1 flex-col ${mode === 'clone' ? 'flex' : 'hidden'}`}>
        <CloneStudio />
      </div>

      {/* Library mode — chọn avatar đã tạo đưa vào studio (thêm góc mặt / tải / lưu lại). */}
      <div className={`min-h-0 flex-1 flex-col ${mode === 'library' ? 'flex' : 'hidden'}`}>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs text-app-muted">
            Chọn 1 avatar đã tạo để đưa vào studio — có thể tạo thêm <b className="text-app-text">góc mặt cùng người</b>, tải ảnh, hoặc lưu lại.
          </p>
          {models.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-app-border text-center text-app-subtle">
              <User className="h-8 w-8" />
              <p className="text-sm">Chưa có avatar nào trong Thư viện.</p>
              <p className="text-xs">Tạo ở tab "Tạo Avatar Random / Clone" rồi lưu vào Project.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {models.map((m) => (
                <AvatarLibraryCard key={m.id} model={m} onPick={() => loadAvatarFromLibrary(m)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Random mode — also kept mounted; only one is visible at a time. */}
      <div className={`min-h-0 flex-1 flex-col ${mode === 'random' ? 'flex' : 'hidden'}`}>
      {/* Mobile segmented — replaces the floating FAB */}
      <div className="shrink-0 border-b border-app-border px-3 py-2 lg:hidden">
        <SegmentTabs
          value={mobileTab}
          onChange={setMobileTab}
          options={[{ value: 'setup', label: 'Tùy chỉnh' }, { value: 'result', label: 'Kết quả' }]}
        />
      </div>
      {/* ── Main 3-column layout — output canvas is the hero (form is a fixed rail) ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Side tabs */}
        <div className={`${mobileTab === 'setup' ? 'flex' : 'hidden'} lg:flex lg:w-44 shrink-0 flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible border-b border-app-border lg:border-b-0 lg:border-r bg-app-surface px-2 py-2 lg:py-3`}>
          {TABS.map((tab) => {
            const Icon = TAB_ICONS[tab.id]
            const isActive = activeTab === tab.id
            const { filled, total } = tabCompletion(tab.id)
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-bold transition-colors ${isActive
                  ? 'ui-accent-soft'
                  : 'text-app-muted hover:bg-app-card hover:text-app-text'
                  }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{tab.label}</span>
                <span className={`ml-auto text-[10px] tabular-nums ${isActive ? 'opacity-70' : 'text-app-faint'}`}>
                  {filled}/{total}
                </span>
              </button>
            )
          })}
        </div>

        {/* Controls panel — split ~half so the form + output stay balanced */}
        <div className={`${mobileTab === 'setup' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/2 shrink-0 flex-col border-b border-app-border lg:border-b-0 lg:border-r`}>
          <ControlsPanel
            profile={profile}
            onProfileChange={setProfile}
            activeTab={activeTab}
          />
        </div>

        {/* Output panel — the hero */}
        <div className={`${mobileTab === 'result' ? 'flex' : 'hidden'} lg:flex min-w-0 flex-1 flex-col overflow-hidden min-h-0`}>
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
      {/* Mobile only: the Generate button lives in the output (Kết quả) tab, so
          give the setup tab a sticky jump CTA — never strand the user on the
          form with no way to reach "Tạo". */}
      {mobileTab === 'setup' && (
        <div className="shrink-0 border-t border-app-border bg-app-surface p-3 lg:hidden">
          <button
            onClick={() => setMobileTab('result')}
            className="ui-accent-solid flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm font-bold"
          >
            Xem &amp; Tạo Avatar AI →
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

// ── Thẻ avatar trong Thư viện — resolve asset:// qua useAssetUrl ──
function AvatarLibraryCard({ model, onPick }: { model: Model; onPick: () => void }) {
  const url = useAssetUrl(model.characterImage)
  const angles = model.variants?.length ?? 0
  return (
    <button
      onClick={onPick}
      className="group flex flex-col overflow-hidden rounded-xl border border-app-border bg-app-card text-left transition-colors hover:border-app-border-strong"
      title="Đưa vào studio"
    >
      <div className="relative aspect-[3/4] bg-app-card-elevated">
        {url
          ? <img src={url} alt={model.name} className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center text-app-faint"><User className="h-8 w-8" /></div>}
        {angles > 0 && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">+{angles} góc</span>
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] font-bold text-app-text">{model.name || '(chưa đặt tên)'}</p>
        <p className="text-[9px] font-medium" style={{ color: 'var(--color-accent)' }}>Đưa vào studio →</p>
      </div>
    </button>
  )
}
