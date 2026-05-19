// ── Expert / Doctor / KOL module (P33, P48 testimonial card layout) ───────
//
// Authority signal: a fictional expert / doctor / KOL portrait shown
// alongside the product. Strict architecture rule: ALWAYS fictional —
// never impersonate real doctors, celebrities, or named professionals.
// AI spokesperson framing.
//
// P48 — portrait 9:16 testimonial-card layout: large headshot top, name
// caption + years-of-experience badge + follower-count badge mid-frame,
// quote text box with feedback line bottom. Mirrors the trust-card
// aesthetic Ladipage uses for expert endorsement frames.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'expert-kol',
  label: { vi: 'Chuyên gia / Bác sĩ / KOL', en: 'Expert / Doctor / KOL' },
  category: 'social-proof',
  aspectRatio: '9:16',
  scenePrompt:
    'Portrait 9:16 expert-testimonial-card layout. UPPER 55%: a FICTIONAL '
    + 'professional spokesperson (doctor / pharmacist / nutritionist / '
    + 'wellness expert as fits the product niche) shown chest-up in clean '
    + 'professional setting (clinic / consultation room / clean office), '
    + 'wearing role-appropriate attire (white coat / scrubs / smart '
    + 'professional). Direct calm eye contact with camera. Authoritative '
    + 'but warm expression. The product packaging visible in hand or on '
    + 'the surface beside them, label fully facing camera. '
    + 'MIDDLE STRIP: a clean white rounded info bar with the expert\'s '
    + 'plausible Vietnamese / Malay / Indonesian full name in BOLD large '
    + 'type ("Dr. <given-name> <family-name>" or "<title> <full-name>"), '
    + 'a professional role title below it (e.g. "Bác sĩ răng hàm mặt" / '
    + '"Doktor Pergigian" / "Dokter Gigi"), plus TWO small pill badges '
    + 'side-by-side: one says "X năm kinh nghiệm" / "X tahun pengalaman" '
    + '(plausible 8-20 years), the other says "Y followers" with a small '
    + 'verified-tick glyph (plausible 50K-500K). '
    + 'LOWER 30%: a soft rounded-rectangle quote card with large italic '
    + 'opening + closing quotation marks framing a SHORT 1-2 sentence '
    + 'locale-native testimonial about the product (matching the '
    + 'product\'s benefit fields). Subtle brand-color accent on the quote '
    + 'card. NEVER impersonate a real named doctor / real KOL / real '
    + 'celebrity — fully composite fictional identity.',
  composition: { productDominance: 0.3, faceDominance: 0.55 },
  requiresAvatar: false,
  moduleNegatives: [
    'impersonating real doctors, celebrities or named KOLs',
    'fake credentials or unrealistic certificate plaques in frame',
    'cluttered overlapping badges hiding the expert face',
    'fewer than the 3 layout zones (headshot / info bar / quote card)',
    'quote text in the wrong locale language',
  ],
})
