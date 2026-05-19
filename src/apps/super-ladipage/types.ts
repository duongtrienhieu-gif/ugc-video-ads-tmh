// Super Ladipage — clean-room rebuild của Landing Page AI.
// Phase 1: skeleton types. Sẽ mở rộng dần khi port UI (Phase 2) và
// rebuild services (Phase 3).

/** Ngôn ngữ landing page — quyết định toàn bộ copy/headline/FAQ. */
export type LandingLanguage = 'MY' | 'VN' | 'GB'

/** 5 preset = 5 sales psychology engine khác nhau. */
export type LandingPreset =
  | 'ugc-fast'      // UGC Chuyển Đổi Nhanh
  | 'story'         // Kể Chuyện Hành Trình
  | 'expert'        // Chuyên Gia / Khoa Học
  | 'cta-heavy'     // Chốt Đơn Mạnh
  | 'luxury'        // Thương Hiệu Cao Cấp

/** Trạng thái của một asset (ảnh) trong section. */
export type AssetStatus = 'empty' | 'generating' | 'ready' | 'error'

/** Trạng thái tổng của 1 pack. */
export type PackStatus =
  | 'draft'              // chưa generate
  | 'generating-copy'    // đang sinh copy
  | 'copy-ready'         // copy xong, ảnh chưa sinh / sinh dở
  | 'ready'              // copy + tất cả ảnh xong

/** Field có dịch song ngữ: bản gốc theo `LandingLanguage` + bản dịch VN. */
export interface BilingualField {
  /** Bản viết bằng ngôn ngữ đích (MY/VN/GB). */
  native: string
  /** Bản dịch sang tiếng Việt — bằng `native` nếu language = VN. */
  vn: string
}

/** Một ảnh trong section. */
export interface SuperLadipageAsset {
  id: string
  /** Vai trò ảnh — vd "Hero text overlay A — designed decor". */
  role: string
  /** Tên file gợi ý — vd "hero_01.jpg". */
  filename: string
  /** Tỉ lệ khung — mặc định "4:5". */
  aspectRatio: string
  /** Prompt ENG truyền vào image API. Sinh ra ở Pass 1, có thể edit tay. */
  prompt: string
  /** Asset ref sau khi sinh thành công (asset-{uuid}). */
  assetRef?: string
  status: AssetStatus
  errorMessage?: string
  /** Số credit dự kiến tiêu khi sinh. */
  creditCost: number
}

/** Một section trong landing pack. */
export interface SuperLadipageSection {
  id: string
  order: number
  /** Type semantic — vd "hero", "pain", "why", "solution", "faq". */
  type: string
  emoji: string
  /** Headline ngắn của section (hiển thị ở header row khi collapsed). */
  title: BilingualField
  /** Field copy — schema linh hoạt, tùy preset & section type. */
  fields: Record<string, BilingualField>
  /** Body copy dài (nếu có). */
  bodyCopy?: BilingualField
  /** Danh sách ảnh thuộc section. */
  assets: SuperLadipageAsset[]
  /** Có badge "MỚI" không. */
  isNew?: boolean
}

/** Một landing pack đầy đủ. */
export interface SuperLadipagePack {
  id: string
  productId: string
  productName: string
  language: LandingLanguage
  preset: LandingPreset
  /** Asset refs của ảnh tham chiếu sản phẩm (max 3). */
  referenceImageRefs: string[]
  /** Link landing page đối thủ (optional, dùng làm style/structure hint). */
  competitorLink?: string
  sections: SuperLadipageSection[]
  status: PackStatus
  createdAt: number
  updatedAt: number
  /** Timestamp lần auto-save gần nhất. */
  autoSavedAt?: number
}
