// ── Avatar Consistency Memory (P30 — Phase 6) ──────────────────────────────
//
// Production-grade consistency layer: when a user generates multiple
// creatives in the same campaign (= same productId), the system
// remembers the chosen avatar and auto-selects it on subsequent
// creative types that require an avatar.
//
// Result: 5 UGC creatives for Product X share the same AI persona
// across selfie / holding-product / TikTok still / before-after / etc.
// This is the "same face family" property called out in Phase 6 §2.
//
// STORAGE: localStorage scoped per productId. Survives reload, scoped
// per browser. The store is small (one modelId per product) and
// non-critical — failures fall back to "no memory" without errors.

const KEY_PREFIX = 'creative-studio:campaign-avatar:'

function key(productId: string): string {
  return `${KEY_PREFIX}${productId}`
}

/** Remember the avatar chosen for a given product. */
export function rememberAvatarForProduct(productId: string | undefined, modelId: string | undefined): void {
  if (!productId || !modelId) return
  try {
    localStorage.setItem(key(productId), modelId)
  } catch {
    // localStorage may be unavailable (private browsing, disabled
    // storage) — fall back silently.
  }
}

/** Look up the previously chosen avatar for a product. Returns null
 *  when no memory exists or storage is unavailable. */
export function recallAvatarForProduct(productId: string | undefined): string | null {
  if (!productId) return null
  try {
    return localStorage.getItem(key(productId))
  } catch {
    return null
  }
}

/** Clear the memory for a product — useful when user changes campaign
 *  direction and wants a fresh avatar. */
export function forgetAvatarForProduct(productId: string | undefined): void {
  if (!productId) return
  try {
    localStorage.removeItem(key(productId))
  } catch {
    // silent
  }
}
