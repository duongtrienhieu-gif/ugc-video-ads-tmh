// ── Shared Style Variants (P3) ──────────────────────────────────────────────
//
// Extracted from BrollStudio.tsx legacy STYLE_OPTIONS. Photographic modules
// reference these by id and bake the matching stylePrompt into their final
// prompt.

export interface StyleVariant {
  id: string
  label: string
  swatch: string
  stylePrompt: string
}

export const STYLE_VARIANTS: StyleVariant[] = [
  {
    id: 'realistic',
    label: 'Realistic',
    swatch: '#94a3b8',
    stylePrompt: 'Photorealistic, natural skin texture with pores and minor imperfections, real human, candid feel, no AI-rendered look, no plastic skin. Sharp focus across the entire frame, zero bokeh.',
  },
  {
    id: 'iphone',
    label: 'iPhone',
    swatch: '#60a5fa',
    stylePrompt: 'Authentic iPhone photo, slight digital grain, real consumer smartphone aesthetic, natural color science, unedited skin, no studio look.',
  },
  {
    id: 'ecommerce',
    label: 'Ecommerce',
    swatch: '#e2e8f0',
    stylePrompt: 'Clean e-commerce product photography, seamless near-white background, even studio softbox light, product hero centered, very sharp focus on the label, no harsh shadows.',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    swatch: '#d4b483',
    stylePrompt: 'High-end luxury beauty editorial, marble surface or muted neutrals, soft moody key light, premium magazine quality, refined and elegant.',
  },
  {
    id: 'beauty',
    label: 'Beauty',
    swatch: '#f9a8d4',
    stylePrompt: 'Beauty campaign aesthetic, glowing dewy skin, soft pink and peach color palette, dreamy diffuse light, subtle glow.',
  },
  {
    id: 'clinical',
    label: 'Clinical',
    swatch: '#67e8f9',
    stylePrompt: 'Clinical pharmaceutical aesthetic, cool white and pale blue tones, sterile uncluttered background, scientific authority feel, crisp and sharp.',
  },
]

export function findStyleVariant(id: string): StyleVariant {
  return STYLE_VARIANTS.find((s) => s.id === id) ?? STYLE_VARIANTS[0]
}
