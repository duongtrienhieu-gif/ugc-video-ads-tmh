// ── Persona: Clinical Expert (P4) ──────────────────────────────────────────
import type { Persona } from '../../../types/persona'

export const clinicalExpert: Persona = {
  id: 'clinical_expert',
  label: { vi: 'Chuyên gia / khoa học', en: 'Clinical Expert' },
  description: 'Doktor / ahli farmasi / saintis 35-50, hero untuk form "Chuyên gia / Khoa học" — landing-page authority.',
  seedMemory: {
    gender: 'female',
    ethnicity: 'East / Southeast Asian',
    ageRange: '36-48',
    faceShape: 'oval, professional',
    skinTone: 'neutral fair',
    hairStyle: 'neat tied back or short professional',
    bodyType: 'slim, professional posture',
    outfitPalette: ['white lab coat', 'pharmacist tunic', 'neutral clinic background'],
    realismLevel: 'clean-commercial',
  },
  preferredCameraStyle: 'tripod-ugc',
  defaultRealism: 'clean-commercial',
  intentTags: ['authority', 'clinical', 'science', 'doctor', 'pharmacist', 'expert'],
}
