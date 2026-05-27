// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — NICHE DESIRE ARCHITECTURE (Chunk C2)
//
// Per-niche EMOTIONAL GRAVITY + buying psychology pressure axes.
// Counters "tired/healing default" flattening across niches.
//
// Different niches have FUNDAMENTALLY DIFFERENT emotional gravity:
//   - haircare → femininity + identity (NOT body fatigue)
//   - supplement-wellness → aliveness + emotional stability (NOT just rest)
//   - beauty-confidence → attractiveness + social presence (NOT inner calm)
//   - relationship → patience + warmth + connection (NOT physical recovery)
//   - health-functional → mobility + dignity + capacity (NOT calm)
//   - fitness-recovery → activity restoration + dignity (NOT rest)
//   - mom-baby → self-reclamation + recognition (NOT physical reset)
//   - skincare → age-presence + visibility (NOT inner peace)
//
// Inject per-pack at top of user prompt — narrator's emotional destination
// LOCKED. Phase 4 ending must NOT default to "healing + tired-out" trope.
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

export interface NicheDesireArchitecture {
  niche: NicheKey
  /** Primary desire force — what buyer ACTUALLY wants emotionally. */
  primaryDesire: string
  /** Specific desire tensions (3-5) — emotional forces driving purchase. */
  desireTensions: string[]
  /** Emotional gravity description for prompt injection. */
  emotionalGravity: string
  /** Forbidden default emotional resolutions — anti-flattening. */
  forbiddenDefaults: string[]
}

