# Supabase Migration — User Outputs (cross-device sync for 5 features)

Adds Supabase persistence for these per-user output stores so the
data follows the user's email across devices:

| Store | Kind | Lưu gì |
|---|---|---|
| `useAdTemplateStore` | `ad-win-template` | Phân tích "ad chiến" lưu từ Phân tích QC để tái sử dụng trong UGC Builder |
| `useLabContentStore` | `lab-content` | Brief Lab Content đã lưu |
| `useAdsContentStore` | `ads-content` | Ads Content output đã lưu |
| `useLipSyncStore` | `lip-sync-history` | Lịch sử lip-sync (asset blob đã có sẵn trong Supabase Storage) |
| `useVideoTranslateStore` | `video-translate-history` | Lịch sử dịch video (asset blob đã có sẵn) |

One shared table — `kind` column discriminates which feature owns each
row. Same pattern as `landing_projects` (kind='landing-page' /
'super-ladipage').

---

## What this enables

| Trước | Sau |
|---|---|
| 5 store trên đều lưu **chỉ localStorage** | Lưu cả localStorage + Supabase |
| Mất khi xoá browser data / login máy khác | Survive xoá data + cross-device |
| Single-device | Cross-device — login email = thấy data |
| Không backup | Supabase auto-backups |

---

## How to apply

1. Mở https://supabase.com/dashboard/project/_/sql/new
2. Paste SQL bên dưới
3. Click "Run"
4. Verify ở Database → Tables → `user_outputs`

Sau khi chạy SQL:
- Login lại ở máy có data cũ → app tự upload lên Supabase (first-sync)
- Login máy mới → output 5 feature tự xuất hiện

Trước khi chạy SQL: app vẫn hoạt động bình thường (localStorage mode).
Không regression.

---

## SQL — copy this into Supabase SQL editor

```sql
-- ── user_outputs: shared cross-device store for misc user outputs ─────────
-- One row = one saved output. `kind` discriminates which feature owns it.
-- See src/services/userOutputsAPI.ts for the up-to-date list of kinds.
--
-- This table is INTENTIONALLY separate from `landing_projects` (which
-- has feature-specific columns product_id / product_name / language).
-- Schema here is minimal + generic so future features can add new kinds
-- without ALTER TABLE migrations.

CREATE TABLE IF NOT EXISTS public.user_outputs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  title         TEXT,
  payload_json  JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the queries the app actually runs
CREATE INDEX IF NOT EXISTS idx_user_outputs_user_kind
  ON public.user_outputs(user_id, kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_outputs_user_updated
  ON public.user_outputs(user_id, updated_at DESC);

-- Auto-update `updated_at` on every UPDATE
CREATE OR REPLACE FUNCTION public.touch_user_outputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_outputs_updated_at ON public.user_outputs;
CREATE TRIGGER trg_user_outputs_updated_at
  BEFORE UPDATE ON public.user_outputs
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_outputs_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────
-- Each user can only see / modify / delete their own outputs.

ALTER TABLE public.user_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own user_outputs" ON public.user_outputs;
CREATE POLICY "Users select own user_outputs"
  ON public.user_outputs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own user_outputs" ON public.user_outputs;
CREATE POLICY "Users insert own user_outputs"
  ON public.user_outputs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own user_outputs" ON public.user_outputs;
CREATE POLICY "Users update own user_outputs"
  ON public.user_outputs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own user_outputs" ON public.user_outputs;
CREATE POLICY "Users delete own user_outputs"
  ON public.user_outputs FOR DELETE
  USING (auth.uid() = user_id);

-- Done. Verify with:
--   SELECT kind, count(*) FROM public.user_outputs GROUP BY kind;
```

---

## Rollback

To stop using Supabase sync for these 5 stores:

```sql
DROP TABLE public.user_outputs;
```

App falls back to localStorage gracefully — saved items in localStorage
are NEVER deleted by the Supabase layer. Worst case rollback = lose
cross-device sync, keep all local items intact.
