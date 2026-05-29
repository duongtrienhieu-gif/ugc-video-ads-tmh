// ── Ad Structure Templates ───────────────────────────────────────────────────
// Z31 §2 — 8 UGC ad structures replacing the v2 cinematic storyboard.
//
// Each structure defines:
//   • What the 5 script blocks emphasise
//   • Per-block duration weight (sums to 1.0 — used by the timing estimator
//     to allocate the target duration across blocks)
//   • A Gemini system-prompt hint that drives the actual script generation
//
// All structures use the SAME 5-block skeleton (HOOK / PAIN / DISCOVERY /
// BENEFIT / CTA). Only the EMPHASIS shifts — e.g. SOCIAL_PROOF leans
// heavily into BENEFIT block content with testimonial-style language; a
// LISTICLE leans into a numbered DISCOVERY block; etc.
// ─────────────────────────────────────────────────────────────────────────────

import type { AdStructure, ScriptBlockId } from '../types'

export interface AdStructureConfig {
  id: AdStructure
  labelVi: string
  /** One-line user-facing pitch */
  descriptionVi: string
  /** Emoji shown on picker cards */
  emoji: string
  /** Tone for UI chip */
  tone: 'violet' | 'emerald' | 'amber' | 'pink' | 'sky' | 'rose'
  /** Per-block duration WEIGHT — values sum to ~1.0. Used by the timing
   *  estimator to split targetDurationSec across blocks (e.g. SOCIAL_PROOF
   *  has 30% on benefit because that's where testimonials live). */
  blockWeights: Record<ScriptBlockId, number>
  /** Gemini system-prompt fragment describing this structure. Appended to
   *  the base prompt during script generation. Plain English so Gemini's
   *  TikTok-native pattern matching kicks in. */
  systemPrompt: string
  /** Best-fit niches (just for the picker UI subtitle) */
  bestFor: string[]
}

