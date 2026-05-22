// ═════════════════════════════════════════════════════════════════════
// generateStorytellingPack — P0.5 MOCK
//
// ⚠️ P0.5 deliverable: trả về hardcoded 10-section mock pack đúng
// blueprint v3 để verify end-to-end pipeline (form selector → dispatcher
// → isolated renderer). KHÔNG gọi Gemini, KHÔNG gọi KIE.
//
// Section order khớp DEFAULT_SECTION_ORDER:
//   intro-portrait → ordinary-life → daily-friction → failed-attempts
//   → inner-realization → discovery-moment → first-trial → subtle-change
//   → new-normal → sharing-invitation
//
// Mock copy thể hiện storytelling rhythm:
//   - short paragraphs
//   - breathing lines / pause lines / unfinished thoughts
//   - conversational tone
//   - emotional arc đi qua 10 beats
//
// section.type dùng existing UGC SectionType để compat với LandingSection
// shape. Storytelling section ID lưu trong storytellingMeta.sectionIds[]
// (parallel array) — KHÔNG pollute shared types.ts.
//
// Phase 2+ sẽ thay file này bằng real pipeline (resolvers + Gemini gen).
// ═════════════════════════════════════════════════════════════════════

import type {
  AllowedOverlayType, CharacterProfile, LandingGenParams, LandingPagePack,
  LandingSection, SectionId, StorytellingPack,
} from '../types'
import type { SectionType } from '../../types'
import { useBankStore } from '../../../../stores/bankStore'
import { DEFAULT_SECTION_ORDER, SECTION_BLUEPRINTS } from '../config/sectionBlueprints'
import { resolveStorytellingInput } from '../resolvers/resolveStorytellingInput'
import { resolveSectionPlan } from '../resolvers/resolveSectionPlan'

const MOCK_MARKER = '[MOCK P0.5]'

// ── Map storytelling SectionId → existing UGC SectionType for compat
//    với LandingSection.type. Chỉ tồn tại ở mock layer; real pipeline
//    P2+ sẽ store storytelling sectionId độc lập. ────────────────────
const SECTION_TYPE_MAP: Record<SectionId, SectionType> = {
  'intro-portrait':     'hero',
  'ordinary-life':      'lifestyle',
  'daily-friction':     'pain',
  'failed-attempts':    'failed-solutions',
  'inner-realization':  'why-happens',
  'discovery-moment':   'product-discovery',
  'first-trial':        'lifestyle',
  'subtle-change':      'lifestyle',
  'new-normal':         'lifestyle',
  'sharing-invitation': 'final-cta',
}

