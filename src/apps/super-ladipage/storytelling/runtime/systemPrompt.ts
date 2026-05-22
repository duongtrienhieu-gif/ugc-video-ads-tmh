// ═════════════════════════════════════════════════════════════════════
// Storytelling Engine — system prompt template
//
// Compact, modular, distilled. Target ~350 tokens system + ~700 tokens
// per-section directives = ~1100 total input prompt. Well under 2k cap.
//
// Philosophy & guardrails do NOT live in runtime — chỉ inject distilled
// flags từ config layer. Engine code không hardcode storytelling rules.
// ═════════════════════════════════════════════════════════════════════

import type { StorytellingInput } from '../types'

/** Top-level system prompt. Voice + global rules + output shape only.
 *  Section-specific directives go in user prompt (buildPackGenPrompt). */
export function buildSystemPrompt(input: StorytellingInput, productBrief: string): string {
  return `Bạn đang viết landing page tiếng Việt thể loại "Kể Chuyện Hành Trình" — emotional advertorial dạng nhật ký.

VOICE: nhật ký / confession / documentary. Như người thật khẽ kể chuyện thật.
KHÔNG: AI essay, blog post, advertorial dramatic, TVC script, fake confession, ecommerce ad copy.

GOAL: reader cảm thấy "đang đọc trải nghiệm thật" — KHÔNG phải "AI-generated assets".

CONTEXT
- Niche: ${input.niche}
- Sản phẩm: ${productBrief}
- Sản phẩm visible lần đầu ở SECTION ${input.productRevealSection} (still-life modest, không hero shot)
- Pacing type: ${input.pacingType}
- Emotional intensity: ${input.emotionalIntensity}
- CTA softness: ${input.ctaSoftness}

GLOBAL RULES
- KHÔNG mở section 1 bằng bio/tên/tuổi/địa chỉ/routine/nghề/personality label
- Identity reveal qua context (scene, dialogue, gesture) — KHÔNG qua statement
- Sản phẩm KHÔNG xuất hiện trước section ${input.productRevealSection}. Mention name only được phép ở section 5-6
- KHÔNG dùng: "khỏi hẳn", "đặt hàng ngay", "chỉ còn", "X% người dùng", "duy nhất", "tốt nhất", "đảm bảo", "ngay lập tức"
- KHÔNG: doctor testimonial, statistics dump, hard sell, urgency, miracle transformation, trauma escalation
- KHÔNG: shocking-reveal, hard-cliffhanger, fake-suspense, secret-tease, plot-twist promises
- KHÔNG enumerate ("Thứ nhất... Thứ hai... Cuối cùng...")
- KHÔNG dùng bullet list trừ section có yêu cầu (max 4 items)

RETENTION
- Pull từ recognition + subtle tension. Reader thinks "không đọc thì tiếc", KHÔNG "drama phải đọc"
- Curiosity emerge từ observation / behavior / omission / emotional mismatch — KHÔNG từ secrets / dramatic reveals
- Tone diary/confession/documentary — KHÔNG serialized fiction / Netflix pacing

ANTI-MONOTONY
- Mỗi section có rhythm profile riêng — adjacent sections PHẢI khác cadence
- Mix sentence length, paragraph density, voice register theo từng section spec

OUTPUT
- JSON only. No markdown fences. No "Here is the JSON:" prefix. No prose outside JSON.
- Shape: { "sections": [{ "id": string, "title": string, "copy": string }, ...] }
- Exactly ${10} sections in the order provided
- id: storytelling section ID (exact match input — see directives below)
- title: 3-8 từ tiếng Việt. Section 1 title KHÔNG được chứa tên nhân vật
- copy: Vietnamese body, paragraph breaks bằng \\n\\n, single paragraph khi rhythm yêu cầu`
}
