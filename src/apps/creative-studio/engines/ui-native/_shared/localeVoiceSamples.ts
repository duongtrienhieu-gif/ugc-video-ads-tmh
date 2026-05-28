// ── Locale Voice Sample Bank (P41) ──────────────────────────────────────
//
// Per-locale CONCRETE conversation samples — chat / review / comment
// snippets that match how real users in each SEA market write online.
// Matches Ladipage's prompt pattern of embedding EXACT message strings
// per locale (vs Creative Studio's pre-P41 generic localeMap guidance).
//
// Why embedded examples beat generic instructions:
//   • Gemini drifts toward whatever it has SEEN, not what it's been TOLD
//   • "Use casual Malay" → drifts to formal Malay textbook style
//   • Show 3 real Malay chat messages → mimics the actual rhythm
//
// SCOPE: These samples are for PROMPT STEERING ONLY. They are NOT used
// as fallback content (that's chatFallback / reviewFallback /
// commentFallback) and they are NOT user-facing text. They live INSIDE
// the Gemini prompt as "voice reference".

import type { UINativeLocale } from '../../../types/uiNative'

interface VoiceSamples {
  /** Casual chat snippets — short customer-to-shop testimonial flow. */
  chatSnippets: string[]
  /** Marketplace review snippets — 1-3 sentences each, mid-length. */
  reviewSnippets: string[]
  /** Social-feed comment snippets — short reactions, slang, emoji. */
  commentSnippets: string[]
}

const SAMPLES: Record<UINativeLocale, VoiceSamples> = {
  'my-MY': {
    chatSnippets: [
      'Salam sis, nak tanya pasal produk ni',
      'Dah sampai dah ke takda? 😊',
      'Wah cepat sangat shop, baru pesan semalam',
      'Memang power la produk ni, dah cuba',
      'Boleh dapatkan link order? COD sampai Sabah ke?',
      'Ok sis terima kasih, nak order 2 botol',
      'Alhamdulillah, dah rasa beza dah',
      'Berbaloi gila, jimat sangat 👍',
    ],
    reviewSnippets: [
      'Produk best! Penghadaman dah lancar, kurang kembung. Akan order lagi.',
      'Alhamdulillah, dah seminggu guna rasa lebih bertenaga. Recommended!',
      'Memang berbaloi, packaging cantik, sampai cepat. Terima kasih shop ❤️',
      'Cuba la korang, mula-mula skeptikal je tapi memang membantu.',
      'Power produk ni, dah tak sembelit lagi. 5 bintang!',
    ],
    commentSnippets: [
      'Wah memang power!',
      'Best gila sis 👍',
      'Boleh dapatkan link tak?',
      'Saya pun nak cuba',
      'Dah cuba, memang berkesan!',
      'Berbaloi sangat ❤️',
      'Recommended! Cepat order',
      'Stok masih ada ke?',
      'Tag kawan jom!',
      'Yang ni je yang berkesan untuk saya',
    ],
  },

  'vi-VN': {
    chatSnippets: [
      'Chào shop, sản phẩm này còn ko ạ',
      'Dạ em đặt 2 hộp nha',
      'Ship Hà Nội mất mấy ngày shop?',
      'Mẹ em dùng 1 tuần là thấy khác ngay',
      'Ok shop, em cảm ơn 🙏',
      'Dùng đều mỗi sáng đúng ko ạ?',
      'Hết mất ngủ rồi, mừng ghê',
      'Shop tư vấn nhiệt tình quá, đặt liền',
    ],
    reviewSnippets: [
      'Sản phẩm dùng được lắm, hết đầy hơi sau 2 tuần. Sẽ ủng hộ shop lần sau ❤️',
      'Đóng gói cẩn thận, ship nhanh. Mẹ mình dùng thấy ngủ ngon hơn hẳn.',
      'Lúc đầu cũng nghi nhưng dùng thử rồi mới biết, đúng là tiền nào của nấy.',
      'Mua được 2 tuần, da đỡ khô hẳn, đáng tiền. Nhân viên shop tư vấn nhiệt tình.',
      '5 sao cho shop! Sản phẩm chính hãng, có giấy chứng nhận đầy đủ.',
    ],
    commentSnippets: [
      'Mua ở đâu vậy sis',
      'Ngon ko ạ',
      'Cho mình xin link với',
      'Có ship Đà Nẵng ko shop?',
      'Đặt rồi nha, đang chờ',
      'Dùng rồi đỉnh nha',
      'Bao nhiêu vậy ạ?',
      'Tag bạn xem nè',
      'Ai dùng thử chưa ạ',
      'Em đặt rồi, hôm sau review',
    ],
  },

  'id-ID': {
    chatSnippets: [
      'Sis, produk ini masih ada stoknya?',
      'Saya pesan 2 botol ya',
      'Ongkir ke Bandung berapa kak?',
      'Sudah seminggu pakai, lumayan kerasa bedanya',
      'Oke sis, makasih ya 🙏',
      'COD ke daerah saya bisa gak?',
      'Mantap, recommended banget',
      'Pengiriman cepat, packaging rapi',
    ],
    reviewSnippets: [
      'Produknya bagus, baru pakai seminggu sudah kerasa perbedaannya. Recommended!',
      'Packaging aman, kemasan rapi, kurir cepet. Akan repeat order lagi.',
      'Awalnya ragu tapi setelah coba ternyata benar bantu. Worth it banget.',
      'Mama saya pakai sebulan, tidur lebih nyenyak. Terima kasih shop!',
      'Bintang 5! Pelayanan ramah, produk asli, ada sertifikat BPOM.',
    ],
    commentSnippets: [
      'Beli di mana sis',
      'Mantap banget!',
      'Minta link dong',
      'Bisa COD ke Jogja?',
      'Saya juga pakai, recommended',
      'Berapa harga sis',
      'Tag temen nih',
      'Worth banget',
      'Udah pesen, tunggu kedatangan',
      'Yang ini paling cocok buat aku',
    ],
  },

  'global': {
    chatSnippets: [
      'hi shop, is this still in stock?',
      'just ordered 2, thanks!',
      'how long does shipping take?',
      'mom tried it for a week and felt better already',
      'okay placing order now',
      'do you ship internationally?',
      'thank you, fast reply 🙏',
      'will reorder soon',
    ],
    reviewSnippets: [
      'Tried this for 2 weeks, noticeable difference. Packaging was solid and shipping was fast.',
      'Was skeptical at first but it actually works. Will reorder for my mom.',
      'Great product, customer service is responsive too. 5 stars!',
      'Mid-priced but worth every cent. Lighter feeling after 10 days.',
      'Product matches description. Quality packaging, certified authentic.',
    ],
    commentSnippets: [
      'where to buy?',
      'looks legit',
      'send me the link please',
      'does it really work?',
      'just ordered',
      'how much is it?',
      'tagging a friend',
      'recommended!',
      'will check this out',
      'this is the only one that worked for me',
    ],
  },
}

