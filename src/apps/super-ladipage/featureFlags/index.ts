// ─────────────────────────────────────────────────────────────────────
// Feature Flags — internal beta gating (INT)
//
// Reads Vite env vars at build time. Vercel env var:
//   VITE_INTERNAL_BETA=true
//
// All UI features gated by isInternalBeta() are HIDDEN by default.
// Internal users get the flag set via Vercel dashboard / .env.local.
// ─────────────────────────────────────────────────────────────────────

/** True when VITE_INTERNAL_BETA env var is exactly 'true'. */
export function isInternalBeta(): boolean {
  const raw = import.meta.env.VITE_INTERNAL_BETA
  return raw === 'true' || raw === '1'
}

/** True when running on Vercel preview deployment (vs production). */
export function isVercelPreview(): boolean {
  return import.meta.env.VITE_VERCEL_ENV === 'preview'
}

/** Returns a human-readable label of the current environment for badges. */
export function getEnvLabel(): string {
  if (isInternalBeta()) return 'BETA'
  if (isVercelPreview()) return 'PREVIEW'
  if (import.meta.env.DEV) return 'DEV'
  return ''
}
