// ── Conversation Text Payload Generator (P5) ────────────────────────────────
//
// Decoupled from the canvas template — Gemini Text generates the
// conversation, then the canvas renderer just lays it out. Keeps small
// UI text out of KIE GPT-4o (which fails at small text).
//
// Caller can SHORT-CIRCUIT by passing an explicit textPayload in
// params.options.textPayload — useful for tests, fixtures, and the case
// where the user already wrote the dialogue manually.

import type { UINativeTextContent, UINativeLocale, UINativePlatform } from '../../../types/uiNative'
import { directGeminiText } from '../../../../../utils/gemini'
import { findPersona } from '../../../shared/metadata/personaLibrary'

/** What kind of UI-native content we are generating text for. */
export type TextPayloadContentType = 'chat' | 'review' | 'comment-thread'

export interface TextPayloadRequest {
  platform: UINativePlatform
  locale: UINativeLocale
  /** Product name + niche — anchors the conversation topic. */
  productName: string
  niche?: string
  /** Optional persona id for the testimonial author. */
  personaId?: string
  /** Number of messages / comments / reviews to generate (default 8 chat, 1 review, 6 comments). */
  messageCount?: number
  /** Tone hint, default 'natural-warm'. */
  tone?: string
  /** Which content shape to ask the LLM for. Default 'chat'. */
  contentType?: TextPayloadContentType
}

const SYSTEM_INSTRUCTION =
  'You generate realistic short messaging-app conversations that look like authentic UGC '
  + 'testimonials between a happy customer and a shop / creator. Output JSON only, no prose, '
  + 'no markdown fences. Conversations must sound like real chats — typos allowed, casual '
  + 'punctuation, short messages, mixed message lengths, occasional emoji. NEVER promotional '
  + 'corporate copy.'

/** Strict JSON envelope the LLM must return. */
interface LLMResponse {
  customerDisplayName: string
  messages: {
    side: 'incoming' | 'outgoing'  // incoming = customer; outgoing = shop
    text: string
  }[]
}

