// ═════════════════════════════════════════════════════════════════════
// outputDispatcher — route OutputPanel rendering theo pack.form
//
// Drop-in replacement cho `./components/OutputPanel`. SuperLadipage.tsx
// chỉ cần đổi 1 dòng import — JSX call site giữ nguyên.
//
// Pattern song song với `formDispatcher.ts` ở generation side. Routing
// rule:
//   - pack là StorytellingPack (form='advertorial' + storytellingMeta) →
//     StorytellingOutputPanel (isolated renderer, diary aesthetic)
//   - Mọi case khác (pack=null, hoặc form khác) → OutputPanel UGC gốc
//     (untouched)
//
// Storytelling renderer dùng SUBSET của OutputPanel props (no image-gen
// buttons — P0.5 chưa có image pipeline). Props không dùng được swallow
// im lặng.
// ═════════════════════════════════════════════════════════════════════

import type { ImagePrompt, LandingPagePack } from './types'
import type { ImageProgress } from './SuperLadipage'
import OutputPanel from './components/OutputPanel'
import { isStorytellingPack } from './storytelling/types'
import StorytellingOutputPanel from './storytelling/components/StorytellingOutputPanel'

// Drop-in interface — mirror OutputPanel props 1:1 để SuperLadipage gọi
// y nguyên, không cần đổi JSX.
interface OutputDispatcherProps {
  pack: LandingPagePack | null
  isGenerating: boolean
  onRegenerate: () => void
  onGenerateAllImages: () => void
  onGenerateRemaining: () => void
  onRetryFailed: () => void
  onGenerateSection?: (sectionIdx: number) => void
  onGenerateSample?: () => void
  onRegenerateImage: (sectionIdx: number, imageIdx: number) => void
  onDeleteImage: (sectionIdx: number, imageIdx: number) => void
  onUpdatePrompt?: (sectionIdx: number, imageIdx: number, newPrompt: string) => void
  onRestorePrompt?: (sectionIdx: number, imageIdx: number) => void
  imageProgress: ImageProgress | null
  isGeneratingImages: boolean
  loadedFromId?: string | null
  loadedProjectTitle?: string
  onLoadProject?: (id: string) => void
  onSaveAsProject?: (title?: string) => void
  onNewProject?: () => void
}

export default function OutputDispatcher(props: OutputDispatcherProps) {
  // Route to storytelling renderer when pack is a fully-formed StorytellingPack.
  // Type guard ensures `storytellingMeta` exists — older/legacy advertorial
  // packs without meta safely fall back to UGC OutputPanel.
  if (props.pack && isStorytellingPack(props.pack)) {
    return (
      <StorytellingOutputPanel
        pack={props.pack}
        isGenerating={props.isGenerating}
        onRegenerate={props.onRegenerate}
        onNewProject={props.onNewProject}
        onSaveAsProject={props.onSaveAsProject}
        loadedFromId={props.loadedFromId}
        loadedProjectTitle={props.loadedProjectTitle}
      />
    )
  }

  // Default — UGC OutputPanel unchanged, all props pass through.
  return <OutputPanel {...props} />
}

// Re-export unused-by-storytelling types để TS không complain ở SuperLadipage
// import paths (defensive — không thật sự cần nhưng giúp future refactor).
export type { ImagePrompt }
