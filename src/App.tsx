import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import { useAppStore } from './stores/appStore'
import { supabase } from './lib/supabase'
import { useAuthStore } from './stores/authStore'
import { useBankStore } from './stores/bankStore'
import { useLandingPageStore } from './apps/landing-page/store'
import { useSuperLadipageStore } from './apps/super-ladipage/store'
import { useAdTemplateStore } from './stores/adTemplateStore'
import { useLabContentStore } from './apps/lab-content/store'
import { useAdsContentStore } from './apps/ads-content/store'
import { useLipSyncStore } from './stores/lipSyncStore'
import { useVideoTranslateStore } from './stores/videoTranslateStore'
import { useBrandKitStore } from './stores/brandKitStore'
import { useTikTokShopListingsStore } from './apps/tiktok-shop/listingsStore'
import { useChatBotStore } from './apps/chat-bot/store'
import AuthScreen from './components/AuthScreen'
import RestoreSessionModal from './components/RestoreSessionModal'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSettingsStore } from './stores/settingsStore'
import { getKieCredits } from './utils/kieai'
import { directGeminiVision } from './utils/gemini'

import Finder from './apps/finder/Finder'
import AdAnatomy from './apps/ad-anatomy/AdAnatomy'
import ScriptArchitect from './apps/script-architect/ScriptArchitect'
import AdsContent from './apps/ads-content/AdsContent'
import LabContent from './apps/lab-content/LabContent'
import LandingPageAI from './apps/landing-page/LandingPageAI'
import SuperLadipage from './apps/super-ladipage/SuperLadipage'
import History from './apps/history/History'
import CharacterStudio from './apps/character-studio/CharacterStudio'
import VoiceStudio from './apps/voice-studio/VoiceStudio'
import CreativeStudio from './apps/creative-studio/CreativeStudio'
import ImageDna from './apps/image-dna/ImageDna'
import VideoTranslate from './apps/video-translate/VideoTranslate'
import VideoBuilder from './apps/video-builder/VideoBuilder'
import TimSourceVideo from './apps/tim-source-video/TimSourceVideo'
import StudioBrandKit from './apps/studio-brand-kit/StudioBrandKit'
import TikTokShop from './apps/tiktok-shop/TikTokShop'
import Research from './apps/research/Research'
import ChatBot from './apps/chat-bot/ChatBot'

const APP_COMPONENTS: Record<string, React.ComponentType> = {
  'finder': Finder,
  'ad-anatomy': AdAnatomy,
  'script-architect': ScriptArchitect,
  'ads-content': AdsContent,
  'lab-content': LabContent,
  'landing-page': LandingPageAI,
  'super-ladipage': SuperLadipage,
  'history': History,
  'character-studio': CharacterStudio,
  'voice-studio': VoiceStudio,
  // P10 canonical id (broll-studio kept below as alias so saved
  // openApp() targets / inter-app sendTo links from before P10 still
  // resolve to the same component).
  'creative-studio': CreativeStudio,
  'broll-studio':    CreativeStudio,
  'image-dna': ImageDna,
  'video-translate': VideoTranslate,
  'video-builder': VideoBuilder,
  'tim-source-video': TimSourceVideo,
  'studio-brand-kit': StudioBrandKit,
  'tiktok-shop': TikTokShop,
  'research': Research,
  'chat-bot': ChatBot,
}

/** VN label + cache keys used by the per-app ErrorBoundary fallback so the
 *  user can wipe stale localStorage and reload when an app crashes.
 *  Cache key list mirrors the keys each app reads on mount. */
const APP_BOUNDARY_META: Record<string, { name: string; resetKeys: string[] }> = {
  'finder':            { name: 'Finder',         resetKeys: [] },
  'ad-anatomy':        { name: 'Phân tích QC',   resetKeys: ['ugc-ad-anatomy-cache'] },
  'script-architect':  { name: 'Script Architect', resetKeys: [] },
  'ads-content':       { name: 'Ads Content',    resetKeys: [] },
  'lab-content':       { name: 'Lab Content',    resetKeys: [] },
  'landing-page':      { name: 'Landing Page AI', resetKeys: [] },
  'super-ladipage':    { name: 'Super Ladipage',  resetKeys: [] },
  'history':           { name: 'Lịch sử',        resetKeys: [] },
  'character-studio':  { name: 'Character Studio', resetKeys: [] },
  'voice-studio':      { name: 'Voice Studio',   resetKeys: [] },
  'creative-studio':   { name: 'Creative Studio', resetKeys: [] },
  'broll-studio':      { name: 'Creative Studio', resetKeys: [] },  // alias
  'image-dna':         { name: 'Image DNA',      resetKeys: [] },
  'video-translate':   { name: 'Dịch Video',     resetKeys: [] },
  'video-builder':     { name: 'UGC Builder',    resetKeys: [] },
  'tim-source-video':  { name: 'Tìm Source Video', resetKeys: [] },
  'studio-brand-kit':  { name: 'Studio Brand Kit', resetKeys: ['ugc-lab:brand-kits'] },
  'tiktok-shop':       { name: 'TikTok Shop',      resetKeys: [] },
  'research':          { name: 'Research',         resetKeys: [] },
  'chat-bot':          { name: 'Chat Bot',         resetKeys: ['chat-bot-configs-v1'] },
}

