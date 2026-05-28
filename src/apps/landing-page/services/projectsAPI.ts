// ─────────────────────────────────────────────────────────────────────
// Landing Projects Supabase API — shared backend for Landing Page AI
// and Super Ladipage. Each project is stored as one row in the
// `landing_projects` table with a `kind` discriminator so the two apps
// stay logically separate while sharing the schema + index + RLS rules.
//
// All functions gracefully degrade: if the table doesn't exist, the
// network is down, or the user isn't logged in, the calls return
// null/false instead of throwing. Callers continue with localStorage as
// the offline cache (zustand persist middleware) — never crash.
// ─────────────────────────────────────────────────────────────────────

import { supabase, requireUserId } from '../../../lib/supabase'

/** Discriminator — keeps Landing Page AI and Super Ladipage separated
 *  even though they share one table. */
export type ProjectKind = 'landing-page' | 'super-ladipage'

/** Minimal subset of LandingPagePack that the row-level columns mirror.
 *  Kept loose so both apps (landing-page + super-ladipage) which have
 *  structurally-similar-but-distinct pack types can share this API. */
interface PackShape {
  productId?: string
  productName?: string
  language?: string
}

/** Minimal subset of SavedLandingPack that the row carries directly.
 *  The full pack body lives in pack_json. */
interface SavedShape extends PackShape {
  id: string
  title: string
  createdAt: number
}

interface ProjectRow {
  id: string
  user_id: string
  kind: ProjectKind
  title: string
  product_id: string | null
  product_name: string | null
  language: string | null
  pack_json: unknown
  is_archived: boolean
  created_at: string
  updated_at: string
}

/** Map a raw Supabase row back into the shape callers expect. We trust
 *  pack_json to contain the full app-specific SavedLandingPack body and
 *  overlay the row-level id / title / createdAt on top so they remain
 *  authoritative even if pack_json carries a stale snapshot. */
function rowToSavedPack<T extends SavedShape>(row: ProjectRow): T {
  return {
    ...(row.pack_json as T),
    id: row.id,
    title: row.title,
    createdAt: new Date(row.created_at).getTime(),
  }
}

/** Fetch all non-archived projects for the given kind belonging to the
 *  current user. Returns `null` on any failure so the caller can keep
 *  the localStorage cache as-is (no destructive override on fetch fail). */
export async function listProjects<T extends SavedShape>(kind: ProjectKind): Promise<T[] | null> {
  try {
    const user_id = await requireUserId()
    const { data, error } = await supabase
      .from('landing_projects')
      .select('*')
      .eq('user_id', user_id)
      .eq('kind', kind)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
    if (error) {
      console.warn(`[projectsAPI] list ${kind} failed:`, error.message)
      return null
    }
    return (data as ProjectRow[]).map((r) => rowToSavedPack<T>(r))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[projectsAPI] list ${kind} threw:`, msg)
    return null
  }
}

/** Insert a new project. The caller's saved.id is preserved so the
 *  local store and Supabase agree on the same UUID. */
export async function createProject<T extends SavedShape>(kind: ProjectKind, saved: T): Promise<boolean> {
  try {
    const user_id = await requireUserId()
    const { error } = await supabase
      .from('landing_projects')
      .insert({
        id: saved.id,
        user_id,
        kind,
        title: saved.title,
        product_id: saved.productId ?? null,
        product_name: saved.productName ?? null,
        language: saved.language ?? null,
        pack_json: saved,
      })
    if (error) {
      console.warn(`[projectsAPI] create ${kind} failed:`, error.message)
      return false
    }
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[projectsAPI] create ${kind} threw:`, msg)
    return false
  }
}

/** Update the pack contents (and optionally the title) for an existing
 *  project. Caller passes the full pack so we can re-derive product_id /
 *  product_name / language at the row level for fast SQL filtering. */
export async function updateProject<T extends PackShape>(
  kind: ProjectKind,
  id: string,
  pack: T,
  title?: string,
): Promise<boolean> {
  try {
    const user_id = await requireUserId()
    const patch: Record<string, unknown> = {
      pack_json: pack,
      product_id: pack.productId ?? null,
      product_name: pack.productName ?? null,
      language: pack.language ?? null,
    }
    if (title !== undefined) patch.title = title
    const { error } = await supabase
      .from('landing_projects')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user_id)
      .eq('kind', kind)
    if (error) {
      console.warn(`[projectsAPI] update ${kind} failed:`, error.message)
      return false
    }
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[projectsAPI] update ${kind} threw:`, msg)
    return false
  }
}

/** Permanently delete a project (no soft-delete via is_archived for now —
 *  matches the existing UX where "Xoá vĩnh viễn" is a single-step action). */
export async function deleteProject(kind: ProjectKind, id: string): Promise<boolean> {
  try {
    const user_id = await requireUserId()
    const { error } = await supabase
      .from('landing_projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)
      .eq('kind', kind)
    if (error) {
      console.warn(`[projectsAPI] delete ${kind} failed:`, error.message)
      return false
    }
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[projectsAPI] delete ${kind} threw:`, msg)
    return false
  }
}
