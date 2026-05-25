// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — PERFORMANCE HOOK LAYER
//
// Consolidated section-1 hook architecture + emotional-flavor axes for
// the whole pack. Reader-immersion goal: reader feels "đang nói về mình"
// within 1-3 seconds, NOT "nghe chuyện người khác".
//
// THIS FILE OWNS:
//   1. YouFirstOpeners + BridgePhrases — section-1 4-step structure
//   2. HOOK_PATTERNS — emotional posture flavor (drives s1 additional axis)
//   3. HOOK_AXES + NICHE_HOOK_AXIS_BIAS — pack-level emotional theme
//      (drives which emotional drawer the pack pulls from; niche-biased)
//
// Section 1 (hook-interrupt) STRUCTURE LOCKED to 4-step:
//   [1] YOU-FIRST opening — calls reader by name ("Bạn có từng...")
//   [2] SPECIFIC MICRO MOMENT — concrete physical/behavioral beat
//   [3] HIDDEN EMOTION — surface unspoken feeling reader carries silently
//   [4] BRIDGE TO TÔI — narrator joins reader ("Tôi cũng từng như vậy.")
//
// Steps 1 and 4 are MANDATORY structural. Steps 2-3 emerge from
// narrator psychology + niche pain (sampled elsewhere).
//
// SAMPLING per pack:
//   - 1 youFirstOpener (8 options) — drives starter family
//   - 1 bridgePhrase (6 options) — drives step 4 transition
//   - 1 hookPattern (6 emotional postures) — flavor axis
//   - 1 hookAxis (10 emotional themes, niche-biased) — pack theme
//
// CRITICAL: youFirstOpener example questions are NICHE-MISMATCHED across
// products. Gemini learns STRUCTURAL PATTERN without being able to copy
// quotes verbatim (niche won't match the pack). Same anti-leak pattern
// as reviewStyleProfiles.
// ─────────────────────────────────────────────────────────────────────

import type { HookPattern, NicheKey } from '../types'

export type YouFirstStarter =
  | 'have-you-ever'        // "Bạn có từng..."
  | 'if-recently-you'      // "Nếu gần đây bạn..."
  | 'some-days-you'        // "Có những ngày bạn..."
  | 'maybe-when-you'       // "Có khi nào bạn..."
  | 'you-also-question'    // "Bạn cũng vậy không..."
  | 'have-you-noticed'     // "Bạn có để ý..."
  | 'how-long-since-you'   // "Đã bao lâu rồi bạn không..."
  | 'do-you-still'         // "Bạn còn nhớ cảm giác..."

export interface YouFirstOpener {
  id: YouFirstStarter
  starter: string
  /** When this starter family lands best. */
  emotionalFit: string
  /** 3 niche-mismatched example questions to teach pattern, not phrase. */
  exampleQuestions: string[]
}

