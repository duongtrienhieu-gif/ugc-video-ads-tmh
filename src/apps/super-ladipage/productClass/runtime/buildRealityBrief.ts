// ─────────────────────────────────────────────────────────────────────
// Product Class — buildRealityBrief (POSITIVE injection block)
//
// Converts ProductRealityModel → Vietnamese context block injectable
// into storytelling Gemini prompt. Pure positive description (no "don't
// say X" rules) — Gemini follows the accurate description naturally.
//
// This is THE single point where productClass affects storytelling output.
// All library lookups happen here.
// ─────────────────────────────────────────────────────────────────────

import type { ProductRealityModel } from '../types'
import { MECHANISM_DESCRIPTIONS } from '../libraries/mechanismDescriptions'
import { HERO_TRIGGERS } from '../libraries/heroTriggers'
import { DISCOVERY_SCENES, pickRealisticDiscovery } from '../libraries/discoveryContexts'
import { FAILED_ATTEMPTS } from '../libraries/failedAttempts'

/** Build a Vietnamese product-reality context block for Gemini prompt.
 *  Output is positive description only — no rules, no anti-patterns. */
export function buildRealityBrief(reality: ProductRealityModel): string {
  const mechanism = MECHANISM_DESCRIPTIONS[reality.mechanismFamily]
  const heroTriggers = HERO_TRIGGERS[reality.mechanismFamily].slice(0, 5)
  const failedAttempts = FAILED_ATTEMPTS[reality.mechanismFamily].slice(0, 5)
  const realisticDiscovery = pickRealisticDiscovery(reality.discoveryContext, reality.mechanismFamily)
  const discoveryScene = DISCOVERY_SCENES[realisticDiscovery]

  return [
    `═══ PRODUCT REALITY MODEL (LOCKED — không reinterpret) ═══`,
    ``,
    `Form factor: ${reality.productForm}`,
    `Usage mode: ${reality.usageMode}`,
    `Sensation timing: ${reality.sensationTiming}`,
    `Impulse type: ${reality.impulseType}`,
    ``,
    `── Mechanism (mô tả CHÍNH XÁC sản phẩm hoạt động thế nào) ──`,
    mechanism,
    ``,
    `── Hero recognition triggers (concrete sensory signals) ──`,
    `Reader của sản phẩm này nhận ra MÌNH qua những signals cụ thể sau:`,
    ...heroTriggers.map((t) => `  • ${t}`),
    `Hero opening (chương 1) PHẢI đánh trúng ít nhất 1 trong những signals này trong 1-2 paragraphs đầu.`,
    ``,
    `── Failed attempts (reader đã thử gì trước khi tìm product này) ──`,
    `Reader đã từng thử:`,
    ...failedAttempts.map((a) => `  • ${a}`),
    `Block "shared-failed-attempts" PHẢI dùng 2-3 từ list này (KHÔNG dùng generic "đã thử kem này kem kia").`,
    ``,
    `── Discovery context (reader gặp product này qua đâu) ──`,
    `Discovery context THỰC TẾ: ${realisticDiscovery}`,
    `Scene: ${discoveryScene}`,
    `Block "natural-product-discovery" PHẢI dùng đúng discovery context này — KHÔNG bịa context khác.`,
    ``,
    `═══════════════════════════════════════════════════════════════`,
  ].join('\n')
}
