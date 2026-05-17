# ARCHITECTURE DIFF PLAN — LandingPage AI Hybrid Render

Pre-refactor baseline: `stable-render-v1` (commit `2631890`).

This document describes the architectural delta between the current
"every-asset-is-an-AI-render" pipeline and the proposed hybrid pipeline
that reuses product renders + composes template-based assets locally.

NON-NEGOTIABLE constraints (per user spec, restated up front so the plan
can be measured against them):
- Final asset count stays at ~35 (no visible reduction)
- 17 sections stay exactly the same
- Malaysia advertorial density / busy / trust-heavy feel preserved
- UX/UI unchanged from user's POV
- Backward-compatible: old saved projects keep working
- Rollback safety: feature flag toggles between old and new

---

## 1. CURRENT FLOW (stable-render-v1)

```
User → InputPanel → onGenerate(params)
         ↓
generateLandingPack()  ← Gemini call ($0.01, 30-60s)
         ↓ returns LandingPagePack with 17 sections × imagePrompts[]
collectJobs(pack)
         ↓ 35 ImageJobs sorted by section priority
generatePackImages() with concurrency=6
         ↓ EACH JOB:
            submitGpt4oImage → poll → downloadAndStore
            cost: 6 credit / image, ~30-90s / image
         ↓ 35 KIE.ai GPT-4o image calls
         total: ~210 credit, ~90-180s wall-clock
```

### Asset breakdown in current flow (all 35 = full AI renders)

| Section | Image count | Subject | Aspect | Current cost |
|---|---|---|---|---|
| hero | 2 | Hijab woman + product + overlay | 4:5 | 12 credit |
| pain | 5 | Different pain emotion scenes | 4:5 | 30 credit |
| why-happens | 1-2 | Mechanism infographic | 1:1 | 6-12 credit |
| failed-solutions | 1-2 | Tired person + failed product pile | 4:5 | 6-12 credit |
| product-discovery | 1 | First-time-holding-product UGC | 4:5 | 6 credit |
| ingredients | 2-3 | Ingredient card infographic | 1:1 | 12-18 credit |
| mechanism | 1-2 | Science diagram | 1:1 | 6-12 credit |
| benefits | 1 | Benefits icon grid | 1:1 | 6 credit |
| comparison | 1 | vs-competitor table | 1:1 | 6 credit |
| lifestyle | 1-2 | Family happy / outdoor scene | 4:5 | 6-12 credit |
| social-proof | 5 | FB / TikTok / Shopee screenshots + 2 selfies | 4:5 | 30 credit |
| whatsapp-testimonials | 4 | WhatsApp chat screenshots | 4:5 | 24 credit |
| news-proof | 2 | Malaysia news article screenshots | 4:5 | 12 credit |
| before-after | 4 | Before/after collages | 4:5 | 24 credit |
| faq | 0 | (no images) | — | 0 |
| offer | 2 | Promo banner with packaging | 16:9 | 12 credit |
| final-cta | 2 | Social proof CTA banner | 16:9 | 12 credit |
| **TOTAL** | **~35** | | | **~210 credit** |

### Pain points in current flow

1. **WhatsApp / Shopee / TikTok screenshots cost full AI render** even though they're 95% template + 5% unique copy. The screenshot UI is identical every time.
2. **Promo banners regenerate the product packshot from scratch** every time — the same bottle is rendered 4-8 times (hero, offer_01, offer_02, finalcta_01, finalcta_02, ingredient cards, etc.).
3. **News article screenshots are 90% generic** — only the headline + 1-2 paragraphs of body text vary.
4. **Before/after collages render the split-frame layout via AI** when a portrait + label overlay would compose locally in 200ms.
5. **Ingredient cards / comparison tables / benefits grids are pure infographic layout** — AI can render them but a Canvas + HTML template makes them sharper and cheaper.

Estimated waste: **60-70% of credit** is spent re-rendering UI/template chrome that doesn't need AI.

---

## 2. NEW FLOW (hybrid-render-v2, behind `ENABLE_HYBRID_RENDER`)

