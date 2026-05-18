# Creative Studio Architecture (broll-studio app)

> **Status**: Phase 4 — continuity engine + persona library + emotional
> beats foundation landed. Existing `BrollStudio.tsx` still runs on its
> legacy direct-KIE path. The 9 photographic modules from P3 remain
> byte-stable; opt-in wiring into persona / beat / continuity is deferred
> to the phase that owns BrollStudio UI changes.

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
│  ├─ designedGraphic.ts              DesignedGraphicModule + Layout/Typography/Color
│  ├─ persona.ts                      P4 — Persona archetype contract
│  ├─ emotionalBeat.ts                P4 — EmotionalBeat + EditorialPhase + ShotEnergy
│  └─ continuity.ts                   P4 — ContinuitySession + ContinuityRef
│
├─ registry/                        ← P2 — dispatch layer (static imports only)
│  ├─ groups.ts                       ASSET_TO_GROUP map, getEngineGroup helpers
│  ├─ assetRegistry.ts                ASSET_REGISTRY (empty placeholder)
│  └─ resolveAssetType.ts             resolveAssetType() + AssetNotImplementedError
│
├─ orchestration/                   ← P2 — public entry + dispatch
│  ├─ generateAssets.ts               PUBLIC entry: generateAssets(id, params)
│  ├─ generateAssetSequence.ts        P4 — multi-shot wrapper with continuity
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
│  ├─ metadata/                        styleVariants (P3), personaLibrary (P4),
│  │                                   emotionalBeats (P4)
│  └─ continuity/                      P4 — in-memory continuity engine
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
| **P2** | ✅ done | Type contracts + registry + orchestration skeleton |
| **P3** | ✅ done | Migrate current BrollStudio scenes → engines/photographic/ modules |
| **P4** | ✅ done (this commit) | Continuity engine + persona library + emotional beats (foundation) |
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

## P4 — Continuity / Persona / Emotional Beats

P4 lands a foundation layer that downstream engine groups (P5 ui-native
chat-proof, P6 marketplace, P8 designed-graphic) will consume. The 9
photographic modules from P3 stay byte-stable — opt-in wiring is
deferred to the phase that owns BrollStudio UI changes.

### Persona Library

`shared/metadata/personaLibrary.ts` ships 6 archetype presets covering
the most common SEA UGC patterns (VN office female, VN homemaker, VN
office male, VN Gen Z student, MY hijab woman, generic SEA female).
Each persona declares:

- `appearance` — 60-100 word physical description block
- `environment` — 40-60 word typical-context block
- `voiceCharacter` — tone / personality cues for caption + script
- `demographicTags` — filterable tags for UI pickers
- `suitableFor` — AssetCategory hint for sensible defaults

Personas are TEXT-ONLY locks — they do not require a reference image.
Combine with a Model bank entry when both archetype text AND image
identity-lock are wanted.

### Emotional Beats

`shared/metadata/emotionalBeats.ts` ships 10 beat presets across the
5-phase editorial arc (hook / body / education / recovery / cta). Each
beat declares mood + face expression directives. Vocabulary
(`EditorialPhase`, `ShotEnergy`) is intentionally identical to
video-builder v2 so a cross-tool flow (photographic still →
video animation) stays emotionally coherent.

The types are RE-DECLARED locally in `types/emotionalBeat.ts` rather
than imported from video-builder — broll-studio MUST NOT cross into
other apps per the engine-isolation rule. P9 may promote shared types
if cross-app reuse demands it.

### Continuity Engine

`shared/continuity/continuityEngine.ts` manages in-memory
ContinuitySession objects. Pattern is the generalization of the
landing-page advertorial "render hero first, inject as ref[0] for the
rest" mechanism (see
`src/apps/landing-page/services/generateImages.ts:547`).

Public API exported via `shared/continuity/index.ts`:

```ts
const sid = startContinuitySession({ productId, modelId, personaId })
// run first shot (hero)
const hero = await generateAssets('ugc-selfie', {...})
bindHeroAsset(sid, hero)
// subsequent shots — pass baseRef from session
const refs = resolveContinuityRefs(sid, product.image, model?.image)
const directive = buildContinuityDirective(sid, beatId)
// ...
disposeContinuitySession(sid)
```

Sessions are in-memory only (no Zustand, no IndexedDB). One session per
"shoot" / "sequence". Caller owns the lifecycle.

### Sequence Orchestrator

`orchestration/generateAssetSequence.ts` is the high-level wrapper:

```ts
const { assets } = await generateAssetSequence(
  [
    { assetTypeId: 'ugc-selfie',      beatId: 'hook-curiosity' },
    { assetTypeId: 'holding-product', beatId: 'education-discovery' },
    { assetTypeId: 'before-after',    beatId: 'recovery-relief' },
  ],
  { productId, modelId, personaId: 'vn-homemaker-mid-30s' },
)
```

The orchestrator opens a session, runs each shot sequentially, binds
the first asset as the hero, and injects continuity refs + directive
into every subsequent call via `params.options.baseRef` +
`params.options.continuityDirective`.

`generateAssets()` is NOT modified — single-shot path stays byte-stable.

### Wiring into existing modules

NOT done in P4. The 9 photographic modules from P3 ignore the new
`options.continuityDirective` / `options.beatId` / `options.personaId`
fields by design — their `_buildModule.ts` factory currently composes
prompts from `PRODUCT_LOCK + AVATAR_LOCK + scene + style + variation +
format` only. A later phase will extend the factory to consume the new
options when present and to inject them ahead of the scene block.

### Boundaries — what P4 did NOT touch

- `BrollStudio.tsx` — byte-identical
- `services/qcProduct.ts` — byte-identical
- `engines/photographic/_buildModule.ts` — byte-identical
- `engines/photographic/_dispatcher.ts` — byte-identical
- `engines/photographic/*/module.ts` (all 9) — byte-identical
- `orchestration/generateAssets.ts` — byte-identical
- `orchestration/dispatch.ts` — byte-identical
- `registry/*` — byte-identical
- `src/apps/landing-page/`, `src/apps/video-builder/` — untouched
- `src/stores/*`, `src/utils/*`, `App.tsx`, `Sidebar.tsx` — untouched
