// ─────────────────────────────────────────────────────────────────────────
// services/forms/_registry.ts — Phase 2 — FORM MODULE DISPATCH
//
// Resolves a form id (from LandingGenParams.form) to the actual
// FormBlueprintModule instance. Uses dynamic imports so each form's code
// only loads when a user actually picks it (bundle splitting).
//
// Backward-compat: FORM_ALIASES maps any older / alternative id to the
// canonical form id. Phase 2 keeps existing ids untouched (no DB migration
// needed). The alias table is the migration safety net — if Phase 7 ever
// renames ids to Vietnamese, we add the old EN id here pointing to the
// new VI id, and saved projects keep loading.
//
// NOTE: this is a dispatch layer ONLY. No business logic lives here.
// ─────────────────────────────────────────────────────────────────────────

import type { LandingForm } from '../../types'
import type { FormBlueprintModule, FormResolver } from './_types'

// Lazy loaders keyed by canonical form id. Each loader returns the module
// instance (NOT the file's default export — we expose a named `module`
// inside each form file for clarity).
const FORM_REGISTRY: Record<LandingForm, FormResolver> = {
  'ugc-malaysia':  async () => (await import('./ugc-malaysia')).module,
  'advertorial':   async () => (await import('./advertorial')).module,
  'premium':       async () => (await import('./premium')).module,
  'hard-sell-cod': async () => (await import('./hard-sell-cod')).module,
  'chuyen-gia':    async () => (await import('./chuyen-gia')).module,
}

/**
 * Aliases for backward compatibility. If a saved project or stale URL
 * refers to a form id that has been renamed, resolve it to the canonical
 * id via this map. Empty at Phase 2 — kept here as the future migration
 * point.
 *
 * Example future use:
 *   'ugc-malaysia' → 'ugc-chuyendoi-nhanh'
 *   'advertorial'  → 'ke-chuyen-hanh-trinh'
 */
const FORM_ALIASES: Partial<Record<string, LandingForm>> = {
  // No aliases yet — Phase 2 preserves all existing ids exactly.
}

/** Default form when the input is missing / unknown. Form 1 is the safest
 *  fallback because it's the frozen, battle-tested engine. */
const FALLBACK_FORM: LandingForm = 'ugc-malaysia'

/**
 * Resolve a form id to its blueprint module. Async because each form is
 * lazy-loaded. Falls back to ugc-malaysia if the id is unknown — never
 * throws, so a corrupt saved project still opens.
 */
export async function resolveForm(formId: string | undefined): Promise<FormBlueprintModule> {
  const raw = formId ?? FALLBACK_FORM
  const canonical = (FORM_ALIASES[raw] ?? raw) as LandingForm
  const loader = FORM_REGISTRY[canonical]
  if (!loader) {
    console.warn(`[FORM REGISTRY] unknown formId="${formId}" — falling back to ${FALLBACK_FORM}`)
    return (await FORM_REGISTRY[FALLBACK_FORM]()) as FormBlueprintModule
  }
  const module = await loader()
  console.info(`[FORM REGISTRY] resolved formId=${canonical} → ${module.label.en} (${module.sections.length} sections)`)
  return module
}

/** List all registered forms (for InputPanel UI). Synchronous — returns
 *  ids only, the UI doesn't need to load modules just to show the picker. */
export function listFormIds(): LandingForm[] {
  return Object.keys(FORM_REGISTRY) as LandingForm[]
}