```
User → InputPanel → onGenerate(params)
         ↓
generateLandingPack()                     ← unchanged ($0.01)
         ↓
renderPlanner.classify(pack)              ← NEW: tags each ImagePrompt
         ↓
generatePackImages() routes per asset:
  ├── strategy='ai_full_render'   → KIE GPT-4o (legacy path, identical)
  ├── strategy='reusable_render'  → KIE GPT-4o ONCE → ProductRenderPool
  ├── strategy='template_composed'→ templateEngine + canvas/HTML local render
  └── strategy='derived_asset'    → derive from reusable + transformer
         ↓
Asset blobs uploaded to Supabase (same flow)
         ↓
Output: ~35 final assets, same UI, same shape
Cost: ~72-108 credit (50-65% reduction)
Wall-clock: 60-100s (40-50% reduction)
```

### Asset breakdown in new flow

| Section | Image count | Strategy | New cost |
|---|---|---|---|
| hero | 2 | 1 ai_full + 1 derived (overlay swap) | 6 credit |
| pain | 5 | 5 ai_full (emotional, must vary) | 30 credit |
| why-happens | 1-2 | template_composed (infographic from copy + reusable bg) | 0 |
| failed-solutions | 1-2 | 1 ai_full (only the person) | 6 credit |
| product-discovery | 1 | derived from hero (same person, new pose framing) — fallback ai_full | 6 credit |
| ingredients | 2-3 | template_composed (ingredient name + reusable swatch + product render) | 0 |
| mechanism | 1-2 | template_composed (diagram from copy steps + arrows) | 0 |
| benefits | 1 | template_composed (icon grid from `bullets` array) | 0 |
| comparison | 1 | template_composed (HTML table → canvas) | 0 |
| lifestyle | 1-2 | 1 ai_full (true human scene) | 6 credit |
| social-proof | 5 | 1 ai_full selfie + 1 ai_full crowd + 3 template_composed (FB / TikTok / Shopee) | 12 credit |
| whatsapp-testimonials | 4 | All 4 template_composed (WA UI from copy + reusable avatar + product render) | 0 |
| news-proof | 2 | template_composed (article layout + reusable hero) | 0 |
| before-after | 4 | 2 ai_full portrait pairs → 4 derived collages | 12 credit |
| faq | 0 | — | 0 |
| offer | 2 | reusable product render + template promo banner overlay | 6 credit |
| final-cta | 2 | template_composed (reusable product + metrics overlay) | 0 |
| **TOTAL ai_full** | **~12** | | |
| **TOTAL reusable** | **1** (product packshot) | | |
| **TOTAL template** | **~17** | | |
| **TOTAL derived** | **~5** | | |
| **FINAL ASSETS** | **~35** (unchanged) | | **~84 credit** |

**Savings**: ~126 credit / pack (60% reduction). ~30-50s faster (KIE rate-limit relief).

---

## 3. FILES TO MODIFY / CREATE

See `RESTORE_GUIDE.md → FILES THAT WILL BE TOUCHED` for the full list. Quick summary:

| File | Action | Risk |
|---|---|---|
| `lib/featureFlags.ts` | NEW | Low — pure read of env var |
| `services/renderPlanner.ts` | NEW | Medium — classification logic must be correct or wrong assets go to wrong path |
| `services/templateEngine.ts` | NEW | High — canvas/HTML composition is complex; broken composer = broken asset |
| `services/composers/*.ts` | NEW (6 files) | Medium each — isolated per asset type, easy to test |
| `services/productRenderPool.ts` | NEW | Medium — wrong cache key = wrong reuse |
| `services/generateImages.ts` | MODIFIED | High — routing logic gates everything |
| `types.ts` | MODIFIED | Low — additive optional fields |
| `components/SectionCard.tsx` | MODIFIED | Low — render templated asset same as AI asset (no UI diff) |
| `components/OutputPanel.tsx` | MODIFIED | Low — metrics chip only |
| `generateLandingPack.ts` | UNTOUCHED | — |
| `store.ts` | UNTOUCHED | — |
| `LandingPageAI.tsx` | UNTOUCHED | — |

### Risk hot-spots

🔴 **High**: `templateEngine.ts` — must accurately fake authentic WhatsApp / Shopee / news screenshots. If templates look "too clean" or "too synthetic", trust signal drops.

🟡 **Medium**: `renderPlanner.ts` — classification must err on the side of AI render when uncertain. A hero scene routed to template = catastrophe. An infographic routed to AI = wasted credit but no visible damage.

