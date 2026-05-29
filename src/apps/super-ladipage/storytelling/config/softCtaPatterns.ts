// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — SOFT CTA PATTERNS (v4.5)
//
// Section 11 (soft-cta) tone library. Human invitation, NOT marketing CTA.
//
// GOAL: reader cảm thấy như một người bạn đang nói chuyện với mình lần
// cuối trước khi gác máy — KHÔNG phải "click here to buy".
//
// "Bạn không phải người duy nhất trải qua cảm giác đó." ← target tone
// ─────────────────────────────────────────────────────────────────────

export type SoftCtaTone =
  | 'peer-acknowledgment'        // "Bạn không phải người duy nhất..."
  | 'gentle-permission'          // "Có lẽ bạn cũng có quyền dừng lại..."
  | 'shared-experience-close'    // "Tôi viết cái này vì..."
  | 'quiet-invitation'           // "Nếu bạn cũng đang ở giai đoạn đó..."

export interface SoftCtaToneSpec {
  tone: SoftCtaTone
  description: string
  /** Vietnamese style references — tone refs, NOT mandatory templates. */
  examples: string[]
}

export const SOFT_CTA_TONES: Record<SoftCtaTone, SoftCtaToneSpec> = {
  'peer-acknowledgment': {
    tone: 'peer-acknowledgment',
    description: 'Khẳng định reader không một mình — như một người bạn',
    examples: [
      'Tôi chỉ muốn nói: bạn không phải người duy nhất trải qua cảm giác đó.',
      'Có rất nhiều người cũng đang ở đó. Bạn không một mình.',
      'Cảm giác đó — tôi cũng từng. Và tôi biết nhiều người khác cũng vậy.',
    ],
  },
  'gentle-permission': {
    tone: 'gentle-permission',
    description: 'Trao reader quyền dừng lại, không phải cố chịu',
    examples: [
      'Có lẽ điều bạn cần không phải là "cố chịu thêm".',
      'Bạn có quyền dừng lại và tìm một cách khác.',
      'Không phải ai cũng cần phải gánh chuyện này một mình.',
    ],
  },
  'shared-experience-close': {
    tone: 'shared-experience-close',
    description: 'Kết bằng lý do narrator viết — chia sẻ thật, không bán hàng',
    examples: [
      'Tôi viết những dòng này không phải để quảng cáo gì. Chỉ là tôi nghĩ — nếu có ai đang ở đó, có thể câu chuyện của tôi sẽ giúp được.',
      'Câu chuyện của tôi đến đây là hết. Câu chuyện của bạn có thể đang ở giữa Chương 3.',
      'Tôi không biết bạn đang ở giai đoạn nào. Nhưng nếu giống tôi 6 tháng trước, thì tôi mong những dòng này có ích.',
    ],
  },
  'quiet-invitation': {
    tone: 'quiet-invitation',
    description: 'Lời mời thật nhẹ — KHÔNG urgency, KHÔNG benefit push',
    examples: [
      'Nếu bạn cũng đang ở giai đoạn mà mỗi sáng thức dậy thấy người nặng nề hơn...',
      'Nếu bạn từng nhìn vào gương và tự hỏi "có phải mình đang già rồi không"...',
      'Nếu bạn cũng từng có cảm giác tương tự — có lẽ chúng ta hiểu nhau hơn bạn nghĩ.',
    ],
  },
}

// ═══ BANNED PATTERNS (extending bannedPhraseDetector logic) ═══════════

/** Patterns BANNED in section 11. Stricter than global bannedPhraseDetector. */
export const SOFT_CTA_BANNED_PATTERNS = [
  // Direct hard-sell
  'đặt hàng ngay',
  'mua ngay',
  'click ngay',
  'click vào đây',
  'liên hệ ngay',
  'ưu đãi đang chờ',
  // FOMO / urgency
  'chỉ còn',
  'cơ hội cuối',
  'đừng bỏ lỡ',
  'số lượng có hạn',
  // Aspirational copywriter
  'bạn xứng đáng',
  'phiên bản tốt hơn',
  'cơ hội thay đổi',
  'mở ra cuộc sống mới',
  // Fear-based
  'đừng để',
  'đừng để X hủy hoại',
  'trước khi quá muộn',
  // Marketing wrappers
  'chúng tôi cam kết',
  'sản phẩm tốt nhất',
  'giải pháp duy nhất',
] as const

// ═══ PROMPT DIRECTIVE FOR SECTION 11 ══════════════════════════════════

export const SOFT_CTA_PROMPT =
  `Section 11 (soft-cta) — TONE RULES:

GOAL: như một người bạn đang nói chuyện lần cuối trước khi gác máy.
NOT marketing CTA. NOT urgency. NOT benefit push.

PHẢI có 1 trong 4 tones:
- peer-acknowledgment: "bạn không phải người duy nhất..."
- gentle-permission: "có lẽ bạn cũng có quyền dừng lại..."
- shared-experience-close: "tôi viết cái này vì..." / "câu chuyện của tôi đến đây là hết..."
- quiet-invitation: "nếu bạn cũng đang ở giai đoạn đó..."

PHẢI KHÔNG:
- "Đặt hàng ngay", "mua ngay", "click ngay" — hard sell
- "Chỉ còn", "đừng bỏ lỡ", "cơ hội cuối" — urgency/FOMO
- "Bạn xứng đáng", "phiên bản tốt hơn", "cơ hội thay đổi" — aspirational copywriter
- "Đừng để X hủy hoại", "trước khi quá muộn" — fear-based
- Product name mention (product reveal đã ở section 6)
- Statistics, benefits list, social proof claims

LENGTH: 60-100 từ. KHÔNG dài hơn.

Self-test: Nếu thay tên product bằng "cuốn sách tôi đọc" hoặc "blog bạn tôi viết",
section 11 vẫn make sense không? Nếu phải có product mới make sense → quá salesy → rewrite.`

/** Get section 11 directive for prompt injection. */
export function buildSoftCtaDirective(): string {
  const toneKeys = Object.keys(SOFT_CTA_TONES) as Array<keyof typeof SOFT_CTA_TONES>
  return `SOFT CTA TONES (CHOOSE 1, vary across packs): ${toneKeys.join(' / ')}`
}
