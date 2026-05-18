// ── Participant Engine (P12 authenticity overhaul) ─────────────────────────
//
// Generates a pool of unique ChatParticipants per platform's needs so
// renderers never reuse the same username / avatar combo across the
// thread (the "bot-farm" tell).
//
// Avatar generation is COST-CONSTRAINED — each KIE call is ~6 credit.
// Default per-platform avatar count is conservative; caller can opt
// up via params.options.uniqueAvatarCount (hard ceiling 8).

import type { UINativeLocale, UINativePlatform } from '../../../types/uiNative'

export type ParticipantRole = 'customer' | 'seller' | 'viewer'
export type Gender = 'male' | 'female'
export type AgeBand = 'young' | 'adult' | 'elder'

export interface ChatParticipant {
  id: string
  name: string
  /** Stable seed for KIE avatar generation — drives appearance diversity. */
  avatarSeed: string
  role: ParticipantRole
  gender?: Gender
  ageBand?: AgeBand
}

/** Per-platform target counts. Realistic, NOT the 8-20 ideal which
 *  would burn 50-120 KIE credits per single generation. Caller can
 *  override via options.uniqueAvatarCount up to the ceiling. */
export const PLATFORM_PARTICIPANT_TARGETS: Record<UINativePlatform, number> = {
  whatsapp:         1,    // customer only (seller-side bubbles have no avatar)
  messenger:        1,    // same
  shopee:           1,    // one buyer per review card
  'tiktok-shop':    1,    // same
  facebook:         4,    // varied commenter pool
  'tiktok-comment': 4,    // varied commenter pool
}

/** Absolute ceiling on KIE avatar calls per generation — protects the
 *  user from accidentally burning $$$ in credit when raising the count. */
export const UNIQUE_AVATAR_CEILING = 8

// ── Locale name pools ─────────────────────────────────────────────────

const NAME_POOLS: Record<UINativeLocale, { female: string[]; male: string[] }> = {
  'vi-VN': {
    female: ['Linh N.', 'Mai H.', 'Thảo P.', 'Hương L.', 'Trang Đ.', 'My Q.', 'Phương Vy', 'Hà My', 'Kim Anh', 'Nhung T.'],
    male:   ['Minh H.', 'Tuấn A.', 'Long V.', 'Nam K.', 'Đức T.', 'Hùng P.', 'Bảo T.', 'Khải Đ.', 'Quang N.', 'Hiếu L.'],
  },
  'my-MY': {
    female: ['Aisyah B.', 'Nurul A.', 'Siti R.', 'Farah Z.', 'Iman S.', 'Hana K.', 'Aida L.', 'Syaza N.'],
    male:   ['Aiman R.', 'Hakim Z.', 'Iskandar M.', 'Faiz A.', 'Adam S.', 'Daniel H.', 'Amir K.', 'Zaki R.'],
  },
  'id-ID': {
    female: ['Anindya P.', 'Putri W.', 'Citra D.', 'Ayu R.', 'Dewi L.', 'Sari M.', 'Rina S.', 'Tika N.'],
    male:   ['Bagas P.', 'Rangga D.', 'Adi K.', 'Yoga S.', 'Reza A.', 'Fajar L.', 'Hendra B.', 'Ridho T.'],
  },
  'global': {
    female: ['Emma R.', 'Sophie L.', 'Maya K.', 'Alex P.', 'Mia T.', 'Zara N.', 'Lily C.', 'Olivia W.'],
    male:   ['Liam T.', 'Noah K.', 'Mateo S.', 'Ethan W.', 'Lucas H.', 'Ryan O.', 'Owen D.', 'Caleb B.'],
  },
}

// ── Seeded RNG (mulberry32) ──────────────────────────────────────────

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
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// ── Pool generator ──────────────────────────────────────────────────

export interface PoolOptions {
  platform: UINativePlatform
  locale: UINativeLocale
  /** Caller cap — defaults to PLATFORM_PARTICIPANT_TARGETS[platform]; capped at UNIQUE_AVATAR_CEILING. */
  count?: number
  /** Stable seed so the same product+platform always yields the same pool. */
  seed: string
}

export function generateParticipantPool(opts: PoolOptions): ChatParticipant[] {
  const requested = opts.count ?? PLATFORM_PARTICIPANT_TARGETS[opts.platform]
  const count = Math.max(1, Math.min(UNIQUE_AVATAR_CEILING, requested))
  const rng = mulberry32(hashSeed(`${opts.seed}_${opts.platform}_${opts.locale}`))
  const pool = NAME_POOLS[opts.locale]

  const out: ChatParticipant[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < count; i++) {
    const gender: Gender = rng() < 0.62 ? 'female' : 'male'   // SEA UGC tends female-skewed
    const ageBand: AgeBand = pickAge(rng())
    const names = pool[gender]
    let name = names[Math.floor(rng() * names.length)]
    let attempts = 0
    while (usedNames.has(name) && attempts < 10) {
      name = names[Math.floor(rng() * names.length)]
      attempts++
    }
    usedNames.add(name)

    out.push({
      id: `p${i}_${name.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
      name,
      avatarSeed: `${opts.seed}_${i}_${gender}_${ageBand}`,
      role: i === 0 && (opts.platform === 'whatsapp' || opts.platform === 'messenger') ? 'customer' : 'viewer',
      gender,
      ageBand,
    })
  }
  return out
}

function pickAge(r: number): AgeBand {
  if (r < 0.35) return 'young'
  if (r < 0.85) return 'adult'
  return 'elder'
}

/** Build the avatar generation prompt suffix from a participant — gives
 *  the KIE call enough variability to avoid clone faces. */
export function buildAvatarHint(p: ChatParticipant, locale: UINativeLocale): string {
  const region = locale === 'vi-VN' ? 'Vietnamese' :
                 locale === 'my-MY' ? 'Malaysian' :
                 locale === 'id-ID' ? 'Indonesian' :
                 'Southeast Asian'
  const age = p.ageBand === 'young' ? 'early 20s' :
              p.ageBand === 'elder' ? 'mid 40s' :
              'late 20s to mid 30s'
  return `${region} ${p.gender ?? 'person'}, ${age}, casual everyday look, NOT a model, slight asymmetric framing as if a real selfie. Variation seed: ${p.avatarSeed.slice(-8)}.`
}