// ── Mock copy per section ─────────────────────────────────────────────
const MOCK_COPY: Record<SectionId, { title: string; copy: string }> = {
  'intro-portrait': {
    title: 'Cô ấy tên Aishah',
    copy:
`Aishah, 38 tuổi.

Sống ở một thị trấn nhỏ ngoại ô Selangor cùng chồng và hai đứa con.

Mỗi sáng cô dậy lúc 5h30 — chuẩn bị bữa sáng cho cả nhà, tiễn các con đi học, rồi mở cửa hàng nhỏ bán đồ ăn vặt trước nhà.

Cô là kiểu người không kêu ca.

"Mọi người đều mệt mà," cô hay nói vậy.

Nhưng có những thứ — bạn không nói ra — không có nghĩa là nó không có.`,
  },

  'ordinary-life': {
    title: 'Một sáng tháng Ba',
    copy:
`Buổi sáng hôm đó không khác gì những buổi sáng khác.

Cô pha cà phê. Sắp dĩa bánh ra bàn. Gọi tụi nhỏ xuống. Tiễn chồng đi làm.

Mọi thứ đúng nhịp.

Chỉ là — khi đứng nhìn theo chiếc xe chồng cô rẽ ra khỏi ngõ, cô đứng đó lâu hơn bình thường.

Cô không biết tại sao.

Có lẽ chỉ là mệt một chút.`,
  },

  'daily-friction': {
    title: 'Mỗi chiều khoảng 3 giờ',
    copy:
`Có một cảm giác đến.

Không hẳn là mệt. Cũng không hẳn là buồn ngủ.

Giống như cơ thể đang nói: "Đủ rồi nhé."

Aishah pha thêm một ly cà phê. Rồi đôi khi một ly nữa.

Khách vào cửa hàng — cô vẫn cười, vẫn nói chuyện. Nhưng tối về, cô nằm xuống và chỉ muốn không phải nghĩ gì nữa.

Cô không nói ai biết.

Vì có vẻ như đây là cảm giác mà tất cả phụ nữ ở tuổi của cô đều có.

Có lẽ thế.`,
  },

  'failed-attempts': {
    title: 'Tôi đã thử',
    copy:
`Vitamin tổng hợp ở pharmacy. Đã thử.

Đi ngủ sớm hơn. Đã thử.

Uống nhiều nước. Đã thử.

Tập thể dục buổi sáng — được 4 ngày.

Mỗi lần cô đọc một bài báo nói về "5 cách để có nhiều năng lượng hơn", cô đều ghi lại. Đều thử.

Có cách work một tuần. Có cách work vài ngày.

Rồi quay lại điểm cũ.

Cô bắt đầu nghĩ — có lẽ vấn đề không phải ở việc cô chưa đủ cố gắng.`,
  },

  'inner-realization': {
    title: 'Có lẽ',
    copy:
`Có lẽ vấn đề không phải là cô lười.

Cũng không phải là cô không có kỷ luật.

Cô có cả hai.

Có lẽ — cơ thể cô đang thiếu một thứ gì đó mà ly cà phê thứ ba không bù lại được.

Một thứ gì đó nhỏ. Nhưng cụ thể.

Cô không biết là thứ gì.

Nhưng từ ngày đó, cô bắt đầu để ý hơn.`,
  },

  'discovery-moment': {
    title: 'Một buổi tối tháng Năm',
    copy:
`Em gái cô — Aida — ghé qua chơi.

Hai chị em ngồi ở hiên nhà, uống trà. Aida vừa quay lại đi làm sau 6 tháng nghỉ chăm con thứ hai.

"Chị có biết — em từng tưởng mình bị burnout thật sự," Aida nói. "Mệt kiểu chết người. Sau đó em mới biết là…"

Aida nhắc một cái tên.

Aishah chưa từng nghe. Cô gật đầu lịch sự, nhớ trong đầu.

Đêm đó cô tra Google.`,
  },

  'first-trial': {
    title: 'Tuần đầu tiên',
    copy:
`Cô không kỳ vọng gì.

Đặt mua. Chờ 2 ngày. Hộp đến.

Cô mở ra, đọc hướng dẫn, đặt lên kệ bếp — cạnh bình cà phê.

Sáng hôm sau cô dùng theo hướng dẫn.

Không cảm thấy gì đặc biệt ngày đầu. Không cảm thấy gì ngày thứ hai. Cũng không cảm thấy gì khác ngày thứ ba.

Cô gần như đã quên.`,
  },

  'subtle-change': {
    title: 'Ba tuần sau',
    copy:
`Aishah không nhớ chính xác ngày nào nó bắt đầu khác đi.

Có thể là sáng thứ Tư tuần đó — khi cô tỉnh dậy lúc 5h30 và không cần bấm "ngủ thêm 10 phút" trên đồng hồ.

Hoặc chiều thứ Sáu — khi 3 giờ trôi qua, và cô không nghĩ đến ly cà phê thứ ba.

Hoặc tối Chủ Nhật — khi cô ngồi vẽ với con gái lớn đến 9 giờ, mà không thấy mí mắt nặng.

Những thay đổi nhỏ.

Không kịch tính. Không "khỏi hẳn".

Nhưng có.`,
  },

  'new-normal': {
    title: 'Bây giờ',
    copy:
`Bây giờ là tháng Tám.

Cửa hàng vẫn mở từ 7 giờ. Tụi nhỏ vẫn đi học. Chồng vẫn rẽ ra khỏi ngõ lúc 7h30.

Khác là — Aishah không còn đứng nhìn theo lâu hơn cần thiết nữa.

Cuối tuần cô đi chợ sớm, ghé hàng quen, mang hoa về cắm trên bàn ăn. Tối nấu nhiều món hơn một chút. Đi ngủ sớm hơn nếu thấy nên.

Cô vẫn là Aishah. Vẫn không kêu ca.

Chỉ là — bây giờ cô thực sự ổn.`,
  },

  'sharing-invitation': {
    title: 'Nếu bạn cũng từng…',
    copy:
`Câu chuyện của Aishah đến đây là hết.

Nhưng có thể câu chuyện của bạn đang ở đâu đó — giữa Chương 3 và Chương 4.

Nếu bạn cũng từng có cảm giác mệt vô cớ vào 3 giờ chiều, từng pha ly cà phê thứ ba và tự hỏi "có phải mình đang già rồi không" — có lẽ chúng ta hiểu nhau hơn bạn nghĩ.

Tôi chỉ muốn nói: bạn không một mình.`,
  },
}

