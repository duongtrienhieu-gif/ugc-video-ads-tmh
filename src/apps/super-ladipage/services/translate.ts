import type { LandingPagePack, LandingLanguage } from '../types'
import { textGenWithFallback } from './textGenWithFallback'

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
  kieApiKey: string
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

  // Retry 2x — JSON parse fail hoặc translate call lỗi sẽ retry với fresh call.
  // Pattern này khớp với pack gen retry, đảm bảo translate không silent fail.
  const MAX_ATTEMPTS = 2
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[translate] attempt ${attempt}/${MAX_ATTEMPTS} — ${sourceKeys.length} fields → VN, timeout ${TRANSLATE_TIMEOUT_MS / 1000}s (Gemini → KIE fallback)...`)
    try {
      const raw = await textGenWithFallback({
        geminiApiKey:      args.apiKey,
        kieApiKey:         args.kieApiKey,
        prompt:            userPrompt,
        systemInstruction: systemPrompt,
        jsonMode:          true,
        maxOutputTokens:   16384,
        timeoutMs:         TRANSLATE_TIMEOUT_MS,
        label:             `translate-${attempt}`,
      })
      console.log(`[translate] attempt ${attempt} returned ${raw.length} chars, parsing JSON...`)

      // Strip fences just in case
      let cleaned = raw.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
      }

      const parsed = JSON.parse(cleaned)
      if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Translate output không phải object — type=${typeof parsed}`)
      }
      const translations = parsed as TranslateSource

      // Validate ít nhất 50% keys translated (defense vs silent partial fail)
      const translatedKeys = Object.keys(translations).filter((k) => sourceKeys.includes(k))
      const coverageRatio = translatedKeys.length / sourceKeys.length
      if (coverageRatio < 0.5) {
        throw new Error(`Translate coverage chỉ ${Math.round(coverageRatio * 100)}% (${translatedKeys.length}/${sourceKeys.length} keys) — quá thấp, retry`)
      }

      console.log(`[translate] ✓ attempt ${attempt} OK — ${translatedKeys.length}/${sourceKeys.length} fields translated (${Math.round(coverageRatio * 100)}%)`)
      return applyTranslations(args.pack, translations)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[translate] attempt ${attempt}/${MAX_ATTEMPTS} FAILED: ${lastError.message.slice(0, 200)}`)
    }
  }

  // Cả 2 attempt fail → throw để orchestrator catch + toast error (KHÔNG silent)
  throw new Error(
    `Dịch sang tiếng Việt thất bại sau ${MAX_ATTEMPTS} lần thử. ` +
    `Lỗi cuối: ${lastError?.message ?? 'không rõ'}. ` +
    `Pack copy gốc vẫn dùng được, chỉ thiếu bản dịch VN — bấm tạo lại để retry.`,
  )
}
