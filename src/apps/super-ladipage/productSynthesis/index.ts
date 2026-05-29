// ─────────────────────────────────────────────────────────────────────
// Product Synthesis — public API barrel
// ─────────────────────────────────────────────────────────────────────

export { synthesizeProductBrief } from './synthesizeProductBrief'
export { buildSynthesizedBrief } from './buildSynthesizedBrief'
export { synthesizeCommercialPsychology } from './synthesizeCommercialPsychology'
// OPT-F5 (2026-05-28) — merged brief+CP call with sequential fallback
export { synthesizeBriefAndCP } from './synthesizeBriefAndCP'
export type {
  SynthesizedProductBrief,
  SynthesizeProductBriefInput,
  SynthesizeProductBriefKeys,
  SynthesizedCommercialPsychology,
  SynthesizeCommercialPsychologyInput,
  SynthesizeCommercialPsychologyKeys,
  CommercialObjection,
  CommercialVoiceTexture,
} from './types'
