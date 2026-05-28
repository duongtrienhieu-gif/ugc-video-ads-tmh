// ═════════════════════════════════════════════════════════════════════
// Image Semantics — type definitions
//
// POST-REBUILD (2026-05-27): radically slimmed. The 9-axis fragment
// system was deleted along with intentMaps / fragmentMaps / 3 adapters.
//
// What remains in ImageIntent: just the imageRole carrier (used by
// orchestrator for reference selection + planning) + an intentNote stub
// for legacy callers. Per-image prompt is now produced by the
// imageSceneSynthesis module from section text, NOT from these axes.
// ═════════════════════════════════════════════════════════════════════

import type { VisualSemanticsSection, VisualSemanticsPage } from '../visualSemantics'
import type { ImageRole } from '../composer'

export type { ImageRole }

// ─── ImageIntent — slim per-section governance carrier ─────────────

export interface ImageIntent {
  /** Re-export of composer's ImageRole — drives renderer routing + ref picking. */
  imageRole: ImageRole
  /** INTERNAL governance note — stub kept for type compatibility. */
  intentNote: string
}

// ─── ImageIntentSection extends VisualSemanticsSection ─────────────

export interface ImageIntentSection extends VisualSemanticsSection {
  /** Present only when imageRole !== 'none'. */
  imageIntent?: ImageIntent
}

// ─── ImageIntentPage extends VisualSemanticsPage ───────────────────

export interface ImageIntentPage extends VisualSemanticsPage {
  sections: ImageIntentSection[]
  /** Soft contradiction warnings (no-op post-rebuild, always empty). */
  imageIntentWarnings: string[]
  /** Count of sections that received an imageIntent (image roles !== none). */
  imageBearingSectionCount: number
}
