-- ─────────────────────────────────────────────────────────────────────
-- research.sql — backing store for the "Research" module
-- (AI research assistant phân tích data Kalodata cho seller TikTok Shop).
--
-- Module: src/apps/research/  (standalone — không đụng module khác).
-- Data nguồn: Chrome Extension capture Kalodata → đẩy thẳng các bảng dưới.
--
-- Bảng SHARED (data thị trường, cả công ty xem chung):
--   • research_products    — danh sách sản phẩm theo market (từ /product/queryList)
--   • research_snapshots   — lịch sử theo ngày (để tính tăng trưởng/growth)
--   • research_creators    — danh sách creator (từ /creator/queryList)
--   • research_videos      — danh sách video + ad ROAS (từ /video/queryList)
--   • research_shops       — danh sách shop đối thủ (từ /shop/queryList)
--   • research_categories  — map cate_id → tên ngách + phân loại rủi ro SKU
--   • research_ingest_log  — nhật ký mỗi lần extension đẩy data ("đồng bộ lúc nào")
--
-- Bảng PER-USER (riêng từng người):
--   • research_user_items  — watchlist: Theo dõi / Đang test / Loại / Đã duyệt
--
-- ⚠ RLS giai đoạn P1 (chỉ owner dùng extension): bảng SHARED cho phép MỌI user
--    đã đăng nhập đọc/ghi. Khi lên P3 (multi-tenant 6 nhân sự) sẽ THÊM workspace_id
--    + siết policy theo workspace. Cột workspace_id đã có sẵn (nullable) để khỏi
--    phải migrate phá vỡ về sau.
--
-- Tất cả idempotent — chạy lại nhiều lần an toàn.
-- ─────────────────────────────────────────────────────────────────────

-- ===== Trigger dùng chung: tự bump updated_at =====
CREATE OR REPLACE FUNCTION public.research_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────
-- 1) research_products
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_products (
  product_id              TEXT NOT NULL,
  market                  TEXT NOT NULL,                 -- MY | TH | ID | VN
  product_title           TEXT,
  image_url               TEXT,
  revenue                 NUMERIC,
  revenue_grouping_rate   NUMERIC,                       -- % tăng trưởng doanh thu
  sale                    NUMERIC,                       -- số lượng bán
  unit_price              NUMERIC,
  min_real_price          NUMERIC,
  max_real_price          NUMERIC,
  commission_rate         NUMERIC,
  product_rating          NUMERIC,
  creator_num             INTEGER,
  creator_conversion_ratio NUMERIC,
  video_revenue           NUMERIC,
  live_revenue            NUMERIC,
  showcase_revenue        NUMERIC,
  gmv_a                   NUMERIC,
  gmv_b                   NUMERIC,
  pri_cate_id             TEXT,
  sec_cate_id             TEXT,
  ter_cate_id             TEXT,
  delivery_type           TEXT,
  is_overseas             BOOLEAN,
  is_full_service         BOOLEAN,
  is_tokopedia            BOOLEAN,
  launch_date             DATE,
  revenue_trend           JSONB,                         -- mảng sparkline
  sku_variance_risk       TEXT,                          -- low | mid | high (tính lúc ingest/scoring)
  raw                     JSONB,                         -- payload gốc đầy đủ (forward-compat)
  workspace_id            UUID,
  ingested_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  captured_at             TIMESTAMPTZ,                   -- mốc data (cuối khoảng ngày)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, market)
);
CREATE INDEX IF NOT EXISTS research_products_market_cate_idx
  ON public.research_products (market, pri_cate_id, sec_cate_id);
CREATE INDEX IF NOT EXISTS research_products_growth_idx
  ON public.research_products (market, revenue_grouping_rate DESC);
CREATE INDEX IF NOT EXISTS research_products_revenue_idx
  ON public.research_products (market, revenue DESC);

