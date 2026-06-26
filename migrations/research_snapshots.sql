-- ── Momentum snapshots (research_snapshots) ──────────────────────────────────
-- Mỗi lần quét lưu số-đã-bán/SP/ngày. Quét lại sau vài ngày → tính tăng trưởng THẬT
-- (đang lên hay đã bão hòa), vì sold trên TikTok Shop là số TÍCH LŨY không phân biệt được.
-- CHẠY 1 LẦN: Supabase → SQL Editor → New query → dán toàn bộ → Run.

create table if not exists public.research_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  text not null,
  market      text,
  sold        bigint not null default 0,
  captured_on date not null default current_date,
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (user_id, product_id, captured_on)   -- 1 mốc/SP/ngày (upsert đè)
);

create index if not exists research_snapshots_lookup_idx
  on public.research_snapshots (user_id, product_id, captured_on desc);

alter table public.research_snapshots enable row level security;

-- RLS: mỗi user chỉ thấy / ghi mốc của chính mình.
drop policy if exists research_snapshots_select_own on public.research_snapshots;
create policy research_snapshots_select_own on public.research_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists research_snapshots_insert_own on public.research_snapshots;
create policy research_snapshots_insert_own on public.research_snapshots
  for insert with check (auth.uid() = user_id);

drop policy if exists research_snapshots_update_own on public.research_snapshots;
create policy research_snapshots_update_own on public.research_snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
