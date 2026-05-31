// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — useImageGeneration hook (POST-REBUILD)
//
// React hook managing async batch generation state + session updates.
// Now requires PageGenerationContext (niche + protagonist + product +
// API keys) so scene synthesis can run inside executePageGeneration.
// ─────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react'
import type { GeneratedAsset, OrchestratedPage } from '../types'
import type { SceneDescription } from '../../imageSceneSynthesis'
import type { LandingSession } from '../../sessionRuntime'
import {
  setRegenStatus,
  incrementRetry,
  recordFailure,
  recordGenerationEvent,
  saveSession,
} from '../../sessionRuntime'
import { executePageGeneration } from './executePageGeneration'
import type {
  ExecutePageGenerationOptions,
  ExecutePageGenerationResult,
  PageGenerationContext,
} from './executePageGeneration'
import { executePIImages } from './executePIImages'
import type { PIImageWorkItem } from './executePIImages'

export interface UseImageGenerationOptions {
  page: OrchestratedPage | null
  session: LandingSession | null
  setSession: (s: LandingSession) => void
  executors: ExecutePageGenerationOptions['executors']
  /** Required post-rebuild — synthesis + cultural + API keys context. */
  context: PageGenerationContext | null
  concurrency?: number
  /** OPT.4 (2026-05-28) — Toast callback on image gen failure so user knows
   *  WHY it failed (not silent). Receives section id + reason text. */
  onFailureToast?: (sectionId: string, reason: string) => void
  /** UI-FIX5 (2026-05-28) — CRITICAL: callback fired whenever an executor
   *  finishes a section (success OR failure) with the FULL updated asset
   *  including outputImages[].url. Without this hook the parent has no
   *  way to learn the image URL — onSectionComplete previously only
   *  wrote regenStatus into the session, the URL was discarded after
   *  the inner callback returned, and the UI (which reads from
   *  meta.exportablePage.sections[i].generatedAsset.outputImages) never
   *  saw a URL → "Tạo ảnh" silently appeared to do nothing forever. */
  onAssetUpdated?: (sectionId: string, asset: GeneratedAsset) => void

  // ── 2026-05-30 — PI image plans (parallel pipeline) ─────────────────
  // When the pack carries piImageAssets (currently only
  // 'pi-mechanism-personal' per PI_IMAGE_ROLE), this hook ALSO runs
  // executePIImages alongside executePageGeneration:
  //   - generateAll: runs storytelling first, then PI with the
  //     character anchor URL captured from the hero-anchor section.
  //   - generateSection('pi-…'): routes to executePIImages only.
  // Both maps are optional — PI flow no-ops cleanly when absent.
  piImageAssets?: Record<string, GeneratedAsset>
  piImageScenes?: Record<string, SceneDescription>
}

export interface UseImageGenerationState {
  isGenerating: boolean
  progress: {
    done: number
    total: number
    currentSectionId: string | null
    /** True during scene synthesis phase (before any KIE call). */
    isSynthesizing: boolean
  }
  lastResult: ExecutePageGenerationResult | null
  error: string | null
}

export interface UseImageGenerationApi extends UseImageGenerationState {
  generateAll: () => Promise<void>
  generateSection: (sectionId: string) => Promise<void>
  cancel: () => void
  reset: () => void
}

