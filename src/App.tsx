import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/Toast'
import { useAppStore } from './stores/appStore'
import { supabase } from './lib/supabase'
import { useAuthStore } from './stores/authStore'
import { useBankStore } from './stores/bankStore'
import AuthScreen from './components/AuthScreen'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSettingsStore } from './stores/settingsStore'
import { getKieCredits } from './utils/kieai'
import { directGeminiVision } from './utils/gemini'

import Finder from './apps/finder/Finder'
import AdAnatomy from './apps/ad-anatomy/AdAnatomy'
import ScriptArchitect from './apps/script-architect/ScriptArchitect'
import AdsContent from './apps/ads-content/AdsContent'
import CharacterStudio from './apps/character-studio/CharacterStudio'
import VoiceStudio from './apps/voice-studio/VoiceStudio'
import BrollStudio from './apps/broll-studio/BrollStudio'
import ImageDna from './apps/image-dna/ImageDna'
import BRollVideos from './apps/broll-videos/BRollVideos'
import VideoTranslate from './apps/video-translate/VideoTranslate'
import VideoBuilder from './apps/video-builder/VideoBuilder'

const APP_COMPONENTS: Record<string, React.ComponentType> = {
  'finder': Finder,
  'ad-anatomy': AdAnatomy,
  'script-architect': ScriptArchitect,
  'ads-content': AdsContent,
  'character-studio': CharacterStudio,
  'voice-studio': VoiceStudio,
  'broll-studio': BrollStudio,
  'image-dna': ImageDna,
  'broll-videos': BRollVideos,
  'video-translate': VideoTranslate,
  'video-builder': VideoBuilder,
}

export default function App() {
  const activeApp = useAppStore((s) => s.activeApp)
  const runningApps = useAppStore((s) => s.runningApps)
  const openApp = useAppStore((s) => s.openApp)
  const { user, loading, setUser, setLoading } = useAuthStore()
  const loadAll = useBankStore((s) => s.loadAll)
  const { kieApiKey, geminiApiKey, kieCredits, setKieCredits } = useSettingsStore()
  const [refreshingKie, setRefreshingKie] = useState(false)
  const [geminiOk, setGeminiOk] = useState<boolean | null>(null)
  const [checkingGemini, setCheckingGemini] = useState(false)

  async function handleRefreshKie() {
    if (!kieApiKey || refreshingKie) return
    setRefreshingKie(true)
    try {
      const c = await getKieCredits(kieApiKey)
      setKieCredits(c)
    } catch { /* silent */ } finally {
      setRefreshingKie(false)
    }
  }

  async function handleCheckGemini() {
    if (!geminiApiKey || checkingGemini) return
    setCheckingGemini(true)
    try {
      await directGeminiVision({
        apiKey: geminiApiKey,
        parts: [{ text: 'Reply with the single word: ok' }],
      })
      setGeminiOk(true)
    } catch {
      setGeminiOk(false)
    } finally {
      setCheckingGemini(false)
    }
  }

  // Auto-check Gemini key when it changes
  useEffect(() => {
    if (geminiApiKey) {
      setGeminiOk(null)
      handleCheckGemini()
    } else {
      setGeminiOk(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geminiApiKey])

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
        {/* API badges top-right */}
        <div className="absolute right-4 top-3 z-50 flex items-center gap-2">
          {/* Gemini badge */}
          {geminiApiKey && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 shadow-sm">
              {checkingGemini ? (
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
              ) : geminiOk === true ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : geminiOk === false ? (
                <AlertCircle className="h-3 w-3 text-red-400" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-emerald-300" />
              )}
              <span className="text-xs font-semibold text-emerald-600">Gemini</span>
              <button
                onClick={handleCheckGemini}
                title="Kiểm tra Gemini key"
                className="rounded-full p-0.5 text-emerald-400 transition-colors hover:text-emerald-600"
              >
                <RefreshCw className={`h-3 w-3 ${checkingGemini ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* KIE badge */}
          {kieApiKey && (
            <div className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-400">KIE</span>
              <span className="text-xs font-semibold tabular-nums text-indigo-600">
                {kieCredits !== null
                  ? `${kieCredits % 1 === 0 ? kieCredits.toLocaleString('vi-VN') : kieCredits.toFixed(2)} Credit`
                  : '-- Credit'}
              </span>
              <button
                onClick={handleRefreshKie}
                title="Làm mới KIE credits"
                className="rounded-full p-0.5 text-indigo-400 transition-colors hover:text-indigo-600"
              >
                <RefreshCw className={`h-3 w-3 ${refreshingKie ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
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
