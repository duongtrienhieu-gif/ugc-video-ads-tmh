// ── Mode 3 — Personified Studio — Constants (KB library, scene labels, cost) ──
import type {
  ArchetypeId, HeroType, CtaStyle, VideoLength, SceneType, ClipDuration, TargetMarket,
} from './types'

/** Nhịp nói theo thị trường: VN đơn-âm (~3.3 từ/s) đọc nhanh; MY đa-âm-tiết đọc
 *  CHẬM hơn (~2.4 từ/s). Dùng 3.3 cho MY sẽ ước lượng hụt → cắt chữ ở cảnh 8s. */
export const WORDS_PER_SEC: Record<TargetMarket, number> = { VN: 3.3, MY: 2.4 }

// ── 4 Kiểu kịch bản (pickable) ───────────────────────────────────────────────
export interface ArchetypeDef {
  id: ArchetypeId
  labelVi: string
  taglineVi: string
  whenVi: string        // hợp ngách/vấn đề nào
  narratorVi: string    // ai dẫn chuyện + giọng
  exampleVi: string     // ví dụ từ 9 video
  emoji: string
  /** Hint nhồi vào prompt brain — đặc trưng cấu trúc + giọng của kiểu này. */
  brainHint: string
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
  KB1_invader: {
    id: 'KB1_invader',
    labelVi: 'Quái Vật Xâm Lược',
    taglineVi: 'Phản diện hung hăng dọa thẳng mặt → sản phẩm tiêu diệt',
    whenVi: 'Vấn đề NHÌN THẤY được: mụn, sỏi, nấm da, viêm, mảng bám',
    narratorVi: 'Phản diện kể chuyện, giọng "tao–mày" hung hăng, khịa đểu',
    exampleVi: 'Mụn cóc có mặt · sỏi amidan · viêm nang lông',
    emoji: '👹',
    brainHint:
      'Villain is a VISIBLE personified pathogen/object living on the body surface, aggressive and ' +
      'mocking, taunts the viewer directly ("tao–mày"). A HERO product arrives and destroys it. ' +
      'Villain often NARRATES its own defeat, naming the product/ingredient as it loses.',
  },
  KB2_inner_demon: {
    id: 'KB2_inner_demon',
    labelVi: 'Quỷ Tâm Lý',
    taglineVi: 'Thực thể trừu tượng dày vò nỗi đau tinh thần, có người thật + gương',
    whenVi: 'Vấn đề VÔ HÌNH: mất ngủ, lo âu, tự ti, stress, mệt mỏi',
    narratorVi: 'Phản diện trừu tượng thao túng/châm chọc tâm lý nạn nhân (người thật)',
    exampleVi: 'Quỷ tự ti vì mụn (soi gương) · quái vật mất ngủ 2h sáng',
    emoji: '🌑',
    brainHint:
      'Villain is an ABSTRACT entity embodying a psychological pain (insecurity, insomnia, anxiety). ' +
      'A real human victim is present (mirror / bed). The demon manipulates and taunts the victim ' +
      'psychologically; the product breaks the demon and frees the person.',
  },
  KB3_grumpy_organ: {
    id: 'KB3_grumpy_organ',
    labelVi: 'Bộ Phận Cằn Nhằn',
    taglineVi: 'Bộ phận cơ thể tự kể khổ, mắng chủ lười, ẩn dụ công sở/xây dựng',
    whenVi: 'Nội tạng / tiêu hóa / phụ khoa — vừa bán vừa viral',
    narratorVi: 'Chính bộ phận cơ thể dẫn chuyện, giọng "tui–sếp/bà", cằn nhằn duyên',
    exampleVi: 'Dạ dày công nhân đình công · tử cung bà chủ nhà',
    emoji: '🫃',
    brainHint:
      'The NARRATOR is the body organ itself, personified as a fed-up worker / landlord who scolds the ' +
      'OWNER (the user) for bad habits, using workplace/construction metaphors ("đình công", "đổ bê tông", ' +
      '"xả lũ axit"). Voice "tui–sếp/bà", sassy but caring. Product = reinforcement it demands.',
  },
  KB4_ingredient_battle: {
    id: 'KB4_ingredient_battle',
    labelVi: 'Khoe Vũ Khí Hoạt Chất',
    taglineVi: 'Mỗi hoạt chất = 1 vũ khí/1 cảnh; villain tự khai công dụng lúc thua',
    whenVi: 'Sản phẩm NHIỀU hoạt chất cần khoe: serum, viên uống multi-ingredient',
    narratorVi: 'Phản diện + hero "vũ khí", nhịp battle gamified',
    exampleVi: 'AHA/BHA/PHA = khiên, Niacinamide = xích, B5 = hơi chữa lành',
    emoji: '⚔️',
    brainHint:
      'Gamified BATTLE: each active ingredient becomes a distinct WEAPON in its own Application scene ' +
      '(shield / chains / laser / healing mist). The villain narrates its defeat, NAMING each ingredient ' +
      'and its benefit as that weapon hits it. One Application scene per key ingredient.',
  },
}

