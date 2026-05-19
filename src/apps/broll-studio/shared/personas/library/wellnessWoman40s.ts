// ── Persona: Wellness Woman 40s (P4) ───────────────────────────────────────
import type { Persona } from '../../../types/persona'

export const wellnessWoman40s: Persona = {
  id: 'wellness_woman_40s',
  label: { vi: 'Phụ nữ wellness 40+', en: 'Wellness Woman 40s' },
  description: 'Wanita 40-50 yang menjaga kecantikan & kesihatan, hero untuk premium skincare, anti-aging, collagen.',
  seedMemory: {
    gender: 'female',
    ethnicity: 'Pan-Asian (Malay / Chinese / mixed)',
    ageRange: '42-50',
    faceShape: 'oval, refined',
    skinTone: 'even fair-to-medium, well-cared',
    hairStyle: 'sleek shoulder-length, healthy shine',
    bodyType: 'slim, well-groomed',
    outfitPalette: ['silky neutral blouse', 'beige knit', 'soft champagne', 'understated linen'],
    realismLevel: 'clean-commercial',
  },
  preferredCameraStyle: 'home-mirror',
  defaultRealism: 'clean-commercial',
  intentTags: ['beauty', 'anti-aging', 'collagen', 'skincare-premium', 'wellness', 'luxury'],
}
