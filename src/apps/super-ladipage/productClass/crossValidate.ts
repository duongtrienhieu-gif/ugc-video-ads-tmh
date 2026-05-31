// ─────────────────────────────────────────────────────────────────────
// Product Class — niche × reality cross-validation (2026-05-30)
//
// Runs AFTER both niche detection and reality classification complete.
// Catches obvious mismatches that the standalone reality classifier might
// produce because it doesn't see the niche signal.
//
// Specifically targets the SYSTEMIC bug user reported (10/10 packs
// across niches all output "từ bên trong / hấp thu / tác động hệ thống"
// framing) caused by topical / device / cosmetic products being
// mis-classified as `oral-bioactive` or `biochemical-repair`. The fix
// for the classifier itself happens in classifier.ts CRITICAL RULES,
// but real-world inputs are noisy — this layer is the safety net.
//
// LOCKED rules:
//   1. Niche signals dominate when product name confirms the niche
//      (e.g., niche=dental-oral-care + productName contains "răng/teeth"
//      → cannot be oral-bioactive even if classifier said so).
//   2. Override is conservative: when overriding, pick the SAFEST
//      mechanism (topical-soothe / cosmetic-aesthetic) that matches the
//      niche, NEVER something more specific (which could still be wrong).
//   3. usageMode + productForm + sensationTiming are adjusted together
//      so the model stays internally consistent.
//   4. Source becomes 'fallback' so telemetry knows the original was
//      overridden, and downstream consumers know not to fully trust the
//      classifier confidence.
// ─────────────────────────────────────────────────────────────────────

import type {
  ProductRealityModel,
  MechanismFamily,
  ProductForm,
  UsageMode,
} from './types'
import type { NicheKey } from '../storytelling/types'

// Niches whose products are ALWAYS topical / cosmetic / external — never
// truly ingested even when name contains "powder" / "mineral" / "drink".
const ALWAYS_TOPICAL_NICHES: ReadonlyArray<NicheKey> = [
  'dental-oral-care',   // toothpaste, whitening powder, mouthwash — all apply
  'skincare',           // cream, serum, mask — all apply
  'haircare',           // shampoo, conditioner, hair serum — all apply
  'beauty-confidence',  // body cream, deodorant — all apply
]

// Niches whose products are ALMOST ALWAYS internal / ingested — pills,
// drinks, capsules. Topical exceptions are rare.
const ALWAYS_ORAL_NICHES: ReadonlyArray<NicheKey> = [
  'supplement-wellness',
  'diabetes-blood-sugar',
  'liver-detox',
  'prostate-urology',     // saw palmetto pills
  'anti-aging-longevity', // NMN/NAD pills
  'menopause',            // hormonal supplements
  'sleep-insomnia',       // melatonin pills
  'mental-health',        // ashwagandha pills
]

// Mechanism families that imply "ingested + systemic + from within"
// framing. If used for a topical niche, the pack will leak internal-only
// language across every chapter.
const ORAL_MECHANISM_FAMILIES: ReadonlyArray<MechanismFamily> = [
  'oral-bioactive',
  'biochemical-repair',
]

/** Product-name keyword patterns that confirm a niche match. When a
 *  product's name explicitly references a topical-niche concept, we
 *  trust the niche over the classifier's mechanism guess. */
const TOPICAL_NICHE_NAME_HINTS: Record<string, RegExp> = {
  'dental-oral-care': /\b(teeth|răng|gigi|dental|toothpaste|whitening|kem đánh răng|nước súc miệng|bột tẩy trắng|bột khoáng chất răng|mineral powder|toothbrush|gum)\b/i,
  'skincare':         /\b(skin|da|kulit|cream|kem|serum|moisturizer|sunscreen|chống nắng|sữa rửa mặt|mặt nạ|mask)\b/i,
  'haircare':         /\b(hair|tóc|rambut|shampoo|conditioner|dầu gội|dầu xả|hair serum|hair oil|scalp)\b/i,
  'beauty-confidence':/\b(deodorant|nách|ketiak|body cream|kem body|tẩy lông|hair removal|breast|ngực)\b/i,
}