/** Pick N samples deterministically per (locale, kind, seed) so the
 *  same product+locale combo gets a stable voice sample set. */
function pickSamples(arr: string[], count: number, seed: string): string[] {
  if (arr.length === 0) return []
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  let s = h >>> 0
  const next = (): number => {
    s = (s + 0x6D2B79F5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pool = [...arr]
  const picked: string[] = []
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const idx = Math.floor(next() * pool.length)
    picked.push(pool[idx])
    pool.splice(idx, 1)
  }
  return picked
}

/** Emit a Gemini prompt fragment with concrete voice samples for chat. */
export function voiceSamplesChat(locale: UINativeLocale, seed: string): string {
  const picks = pickSamples(SAMPLES[locale].chatSnippets, 4, seed + '|chat')
  if (picks.length === 0) return ''
  return [
    '',
    `VOICE REFERENCE — how real ${locale} customers chat (mimic this rhythm + slang, DO NOT copy verbatim):`,
    ...picks.map((p) => `  • "${p}"`),
  ].join('\n')
}

export function voiceSamplesReview(locale: UINativeLocale, seed: string): string {
  const picks = pickSamples(SAMPLES[locale].reviewSnippets, 3, seed + '|review')
  if (picks.length === 0) return ''
  return [
    '',
    `VOICE REFERENCE — how real ${locale} buyers write marketplace reviews (mimic this rhythm + tone, DO NOT copy verbatim):`,
    ...picks.map((p) => `  • "${p}"`),
  ].join('\n')
}

export function voiceSamplesComment(locale: UINativeLocale, seed: string): string {
  const picks = pickSamples(SAMPLES[locale].commentSnippets, 6, seed + '|comment')
  if (picks.length === 0) return ''
  return [
    '',
    `VOICE REFERENCE — how real ${locale} users comment on social posts (mimic the rhythm / slang / emoji density, DO NOT copy verbatim):`,
    ...picks.map((p) => `  • "${p}"`),
  ].join('\n')
}
