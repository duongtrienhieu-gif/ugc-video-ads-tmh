# Creative Studio Architecture (broll-studio app)

> **Status**: Phase 8 — Designed-Graphic group complete (infographic +
> cta-banner). Three engine groups all serving concrete modules:
> photographic (9), ui-native (6), designed-graphic (2) = **17
> implemented asset types**. Existing `BrollStudio.tsx` still on its
> legacy direct-KIE path; new modules reachable only via
> `generateAssets()`.

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
| **P5** | ✅ done | UI-Native MVP: Chat Proof (WhatsApp + Messenger) |
| **P6** | ✅ done | UI-Native expansion: Shopee + TikTok Shop + Facebook + TikTok comments |
| **P7** | ✅ done | Authenticity QC v2 + designed-graphic group entry |
| **P8** | ✅ done (this commit) | Designed-Graphic group: Infographic + CTA Banner |
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

## P6 — UI-Native expansion (Marketplace + Social Comment)

P6 extends the ui-native engine with 4 new modules across 2 new
content shapes. The dispatcher gained a `TextPayloadContentType`
router (`chat` / `review` / `comment-thread`) so the same pipeline
serves chat threads, marketplace reviews, and social comment lists
without code duplication.

ASSET_REGISTRY now has 15 implemented entries (9 photographic +
6 ui-native).

### New modules

| Asset id | Platform | Category | Content shape | Renderer |
|---|---|---|---|---|
| `shopee-feedback` | Shopee | marketplace | single review | renderShopeeReview() |
| `tiktok-feedback` | TikTok Shop | marketplace | single review | renderTikTokShopReview() |
| `facebook-comment` | Facebook | social-comment | comment thread | renderFacebookComments() |
| `tiktok-comment` | TikTok | social-comment | dark comment overlay | renderTikTokComments() |

### New asset type id

P6 adds one new id to the AssetTypeId union: `tiktok-comment`
(P2 pre-declared only 3 of the 4 expansion targets). Also added
to ASSET_TO_GROUP routing table.

### New shared palettes (`_shared/colors.ts`)

- `SHOPEE_LIGHT_2024`        — Shopee orange #EE4D2D + teal verified badge
- `TIKTOK_SHOP_LIGHT_2024`   — TikTok pink-red #FE2C55 + cyan accent
- `FACEBOOK_LIGHT_2024`      — Facebook blue #1B74E4 + grey divider
- `TIKTOK_COMMENT_DARK_2024` — pure dark theme for the comment overlay

### Extended `_shared/textPayload.ts`

The Gemini text generator now routes by `TextPayloadContentType`:

```ts
// Chat (P5) — generateTextPayload returns dialog with side: incoming|outgoing
// Review (P6) — generateTextPayload returns single review with star
//   rating encoded as reactions[]: ['★5', 'variant:...', 'helpful:N']
// Comment thread (P6) — generateTextPayload returns multi-author thread
//   with likes + isReply encoded as reactions[]: ['likes:N', 'isReply:true']
```

Helper readers exposed: `readRating()`, `readVariant()`, `readHelpful()`,
`readLikes()`, `readIsReply()` — templates use these to decode the
reactions[] array without depending on the generator's internal shape.

### Dispatcher upgrade

`engines/ui-native/_dispatcher.ts` now ships:

- `TEMPLATE_RENDERERS: Record<UINativePlatform, RendererFn>` — full
  table, all 6 platforms wired
- `PLATFORM_CONTENT_TYPE: Record<UINativePlatform, TextPayloadContentType>`
  — default content type per platform (drives Gemini prompt selection)
- `PLATFORM_DEFAULT_COUNT: Record<UINativePlatform, number>` — sensible
  defaults (1 for review, 6 for FB comments, 8 for TikTok comments
  + chat)
- Product image URL resolved from bankStore.getProductById() and passed
  to the renderer as `productImageUrl` (used by review templates for
  the photo attachment thumb)

### Boundaries — what P6 did NOT touch

- `BrollStudio.tsx` — byte-identical
- `services/qcProduct.ts` — byte-identical
- P3 photographic engine — byte-identical
- P4 continuity + persona + beats — byte-identical
- P5 chat modules + their templates — byte-identical
- `orchestration/generateAssets.ts` — byte-identical
- `orchestration/generateAssetSequence.ts` — byte-identical
- `orchestration/dispatch.ts` — byte-identical (P5 wired the slot)
- `src/apps/landing-page/`, `src/apps/video-builder/` — untouched
- `src/stores/*`, `src/utils/*`, `App.tsx`, `Sidebar.tsx` — untouched

