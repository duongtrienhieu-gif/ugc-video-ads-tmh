import type { LandingPagePack, LandingLanguage } from '../types'
import { directGeminiText } from '../../../utils/gemini'
import { withTimeout } from './withTimeout'

const TRANSLATE_TIMEOUT_MS = 90_000

// ─────────────────────────────────────────────────────────────────────
// Translate pack native → VN.
//
// 1 call duy nhất / pack. Gemini nhận pack JSON (rút gọn về fields cần
// dịch) → trả về object dịch song song. Code apply lại vào pack.
//
// Strategy: tách field cần dịch ra path-keyed object để dễ apply lại
// và tránh nhầm lẫn (vd pack.sections[0].headline → key "s0.headline").
// ─────────────────────────────────────────────────────────────────────

interface TranslateSource {
  [pathKey: string]: string
}

function collectFieldsToTranslate(pack: LandingPagePack): TranslateSource {
  const out: TranslateSource = {}

  pack.sections.forEach((s, i) => {
    const prefix = `s${i}`
    if (s.title)        out[`${prefix}.title`]        = s.title
    if (s.copy)         out[`${prefix}.copy`]         = s.copy
    if (s.headline)     out[`${prefix}.headline`]     = s.headline
    if (s.subheadline)  out[`${prefix}.subheadline`]  = s.subheadline
    if (s.cta)          out[`${prefix}.cta`]          = s.cta
    if (s.offerStrip)   out[`${prefix}.offerStrip`]   = s.offerStrip
    if (s.urgencyText)  out[`${prefix}.urgencyText`]  = s.urgencyText
    s.bullets?.forEach((b, bi) => { out[`${prefix}.bullets[${bi}]`] = b })
    s.faqs?.forEach((f, fi) => {
      out[`${prefix}.faqs[${fi}].question`] = f.question
      out[`${prefix}.faqs[${fi}].answer`]   = f.answer
    })
    s.reviews?.forEach((r, ri) => {
      out[`${prefix}.reviews[${ri}].quote`] = r.quote
    })
  })

  return out
}

function applyTranslations(pack: LandingPagePack, translations: TranslateSource): LandingPagePack {
  const next: LandingPagePack = {
    ...pack,
    sections: pack.sections.map((s) => ({ ...s })),
  }

  Object.entries(translations).forEach(([key, value]) => {
    const m = key.match(/^s(\d+)\.(.+)$/)
    if (!m) return
    const sIdx = Number(m[1])
    const sub = m[2]
    const sec = next.sections[sIdx]
    if (!sec) return

    if (sub === 'title')             sec.titleVi             = value
    else if (sub === 'copy')         sec.viTranslation       = value
    else if (sub === 'headline')     sec.headlineVi          = value
    else if (sub === 'subheadline')  sec.subheadlineVi       = value
    else if (sub === 'cta')          sec.ctaVi               = value
    else if (sub === 'offerStrip')   sec.offerStripVi        = value
    else if (sub === 'urgencyText')  sec.urgencyTextVi       = value
    else if (sub.startsWith('bullets[')) {
      const bi = Number(sub.match(/\[(\d+)\]/)?.[1] ?? -1)
      if (bi >= 0) {
        if (!sec.bulletsVi) sec.bulletsVi = sec.bullets ? [...sec.bullets] : []
        sec.bulletsVi[bi] = value
      }
    }
    // FAQs + reviews: chỉ dịch (in-place override OK vì không có UI bilingual cho 2 cái này)
  })

  return next
}

export async function translatePackToVi(args: {
  apiKey: string
  pack: LandingPagePack
  fromLanguage: LandingLanguage
}): Promise<LandingPagePack> {
  // Nếu đã là VN → bỏ qua (just copy native → vi để UI không hiển thị toggle)
  if (args.fromLanguage === 'vi') {
    const next: LandingPagePack = {
      ...args.pack,
      sections: args.pack.sections.map((s) => ({
        ...s,
        titleVi:        s.title,
        viTranslation:  s.copy,
        headlineVi:     s.headline,
        subheadlineVi:  s.subheadline,
        ctaVi:          s.cta,
        offerStripVi:   s.offerStrip,
        urgencyTextVi:  s.urgencyText,
        bulletsVi:      s.bullets,
      })),
    }
    return next
  }

  const source = collectFieldsToTranslate(args.pack)
  const sourceKeys = Object.keys(source)
  if (sourceKeys.length === 0) return args.pack

  const fromName = args.fromLanguage === 'ms' ? 'Bahasa Melayu' : 'English'

  const systemPrompt = `
You are a marketing copy translator for Vietnamese (Tiếng Việt) audience.

TASK: Translate each field below from ${fromName} to Vietnamese (Tiếng Việt).

RULES:
1. Translate MEANING, not word-by-word. Output natural Vietnamese marketing copy.
2. KEEP brand names, product names, prices, certifications (HALAL, KKM, etc), and ALL-CAPS proper nouns verbatim. Do NOT translate them.
3. Keep emojis ✅⚡❤️🔥 etc as-is.
4. Output JSON ONLY: { "<key>": "<vietnamese translation>" } — same keys as input.
5. No commentary, no markdown fences.
`.trim()

  const userPrompt = `
Translate these fields to Vietnamese. Output JSON only:

${JSON.stringify(source, null, 2)}
`.trim()

  console.log(`[translate] ${sourceKeys.length} fields → VN, timeout ${TRANSLATE_TIMEOUT_MS / 1000}s...`)
  const raw = await withTimeout(
    directGeminiText({
      apiKey: args.apiKey,
      prompt: userPrompt,
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      maxOutputTokens: 16384,
    }),
    TRANSLATE_TIMEOUT_MS,
    '[translate]',
  )
  console.log(`[translate] Gemini returned ${raw.length} chars`)

  // Strip fences just in case
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.warn('[translate] JSON parse failed — returning original pack', err)
    return args.pack
  }

  if (!parsed || typeof parsed !== 'object') return args.pack
  const translations = parsed as TranslateSource

  return applyTranslations(args.pack, translations)
}