export const ARCHETYPE_ORDER: ArchetypeId[] = [
  'KB1_invader', 'KB2_inner_demon', 'KB3_grumpy_organ', 'KB4_ingredient_battle',
]

/** KHUÔN CỨNG mỗi KB — nhồi vào brain để khóa: ai dẫn chuyện, nhân vật nào
 *  bắt buộc/cấm, ai làm CTA. Giải quyết gốc loạn-nhân-vật + pick-không-khóa. */
export const ARCHETYPE_STRUCTURE: Record<ArchetypeId, string> = {
  KB1_invader:
    'KHUÔN KB1: Người dẫn = VILLAIN (quái vật NHÌN THẤY được). Nhân vật = villain + hero(sản phẩm). Tối đa 1 nhân vật phụ = bộ-phận-bị-hại (organ) HOẶC bỏ — TUYỆT ĐỐI KHÔNG vừa có người-nạn-nhân VỪA có organ. CTA do HERO tự chốt (hoặc villain lúc bỏ chạy). KHÔNG tạo nhân vật sidekick/trợ-lý riêng.',
  KB2_inner_demon:
    'KHUÔN KB2 (CHỈ cho vấn đề VÔ HÌNH — mất ngủ/lo âu/tự ti/stress/mệt mỏi): Người dẫn = VILLAIN (thực thể tâm lý trừu tượng). Nhân vật = villain + NGƯỜI THẬT (nạn nhân, ở gương/giường) + hero. KHÔNG tạo organ-bộ-phận. CTA do hero hoặc người-vừa-được-giải-thoát. KHÔNG sidekick riêng.',
  KB3_grumpy_organ:
    'KHUÔN KB3: Người dẫn = CHÍNH BỘ PHẬN CƠ THỂ (organ) — tự kể khổ + mắng CHỦ (chủ = người xem, KHÔNG hiện thành nhân vật). Nhân vật = organ + hero (+ tùy chọn 1 villain nhỏ = vấn đề nhân cách hóa, để cảnh tan rã đã mắt). KHÔNG tạo người-nạn-nhân riêng. CTA do CHÍNH organ tự chốt (mạch nhất) hoặc hero. KHÔNG sidekick riêng.',
  KB4_ingredient_battle:
    'KHUÔN KB4: Người dẫn = VILLAIN, phải KHAI TÊN từng hoạt chất ĐÚNG LÚC BỊ ĐÁNH/THUA (cảnh application/destruction) — KHÔNG khai ở rootcause. Nhân vật = villain + hero (tối đa 1 phụ). application = 1 cảnh/hoạt chất nhưng TỐI ĐA 3 cảnh hoạt chất (gộp 2 hoạt chất/cảnh nếu sản phẩm có >3). CTA do hero. KHÔNG sidekick riêng.',
}

