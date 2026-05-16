import {
  FolderOpen,
  UserRound,
  ScanSearch,
  Clapperboard,
  PenLine,
  Mic,
  Film,
  Video,
  Package,
  FileText,
  Megaphone,
  LayoutTemplate,
  History as HistoryIcon,
} from 'lucide-react'
import type { ElementType } from 'react'

export interface AppConfig {
  id: string
  name: string
  icon: ElementType
  accent: string
}

export const APP_REGISTRY: AppConfig[] = [
  { id: 'finder', name: 'Trình Duyệt', icon: FolderOpen, accent: '#a1a1aa' },
  { id: 'character-studio', name: 'Studio Avatar AI', icon: UserRound, accent: '#0ea5e9' },
  { id: 'image-dna', name: 'DNA Ảnh', icon: ScanSearch, accent: '#22c55e' },
  { id: 'ad-anatomy', name: 'Phân Tích QC', icon: Clapperboard, accent: '#FB2B37' },
  { id: 'script-architect', name: 'Tạo Kịch bản UGC', icon: PenLine, accent: '#3b82f6' },
  { id: 'ads-content',      name: 'Ads Content',       icon: Megaphone, accent: '#ec4899' },
  { id: 'landing-page',     name: 'Landing Page AI',   icon: LayoutTemplate, accent: '#7c3aed' },
  { id: 'history',          name: 'History',           icon: HistoryIcon, accent: '#8b5cf6' },
  { id: 'voice-studio', name: 'Giọng Đọc', icon: Mic, accent: '#6366f1' },
  { id: 'broll-studio', name: 'Product AI', icon: Film, accent: '#f97316' },
  { id: 'broll-videos', name: 'Video B-Roll', icon: Video, accent: '#8b5cf6' },
]

export const FINDER_APP = APP_REGISTRY[0]
export const DOCK_APPS = APP_REGISTRY

export type BankType = 'products' | 'models' | 'scripts' | 'voices' | 'brolls' | 'adsContent'

export const BANK_CONFIG: Record<BankType, { label: string; icon: ElementType }> = {
  products:   { label: 'Sản phẩm',  icon: Package },
  models:     { label: 'Avatar AI', icon: UserRound },
  scripts:    { label: 'Kịch bản',  icon: FileText },
  voices:     { label: 'Giọng đọc', icon: Mic },
  brolls:     { label: 'Product AI', icon: Film },
  adsContent: { label: 'Ads Content', icon: Megaphone },
}

export function getAppConfig(appId: string): AppConfig | undefined {
  return APP_REGISTRY.find((a) => a.id === appId)
}
