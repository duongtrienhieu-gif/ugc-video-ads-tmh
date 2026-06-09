// TikTok Shop — locked constants (slot map, palettes, composition families).
// Phase 1: includes mock data so UI shell looks alive without real generation.

import type {
  SlotConfig,
  CompositionFamily,
  AtmosphereVariant,
  PaletteFamily,
  DescriptionBlock,
  ListingDescription,
  OverlayConfig,
} from './types'
import type { Market } from '../../types/brandKit'

// ─────────────────────────────────────────────────────────────────────────
// SLOT MAP — the 9-slot conversion arc, hard-mapped for TPCN health.
// Tier 1 LOCK: intent is invariant. Tier 2 LOCK: composition + atmosphere
// pre-assigned. Tier 3: only overlay text + AI scene vary per generation.
// ─────────────────────────────────────────────────────────────────────────

// Phase 6 pivot: ALL 9 slots are AI-gen now (no canvas-only). highRes=false
// for everything since Nano Banana 2 @ 1K (8 credits) is plenty for TikTok
// Shop thumbnails. Hero/Offer can bump to highRes=true later if needed.
export const SLOT_MAP: SlotConfig[] = [
  { slot: 1, intent: 'hero-hook',      intentLabel: 'Hero Hook',          composition: 'pill-bottle-hero-centered',  atmosphere: 'classic',   visualMode: 'ai-gen', highRes: false },
  { slot: 2, intent: 'pain-point',     intentLabel: 'Pain Point',         composition: 'split-screen-before-after',  atmosphere: 'soft',      visualMode: 'ai-gen', highRes: false },
  { slot: 3, intent: 'transformation', intentLabel: 'Kết quả',            composition: 'split-screen-before-after',  atmosphere: 'energetic', visualMode: 'ai-gen', highRes: false },
  { slot: 4, intent: 'usp-mechanism',  intentLabel: 'USP / Cơ chế',       composition: 'floating-ingredients-bottle', atmosphere: 'classic',   visualMode: 'ai-gen', highRes: false },
  { slot: 5, intent: 'social-proof',         intentLabel: 'Phản hồi WhatsApp',  composition: 'testimonial-card-overlay',   atmosphere: 'soft',      visualMode: 'ai-gen', highRes: false },
  { slot: 6, intent: 'usage-demo',           intentLabel: 'Hướng dẫn dùng',     composition: 'step-infographic',           atmosphere: 'soft',      visualMode: 'ai-gen', highRes: false },
  { slot: 7, intent: 'comparison',           intentLabel: 'So sánh',            composition: 'cert-lab-report-stack',      atmosphere: 'energetic', visualMode: 'ai-gen', highRes: false },
  { slot: 8, intent: 'qualifying-checklist', intentLabel: 'Ai nên dùng',        composition: 'step-infographic',           atmosphere: 'classic',   visualMode: 'ai-gen', highRes: false },
  { slot: 9, intent: 'brand-story-bar',      intentLabel: 'Lý do chọn',         composition: 'cert-lab-report-stack',      atmosphere: 'soft',      visualMode: 'ai-gen', highRes: false },
]

// ─────────────────────────────────────────────────────────────────────────
// TPCN PALETTE FAMILIES — 4 fixed palettes for medical-commerce feel.
// Brand Kit's primary color snaps to the nearest family via snapToPaletteFamily().
// ─────────────────────────────────────────────────────────────────────────

export interface PaletteSpec {
  family: PaletteFamily
  label: string
  primary: string
  secondary: string
  cta: string
  neutral: string
}

