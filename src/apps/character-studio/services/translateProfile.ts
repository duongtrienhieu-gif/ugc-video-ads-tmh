// Translate a (Vietnamese) avatar profile to English just before the image
// prompt is built, so the operator reads/edits Vietnamese fields while the image
// model still gets a clean ENGLISH prompt (English = best descriptor fidelity).
//
// CRITICAL: nationality/ethnicity is preserved EXACTLY — "Phụ nữ Việt Nam" must
// stay "Vietnamese woman", never drift to another nationality. Structural values
// (aspectRatio) are skipped. If the profile is already English (no Vietnamese
// diacritics), no call is made. Cached by profile content.

import type { CharacterProfile } from '../types'
import { directGeminiText } from '../../../utils/gemini'

// Keys whose value drives LOGIC (not the visual prompt) — never translate.
const SKIP_KEYS = new Set(['aspectRatio'])

// Vietnamese diacritic detector — if no value has these, the profile is already
// English and we can skip the round-trip entirely.
const VN_RE = /[ăâêôơưđàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i

const cache = new Map<string, CharacterProfile>()
const inflight = new Map<string, Promise<CharacterProfile>>()

export async function translateProfileToEnglish(
  profile: CharacterProfile,
  geminiApiKey: string,
): Promise<CharacterProfile> {
  if (!geminiApiKey?.trim()) return profile

  const toTranslate: Record<string, string> = {}
  for (const [k, v] of Object.entries(profile)) {
    if (typeof v === 'string' && v.trim() !== '' && !SKIP_KEYS.has(k)) toTranslate[k] = v
  }
  if (Object.keys(toTranslate).length === 0) return profile
  // Already English → no call needed.
  if (!Object.values(toTranslate).some((v) => VN_RE.test(v))) return profile

  const key = JSON.stringify(toTranslate)
  const cached = cache.get(key)
  if (cached) return cached
  const pending = inflight.get(key)
  if (pending) return pending

  const promise = doTranslate(profile, toTranslate, geminiApiKey, key)
  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}

async function doTranslate(
  profile: CharacterProfile,
  toTranslate: Record<string, string>,
  geminiApiKey: string,
  key: string,
): Promise<CharacterProfile> {
  const prompt = `Translate each value below from Vietnamese into concise ENGLISH suitable for an AI image-generation prompt (describing a person for a UGC ad). Output ONLY a JSON object with the SAME keys.

Rules:
- The "ethnicity" value is the person's NATIONALITY — translate it EXACTLY and never change the nationality (e.g. "Phụ nữ Việt Nam" → "Vietnamese woman", "Phụ nữ Malaysia theo đạo Hồi" → "Malaysian Muslim woman"). This is critical.
- "Khăn trùm đầu Hồi giáo màu X" → "X-colored Islamic headscarf (hijab)".
- Use natural English visual descriptors; keep it short per field.
- Values already in English: keep as-is.

VALUES (Vietnamese):
${JSON.stringify(toTranslate)}`

  try {
    const raw = await directGeminiText({
      apiKey: geminiApiKey,
      prompt,
      responseMimeType: 'application/json',
      thinkingBudget: 0,
      maxOutputTokens: 2048,
    })
    const parsed = JSON.parse(
      raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''),
    ) as Record<string, unknown>

    const out: CharacterProfile = { ...profile }
    for (const k of Object.keys(toTranslate)) {
      const v = parsed[k]
      if (typeof v === 'string' && v.trim() !== '') out[k] = v
    }
    cache.set(key, out)
    return out
  } catch (err) {
    console.warn('[translateProfile] failed — using profile as-is (may be Vietnamese)', err)
    return profile
  }
}
