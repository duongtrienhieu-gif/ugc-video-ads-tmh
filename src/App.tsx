import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/Toast'
import { useAppStore } from './stores/appStore'
import { supabase } from './lib/supabase'
import { useAuthStore } from './stores/authStore'
import { useBankStore } from './stores/bankStore'
import AuthScreen from './components/AuthScreen'
import { RefreshCw } from 'lucide-react'
import { useSettingsStore } from './stores/settingsStore'
import { getKieCredits } from './utils/kieai'

import Finder from './apps/finder/Finder'
import AdAnatomy from './apps/ad-anatomy/AdAnatomy'
import ScriptArchitect from './apps/script-architect/ScriptArchitect'
import CharacterStudio from './apps/character-studio/CharacterStudio'
import VoiceStudio from './apps/voice-studio/VoiceStudio'
import BrollStudio from './apps/broll-studio/BrollStudio'
import ImageDna from './apps/image-dna/ImageDna'
import BRollVideos from './apps/broll-videos/BRollVideos'

const APP_COMPONENTS: Record<string, React.ComponentType> = {
  'finder': Finder,
  'ad-anatomy': AdAnatomy,
  'script-architect': ScriptArchitect,
  'character-studio': CharacterStudio,
  'voice-studio': VoiceStudio,
  'broll-studio': BrollStudio,
  'image-dna': ImageDna,
  'broll-videos': BRollVideos,
}

export default function App() {
  const activeApp = useAppStore((s) => s.activeApp)
  const runningApps = useAppStore((s) => s.runningApps)
  const openApp = useAppStore((s) => s.openApp)
  const { user, loading, setUser, setLoading } = useAuthStore()
  const loadAll = useBankStore((s) => s.loadAll)
  const { kieApiKey, kieCredits, setKieCredits } = useSettingsStore()
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefreshCredits() {
    if (!kieApiKey || refreshing) return
    setRefreshing(true)
    try {
      const c = await getKieCredits(kieApiKey)
      setKieCredits(c)
    } catch { /* silent */ } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) loadAll()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadAll()
    })

    return () => subscription.unsubscribe()
  }, [setUser, setLoading, loadAll])

  useEffect(() => {
    openApp('finder')
  }, [openApp])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#EEEEF2]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
      </div>
    )
  }

  if (!user) return <AuthScreen />

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#EEEEF2] text-gray-900 antialiased">
      <Sidebar activeApp={activeApp} onNavigate={openApp} />
      <main className="relative flex-1 overflow-hidden bg-white shadow-sm">
        {/* Credits badge top-right */}
        {kieApiKey && (
          <div className="absolute right-4 top-3 z-50 flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1.5 shadow-sm">
            <span className="text-xs font-semibold tabular-nums text-indigo-600">
              {kieCredits !== null
                ? `${kieCredits % 1 === 0 ? kieCredits.toLocaleString('vi-VN') : kieCredits.toFixed(2)} Credit`
                : '-- Credit'}
            </span>
            <button
              onClick={handleRefreshCredits}
              title="Làm mới credits"
              className="rounded-full p-0.5 text-indigo-400 transition-colors hover:text-indigo-600"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
        {runningApps.map((appId) => {
          const Component = APP_COMPONENTS[appId]
          const isActive = activeApp === appId
          return (
            <div
              key={appId}
              className={`absolute inset-0 transition-opacity duration-200 ease-out ${
                isActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <div className="h-full overflow-y-auto">
                {Component ? <Component /> : null}
              </div>
            </div>
          )
        })}
      </main>
      <ToastContainer />
    </div>
  )
}
