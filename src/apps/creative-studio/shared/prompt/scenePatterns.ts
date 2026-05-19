// ── Scene Pattern Library (P36 — Ladipage-style prompt specificity) ──────
//
// Extracted from real-world ads-grade prompts (INFINITY_PROBIOTICS pack).
// Each helper emits a richly-specific text fragment locale-aware:
//   - demographic anchor (gender / age / attire matching the market)
//   - cultural context (Halal / hijab acceptable / áo dài / etc.)
//   - device + lighting + UGC quality language
//   - designed text-overlay layout directives
//   - price-lock pattern (prevents Gemini from inventing prices)
//
// USAGE:
//   import { demographicAnchor, screenshotFeel } from '../shared/prompt/scenePatterns'
//   const sceneText =
//     `${demographicAnchor('my-MY', { role: 'customer', gender: 'woman' })} `
//     + `${screenshotFeel('selfie')}. The person holds product towards camera.`
//
// HARD RULE: NEVER hardcode "Malaysian woman" or "Vietnamese person" in
// configs.ts — always go through these helpers so a locale change ripples
// through every creative consistently.

import type { UINativeLocale } from '../../types/uiNative'

// ── Demographic anchors per locale ───────────────────────────────────

type Gender = 'woman' | 'man' | 'mixed'
type AgeRange = 'gen-z' | 'mid-20s' | 'mid-30s' | 'mid-40s' | 'older' | 'mixed'
type Role =
  | 'customer'            // generic UGC customer
  | 'creator'             // TikTok / Reels creator vibe
  | 'professional'        // doctor / expert / KOL
  | 'family-member'       // household / domestic context
  | 'office-worker'       // urban professional context

export interface DemographicOpts {
  role?: Role
  gender?: Gender
  age?: AgeRange
  /** When true, add hijab / modest-attire hint where culturally appropriate. */
  modestAttire?: boolean
}

/** Locale-specific demographic phrasing matching real Ladipage-style
 *  prompts. Returns a sentence fragment ready to plug into BLOCKS.scene(). */
export function demographicAnchor(locale: UINativeLocale, opts: DemographicOpts = {}): string {
  const role = opts.role ?? 'customer'
  const gender = opts.gender ?? 'woman'
  const age = opts.age ?? 'mid-30s'

  const nationality = NATIONALITY_BY_LOCALE[locale]
  const ageStr = AGE_PHRASE[age]
  const genderStr = GENDER_PHRASE[gender]

  // Role-specific modifier
  const roleStr = roleModifier(locale, role)

  // Cultural attire hint (modest / hijab) when locale + opts allow
  const attireHint = (opts.modestAttire ?? defaultModestAttire(locale, gender))
    ? attireBlurb(locale, gender)
    : ''

  // Concatenate Ladipage-style: "A Malaysian woman in her mid-30s, [attire,] [role context]"
  const parts = [`A ${nationality} ${genderStr} ${ageStr}`]
  if (attireHint) parts.push(attireHint)
  if (roleStr)   parts.push(roleStr)
  return parts.join(', ')
}

const NATIONALITY_BY_LOCALE: Record<UINativeLocale, string> = {
  'vi-VN':  'Vietnamese',
  'my-MY':  'Malaysian',
  'id-ID':  'Indonesian',
  'global': 'Southeast Asian',
}

const AGE_PHRASE: Record<AgeRange, string> = {
  'gen-z':    'in her early 20s',
  'mid-20s':  'in her mid-20s',
  'mid-30s':  'in her mid-30s',
  'mid-40s':  'in her mid-40s',
  'older':    'in her late 50s',
  'mixed':    'of varied age',
}

const GENDER_PHRASE: Record<Gender, string> = {
  woman:  'woman',
  man:    'man',
  mixed:  'person',
}

function roleModifier(locale: UINativeLocale, role: Role): string {
  switch (role) {
    case 'customer':       return 'with a warm natural smile, looking like a real customer'
    case 'creator':        return 'with a TikTok-creator vibe, casual energy'
    case 'professional':   return locale === 'my-MY'
      ? 'wearing a clean professional white coat, calm authoritative presence'
      : 'wearing a clean professional outfit, calm authoritative presence'
    case 'family-member':  return 'with a warm relatable expression, household context'
    case 'office-worker':  return 'in smart-casual office attire, urban professional vibe'
    default:               return ''
  }
}

/** Whether the locale's market has hijab / modest-attire as a default
 *  cultural context. Caller can always override via opts.modestAttire. */
function defaultModestAttire(locale: UINativeLocale, gender: Gender): boolean {
  // my-MY market is majority Muslim — modest attire / hijab common in ads.
  // id-ID is also majority Muslim but split — only when explicitly opted in.
  // vi-VN + global default to no.
  return locale === 'my-MY' && gender === 'woman'
}