export const YOU_FIRST_OPENERS: YouFirstOpener[] = [
  {
    id: 'have-you-ever',
    starter: 'Bạn có từng',
    emotionalFit: 'past-tense recall — invites reader to dig up specific memory',
    exampleQuestions: [
      'Bạn có từng đứng cạnh mép giường vài phút chỉ để lấy can đảm bước xuống đất?',
      'Bạn có từng vén tóc lên rồi đặt xuống vì không muốn nhìn rõ vùng đỉnh đầu?',
      'Bạn có từng phải vịn vào thành tủ bếp vài giây mới đứng vững?',
    ],
  },
  {
    id: 'if-recently-you',
    starter: 'Nếu gần đây bạn',
    emotionalFit: 'present-arc — invites recognition of current ongoing pattern',
    exampleQuestions: [
      'Nếu gần đây bạn bắt đầu thấy đầu gối nhói lên khi đứng dậy — thì bạn không phải là người duy nhất.',
      'Nếu gần đây bạn hay ngồi yên 10 phút trước khi rời khỏi giường — bạn không một mình.',
      'Nếu gần đây bạn để ý mình hay quên giữa câu — không phải là chuyện tuổi tác đâu.',
    ],
  },
  {
    id: 'some-days-you',
    starter: 'Có những ngày bạn',
    emotionalFit: 'episodic — softer, allows for "không phải ngày nào cũng vậy"',
    exampleQuestions: [
      'Có những ngày bạn chỉ muốn gội đầu thật nhanh vì không muốn thấy thêm tóc trong cống nữa.',
      'Có những ngày bạn ngồi vào bàn làm việc rồi 30 phút sau vẫn chưa làm được gì.',
      'Có những ngày bạn đi qua gương mà cố tình không nhìn vào.',
    ],
  },
  {
    id: 'maybe-when-you',
    starter: 'Có khi nào bạn',
    emotionalFit: 'rhetorical-soft — invites without confrontation',
    exampleQuestions: [
      'Có khi nào bạn ngồi nhìn bàn tay mình rồi tự hỏi: cơ thể đang xuống nhanh vậy sao?',
      'Có khi nào bạn vừa khen con xong là quay đi vì sợ lúc đó mình không đủ kiên nhẫn?',
      'Có khi nào bạn google triệu chứng của mình lúc 2 giờ sáng?',
    ],
  },
  {
    id: 'you-also-question',
    starter: 'Bạn cũng vậy',
    emotionalFit: 'companion — assumes shared experience, low confrontation',
    exampleQuestions: [
      'Bạn cũng vậy không — sáng dậy mệt hơn cả lúc đêm hôm trước?',
      'Bạn cũng vậy à — đi siêu thị về phải nằm 30 phút mới đứng nổi?',
      'Bạn cũng vậy chứ — soi gương rồi tự hỏi "đây có phải mình không?"',
    ],
  },
  {
    id: 'have-you-noticed',
    starter: 'Bạn có để ý',
    emotionalFit: 'observation-led — invites self-monitoring posture',
    exampleQuestions: [
      'Bạn có để ý dạo này mình hay phải đứng nghỉ giữa cầu thang không?',
      'Bạn có để ý buổi tối tóc rụng trên gối nhiều hơn trước hẳn không?',
      'Bạn có để ý 3 giờ chiều là pin tinh thần đã cạn rồi không?',
    ],
  },
  {
    id: 'how-long-since-you',
    starter: 'Đã bao lâu rồi bạn không',
    emotionalFit: 'absence-aware — surfaces what reader has stopped doing without noticing',
    exampleQuestions: [
      'Đã bao lâu rồi bạn không thấy mình thật sự nhẹ nhõm khi thức dậy?',
      'Đã bao lâu rồi bạn không dám mặc cái áo mình từng yêu thích?',
      'Đã bao lâu rồi bạn không ngồi yên với chính mình mà không thấy mệt?',
    ],
  },
  {
    id: 'do-you-still',
    starter: 'Bạn còn nhớ cảm giác',
    emotionalFit: 'memory-pull — invites comparison with past self',
    exampleQuestions: [
      'Bạn còn nhớ cảm giác sáng dậy không nặng đầu là thế nào không?',
      'Bạn còn nhớ lần cuối bạn soi gương mà không tránh ánh mắt mình là khi nào không?',
      'Bạn còn nhớ cảm giác chạy lên cầu thang mà không phải đếm bậc không?',
    ],
  },
]

export interface BridgePhrase {
  id: string
  phrase: string
  vibe: string
}

export const BRIDGE_PHRASES: BridgePhrase[] = [
  { id: 'me-too-was',         phrase: 'Tôi cũng từng như vậy.',                  vibe: 'simple direct join' },
  { id: 'i-stood-there',      phrase: 'Tôi cũng từng đứng đó.',                  vibe: 'embodied memory join' },
  { id: 'i-was-there-too',    phrase: 'Tôi cũng đã ở đó.',                       vibe: 'quieter empathy join' },
  { id: 'me-also-now',        phrase: 'Mình cũng vậy đó.',                       vibe: 'casual peer join' },
  { id: 'me-still-remember',  phrase: 'Tôi vẫn còn nhớ cảm giác đó.',            vibe: 'memory-anchored join' },
  { id: 'maybe-you-know-it',  phrase: 'Có lẽ bạn cũng biết cảm giác đó rồi.',    vibe: 'gentle continuation' },
]

