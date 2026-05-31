// ═════════════════════════════════════════════════════════════════════
// Product Info Layer — module barrel
// ═════════════════════════════════════════════════════════════════════

export type {
  PISectionType,
  PIAnchorPosition,
  PlannerInput,
  PISectionPlan,
  PIPlan,
  PIBlock,
  PIBatchResult,
  GeneratorInput,
  GeneratorKeys,
} from './types'

export {
  PI_ANCHOR_BY_TYPE,
  PI_SECTION_TYPE_MAP,
  PI_IMAGE_ROLE,
  piBlockIdForType,
} from './types'

export { planPISections, getPlannedTypes, getAnchorForType } from './runtime/planPISections'
export { generatePISection } from './runtime/generatePISection'
export { composePIBlocks, interleaveIntoPack } from './runtime/composePIBlocks'

export { getDiaryVoiceSystemInstruction } from './config/diaryVoiceLock'