export function useImageGeneration(opts: UseImageGenerationOptions): UseImageGenerationApi {
  const [state, setState] = useState<UseImageGenerationState>({
    isGenerating: false,
    progress: { done: 0, total: 0, currentSectionId: null, isSynthesizing: false },
    lastResult: null,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    abortRef.current = null
    setState({
      isGenerating: false,
      progress: { done: 0, total: 0, currentSectionId: null, isSynthesizing: false },
      lastResult: null,
      error: null,
    })
  }, [])

  const runGeneration = useCallback(
    async (sectionFilter?: (id: string) => boolean) => {
      // UI-FIX9 (2026-05-29) — SURFACE silent failures via toast.
      // Previous code did silent `return` on 3 paths (no page/session, no
      // context, isGenerating). User reported "click Tạo ảnh nhiều lần
      // không ra gì" because all 3 paths failed without any feedback.
      // Now each rejected click triggers a toast with the reason — user
      // sees WHY click was ignored and what to do.
      const toastReject = (reason: string) => {
        opts.onFailureToast?.('click-rejected', reason)
        console.warn(`[image-gen] click rejected: ${reason}`)
      }

      if (!opts.page || !opts.session) {
        setState((s) => ({ ...s, error: 'No page or session available' }))
        toastReject('Pack chưa sẵn sàng — refresh trang rồi thử lại')
        return
      }
      if (!opts.context) {
        setState((s) => ({ ...s, error: 'Missing generation context — refresh the pack' }))
        toastReject('Thiếu context (KIE key?) — kiểm tra Cài đặt')
        return
      }
      if (state.isGenerating) {
        toastReject('Đang chạy generation khác — đợi thanh tiến độ xong rồi click lại')
        return
      }

      const controller = new AbortController()
      abortRef.current = controller

      // UI-FIX4 (2026-05-28) — When user clicks regen on ONE section
      // explicitly (sectionFilter set), always count it regardless of
      // current status. "Generate All" path (no filter) keeps the
      // status-based eligibility check.
      const isSingleSection = Boolean(sectionFilter)
      const eligibleSections = opts.page.sections.filter((s) => {
        if (!s.generatedAsset) return false
        if (sectionFilter && !sectionFilter(s.id)) return false
        if (isSingleSection) return true
        const st = s.generatedAsset.generationStatus
        return st === 'planned' || st === 'failed'
      })

      // 2026-05-30 — Parallel PI eligibility check. PI assets live in
      // opts.piImageAssets (NOT opts.page.sections) and have their own
      // execution path. We do the same status / filter checks so the
      // overall counter reflects both flows.
      const eligiblePIIds: string[] = []
      if (opts.piImageAssets) {
        for (const [piId, asset] of Object.entries(opts.piImageAssets)) {
          if (sectionFilter && !sectionFilter(piId)) continue
          if (isSingleSection) {
            eligiblePIIds.push(piId)
            continue
          }
          const st = asset.generationStatus
          if (st === 'planned' || st === 'failed') eligiblePIIds.push(piId)
        }
      }

      const total = eligibleSections.length + eligiblePIIds.length

      // UI-FIX9 (2026-05-29) — Empty-queue guard. If filter matched 0
      // sections (e.g. user clicked "Tạo ảnh" on a section whose
      // `generatedAsset` is missing because composer didn't plan it),
      // executePageGeneration would no-op silently. Toast instead.
      if (total === 0) {
        const targetId = sectionFilter
          ? (opts.page.sections.find((s) => sectionFilter(s.id))?.id
             ?? Object.keys(opts.piImageAssets ?? {}).find((id) => sectionFilter(id))
             ?? 'unknown')
          : 'all'
        toastReject(
          isSingleSection
            ? `Section "${targetId.slice(0, 24)}" không có image plan — composer chưa assign imageRole. Thử Tạo lại pack.`
            : 'Không có ảnh nào cần tạo. Có thể tất cả đã hoàn thành.',
        )
        return
      }

      setState({
        isGenerating: true,
        progress: { done: 0, total, currentSectionId: null, isSynthesizing: true },
        lastResult: null,
        error: null,
      })

      let workingSession = opts.session

      // UI-FIX4 (2026-05-28) — try/finally guarantees isGenerating gets
      // reset even if executePageGeneration throws an unhandled error.
      // Previous bug: unhandled throw left isGenerating stuck true and
      // every subsequent click hit the `if (state.isGenerating) return`
      // guard, so the button became dead until full page reload.
      let result: ExecutePageGenerationResult | null = null

      // 2026-05-30 — Shared session-mutation logic for both storytelling
      // and PI completion handlers. Extracted so the PI parallel pipeline
      // can reuse the same session-update path without duplicating the
      // UI-FIX5 callback wiring.
      const handleAssetComplete = (sectionId: string, asset: GeneratedAsset) => {
        opts.onAssetUpdated?.(sectionId, asset)
        if (asset.generationStatus === 'completed') {
          console.info(`[image-gen] section=${sectionId} renderer=${asset.renderer} COMPLETED url=${asset.outputImages[0]?.url.slice(0, 80)}`)
          workingSession = setRegenStatus(workingSession, sectionId, 'completed', 'image')
        } else {
          const reason = asset.failureReason ?? 'unknown failure'
          console.warn(`[image-gen] section=${sectionId} renderer=${asset.renderer} FAILED reason=${reason}`)
          workingSession = recordFailure(workingSession, sectionId, reason)
          workingSession = incrementRetry(workingSession, sectionId)
          opts.onFailureToast?.(sectionId, reason)
        }
        workingSession = recordGenerationEvent(workingSession, {
          durationMs:
            asset.executedAt && asset.plannedAt
              ? Math.max(0, asset.executedAt - asset.plannedAt)
              : 0,
          renderer: asset.renderer,
        })
        opts.setSession(workingSession)
        void saveSession(workingSession)
        setState((s) => ({
          ...s,
          progress: { ...s.progress, done: s.progress.done + 1 },
        }))
      }

      const handleAssetStart = (sectionId: string, renderer: string) => {
        console.info(`[image-gen] section=${sectionId} renderer=${renderer} START`)
        workingSession = setRegenStatus(workingSession, sectionId, 'generating', 'image')
        opts.setSession(workingSession)
        void saveSession(workingSession)
        setState((s) => ({
          ...s,
          progress: { ...s.progress, currentSectionId: sectionId, isSynthesizing: false },
        }))
      }

      // 2026-05-30 — Capture character anchor URL from hero section as it
      // completes, so the PI image (which runs after storytelling) can
      // receive it as a reference for face / identity continuity.
      let capturedAnchorUrl: string | null = null
      const heroSectionId = opts.page?.sections.find(
        (s) => s.imageIntent?.imageRole === 'hero-anchor',
      )?.id

      try {
        // ── STORYTELLING flow (skip when only PI is eligible) ─────────
        if (eligibleSections.length > 0) {
          result = await executePageGeneration(opts.page, {
            executors: opts.executors,
            context: opts.context,
            concurrency: opts.concurrency,
            signal: controller.signal,
            filter: sectionFilter,
            // UI-FIX4 — single-section click should always regen, even if
            // the section currently sits in 'completed' or 'generating'.
            forceRegenerate: isSingleSection,
            onSceneSynthesized: () => {
              setState((s) =>
                s.progress.isSynthesizing
                  ? { ...s, progress: { ...s.progress, isSynthesizing: false } }
                  : s,
              )
            },
            onSectionStart: handleAssetStart,
            onSectionComplete: (sectionId, asset) => {
              if (
                heroSectionId
                && sectionId === heroSectionId
                && asset.generationStatus === 'completed'
                && asset.outputImages[0]?.url
              ) {
                capturedAnchorUrl = asset.outputImages[0].url
              }
              handleAssetComplete(sectionId, asset)
            },
          })
        }

        // ── PI flow (parallel pipeline, runs after storytelling) ──────
        // Only fires when:
        //   - opts.piImageAssets + opts.piImageScenes are present, AND
        //   - at least one PI id passed eligibility above.
        // Reuses storytelling's character anchor URL when available so
        // the narrator in the PI mechanism close-up matches the rest of
        // the pack. When storytelling didn't run (PI-only click), PI
        // gets no anchor — acceptable trade-off for the simpler flow.
        if (
          eligiblePIIds.length > 0
          && opts.piImageAssets
          && opts.piImageScenes
        ) {
          const piWorkItems: PIImageWorkItem[] = []
          for (const piId of eligiblePIIds) {
            const asset = opts.piImageAssets[piId]
            const scene = opts.piImageScenes[piId]
            if (!asset || !scene) continue
            piWorkItems.push({
              piBlockId: piId,
              scene,
              asset,
              imageRole: scene.imageRole,
              aspectRatio: '9:16',
            })
          }

          if (piWorkItems.length > 0) {
            await executePIImages(piWorkItems, {
              executors: opts.executors,
              characterAnchorUrl: capturedAnchorUrl,
              signal: controller.signal,
              filter: sectionFilter,
              forceRegenerate: isSingleSection,
              onItemStart: (piBlockId) => handleAssetStart(piBlockId, 'gpt4o'),
              onItemComplete: (piBlockId, asset) => handleAssetComplete(piBlockId, asset),
            })
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown image gen error'
        console.error(`[image-gen] FATAL during runGeneration: ${msg}`)
        setState((s) => ({ ...s, error: msg }))
        // Surface to toast if any section filter was given
        if (sectionFilter) {
          const targetId = opts.page?.sections.find((s) => sectionFilter(s.id))?.id ?? 'unknown'
          opts.onFailureToast?.(targetId, msg)
        }
      } finally {
        setState((s) => ({
          ...s,
          isGenerating: false,
          progress: { ...s.progress, currentSectionId: null, isSynthesizing: false },
          lastResult: result,
        }))
        abortRef.current = null
      }
    },
    [opts, state.isGenerating],
  )

  const generateAll = useCallback(() => runGeneration(), [runGeneration])
  const generateSection = useCallback(
    (sectionId: string) => runGeneration((id) => id === sectionId),
    [runGeneration],
  )

  return {
    ...state,
    generateAll,
    generateSection,
    cancel,
    reset,
  }
}
