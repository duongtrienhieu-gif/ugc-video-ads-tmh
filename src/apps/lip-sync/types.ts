import type { VideoStatus } from '../../utils/kieai'

export interface LipSyncHistoryItem {
  id: string
  imageUrl: string       // display URL for thumbnail
  audioUrl: string       // display URL for audio player
  videoUrl: string | null
  scriptText: string
  voiceName: string
  modelName: string
  status: VideoStatus
  errorMessage?: string
  taskId: string
  createdAt: number
}
