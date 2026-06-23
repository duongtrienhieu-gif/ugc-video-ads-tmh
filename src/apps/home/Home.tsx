import { useState } from 'react'
import { ArrowRight, Play, BadgeCheck, Sparkles } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { BRAND } from '../../config/brand'
import { APP_GROUPS, ALL_APPS, TINT_CLASSES, type AppMeta } from '../../config/apps'
import { EyebrowLabel, CornerFrame, HotBadge, GoldButton } from '../../components/cinematic'

const FILTERS = ['Tất cả', ...APP_GROUPS.map((g) => g.label)]

export default function Home() {
  const openApp = useAppStore((s) => s.openApp)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const [filter, setFilter] = useState('Tất cả')

  function go(item: AppMeta) {
    if (item.action === 'products') {
      sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
    } else {
      openApp(item.id)
    }
  }

  const visible =
    filter === 'Tất cả'
      ? ALL_APPS
      : (APP_GROUPS.find((g) => g.label === filter)?.items ?? ALL_APPS)

  return (
    <div className="min-h-full bg-app-base">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative border-b border-app-border px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:px-10">
        {/* eyebrow row */}
        <div className="mb-5 flex items-center justify-between sm:mb-7">
          <EyebrowLabel rec>REC · {BRAND.name} STUDIO · 2026</EyebrowLabel>
          <EyebrowLabel className="hidden sm:inline-flex">
            <span style={{ color: 'var(--color-accent)' }}># AUTOPILOT</span>
          </EyebrowLabel>
        </div>

        <div className="flex items-center gap-6 lg:gap-10">
          {/* copy */}
          <div className="min-w-0 flex-1">
            <p className="mb-3 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.26em]" style={{ color: 'var(--color-accent)' }}>
              Mở khóa kỷ nguyên UGC
            </p>
            <h1 className="text-[27px] font-bold leading-[1.05] tracking-tight text-app-text sm:text-4xl lg:text-[52px]">
              Sản xuất video bán hàng
              <br />
              <span className="italic" style={{ color: 'var(--color-accent)' }}>không cần quay phim</span>
            </h1>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-app-muted sm:mt-4 sm:text-sm">
              {BRAND.pitch}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6">
              <GoldButton onClick={() => openApp('character-studio')}>
                <Sparkles className="h-4 w-4" /> Bắt đầu tạo
              </GoldButton>
              <GoldButton variant="outline" onClick={() => openApp('video-builder')}>
                <Play className="h-4 w-4" /> Xem demo
              </GoldButton>
            </div>
          </div>

          {/* framed visual — md+ only (keeps mobile lean) */}
          <CornerFrame className="hidden aspect-[4/3] w-[230px] shrink-0 overflow-hidden border border-app-border md:block lg:w-[300px]" radius="rounded-2xl">
            <div
              className="flex h-full w-full items-end justify-center"
              style={{ background: 'linear-gradient(135deg, var(--color-card-elevated), var(--color-accent-dim))' }}
            >
              <span
                className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold tracking-wider"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
              >
                <BadgeCheck className="h-3 w-3" /> VERIFIED ID
              </span>
              <Sparkles className="mb-10 h-20 w-20 text-app-faint" strokeWidth={1} />
            </div>
          </CornerFrame>
        </div>
      </section>

      {/* ── TOOLS ────────────────────────────────────────────────────── */}
      <section className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
          <h2 className="text-base font-bold text-app-text sm:text-lg">Công cụ của bạn</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const on = filter === f
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors sm:text-xs ${
                    on ? '' : 'text-app-muted hover:text-app-text'
                  }`}
                  style={on ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast)' } : undefined}
                >
                  {f}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {visible.map((item) => {
            const Icon = item.icon
            const tint = TINT_CLASSES[item.tint]
            return (
              <button
                key={item.id}
                onClick={() => go(item)}
                className="group relative flex flex-col rounded-xl border border-app-border bg-app-card p-3.5 text-left transition-all hover:border-app-border-strong hover:bg-app-card-elevated sm:p-4"
              >
                {item.hot && <HotBadge className="absolute right-2.5 top-2.5" />}
                <span className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${tint.chip}`}>
                  <Icon className={`h-[18px] w-[18px] sm:h-5 sm:w-5 ${tint.icon}`} strokeWidth={2} />
                </span>
                <span className="text-[13px] font-bold text-app-text sm:text-sm">{item.label}</span>
                <span className="mt-0.5 text-[11px] text-app-subtle">{item.desc}</span>
                <ArrowRight className="mt-2 h-3.5 w-3.5 text-app-faint transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--color-accent)' }} />
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
