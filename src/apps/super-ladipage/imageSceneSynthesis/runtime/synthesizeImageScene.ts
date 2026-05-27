// ─────────────────────────────────────────────────────────────────────
// Image Scene Synthesis — synthesizeImageScene (single-section runtime)
//
// One Gemini call per section. Input: section text + imageRole + niche +
// protagonist + (optional) product context. Output: ONE coherent prompt
// in plain English describing exactly what to render.
//
// LOCKED:
//   - System instruction = VISUAL_GENRE_SYSTEM_INSTRUCTION (immutable)
//   - User prompt assembled from section text + role micro-rule + context
//   - Output is a single paragraph — no concat with anything downstream
//
// Failure path: Gemini overload / timeout → fallback to static
// role-based prompt (still respects visual genre, just less specific).
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../../services/textGenWithFallback'
import {
  VISUAL_GENRE_SYSTEM_INSTRUCTION,
  ROLE_MICRO_RULES,
  PHASE_MOOD_HINT,
} from '../config/storytellingVisualGenre'
import { decideRouting } from '../config/rendererRouting'
import type { SceneSynthesisInput, SceneDescription } from '../types'

interface ApiKeys {
  geminiApiKey: string
  kieApiKey: string
}

function buildUserPrompt(input: SceneSynthesisInput): string {
  const langLabel =
    input.targetLanguage === 'ms' ? 'Malaysian / Bahasa context' :
    input.targetLanguage === 'en' ? 'English / generic SEA context' :
    'Vietnamese context'

  const phaseHint = input.storyPhase
    ? PHASE_MOOD_HINT[input.storyPhase]
    : ''

  const productLine = input.productContext
    ? `Product identity (when product appears, render accurately): ${input.productContext.productIdentityForImage}`
    : `(No product in this image — focus on the protagonist + environment + objects from section text.)`

  const envLine = input.protagonist.environmentLock
    ? `Environment lock: ${input.protagonist.environmentLock}`
    : ''

  return `Synthesize ONE image prompt for the section below. Follow ALL system rules. Output ONE paragraph only.

═══ SECTION CONTEXT ═══
imageRole: ${input.imageRole}
Niche: ${input.niche}
Cultural anchor: ${langLabel}

═══ PROTAGONIST (use this identity exactly — every image is the SAME person) ═══
Archetype: ${input.protagonist.archetype}
Appearance lock: ${input.protagonist.appearanceLock}
${envLine}

═══ SECTION TEXT (narrative — extract a micro-moment from here) ═══
${input.sectionHeading ? `Heading: ${input.sectionHeading}\n\n` : ''}${input.sectionText.slice(0, 1800)}

═══ ROLE MICRO-RULE (must obey) ═══
${ROLE_MICRO_RULES[input.imageRole]}

${phaseHint ? `═══ PHASE MOOD ═══\n${phaseHint}\n` : ''}
═══ PRODUCT CONTEXT ═══
${productLine}

═══ OUTPUT INSTRUCTION ═══
Write ONE paragraph (~80-150 words). Describe what the camera literally sees. Anchor to a SPECIFIC micro-moment from the section text — do NOT generalize. End with anti-aesthetic cues ("not posed, not centered, real skin texture preserved, no studio gloss"). Output the prompt ONLY — no markdown, no explanation.`
}

// ─── Fallback prompts per role (used when Gemini fails) ────────────────
//
// Each fallback is still strict-genre — uses the same locked visual grammar
// language. The only thing missing vs Gemini-synthesized is section-text
// specificity. Better than nothing if API is overloaded.

