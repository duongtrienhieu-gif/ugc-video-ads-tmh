// ── UGC Selfie module (P3) — "Selfie cùng SP" ───────────────────────────────
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'ugc-selfie',
  label: { vi: 'Selfie cùng sản phẩm', en: 'UGC Selfie' },
  category: 'ugc',
  scenePrompt: 'Smartphone-selfie composition from slightly above, the person holds the product right next to their cheek with one hand, faint genuine smile, soft window light. The product label faces the camera and is clearly readable.',
  defaultStyleId: 'iphone',
  requiresAvatar: true,
  composition: { productDominance: 0.4, faceDominance: 0.7, allowedAngles: ['selfie-from-above', 'eye-level-selfie'] },
})