## P7 — Authenticity QC v2 + Designed-Graphic Entry

P7 ships two coupled deliverables: a two-tier authenticity QC pipeline
running on every ui-native generation, and the typed entry point for
the designed-graphic engine group (the last `notYetImplemented` stub
in `orchestration/dispatch.ts` is gone).

### Authenticity QC v2

Pipeline runs inside `engines/ui-native/_dispatcher.ts` between
post-process and `saveAsset`:

```
... → applyPostProcess(canvas) → blob
  → runAuthenticityQC({ blob, expectedW/H, authenticity, platform, ... })
      ├─ Tier 1 local heuristics (always, sync)
      │     blob.size floor/ceiling, JPEG SOI marker, MIME match,
      │     RGBA transparency sample (banned), decoded dimensions vs
      │     template (drift > 30px = warning)
      └─ Tier 2 vision QC (opt-in via params.options.runVisionQC)
            Gemini Vision rubric per UINativeAuthenticity, returns
            { pass, score, findings[] }
  → saveAsset(blob) → assetRef
  → normalizeOutput + attach qcSummary { passed, overall, issues, visionPass }
```

QC score policy (see `shared/qc/authenticityQC.ts`):

- Start at 100, deduct per-issue penalty (local error -25, vision
  error -20, local warning -8, vision warning -6, info -2/-1)
- If vision tier ran, overall = (localScore + visionScore) / 2
- `passed` = no error-severity issues AND overall >= minPassScore (default 70)
  AND (vision tier did not run OR visionPass = true)

### New files (QC)

```
shared/qc/
├─ authenticityQC.ts         main orchestrator — runAuthenticityQC()
├─ localHeuristics.ts        runLocalHeuristics() + checkDecodedDimensions()
└─ visionQC.ts               runVisionQC() — Gemini Vision rubric + parse
types/qc.ts                  QCVerdict, QCIssue, QCRunOptions, QCSeverity
```

### AssetMetadata.qcSummary expanded (additive, back-compat)

```ts
qcSummary?: {
  passed: boolean
  overall: number
  issues?: { code, message, severity, tier }[]   // NEW in P7, optional
  visionPass?: boolean | null                     // NEW in P7, optional
}
```

P3/P5/P6 modules that did not previously set `qcSummary` keep working;
the dispatcher attaches the verdict in normalizeOutput's wake.

### Designed-Graphic group entry

P7 lands the typed entry point for the designed-graphic engine group
— the dispatcher itself still throws "P8 will fill this in" but the
slot in `ENGINE_DISPATCH` is no longer the generic
`notYetImplemented` stub. P8 only needs to fill the dispatcher body
(no orchestration changes).

### New files (designed-graphic foundation)

```
engines/designed-graphic/
├─ _dispatcher.ts            typed entry — throws with helpful guidance
└─ _buildModule.ts           DesignedGraphicModule factory (P8 modules
                             will consume this)

shared/design-system/
├─ typography.ts             TYPOGRAPHY_PRESETS (4 preset scales),
                             findTypography()
├─ colorThemes.ts            COLOR_THEMES (5 preset palettes),
                             findColorTheme()
└─ grid.ts                   LAYOUT_PRESETS (infographic-1x1/4x5,
                             cta-banner-16x9/4x5), contentRect(),
                             columnRect(), spanColumns(),
                             splitVertical(), findLayout()
```

### Boundaries — what P7 did NOT touch

- `BrollStudio.tsx` — byte-identical
- `services/qcProduct.ts` — byte-identical
- P3 photographic engine — byte-identical (qcSummary attachment is
  opt-in via normalizeOutput; current photographic.normalizeOutput
  does not set it)
- P4 continuity + persona + beats — byte-identical
- P5 chat modules + their templates — byte-identical
- P6 marketplace + comment modules + their templates — byte-identical
- `orchestration/generateAssets.ts` — byte-identical
- `orchestration/generateAssetSequence.ts` — byte-identical
- `registry/*` — byte-identical
- `src/apps/landing-page/`, `src/apps/video-builder/` — untouched
- `src/stores/*`, `src/utils/*`, `App.tsx`, `Sidebar.tsx` — untouched

## P8 — Designed-Graphic Group (Infographic + CTA Banner)

P8 fills the designed-graphic dispatcher body (P7 left it stubbed)
and ships 2 concrete modules built via the
`buildDesignedGraphicModule` factory. All three engine groups now
have concrete modules and live dispatchers.

