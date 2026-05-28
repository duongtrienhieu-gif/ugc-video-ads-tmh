// ── Persona: Middle Age Father (P4) ────────────────────────────────────────
import type { Persona } from '../../../types/persona'

export const middleAgeFather: Persona = {
  id: 'middle_age_father',
  label: { vi: 'Bố tuổi trung niên', en: 'Middle Age Father' },
  description: 'Lelaki Asia 40-52, bapa, hero untuk produk vitaliti, sendi, jantung, tenaga lelaki dewasa.',
  seedMemory: {
    gender: 'male',
    ethnicity: 'Southeast Asian (Malay / Chinese Malaysian)',
    ageRange: '42-52',
    faceShape: 'broader, mature',
    skinTone: 'warm tan',
    hairStyle: 'short natural dark with grey at temples',
    bodyType: 'average, slightly stocky',
    outfitPalette: ['plain polo / collared shirt', 'casual home tee', 'muted navy / olive'],
    realismLevel: 'ugc-natural',
  },
  preferredCameraStyle: 'tripod-ugc',
  defaultRealism: 'ugc-natural',
  intentTags: ['vitality', 'joint', 'heart', 'men-health', 'energy', 'recovery'],
}