export const TPCN_PALETTES: Record<PaletteFamily, PaletteSpec> = {
  medicalBlue: { family: 'medicalBlue', label: 'Medical Blue',  primary: '#1E4D8C', secondary: '#E8F2FC', cta: '#FF6B35', neutral: '#FFFFFF' },
  cleanGreen:  { family: 'cleanGreen',  label: 'Clean Green',   primary: '#2D7A4F', secondary: '#F0F9F2', cta: '#FF6B35', neutral: '#FFFFFF' },
  softMint:    { family: 'softMint',    label: 'Soft Mint',     primary: '#5BB5A8', secondary: '#F2FAF8', cta: '#FF6B35', neutral: '#FFFFFF' },
  premiumNavy: { family: 'premiumNavy', label: 'Premium Navy',  primary: '#0A2540', secondary: '#F5E8D0', cta: '#C9A961', neutral: '#FFFFFF' },
}

// Snap any brand-kit primary hex to the closest TPCN palette family.
// Uses simple RGB distance for Phase 1 (good enough; Lab color space later).
export function snapToPaletteFamily(primaryHex: string): PaletteFamily {
  const target = hexToRgb(primaryHex)
  if (!target) return 'medicalBlue'

  let bestFamily: PaletteFamily = 'medicalBlue'
  let bestDist = Infinity
  for (const spec of Object.values(TPCN_PALETTES)) {
    const rgb = hexToRgb(spec.primary)
    if (!rgb) continue
    const d = Math.sqrt(
      (rgb.r - target.r) ** 2 +
      (rgb.g - target.g) ** 2 +
      (rgb.b - target.b) ** 2,
    )
    if (d < bestDist) {
      bestDist = d
      bestFamily = spec.family
    }
  }
  return bestFamily
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([0-9A-Fa-f]{6})$/)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// ─────────────────────────────────────────────────────────────────────────
// ATMOSPHERE VARIANTS — Tier 2 visual variation within brand palette.
// 3 background treatments; each slot maps to one in SLOT_MAP above.
// ─────────────────────────────────────────────────────────────────────────

export interface AtmosphereSpec {
  variant: AtmosphereVariant
  label: string
  promptKeyword: string                   // appended to Gemini prompt for visual mood
  cssGradient: (p: PaletteSpec) => string // for canvas/preview rendering
  accentRatio: number                     // 0..1 — how much accent color dominates
}

export const ATMOSPHERE_VARIANTS: Record<AtmosphereVariant, AtmosphereSpec> = {
  classic: {
    variant: 'classic',
    label: 'Classic',
    promptKeyword: 'clean professional diagonal gradient from primary brand color to soft secondary, balanced composition',
    cssGradient: (p) => `linear-gradient(135deg, ${p.primary} 0%, ${p.secondary} 100%)`,
    accentRatio: 0.10,
  },
  soft: {
    variant: 'soft',
    label: 'Soft',
    promptKeyword: 'airy lighter radial gradient from upper center, secondary color washing out to neutral white, calm approachable mood',
    cssGradient: (p) => `radial-gradient(circle at 50% 20%, ${p.secondary} 0%, ${p.neutral} 100%)`,
    accentRatio: 0.05,
  },
  energetic: {
    variant: 'energetic',
    label: 'Energetic',
    promptKeyword: 'deeper confident vertical gradient with accent color edge glow, primary brand color intensified, momentum mood',
    cssGradient: (p) => `linear-gradient(180deg, ${p.primary} 0%, ${p.cta} 100%)`,
    accentRatio: 0.30,
  },
}

// ─────────────────────────────────────────────────────────────────────────
// COMPOSITION FAMILY LABELS — VN labels for UI display.
// ─────────────────────────────────────────────────────────────────────────

export const COMPOSITION_FAMILY_LABELS: Record<CompositionFamily, string> = {
  'pill-bottle-hero-centered':   'Hero giữa khung',
  'split-screen-before-after':   'Trước/Sau chia đôi',
  'floating-ingredients-bottle': 'Thành phần nổi quanh sản phẩm',
  'testimonial-card-overlay':    'Thẻ đánh giá',
  'step-infographic':            'Infographic theo bước',
  'cert-lab-report-stack':       'Bảng cam kết / chứng nhận',
}

