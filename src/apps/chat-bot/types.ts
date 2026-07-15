// ─────────────────────────────────────────────────────────────────────────
// CHAT BOT — type definitions
//
// Module "bộ não bán hàng": setup cấu hình bán-qua-chat cho từng sản phẩm +
// engine sinh "gói hành động" (ActionPacket) + simulator QC. Channel-agnostic:
// Simulator / WhatsApp / Pancake về sau đều cắm vào cùng engine.
//
// Lưu trữ: user_outputs (kind='chat-bot-config') + localStorage (zustand persist).
// SalesConfig thoả OutputItem của userOutputsAPI ({ id, title?, createdAt }).
// ─────────────────────────────────────────────────────────────────────────

/** Thị trường chạy của 1 cấu hình — quyết định ngôn ngữ + tiền tệ + (sau) đường ống. */
export type Market = 'VN' | 'MY'

/** Bậc trong tiến trình tư vấn (stage machine). Kim chỉ nam, AI tự nhảy bậc. */
export type Stage =
  | 'greeting'   // chào + xác nhận đúng sản phẩm
  | 'value'      // trao giá trị + neo giá
  | 'qualify'    // hỏi câu nối khai thác
  | 'advise'     // tư vấn sâu
  | 'objection'  // xử lý từ chối + nấc khuyến mãi
  | 'close'      // chốt: xin SĐT/địa chỉ
  | 'followup'   // khách im → nhắc

/** Vai trò nội dung của 1 ảnh/video — gán NHÃN 1 lần lúc setup; lúc chat AI chỉ
 *  đọc nhãn (text) để chọn gửi đúng bậc, KHÔNG xem pixel (tiết kiệm vision call).
 *  Bộ nhãn bám theo nội dung thật của ảnh Ladipage/TikTok (hook/pain/hdsd/...). */
export type MediaRole =
  | 'hook'       // ảnh thu hút / mở đầu
  | 'pain'       // ảnh vấn đề / nỗi đau
  | 'feature'    // ảnh tính năng / thành phần
  | 'mechanism'  // ảnh cơ chế hoạt động
  | 'usage'      // ảnh hướng dẫn sử dụng (HDSD)
  | 'compare'    // ảnh so sánh / before-after
  | 'proof'      // phản hồi khách (review / WhatsApp)
  | 'authority'  // báo chí / chuyên gia / uy tín
  | 'promo'      // ảnh khuyến mãi / giá
  | 'unboxing'   // ảnh/video mở hộp, dùng thử
  | 'other'

export interface MediaSlot {
  id: string
  /** asset-UUID (assetStore) hoặc URL trực tiếp. KHÔNG lưu signed URL (hết hạn 1h)
   *  — resolve link tươi bằng assetStore.getUrl() lúc gửi/hiển thị. */
  assetRef: string
  mediaType: 'image' | 'video'
  role: MediaRole
  stage: Stage
  caption?: string  // mô tả ngắn (VN) — đưa vào prompt cho AI biết khi nào dùng
}

export interface ObjectionItem {
  id: string
  trigger: string    // tình huống từ chối (user viết VN)
  guidance: string   // hướng gỡ (user viết VN)
}

/** Bậc combo: mua số lượng X → giá Y (để bot upsell "lấy 2 lợi hơn" + chốt đúng). */
export interface PricingTier {
  id: string
  qty: number        // số lượng MUA (1, 2, 3…) — qty=1 freeQty=0 = giá lẻ
  freeQty?: number   // số lượng TẶNG kèm (0/undefined = không tặng) — vd mua 1 tặng 1, mua 2 tặng 3
  price: string      // giá cho mức này (kèm đơn vị, vd "RM159")
  label?: string     // tên combo tuỳ chọn (vd "Combo tiết kiệm")
}

/** Biến thể sản phẩm (size/màu…) — bot xác nhận đúng khi chốt đơn. */
export interface ProductVariant {
  id: string
  name: string       // vd "Size" / "Màu"
  options: string    // vd "S, M, L" (free-text, phẩy)
}

/** Chính sách COD/giao hàng — FACT CỨNG bot cấm bịa (câu hỏi logistics rất nhiều). */
export interface CodPolicy {
  shippingFee?: string    // "freeship" / "RM10"
  deliveryTime?: string   // "2-4 ngày làm việc"
  coverage?: string       // "toàn Malaysia" / "West Malaysia"
  returnPolicy?: string   // "đổi trả 7 ngày / bảo hành 1 năm"
  note?: string           // ghi chú COD thêm
}

