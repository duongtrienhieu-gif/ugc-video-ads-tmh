// ─────────────────────────────────────────────────────────────────────
// Pack Brainstorm — synthesizePackBrainstorm (REBUILD Sprint 1, 2026-05-28)
//
// ONE Gemini call. Reads:
//   - product reality from synthesizeProductBrief
//   - commercial psychology from synthesizeCommercialPsychology
//   - raw input fields (pain points, benefits, USP, pricing) verbatim
//
// Produces:
//   - painLadder: 3-5 pains ordered by intensity
//   - chosenAngle: ONE of 5 hook archetypes
//   - hookDraft: a 2-4 sentence opening the storytelling generator must
//                anchor Block 1 to
//   - agitateBeats: 3-5 beats the agitation phase must hit
//   - socialProofPersonas: 3 persona seeds matched to product paradigm
//
// Without this stage, storytelling Gemini defaulted to the "soft diary
// nostalgia recall" pattern for every niche regardless of input. With
// this stage, the angle is decided UP-FRONT and the storytelling
// generator must honor it.
// ─────────────────────────────────────────────────────────────────────

import { textGenWithFallback } from '../services/textGenWithFallback'
import type {
  PackBrainstorm,
  HookAngle,
  HookCandidate,
  PainLadderEntry,
  SocialProofPersonaSeed,
  SynthesizePackBrainstormInput,
  SynthesizePackBrainstormKeys,
} from './types'
import { listSubVariants } from './hookSubVariants'
import { pickHookCandidate } from './pickHookCandidate'

const BRAINSTORM_SYSTEM = `You are a pre-write reasoning assistant for a Vietnamese / Malay / English marketing copy pipeline.

You DO NOT write the marketing copy yourself. Your only job is to:
1. Read the product reality + buyer psychology THOROUGHLY.
2. Decide WHICH pain hits hardest for THIS specific product.
3. Pick the strongest hook angle from a fixed taxonomy.
4. Draft ONE opening paragraph (2-4 sentences) that the downstream writer must anchor to.
5. List the agitation beats the writer must hit.
6. Seed 3 social-proof personas matched to the product paradigm.

Output STRICT JSON. No prose outside JSON.`

interface BrainstormJSON {
  painLadder: Array<{
    rank: number
    pain: string
    lossType: string
  }>
  chosenAngle: string
  chosenAngleCandidates: string[]
  /** Sprint 4 — array of N hook candidates, each with its own sub-variant. */
  hookCandidates: Array<{
    subVariant: string
    hookDraft: string
    flavor?: string
  }>
  agitateBeats: string[]
  socialProofPersonas: Array<{ label: string; angle: string }>
  rationale: string
}

const VALID_ANGLES: HookAngle[] = [
  'pain-immediate-scene',
  'social-shame',
  'future-fear',
  'wasted-effort',
  'soft-recognition',
]

const VALID_LOSS_TYPES: PainLadderEntry['lossType'][] = [
  'sleep', 'health', 'time', 'money', 'pride', 'social', 'future',
]

/** Sprint 4 — list ALL sub-variants Gemini can pick from across the 5 angles.
 *  Compact list so the prompt doesn't blow up. */
function buildSubVariantMenu(): string {
  const lines: string[] = []
  const ANGLES: HookAngle[] = ['pain-immediate-scene', 'social-shame', 'future-fear', 'wasted-effort', 'soft-recognition']
  for (const angle of ANGLES) {
    const variants = listSubVariants(angle)
    if (variants.length === 0) continue
    const items = variants.map((v) => `${v.id} (${v.label})`).join(' | ')
    lines.push(`  ${angle}: ${items}`)
  }
  return lines.join('\n')
}

