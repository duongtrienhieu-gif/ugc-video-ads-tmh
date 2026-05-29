// ── Generations API (P13) ──────────────────────────────────────────────────
//
// Typed Supabase queries for the `creative_generations` table.
//
// CONTRACT:
//   • Every row scoped to a single user via RLS — no cross-user leakage
//   • `outputs_json` holds GeneratedAsset[] (with asset:xxx refs, not blobs)
//   • `inputs_json` holds the full payload so a job can be re-run later
//   • Mutations stamp `user_id` explicitly via requireUserId() — never
//     rely on DB defaults, never let a UI drift cause a foreign-user write

import { supabase, requireUserId } from '../../../lib/supabase'
import type { GeneratedAsset } from '../types/asset'
import type { AssetTypeId } from '../types/asset'

export type GenerationStatus = 'queued' | 'generating' | 'completed' | 'failed'

export interface GenerationInputs {
  productId?: string
  modelId?: string
  referenceRefs?: string[]
  /** Engine-specific options (locale, persona, beat, color theme, etc). */
  options?: Record<string, unknown>
}

export interface GenerationRow {
  id: string
  user_id: string
  creative_type: AssetTypeId
  status: GenerationStatus
  progress: number
  inputs_json: GenerationInputs
  outputs_json: { assets: GeneratedAsset[] }
  error_message: string | null
  created_at: string
  updated_at: string
}

// ── Reads ────────────────────────────────────────────────────────────

/** Fetch the current user's generations, newest first. */
export async function listGenerations(limit = 100): Promise<GenerationRow[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('creative_generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    const code = error.code ? ` [${error.code}]` : ''
    console.error('[generationsAPI.list] full error:', error)
    throw new Error(`[generationsAPI.list]${code} ${error.message}`)
  }
  return (data ?? []) as GenerationRow[]
}

// ── Writes ───────────────────────────────────────────────────────────

export interface InsertGenerationInput {
  creativeType: AssetTypeId
  inputs: GenerationInputs
}

/** Create a 'queued' row and return the persisted id + created_at. */
export async function insertGeneration(input: InsertGenerationInput): Promise<GenerationRow> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('creative_generations')
    .insert({
      user_id: userId,
      creative_type: input.creativeType,
      status: 'queued' as const,
      progress: 0,
      inputs_json: input.inputs,
      outputs_json: { assets: [] },
    })
    .select('*')
    .single()
  if (error || !data) {
    // P17 fix: surface Supabase error code in the thrown message so
    // CreativeStudio.tsx translateJobError can map it to a specific
    // Vietnamese hint (eg 42P01 → "Apply migration SQL").
    const code    = error?.code    ? ` [${error.code}]`   : ''
    const details = error?.details ? ` — ${error.details}` : ''
    const hint    = error?.hint    ? ` (hint: ${error.hint})` : ''
    const reason  = error?.message ?? 'no row returned'
    console.error('[generationsAPI.insert] full error:', error)
    throw new Error(`[generationsAPI.insert]${code} ${reason}${details}${hint}`)
  }
  return data as GenerationRow
}

export interface UpdateGenerationPatch {
  status?: GenerationStatus
  progress?: number
  outputs?: GeneratedAsset[]
  errorMessage?: string | null
}

/** Update a row's status / progress / outputs / error. */
export async function updateGeneration(id: string, patch: UpdateGenerationPatch): Promise<void> {
  const dbPatch: Partial<GenerationRow> & { outputs_json?: { assets: GeneratedAsset[] } } = {}
  if (patch.status !== undefined)        dbPatch.status        = patch.status
  if (patch.progress !== undefined)      dbPatch.progress      = patch.progress
  if (patch.outputs !== undefined)       dbPatch.outputs_json  = { assets: patch.outputs }
  if (patch.errorMessage !== undefined)  dbPatch.error_message = patch.errorMessage

  const { error } = await supabase
    .from('creative_generations')
    .update(dbPatch)
    .eq('id', id)
  if (error) throw new Error(`[generationsAPI.update] ${error.message}`)
}

/** Hard-delete a generation row. (Image blobs stay in IndexedDB — they
 *  may still be referenced by saved B-rolls; deleting them is a
 *  separate concern.) */
export async function deleteGeneration(id: string): Promise<void> {
  const { error } = await supabase
    .from('creative_generations')
    .delete()
    .eq('id', id)
  if (error) throw new Error(`[generationsAPI.delete] ${error.message}`)
}
