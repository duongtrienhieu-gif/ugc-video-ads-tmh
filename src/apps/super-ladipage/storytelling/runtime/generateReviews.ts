// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — generateReviews (v5.7 Phase B v2)
//
// SEPARATE Gemini call for trust-continuity reviews.
//
// Why: main pack-gen call carries narrator voice + story prose context.
// When reviews live in same call, narrator voice CONTAMINATES review voice
// → reviews feel like "mini-storytelling paragraphs from the same author"
// rather than "random internet humans".
//
// This call:
//   - Has ZERO narrator brief (no contamination from story voice)
//   - Receives ONLY: product context + 1-line pack summary + 3 style profiles
//   - Returns ONLY 3 reviews matching the assigned style profiles
//   - Fails gracefully — if call errors, orchestrator returns pack with empty
//     reviews + warning (does NOT fail entire pack delivery)
// ═════════════════════════════════════════════════════════════════════

import { textGenWithFallback } from '../../services/textGenWithFallback'
import {
  buildReviewBlockDirective,
  type ReviewStyleProfile,
} from '../config/reviewStyleProfiles'
import type { ParsedReview } from './parsePackResponse'

const REVIEWS_TIMEOUT_MS = 45_000

export interface GenerateReviewsArgs {
  geminiApiKey: string
  kieApiKey: string
  productName: string
  productNiche: string
  painPoint: string
  /** 1-line summary of what the protagonist's story arc was about — just
   *  enough context for review voices to land. Do NOT include narrator voice. */
  storyContextLine: string
  styles: ReviewStyleProfile[]
}

export interface GenerateReviewsResult {
  reviews: ParsedReview[]
  /** Status for telemetry / CLI display. */
  status: 'ok' | 'parse-error' | 'call-error' | 'empty'
  /** Runtime in seconds. */
  runtimeSec: number
  /** Error message if status != 'ok'. */
  errorMessage?: string
}

function buildReviewsSystemPrompt(): string {
  return `You generate Vietnamese mini-reviews/comments for a product testimonial section.

YOU ARE NOT a storyteller. You write SHORT internet comments / DMs / FB replies
from DIFFERENT random humans. Each review is from a DIFFERENT person with a
DIFFERENT brain (emotional intelligence, self-awareness, writing effort, etc).

ZERO storytelling-prose voice. ZERO mini-essays. Each review is a COMMENT —
the kind of thing a real person actually types into an app, often imperfectly.

OUTPUT FORMAT (strict JSON, no fences):
{
  "reviews": [
    { "quote": "...", "author": "...", "meta": "..." },
    { "quote": "...", "author": "...", "meta": "..." },
    { "quote": "...", "author": "...", "meta": "..." }
  ]
}

- "quote" = the review text in Vietnamese.
- "author" = short Vietnamese label per the style's author format hint.
- "meta" = OPTIONAL one-word descriptor ("FB comment", "DM", "TikTok", etc) — may omit.`
}

function buildReviewsUserPrompt(args: GenerateReviewsArgs): string {
  const block = buildReviewBlockDirective(args.styles)
  return `PRODUCT CONTEXT (for grounding — do NOT echo verbatim):
- Product: ${args.productName}
- Niche: ${args.productNiche}
- Pain it addresses: ${args.painPoint}
- Story summary: ${args.storyContextLine}

${block}

REMINDER:
- 3 reviews, each from a DIFFERENT person matching its assigned style profile.
- Some reviews SHOULD feel underwritten / awkward / careless. That is realistic.
- DO NOT write storytelling-prose. DO write internet comments.
- Vietnamese only. JSON only output.`
}

/** Parse the reviews-only response. Tolerant of fence wrappers. */
function parseReviewsResponse(raw: string): ParsedReview[] | null {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  try {
    const obj = JSON.parse(cleaned) as { reviews?: unknown }
    if (!obj || !Array.isArray(obj.reviews)) return null
    const reviews: ParsedReview[] = []
    for (const r of obj.reviews) {
      if (!r || typeof r !== 'object') continue
      const rec = r as Record<string, unknown>
      const quote = typeof rec.quote === 'string' ? rec.quote.trim() : ''
      if (!quote) continue
      const author = typeof rec.author === 'string' ? rec.author.trim() : undefined
      const meta = typeof rec.meta === 'string' ? rec.meta.trim() : undefined
      reviews.push({ quote, author, meta })
    }
    return reviews.length > 0 ? reviews : null
  } catch {
    return null
  }
}

/** Top-level review generator. Always returns a result (never throws).
 *  Caller checks `status` to decide whether to use reviews or warn. */
export async function generateReviews(args: GenerateReviewsArgs): Promise<GenerateReviewsResult> {
  const startedAt = Date.now()
  const systemPrompt = buildReviewsSystemPrompt()
  const userPrompt = buildReviewsUserPrompt(args)

  console.info(
    `[storytelling/generateReviews] separate review call — styles=[${args.styles.map((s) => s.id).join(', ')}]`,
  )

  try {
    const raw = await textGenWithFallback({
      geminiApiKey:      args.geminiApiKey,
      kieApiKey:         args.kieApiKey,
      systemInstruction: systemPrompt,
      prompt:            userPrompt,
      jsonMode:          true,
      maxOutputTokens:   800,
      timeoutMs:         REVIEWS_TIMEOUT_MS,
      label:             'storytelling-reviews',
    })
    const runtimeSec = (Date.now() - startedAt) / 1000

    const parsed = parseReviewsResponse(raw)
    if (!parsed || parsed.length === 0) {
      console.warn(`[storytelling/generateReviews] parse failed or empty — raw="${raw.slice(0, 200)}"`)
      return { reviews: [], status: 'parse-error', runtimeSec, errorMessage: 'parse failed' }
    }
    console.info(`[storytelling/generateReviews] ✓ ${parsed.length} reviews in ${runtimeSec.toFixed(1)}s`)
    return { reviews: parsed, status: 'ok', runtimeSec }
  } catch (err) {
    const runtimeSec = (Date.now() - startedAt) / 1000
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[storytelling/generateReviews] call failed in ${runtimeSec.toFixed(1)}s: ${msg.slice(0, 200)}`)
    return { reviews: [], status: 'call-error', runtimeSec, errorMessage: msg }
  }
}

/** Compose a brief 1-line summary of the protagonist's story arc from the
 *  generated pack — just enough context for review voices to land without
 *  leaking narrator voice. */
export function buildStoryContextLine(
  productName: string,
  productNiche: string,
  painPoint: string,
): string {
  return `Người chia sẻ là một narrator trải qua "${painPoint.slice(0, 80)}" và tìm thấy ${productName} (niche: ${productNiche}). Reviews là từ người khác đọc bài share, không phải narrator.`
}