function attireBlurb(locale: UINativeLocale, gender: Gender): string {
  if (locale === 'my-MY' && gender === 'woman') {
    return 'wearing a hijab and modest casual attire (50% chance of hijab — sometimes uncovered hair, both authentic for Malaysia)'
  }
  if (locale === 'id-ID' && gender === 'woman') {
    return 'wearing modest casual Indonesian attire'
  }
  return ''
}

// ── Setting + lighting + device packs ────────────────────────────────

type Setting =
  | 'casual-home'      // living room / general home interior
  | 'kitchen-morning'  // kitchen counter, morning sun through window
  | 'bathroom-routine' // marble bathroom, soft warm light
  | 'cafe-urban'       // cafe table, ambient + window backlight
  | 'office-desk'      // office / coworking, daylight
  | 'bedroom-vanity'   // bedroom / dresser, ring-light or window
  | 'studio-clean'     // seamless near-white studio
  | 'clinic-clean'     // clinic / consultation room, soft fill

export function settingPack(setting: Setting, locale: UINativeLocale): string {
  // Locale flavor: small touches that differentiate Malaysia / Indonesia /
  // Vietnam interiors (eg "a small Islamic decorative element on the wall"
  // in my-MY, "Tết Vietnamese decoration in background" sometimes for vi-VN).
  // Keep subtle — model handles obvious cues.
  switch (setting) {
    case 'casual-home':
      return 'in a casual indoor home setting with natural window light, lived-in not staged'
    case 'kitchen-morning':
      return 'on a kitchen counter with morning sunlight streaming through a window, slightly lived-in'
    case 'bathroom-routine':
      return 'on a clean white marble bathroom counter with neatly folded towels, soft warm morning light'
    case 'cafe-urban':
      return 'at a cafe table with cappuccino and laptop or notebook, ambient cafe light plus warm window backlight'
    case 'office-desk':
      return 'at an office or coworking desk with daylight from a side window'
    case 'bedroom-vanity':
      return 'at a bedroom vanity / dresser setup, with a ring-light reflection visible in the eyes' + (locale === 'my-MY' ? ', subtle Malaysian home decor in the background' : '')
    case 'studio-clean':
      return 'against a seamless near-white studio backdrop, even softbox lighting'
    case 'clinic-clean':
      return 'in a clean clinic or consultation room, soft balanced professional lighting'
    default:
      return ''
  }
}

// ── Phone / device + UGC authenticity feel ───────────────────────────

type CaptureMode = 'selfie' | 'handheld' | 'tripod' | 'macro' | 'split-frame'

/** UGC phone-screenshot authenticity directive. Matches the
 *  Ladipage "taking a selfie with an iPhone" + "UGC quality" pattern. */
export function screenshotFeel(mode: CaptureMode): string {
  switch (mode) {
    case 'selfie':
      return 'taking a selfie with an iPhone, UGC quality with slight JPEG compression and natural phone-camera imperfections'
    case 'handheld':
      return 'handheld smartphone framing, casual UGC quality, slight natural shake feel'
    case 'tripod':
      return 'tripod-mounted DSLR feel, sharp and clean, ecommerce-ready'
    case 'macro':
      return 'macro close-up smartphone capture, shallow depth of field, sharp focal point'
    case 'split-frame':
      return 'split-frame composition shot on tripod, identical framing both halves, authentic amateur quality not pro-studio'
    default:
      return ''
  }
}

// ── Designed text overlay layouts ────────────────────────────────────

type OverlayLayout =
  | 'hero-hook'           // big condensed headline + 3 emoji badges + arrow
  | 'pain-italic'         // italic urgent text on dark glassmorphism panel
  | 'ingredient-card'     // clean card with icon + benefit
  | 'comparison-table'    // 2-column vs table
  | 'final-cta-metrics'   // product + halo of metric chips
  | 'before-after-labels' // SEBELUM / SELEPAS labels on split-frame

export interface OverlayOpts {
  /** Main headline text in the target locale. Quoted EXACTLY in the prompt. */
  headline?: string
  /** 2-3 short badges with emoji prefix. */
  badges?: string[]
  /** Locale for fallback labels (SEBELUM/SELEPAS vs TRƯỚC/SAU). */
  locale: UINativeLocale
}