/** Luật nhân vật + personify dùng chung mọi KB. */
export const SHARED_CHAR_RULES =
  'NHÂN VẬT (chung): TỐI ĐA 3 nhân vật có thoại. Mỗi nhân vật phải có ≥2 câu trong cả video — vai nào chỉ nói 1 câu thì GỘP vào nhân vật khác. KHÔNG đẻ nhân vật mới chỉ để đọc CTA.'

export const HERO_FORMFACTOR_RULE =
  'HERO theo DẠNG sản phẩm: dạng ĐỰNG (chai/tuýp/hũ/lọ/hộp/vỉ/gói/gel/serum/kem/viên) → nhân cách hóa thêm MẮT biểu cảm + TAY nhỏ (hiệp sĩ). Dạng ĐEO/THIẾT BỊ (đai/máy/miếng dán/belt) → KHÔNG ép mặt người; nhân cách hóa kiểu "khí cụ anh hùng" biến hình/phát sáng/bung cơ chế (tối đa thêm đôi mắt nhỏ nếu hợp). LUÔN giữ bao bì/nhãn/màu/dáng thật — vẫn nhận ra đúng sản phẩm.'

// ── Module toggles ───────────────────────────────────────────────────────────
export const HERO_TYPE_LABEL: Record<HeroType, string> = {
  product_knight:    'Sản phẩm hóa hiệp sĩ (mắt/tay)',
  ingredient_weapon: 'Hiệp sĩ tung hoạt chất',
  helper_army:       'Hiệp sĩ + đạo quân lợi khuẩn',
}

/** SẢN PHẨM THẬT luôn là hero, được NHÂN CÁCH HÓA (thêm mắt + tay nhỏ) NHƯNG GIỮ
 *  nguyên bao bì/nhãn/màu/dáng thật (khóa bằng 4 ảnh ở P2). Trục này = hiệp-sĩ ra tay kiểu gì. */
export const HERO_TYPE_DESC: Record<HeroType, string> = {
  product_knight:    'Sản phẩm thật được nhân cách hóa thành HIỆP SĨ — thêm mắt biểu cảm + tay nhỏ, NHƯNG giữ nguyên bao bì/nhãn/màu/dáng thật. Tự tay xịt/đánh diệt phản diện. Đúng kiểu 9 video mẫu.',
  ingredient_weapon: 'Sản phẩm-hiệp sĩ VUNG hoạt chất (tia/luồng) làm vũ khí — hợp serum / sản phẩm nhiều hoạt chất (đi cùng KB4).',
  helper_army:       'Sản phẩm-hiệp sĩ chỉ huy ĐẠO QUÂN lợi khuẩn/vi hạt ùa ra dọn dẹp — hợp probiotic / collagen / men vi sinh.',
}

/** Giải thích cảnh FalseSolution cho user. */
export const FALSE_SOLUTION_DESC =
  'Chèn 1 cảnh: cách chữa THƯỜNG (nước muối, kem thường, rửa bên ngoài…) tỏ ra VÔ DỤNG hoặc làm nặng thêm — rồi sản phẩm mới ra tay. Đòn tâm lý "đồ khác thua, chỉ cái này được".'

export const CTA_STYLE_LABEL: Record<CtaStyle, string> = {
  villain_flees:       'Phản diện thua → "đặt ngay, link dưới"',
  reverse_psych:       '"Đừng bấm giỏ hàng" (reverse-psych)',
  sidekick_disclaimer: 'Hero chốt giỏ + disclaimer',
}

export const LENGTH_LABEL: Record<VideoLength, string> = {
  short:  'Ngắn (~5 cảnh · 28-40s)',
  medium: 'Vừa (~7 cảnh · 42-58s)',
  long:   'Dài (~9 cảnh · 55-72s)',
}
export const LENGTH_SCENE_COUNT: Record<VideoLength, number> = { short: 5, medium: 7, long: 9 }
/** Target tổng giây để brain bám (viết thoại đủ ngắn) — mỗi cảnh ~6-7s trung bình. */
export const LENGTH_TARGET_SEC: Record<VideoLength, number> = { short: 32, medium: 48, long: 60 }

