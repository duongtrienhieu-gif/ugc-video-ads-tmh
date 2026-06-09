// ── Auto Edit Planner ────────────────────────────────────────────────────────
// Z34 — The "conversion layer" planner. Deterministic, no AI calls.
// Takes:
//   • Phase 3 creator video (lipsync talking head, full duration)
//   • Phase 4 approved/locked action inserts
//   • Phase 2 script (master voice timeline)
//   • Editing style + subtitle style + BGM style
// Returns:
//   • AutoEditPlan — segments + captions + zooms + SFX + BGM + CTA
//
// CORE PHILOSOPHY (Z34 §1):
//   Editing's job is to CHEAT perception, not to create cinema. Fast
//   cuts + captions + zooms hide AI imperfections. This planner is
//   FAST + DETERMINISTIC so the user can re-roll instantly.
//
// HOOK / CTA emphasis (Z34 §8 + §9):
//   First 1.5s gets a punch zoom + larger captions + stronger SFX.
//   Last ~2s gets a CTA overlay sticker. Style-driven.
//
// REALISM FILTER (Z34 §12):
//   Insert overlays are SHORT (1.5-3s based on style) — they DON'T
//   replace the creator video, they layer over it briefly. The viewer
//   still mostly sees the talking head. AI imperfections of the inserts
//   are hidden by their short visible window.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AutoEditPlan, EditSegment, SegmentOverlay, SfxCue, CtaOverlay,
  EditingStyleId, SubtitleStyleId, BgmStyleId,
  CreatorVideoClip, ActionInsertClip, GeneratedScript,
} from '../types'
import { EDITING_STYLES } from './editingStyles'
import { BGM_CATALOG } from './bgmCatalog'
import { pickSfxFor } from './sfxCatalog'
import { buildCaptionSegments } from './subtitleEngine'
import { buildPunchZoomCues } from './punchZoomPlanner'

// ── Public entry ───────────────────────────────────────────────────────────

export interface BuildPlanParams {
  creatorVideo: CreatorVideoClip
  /** ALL inserts — planner filters to only approved + locked + completed.
   *  Rejected / failed / skipped / idle are excluded. */
  inserts: ActionInsertClip[]
  /** Phase 2 script — drives captions + timing */
  script: GeneratedScript
  /** Phase 5 style picks */
  styleId: EditingStyleId
  subtitleStyleId: SubtitleStyleId
  /** Optional BGM override (null = use style's default) */
  bgmStyleId: BgmStyleId | null
  /** CTA text — defaults to script's CTA block */
  ctaTextOverride?: string
}

