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

// ─────────────────────────────────────────────────────────────────────────
// SLOT MAP — the 9-slot conversion arc, hard-mapped for TPCN health.
// Tier 1 LOCK: intent is invariant. Tier 2 LOCK: composition + atmosphere
// pre-assigned. Tier 3: only overlay text + AI scene vary per generation.
// ─────────────────────────────────────────────────────────────────────────

export const SLOT_MAP: SlotConfig[] = [
  { slot: 1, intent: 'hero-hook',      intentLabel: 'Hero Hook',          composition: 'pill-bottle-hero-centered',  atmosphere: 'classic',   visualMode: 'ai-gen',      highRes: true  },
  { slot: 2, intent: 'pain-point',     intentLabel: 'Pain Point',         composition: 'split-screen-before-after',  atmosphere: 'soft',      visualMode: 'ai-gen',      highRes: false },
  { slot: 3, intent: 'transformation', intentLabel: 'Kết quả',            composition: 'split-screen-before-after',  atmosphere: 'energetic', visualMode: 'ai-gen',      highRes: false },
  { slot: 4, intent: 'usp-mechanism',  intentLabel: 'USP / Cơ chế',       composition: 'floating-ingredients-bottle', atmosphere: 'classic',   visualMode: 'ai-gen',      highRes: false },
  { slot: 5, intent: 'social-proof',   intentLabel: 'Đánh giá khách',     composition: 'testimonial-card-overlay',   atmosphere: 'soft',      visualMode: 'canvas-only', highRes: false },
  { slot: 6, intent: 'usage-demo',     intentLabel: 'Hướng dẫn dùng',     composition: 'step-infographic',           atmosphere: 'soft',      visualMode: 'ai-gen',      highRes: false },
  { slot: 7, intent: 'comparison',     intentLabel: 'So sánh',            composition: 'cert-lab-report-stack',      atmosphere: 'energetic', visualMode: 'ai-gen',      highRes: false },
  { slot: 8, intent: 'offer-combo',    intentLabel: 'Ưu đãi',             composition: 'pill-bottle-hero-centered',  atmosphere: 'energetic', visualMode: 'ai-gen',      highRes: true  },
  { slot: 9, intent: 'faq-assurance',  intentLabel: 'FAQ & Cam kết',      composition: 'cert-lab-report-stack',      atmosphere: 'soft',      visualMode: 'canvas-only', highRes: false },
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
// COST ESTIMATION — kie.ai credit math.
// Confirmed from utils/kieai.ts:
//   gpt-image-2-text-to-image: 6 credits @ 1K, 10 credits @ 2K, 16 @ 4K
//   Text gen via Gemini Flash ≈ 1 credit per listing
// ─────────────────────────────────────────────────────────────────────────

export const CREDIT_COST_PER_IMAGE_1K = 6
export const CREDIT_COST_PER_IMAGE_2K = 10
export const ESTIMATED_TEXT_CREDITS = 1

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

export const MOCK_OVERLAY_BY_SLOT: Record<number, OverlayConfig> = {
  1: { headline: 'GIGI PUTIH 3X LEBIH CEPAT', subheadline: 'Senyum yakin dalam 14 hari' },
  2: { headline: 'Gigi kuning sebab kopi & rokok?', bullets: ['Tak yakin nak senyum', 'Bau mulut tak fresh', 'Whitening klinik RM500+'] },
  3: { metric: { value: '+8 SHADE', label: 'DALAM 14 HARI' }, disclaimer: 'Hasil mungkin berbeza individu' },
  4: { headline: 'FORMULA AKTIF', bullets: ['Activated Charcoal 30%', 'Hydroxyapatite 25%', 'Calcium Carbonate 20%', 'Mint Extract 15%'] },
  5: { testimonial: { quote: 'Selepas 2 minggu, gigi saya jauh lebih putih. Suami pun perasan!', author: 'Aisyah, 34, KL', rating: 5 } },
  6: { headline: 'CARA GUNA — 3 LANGKAH', steps: [{ number: 1, text: 'Basahkan berus gigi' }, { number: 2, text: 'Celup dalam serbuk' }, { number: 3, text: 'Berus 2 minit, 2x sehari' }] },
  7: { comparison: { headers: ['Pilihan natural', 'Bahan kimia'], rows: [['RM 89', 'RM 250+'], ['14 hari', '30+ hari'], ['Tiada sakit', 'Sensitif'], ['Semula jadi', 'Kimia']] } },
  8: { price: { current: 'RM 89', original: 'RM 159', discount: '-44%' }, headline: '+ FREE Berus Gigi Lembut', cta: 'BELI SEKARANG' },
  9: { faq: [
    { q: 'Selamat untuk enamel?',   a: 'Ya, pH neutral, formula lembut' },
    { q: 'Bila nampak hasil?',      a: '7-14 hari, bergantung condition' },
    { q: 'Boleh pulangkan?',        a: 'Ya, 7 hari tanpa soal' },
  ] },
}

export const MOCK_DESCRIPTION_BLOCKS: DescriptionBlock[] = [
  { kind: 'hook',     text: '🦷 Senyum percaya diri dalam 14 hari — tanpa whitening klinik mahal!' },
  { kind: 'pain',     bullets: [
    'Tak yakin nak senyum sebab gigi kuning?',
    'Selalu sapu mulut bila bercakap dekat?',
    'Dah cuba whitening strip tapi gigi jadi sensitif?',
  ] },
  { kind: 'solution', text: 'WHITEPRO Whitening Powder — Serbuk pemutih gigi formula aktif dengan Activated Charcoal + Hydroxyapatite. Rawat puncanya, putih natural, kekal lama.' },
  { kind: 'benefits', bullets: [
    'Putihkan hingga 8 shade dalam 14 hari',
    'Selamat untuk enamel — pH neutral',
    'Tanpa sensitiviti seperti whitening strip',
    'Bahan semula jadi',
    '1 botol = 2 bulan guna',
  ] },
  { kind: 'specs',    rows: [
    ['Activated Charcoal', '30%'],
    ['Hydroxyapatite',     '25%'],
    ['Calcium Carbonate',  '20%'],
    ['Mint Extract',       '15%'],
    ['Vitamin E',          '10%'],
  ] },
  { kind: 'reviews',  quotes: [
    { text: 'Gigi saya jauh lebih putih selepas 2 minggu!', author: 'Aisyah, KL' },
    { text: 'Tak sensitif macam whitening strip!',          author: 'Faridah, JB' },
  ] },
  { kind: 'usage',    steps: [
    'Basahkan berus gigi',
    'Celup dalam serbuk WhitePro',
    'Berus 2 minit, 2x sehari (pagi & malam)',
  ] },
  { kind: 'offer',    text: 'RM 159 → RM 89 (jimat 44%) + FREE Berus Gigi Lembut (RM 25)' },
  { kind: 'faq',      items: [
    { q: 'Selamat untuk gigi sensitif?', a: 'Ya, formula pH neutral.' },
    { q: 'Bila nampak hasil?',           a: '7-14 hari.' },
    { q: 'Boleh pulangkan?',             a: 'Ya, 7 hari tanpa soal.' },
  ] },
  { kind: 'promise',  bullets: [
    'Stok Malaysia (1-3 hari sampai)',
    'Pulangan 7 hari',
    'Pembungkusan diskret',
  ] },
  { kind: 'cta',      text: '📲 BELI SEKARANG — stok terhad!' },
]

export const MOCK_DESCRIPTION: ListingDescription = {
  blocks: MOCK_DESCRIPTION_BLOCKS,
  fullText: '',  // assembled by service in Phase 4
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
  offer:    { icon: '🎁', label: 'Ưu đãi' },
  faq:      { icon: '❓', label: 'FAQ' },
  promise:  { icon: '🛡️', label: 'Cam kết' },
  cta:      { icon: '📲', label: 'CTA' },
}