/** Build the Gemini prompt for a conversation payload request. */
export function buildTextPayloadPrompt(req: TextPayloadRequest): string {
  const persona = req.personaId ? findPersona(req.personaId) : null
  const count = req.messageCount ?? 8
  const tone = req.tone ?? 'natural-warm'

  const personaBlock = persona
    ? `Customer persona: ${persona.label.en}. Voice character: ${persona.voiceCharacter}`
    : 'Customer persona: typical authentic SEA customer, casual conversational tone.'

  const localeMap: Record<UINativeLocale, string> = {
    'my-MY':  'Malay (Bahasa Melayu) with occasional English code-switching',
    'vi-VN':  'Vietnamese with casual abbreviations (vd: ko thay vi khong)',
    'id-ID':  'Indonesian (Bahasa Indonesia) casual',
    'global': 'English casual conversational',
  }

  return [
    `Generate a ${req.platform} chat conversation that looks like a real customer testimonial.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    personaBlock,
    `Language: ${localeMap[req.locale]}`,
    `Tone: ${tone}`,
    `Message count: ${count} total messages (mix of incoming/outgoing — customer says more than shop).`,
    '',
    'STRICT JSON OUTPUT — return ONLY this shape, no prose, no markdown fence:',
    '{',
    '  "customerDisplayName": "<a believable name + last initial, eg \\"Linh N.\\" or \\"Aisyah B.\\">",',
    '  "messages": [',
    '    { "side": "incoming" | "outgoing", "text": "<one short message>" },',
    '    ...',
    '  ]',
    '}',
    '',
    'Rules:',
    '- "incoming" = customer (testimonial author). "outgoing" = shop / creator replying.',
    '- Start with an incoming message (customer initiates testimonial).',
    '- 60-70% of messages should be "incoming" (customer doing most of the talking).',
    '- Each message 4-25 words. Short conversational fragments. No essays.',
    '- Mention the product naturally, NOT as ad copy.',
    '- Include 1-2 specific result details (eg time frame, body part, daily-life moment).',
    '- 1-2 messages may contain a single emoji. Do not overdo emojis.',
    '- NO links, NO phone numbers, NO prices, NO "DM me" or "click bio".',
    '- NEVER include the words "advertisement", "sponsored", "ad", "promo".',
  ].join('\n')
}

/** Parse the raw model output into a strict UINativeTextContent payload. */
export function parseTextPayloadResponse(
  raw: string,
  req: TextPayloadRequest,
  baseTimestamps: string[],
): UINativeTextContent {
  const cleaned = stripJsonFence(raw).trim()
  let parsed: LLMResponse
  try {
    parsed = JSON.parse(cleaned) as LLMResponse
  } catch (err) {
    throw new Error(`[ui-native text] JSON parse failed: ${(err as Error).message}`)
  }

  if (!parsed.customerDisplayName || !Array.isArray(parsed.messages)) {
    throw new Error('[ui-native text] response missing required fields')
  }

  const persona = req.personaId ? findPersona(req.personaId) : null
  const customerAvatarHint = persona?.label.en ?? `${req.locale} customer`

  return {
    participants: [
      { displayName: parsed.customerDisplayName, avatarHint: customerAvatarHint, locale: req.locale },
      { displayName: 'Shop',                     avatarHint: 'shop owner',        locale: req.locale },
    ],
    items: parsed.messages.map((m, i) => ({
      side: m.side,
      authorIdx: m.side === 'incoming' ? 0 : 1,
      text: m.text,
      timestamp: baseTimestamps[i] ?? baseTimestamps[baseTimestamps.length - 1] ?? '14:23',
      hasAttachment: 'none' as const,
    })),
    context: {
      topic: 'product-testimonial',
      niche: req.niche,
      productName: req.productName,
    },
  }
}

function stripJsonFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
}

// ── Marketplace review prompts (P6) ─────────────────────────────────────

const REVIEW_SYSTEM_INSTRUCTION =
  'You generate realistic marketplace product reviews that look like authentic buyer '
  + 'feedback on Shopee / TikTok Shop. Output JSON only, no prose, no markdown fences. '
  + 'Reviews must sound like a real customer who actually bought and used the product — '
  + 'specific details, mild typos, real-life context. NEVER promotional corporate copy. '
  + 'NEVER mention the words "advertisement", "sponsored", "ad", "promo".'

interface LLMReviewResponse {
  buyerDisplayName: string
  /** Star rating out of 5, integer. Mostly 5, sometimes 4 for believability. */
  rating: number
  /** Variant the buyer bought (eg color, size, flavor). */
  variantBought: string
  reviewBody: string
  /** Optional short like-count badge string, eg "Helpful (12)". */
  helpfulCount: number
}

function buildReviewPrompt(req: TextPayloadRequest): string {
  const persona = req.personaId ? findPersona(req.personaId) : null
  const personaBlock = persona
    ? `Buyer persona: ${persona.label.en}. Voice character: ${persona.voiceCharacter}`
    : 'Buyer persona: typical authentic SEA marketplace shopper, casual review tone.'
  const localeMap: Record<UINativeLocale, string> = {
    'my-MY':  'Malay (Bahasa Melayu) marketplace review style',
    'vi-VN':  'Vietnamese marketplace review style (casual, may use abbreviations)',
    'id-ID':  'Indonesian (Bahasa Indonesia) marketplace review style',
    'global': 'English casual review style',
  }

  return [
    `Generate a ${req.platform === 'shopee' ? 'Shopee' : 'TikTok Shop'} product review that looks authentic.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    personaBlock,
    `Language: ${localeMap[req.locale]}`,
    '',
    'STRICT JSON OUTPUT — no prose, no markdown fence:',
    '{',
    '  "buyerDisplayName": "<a believable masked username, eg \\"linhng***12\\" or \\"aisyahb***08\\">",',
    '  "rating": 5,',
    '  "variantBought": "<short variant string, eg \\"Vị cam, hộp 30 viên\\" or \\"Pack of 2, mint flavor\\">",',
    '  "reviewBody": "<a realistic 3-5 sentence buyer review>",',
    '  "helpfulCount": 12',
    '}',
    '',
    'Rules:',
    '- Rating is usually 5, sometimes 4 (avoid 3/2/1 — testimonial-use case).',
    '- reviewBody must be SPECIFIC (when used, what changed, how long, sensory detail).',
    '- 60-160 words. Conversational, not corporate.',
    '- 0-2 emojis max. No links, no phone numbers, no prices.',
    '- variantBought should sound like a real SKU choice.',
    '- helpfulCount: realistic small number 3-80.',
  ].join('\n')
}