export function buildAutoEditPlan(params: BuildPlanParams): AutoEditPlan {
  const style = EDITING_STYLES[params.styleId]
  const bgmStyleId = params.bgmStyleId ?? style.defaultBgmStyle
  const subtitleStyleId = params.subtitleStyleId

  // Filter inserts to only those eligible (approved / locked / completed)
  const eligibleInserts = params.inserts.filter((it) =>
    (it.status === 'approved' || it.status === 'locked' || it.status === 'completed') &&
    !!it.videoRef
  ).sort((a, b) => a.order - b.order)

  console.log(
    `[AUTO_EDIT] style=${params.styleId} bgm=${bgmStyleId} ` +
    `eligible-inserts=${eligibleInserts.length}/${params.inserts.length} ` +
    `voice-duration=${params.creatorVideo.voiceDurationSec?.toFixed(1) ?? '?'}s`
  )

  // The total duration is anchored to the creator video duration (which
  // matches the voice timeline). Inserts overlay ON TOP of the creator video.
  const totalDurationSec = params.creatorVideo.voiceDurationSec ??
    params.script.totalDurationSec ??
    params.creatorVideo.durationSec

  // Z57 — re-scale insert timestamps from the ESTIMATE basis to the ACTUAL
  // voice. insert.voiceTimestampSec was computed against script.totalDurationSec
  // (a word-count/WPM estimate, e.g. 66s), but the real TTS often lands shorter
  // (e.g. 56s with eleven_v3 + 1.15× speed). Without scaling, an insert anchored
  // at 40s of a 66s estimate plays at 40s of a 56s clip = 14s too late, over the
  // wrong spoken line. Scale = actualVoiceDur / estimatedScriptDur makes every
  // insert land on the line it was anchored to, regardless of which TTS model
  // (v2/v3) or voice rendered. Falls back to 1 (no change) when the actual voice
  // duration isn't known yet.
  const estimatedScriptDur = params.script.totalDurationSec ?? 0
  const actualVoiceDur = params.creatorVideo.voiceDurationSec ?? 0
  const timelineScale =
    actualVoiceDur > 0 && estimatedScriptDur > 0
      ? actualVoiceDur / estimatedScriptDur
      : 1
  if (Math.abs(timelineScale - 1) > 0.02) {
    console.log(
      `[AUTO_EDIT] timeline rescale ${estimatedScriptDur.toFixed(1)}s (est) → ` +
      `${actualVoiceDur.toFixed(1)}s (real) · scale=${timelineScale.toFixed(3)} ` +
      `— insert timestamps adjusted to match the actual voice`,
    )
  }

  // ── 1. Build segments (creator + inserts) ────────────────────────────
  const segments = buildSegments(
    params.creatorVideo,
    eligibleInserts,
    style.insertOverlayDurationSec,
    totalDurationSec,
    timelineScale,
  )

  // ── 2. Build captions ────────────────────────────────────────────────
  const captions = subtitleStyleId === 'none'
    ? []
    : buildCaptionSegments({
        script: params.script,
        scriptStartSec: 0,
        wordsPerChunk: 3,
        emphasisRate: style.captionEmphasisRate,
      })

  // ── 3. Build punch zoom cues ─────────────────────────────────────────
  const punchZooms = buildPunchZoomCues({
    script: params.script,
    scriptStartSec: 0,
    styleId: params.styleId,
    totalDurationSec,
  })

  // ── 4. Build SFX cues (transitions + zoom accents) ───────────────────
  const sfxCues = buildSfxCues({
    segments,
    punchZooms,
    totalDurationSec,
    sfxDensity: style.sfxDensity,
    styleAppliesCta: style.applyCtaOverlay,
  })

  // ── 5. CTA overlay ───────────────────────────────────────────────────
  const cta: CtaOverlay | null = style.applyCtaOverlay
    ? buildCtaOverlay({
        script: params.script,
        totalDurationSec,
        styleId: params.styleId,
        textOverride: params.ctaTextOverride,
      })
    : null

  // ── 6. BGM spec ──────────────────────────────────────────────────────
  const bgmCfg = BGM_CATALOG[bgmStyleId]
  const bgm = bgmStyleId === 'none' ? null : {
    styleId: bgmStyleId,
    volume: Math.min(0.25, style.bgmVolume),  // voice always priority — hard cap 0.25
    fadeInSec: bgmCfg.fadeInSec,
    fadeOutSec: bgmCfg.fadeOutSec,
  }

  const plan: AutoEditPlan = {
    totalDurationSec: round2(totalDurationSec),
    segments,
    captions,
    punchZooms,
    sfxCues,
    bgm,
    cta,
    styleId: params.styleId,
    subtitleStyleId,
    generatedAt: Date.now(),
  }

  console.log(
    `[AUTO_EDIT] plan built · segments=${plan.segments.length} ` +
    `captions=${plan.captions.length} zooms=${plan.punchZooms.length} ` +
    `sfx=${plan.sfxCues.length} cta=${plan.cta ? 'yes' : 'no'} ` +
    `duration=${plan.totalDurationSec.toFixed(1)}s`
  )

  return plan
}

// ── Segment builder ────────────────────────────────────────────────────

/**
 * Build the segment timeline. Strategy:
 *   • Start with one creator_video segment spanning the full duration
 *   • For each eligible insert, INSERT an action_insert segment at its
 *     voiceTimestampSec (or evenly spaced if no timestamp)
 *   • Inserts replace the creator segment for their overlay duration
 *
 * This produces a sequence like:
 *   creator [0-3.5s] → insert [3.5-5.0s] → creator [5.0-12.4s] → insert [12.4-13.9s] → ...
 */
