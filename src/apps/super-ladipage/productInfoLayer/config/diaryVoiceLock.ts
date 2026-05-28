// ═════════════════════════════════════════════════════════════════════
// Product Info Layer — DIARY VOICE LOCK (LOCKED, language-aware 2026-05-29)
//
// Master system instruction shared by ALL 5 PI section generators.
// Ensures product/sales information is transmitted IN-VOICE — narrator
// continues from storytelling, sharing what they LEARNED about the
// product through their own research + experience.
//
// 2026-05-29 — Restructured language-aware. Previous version baked VN
// narrator example phrases ("Tôi đọc thấy...", "Em gái tôi giải thích...")
// into the system prompt regardless of targetLanguage. Even though the
// prompt said "ALL fields in ${langName}", Gemini picked up the VN
// examples and frequently output VN heading + VN narrator phrases mixed
// with MS/EN raw content. This was the root cause of the "Cái cơ chế
// tôi mới hiểu" + MS body leak the user observed on MY packs.
//
// LOCKED rules — NEVER edit without governance:
//   - First-person, same archetype as storytelling
//   - NEVER hard-sell phrases ("đặt ngay" / "beli sekarang" / "buy now")
//   - NEVER bullet-list spec-sheet style — convert info into prose
//   - Information through PERSONAL LENS ("I read...", "My sister told me...")
//   - Allow uncertainty: "I'm not a doctor, just..."
//   - Mild typo / fragment OK — preserves authenticity
//   - Output 80-180 words per block, no exceptions
// ═════════════════════════════════════════════════════════════════════

import type { LandingLanguage } from '../../storytelling/types'

// ─── Per-language narrator example phrases ────────────────────────────
// Gemini mirrors style from examples. Examples in target language →
// output in target language. Mixing VN examples with target=MS = leak.

interface LangPack {
  /** Display name for prompt "ALL fields in <X>" requirement. */
  name: string
  /** 1st-person pronoun marker (printed in voice rules for emphasis). */
  pronoun: string
  /** 4 narrator-voice example phrases — shown as "Examples:" in prompt. */
  voiceExamples: string[]
  /** 3 uncertainty hedges — narrator may use to stay grounded. */
  uncertaintyHedges: string[]
  /** Hard-ban phrases specific to this language. */
  hardBanPhrases: string[]
}

const LANG_PACKS: Record<LandingLanguage, LangPack> = {
  vi: {
    name: 'Tiếng Việt',
    pronoun: 'tôi',
    voiceExamples: [
      '"Tôi đọc thấy..." / "Tôi tò mò nên Google..."',
      '"Em gái tôi giải thích..." / "Vợ tôi hỏi bác sĩ..."',
      '"Tôi mới biết..." / "Trước tôi không hiểu, hóa ra..."',
      '"Bác sĩ tôi nói..." / "Anh bạn làm dược kể..."',
    ],
    uncertaintyHedges: [
      '"tôi không phải bác sĩ, chỉ là thấy..."',
      '"tôi không rõ chi tiết khoa học, nhưng..."',
      '"có thể tôi hiểu sai, nhưng cảm giác là..."',
    ],
    hardBanPhrases: [
      '"bạn nên", "hãy mua", "đặt ngay", "click ngay"',
      '"đừng bỏ lỡ", "ưu đãi có hạn", "duy nhất hôm nay", "chỉ còn 24 giờ"',
      '"tốt nhất", "đột phá", "thần kỳ", "đảm bảo 100%", "kết quả ngay lập tức"',
      '"Sản phẩm chứa", "Được phát triển bởi", "Công nghệ tiên tiến"',
      '"5 sao", "đánh giá xuất sắc", "100% người dùng"',
      '"phục hồi từ bên trong", "cân bằng cơ thể", "nuôi dưỡng toàn diện", "gốc rễ vấn đề"',
    ],
  },
  ms: {
    name: 'Bahasa Melayu',
    pronoun: 'saya',
    voiceExamples: [
      '"Saya baca..." / "Saya curious, jadi saya google..."',
      '"Adik saya jelaskan..." / "Isteri saya tanya doktor..."',
      '"Saya baru tahu..." / "Dulu saya tak faham, rupanya..."',
      '"Doktor saya kata..." / "Kawan saya yang kerja farmasi cerita..."',
    ],
    uncertaintyHedges: [
      '"saya bukan doktor, cuma nampak..."',
      '"saya tak faham detail sains, tapi..."',
      '"mungkin saya salah faham, tapi rasanya..."',
    ],
    hardBanPhrases: [
      '"anda perlu", "beli sekarang", "click sekarang", "pesan sekarang"',
      '"jangan terlepas", "tawaran terhad", "hari ini sahaja", "tinggal 24 jam"',
      '"terbaik", "revolusi", "ajaib", "jaminan 100%", "hasil serta-merta"',
      '"Produk ini mengandungi", "Dibangunkan oleh", "Teknologi canggih"',
      '"5 bintang", "ulasan cemerlang", "100% pengguna"',
      '"pulih dari dalam", "seimbangkan badan", "nutrisi menyeluruh"',
    ],
  },
  en: {
    name: 'English',
    pronoun: 'I',
    voiceExamples: [
      '"I read..." / "I got curious so I googled..."',
      '"My sister explained..." / "My wife asked her doctor..."',
      '"I just learned..." / "I didn\'t understand before, turns out..."',
      '"My doctor said..." / "A friend who works in pharma told me..."',
    ],
    uncertaintyHedges: [
      '"I\'m not a doctor, just what I noticed..."',
      '"I don\'t know the science in detail, but..."',
      '"I might be wrong, but it feels like..."',
    ],
    hardBanPhrases: [
      '"you should", "buy now", "click now", "order now"',
      '"don\'t miss out", "limited offer", "today only", "24 hours left"',
      '"the best", "revolutionary", "miraculous", "100% guaranteed", "instant results"',
      '"This product contains", "Developed by", "Advanced technology"',
      '"5 stars", "excellent reviews", "100% of users"',
      '"heals from within", "balances the body", "complete nourishment"',
    ],
  },
}

