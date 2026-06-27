// ── Mode 3 — Xưởng Nhân Vật Hoá 3D (Personified Problem Studio) — Types ───────
// Video quảng cáo nhân cách hóa vấn đề / bộ phận cơ thể 3D (kiểu mụn-có-mặt,
// dạ-dày-công-nhân). Đứng ĐỘC LẬP mode 1-2, chỉ đọc product bank.
//
// P1 (bản này) = BRAIN + simulator TEXT-ONLY: phân tích insight → sinh kịch bản
// (storyboard + full-text voice script song ngữ, snap duration 4/8/12). CHƯA gọi
// model ảnh/video — đó là P2/P3.
// ─────────────────────────────────────────────────────────────────────────────

/** Thị trường đích. Product bank luôn nguồn VN; khi MY → engine sinh thoại tiếng
 *  Mã + LUÔN kèm bản dịch nghĩa VN (viGloss) cho operator duyệt. */
export type TargetMarket = 'VN' | 'MY'

export const TARGET_MARKET_GEMINI_NAME: Record<TargetMarket, string> = {
  VN: 'Vietnamese',
  MY: 'Bahasa Malaysia (Malay)',
}
export const TARGET_MARKET_LABEL: Record<TargetMarket, string> = {
  VN: 'Việt Nam',
  MY: 'Malaysia',
}

/** 4 Kiểu kịch bản pickable (rút từ 9 video mẫu). */
export type ArchetypeId =
  | 'KB1_invader'          // Quái Vật Xâm Lược — phản diện hung hăng dọa → SP diệt
  | 'KB2_inner_demon'      // Quỷ Tâm Lý — thực thể trừu tượng + người thật + gương
  | 'KB3_grumpy_organ'     // Bộ Phận Cằn Nhằn — organ tự kể, mắng chủ, ẩn dụ công sở
  | 'KB4_ingredient_battle'// Khoe Vũ Khí Hoạt Chất — mỗi hoạt chất 1 cảnh, villain tự khai

/** SẢN PHẨM THẬT LUÔN là hero (app bán hàng) và được NHÂN CÁCH HÓA — thêm mắt
 *  biểu cảm + tay nhỏ thành "hiệp sĩ" NHƯNG GIỮ NGUYÊN bao bì/nhãn/màu/dáng thật
 *  (khóa bằng 4 ảnh ở P2). Trục này = hiệp-sĩ-sản-phẩm ra tay kiểu gì. */
export type HeroType =
  | 'product_knight'    // sản phẩm hóa hiệp sĩ tự tay diệt phản diện (mặc định)
  | 'ingredient_weapon' // hiệp sĩ vung hoạt chất (tia/luồng) làm vũ khí (serum/multi-ingredient)
  | 'helper_army'       // hiệp sĩ chỉ huy đạo quân lợi khuẩn/vi hạt ùa ra (probiotic/collagen)

/** Mọi CTA đều CHỐT ĐƠN (app bán hàng) — chỉ khác cách dẫn. Luôn kết bằng packshot
 *  sản phẩm thật + kêu mua + giỏ/link dưới + disclaimer "tùy cơ địa". */
export type CtaStyle =
  | 'villain_flees'       // phản diện thua bỏ chạy → chốt "đặt ngay, link dưới"
  | 'reverse_psych'       // "đừng bấm giỏ hàng" (reverse-psych, vẫn chốt đơn)
  | 'sidekick_disclaimer' // sidekick chốt giỏ + disclaimer cơ địa

export type VideoLength = 'short' | 'medium' | 'long' // 5 / 7 / 9 cảnh

/** Mỗi cảnh chỉ 4s HOẶC 8s (bỏ 12s — phá nhịp punchy của format). */
export type ClipDuration = 4 | 8

export interface PersonifiedConfig {
  archetype: ArchetypeId
  length: VideoLength
  heroType: HeroType
  falseSolution: boolean   // bật cảnh "đồ thường thất bại → phản diện mạnh thêm"
  ctaStyle: CtaStyle
}

/** Mô tả tone giọng vùng miền — nhồi nguyên văn vào mọi cảnh có nhân vật đó để
 *  giữ giọng nhất quán toàn video (đây là thách thức #1 của Veo/TTS). */
export interface VoiceProfile {
  vungMien: string   // 'Nam Bộ' | 'Bắc Bộ' | 'Trung' | 'Standard Malay'…
  gioiTinh: 'nam' | 'nu'
  tuoi: string       // 'trẻ' | 'trung niên'…
  pitch: string      // 'trầm' | 'cao'…
  texture: string    // 'khàn/gravelly' | 'mượt'…
  tinhCach: string   // 'hung hăng khịa đểu' | 'cằn nhằn duyên'…
}

export type CharacterRole = 'villain' | 'hero' | 'organ' | 'sidekick'

export interface PersonifiedCharacter {
  role: CharacterRole
  name: string           // tên gọi nội bộ ("Quỷ Mụn", "Tuýp Hiệp Sĩ")
  represents: string     // nhân cách hóa cái gì
  appearance: string     // hình dạng, màu, chất liệu bề mặt
  renderStyle: string    // 3D Pixar + nền cơ thể tả thực…
  voice: VoiceProfile
  imagePromptEn: string  // prompt EN tạo ảnh nhân vật (dùng ở P2)
}

export type SceneType =
  | 'challenger' | 'rootcause' | 'agitation' | 'false_solution'
  | 'hero_entrance' | 'application' | 'destruction'
  | 'social_proof' | 'result' | 'cta'

export interface PersonifiedScene {
  idx: number
  sceneType: SceneType
  clipDuration: ClipDuration
  /** Cảnh có SẢN PHẨM THẬT trong khung không → P2 render bằng gpt-4o-image + 4 ảnh
   *  sản phẩm để khóa fidelity bao bì (đúng luật "preserve product" của repo). */
  hasProduct: boolean
  speaker: string          // tên/role nhân vật nói
  dialoguePrimary: string  // thoại ngôn ngữ ĐÍCH (đưa vào TTS/render)
  dialogueVi: string       // bản dịch nghĩa VN (operator đọc; = primary nếu market VN)
  emotion: string
  camera: string
  sfx: string[]
  action: string           // chuyện gì xảy ra trên màn hình
  videoPromptEn: string    // prompt i2v cho cảnh (dùng ở P3)
}

export interface ProductInsight {
  productInsight: string       // USP, hoạt chất, cơ chế, điểm khác biệt
  customerInsight: string      // chân dung, nỗi đau, nỗi sợ, insecurity
  painCore: string             // nỗi đau cốt lõi 1 câu
  metaphor: string             // ẩn dụ chọn (xâm lược / công trường / quỷ tâm lý…)
  recommendedArchetype: ArchetypeId
  reasonVi: string             // vì sao gợi ý KB đó
}

export interface PersonifiedScript {
  insight: ProductInsight
  characters: PersonifiedCharacter[]
  /** Biome cố định (EN) cho TOÀN video — mọi keyframe diễn trong cùng thế giới này
   *  (vd khớp viêm: sụn bóng, đầu xương, mô đỏ sưng). Nhồi vào prompt mọi cảnh → nhất
   *  quán bối cảnh như video mẫu. Brain sinh từ metaphor/bộ phận cơ thể. */
  worldEnv: string
  scenes: PersonifiedScene[]
  fullVoiceScriptPrimary: string // toàn bộ thoại liền mạch — ngôn ngữ đích
  fullVoiceScriptVi: string      // toàn bộ thoại liền mạch — VN (operator)
  totalSec: number
}
