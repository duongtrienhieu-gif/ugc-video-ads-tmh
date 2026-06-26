-- ── Danh sách Test (research_watchlist) ──────────────────────────────────────
-- Lưu các SP research được "ghim" để test sau, đồng bộ theo user (đa thiết bị).
-- CHẠY 1 LẦN: Supabase → SQL Editor → New query → dán toàn bộ → Run.

create table if not exists public.research_watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id text not null,                 -- productId research (khóa dedup)
  market     text,
  product    jsonb not null,                -- snapshot ScoredProduct
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (user_id, product_id)              -- mỗi user không ghim trùng 1 SP
);

-- Cột nâng cấp (chạy lại file an toàn — add nếu chưa có): trạng thái test, người phụ trách, ghi chú.
alter table public.research_watchlist add column if not exists status   text default 'new';
alter table public.research_watchlist add column if not exists assignee text;
alter table public.research_watchlist add column if not exists note     text;

create index if not exists research_watchlist_user_idx
  on public.research_watchlist (user_id, created_at desc);

alter table public.research_watchlist enable row level security;

-- RLS: mỗi user chỉ thấy / thêm / xóa danh sách của chính mình.
drop policy if exists research_watchlist_select_own on public.research_watchlist;
create policy research_watchlist_select_own on public.research_watchlist
  for select using (auth.uid() = user_id);

drop policy if exists research_watchlist_insert_own on public.research_watchlist;
create policy research_watchlist_insert_own on public.research_watchlist
  for insert with check (auth.uid() = user_id);

drop policy if exists research_watchlist_update_own on public.research_watchlist;
create policy research_watchlist_update_own on public.research_watchlist
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists research_watchlist_delete_own on public.research_watchlist;
create policy research_watchlist_delete_own on public.research_watchlist
  for delete using (auth.uid() = user_id);
