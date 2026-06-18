// ── Voice Timing Estimator ───────────────────────────────────────────────────
// Z31 §6 — VOICE is the MASTER TIMELINE. Everything renders to sync with
// the voice duration. This module estimates per-block voice duration
// BEFORE the TTS call so the UI can show "your 30s script lands at 28.4s"
// and the user can tweak before paying for TTS.
//
// Baseline: 215 wpm — Z65 raised the TTS to speed 1.2 + lower style (fewer
// pauses) for a snappier pace, so the effective read rate rose (~200→~215 wpm).
// The estimate is still approximate (it varies by voice/run) — the auto-edit
// planner (Z57) re-scales insert timestamps to the ACTUAL measured voice
// duration, and the UI shows the REAL measured duration after "Nghe thử giọng"
// (Z64), so final timing + the displayed number are correct regardless.
//
// The estimator is purely arithmetic — no network, no Gemini, runs on
// every script edit.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GeneratedScript, ScriptBlock, ScriptBlockId, ScriptTargetDurationSec,
  AdStructure, VoiceAlignment, ScriptLang,
} from '../types'
import { DEFAULT_SCRIPT_LANG } from '../types'
import { AD_STRUCTURES } from './adStructures'

// ── Read-duration model — SYLLABLE-based, language-universal ────────────────
// A single WPM can't fit VN + EN + MS: a Vietnamese space-token is ONE syllable
// ("tiêu hóa" = 2 tokens), but an English/Malay word is 1.5-3.5 syllables — so the
// same speech speed gives wildly different words/min. Speech rate is far more
// constant in SYLLABLES/sec (~human articulation rate). So we count SYLLABLES and
// divide by one rate, calibrated from a real run (170 VN syllables / 41.9s at the
// engine's 1.2× pace = 4.05 syll/s). Each language self-calibrates from its real
// measured voice (EMA in localStorage), so it converges without a guessed table.
// P5i — PER-LANGUAGE rate. The old single 4.05 syll/s + clamp [3.5, 4.3] was measured
// from VIETNAMESE only. MS + EN are spoken MUCH faster at the engine's 1.2× pace (~5.8
// syll/s for MS), so a VN-tuned rate made MS scripts estimate ~30% LONGER than the real
// voice (est 62.9s → real 43.7s). Worse: the 4.3 ceiling REJECTED every real MS
// observation (~5.8 > 4.3) in calibrateSyllableRate, so MS could NEVER converge — the
// estimate stayed permanently long, which STARVED the refit (it thought a 43s script was
// already 60s and never expanded it → short, content-poor scripts). Each language now
// has its own base rate + accept/clamp band so it converges to its real pace.
// P6e — MY TTS pace dropped 1.2× → 1.15× (lipsync drift + "như gió"), so Malay is read
// ~4% SLOWER → fewer syllables/sec → the Bước-1 "~Xs" gợi ý must grow. Rate ∝ pace:
// 5.7 × 1.15/1.2 ≈ 5.46. VN/EN unchanged (still 1.2×).
const BASE_RATE: Record<ScriptLang, number> = { vi: 4.05, ms: 5.46, en: 5.3 }
const RATE_BAND: Record<ScriptLang, [number, number]> = {
  vi: [3.6, 4.6],
  ms: [4.6, 7.2],
  en: [4.4, 7.2],
}
const baseRate = (lang: ScriptLang): number => BASE_RATE[lang] ?? 4.05
const rateBand = (lang: ScriptLang): [number, number] => RATE_BAND[lang] ?? [3.5, 7.2]

