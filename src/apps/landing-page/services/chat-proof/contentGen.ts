// ─────────────────────────────────────────────────────────────────────
// Content generation — produces the conversation text (header + message
// bubbles + product card copy) via Gemini text. Decoupled from the
// canvas rendering so we can swap LLMs / fallback to deterministic
// templates if needed.
//
// Returns a ChatProofContent ready to feed into renderChatProof().
// ─────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import type {
  ChatProofContent, ChatProofVariant,
} from './types'

interface GenerateContentArgs {
  productName: string
  productNiche?: string
  productPainPoint?: string
  productDomain?: string
  variant: ChatProofVariant
  /** Locale for sender names + slang. Default: 'my' (Malay). */
  locale?: 'my' | 'vi' | 'en'
  /** Optional variation seed — deterministic per render slot so 4 chats
   *  in the same WhatsApp section don't all use the same names. */
  variationSeed?: string
  geminiApiKey: string
}

// Malay sender pool — believable casual names
const MY_NAMES_FEMALE = ['Maya', 'Aisyah', 'Faridah', 'Siti', 'Nurul', 'Liyana', 'Hana', 'Aina', 'Sofea', 'Zaza']
const VI_NAMES = ['Linh', 'Trang', 'Mai', 'Hà', 'Nhi', 'Thảo', 'Vy', 'Hương']
const EN_NAMES = ['Sarah', 'Emma', 'Maya', 'Olivia', 'Sophia', 'Chloe', 'Amy', 'Ella']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function pickName(locale: string, seed: string): string {
  const pool = locale === 'vi' ? VI_NAMES
    : locale === 'en' ? EN_NAMES
    : MY_NAMES_FEMALE
  return pool[hash(seed) % pool.length]
}

const SYSTEM_PROMPT = `You generate ONE short casual chat conversation between two friends about a wellness / supplement / beauty / home product. The reply will be drawn into a phone chat screenshot template — keep it TIGHT.

OUTPUT FORMAT: a JSON object only, no markdown fences, no commentary. Schema:
{
  "header": { "contactName": "string", "status": "string (optional, eg 'online' / 'last seen today')" },
  "messages": [
    { "side": "incoming" | "outgoing", "text": "string", "timestamp": "string (optional)" }
  ],
  "productCard": { "title": "string", "subtitle": "string", "domain": "string", "side": "outgoing" | "incoming" },
  "productCardAfterIndex": number
}

WRITING RULES:
- 5 to 8 messages total
- Conversation flow: pain/curiosity → recommendation → product image (the card) → testimonial → soft CTA
- Each message under ~14 words. Short. Casual. Real friends texting.
- Vary message sides — alternate but not strict pingpong
- One emoji per 2-3 messages max (😩 🥰 🙌 💚 🔥)
- NO marketing paragraphs. NO formal English. NO "BUY NOW".
- For Malay locale: mix Manglish ("eh", "weh", "tau tak", "sis", "tak tipu", "serius", "memang best"). Code-switch naturally.
- Product card subtitle: ONE short benefit-led line, ~10 words max.
- Product card CTA messages stay subtle: "grab yours here 👇", "sis cuba tengok ni", "ni link dia"
- The product card slots between message[productCardAfterIndex] and message[productCardAfterIndex + 1].`

interface RawGeneration {
  header?: { contactName?: string; status?: string }
  messages?: { side?: string; text?: string; timestamp?: string }[]
  productCard?: { title?: string; subtitle?: string; domain?: string; side?: string }
  productCardAfterIndex?: number
}

function safeJsonParse(text: string): RawGeneration | null {
  // Strip code fences if present
  const cleaned = text
    .replace(/^```(?:json)?/m, '')
    .replace(/```$/m, '')
    .trim()
  try {
    return JSON.parse(cleaned) as RawGeneration
  } catch {
    // Try to extract the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) as RawGeneration } catch { return null }
  }
}