function buildSegments(
  creatorVideo: CreatorVideoClip,
  inserts: ActionInsertClip[],
  insertOverlayDurationSec: number,
  totalDurationSec: number,
  /** Z57 — multiply estimate-based voiceTimestampSec to map onto the real
   *  voice duration. 1 = no change (actual duration unknown). */
  timelineScale: number,
): EditSegment[] {
  if (!creatorVideo.videoRef) return []

  // Z69 — split inserts by layout. 'overlay_corner' → ride on the creator
  // segment as a PIP (creator stays full-screen + visible). 'cut' (default) →
  // replace the creator for its window. Same scheduling/scaling logic for both,
  // they just attach to different places in the segment tree at the end.
  const cutInserts = inserts.filter((it) => (it.layout ?? 'cut') === 'cut')
  const overlayInserts = inserts.filter((it) => it.layout === 'overlay_corner')
  // Z83 — cuts that get DEMOTED to overlays (because they'd stack too close to
  // another cut and bury the creator) collect here, then ride alongside the
  // real overlays below. Keeps their content while letting the creator surface.
  const demotedCuts: ActionInsertClip[] = []

  // Compute insert timestamps — clamp to [1, totalDuration - 1] window
  // so we don't insert in the first second (hook intact) or last second
  // (CTA intact).
  const usableStart = 1.0
  const usableEnd = Math.max(usableStart + 1, totalDurationSec - 1)
  // Z80 — CREATOR-FIRST hard floor: a CUT replaces the creator, so the first
  // few seconds must NOT be a cut — the viewer has to see the avatar lipsync
  // talking before anything covers it (trust). Cuts start no earlier than 4s;
  // the creator owns 0-4s. (Overlays keep usableStart=1.0 — the creator stays
  // visible behind them, so they don't need the lead-in.)
  const cutLeadInSec = 4.0
  const cutUsableStart = Math.min(cutLeadInSec, usableEnd - 1.5)
  const insertSlots: { insert: ActionInsertClip; tsSec: number; durSec: number }[] = []

  for (const insert of cutInserts) {
    // Z37 — honor the per-scene length the Scene Director (or the preset)
    // decided, so a grouped concept scene can hold the screen for its full
    // 3-5s instead of being capped to one fixed style value. The style's
    // insertOverlayDurationSec is the fallback when an insert has no length.
    // Clamp to a sane overlay window so one insert never swallows the video.
    // Z42 — the footage ceiling depends on render mode: a Kling clip is a fixed
    // 5s of real footage, while a Ken Burns clip is a synthetic local zoom that
    // can run up to 8s. Cap each insert to what its own footage can actually
    // fill so we never hold past the available frames.
    // Z60 — Veo renders a fixed 8s clip (was Kling 5s), so video footage can
    // fill up to ~7s; ken_burns local zoom up to 8s.
    const footageCap = (insert.renderMode ?? 'video') === 'ken_burns' ? 8 : 7
    const overlayCap = Math.min(footageCap, Math.max(1.5, usableEnd - usableStart))
    const durSec = Math.max(
      1.5,
      Math.min(overlayCap, insert.durationSec || insertOverlayDurationSec),
    )
    let ts = insert.voiceTimestampSec ?? null
    if (ts === null || ts === undefined) {
      // Evenly distribute manually-added inserts that lack a timestamp
      const fraction = insertSlots.length / Math.max(1, inserts.length)
      ts = cutUsableStart + fraction * (usableEnd - cutUsableStart)
    } else {
      // Z57 — map the estimate-based timestamp onto the real voice timeline.
      ts = ts * timelineScale
    }
    // Z80 — cuts can't start before the creator lead-in (4s).
    ts = Math.max(cutUsableStart, Math.min(usableEnd - durSec, ts))
    insertSlots.push({
      insert,
      tsSec: round2(ts),
      durSec: round2(durSec),
    })
  }

  // Sort by timestamp + dedupe overlaps (push later inserts forward)
  insertSlots.sort((a, b) => a.tsSec - b.tsSec)
  // Z80 — the OPENING cut stays short so the ad doesn't sit on one B-roll right
  // after the hook (user: "mở đầu 6s quá dài"). Cap the earliest cut to ≤4s.
  if (insertSlots.length > 0) {
    insertSlots[0].durSec = round2(Math.min(insertSlots[0].durSec, 4))
  }
  // Z83 — MIN CREATOR GAP. A CUT hides the creator; two cuts back-to-back bury
  // the talking head for their COMBINED length (the user saw the creator vanish
  // ~7s when two cuts stacked). Enforce ≥3s of creator BETWEEN cuts: a cut that
  // would land within 3s of the previous KEPT cut's end is DEMOTED to an overlay
  // (content preserved, creator stays visible behind it) instead of stacking.
  // Cuts therefore always alternate with a visible creator stretch.
  const MIN_CREATOR_GAP = 3.0
  const keptSlots: typeof insertSlots = []
  let lastCutEnd = -Infinity
  for (const slot of insertSlots) {
    if (slot.tsSec >= lastCutEnd + MIN_CREATOR_GAP) {
      keptSlots.push(slot)
      lastCutEnd = slot.tsSec + slot.durSec
    } else {
      demotedCuts.push(slot.insert)  // too close → render as an overlay instead
    }
  }
  // Trim any that ran past the end
  const validSlots = keptSlots.filter((s) => s.tsSec + s.durSec <= totalDurationSec)

  // Now build the actual segment list
  const segments: EditSegment[] = []
  let segmentId = 0
  let cursor = 0

  for (const slot of validSlots) {
    // Creator segment from cursor → slot start
    if (slot.tsSec > cursor) {
      segments.push({
        segmentId: segmentId++,
        startSec: round2(cursor),
        durationSec: round2(slot.tsSec - cursor),
        source: { kind: 'creator_video', videoRef: creatorVideo.videoRef },
        sourceInSec: round2(cursor),
        reason: 'narration_block',
        transitionIn: segments.length === 0 ? 'cut' : 'cut',
      })
    }
    // Insert segment
    if (slot.insert.videoRef) {
      segments.push({
        segmentId: segmentId++,
        startSec: round2(slot.tsSec),
        durationSec: round2(slot.durSec),
        source: {
          kind: 'action_insert',
          insertId: slot.insert.insertId,
          videoRef: slot.insert.videoRef,
        },
        sourceInSec: 0,
        reason: 'insert_overlay',
        transitionIn: 'whoosh',
      })
    }
    cursor = round2(slot.tsSec + slot.durSec)
  }

  // Final creator segment from cursor → end
  if (cursor < totalDurationSec) {
    segments.push({
      segmentId: segmentId++,
      startSec: round2(cursor),
      durationSec: round2(totalDurationSec - cursor),
      source: { kind: 'creator_video', videoRef: creatorVideo.videoRef },
      sourceInSec: round2(cursor),
      reason: 'narration_block',
      transitionIn: 'cut',
    })
  }

  // Z69 — attach overlay_corner inserts to the creator segments they sit
  // inside. Each overlay rides ON TOP of the creator segment for its window —
  // the creator stays full-screen behind it. If an overlay straddles segment
  // boundaries we clamp it to the segment it MOSTLY overlaps (simpler than
  // splitting). Overlays falling on an action_insert (cut) segment are dropped
  // — can't PIP-over an insert that already replaced the creator.
  // Z83 — real overlays + the cuts we demoted above, processed together.
  for (const ins of [...overlayInserts, ...demotedCuts]) {
    if (!ins.videoRef) continue
    const footageCap = (ins.renderMode ?? 'video') === 'ken_burns' ? 8 : 7
    const durSec = Math.max(1.5, Math.min(footageCap, ins.durationSec || insertOverlayDurationSec))
    let ts = ins.voiceTimestampSec ?? null
    if (ts == null) {
      // Manually-added overlay without timestamp → put at the midpoint
      ts = totalDurationSec / 2
    } else {
      ts = ts * timelineScale
    }
    ts = Math.max(usableStart, Math.min(usableEnd - durSec, ts))

    // Find the creator segment that contains the overlay START.
    let host = segments.find(
      (s) => s.source.kind === 'creator_video'
        && s.startSec <= ts!
        && ts! < s.startSec + s.durationSec,
    )
    if (!host) {
      // Z83 — the ideal time lands ON a CUT (common for a demoted cut, whose
      // anchor sat inside the cut it collided with). Slide the overlay to the
      // START of the next creator segment so the content still renders (slightly
      // off its line, but the creator is visible) instead of being dropped.
      const next = segments.find((s) => s.source.kind === 'creator_video' && s.startSec >= ts!)
      if (!next) continue  // no creator window left → drop
      host = next
      ts = next.startSec
    }

    // Clamp the overlay window to within the host segment.
    const overlayStart = Math.max(0, ts - host.startSec)
    const overlayEnd = Math.min(host.durationSec, overlayStart + durSec)
    const overlayDur = round2(overlayEnd - overlayStart)
    if (overlayDur < 1.0) continue  // too short after clamp

    const overlay: SegmentOverlay = {
      insertId: ins.insertId,
      videoRef: ins.videoRef,
      startSec: round2(overlayStart),
      durationSec: overlayDur,
      // Z77 — bottom-right + bigger. The creator talking-head's face sits
      // upper-centre, so a bottom corner keeps the face clear while filling the
      // dead chest/shirt space. 0.46 (was 0.32) makes infographic text + labels
      // actually readable as a PIP. The assembler clamps to [0.2, 0.55].
      corner: 'br',
      widthFraction: 0.46,
    }
    host.overlays = [...(host.overlays ?? []), overlay]
  }

  return segments
}

