// ─────────────────────────────────────────────────────────────────────
// Image Scene Synthesis — synthesizePageScenes (OPT.3 2026-05-28)
//
// SINGLE Gemini call producing scene prompts for ALL image-bearing
// sections at once. Replaces 7-9 separate Gemini calls — save 6-8
// calls per pack.
//
// Architecture: same LOCKED visual genre system instruction, single user
// prompt listing all sections with their text + imageRole + phase. Gemini
// outputs JSON Record<sectionId, prompt>. Per-section synthesizeImageScene
// is kept as FALLBACK for any section the batch failed to parse.
//
// Returns Record<sectionId, SceneDescription> identical to previous API.
// ─────────────────────────────────────────────────────────────────────

import type { ComposedSection } from '../../composer'
import type { NicheKey } from '../../storytelling/types'
import type {
  PageSceneSynthesis,
  ProductVisualContext,
  ProtagonistVisualContext,
  SceneDescription,
} from '../types'
import { synthesizeImageScene } from './synthesizeImageScene'
import { decideRouting } from '../config/rendererRouting'
import {
  VISUAL_GENRE_SYSTEM_INSTRUCTION,
  ROLE_MICRO_RULES,
  PHASE_MOOD_HINT,
} from '../config/storytellingVisualGenre'
import { textGenWithFallback } from '../../services/textGenWithFallback'
import type { LandingLanguage } from '../../storytelling/types'

interface PageSynthesisContext {
  niche: NicheKey
  protagonist: ProtagonistVisualContext
  productContext: ProductVisualContext | null
  targetLanguage: LandingLanguage
  /** Optional callback when each section completes (for UI progress). */
  onSectionSynthesized?: (sectionId: string, scene: SceneDescription) => void
}

interface ApiKeys {
  geminiApiKey: string
  kieApiKey: string
}

/** Map a section's role to a story phase 1-4. */
function inferStoryPhase(section: ComposedSection): 1 | 2 | 3 | 4 {
  const role = section.role
  if (role === 'hero-recognition' || role === 'lived-experience') return 1
  if (role === 'shared-struggle') return 2
  if (role === 'reframe-moment' || role === 'solution-opening') return 3
  return 4
}

interface BatchOutput {
  [sectionId: string]: string  // prompt string per sectionId
}

/** Build single batch prompt asking Gemini for all scene prompts in one go. */
function buildBatchPrompt(sections: ComposedSection[], context: PageSynthesisContext): string {
  const langLabel =
    context.targetLanguage === 'ms' ? 'Malaysian / Bahasa context' :
    context.targetLanguage === 'en' ? 'English / generic SEA context' :
    'Vietnamese context'

  const envLine = context.protagonist.environmentLock
    ? `Environment lock: ${context.protagonist.environmentLock}`
    : ''

  const productLine = context.productContext
    ? `Product identity (use when product appears): ${context.productContext.productIdentityForImage}`
    : `(No product reference uploaded — focus on protagonist + environment.)`

  const sectionBlocks = sections.map((s, idx) => {
    const phase = inferStoryPhase(s)
    const microRule = ROLE_MICRO_RULES[s.imageRole]
    const sectionText = s.paragraphs.join('\n').slice(0, 1200)
    return `── SECTION ${idx + 1} | id: "${s.id}" ──
imageRole: ${s.imageRole}
storyPhase: ${phase} — ${PHASE_MOOD_HINT[phase]}
sectionText: ${sectionText}
roleRule: ${microRule}`
  }).join('\n\n')

  return `Synthesize image prompts for ALL sections below in ONE response. Follow ALL system rules. Output ONE coherent prompt per section.

═══ SHARED CONTEXT ═══
Niche: ${context.niche}
Cultural anchor: ${langLabel}
Protagonist archetype: ${context.protagonist.archetype}
Appearance lock (every image is SAME person): ${context.protagonist.appearanceLock}
${envLine}

${productLine}

═══ SECTIONS TO SYNTHESIZE ═══

${sectionBlocks}

═══ OUTPUT FORMAT ═══

Strict JSON — one entry per section, keyed by section id:

{
${sections.map((s) => `  "${s.id}": "Single coherent image prompt for THIS section (~80-150 words). Describe what camera literally sees. Anchor to specific micro-moment from sectionText. End with anti-aesthetic cues."`).join(',\n')}
}

Each prompt MUST:
1. Anchor to a SPECIFIC micro-moment from THAT section's text (not generic)
2. Obey the role rule for that section's imageRole
3. Match story phase mood (cooler/dimmer Phase 1-2, warmer Phase 3-4)
4. End with: "not posed, not centered, real skin texture preserved, no studio gloss"
5. Reference the same protagonist identity for character continuity

Each section MUST have its OWN unique micro-moment. NO duplicate prompts.

JSON only. NO markdown fences. NO prose outside JSON.`
}

