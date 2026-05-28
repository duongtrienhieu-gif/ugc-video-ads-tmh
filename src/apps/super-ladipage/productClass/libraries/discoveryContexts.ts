// ─────────────────────────────────────────────────────────────────────
// Product Class — discovery context library
//
// Realistic discovery context per (DiscoveryContext × MechanismFamily).
// Where would a reader REALISTICALLY discover this product type?
//
// Bug v1 had: knee brace "discovered via pharmacist" — pharmacy doesn't
// sell wearable braces. v2 maps discovery to product distribution reality.
// ─────────────────────────────────────────────────────────────────────

import type { DiscoveryContext, MechanismFamily } from '../types'

// ─── Realistic discovery scenes per context ────────────────────────

export const DISCOVERY_SCENES: Record<DiscoveryContext, string> = {
  'social-ads': 'thấy quảng cáo trên Facebook khi đang lướt buổi tối / Instagram reels khi đợi chế biến cà phê',
  'tiktok-viral': 'xem TikTok review của một người dùng thật / video viral ai đó kể trải nghiệm',
  'friend-referral': 'nhóm bạn Zalo / WhatsApp có ai đó kể đã dùng / hàng xóm khoe lại',
  'pharmacy': 'tình cờ ở hiệu thuốc, dược sĩ tư vấn cho một khách hàng khác đứng kế bên',
  'doctor-clinic': 'bác sĩ kê / nhân viên clinic giới thiệu khi đi khám',
  'self-research': 'đọc được trên một bài báo / Facebook group sức khỏe / search Google',
}

// ─── Validation: which discovery contexts make sense per mechanism ─

/** Pharmacy/doctor discovery is realistic ONLY for oral supplements / OTC pills.
 *  Wearable devices and topical creams are NOT distributed via pharmacy
 *  in Vietnam/Malaysia mass market — they sell via Facebook/TikTok/COD. */
export const REALISTIC_DISCOVERY: Record<MechanismFamily, DiscoveryContext[]> = {
  'physical-stabilization': ['social-ads', 'tiktok-viral', 'friend-referral'],
  'wearable-support':       ['social-ads', 'tiktok-viral', 'friend-referral', 'doctor-clinic'],
  'mechanical-aid':         ['social-ads', 'tiktok-viral', 'friend-referral'],
  'oral-bioactive':         ['pharmacy', 'doctor-clinic', 'friend-referral', 'self-research'],
  'topical-soothe':         ['social-ads', 'tiktok-viral', 'friend-referral', 'pharmacy'],
  'spray-relief':           ['pharmacy', 'doctor-clinic', 'social-ads'],
  'patch-delivery':         ['social-ads', 'pharmacy', 'tiktok-viral'],
  'biochemical-repair':     ['pharmacy', 'doctor-clinic', 'self-research', 'friend-referral'],
  'cosmetic-aesthetic':     ['social-ads', 'tiktok-viral', 'friend-referral'],
}

/** Pick a realistic discovery context — if classifier returned something
 *  unrealistic for the mechanism, fall back to the most natural option. */
export function pickRealisticDiscovery(
  requested: DiscoveryContext,
  mechanism: MechanismFamily,
): DiscoveryContext {
  const realistic = REALISTIC_DISCOVERY[mechanism]
  if (realistic.includes(requested)) return requested
  // Substitute with first realistic option for this mechanism
  return realistic[0]
}