function buildBrainstormPrompt(input: SynthesizePackBrainstormInput): string {
  const lang =
    input.targetLanguage === 'ms' ? 'Bahasa Melayu' :
    input.targetLanguage === 'en' ? 'English' :
    'Tiếng Việt'

  const objectionsLine = input.topObjections && input.topObjections.length > 0
    ? input.topObjections.slice(0, 3).map((o) => `- ${o.objection}`).join('\n')
    : '(commercial-psychology synthesis unavailable)'

  const avoidBlock = (input.avoidedHookFingerprints && input.avoidedHookFingerprints.length > 0)
    ? `\n═══ ANTI-REPEAT MEMORY (DO NOT MATCH) ═══
Recent packs of THIS product already used these hook patterns (fingerprint format = subVariant-hash):
${input.avoidedHookFingerprints.slice(0, 5).map((f) => `  - ${f}`).join('\n')}
AVOID producing hookCandidates that would match these. Vary BOTH the sub-variant AND the wording.
`
    : ''

  return `Read the product reality below and brainstorm the pre-write plan for ONE landing page pack.
${avoidBlock}

═══ PRODUCT REALITY ═══
Name: ${input.productName}
Niche: ${input.niche}

Product essence: ${input.productEssence}
Reader symptoms: ${input.readerSpecificSymptoms.slice(0, 6).join(' / ')}
Usage scene: ${input.usageScene}
Failed attempts buyer already tried: ${input.realisticFailedAttempts.slice(0, 5).join(' / ')}

═══ BUYER PSYCHOLOGY ═══
Primary desire: ${input.primaryDesire || '(not synthesized)'}
Desire tensions: ${(input.desireTensions ?? []).slice(0, 5).join(' / ') || '(none)'}
Likely objections:
${objectionsLine}

═══ RAW MARKETER INPUT (preserve numbers + specifics) ═══
Pain points: ${input.rawPainPoints.slice(0, 600)}
Benefits: ${input.rawBenefits.slice(0, 500)}
USP: ${input.rawUsp.slice(0, 400)}
Pricing offer: ${input.rawPricing.slice(0, 300)}

═══ YOUR JOB — Output strict JSON in ${lang} (JSON keys stay English) ═══

{
  "painLadder": [
    { "rank": 1, "pain": "...", "lossType": "sleep|health|time|money|pride|social|future" }
    // 3-5 entries, rank 1 = SHARPEST pain THIS buyer feels. Concrete + specific. NOT category labels.
    // Each "pain" line must reference a moment / symptom / number a real buyer would recognize.
  ],

  "chosenAngle": "pain-immediate-scene|social-shame|future-fear|wasted-effort|soft-recognition",
  // PICK ONE based on rank-1 pain + lossType:
  //   pain-immediate-scene → acute moment-bound pain (cough at 3am, joint flare after walking)
  //   social-shame        → "I don't want others to see/notice" layer dominant
  //   future-fear         → compounding condition + reader young/middle-age + treatable now
  //   wasted-effort       → failed attempts list LONG + clear money already burned
  //   soft-recognition    → ONLY for soft-vanity niches (beauty/lifestyle/premium); avoid otherwise

  "chosenAngleCandidates": ["...", "..."],
  // 2-3 angles you considered. Always include the chosen one first.

  "hookCandidates": [
    { "subVariant": "...", "hookDraft": "...", "flavor": "..." }
    // EXACTLY 3 candidates. ALL three MUST use the SAME chosenAngle but DIFFERENT sub-variants from this menu:
    //
    // ─── SUB-VARIANT MENU per angle (PICK 3 DIFFERENT ones from the chosenAngle's list) ───
${buildSubVariantMenu()}
    //
    // RULES for each candidate's hookDraft:
    //  - 2-4 sentence opening paragraph in ${lang}. Block 1 of the pack will be anchored to the PICKED candidate (selected by seed downstream).
    //  - The downstream writer MUST start the pack from the picked candidate's seed.
    //  - Use the candidate's sub-variant pattern (see SUB-VARIANT MENU hint above).
    //  - Reference at least ONE concrete specific from the rank-1 pain (a time, a symptom name, a number).
    //  - DO NOT open with nostalgia recall ("bạn còn nhớ cảm giác...") UNLESS chosenAngle = soft-recognition.
    //  - DO NOT use generic openers ("có những điều rất nhỏ", "bạn có phải là người này").
    //  - 1st-person ("tôi") narrator may appear but reader (YOU) must be the emotional center.
    //  - Each of the 3 candidates MUST FEEL meaningfully different — different opening word, different sensory channel, different micro-moment.
    //  - "flavor" = 1 short phrase ("3am scene", "money inventory", "kids witness") so telemetry can tell them apart.
  ],

  "agitateBeats": [
    "...", "...", "..."
    // 3-5 short beats (each ≤ 12 words in ${lang}) the agitation phase (Phase 1-2 of pack) MUST hit.
    // Examples: "stack 5 symptoms reader counts", "negative future 5 years if untreated",
    // "money already spent on failed solutions", "social moment of shame".
    // These become the SCAFFOLD for blocks daily-micro-friction + hidden-emotional-truth.
  ],

  "socialProofPersonas": [
    { "label": "...", "angle": "..." }
    // EXACTLY 3 personas. label = "Name, age, 1-word condition" matched to the niche cultural context.
    // angle = ONE-sentence story angle in ${lang}.
    // For Malay packs: use Malay/Tamil/Chinese-Malaysian names mixed (Kiah, Muthu, Sarah, Wei, Aisha...).
    // For Vietnamese packs: Việt names. For English packs: generic SEA-English mix.
  ],

  "rationale": "..."
  // 1-2 short sentences in ${lang} explaining why this angle won. Debug-only.
}

CRITICAL:
- chosenAngle MUST be one of the 5 enums exactly.
- lossType MUST be one of: sleep|health|time|money|pride|social|future
- hookDraft is the SEED, not the final block — keep it punchy (2-4 sentences max).
- All output text in ${lang}. JSON only. No markdown fences.`
}

