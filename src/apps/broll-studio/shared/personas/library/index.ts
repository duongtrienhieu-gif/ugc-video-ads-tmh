// ── Persona Library Index (P4) ──────────────────────────────────────────────
//
// Single static-import surface for the 5 P4 personas. Add new personas
// here; the persona router (../router.ts) consumes this list.

import type { Persona, PersonaId } from '../../../types/persona'
import { malayMuslimMother } from './malayMuslimMother'
import { youngOfficeWorker } from './youngOfficeWorker'
import { middleAgeFather } from './middleAgeFather'
import { wellnessWoman40s } from './wellnessWoman40s'
import { clinicalExpert } from './clinicalExpert'

export const PERSONAS: readonly Persona[] = [
  malayMuslimMother,
  youngOfficeWorker,
  middleAgeFather,
  wellnessWoman40s,
  clinicalExpert,
] as const

export function getPersona(id: PersonaId): Persona | undefined {
  return PERSONAS.find((p) => p.id === id)
}

export function listPersonaIds(): PersonaId[] {
  return PERSONAS.map((p) => p.id)
}
