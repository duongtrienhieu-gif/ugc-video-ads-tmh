import { useState, useEffect } from 'react'
import { LayoutGrid, User, PenLine, Mic, Image, Eye, Settings, FlaskConical, RefreshCw, LogOut, Activity, Languages, Sparkles, Package, Megaphone, FolderOpen, Brain, Rocket, Search, History as HistoryIcon, Palette } from 'lucide-react'
import SettingsModal from './SettingsModal'
import Diagnostic from './Diagnostic'
import DraftsPanel from './DraftsPanel'
import { useSettingsStore } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'
import { getKieCredits } from '../utils/kieai'
import { useAuthStore } from '../stores/authStore'
import { scanForPendingSessions } from '../services/sessionPersistence'
import { useSuperLadipageStore } from '../apps/super-ladipage/store'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { id: 'finder', label: 'Project', icon: LayoutGrid },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'products-shortcut', label: 'Sản phẩm', icon: Package },
  { id: 'studio-brand-kit', label: 'Brand Kit', icon: Palette },
  { id: 'character-studio', label: 'Avatar AI', icon: User },
  { id: 'script-architect', label: 'Kịch bản', icon: PenLine },
  { id: 'ads-content',      label: 'Ads Content', icon: Megaphone },
  { id: 'tim-source-video', label: 'Tìm Source Video', icon: Search },
  { id: 'lab-content',      label: 'Lab Content', icon: Brain },
  // 2026-05-20 — 'landing-page' entry hidden from sidebar so employees
  // only see Super Ladipage (the newer rewrite with cleaner identity
  // lock + recipe-based prompt assembly). Landing Page code + route in
  // App.tsx kept intact for backward compat / direct-URL access if
  // needed. Re-add this entry to restore the menu item.
  // { id: 'landing-page',     label: 'Landing Page', icon: LayoutTemplate },
  { id: 'super-ladipage',   label: 'Super Ladipage', icon: Rocket },
  { id: 'voice-studio', label: 'Giọng đọc', icon: Mic },
  { id: 'creative-studio', label: 'Creative Studio', icon: Image },
  { id: 'video-translate', label: 'Dịch Video',   icon: Languages },
  { id: 'video-builder',   label: 'UGC Builder',  icon: Sparkles },
  { id: 'ad-anatomy',      label: 'Phân tích QC', icon: Eye },
]

interface SidebarProps {
  activeApp: string | null
  onNavigate: (appId: string) => void
}