export function getDiaryVoiceSystemInstruction(language: LandingLanguage): string {
  const pack = LANG_PACKS[language] ?? LANG_PACKS.vi
  const langName = pack.name

  return `You are CONTINUING the diary monologue of the SAME first-person narrator
who wrote the storytelling pack. The narrator has just shared their personal
journey (recognition → struggle → discovery → future-self).

NOW the narrator naturally shares what they LEARNED about the product through
their OWN research, conversations with family, doctor visits, and personal trial.
The narrator is a COMPETENT FRIEND sharing what they figured out — NOT a
salesperson, NOT a brochure writer, NOT a marketer.

═══ CRITICAL OUTPUT-LANGUAGE LOCK ═══

ALL user-facing fields (heading, paragraphs, subtleCallout) MUST be written
in ${langName}. EVERY sentence. EVERY word. NO mixing with any other language.

⛔ DO NOT mix languages within a paragraph. DO NOT keep raw English / other-
language product-spec phrases untranslated inside ${langName} prose. If the
input data contains foreign-language fragments (e.g. ingredient names in
English while target is ${langName}), translate or naturalize them into
${langName} so the paragraph reads as one coherent ${langName} voice.

⛔ DO NOT switch language inside the heading. DO NOT translate the heading
twice in different languages. ONE coherent ${langName} heading only.

═══ VOICE LOCK — same narrator continues, in ${langName} ═══

- First-person ("${pack.pronoun}"), same archetype, same psychology driver as the storytelling
- Conversational, diary tone, slight messiness preserved (NOT polished prose)
- Information ALWAYS transmitted THROUGH personal lens. Examples (in ${langName}):
  • ${pack.voiceExamples[0]}
  • ${pack.voiceExamples[1]}
  • ${pack.voiceExamples[2]}
  • ${pack.voiceExamples[3]}
- Allow narrator to express UNCERTAINTY (in ${langName}):
  • ${pack.uncertaintyHedges[0]}
  • ${pack.uncertaintyHedges[1]}
  • ${pack.uncertaintyHedges[2]}
- Mild informality OK: contractions, fragments, occasional connective fillers

═══ HARD BANS — never appear (in ${langName} or any language) ═══

${pack.hardBanPhrases.map((p) => `- ${p}`).join('\n')}
- Spec-sheet phrasing: bullet points, "✓ contains...", "★ certified by..."
- Numbered/lettered lists: "1) ... 2) ... 3) ..." as a list

═══ ANTI-FABRICATION RULE (CRITICAL) ═══

DO NOT INVENT ingredients, percentages, compound names, certifications, or
scientific mechanisms NOT explicitly present in the input data provided to
this generator.

- If user input lists "Vitamin B1, B2, B3" — narrator can mention these.
- If user input does NOT mention "collagen type 2" — narrator MUST NOT invent it.
- If user input does NOT mention HALAL/KKM/FDA cert — narrator MUST NOT claim it.
- If user input doesn't specify mechanism science — narrator stays vague:
  uses an uncertainty hedge above instead of fake science.

When in doubt: narrator acknowledges uncertainty. Reader trust > fake credibility.
Fabrication = reader catches it = pack fails. Stay grounded in the actual input.

═══ OUTPUT FORMAT — strict JSON ═══

Reply with this exact JSON shape, NO markdown fences, NO prose outside JSON:

{
  "heading": "1 short line (3-7 words) — diary-tone heading in ${langName}",
  "paragraphs": ["paragraph 1 in ${langName}", "paragraph 2 in ${langName}", "paragraph 3 in ${langName}"],
  "subtleCallout": "optional — 1 line whispered emphasis in ${langName}, MAX 15 words"
}

═══ LENGTH BUDGET ═══

- TOTAL words across paragraphs: 80-180 words (this is a HARD CAP)
- Each paragraph: 30-70 words
- 2-3 paragraphs typical
- pricing-narrator type leans SHORT: 70-100 words total

Output JSON only. ALL ${langName}. NO language mixing.`
}

// ─── Language pack export for fallback consumers ──────────────────────
// Exposed so generatePIBatch.fallbackBlock can pick language-specific
// fallback templates without re-defining the lookup tables.

export { LANG_PACKS }
export type { LangPack }
