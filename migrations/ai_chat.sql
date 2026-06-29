-- ── Trợ lý AI (ai-chat) — 2 bảng ───────────────────────────────────────────
-- CHẠY 1 LẦN: Supabase Dashboard → SQL Editor → New query → dán file này → Run.
-- App tự fallback localStorage nếu chưa chạy SQL → không lỗi.
--
-- 1) ai_chat_conversations — LỊCH SỬ chat theo TÀI KHOẢN (đi mọi máy), mỗi user
--    chỉ thấy của mình (RLS auth.uid()). id = uuid client tự sinh → upsert theo id.
-- 2) app_shared_config     — KEY GPT DÙNG CHUNG: chủ set 1 lần, mọi nhân viên đọc.

create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════════════════════════════════
-- 1) Lịch sử chat per-user
-- ════════════════════════════════════════════════════════════════════════
create table if not exists ai_chat_conversations (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  messages    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table ai_chat_conversations enable row level security;

drop policy if exists ai_chat_select_own on ai_chat_conversations;
create policy ai_chat_select_own on ai_chat_conversations for select using (auth.uid() = user_id);
drop policy if exists ai_chat_insert_own on ai_chat_conversations;
create policy ai_chat_insert_own on ai_chat_conversations for insert with check (auth.uid() = user_id);
drop policy if exists ai_chat_update_own on ai_chat_conversations;
create policy ai_chat_update_own on ai_chat_conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists ai_chat_delete_own on ai_chat_conversations;
create policy ai_chat_delete_own on ai_chat_conversations for delete using (auth.uid() = user_id);

create index if not exists idx_ai_chat_user on ai_chat_conversations(user_id, updated_at desc);

-- ════════════════════════════════════════════════════════════════════════
-- 2) Key GPT dùng chung (1 dòng, id='global')
--    READ: mọi user đã đăng nhập (để dùng key). WRITE: mọi user đã đăng nhập
--    (đội nội bộ tin tưởng; UI chỉ hiện ô set key cho chủ). Muốn chặt hơn
--    (chỉ CEO ghi) thì sửa policy WRITE bên dưới theo bảng team_members.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists app_shared_config (
  id          text primary key default 'global',
  openai_key  text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table app_shared_config enable row level security;

drop policy if exists app_shared_select on app_shared_config;
create policy app_shared_select on app_shared_config for select to authenticated using (true);
drop policy if exists app_shared_insert on app_shared_config;
create policy app_shared_insert on app_shared_config for insert to authenticated with check (true);
drop policy if exists app_shared_update on app_shared_config;
create policy app_shared_update on app_shared_config for update to authenticated using (true) with check (true);

insert into app_shared_config (id) values ('global') on conflict (id) do nothing;
