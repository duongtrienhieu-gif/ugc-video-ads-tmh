// ── Mode 3 — Personified Studio — Constants (KB library, scene labels, cost) ──
import type {
  ArchetypeId, HeroType, CtaStyle, VideoLength, SceneType, ClipDuration, TargetMarket,
} from './types'

/** Nhịp đọc GỐC (1.0x) theo thị trường: VN đơn-âm (~3.3 từ/s); MY đa-âm-tiết
 *  CHẬM hơn (~2.4 từ/s). */
export const WORDS_PER_SEC: Record<TargetMarket, number> = { VN: 3.3, MY: 2.4 }

/** Tốc độ phát giọng chuẩn = 1.2x (atempo — GIỮ cao độ, không "giọng chuột").
 *  Cho phép kịch bản dày hơn ~20%/clip + nhịp năng động kiểu UGC. P3/P4 PHẢI
 *  phát ở đúng tốc độ này để khớp ước lượng. Trần ~1.25x (quá là mất chất giọng). */
export const EXPRESSIVE_SPEED = 1.2

/** Nhịp HIỆU DỤNG (đã tính speed) — dùng cho cả ước lượng giây lẫn budget số từ. */
export function playbackWps(market: TargetMarket): number {
  return WORDS_PER_SEC[market] * EXPRESSIVE_SPEED
}

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
    'KHUÔN KB1 — QUÁI VẬT XÂM LƯỢC (nhịp PHIM QUÁI VẬT). Người dẫn = VILLAIN nhìn-thấy-được. Nhân vật = villain + hero(SP); tối đa 1 phụ = organ-bị-hại HOẶC bỏ — TUYỆT ĐỐI KHÔNG vừa nạn-nhân-người VỪA organ; KHÔNG sidekick. CTA do HERO (hoặc villain lúc bỏ chạy). ' +
    'SHAPE: (1) MỞ MÀN villain đang TÀN PHÁ + cười nhạo, khịa thẳng "tao-mày"; (2) LEO THANG — villain khoe đã phá HỎNG 1 KHOẢNH KHẮC ĐỜI THẬT cụ thể của chủ (vd nghe con gọi điện không rõ, ngại chỗ đông), CẤM chung chung "đời mày tiêu"; (3) hero xông vào, villain CƯỜI KHẨY / phản công trước (coi thường); (4) cơ chế SP giáng đòn → villain CHỐNG CỰ rồi mới thua, vừa tan vừa KHAI tên SP/hoạt chất; (5) kết quả sạch đẹp; (6) CTA. Climax = villain kháng cự rồi MỚI bại — KHÔNG thua tức thì.',
  KB2_inner_demon:
    'KHUÔN KB2 — QUỶ TÂM LÝ (nhịp THRILLER TÂM LÝ). Villain LUÔN tấn công CHIỀU TÂM LÝ/CẢM XÚC của vấn đề (tự ti / lo / XẤU HỔ / sợ ánh nhìn đám đông). ⚠️ Kể cả vấn đề THỂ CHẤT (ho/khớp/mụn/hôi miệng) cũng phải đánh qua nỗi XẤU HỔ-lo nó GÂY RA (vd ho giữa cuộc họp → quỷ nuôi nỗi XẤU HỔ + ánh mắt người xung quanh — KHÔNG phải con-ho thể chất, đó là KB1). Người dẫn = VILLAIN trừu tượng. BẮT BUỘC có NGƯỜI THẬT (nạn nhân ở gương/giường/giữa đám đông) — không có người thì KB2 vô nghĩa. KHÔNG organ; KHÔNG sidekick. CTA do hero hoặc người-vừa-thoát. ' +
    'SHAPE: (1) quỷ THÌ THẦM vào tai người thật 1 nỗi tự ti/lo CỤ THỂ lúc yếu lòng (2h sáng / soi gương); (2) người thật LÚN sâu, quỷ lớn dần bám chặt (leo thang NỘI TÂM); (3) người chạm tới SP = bước ngoặt tự cứu; (4) quỷ GÀO / co rúm khi bị "bỏ đói"/đánh tan — CHỐNG CỰ trước khi vỡ; (5) người THỞ PHÀO, nhẹ nhõm (kết quả là sự GIẢI THOÁT cảm xúc, không chỉ "sạch"); (6) CTA. Climax = lựa chọn của người + quỷ giãy chết.',
  KB3_grumpy_organ:
    'KHUÔN KB3 — BỘ PHẬN CẰN NHẰN (nhịp ĐỘC THOẠI SITCOM). Người dẫn = CHÍNH ORGAN, mắng CHỦ (chủ = người xem, KHÔNG hiện thành nhân vật). Nhân vật = organ + hero (+ tùy chọn 1 villain nhỏ cho cảnh tan rã đã mắt); KHÔNG nạn-nhân-người; KHÔNG sidekick. CTA do CHÍNH organ. ' +
    'SHAPE: (1) organ MỞ bằng 1 câu cằn nhằn DUYÊN + ẩn dụ công sở/xây dựng (gag chạy XUYÊN video); (2) LIỆT KÊ leo thang các "tội" CỤ THỂ của chủ (ăn khuya, lười uống nước…) — có thái độ, đá xoáy; (3) organ RA TỐI HẬU THƯ ("tao đình công!"); (4) chủ mang SP tới, organ THỬ với vẻ HOÀI NGHI; (5) organ QUAY XE 180° khen miễn cưỡng, CALLBACK gag mở màn; (6) CTA do organ. Climax = từ đình công → chịu SP, twist hài.',
  KB4_ingredient_battle:
    'KHUÔN KB4 — KHOE VŨ KHÍ HOẠT CHẤT (nhịp BOSS-FIGHT game). Người dẫn = VILLAIN (như boss có "máu/HP"). Nhân vật = villain + hero (tối đa 1 phụ); KHÔNG sidekick. CTA do hero. ' +
    'SHAPE: (1) villain vênh váo "tao BẤT BẠI" + khịa; (2) hero vào trận; (3) MỖI hoạt chất = 1 ĐÒN COMBO riêng (application, TỐI ĐA 3 cảnh, gộp 2 hoạt chất/cảnh nếu >3): mỗi đòn villain TỤT MÁU + HOẢNG dần + tự KHAI tên+công dụng hoạt chất ĐÚNG LÚC trúng đòn (KHÔNG khai trước/ở rootcause); (4) hoạt chất cuối = đòn KẾT LIỄU, villain NỔ TUNG; (5) kết quả; (6) CTA. Climax = máu villain tụt dần + hoảng leo thang — KHÔNG thua 1 phát.',
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

/** Budget số từ/cảnh — tính từ nhịp hiệu dụng (đã gồm speed 1.2x). Đệm ~1.5s ở
 *  cảnh 8s để khỏi cắt chữ. Tự đồng bộ khi đổi WORDS_PER_SEC / EXPRESSIVE_SPEED. */
export function wordBudgetHint(market: TargetMarket): string {
  const w = playbackWps(market)
  const max4 = Math.round(3.4 * w)   // cảnh 4s: nói ≤3.4s
  const max8 = Math.round(6.5 * w)   // cảnh 8s: nói ≤6.5s (chừa ~1.5s đệm)
  const tail = market === 'MY' ? ' (Mã đọc lâu hơn — đừng tràn)' : ''
  return `cảnh 4s ≈ ${Math.round(max4 * 0.55)}-${max4} từ · cảnh 8s ≈ ${Math.round(max8 * 0.6)}-${max8} từ. TỐI ĐA ~${max8} từ/cảnh${tail}.`
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