-- ───────────────────────────────────────────────
-- 2) research_snapshots — time series (1 dòng / sản phẩm / market / ngày)
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              TEXT NOT NULL,
  market                  TEXT NOT NULL,
  snapshot_date           DATE NOT NULL,
  revenue                 NUMERIC,
  sale                    NUMERIC,
  unit_price              NUMERIC,
  commission_rate         NUMERIC,
  revenue_grouping_rate   NUMERIC,
  creator_num             INTEGER,
  workspace_id            UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, market, snapshot_date)
);
CREATE INDEX IF NOT EXISTS research_snapshots_lookup_idx
  ON public.research_snapshots (product_id, market, snapshot_date DESC);

-- ───────────────────────────────────────────────
-- 3) research_creators
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_creators (
  creator_id              TEXT NOT NULL,
  market                  TEXT NOT NULL,
  handle                  TEXT,
  nickname                TEXT,
  signature               TEXT,
  main_category           TEXT,
  followers               NUMERIC,
  new_followers           NUMERIC,
  video_engagement_rate   NUMERIC,
  revenue                 NUMERIC,
  sale                    NUMERIC,
  unit_price              NUMERIC,
  views                   NUMERIC,
  revenue_grouping_rate   NUMERIC,
  creator_debut           DATE,
  contact                 JSONB,                         -- từ /creator/enrich (nếu có)
  raw                     JSONB,
  workspace_id            UUID,
  ingested_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  captured_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (creator_id, market)
);
CREATE INDEX IF NOT EXISTS research_creators_market_cat_idx
  ON public.research_creators (market, main_category);

-- ───────────────────────────────────────────────
-- 4) research_videos
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_videos (
  video_id                TEXT NOT NULL,
  market                  TEXT NOT NULL,
  description             TEXT,                          -- caption / hook
  handle                  TEXT,
  duration                INTEGER,
  publish_date            DATE,
  views                   NUMERIC,
  gpm                     NUMERIC,
  revenue                 NUMERIC,
  sale                    NUMERIC,
  ad                      BOOLEAN,
  ad_cpa                  NUMERIC,
  ad2_roas                NUMERIC,
  ad2_cost                NUMERIC,
  ad_view_ratio           NUMERIC,
  ad_revenue_ratio        NUMERIC,
  revenue_grouping_rate   NUMERIC,
  product_id              TEXT,                          -- sản phẩm gắn kèm (nếu có)
  raw                     JSONB,
  workspace_id            UUID,
  ingested_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  captured_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, market)
);
CREATE INDEX IF NOT EXISTS research_videos_product_idx
  ON public.research_videos (market, product_id);

-- ───────────────────────────────────────────────
-- 5) research_shops
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_shops (
  shop_id                 TEXT NOT NULL,
  market                  TEXT NOT NULL,
  name                    TEXT,
  region                  TEXT,
  seller_type             TEXT,
  main_category           TEXT,
  revenue                 NUMERIC,
  sale                    NUMERIC,
  unit_price              NUMERIC,
  revenue_grouping_rate   NUMERIC,
  self_promotion_revenue  NUMERIC,
  affiliate_revenue       NUMERIC,
  video_revenue           NUMERIC,
  live_revenue            NUMERIC,
  showcase_revenue        NUMERIC,
  shopping_mall_revenue   NUMERIC,
  is_full_service         BOOLEAN,
  is_overseas             BOOLEAN,
  is_tokopedia            BOOLEAN,
  product_ids             JSONB,                         -- từ /shop/enrich
  raw                     JSONB,
  workspace_id            UUID,
  ingested_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  captured_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, market)
);
CREATE INDEX IF NOT EXISTS research_shops_market_cat_idx
  ON public.research_shops (market, main_category);

-- ───────────────────────────────────────────────
-- 6) research_categories — map cate_id → tên + phân loại rủi ro SKU
--    (seed dần; scoring có fallback phân loại theo keyword khi trống)
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_categories (
  cate_id                 TEXT PRIMARY KEY,
  name                    TEXT,
  parent_id               TEXT,
  level                   INTEGER,
  sku_variance_class      TEXT,                          -- low | mid | high
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────
-- 7) research_ingest_log — "đồng bộ lúc nào, bao nhiêu dòng"
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_ingest_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingested_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  market                  TEXT,
  entity_type             TEXT,                          -- product | creator | video | shop
  row_count               INTEGER,
  source_url              TEXT,
  workspace_id            UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_ingest_log_recent_idx
  ON public.research_ingest_log (created_at DESC);