/** OPT.3 — Try batched scene synthesis first; fallback to per-section
 *  for any section that batch missed. */
export async function synthesizePageScenes(
  sections: ComposedSection[],
  context: PageSynthesisContext,
  keys: ApiKeys,
  options: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<PageSceneSynthesis> {
  const startedAt = Date.now()
  const scenes: Record<string, SceneDescription> = {}
  let succeeded = 0
  let fallbackCount = 0

  // ── Filter to sections that need an image ──
  const queue = sections.filter((s) => s.imageRole !== 'none')

  if (queue.length === 0) {
    return { scenes, succeeded: 0, fallbackCount: 0, durationMs: 0 }
  }

  // ── BATCH PATH (preferred): 1 Gemini call for all sections ──
  if (keys.geminiApiKey || keys.kieApiKey) {
    try {
      const prompt = buildBatchPrompt(queue, context)
      const raw = await textGenWithFallback({
        geminiApiKey: keys.geminiApiKey,
        kieApiKey: keys.kieApiKey,
        prompt,
        systemInstruction: VISUAL_GENRE_SYSTEM_INSTRUCTION,
        jsonMode: true,
        maxOutputTokens: 4000,
        // 2026-05-30 — Lowered from 60s to 30s. Successful Gemini batch
        // gens return in ~10-15s; the extra 30s of timeout headroom only
        // matters during overload, and during overload the per-section
        // fallback path produces better results faster than waiting for
        // a slow batch to complete. Scene synth user-perceived latency
        // drops from 60s+ to 30s on peak-hour overload.
        timeoutMs: 30_000,
        label: 'scene-synth-batch',
      })

      let cleaned = raw.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
      }
      const parsed = JSON.parse(cleaned) as BatchOutput

      for (const section of queue) {
        if (options.signal?.aborted) break
        const promptText = parsed[section.id]
        const routing = decideRouting(section.imageRole, Boolean(context.productContext))

        if (typeof promptText === 'string' && promptText.trim().length >= 40) {
          const scene: SceneDescription = {
            sectionId: section.id,
            imageRole: section.imageRole,
            prompt: promptText.trim(),
            routing,
            synthesizedAt: Date.now(),
            source: 'gemini',
          }
          scenes[section.id] = scene
          succeeded++
          context.onSectionSynthesized?.(section.id, scene)
        }
        // Sections that batch didn't return → fall through to per-section fallback below
      }
      console.info(`[scene-synth/batch] 1 Gemini call → ${succeeded}/${queue.length} scenes (${queue.length - succeeded} need per-section retry)`)
    } catch (err) {
      console.warn('[scene-synth/batch] Batch failed — falling through to per-section synthesis:', err)
    }
  }

  // ── PER-SECTION FALLBACK for any section batch missed ──
  for (const section of queue) {
    if (options.signal?.aborted) break
    if (scenes[section.id]) continue  // already synthesized via batch
    const sectionText = section.paragraphs.join('\n\n')
    const scene = await synthesizeImageScene(
      {
        sectionId: section.id,
        imageRole: section.imageRole,
        sectionText,
        storyPhase: inferStoryPhase(section),
        niche: context.niche,
        protagonist: context.protagonist,
        productContext: context.productContext,
        targetLanguage: context.targetLanguage,
      },
      keys,
    )
    scenes[section.id] = scene
    if (scene.source === 'gemini') succeeded++
    else fallbackCount++
    context.onSectionSynthesized?.(section.id, scene)
  }

  return {
    scenes,
    succeeded,
    fallbackCount,
    durationMs: Date.now() - startedAt,
  }
}
