-- ─────────────────────────────────────────────────────────────────────
-- user_outputs — backing store for multi-purpose user-saved outputs.
--
-- Used by 4+ stores via a 'kind' discriminator column:
--   • Brand Kit (kind='brand-kit')           — src/stores/brandKitStore.ts
--   • Lip-Sync history (kind='lip-sync-history')
--   • Video-Translate history (kind='video-translate-history')
--   • TikTok Shop listings (kind='tiktok-shop-listing') — src/apps/tiktok-shop/listingsStore.ts
--
-- 4 apps were failing with
--   "Could not find the table 'public.user_outputs' in the schema cache"
-- because this table never had a checked-in migration. Add it here so the
-- next person who provisions a fresh Supabase project doesn't hit the
-- same wall.
--
-- All operations idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_outputs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  title         TEXT,
  payload_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Common query patterns: filter by user + kind, order by updated_at desc
CREATE INDEX IF NOT EXISTS user_outputs_user_kind_idx
  ON public.user_outputs (user_id, kind);
CREATE INDEX IF NOT EXISTS user_outputs_updated_at_idx
  ON public.user_outputs (updated_at DESC);

-- RLS: each user only sees/modifies their own rows
ALTER TABLE public.user_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own outputs" ON public.user_outputs;
DROP POLICY IF EXISTS "Users can insert own outputs" ON public.user_outputs;
DROP POLICY IF EXISTS "Users can update own outputs" ON public.user_outputs;
DROP POLICY IF EXISTS "Users can delete own outputs" ON public.user_outputs;

CREATE POLICY "Users can select own outputs"
  ON public.user_outputs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outputs"
  ON public.user_outputs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outputs"
  ON public.user_outputs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outputs"
  ON public.user_outputs FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-bump updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.user_outputs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_outputs_updated_at ON public.user_outputs;
CREATE TRIGGER user_outputs_updated_at
  BEFORE UPDATE ON public.user_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.user_outputs_set_updated_at();

-- Reload PostgREST schema cache so the table becomes visible to the API
-- immediately — without this, you'd see "Could not find the table in the
-- schema cache" until PostgREST eventually picks it up on its own.
NOTIFY pgrst, 'reload schema';
