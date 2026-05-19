// ── Pain Overlay UGC module (P37) ───────────────────────────────────────
//
// Empathy-driven UGC: a face mid-symptom with a short italic Malay /
// Vietnamese / Indonesian text overlay on a dark glassmorphism panel.
// Matches Ladipage `pain_01..05` pattern — each pain point gets its
// own frame so the funnel can stack 4-5 pains in sequence.

import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'pain-overlay',
  label: { vi: 'Pain Point Overlay', en: 'Pain Point Overlay' },
  category: 'ugc',
  scenePrompt:
    'Person mid-symptom expressing a specific pain point — fatigue / '
    + 'bloating / sleeplessness / digestive discomfort / weight gain — '
    + 'in a casual indoor setting. Dark glassmorphism panel overlay '
    + 'with italic slanted target-locale text + emoji prefix. NO target '
    + 'product visible (this is the BEFORE state, pre-discovery).',
  composition: { productDominance: 0, faceDominance: 0.9 },
  requiresAvatar: false,
  moduleNegatives: [
    'happy or relaxed expression',
    'target product visible in frame',
    'studio glamour lighting',
  ],
})
