// ── Product Localizations Store (P32 — Phase 6 multilingual brain) ────────
//
// Per-product, per-locale field overrides. Lives in localStorage so the
// existing Supabase products table doesn't need a migration. When the
// user selects locale=my-MY for Product X, the productKnowledge service
// reads from localizations[X]['my-MY'] FIRST, falling back to the
// legacy Vietnamese product fields.
//
// CRITICAL ARCHITECTURE RULE (per user spec):
//   "KHÔNG ĐƯỢC TRANSLATE — phải Malaysia-native rewriting"
//
// The native rewrite service (nativeRewrite.ts) honors this — it asks
// Gemini to RE-WRITE in the target market's voice, not literal-
// translate from Vietnamese. Output gets stored here.
//
// STORAGE FORMAT
//   localStorage key: 'creative-studio:product-locale:<productId>:<locale>'
//   value: JSON-encoded LocalizedProductFields
//
// Failures fall back silently — localizations are an enhancement, not
// a hard dependency.

import type { UINativeLocale } from '../types/uiNative'

/** Subset of Product fields that can be locale-overridden. */
export interface LocalizedProductFields {
  productName?: string
  productDescription?: string
  niche?: string
  audience?: string
  benefits?: string
  usps?: string
  painPoints?: string
  ingredients?: string
  offer?: string
  usageGuide?: string
  tone?: string
  /** When this localization was created / last updated. */
  updatedAt: number
  /** How the localization was created — manual entry vs Gemini native rewrite. */
  source: 'manual' | 'native-rewrite'
}

const STORAGE_PREFIX = 'creative-studio:product-locale:'

function key(productId: string, locale: UINativeLocale): string {
  return `${STORAGE_PREFIX}${productId}:${locale}`
}

/** Read a localization. Returns null when missing or storage unavailable. */
export function readLocalization(
  productId: string,
  locale: UINativeLocale,
): LocalizedProductFields | null {
  if (!productId) return null
  try {
    const raw = localStorage.getItem(key(productId, locale))
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalizedProductFields
    // Light sanity check — must at least have a productName or
    // benefits/usps to be usable.
    if (!parsed.productName && !parsed.benefits && !parsed.usps && !parsed.painPoints) return null
    return parsed
  } catch (err) {
    console.warn('[productLocalizations.read] failed', err)
    return null
  }
}

/** Write a localization. Silent on storage failure. */
export function writeLocalization(
  productId: string,
  locale: UINativeLocale,
  fields: Omit<LocalizedProductFields, 'updatedAt'>,
): void {
  if (!productId) return
  const payload: LocalizedProductFields = {
    ...fields,
    updatedAt: Date.now(),
  }
  try {
    localStorage.setItem(key(productId, locale), JSON.stringify(payload))
  } catch (err) {
    console.warn('[productLocalizations.write] failed', err)
  }
}

/** Delete a localization. */
export function deleteLocalization(productId: string, locale: UINativeLocale): void {
  if (!productId) return
  try {
    localStorage.removeItem(key(productId, locale))
  } catch {
    // silent
  }
}

/** Check availability across all supported locales — used by UI to show
 *  per-locale status chips ("✓ MY ready" / "✗ MY missing"). */
export function listAvailableLocales(productId: string): UINativeLocale[] {
  const available: UINativeLocale[] = []
  for (const locale of ['vi-VN', 'my-MY', 'id-ID', 'global'] as const) {
    if (readLocalization(productId, locale)) available.push(locale)
  }
  return available
}
