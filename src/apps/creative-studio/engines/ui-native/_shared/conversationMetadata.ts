// ── Conversation Metadata Engine (P12 authenticity overhaul) ────────────────
//
// Per-locale string + cadence generators for the metadata that gives a
// screenshot its "this is a real chat" smell:
//   • "Đã gửi" / "Delivered"
//   • "Đã xem 14:23" / "Seen 14:23"
//   • "Đang online" / "online"
//   • "Truy cập 12 phút trước" / "last seen 12m ago"
//   • "Hôm nay" / "Today" / "Hôm qua" / "Yesterday"
//   • "Liên quan nhất" / "Most relevant"
//   • "9.4k bình luận" / "9.4k comments"
//
// All strings localized for 4 locales. Cadence helpers ensure the
// timestamps spread realistically (no two messages at the same minute,
// gaps weighted natural).

import type { UINativeLocale, UINativePlatform } from '../../../types/uiNative'
import { formatTimeHHMM } from './timestamps'

// ── Locale string packs ──────────────────────────────────────────────

export interface ConversationStrings {
  /** "Đã gửi" — single tick state. */
  delivered: string
  /** "Đã xem" — double tick / read. */
  seen: string
  /** "Đang online" / "online". */
  online: string
  /** "Truy cập gần nhất {time}" / "last seen {time}". */
  lastSeen: (t: string) => string
  /** "Hôm nay" / "Today". */
  today: string
  /** "Hôm qua" / "Yesterday". */
  yesterday: string
  /** "Liên quan nhất" / "Most relevant". */
  mostRelevant: string
  /** "Mới nhất" / "Newest". */
  newest: string
  /** "{count} bình luận" / "{count} comments". */
  commentsCount: (n: number) => string
  /** "{count} đánh giá" / "{count} reviews". */
  reviewsCount: (n: number) => string
  /** "Trả lời" / "Reply". */
  reply: string
  /** "Thích" / "Like". */
  like: string
  /** "Hữu ích" / "Helpful". */
  helpful: string
  /** Composer placeholder per platform. */
  composerPlaceholder: (platform: UINativePlatform) => string
  /** P31 — marketplace app-bar title ("Đánh giá sản phẩm" / "Ulasan
   *  produk" / "Ulasan produk" / "Product reviews"). Used by Shopee +
   *  TikTok Shop review templates. */
  productReviewsTitle: string
  /** P31 — Messenger "Active now" presence subtitle ("Đang hoạt
   *  động" / "Aktif sekarang" / "Sedang aktif" / "Active now"). */
  activeNow: string
}

export const STRINGS_VI_VN: ConversationStrings = {
  delivered: 'Đã gửi',
  seen: 'Đã xem',
  online: 'đang hoạt động',
  lastSeen: (t) => `truy cập gần nhất ${t}`,
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  mostRelevant: 'Liên quan nhất',
  newest: 'Mới nhất',
  commentsCount: (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}N bình luận` : `${n} bình luận`,
  reviewsCount:  (n) => `${n} đánh giá`,
  reply: 'Trả lời',
  like: 'Thích',
  helpful: 'Hữu ích',
  composerPlaceholder: (p) =>
    p === 'whatsapp'  ? 'Tin nhắn' :
    p === 'messenger' ? 'Aa' :
    p === 'facebook'  ? 'Viết bình luận...' :
    p === 'tiktok-comment' ? 'Thêm bình luận...' :
    'Viết...',
  productReviewsTitle: 'Đánh giá sản phẩm',
  activeNow: 'Đang hoạt động',
}

export const STRINGS_MY_MY: ConversationStrings = {
  delivered: 'Dihantar',
  seen: 'Dibaca',
  online: 'dalam talian',
  lastSeen: (t) => `dilihat ${t}`,
  today: 'Hari ini',
  yesterday: 'Semalam',
  mostRelevant: 'Paling relevan',
  newest: 'Terbaru',
  commentsCount: (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k komen` : `${n} komen`,
  reviewsCount:  (n) => `${n} ulasan`,
  reply: 'Balas',
  like: 'Suka',
  helpful: 'Membantu',
  composerPlaceholder: (p) =>
    p === 'whatsapp'  ? 'Mesej' :
    p === 'messenger' ? 'Aa' :
    p === 'facebook'  ? 'Tulis komen...' :
    p === 'tiktok-comment' ? 'Tambah komen...' :
    'Tulis...',
  productReviewsTitle: 'Ulasan produk',
  activeNow: 'Aktif sekarang',
}

