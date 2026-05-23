// ─────────────────────────────────────────────────────────────────────
// Storytelling Engine — CORE PHILOSOPHY (v5.7)
//
// Single small global prompt. Replaces 7 separate global directives
// (RETENTION_RESTRAINT / MICRO_REALISM / VISUAL_FIRST_WRITING /
// RHYTHM_ENGINE / HOOK_ENFORCEMENT / BELIEF_SHIFT / SOFT_CTA) which
// duplicated what's already in per-section directives and bloated prompt.
//
// Architecture principle (per user direction):
//   KEEP CORE SYSTEM SMALL.
//   Per-pack diversity lives in sampling objects (narrator / hookAxis /
//   memorySnapshot / reviewStyle / energyCurve / discoveryChannel),
//   NOT in giant prompt rules.
//
// What stays in this core:
//   - North star (what reader should feel)
//   - Voice baseline (1st person, conversational cadence, embodied specifics)
//   - Hard bans that ARE NOT covered by per-section directives or sampling
//   - Output format
//
// What does NOT belong here:
//   - Per-section structure (lives in buildSectionDirective)
//   - Per-pack variation flavor (lives in sampling object briefs)
//   - Long anti-pattern lists (anti-rules → cause prompt entropy + flatten output)
// ─────────────────────────────────────────────────────────────────────

export const ENGINE_CORE_PHILOSOPHY =
  `═══ CORE PHILOSOPHY ═══

NORTH STAR: reader finishes thinking "trời giống mình thật" — NOT "writing đẹp",
NOT "marketing copy". One single test.

VOICE BASELINE:
- 1st person "tôi" (KHÔNG 3rd-person observer mode).
- Conversational flowing sentences (12-20 từ avg). Read-aloud test.
- Specific NAMED pain via embodied physical moments (vịn cầu thang, soi gương,
  đứng giữa siêu thị), NOT abstract feelings ("có gì đó", "cảm thấy không ổn").
- Imperfect human cadence OK — abrupt thought stops, occasional overlong line,
  paragraph asymmetry, accidental-looking pacing. Human writing không clean.
- Allow slightly awkward phrasing if natural. Reader recognition > prose beauty.

PULL MECHANICS (replaces retention essay):
- Curiosity from observation / behavior / omission / emotional mismatch / tiny anomalies.
- Tone: diary / confession / documentary — NEVER serialized fiction.
- No drama escalation, no fake suspense, no plot-twist energy.

OUTPUT: valid JSON only — no markdown fences, no prose outside JSON.`