/** P0.5 mock entry point. Signature match `generateLandingPack` từ UGC
 *  để dispatcher swap được 1:1. */
export async function generateStorytellingPack(
  params: LandingGenParams,
): Promise<LandingPagePack> {
  const product = useBankStore.getState().getProductById(params.productId)
  if (!product) {
    throw new Error(`Không tìm thấy sản phẩm với id="${params.productId}". Vui lòng chọn lại sản phẩm.`)
  }

  // Demonstrate resolver chain (output không dùng trong mock, compile-check only)
  const input = resolveStorytellingInput(params)
  const plan = resolveSectionPlan(input)
  console.info(
    `[storytelling] P0.5 mock — resolver chain OK. Niche=${input.niche}, ` +
    `sections planned=${plan.length}, productReveal=section ${input.productRevealSection}`,
  )

  // ── Character anchor (Phase 3 sẽ derive from product+niche) ──────
  const characterProfile: CharacterProfile = {
    name: 'Aishah',
    archetype: 'Người phụ nữ Đông Nam Á, 35-45, mẹ 2 con, chủ cửa hàng nhỏ',
    appearanceLock:
      'Malay Muslim woman, age 35-45, hijab always, modern-modest dress, warm-maternal vibe',
    environmentLock:
      'Suburban Malaysian house — kitchen with morning window light, front-yard shop, living room, garden',
    emotionalArc: DEFAULT_SECTION_ORDER.map((sid) => ({
      sectionType: SECTION_TYPE_MAP[sid],
      mood: SECTION_BLUEPRINTS[sid].emotionalBeat,
    })),
  }

  // ── Allocate overlay budget (2 max, anti-ads-vibe). Default: section 1
  //    chapter-marker + section 8 time-marker. ──────────────────────────
  const overlayPerSection: (AllowedOverlayType | null)[] = DEFAULT_SECTION_ORDER.map((sid) => {
    if (sid === 'intro-portrait') return 'chapter-marker'
    if (sid === 'subtle-change')  return 'diary-timestamp'
    return null
  })

  // ── Build 10 sections from blueprint + mock copy ────────────────
  const sections: LandingSection[] = DEFAULT_SECTION_ORDER.map((sid) => {
    const blueprint = SECTION_BLUEPRINTS[sid]
    const { title, copy } = MOCK_COPY[sid]
    return {
      type: SECTION_TYPE_MAP[sid],
      title,
      titleVi: title,
      copy: `${MOCK_MARKER}\n\n${copy}`,
      layoutGuide: blueprint.pacingPurpose,
      imagePrompts: [],
    }
  })

  const pack: StorytellingPack = {
    productId: params.productId,
    productName: product.productName,
    language: params.language,
    form: 'advertorial',
    sections,
    visualMemory: params.visualMemory ?? [],
    generatedAt: Date.now(),
    characterProfile,
    storytellingMeta: {
      emotionalIntensity:   input.emotionalIntensity,
      pacingType:           input.pacingType,
      productRevealSection: input.productRevealSection,
      niche:                input.niche,
      overlayBudgetUsed:    overlayPerSection.filter((o) => o !== null).length,
      sectionIds:           [...DEFAULT_SECTION_ORDER],
      overlayPerSection,
    },
  }

  return pack
}