export const NICHE_DESIRE_ARCHITECTURE: Record<NicheKey, NicheDesireArchitecture> = {
  'haircare': {
    niche: 'haircare',
    primaryDesire: 'identity restoration / femininity reclamation',
    desireTensions: [
      'attractiveness anxiety (sợ không còn xinh)',
      'aging-via-hair-loss fear (tóc rụng = già đi rõ)',
      'mirror avoidance habit (không soi gương buổi sáng)',
      'identity erosion (không nhận ra phiên bản trước)',
    ],
    emotionalGravity: 'femininity + identity (NOT generic body fatigue/healing)',
    forbiddenDefaults: [
      'tired and healing tone',
      'body-system-rest narrative',
      'generic self-care resolution',
      'calm inner peace ending without external visibility',
    ],
  },

  'skincare': {
    niche: 'skincare',
    primaryDesire: 'age-presence restoration / visibility without anxiety',
    desireTensions: [
      'age-visibility fear (sợ người ta thấy mình già)',
      'social-confidence loss (né camera, né selfie)',
      'self-image anxiety (so sánh với bạn cùng tuổi)',
      'unable to hide signs of time (kem mới chưa đủ)',
    ],
    emotionalGravity: 'age-presence + social visibility (NOT inner peace alone)',
    forbiddenDefaults: [
      'inner peace conclusion only',
      'self-acceptance without external presence',
      'healing narrative without visibility shift',
      'generic confidence boost',
    ],
  },

  'supplement-wellness': {
    niche: 'supplement-wellness',
    primaryDesire: 'emotional stability / feeling alive again / self return',
    desireTensions: [
      'emotional flatness fear (không vui không buồn)',
      'self-disappearance anxiety (mình đang biến mất)',
      'cognitive decline fear (sương mù não tăng)',
      'aliveness loss (không còn energetic như xưa)',
    ],
    emotionalGravity: 'aliveness + emotional stability (NOT physical-recovery narrative)',
    forbiddenDefaults: [
      'just tired-resolved trope',
      'body aches resolved (wrong domain)',
      'physical capacity narrative without emotional return',
      'sleep-better-only ending',
    ],
  },

  'health-functional': {
    niche: 'health-functional',
    primaryDesire: 'mobility restoration / dignity / not-a-burden',
    desireTensions: [
      'mobility loss fear (vịn cầu thang vĩnh viễn)',
      'becoming a burden fear (gánh nặng cho con)',
      'capacity loss (không chơi với cháu được)',
      'aging body shame (cơ thể xuống nhanh hơn dự đoán)',
    ],
    emotionalGravity: 'mobility + dignity + independent capacity (NOT calm-inner-peace)',
    forbiddenDefaults: [
      'inner peace without mobility return',
      'self-acceptance of decline',
      'gentle resignation tone',
      'emotional-only resolution without physical capacity',
    ],
  },

  'mom-baby': {
    niche: 'mom-baby',
    primaryDesire: 'self-reclamation / "tôi trở lại làm tôi" / being seen as self not just mom',
    desireTensions: [
      'identity loss (mình là ai ngoài "mẹ")',
      'invisible exhaustion (không ai hiểu mình mệt thế nào)',
      'loss of pre-baby self (cơ thể không quay lại)',
      'silent overwhelm (giấu mệt vì là mẹ)',
    ],
    emotionalGravity: 'self-reclamation + visibility-as-self (NOT just physical reset)',
    forbiddenDefaults: [
      'body reset narrative only',
      'tired mom healing trope',
      'self-sacrifice celebrated tone',
      'physical-recovery-only ending',
    ],
  },

  'beauty-confidence': {
    niche: 'beauty-confidence',
    primaryDesire: 'attention restoration / wanting to be looked at again',
    desireTensions: [
      'social-visibility anxiety (né camera, né selfie chung)',
      'attractiveness tension (sự attractiveness đang fade)',
      'lighting/camera avoidance (lùi 1 bước khi soi gương)',
      'peer comparison fatigue (so với bạn cùng tuổi)',
      'lost the "looked-at" feeling',
    ],
    emotionalGravity: 'attractiveness + external presence (NOT calm-inner-peace)',
    forbiddenDefaults: [
      'inner peace conclusion',
      'self-acceptance ending only',
      'healing narrative without external visibility',
      'gentle resignation about aging',
    ],
  },

  'relationship': {
    niche: 'relationship',
    primaryDesire: 'emotional presence / patience restored / warmth returns',
    desireTensions: [
      'snapping at family guilt (cộc với con/chồng)',
      'overstimulation fatigue (mệt khi đám đông)',
      'wanting warmth back (không còn ấm như trước)',
      'avoiding home (ngồi 10p trong xe trước khi vào nhà)',
      'cười cho có (không cảm thấy thật)',
    ],
    emotionalGravity: 'patience + warmth + emotional presence (NOT physical fatigue resolved)',
    forbiddenDefaults: [
      'physical recovery narrative',
      'sleep restoration only',
      'energy back without emotional warmth',
      'tired-mom healing trope',
    ],
  },

  'fitness-recovery': {
    niche: 'fitness-recovery',
    primaryDesire: 'activity restoration / not-locked-out / dignity in body',
    desireTensions: [
      'activity loss fear (không leo núi / đi xa được)',
      'medication dependency anxiety (gắn với thuốc giảm đau dài hạn)',
      'aging body shame (xuống nhanh hơn bạn cùng tuổi)',
      'capacity erosion (đi siêu thị về phải nằm)',
    ],
    emotionalGravity: 'activity + capacity restoration (NOT calm-acceptance of limits)',
    forbiddenDefaults: [
      'gentle resignation tone',
      'self-acceptance of decline',
      'emotional-only resolution',
      'inner peace without physical capacity return',
    ],
  },

  // ── Tier S extensions (2026-05-27) ──

  'sleep-insomnia': {
    niche: 'sleep-insomnia',
    primaryDesire: 'restful nights + waking as yourself again',
    desireTensions: [
      'mind racing vs body exhausted (đầu chạy mà người mệt)',
      'fear of bed (sợ buổi tối vì lại đối diện với gối)',
      'dependency anxiety (gắn với thuốc ngủ dài hạn)',
      'cognitive decline fear (mất ngủ kéo dài làm não yếu)',
    ],
    emotionalGravity: 'restful-night-return + waking-as-self (NOT knocked-out pharmaceutical sleep)',
    forbiddenDefaults: [
      'pharmaceutical-knockout framing',
      'sleep-as-luxury tone',
      'forced-relaxation narrative',
      'sleep hygiene lecture',
    ],
  },

  'menopause': {
    niche: 'menopause',
    primaryDesire: 'identity continuity through hormonal transition / "tôi vẫn là tôi"',
    desireTensions: [
      'identity loss fear (không còn là phụ nữ — chỉ là bà)',
      'invisibility anxiety (chồng / xã hội ngừng quan tâm)',
      'silent suffering (không dám kể với ai)',
      'time anxiety (những năm còn lại chỉ là già + mệt)',
    ],
    emotionalGravity: 'identity-continuity / self-preservation through transition (NOT anti-aging miracle)',
    forbiddenDefaults: [
      'anti-aging miracle framing',
      'youth-recovery narrative',
      'pathologizing menopause as disease',
      'shame-of-aging tone',
    ],
  },

  'mental-health': {
    niche: 'mental-health',
    primaryDesire: 'inner calm return + functional regulation / "có thể thở lại"',
    desireTensions: [
      'high-functioning facade (mệt mà phải cười)',
      'isolation fear (nói thật ai cũng xa)',
      'weakness shame (yếu đuối — người khác chịu được sao mình không)',
      'permanence fear (sẽ không bao giờ thoát được)',
    ],
    emotionalGravity: 'inner-calm-return / nervous system regulation (NOT happy-pill cure)',
    forbiddenDefaults: [
      'depression-cured framing',
      'happy-pill tone',
      'forced positivity ending',
      'mental-illness-as-weakness narrative',
    ],
  },

  'anti-aging-longevity': {
    niche: 'anti-aging-longevity',
    primaryDesire: 'vital years extension / healthspan over lifespan',
    desireTensions: [
      'time-not-enough fear (sẽ không kịp những điều muốn làm)',
      'biological-decline anxiety (xuống nhanh hơn nhận ra)',
      'caregiver burden fear (là gánh nặng cho con cháu)',
      'invisibility-of-old-age (xã hội ngừng nhìn tôi)',
    ],
    emotionalGravity: 'vitality-extension / quality-years return (NOT immortality / fountain-of-youth)',
    forbiddenDefaults: [
      'vanity-aesthetic framing',
      'fountain-of-youth tone',
      'immortality narrative',
      'youth-obsession trope',
    ],
  },

  // ── SEA-6 extensions (2026-05-27) ──

  'dental-oral-care': {
    niche: 'dental-oral-care',
    primaryDesire: 'social smile return / confident close-distance presence',
    desireTensions: [
      'breath shame (sợ người gần để ý)',
      'smile-hiding habit (che miệng khi cười)',
      'photo avoidance (né cười hở răng trong selfie)',
      'social intimacy loss (con/cháu né hôn má)',
    ],
    emotionalGravity: 'social smile + close-distance dignity (NOT cosmetic whiteness only)',
    forbiddenDefaults: [
      'cosmetic-white-teeth framing only',
      'aesthetic smile-makeover tone',
      'commercial dentist promotional voice',
      'beauty-confidence aesthetic narrative',
    ],
  },

  'diabetes-blood-sugar': {
    niche: 'diabetes-blood-sugar',
    primaryDesire: 'health stability + food freedom / "ăn cơm như bình thường lại"',
    desireTensions: [
      'food restriction fatigue (kiêng mãi không xong)',
      'numbers anxiety (A1C lên xuống — không kiểm soát được)',
      'complication fear (mắt / thận / chân — sợ đoạn chi)',
      'social isolation (tiệc tùng phải né)',
    ],
    emotionalGravity: 'health-stability + food-freedom (NOT miracle cure / "chữa khỏi tiểu đường")',
    forbiddenDefaults: [
      'miracle cure framing',
      'replacement-of-medication promise',
      'aggressive medical claim tone',
      'wellness influencer voice',
    ],
  },

  'liver-detox': {
    niche: 'liver-detox',
    primaryDesire: 'internal cleansing + energy return / silent damage reversed',
    desireTensions: [
      'silent damage anxiety (chưa rõ — đã muộn rồi)',
      'social pressure fatigue (bị rủ nhậu — không né được)',
      'mortality fear (xơ gan → ung thư trong 5-10 năm)',
      'fatigue without cause (mệt không lý do)',
    ],
    emotionalGravity: 'internal-cleanse + energy-back (NOT extreme detox / cleansing trend)',
    forbiddenDefaults: [
      'extreme-detox cleansing framing',
      'juice-fast tone',
      'spiritual-purification narrative',
      'fearmongering medical claim',
    ],
  },

  'prostate-urology': {
    niche: 'prostate-urology',
    primaryDesire: 'silent dignity / nighttime sleep return / quiet male capacity',
    desireTensions: [
      'masculine identity threat (không còn "đàn ông" như xưa)',
      'silent shame (không kể với vợ)',
      'sleep deprivation (tiểu đêm phá giấc)',
      'travel anxiety (không dám đi xa)',
      'BPH → cancer fear',
    ],
    emotionalGravity: 'silent-vitality + male-dignity (NOT viagra-style masculine bravado)',
    forbiddenDefaults: [
      'sexual-bravado framing',
      'viagra-style masculine performance tone',
      'aggressive masculine-power narrative',
      'youth-recovery promise',
    ],
  },

  'hemorrhoids-digestive-shame': {
    niche: 'hemorrhoids-digestive-shame',
    primaryDesire: 'discreet comfort return / bathroom dignity / no-one-knows healing',
    desireTensions: [
      'extreme privacy (kể với ai cũng nhục)',
      'physical pain ongoing (đau khi ngồi / đi vệ sinh)',
      'surgery fear (cắt trĩ — đau khủng khiếp)',
      'social activity limitation (né xe máy / đi xa)',
      'cancer confusion (sợ ung thư trực tràng vì máu)',
    ],
    emotionalGravity: 'discreet-comfort + bathroom-dignity (NOT trendy wellness tone)',
    forbiddenDefaults: [
      'cheerful-wellness framing',
      'aspirational lifestyle tone',
      'social-share testimonial voice',
      'aesthetic photogenic narrative',
    ],
  },

  'eye-vision-care': {
    niche: 'eye-vision-care',
    primaryDesire: 'visual clarity + screen endurance / "đọc chữ thoải mái lại"',
    desireTensions: [
      'screen-fatigue cumulative (cuối ngày mắt không nhìn nổi nữa)',
      'aging vision fear (60 tuổi phẫu thuật)',
      'work productivity loss (không nhìn rõ → làm chậm)',
      'driving night fear (chói đèn không lái được)',
    ],
    emotionalGravity: 'clarity + capacity (NOT aspirational "perfect vision" / laser-eye marketing)',
    forbiddenDefaults: [
      'perfect-vision miracle framing',
      'laser-eye-surgery promotional tone',
      'beauty-aesthetic eye narrative',
      'youth-restoration voice',
    ],
  },

  // ── SPEC-FIX (2026-05-27) — health-functional split ──

  'health-respiratory': {
    niche: 'health-respiratory',
    primaryDesire: 'breath freedom return / quiet nights / no mouth-breathing',
    desireTensions: [
      'sleep disruption (đêm nào cũng há miệng thở)',
      'social discomfort (hỉ mũi trong cuộc họp / tụ tập)',
      'sinus surgery fear (sẽ phải mổ xoang vài năm tới)',
      'spray-dependency anxiety (phụ thuộc thuốc co mạch)',
    ],
    emotionalGravity: 'breath-freedom + sleep-restoration (NOT vague "wellness from within")',
    forbiddenDefaults: [
      'generic wellness from within framing',
      'instant unblock miracle tone',
      'detox / cleanse narrative (wrong domain)',
      'aesthetic / beauty framing',
    ],
  },

  'health-joint': {
    niche: 'health-joint',
    primaryDesire: 'mobility restoration / dignity / not-a-burden',
    desireTensions: [
      'mobility loss fear (vịn cầu thang vĩnh viễn)',
      'becoming a burden fear (gánh nặng cho con)',
      'capacity loss (không chơi với cháu được)',
      'aging body shame (cơ thể xuống nhanh hơn dự đoán)',
    ],
    emotionalGravity: 'mobility + dignity + independent capacity (NOT calm-acceptance-of-decline)',
    forbiddenDefaults: [
      'inner peace without mobility return',
      'self-acceptance of decline',
      'gentle resignation tone',
      'emotional-only resolution without physical capacity',
    ],
  },

  'health-digestive': {
    niche: 'health-digestive',
    primaryDesire: 'eat-without-fear / digestive ease / no food anxiety',
    desireTensions: [
      'food restriction fatigue (kiêng cay/chua/dầu mỡ mãi)',
      'cancer fear (viêm → loét → ung thư)',
      'medication dependency (omeprazole cả đời)',
      'social meal anxiety (kén ăn → phiền người khác)',
    ],
    emotionalGravity: 'eat-freely + digestive-ease (NOT detox / cleanse / weight loss)',
    forbiddenDefaults: [
      'detox cleansing framing',
      'weight-loss tone',
      'beauty / aesthetic narrative',
      'spiritual purification voice',
    ],
  },

  'health-cardiovascular': {
    niche: 'health-cardiovascular',
    primaryDesire: 'stable numbers / peace of mind / years with family',
    desireTensions: [
      'mortality fear (đột quỵ / nhồi máu ban đêm)',
      'medication-dependence anxiety (uống thuốc cả đời)',
      'time-running-out (sợ không kịp xem con cháu lớn)',
      'numbers anxiety (huyết áp lên xuống không kiểm soát)',
    ],
    emotionalGravity: 'cardiac-stability + peace-of-mind (NOT miracle cure / replacing medication)',
    forbiddenDefaults: [
      'miracle cure framing',
      'replacement-of-medication promise',
      'fearmongering tone',
      'wellness influencer voice',
    ],
  },
}

