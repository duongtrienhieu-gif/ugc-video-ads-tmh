-- ── Creative Studio — Generations Table (P13) ──────────────────────────────
--
-- Persistent storage for every asset generation triggered from the
-- Creative Studio UI. Replaces the previous in-memory + localStorage
-- session-persist approach so:
--   • F5 / logout / new browser → history survives
--   • multiple devices for the same user see the same workspace
--   • per-output delete is durable
--
-- IMPORTANT — APPLY MANUALLY VIA SUPABASE DASHBOARD OR CLI:
--   1. Supabase Dashboard → SQL Editor → New query → paste this file → Run
--   2. OR via CLI: supabase db push (if a CLI workflow is in place)
--
-- ARCHITECTURE NOTES:
--   • outputs_json holds a small metadata + asset:xxx ref array;
--     the actual image bytes stay in IndexedDB (utils/assetStore.ts).
--     This keeps the DB row tiny + offline image access fast.
--   • inputs_json captures product/avatar/reference refs + options so
--     the same job can be regenerated later.
--   • status enum reflects the job lifecycle the JS runtime drives.
--   • RLS policies scope every row to its owner — no cross-user
--     visibility, no admin escape hatch.

create extension if not exists "pgcrypto";  -- gen_random_uuid()

create table if not exists creative_generations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  creative_type text not null,
  status        text not null check (status in ('queued', 'generating', 'completed', 'failed')),
  progress      smallint default 0 check (progress >= 0 and progress <= 100),

  inputs_json   jsonb not null default '{}'::jsonb,
  outputs_json  jsonb not null default '{}'::jsonb,

  error_message text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Hot path: list a user's jobs in reverse-chronological order
create index if not exists creative_generations_user_created
  on creative_generations (user_id, created_at desc);

-- Trigger to auto-bump updated_at
create or replace function creative_generations_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists creative_generations_touch_updated_at on creative_generations;
create trigger creative_generations_touch_updated_at
  before update on creative_generations
  for each row execute function creative_generations_touch_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────
alter table creative_generations enable row level security;

drop policy if exists creative_generations_select_own on creative_generations;
create policy creative_generations_select_own
  on creative_generations for select
  using (auth.uid() = user_id);

drop policy if exists creative_generations_insert_own on creative_generations;
create policy creative_generations_insert_own
  on creative_generations for insert
  with check (auth.uid() = user_id);

drop policy if exists creative_generations_update_own on creative_generations;
create policy creative_generations_update_own
  on creative_generations for update
  using (auth.uid() = user_id);

drop policy if exists creative_generations_delete_own on creative_generations;
create policy creative_generations_delete_own
  on creative_generations for delete
  using (auth.uid() = user_id);

-- ── Verification queries (run after migration) ────────────────────────
-- select count(*) from creative_generations;
-- select id, creative_type, status, created_at from creative_generations
--   order by created_at desc limit 10;
