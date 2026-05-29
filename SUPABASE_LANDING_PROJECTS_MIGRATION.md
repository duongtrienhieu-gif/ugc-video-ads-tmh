# Supabase Migration — Landing Page Projects

Landing Page AI **and Super Ladipage** persist saved projects to Supabase
so they're available cross-device when the user logs in from a different
machine. Run the SQL below ONCE in your Supabase project's SQL editor
before cross-device sync becomes useful.

The app handles graceful degradation: if the table doesn't exist, all
saved projects keep working via localStorage (the same way they did
pre-Supabase). No code path crashes on a missing table.

> **If you already ran an earlier version of this migration** (without
> the `kind` column), re-run the SQL below — it's idempotent. The
> `ALTER TABLE ... ADD COLUMN IF NOT EXISTS kind` will be a no-op on
> fresh tables and back-fill an existing one without touching data.

---

## What this enables

| Before | After |
|---|---|
| Projects stored in localStorage only | Projects in localStorage + Supabase |
| Lost if user clears browser data | Survives any browser clear / device swap |
| Single-device | **Cross-device** — log in on any browser, projects appear |
| No backup | Supabase auto-backups handle disaster recovery |
| F5 = stays (per-browser) | F5 = stays (per-account, any device) |

Both **Landing Page AI** and **Super Ladipage** use the same table; the
`kind` column keeps their projects separated.

---

## How to apply

1. Open https://supabase.com/dashboard/project/_/sql/new
2. Paste the SQL block below into the editor
3. Click "Run"
4. Verify in Database → Tables → landing_projects (should have a `kind` column)

After the SQL runs, log out + log back in on the device with existing
projects. The app uploads them once on first sync. From then on every
device gets the same project list automatically.

---

## SQL — copy this into Supabase SQL editor

```sql
-- ── landing_projects: saved Landing Page + Super Ladipage packs ──────────
-- Stores the FULL LandingPagePack as JSONB. Image refs inside the pack
-- still point to Supabase Storage assets via the existing asset_paths table.
-- This is the source of truth for cross-device project sync.

CREATE TABLE IF NOT EXISTS public.landing_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'landing-page',
  title         TEXT NOT NULL,
  product_id    TEXT,
  product_name  TEXT,
  language      TEXT,
  pack_json     JSONB NOT NULL,  -- full LandingPagePack including sections + imagePrompts
  is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent migration for users who ran the earlier version (no kind column)
ALTER TABLE public.landing_projects
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'landing-page';

-- Indexes for the queries the app actually runs
CREATE INDEX IF NOT EXISTS idx_landing_projects_user_updated
  ON public.landing_projects(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_projects_user_kind
  ON public.landing_projects(user_id, kind, is_archived);

CREATE INDEX IF NOT EXISTS idx_landing_projects_user_archived
  ON public.landing_projects(user_id, is_archived);

-- Auto-update `updated_at` on every UPDATE
CREATE OR REPLACE FUNCTION public.touch_landing_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_landing_projects_updated_at ON public.landing_projects;
CREATE TRIGGER trg_landing_projects_updated_at
  BEFORE UPDATE ON public.landing_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_landing_projects_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────
-- Each user can only see / modify / delete their own projects.

ALTER TABLE public.landing_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own landing_projects" ON public.landing_projects;
CREATE POLICY "Users select own landing_projects"
  ON public.landing_projects FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own landing_projects" ON public.landing_projects;
CREATE POLICY "Users insert own landing_projects"
  ON public.landing_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own landing_projects" ON public.landing_projects;
CREATE POLICY "Users update own landing_projects"
  ON public.landing_projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own landing_projects" ON public.landing_projects;
CREATE POLICY "Users delete own landing_projects"
  ON public.landing_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Done. Verify with:
--   SELECT count(*) FROM public.landing_projects;
-- (should return 0)
```

---

## How the app uses it

1. **On login**: app fetches all `landing_projects` rows for the user,
   merges with localStorage by `updated_at` (Supabase wins if newer).
2. **On any edit**: localStorage updates IMMEDIATELY (instant UI), and a
   Supabase upsert is queued (debounced 2s).
3. **Delete project**: localStorage row removed instantly, Supabase row
   deleted via REST call (fire-and-forget).
4. **Conflict**: if same project edited on 2 devices simultaneously, the
   last write wins by `updated_at` server timestamp. No merge UI yet.

## Rollback

To stop using Supabase (revert to localStorage-only):

Either:
- Drop the table (`DROP TABLE public.landing_projects`) — app falls back to localStorage gracefully
- Or in DevTools: `localStorage.setItem('ugc-lab:landing-projects:supabase-disabled', 'true')` and reload — app skips Supabase calls entirely for that browser

Saved projects in localStorage are NEVER deleted by the Supabase sync layer.
Worst case rollback = lose cross-device sync, keep all local projects intact.
