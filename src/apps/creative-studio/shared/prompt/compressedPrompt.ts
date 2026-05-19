// ── Compressed Prompt Assembler (P42 — Ladipage-equivalent density) ────────
//
// PHASE 42 — Output ảnh photographic engine cảm giác kém Ladipage AI dù
// cùng dùng KIE gpt-image-2 + cùng reference image. Root cause: PROMPT BLOAT.
// Ladipage gửi ~100 từ flat paragraph → attention concentrated. Structured
// assembler (promptAssembler.ts) emits ~1500-2500 tokens with 12+ [SECTION]
// labels → attention diluted → output kém sắc nét.
//
// This module emits a flat-paragraph prompt (target 100-200 words) matching
// Ladipage's concentration profile:
//
//   - [CREATIVE DNA / LAYOUT / VISUAL / QUALITY / FAILURE RULES] →
//     collapsed; rules framing dropped (promptBlocks already encode them
//     as positive scene language).
//   - [PRODUCT LOCK — 6 lines] → 1-line "preserve EXACT product from FIRST
//     reference image".
//   - [PRODUCT KNOWLEDGE — 10 lines] → dropped (KIE generates images, not
//     text content; ProductKnowledge serves Gemini text gen only).
//   - [DEMOGRAPHIC + SETTING + CAPTURE + SCENE + LIGHTING + UGC + CULTURAL
//     + PLATFORM] → section labels stripped, text concatenated into one
//     flowing paragraph.
//   - [LOCALE HARD LOCK — 8 lines] → 1-line "Any visible text in <native
//     language> only".
//   - [NEGATIVE — 6 bullets] → dropped; rely on positive specification +
//     top-2 failureModes inlined as "Avoid: X; Y".
//
// CRITICAL invariants preserved (vs the structured path):
//   - The product reference image still attaches via filesUrl on the
//     dispatcher's KIE call. Avatar reference still attaches when present.
//   - DNA blocks (layoutRules / visualRules / failureModes / etc.) are
//     still recorded on asset.metadata.engineExtras.creativeDna in the
//     dispatcher — they are the SOURCE OF TRUTH for QC, independent of
//     what surface text reaches the model.
//   - The legacy structured assembler (assemblePrompt) stays available so
//     A/B comparison + fallback are possible via params.options.useStructuredPrompt.

import type { CreativeConfig, PromptBlock, PromptBlockKind, PromptContext } from '../../types/creativeDNA'
import type { UINativeLocale } from '../../types/uiNative'

// ── Drop list ────────────────────────────────────────────────────────────
//
// Blocks of these kinds are NOT included in the compressed paragraph.
// We replace them with concise inline equivalents (identity lock, locale
// rule, failure-mode tail) further below.

const DROP_KINDS: ReadonlySet<PromptBlockKind> = new Set([
  'dnaRules',    // [CREATIVE DNA — HARD RULES …] rules-framing block
  'product',     // [PRODUCT LOCK] + [PRODUCT KNOWLEDGE] — replaced inline
  'continuity',  // ref-image cohesion block — replaced inline from ctx
  'negative',    // [NEGATIVE] + [LOCALE HARD LOCK] (both kind:'negative') —
                 //   replaced inline with 1-line locale rule + failure tail
])

// ── Per-locale visible-text language name ─────────────────────────────
//
// Mirrors the locale map in blockLibrary.localeHardLock() but condensed
// to a single language label. Used in the compressed 1-line locale rule.

const LOCALE_NATIVE_LANGUAGE: Record<UINativeLocale, string> = {
  'vi-VN':  'Vietnamese (Tiếng Việt with diacritics)',
  'my-MY':  'Bahasa Melayu',
  'id-ID':  'Bahasa Indonesia',
  'global': 'plain English',
}

// ── Section-label stripper ────────────────────────────────────────────
//
// blockLibrary emits blocks prefixed with "[LABEL]\n" (e.g. "[SCENE]\n",
// "[DEMOGRAPHIC]\n", "[LIGHTING]\n"). The compressed prompt drops the
// label and keeps the body. Multi-section blocks (dnaRules) are not
// passed through this — they live in DROP_KINDS.

function stripSectionLabel(text: string): string {
  return text.replace(/^\[[^\]]+\]\s*\n+/, '').trim()
}

// ── Resolve a single block to its surface text ────────────────────────

function resolveBlockText(block: PromptBlock, ctx: PromptContext): string {
  const raw = typeof block.text === 'function' ? block.text(ctx) : block.text
  return raw ? raw.trim() : ''
}

// ── Public entry point ────────────────────────────────────────────────
//
// Returns a single flat paragraph — no [SECTION] labels, no bullet lists.
// Target length: 100-200 words. Caller (the photographic dispatcher)
// passes this string directly to KIE generateGpt4oImage as `prompt`.

export function assembleCompressedPrompt(
  config: CreativeConfig,
  ctx: PromptContext,
): string {
  const locale = (ctx.locale ?? 'vi-VN') as UINativeLocale

  // 1) Walk promptBlocks, drop the rules-framing / identity / locale-rule
  //    / negative blocks, strip section labels from the rest.
  const sceneFragments: string[] = []
  for (const block of config.promptBlocks) {
    if (DROP_KINDS.has(block.kind)) continue
    const text = resolveBlockText(block, ctx)
    if (!text) continue
    const cleaned = stripSectionLabel(text)
    if (cleaned) sceneFragments.push(cleaned)
  }

  // 2) Identity locks — concise 1-line replacements for the [PRODUCT LOCK]
  //    + (optional) [AVATAR REFERENCE] / [CONTINUITY] blocks.
  const identityParts: string[] = []
  identityParts.push(
    'Preserve the EXACT product from the FIRST reference image — same packaging shape, colors, label text, logo, and proportions. Do not redesign, do not invent new copy.',
  )
  if (ctx.hasAvatar && ctx.hasBaseRef) {
    identityParts.push(
      'The SECOND reference image is the person (approximate likeness — same age, gender, ethnicity, hairstyle). The THIRD reference image is a prior frame from the same shoot; use it as a cohesion anchor for outfit and background.',
    )
  } else if (ctx.hasAvatar) {
    identityParts.push(
      'The SECOND reference image is the person (approximate likeness — same age, gender, ethnicity, hairstyle).',
    )
  } else if (ctx.hasBaseRef) {
    identityParts.push(
      'The SECOND reference image is a prior frame from the same shoot; use it as a cohesion anchor for outfit and background.',
    )
  }

  // 3) Locale rule — 1 line replacing the 8-line [LOCALE HARD LOCK].
  const localeRule =
    `Any visible text (captions, signs, sticky notes, price tags) in ${LOCALE_NATIVE_LANGUAGE[locale]} only — the product label is fixed by the reference image and must be reproduced exactly.`

  // 4) Failure-mode tail — drop the [NEGATIVE] bullet block, surface
  //    the top 2 failure modes from the DNA inline as a brief "Avoid"
  //    hint so the model still has a steer away from common errors.
  const failureTail = (() => {
    const top = (config.dna.failureModes ?? []).slice(0, 2)
    return top.length ? `Avoid: ${top.join('; ')}.` : ''
  })()

  // 5) Stitch everything into a single flat paragraph.
  const segments = [
    ...identityParts,
    ...sceneFragments,
    localeRule,
    failureTail,
  ].filter((s) => s.length > 0)

  return segments.join(' ')
}
