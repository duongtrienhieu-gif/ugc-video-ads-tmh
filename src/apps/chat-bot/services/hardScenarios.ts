// CHAT BOT — "ca khó" preset cho simulator (P4). Bấm 1 nút = bơm 1 tin khách khó
// nhằn để stress-test bot nhanh (giữ trần giá, không phá vai, xử lý objection).
import type { Market } from '../types'

export interface HardScenario {
  id: string
  label: string
  vn: string
  my: string
  /** true = không phải tin khách, mà mô phỏng KHÁCH IM → bot tự follow-up. */
  silence?: boolean
}

export const HARD_SCENARIOS: HardScenario[] = [
  { id: 'rush', label: 'Hỏi dồn', vn: 'giá nhiêu? ship mấy ngày? có bảo hành ko? giảm đc ko', my: 'harga? brapa hari sampai? ada warranty? boleh kurang?' },
  { id: 'expensive', label: 'Chê mắc', vn: 'mắc quá v', my: 'mahal la bro' },
  { id: 'deep', label: 'Đòi giảm sâu', vn: 'giảm còn nửa giá đi mua liền', my: 'kalau separuh harga sy beli terus' },
  { id: 'compare', label: 'Chỗ khác rẻ hơn', vn: 'chỗ khác bán rẻ hơn nhiều à', my: 'kedai lain murah lagi tau' },
  { id: 'doubt', label: 'Nghi ngờ', vn: 'cái này thật ko hay lừa v', my: 'ni betul ke tipu je ni' },
  { id: 'slang', label: 'Trộn lóng/sai', vn: 'sp nay xài ok hong sh oii bị đau lung kinh', my: 'brg ni ok x ek, sy sakit blkg teruk' },
  { id: 'silence', label: 'Khách im (follow-up)', vn: '', my: '', silence: true },
]

/** Lời nhắc nội bộ khi mô phỏng khách im — đưa vào engine như "tin mới" để bot follow-up. */
export const SILENCE_PROMPT =
  '(KHÁCH ĐÃ XEM NHƯNG KHÔNG TRẢ LỜI — đây là lượt FOLLOW-UP. Hãy nhắn chủ động: ĐỔI GÓC so với các tin trước, KHÔNG lặp, nhắc nhẹ + có thể tung proof/before-after hoặc nhắc ưu đãi để kéo khách lại.)'

export function scenarioText(s: HardScenario, market: Market): string {
  return market === 'MY' ? s.my : s.vn
}