// ── SFX cue builder ────────────────────────────────────────────────────

interface BuildSfxCuesParams {
  segments: EditSegment[]
  punchZooms: { startSec: number }[]
  totalDurationSec: number
  sfxDensity: number
  styleAppliesCta: boolean
}

function buildSfxCues(params: BuildSfxCuesParams): SfxCue[] {
  if (params.sfxDensity <= 0) return []
  const cues: SfxCue[] = []

  // 1. Transitions — fire SFX on every action_insert IN/OUT
  for (const seg of params.segments) {
    if (seg.source.kind === 'action_insert') {
      cues.push({
        startSec: round2(seg.startSec),
        sfxId: pickSfxFor('transition'),
        volume: 0.35 * params.sfxDensity,
        reason: 'transition',
      })
    }
  }

  // 2. Punch-zoom accents — light click on each zoom (if density high enough)
  if (params.sfxDensity > 0.4) {
    for (const zoom of params.punchZooms) {
      cues.push({
        startSec: round2(zoom.startSec),
        sfxId: pickSfxFor('punch_zoom'),
        volume: 0.25 * params.sfxDensity,
        reason: 'punch_zoom',
      })
    }
  }

  // 3. CTA hit — strong impact 0.5s before CTA shows (if style does CTA)
  if (params.styleAppliesCta && params.totalDurationSec > 2) {
    cues.push({
      startSec: round2(params.totalDurationSec - 2.0),
      sfxId: pickSfxFor('cta'),
      volume: 0.45 * Math.max(0.5, params.sfxDensity),
      reason: 'cta_emphasis',
    })
  }

  // Sort + dedupe overlapping
  cues.sort((a, b) => a.startSec - b.startSec)
  const out: SfxCue[] = []
  for (const c of cues) {
    const last = out[out.length - 1]
    // Don't fire two SFX within 0.2s of each other (too cluttered)
    if (!last || c.startSec - last.startSec > 0.2) out.push(c)
  }
  return out
}

