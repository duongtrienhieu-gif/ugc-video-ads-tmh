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

// P50 — review payload is now an ARRAY of reviews so shopee-feedback /
// tiktok-feedback can stack 2-3 reviews per screenshot (matching real
// marketplace UIs where the screen is full of stacked review cards, not
// one card with empty space). buyerDisplayName is also Shopee/TikTok-
// style masked ("T**n H**u" — initial + asterisks + last letter chunks)
// so it reads as a real anonymised buyer, not a fake username.
interface LLMReviewItem {
  /** Shopee/TikTok-style masked name: "T**n H**u" or "L**g H**g ** T**". */
  buyerDisplayName: string
  /** Star rating out of 5, integer. Mostly 5, sometimes 4 for believability. */
  rating: number
  /** Variant the buyer bought (eg color, size, flavor). */
  variantBought: string
  /** Body — 3-5 sentences, with line breaks between sentences so the
   *  review renders as multi-paragraph (matches real review UX). */
  reviewBody: string
  /** Realistic small helpful count 0-30 (mostly 0-5, occasional 20-30). */
  helpfulCount: number
}

interface LLMReviewResponse {
  reviews: LLMReviewItem[]
}

function buildReviewPrompt(req: TextPayloadRequest): string {
  const persona = req.personaId ? findPersona(req.personaId) : null
  const personaBlock = persona
    ? `Buyer persona: ${persona.label.en}. Voice character: ${persona.voiceCharacter}`
    : 'Buyer persona: typical authentic SEA marketplace shopper, casual review tone.'
  const localeMap: Record<UINativeLocale, string> = {
    'my-MY':  'Malay (Bahasa Melayu) marketplace review style — casual conversational, may drop punctuation, shorthand like "tak", "dah", "memang", "best gila"',
    'vi-VN':  'Vietnamese marketplace review style (casual, may use abbreviations)',
    'id-ID':  'Indonesian (Bahasa Indonesia) marketplace review style',
    'global': 'English casual review style',
  }
  const knowledge = productKnowledgeBlock(req)
  const voiceRef = voiceSamplesReview(req.locale, `${req.productName}|${req.platform}|review`)
  const count = req.messageCount ?? 2
  const platformName = req.platform === 'shopee' ? 'Shopee' : 'TikTok Shop'

  // P50 — Shopee/TikTok always show usernames in a masked format. The
  // prompt instructs the LLM to mask the buyer name so the screenshots
  // match the real marketplace UX.
  const maskExamples = req.locale === 'vi-VN' ? '"T**n H**u", "L**g H**g ** T**", "duc.l**rious"'
    : req.locale === 'my-MY' ? '"A**y**", "S**z**n***92", "n**dia_**78"'
    : req.locale === 'id-ID' ? '"P**ri_**", "R**i ***82", "f**za_***"'
    : '"S**a J**n", "m**e_***", "j**n_**85"'

  return [
    `Generate ${count} authentic ${platformName} buyer reviews about this product.`,
    `Product: ${req.productName}${req.niche ? ` (niche: ${req.niche})` : ''}`,
    knowledge,
    personaBlock,
    `Language: ${localeMap[req.locale]}`,
    voiceRef,
    '',
    'STRICT JSON OUTPUT — no prose, no markdown fence:',
    '{',
    '  "reviews": [',
    '    {',
    `      "buyerDisplayName": "<masked buyer name in ${platformName} style. Use ${maskExamples}>",`,
    '      "rating": 5,',
    '      "variantBought": "<short variant SKU string, locale-native>",',
    '      "reviewBody": "<3-5 sentence buyer review WITH line breaks between sentences (use \\n)>",',
    '      "helpfulCount": 5',
    '    },',
    '    ... // exactly ' + count + ' review items total',
    '  ]',
    '}',
    '',
    'Rules:',
    `- Output EXACTLY ${count} reviews in the "reviews" array.`,
    '- Each buyerDisplayName MUST follow the Shopee/TikTok mask pattern — initial letter + asterisks + last letter chunks (never a full real name).',
    '- Rating is usually 5, sometimes 4 (avoid 3/2/1 — testimonial use case).',
    '- reviewBody is SPECIFIC (when used, what changed, how long, sensory detail). 3-5 sentences, INCLUDE line breaks (\\n) between sentences so the review renders as multi-paragraph.',
    '- 60-180 words per review. Conversational, mild typos OK. NEVER corporate.',
    '- 0-2 emojis max per review. No links, no phone numbers, no prices.',
    '- variantBought sounds like a real SKU choice ("' + (req.locale === 'my-MY' ? '1 Botol, T400 3 MATA, Pakej 30 hari, Saiz L' : 'Hộp 30 viên, Vị cam, Size L') + '").',
    '- helpfulCount: usually 0-5, occasional 15-30.',
    '- The reviews should sound DIFFERENT from each other — different buyer voice, different angle of praise, different sentence length.',
  ].join('\n')
}

