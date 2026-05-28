// ── Persona Router (P4) ─────────────────────────────────────────────────────
//
// Given form intent (tags like "gut-health", "men-vitality", "skincare-premium")
// pick the best-matching persona from the library by intentTag overlap.
// Deterministic — first match wins, ties broken by library order.

import type { Persona, PersonaId } from '../../types/persona'
import { PERSONAS, getPersona } from './library'

/**
 * Score a persona against a set of intent tags. Each overlap = 1 point.
 * Higher is better. Returns 0 if no overlap.
 */
function scorePersona(persona: Persona, intentTags: readonly string[]): number {
  let score = 0
  for (const tag of intentTags) {
    if (persona.intentTags.includes(tag)) score += 1
  }
  return score
}

/**
 * Route a list of intent tags to the best persona. Falls back to the
 * provided defaultId, or the first library entry, if no persona matches.
 */
export function routePersona(
  intentTags: readonly string[],
  defaultId: PersonaId = 'malay_muslim_mother',
): Persona {
  let best: { persona: Persona; score: number } | null = null
  for (const persona of PERSONAS) {
    const score = scorePersona(persona, intentTags)
    if (score === 0) continue
    if (best == null || score > best.score) {
      best = { persona, score }
    }
  }
  if (best) return best.persona
  return getPersona(defaultId) ?? PERSONAS[0]!
}
