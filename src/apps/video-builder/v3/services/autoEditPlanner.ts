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
  AutoEditPlan, EditSegment, SegmentOverlay, CtaOverlay,
  EditingStyleId, SubtitleStyleId, BgmStyleId,
  CreatorVideoClip, ActionInsertClip, GeneratedScript, VoiceAlignment,
} from '../types'
import { EDITING_STYLES } from './editingStyles'
import { BGM_CATALOG } from './bgmCatalog'
import { buildPunchZoomCues } from './punchZoomPlanner'
import { computeQuoteTimestampFromAlignment } from './insertTimingEngine'

// Z98 (#6) — the anchor second of an insert on the FINAL voice timeline. Prefers
// the REAL voice alignment (exact spoken second of the insert's quoted line) and
// only falls back to the WPM estimate × global rescale when there's no alignment
// or the quote can't be located. Returns null when the insert has no anchor at
// all (caller then spaces it evenly).
function resolveAnchorSec(
  insert: ActionInsertClip,
  voiceAlignment: VoiceAlignment | undefined,
  timelineScale: number,
): number | null {
  if (voiceAlignment && insert.quote) {
    const real = computeQuoteTimestampFromAlignment(voiceAlignment, insert.quote)
    if (real != null) return real   // exact — already in final-audio seconds, no scale
  }
  if (insert.voiceTimestampSec == null) return null
  return insert.voiceTimestampSec * timelineScale   // estimate fallback (Z57)
}

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

  // Filter inserts to only those eligible (approved / locked / completed).
  // Z98 #5 — a sticker's footage is its local PNG (keyframeRef), not a videoRef,
  // so accept EITHER so stickers aren't filtered out before the overlay pass.
  const eligibleInserts = params.inserts.filter((it) =>
    (it.status === 'approved' || it.status === 'locked' || it.status === 'completed') &&
    (!!it.videoRef || (it.renderMode === 'sticker' && !!it.keyframeRef))
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
  // Z98 #5 — telemetry: how many sticker / video overlays made it into the plan.
  const allOverlays = segments.flatMap((s) => s.overlays ?? [])
  const stickerOverlays = allOverlays.filter((o) => !!o.imageRef)
  console.log(
    `[AUTO_EDIT] overlays=${allOverlays.length} (stickers=${stickerOverlays.length}, video=${allOverlays.length - stickerOverlays.length}) ` +
    `at ${stickerOverlays.map((o) => `${o.startSec}s`).join(',') || '—'}`,
  )

  // ── 2. Captions — REMOVED (Z98) ──────────────────────────────────────
  // Subtitle feature dropped: the WPM-estimated caption timing drifted badly
  // and the .ass burn errored ("Parsed_ass Read failed"). No captions generated.
  const captions: AutoEditPlan['captions'] = []

  // ── 3. Build punch zoom cues ─────────────────────────────────────────
  const punchZooms = buildPunchZoomCues({
    script: params.script,
    scriptStartSec: 0,
    styleId: params.styleId,
    totalDurationSec,
  })

  // ── 4. SFX — REMOVED (Z98) ───────────────────────────────────────────
  // No /sfx/*.mp3 files ever shipped (404 spam) + BGM was already removed.
  const sfxCues: AutoEditPlan['sfxCues'] = []

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
    // Z98 (#6) — real voice second when available, else estimate × rescale.
    let ts = resolveAnchorSec(insert, creatorVideo.voiceAlignment, timelineScale)
    if (ts === null) {
      // Evenly distribute manually-added inserts that lack any anchor
      const fraction = insertSlots.length / Math.max(1, inserts.length)
      ts = cutUsableStart + fraction * (usableEnd - cutUsableStart)
    }
    // Z80 — cuts can't start before the creator lead-in (4s).
    ts = Math.max(cutUsableStart, Math.min(usableEnd - durSec, ts))
    insertSlots.push({
      insert,
      tsSec: round2(ts),
      durSec: round2(durSec),
    })
  }

  // Sort by timestamp. Overlap handling is done by the Z83 gap loop below
  // (overlapping later cuts are demoted to overlays, not pushed forward).
  insertSlots.sort((a, b) => a.tsSec - b.tsSec)
  // Z80 — the OPENING cut stays short so the ad doesn't sit on one B-roll right
  // after the hook (user: "mở đầu 6s quá dài"). Cap the earliest cut to ≤4s.
  if (insertSlots.length > 0) {
    insertSlots[0].durSec = round2(Math.min(insertSlots[0].durSec, 4))
  }
  // Z98 — NO MORE DEMOTION. A cut the director chose STAYS a cut; it is never
  // pushed up to an overlay (user: "mọi cảnh đạo diễn xác định là cut thì edit
  // video phải dùng cut, ko đẩy lên overlay hết"). The old Z83 MIN_CREATOR_GAP
  // rule demoted any cut landing <3s after the previous one — that quietly
  // overrode director intent. Instead, when two cuts would overlap we slide the
  // later one forward so they sit back-to-back (high cut density is allowed —
  // 5/5 is fine). Real per-word voice timing (the ElevenLabs timestamp package)
  // is the proper fix for placement drift; this just guarantees no overlap.
  const keptSlots: typeof insertSlots = []
  let lastCutEnd = -Infinity
  for (const slot of insertSlots) {
    let start = slot.tsSec
    if (start < lastCutEnd) start = round2(lastCutEnd)  // slide forward, stay a cut
    const room = round2(totalDurationSec - start)
    if (room < 1.0) continue  // no room left before the end → drop (can't show <1s)
    slot.tsSec = start
    slot.durSec = round2(Math.min(slot.durSec, room))
    keptSlots.push(slot)
    lastCutEnd = round2(start + slot.durSec)
  }
  const validSlots = keptSlots

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
  // Z98 — only real director-chosen overlays here (cuts are no longer demoted).
  for (const ins of overlayInserts) {
    // Z98 #5 — a sticker's footage is its PNG (keyframeRef); a video/ken_burns
    // overlay is its mp4 (videoRef). Accept either.
    const isSticker = ins.renderMode === 'sticker'
    const srcRef = isSticker ? ins.keyframeRef : ins.videoRef
    if (!srcRef) continue
    const footageCap = (ins.renderMode ?? 'video') === 'ken_burns' ? 8 : 7
    const durSec = isSticker
      ? Math.max(1.2, Math.min(2.5, ins.durationSec || 1.8))
      : Math.max(1.5, Math.min(footageCap, ins.durationSec || insertOverlayDurationSec))
    // Z98 (#6) — real voice second. A sticker's voiceTimestampSec is ALREADY the
    // word-level second (5.3, final-audio seconds), so use it directly — DON'T
    // re-anchor through resolveAnchorSec, which re-locates the whole sentence
    // quote and would drag the sticker back to the sentence start.
    let ts = isSticker
      ? (ins.voiceTimestampSec ?? null)
      : resolveAnchorSec(ins, creatorVideo.voiceAlignment, timelineScale)
    if (ts == null) {
      // Manually-added overlay without any anchor → put at the midpoint
      ts = totalDurationSec / 2
    }
    ts = Math.max(usableStart, Math.min(usableEnd - durSec, ts))

    // Find the segment that contains the overlay START. Z98 #5 v2 — a sticker
    // is a tiny mid-right PNG, so it MAY ride on top of a CUT segment too, which
    // keeps it pinned to its exact spoken word even while a cut is playing. A
    // video overlay (a big PIP) stays creator-only — PIP-ing a video on top of
    // another full-screen cut looks wrong.
    const canHost = (s: typeof segments[number]) => isSticker || s.source.kind === 'creator_video'
    let host = segments.find(
      (s) => canHost(s) && s.startSec <= ts! && ts! < s.startSec + s.durationSec,
    )
    if (!host) {
      // The ideal time lands on a segment this overlay can't host on (a video
      // overlay over a cut). Slide to the START of the next eligible segment so
      // it still renders (slightly off its line) instead of being dropped.
      const next = segments.find((s) => canHost(s) && s.startSec >= ts!)
      if (!next) continue  // no eligible window left → drop
      host = next
      ts = next.startSec
    }

    // Clamp the overlay window to within the host segment.
    let overlayStart = Math.max(0, ts - host.startSec)
    // Z88 — DE-COLLIDE. Multiple overlays can land on the SAME creator segment;
    // without this they'd sit at the same corner+time and render stacked. Push
    // each new overlay to start AFTER the latest existing one. Z98 #5 — only
    // de-collide against the SAME corner: a sticker (mid-right) and a video
    // overlay (bottom-right) never visually clash, so they shouldn't shove
    // each other off their voice moment.
    const targetCorner: SegmentOverlay['corner'] = isSticker ? 'mr' : 'br'
    const existing = (host.overlays ?? []).filter((o) => (o.corner ?? 'br') === targetCorner)
    if (existing.length > 0) {
      const latestEnd = Math.max(...existing.map((o) => o.startSec + o.durationSec))
      if (overlayStart < latestEnd) overlayStart = round2(latestEnd + 0.2)
    }
    const overlayEnd = Math.min(host.durationSec, overlayStart + durSec)
    const overlayDur = round2(overlayEnd - overlayStart)
    if (overlayDur < 1.0) continue  // too short after clamp / no room left → drop

    const overlay: SegmentOverlay = isSticker
      ? {
          // Z98 #5 — sticker: transparent PNG, mid-right edge, sized by HEIGHT
          // (~9% of frame) so every label reads at the same size.
          insertId: ins.insertId,
          imageRef: ins.keyframeRef,
          startSec: round2(overlayStart),
          durationSec: overlayDur,
          corner: 'mr',
          heightFraction: 0.09,
        }
      : {
          insertId: ins.insertId,
          videoRef: ins.videoRef,
          startSec: round2(overlayStart),
          durationSec: overlayDur,
          // Z77 — bottom-right + bigger. The creator talking-head's face sits
          // upper-centre, so a bottom corner keeps the face clear while filling
          // the dead chest/shirt space. The assembler clamps to [0.2, 0.55].
          corner: 'br',
          widthFraction: 0.46,
        }
    host.overlays = [...(host.overlays ?? []), overlay]
  }

  return segments
}

// Z98 — buildSfxCues() removed (SFX feature dropped; no /sfx files shipped).

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
