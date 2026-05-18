# `_graveyard_phase1/` — Dead Code Archive

## Purpose

This folder stores legacy / dead source files removed from `src/` during
**Phase 1 cleanup of the Creative Studio migration**.

These files are **NOT compiled** (the folder is outside `tsconfig.app.json`'s
`include: ["src"]` scope and outside Vite's source root). They are kept on
disk only as a recovery safety net in case a dependency we missed surfaces
later.

## Phase 1 contents

Source path → graveyard path:

| Original | Reason for removal |
|---|---|
| `src/apps/broll-studio/services/generateBroll.ts` | Old "AI B-Roll director from script" pipeline. Superseded by `BrollStudio.tsx`'s direct `generateGpt4oImage` calls. Zero external imports verified via grep. |
| `src/apps/broll-studio/components/InputPanel.tsx` | Old broll-studio input panel. Not imported by `BrollStudio.tsx` (which renders its own input inline). Zero external imports. |
| `src/apps/broll-studio/components/OutputPanel.tsx` | Old broll-studio output panel. Only references the legacy `BrollResult` types. Not imported by `BrollStudio.tsx`. Zero external imports. |
| `src/apps/broll-studio/types.ts` | Legacy types (`BrollInput`, `Scene`, `BrollResult`, `PromptVariation`, `CardState`, `GeneratedImage`, `ReferenceImage`, `SceneType`). Used ONLY by the 3 dead files above (now also archived). Active code uses inline interfaces in `BrollStudio.tsx`. |

## Removal verification

Each file was verified before move with:
```
grep -rln "from.*broll-studio/services/generateBroll" src/
grep -rln "from.*broll-studio/components/InputPanel"  src/
grep -rln "from.*broll-studio/components/OutputPanel" src/
grep -rln "from.*broll-studio/types"                  src/
grep -rln "generateBroll\b|generateNewVariation|animateFrame|BrollResult|BrollInput|PromptVariation|CardState|GeneratedImage" src/
```
All returned **empty** outside the dead-file triangle itself.

Build verified clean: `npm run build` passes after the move.

## Restoration procedure

If a file in this graveyard is needed later:

1. Identify the specific export that is required
2. Move ONLY the relevant file back to its original `src/` path
3. Re-add to `git ls-files`
4. Run `npm run build` to verify
5. Document the restoration reason in this README

## Hard-delete schedule

Files in this folder may be hard-deleted from the repo **after 60 days**
without restoration request. Once deleted from git history, they remain
recoverable only via the commit that introduced this graveyard.

## Out-of-scope notes (deferred from Phase 1)

These dead-code candidates were identified during Phase 1 audit but
NOT moved because they live outside `broll-studio/` scope:

- `src/utils/openai.ts` — all 4 exports (`generateBrollImageGPT`,
  `editImageWithReferenceGPT`, `fetchImageAsBlob`, `testOpenAIConnection`)
  have zero consumers in `src/`. File is fully dead. Defer to Phase 9
  cleanup (shared utils audit).

- `src/apps/video-builder/v2/services/v2StatePersist.ts` lines 138-141
  use **dynamic imports** for 4 store modules. Same pattern as the
  landing-page bug fixed in Phase 7 (dynamic-import-404 on redeploy).
  Currently a latent risk — should be converted to static imports.
  Out of Phase 1 scope (not under `broll-studio/`). Note for the
  video-builder maintainer or a future stabilization phase.
