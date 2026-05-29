// ═════════════════════════════════════════════════════════════════════
// Generation Orchestration — type definitions (P12 controlled lifecycle)
//
// Consumes RendererAdaptedPage → orchestrates real per-section image
// generation. SUBORDINATE to upstream psychology — the orchestrator
// is an execution engine, NOT a creative brain.
//
// LOCKED: orchestration MUST NOT reinterpret upstream semantics. It
// only routes / injects references / retries on failure. No prompt
// rewriting. No auto-beautify. No quality scoring AI.
//
// LOCKED: two-layer split:
//   - Plan layer (sync, deterministic, runs in pack gen):
//     routing + references + retry policy → GeneratedAsset with
//     status='planned', outputImages=[]
//   - Execution layer (async, consumer-triggered, executor-injected):
//     runs RendererExecutor, updates status + outputImages
//
// LOCKED: NO real API executors here. Only MockExecutor ships. Real
// DALL-E/Flux/SDXL clients = P12.5+ (separate, optional).
//
// LOCKED: NO auto-trigger. Pack gen plans only. Consumer must
// explicitly invoke execution.
// ═════════════════════════════════════════════════════════════════════

import type { RendererKey, RendererPrompt, RendererAdaptedSection, RendererAdaptedPage } from '../rendererAdapters'
import type { ImageRole } from '../imageSemantics'
import type { ImageAspectRatio } from '../renderContract'

// ─── Reference assets (user-uploaded) ──────────────────────────────

export type ReferenceAssetKind =
  | 'packaging'           // product packaging photo
  | 'logo'                // brand logo
  | 'label'               // product label
  | 'product-shot'        // clean product photo
  | 'character-reference' // character/face reference

export interface ReferenceAsset {
  kind: ReferenceAssetKind
  /** URL, data URI, or blob/IndexedDB key — opaque to orchestration. */
  url: string
  /** Optional name/label for QA / debug. */
  name?: string
  /** Optional reference weight 0-1 (renderer-specific interpretation). */
  weight?: number
}

// ─── Generation lifecycle status (LOCKED — no expansion) ───────────

export type GenerationStatus =
  | 'planned'      // plan made, not yet executed
  | 'in-progress'  // executor running
  | 'completed'    // success
  | 'failed'       // executor failure, no more retries
  | 'retrying'     // mid-retry
  | 'skipped'      // intentionally skipped (e.g., no imageIntent)

// ─── Output image shape ────────────────────────────────────────────

export interface OutputImage {
  /** URL / data URI / blob URL of the generated image. */
  url: string
  width?: number
  height?: number
  bytes?: number
  /** Optional content hash for dedup / consistency tracking. */
  hash?: string
}

// ─── GeneratedAsset — per-section orchestration record ─────────────

export interface GeneratedAsset {
  /** Renderer routed for this section (decided by intent, not random). */
  renderer: RendererKey
  /** Exact prompt fed to the executor (from rendererOutputs[renderer]). */
  promptUsed: RendererPrompt
  /** References selected for this section (filtered by imageRole). */
  referenceAssets: ReferenceAsset[]
  /** Lifecycle status — see GenerationStatus. */
  generationStatus: GenerationStatus
  /** Number of retries attempted (0 initially). */
  retryCount: number
  /** OPTIONAL — declarative consistency alignment 0-1. Deferred to P13. */
  semanticConsistencyScore?: number
  /** Generated images. Empty at plan time. */
  outputImages: OutputImage[]
  /** Failure reason if status === 'failed'. */
  failureReason?: string
  /** Plan timestamp (ms). */
  plannedAt: number
  /** Execution start timestamp (ms), set when executor runs. */
  executedAt?: number
}

// ─── Executor interface (P12 contract for future API clients) ──────

export interface ExecutorInput {
  prompt: RendererPrompt
  references: ReferenceAsset[]
  imageRole: ImageRole
  aspectRatio?: ImageAspectRatio
  sectionId: string
  attempt: number
}

export type ExecutorOutputStatus = 'ok' | 'failed' | 'malformed'

export interface ExecutorOutput {
  status: ExecutorOutputStatus
  images: OutputImage[]
  failureReason?: string
}

export interface RendererExecutor {
  /** Renderer this executor handles — orchestrator dispatches by key. */
  readonly renderer: RendererKey
  /** Async generation entry. */
  generate(input: ExecutorInput): Promise<ExecutorOutput>
}

export type ExecutorRegistry = Partial<Record<RendererKey, RendererExecutor>>

// ─── OrchestratedSection / OrchestratedPage (subtype chain) ────────

export interface OrchestratedSection extends RendererAdaptedSection {
  /** Present only when rendererOutputs exists (i.e., section has image). */
  generatedAsset?: GeneratedAsset
}

export interface OrchestratedPage extends RendererAdaptedPage {
  sections: OrchestratedSection[]
  /** Count of sections that received a generation plan. */
  generationPlanCount: number
  /** Count of sections with status === 'completed'. */
  generationCompletedCount: number
  /** Count of sections with status === 'failed'. */
  generationFailureCount: number
  /** Soft governance warnings from orchestrationValidator. */
  orchestrationWarnings: string[]
}
