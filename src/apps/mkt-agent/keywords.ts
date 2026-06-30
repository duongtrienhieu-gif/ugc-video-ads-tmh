// ── MKT Agent · Thư viện từ khóa COD (MY) theo nhóm ──────────────────────────
// Mục tiêu: quét RỘNG mọi ngách COD đang có cầu — KHÔNG bó vào sức khỏe. CHỦ Ý
// loại thời trang/giày/túi (nhiều biến thể/size/màu = sai số + hoàn cao).
// User toggle nhóm để nạp nhanh vào ô ngách; vẫn tự thêm tay được.

export interface KeywordGroup { label: string; terms: string[] }

export const KEYWORD_GROUPS: KeywordGroup[] = [
  { label: 'Đau · Xương khớp', terms: ['minyak urut', 'sakit sendi lutut', 'sakit belakang', 'kaki kebas', 'gout', 'asid urik'] },
  { label: 'Da · Mụn', terms: ['jerawat', 'jeragat', 'parut jerawat', 'pemutih kulit', 'pori besar', 'kedut wajah'] },
  { label: 'Tóc', terms: ['rambut gugur', 'uban', 'kebotakan'] },
  { label: 'Giảm cân', terms: ['kurus cepat', 'buang lemak', 'perut buncit'] },
  { label: 'Răng miệng', terms: ['sakit gigi', 'gusi bengkak', 'pemutih gigi', 'nafas berbau'] },
  { label: 'Sinh lý nam', terms: ['kuat lelaki', 'tahan lama', 'tenaga batin'] },
  { label: 'Bệnh mãn', terms: ['kolesterol tinggi', 'darah tinggi', 'kencing manis', 'gastrik', 'buasir'] },
  { label: 'Gia dụng tiện ích', terms: ['pembersih dapur', 'penghilang kerak', 'ubat nyamuk', 'penyental lantai'] },
]

// Các từ trong ô ngách → mảng đã chuẩn hóa.
export function parseNiches(s: string): string[] {
  return s.split(',').map((t) => t.trim()).filter(Boolean)
}
// Nhóm này đã bật chưa (mọi term của nó đều có trong ô ngách)?
export function isGroupActive(g: KeywordGroup, niches: string[]): boolean {
  const set = new Set(niches.map((t) => t.toLowerCase()))
  return g.terms.every((t) => set.has(t.toLowerCase()))
}
// Toggle 1 nhóm: đang bật → bỏ hết term của nhóm; chưa → thêm (dedup).
export function toggleGroup(g: KeywordGroup, current: string): string {
  const niches = parseNiches(current)
  const lower = new Set(niches.map((t) => t.toLowerCase()))
  if (isGroupActive(g, niches)) {
    const remove = new Set(g.terms.map((t) => t.toLowerCase()))
    return niches.filter((t) => !remove.has(t.toLowerCase())).join(', ')
  }
  const add = g.terms.filter((t) => !lower.has(t.toLowerCase()))
  return [...niches, ...add].join(', ')
}