ASSET_REGISTRY now has **17 implemented entries** (9 photographic +
6 ui-native + 2 designed-graphic).

### Pipeline

```
generateAssets('infographic', { productId, options })
  → dispatchDesignedGraphic(module, params)
      1. Resolve product context from bankStore
      2. module.buildLayout / buildTypography / buildColorTheme
         (caller overrides via opts.layoutId / typographyId /
         colorThemeId)
      3. Generate text content via Gemini Text — or short-circuit
         via opts.content (typed InfographicContent | CtaBannerContent)
      4. Resolve product image URL from bankStore for the hero visual
      5. Render canvas via the platform renderer
         (rendererKind 'infographic' → renderInfographic;
          rendererKind 'cta-banner'  → renderCtaBanner)
      6. canvasToBlob (JPEG, quality 0.94 — pixel-clean, no
         authenticity post-process drift like ui-native does)
      7. saveAsset → assetRef
      8. module.normalizeOutput (factory-provided)
```

### New files

```
engines/designed-graphic/
├─ _dispatcher.ts                BODY FILLED — see above pipeline
├─ _buildModule.ts               (P7, unchanged)
├─ _textPayload.ts               generateInfographicContent +
│                                generateCtaBannerContent (Gemini text)
├─ infographic/
│  ├─ module.ts                  buildDesignedGraphicModule spec
│  └─ template.ts                renderInfographic()
└─ cta-banner/
   ├─ module.ts
   └─ template.ts                renderCtaBanner()
```

### Renderer architecture

Each renderer is pure canvas — no Gemini, no KIE. Pulls the
already-resolved content + design tokens and lays them out:

**Infographic (4:5, 1080×1350)**
- Background gradient from colorTheme.gradient
- Uppercase title in primary color
- Hero stat: large display value + accent unit suffix + label line
- Accent divider bar
- Numbered bullet rows (1-5 items, splitVertical layout)
- Optional product image inset top-right (220px rounded square)
- Footnote at bottom (caption typography, 55% alpha)

**CTA Banner (4:5, 1080×1350)**
- Background gradient
- Product image hero on top 42% of canvas (rounded, cover-fit, clip)
- Offer pill (uppercase caption, accent fill, primary text)
- Display headline (left-aligned, 800 weight)
- Subheadline (72% alpha, body size)
- Full-width CTA button at bottom (primary fill, uppercase text,
  arrow glyph on right)

### Caller short-circuit

```ts
// Skip the Gemini call:
generateAssets('infographic', {
  productId: 'prod_xxx',
  options: {
    content: {
      title: 'GIẢM 47% MẤT NGỦ',
      heroStat: { value: '47', unit: '%', label: 'cải thiện sau 2 tuần' },
      bullets: ['Ngủ sâu trong 7 phút', 'Tỉnh táo buổi sáng', 'Không phụ thuộc'],
      footnote: 'Nghiên cứu nội bộ, 200 người dùng, 2024',
    },
    layoutId:     'infographic-4x5',
    colorThemeId: 'wellness-clean',
  },
})
```

### Design token override knobs

Caller can pass any of these via `params.options`:
- `layoutId` → key in `LAYOUT_PRESETS`
- `typographyId` → key in `TYPOGRAPHY_PRESETS`
- `colorThemeId` → key in `COLOR_THEMES`
- `content` → typed payload to short-circuit Gemini
- `locale` → `'vi-VN'` (default) | `'my-MY'` | `'id-ID'` | `'global'`
- `tone` → free-form tone hint for content generation
- `benefits` / `usps` / `offer` / `niche` / `productName` /
  `productDescription` → override the bankStore lookup

### Boundaries — what P8 did NOT touch

- `BrollStudio.tsx` — byte-identical (still legacy direct-KIE path)
- `services/qcProduct.ts` — byte-identical
- P3 photographic — byte-identical
- P4 continuity / persona / beats — byte-identical
- P5 / P6 ui-native modules + dispatcher — byte-identical
- P7 QC pipeline — byte-identical (designed-graphic does not run
  the ui-native authenticity QC; pixel-clean output is its own QC)
- `orchestration/generateAssets.ts` — byte-identical
- `orchestration/generateAssetSequence.ts` — byte-identical
- `registry/groups.ts` — byte-identical (already declared
  infographic + cta-banner in P2 ASSET_TO_GROUP)
- `src/apps/landing-page/`, `src/apps/video-builder/` — untouched
- `src/stores/*`, `src/utils/*`, `App.tsx`, `Sidebar.tsx` — untouched

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