// ═══ SAMPLING ═════════════════════════════════════════════════════════

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function sampleYouFirstOpener(seed: string): YouFirstOpener {
  const idx = hashSeed(`${seed}:youFirst`) % YOU_FIRST_OPENERS.length
  return YOU_FIRST_OPENERS[idx]
}

export function sampleBridgePhrase(seed: string): BridgePhrase {
  const idx = hashSeed(`${seed}:bridge`) % BRIDGE_PHRASES.length
  return BRIDGE_PHRASES[idx]
}

// ═══ PROMPT INJECTION ═════════════════════════════════════════════════

/** Section 1 directive — replaces old HOOK_PATTERNS injection.
 *  Locks 4-step Performance Hook structure with sampled opener + bridge.
 *  Niche-mismatched examples teach SHAPE without enabling verbatim copy. */
export function performanceHookSection1Directive(
  opener: YouFirstOpener,
  bridge: BridgePhrase,
): string {
  const examples = opener.exampleQuestions
    .map((q) => `    "${q}"`)
    .join('\n')
  return `🎯 PERFORMANCE HOOK LAYER (section 1 — locked 4-step structure)

GOAL: Reader feels "đang nói về mình" within 1-3 seconds. NOT "nghe chuyện người khác".
This is an AD CONVERSION hook. Reader passive observer = ad fails.

[1] YOU-FIRST OPENING (MANDATORY — never start with "Tôi/Mình/Em")
    Starter: ${opener.starter}...
    Fit: ${opener.emotionalFit}
    Shape examples (NEVER copy — niche-mismatched on purpose):
${examples}
    Generate new question for THIS pack's niche/pain using same starter family + shape.

[2] SPECIFIC MICRO MOMENT
    Concrete physical/behavioral beat reader recognizes. Embodied. NOT abstract.
    (vd categories: tránh soi gương / vịn cầu thang / đứng yên giữa siêu thị /
     không nhìn xuống cống thoát nước / ngủ dậy vẫn mệt / che vùng đỉnh đầu)
    Pull from narrator's shame patterns + niche pain (already sampled).

[3] HIDDEN EMOTION
    Name the unspoken feeling reader carries silently — without dramatizing.
    (vd: xấu hổ / né tránh / giả vờ không thấy / tự thu mình lại / bất an thầm)
    1-2 short lines max. NOT trauma escalation.

[4] BRIDGE TO TÔI (MANDATORY — without this step, section feels like accusation)
    Phrase: "${bridge.phrase}"
    Use this exact phrase OR small variation in same vibe (${bridge.vibe}).
    Narrator JOINS reader from this point. Body sections (2+) continue in tôi voice.

Reader exits section 1 thinking "có phải mình không?" — NOT "đây là chuyện ai đó."

CONSTRAINTS:
- KHÔNG mở đầu bằng "Tôi/Mình/Em" — that breaks step [1].
- KHÔNG skip step [4] — without bridge, section feels accusatory.
- KHÔNG "Bạn xứng đáng" / "Đừng để X hủy hoại" / aspirational copywriter bait.
- KHÔNG "Tôi hiểu cảm giác của bạn" / fake empathy.`
}

// ═══ EMOTIONAL FLAVOR AXES ════════════════════════════════════════════
// Layered on top of the 4-step structure. Each pack samples ONE pattern
// + ONE axis. Inject into s1 directive as additional flavor (not as
// opener content — opener is driven by youFirstOpener above).
//
// Examples fields removed: never read by runtime (only `.description`
// was injected). Narrator-first sentence examples (legacy v4.x) would
// also conflict with v5.8 YOU-first opening lock.
// ─────────────────────────────────────────────────────────────────────

export interface HookPatternSpec {
  pattern: HookPattern
  description: string
}

/** 6 narrator emotional postures. Sampled per-pack via NarratorDna.hookPattern.
 *  Layered as flavor axis on top of YOU-first opener (does NOT drive opener
 *  content — opener is locked to YouFirstOpener.starter). */
