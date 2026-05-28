// ── Persona: Malay Muslim Mother (P4) ──────────────────────────────────────
import type { Persona } from '../../../types/persona'

export const malayMuslimMother: Persona = {
  id: 'malay_muslim_mother',
  label: { vi: 'Mẹ Malay Hồi giáo', en: 'Malay Muslim Mother' },
  description: 'Wanita Melayu Islam 30-45 berhijab, ibu rumah / pekerja, hero utama untuk produk kesihatan wanita & keluarga.',
  seedMemory: {
    gender: 'female',
    ethnicity: 'Malay Muslim (Malaysian)',
    ageRange: '32-42',
    faceShape: 'soft rounded',
    hijabStyle: 'modern soft scarf (tudung bawal / shawl), neat',
    skinTone: 'warm medium-tan',
    bodyType: 'average build, soft figure',
    outfitPalette: ['muted earth tones', 'soft pastel', 'modest baju kurung casual'],
    realismLevel: 'ugc-natural',
  },
  preferredCameraStyle: 'iphone-selfie',
  defaultRealism: 'ugc-natural',
  intentTags: ['gut-health', 'women-health', 'family', 'home-care', 'wellness', 'halal'],
}
