import type {
  LandingGenParams, LandingPagePack, LandingSection, ImagePrompt,
  ProductIdentity, ImageSlotConcept, SectionSpec,
} from '../types'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { getPresetSpec } from '../prompts/presetSpecs'
import { buildSystemPromptPackGen } from '../prompts/systemPromptPackGen'
import { extractProductIdentity } from './extractProductIdentity'
import { translatePackToVi } from './translate'
import { assembleImagePrompt } from '../assembler/assembleImagePrompt'
import { semanticGateScan } from '../assembler/semanticGate'
import { textGenWithFallback } from './textGenWithFallback'

/** Timeout cho text gen lớn (pack 17 section). Output có thể tới ~16K
 *  token, Gemini 2.5 Flash sinh ~200 token/s → ~80s. Cho 150s safety. */
const PACK_GEN_TIMEOUT_MS = 150_000

// ─────────────────────────────────────────────────────────────────────
// Super Ladipage — Pass 1 orchestrator.
//
// Pipeline:
//   1. Resolve product + API key
//   2. extractProductIdentity (Gemini Vision, 1 lần)
//   3. Gen pack text + image concepts (Gemini text, JSON mode)
//   4. Semantic gate scan — fail → retry max 2x với feedback
//   5. Translate pack → VN (Gemini text)
//   6. Assemble image prompts (pure code, deterministic)
//   7. Return LandingPagePack (status: copy-ready, ảnh chưa sinh)
// ─────────────────────────────────────────────────────────────────────

/** Raw output từ Gemini text gen — chưa qua assembler. */
interface RawPackOutput {
  sections: Array<{
    type:        string
    title:       string
    layoutGuide?: string
    copy:        string
    headline?:   string
    subheadline?: string
    cta?:        string
    offerStrip?: string
    urgencyText?: string
    bullets?:    string[]
    faqs?:       Array<{ question: string; answer: string }>
    reviews?:    Array<{ author: string; quote: string; meta?: string; rating?: number }>
    comparisonData?: {
      us: { title: string; bullets: string[] }
      them: { title: string; bullets: string[] }
    }
    imagePrompts: Array<{
      filename:    string
      style:       string
      aspectRatio: string
      concept:     ImageSlotConcept
    }>
  }>
}

function stripFences(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  return t
}