function fallbackPrompt(input: SceneSynthesisInput): string {
  // Use the archetype label as a compact person descriptor
  const personDesc = input.protagonist.archetype || 'A Southeast Asian adult'

  switch (input.imageRole) {
    case 'hero-anchor':
      return `${personDesc}, sitting near a window in early morning light, looking slightly past the camera with a quiet, tired expression. iPhone candid style, partial face visible but mid-thought, NOT smiling at lens. Soft natural light from window, slightly underexposed indoor tone. Real skin texture preserved, no airbrush, no studio lighting. Documentary realism, asymmetric framing, comfortable with negative space. Identity reference: ${input.protagonist.appearanceLock.slice(0, 240)}. Not posed, not centered, no studio gloss.`

    case 'mood-supporting':
      return `${personDesc}, in a small domestic moment — at a kitchen counter or beside a bed, looking down at hands or a small object. 3/4 angle from the side, partial face, no eye contact with camera. Soft window light, muted natural tones. Documentary candid style, photojournalism-light. Identity reference: ${input.protagonist.appearanceLock.slice(0, 240)}. Real skin texture, real fabric, real morning haze. Not posed, not centered, no studio gloss.`

    case 'object-trace':
      return `Flat-lay on a bedside table or kitchen counter — half-empty bottles, an open box of tablets, a notebook with one corner folded, items slightly disorganized like someone has been trying things. Top-down or slight 3/4 angle. Soft window light or under-cabinet fluorescent. No person in frame. Documentary style, NOT styled photoshoot, NOT Pinterest flat-lay. Real surface texture, dust visible, items NOT perfectly arranged. No studio gloss.`

    case 'lifestyle-context':
      return `${personDesc}, doing an ordinary daily activity — walking near home, at a local market, sitting on a balcony. Wide environmental context visible, real Southeast Asian urban or rural setting. Subject NOT looking at camera, NOT smiling at lens — caught mid-motion. Soft natural light, muted tones. Documentary candid style. Identity reference: ${input.protagonist.appearanceLock.slice(0, 240)}. Real fabric, real morning light. Not posed, not centered, no studio gloss.`

    case 'proof-callout':
      return `A candid close moment — a hand holding a product (use reference if provided) over a kitchen counter, with soft window light behind. The product occupies about 25% of the frame, real surface texture below. Could include partial face of ${personDesc} on the edge of frame (use reference for identity continuity). Documentary style, photojournalism-light. NO before/after split, NO testimonial card, NO star rating overlay. Just a quiet real moment. Not posed, not centered, no studio gloss.`

    case 'none':
      return ''
  }
}

export async function synthesizeImageScene(
  input: SceneSynthesisInput,
  keys: ApiKeys,
): Promise<SceneDescription> {
  const routing = decideRouting(input.imageRole, Boolean(input.productContext))
  const synthesizedAt = Date.now()

  if (input.imageRole === 'none') {
    return {
      sectionId: input.sectionId,
      imageRole: 'none',
      prompt: '',
      routing,
      synthesizedAt,
      source: 'fallback',
    }
  }

  // ── Try Gemini ──
  if (keys.geminiApiKey) {
    try {
      const raw = await textGenWithFallback({
        geminiApiKey: keys.geminiApiKey,
        kieApiKey: keys.kieApiKey,
        prompt: buildUserPrompt(input),
        systemInstruction: VISUAL_GENRE_SYSTEM_INSTRUCTION,
        jsonMode: false,
        maxOutputTokens: 400,
        timeoutMs: 25_000,
        label: `scene-synth-${input.sectionId}`,
      })

      const cleaned = raw.trim().replace(/^["'`]+|["'`]+$/g, '')
      if (cleaned.length >= 40) {
        return {
          sectionId: input.sectionId,
          imageRole: input.imageRole,
          prompt: cleaned,
          routing,
          synthesizedAt,
          source: 'gemini',
        }
      }
      console.warn(`[scene-synth ${input.sectionId}] Gemini returned too-short prompt (${cleaned.length} chars) — falling back`)
    } catch (err) {
      console.warn(`[scene-synth ${input.sectionId}] Gemini failed — falling back:`, err)
    }
  }

  return {
    sectionId: input.sectionId,
    imageRole: input.imageRole,
    prompt: fallbackPrompt(input),
    routing,
    synthesizedAt,
    source: 'fallback',
  }
}
