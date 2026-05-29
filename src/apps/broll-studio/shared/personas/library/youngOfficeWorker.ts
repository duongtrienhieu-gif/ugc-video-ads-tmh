// ── Persona: Young Office Worker (P4) ──────────────────────────────────────
import type { Persona } from '../../../types/persona'

export const youngOfficeWorker: Persona = {
  id: 'young_office_worker',
  label: { vi: 'Nhân viên văn phòng trẻ', en: 'Young Office Worker' },
  description: 'Wanita / lelaki Asia 24-30, pekerja pejabat KL/JB, gaya casual-smart, hero untuk produk anti-stress, energy, skincare ringan.',
  seedMemory: {
    gender: 'female',
    ethnicity: 'Southeast Asian (mixed Malay / Chinese / Indian)',
    ageRange: '24-30',
    faceShape: 'oval',
    skinTone: 'neutral light-to-medium',
    hairStyle: 'shoulder-length natural dark, loosely tied',
    bodyType: 'slim-average',
    outfitPalette: ['neutral blouse', 'denim casual', 'soft pastel cardigan'],
    realismLevel: 'phone-authentic',
  },
  preferredCameraStyle: 'samsung-indoor',
  defaultRealism: 'phone-authentic',
  intentTags: ['energy', 'stress', 'beauty', 'skincare', 'lifestyle', 'productivity'],
}
