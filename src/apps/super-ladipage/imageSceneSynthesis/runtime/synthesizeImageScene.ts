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
// Fix B (2026-05-29) — Fallbacks now incorporate niche + productIdentity
// + a section-text excerpt so each fallback prompt is product-differentiated
// rather than identical-per-role. Previously: 3 sections with imageRole=
// 'mood-supporting' produced 3 IDENTICAL prompts → user-visible "prompt
// y chang nhau". Now: niche framing + product mention + section excerpt
// vary the prompt even in degraded mode.

// Niche → buyer-context tag injected into fallback prompts. Keeps the
// scene domain-appropriate (a respiratory-spray fallback shouldn't look
// like a skincare fallback even when Gemini is down).
const NICHE_BUYER_CONTEXT: Partial<Record<string, string>> = {
  'health-respiratory':        'someone managing chronic sinus / cough / breathing discomfort',
  'health-joint':              'someone dealing with knee or back pain from years of standing',
  'health-cardiovascular':     'someone watching their blood pressure after a doctor warning',
  'health-digestive':          'someone with recurring stomach / reflux discomfort',
  'health-functional':         'someone managing a quiet ongoing health concern',
  'diabetes-blood-sugar':      'someone monitoring blood sugar after a medical alert',
  'liver-detox':               'someone concerned about liver health after a health check',
  'hemorrhoids-digestive-shame': 'someone with a digestive issue they don\'t want to discuss openly',
  'prostate-urology':          'a middle-aged man with frequent nighttime bathroom trips',
  'eye-vision-care':           'someone with dry, fatigued eyes from long screen hours',
  'dental-oral-care':          'someone bothered by gum sensitivity or chronic bad breath',
  'skincare':                  'a woman dealing with stubborn skin texture / acne / dullness',
  'haircare':                  'someone watching strands fall in the shower drain every morning',
  'beauty-confidence':         'a woman quietly losing confidence in the mirror',
  'anti-aging-longevity':      'someone in their 40s noticing the first real signs of aging',
  'mom-baby':                  'a young mother juggling baby + household + her own recovery',
  'menopause':                 'a woman in her late 40s navigating hot flashes and sleep loss',
  'sleep-insomnia':            'someone who wakes up at 3am and can\'t fall back asleep',
  'mental-health':             'a tired-eyed urban worker in chronic low-grade burnout',
  'relationship':              'someone quietly worried about closeness in a long relationship',
  'supplement-wellness':       'a busy adult trying to plug a daily energy / nutrition gap',
  'fitness-recovery':          'an active adult dealing with post-workout aches and stiffness',
}

function fallbackPrompt(input: SceneSynthesisInput): string {
  // Compose a richer person descriptor (archetype + 1-sentence appearance).
  const personDesc = input.protagonist.archetype || 'A Southeast Asian adult'
  const idLock = input.protagonist.appearanceLock.slice(0, 240)

  // Niche-aware buyer context — varies per product/niche even in degraded mode
  const buyerContext = NICHE_BUYER_CONTEXT[input.niche] || 'an ordinary adult dealing with a quiet daily concern'

  // Product mention — only if a product identity was synthesized
  const productMention = input.productContext?.productIdentityForImage
    ? ` The product visible is: ${input.productContext.productIdentityForImage.slice(0, 200)}.`
    : ''

  // Section text excerpt — first 200 chars of section narrative for micro-moment anchor
  const sectionHint = input.sectionText?.trim().slice(0, 200).replace(/\s+/g, ' ')
  const sectionLine = sectionHint
    ? ` Section anchor (extract a specific micro-moment from this): "${sectionHint}".`
    : ''

  // Phase tone — Phase 1-2 cooler, Phase 3-4 warmer
  const phaseTone =
    input.storyPhase === 1 ? 'slightly cool, dim, observational, melancholic' :
    input.storyPhase === 2 ? 'cool with hint of human presence, quietly shared' :
    input.storyPhase === 3 ? 'softer, lighter, curious, restrained hope' :
    input.storyPhase === 4 ? 'warmer, brighter, ordinary contentment (NOT euphoria)' :
    'natural muted tones'

  switch (input.imageRole) {
    case 'hero-anchor':
      return `${personDesc} — ${buyerContext} — sitting near a window in early morning light, looking slightly past the camera with a quiet, tired expression. iPhone candid style, partial face visible but mid-thought, NOT smiling at lens. Soft natural light from window, slightly underexposed indoor tone. Tone: ${phaseTone}. Real skin texture preserved, no airbrush, no studio lighting. Documentary realism, asymmetric framing, comfortable with negative space. Identity reference: ${idLock}.${sectionLine} Not posed, not centered, no studio gloss.`

    case 'mood-supporting':
      return `${personDesc} — ${buyerContext} — in a small domestic moment, at a kitchen counter or beside a bed, looking down at hands or a small object. 3/4 angle from the side, partial face, no eye contact with camera. Soft window light, ${phaseTone}. Documentary candid style, photojournalism-light. Identity reference: ${idLock}.${sectionLine} Real skin texture, real fabric, real morning haze. Not posed, not centered, no studio gloss.`

    case 'object-trace':
      return `Flat-lay on a bedside table or kitchen counter relevant to ${buyerContext} — half-empty bottles, an open box, a notebook with one corner folded, items slightly disorganized like someone has been trying things. Top-down or slight 3/4 angle. Soft window light or under-cabinet fluorescent, ${phaseTone}. No person in frame.${productMention}${sectionLine} Documentary style, NOT styled photoshoot, NOT Pinterest flat-lay. Real surface texture, items NOT perfectly arranged. No studio gloss.`

    case 'lifestyle-context':
      return `${personDesc} — ${buyerContext} — doing an ordinary daily activity (walking near home, at a local market, sitting on a balcony). Wide environmental context visible, real Southeast Asian urban or rural setting. Subject NOT looking at camera, NOT smiling at lens — caught mid-motion. ${phaseTone}. Documentary candid style. Identity reference: ${idLock}.${productMention}${sectionLine} Real fabric, real morning light. Not posed, not centered, no studio gloss.`

    case 'proof-callout':
      return `A candid close moment for ${buyerContext} — a hand holding a product over a kitchen counter, with soft window light behind. The product occupies about 25% of the frame, real surface texture below. Could include partial face of ${personDesc} on the edge of frame (use reference for identity continuity). ${phaseTone}.${productMention}${sectionLine} Documentary style, photojournalism-light. NO before/after split, NO testimonial card, NO star rating overlay. Just a quiet real moment. Identity reference: ${idLock}. Not posed, not centered, no studio gloss.`

    case 'hero-product':
      // 2026-05-30 — Dedicated product showcase. Used by PI mechanism-personal
      // so the reader actually SEES the product the narrator is describing.
      // Product fills 60-80% of frame, label readable. NO character continuity
      // needed (this is a product hero, not a person scene).
      return `Dedicated product showcase shot for ${buyerContext}. Composition: product fills 60-80% of the frame, label clearly readable. Surface: single clean tabletop / wooden counter / soft fabric. Light: soft natural diffused (window or overhead daylight) — NO studio strobe, NO commercial gloss, NO advertising glamour. Shallow depth of field (background slightly out of focus).${productMention} Optional supporting element: a hand at the edge holding it, OR a single small accessory beside for scale — do NOT crowd the frame. Documentary catalog feel — like a Humans-of-New-York object portrait, NOT an Instagram product flat-lay. Real surface texture preserved. No overlay text. No badges. No watermark. Not centered exact, comfortable with slight asymmetry.${sectionLine}`

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
