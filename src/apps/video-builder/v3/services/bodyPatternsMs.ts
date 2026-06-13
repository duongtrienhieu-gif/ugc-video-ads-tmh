// ── Malaysia Body Patterns (P3n) ─────────────────────────────────────────────
// Lang-specific vocabulary the body prompt / validator pick up when lang='ms'.
// User-curated MS Cultural Layer V1 + the openers/closers/forbidden additions,
// plus a symptom-ban list curated against the VN list in adStructures so the
// INSTANT-group symptomBans rule works the same way on MS scripts.
//
// All lists are PLAIN STRINGS — no templates. They are used either as inline
// vocabulary hints in the body system prompt (when lang='ms') or as substring
// match keys in scriptValidator.ts (CTA lever check, anti-pattern check,
// symptom-ban check).
// ─────────────────────────────────────────────────────────────────────────────

/** MS CTA buying levers — match scriptValidator's CTA_LEVER_KEYWORDS_VI. The
 *  body validator passes the CTA block when AT LEAST ONE of these substrings
 *  appears. The hard 25 from Cultural Layer V1 + soft closers from the natural
 *  closers list (good for LEAD-tone CTAs that shouldn't bark "grab cepat"). */
export const MS_CTA_LEVERS: string[] = [
  // ── HARD levers (Cultural Layer V1) ─────────────────────────────────────
  'stok terhad', 'grab cepat', 'jangan tunggu lama', 'sementara stok masih ada',
  'promo hari ni', 'ramai dah cuba', 'ramai repeat order', 'best seller',
  'viral dekat tiktok', '5 bintang', 'review padu', 'worth it',
  'memang berbaloi', 'jimat', 'limited stock', 'official store',
  'guaranteed original', 'refund available', 'tukar jika rosak', 'fast shipping',
  'trusted seller', 'hot selling', 'harga promo', 'lebih ramai pilih', 'laku keras',
  // ── SOFT closers (natural for LEAD-tone CTA) ─────────────────────────────
  'korang nilai sendiri', 'cuma share pengalaman', 'tak rugi cuba',
  'ramai dah guna', 'kalau nak grab', 'jangan tunggu sampai habis',
  'repeat order', 'worth it bagi aku', 'harap membantu',
]

/** MS body anti-patterns — drift detectors equivalent to VN's bodyAntiPatterns.
 *  The validator checks no BODY BLOCK opens with any of these (the WRONG-group's
 *  default opener). Merged V1 list + the 10 natural openers (de-duped). */
export const MS_BODY_ANTI_PATTERNS: string[] = [
  // ── Drift openers (would push INSTANT script into Problem-Solution) ──────
  'awak pernah tak', 'korang pernah tak', 'dulu aku ada masalah',
  'dah lama korang', 'korang ada tak masalah ni', 'awak ada masalah',
  // ── Generic narrative drift to AVOID at block opening ────────────────────
  // (These ARE valid mid-sentence — only banned as the FIRST 80 chars opener.)
  'aku skeptikal mula-mula',
]

/** MS body NATIVE phrasing palette — injected as a vocabulary hint in the body
 *  system prompt so Gemini varies cadence instead of writing textbook BM. NOT
 *  banned by the validator; this is encouragement, not enforcement. */
export const MS_NATIVE_OPENERS: string[] = [
  'Serious la', 'Korang', 'Eh wait', 'Aku nak share sikit', 'Tak sangka',
  'Gila weh', 'Jujur cakap', 'Aku baru sedar', 'Patutlah', 'Rupanya',
  'Aku dulu fikir', 'Aku ingat', 'Memang jadi', 'Aku betul-betul ingat',
  'Sekali cuba', 'Aku pun terkejut', 'Baru aku sedar', 'Tak hairanlah',
]

/** MS story connectors — "pastu / sekali / rupanya / patutlah" etc. Gemini
 *  injects these between ideas instead of literal-translating VN "rồi / sau đó". */
export const MS_TRANSITIONS: string[] = [
  'lepas tu', 'pastu', 'sekali', 'rupanya', 'baru aku sedar', 'patutlah',
  'tak hairanlah', 'lagi satu', 'yang bestnya', 'yang paling penting',
  'masalahnya', 'cuba bayangkan', 'sebab tu', 'jadi sekarang', 'mula-mula',
  'selepas beberapa hari', 'bila dah cuba', 'akhirnya', 'pendek cerita',
  'senang cerita',
]

