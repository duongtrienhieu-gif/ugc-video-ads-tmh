// ── Before/After module (P3) — same person, different outfit/light/posture ──
//
// Enforces user's Phase 7 stabilization rule (authentic transformation):
// SAME face identity, DIFFERENT outfit / hair / posture / expression /
// lighting / room angle between BEFORE and AFTER. NEVER Photoshop overlay.
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'before-after',
  label: { vi: 'Before / After', en: 'Before / After' },
  category: 'before-after',
  scenePrompt: `Split-frame 1:1 composition. Left half: the person BEFORE — tired posture, dull skin, oversized homewear, dim flat lighting, slouched shoulders, no smile, low energy. Right half: the SAME person AFTER — cleaner fit / brighter outfit color (NOT the same shirt), brushed hair, straighter posture, gentle natural smile, brighter natural daylight, healthier complexion. Identical face identity in both halves; everything else MUST visibly differ. Neutral backdrop on both halves. No product in frame.`,
  defaultStyleId: 'realistic',
  requiresAvatar: true,
  composition: {
    productDominance: 0,
    faceDominance: 0.7,
    allowedAngles: ['split-frame-side-by-side'],
    forbiddenLayouts: ['same-clothes-both-halves', 'photoshop-overlay-look', 'pixel-identical-bg'],
  },
  moduleNegatives: [
    'Do NOT depict the person in the same outfit in both halves',
    'Do NOT use identical lighting in both halves',
    'Do NOT keep identical hair styling in both halves',
    'Do NOT keep identical posture / expression in both halves',
    'Do NOT do extreme fake slimming or face swap — realistic 14-day change only',
    'No product in either half',
  ],
})
