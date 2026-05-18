// ── Persona Type Contract (P4) ──────────────────────────────────────────────
//
// Persona = a reusable character archetype (appearance + environment +
// demographic tags) that can be composed into a photographic prompt
// independently of any specific Model bank entry.
//
// Personas are STATIC metadata. They live in
// shared/metadata/personaLibrary.ts and are looked up by id at prompt
// build time, the same way StyleVariant works.
//
// Distinction vs Model bank:
//   • Model (bankStore)  → user-uploaded character image + jsonProfile,
//                          identity-locked via reference image
//   • Persona            → text-only archetype lock, no reference image
//                          required, useful when the user wants a
//                          generic "Vietnamese office woman, mid-20s"
//                          without curating a model
//
// A photographic generation can use either, both, or neither:
//   • model only  → identity lock via reference image
//   • persona only → text-described archetype, KIE imagines the face
//   • both        → persona constrains demographic, model locks identity
//   • neither     → product-only render (e.g. clean packshot)

import type { AssetCategory } from './asset'

/** Demographic/contextual tags that callers can filter personas by. */
export type PersonaDemographicTag =
  | 'female' | 'male'
  | 'gen-z' | 'millennial' | 'gen-x' | 'boomer'
  | 'vietnamese' | 'malaysian' | 'thai' | 'indonesian' | 'filipino' | 'sea-generic'
  | 'office-worker' | 'homemaker' | 'student' | 'parent' | 'retiree'
  | 'hijab' | 'no-hijab'
  | 'urban' | 'suburban' | 'rural'

/** A reusable character archetype usable across photographic modules. */
export interface Persona {
  id: string
  /** UI display label — Vietnamese first per Phase 7 spec. */
  label: { vi: string; en: string }
  /** 60-100 word block describing physical appearance, baked into prompt. */
  appearance: string
  /** 40-60 word block describing typical environment / context. */
  environment: string
  /** Tone / voice / personality cues for caption + script consistency. */
  voiceCharacter: string
  /** Filter tags — used by UI pickers and registry queries. */
  demographicTags: PersonaDemographicTag[]
  /** Asset categories this persona is appropriate for (UI hint). */
  suitableFor: AssetCategory[]
}
