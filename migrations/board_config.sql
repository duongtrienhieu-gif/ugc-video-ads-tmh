-- ── board_config — LINK NGUỒN DỮ LIỆU DÙNG CHUNG (KHO & BÁO CÁO) ─────────────
-- Chủ dán link Google Sheet tháng mới 1 lần → MỌI nhân viên / điện thoại đọc cùng
-- một bộ link (khỏi mỗi máy dán lại localStorage). Cùng pattern app_shared_config.
-- Chạy 1 lần trong Supabase SQL editor.
create table if not exists board_config (
  id          text primary key,
  links       jsonb not null default '{}'::jsonb,
  updated_by  text,
  updated_at  timestamptz default now()
);
alter table board_config enable row level security;

-- Cột số THẬT ẩn của CEO (tỷ giá/chi phí thật, buffer, overhead) — chỉ CEO đọc/ghi ở UI.
alter table board_config add column if not exists ceo_cfg jsonb;
-- Tồn ế / team (giá vốn hàng >45 ngày còn kẹt + lỗ xả) — CEO nhập, cả team đọc để hiện phạt 8%.
alter table board_config add column if not exists ton_ele jsonb;

-- Mọi user đăng nhập đọc + ghi (nội bộ — sau login). Link Sheet vốn đã công khai.
drop policy if exists board_config_select on board_config;
create policy board_config_select on board_config for select to authenticated using (true);
drop policy if exists board_config_insert on board_config;
create policy board_config_insert on board_config for insert to authenticated with check (true);
drop policy if exists board_config_update on board_config;
create policy board_config_update on board_config for update to authenticated using (true) with check (true);

insert into board_config (id) values ('global') on conflict (id) do nothing;
