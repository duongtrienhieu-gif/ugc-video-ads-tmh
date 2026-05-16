import type {
  LandingGenParams, LandingPagePack, LandingSection, SectionType, LandingLanguage,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'

// ─────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — briefs Gemini as an elite Malaysian DTC advertorial
// copywriter. The 10-section structure is enforced via strict JSON
// output. layoutGuide must be Vietnamese; copy follows the chosen
// language; image prompts are always English (for downstream Gemini
// image-edit endpoints that expect English).
// ─────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite Malaysian DTC ecommerce media buyer and advertorial copywriter who has launched 200+ Facebook ads landing pages that scaled to RM 1M+ in revenue. You specialise in:
- Supplement / skincare / patch / health-product niches
- Malaysian Bahasa Melayu advertorial voice (NOT formal textbook Malay)
- Mobile-first, conversion-first landing page structure
- COD ecommerce psychology
- UGC + native ad aesthetics (NOT cinematic, NOT luxury, NOT studio)

You are NOT a website designer. You are a PERFORMANCE MARKETER who writes structured advertorial packs that get copy-pasted into Ladipage.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT JSON ONLY, no markdown fences, no commentary
═══════════════════════════════════════════════════════════════
{
  "language": "ms" | "vi" | "en",
  "sections": [ ...exactly 10 section objects in the order specified below... ]
}

Each section object has these fields. Include only those relevant to the section type — but ALWAYS include "type", "title", "copy", "layoutGuide", and "imagePrompts" (even if imagePrompts is []).

{
  "type": "hero" | "pain" | "why-happens" | "ingredients" | "social-proof" | "before-after" | "benefits" | "offer" | "faq" | "final-cta",
  "title": "Vietnamese heading shown in the UI",
  "copy": "main body copy in the chosen language, mobile-first formatted with line breaks + emojis",
  "layoutGuide": "VIETNAMESE guidance for the user — describe how to arrange this section in Ladipage (block widths, image positions, CTA placement)",
  "headline": "optional headline (hero, final-cta)",
  "subheadline": "optional",
  "cta": "optional CTA button text in chosen language",
  "offerStrip": "optional offer-strip text (hero, offer)",
  "urgencyText": "optional urgency line",
  "bullets": ["optional bullet list — benefits section"],
  "faqs": [{"question":"...","answer":"..."}],
  "reviews": [{"author":"...","quote":"...","meta":"optional","rating":5}],
  "imagePrompts": [
    {
      "filename": "hero_01.jpg",
      "prompt": "English image-generation prompt, 30-60 words",
      "style": "Malaysia UGC native | WhatsApp screenshot | Ingredient card infographic | Before-after photo | Promo banner",
      "aspectRatio": "4:5 | 1:1 | 9:16 | 16:9"
    }
  ],
  "imageSizeHint": "optional layout hint like 'Full-width on mobile, max 720px tall'"
}

═══════════════════════════════════════════════════════════════
SECTION SPEC — produce EXACTLY these 10, in this order
═══════════════════════════════════════════════════════════════
1. type="hero" — Mở đầu chốt scroll
   • headline (scroll-stopping, addresses pain), subheadline, cta, offerStrip, urgencyText
   • copy: 2-3 short paragraphs reinforcing the headline
   • 1 imagePrompt: Malaysian woman holding the product, natural indoor light, iPhone-selfie feel, NOT studio. 4:5.

2. type="pain" — Đau cảm xúc
   • copy: emotional pain agitation, mobile-first paragraphs with emojis
   • 2 imagePrompts: 1 relatable suffering moment (face / hand on stomach / mirror), 1 lifestyle pain context (rejecting food, hiding face). UGC. 4:5 or 1:1.

3. type="why-happens" — Vì sao xảy ra (educational)
   • copy: explain the root mechanism in plain Malay/Vi/En — short paragraphs, conversational, NOT medical-textbook
   • 1-2 imagePrompts: infographic-style mechanism visual (gut microbiome / skin layer / patch placement — pick what fits the product niche). Clean, mobile-readable. 1:1.

4. type="ingredients" — Cơ chế ingredient (CRITICAL)
   • copy: name 2-3 hero ingredients from the product brief and explain how each works, simply
   • bullets: 3-5 ingredient → effect lines
   • 2-3 imagePrompts: ingredient cards (capsule + molecule illustration / ingredient hero shot / benefits comparison visual). Infographic style. 1:1.

5. type="social-proof" — Bằng chứng xã hội
   • reviews: 4-6 fake-but-realistic reviews in the chosen language, with author names appropriate to Malaysia (Aisyah, Siti, Ahmad, etc.), short quotes, optional meta like "WhatsApp · 2 minggu lepas"
   • copy: 1-2 short framing paragraphs
   • 2-3 imagePrompts: WhatsApp screenshot, Messenger screenshot, TikTok comment screenshot — MUST look realistic + slightly compressed + imperfect spacing + authentic local vibe. NEVER over-designed clean UI. 9:16 or 4:5.

6. type="before-after" — Trước & sau
   • copy: short testimonial-style story
   • 1-2 imagePrompts: realistic before/after, NOT exaggerated, UGC look. 1:1 split-frame.

7. type="benefits" — Lợi ích
   • bullets: 5-7 short benefits with leading emoji each
   • copy: 1 short framing paragraph
   • 1 imagePrompt: benefits comparison grid or icon-card visual. 1:1.

8. type="offer" — Khuyến mãi & COD
   • copy: offer description, discount, COD details, shipping
   • offerStrip + urgencyText
   • cta: strong button text
   • 1-2 imagePrompts: promo banner, COD card. 16:9 or 4:5.

9. type="faq" — Câu hỏi thường gặp
   • faqs: 5-7 Malaysia-localized FAQs (halal status, side effects, "berapa lama nampak hasil", COD payment, shipping, return policy, allergies). Answers conversational.
   • imagePrompts: [] (FAQ section needs no image)

10. type="final-cta" — Chốt cuối
    • headline (strong urgency), subheadline, cta, urgencyText
    • copy: closing pitch
    • 1 imagePrompt: hero ecommerce shot or final product banner. 4:5.

═══════════════════════════════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════════════════════════════
• Default Bahasa Malaysia — NATURAL COLLOQUIAL Malaysian (NOT textbook), mix English where natural ("memang worth it", "tau tak", "I tak sangka", "serius gila")
• If language=vi → natural Vietnamese ecommerce voice, "mình/bạn" register
• If language=en → conversational SEA English, slightly informal
• Keep product NAME and INGREDIENT NAMES in their original English
• layoutGuide is ALWAYS in VIETNAMESE regardless of copy language

═══════════════════════════════════════════════════════════════
COPY FORMATTING — mobile-first non-negotiable
═══════════════════════════════════════════════════════════════
• Short paragraphs (1-3 lines) separated by BLANK LINES
• Strategic emojis at paragraph starts for visual rhythm
• ✅ benefits / ❌ failed alternatives where useful
• 👉 / 👇 for pointing at CTAs
• NO giant text walls, NO markdown headers, NO labels like "Hook:" / "Body:"
• NEVER claim cure / treatment / guaranteed — keep advertorial-safe

═══════════════════════════════════════════════════════════════
IMAGE PROMPT RULES
═══════════════════════════════════════════════════════════════
• ALWAYS English, 30-60 words
• DEFAULT ETHNICITY: Malaysian native (unless target market clearly says otherwise)
• Visual lock across sections: same ethnicity, same lighting style, same UGC vibe
• NEVER cinematic / fashion editorial / luxury commercial / stock-photo corporate
• Aesthetic target: Facebook ads MY native ecommerce advertorial UGC
• Social-proof screenshots: explicitly note "slightly compressed image quality", "imperfect spacing", "casual Malay language", "natural emoji usage"`

// ─────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

function buildUserPrompt(params: LandingGenParams): string {
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const lines: string[] = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT BRIEF (use REAL fields — never invent)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.painPoints)         lines.push(`Pain points: ${product.painPoints}`)
  if (product.usps)               lines.push(`USPs: ${product.usps}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)
  if (product.offer)              lines.push(`Offer: ${product.offer}`)
  if (product.ingredients)        lines.push(`★ Ingredients (name these specifically — never generic "powerful formula"): ${product.ingredients}`)

  lines.push('')
  lines.push(`Output language: ${params.language}`)
  if (params.nicheHint) lines.push(`Niche hint: ${params.nicheHint}`)
  if (params.sourceUrl) lines.push(`Source URL the marketer is referencing (treat as context only, do not assume content): ${params.sourceUrl}`)

  lines.push('')
  lines.push('Generate the 10-section advertorial pack as a single STRICT JSON object matching the schema above. No markdown fences, no commentary — JSON only.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────
// Tolerant JSON extractor — strips ```json fences, leading commentary,
// trailing markdown.
// ─────────────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fence) s = fence[1].trim()
  // Find first { and last } as a last-resort bracket extract
  const first = s.indexOf('{')
  const last  = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  return s
}