-- ───────────────────────────────────────────────
-- 8) research_user_items — watchlist riêng từng người
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_user_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type             TEXT NOT NULL DEFAULT 'product',
  entity_id               TEXT NOT NULL,
  market                  TEXT,
  status                  TEXT,                          -- watch | testing | rejected | approved
  note                    TEXT,
  payload_json            JSONB,                         -- ảnh chụp sản phẩm lúc lưu
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_user_items_user_idx
  ON public.research_user_items (user_id, status);

-- ═══════════════════════════════════════════════
-- TRIGGERS updated_at
-- ═══════════════════════════════════════════════
DROP TRIGGER IF EXISTS research_products_updated_at ON public.research_products;
CREATE TRIGGER research_products_updated_at BEFORE UPDATE ON public.research_products
  FOR EACH ROW EXECUTE FUNCTION public.research_set_updated_at();
DROP TRIGGER IF EXISTS research_creators_updated_at ON public.research_creators;
CREATE TRIGGER research_creators_updated_at BEFORE UPDATE ON public.research_creators
  FOR EACH ROW EXECUTE FUNCTION public.research_set_updated_at();
DROP TRIGGER IF EXISTS research_videos_updated_at ON public.research_videos;
CREATE TRIGGER research_videos_updated_at BEFORE UPDATE ON public.research_videos
  FOR EACH ROW EXECUTE FUNCTION public.research_set_updated_at();
DROP TRIGGER IF EXISTS research_shops_updated_at ON public.research_shops;
CREATE TRIGGER research_shops_updated_at BEFORE UPDATE ON public.research_shops
  FOR EACH ROW EXECUTE FUNCTION public.research_set_updated_at();
DROP TRIGGER IF EXISTS research_categories_updated_at ON public.research_categories;
CREATE TRIGGER research_categories_updated_at BEFORE UPDATE ON public.research_categories
  FOR EACH ROW EXECUTE FUNCTION public.research_set_updated_at();
DROP TRIGGER IF EXISTS research_user_items_updated_at ON public.research_user_items;
CREATE TRIGGER research_user_items_updated_at BEFORE UPDATE ON public.research_user_items
  FOR EACH ROW EXECUTE FUNCTION public.research_set_updated_at();

-- ═══════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════
ALTER TABLE public.research_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_creators    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_videos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_shops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_ingest_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_user_items  ENABLE ROW LEVEL SECURITY;

-- SHARED tables: P1 — mọi user đã đăng nhập đọc/ghi được (P3 sẽ siết theo workspace).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'research_products','research_snapshots','research_creators',
    'research_videos','research_shops','research_categories','research_ingest_log'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth read %1$s" ON public.%1$I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth write %1$s" ON public.%1$I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth update %1$s" ON public.%1$I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth delete %1$s" ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY "auth read %1$s"   ON public.%1$I FOR SELECT USING (auth.uid() IS NOT NULL);', t);
    EXECUTE format('CREATE POLICY "auth write %1$s"  ON public.%1$I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);', t);
    EXECUTE format('CREATE POLICY "auth update %1$s" ON public.%1$I FOR UPDATE USING (auth.uid() IS NOT NULL);', t);
    EXECUTE format('CREATE POLICY "auth delete %1$s" ON public.%1$I FOR DELETE USING (auth.uid() IS NOT NULL);', t);
  END LOOP;
END $$;

-- PER-USER table: chỉ thấy/sửa dòng của mình.
DROP POLICY IF EXISTS "own select items" ON public.research_user_items;
DROP POLICY IF EXISTS "own insert items" ON public.research_user_items;
DROP POLICY IF EXISTS "own update items" ON public.research_user_items;
DROP POLICY IF EXISTS "own delete items" ON public.research_user_items;
CREATE POLICY "own select items" ON public.research_user_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert items" ON public.research_user_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update items" ON public.research_user_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete items" ON public.research_user_items FOR DELETE USING (auth.uid() = user_id);

-- Reload PostgREST schema cache → bảng hiện ra với API ngay lập tức.
NOTIFY pgrst, 'reload schema';
