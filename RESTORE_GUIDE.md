# RESTORE GUIDE — LandingPage AI Hybrid-Render Refactor

Pre-refactor snapshot point:
- **Commit**: `2631890`
- **Tag**: `stable-render-v1`
- **Backup branch**: `backup/pre-render-workflow-v1`
- **Date**: 2026-05-17

The hybrid-render refactor (Phase 1-12) keeps the legacy AI-full-render
pipeline intact and adds a new code path behind a feature flag. This doc
describes how to rollback at every level — from "disable new flow without
deploying" (1 second) to "completely undo all refactor commits" (full revert).

---

## ROLLBACK LEVELS

### Level 0 — Disable hybrid render at runtime (instant)

If hybrid mode is causing issues in production:

**Option A: environment variable** (zero deploy if Vercel reads `.env`)
```
VITE_ENABLE_HYBRID_RENDER=false
```
Then redeploy. App reverts to full AI render flow with no code change.

**Option B: localStorage override** (per-browser, no deploy)
Open DevTools Console on production:
```js
localStorage.setItem('ugc-lab:feature:hybrid-render', 'false')
location.reload()
```
This forces the legacy code path for that one user.

### Level 1 — Hot-fix revert of the last refactor commit

If only the latest refactor commit broke things:
```bash
git revert HEAD --no-edit
git push origin main
```
Vercel auto-deploys the revert in ~2 min.

### Level 2 — Revert the entire hybrid-render refactor series

If multiple refactor commits all need to come out:
```bash
# Find the first refactor commit (look for "feat(hybrid-render)" prefix)
git log --oneline | grep "hybrid-render"

# Revert the range — leaves history clean, doesn't rewrite
git revert <first-hybrid-commit>^..HEAD --no-edit
git push origin main
```

### Level 3 — Hard reset main to stable-render-v1

⚠️ DESTRUCTIVE. Use ONLY if you accept losing all post-refactor commits.

```bash
git checkout main
git reset --hard stable-render-v1
git push --force-with-lease origin main
```

**Pre-condition**: confirm no important non-refactor commits live in the
range you're nuking. Check with:
```bash
git log stable-render-v1..main --oneline
```
Anything that's NOT prefixed with `feat(hybrid-render):` or related — pluck
those out first with `git cherry-pick`.

### Level 4 — Spin up the backup branch as new main

If main has diverged badly and a force-push is risky:
```bash
git push origin backup/pre-render-workflow-v1:main --force-with-lease
```
This sets main back to the exact pre-refactor state without rewriting tags.

---

## VERIFY ROLLBACK WORKED

After any rollback:

1. Local check:
   ```bash
   npm run build
   ```
   Should succeed with output identical to pre-refactor build.

2. Functional check on Vercel after deploy:
   - Open `LandingPage AI`
   - Generate a fresh pack → should see all 17 sections
   - Bấm "Sinh tất cả ảnh" → all images render via AI (no template-composed assets)
   - Image count matches pre-refactor: ~35 final assets

3. localStorage check:
   - Open DevTools → Application → Local Storage
   - Key `landing-page-saved-v1` schema should be the v1 shape (no `renderStrategy` field on assets)
   - In-flight key `ugc-lab:landing-page:inflight-v1` should still hydrate cleanly

---

## FILES THAT WILL BE TOUCHED IN THE REFACTOR

The hybrid-render refactor is scoped to the LandingPage AI module. Other
modules (Avatar AI, Product AI, Video Builder, etc.) are NOT affected.

### MODIFIED
- `src/apps/landing-page/services/generateImages.ts`
  → routing logic: classify each ImagePrompt → AI-render OR template-compose
- `src/apps/landing-page/types.ts`
  → extend `ImagePrompt` with `renderStrategy`, `derivedFrom`, `compositionConfig`
- `src/apps/landing-page/components/SectionCard.tsx`
  → render template-composed assets identically to AI-render ones (no UI diff)
- `src/apps/landing-page/components/OutputPanel.tsx`
  → Metrics chip: "12 AI · 23 derived · saved ~138 credit"

### NEW (entire phase only loaded behind feature flag)
- `src/apps/landing-page/lib/featureFlags.ts`
  → single source of truth for `ENABLE_HYBRID_RENDER`
- `src/apps/landing-page/services/renderPlanner.ts`
  → classifies each ImagePrompt into ai_full_render | template_composed | derived_asset | reusable_render
- `src/apps/landing-page/services/templateEngine.ts`
  → HTML/canvas composer for WhatsApp / Shopee review / news article / promo banner / star rating / urgency strip
- `src/apps/landing-page/services/composers/whatsappComposer.ts`
  → renders WhatsApp UI screenshot from a generated message + reusable product render
- `src/apps/landing-page/services/composers/reviewComposer.ts`
  → renders TikTok Shop / Shopee review card from reusable product render
- `src/apps/landing-page/services/composers/newsComposer.ts`
  → renders Malaysia news article screenshot from reusable hero image
- `src/apps/landing-page/services/composers/promoComposer.ts`
  → renders promo banner from reusable product render + discount burst overlay
- `src/apps/landing-page/services/composers/beforeAfterComposer.ts`
  → renders split-frame before/after collage from 2 portrait renders
- `src/apps/landing-page/services/productRenderPool.ts`
  → reusable product packshot — generate once, reuse across 8+ sections

### UNTOUCHED — guaranteed to remain identical
- `src/apps/landing-page/services/generateLandingPack.ts` (text/copy generation)
- `src/apps/landing-page/store.ts` (Canva-style project store from `dc97cae`)
- `src/apps/landing-page/LandingPageAI.tsx` (top-level orchestrator)
- All other modules (Avatar AI, Product AI, etc.)

---

## DATA SHAPE COMPATIBILITY

The refactor extends `ImagePrompt` with optional fields. Old saved projects
(`landing-page-saved-v1` localStorage entries) keep working with no
migration — TypeScript marks the new fields optional.

Forward compatibility:
- Old packs (no `renderStrategy` field) → renderPlanner defaults to `ai_full_render` → identical behavior
- New packs (with `renderStrategy`) → both legacy and hybrid code paths read the field correctly

---

## EMERGENCY CONTACTS / KNOWN ISSUES

- If KIE API errors spike post-deploy → check Level 0 Option B for instant per-user override
- If template-composed assets look broken → set `ENABLE_HYBRID_RENDER=false` and report; do NOT roll back the whole refactor unless template engine logic is corrupting saved projects
- The new code path does NOT modify any localStorage data unless the user explicitly generates a new pack with `ENABLE_HYBRID_RENDER=true`. Existing saved projects are untouchable.

---

## RECOVERY TEST CHECKLIST

Before declaring rollback "done":
- [ ] `git log -1 --oneline` shows expected commit
- [ ] `npm run build` passes
- [ ] Vercel deploy succeeds
- [ ] Open production URL → LandingPage AI → generate 1 pack
- [ ] All 35 final assets render via AI (check Network tab: 35 KIE calls)
- [ ] No `renderStrategy` field visible in DevTools Console when inspecting pack JSON
- [ ] Saved projects from before refactor still open correctly via "Mở"
- [ ] No console errors

If any item fails → escalate to Level N+1.