// Don't extend Partial<LandingSection> — the type narrows to SectionType and
// won't accept the raw string Gemini returns. We carry an unknown type then
// narrow it inside normalizeSection.
type RawSection = Omit<Partial<LandingSection>, 'type'> & { type?: string }

interface RawPack {
  language?: string
  sections?: RawSection[]
}

const SECTION_ORDER: SectionType[] = [
  'hero', 'pain', 'why-happens', 'ingredients', 'social-proof',
  'before-after', 'benefits', 'offer', 'faq', 'final-cta',
]

function normalizeSection(s: RawSection): LandingSection | null {
  const type = SECTION_ORDER.find((t) => t === s.type)
  if (!type) return null
  return {
    type,
    title: s.title ?? type,
    copy: s.copy ?? '',
    layoutGuide: s.layoutGuide ?? '',
    headline: s.headline,
    subheadline: s.subheadline,
    cta: s.cta,
    offerStrip: s.offerStrip,
    urgencyText: s.urgencyText,
    bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : undefined,
    faqs: Array.isArray(s.faqs) ? s.faqs : undefined,
    reviews: Array.isArray(s.reviews) ? s.reviews : undefined,
    imagePrompts: Array.isArray(s.imagePrompts) ? s.imagePrompts : [],
    imageSizeHint: s.imageSizeHint,
  }
}