function parseReviewResponse(
  raw: string,
  req: TextPayloadRequest,
  timestamp: string,
): UINativeTextContent {
  const cleaned = stripJsonFence(raw).trim()
  let parsed: LLMReviewResponse
  try {
    parsed = JSON.parse(cleaned) as LLMReviewResponse
  } catch (err) {
    throw new Error(`[ui-native review] JSON parse failed: ${(err as Error).message}`)
  }
  if (!parsed.buyerDisplayName || !parsed.reviewBody) {
    throw new Error('[ui-native review] response missing required fields')
  }

  const persona = req.personaId ? findPersona(req.personaId) : null
  const avatarHint = persona?.label.en ?? `${req.locale} marketplace buyer`

  // Encode rating + variant + helpfulCount in the reactions array so the
  // template can read them via a stable channel.
  const reactions = [
    `★${Math.max(1, Math.min(5, Math.round(parsed.rating ?? 5)))}`,
    `variant:${parsed.variantBought ?? ''}`,
    `helpful:${parsed.helpfulCount ?? 0}`,
  ]

  return {
    participants: [
      { displayName: parsed.buyerDisplayName, avatarHint, locale: req.locale },
    ],
    items: [
      {
        authorIdx: 0,
        text: parsed.reviewBody,
        timestamp,
        reactions,
        hasAttachment: 'product',
      },
    ],
    context: {
      topic: 'marketplace-review',
      niche: req.niche,
      productName: req.productName,
    },
  }
}

// ── Comment-thread prompts (P6) ─────────────────────────────────────────

const COMMENT_SYSTEM_INSTRUCTION =
  'You generate realistic social-media comment threads that look like an authentic '
  + 'reaction to a UGC post about a product. Output JSON only, no prose, no markdown '
  + 'fences. Comments must sound like real strangers replying — short, casual, mixed '
  + 'opinions (mostly positive but 1-2 neutral / curious comments OK). NEVER promotional '
  + 'corporate copy.'

interface LLMCommentResponse {
  comments: {
    username: string
    text: string
    likes: number
    isReply?: boolean
  }[]
}