export default function App() {
  const activeApp = useAppStore((s) => s.activeApp)
  const runningApps = useAppStore((s) => s.runningApps)
  const openApp = useAppStore((s) => s.openApp)
  const { user, loading, setUser, setLoading } = useAuthStore()
  const loadAll = useBankStore((s) => s.loadAll)
  const { kieApiKey, geminiApiKey, kieCredits, setKieCredits, theme } = useSettingsStore()

  // ── Theme: apply `data-theme="dark"` to <html> when user has opted in.
  // Only 2 modes: 'light' (default — attribute removed) / 'dark' (attribute
  // set). Existing users see no change until they toggle in Settings.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
    }
  }, [theme])
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
    // On login, hydrate all per-user persistent state from Supabase:
    //   • bank data (products / models / scripts / voices / brolls)
    //   • Landing Page AI saved projects (landing_projects)
    //   • Super Ladipage saved projects (landing_projects, kind discriminator)
    //   • Ad Win Templates / Lab Content / Ads Content / Lip Sync history /
    //     Video Translate history (all in user_outputs, kind discriminator)
    //
    // Every hydrate() call falls back to localStorage cache if the
    // Supabase fetch fails (table missing / network down / RLS) — the
    // app keeps working with the data already on this device.
    const onLogin = () => {
      loadAll()
      void useLandingPageStore.getState().hydrate()
      void useSuperLadipageStore.getState().hydrate()
      void useAdTemplateStore.getState().hydrate()
      void useLabContentStore.getState().hydrate()
      void useAdsContentStore.getState().hydrate()
      void useLipSyncStore.getState().hydrate()
      void useVideoTranslateStore.getState().hydrate()
      void useBrandKitStore.getState().hydrate()
      void useTikTokShopListingsStore.getState().hydrate()
      void useChatBotStore.getState().hydrate()
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) onLogin()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) onLogin()
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
        {/* API badges top-right.
            Mobile (<768px): compact icon-only pills — hides "Gemini" word,
            hides "Credit" suffix, drops the refresh button (status still
            updates automatically on key change / refresh icon stays as
            visual indicator). Saves ~50% horizontal space on phones.
            Desktop (md+): full original layout unchanged. */}
        <div className="absolute right-2 top-2 md:right-4 md:top-3 z-50 flex items-center gap-1.5 md:gap-2">
          {/* Gemini badge — same preservation pattern as KIE: inner
              refresh button only on desktop; mobile uses a full-pill
              tap overlay so the smaller compact pill stays tappable. */}
          {geminiApiKey && (
            <div className="relative flex items-center gap-1 md:gap-1.5 rounded-full border border-emerald-200 bg-white px-1.5 py-1 md:px-3 md:py-1.5 shadow-sm">
              {checkingGemini ? (
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
              ) : geminiOk === true ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : geminiOk === false ? (
                <AlertCircle className="h-3 w-3 text-red-400" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-emerald-300" />
              )}
              <span className="hidden md:inline text-xs font-semibold text-emerald-600">Gemini</span>
              <span className="md:hidden text-[10px] font-bold text-emerald-600">G</span>
              <button
                onClick={handleCheckGemini}
                title="Kiểm tra Gemini key"
                className="hidden md:inline-flex rounded-full p-0.5 text-emerald-400 transition-colors hover:text-emerald-600"
              >
                <RefreshCw className={`h-3 w-3 ${checkingGemini ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleCheckGemini}
                aria-label="Kiểm tra Gemini key"
                title="Kiểm tra Gemini key"
                className="md:hidden absolute inset-0 rounded-full"
              />
            </div>
          )}

          {/* KIE badge — preserves the ORIGINAL desktop semantics
              (outer div is non-clickable, inner refresh button handles
              the action). On mobile the inner refresh icon is hidden
              and a `md:hidden` button overlay is mounted instead so the
              whole compact pill is tappable. */}
          {kieApiKey && (
            <div className="relative flex items-center gap-1 md:gap-1.5 rounded-full border border-indigo-200 bg-white px-1.5 py-1 md:px-3 md:py-1.5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-400">KIE</span>
              <span className="text-[11px] md:text-xs font-semibold tabular-nums text-indigo-600">
                {kieCredits !== null
                  ? (kieCredits % 1 === 0 ? kieCredits.toLocaleString('vi-VN') : kieCredits.toFixed(2))
                  : '--'}
                <span className="hidden md:inline"> Credit</span>
              </span>
              <button
                onClick={handleRefreshKie}
                title="Làm mới KIE credits"
                className="hidden md:inline-flex rounded-full p-0.5 text-indigo-400 transition-colors hover:text-indigo-600"
              >
                <RefreshCw className={`h-3 w-3 ${refreshingKie ? 'animate-spin' : ''}`} />
              </button>
              {/* Mobile-only full-pill tap target — replaces the hidden
                  inner refresh button on small screens so users can still
                  refresh credits with a single tap. */}
              <button
                onClick={handleRefreshKie}
                aria-label="Làm mới KIE credits"
                title="Làm mới KIE credits"
                className="md:hidden absolute inset-0 rounded-full"
              />
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
                {Component ? (
                  <ErrorBoundary
                    appName={APP_BOUNDARY_META[appId]?.name ?? appId}
                    resetKeys={APP_BOUNDARY_META[appId]?.resetKeys ?? []}
                  >
                    <Component />
                  </ErrorBoundary>
                ) : null}
              </div>
            </div>
          )
        })}
      </main>
      <ToastContainer />
      <RestoreSessionModal />
    </div>
  )
}
