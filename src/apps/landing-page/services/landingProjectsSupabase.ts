// landingProjectsSupabase.ts — Phase H2
//
// Supabase-backed CRUD for the `landing_projects` table. Provides the
// network half of the local-first + sync architecture. Every function is
// defensive: if the table doesn't exist, the user isn't authenticated, or
// network is down, we silently degrade — the localStorage source of truth
// keeps working unchanged.
//
// See SUPABASE_LANDING_PROJECTS_MIGRATION.md for the SQL to run once before
// these functions can actually persist anything.

import { supabase } from '../../../lib/supabase'
import type { LandingPagePack, SavedLandingPack } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────

/** Row shape as it exists in the `landing_projects` table. */
interface ProjectRow {
  id: string
  user_id: string
  title: string
  product_id: string | null
  product_name: string | null
  language: string | null
  pack_json: LandingPagePack
  is_archived: boolean
  created_at: string  // ISO timestamp
  updated_at: string
}

/** Local-side opt-out — lets a power user disable Supabase sync per browser. */
const LOCAL_DISABLE_KEY = 'ugc-lab:landing-projects:supabase-disabled'

export function isSupabaseSyncDisabled(): boolean {
  try {
    return localStorage.getItem(LOCAL_DISABLE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setSupabaseSyncDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem(LOCAL_DISABLE_KEY, 'true')
    else localStorage.removeItem(LOCAL_DISABLE_KEY)
  } catch {/* silent */}
}

// ── Row ↔ SavedLandingPack converters ──────────────────────────────────────

function rowToSavedPack(row: ProjectRow): SavedLandingPack {
  return {
    ...row.pack_json,
    // Override identity fields from the row columns (source of truth)
    id: row.id,
    title: row.title,
    productId: row.product_id ?? row.pack_json.productId,
    productName: row.product_name ?? row.pack_json.productName,
    language: (row.language as SavedLandingPack['language']) ?? row.pack_json.language,
    createdAt: new Date(row.created_at).getTime(),
  }
}

function savedPackToInsert(pack: SavedLandingPack, userId: string): Omit<ProjectRow, 'created_at' | 'updated_at'> {
  return {
    id: pack.id,
    user_id: userId,
    title: pack.title,
    product_id: pack.productId || null,
    product_name: pack.productName || null,
    language: pack.language || null,
    pack_json: {
      // Strip identity fields out of the JSONB — they're in the columns
      productId:    pack.productId,
      productName:  pack.productName,
      language:     pack.language,
      sections:     pack.sections,
      visualMemory: pack.visualMemory,
      generatedAt:  pack.generatedAt,
    },
    is_archived: false,
  }
}

// ── Result type — always succeeds at the contract level, signals failures ─

export interface SyncResult<T> {
  ok: boolean
  data: T | null
  error?: string
  /** True when the operation was skipped because Supabase is unavailable
   *  (table missing, user logged out, opt-out flag set). Caller should
   *  continue with localStorage as if nothing happened. */
  skipped?: boolean
}

// ── Public CRUD ────────────────────────────────────────────────────────────

/**
 * Fetch all non-archived projects belonging to the current user.
 * Returns [] on any failure — caller falls back to localStorage.
 */
export async function fetchAllProjects(): Promise<SyncResult<SavedLandingPack[]>> {
  if (isSupabaseSyncDisabled()) return { ok: true, data: [], skipped: true }

  try {
    const { data, error } = await supabase
      .from('landing_projects')
      .select('*')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })

    if (error) {
      // Common: 42P01 (table missing) → degrade gracefully
      const code = (error as { code?: string }).code
      if (code === '42P01' || error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return { ok: true, data: [], skipped: true }
      }
      // Auth errors (401/403) → user not logged in / no RLS access
      return { ok: false, data: null, error: error.message }
    }

    return { ok: true, data: (data ?? []).map((row) => rowToSavedPack(row as ProjectRow)) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, data: null, error: msg }
  }
}

/**
 * Insert or update a project. Idempotent — running it twice with the same
 * id replaces the row. Used by every store mutation that should sync.
 */
