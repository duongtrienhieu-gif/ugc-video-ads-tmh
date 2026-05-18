// ── Expert / Doctor / KOL module (P33) ────────────────────────────────────
//
// Authority signal: a fictional expert / doctor / KOL portrait shown
// alongside the product. Strict architecture rule: ALWAYS fictional —
// never impersonate real doctors, celebrities, or named professionals.
// AI spokesperson framing.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'expert-kol',
  label: { vi: 'Chuyên gia / Bác sĩ / KOL', en: 'Expert / Doctor / KOL' },
  category: 'social-proof',
  scenePrompt:
    'A FICTIONAL professional spokesperson (doctor / pharmacist / nutritionist / '
    + 'wellness expert) holding or presenting the product in a clean professional '
    + 'setting (clinic / consultation room / clean office). Wearing role-appropriate '
    + 'attire (white coat / smart professional / scrubs as the niche fits). Direct '
    + 'eye contact with camera. Authoritative but warm expression. NEVER impersonate '
    + 'real doctors / real KOLs / real celebrities — composite fictional face only. '
    + 'Clean professional lighting.',
  composition: { productDominance: 0.4, faceDominance: 0.6 },
  requiresAvatar: false,
})
