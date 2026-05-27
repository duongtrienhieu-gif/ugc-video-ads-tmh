// ─────────────────────────────────────────────────────────────────────
// Generation Orchestration — public API barrel (P12)
//
// Plan entry (sync, runs in pack gen):
//   planImageGenerationPage(rendererAdaptedPage, references?)
//     → OrchestratedPage
//
// Execute entry (async, consumer-triggered):
//   executeSectionGeneration({ asset, executor, ... })
//     → updated GeneratedAsset
//
// Executors: MockExecutor only. Real API clients = P12.5+.
// ─────────────────────────────────────────────────────────────────────

// Plan layer (sync, deterministic)
export { planImageGeneration } from './runtime/planImageGeneration'
export { planImageGenerationPage } from './runtime/planImageGenerationPage'

// Execution layer (async, consumer-triggered)
export { executeSectionGeneration } from './runtime/executeSectionGeneration'
export type { ExecuteSectionInput } from './runtime/executeSectionGeneration'

// LIVE: page-level batch execution
export { executePageGeneration, withCharacterReference } from './runtime/executePageGeneration'
export type {
  ExecutePageGenerationOptions,
  ExecutePageGenerationResult,
  PageGenerationContext,
} from './runtime/executePageGeneration'

// LIVE: React hook for UI integration
export { useImageGeneration } from './runtime/useImageGeneration'
export type {
  UseImageGenerationOptions,
  UseImageGenerationState,
  UseImageGenerationApi,
} from './runtime/useImageGeneration'

// Executors — mock (for dev/test) + KIE (for production)
export { createMockExecutor } from './executors/mockExecutor'
export type { MockExecutorOptions } from './executors/mockExecutor'

export { createKieGptImageExecutor } from './executors/kieGptImageExecutor'
export type { KieGptImageExecutorOptions } from './executors/kieGptImageExecutor'

export { createKieGpt4oImageExecutor } from './executors/kieGpt4oImageExecutor'
export type { KieGpt4oImageExecutorOptions } from './executors/kieGpt4oImageExecutor'

// Config (read-only — for QA / dev introspection)
export { selectReferences } from './config/referenceSelection'
export { shouldRetry, MAX_RETRIES, RETRIABLE_STATUSES } from './config/retryPolicy'

// Validator
export { orchestrationValidator } from './validators/orchestrationValidator'

// Types
export type {
  ReferenceAsset,
  ReferenceAssetKind,
  GenerationStatus,
  OutputImage,
  GeneratedAsset,
  ExecutorInput,
  ExecutorOutput,
  ExecutorOutputStatus,
  RendererExecutor,
  ExecutorRegistry,
  OrchestratedSection,
  OrchestratedPage,
} from './types'