/** Confirmed topical niche when product name + niche both signal topical. */
function nameConfirmsTopical(productName: string, niche: NicheKey): boolean {
  const pat = TOPICAL_NICHE_NAME_HINTS[niche as string]
  if (!pat) return false
  return pat.test(productName)
}

/** Build an override ProductRealityModel for a niche-confirmed topical
 *  product whose classifier incorrectly chose an oral mechanism. */
function buildTopicalOverride(
  original: ProductRealityModel,
  niche: NicheKey,
  productName: string,
): ProductRealityModel {
  // Pick the most appropriate topical mechanism for the niche.
  // Cosmetic niches → cosmetic-aesthetic. Other topical niches default
  // to topical-soothe (neutral surface-level mechanism).
  const isCosmetic = niche === 'skincare'
    || niche === 'haircare'
    || niche === 'dental-oral-care'
    || niche === 'beauty-confidence'
  const newMechanism: MechanismFamily = isCosmetic ? 'cosmetic-aesthetic' : 'topical-soothe'

  // Pick appropriate productForm. Dental whitening "powder" stays
  // 'cosmetic' (not 'oral-pill') because it's an apply-to-teeth product.
  const newForm: ProductForm = niche === 'dental-oral-care'
    ? 'cosmetic'
    : niche === 'haircare'
    ? 'cosmetic'
    : 'topical-cream'

  const newUsageMode: UsageMode = 'apply'

  return {
    ...original,
    productForm: newForm,
    usageMode: newUsageMode,
    mechanismFamily: newMechanism,
    // sensationTiming stays — gradual is correct for cosmetics too.
    source: 'fallback',
    rationale:
      `Cross-validation override: niche=${niche} confirmed by productName "${productName.slice(0, 40)}" but ` +
      `classifier picked ${original.mechanismFamily}/${original.usageMode}. Forced to topical (${newMechanism}/apply) ` +
      `to prevent systemic "từ bên trong" framing in pack. Original rationale: ${original.rationale || '(none)'}`,
  }
}

export interface CrossValidationResult {
  reality: ProductRealityModel
  overridden: boolean
  reason?: string
}

/** Cross-validate classifier output against detected niche + product name.
 *
 *  Returns either the original ProductRealityModel (when consistent) or
 *  an overridden version (when an obvious mismatch is detected).
 *
 *  Non-destructive — the caller can compare reality.source to know if
 *  override fired. Logs an info message when overriding. */
export function crossValidateProductReality(args: {
  reality: ProductRealityModel
  niche: NicheKey
  productName: string
}): CrossValidationResult {
  const { reality, niche, productName } = args

  // ── Check 1: Niche-confirmed topical with oral mechanism → override.
  // This is the primary fix for the "10/10 packs internal framing" bug.
  if (
    (ALWAYS_TOPICAL_NICHES as readonly string[]).includes(niche as string)
    && (ORAL_MECHANISM_FAMILIES as readonly string[]).includes(reality.mechanismFamily as string)
    && nameConfirmsTopical(productName, niche)
  ) {
    const overridden = buildTopicalOverride(reality, niche, productName)
    const reason =
      `niche=${niche} is ALWAYS_TOPICAL but classifier returned ` +
      `mechanism=${reality.mechanismFamily}; productName "${productName.slice(0, 40)}" confirms topical context. ` +
      `Overriding to ${overridden.mechanismFamily} / ${overridden.usageMode}.`
    console.warn(`[productClass/crossValidate] OVERRIDE: ${reason}`)
    return { reality: overridden, overridden: true, reason }
  }

  // ── Check 2: Oral niche but classifier picked topical mechanism →
  //   only override when product name STRONGLY signals oral (pill, viên,
  //   collagen drink, etc). Otherwise trust classifier — some niches do
  //   have mixed-topical products.
  // (Not implemented in V1 — Check 1 alone covers the user-reported bug.)

  return { reality, overridden: false }
}

/** Useful exports for downstream consumers (validators, debugger panels). */
export { ALWAYS_TOPICAL_NICHES, ALWAYS_ORAL_NICHES, ORAL_MECHANISM_FAMILIES }
