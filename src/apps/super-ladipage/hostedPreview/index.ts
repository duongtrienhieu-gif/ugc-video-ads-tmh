// ─────────────────────────────────────────────────────────────────────
// Hosted Preview — public API barrel (INT)
//
// Hash-based detection + standalone preview shell. Loads LandingSession
// from IndexedDB by ID, renders chrome-less for marketer share.
// ─────────────────────────────────────────────────────────────────────

export { HostedPreviewPage } from './HostedPreviewPage'
export {
  usePreviewRouting,
  extractPreviewSessionId,
  buildPreviewUrl,
} from './usePreviewRouting'
