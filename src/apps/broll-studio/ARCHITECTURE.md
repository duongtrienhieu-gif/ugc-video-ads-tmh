# Creative Studio Architecture (broll-studio app)

> **Status**: Phase 2 — registry skeleton landed. Existing `BrollStudio.tsx`
> still runs on its legacy direct-KIE path. Migration into the new
> architecture begins in P3.

## Folder map

```
src/apps/broll-studio/
│
├─ BrollStudio.tsx                  ← active legacy app entry (UNTOUCHED through P2)
├─ services/
│  └─ qcProduct.ts                  ← active legacy QC (UNTOUCHED through P2)
│
├─ ARCHITECTURE.md                  ← this file
│
├─ types/                           ← P2 — type contracts only
│  ├─ engine.ts                       EngineGroup, ENGINE_GROUP_CHARACTERISTICS
│  ├─ asset.ts                        AssetTypeId, AssetCategory, AssetMetadata,
│  │                                  GeneratedAsset, GenerateAssetParams
│  ├─ photographic.ts                 PhotographicModule + Composition/QC/Negative
│  ├─ uiNative.ts                     UINativeModule + Template/TextContent/Auth
│  └─ designedGraphic.ts              DesignedGraphicModule + Layout/Typography/Color
│
├─ registry/                        ← P2 — dispatch layer (static imports only)
│  ├─ groups.ts                       ASSET_TO_GROUP map, getEngineGroup helpers
│  ├─ assetRegistry.ts                ASSET_REGISTRY (empty placeholder)
│  └─ resolveAssetType.ts             resolveAssetType() + AssetNotImplementedError
│
├─ orchestration/                   ← P2 — public entry + dispatch
│  ├─ generateAssets.ts               PUBLIC entry: generateAssets(id, params)
│  └─ dispatch.ts                     ENGINE_DISPATCH table + dispatchToEngine()
│
├─ engines/                         ← engine module homes (P3+)
│  ├─ photographic/                    P3 will populate
│  ├─ ui-native/                       P5+ will populate
│  └─ designed-graphic/                P8 will populate
│
├─ shared/                          ← cross-engine utilities (P3+)
│  ├─ prompts/                         shared prompt fragments
│  ├─ qc/                              productMatch.ts moves here in P3
│  ├─ transforms/                      image post-process utilities
│  └─ metadata/                        persona library, locale dicts
│
└─ _future/                         ← experimental drafts, not in production
```

## Three engine groups — STRICT isolation

| Group | Backend | Output mode | Quality lever |
|---|---|---|---|
| **photographic** | KIE GPT-4o | single image | prompt |
| **ui-native** | canvas + KIE atomic | composed canvas | template + reference library |
| **designed-graphic** | canvas + KIE atomic | designed layout | design system + typography |

**Architectural rule**: modules in one group MUST NOT import from another group. Folder boundary enforces this convention. Each group is a distinct technical pipeline with its own quality concerns — sharing logic would create the mixed-engine confusion the old broll-studio architecture suffered.

## Static imports only

The registry uses STATIC imports exclusively:

```ts
// ✅ correct
import { module as productShot } from '../engines/photographic/product-shot/module'
export const ASSET_REGISTRY = { 'product-shot': productShot, ... }

// ❌ FORBIDDEN — caused 404-after-redeploy bug in Phase 7 of landing-page
'product-shot': () => import('../engines/photographic/product-shot/module')
```

All engine modules are bundled into the main `index.js` chunk. Bundle bloat is acceptable — predictability + zero stale-chunk failure mode beats lazy loading for an internal creative tool.

## Public entry point

External callers (the BrollStudio UI shell once migrated) interact with a single function:

```ts
import { generateAssets } from './orchestration/generateAssets'

const asset = await generateAssets('product-shot', {
  productId: 'prod_xxx',
  modelId: 'model_yyy',
  options: { sceneId: 'kitchen', styleId: 'iphone' },
})
```

The orchestrator:
1. Resolves `assetTypeId` → `AssetModule` via the registry
2. Dispatches by `module.engineGroup` to the right pipeline
3. Returns a `GeneratedAsset` with normalised metadata

## Phase status

| Phase | Status | Scope |
|---|---|---|
| **P1** | ✅ done | Dead code cleanup (1062 lines → graveyard) |
| **P2** | ✅ done (this commit) | Type contracts + registry + orchestration skeleton |
| **P3** | pending | Migrate current BrollStudio scenes → engines/photographic/ modules |
| **P4** | pending | Continuity engine + persona library + emotional timeline |
| **P5** | pending | UI-Native MVP: Chat Proof (WhatsApp + Messenger) |
| **P6** | pending | UI-Native expansion: Shopee + TikTok Shop + Facebook + TikTok comments |
| **P7** | pending | Authenticity QC v2 + designed-graphic group entry |
| **P8** | pending | Designed-Graphic group: Infographic + CTA Banner |
| **P9** | pending | Shared utils cleanup + cross-app QC promotion |
| **P10** | pending | App id rename (broll-studio → creative-studio) with alias |

## Boundaries — what P2 did NOT touch

- `BrollStudio.tsx` (1158 lines) — byte-identical to pre-P2
- `services/qcProduct.ts` — byte-identical
- `src/apps/landing-page/` — entirely untouched
- `src/utils/*` — entirely untouched
- `src/stores/*` — entirely untouched
- `src/services/sessionPersistence.ts` — untouched
- `App.tsx` `APP_COMPONENTS` / `APP_BOUNDARY_META` — untouched
- `Sidebar.tsx` — untouched

The skeleton lives alongside the legacy app. Migration happens in P3.
