import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/Toast'
import { useAppStore } from './stores/appStore'
import { supabase } from './lib/supabase'
import { useAuthStore } from './stores/authStore'
import { useBankStore } from './stores/bankStore'
import AuthScreen from './components/AuthScreen'

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