export function designedOverlay(layout: OverlayLayout, opts: OverlayOpts): string {
  switch (layout) {
    case 'hero-hook': {
      const headlineSnippet = opts.headline
        ? `BIG bold condensed main hook headline at the top reads "${opts.headline}" in white with a subtle glow.`
        : 'BIG bold condensed main hook headline at the top in white with a subtle glow.'
      const badgesSnippet = opts.badges?.length
        ? `Below, ${opts.badges.length} glassmorphism rounded badges with emoji prefix: ${opts.badges.map((b) => `"${b}"`).join(', ')}.`
        : 'Below, 3 glassmorphism rounded badges each with an emoji prefix.'
      return [
        'DESIGNED text overlay with multi-layer hierarchy:',
        headlineSnippet,
        badgesSnippet,
        'A small decorative arrow sticker points toward the product.',
      ].join(' ')
    }
    case 'pain-italic': {
      const inner = opts.headline ? `reads "${opts.headline}"` : ''
      return `Italic slanted ${LANG_NAME[opts.locale]} overlay on a rounded dark glass panel ${inner}, with a subtle warning-color glow and a small decorative arrow pointing to the affected area.`
    }
    case 'ingredient-card':
      return 'Clean ingredient card layout — prominent emoji or icon at top, ingredient name in bold mid-line, brief benefit line below. Subtle gradient background.'
    case 'comparison-table': {
      const ours = opts.locale === 'vi-VN' ? 'SẢN PHẨM' : opts.locale === 'my-MY' ? 'PRODUK' : opts.locale === 'id-ID' ? 'PRODUK' : 'OURS'
      const others = opts.locale === 'vi-VN' ? 'CÒN LẠI' : opts.locale === 'my-MY' ? 'LAIN' : opts.locale === 'id-ID' ? 'LAINNYA' : 'OTHERS'
      return `Two-column comparison table. Left column "${ours}" with vibrant emerald background and green checkmarks. Right column "${others}" with gray background and red X marks. Rows compare key attributes. Bold mobile-readable typography.`
    }
    case 'final-cta-metrics': {
      const headline = opts.headline ? `Headline text reads "${opts.headline}".` : ''
      const badges = opts.badges?.length
        ? `Floating metric chips around the product: ${opts.badges.map((b) => `"${b}"`).join(', ')}.`
        : 'Floating metric chips around the product (star rating, customer count, trust badge).'
      return `Last-scroll-stopper layout — product packaging centered with a subtle glow halo. ${badges} ${headline} Clear CTA button shape included.`.trim()
    }
    case 'before-after-labels': {
      const before = opts.locale === 'vi-VN' ? 'TRƯỚC' : opts.locale === 'my-MY' ? 'SEBELUM' : opts.locale === 'id-ID' ? 'SEBELUM' : 'BEFORE'
      const after  = opts.locale === 'vi-VN' ? 'SAU'   : opts.locale === 'my-MY' ? 'SELEPAS' : opts.locale === 'id-ID' ? 'SESUDAH' : 'AFTER'
      return `Small "${before}" / "${after}" labels at the bottom edge of each half, clean ${LANG_NAME[opts.locale]} typography.`
    }
    default:
      return ''
  }
}

const LANG_NAME: Record<UINativeLocale, string> = {
  'vi-VN':  'Vietnamese',
  'my-MY':  'Bahasa Melayu',
  'id-ID':  'Bahasa Indonesia',
  'global': 'English',
}

// ── Price-lock pattern ───────────────────────────────────────────────

/** Extract the first plausible price token from a free-text offer
 *  string. Returns e.g. "RM59" / "199.000đ" / "$19.99" or null. */
export function extractPriceToken(offer: string | null | undefined): string | null {
  if (!offer) return null
  // Common SEA price formats — currency-prefixed OR thousand-grouped + "đ"
  const m = offer.match(
    /(?:RM|Rp|S\$|HK\$|\$|US\$|VND|IDR|MYR)\s*[\d,.]+(?:\s*(?:k|K|nghìn))?|[\d,.]+\s*đ|[\d,.]+\s*(?:VNĐ|VND)/,
  )
  return m ? m[0].trim() : null
}

/** Emits the "(show only RM59)" price-lock directive when the offer has a
 *  numeric price token. Prevents the model from inventing prices. */
export function priceLockDirective(offer: string | null | undefined): string {
  const token = extractPriceToken(offer)
  if (!token) return ''
  return `The EXACT product price "${token}" is clearly displayed. (show only "${token}" — do NOT invent any other price)`
}

// ── Cultural anchor cues (subtle) ────────────────────────────────────

export function culturalCueByLocale(locale: UINativeLocale): string {
  switch (locale) {
    case 'my-MY':
      return 'Authentic Malaysian household context — natural mix of Malay-Muslim cultural cues acceptable but not exaggerated (kuih on a side table, prayer mat folded in corner, Halal-compliant setting).'
    case 'id-ID':
      return 'Authentic Indonesian household context — natural Indonesian cues acceptable (tropical interior, batik accent, modest casual lifestyle).'
    case 'vi-VN':
      return 'Authentic Vietnamese household context — natural Vietnamese cues acceptable (subtle Tết or family-altar accent only when seasonally relevant, ao dai never as default daily wear).'
    case 'global':
      return 'Generic Southeast Asian / international context, no strong cultural anchor.'
  }
}
