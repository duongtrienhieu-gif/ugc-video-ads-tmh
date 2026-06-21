// Form BG Studio — nhãn song ngữ tối thiểu (ms chính / vi phụ).

import type { Market } from '../../types/brandKit'

export function langDisplayName(lang: Market): string {
  return lang === 'vi' ? 'Tiếng Việt' : 'Bahasa Malaysia'
}

/** Badge "quà tặng kèm" (cho preset abundance). */
export function freeGiftBadge(lang: Market): string {
  return lang === 'vi' ? 'QUÀ TẶNG KÈM' : 'HADIAH PERCUMA'
}