/** Get desire architecture for niche — never null (22 niches covered). */
export function getDesireForNiche(niche: NicheKey): NicheDesireArchitecture {
  return NICHE_DESIRE_ARCHITECTURE[niche]
}

/** Compose desire brief for prompt injection.
 *
 *  CP-SYNTHESIS (2026-05-28): when product-specific commercial psychology
 *  is provided (primaryDesire / desireTensions / emotionalGravity from
 *  synthesizeCommercialPsychology), THEY OVERRIDE niche-table defaults.
 *  Niche table acts as fallback baseline. Same pattern as SPEC.1
 *  (synthesis symptoms override niche pool). */
export function nicheDesireBrief(
  desire: NicheDesireArchitecture,
  commercialPsych?: {
    primaryDesire?: string
    desireTensions?: string[]
    emotionalGravity?: string
  },
): string {
  const useSynthesis = Boolean(
    commercialPsych
    && commercialPsych.primaryDesire && commercialPsych.primaryDesire.length > 5,
  )

  const primaryDesire = useSynthesis ? commercialPsych!.primaryDesire! : desire.primaryDesire
  const desireTensions = useSynthesis && commercialPsych!.desireTensions && commercialPsych!.desireTensions!.length > 0
    ? commercialPsych!.desireTensions!
    : desire.desireTensions
  const emotionalGravity = useSynthesis && commercialPsych!.emotionalGravity && commercialPsych!.emotionalGravity!.length > 5
    ? commercialPsych!.emotionalGravity!
    : desire.emotionalGravity

  return [
    `═══ DESIRE GRAVITY (${useSynthesis ? 'product-synthesized — AUTHORITATIVE' : `niche-baseline ${desire.niche}`}) ═══`,
    `Primary desire: ${primaryDesire}`,
    `Emotional gravity (Phase 4 ending MUST land here): ${emotionalGravity}`,
    `Desire tensions (use 1-2 in Phase 1-2 to surface):`,
    ...desireTensions.map((t) => `  - ${t}`),
    `⛔ FORBIDDEN Phase-4 defaults (anti-flattening — NEVER end pack with these):`,
    ...desire.forbiddenDefaults.map((d) => `  ✗ ${d}`),
  ].join('\n')
}