/** Cấu hình bán-qua-chat cho 1 sản phẩm. Fact sản phẩm (tên, lợi ích, ảnh) đọc từ
 *  product bank theo productId; ở đây chỉ nhập phần RIÊNG cho kênh chat. */
export interface SalesConfig {
  id: string
  /** Tên hiển thị (= tên sản phẩm) — cho userOutputsAPI listing. */
  title?: string
  createdAt: number
  updatedAt: number

  productId: string
  market: Market

  // ── Định tuyến đa-SP (bot 1 số phục vụ nhiều SP) ──
  routeCode?: string   // MÃ ngắn DUY NHẤT (vd "APRICOT") — khách nhắn "pasal APRICOT" → bot nạp config này
  team?: string        // Team phụ trách (vd "SUMMIT") — để giao đúng nhóm ở Chatwoot + báo cáo

  // ── Giá CHAT — LEGACY (config cũ). Config mới dùng pricingTiers làm nguồn giá DUY NHẤT. ──
  chatPrice: string          // legacy — để '' ở config mới
  chatPromo?: string         // legacy — ưu đãi giờ viết vào label của tier
  discountFloor: string      // legacy — bot mới CẤM bán ngoài BẢNG GIÁ nên không cần trần riêng

  // ── Bảng giá + biến thể + chính sách (fact cứng, feed vào đơn) ──
  pricingTiers?: PricingTier[]   // BẢNG GIÁ (bắt buộc ≥1 mức) — mua X tặng Y = giá Z, gồm cả giá lẻ
  variants?: ProductVariant[]    // biến thể size/màu
  codPolicy?: CodPolicy          // ship/giao/đổi-trả/khu vực

  // ── Bán hàng ──
  mediaMap: MediaSlot[]
  objectionBank: ObjectionItem[]
  playbookNote?: string      // tone, độ "lì" khi chốt (user viết VN)
  goldenExamples?: string[]  // 1-2 đoạn hội thoại mẫu vàng (few-shot)
}

// ── Engine output: "Gói hành động" (1 call Gemini / lượt khách) ──────────────

export interface BotMessage {
  type: 'text' | 'image' | 'video'
  contentTarget?: string  // text gửi khách (VN hoặc Manglish theo market)
  contentVi?: string      // VN gloss cho operator — KHÔNG gửi (bỏ khi market=VN)
  assetRef?: string       // khi type=image/video
}

/** 1 món trong đơn (biến thể + số lượng). */
export interface OrderItem {
  name?: string   // tên/biến thể/combo (vd "size L", "combo mua 2")
  qty?: number
}

/** Đơn có CẤU TRÚC — để xuất Google Sheet + báo team chuẩn (không bóc dict lỏng). */
export interface CapturedOrder {
  customerName?: string
  phone?: string
  address?: string
  items?: OrderItem[]
  total?: string   // tổng tiền (kèm đơn vị)
  note?: string    // ghi chú (yêu cầu riêng/khung giờ giao…)
}

export interface ActionPacket {
  messages: BotMessage[]
  awaitCustomer: boolean              // true = gửi xong DỪNG, chờ khách rep
  nextStage: Stage
  intent: string                      // vd 'ask_price' | 'objection_price' | 'ready_to_buy'
  captured: Record<string, string>    // SĐT/địa chỉ/màu... bot moi được (thô, xuyên phiên)
  handover: boolean                   // true = chuyển cho người
  /** Lý do handover (chê giá/khiếu nại/đơn to/ngoài phạm vi…) — để route đúng agent. */
  handoverReason?: string
  /** Đơn có cấu trúc — CHỈ điền khi đã gom đủ (tên+sđt+địa chỉ+món). */
  order?: CapturedOrder
  /** true = đơn ĐÃ xác nhận đủ → trigger xuất Sheet + báo team. */
  orderComplete?: boolean
  suggestedFollowup?: { afterMinutes: number; note: string }
  /** Tóm tắt phiên (cập nhật mỗi lượt): khách là ai, đã hỏi/lo gì, chốt tới đâu —
   *  để nhớ xuyên cả chat dài dù lịch sử thô bị cắt. */
  sessionSummary?: string
}

// ── Simulator ────────────────────────────────────────────────────────────────

/** Một lượt trong simulator: tin khách / gói hành động của bot / ghi chú hệ thống. */
export interface ChatTurn {
  id: string
  role: 'customer' | 'bot' | 'system'
  /** Với customer: text khách gõ. Với system: ghi chú hiển thị (vd "khách im"). Bot: xem `packet`. */
  customerText?: string
  packet?: ActionPacket
  at: number
}
