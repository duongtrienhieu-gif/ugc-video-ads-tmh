import { useEffect } from 'react'
import TopNav from './components/TopNav'
import ToastContainer from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import { useAppStore } from './stores/appStore'
import { supabase } from './lib/supabase'
import { useAuthStore } from './stores/authStore'
import { useBankStore } from './stores/bankStore'
import { useLandingPageStore } from './apps/landing-page/store'
import { useSuperLadipageStore } from './apps/super-ladipage/store'
import { useAdTemplateStore } from './stores/adTemplateStore'
import { useAdsContentStore } from './apps/ads-content/store'
import { useLipSyncStore } from './stores/lipSyncStore'
import { useVideoTranslateStore } from './stores/videoTranslateStore'
import { useBrandKitStore } from './stores/brandKitStore'
import { useTikTokShopListingsStore } from './apps/tiktok-shop/listingsStore'
import { useChatBotStore } from './apps/chat-bot/store'
import AuthScreen from './components/AuthScreen'
import RestoreSessionModal from './components/RestoreSessionModal'
import { useSettingsStore } from './stores/settingsStore'

import Home from './apps/home/Home'
import Finder from './apps/finder/Finder'
import AdAnatomy from './apps/ad-anatomy/AdAnatomy'
import ScriptArchitect from './apps/script-architect/ScriptArchitect'
import AdsContent from './apps/ads-content/AdsContent'
import LandingPageAI from './apps/landing-page/LandingPageAI'
import SuperLadipage from './apps/super-ladipage/SuperLadipage'
import History from './apps/history/History'
import CharacterStudio from './apps/character-studio/CharacterStudio'
import VoiceStudio from './apps/voice-studio/VoiceStudio'
import CreativeStudio from './apps/creative-studio/CreativeStudio'
import ImageDna from './apps/image-dna/ImageDna'
import VideoTranslate from './apps/video-translate/VideoTranslate'
import VideoBuilder from './apps/video-builder/VideoBuilder'
import StudioBrandKit from './apps/studio-brand-kit/StudioBrandKit'
import TikTokShop from './apps/tiktok-shop/TikTokShop'
import Research from './apps/research/Research'
import SpyAds from './apps/spy-ads/SpyAds'
import ChatBot from './apps/chat-bot/ChatBot'
import ImageStudio from './apps/image-studio/ImageStudio'
import InventoryBoard from './apps/inventory-board/InventoryBoard'

const APP_COMPONENTS: Record<string, React.ComponentType> = {
  'home': Home,
  'finder': Finder,
  'ad-anatomy': AdAnatomy,
  'script-architect': ScriptArchitect,
  'ads-content': AdsContent,
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
  'studio-brand-kit': StudioBrandKit,
  'tiktok-shop': TikTokShop,
  'research': Research,
  'spy-ads': SpyAds,
  'chat-bot': ChatBot,
  'image-studio': ImageStudio,
  'inventory-board': InventoryBoard,
}

/** VN label + cache keys used by the per-app ErrorBoundary fallback so the
 *  user can wipe stale localStorage and reload when an app crashes.
 *  Cache key list mirrors the keys each app reads on mount. */
const APP_BOUNDARY_META: Record<string, { name: string; resetKeys: string[] }> = {
  'home':              { name: 'Trang chủ',      resetKeys: [] },
  'finder':            { name: 'Finder',         resetKeys: [] },
  'ad-anatomy':        { name: 'Phân tích QC',   resetKeys: ['ugc-ad-anatomy-cache'] },
  'script-architect':  { name: 'Script Architect', resetKeys: [] },
  'ads-content':       { name: 'Ads Content',    resetKeys: [] },
  'landing-page':      { name: 'Landing Page AI', resetKeys: [] },
  'super-ladipage':    { name: 'Super Ladipage',  resetKeys: [] },
  'history':           { name: 'Lịch sử',        resetKeys: [] },
  'character-studio':  { name: 'Character Studio', resetKeys: [] },
  'voice-studio':      { name: 'Voice Studio',   resetKeys: [] },
  'creative-studio':   { name: 'Creative Studio', resetKeys: [] },
  'broll-studio':      { name: 'Creative Studio', resetKeys: [] },  // alias
  'image-dna':         { name: 'Image DNA',      resetKeys: [] },
  'video-translate':   { name: 'Dịch Video',     resetKeys: [] },
  'video-builder':     { name: 'Xưởng Video AI', resetKeys: [] },
  'studio-brand-kit':  { name: 'Studio Brand Kit', resetKeys: ['ugc-lab:brand-kits'] },
  'tiktok-shop':       { name: 'TikTok Shop',      resetKeys: [] },
  'research':          { name: 'Research',         resetKeys: [] },
  'spy-ads':           { name: 'Spy Ads',          resetKeys: [] },
  'chat-bot':          { name: 'Chat Bot',         resetKeys: ['chat-bot-configs-v1'] },
  'image-studio':      { name: 'Xưởng Ảnh',        resetKeys: ['gift-studio-draft-v1', 'form-bg-studio-draft-v1', 'rebrand-studio-draft-v1', 'image-studio-mode-v1'] },
  'inventory-board':   { name: 'Kho & Nhập hàng',  resetKeys: ['inv_board_sources'] },
}

export default function App() {
  const activeApp = useAppStore((s) => s.activeApp)
  const runningApps = useAppStore((s) => s.runningApps)
  const openApp = useAppStore((s) => s.openApp)
  const { user, loading, setUser, setLoading } = useAuthStore()
  const loadAll = useBankStore((s) => s.loadAll)
  const { theme } = useSettingsStore()

  // ── Theme: 3 modes.
  //   'light'  → no attributes (default, unchanged)
  //   'dark'   → data-theme="dark"            (neutral Linear/Notion dark)
  //   'studio' → data-theme="dark" + data-accent="studio"  (AUREA gold skin)
  // 'studio' intentionally REUSES data-theme="dark" so every existing
  // dark-mode compatibility override in index.css applies to the 14 inner
  // apps; data-accent="studio" only re-skins the shell (deeper navy + gold).
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark' || theme === 'studio') {
      root.setAttribute('data-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
    }
    if (theme === 'studio') {
      root.setAttribute('data-accent', 'studio')
    } else {
      root.removeAttribute('data-accent')
    }
  }, [theme])

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
    openApp('home')
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
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-app-base text-app-text antialiased pb-[env(safe-area-inset-bottom)]">
      <TopNav activeApp={activeApp} onNavigate={openApp} />
      <main className="relative flex-1 overflow-hidden bg-app-card shadow-sm">
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
