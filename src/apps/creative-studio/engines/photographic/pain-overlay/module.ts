// ── Pain Overlay UGC module (P37, P48 body-location-by-niche) ────────────
//
// Empathy-driven UGC: a face mid-symptom with a short italic Malay /
// Vietnamese / Indonesian text overlay on a dark glassmorphism panel.
// Matches Ladipage `pain_01..05` pattern — each pain point gets its
// own frame so the funnel can stack 4-5 pains in sequence.
//
// P48 — the body location of the pain is now derived from the product's
// niche / painPoints (loaded by the creativeConfig path). The legacy
// hardcoded list ("fatigue / bloating / sleeplessness / digestive /
// weight gain") biased the model toward abdomen-clutching poses for
// products that have nothing to do with the gut (dental, skincare,
// joint, hair). The new prompt enumerates body-area mappings explicitly.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'pain-overlay',
  label: { vi: 'Khoảnh khắc đau / khó chịu', en: 'Pain Point Overlay' },
  category: 'ugc',
  scenePrompt:
    'Person mid-symptom at home expressing the pain point that matches '
    + 'the product\'s niche — the body location MUST match the pain: '
    + 'dental / oral product → hand to cheek or jaw with wincing mouth; '
    + 'digestive / gut product → hand on stomach; headache / sleep '
    + 'product → hand to forehead or temples; joint / back product → '
    + 'hand to the affected joint; skin product → examining affected '
    + 'skin in a mirror; hair / scalp product → hand through thinning '
    + 'hair. Genuine frustrated exhausted expression — NOT acted, NEVER '
    + 'smiling. Dark glassmorphism panel overlay with italic slanted '
    + 'target-locale text + emoji prefix. NO target product visible '
    + '(pre-discovery state).',
  composition: { productDominance: 0, faceDominance: 0.9 },
  requiresAvatar: false,
  moduleNegatives: [
    'happy or relaxed expression',
    'target product visible in frame',
    'studio glamour lighting',
    'pain location mismatched with product niche',
  ],
})