// ─────────────────────────────────────────────────────────────────────────
// COST ESTIMATION — Phase 6 final uses GPT-4o image edit (TRUE i2i).
// Per kie.ai pricing (battle-tested in Super Ladipage):
//   gpt-4o-image (i2i with filesUrl): 6 credits @ 1K
//   Text gen via Gemini Flash ≈ 1 credit per listing
// 9 AI slots × 6 + 1 text = ~55 credits/listing (~$0.28 / RM 1.30)
// Same cost as the failed gpt-image-2 test, but gpt-image-2 ignores refs
// while gpt-4o-image honors them properly.
// ─────────────────────────────────────────────────────────────────────────

export const CREDIT_COST_PER_IMAGE_1K = 6
export const CREDIT_COST_PER_IMAGE_2K = 10
export const ESTIMATED_TEXT_CREDITS = 1

// Combo thumbnails (Phase 7B) — same gpt-4o-image cost as 1K main slot.
export const CREDIT_COST_PER_COMBO = 6
export const MAX_COMBOS = 12

export function estimateListingCredits(slots: SlotConfig[] = SLOT_MAP): number {
  const aiSlots = slots.filter((s) => s.visualMode === 'ai-gen')
  const imageCost = aiSlots.reduce(
    (sum, s) => sum + (s.highRes ? CREDIT_COST_PER_IMAGE_2K : CREDIT_COST_PER_IMAGE_1K),
    0,
  )
  return imageCost + ESTIMATED_TEXT_CREDITS
}

// ─────────────────────────────────────────────────────────────────────────
// MOCK DATA — Phase 1 preview. Removed/replaced by real generation in Phase 3+.
// Bột làm trắng răng ("WhitePro") as the example product across all 9 slots.
// ─────────────────────────────────────────────────────────────────────────

// Generic placeholder overlays — kept around for the mock-preview empty
// state, but NEVER injected into AI prompts. AI prompts pull their slot
// texts from ListingDescription.slotTexts (which the description AI gens
// based on the actual selected product). See [[feedback-product-fidelity-mandate]].
export const MOCK_OVERLAY_BY_SLOT: Record<number, OverlayConfig> = {
  1: { headline: '(Hero claim)',              subheadline: '(Sub claim)' },
  2: { headline: '(Pain question)',           bullets: ['(Pain 1)', '(Pain 2)', '(Pain 3)'] },
  3: { metric: { value: '(metric)',           label: '(period)' }, disclaimer: '(disclaimer)' },
  4: { headline: '(Formula title)',           bullets: ['(Ingredient 1)', '(Ingredient 2)', '(Ingredient 3)'] },
  5: { testimonial: { quote: '(Quote)',       author: '(Author)', rating: 5 } },
  6: { headline: '(Usage title)',             steps: [{ number: 1, text: '(Step 1)' }, { number: 2, text: '(Step 2)' }, { number: 3, text: '(Step 3)' }] },
  7: { comparison: { headers: ['(Ours)', '(Theirs)'], rows: [['', ''], ['', '']] } },
  8: { headline: '(AI NÊN DÙNG)', bullets: ['(Dấu hiệu 1)', '(Dấu hiệu 2)', '(Dấu hiệu 3)', '(Dấu hiệu 4)', '(Dấu hiệu 5)'], cta: '(Qualifier)' },
  9: { headline: '(LÝ DO CHỌN)', bullets: ['(Lý do 1 — cụ thể)', '(Lý do 2 — cụ thể)', '(Lý do 3 — cụ thể)'] },
}

