// ── MKT Agent · Thư viện từ khóa COD (MY) theo nhóm ──────────────────────────
// Mục tiêu: quét RỘNG mọi ngách COD đang có cầu — KHÔNG bó vào sức khỏe. CHỦ Ý
// loại thời trang/giày/túi (nhiều biến thể/size/màu = sai số + hoàn cao).
// User toggle nhóm để nạp nhanh vào ô ngách; vẫn tự thêm tay được.

export interface KeywordGroup { label: string; terms: string[] }

// Seed ngắn (Malay) cho mỗi ngách — dùng làm HẠT GIỐNG. Bấm "🪄 Bung ngách (AI)"
// để AI nở rộng phủ cả ngách (15 từ) thay vì bó vào vài từ này.
export const KEYWORD_GROUPS: KeywordGroup[] = [
  { label: '💊 TPCN / Vitamin', terms: ['suplemen kesihatan', 'multivitamin', 'vitamin c'] },
  { label: '🌸 Collagen / Đẹp da', terms: ['kolagen', 'minuman kolagen', 'kulit gebu'] },
  { label: '🔥 Giảm cân / Detox', terms: ['kurus cepat', 'buang lemak', 'detox', 'perut buncit'] },
  { label: '💪 Sinh lý / Sức khỏe nam', terms: ['kuat lelaki', 'tenaga batin', 'tahan lama'] },
  { label: '💇 Tóc / Rụng tóc', terms: ['rambut gugur', 'serum rambut', 'uban', 'kebotakan'] },
  { label: '🧴 Skincare', terms: ['serum wajah', 'pencuci muka', 'pelembap', 'sunscreen'] },
  { label: '🦷 Răng miệng', terms: ['pemutih gigi', 'ubat gigi', 'nafas berbau'] },
  { label: '🍼 Mẹ & bé', terms: ['vitamin kanak', 'barang baby', 'susu ibu'] },
  { label: '🩺 Dụng cụ sức khỏe', terms: ['alat urut', 'brace lutut', 'koyo', 'alat kesihatan'] },
  { label: '🍿 Đồ ăn vặt / Snack', terms: ['snek', 'makanan ringan', 'keropok'] },
  { label: '🦴 Xương khớp / Đau nhức', terms: ['sakit sendi', 'minyak urut', 'sakit lutut', 'gout'] },
  { label: '🌿 Tiêu hóa / Dạ dày / Gan', terms: ['gastrik', 'sembelit', 'probiotik', 'detox hati'] },
  { label: '👁 Mắt / Thị lực', terms: ['mata kabur', 'lutein', 'ubat mata'] },
  { label: '😴 Ngủ ngon / Giảm stress', terms: ['susah tidur', 'insomnia', 'kurang stress'] },
  { label: '🌸 Vệ sinh PN / Trắng body', terms: ['pencuci wanita', 'miss v', 'pemutih badan'] },
  { label: '🩸 Đường huyết / Tim mạch', terms: ['kencing manis', 'darah tinggi', 'kolesterol'] },
  { label: '💧 Trị mụn / Trị nám', terms: ['jerawat', 'jeragat', 'parut jerawat'] },
  { label: '🏠 Gia dụng / Nhà bếp', terms: ['pembersih dapur', 'penghilang kerak', 'penyental lantai'] },
  { label: '✨ Tiện ích độc lạ / Viral', terms: ['barang viral', 'gadget rumah', 'alat serbaguna'] },
  { label: '📱 Đồ thông minh / Điện tử', terms: ['gajet', 'smart home', 'alat elektrik'] },
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
