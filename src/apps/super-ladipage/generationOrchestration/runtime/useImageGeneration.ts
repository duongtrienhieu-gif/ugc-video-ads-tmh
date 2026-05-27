// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — useImageGeneration hook (POST-REBUILD)
//
// React hook managing async batch generation state + session updates.
// Now requires PageGenerationContext (niche + protagonist + product +
// API keys) so scene synthesis can run inside executePageGeneration.
// ─────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react'
import type { OrchestratedPage } from '../types'
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
      if (!opts.page || !opts.session) {
        setState((s) => ({ ...s, error: 'No page or session available' }))
        return
      }
      if (!opts.context) {
        setState((s) => ({ ...s, error: 'Missing generation context — refresh the pack' }))
        return
      }
      if (state.isGenerating) return

      const controller = new AbortController()
      abortRef.current = controller

      // UI-FIX4 (2026-05-28) — When user clicks regen on ONE section
      // explicitly (sectionFilter set), always count it regardless of
      // current status. "Generate All" path (no filter) keeps the
      // status-based eligibility check.
      const isSingleSection = Boolean(sectionFilter)
      const total = opts.page.sections.filter((s) => {
        if (!s.generatedAsset) return false
        if (sectionFilter && !sectionFilter(s.id)) return false
        if (isSingleSection) return true
        const st = s.generatedAsset.generationStatus
        return st === 'planned' || st === 'failed'
      }).length

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
      try {
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
            // First time we see a synthesized scene, flip out of "synthesizing" UI state
            setState((s) =>
              s.progress.isSynthesizing
                ? { ...s, progress: { ...s.progress, isSynthesizing: false } }
                : s,
            )
          },
          onSectionStart: (sectionId, renderer) => {
            console.info(`[image-gen] section=${sectionId} renderer=${renderer} START`)
            workingSession = setRegenStatus(workingSession, sectionId, 'generating', 'image')
            opts.setSession(workingSession)
            void saveSession(workingSession)
            setState((s) => ({
              ...s,
              progress: { ...s.progress, currentSectionId: sectionId, isSynthesizing: false },
            }))
          },
          onSectionComplete: (sectionId, asset) => {
            if (asset.generationStatus === 'completed') {
              console.info(`[image-gen] section=${sectionId} renderer=${asset.renderer} COMPLETED url=${asset.outputImages[0]?.url.slice(0, 80)}`)
              workingSession = setRegenStatus(workingSession, sectionId, 'completed', 'image')
            } else {
              const reason = asset.failureReason ?? 'unknown failure'
              console.warn(`[image-gen] section=${sectionId} renderer=${asset.renderer} FAILED reason=${reason}`)
              workingSession = recordFailure(
                workingSession,
                sectionId,
                reason,
              )
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
          },
        })
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
