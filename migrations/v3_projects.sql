-- ── v3 Projects Library Table (Z38) ────────────────────────────────────────
--
-- Z38 — Cross-device sync for the v3 Ads Video Engine project library
-- (Z35 §8 — saved projects with name / tags / isWinner / snapshot).
--
-- Mirrors the Z35 SavedProject shape:
--   { id, name, productName, avatarName, snapshot{...}, tags[], isWinner,
--     thumbRef?, createdAt, lastEditedAt }
--
-- APPLY MANUALLY VIA SUPABASE DASHBOARD OR CLI:
--   1. Supabase Dashboard → SQL Editor → New query → paste this file → Run
--   2. OR via CLI: supabase db push
--
-- ARCHITECTURE NOTES:
--   • One row per saved project. user_id foreign-keyed → owner.
--   • snapshot_json holds the entire V3PipelineState slice (inputs +
--     scriptBrain + creatorVideoConfig + creatorVideo + inserts + autoEdit).
--     Asset:xxx refs inside the snapshot still resolve via IndexedDB
--     locally — Z38 doesn't upload media to Supabase, only metadata.
--   • tags is a string[] for filtering.
--   • is_winner is a separate column (not in JSON) so we can index +
--     sort efficiently.
--   • thumb_ref is nullable.
--   • RLS scopes to owner only.

create extension if not exists "pgcrypto";

create table if not exists v3_projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Display metadata (denormalised for cheap list rendering)
  name            text not null,
  product_name    text not null default '',
  avatar_name     text not null default '',
  thumb_ref       text,
  tags            text[] not null default '{}',
  is_winner       boolean not null default false,

  -- The full V3PipelineState snapshot (input/script/creator/inserts/autoEdit)
  snapshot_json   jsonb not null,

  created_at      timestamptz not null default now(),
  last_edited_at  timestamptz not null default now()
);

-- ── Auto-bump last_edited_at on UPDATE ─────────────────────────────────────

create or replace function set_v3_projects_last_edited_at()
returns trigger as $$
begin
  new.last_edited_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists v3_projects_last_edited_at on v3_projects;
create trigger v3_projects_last_edited_at
  before update on v3_projects
  for each row execute function set_v3_projects_last_edited_at();

-- ── RLS — strict per-user isolation ────────────────────────────────────────

alter table v3_projects enable row level security;

drop policy if exists v3_projects_select_own on v3_projects;
create policy v3_projects_select_own on v3_projects
  for select using (auth.uid() = user_id);

drop policy if exists v3_projects_insert_own on v3_projects;
create policy v3_projects_insert_own on v3_projects
  for insert with check (auth.uid() = user_id);

drop policy if exists v3_projects_update_own on v3_projects;
create policy v3_projects_update_own on v3_projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists v3_projects_delete_own on v3_projects;
create policy v3_projects_delete_own on v3_projects
  for delete using (auth.uid() = user_id);

-- ── Indexes — accelerate the library listing query ─────────────────────────

create index if not exists idx_v3_projects_user_id on v3_projects(user_id);
create index if not exists idx_v3_projects_user_winner_edited
  on v3_projects(user_id, is_winner desc, last_edited_at desc);
