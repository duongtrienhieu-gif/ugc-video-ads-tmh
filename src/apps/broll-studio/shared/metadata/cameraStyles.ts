// ── Camera Styles (P4) ──────────────────────────────────────────────────────
//
// Camera style = which "phone / lens" the section pretends to be shot
// through. Drives prompt fragments like "shot on iPhone 14, slight motion
// blur, ring-light reflection". Personas pick a preferred camera style;
// sections can override.

export interface CameraStyle {
  id: string
  /** Vietnamese-first label. */
  label: { vi: string; en: string }
  /** Free-form prompt fragment injected into [CAMERA] block. */
  prompt: string
}

export const CAMERA_STYLES: readonly CameraStyle[] = [
  {
    id: 'iphone-selfie',
    label: { vi: 'iPhone selfie', en: 'iPhone selfie' },
    prompt:
      'Shot on iPhone front camera, slight wide-angle distortion, natural skin texture, soft indoor lighting, faint catchlight in eyes.',
  },
  {
    id: 'samsung-indoor',
    label: { vi: 'Samsung trong nhà', en: 'Samsung indoor' },
    prompt:
      'Shot on Samsung Galaxy main camera, warm white-balance, slight noise in shadows, indoor ambient light, candid framing.',
  },
  {
    id: 'tiktok-handheld',
    label: { vi: 'TikTok cầm tay', en: 'TikTok handheld' },
    prompt:
      'Handheld smartphone shot, slight motion-blur, ring-light reflection visible in eyes, raw TikTok review aesthetic, mild lens flare.',
  },
  {
    id: 'home-mirror',
    label: { vi: 'Gương ở nhà', en: 'Home mirror' },
    prompt:
      'Mirror selfie, phone partially visible in the frame, soft bedroom lighting, no studio polish, authentic home environment.',
  },
  {
    id: 'cafe-candid',
    label: { vi: 'Quán cafe candid', en: 'Cafe candid' },
    prompt:
      'Candid cafe snapshot from a friend\'s phone, warm window light, slight bokeh from cafe interior, unposed natural moment.',
  },
  {
    id: 'tripod-ugc',
    label: { vi: 'Tripod UGC', en: 'Tripod UGC' },
    prompt:
      'Phone on small tripod, eye-level, stable framing, soft daylight from a window, raw UGC feel — not commercial polish.',
  },
] as const

export function findCameraStyle(id: string | undefined | null): CameraStyle {
  return CAMERA_STYLES.find((c) => c.id === id) ?? CAMERA_STYLES[0]!
}
