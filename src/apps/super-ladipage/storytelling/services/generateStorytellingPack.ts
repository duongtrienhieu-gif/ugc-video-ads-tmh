// ═════════════════════════════════════════════════════════════════════
// generateStorytellingPack — P0.5 MOCK
//
// ⚠️ P0.5 deliverable: trả về hardcoded mock pack để verify end-to-end
// pipeline (form selector → dispatcher → render). KHÔNG gọi Gemini,
// KHÔNG gọi KIE, KHÔNG real text gen, KHÔNG real image gen.
//
// Pack shape compatible với LandingPagePack để OutputPanel render được
// mà không cần UI riêng. 4 mock section dùng existing SectionType values
// (`hero`, `pain`, `lifestyle`, `final-cta`) — KHÔNG pollute shared
// types.ts với section ID mới của storytelling.
//
// Phase 2+ sẽ rebuild file này thành real pipeline:
//   1. resolveStorytellingInput → StorytellingInput
//   2. resolveSectionPlan → SectionPlan[]
//   3. buildPackGenPrompt (compact) → Gemini text gen
//   4. semanticGateScan (storytelling-specific)
//   5. assembleImagePrompt (per section)
//   6. return StorytellingPack
// ═════════════════════════════════════════════════════════════════════

import type {
  CharacterProfile, LandingGenParams, LandingPagePack, StorytellingPack,
} from '../types'
import { useBankStore } from '../../../../stores/bankStore'
import { resolveStorytellingInput } from '../resolvers/resolveStorytellingInput'
import { resolveSectionPlan } from '../resolvers/resolveSectionPlan'

const MOCK_MARKER = '[MOCK STORYTELLING — Phase P0.5]'

/** P0.5 mock entry point. Signature match `generateLandingPack` từ UGC
 *  để dispatcher swap được 1:1. */
export async function generateStorytellingPack(
  params: LandingGenParams,
): Promise<LandingPagePack> {
  // ── Lấy product giống pattern UGC (useBankStore.getState()) ─────
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) {
    throw new Error(`Không tìm thấy sản phẩm với id="${params.productId}". Vui lòng chọn lại sản phẩm.`)
  }

  // ── Demonstrate resolver layer hoạt động (output không dùng trong mock
  //    nhưng compile-check chain types) ──────────────────────────────────
  const input = resolveStorytellingInput(params)
  const plan = resolveSectionPlan(input)
  console.info(
    `[storytelling] P0.5 mock — resolver chain OK. Niche=${input.niche}, ` +
    `sections planned=${plan.length}, productReveal=section ${input.productRevealSection}`,
  )

  // ── Mock character profile (Phase 3 sẽ derive from product+niche) ─
  const characterProfile: CharacterProfile = {
    name: 'Aishah',
    archetype: 'Người phụ nữ Đông Nam Á, 35-45, mẹ 2 con',
    appearanceLock:
      'Malay Muslim woman, age 35-45, hijab always, modern-modest dress, warm-maternal vibe, suburban setting',
    environmentLock:
      'Suburban Malaysian house — kitchen with morning window light, living room, garden',
    emotionalArc: [
      { sectionType: 'hero',      mood: 'calm-curious' },
      { sectionType: 'pain',      mood: 'recurring-discomfort' },
      { sectionType: 'lifestyle', mood: 'first-hope' },
      { sectionType: 'final-cta', mood: 'settled-resolve' },
    ],
  }

  // ── 4 mock section dùng existing SectionType values ────────────────
  const pack: StorytellingPack = {
    productId: params.productId,
    productName: product.productName,
    language: params.language,
    form: 'advertorial',
    sections: [
      {
        type: 'hero',
        title: 'Cô ấy tên Aishah',
        titleVi: 'Cô ấy tên Aishah',
        copy:
`${MOCK_MARKER}

Chương 1.

Aishah, 38 tuổi, sống ở Selangor cùng chồng và 2 con. Mỗi sáng cô dậy lúc 5h30 — chuẩn bị bữa sáng, tiễn các con đi học, rồi mở cửa hàng nhỏ bán đồ ăn vặt trước nhà.

Cô là kiểu người không kêu ca. "Mọi người đều mệt mà," cô hay nói vậy.

Nhưng có những thứ — bạn không nói ra — không có nghĩa là nó không có.`,
        layoutGuide: 'Cinematic portrait, soft natural window light, environmental hint of kitchen',
        imagePrompts: [],
      },
      {
        type: 'pain',
        title: 'Một sự khó chịu quen thuộc',
        titleVi: 'Một sự khó chịu quen thuộc',
        copy:
`${MOCK_MARKER}

Mỗi chiều khoảng 3 giờ, có một cảm giác đến.

Không hẳn là mệt. Cũng không hẳn là buồn ngủ.

Giống như cơ thể đang nói: "Đủ rồi nhé."

Aishah pha thêm một ly cà phê. Rồi một ly nữa. Cô không nói ai biết — vì có vẻ như đây là cảm giác mà tất cả phụ nữ ở tuổi của cô đều có.

Có lẽ thế.

Hoặc có lẽ không.`,
        layoutGuide: 'Documentary close-up, partial face, hands resting, mood-led',
        imagePrompts: [],
      },
      {
        type: 'lifestyle',
        title: 'Ba tuần sau',
        titleVi: 'Ba tuần sau',
        copy:
`${MOCK_MARKER}

Aishah không nhớ chính xác ngày nào nó bắt đầu khác đi.

Có thể là sáng thứ Tư tuần đó — khi cô tỉnh dậy lúc 5h30 và không cần bấm "ngủ thêm 10 phút" trên đồng hồ.

Hoặc chiều thứ Sáu — khi 3 giờ trôi qua, và cô không nghĩ đến ly cà phê thứ ba.

Những thay đổi nhỏ. Không kịch tính.

Nhưng có.`,
        layoutGuide: 'Candid moment — pouring tea, reading, looking out window. NOT smile-at-camera.',
        imagePrompts: [],
      },
      {
        type: 'final-cta',
        title: 'Nếu bạn cũng từng…',
        titleVi: 'Nếu bạn cũng từng…',
        copy:
`${MOCK_MARKER}

Câu chuyện của Aishah đến đây là hết.

Nhưng có thể câu chuyện của bạn đang ở đâu đó — giữa Chương 3 và Chương 4.

Nếu bạn cũng từng có cảm giác mệt vô cớ vào 3 giờ chiều, từng pha ly cà phê thứ ba và tự hỏi "có phải mình đang già rồi không" — có lẽ chúng ta hiểu nhau hơn bạn nghĩ.

Tôi chỉ muốn nói: bạn không một mình.`,
        layoutGuide: 'Quiet emotional anchor — 2-person sharing scene OR open landscape. No product in frame, no CTA overlay.',
        imagePrompts: [],
      },
    ],
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
    characterProfile,
    storytellingMeta: {
      emotionalIntensity:   input.emotionalIntensity,
      pacingType:           input.pacingType,
      productRevealSection: input.productRevealSection,
      niche:                input.niche,
      overlayBudgetUsed:    0,
    },
  }

  return pack
}