export const STRINGS_ID_ID: ConversationStrings = {
  delivered: 'Terkirim',
  seen: 'Dibaca',
  online: 'online',
  lastSeen: (t) => `terakhir dilihat ${t}`,
  today: 'Hari ini',
  yesterday: 'Kemarin',
  mostRelevant: 'Paling relevan',
  newest: 'Terbaru',
  commentsCount: (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}rb komentar` : `${n} komentar`,
  reviewsCount:  (n) => `${n} ulasan`,
  reply: 'Balas',
  like: 'Suka',
  helpful: 'Membantu',
  composerPlaceholder: (p) =>
    p === 'whatsapp'  ? 'Pesan' :
    p === 'messenger' ? 'Aa' :
    p === 'facebook'  ? 'Tulis komentar...' :
    p === 'tiktok-comment' ? 'Tambah komentar...' :
    'Tulis...',
  productReviewsTitle: 'Ulasan produk',
  activeNow: 'Sedang aktif',
}

export const STRINGS_GLOBAL: ConversationStrings = {
  delivered: 'Delivered',
  seen: 'Seen',
  online: 'online',
  lastSeen: (t) => `last seen ${t}`,
  today: 'Today',
  yesterday: 'Yesterday',
  mostRelevant: 'Most relevant',
  newest: 'Newest',
  commentsCount: (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k comments` : `${n} comments`,
  reviewsCount:  (n) => `${n} reviews`,
  reply: 'Reply',
  like: 'Like',
  helpful: 'Helpful',
  composerPlaceholder: (p) =>
    p === 'whatsapp'  ? 'Message' :
    p === 'messenger' ? 'Aa' :
    p === 'facebook'  ? 'Write a comment...' :
    p === 'tiktok-comment' ? 'Add comment...' :
    'Write...',
  productReviewsTitle: 'Product reviews',
  activeNow: 'Active now',
}

export function findStrings(locale: UINativeLocale): ConversationStrings {
  switch (locale) {
    case 'vi-VN':  return STRINGS_VI_VN
    case 'my-MY':  return STRINGS_MY_MY
    case 'id-ID':  return STRINGS_ID_ID
    default:        return STRINGS_GLOBAL
  }
}

// ── Cadence helpers ──────────────────────────────────────────────────

export interface MessageCadence {
  /** When was the user "last seen" — a few minutes before the first message. */
  lastSeen: string
  /** "Seen at" stamp for the last outgoing — slightly after last message. */
  seenAtLast: string
  /** Status pill — "đang hoạt động" if last message within 5min, else "last seen X". */
  presenceLabel: (s: ConversationStrings) => string
}

/** Build cadence + presence from a perMessage timeline (HH:MM strings). */
export function buildCadence(perMessage: string[]): MessageCadence {
  if (perMessage.length === 0) {
    return {
      lastSeen: '14:00',
      seenAtLast: '14:23',
      presenceLabel: (s) => s.online,
    }
  }
  const first = perMessage[0]
  const last = perMessage[perMessage.length - 1]
  const lastSeen = shiftHHMM(first, -7)
  const seenAtLast = shiftHHMM(last, +2)
  return {
    lastSeen,
    seenAtLast,
    presenceLabel: (s) => s.online,
  }
}

function shiftHHMM(t: string, deltaMin: number): string {
  const [h, m] = t.split(':').map((x) => Number(x))
  const total = h * 60 + m + deltaMin
  const newH = ((total % (24 * 60)) + 24 * 60) % (24 * 60) / 60 | 0
  const newM = ((total % 60) + 60) % 60
  const d = new Date()
  d.setHours(newH, newM, 0, 0)
  return formatTimeHHMM(d)
}

// ── Realistic engagement counter sprinkle ───────────────────────────

/** Generate a believable engagement metric (likes / comments / shares
 *  count) seeded by a string so re-renders match. */
export function fakeMetric(seed: string, kind: 'small' | 'medium' | 'large'): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const r = (h >>> 0) / 4294967296
  if (kind === 'small')  return 1 + Math.floor(r * 30)         // 1..30
  if (kind === 'medium') return 50 + Math.floor(r * 380)        // 50..430
  return 1200 + Math.floor(r * 18000)                            // 1.2k..19k
}