// ── CTA overlay builder ────────────────────────────────────────────────

interface BuildCtaParams {
  script: GeneratedScript
  totalDurationSec: number
  styleId: EditingStyleId
  textOverride?: string
}

function buildCtaOverlay(params: BuildCtaParams): CtaOverlay {
  // Extract CTA text from script — pick the script's CTA block first line.
  const ctaBlock = params.script.blocks.find((b) => b.id === 'cta')
  // Fall back to empty (not an English string) so we never leak a language
  // that doesn't match the script's output language. The CTA block is one of
  // the 5 canonical blocks, so this is effectively always populated.
  const fallbackText = ctaBlock?.text.split(/[.!?]/)[0].trim() || ''
  const text = (params.textOverride || fallbackText).slice(0, 80)

  // Style decides animation
  const style = EDITING_STYLES[params.styleId]
  const animation: CtaOverlay['animation'] =
    style.id === 'aggressive_sales' ? 'shake' :
    style.id === 'fast_ugc'         ? 'pop_in' :
    style.id === 'emotional_story'  ? 'fade_in' :
    'slide_up'

  // CTA duration = last 2s of video
  return {
    startSec: round2(Math.max(0, params.totalDurationSec - 2.0)),
    durationSec: 2.0,
    text,
    animation,
    style: style.id === 'aggressive_sales' ? 'fullscreen_centered' : 'sticker_bottom',
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Validation diagnostic ──────────────────────────────────────────────

/** Z34 — Cheap sanity check on the generated plan. Returns warnings the
 *  UI can show without blocking the user from previewing. */
export function validatePlan(plan: AutoEditPlan): string[] {
  const warnings: string[] = []

  if (plan.segments.length === 0) {
    warnings.push('Không có segment nào — plan rỗng.')
  }
  if (plan.totalDurationSec < 5) {
    warnings.push(`Video chỉ ${plan.totalDurationSec.toFixed(1)}s — có thể quá ngắn cho TikTok hook.`)
  }
  if (plan.totalDurationSec > 90) {
    warnings.push(`Video ${plan.totalDurationSec.toFixed(1)}s — vượt cap TikTok ad chuẩn (60s).`)
  }
  // Verify segment continuity
  for (let i = 1; i < plan.segments.length; i++) {
    const prev = plan.segments[i - 1]
    const cur = plan.segments[i]
    const expectedStart = prev.startSec + prev.durationSec
    if (Math.abs(cur.startSec - expectedStart) > 0.05) {
      warnings.push(`Gap timeline giữa segment ${prev.segmentId} → ${cur.segmentId}: ${(cur.startSec - expectedStart).toFixed(2)}s`)
    }
  }
  return warnings
}
