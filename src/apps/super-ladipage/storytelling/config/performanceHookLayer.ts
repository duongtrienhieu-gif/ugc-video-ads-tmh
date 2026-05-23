// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — PERFORMANCE HOOK LAYER (v5.8 / Reader-Immersion)
//
// Per user direction: shift from "Narrator Storytelling" → "Reader-Immersion
// Performance Storytelling". Goal: ad conversion. Reader must feel
// "đang nói về mình" within 1-3 seconds, NOT "nghe chuyện người khác".
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
// SAMPLING:
//   - 1 youFirstOpener per pack (8 options) — drives starter family
//   - 1 bridgePhrase per pack (6 options) — drives step 4 transition
//
// CRITICAL: example questions are NICHE-MISMATCHED across products. Gemini
// learns STRUCTURAL PATTERN (starter family + question shape) without
// being able to copy any quote verbatim (niche won't match the pack).
// Same pattern as Chunk 1 reviewStyleProfiles to prevent verbatim leak.
//
// REPLACES (not adds):
//   - HOOK_PATTERNS injection in section 1 directive (downgraded to flavor only)
//   - HOOK_ENFORCEMENT_PROMPT (already removed in v5.7 Phase A)
//
// KEEPS intact:
//   - hookPattern selection (still drives emotional flavor as ADDITIONAL axis)
//   - hookAxis selection (still drives emotional axis)
//   - All other sampling objects
// ─────────────────────────────────────────────────────────────────────

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