// ── Scene types ──────────────────────────────────────────────────────────────
export const SCENE_TYPE_LABEL: Record<SceneType, string> = {
  challenger:    'Hook khịa',
  rootcause:     'Khoe cách gây hại',
  agitation:     'Làm nặng thêm',
  false_solution:'Đồ thường thất bại',
  hero_entrance: 'Sản phẩm xuất hiện',
  application:   'Tác động / hoạt chất',
  destruction:   'Tan rã',
  social_proof:  'Review 5★',
  result:        'Kết quả sạch đẹp',
  cta:           'Chốt đơn',
}

// ── Cost / duration (Mode 3 standalone — số liệu copy từ video-builder/v3, đã
//    verify với KIE pricing 2026-06-09). Giữ riêng để Mode 3 không phụ thuộc v3. ─
export const CREDIT_USD = 0.005              // ~$0.005 / credit
export const VND_PER_USD = 25_000            // theo benchmark user (6k = $0.24)

export type RenderTier = 'seedance720' | 'grok480'
export const RENDER_TIER_LABEL: Record<RenderTier, string> = {
  seedance720: 'Seedance 720p (đẹp · backbone)',
  grok480:     'Grok 480p (nháp · rẻ)',
}
/** credit / giây i2v (no-audio). Seedance 720p 3.5 · Grok 480p ~1.6. */
const I2V_CR_PER_SEC: Record<RenderTier, number> = { seedance720: 3.5, grok480: 1.6 }
const KEYFRAME_CR = 6                         // 1 ảnh keyframe gpt-4o-image ≈ 6cr

/** Mỗi cảnh chỉ 4s hoặc 8s (bỏ 12s). Thoại ngắn → 4s, còn lại 8s. */
export function pickClipDuration(speechSec: number): ClipDuration {
  return Math.max(1, speechSec) + 0.6 <= 4 ? 4 : 8
}

/** hasProduct được tính DETERMINISTIC theo sceneType (KHÔNG để AI đoán) — chỉ cảnh
 *  có SẢN PHẨM THẬT mới true để P2 khóa fidelity. FalseSolution = hàng generic nên
 *  KHÔNG tính (false). */
export const SCENE_HAS_PRODUCT = new Set<SceneType>(['hero_entrance', 'application', 'result', 'cta'])

/** Ước thời lượng nói (giây) từ số từ, theo nhịp của thị trường (truyền WORDS_PER_SEC[market]). */
export function estimateSpeechSec(text: string, wordsPerSec = 3.3): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, words / wordsPerSec)
}

/** Budget số từ/cảnh theo market — đệm an toàn ~1.5s ở cảnh 8s để khỏi cắt chữ. */
export function wordBudgetHint(market: TargetMarket): string {
  return market === 'MY'
    ? 'cảnh 4s ≈ 5-8 từ · cảnh 8s ≈ 10-16 từ. TỐI ĐA ~16 từ/cảnh (tiếng Mã đa âm tiết đọc lâu — viết ngắn để khỏi CẮT CHỮ ở cuối).'
    : 'cảnh 4s ≈ 6-11 từ · cảnh 8s ≈ 13-21 từ. TỐI ĐA ~21 từ/cảnh.'
}

export interface CreditEstimate { credits: number; usd: number; vnd: number }

/** Tổng credit 1 video = mỗi cảnh (1 keyframe + i2v theo clipDuration). */
export function estimateProjectCredits(
  clipDurations: ClipDuration[], tier: RenderTier,
): CreditEstimate {
  const i2v = clipDurations.reduce((sum, d) => sum + Math.round(I2V_CR_PER_SEC[tier] * d), 0)
  const credits = clipDurations.length * KEYFRAME_CR + i2v
  const usd = credits * CREDIT_USD
  return { credits, usd, vnd: Math.round(usd * VND_PER_USD) }
}

export function formatCreditEstimate(e: CreditEstimate): string {
  return `~${e.credits} credit (~$${e.usd.toFixed(2)} · ~${e.vnd.toLocaleString('vi-VN')}đ)`
}