function asValidAngle(raw: string, fallback: HookAngle): HookAngle {
  const normalized = raw.trim().toLowerCase() as HookAngle
  return VALID_ANGLES.includes(normalized) ? normalized : fallback
}

function asValidLossType(
  raw: string,
  fallback: PainLadderEntry['lossType'],
): PainLadderEntry['lossType'] {
  const normalized = raw.trim().toLowerCase() as PainLadderEntry['lossType']
  return VALID_LOSS_TYPES.includes(normalized) ? normalized : fallback
}

/** Build a deterministic fallback when Gemini is unavailable or returns garbage.
 *  Uses the upstream synthesis data verbatim — no static templates.
 *  Sprint 4: returns 3 candidates so the picker still has a pool. */
function buildFallbackBrainstorm(input: SynthesizePackBrainstormInput): PackBrainstorm {
  const symptoms = input.readerSpecificSymptoms.slice(0, 5)
  const failedAttempts = input.realisticFailedAttempts.slice(0, 3)

  // Pick angle from the input shape (no Gemini judgement available).
  let angle: HookAngle = 'pain-immediate-scene'
  if (failedAttempts.length >= 3) angle = 'wasted-effort'
  else if (input.desireTensions && input.desireTensions.some((t) => /(ngại|xấu hổ|che|giấu|sợ người)/i.test(t))) {
    angle = 'social-shame'
  }

  const painLadder: PainLadderEntry[] = symptoms.slice(0, 5).map((s, idx) => ({
    rank: (idx + 1) as PainLadderEntry['rank'],
    pain: s,
    lossType: 'health',
  }))

  // Compose 3 basic candidates using the first 3 sub-variants of the
  // chosen angle so the picker still has a pool. Deliberately terse —
  // the storytelling generator expands later.
  const variants = listSubVariants(angle).slice(0, 3)
  const topSymptom = symptoms[0] ?? input.productEssence.slice(0, 80)
  const hookCandidates: HookCandidate[] = variants.map((v, i) => {
    const draftSeed = input.targetLanguage === 'ms'
      ? [
          `Awak masih ingat tak — bila kali terakhir awak tidur lena tanpa ${topSymptom}?`,
          `Pernah tak terasa ${topSymptom}, lepas tu tak boleh tidur balik?`,
          `Setiap kali ${input.usageScene || 'pagi'}, awak terasa ${topSymptom} lagi sekali.`,
        ][i]
      : input.targetLanguage === 'en'
      ? [
          `When was the last time a full day went by without ${topSymptom}?`,
          `Three nights a week now you wake up at 3am because of ${topSymptom}.`,
          `Every ${input.usageScene || 'morning'}, you check whether ${topSymptom} is back. It always is.`,
        ][i]
      : [
          `Bạn còn nhớ lần cuối cùng một ngày trôi qua mà không có ${topSymptom} không?`,
          `Ba đêm trong tuần bạn lại thức dậy vì ${topSymptom}. Bạn đã đếm.`,
          `Sáng nay, lại là ${topSymptom}. Như mọi sáng tuần này. Như mọi sáng tháng trước.`,
        ][i]
    return {
      subVariant: v.id,
      hookDraft: draftSeed,
      flavor: v.label,
    }
  })
  if (hookCandidates.length === 0) {
    // Angle has no sub-variants — emit one inline.
    hookCandidates.push({
      subVariant: 'fallback',
      hookDraft: `Tôi đã sống với ${topSymptom} đủ lâu để biết nó không tự khỏi.`,
      flavor: 'fallback',
    })
  }

  // Pick first candidate by default for fallback
  const picked = pickHookCandidate({
    candidates: hookCandidates,
    seed: input.seed ?? 0,
    avoidedFingerprints: input.avoidedHookFingerprints,
  })

  const agitateBeats: string[] = []
  if (symptoms.length >= 3) agitateBeats.push('stack symptoms 3-5 thật cụ thể')
  if (failedAttempts.length >= 2) agitateBeats.push('thừa nhận đã thử nhưng không thành')
  agitateBeats.push('vẽ tương lai nếu không xử lý sớm')

  const socialProofPersonas: SocialProofPersonaSeed[] = [
    { label: 'Persona 1', angle: 'người mới dùng — kể trải nghiệm 2-3 tuần' },
    { label: 'Persona 2', angle: 'người dùng lâu năm — kể độ ổn định' },
    { label: 'Persona 3', angle: 'người nghi ngờ ban đầu — kể lúc đổi ý' },
  ]

  return {
    painLadder,
    chosenAngle: angle,
    chosenAngleCandidates: [angle],
    hookCandidates,
    chosenSubVariant: picked.picked.subVariant,
    hookDraft: picked.picked.hookDraft,
    agitateBeats,
    socialProofPersonas,
    rationale: 'Fallback brainstorm — Gemini call failed or skipped. Used synthesis-derived symptoms + simple angle heuristic.',
    source: 'fallback',
    hookFingerprint: picked.fingerprint,
  }
}