function buildCommentPrompt(req: TextPayloadRequest): string {
  const persona = req.personaId ? findPersona(req.personaId) : null
  const personaBlock = persona
    ? `Original post is by persona: ${persona.label.en}. Voice character: ${persona.voiceCharacter}. The comments are from OTHER users (not the persona).`
    : 'Original post is by a typical SEA UGC creator. Comments are from other casual users.'
  const localeMap: Record<UINativeLocale, string> = {
    'my-MY':  'Malay (Bahasa Melayu) social media casual',
    'vi-VN':  'Vietnamese social media casual with abbreviations',
    'id-ID':  'Indonesian social media casual',
    'global': 'English social media casual',
  }
  const count = req.messageCount ?? 6
  const platformName = req.platform === 'facebook' ? 'Facebook' : 'TikTok'

  return [
    `Generate ${count} ${platformName} comments on a UGC post about this product.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    personaBlock,
    `Language: ${localeMap[req.locale]}`,
    '',
    'STRICT JSON OUTPUT — no prose, no markdown fence:',
    '{',
    '  "comments": [',
    '    { "username": "<believable casual username eg \\"thanh.nguyen\\" or \\"itsaishaa\\">",',
    '      "text": "<one short comment 4-25 words>",',
    '      "likes": 12,',
    '      "isReply": false },',
    '    ...',
    '  ]',
    '}',
    '',
    'Rules:',
    '- 4-8 unique usernames across the comments (some can comment twice via a reply).',
    `- ${Math.floor(count / 4)}-${Math.floor(count / 3)} of the comments may set isReply=true.`,
    '- likes: realistic small numbers, mostly 0-25, 1-2 comments can have 30-200.',
    '- Mix of: "where to buy?", "how long for results?", "tried it, works!", "tagging a friend".',
    '- 1-2 comments may have a single emoji.',
    '- NO links, NO phone numbers, NO prices, NO "DM me" or "check bio".',
    '- NEVER include "advertisement", "sponsored", "ad", "promo".',
  ].join('\n')
}

function parseCommentResponse(
  raw: string,
  req: TextPayloadRequest,
  baseTimestamps: string[],
): UINativeTextContent {
  const cleaned = stripJsonFence(raw).trim()
  let parsed: LLMCommentResponse
  try {
    parsed = JSON.parse(cleaned) as LLMCommentResponse
  } catch (err) {
    throw new Error(`[ui-native comments] JSON parse failed: ${(err as Error).message}`)
  }
  if (!Array.isArray(parsed.comments) || parsed.comments.length === 0) {
    throw new Error('[ui-native comments] response missing comments array')
  }

  // Build participants from unique usernames in order seen
  const usernameToIdx = new Map<string, number>()
  const participants: UINativeTextContent['participants'] = []
  for (const c of parsed.comments) {
    if (!usernameToIdx.has(c.username)) {
      usernameToIdx.set(c.username, participants.length)
      participants.push({
        displayName: c.username,
        avatarHint:  `${req.locale} ${req.platform} casual user`,
        locale:      req.locale,
      })
    }
  }

  const items = parsed.comments.map((c, i) => ({
    authorIdx: usernameToIdx.get(c.username) ?? 0,
    text:      c.text,
    timestamp: baseTimestamps[i] ?? baseTimestamps[baseTimestamps.length - 1] ?? '14:23',
    reactions: [
      `likes:${Math.max(0, Math.round(c.likes ?? 0))}`,
      ...(c.isReply ? ['isReply:true'] : []),
    ],
    hasAttachment: 'none' as const,
  }))

  return {
    participants,
    items,
    context: {
      topic: req.platform === 'facebook' ? 'facebook-comments' : 'tiktok-comments',
      niche: req.niche,
      productName: req.productName,
    },
  }
}

// ── Public single-shot helper — routes by contentType ──────────────────

/** Single-shot helper — call Gemini, parse, return content. Routes by
 *  request.contentType (default 'chat'). */
export async function generateTextPayload(
  apiKey: string,
  req: TextPayloadRequest,
  baseTimestamps: string[],
): Promise<UINativeTextContent> {
  const contentType: TextPayloadContentType = req.contentType ?? 'chat'

  if (contentType === 'review') {
    const raw = await directGeminiText({
      apiKey,
      prompt: buildReviewPrompt(req),
      systemInstruction: REVIEW_SYSTEM_INSTRUCTION,
      maxOutputTokens: 1024,
    })
    return parseReviewResponse(raw, req, baseTimestamps[0] ?? '14:23')
  }

  if (contentType === 'comment-thread') {
    const raw = await directGeminiText({
      apiKey,
      prompt: buildCommentPrompt(req),
      systemInstruction: COMMENT_SYSTEM_INSTRUCTION,
      maxOutputTokens: 2048,
    })
    return parseCommentResponse(raw, req, baseTimestamps)
  }

  // Default: chat conversation
  const raw = await directGeminiText({
    apiKey,
    prompt: buildTextPayloadPrompt(req),
    systemInstruction: SYSTEM_INSTRUCTION,
    maxOutputTokens: 2048,
  })
  return parseTextPayloadResponse(raw, req, baseTimestamps)
}

// Read helpers for the encoded reactions fields above
export function readRating(item: { reactions?: string[] }): number {
  const tag = item.reactions?.find((r) => r.startsWith('★'))
  if (!tag) return 5
  return Math.max(1, Math.min(5, Number(tag.slice(1)) || 5))
}

export function readVariant(item: { reactions?: string[] }): string {
  const tag = item.reactions?.find((r) => r.startsWith('variant:'))
  return tag ? tag.slice('variant:'.length) : ''
}

export function readHelpful(item: { reactions?: string[] }): number {
  const tag = item.reactions?.find((r) => r.startsWith('helpful:'))
  return tag ? Math.max(0, Number(tag.slice('helpful:'.length)) || 0) : 0
}

export function readLikes(item: { reactions?: string[] }): number {
  const tag = item.reactions?.find((r) => r.startsWith('likes:'))
  return tag ? Math.max(0, Number(tag.slice('likes:'.length)) || 0) : 0
}

export function readIsReply(item: { reactions?: string[] }): boolean {
  return !!item.reactions?.includes('isReply:true')
}
