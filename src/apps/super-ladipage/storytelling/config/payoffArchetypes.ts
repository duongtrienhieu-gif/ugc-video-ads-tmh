// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — PAYOFF ARCHETYPES (v5.7 Phase C / Chunk 2)
//
// Per user direction after Phase C test:
//   "Endings nào cũng 'nhẹ hơn / bình yên hơn / lắng nghe cơ thể'."
//   "Ending emotional tone phải sampled. KHÔNG default 'peaceful reflection'."
//
// Payoff = the emotional DESTINATION reader reaches by end of pack. Drives
// sections 8 (emotional-payoff) + 9 (reflection-trust) + 11 (soft-cta).
// Without sampling: every pack defaults to "quiet_peace + healed body +
// gratitude reflection". Reader exits 4 packs in a row with same feeling
// regardless of niche/narrator/product.
//
// SAMPLING ARCHITECTURE: each pack gets 1 payoff archetype via seed. The
// archetype's per-section flavor briefs replace the generic "peaceful"
// default. Reader's emotional destination varies per pack independently
// of narrator/niche/product axes.
//
// 12 archetypes (user-specified list, locked):
//   quiet_peace / social_confidence / vanity_return / relationship_repair /
//   energy_recovery / productivity_return / identity_return / anger_regret /
//   self_respect_return / emotional_reconnection / motherhood_strength /
//   ambition_return
//
// CRITICAL: per-section flavor briefs are STRUCTURAL HINTS not prose
// templates. They describe WHAT emotional destination this archetype
// targets — Gemini generates phrasing per narrator voice.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

export type PayoffArchetypeId =
  | 'quiet-peace'              // existing default — internal calm + body release
  | 'social-confidence'        // back in public, can show up at events / meetings
  | 'vanity-return'            // mirror feels OK again, photos OK, dressing up matters
  | 'relationship-repair'      // less snapping at family, present with kids/spouse
  | 'energy-recovery'          // physical capacity restored — can do more in a day
  | 'productivity-return'      // work output picked up, mental sharpness back
  | 'identity-return'          // "tôi đã quay lại là tôi" — recognized self in mirror
  | 'anger-regret'             // anger at how long they accepted suffering as normal
  | 'self-respect-return'      // stopped apologizing for own needs / discomfort
  | 'emotional-reconnection'   // can feel emotions again, not numb
  | 'motherhood-strength'      // present + patient with kids, no longer exhausted-shouting
  | 'ambition-return'          // dared to plan things again — trips, projects, future

export interface PayoffArchetype {
  id: PayoffArchetypeId
  label: string
  /** Emotional destination 1-line summary — what does reader exit feeling? */
  destination: string
  /** Per-section flavor briefs. Drive sections 8 / 9 / 11 directives.
   *  Each is a concrete WHAT-not-HOW directive — Gemini decides phrasing
   *  via narrator voice. */
  sectionFlavor: {
    'emotional-payoff':   string  // section 8 — the felt change
    'reflection-trust':   string  // section 9 — looking back maturity
    'soft-cta':           string  // section 11 — closing invitation tone
  }
  /** Niches where this archetype lands naturally. Other niches can still
   *  pick it but will need narrator/context bridging. */
  preferredNiches?: NicheKey[]
}