export default function Sidebar({ activeApp, onNavigate }: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [diagnosticOpen, setDiagnosticOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [draftsCount, setDraftsCount] = useState(0)
  const { kieApiKey, kieCredits, setKieCredits } = useSettingsStore()
  const [refreshing, setRefreshing] = useState(false)
  const { user, signOut } = useAuthStore()
  const sendToApp = useAppStore((s) => s.sendToApp)
  const superLadipageCount = useSuperLadipageStore((s) => s.items.length)

  // Poll for drafts count every 10s to update the badge dot
  useEffect(() => {
    const updateCount = () => setDraftsCount(scanForPendingSessions().length)
    updateCount()
    const id = setInterval(updateCount, 10000)
    return () => clearInterval(id)
  }, [])

  // "Sản phẩm" shortcut → open Finder + auto-select products bank
  const handleNav = (id: string) => {
    if (id === 'products-shortcut') {
      sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
      return
    }
    onNavigate(id)
  }

  // Auto-fetch credits on mount if key exists
  useEffect(() => {
    if (kieApiKey && kieCredits === null) {
      getKieCredits(kieApiKey)
        .then((c) => setKieCredits(c))
        .catch(() => {})
    }
  }, [kieApiKey, kieCredits, setKieCredits])

  async function handleRefreshCredits() {
    if (!kieApiKey || refreshing) return
    setRefreshing(true)
    try {
      const c = await getKieCredits(kieApiKey)
      setKieCredits(c)
    } catch {
      // silent
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <aside className="flex h-full w-[56px] md:w-[72px] shrink-0 flex-col border-r border-black/10 bg-[#FAFAFA] shadow-[1px_0_0_0_rgba(0,0,0,0.04)]">
        {/* Logo */}
        <div className="flex h-12 md:h-16 shrink-0 items-center justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.05]">
            <FlaskConical className="h-4 w-4 text-gray-600" strokeWidth={1.5} />
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto px-1 md:px-1.5 pb-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            // 'products-shortcut' lights up when finder shows products bank — but for simplicity
            // we just always show it as inactive (it's a shortcut, not a route)
            const isActive = id !== 'products-shortcut' && activeApp === id
            // Show project count badge on Super Ladipage nav (Canva-style)
            const badge =
              id === 'super-ladipage' && superLadipageCount > 0 ? superLadipageCount : null
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                title={label}
                className={`relative flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-black/5 ${
                  isActive ? 'bg-black/5' : ''
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] transition-colors ${isActive ? 'text-gray-900' : 'text-gray-500'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {badge !== null && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm">
                    {badge}
                  </span>
                )}
                <span
                  className={`hidden md:block w-full text-center text-[10px] font-bold leading-tight tracking-tight transition-colors ${
                    isActive ? 'text-gray-900' : 'text-gray-600'
                  }`}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Bottom: Credits + Settings + Avatar */}
        <div className="flex shrink-0 flex-col items-center gap-1 px-1 md:px-1.5 pb-4">
          {/* Credits badge — hidden on mobile (moved to compact top-right badge area) */}
          {kieApiKey && (
            <button
              onClick={handleRefreshCredits}
              title={kieCredits !== null
                ? `${kieCredits.toLocaleString('vi-VN')} Credit · click để làm mới`
                : 'Làm mới credits'}
              className="hidden md:flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors hover:bg-black/5"
            >
              <div className="flex items-center gap-0.5">
                <RefreshCw className={`h-2.5 w-2.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
              </div>
              {kieCredits !== null ? (
                <span className="w-full text-center text-[9px] font-bold leading-tight text-indigo-500 tabular-nums">
                  {kieCredits % 1 === 0
                    ? kieCredits.toLocaleString('vi-VN')
                    : kieCredits.toFixed(2)} Credit
                </span>
              ) : (
                <span className="text-[9px] font-bold text-gray-400">-- Credit</span>
              )}
            </button>
          )}

          <button
            onClick={() => setDraftsOpen(true)}
            title="Bản nháp chưa hoàn thành"
            className="relative flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-violet-500/10"
          >
            <FolderOpen className="h-[18px] w-[18px] text-violet-500" strokeWidth={2} />
            {draftsCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white shadow-sm">
                {draftsCount}
              </span>
            )}
            <span className="hidden md:block text-[10px] font-bold leading-tight text-violet-500">Bản nháp</span>
          </button>

          <button
            onClick={() => setDiagnosticOpen(true)}
            title="Chẩn đoán dữ liệu"
            className="flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-amber-500/10"
          >
            <Activity className="h-[18px] w-[18px] text-amber-500" strokeWidth={2} />
            <span className="hidden md:block text-[10px] font-bold leading-tight text-amber-500">Chẩn đoán</span>
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            title="Cài đặt"
            className="flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-black/5"
          >
            <Settings className="h-[18px] w-[18px] text-gray-500" strokeWidth={2} />
            <span className="hidden md:block text-[10px] font-bold leading-tight text-gray-600">Cài đặt</span>
          </button>

          {/* User info + logout */}
          <div className="flex w-full flex-col items-center gap-1">
            <button
              onClick={signOut}
              title={`Đăng xuất (${user?.email})`}
              className="flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors hover:bg-red-500/10"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500">
                <span className="text-[10px] font-semibold text-white">
                  {user?.email?.[0]?.toUpperCase() ?? 'U'}
                </span>
              </div>
              <LogOut className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        </div>
      </aside>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Diagnostic isOpen={diagnosticOpen} onClose={() => setDiagnosticOpen(false)} />
      <DraftsPanel open={draftsOpen} onClose={() => setDraftsOpen(false)} />
    </>
  )
}
