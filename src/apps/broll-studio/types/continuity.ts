// ── Continuity / Character Memory types (P4) ───────────────────────────────
//
// P4 lifts the photographic engine from "scene generator" to
// "psychology-driven asset system". Continuity is the foundation —
// every pack now has a CharacterMemory that locks identity, ethnicity,
// hijab/outfit policy and realism level across all sections.

/** How tightly identity is preserved across a multi-section pack. */
export type ContinuityLevel =
  | 'NONE'    // Every render independent. Random faces.
  | 'SOFT'    // Same vibe / persona, face may drift.
  | 'LOCKED'  // Same individual across every section.

/** Realism preset — drives camera + lighting + skin-finish prompt fragments. */
export type RealismLevel =
  | 'clean-commercial'   // studio-clean. Allowed for hero / offer.
  | 'ugc-natural'        // believable phone-camera UGC.
  | 'phone-authentic'    // raw smartphone, slight noise.
  | 'messy-real-life'    // genuine candid, imperfect framing.

/**
 * Character memory — extracted from the first generated section (or seeded
 * from avatar bank) and injected into every subsequent section to enforce
 * identity continuity. Free-form strings are intentional — the prompt
 * builder embeds them as natural language. Validation happens at QC time.
 */
export interface CharacterMemory {
  /** Stable id (matches Model id when seeded from bank, else generated). */
  id: string

  /** Demographic identity. */
  gender: 'female' | 'male' | 'unspecified'
  ethnicity: string                          // e.g. "Malay Muslim", "Vietnamese"
  ageRange: string                           // e.g. "30-38"

  /** Visual identity. */
  faceShape?: string                         // e.g. "round", "oval"
  hijabStyle?: string                        // e.g. "modern soft scarf", null if N/A
  skinTone?: string                          // e.g. "warm medium-tan"
  hairStyle?: string                         // ignored when hijab present
  bodyType?: string

  /** Wardrobe palette — drives outfit evolution within the palette. */
  outfitPalette?: string[]                   // e.g. ["muted earth", "soft pastel"]

  /** Default realism for this character. */
  realismLevel: RealismLevel
}

/**
 * Visual memory bag — accumulates ref URLs as a pack renders. The
 * orchestrator stores these between section renders so later sections
 * can be conditioned on earlier ones (hero face ref, lighting ref, etc.).
 */
export interface VisualMemory {
  /** Hero face reference (asset:xxx or URL) — extracted from section 1. */
  heroFaceRef?: string
  /** Outfit references keyed by section name. */
  outfitRefs: Record<string, string>
  /** Lighting / mood references keyed by section name. */
  lightingRefs: Record<string, string>
  moodRefs: Record<string, string>
}

/** Default zero-state visual memory. */
export function emptyVisualMemory(): VisualMemory {
  return { outfitRefs: {}, lightingRefs: {}, moodRefs: {} }
}