export const PAYOFF_ARCHETYPES: Record<PayoffArchetypeId, PayoffArchetype> = {
  'quiet-peace': {
    id: 'quiet-peace',
    label: 'Quiet internal peace',
    destination: 'internal calm, body settled, no big drama — just less heavy',
    sectionFlavor: {
      'emotional-payoff':
        'cơ thể nhẹ đi, không còn căng / mệt như trước. Daily moments feel less heavy. Đây là VÙNG QUEN NHẤT của storytelling — đảm bảo cụ thể, không generic "thấy bình yên".',
      'reflection-trust':
        'không kịch tính. Nhận ra mình đã quên cảm giác "không mệt" lâu thế nào. Mature acceptance, không revelation.',
      'soft-cta':
        'gentle peer-tone invitation. Không urgency. "Nếu bạn cũng đang ở giai đoạn đó..." vibe.',
    },
  },
  'social-confidence': {
    id: 'social-confidence',
    label: 'Social confidence return',
    destination: 'có thể xuất hiện ngoài xã hội lại — events, gặp bạn, đi chợ, dự đám',
    sectionFlavor: {
      'emotional-payoff':
        'dám đi gặp bạn cũ lại / dám dự đám / không né tránh tụ tập như trước. Concrete social moments. Quan trọng: NOT về appearance — về dám-xuất-hiện.',
      'reflection-trust':
        'nhận ra mình đã withdraw khỏi xã hội bao lâu mà không tự biết. Slight regret + relief returning.',
      'soft-cta':
        'shared-experience-close tone. "Tôi viết cái này vì biết có người cũng đang ngại ra ngoài như tôi từng vậy."',
    },
  },
  'vanity-return': {
    id: 'vanity-return',
    label: 'Vanity return — mirror OK again',
    destination: 'soi gương không né tránh, dám make-up lại, dressing up không thấy giả tạo',
    preferredNiches: ['skincare', 'haircare', 'beauty-confidence'],
    sectionFlavor: {
      'emotional-payoff':
        'concrete vanity moments returning — soi gương buổi sáng không tránh, photos không xóa, đứng trước tủ đồ chọn được. Honest about vanity mattering. KHÔNG self-deprecating "vẻ ngoài không quan trọng".',
      'reflection-trust':
        'admit mình đã tránh gương / tránh ảnh / tránh nhìn thẳng bản thân. Reclaim right to care about appearance.',
      'soft-cta':
        'gentle-permission tone. "Có lẽ bạn cũng có quyền chăm cho mình lại..." Không guilt.',
    },
  },
  'relationship-repair': {
    id: 'relationship-repair',
    label: 'Family relationship repair',
    destination: 'less snapping at chồng / con / bố mẹ. Present in conversations. Patience returned.',
    preferredNiches: ['mom-baby', 'supplement-wellness', 'relationship'],
    sectionFlavor: {
      'emotional-payoff':
        'concrete relationship micro-moments: ngồi nghe con kể chuyện cả buổi, không snap chồng vì chuyện vặt, ăn cơm cả nhà mà không vội. Repair shown through behavior not declaration.',
      'reflection-trust':
        'nhận ra mình đã cộc cằn bao lâu mà cứ nghĩ là personality. Apologize internally to family.',
      'soft-cta':
        'peer-acknowledgment tone. "Bạn không phải người duy nhất từng nghĩ mình là người cộc tính bẩm sinh."',
    },
  },
  'energy-recovery': {
    id: 'energy-recovery',
    label: 'Physical energy recovery',
    destination: 'dậy không nặng đầu, đi cả ngày không kiệt, chiều 3h không cạn pin',
    preferredNiches: ['supplement-wellness', 'health-functional', 'mom-baby', 'fitness-recovery'],
    sectionFlavor: {
      'emotional-payoff':
        'physical capacity moments restored: đi siêu thị + ghé chợ + về nấu cơm trong 1 chiều, đứng lớp 4-5 tiếng không phải ngồi nghỉ, leo cầu thang lên tầng 3 không thở dốc. Specific physical thresholds.',
      'reflection-trust':
        'nhận ra mình đã "co lại" so với khả năng cũ. Realize what "bình thường" used to mean.',
      'soft-cta':
        'quiet-invitation. "Nếu bạn cũng đang chỉ có một nửa năng lượng so với trước..."',
    },
  },
  'productivity-return': {
    id: 'productivity-return',
    label: 'Productivity / mental sharpness return',
    destination: 'làm việc tập trung lại, deadline OK, đầu óc không sương mù',
    preferredNiches: ['supplement-wellness', 'health-functional'],
    sectionFlavor: {
      'emotional-payoff':
        'cognitive moments: ngồi xử lý email không zoom-out, follow được cuộc họp 2 tiếng không zone-out, đọc 1 bài article hết mà không phải đọc lại. Work-life specific.',
      'reflection-trust':
        'nhận ra mình đã chấp nhận "brain fog" như normal aging. Anger nhẹ + relief.',
      'soft-cta':
        'shared-experience-close. "Tôi viết cái này vì biết có người cũng đang nghĩ mình đang dở chứng tuổi 40..."',
    },
  },
  'identity-return': {
    id: 'identity-return',
    label: 'Identity / sense-of-self return',
    destination: '"đây mới là tôi" — recognized self, không cảm thấy như đang sống version giảm dần',
    sectionFlavor: {
      'emotional-payoff':
        'identity moments: soi gương + recognize ánh mắt cũ, làm thứ mình từng yêu thích lại (vẽ / piano / đi bộ buổi tối / nấu món yêu), nói chuyện theo cách mình từng nói. KHÔNG generic "tôi đã thay đổi".',
      'reflection-trust':
        'realize mình đã đánh mất chính mình từng chút mỗi tháng mà không nhận ra. Reclaim language: "tôi đã quay lại là tôi".',
      'soft-cta':
        'gentle-permission. "Nếu bạn cũng cảm thấy mình đang sống một version giảm dần..."',
    },
  },
  'anger-regret': {
    id: 'anger-regret',
    label: 'Anger / regret at how long suffering was accepted',
    destination: 'tức nhẹ với bản thân vì đã chịu đựng quá lâu như chuyện đương nhiên',
    sectionFlavor: {
      'emotional-payoff':
        'anger moments: nhận ra mình đã chịu đựng X năm trời mà không cần phải vậy. KHÔNG suffering-glorification. KHÔNG self-pity. Pissed-off-at-self-for-accepting-it tone.',
      'reflection-trust':
        '"giận một chút khi nghĩ tại sao mình lại để bản thân vậy lâu thế." Mature anger — không dramatic, không bitter forever, just honest regret.',
      'soft-cta':
        'peer-acknowledgment with edge. "Đừng đợi như tôi đợi — không cần phải chịu thêm để chứng minh điều gì."',
    },
  },
  'self-respect-return': {
    id: 'self-respect-return',
    label: 'Self-respect return — stopped minimizing own needs',
    destination: 'không xin lỗi vì có nhu cầu của riêng mình; ưu tiên bản thân không thấy guilty',
    preferredNiches: ['mom-baby', 'relationship', 'supplement-wellness'],
    sectionFlavor: {
      'emotional-payoff':
        'self-respect moments: dám nói "không" với việc thêm, dám đi spa / mua thuốc cho mình mà không thấy có lỗi với chồng/con, dám ngủ thêm 30 phút thay vì dậy sớm phục vụ cả nhà.',
      'reflection-trust':
        'realize mình đã put-self-last bao lâu như default. Without resentment toward family — just reclaiming own slot.',
      'soft-cta':
        'gentle-permission. "Bạn cũng có quyền chăm cho mình — không phải selfish, là cần thiết."',
    },
  },
  'emotional-reconnection': {
    id: 'emotional-reconnection',
    label: 'Emotional reconnection — feeling things again',
    destination: 'cảm xúc trở lại, không còn numb / flat / chỉ-vận-hành',
    sectionFlavor: {
      'emotional-payoff':
        'emotion moments returning: khóc khi xem 1 đoạn phim, cười khi con kể chuyện vô lý, thấy đẹp khi nhìn buổi sáng. Affect awakening. NOT dramatic — small re-sensitization.',
      'reflection-trust':
        'nhận ra mình đã sống "phẳng" — không buồn, không vui, chỉ vận hành. Realize emotion absence was a symptom not personality.',
      'soft-cta':
        'shared-experience-close. "Nếu bạn cũng đã quen với việc không thấy gì cả..."',
    },
  },
  'motherhood-strength': {
    id: 'motherhood-strength',
    label: 'Motherhood strength — present + patient again',
    destination: 'làm mẹ không kiệt sức, present với con, không la hét vô cớ',
    preferredNiches: ['mom-baby', 'supplement-wellness'],
    sectionFlavor: {
      'emotional-payoff':
        'motherhood micro-moments: ngồi cả buổi tối chơi với con không nhìn đồng hồ, không la lên khi con làm vỡ ly, đọc truyện cho con đến hết cuốn không buồn ngủ. Concrete maternal capacity restored.',
      'reflection-trust':
        'nhận ra mình đã sợ chính bản thân khi mệt — sợ mình sẽ snap. Now feel safe with self around kids.',
      'soft-cta':
        'peer-acknowledgment. "Bạn không phải mẹ tệ — bạn chỉ là mẹ kiệt sức. Có khác nhau."',
    },
  },
  'ambition-return': {
    id: 'ambition-return',
    label: 'Ambition return — planning future again',
    destination: 'dám lên kế hoạch — chuyến đi / dự án / mục tiêu — không thấy quá sức',
    sectionFlavor: {
      'emotional-payoff':
        'ambition moments: book chuyến đi cuối năm, start lại blog/study/business idea, viết down 1 năm goals. Not grand — restored capacity to imagine future.',
      'reflection-trust':
        'realize mình đã ngừng plan ahead bao giờ — chỉ survive từng tuần. Future-tense returns.',
      'soft-cta':
        'quiet-invitation. "Nếu bạn cũng đã quên cảm giác mong chờ một điều gì..."',
    },
  },
}

