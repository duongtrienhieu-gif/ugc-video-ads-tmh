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
import type { CreativeDNA } from '../../../types/creativeDNA'
import { findPersona } from '../../../shared/metadata/personaLibrary'
import { safeGenerateStructured } from '../../../shared/llm/safeGenerateStructured'
import { assembleDnaDirective } from '../../../shared/prompt/dnaDirective'
import { validateLocaleMany } from '../../../shared/qc/localeValidator'
import { buildArchetypeMix, describeMix } from './commentArchetypes'
import { voiceSamplesChat, voiceSamplesReview, voiceSamplesComment } from './localeVoiceSamples'

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
  /** P25 — full product knowledge profile. When provided, gets baked
   *  into the LLM prompt so chat / review / comment text references
   *  real benefits + pain points + USPs instead of inventing them. */
  productKnowledge?: import('../../../services/productKnowledge').ProductKnowledge
  /** P28 — Creative DNA. When provided, its hard rule arrays get
   *  appended to every system instruction so generated chat / review
   *  / comment text honors contentRules, platformBehavior, and never
   *  produces failureModes. */
  dna?: CreativeDNA
}

// ── Locale hard-lock for Gemini system instructions ──────────────────

function localeRule(locale: UINativeLocale): string {
  const map: Record<UINativeLocale, string> = {
    'vi-VN':  'ALL output must be in Vietnamese (Tiếng Việt with diacritics — không bỏ dấu). NEVER mix English unless quoting an approved brand term. NEVER output Chinese, Korean, or Malay.',
    'my-MY':  'ALL output must be in Bahasa Melayu. NEVER output Vietnamese, Chinese, English (except approved brand terms), or Korean.',
    'id-ID':  'ALL output must be in Bahasa Indonesia. NEVER output Vietnamese, Chinese, Malay (Bahasa Melayu has subtle differences), or English.',
    'global': 'ALL output must be in plain casual English. NEVER output Vietnamese, Chinese, Korean, or Malay.',
  }
  return `[LOCALE HARD LOCK]\n${map[locale]}`
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
function productKnowledgeBlock(req: TextPayloadRequest): string {
  if (!req.productKnowledge) return ''
  const k = req.productKnowledge
  const lines: string[] = ['[PRODUCT KNOWLEDGE — reference these in the generated text]']
  if (k.benefits.length)   lines.push(`Real benefits: ${k.benefits.slice(0, 4).join(' · ')}`)
  if (k.usps.length)       lines.push(`USPs: ${k.usps.slice(0, 3).join(' · ')}`)
  if (k.painPoints.length) lines.push(`Pain points: ${k.painPoints.slice(0, 3).join(' · ')}`)
  if (k.offer)             lines.push(`Offer: ${k.offer.slice(0, 100)}`)
  lines.push('Reference these naturally — do NOT list them verbatim. NEVER invent fake claims.')
  return lines.join('\n') + '\n'
}

export function buildTextPayloadPrompt(req: TextPayloadRequest): string {
  const persona = req.personaId ? findPersona(req.personaId) : null
  const count = req.messageCount ?? 8
  const tone = req.tone ?? 'natural-warm'
  const knowledge = productKnowledgeBlock(req)

  const personaBlock = persona
    ? `Customer persona: ${persona.label.en}. Voice character: ${persona.voiceCharacter}`
    : 'Customer persona: typical authentic SEA customer, casual conversational tone.'

  const localeMap: Record<UINativeLocale, string> = {
    'my-MY':  'Malay (Bahasa Melayu) with occasional English code-switching',
    'vi-VN':  'Vietnamese with casual abbreviations (vd: ko thay vi khong)',
    'id-ID':  'Indonesian (Bahasa Indonesia) casual',
    'global': 'English casual conversational',
  }

  // P41 — concrete per-locale voice samples (Ladipage-style embedded
  // examples rather than generic guidance).
  const voiceRef = voiceSamplesChat(req.locale, `${req.productName}|${req.platform}`)

  return [
    `Generate a ${req.platform} chat conversation that looks like a real customer testimonial.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    knowledge,
    personaBlock,
    `Language: ${localeMap[req.locale]}`,
    `Tone: ${tone}`,
    `Message count: ${count} total messages (mix of incoming/outgoing — customer says more than shop).`,
    voiceRef,
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
/** Consume an already-parsed + validated LLMResponse and shape it into
 *  UINativeTextContent. JSON parsing happens upstream in
 *  safeGenerateStructured — this fn just maps the validated object. */
function shapeChatPayload(
  parsed: LLMResponse,
  req: TextPayloadRequest,
  baseTimestamps: string[],
): UINativeTextContent {
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

// ── Schema check (cheap structural validator — not Zod) ───────────────
function isChatResponse(v: unknown): v is LLMResponse {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj.customerDisplayName !== 'string') return false
  if (!Array.isArray(obj.messages) || obj.messages.length === 0) return false
  return obj.messages.every((m) => {
    if (typeof m !== 'object' || m === null) return false
    const msg = m as Record<string, unknown>
    return (msg.side === 'incoming' || msg.side === 'outgoing') && typeof msg.text === 'string'
  })
}

// ── Fallback chat content (used when LLM keeps failing) ───────────────
function chatFallback(req: TextPayloadRequest): LLMResponse {
  const localeName = req.locale === 'vi-VN' ? 'Linh N.'
    : req.locale === 'my-MY' ? 'Aisyah B.'
    : req.locale === 'id-ID' ? 'Putri W.'
    : 'Emma R.'
  const phrases = req.locale === 'vi-VN'
    ? [
        { side: 'incoming' as const, text: `chào shop, ${req.productName} còn ko ạ?` },
        { side: 'outgoing' as const, text: 'dạ còn ạ, bên em giao trong 24h ạ' },
        { side: 'incoming' as const, text: 'dùng cỡ 2 tuần là thấy khác à?' },
        { side: 'outgoing' as const, text: 'dạ chị, hầu hết khách phản hồi sau 10-14 ngày là rõ' },
        { side: 'incoming' as const, text: 'ok shop, em đặt 2 hộp nha' },
        { side: 'outgoing' as const, text: 'dạ em cảm ơn chị 🙏' },
      ]
    : [
        { side: 'incoming' as const, text: `hi shop, is ${req.productName} still in stock?` },
        { side: 'outgoing' as const, text: 'yes! ships within 24h' },
        { side: 'incoming' as const, text: 'how long until i see results?' },
        { side: 'outgoing' as const, text: 'most customers say 10-14 days' },
        { side: 'incoming' as const, text: 'ok ill take 2' },
        { side: 'outgoing' as const, text: 'thank you 🙏' },
      ]
  return { customerDisplayName: localeName, messages: phrases }
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
  const knowledge = productKnowledgeBlock(req)
  // P41 — concrete per-locale review voice samples
  const voiceRef = voiceSamplesReview(req.locale, `${req.productName}|${req.platform}|review`)

  return [
    `Generate a ${req.platform === 'shopee' ? 'Shopee' : 'TikTok Shop'} product review that looks authentic.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    knowledge,
    personaBlock,
    `Language: ${localeMap[req.locale]}`,
    voiceRef,
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

function shapeReviewPayload(
  parsed: LLMReviewResponse,
  req: TextPayloadRequest,
  timestamp: string,
): UINativeTextContent {
  const persona = req.personaId ? findPersona(req.personaId) : null
  const avatarHint = persona?.label.en ?? `${req.locale} marketplace buyer`

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

function isReviewResponse(v: unknown): v is LLMReviewResponse {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return typeof obj.buyerDisplayName === 'string'
      && typeof obj.reviewBody === 'string'
      && obj.reviewBody.length > 5
}

function reviewFallback(req: TextPayloadRequest): LLMReviewResponse {
  const name = req.locale === 'vi-VN' ? 'linhng***12'
    : req.locale === 'my-MY' ? 'aisyahb***08'
    : req.locale === 'id-ID' ? 'putri***24'
    : 'emma***07'
  const body = req.locale === 'vi-VN'
    ? `Mình mua ${req.productName} dùng được 3 tuần, thấy khác rõ. Đóng gói cẩn thận, shop tư vấn nhiệt tình. Sẽ ủng hộ shop lần sau.`
    : `Tried ${req.productName} for about 3 weeks, noticeable difference. Packaging is solid, shop replies quickly. Will reorder.`
  const variant = req.locale === 'vi-VN' ? 'Hộp 30 viên' : 'Pack of 30'
  return { buyerDisplayName: name, rating: 5, variantBought: variant, reviewBody: body, helpfulCount: 12 }
}

// ── Comment-thread prompts (P6) ─────────────────────────────────────────

const COMMENT_SYSTEM_INSTRUCTION =
  'You generate realistic social-media comment threads that look like an authentic '
  + 'reaction to a UGC post about a product. Output JSON only, no prose, no markdown '
  + 'fences. Comments must sound like real strangers replying — short, casual, mixed '
  + 'opinions (mostly positive but 1-2 neutral / curious comments OK). NEVER promotional '
  + 'corporate copy.'

interface LLMCommentResponse {
  // P48 — facebook-comment thread now also carries the original post
  // metadata so the canvas template can render the post header
  // (page name + post caption + product image) ABOVE the comments,
  // and mark some replies as coming from the page owner.
  postCaption?: string
  ownerName?: string
  postLikes?: number
  postShares?: number
  comments: {
    username: string
    text: string
    likes: number
    isReply?: boolean
    /** P48 — true when the page owner replies to a commenter. */
    isOwnerReply?: boolean
  }[]
}

function buildCommentPrompt(req: TextPayloadRequest): string {
  const persona = req.personaId ? findPersona(req.personaId) : null
  const personaBlock = persona
    ? `Original post is by persona: ${persona.label.en}. Voice character: ${persona.voiceCharacter}. The comments are from OTHER users (not the persona).`
    : 'Original post is by a typical SEA UGC creator. Comments are from other casual users.'
  const localeMap: Record<UINativeLocale, string> = {
    'my-MY':  'Malay (Bahasa Melayu) social media casual — drop standard punctuation often, use shorthand like "tak", "dah"',
    'vi-VN':  'Vietnamese social media casual with HEAVY abbreviation: ko=không, vs=với, vay=vậy, dc=được, hum=hôm, bgio=bao giờ, nhin=nhìn — also drop tone marks sometimes (real users do)',
    'id-ID':  'Indonesian social media casual with shorthand: yg=yang, dgn=dengan, krn=karena, jg=juga',
    'global': 'English social media casual — lowercase, drops apostrophes ("its" not "it\'s"), short fragments',
  }
  const count = req.messageCount ?? 6
  const platformName = req.platform === 'facebook' ? 'Facebook' : 'TikTok'
  const knowledge = productKnowledgeBlock(req)

  // P12 — archetype-driven mix replaces "1-2 emojis, mix of question/testimonial" generic guidance
  const mix = buildArchetypeMix(req.platform === 'facebook' ? 'facebook' : 'tiktok', count, `${req.productName}_${req.locale}`)
  const mixDescription = describeMix(mix)

  // P41 — concrete per-locale comment voice samples
  const voiceRef = voiceSamplesComment(req.locale, `${req.productName}|${req.platform}|comment`)

  // P48 — facebook-comment threads also need a post header on top of the
  // comments. Ask the LLM to author the post caption + page / creator name
  // + plausible like/share counts AND mark 1-2 comments as owner replies.
  const facebookExtras = req.platform === 'facebook' ? [
    '',
    'POST HEADER (Facebook only): Above the comments, the canvas renders the original post — a page / creator account that authored the post about this product. You also generate:',
    '  • a SHORT 1-2 sentence post caption in locale voice about the product (NEVER salesy; sound like a customer-discovery share or a page review post)',
    '  • a plausible locale-native page / creator display name (e.g. "Mỹ Phẩm Linh House" / "Sihat Bersama Aisyah" / "WellnessKita")',
    '  • a plausible postLikes count (200-5000) and postShares count (10-300)',
    '',
    'OWNER REPLIES: 1-2 of the comments below MUST be marked `"isOwnerReply": true` and authored by the page owner (use ownerName as the username) — these are SHORT polite replies to a previous commenter that answer a question or thank them. Place them as isReply: true and isOwnerReply: true, immediately after the commenter they reply to.',
  ] : []

  return [
    `Generate ${count} ${platformName} comments on a UGC post about this product.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    knowledge,
    personaBlock,
    `Language: ${localeMap[req.locale]}`,
    voiceRef,
    ...facebookExtras,
    '',
    'EACH comment must follow the archetype assigned below — this is what makes the thread feel MESSY and HUMAN instead of "8 variations of the same caption":',
    mixDescription,
    '',
    'STRICT JSON OUTPUT — no prose, no markdown fence:',
    '{',
    ...(req.platform === 'facebook' ? [
      '  "postCaption": "<1-2 sentence locale-native post caption>",',
      '  "ownerName": "<plausible page/creator display name>",',
      '  "postLikes": 1234,',
      '  "postShares": 56,',
    ] : []),
    '  "comments": [',
    '    { "username": "<lowercase casual username eg \\"thanh.nguyen\\", \\"linhng_98\\", \\"_mayhoang_\\">",',
    '      "text": "<the comment, following its archetype rules>",',
    '      "likes": 12,',
    '      "isReply": false' + (req.platform === 'facebook' ? ', "isOwnerReply": false' : '') + ' },',
    '    ...',
    '  ]',
    '}',
    '',
    'Hard rules:',
    `- Output ${count} comments in the order listed above.`,
    '- Usernames: each comment gets a DIFFERENT username (it is fine if a reply quotes a previous username — that is what reply archetypes do).',
    '- likes: realistic distribution — most 0..15, one or two can hit 60..400.',
    '- NO links, NO phone numbers, NO prices, NO "DM me" / "check bio" / "link in profile".',
    '- NEVER use words: advertisement, sponsored, ad, promo, paid, #ad.',
    '- Casual punctuation: lowercase is fine, drop full stops at end of short reactions, double "!!" / "??" allowed for emphasis.',
    '- For Vietnamese: real users mix tone-marked and tone-dropped forms — output should too.',
  ].join('\n')
}

function shapeCommentPayload(
  parsed: LLMCommentResponse,
  req: TextPayloadRequest,
  baseTimestamps: string[],
): UINativeTextContent {
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
      // P48 — owner-reply flag flows into reactions so the canvas
      // template can render a "Tác giả" / "Author" badge on the bubble.
      ...(c.isOwnerReply ? ['isOwnerReply:true'] : []),
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
      // P48 — facebook-comment post header data (undefined for other platforms)
      postCaption: parsed.postCaption,
      ownerName:   parsed.ownerName,
      postLikes:   typeof parsed.postLikes  === 'number' ? Math.max(0, Math.round(parsed.postLikes))  : undefined,
      postShares:  typeof parsed.postShares === 'number' ? Math.max(0, Math.round(parsed.postShares)) : undefined,
    },
  }
}

function isCommentResponse(v: unknown): v is LLMCommentResponse {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (!Array.isArray(obj.comments) || obj.comments.length === 0) return false
  return obj.comments.every((c) => {
    if (typeof c !== 'object' || c === null) return false
    const item = c as Record<string, unknown>
    return typeof item.username === 'string' && typeof item.text === 'string'
  })
}

function commentFallback(req: TextPayloadRequest): LLMCommentResponse {
  const count = req.messageCount ?? 6
  const phrases = req.locale === 'vi-VN'
    ? ['mua ở đâu vậy ạ?', 'sản phẩm này dùng được không?', 'cho mình xin link với', 'shop có ship Hà Nội ko?', 'dùng được lâu chưa bạn?', 'rep cho mình giá nha', 'có ai dùng thử chưa?', 'tag bạn xem cái này nha']
    : req.locale === 'my-MY'
    ? ['mana boleh dapat?', 'ada di shopee?', 'how much?', 'berapa lama dapat result?', 'nak juga try', 'pernah cuba ke?']
    : ['where can i buy?', 'whats the price?', 'does it really work?', 'how long for results?', 'looks good', 'tagging a friend']
  const usernames = ['linhng_98', 'minhanh.t', '_mayhoang', 'tuan.a01', 'huyentrang', 'nguyenmy_92', 'thaodo.q', 'kimanh.h']
  return {
    comments: Array.from({ length: count }).map((_, i) => ({
      username: usernames[i % usernames.length],
      text:     phrases[i % phrases.length],
      likes:    [3, 12, 1, 28, 0, 7][i % 6],
      isReply:  i > 0 && i % 3 === 0,
    })),
  }
}

// ── Public single-shot helper — routes by contentType ──────────────────
//
// P12-fix: all three content types now go through safeGenerateStructured
//   - Gemini called with responseMimeType: 'application/json' (forced JSON)
//   - extractStructuredJson repairs any residual malformed output
//   - schema validation per content type
//   - up to 2 retries with stricter prompt
//   - guaranteed fallback content — NEVER throws

export async function generateTextPayload(
  apiKey: string,
  req: TextPayloadRequest,
  baseTimestamps: string[],
): Promise<UINativeTextContent> {
  const contentType: TextPayloadContentType = req.contentType ?? 'chat'

  // P25 — append locale hard-lock to ALL system instructions so the
  // LLM cannot drift into the wrong language. Tech detail: appending
  // to systemInstruction is more reliable than embedding in the user
  // prompt for Gemini models.
  const localeAppend = '\n\n' + localeRule(req.locale)

  // P28 — append Creative DNA directive when a dna is provided. The
  // DNA carries content rules / platform behavior / failure modes that
  // the chat / review / comment generator MUST honor.
  const dnaDirective = req.dna ? assembleDnaDirective(req.dna) : ''
  const dnaAppend = dnaDirective ? '\n\n' + dnaDirective : ''

  if (contentType === 'review') {
    const result = await safeGenerateStructured<LLMReviewResponse>({
      apiKey,
      prompt: buildReviewPrompt(req),
      systemInstruction: REVIEW_SYSTEM_INSTRUCTION + localeAppend + dnaAppend,
      maxOutputTokens: 1024,
      schema: { name: 'LLMReviewResponse', validate: isReviewResponse },
      fallback: reviewFallback(req),
      generatorLabel: 'ui-native review',
      // P29 — locale validation: review body must be in the right language.
      postValidate: (v) => validateLocaleMany([v.reviewBody, v.variantBought], req.locale),
    })
    return shapeReviewPayload(result.value, req, baseTimestamps[0] ?? '14:23')
  }

  if (contentType === 'comment-thread') {
    const result = await safeGenerateStructured<LLMCommentResponse>({
      apiKey,
      prompt: buildCommentPrompt(req),
      systemInstruction: COMMENT_SYSTEM_INSTRUCTION + localeAppend + dnaAppend,
      maxOutputTokens: 2048,
      schema: { name: 'LLMCommentResponse', validate: isCommentResponse },
      fallback: commentFallback(req),
      generatorLabel: 'ui-native comments',
      // P29 — every comment body must match the locale.
      postValidate: (v) => validateLocaleMany(v.comments.map((c) => c.text), req.locale),
    })
    return shapeCommentPayload(result.value, req, baseTimestamps)
  }

  // Default: chat conversation
  const result = await safeGenerateStructured<LLMResponse>({
    apiKey,
    prompt: buildTextPayloadPrompt(req),
    systemInstruction: SYSTEM_INSTRUCTION + localeAppend + dnaAppend,
    maxOutputTokens: 2048,
    schema: { name: 'LLMResponse', validate: isChatResponse },
    fallback: chatFallback(req),
    generatorLabel: 'ui-native chat',
    // P29 — every chat message must match the locale.
    postValidate: (v) => validateLocaleMany(v.messages.map((m) => m.text), req.locale),
  })
  return shapeChatPayload(result.value, req, baseTimestamps)
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

/** P48 — true when this comment was authored by the page owner replying
 *  to a previous commenter (Facebook only). The facebook-comment canvas
 *  template renders these with an "Tác giả" / "Author" badge to mirror
 *  the page-owner badge on real Facebook threads. */
export function readIsOwnerReply(item: { reactions?: string[] }): boolean {
  return !!item.reactions?.includes('isOwnerReply:true')
}
