import { useState, useEffect, useRef } from 'react'
import {
  Gem, Home, ChevronDown, Menu, X, Sun, Moon, Sparkles, Zap,
  Settings, Activity, FolderOpen, LogOut, RefreshCw, CheckCircle2, AlertCircle,
} from 'lucide-react'
import SettingsModal from './SettingsModal'
import Diagnostic from './Diagnostic'
import DraftsPanel from './DraftsPanel'
import { HotBadge } from './cinematic'
import { BRAND } from '../config/brand'
import { APP_GROUPS, type AppMeta } from '../config/apps'
import { useSettingsStore, type ThemePreference } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { getKieCredits } from '../utils/kieai'
import { directGeminiVision } from '../utils/gemini'
import { scanForPendingSessions } from '../services/sessionPersistence'

interface TopNavProps {
  activeApp: string | null
  onNavigate: (appId: string) => void
}

// Theme cycle: light → dark → studio → light
const THEME_ORDER: ThemePreference[] = ['light', 'dark', 'studio']
const THEME_META: Record<ThemePreference, { icon: React.ElementType; label: string }> = {
  light:  { icon: Sun,      label: 'Sáng' },
  dark:   { icon: Moon,     label: 'Tối' },
  studio: { icon: Sparkles, label: 'Studio' },
}