// ═══ SAMPLING ═════════════════════════════════════════════════════════

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Sample 1 payoff archetype per pack. Biased toward niche-preferred when
 *  available, otherwise picks from full pool. Deterministic per seed. */
export function samplePayoffArchetype(seed: string, niche: NicheKey): PayoffArchetype {
  const all = Object.values(PAYOFF_ARCHETYPES)

  // Build candidate pool: niche-preferred archetypes get 2x weight via duplication.
  const preferred = all.filter((a) => a.preferredNiches?.includes(niche))
  const pool: PayoffArchetype[] = [...all, ...preferred]  // preferred appear twice

  const idx = hashSeed(`${seed}:payoff`) % pool.length
  return pool[idx]
}

/** Compose payoff brief for prompt injection.
 *  Used per-section in buildPackGenPrompt for s8/s9/s11. */
export function payoffSectionFlavor(
  payoff: PayoffArchetype,
  sectionId: 'emotional-payoff' | 'reflection-trust' | 'soft-cta',
): string {
  return `PAYOFF ARCHETYPE: ${payoff.id} — destination=${payoff.destination}
  Section-specific flavor: ${payoff.sectionFlavor[sectionId]}`
}

/** Top-level archetype brief — injected at top of pack prompt so narrator
 *  knows where the story arc is heading emotionally. */
export function payoffArchetypeBrief(payoff: PayoffArchetype): string {
  return `═══ PAYOFF ARCHETYPE (per-pack — where this story ENDS emotionally) ═══
ID: ${payoff.id}
Destination: ${payoff.destination}

This drives the FELT TONE of sections 8 (emotional-payoff), 9 (reflection-
trust), 11 (soft-cta). KHÔNG default "peaceful reflection" — every pack
ends in a different emotional place. Narrator voice still drives phrasing.`
}
