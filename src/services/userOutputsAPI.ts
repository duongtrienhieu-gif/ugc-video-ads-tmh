// ─────────────────────────────────────────────────────────────────────
// User Outputs Supabase API — shared cloud sync layer for user-generated
// outputs that don't fit the bankStore canonical tables.
//
// One row in `public.user_outputs` represents ONE saved output. The
// `kind` column discriminates which feature owns the row, so the table
// scales to additional feature families without schema churn.
//
// Known kinds (keep in sync with each feature's store):
//   • 'ad-win-template'         → src/stores/adTemplateStore.ts
//   • 'ads-content'             → src/apps/ads-content/store.ts
//   • 'lab-content'             → src/apps/lab-content/store.ts
//   • 'lip-sync-history'        → src/stores/lipSyncStore.ts
//   • 'video-translate-history' → src/stores/videoTranslateStore.ts
//   • 'chat-bot-config'         → src/apps/chat-bot/store.ts
//
// Every function gracefully degrades — returns null/false on any
// failure so callers can keep their localStorage cache intact. Never
// throws so the UI stays responsive when offline / not logged in /
// before the migration SQL has been run.
// ─────────────────────────────────────────────────────────────────────

import { supabase, requireUserId } from '../lib/supabase'

export type OutputKind =
  | 'ad-win-template'
  | 'ads-content'
  | 'lab-content'
  | 'lip-sync-history'
  | 'video-translate-history'
  | 'brand-kit'
  | 'chat-bot-config'

/** Minimum required fields any output item must expose. The full body
 *  lives in `payload_json`; the row-level fields are for fast listing
 *  + ordering without parsing the JSON blob. */
interface OutputItem {
  id: string
  /** Display label — falls back to a derived label if not set. */
  title?: string
  createdAt: number
}

interface OutputRow {
  id: string
  user_id: string
  kind: OutputKind
  title: string | null
  payload_json: unknown
  created_at: string
  updated_at: string
}

/** Map a Supabase row into the shape the caller's store expects. We
 *  trust `payload_json` to be the full item, but overlay the row-level
 *  id / title / createdAt to keep them authoritative even if the JSON
 *  copy is stale (eg the row was titled-renamed since payload was
 *  written). */
function rowToItem<T extends OutputItem>(row: OutputRow): T {
  const base = (row.payload_json as T) ?? ({} as T)
  return {
    ...base,
    id: row.id,
    title: row.title ?? base.title,
    createdAt: new Date(row.created_at).getTime(),
  } as T
}

/** Fetch all rows of `kind` for the current user, newest-first by
 *  updated_at. Returns null on any failure (table missing / RLS /
 *  network / not logged in) so caller can keep the localStorage cache
 *  as-is rather than wiping it with an empty list. */
export async function listOutputs<T extends OutputItem>(kind: OutputKind): Promise<T[] | null> {
  try {
    const user_id = await requireUserId()
    const { data, error } = await supabase
      .from('user_outputs')
      .select('*')
      .eq('user_id', user_id)
      .eq('kind', kind)
      .order('updated_at', { ascending: false })
    if (error) {
      console.warn(`[userOutputsAPI] list ${kind} failed:`, error.message)
      return null
    }
    return (data as OutputRow[]).map((r) => rowToItem<T>(r))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[userOutputsAPI] list ${kind} threw:`, msg)
    return null
  }
}

/** Insert one row. Caller-supplied id is preserved so memory state +
 *  Supabase agree on the same UUID. Title is optional but recommended
 *  for fast searchable listings. */
export async function createOutput<T extends OutputItem>(
  kind: OutputKind,
  item: T,
  title?: string,
): Promise<boolean> {
  try {
    const user_id = await requireUserId()
    const { error } = await supabase
      .from('user_outputs')
      .insert({
        id: item.id,
        user_id,
        kind,
        title: title ?? item.title ?? null,
        payload_json: item,
      })
    if (error) {
      console.warn(`[userOutputsAPI] create ${kind} failed:`, error.message)
      return false
    }
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[userOutputsAPI] create ${kind} threw:`, msg)
    return false
  }
}

/** Update the payload (and optionally the row-level title). Pass the
 *  FULL item so the JSON blob stays in sync — partial updates leave
 *  stale fields behind. */
export async function updateOutput<T extends OutputItem>(
  kind: OutputKind,
  id: string,
  item: T,
  title?: string,
): Promise<boolean> {
  try {
    const user_id = await requireUserId()
    const patch: Record<string, unknown> = { payload_json: item }
    if (title !== undefined) patch.title = title
    const { error } = await supabase
      .from('user_outputs')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user_id)
      .eq('kind', kind)
    if (error) {
      console.warn(`[userOutputsAPI] update ${kind} failed:`, error.message)
      return false
    }
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[userOutputsAPI] update ${kind} threw:`, msg)
    return false
  }
}

/** Permanently delete a row. */
export async function deleteOutput(kind: OutputKind, id: string): Promise<boolean> {
  try {
    const user_id = await requireUserId()
    const { error } = await supabase
      .from('user_outputs')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)
      .eq('kind', kind)
    if (error) {
      console.warn(`[userOutputsAPI] delete ${kind} failed:`, error.message)
      return false
    }
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[userOutputsAPI] delete ${kind} threw:`, msg)
    return false
  }
}