🟡 **Medium**: `productRenderPool.ts` — cache key must be `{productId, packshot-style, aspect}`. Mis-keyed reuse = wrong product appears in a section.

🟢 **Low**: feature flag itself — if flag broken, fallback is "always legacy", which is safe.

---

## 4. CREDIT REDUCTION ESTIMATE

| Metric | Current | Hybrid | Saving |
|---|---|---|---|
| AI render count | 35 | 12-13 | **-65%** |
| KIE credit / pack | ~210 | ~84 | **-60%** |
| Gemini call count | 1 | 1 | 0% |
| Gemini cost | ~$0.01 | ~$0.01 | 0% |
| Wall-clock (full pack, concurrency=6) | 90-180s | 60-100s | **-40%** |
| Wall-clock (1 image regen) | 30-90s | 0.2-30s (template = instant) | -90% |
| Supabase Storage / pack | ~25MB blobs | ~15MB blobs (reuse + smaller PNGs) | -40% |

### Real-money math (per user gen)

| User pattern | Current cost | Hybrid cost |
|---|---|---|
| Gen 1 pack | 210 credit | 84 credit |
| Gen + 5 retries on failed images | 240 credit | 96 credit (template retries are free) |
| Gen 10 packs / month | 2100 credit | 840 credit |
| KIE.ai pricing (approx $0.05 per gpt-4o-image call = 6 credit) | $17.50/mo | $7.00/mo |

For a Malaysia ad agency churning 50-100 packs/month, savings compound to ~$50-100/month per seat.

---

## 5. ROLLBACK IMPACT

| Rollback level | What's lost | What's kept | Time to recover |
|---|---|---|---|
| Level 0 (flag off) | New flow paused, legacy resumes | All saved projects, all in-flight | Instant |
| Level 1 (revert HEAD) | Latest refactor commit | All prior commits | 2-3 min deploy |
| Level 2 (revert series) | Entire refactor | Saved projects keep working (additive fields ignored) | 2-3 min deploy |
| Level 3 (hard reset) | Refactor + any subsequent unrelated commits | Saved projects keep working | 2-3 min deploy |
| Level 4 (backup branch as main) | All commits since `2631890` | Tag stays intact | 2-3 min deploy |

Saved projects (`landing-page-saved-v1` localStorage entries) are
backward-compatible at every rollback level because all new fields on
`ImagePrompt` and `LandingSection` are optional.

---

## 6. PHASE EXECUTION ORDER (after this plan is approved)

Each phase is its own commit prefixed `feat(hybrid-render): phase N — ...`
so revert granularity is per-phase.

1. **Phase 1**: types + feature flag + renderPlanner (scaffolding, behavior unchanged)
2. **Phase 2**: productRenderPool (reusable cache, no consumers yet)
3. **Phase 3**: templateEngine + first composer (whatsapp) — gated behind flag
4. **Phase 4**: composers for review / news / promo / before-after / final-cta
5. **Phase 5**: renderPlanner routing logic wired up
6. **Phase 6**: generateImages route-by-strategy implementation
7. **Phase 7**: SectionCard renders both legacy and hybrid assets identically
8. **Phase 8**: OutputPanel metrics chip (AI count / derived count / credit saved)
9. **Phase 9**: BEFORE_AFTER_COMPARISON.md with real numbers from production tests

Each phase can be flag-toggled independently. If Phase 4 templates look
wrong, set `ENABLE_HYBRID_RENDER=false` while Phase 5 is being fixed —
zero-deploy mitigation.

---

## 7. NON-GOALS (explicit OUT-OF-SCOPE)

These are NOT addressed by this refactor and will remain pain points:
- Master Frame timeout 70s (separate fix tracked elsewhere)
- Prompt size compression for video-builder v2 (separate)
- Supabase backend `landing_pages` table (still localStorage-only)
- Export HTML (separate scope)
- Version history / snapshots (separate scope)
- Visual memory persistence across F5 (separate scope)

---

## 8. APPROVAL GATE

Before Phase 1 begins, the user must confirm:
- [ ] Backup branch + tag verified on GitHub
- [ ] Restore guide reviewed
- [ ] Architecture diff plan reviewed
- [ ] Final asset count target (~35) is acceptable
- [ ] Visual density preservation is acceptable
- [ ] Phase order is acceptable

Without explicit user approval, Phase 1 implementation does NOT proceed.