export default function TopNav({ activeApp, onNavigate }: TopNavProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [diagnosticOpen, setDiagnosticOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [draftsCount, setDraftsCount] = useState(0)
  const navRef = useRef<HTMLDivElement>(null)

  const { kieApiKey, kieCredits, setKieCredits, geminiApiKey, theme, setTheme } = useSettingsStore()
  const sendToApp = useAppStore((s) => s.sendToApp)
  const { user, signOut } = useAuthStore()

  const [refreshing, setRefreshing] = useState(false)
  const [geminiOk, setGeminiOk] = useState<boolean | null>(null)
  const [checkingGemini, setCheckingGemini] = useState(false)

  // Drafts badge poll (same cadence as the old sidebar)
  useEffect(() => {
    const update = () => setDraftsCount(scanForPendingSessions().length)
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [])

  // Auto-fetch credits on mount if key exists
  useEffect(() => {
    if (kieApiKey && kieCredits === null) {
      getKieCredits(kieApiKey).then(setKieCredits).catch(() => {})
    }
  }, [kieApiKey, kieCredits, setKieCredits])

  // Gemini key health check
  useEffect(() => {
    if (!geminiApiKey) { setGeminiOk(null); return }
    setGeminiOk(null)
    setCheckingGemini(true)
    directGeminiVision({ apiKey: geminiApiKey, parts: [{ text: 'Reply with the single word: ok' }] })
      .then(() => setGeminiOk(true))
      .catch(() => setGeminiOk(false))
      .finally(() => setCheckingGemini(false))
  }, [geminiApiKey])

  // Close any open desktop dropdown on outside-click / Esc
  useEffect(() => {
    if (!openMenu) return
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  async function handleRefreshKie() {
    if (!kieApiKey || refreshing) return
    setRefreshing(true)
    try { setKieCredits(await getKieCredits(kieApiKey)) } catch { /* silent */ } finally { setRefreshing(false) }
  }

  function go(item: AppMeta) {
    if (item.action === 'products') {
      sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
    } else {
      onNavigate(item.id)
    }
    setOpenMenu(null)
    setMobileOpen(false)
  }

  function cycleTheme() {
    const i = THEME_ORDER.indexOf(theme)
    setTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length])
  }

  const ThemeIcon = THEME_META[theme].icon
  const creditsText = kieCredits !== null
    ? (kieCredits % 1 === 0 ? kieCredits.toLocaleString('vi-VN') : kieCredits.toFixed(2))
    : '--'

  const isActive = (id: string) => activeApp === id

  return (
    <>
      {/* pt-[env(safe-area-inset-top)] — đẩy header xuống dưới notch/Dynamic
          Island khi chạy PWA standalone trên iPhone (viewport-fit=cover làm
          nội dung tràn lên dưới status bar). bg-app-surface lấp luôn vùng đó. */}
      <header className="relative z-40 shrink-0 border-b border-app-border bg-app-surface pt-[env(safe-area-inset-top)]">
        <div className="flex h-12 items-center justify-between gap-2 px-3 sm:h-14 sm:px-4 lg:px-6" ref={navRef}>
          {/* ── Left: logo + desktop nav ───────────────────────────── */}
          <div className="flex min-w-0 items-center gap-3 lg:gap-7">
            <button onClick={() => onNavigate('home')} className="flex shrink-0 items-center gap-2 sm:gap-2.5" title={BRAND.company}>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <Gem className="h-[18px] w-[18px] sm:h-5 sm:w-5" style={{ color: 'var(--color-accent-contrast)' }} strokeWidth={2.25} />
              </span>
              <span className="flex flex-col leading-none">
                {/* TMH GROUP = the identity: accent color + mono stamp font,
                    extra-bold + large + heavy tracking so it dominates. */}
                <span
                  className="font-[var(--font-mono)] text-[17px] tracking-[0.2em] sm:text-2xl"
                  style={{ color: 'var(--color-accent)', fontWeight: 800 }}
                >
                  {BRAND.name}
                </span>
                <span className="mt-1 hidden text-[8px] font-bold tracking-[0.4em] text-app-subtle sm:block">
                  {BRAND.tagline}
                </span>
              </span>
            </button>

            {/* Desktop nav links */}
            <nav className="hidden items-center gap-1 lg:flex">
              <NavLink
                active={isActive('home')}
                onClick={() => onNavigate('home')}
                icon={<Home className="h-4 w-4" />}
                label="Trang chủ"
              />
              {APP_GROUPS.map((group) => {
                const open = openMenu === group.label
                const groupActive = group.items.some((it) => isActive(it.id))
                return (
                  <div key={group.label} className="relative">
                    <button
                      onClick={() => setOpenMenu(open ? null : group.label)}
                      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors hover:bg-app-card ${
                        open || groupActive ? 'text-app-text' : 'text-app-muted'
                      }`}
                      style={open || groupActive ? { color: 'var(--color-accent)' } : undefined}
                    >
                      {group.label}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="absolute left-0 top-full mt-1.5 w-64 overflow-hidden rounded-xl border border-app-border bg-app-card-elevated p-1.5 shadow-xl">
                        {group.items.map((item) => (
                          <DropdownItem key={item.id} item={item} active={isActive(item.id)} onClick={() => go(item)} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>

          {/* ── Right: status + actions ────────────────────────────── */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Gemini health dot — desktop only */}
            {geminiApiKey && (
              <span className="hidden items-center gap-1 rounded-full border border-app-border px-2 py-1 lg:inline-flex">
                {checkingGemini ? <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                  : geminiOk ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  : geminiOk === false ? <AlertCircle className="h-3 w-3 text-red-400" />
                  : <span className="h-2 w-2 rounded-full bg-emerald-300" />}
                <span className="text-[10px] font-bold text-emerald-500">Gemini</span>
              </span>
            )}

            {/* Credits pill — always visible (compact on mobile) */}
            {kieApiKey && (
              <button
                onClick={handleRefreshKie}
                title="Làm mới KIE credits"
                className="flex items-center gap-1.5 rounded-full border border-app-border px-2.5 py-1 sm:px-3 sm:py-1.5"
              >
                <Zap className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                <span className="text-[11px] font-bold tabular-nums sm:text-xs" style={{ color: 'var(--color-accent)' }}>
                  {creditsText}
                </span>
                <RefreshCw className={`hidden h-3 w-3 text-app-subtle sm:inline ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* MUA CREDITS — desktop only (gold CTA) */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold lg:inline-flex"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
            >
              <Zap className="h-3.5 w-3.5" /> MUA CREDITS
            </button>

            {/* Theme cycle */}
            <button
              onClick={cycleTheme}
              title={`Giao diện: ${THEME_META[theme].label} (bấm để đổi)`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-card"
            >
              <ThemeIcon className="h-4 w-4" style={theme === 'studio' ? { color: 'var(--color-accent)' } : undefined} />
            </button>

            {/* Desktop quick actions */}
            <div className="hidden items-center gap-0.5 lg:flex">
              <IconBtn title="Bản nháp" onClick={() => setDraftsOpen(true)} badge={draftsCount}>
                <FolderOpen className="h-4 w-4 text-violet-400" />
              </IconBtn>
              <IconBtn title="Chẩn đoán" onClick={() => setDiagnosticOpen(true)}>
                <Activity className="h-4 w-4 text-amber-400" />
              </IconBtn>
              <IconBtn title="Cài đặt" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4 text-app-muted" />
              </IconBtn>
            </div>

            {/* Avatar / logout — desktop */}
            <button
              onClick={signOut}
              title={`Đăng xuất (${user?.email})`}
              className="hidden h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 lg:flex"
            >
              <span className="text-[11px] font-bold text-white">{user?.email?.[0]?.toUpperCase() ?? 'U'}</span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-app-text hover:bg-app-card lg:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              {!mobileOpen && draftsCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-rec)' }} />
              )}
            </button>
          </div>
        </div>

        {/* ── Mobile drawer — overlay phủ HẾT màn hình từ dưới navbar tới đáy.
            Dùng fixed + inset để bg-app-surface lấp toàn bộ (kể cả vùng home
            indicator) → không còn dải đen lòi dưới nút Đăng xuất. z-30 < header
            navbar (z-40) nên nút X vẫn nổi trên cùng. top = safe-top + chiều
            cao navbar (h-12=3rem mobile). pb chừa home indicator. ── */}
        {mobileOpen && (
          <div className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+3rem)] z-30 overflow-y-auto border-t border-app-border bg-app-surface px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 lg:hidden">
            <button
              onClick={() => { onNavigate('home'); setMobileOpen(false) }}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-bold ${
                isActive('home') ? 'bg-app-card' : ''
              }`}
              style={isActive('home') ? { color: 'var(--color-accent)' } : undefined}
            >
              <Home className="h-[18px] w-[18px]" /> Trang chủ
            </button>
            {APP_GROUPS.map((group) => (
              <div key={group.label} className="py-1">
                <p className="px-3 py-1.5 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-app-subtle">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => go(item)}
                        className={`relative flex items-center gap-2 rounded-lg border border-app-border px-3 py-3 text-left ${
                          isActive(item.id) ? 'bg-app-card' : ''
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0 text-app-muted" />
                        <span className="truncate text-[13px] font-bold text-app-text">{item.label}</span>
                        {item.hot && <HotBadge className="absolute right-1.5 top-1.5" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {/* Mobile action row */}
            <div className="mt-2 flex items-center gap-2 border-t border-app-border pt-3">
              <button onClick={() => { setDraftsOpen(true); setMobileOpen(false) }} className="relative flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-violet-400">
                <FolderOpen className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-bold">Bản nháp</span>
                {draftsCount > 0 && <span className="absolute right-3 top-1 h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-rec)' }} />}
              </button>
              <button onClick={() => { setDiagnosticOpen(true); setMobileOpen(false) }} className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-amber-400">
                <Activity className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-bold">Chẩn đoán</span>
              </button>
              <button onClick={() => { setSettingsOpen(true); setMobileOpen(false) }} className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-app-muted">
                <Settings className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-bold">Cài đặt</span>
              </button>
              <button onClick={signOut} className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-red-400">
                <LogOut className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-bold">Đăng xuất</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Diagnostic isOpen={diagnosticOpen} onClose={() => setDiagnosticOpen(false)} />
      <DraftsPanel open={draftsOpen} onClose={() => setDraftsOpen(false)} />
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function NavLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors hover:bg-app-card ${active ? '' : 'text-app-muted'}`}
      style={active ? { color: 'var(--color-accent)' } : undefined}
    >
      {icon}{label}
    </button>
  )
}

function DropdownItem({ item, active, onClick }: { item: AppMeta; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-app-card ${active ? 'bg-app-card' : ''}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-card-elevated">
        <Icon className="h-[18px] w-[18px] text-app-muted" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-app-text">{item.label}</span>
          {item.hot && <HotBadge />}
        </span>
        <span className="block truncate text-[11px] text-app-subtle">{item.desc}</span>
      </span>
    </button>
  )
}

function IconBtn({ title, onClick, children, badge = 0 }: { title: string; onClick: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <button onClick={onClick} title={title} className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-app-card">
      {children}
      {badge > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold text-white" style={{ backgroundColor: 'var(--color-rec)' }}>
          {badge}
        </span>
      )}
    </button>
  )
}
