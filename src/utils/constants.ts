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
  { id: 'character-studio', name: 'Studio Nhân Vật', icon: UserRound, accent: '#0ea5e9' },
  { id: 'image-dna', name: 'DNA Ảnh', icon: ScanSearch, accent: '#22c55e' },
  { id: 'ad-anatomy', name: 'Phân Tích QC', icon: Clapperboard, accent: '#FB2B37' },
  { id: 'script-architect', name: 'Kịch Bản', icon: PenLine, accent: '#3b82f6' },
  { id: 'voice-studio', name: 'Giọng Đọc', icon: Mic, accent: '#6366f1' },
  { id: 'broll-studio', name: 'B-Roll', icon: Film, accent: '#f97316' },
  { id: 'broll-videos', name: 'Video B-Roll', icon: Video, accent: '#8b5cf6' },
]

export const FINDER_APP = APP_REGISTRY[0]
export const DOCK_APPS = APP_REGISTRY

export type BankType = 'products' | 'models' | 'scripts' | 'voices' | 'brolls'

export const BANK_CONFIG: Record<BankType, { label: string; icon: ElementType }> = {
  products: { label: 'Sản phẩm', icon: Package },
  models: { label: 'Nhân vật', icon: UserRound },
  scripts: { label: 'Kịch bản', icon: FileText },
  voices: { label: 'Giọng đọc', icon: Mic },
  brolls: { label: 'B-Roll', icon: Film },
}

export function getAppConfig(appId: string): AppConfig | undefined {
  return APP_REGISTRY.find((a) => a.id === appId)
}
