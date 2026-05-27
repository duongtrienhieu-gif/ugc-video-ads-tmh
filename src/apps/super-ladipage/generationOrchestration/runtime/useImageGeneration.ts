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

      const total = opts.page.sections.filter((s) => {
        if (!s.generatedAsset) return false
        if (sectionFilter && !sectionFilter(s.id)) return false
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

      const result = await executePageGeneration(opts.page, {
        executors: opts.executors,
        context: opts.context,
        concurrency: opts.concurrency,
        signal: controller.signal,
        filter: sectionFilter,
        onSceneSynthesized: () => {
          // First time we see a synthesized scene, flip out of "synthesizing" UI state
          setState((s) =>
            s.progress.isSynthesizing
              ? { ...s, progress: { ...s.progress, isSynthesizing: false } }
              : s,
          )
        },
        onSectionStart: (sectionId) => {
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
            workingSession = setRegenStatus(workingSession, sectionId, 'completed', 'image')
          } else {
            workingSession = recordFailure(
              workingSession,
              sectionId,
              asset.failureReason ?? 'unknown failure',
            )
            workingSession = incrementRetry(workingSession, sectionId)
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

      setState((s) => ({
        ...s,
        isGenerating: false,
        progress: { ...s.progress, currentSectionId: null, isSynthesizing: false },
        lastResult: result,
      }))
      abortRef.current = null
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
