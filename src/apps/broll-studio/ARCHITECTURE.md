# Creative Studio Architecture (broll-studio app)

> **Status**: Phase 5 — UI-Native MVP (WhatsApp + Messenger chat proof)
> landed. Two ui-native modules wired into the registry, ui-native
> dispatcher implemented end-to-end (Gemini text → KIE avatar → Canvas
> template → JPEG post-process → asset). Existing `BrollStudio.tsx`
> still runs on its legacy direct-KIE path; the new modules are reached
> via `generateAssets()` only.

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
| **P4** | ✅ done | Continuity engine + persona library + emotional beats (foundation) |
| **P5** | ✅ done (this commit) | UI-Native MVP: Chat Proof (WhatsApp + Messenger) |
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

## P5 — UI-Native MVP (Chat Proof)

P5 lands the first concrete ui-native engine modules — `whatsapp-proof`
and `messenger-chat` — plus the full ui-native dispatcher pipeline.
Pipeline is fundamentally different from photographic:

```
generateAssets('whatsapp-proof', params)
  └─ dispatchUINative(module, params)
      1. Determine template (canvas size, theme, palette)
      2. Build message timeline (timestamps + date label, locale-aware)
      3. Generate text payload (Gemini Text — conversation script)
         OR consume params.options.textPayload (caller short-circuit)
      4. Generate atomic avatar (KIE GPT-4o, 1:1)
      5. Render conversation on HTMLCanvasElement
         (status bar + header + bubbles + composer)
      6. Post-process (crop drift + JPEG recompress)
      7. saveAsset + normalizeOutput → GeneratedAsset
```

### Folder layout for P5

```
engines/ui-native/
├─ _shared/                          shared helpers across all platforms
│  ├─ canvas.ts                        create / load / wrap / blob helpers
│  ├─ colors.ts                        WHATSAPP_LIGHT_2024 / MESSENGER_LIGHT_2024
│  ├─ statusBar.ts                     iOS / Android status bar renderer
│  ├─ timestamps.ts                    buildTimeline() + locale day labels
│  ├─ postProcess.ts                   JPEG recompress + crop drift
│  ├─ avatarGen.ts                     atomic KIE avatar generator
│  └─ textPayload.ts                   Gemini conversation generator
│
├─ _dispatcher.ts                    public ui-native pipeline entry
│
├─ whatsapp-proof/
│  ├─ module.ts                        UINativeModule export
│  ├─ template.ts                      renderWhatsAppConversation()
│  └─ exemplars.ts                     ReferenceExemplar pool (empty MVP)
│
└─ messenger-chat/
   ├─ module.ts
   ├─ template.ts                      renderMessengerConversation()
   └─ exemplars.ts
```

### Authenticity rules

Both modules declare the same `UINativeAuthenticity` ruleset:

- `requireStatusBar: true`     — iOS notch + battery / wifi / signal glyphs
- `requireRealisticTimestamps: true` — 24h time, locale day labels, 1-12 min message gaps
- `requireImperfectCrop: true` — 4-14px drift on each edge per `postProcess` intensity
- `requireJpegCompression: true` — JPEG output at quality 0.82 (medium intensity default)
- `bannedAesthetics`           — figma-perfect-edges, studio-clean-screenshot,
                                 png-export, desktop-screenshot, rgba-transparency

### Locale support

Text payload + timeline support 4 locales:

- `my-MY`  Malay (Bahasa Melayu)
- `vi-VN`  Vietnamese (default for both P5 modules)
- `id-ID`  Indonesian
- `global` English fallback

### Caller short-circuit

Callers can supply a pre-built `UINativeTextContent` via
`params.options.textPayload` to skip the Gemini call. Useful for:

- fixtures + visual regression testing
- manual scripting where the user wrote the dialogue themselves
- batch-rendering N variants of the same conversation

### Boundaries — what P5 did NOT touch

- `BrollStudio.tsx` — byte-identical (still legacy direct-KIE path)
- `services/qcProduct.ts` — byte-identical
- P3 photographic engine — byte-identical (zero new imports)
- P4 continuity + persona + beats — byte-identical (not yet consumed)
- `orchestration/generateAssets.ts` — byte-identical
- `orchestration/generateAssetSequence.ts` — byte-identical
- `registry/groups.ts` — byte-identical (already declared 'whatsapp-proof' + 'messenger-chat' in P2 ASSET_TO_GROUP map)
- `src/apps/landing-page/`, `src/apps/video-builder/` — untouched
- `src/stores/*`, `src/utils/*`, `App.tsx`, `Sidebar.tsx` — untouched

### Wiring with P4 continuity

P5 modules do not yet consume `params.options.personaId` /
`params.options.beatId` / `params.options.continuityDirective`. The
`textPayload` generator inside P5 already takes `personaId` directly
through its `TextPayloadRequest`, so this wiring is one small commit
when the BrollStudio UI gains persona pickers (planned with the UI
overhaul phase).

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
