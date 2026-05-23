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

NORTH STAR: reader-immersion ad performance. Reader exits section 1 thinking
"có phải mình không?" — NOT "đây là chuyện ai đó." Ads convert when reader
feels CALLED BY NAME, not entertained by someone else's story.

VOICE BASELINE (v5.8 Reader-Immersion shift):
- Section 1 (hook-interrupt): YOU-FIRST opening locked. Calls reader directly
  with sampled starter ("Bạn có từng..." / "Nếu gần đây bạn..." / etc), surfaces
  specific micro moment + hidden emotion, then bridges to "tôi" voice.
- Body sections (2-11): 1st person "tôi" narrator + 1 reader-mirror beat per
  section ("Bạn có từng X?" sprinkled to keep reader engaged, not passive
  observer).
- KHÔNG 3rd-person observer mode anywhere.
- Specific NAMED pain via embodied physical moments (vịn cầu thang, soi gương,
  đứng giữa siêu thị), NOT abstract feelings ("có gì đó", "cảm thấy không ổn").

CADENCE PERMISSION (v5.7 Chunk 4 — replaces explicit rhythm prescriptions):
- Imperfect cadence is allowed and encouraged.
- Abrupt thought stops, occasional overlong line, paragraph asymmetry,
  uneven density, fragmented thought, repetition nhẹ — all acceptable if
  emotionally believable for the narrator.
- DO NOT polish toward "AI balanced rhythm" — narrator psychology should
  shape sentence length and break placement.
- Sentence length emerges from narrator voice + emotional state, not target.

PULL MECHANICS (replaces retention essay):
- Curiosity from observation / behavior / omission / emotional mismatch / tiny anomalies.
- Tone: diary / confession / documentary — NEVER serialized fiction.
- No drama escalation, no fake suspense, no plot-twist energy.

OUTPUT: valid JSON only — no markdown fences, no prose outside JSON.`