/** MS daily-life contexts — concrete point-of-contact moments grounded in
 *  Malaysian routine. Gemini picks one when the POINT-OF-CONTACT universal rule
 *  fires, so the script feels lived in Malaysia (not a generic Asian TikTok). */
export const MS_DAILY_CONTEXTS: string[] = [
  'bangun pagi', 'sebelum tidur', 'lepas bangun tidur', 'aircond semalaman',
  'tengah kerja', 'balik kerja', 'lunch break', 'dalam kereta', 'masa jem',
  'weekend', 'selepas gym', 'selepas jogging', 'musim hujan', 'cuaca panas',
  'selepas mandi', 'dekat office', 'tengah study', 'malam-malam', 'masa travel',
  'masa cuti', 'anak balik sekolah', 'selepas makan', 'sebelum keluar rumah',
  'masa shopping', 'selepas seharian bekerja', 'masa urus anak', 'masa memasak',
  'selepas bersukan', 'masa tengok TV', 'waktu rehat',
]

/** MS sensory words split by product niche (matches the SENSORY MOMENT universal
 *  rule's per-niche dimension list). The body prompt injects the niche-relevant
 *  bucket so Gemini stops translating "giòn rụm" → "rangup" with the wrong cadence. */
export const MS_SENSORY_HEALTH: string[] = [
  'lega', 'lapang', 'selesa', 'ringan', 'segar', 'senang bernafas',
  'lebih tenang', 'lebih nyaman', 'rasa better', 'kurang ganggu',
]

export const MS_SENSORY_SKINCARE: string[] = [
  'tak melekit', 'cepat serap', 'ringan atas kulit', 'kulit rasa lembut',
  'kulit rasa segar', 'tak berminyak', 'rasa smooth', 'nampak sihat',
  'lebih hydrated', 'selesa dipakai',
]

export const MS_SENSORY_FOOD: string[] = [
  'rangup', 'garing', 'juicy', 'lembut', 'sedap gila', 'cair dalam mulut',
  'fresh', 'tak muak', 'wangi', 'padu',
]

export const MS_SENSORY_HOME: string[] = [
  'bersih berkilat', 'nampak macam baru', 'tak berbau', 'lebih kemas',
  'lebih selesa', 'mudah guna', 'senang cuci', 'tak renyah', 'praktikal',
  'memang membantu',
]

/** MS social-proof phrasing — preferred over literal translations like
 *  "10000 nguoi da mua" → "10000 orang dah beli" (feels textbook). */
export const MS_SOCIAL_PROOF: string[] = [
  'ramai dah cuba', 'ramai repeat order', 'review memang padu',
  '5 bintang banyak', 'dah lebih 10k orang guna', 'seller paling laku',
  'viral dekat TikTok', 'orang recommend', 'customer puas hati',
  'antara yang paling popular',
]

/** MS objection-handling phrasing — the "I was skeptical too" beat in native
 *  Malaysian register. Gemini uses these to lower viewer skepticism naturally. */
export const MS_OBJECTION: string[] = [
  'aku ingat scam', 'aku skeptikal mula-mula', 'aku tak percaya sangat',
  'takut tak jadi', 'risau bazir duit', 'risau tak sesuai',
  'ingat marketing je', 'ingat biasa-biasa', 'aku pun ragu-ragu',
  'aku fikir sama je macam yang lain',
]

/** MS symptom bans for INSTANT pain block — equivalent to VN list in
 *  adStructures.SYMPTOM_BANS_INSTANT. The body validator hard-bans these
 *  substrings in the pain block of an INSTANT-group MS script (the pain block
 *  is a 1-sentence transition tied to the hook, NOT a symptom report).
 *  Curated from the VN list ("đau dạ dày" → "sakit perut", "mệt mỏi" → "penat", …). */