export async function synthesizePackBrainstorm(
  input: SynthesizePackBrainstormInput,
  keys: SynthesizePackBrainstormKeys,
): Promise<PackBrainstorm> {
  if (!keys.geminiApiKey && !keys.kieApiKey) {
    console.warn('[brainstorm] No API key — using fallback brainstorm')
    return buildFallbackBrainstorm(input)
  }

  const fallback = buildFallbackBrainstorm(input)

  try {
    const raw = await textGenWithFallback({
      geminiApiKey: keys.geminiApiKey,
      kieApiKey: keys.kieApiKey,
      prompt: buildBrainstormPrompt(input),
      systemInstruction: BRAINSTORM_SYSTEM,
      jsonMode: true,
      // Sprint 4: bumped from 1800 → 2800 to accommodate 3 hook candidates
      // (each 2-4 sentences + flavor + subVariant) without truncation.
      maxOutputTokens: 2800,
      timeoutMs: 45_000,
      label: 'pack-brainstorm',
    })

    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }

    const parsed = JSON.parse(cleaned) as BrainstormJSON

    // ── Normalize + validate ──
    const painLadder: PainLadderEntry[] = []
    if (Array.isArray(parsed.painLadder)) {
      for (const entry of parsed.painLadder.slice(0, 5)) {
        if (typeof entry?.pain !== 'string' || entry.pain.trim().length < 5) continue
        painLadder.push({
          rank: Math.min(5, Math.max(1, Number(entry.rank) || painLadder.length + 1)) as PainLadderEntry['rank'],
          pain: entry.pain.trim().slice(0, 240),
          lossType: asValidLossType(String(entry.lossType ?? 'health'), 'health'),
        })
      }
    }
    if (painLadder.length === 0) return fallback

    const chosenAngle = asValidAngle(String(parsed.chosenAngle ?? ''), 'pain-immediate-scene')

    const chosenAngleCandidates: HookAngle[] = Array.isArray(parsed.chosenAngleCandidates)
      ? parsed.chosenAngleCandidates
          .map((a) => asValidAngle(String(a), chosenAngle))
          .filter((a, i, arr) => arr.indexOf(a) === i)
          .slice(0, 3)
      : [chosenAngle]

    // Sprint 4 — normalize hookCandidates[] (Gemini returns 3, we validate
    // and pick 1 via seed + avoid list).
    const validVariantIds = new Set(listSubVariants(chosenAngle).map((v) => v.id))
    const hookCandidates: HookCandidate[] = Array.isArray(parsed.hookCandidates)
      ? parsed.hookCandidates
          .filter((c) => c && typeof c.hookDraft === 'string' && c.hookDraft.trim().length >= 20)
          .map((c) => ({
            subVariant: validVariantIds.has(String(c.subVariant)) ? String(c.subVariant) : (listSubVariants(chosenAngle)[0]?.id ?? 'unknown'),
            hookDraft: c.hookDraft.trim().slice(0, 800),
            flavor: typeof c.flavor === 'string' ? c.flavor.trim().slice(0, 80) : undefined,
          }))
          .slice(0, 5)
      : []

    // De-duplicate by subVariant — if Gemini reused a variant, keep first.
    const seenVariants = new Set<string>()
    const uniqueCandidates: HookCandidate[] = []
    for (const c of hookCandidates) {
      if (seenVariants.has(c.subVariant)) continue
      seenVariants.add(c.subVariant)
      uniqueCandidates.push(c)
    }

    // If we ended up with < 1 candidate from Gemini, fall back entirely.
    if (uniqueCandidates.length === 0) return fallback

    // Pick 1 via seed-based picker (Sprint 4 Layer A+E).
    const pickResult = pickHookCandidate({
      candidates: uniqueCandidates,
      seed: input.seed ?? 0,
      avoidedFingerprints: input.avoidedHookFingerprints,
    })
    if (pickResult.bypassed) {
      console.info(
        `[brainstorm/pick] All ${uniqueCandidates.length} candidates matched the avoid list — picker bypassed memory. Consider widening the sub-variant pool for this angle.`,
      )
    }

    const agitateBeats: string[] = Array.isArray(parsed.agitateBeats)
      ? parsed.agitateBeats
          .filter((b) => typeof b === 'string' && b.trim().length > 3)
          .map((b) => String(b).trim().slice(0, 160))
          .slice(0, 5)
      : fallback.agitateBeats

    const socialProofPersonas: SocialProofPersonaSeed[] = Array.isArray(parsed.socialProofPersonas)
      ? parsed.socialProofPersonas
          .filter((p) => p && typeof p.label === 'string' && typeof p.angle === 'string')
          .map((p) => ({
            label: p.label.trim().slice(0, 80),
            angle: p.angle.trim().slice(0, 240),
          }))
          .slice(0, 3)
      : fallback.socialProofPersonas

    return {
      painLadder,
      chosenAngle,
      chosenAngleCandidates,
      hookCandidates: uniqueCandidates,
      chosenSubVariant: pickResult.picked.subVariant,
      hookDraft: pickResult.picked.hookDraft,
      agitateBeats: agitateBeats.length > 0 ? agitateBeats : fallback.agitateBeats,
      socialProofPersonas: socialProofPersonas.length > 0 ? socialProofPersonas : fallback.socialProofPersonas,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 280) : '',
      source: 'gemini',
      hookFingerprint: pickResult.fingerprint,
    }
  } catch (err) {
    console.warn('[brainstorm] Gemini brainstorm failed — using fallback:', err)
    return fallback
  }
}

// Re-export the hash helper so callers (e.g. generateStorytellingPack)
// can verify or build fingerprints without depending on the picker file.
export { hookFingerprint } from './pickHookCandidate'
