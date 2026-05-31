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

// ═════════════════════════════════════════════════════════════════════
// 2026-05-30 — Pain-driven-DR close directive
//
// User feedback (dental whitening pack): pain-driven-DR mode pack
// produced shock pain in Phase 1-2, full failed-attempts RM500 detail
// in Phase 2, transformation specifics in Phase 4 — then cut to a SOFT
// close ("Có lẽ đã đến lúc bạn cho phép bản thân thử một cách khác")
// that wasted all the agitation. Conversion = "đầu voi đuôi chuột".
//
// DR mode close needs:
//   1. Pivot back to the SPECIFIC pain reader felt (sensory recall).
//   2. Explicit ACTION VERB ("đặt", "mua", "thử", "lấy" + lang variants).
//   3. SCARCITY echo (recall pricing tier or limited offer from PI block).
//   4. SPECIFIC transformation recall (echo Phase 4 sensory moment).
//   5. 1 OBJECTION KNOCKOUT (risk reversal: COD, refund, free shipping).
//
// Still NOT hard-sell screaming. Still narrator voice. But the close
// closes — it doesn't drift into a soft "permission to try" with no
// next step.
//
// The directive is INJECTED at the close-invitation block when
// narrativeMode === 'pain-driven-DR'. Soft + aspiration modes keep
// the existing buildSoftCtaDirective behavior.
// ═════════════════════════════════════════════════════════════════════

export const DR_CTA_PROMPT =
  `Section 11 (close-invitation) — PAIN-DRIVEN-DR CLOSE:

Bạn vừa stack ${ '6-9' } chương về pain + failed attempts + product reveal +
transformation. Reader đang ở peak emotional readiness — NGAY BÂY GIỜ là
moment họ quyết định mua hay không. KHÔNG được soft-out với "có lẽ bạn
cũng có quyền dừng lại" — đó là wasted agitation.

DR CLOSE phải có ĐỦ 5 ELEMENTS (per priority):

1. PAIN PIVOT (1 paragraph) — recall ONE specific symptom reader đã
   nhận ra ở Phase 1-2 (cụ thể, KHÔNG generic "khó chịu").
   ✅ "Sáng mai bạn vẫn che miệng khi cười, hay đặt 1 hộp về thử?"
   ❌ "Có lẽ đã đến lúc thử một cách khác"

2. ACTION VERB EXPLICIT (1 paragraph) — câu mệnh lệnh cụ thể:
   ✅ "Đặt 1 hộp về dùng 30 ngày — không hợp trả lại."
   ✅ "Lấy gói MUA 2 TẶNG 2 — đủ cho bạn + mẹ."
   ✅ "Thử 1 chai trước — RM59 thôi, đỡ rủi ro."
   MS: "Order satu kotak", "Cuba", "Beli".
   EN: "Order 1 box", "Try", "Get".

3. SCARCITY ECHO (1 sentence) — recall offer cụ thể từ PI pricing block:
   "Giá RM59 (giảm từ RM119) — promo đến hết tháng."
   "Pack 2+2 RM89 — khi hết stock sẽ tăng giá."

4. TRANSFORMATION RECALL (1 sentence) — echo sensory peak từ Phase 4:
   ✅ "Để sáng mai mở mắt cười không phải sờ răng xem có sạch không."
   ✅ "Để đứng dậy không cần vịn bàn nữa."

5. OBJECTION KNOCKOUT (1 sentence) — risk reversal:
   "COD, không hợp trả lại — bạn không mất đồng nào nếu không hợp."
   "Free ship + đổi trả 7 ngày — thử là biết."

LENGTH: 100-160 từ. Dài hơn soft close vì có 5 elements. KHÔNG cắt.

⛔ DR CLOSE VẪN KHÔNG ĐƯỢC:
- Caps lock + exclamation marks ("MUA NGAY!!!", "ƯU ĐÃI SỐC")
- Fake urgency ("chỉ còn 3 hộp cuối", "đếm ngược 24h")
- Fake stats ("99% người dùng yêu thích")
- Aspirational fluff ("bạn xứng đáng", "cuộc sống tốt hơn")
- Banned root-cause phrases ("nguyên nhân gốc rễ", "từ bên trong cơ thể")

✅ DR CLOSE ALLOWED:
- Action verb có thật (đặt / mua / thử / lấy / nhận)
- Numeric scarcity từ input (RM59 / RM89 / MUA 2 TẶNG 2)
- Cụ thể transformation recall từ Phase 4
- Risk reversal (COD / 7-day return / free ship) NẾU input có

Self-test: nếu close section thiếu action verb HOẶC thiếu numeric reference
HOẶC thiếu transformation recall → REJECT + retry.`

/** Get section 11 directive for pain-driven-DR mode. */
export function buildDrCtaDirective(): string {
  return DR_CTA_PROMPT
}
