-- ── User Settings Table (Z38) ──────────────────────────────────────────────
--
-- Z38 — Cross-device sync for user settings (pipelineVersion + API keys +
-- future feature flags). Replaces the localStorage-only approach so:
--   • Đăng nhập máy khác / IP khác → settings follow Gmail account
--   • Auto-migrate v2→v3 (Z37) applies globally per user, not per browser
--   • API keys (KIE / Gemini / ElevenLabs / etc.) follow account
--
-- APPLY MANUALLY VIA SUPABASE DASHBOARD OR CLI:
--   1. Supabase Dashboard → SQL Editor → New query → paste this file → Run
--   2. OR via CLI: supabase db push (if a CLI workflow is in place)
--
-- ARCHITECTURE NOTES:
--   • One row per user_id (UNIQUE constraint). UPSERT pattern.
--   • settings_json holds the full StoredSettings shape (pipelineVersion +
--     api keys + future flags). JSON column keeps the schema flexible —
--     new fields don't need a column-add migration.
--   • RLS policies scope every row to its owner. Read + write own only.
--   • updated_at auto-bumps on every save (used by client to detect
--     stale local copies for conflict resolution).

create extension if not exists "pgcrypto";

create table if not exists user_settings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  settings_json jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Auto-bump updated_at on UPDATE ────────────────────────────────────────

create or replace function set_user_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_settings_updated_at on user_settings;
create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function set_user_settings_updated_at();

-- ── RLS — strict per-user isolation ───────────────────────────────────────

alter table user_settings enable row level security;

-- read own row only
drop policy if exists user_settings_select_own on user_settings;
create policy user_settings_select_own on user_settings
  for select using (auth.uid() = user_id);

-- insert own row only
drop policy if exists user_settings_insert_own on user_settings;
create policy user_settings_insert_own on user_settings
  for insert with check (auth.uid() = user_id);

-- update own row only
drop policy if exists user_settings_update_own on user_settings;
create policy user_settings_update_own on user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- delete own row only (rare — settings usually upsert, not delete)
drop policy if exists user_settings_delete_own on user_settings;
create policy user_settings_delete_own on user_settings
  for delete using (auth.uid() = user_id);

-- ── Index — accelerate the per-user lookup ────────────────────────────────

create index if not exists idx_user_settings_user_id on user_settings(user_id);
