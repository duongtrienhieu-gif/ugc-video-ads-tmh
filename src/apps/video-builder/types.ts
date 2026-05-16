// ── Video Builder Types ───────────────────────────────────────────────────────

export type BuildStepStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped'

export interface BuildStep {
  id: string
  label: string
  detail: string
  status: BuildStepStatus
}

export type BuildStatus =
  | 'idle'
  | 'parsing'
  | 'voicing'
  | 'uploading'
  | 'avatar'
  | 'broll'
  | 'removing-bg'
  | 'assembling'
  | 'done'
  | 'failed'

export interface ScriptSegment {
  index: number
  text: string
  durationSec: number   // estimated duration of this segment
  startSec: number      // start time in final video
  brollPrompt: string   // prompt for Kling video generation
  avatarPosition: 'left' | 'right'
  useProduct: boolean   // should product image be referenced?
}

export interface VideoBuilderJob {
  id: string
  name: string
  status: BuildStatus
  errorMessage: string | null
  // Inputs
  script: string
  voiceId: string
  voiceName: string
  // Results
  videoUrl: string | null
  assetId: string | null
  totalDuration: number | null
  createdAt: number
}

// Gemini returns this structure when parsing the script
export interface ParsedScript {
  segments: ScriptSegment[]
  totalEstimatedSec: number
}
