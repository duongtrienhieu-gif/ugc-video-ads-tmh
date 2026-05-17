// ─────────────────────────────────────────────────────────────────────────
// Lab Content handoff mappers — translate a strategic brief's recommended
// formula + tone into the closest existing preset / tone IDs of the two
// downstream apps (Ads Content and Script Architect).
//
// Kept centralised here so both receiving apps decode the same way, and so
// the mapping rules are easy to tune in one place.
// ─────────────────────────────────────────────────────────────────────────

import type { ToneId as LabToneId } from '../types'

// ── Formula → Ads Content preset ────────────────────────────────────────
// Map the 14 copywriting formulas to the closest existing Ads Content preset.
const FORMULA_TO_ADS_PRESET: Record<string, string> = {
  'PAS':            'problem-solution',
  'BAB':            'before-after',
  'Storytelling':   'storytelling',
  'FAB':            'comparison',
  'AIDA':           'long-form-sales',
  'SLAP':           'pattern-interrupt',
  'Hook-Value-CTA': 'short-punchy',
  'PPPP':           'doctor-style',
  'SSS':            'short-punchy',
  'ACC':            'social-proof',
  '5W1H':           'why-this-works',
  '4Cs':            'comparison',
  'COC':            'storytelling',
  'Funnel':         'long-form-sales',
}

export function mapFormulaToAdsPreset(formula: string): string {
  const normalized = formula.trim()
  return FORMULA_TO_ADS_PRESET[normalized] ?? 'problem-solution'
}

// ── Formula → Script Architect preset ───────────────────────────────────
const FORMULA_TO_SCRIPT_PRESET: Record<string, string> = {
  'PAS':            'problem-solution',
  'BAB':            'before-after',
  'Storytelling':   'emotional-story',
  'FAB':            'comparison',
  'AIDA':           'authority-proof',
  'SLAP':           'pattern-interrupt',
  'Hook-Value-CTA': 'fast-cta',
  'PPPP':           'doctor-research',
  'SSS':            'fast-cta',
  'ACC':            'testimonial',
  '5W1H':           'edu-ingredient',
  '4Cs':            'comparison',
  'COC':            'emotional-story',
  'Funnel':         'authority-proof',
}

export function mapFormulaToScriptPreset(formula: string): string {
  const normalized = formula.trim()
  return FORMULA_TO_SCRIPT_PRESET[normalized] ?? 'problem-solution'
}

// ── Lab tone → Ads Content tone IDs (multi-select) ──────────────────────
// Ads Content tones live in src/apps/ads-content/types.ts as ToneId union.
// We return the relevant IDs as strings to avoid a cross-app type import.
const LAB_TONE_TO_ADS_TONES: Record<LabToneId, string[]> = {
  'direct-sharp': ['hard-sell'],
  'expert':       ['scientific'],
  'friendly':     ['soft-sell'],
  'storyteller':  ['emotional'],
  'hype':         ['hard-sell'],
  'custom':       [],
}

export function mapLabToneToAdsTones(toneId: LabToneId): string[] {
  return LAB_TONE_TO_ADS_TONES[toneId] ?? []
}

// ── Lab tone → Script Architect tone modifier IDs (multi-select) ────────
const LAB_TONE_TO_SCRIPT_TONES: Record<LabToneId, string[]> = {
  'direct-sharp': ['hard-sell'],
  'expert':       ['scientific'],
  'friendly':     ['soft-sell'],
  'storyteller':  ['emotional'],
  'hype':         ['hard-sell', 'aggressive-hook'],
  'custom':       [],
}

export function mapLabToneToScriptTones(toneId: LabToneId): string[] {
  return LAB_TONE_TO_SCRIPT_TONES[toneId] ?? []
}
