// ═════════════════════════════════════════════════════════════════════
// Proof System — type definitions (P1 foundation)
//
// Proof = INDEPENDENT conversion system. NOT storytelling accessory.
// Module sandbox: src/apps/super-ladipage/proof/
//
// Philosophy lock:
//   Proof should feel slightly messy, not fully optimized, not fully
//   certain, sometimes underwritten. Real people hedge / ramble /
//   contradict slightly / speak unevenly.
//
//   DO NOT optimize proof toward perfect testimonial writing.
//   Optimize toward believable human traces.
// ═════════════════════════════════════════════════════════════════════

import type { NicheKey } from '../storytelling/types'

// ── Re-export NicheKey so proof consumers chỉ cần import từ proof/types ──
export type { NicheKey }

// ─── Stance archetypes — WHO speaks + HOW ──────────────────────────

export type ProofStanceId =
  | 'cautious-believer'        // "Tôi không khen lung tung — nhưng cái này khác thật"
  | 'slow-converter'           // "Mất X tháng tôi mới chịu công nhận"
  | 'accidentally-impressed'   // "Mua thử cho có. Không ngờ..."
  | 'skeptical-recommender'    // "Tôi đã thử nhiều, đây là cái duy nhất tôi share lại"
  | 'still-using-uncertain'    // "Vẫn đang dùng. Chưa biết có phải nhờ nó không..."
  | 'second-hand-reporter'     // "Mẹ tôi dùng, mình thấy mẹ đỡ"
  | 'anti-hype-blunt'          // "Không thần kỳ đâu nhưng. Đỡ thật."

export type CertaintyLevel = 'hedged' | 'mild' | 'strong' | 'uncertain'
export type EnthusiasmLevel = 'flat' | 'mild' | 'occasional-strong'
export type SentenceQuality = 'fragments-OK' | 'casual' | 'attempted-coherent'

export interface ProofStance {
  id: ProofStanceId
  /** 1-line voice tendency. */
  voice: string
  certaintyLevel: CertaintyLevel
  enthusiasmLevel: EnthusiasmLevel
  sentenceQuality: SentenceQuality
  /** 2-3 trademark phrases/behaviors that signal this stance. */
  characteristicMoves: string[]
  /** 2 niche-mismatched example quotes — teach SHAPE not verbatim. */
  exampleQuotesMismatched: string[]
}

// ─── Phase resonance — proof maps to story phase (P2 distribution-ready) ─

export type ProofPhase =
  | 'recognition'    // "tôi cũng gặp" — identification proof
  | 'trust'          // vulnerable/shared experience
  | 'solution'       // skepticism reduction — "tôi cũng từng nghi rồi thử"
  | 'future-self'    // transformation validation — "đã dùng X tháng"
  | 'cta'            // risk reduction + reassurance — "vẫn đang dùng đều"

// ─── Entropy axes — anti-polish realism variation ──────────────────

export type EntropyGrammar = 'full' | 'casual' | 'fragments'
export type EntropyEffort = 'one-sentence' | 'two-sentence' | 'paragraph-fragment'
export type EntropyEmojiDensity = 'zero' | 'one-max' | 'occasional'
export type EntropyAuthorInfo = 'name-age' | 'nickname-only' | 'generic-reader'

export interface EntropyProfile {
  grammar: EntropyGrammar
  certainty: CertaintyLevel
  effort: EntropyEffort
  emojiDensity: EntropyEmojiDensity
  authorInfoRichness: EntropyAuthorInfo
}

// ─── Niche-specific proof texture ──────────────────────────────────

export interface ProofTextureProfile {
  niche: NicheKey
  /** Typical voice age + demographic for this niche's proof. */
  typicalVoice: string
  /** Common platform feel (FB comment / DM / TikTok reply / Shopee review). */
  platformFeel: string
  /** Specific texture cues per niche (vd haircare → counting hair detail). */
  textureCues: string[]
  /** What this niche's proof should AVOID (anti-stereotypes). */
  avoidPatterns: string[]
}

// ─── Reader objections per niche ───────────────────────────────────

export interface ObjectionEntry {
  /** Reader's unspoken objection. */
  objection: string
  /** What counter-proof posture addresses it (NOT direct refute — emotional bypass). */
  counterPosture: string
}

export interface NicheObjections {
  niche: NicheKey
  objections: ObjectionEntry[]
}

// ─── Per-piece config (sampled per pack — 3 pieces × distinct configs) ─

export interface ProofPieceConfig {
  /** Stance — sampled, distinct across pieces in same pack. */
  stance: ProofStance
  /** Phase resonance — sampled, distinct across pieces. */
  phaseResonance: ProofPhase
  /** Entropy profile — sampled per piece, variety enforced. */
  entropy: EntropyProfile
  /** Optional — if pack has skeptical reader profile, this piece counter
   *  a specific objection (sampled from niche's objection pool). */
  counterObjection?: ObjectionEntry
}

export interface ProofConfig {
  /** Always 3 pieces in P1 (fixed). */
  pieces: ProofPieceConfig[]
  /** Texture profile for this pack's niche. */
  texture: ProofTextureProfile
}

// ─── Output (compatible with existing ParsedReview shape) ──────────

export interface ProofPiece {
  quote: string
  author?: string
  meta?: string
  /** Optional metadata for telemetry — which stance generated this. */
  stanceId?: ProofStanceId
  /** Optional — which phase this piece resonates with (P2 distribution). */
  phaseResonance?: ProofPhase
}
