import type { VideoStatus } from '../../utils/kieai'

export interface LipSyncHistoryItem {
  id: string
  // Persistent Supabase refs (survive page reload)
  imageAssetId: string | null
  audioAssetId: string | null
  videoAssetId: string | null
  // Transient display URLs (regenerated from assetId on load)
  imageUrl: string
  audioUrl: string
  videoUrl: string | null
  scriptText: string
  voiceName: string
  modelName: string
  status: VideoStatus
  errorMessage?: string
  taskId: string
  createdAt: number
}
