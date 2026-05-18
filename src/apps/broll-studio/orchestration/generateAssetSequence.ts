// ── Multi-shot Sequence Orchestrator (P4) ───────────────────────────────────
//
// Sequential wrapper around generateAssets() that maintains a continuity
// session across N shots. First call produces the hero; the engine
// binds the hero asset to the session and subsequent calls receive it
// as the baseRef so KIE locks identity via image-to-image.
//
// Does NOT modify generateAssets() — single-shot path stays byte-stable.
// Callers that want continuity opt-in by calling this entry point
// instead.
//
// Wire-in to BrollStudio.tsx UI happens after the UI gets a "Sequence"
// mode toggle (planned for the next phase that owns UX changes).

import type { AssetTypeId, GenerateAssetParams, GeneratedAsset } from '../types/asset'
import type { ContinuitySessionInit } from '../types/continuity'
import { generateAssets } from './generateAssets'
import {
  startContinuitySession,
  disposeContinuitySession,
  bindHeroAsset,
  noteSequenceStep,
  getContinuitySession,
  buildContinuityDirective,
} from '../shared/continuity'

/** One shot in a sequence. The first entry is the hero. */
export interface SequenceShotSpec {
  assetTypeId: AssetTypeId
  /** Override / merge into the per-shot params. productId / modelId are
   *  taken from the session if not specified here. */
  params?: Omit<GenerateAssetParams, 'productId' | 'modelId'>
  /** Emotional beat id (see shared/metadata/emotionalBeats.ts). Surfaced
   *  via options.beatId + options.continuityDirective to the module. */
  beatId?: string
}

export interface SequenceOptions extends ContinuitySessionInit {
  /** Disposed automatically after the sequence completes (default true). */
  autoDispose?: boolean
}

export interface SequenceResult {
  sessionId: string
  /** Assets in the same order as the input specs. */
  assets: GeneratedAsset[]
}

/**
 * Run a sequence of photographic shots with shared identity. The first
 * shot becomes the hero — its asset is bound to the continuity session,
 * and every subsequent shot receives it as `options.baseRef` (which the
 * photographic dispatcher already supports — see
 * engines/photographic/_dispatcher.ts line 62-67).
 *
 * The continuity directive text (persona + beat + ref instructions) is
 * passed via `options.continuityDirective` so the module's buildPrompt
 * can splice it into the final prompt body. Modules that ignore this
 * field still work (the dispatcher just sends the prompt without the
 * directive).
 */
export async function generateAssetSequence(
  specs: SequenceShotSpec[],
  sequenceOptions: SequenceOptions,
): Promise<SequenceResult> {
  if (specs.length === 0) {
    throw new Error('[generateAssetSequence] specs must contain at least one shot')
  }

  const { autoDispose = true, ...init } = sequenceOptions
  const sessionId = startContinuitySession(init)

  const assets: GeneratedAsset[] = []

  try {
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i]
      const session = getContinuitySession(sessionId)
      if (!session) throw new Error('[generateAssetSequence] session vanished mid-sequence')

      const continuityDirective = buildContinuityDirective(sessionId, spec.beatId)

      const params: GenerateAssetParams = {
        productId: init.productId,
        modelId: init.modelId,
        ...spec.params,
        options: {
          ...(spec.params?.options ?? {}),
          // Hero gets no baseRef; subsequent shots get the hero asset ref
          ...(session.heroAssetRef ? { baseRef: session.heroAssetRef } : {}),
          beatId: spec.beatId,
          personaId: init.personaId,
          continuityDirective,
          sequenceIndex: i,
          sequenceTotal: specs.length,
        },
      }

      const asset = await generateAssets(spec.assetTypeId, params)
      assets.push(asset)

      if (i === 0) {
        // First shot is the hero — bind so the rest of the sequence
        // can identity-lock against it.
        bindHeroAsset(sessionId, asset)
      } else {
        noteSequenceStep(sessionId)
      }
    }

    return { sessionId, assets }
  } finally {
    if (autoDispose) {
      disposeContinuitySession(sessionId)
    }
  }
}
