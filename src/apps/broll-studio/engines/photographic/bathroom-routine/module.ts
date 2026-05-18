// ── Bathroom Routine module (P3) ────────────────────────────────────────────
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'bathroom-routine',
  label: { vi: 'Routine bathroom', en: 'Bathroom Routine' },
  category: 'ugc',
  scenePrompt: 'The product on a white marble bathroom counter with neatly folded towels. The person softly out of focus in the background looking into a mirror. Morning skincare routine vibe, warm soft light.',
  defaultStyleId: 'beauty',
  composition: { productDominance: 0.55, faceDominance: 0.2 },
})
