// ─────────────────────────────────────────────────────────────────────────
// services/forms/_registry.ts — STATIC IMPORT MAP (stabilization fix)
//
// HISTORY
//   • Phase 2: used `async () => (await import('./<form>')).module` per
//     entry. Vite code-split each form into a separate chunk (~20-26KB
//     each). Worked in dev + first prod build.
//   • Stabilization fix: that worked UNTIL a redeploy changed the hashed
//     chunk filenames (eg `chuyen-gia-2xLvczDG.js` → `chuyen-gia-BZiKyU1T
//     .js`). Browsers that had cached the OLD `index-*.js` kept asking
//     the CDN for the OLD chunk path, which no longer existed → 404 +
//     "Failed to fetch dynamically imported module" error toast.
//   • Fix: switch to STATIC eager imports. All 5 form modules now live
//     inside the main index bundle. No separate chunks, no lazy fetches
//     that can stale-cache across deploys. Bundle bloat is small (~90KB
//     total across all forms) and worth the stability win.
//
// NO BUSINESS LOGIC HERE. Just dispatch + alias resolution.
// ─────────────────────────────────────────────────────────────────────────

import type { LandingForm } from '../../types'
import type { FormBlueprintModule } from './_types'

// ── Static imports — bundled into the main index chunk on build ──────────
import { module as ugcMalaysiaModule }  from './ugc-malaysia'
import { module as advertorialModule }  from './advertorial'
import { module as premiumModule }      from './premium'
import { module as hardSellCodModule }  from './hard-sell-cod'
import { module as chuyenGiaModule }    from './chuyen-gia'

// Static map keyed by canonical form id. No async, no dynamic paths,
// no chunk splitting → no cache-bust failure mode on redeploy.
const FORM_MODULES: Record<LandingForm, FormBlueprintModule> = {
  'ugc-malaysia':  ugcMalaysiaModule,
  'advertorial':   advertorialModule,
  'premium':       premiumModule,
  'hard-sell-cod': hardSellCodModule,
  'chuyen-gia':    chuyenGiaModule,
}

/**
 * Aliases for backward compatibility. If a saved project or stale URL
 * refers to a form id that has been renamed, resolve it to the canonical
 * id via this map. Empty today — kept as the future migration safety net.
 */
const FORM_ALIASES: Partial<Record<string, LandingForm>> = {
  // No aliases yet — current IDs preserved exactly.
}

/** Default form when the input is missing / unknown. Form 1 is the safest
 *  fallback because it's the frozen, battle-tested engine. */
const FALLBACK_FORM: LandingForm = 'ugc-malaysia'

/**
 * Resolve a form id to its blueprint module. Returns a Promise so the
 * public API surface stays unchanged for callers that previously awaited
 * the async lazy loader. Internally synchronous — Promise.resolve only.
 * Falls back to ugc-malaysia if the id is unknown — never throws.
 */
export async function resolveForm(formId: string | undefined): Promise<FormBlueprintModule> {
  const raw = formId ?? FALLBACK_FORM
  const canonical = (FORM_ALIASES[raw] ?? raw) as LandingForm
  const module = FORM_MODULES[canonical]
  if (!module) {
    console.warn(`[FORM REGISTRY] unknown formId="${formId}" — falling back to ${FALLBACK_FORM}`)
    return FORM_MODULES[FALLBACK_FORM]
  }
  console.info(`[FORM REGISTRY] resolved formId=${canonical} → ${module.label.en} (${module.sections.length} sections)`)
  return module
}

/** List all registered forms (for InputPanel UI). Synchronous. */
export function listFormIds(): LandingForm[] {
  return Object.keys(FORM_MODULES) as LandingForm[]
}
