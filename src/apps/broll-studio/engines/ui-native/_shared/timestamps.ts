// ── Realistic Timestamp Generator (P5) ──────────────────────────────────────
//
// Authenticity requires timestamps that look like a real conversation
// flow, not synthetic 12:00 / 00:00 placeholders. Produces a sequence
// where messages arrive 1-12 minutes apart, locale-aware day labels.

import type { UINativeLocale } from '../../../types/uiNative'

const DAY_LABELS: Record<UINativeLocale, string[]> = {
  // Sunday, Monday, ..., Saturday
  'my-MY':  ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'],
  'vi-VN':  ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'],
  'id-ID':  ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  'global': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

const TODAY_LABELS: Record<UINativeLocale, string> = {
  'my-MY':  'Hari ini',
  'vi-VN':  'Hôm nay',
  'id-ID':  'Hari ini',
  'global': 'Today',
}

const YESTERDAY_LABELS: Record<UINativeLocale, string> = {
  'my-MY':  'Semalam',
  'vi-VN':  'Hôm qua',
  'id-ID':  'Kemarin',
  'global': 'Yesterday',
}

/** Format a Date into "HH:MM" — 24h to match Asia/SEA convention. */
export function formatTimeHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Format a Date into a date-separator pill label for the given locale. */
export function formatDateSeparator(d: Date, locale: UINativeLocale): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()

  if (sameDay(d, today))     return TODAY_LABELS[locale]
  if (sameDay(d, yesterday)) return YESTERDAY_LABELS[locale]
  return DAY_LABELS[locale][d.getDay()]
}

export interface MessageTimeline {
  /** Time stamps for each message in send order, "HH:MM" form. */
  perMessage: string[]
  /** Single date separator label (eg "Hari ini", "Hôm nay"). */
  dateLabel: string
  /** Header time label for the status bar (matches first message hour). */
  statusBarTime: string
}

/**
 * Build a coherent timeline for N messages. Starts at a believable hour
 * (10:00 – 21:00), advances 1-12 minutes per step. Uses a stable
 * pseudo-random seed so re-renders of the same payload look identical.
 */
export function buildTimeline(
  messageCount: number,
  locale: UINativeLocale,
  seed: string = 'default',
): MessageTimeline {
  const rng = mulberry32(hashSeed(seed))

  // Random believable start hour 10:00 – 21:00
  const startHour = 10 + Math.floor(rng() * 12)
  const startMin = Math.floor(rng() * 60)

  const start = new Date()
  start.setHours(startHour, startMin, 0, 0)

  const perMessage: string[] = []
  let cursor = new Date(start)
  for (let i = 0; i < messageCount; i++) {
    perMessage.push(formatTimeHHMM(cursor))
    const stepMin = 1 + Math.floor(rng() * 12)
    cursor = new Date(cursor.getTime() + stepMin * 60_000)
  }

  return {
    perMessage,
    dateLabel:     formatDateSeparator(start, locale),
    statusBarTime: formatTimeHHMM(new Date(start.getTime() + 17 * 60_000)),  // ~17min later
  }
}

// ── Deterministic PRNG (mulberry32) ────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