// ─────────────────────────────────────────────────────────────────────

export async function generateLandingPack(params: LandingGenParams): Promise<LandingPagePack> {
  const apiKey = getGeminiKey()
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm — chọn lại từ Project')

  const userPrompt = buildUserPrompt(params)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 10 sections × significant content per section → need a big budget.
    maxOutputTokens: 16384,
    // JSON-only output — give Gemini the structured response hint.
    responseMimeType: 'application/json',
  })

  let parsed: RawPack
  try {
    parsed = JSON.parse(extractJson(raw)) as RawPack
  } catch {
    console.error('[LandingPageAI] JSON parse failed. Raw:', raw.slice(0, 500))
    throw new Error('Gemini trả về JSON không hợp lệ — thử lại')
  }

  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Gemini không trả về section nào — thử lại')
  }

  const sections: LandingSection[] = []
  for (const ord of SECTION_ORDER) {
    const found = parsed.sections.find((s) => s.type === ord)
    if (found) {
      const norm = normalizeSection(found)
      if (norm) sections.push(norm)
    }
  }

  if (sections.length === 0) {
    throw new Error('Không có section nào hợp lệ trong JSON Gemini trả về')
  }

  return {
    productId: params.productId,
    productName: product.productName,
    language: (parsed.language as LandingLanguage) ?? params.language,
    sections,
    generatedAt: Date.now(),
  }
}
