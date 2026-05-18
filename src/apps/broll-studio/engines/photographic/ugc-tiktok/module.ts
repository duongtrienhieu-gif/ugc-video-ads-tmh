// ── UGC TikTok module (P3) ──────────────────────────────────────────────────
import { buildPhotographicModule } from '../_buildModule'

export const module = buildPhotographicModule({
  id: 'ugc-tiktok',
  label: { vi: 'UGC TikTok', en: 'UGC TikTok' },
  category: 'ugc',
  scenePrompt: 'Phone-camera-style review shot, the person holds the product up to the camera in a bedroom or vanity setup, ring-light reflection visible in their eyes, raw smartphone aesthetic, looks like a real TikTok review still frame.',
  defaultStyleId: 'iphone',
  requiresAvatar: true,
  composition: {
    productDominance: 0.5,
    faceDominance: 0.5,
    forbiddenLayouts: ['cinematic-studio', 'luxury-editorial'],
  },
})
