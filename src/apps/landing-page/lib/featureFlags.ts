// ── Feature flags for LandingPage AI hybrid-render refactor ────────────────
//
// Single source of truth for ENABLE_HYBRID_RENDER. Read by:
//   - renderPlanner.ts (classify strategies)
//   - generateImages.ts (route by strategy)
//   - OutputPanel.tsx (metrics chip visibility)
//
// Resolution order (first non-null wins):
//   1. localStorage override — `ugc-lab:feature:hybrid-render` = 'true' | 'false'
//      (per-browser, useful for QA / A-B / emergency rollback without deploy)
//   2. Vite env var — VITE_ENABLE_HYBRID_RENDER = 'true' | 'false'
//      (deploy-time toggle, lives in Vercel env)
//   3. DEFAULT — false (legacy AI-full-render flow, stable-render-v1 behavior)
//
// IMPORTANT: This file exists in stable-render-v1's backup branch as a stub
// returning `false`. Phase 1+ ships the real flag-aware logic. Until then,
// every call to isHybridRenderEnabled() returns false → legacy path runs
// exactly as before.

const LOCAL_STORAGE_KEY = 'ugc-lab:feature:hybrid-render'

/** Vite-style env access — guarded so we don't crash in non-Vite contexts. */
function readEnvFlag(): boolean | null {
  try {
    // import.meta.env is replaced by Vite at build time.
    const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ENABLE_HYBRID_RENDER
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {/* silent — not in vite environment */}
  return null
}

/** localStorage override — instant per-browser toggle (no redeploy). */
function readLocalStorageFlag(): boolean | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {/* silent — SSR / privacy mode */}
  return null
}

/**
 * Is the hybrid render pipeline enabled for this user session?
 *
 * Default: FALSE — legacy AI-full-render path runs.
 *
 * Override precedence: localStorage > env var > default.
 */
export function isHybridRenderEnabled(): boolean {
  // V4 QUALITY HOTFIX — hybrid is FORCE-DISABLED unconditionally.
  //
  // The composer dispatch (FB/Shopee/TikTok screenshot canvases, before-after
  // collage, promo-banner overlay) was producing the obvious "AI showcase"
  // look that users instantly spot as fake (centered product, designed UI
  // overlays, floating bottles). Quality > credit savings.
  //
  // Even if a tester previously set localStorage["ugc-lab:feature:hybrid-render"]
  // = "true" or VITE_ENABLE_HYBRID_RENDER=true, we ignore both and ALWAYS
  // return false. To re-enable in the future, delete this short-circuit and
  // restore the original precedence chain (kept below for reference).
  return false

  // ── original precedence (kept commented for future restoration) ──
  // const ls = readLocalStorageFlag()
  // if (ls !== null) return ls
  // const env = readEnvFlag()
  // if (env !== null) return env
  // return false
}

/** For UI debug — shows where the flag value came from. */
export function getHybridRenderFlagSource(): 'localStorage' | 'env' | 'default' {
  if (readLocalStorageFlag() !== null) return 'localStorage'
  if (readEnvFlag() !== null) return 'env'
  return 'default'
}

/** Console helper — call `__setHybridRender(true|false)` from DevTools to toggle. */
if (typeof window !== 'undefined') {
  ;(window as unknown as { __setHybridRender?: (v: boolean) => void }).__setHybridRender = (v: boolean) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(v))
      console.info(`[featureFlags] hybrid-render → ${v}. Reload page to take effect.`)
    } catch (err) {
      console.warn('[featureFlags] could not set:', err)
    }
  }
}
