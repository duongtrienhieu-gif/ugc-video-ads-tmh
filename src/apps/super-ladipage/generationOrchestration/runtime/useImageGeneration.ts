// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — useImageGeneration hook (LIVE)
//
// React hook managing async batch generation state + session updates.
// Consumer exposes 4 actions: generateAll / generateSection / cancel /
// reset. State: isGenerating, progress, lastResult.
//
// Hook is renderer-agnostic — accepts ExecutorRegistry from caller.
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
} from './executePageGeneration'

export interface UseImageGenerationOptions {
  /** Page to generate against (must have generatedAssets planned). */
  page: OrchestratedPage | null
  /** Current session (for state transitions). */
  session: LandingSession | null
  /** Session setter — hook updates session via this. */
  setSession: (s: LandingSession) => void
  /** Executor registry — caller assembles based on available API keys. */
  executors: ExecutePageGenerationOptions['executors']
  /** Concurrency cap. Default 2. */
  concurrency?: number
}

export interface UseImageGenerationState {
  isGenerating: boolean
  progress: {
    done: number
    total: number
    currentSectionId: string | null
  }
  lastResult: ExecutePageGenerationResult | null
  error: string | null
}

export interface UseImageGenerationApi extends UseImageGenerationState {
  /** Generate all 'planned'/'queued'/'failed' sections of the page. */
  generateAll: () => Promise<void>
  /** Generate a single section by ID. */
  generateSection: (sectionId: string) => Promise<void>
  /** Cancel in-flight generation. */
  cancel: () => void
  /** Reset state to initial. */
  reset: () => void
}

export function useImageGeneration(opts: UseImageGenerationOptions): UseImageGenerationApi {
  const [state, setState] = useState<UseImageGenerationState>({
    isGenerating: false,
    progress: { done: 0, total: 0, currentSectionId: null },
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
      progress: { done: 0, total: 0, currentSectionId: null },
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
      if (state.isGenerating) return

      const controller = new AbortController()
      abortRef.current = controller

      // Compute total queue size for progress
      const total = opts.page.sections.filter((s) => {
        if (!s.generatedAsset) return false
        if (sectionFilter && !sectionFilter(s.id)) return false
        const st = s.generatedAsset.generationStatus
        // Match the same eligibility rule as executePageGeneration
        return st === 'planned' || st === 'failed'
      }).length

      setState({
        isGenerating: true,
        progress: { done: 0, total, currentSectionId: null },
        lastResult: null,
        error: null,
      })

      // Snapshot mutable session in closure
      let workingSession = opts.session

      const result = await executePageGeneration(opts.page, {
        executors: opts.executors,
        concurrency: opts.concurrency,
        signal: controller.signal,
        filter: sectionFilter,
        onSectionStart: (sectionId) => {
          workingSession = setRegenStatus(workingSession, sectionId, 'generating', 'image')
          opts.setSession(workingSession)
          void saveSession(workingSession)
          setState((s) => ({
            ...s,
            progress: { ...s.progress, currentSectionId: sectionId },
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
        progress: { ...s.progress, currentSectionId: null },
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