function fallbackContent(productName: string, locale: string, name: string): ChatProofContent {
  const isMy = locale === 'my'
  const isVi = locale === 'vi'
  if (isMy) {
    return {
      header: { contactName: name, status: 'online' },
      messages: [
        { side: 'outgoing', text: 'Eh serius ke ${productName} effective?'.replace('${productName}', productName), timestamp: 'Today 9:47 AM' },
        { side: 'incoming', text: 'Tak tipu sis, baru 4 hari dah rasa beza' },
        { side: 'outgoing', text: 'Macam mana rasa dia?' },
        { side: 'incoming', text: 'Perut rasa ringan, badan ada energy 💚' },
        { side: 'outgoing', text: 'OMG nak cuba la' },
        { side: 'incoming', text: 'Ni link dia 👇' },
        { side: 'incoming', text: 'Grab yours here' },
      ],
      productCard: {
        title: productName,
        subtitle: 'Vitamins, minerals & superfoods. Daily wellness boost.',
        domain: 'shop.my',
        side: 'incoming',
      },
      productCardAfterIndex: 6,
    }
  }
  if (isVi) {
    return {
      header: { contactName: name, status: 'đang hoạt động' },
      messages: [
        { side: 'outgoing', text: `Cậu thử ${productName} chưa?`, timestamp: 'Today 9:47 AM' },
        { side: 'incoming', text: 'Mới dùng 4 ngày thôi mà thấy rõ lắm' },
        { side: 'outgoing', text: 'Khoẻ hơn thật á?' },
        { side: 'incoming', text: 'Bụng dạ nhẹ tênh, lúc nào cũng có energy 💚' },
        { side: 'outgoing', text: 'Ưi mình muốn thử' },
        { side: 'incoming', text: 'Link đây nè 👇' },
      ],
      productCard: {
        title: productName,
        subtitle: 'Vitamin tổng hợp, hỗ trợ tiêu hoá hằng ngày.',
        domain: 'shop.vn',
        side: 'incoming',
      },
      productCardAfterIndex: 5,
    }
  }
  return {
    header: { contactName: name, status: 'online' },
    messages: [
      { side: 'outgoing', text: `have you tried ${productName}?`, timestamp: 'Today 9:47 AM' },
      { side: 'incoming', text: 'honestly? game changer 🥰' },
      { side: 'outgoing', text: 'omg how does it feel?' },
      { side: 'incoming', text: 'so much more energy, way less bloat' },
      { side: 'outgoing', text: 'OK send me the link' },
      { side: 'incoming', text: 'grab yours here 👇' },
    ],
    productCard: {
      title: productName,
      subtitle: 'Daily greens with 41 vitamins, minerals & superfoods.',
      domain: 'shop.com',
      side: 'incoming',
    },
    productCardAfterIndex: 5,
  }
}

export async function generateChatContent(args: GenerateContentArgs): Promise<ChatProofContent> {
  const locale = args.locale ?? 'my'
  const seed = args.variationSeed ?? Math.random().toString(36).slice(2, 8)
  const contactName = pickName(locale, `${args.productName}-${seed}`)

  const userPrompt = `
PRODUCT: ${args.productName}
${args.productNiche ? `NICHE: ${args.productNiche}\n` : ''}${args.productPainPoint ? `PAIN POINT: ${args.productPainPoint}\n` : ''}${args.productDomain ? `DOMAIN: ${args.productDomain}\n` : ''}LOCALE: ${locale === 'my' ? 'Malay (Manglish OK)' : locale === 'vi' ? 'Vietnamese' : 'English'}
SUGGESTED CONTACT NAME: ${contactName} (you may keep or replace with another believable ${locale === 'my' ? 'Malaysian' : locale === 'vi' ? 'Vietnamese' : 'English'} name)
PLATFORM HINT: ${args.variant} (informal, casual)
SEED: ${seed}

Produce the JSON. Output JSON ONLY.`.trim()

  let raw: RawGeneration | null = null
  try {
    const text = await directGeminiText({
      apiKey: args.geminiApiKey,
      prompt: userPrompt,
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 1200,
    })
    raw = safeJsonParse(text)
  } catch (err) {
    console.warn('[chat-proof] gemini gen failed — using fallback:', err)
  }

  if (!raw || !Array.isArray(raw.messages) || raw.messages.length < 3) {
    return fallbackContent(args.productName, locale, contactName)
  }

  // Normalize
  return {
    header: {
      contactName: raw.header?.contactName?.trim() || contactName,
      status: raw.header?.status?.trim() || 'online',
    },
    messages: raw.messages
      .filter((m) => m && typeof m.text === 'string' && m.text.trim())
      .map((m) => ({
        side: m.side === 'outgoing' ? 'outgoing' as const : 'incoming' as const,
        text: m.text!.trim(),
        timestamp: m.timestamp?.trim() || undefined,
      })),
    productCard: raw.productCard ? {
      title: raw.productCard.title?.trim() || args.productName,
      subtitle: raw.productCard.subtitle?.trim() || 'Daily wellness essentials.',
      domain: raw.productCard.domain?.trim() || args.productDomain || 'shop.com',
      side: raw.productCard.side === 'outgoing' ? 'outgoing' as const : 'incoming' as const,
    } : undefined,
    productCardAfterIndex: typeof raw.productCardAfterIndex === 'number'
      ? Math.max(-1, Math.min(raw.productCardAfterIndex, (raw.messages?.length ?? 1) - 1))
      : -1,
  }
}