export async function upsertProject(pack: SavedLandingPack): Promise<SyncResult<SavedLandingPack>> {
  if (isSupabaseSyncDisabled()) return { ok: true, data: null, skipped: true }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: true, data: null, skipped: true }

    const row = savedPackToInsert(pack, user.id)
    const { data, error } = await supabase
      .from('landing_projects')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      const code = (error as { code?: string }).code
      if (code === '42P01') return { ok: true, data: null, skipped: true }
      return { ok: false, data: null, error: error.message }
    }
    return { ok: true, data: rowToSavedPack(data as ProjectRow) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, data: null, error: msg }
  }
}

/** Delete a project by id. */
export async function deleteProject(id: string): Promise<SyncResult<true>> {
  if (isSupabaseSyncDisabled()) return { ok: true, data: null, skipped: true }

  try {
    const { error } = await supabase
      .from('landing_projects')
      .delete()
      .eq('id', id)

    if (error) {
      const code = (error as { code?: string }).code
      if (code === '42P01') return { ok: true, data: null, skipped: true }
      return { ok: false, data: null, error: error.message }
    }
    return { ok: true, data: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, data: null, error: msg }
  }
}

/** Soft-delete: flip is_archived = true. */
export async function archiveProject(id: string): Promise<SyncResult<true>> {
  if (isSupabaseSyncDisabled()) return { ok: true, data: null, skipped: true }

  try {
    const { error } = await supabase
      .from('landing_projects')
      .update({ is_archived: true })
      .eq('id', id)

    if (error) {
      const code = (error as { code?: string }).code
      if (code === '42P01') return { ok: true, data: null, skipped: true }
      return { ok: false, data: null, error: error.message }
    }
    return { ok: true, data: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, data: null, error: msg }
  }
}

/** Update just the title (avoids rewriting the whole pack_json). */
export async function renameProject(id: string, title: string): Promise<SyncResult<true>> {
  if (isSupabaseSyncDisabled()) return { ok: true, data: null, skipped: true }

  try {
    const { error } = await supabase
      .from('landing_projects')
      .update({ title })
      .eq('id', id)

    if (error) {
      const code = (error as { code?: string }).code
      if (code === '42P01') return { ok: true, data: null, skipped: true }
      return { ok: false, data: null, error: error.message }
    }
    return { ok: true, data: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, data: null, error: msg }
  }
}

// ── Convenience: detect whether the table exists at all ───────────────────
//
// Called once on app boot to decide whether to even attempt sync. Caches the
// result in memory so subsequent calls are free.

let _tableExistsCache: boolean | null = null

export async function checkTableExists(): Promise<boolean> {
  if (_tableExistsCache !== null) return _tableExistsCache
  if (isSupabaseSyncDisabled()) {
    _tableExistsCache = false
    return false
  }
  try {
    const { error } = await supabase
      .from('landing_projects')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    if (error) {
      const code = (error as { code?: string }).code
      if (code === '42P01') {
        _tableExistsCache = false
        return false
      }
      // Auth / RLS errors still mean the table exists
      _tableExistsCache = true
      return true
    }
    _tableExistsCache = true
    return true
  } catch {
    _tableExistsCache = false
    return false
  }
}

/** Reset the cache — used in tests / dev. */
export function resetTableExistsCache(): void {
  _tableExistsCache = null
}

// ── Merge strategy: localStorage + Supabase → canonical list ──────────────

/**
 * Merge two arrays of SavedLandingPack by id. Conflict resolution:
 * latest `createdAt` wins. (We use createdAt because it's stamped in local
 * mutations, while Supabase `updated_at` lives on the server row only.)
 *
 * Future enhancement: persist a per-pack `updatedAt` field locally and
 * pick by that instead. For now createdAt is good enough because the
 * Canva-style auto-sync rewrites the whole pack on every change anyway.
 */
export function mergeProjects(
  local: SavedLandingPack[],
  remote: SavedLandingPack[],
): SavedLandingPack[] {
  const byId = new Map<string, SavedLandingPack>()
  for (const p of local)  byId.set(p.id, p)
  for (const p of remote) {
    const existing = byId.get(p.id)
    if (!existing || p.createdAt > existing.createdAt) {
      byId.set(p.id, p)
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt)
}
