// ── Mode 3 — Personified Studio — Constants (KB library, scene labels, cost) ──
import type {
  ArchetypeId, HeroType, CtaStyle, VideoLength, SceneType, ClipDuration,
} from './types'

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

// ── Module toggles ───────────────────────────────────────────────────────────
export const HERO_TYPE_LABEL: Record<HeroType, string> = {
  product_savior:   'Sản phẩm thật bay ra cứu nguy',
  ingredient_burst: 'Hoạt chất bung ra từ sản phẩm',
  helper_army:      'Đạo quân lợi khuẩn từ sản phẩm',
}

/** SẢN PHẨM THẬT luôn là hero — trục này = cách sản phẩm thật RA TAY. Mọi kiểu GIỮ
 *  NGUYÊN bao bì thật (khóa bằng 4 ảnh ở P2), không thêm mặt/tay. */
export const HERO_TYPE_DESC: Record<HeroType, string> = {
  product_savior:   'Tuýp/chai/hộp THẬT bay vào khung + hào quang/foam/tia phun ra diệt phản diện. Giữ y bao bì thật — an toàn, hợp đa số sản phẩm.',
  ingredient_burst: 'Sản phẩm thật mở ra, HOẠT CHẤT (tia/luồng) bung ra thành "vũ khí" diệt phản diện — hợp serum / sản phẩm nhiều hoạt chất (đi cùng KB4).',
  helper_army:      'Đám lợi khuẩn / vi hạt nhỏ ÙA RA TỪ sản phẩm thật để dọn dẹp — hợp probiotic / collagen / men vi sinh. Bao bì sản phẩm vẫn hiện thật.',
}

/** Giải thích cảnh FalseSolution cho user. */
export const FALSE_SOLUTION_DESC =
  'Chèn 1 cảnh: cách chữa THƯỜNG (nước muối, kem thường, rửa bên ngoài…) tỏ ra VÔ DỤNG hoặc làm nặng thêm — rồi sản phẩm mới ra tay. Đòn tâm lý "đồ khác thua, chỉ cái này được".'

export const CTA_STYLE_LABEL: Record<CtaStyle, string> = {
  villain_flees:       'Phản diện thua → "đặt ngay, link dưới"',
  reverse_psych:       '"Đừng bấm giỏ hàng" (reverse-psych)',
  sidekick_disclaimer: 'Sidekick chốt giỏ + disclaimer',
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

/** Seedance chỉ đẻ 4/8/12s. Chọn mức NHỎ NHẤT đủ chứa lời thoại (chừa ~0.8s thở). */
export function pickClipDuration(speechSec: number): ClipDuration {
  const needed = Math.max(1, speechSec) + 0.8
  return needed <= 4 ? 4 : needed <= 8 ? 8 : 12
}

/** Ước thời lượng nói (giây) từ số từ — tiếng Việt theatrical ~3.3 từ/giây. */
export function estimateSpeechSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, words / 3.3)
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