export const MS_SYMPTOM_BANS_INSTANT: string[] = [
  'sakit perut', 'pedih perut', 'sakit kepala', 'pening kepala', 'pening',
  'loya', 'penat', 'lemah', 'letih', 'habis tenaga', 'tak fokus',
  'hilang fokus', 'tak selesa', 'serabut', 'kembung', 'perut buncit',
  'masam tekak', 'sembelit', 'tak boleh tidur', 'insomnia', 'tegang',
  'tertekan', 'kulit rosak', 'kulit teruk', 'muka kusam', 'kulit cedera',
  'rambut gugur', 'botak', 'rambut patah', 'lesu', 'mengantuk',
  'kurang fokus',
]

/** MS forbidden style — the "what NOT to write" rules. Brain has a universal
 *  spoken-not-written rule already; this adds the MS-specific gaps (textbook BM,
 *  direct VN translation, formal TV-commercial tone). Injected as a forbidden
 *  list in the body prompt when lang='ms'. */
export const MS_FORBIDDEN_STYLE: string[] = [
  'textbook Bahasa Malaysia (formal / sekolah register)',
  'corporate advertising tone',
  'long educational explanations',
  'excessive product specifications',
  'direct translation from Vietnamese (e.g. "ban có hay" → "awak ada", "kẻo hết" → "supaya tidak habis")',
  'too many formal words ("anda" / "saudara" / "kami selaku")',
  'sounding like a TV commercial',
]

/** Pick a sensory bucket by rough product niche key. The body prompt passes the
 *  detected niche so Gemini gets the RELEVANT bucket inline, not all 4. */
export function pickMsSensoryBucket(nicheHint: string | undefined): string[] {
  const k = (nicheHint ?? '').toLowerCase()
  if (/(food|drink|snack|makan|minum|kuih|biskut|coklat)/.test(k)) return MS_SENSORY_FOOD
  if (/(skin|kulit|cosmetic|kecantikan|serum|cream|moisturiser)/.test(k)) return MS_SENSORY_SKINCARE
  if (/(home|kitchen|appliance|rumah|dapur|alat)/.test(k)) return MS_SENSORY_HOME
  if (/(health|wellness|supplement|tpcn|kesihatan|vitamin)/.test(k)) return MS_SENSORY_HEALTH
  return MS_SENSORY_FOOD   // default — food is the most TikTok Shop volume on MY
}

/** Render the inline MS vocabulary block for the body system prompt. Pure data
 *  — no instruction; the body prompt's universal rules already tell Gemini WHEN
 *  to use each (sensory beat / point-of-contact / CTA lever). This just supplies
 *  the native Malay vocabulary so Gemini doesn't fall back to translating VN. */
export function buildMsBodyVocabBlock(nicheHint?: string): string {
  const sensory = pickMsSensoryBucket(nicheHint)
  const lines: string[] = []
  lines.push('*** MS NATIVE VOCABULARY (use these instead of translating from Vietnamese) ***')
  lines.push(`- NATIVE OPENERS (sprinkle 1-2 in body): ${MS_NATIVE_OPENERS.slice(0, 10).join(', ')}.`)
  lines.push(`- STORY CONNECTORS (use as transitions): ${MS_TRANSITIONS.slice(0, 10).join(', ')}.`)
  lines.push(`- POINT-OF-CONTACT MOMENTS (pick 1 for the everyday-moment beat): ${MS_DAILY_CONTEXTS.slice(0, 14).join(', ')}.`)
  lines.push(`- SENSORY WORDS (this product niche): ${sensory.join(', ')}.`)
  lines.push(`- SOCIAL-PROOF PHRASING: ${MS_SOCIAL_PROOF.slice(0, 6).join(', ')}.`)
  lines.push(`- OBJECTION HANDLING (use 1 when reasonable): ${MS_OBJECTION.slice(0, 6).join(', ')}.`)
  lines.push(`- CTA LEVERS (use 1 near the close): ${MS_CTA_LEVERS.slice(0, 12).join(', ')}.`)
  lines.push('')
  lines.push('*** AVOID (would break the Malaysian TikTok creator voice) ***')
  for (const f of MS_FORBIDDEN_STYLE) lines.push(`  - ${f}`)
  lines.push('Target voice: "Real Malaysian TikTok creator talking to a friend."')
  return lines.join('\n')
}
