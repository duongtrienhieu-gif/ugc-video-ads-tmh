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

// ── Mock copy per section — v4 dynamics demonstration ─────────────────
// Each section embodies its assigned rhythmProfile + retentionMechanic.
// Section 1 = observation-first hook (NO bio intro). Anti-drama restraint.
// Adjacent sections have different rhythm → anti-monotony validator passes.
const MOCK_COPY: Record<SectionId, { title: string; copy: string }> = {
  // ─── Section 1: observation hook · short-clipped · micro-question ──
  'intro-portrait': {
    title: 'Một sáng tháng Ba',
    copy:
`Chồng cô là người đầu tiên nhận ra.

Một sáng tháng Ba, anh đứng ở cửa bếp, hỏi:

"Em ngủ không ngon à?"

Cô lắc đầu. Bình thường.

Nhưng anh nhìn cô thêm một giây — kiểu nhìn của người đã sống cùng nhau mười lăm năm — rồi đi.

Aishah đứng đó. Tay vẫn cầm muỗng.

Cô không hiểu vì sao mình nhớ mãi câu hỏi đó.`,
  },

  // ─── Section 2: orientation · long-flowing · curiosity-debt ──────
  'ordinary-life': {
    title: 'Cuộc sống không có gì đặc biệt',
    copy:
`Cuộc sống của Aishah không có gì đặc biệt — đúng theo nghĩa mà chính cô vẫn dùng khi ai đó hỏi.

Mỗi sáng cô dậy lúc năm rưỡi, pha cà phê cho chồng trước khi anh đi làm, đánh thức hai đứa nhỏ, đứng ở cửa nhìn theo xe của anh rẽ ra khỏi ngõ. Bảy giờ ba mươi cô mở cửa hàng nhỏ bán đồ ăn vặt trước nhà — một việc cô làm đã sáu năm, kể từ khi đứa thứ hai bắt đầu đi học mẫu giáo.

Người ta vẫn nói cô may mắn. Chồng tốt. Con ngoan. Việc làm linh hoạt. Không có lý do gì để phàn nàn.

Cô đồng ý với họ.

Chỉ là — và cô không nhớ chính xác từ khi nào — buổi tối cô bắt đầu ngồi lâu hơn ở bàn trang điểm trước khi đi ngủ. Không làm gì. Chỉ ngồi.`,
  },

  // ─── Section 3: friction-loop · fragmented · micro-question ──────
  'daily-friction': {
    title: 'Mỗi chiều khoảng ba giờ',
    copy:
`Mỗi chiều khoảng ba giờ.

Một cảm giác đến.

Không phải mệt. Cũng không phải buồn ngủ.

Một cái gì đó ở giữa. Một cái gì đó cô không có từ để gọi tên.

Cô pha thêm một ly cà phê. Khách vào — cô cười, gói bánh, đếm tiền lẻ. Khách ra — cô ngồi xuống chiếc ghế nhựa, tựa lưng vào tường.

Đến năm giờ thì đỡ hơn.

Sáu giờ tụi nhỏ về.

Bảy giờ chồng về.

Tám giờ dọn cơm.

Chín giờ thì đôi khi cô tự hỏi cả ngày mình đã làm gì.

Điều lạ là — chuyện này lặp lại mỗi ngày, và cô vẫn không nói ai biết.`,
  },

  // ─── Section 4: frustration-anchor · conversational · emotional-contrast ──
  'failed-attempts': {
    title: 'Cô đã thử',
    copy:
`Vitamin tổng hợp ở pharmacy. Đã thử.

Đi ngủ sớm hơn. Đã thử.

Uống nhiều nước. Đã thử.

Mỗi lần cô đọc bài "5 cách có nhiều năng lượng hơn" — cô ghi lại. Mỗi lần thử được vài ngày. Có cách work một tuần. Có cách work ba ngày. Rồi quay lại điểm cũ.

Tập thể dục buổi sáng — được bốn ngày. Aishah biết bốn ngày vì cô đếm.

Không phải cô lười. Bạn biết kiểu phụ nữ mở cửa hàng nhỏ từ bảy giờ sáng không? Không có ai trong số đó là người lười.

Vấn đề là — cô bắt đầu nghĩ — có lẽ vấn đề không nằm ở chỗ cô chưa đủ cố gắng.`,
  },

  // ─── Section 5: reflection-pause · reflective-pause · reveal-delay ──
  'inner-realization': {
    title: 'Một câu hỏi cô đã tránh',
    copy:
`Có một câu hỏi mà cô đã tránh trong vài tháng nay.

Không phải vì sợ. Mà vì cô không biết bắt đầu trả lời thế nào.

Có lẽ vấn đề không phải là cô lười. Cũng không phải là cô không kỷ luật. Cô có cả hai — quá nhiều nữa là khác.

Có lẽ — cô nghĩ rất chậm, từng từ — cơ thể cô đang thiếu một thứ gì đó mà ly cà phê thứ ba không bù lại được.

Một thứ rất nhỏ. Nhưng cụ thể.

Cô không biết là thứ gì.

Nhưng từ ngày đó, cô bắt đầu để ý hơn.`,
  },

  // ─── Section 6: curiosity-spark · mixed · section-end-pull ───────
  'discovery-moment': {
    title: 'Một tối tháng Năm',
    copy:
`Em gái cô — Aida — ghé qua chơi một tối tháng Năm.

Aida vừa quay lại đi làm sau sáu tháng nghỉ chăm con thứ hai. Hai chị em ngồi ở hiên nhà, uống trà, nghe tụi nhỏ trong nhà cãi nhau về việc ai sẽ chọn phim trước.

"Chị có biết — em từng tưởng mình bị burnout thật sự," Aida nói, không nhìn cô, nhìn ra phía cổng. "Mệt kiểu chết người. Sáng dậy như xe chết máy. Sau đó em mới biết là…"

Aida nhắc một cái tên.

Aishah chưa từng nghe.

Cô gật đầu lịch sự — kiểu gật đầu của người không muốn em gái thấy mình đang chú ý hơn cô tỏ ra.

Đêm đó cô tra Google.`,
  },

  // ─── Section 7: tentative-action · short-clipped · micro-question ──
  'first-trial': {
    title: 'Không kỳ vọng gì',
    copy:
`Cô không kỳ vọng gì.

Đặt mua. Chờ hai ngày. Hộp đến.

Cô mở ra. Đọc hướng dẫn. Đặt lên kệ bếp cạnh bình cà phê.

Sáng hôm sau cô dùng theo hướng dẫn.

Ngày đầu không cảm thấy gì. Ngày thứ hai cũng vậy. Ngày thứ ba cô gần như đã quên.

Aishah có thói quen quên đi những thứ không gây ra phản ứng tức thì.

Có lẽ điều đó cũng giải thích nhiều chuyện khác.`,
  },

  // ─── Section 8: micro-reward · long-flowing · emotional-contrast ──
  'subtle-change': {
    title: 'Cô không nhớ chính xác ngày nào',
    copy:
`Aishah không nhớ chính xác ngày nào mọi thứ bắt đầu khác đi — đó là điều cô vẫn nói khi sau này có ai hỏi.

Có thể là sáng thứ Tư tuần thứ ba — khi cô tỉnh dậy lúc năm giờ ba mươi và không cần bấm "ngủ thêm mười phút" trên đồng hồ. Cô để ý điều đó nhưng không nghĩ nhiều — cứ tưởng là tình cờ.

Có thể là chiều thứ Sáu — khi ba giờ trôi qua, và cô không nghĩ đến ly cà phê thứ ba. Mãi đến chiều thứ Bảy cô mới nhận ra mình đã không pha cà phê chiều hai ngày liên tiếp.

Hoặc tối Chủ Nhật, khi cô ngồi vẽ với con gái lớn đến chín giờ, và mí mắt vẫn không nặng.

Những thay đổi nhỏ. Không kịch tính. Cũng không "khỏi hẳn".

Chỉ là — không còn ngồi lâu trước bàn trang điểm vào buổi tối.`,
  },

  // ─── Section 9: calm-payoff · mixed · reveal-delay ───────────────
  'new-normal': {
    title: 'Bây giờ là tháng Tám',
    copy:
`Bây giờ là tháng Tám.

Cửa hàng vẫn mở từ bảy giờ. Tụi nhỏ vẫn đi học. Chồng vẫn rẽ ra khỏi ngõ lúc bảy giờ ba mươi.

Khác là — Aishah không còn đứng nhìn theo lâu hơn cần thiết nữa.

Cuối tuần cô đi chợ sớm, ghé hàng quen, đôi khi mang hoa về cắm trên bàn ăn. Việc nhỏ — nhưng cô nhớ là sáu tháng trước cô không có sức để nghĩ đến chuyện hoa.

Tuần trước chồng cô có nói một câu. Anh không nhớ — Aishah hỏi lại và anh không nhớ.

Cô nói: "Em ngủ ngon."`,
  },

  // ─── Section 10: quiet-closure · conversational · null retention ──
  'sharing-invitation': {
    title: 'Nếu bạn cũng từng…',
    copy:
`Câu chuyện của Aishah đến đây là hết.

Tôi không biết câu chuyện của bạn đang ở đâu — giữa Chương Ba và Chương Bốn, có lẽ. Hoặc đâu đó cô không có tên.

Nếu bạn cũng từng có cảm giác mệt vô cớ vào ba giờ chiều, từng pha ly cà phê thứ ba và tự hỏi "có phải mình đang già rồi không" — có lẽ chúng ta hiểu nhau hơn bạn nghĩ.

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
