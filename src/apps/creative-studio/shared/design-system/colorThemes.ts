// ── Designed-Graphic Color Themes (P7) ──────────────────────────────────────
//
// Pre-curated DesignedGraphicColorTheme presets. P8 modules either
// pick by id or accept a custom theme via params.options.

import type { DesignedGraphicColorTheme } from '../../types/designedGraphic'

export const COLOR_THEMES: Record<string, DesignedGraphicColorTheme> = {
  'wellness-clean': {
    primary:    '#1F8B6F',  // calming teal-green
    accent:     '#F2A93B',  // honey accent
    background: '#FAF7F2',  // warm off-white
    foreground: '#1A2B2A',
    gradient:   ['#FAF7F2', '#E8DCC8'],
  },
  'clinical-trust': {
    primary:    '#0F62FE',  // medical blue
    accent:     '#24A148',  // verified green
    background: '#FFFFFF',
    foreground: '#0B1A2A',
    gradient:   ['#FFFFFF', '#EAF1FC'],
  },
  'luxury-warm': {
    primary:    '#8A6E2F',  // brushed gold
    accent:     '#3B2F1E',  // espresso
    background: '#0F0E0C',
    foreground: '#F2E9D8',
    gradient:   ['#1A1612', '#2A2118'],
  },
  'sport-vivid': {
    primary:    '#FF3B30',  // action red
    accent:     '#1D1D1F',  // ink
    background: '#FFFFFF',
    foreground: '#1D1D1F',
    gradient:   ['#FFFFFF', '#F1F1F4'],
  },
  'beauty-pastel': {
    primary:    '#E58FB1',  // rose
    accent:     '#A18CD1',  // dusty lavender
    background: '#FFF5F7',
    foreground: '#3A1F2C',
    gradient:   ['#FFE5EC', '#E0CFE8'],
  },
}

export function findColorTheme(id: string): DesignedGraphicColorTheme {
  return COLOR_THEMES[id] ?? COLOR_THEMES['wellness-clean']
}
