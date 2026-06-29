// ─────────────────────────────────────────────────────────────────────
// App catalog — ONE source of truth shared by the TopNav dropdowns and
// the Home tool grid. Grouped into the 3 menus the user approved:
//   • Sáng tạo  (create assets)
//   • Bán hàng  (sell / convert)
//   • Thư viện  (library / data)
//
// `id` matches the route keys in App.tsx APP_COMPONENTS. The special
// 'products-shortcut' is NOT a route — it opens Finder on the products
// bank (handled by the shell), so it carries `action: 'products'`.
// ─────────────────────────────────────────────────────────────────────
import {
  Bot, User, Mic, PenLine, Sparkles, Images,
  Megaphone, ShoppingBag, Rocket, MessageCircle, TrendingUp,
  Palette, Package, History as HistoryIcon, LayoutGrid, Radar, Warehouse, Target,
} from 'lucide-react'

export interface AppMeta {
  /** Route id (App.tsx) OR a synthetic id for shortcut actions. */
  id: string
  /** Short label shown in nav + card title. */
  label: string
  /** One-line description shown under the card title on Home. */
  desc: string
  icon: React.ElementType
  /** Accent tint family for the card icon chip (Tailwind hue name). */
  tint: 'gold' | 'violet' | 'sky' | 'rose' | 'emerald' | 'pink' | 'indigo' | 'amber'
  /** Show the red HOT badge. */
  hot?: boolean
  /** Non-route shortcut behaviour handled by the shell. */
  action?: 'products'
}

export interface AppGroup {
  /** Menu / section title. */
  label: string
  items: AppMeta[]
}

export const APP_GROUPS: AppGroup[] = [
  {
    label: 'Sáng tạo',
    items: [
      { id: 'mkt-agent',        label: 'MKT Agent',      desc: 'Tự tìm SP → content → Drive', icon: Bot, tint: 'gold', hot: true },
      { id: 'character-studio', label: 'Avatar AI',      desc: 'Tạo KOL ảo',          icon: User,     tint: 'gold',    hot: true },
      { id: 'voice-studio',     label: 'Giọng đọc',      desc: 'Voice Việt + clone',  icon: Mic,      tint: 'violet' },
      { id: 'script-architect', label: 'Kịch bản',       desc: 'Script Architect',    icon: PenLine,  tint: 'sky' },
      { id: 'video-builder',    label: 'Xưởng Video AI', desc: 'Storyboard 4K',       icon: Sparkles, tint: 'gold',    hot: true },
      { id: 'image-studio',     label: 'Xưởng Ảnh',      desc: 'Gift · Form · Rebrand', icon: Images, tint: 'pink' },
    ],
  },
  {
    label: 'Bán hàng',
    items: [
      { id: 'ads-content',    label: 'Ads Content',    desc: 'Content quảng cáo',   icon: Megaphone,     tint: 'amber' },
      { id: 'tiktok-shop',    label: 'TikTok Shop',    desc: '9 ảnh listing',       icon: ShoppingBag,   tint: 'rose',    hot: true },
      { id: 'super-ladipage', label: 'Super Ladipage', desc: 'Landing AI',          icon: Rocket,        tint: 'emerald' },
      { id: 'chat-bot',       label: 'Chat Bot',       desc: 'Chốt đơn tự động',    icon: MessageCircle, tint: 'indigo' },
      { id: 'research',       label: 'Research',       desc: 'Phân tích thị trường', icon: TrendingUp,   tint: 'sky' },
      { id: 'spy-ads',        label: 'Spy Ads',        desc: 'QC video đối thủ (FB)', icon: Radar,       tint: 'rose',    hot: true },
    ],
  },
  {
    label: 'Thư viện',
    items: [
      { id: 'war-room',          label: 'Tác Chiến',  desc: 'Giao việc · target NV', icon: Target, tint: 'gold', hot: true },
      { id: 'inventory-board',   label: 'Kho & Nhập hàng', desc: 'Tồn · đề xuất nhập', icon: Warehouse, tint: 'amber' },
      { id: 'studio-brand-kit',  label: 'Brand Kit', desc: 'Bộ nhận diện',     icon: Palette,     tint: 'violet' },
      { id: 'products-shortcut', label: 'Sản phẩm',  desc: 'Kho sản phẩm',     icon: Package,     tint: 'emerald', action: 'products' },
      { id: 'finder',            label: 'Dự án',     desc: 'Project Finder',   icon: LayoutGrid,  tint: 'sky' },
      { id: 'history',           label: 'Lịch sử',   desc: 'Bản đã tạo',       icon: HistoryIcon, tint: 'amber' },
    ],
  },
]

/** Flat list of every catalog item (Home grid renders this). */
export const ALL_APPS: AppMeta[] = APP_GROUPS.flatMap((g) => g.items)

/** Tailwind classes for each tint — icon chip bg + icon color. Works in
 *  light AND dark/studio because they use /15 alpha fills + 400-shade icons. */
export const TINT_CLASSES: Record<AppMeta['tint'], { chip: string; icon: string }> = {
  gold:    { chip: 'bg-[var(--color-accent-dim)]',   icon: 'text-[var(--color-accent)]' },
  violet:  { chip: 'bg-violet-500/15',  icon: 'text-violet-400' },
  sky:     { chip: 'bg-sky-500/15',     icon: 'text-sky-400' },
  rose:    { chip: 'bg-rose-500/15',    icon: 'text-rose-400' },
  emerald: { chip: 'bg-emerald-500/15', icon: 'text-emerald-400' },
  pink:    { chip: 'bg-pink-500/15',    icon: 'text-pink-400' },
  indigo:  { chip: 'bg-indigo-500/15',  icon: 'text-indigo-400' },
  amber:   { chip: 'bg-amber-500/15',   icon: 'text-amber-400' },
}