// MOCK description blocks shown ONLY in the empty-state mock preview (before
// the user generates anything real). NEVER used as a hardcoded fallback that
// AI gen routes to — the description gen service has its own product-aware
// fallback that synthesises placeholders from the actual product fields.
export const MOCK_DESCRIPTION_BLOCKS: DescriptionBlock[] = [
  { kind: 'hook',     text: '🛒 (Hero claim — sẽ thay bằng nội dung sản phẩm sau khi tạo listing)' },
  { kind: 'pain',     bullets: ['(Pain point 1)', '(Pain point 2)', '(Pain point 3)'] },
  { kind: 'solution', text: '(Mô tả giải pháp + USP — sẽ generate từ thông tin sản phẩm)' },
  { kind: 'benefits', bullets: ['(Lợi ích 1)', '(Lợi ích 2)', '(Lợi ích 3)'] },
  { kind: 'specs',    rows: [['(Thành phần)', '(%)']] },
  { kind: 'reviews',  quotes: [{ text: '(Quote khách hàng)', author: '(Tên, địa chỉ)' }] },
  { kind: 'usage',    steps: ['(Bước 1)', '(Bước 2)', '(Bước 3)'] },
  { kind: 'faq',      items: [
    { q: '(Câu hỏi 1)', a: '(Trả lời 1)' },
    { q: '(Câu hỏi 2)', a: '(Trả lời 2)' },
  ] },
  { kind: 'promise',  bullets: ['(Cam kết 1)', '(Cam kết 2)'] },
  { kind: 'cta',      text: '(CTA cuối)' },
]

export const MOCK_DESCRIPTION: ListingDescription = {
  blocks: MOCK_DESCRIPTION_BLOCKS,
  fullText: '',
}

// ─────────────────────────────────────────────────────────────────────────
// DESCRIPTION BLOCK LABELS — VN labels for the block editor UI.
// ─────────────────────────────────────────────────────────────────────────

export const DESCRIPTION_BLOCK_LABELS: Record<DescriptionBlock['kind'], { icon: string; label: string }> = {
  hook:     { icon: '🎯', label: 'Hook' },
  pain:     { icon: '😣', label: 'Pain Point' },
  solution: { icon: '✨', label: 'Giải pháp' },
  benefits: { icon: '🔥', label: 'Lợi ích' },
  specs:    { icon: '📦', label: 'Thông số' },
  reviews:  { icon: '👥', label: 'Đánh giá' },
  usage:    { icon: '🎬', label: 'Cách dùng' },
  faq:      { icon: '❓', label: 'FAQ' },
  promise:  { icon: '🛡️', label: 'Cam kết' },
  cta:      { icon: '📲', label: 'CTA' },
}

// ─────────────────────────────────────────────────────────────────────────
// COMBO COUNT LABELS — top-center pill on each combo thumbnail.
// Conversion psychology: 1 = trial (low commit) → 4 = max household saving →
// 5+ = wholesale/bulk territory (reseller, stockpile).
// Universal — niche-agnostic, works for any product (TPCN, beauty, etc.).
// ─────────────────────────────────────────────────────────────────────────

const COMBO_LABELS_MS: Record<number, string> = {
  1: 'PERCUBAAN',
  2: 'JIMAT BERDUA',
  3: 'PAKEJ KELUARGA',
  4: 'JIMAT MAKSIMA',
  5: 'PAKEJ BORONG',
}
const COMBO_LABEL_MS_FALLBACK = 'MEGA BORONG'  // 6+

const COMBO_LABELS_VI: Record<number, string> = {
  1: 'DÙNG THỬ',
  2: 'COMBO TIẾT KIỆM',
  3: 'COMBO GIA ĐÌNH',
  4: 'TIẾT KIỆM TỐI ĐA',
  5: 'GIÁ SỈ',
}
const COMBO_LABEL_VI_FALLBACK = 'SIÊU SỈ TIẾT KIỆM'  // 6+

export function getComboLabel(count: number, market: Market): string {
  const safeCount = Math.max(1, Math.floor(count))
  const table = market === 'ms' ? COMBO_LABELS_MS : COMBO_LABELS_VI
  const fallback = market === 'ms' ? COMBO_LABEL_MS_FALLBACK : COMBO_LABEL_VI_FALLBACK
  return table[safeCount] ?? fallback
}
