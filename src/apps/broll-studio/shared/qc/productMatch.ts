// ── Shared Product QC — re-export shim (P3) ─────────────────────────────────
//
// The legacy `services/qcProduct.ts` continues to live in its original
// location (BrollStudio.tsx still imports it). This file is the new
// canonical path that engine modules + the photographic dispatcher import
// from. Both paths resolve to the same logic until P10 final cleanup.

export { qcProduct, type ProductQC } from '../../services/qcProduct'
