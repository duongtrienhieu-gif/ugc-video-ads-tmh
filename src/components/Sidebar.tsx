import { useState, useEffect } from 'react'
import { LayoutGrid, User, PenLine, Mic, Image, Video, Eye, Settings, FlaskConical, RefreshCw, LogOut } from 'lucide-react'
import SettingsModal from './SettingsModal'
import { useSettingsStore } from '../stores/settingsStore'
import { getKieCredits } from '../utils/kieai'
import { useAuthStore } from '../stores/authStore'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { id: 'finder', label: 'Project', icon: LayoutGrid },
  { id: 'character-studio', label: 'Nhân vật', icon: User },
  { id: 'script-architect', label: 'Kịch bản', icon: PenLine },
  { id: 'voice-studio', label: 'Giọng đọc', icon: Mic },
  { id: 'broll-studio', label: 'Ảnh B-Roll', icon: Image },
  { id: 'broll-videos', label: 'Video B-Roll', icon: Video },
  { id: 'ad-anatomy', label: 'Phân tích QC', icon: Eye },
]

interface SidebarProps {
  activeApp: string | null
  onNavigate: (appId: string) => void
}

export default function Sidebar({ activeApp, onNavigate }: SidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { kieApiKey, kieCredits, setKieCredits } = useSettingsStore()
  const [refreshing, setRefreshing] = useState(false)
  const { user, signOut } = useAuthStore()

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
      <aside className="flex h-full w-16 shrink-0 flex-col border-r border-black/10 bg-[#FAFAFA] shadow-[1px_0_0_0_rgba(0,0,0,0.04)]">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.05]">
            <FlaskConical className="h-4 w-4 text-gray-600" strokeWidth={1.5} />
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto px-1.5 pb-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeApp === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-black/5 ${
                  isActive ? 'bg-black/5' : ''
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${isActive ? 'text-gray-900' : 'text-gray-500'}`}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span
                  className={`w-full text-center text-[9px] leading-tight transition-colors ${
                    isActive ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Bottom: Credits + Settings + Avatar */}
        <div className="flex shrink-0 flex-col items-center gap-1 px-1.5 pb-4">
          {/* Credits badge */}
          {kieApiKey && (
            <button
              onClick={handleRefreshCredits}
              title="Làm mới credits"
              className="flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors hover:bg-black/5"
            >
              <div className="flex items-center gap-0.5">
                <RefreshCw className={`h-2.5 w-2.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
              </div>
              {kieCredits !== null ? (
                <span className="w-full text-center text-[8px] font-semibold leading-tight text-indigo-500 tabular-nums">
                  {kieCredits % 1 === 0
                    ? kieCredits.toLocaleString('vi-VN')
                    : kieCredits.toFixed(2)} Credit
                </span>
              ) : (
                <span className="text-[8px] text-gray-400">-- Credit</span>
              )}
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-black/5"
          >
            <Settings className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
            <span className="text-[9px] leading-tight text-gray-500">Cài đặt</span>
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
    </>
  )
}