export const AD_STRUCTURES: Record<AdStructure, AdStructureConfig> = {
  PROBLEM_SOLUTION: {
    id: 'PROBLEM_SOLUTION',
    labelVi: 'Vấn đề → Giải pháp',
    descriptionVi: 'Nêu vấn đề người xem đang gặp, sau đó giới thiệu sản phẩm như giải pháp.',
    emoji: '🧩',
    tone: 'violet',
    blockWeights: { hook: 0.15, pain: 0.25, discovery: 0.20, benefit: 0.25, cta: 0.15 },
    systemPrompt:
      'Write a TikTok-native ad in PROBLEM-SOLUTION format. Start with a relatable problem ' +
      'the viewer has experienced, escalate the pain briefly, then introduce the product as ' +
      'the unexpected fix. Use first-person voice. Avoid corporate adjectives. Sound like a ' +
      'real person sharing what worked, not an ad.',
    bestFor: ['supplement', 'skincare', 'health'],
  },

  STORY_CONFESSION: {
    id: 'STORY_CONFESSION',
    labelVi: 'Kể chuyện / Tự thú',
    descriptionVi: 'Câu chuyện cá nhân kiểu "tôi đã sai về..." — gây tò mò, thân mật.',
    emoji: '🤫',
    tone: 'rose',
    blockWeights: { hook: 0.20, pain: 0.30, discovery: 0.20, benefit: 0.20, cta: 0.10 },
    systemPrompt:
      'Write a TikTok-native ad as a personal CONFESSION story. Begin with an admission ' +
      '("I used to think..." / "For 3 years I made the same mistake..."). The product appears ' +
      'mid-story as the turning point. Conversational, vulnerable, no script-y phrasing. ' +
      'Like a voice memo to a friend, not an ad.',
    bestFor: ['beauty', 'wellness', 'parenting'],
  },

  BEFORE_AFTER: {
    id: 'BEFORE_AFTER',
    labelVi: 'Trước → Sau',
    descriptionVi: 'Khác biệt rõ ràng giữa hai trạng thái — mạnh nhất khi có chuyển biến cảm xúc.',
    emoji: '🔄',
    tone: 'emerald',
    blockWeights: { hook: 0.15, pain: 0.30, discovery: 0.10, benefit: 0.30, cta: 0.15 },
    systemPrompt:
      'Write a TikTok-native BEFORE-AFTER ad. Open with the BEFORE state vividly ' +
      '(specific feelings, specific moments — not "I was tired" but "I crashed every day ' +
      'at 3pm before pickup"). Skip the product intro briefly. The AFTER block must mirror ' +
      'the BEFORE specifics with the new state. Concrete, sensory, no abstractions.',
    bestFor: ['weight-loss', 'skincare', 'energy'],
  },

  AUTHORITY_EXPERT: {
    id: 'AUTHORITY_EXPERT',
    labelVi: 'Chuyên gia / Khoa học',
    descriptionVi: 'Tone tự tin của người trong nghề — bác sĩ, dược sĩ, huấn luyện viên.',
    emoji: '🩺',
    tone: 'sky',
    blockWeights: { hook: 0.10, pain: 0.20, discovery: 0.30, benefit: 0.25, cta: 0.15 },
    systemPrompt:
      'Write a TikTok-native ad in AUTHORITY tone — first-person of someone with credible ' +
      'expertise (doctor, pharmacist, trainer, dietitian). Use a small piece of specific ' +
      'knowledge in the DISCOVERY block (a mechanism, a study finding, a clinical insight) ' +
      'but keep language accessible. No jargon walls. Confidence without arrogance.',
    bestFor: ['supplement', 'medical', 'fitness'],
  },

  PRODUCT_DEMO: {
    id: 'PRODUCT_DEMO',
    labelVi: 'Demo sản phẩm',
    descriptionVi: 'Show cách sản phẩm hoạt động — phù hợp khi mechanic mới hoặc dễ hiểu thị giác.',
    emoji: '🎬',
    tone: 'amber',
    blockWeights: { hook: 0.15, pain: 0.15, discovery: 0.35, benefit: 0.20, cta: 0.15 },
    systemPrompt:
      'Write a TikTok-native PRODUCT DEMO ad. The DISCOVERY block must describe a single ' +
      'concrete usage moment — open this, do that, watch what happens. The script should ' +
      'pair naturally with a hand-held product demo shot. Active verbs, present tense, ' +
      'no abstract benefits in the demo block.',
    bestFor: ['gadget', 'beauty', 'kitchen'],
  },

  SOCIAL_PROOF: {
    id: 'SOCIAL_PROOF',
    labelVi: 'Bằng chứng xã hội',
    descriptionVi: 'Dựa vào số người dùng / review thực — phù hợp với sản phẩm đã bán nhiều.',
    emoji: '⭐',
    tone: 'pink',
    blockWeights: { hook: 0.15, pain: 0.15, discovery: 0.15, benefit: 0.40, cta: 0.15 },
    systemPrompt:
      'Write a TikTok-native ad leaning on SOCIAL PROOF. Quote specific reviewer language ' +
      'in the BENEFIT block (paraphrased — "one girl said this changed her routine"). ' +
      'Mention rough numbers ("20k people tried it") sparingly and only if believable. ' +
      'No fake testimonials, no quoted speech that sounds scripted.',
    bestFor: ['cosmetics', 'fashion', 'COD'],
  },

  PAIN_POINT_HOOK: {
    id: 'PAIN_POINT_HOOK',
    labelVi: 'Hook nỗi đau',
    descriptionVi: 'Đánh thẳng vào nỗi đau cụ thể trong hook — gây dừng scroll.',
    emoji: '💢',
    tone: 'rose',
    blockWeights: { hook: 0.25, pain: 0.30, discovery: 0.15, benefit: 0.15, cta: 0.15 },
    systemPrompt:
      'Write a TikTok-native ad with a PAIN-POINT HOOK. The first line must call out a ' +
      'very specific niche pain ("If you wake up at 3am with your heart racing...") that ' +
      'feels like the algorithm read your mind. The PAIN block stays in that same niche. ' +
      'Product enters late, almost reluctantly. CTA is short and direct.',
    bestFor: ['niche health', 'anxiety', 'sleep'],
  },

  LISTICLE_TIPS: {
    id: 'LISTICLE_TIPS',
    labelVi: 'Listicle / Tips',
    descriptionVi: '3 lý do / tip — format dễ scroll-stop, sản phẩm xuất hiện ở mục cuối.',
    emoji: '📝',
    tone: 'violet',
    blockWeights: { hook: 0.10, pain: 0.10, discovery: 0.50, benefit: 0.20, cta: 0.10 },
    systemPrompt:
      'Write a TikTok-native LISTICLE ad. The DISCOVERY block should structure as a 3-item ' +
      'list ("1... 2... 3..." spoken naturally). The product reveal happens at item 3 — ' +
      'not as the product but as the technique/tool that the speaker uses. BENEFIT block ' +
      'wraps with a one-line summary.',
    bestFor: ['skincare', 'fitness', 'cooking'],
  },
}

export const AD_STRUCTURE_ORDER: AdStructure[] = [
  'PROBLEM_SOLUTION',
  'PAIN_POINT_HOOK',
  'BEFORE_AFTER',
  'STORY_CONFESSION',
  'PRODUCT_DEMO',
  'SOCIAL_PROOF',
  'AUTHORITY_EXPERT',
  'LISTICLE_TIPS',
]