function parseRawPack(raw: string): RawPackOutput {
  const cleaned = stripFences(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Pack JSON parse failed: ${err instanceof Error ? err.message : String(err)}. Raw start: ${cleaned.slice(0, 300)}`)
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { sections?: unknown }).sections)) {
    throw new Error(`Pack output missing "sections" array. Got keys: ${Object.keys(parsed as object).join(', ')}`)
  }
  return parsed as RawPackOutput
}

/** Convert RawPackOutput → LandingSection[] (apply concepts → assembled prompts later). */
function rawToSections(
  raw: RawPackOutput,
  identity: ProductIdentity,
  language: 'ms' | 'vi' | 'en',
): LandingSection[] {
  return raw.sections.map((s) => {
    const imagePrompts: (ImagePrompt & { __concept?: ImageSlotConcept })[] = s.imagePrompts.map((p) => {
      const assembled = assembleImagePrompt({
        identity,
        concept:  p.concept,
        language,
      })
      return {
        filename:     p.filename,
        prompt:       assembled,
        style:        p.style,
        aspectRatio:  p.aspectRatio,
        status:       'idle' as const,
        __concept:    p.concept,
      }
    })

    const section: LandingSection = {
      type:         s.type as LandingSection['type'],
      title:        s.title,
      copy:         s.copy,
      layoutGuide:  s.layoutGuide ?? '',
      headline:     s.headline,
      subheadline:  s.subheadline,
      cta:          s.cta,
      offerStrip:   s.offerStrip,
      urgencyText:  s.urgencyText,
      bullets:      s.bullets,
      faqs:         s.faqs,
      reviews:      s.reviews,
      imagePrompts,
      comparisonData: s.comparisonData,
    }
    return section
  })
}

/** Build specsBySectionType map cho semantic gate. */
function buildSpecsMap(preset: ReturnType<typeof getPresetSpec>): Map<string, SectionSpec> {
  const m = new Map<string, SectionSpec>()
  for (const s of preset.sections) m.set(s.type, s)
  return m
}

export async function generateLandingPack(params: LandingGenParams): Promise<LandingPagePack> {
  // ─── 1. Resolve product + API key ───
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) {
    throw new Error(`Không tìm thấy sản phẩm với id="${params.productId}". Vui lòng chọn lại sản phẩm.`)
  }

  const settings = useSettingsStore.getState()
  if (!settings.hasGeminiKey()) {
    throw new Error('Vui lòng nhập Google Gemini API key trong Cài đặt.')
  }
  if (!settings.hasApiKey()) {
    throw new Error('Vui lòng nhập kie.ai API key trong Cài đặt (cần để sinh ảnh sau bước này).')
  }
  const geminiKey = settings.getGeminiApiKey()
  const kieApiKey = settings.getApiKey()  // for KIE text fallback when Gemini overloaded
  const language  = params.language

  const form = params.form ?? 'ugc-malaysia'
  const preset = getPresetSpec(form)

  console.info(`[SuperLadipage] ═══ START — product="${product.productName}", preset=${form}, language=${language} ═══`)
  const totalStart = Date.now()

  // ─── 2. Extract ProductIdentity ───
  console.info(`[SuperLadipage] STAGE 1/4 — extracting ProductIdentity via Gemini Vision...`)
  const identity = await extractProductIdentity({
    apiKey:       geminiKey,
    product,
    visualMemory: params.visualMemory ?? [],
    language,
  })
  console.info(`[SuperLadipage] STAGE 1/4 DONE — identity OK: category="${identity.productCategory}", name="${identity.productNameExact}"`)

  // ─── 3+4. Gen pack text + Semantic gate (max 2 retry) ───
  console.info(`[SuperLadipage] STAGE 2/4 — generating pack text + image concepts...`)
  const systemPrompt = buildSystemPromptPackGen({
    identity,
    preset,
    language,
    competitorUrl: params.competitorUrl,
  })
  const specsMap = buildSpecsMap(preset)

  let lastError: Error | null = null
  let validPack: LandingPagePack | null = null
  let feedbackForRetry = ''

  for (let attempt = 1; attempt <= 3; attempt++) {
    const startedAt = Date.now()
    try {
      const userPrompt = attempt === 1
        ? 'Generate the landing pack JSON now.'
        : `Previous attempt had these issues:\n${feedbackForRetry}\n\nFix them and regenerate the FULL pack JSON.`

      console.log(`[SuperLadipage] pack gen attempt ${attempt}/3 — calling text gen (Gemini → KIE fallback, timeout ${PACK_GEN_TIMEOUT_MS / 1000}s)...`)

      const raw = await textGenWithFallback({
        geminiApiKey:       geminiKey,
        kieApiKey,
        prompt:             userPrompt,
        systemInstruction:  systemPrompt,
        jsonMode:           true,
        maxOutputTokens:    16384,
        timeoutMs:          PACK_GEN_TIMEOUT_MS,
        label:              `pack-gen-${attempt}`,
      })

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      console.log(`[SuperLadipage] pack gen attempt ${attempt}/3 — text returned ${raw.length} chars in ${elapsed}s, parsing JSON...`)

      const parsed = parseRawPack(raw)
      const sections = rawToSections(parsed, identity, language)

      // Semantic gate scan
      const issues = semanticGateScan(
        {
          sections: sections.map((s) => ({
            type: s.type,
            imagePrompts: s.imagePrompts.map((p) => ({
              filename: p.filename,
              __concept: (p as ImagePrompt & { __concept?: ImageSlotConcept }).__concept,
            })),
          })),
        },
        identity,
        specsMap,
      )

      if (issues.length === 0) {
        // Strip __concept (internal) trước khi return ra UI
        const cleanSections = sections.map((s) => ({
          ...s,
          imagePrompts: s.imagePrompts.map((p) => {
            const { ...rest } = p as ImagePrompt & { __concept?: ImageSlotConcept }
            delete (rest as Record<string, unknown>).__concept
            return rest as ImagePrompt
          }),
        }))

        const pack: LandingPagePack = {
          productId:     product.id,
          productName:   product.productName || identity.productNameExact,
          language,
          sections:      cleanSections,
          visualMemory:  params.visualMemory ?? [],
          generatedAt:   Date.now(),
          form,
          productPackagingDescription: identity.packagingDescription,
        }
        validPack = pack
        console.info(`[SuperLadipage] STAGE 2/4 DONE — pack gen OK on attempt ${attempt} (${pack.sections.length} sections, ${pack.sections.reduce((sum, s) => sum + s.imagePrompts.length, 0)} image prompts)`)
        break
      }

      // Issues found → build feedback for retry
      feedbackForRetry = issues.slice(0, 8).map((iss) =>
        `- Section ${iss.sectionIdx + 1}${iss.imageIdx >= 0 ? `, image ${iss.imageIdx + 1}` : ''}: ${iss.issue}. Fix: ${iss.remedy}`,
      ).join('\n')
      console.warn(`[SuperLadipage] semantic gate failed on attempt ${attempt} — ${issues.length} issues. Retrying...`)
      lastError = new Error(`Semantic gate issues:\n${feedbackForRetry}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[SuperLadipage] attempt ${attempt}/3 errored: ${lastError.message.slice(0, 200)}`)
      feedbackForRetry = lastError.message
    }
  }

  if (!validPack) {
    throw new Error(
      `Tạo landing pack thất bại sau 3 lần thử. Lỗi cuối: ${lastError?.message ?? 'không rõ'}`,
    )
  }

  // ─── 5. Translate pack → VN ───
  if (language === 'vi') {
    console.info('[SuperLadipage] STAGE 3/4 SKIP — language already VN')
  } else {
    console.info('[SuperLadipage] STAGE 3/4 — translating pack → VN...')
    try {
      validPack = await translatePackToVi({
        apiKey:       geminiKey,
        kieApiKey,
        pack:         validPack,
        fromLanguage: language,
      })
      console.info('[SuperLadipage] STAGE 3/4 DONE — translation OK')
    } catch (err) {
      console.warn('[SuperLadipage] STAGE 3/4 FAILED — pack returned without VN translation', err)
      // KHÔNG block pack — user vẫn có copy native, chỉ thiếu dịch VN
    }
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)
  console.info(`[SuperLadipage] ═══ COMPLETE in ${totalElapsed}s — returning pack to UI ═══`)
  return validPack
}