function shapeReviewPayload(
  parsed: LLMReviewResponse,
  req: TextPayloadRequest,
  baseTimestamps: string[],
): UINativeTextContent {
  const persona = req.personaId ? findPersona(req.personaId) : null
  const avatarHint = persona?.label.en ?? `${req.locale} marketplace buyer`
  const reviews = parsed.reviews ?? []

  const participants = reviews.map((r) => ({
    displayName: r.buyerDisplayName,
    avatarHint,
    locale: req.locale,
  }))

  const items = reviews.map((r, idx) => ({
    authorIdx: idx,
    text: r.reviewBody,
    timestamp: baseTimestamps[idx] ?? baseTimestamps[0] ?? '14:23',
    reactions: [
      `★${Math.max(1, Math.min(5, Math.round(r.rating ?? 5)))}`,
      `variant:${r.variantBought ?? ''}`,
      `helpful:${r.helpfulCount ?? 0}`,
    ],
    hasAttachment: 'product' as const,
  }))

  return {
    participants,
    items,
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
  if (!Array.isArray(obj.reviews) || obj.reviews.length === 0) return false
  return obj.reviews.every((r) => {
    if (typeof r !== 'object' || r === null) return false
    const item = r as Record<string, unknown>
    return typeof item.buyerDisplayName === 'string'
        && typeof item.reviewBody === 'string'
        && (item.reviewBody as string).length > 5
  })
}

function reviewFallback(req: TextPayloadRequest): LLMReviewResponse {
  const isMY = req.locale === 'my-MY'
  const isVN = req.locale === 'vi-VN'
  const isID = req.locale === 'id-ID'
  const p = req.productName
  const sample1 = isMY
    ? { name: 'A**y**', body: `Dah guna ${p} dalam 2 minggu, memang power gila.\nPackaging ok, hantar pun cepat.\nDah order lagi untuk mak aku.`, variant: '1 Botol' }
    : isVN
    ? { name: 'l**hng***12', body: `Mình mua ${p} dùng được 3 tuần thấy khác rõ.\nĐóng gói cẩn thận, shop tư vấn nhiệt tình.\nSẽ ủng hộ shop lần sau.`, variant: 'Hộp 30 viên' }
    : isID
    ? { name: 'p**ri_***', body: `Aku pake ${p} 2 minggu, hasilnya keliatan banget.\nPackaging rapi, dikirim cepet.\nBakal order lagi.`, variant: '1 Botol' }
    : { name: 'e**a_***', body: `Tried ${p} for 2 weeks, noticeable difference.\nPackaging is solid, shop replies fast.\nWill reorder.`, variant: 'Pack of 30' }
  const sample2 = isMY
    ? { name: 'n**dia_***', body: `Awal pakai memang ragu sebab takut scam tapi result memang real.\nPenghantaran sampai dalam 2 hari, packing pun rapi.\nDah recommend kat kawan-kawan office.`, variant: '1 Botol' }
    : isVN
    ? { name: 'm**a_***', body: `Lúc đầu cũng hơi nghi vì thấy quảng cáo nhiều, nhưng dùng thử thì thấy hiệu quả thật.\nGiao hàng nhanh, đóng gói cẩn thận.\nĐã giới thiệu cho bạn cùng cơ quan.`, variant: 'Hộp 30 viên' }
    : isID
    ? { name: 'r**a***82', body: `Awalnya ragu krn liat iklan banyak, tapi pas dicoba beneran works.\nKirimnya cepet, packing aman.\nUdah saranin ke temen kantor.`, variant: '1 Botol' }
    : { name: 'j**a_***', body: `At first I was skeptical due to all the ads, but it actually works.\nFast shipping, secure packaging.\nAlready recommended to coworkers.`, variant: 'Pack of 30' }
  return {
    reviews: [
      { buyerDisplayName: sample1.name, rating: 5, variantBought: sample1.variant, reviewBody: sample1.body, helpfulCount: 4 },
      { buyerDisplayName: sample2.name, rating: 5, variantBought: sample2.variant, reviewBody: sample2.body, helpfulCount: 12 },
    ],
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

  // P48 + P49 — facebook-comment AND tiktok-comment threads need a post
  // header on top of the comments (FB) or a styled video peek (TikTok).
  // Ask the LLM to author the post caption + page / creator name + plausible
  // engagement counts. FB also gets 1-2 owner-reply comments. TikTok uses
  // the same fields but they're rendered differently (creator handle +
  // video caption + audio strip) by the canvas template.
  const needsPostHeader = req.platform === 'facebook' || req.platform === 'tiktok-comment'
  const isFacebook = req.platform === 'facebook'
  const facebookExtras = needsPostHeader ? [
    '',
    isFacebook
      ? 'POST HEADER (Facebook): Above the comments, the canvas renders the original page post — a Facebook page that authored the post about this product. Also generate:'
      : 'VIDEO PEEK (TikTok): Above the comments, the canvas renders a styled TikTok video still + caption. Also generate:',
    '  • a SHORT 1-2 sentence locale-native post caption about the product (NEVER salesy; sound like a customer-discovery share OR a creator review)' + (isFacebook ? '' : '. TikTok captions can be more casual: lowercase, emoji-heavy, hashtags allowed.'),
    isFacebook
      ? '  • a plausible locale-native page / creator display name (e.g. "Mỹ Phẩm Linh House" / "Sihat Bersama Aisyah" / "WellnessKita")'
      : '  • a plausible TikTok creator handle/display name (e.g. "@my.linh.review" / "@aisyah.sihat" / "@nadia.wellness") — output WITH the leading @ if natural for the locale',
    '  • a plausible postLikes count (' + (isFacebook ? '200-5000' : '5000-200000') + ') and postShares count (' + (isFacebook ? '10-300' : '100-5000') + ')',
    ...(isFacebook ? [
      '',
      'OWNER REPLIES: 1-2 of the comments below MUST be marked `"isOwnerReply": true` and authored by the page owner (use ownerName as the username) — these are SHORT polite replies to a previous commenter that answer a question or thank them. Place them as isReply: true and isOwnerReply: true, immediately after the commenter they reply to.',
    ] : []),
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
    ...(needsPostHeader ? [
      '  "postCaption": "<1-2 sentence locale-native post caption>",',
      '  "ownerName": "<plausible ' + (isFacebook ? 'page/creator display name' : 'TikTok creator handle (with leading @)') + '>",',
      '  "postLikes": ' + (isFacebook ? '1234' : '12500') + ',',
      '  "postShares": ' + (isFacebook ? '56' : '450') + ',',
    ] : []),
    '  "comments": [',
    '    { "username": "<lowercase casual username eg \\"thanh.nguyen\\", \\"linhng_98\\", \\"_mayhoang_\\">",',
    '      "text": "<the comment, following its archetype rules>",',
    '      "likes": 12,',
    '      "isReply": false' + (isFacebook ? ', "isOwnerReply": false' : '') + ' },',
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
      // P50 — bumped budget for multi-review array
      maxOutputTokens: 2048,
      schema: { name: 'LLMReviewResponse', validate: isReviewResponse },
      fallback: reviewFallback(req),
      generatorLabel: 'ui-native review',
      // P29 — locale validation: every review body must be in the right language.
      postValidate: (v) => validateLocaleMany(
        v.reviews.flatMap((r) => [r.reviewBody, r.variantBought]),
        req.locale,
      ),
    })
    return shapeReviewPayload(result.value, req, baseTimestamps)
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
