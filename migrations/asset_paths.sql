-- ── Asset Paths Table (P45 — backfill for assetStore.ts) ─────────────────
--
-- assetStore.ts has been writing to `asset_paths` since the Supabase
-- Storage migration, but the migration file for the table itself was
-- missing from the repo. On Supabase projects where the table was
-- never created (or where it was created ad-hoc on the dashboard with
-- no RLS), reads of `asset:xxx` references fall back to the slow
-- storage-list scan AND, more critically, cross-origin reads silently
-- return nothing because RLS denies access.
--
-- Symptom this fixes: after deleting one Vercel project + reloading on
-- the surviving Vercel project (different origin), product thumbnails
-- + generated asset images disappear. localStorage Tier 2 cache is
-- per-origin so it's empty on the new origin, and Tier 3 (asset_paths
-- DB query) hits a missing table / RLS-blocked query and silently
-- fails, then Tier 4 (storage.list scan) needs auth which also fails
-- transiently after the auth session cookie is rebuilt for the new
-- origin.
--
-- APPLY MANUALLY VIA SUPABASE DASHBOARD OR CLI:
--   1. Supabase Dashboard → SQL Editor → New query → paste this file → Run
--   2. OR via CLI: supabase db push (if a CLI workflow is in place)
--
-- ARCHITECTURE NOTES:
--   • One row per (assetId). assetId is the canonical PK — the row IS
--     the assetId → storage path mapping. user_id is recorded for RLS
--     scoping only.
--   • RLS: only the owner can read / write their own rows.
--   • This table is a CACHE (binary lives in storage). On miss the
--     client falls back to storage.list scan which is slower but
--     authoritative.

create extension if not exists "pgcrypto";

create table if not exists asset_paths (
  asset_id   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  path       text not null,
  created_at timestamptz not null default now()
);

-- ── RLS — strict per-user isolation ───────────────────────────────────────

alter table asset_paths enable row level security;

-- read own row only
drop policy if exists asset_paths_select_own on asset_paths;
create policy asset_paths_select_own on asset_paths
  for select using (auth.uid() = user_id);

-- insert own row only
drop policy if exists asset_paths_insert_own on asset_paths;
create policy asset_paths_insert_own on asset_paths
  for insert with check (auth.uid() = user_id);

-- update own row only (upsert path overwrite)
drop policy if exists asset_paths_update_own on asset_paths;
create policy asset_paths_update_own on asset_paths
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- delete own row only
drop policy if exists asset_paths_delete_own on asset_paths;
create policy asset_paths_delete_own on asset_paths
  for delete using (auth.uid() = user_id);

-- ── Indexes — accelerate the per-user folder scan + per-asset lookup ─────

create index if not exists idx_asset_paths_user_id on asset_paths(user_id);