// Vowel groups INCLUDING Vietnamese accented vowels — one group ≈ one syllable. This
// makes the counter work for VN too (every VN syllable carries exactly one vowel
// nucleus), so even a wrong `lang` degrades gracefully.
const VOWEL_GROUP = /[aeiouyàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+/gi

/** Count words (space tokens). Kept for callers that need a raw token count. */
export function countWords(text: string): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Count syllables for a language. VN: 1 space-token = 1 syllable (exact). EN/MS:
 *  sum vowel-groups per word (Malay is highly phonetic → accurate; English ~85-90%,
 *  with a trailing silent-'e' trim). */
export function countSyllables(text: string, lang: ScriptLang = DEFAULT_SCRIPT_LANG): number {
  if (!text) return 0
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (lang === 'vi') return tokens.length
  let syl = 0
  for (const raw of tokens) {
    const w = raw.toLowerCase()
    const groups = w.match(VOWEL_GROUP)
    let n = groups ? groups.length : 1
    if (lang === 'en' && n > 1 && /[^aeiouy]e$/.test(w)) n -= 1   // English silent final e
    syl += Math.max(1, n)
  }
  return syl
}

// P6e — bump ONLY the MS key so any value self-calibrated at the OLD 1.2× pace (~5.7) is
// discarded → the new 1.15× base (5.46) takes effect immediately for the Bước-1 estimate;
// it re-converges from real 1.15× runs. VN/EN keep their existing calibration untouched.
const rateKey = (lang: ScriptLang) => `ugc-lab-syll-rate-${lang}${lang === 'ms' ? '-v2' : ''}`

/** The (possibly self-calibrated) syllables/sec for a language. A stored value
 *  outside the language's band (e.g. an old MS rate clamped at 4.3) is ignored so we
 *  fall back to the corrected base. */
function syllableRate(lang: ScriptLang): number {
  const [lo, hi] = rateBand(lang)
  try {
    const v = Number(localStorage.getItem(rateKey(lang)))
    if (Number.isFinite(v) && v >= lo && v <= hi) return v
  } catch { /* no storage */ }
  return baseRate(lang)
}

/** Estimate read duration (seconds) for a piece of text in a language. */
export function estimateReadDurationSec(text: string, lang: ScriptLang = DEFAULT_SCRIPT_LANG): number {
  const syl = countSyllables(text, lang)
  if (syl === 0) return 0
  return Number((syl / syllableRate(lang)).toFixed(2))
}

/** Estimate duration at the engine pace (alias). */
export function estimateReadDurationForVoice(text: string, lang: ScriptLang = DEFAULT_SCRIPT_LANG): number {
  return estimateReadDurationSec(text, lang)
}

/** Self-calibrate: once a REAL voice is measured for a known script, refine that
 *  language's syllables/sec (EMA) so future estimates converge to reality. */
export function calibrateSyllableRate(text: string, lang: ScriptLang, realDurationSec: number): void {
  if (realDurationSec <= 0) return
  const syl = countSyllables(text, lang)
  if (syl < 20) return                       // too short to be reliable
  const observed = syl / realDurationSec
  const [lo, hi] = rateBand(lang)
  if (!Number.isFinite(observed) || observed < lo || observed > hi) return
  const next = syllableRate(lang) * 0.7 + observed * 0.3   // EMA, weight history
  try {
    localStorage.setItem(rateKey(lang), String(Number(next.toFixed(3))))
    // eslint-disable-next-line no-console
    console.log(`[VOICE_EST] calibrate ${lang}: ${syl} syll / ${realDurationSec.toFixed(1)}s = ${observed.toFixed(2)} → rate ${next.toFixed(2)} syll/s`)
  } catch { /* ignore */ }
}

/**
 * Compute the per-block target duration allocation given a structure
 * and total target duration. The structure's blockWeights drive the
 * split (e.g. SOCIAL_PROOF puts 40% on BENEFIT block).
 *
 * Returns a Record<ScriptBlockId, number> of target SECONDS per block.
 * These are the budgets the script generator is asked to hit.
 */
export function allocateBlockBudgets(
  structure: AdStructure,
  targetDurationSec: ScriptTargetDurationSec,
): Record<ScriptBlockId, number> {
  const weights = AD_STRUCTURES[structure].blockWeights
  return {
    hook:      Number((targetDurationSec * weights.hook).toFixed(1)),
    pain:      Number((targetDurationSec * weights.pain).toFixed(1)),
    discovery: Number((targetDurationSec * weights.discovery).toFixed(1)),
    benefit:   Number((targetDurationSec * weights.benefit).toFixed(1)),
    cta:       Number((targetDurationSec * weights.cta).toFixed(1)),
  }
}

/**
 * Recompute every block's estimated duration in a script (called after
 * the user edits text or swaps voice category).
 *
 * Mutates the input blocks (in-place) and returns a fresh GeneratedScript
 * with the updated totalDurationSec.
 */
export function recomputeBlockDurations(script: GeneratedScript, lang: ScriptLang = DEFAULT_SCRIPT_LANG): GeneratedScript {
  const updatedBlocks: ScriptBlock[] = script.blocks.map((b) => ({
    ...b,
    estDurationSec: estimateReadDurationSec(b.text, lang),
  }))
  const total = updatedBlocks.reduce((sum, b) => sum + b.estDurationSec, 0)
  return {
    ...script,
    blocks: updatedBlocks,
    totalDurationSec: Number(total.toFixed(2)),
  }
}

/**
 * Compute the variance between estimated total and target — used by the
 * UI to flash a warning when the script is way over/under target.
 *
 * Returns a positive percentage where 0 = perfect match, positive = over,
 * negative = under.
 */
export function computeDurationVariance(
  script: GeneratedScript,
): { deltaSec: number; deltaPct: number; status: 'on-target' | 'over' | 'under' } {
  const target = script.targetDurationSec
  const actual = script.totalDurationSec
  const deltaSec = Number((actual - target).toFixed(2))
  const deltaPct = Number(((deltaSec / target) * 100).toFixed(1))
  let status: 'on-target' | 'over' | 'under' = 'on-target'
  if (Math.abs(deltaPct) <= 10) status = 'on-target'
  else if (deltaPct > 10) status = 'over'
  else status = 'under'
  return { deltaSec, deltaPct, status }
}

/**
 * Per-block target — used by the UI to render "HOOK · target 3s · est 3.2s"
 * tooltips.
 */
export function blockTargetDuration(
  blockId: ScriptBlockId,
  structure: AdStructure,
  targetDurationSec: ScriptTargetDurationSec,
): number {
  const budgets = allocateBlockBudgets(structure, targetDurationSec)
  return budgets[blockId]
}

/**
 * Z98 B2 — cheap deterministic hash of (full script text + voiceId). Shared by the
 * Step-2 trigger (which stamps a generated voice) and the Step-3 render (which only
 * reuses that voice when the sig still matches — i.e. the script/voice are unchanged).
 */
export function scriptVoiceSig(scriptText: string, voiceId: string | null | undefined): string {
  const s = `${scriptText}|${voiceId ?? ''}`
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${h}:${s.length}`
}

/**
 * Z98 B2 — VOICE-FIRST recalibration. Once the REAL voice is synthesized, replace
 * the 215-wpm estimate with the measured truth so the director splits B-roll over
 * the actual length (the estimate could be ~40% off, which squeezed all the
 * B-roll into the front of a longer real video).
 *
 * With a per-character alignment (#6) we set each block's estDurationSec to the
 * REAL spoken span of its text. Without one we scale every block proportionally
 * so at least the TOTAL matches the measured audio. Either way
 * script.totalDurationSec becomes the real number the director reads.
 */
export function recalibrateScriptToRealVoice(
  script: GeneratedScript,
  measuredDurationSec: number,
  voiceAlignment?: VoiceAlignment,
  lang: ScriptLang = DEFAULT_SCRIPT_LANG,
): GeneratedScript {
  const measured = measuredDurationSec > 0 ? measuredDurationSec : script.totalDurationSec

  // Self-calibrate this language's syllables/sec from the REAL measured voice so the
  // next script's estimate (and the displayed "~Xs") converges to reality.
  calibrateSyllableRate(script.blocks.map((b) => b.text).join(' '), lang, measured)

  // No alignment → proportional scale (real total, blocks keep their ratio).
  if (!voiceAlignment || !voiceAlignment.text || voiceAlignment.charStartSecs.length === 0) {
    const estTotal = script.blocks.reduce((sum, b) => sum + b.estDurationSec, 0)
    const factor = estTotal > 0 ? measured / estTotal : 1
    const blocks = script.blocks.map((b) => ({
      ...b,
      estDurationSec: Number((b.estDurationSec * factor).toFixed(2)),
    }))
    return { ...script, blocks, totalDurationSec: Number(measured.toFixed(2)) }
  }

  // Alignment present → real per-block durations. Each block's text appears in the
  // transcript (alignment.text === blocks joined by ' '); locate it sequentially
  // and read the spoken second of its first character.
  const { text, charStartSecs } = voiceAlignment
  const realStartAt = (charIdx: number): number | null => {
    if (charIdx < 0) return null
    const s = charStartSecs[Math.min(charIdx, charStartSecs.length - 1)]
    return Number.isFinite(s) ? s : null
  }
  const startIdx: number[] = []
  let cursor = 0
  for (const b of script.blocks) {
    const at = text.indexOf(b.text, cursor)
    if (at >= 0) { startIdx.push(at); cursor = at + b.text.length }
    else startIdx.push(-1)
  }
  const blocks = script.blocks.map((b, i) => {
    const start = realStartAt(startIdx[i])
    if (start == null) return { ...b }  // couldn't locate → keep its estimate
    const nextStart = i + 1 < script.blocks.length ? realStartAt(startIdx[i + 1]) : measured
    const end = nextStart ?? measured
    const dur = Math.max(0.1, Number((end - start).toFixed(2)))
    return { ...b, estDurationSec: dur }
  })
  return { ...script, blocks, totalDurationSec: Number(measured.toFixed(2)) }
}