export const HOOK_PATTERNS: Record<HookPattern, HookPatternSpec> = {
  'emotional-rejection': {
    pattern: 'emotional-rejection',
    description: 'Direct emotional rejection — instant pattern interrupt, "I begin to hate X"',
  },
  'specific-fear-moment': {
    pattern: 'specific-fear-moment',
    description: 'Single concrete moment of internal fear — short, embodied, specific',
  },
  'physical-immediacy': {
    pattern: 'physical-immediacy',
    description: 'Body sensation in the present — sharp, immediate, sensory',
  },
  'internal-confession': {
    pattern: 'internal-confession',
    description: 'Silent admission carried alone — "Tôi không nói với ai" tone',
  },
  'pattern-disruption': {
    pattern: 'pattern-disruption',
    description: 'Sudden change in established pattern noticed — break of routine',
  },
  'self-question': {
    pattern: 'self-question',
    description: 'Internal question reader can ask of themselves — reflective probe',
  },
}

export type HookEmotionalAxis =
  | 'identity-collapse'        // "không nhận ra mình"
  | 'embarrassment'            // public/social shame
  | 'silence'                  // "không nói với ai"
  | 'frustration'              // tried many things, none lasted
  | 'vanity'                   // mirror, ảnh, attractiveness
  | 'exhaustion'               // chronic fatigue body collapse
  | 'relationship'             // chồng/vợ/family witness
  | 'social-discomfort'        // group, friends, public moments
  | 'aging-realization'        // "tôi đang già đi"
  | 'hidden-fear'              // afraid but hide

export interface HookAxisSpec {
  axis: HookEmotionalAxis
  description: string
}

/** 10 emotional themes that color the entire pack. Sampled per-pack via
 *  NarratorDna.hookAxis (niche-biased). Drives which emotional drawer the
 *  pack pulls memories/pains from — NOT a per-section directive. */
export const HOOK_AXES: Record<HookEmotionalAxis, HookAxisSpec> = {
  'identity-collapse':  { axis: 'identity-collapse',  description: 'Không nhận ra phiên bản mình — face/body/voice changed' },
  'embarrassment':      { axis: 'embarrassment',      description: 'Public/social shame moment' },
  'silence':            { axis: 'silence',            description: 'Carrying alone, not telling anyone' },
  'frustration':        { axis: 'frustration',        description: 'Tried many things, all failed — frustration loop' },
  'vanity':             { axis: 'vanity',             description: 'Mirror / appearance / attractiveness preoccupation' },
  'exhaustion':         { axis: 'exhaustion',         description: 'Chronic fatigue body collapse' },
  'relationship':       { axis: 'relationship',       description: 'Spouse/family witness / catalyst' },
  'social-discomfort':  { axis: 'social-discomfort',  description: 'Group / friends / public moments awkwardness' },
  'aging-realization':  { axis: 'aging-realization',  description: 'Sudden awareness "tôi đang già đi"' },
  'hidden-fear':        { axis: 'hidden-fear',        description: 'Afraid but hiding — silent anxiety' },
}

/** Niche-specific axis bias — selector samples from preferred pool when available. */
export const NICHE_HOOK_AXIS_BIAS: Partial<Record<NicheKey, HookEmotionalAxis[]>> = {
  'haircare':            ['vanity', 'identity-collapse', 'embarrassment', 'social-discomfort', 'hidden-fear'],
  'skincare':            ['vanity', 'identity-collapse', 'aging-realization', 'social-discomfort', 'embarrassment'],
  'health-functional':   ['exhaustion', 'embarrassment', 'aging-realization', 'relationship', 'hidden-fear'],
  'supplement-wellness': ['exhaustion', 'silence', 'frustration', 'aging-realization', 'hidden-fear'],
  'mom-baby':            ['identity-collapse', 'silence', 'relationship', 'social-discomfort', 'hidden-fear'],
  'beauty-confidence':   ['vanity', 'identity-collapse', 'social-discomfort', 'embarrassment'],
  'relationship':        ['silence', 'relationship', 'hidden-fear', 'frustration'],
  'fitness-recovery':    ['frustration', 'embarrassment', 'aging-realization', 'exhaustion'],
}
