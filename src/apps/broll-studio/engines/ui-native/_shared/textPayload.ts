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

export interface TextPayloadRequest {
  platform: UINativePlatform
  locale: UINativeLocale
  /** Product name + niche — anchors the conversation topic. */
  productName: string
  niche?: string
  /** Optional persona id for the testimonial author. */
  personaId?: string
  /** Number of messages to generate (default 8). */
  messageCount?: number
  /** Tone hint, default 'natural-warm'. */
  tone?: string
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

/** Single-shot helper — call Gemini, parse, return content. */
export async function generateTextPayload(
  apiKey: string,
  req: TextPayloadRequest,
  baseTimestamps: string[],
): Promise<UINativeTextContent> {
  const raw = await directGeminiText({
    apiKey,
    prompt: buildTextPayloadPrompt(req),
    systemInstruction: SYSTEM_INSTRUCTION,
    maxOutputTokens: 2048,
  })
  return parseTextPayloadResponse(raw, req, baseTimestamps)
}
