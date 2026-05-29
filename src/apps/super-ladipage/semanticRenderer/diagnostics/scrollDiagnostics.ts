// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — scrollDiagnostics (P8 validation loop)
//
// Pure aggregate analyzer. Reads VisualSemanticsPage → produces
// DiagnosticsReport. No mutation, no derivation, no new intelligence.
//
// 6 categories detected:
//   1. heavy-clustering    — 2+ adjacent scrollWeight='heavy'
//   2. proof-clustering    — 2+ adjacent sections with proof visible
//   3. visual-monotony     — 3+ adjacent same eyeFlow|pattern|energy
//   4. cta-overexposure    — 3+ total CTA-visible OR 2+ adjacent
//   5. breathing-collapse  — any cramped OR 3+ adjacent w/o generous
//   6. fatigue-spike       — 2+ consecutive compressed-tension
//
// Complements (does NOT overlap):
//   - composer/scrollFatigueDetector       (density/word-count fatigue)
//   - renderContract/renderContractConsistencyDetector (intra-section)
//   - visualSemantics/visualSemanticsCoherenceDetector (axis contradictions)
// ─────────────────────────────────────────────────────────────────────

import type { VisualSemanticsPage, VisualSemanticsSection } from '../types'
import type {
  DiagnosticIssue,
  DiagnosticsReport,
  DiagnosticCategory,
  DiagnosticSeverity,
} from './types'

export function scrollDiagnostics(page: VisualSemanticsPage): DiagnosticsReport {
  const issues: DiagnosticIssue[] = []
  const sections = page.sections

  // ── 1. Heavy clustering — 2+ adjacent scrollWeight='heavy' ───────
  issues.push(...detectHeavyClustering(sections))

  // ── 2. Proof clustering — 2+ adjacent proof-visible ──────────────
  issues.push(...detectProofClustering(sections))

  // ── 3. Visual monotony — 3+ adjacent same axis value ─────────────
  issues.push(...detectVisualMonotony(sections))

  // ── 4. CTA overexposure ─────────────────────────────────────────
  issues.push(...detectCtaOverexposure(sections))

  // ── 5. Breathing collapse ───────────────────────────────────────
  issues.push(...detectBreathingCollapse(sections))

  // ── 6. Fatigue spike — 2+ consecutive compressed-tension ────────
  issues.push(...detectFatigueSpikes(sections))

  return summarize(issues)
}

// ─── detectors ────────────────────────────────────────────────────

function detectHeavyClustering(sections: VisualSemanticsSection[]): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = []
  let runStart = -1
  for (let i = 0; i < sections.length; i++) {
    const isHeavy = sections[i].scrollWeight === 'heavy'
    if (isHeavy && runStart === -1) {
      runStart = i
    } else if (!isHeavy && runStart !== -1) {
      flushHeavy(sections, runStart, i - 1, out)
      runStart = -1
    }
  }
  if (runStart !== -1) flushHeavy(sections, runStart, sections.length - 1, out)
  return out
}

function flushHeavy(
  sections: VisualSemanticsSection[],
  start: number,
  end: number,
  out: DiagnosticIssue[],
) {
  if (end - start + 1 >= 2) {
    const affected = sections.slice(start, end + 1).map((s) => s.id)
    out.push({
      category: 'heavy-clustering',
      severity: end - start + 1 >= 3 ? 'critical' : 'warn',
      message:
        `${affected.length} sections in a row with heavy scrollWeight ` +
        `(${affected.join(' → ')}). Reader fatigue risk — interleave a lighter section.`,
      affectedSectionIds: affected,
    })
  }
}

function detectProofClustering(sections: VisualSemanticsSection[]): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = []
  let runStart = -1
  for (let i = 0; i < sections.length; i++) {
    const visible = sections[i].visualSemantics.proofWeight !== 'invisible'
    if (visible && runStart === -1) {
      runStart = i
    } else if (!visible && runStart !== -1) {
      flushProof(sections, runStart, i - 1, out)
      runStart = -1
    }
  }
  if (runStart !== -1) flushProof(sections, runStart, sections.length - 1, out)
  return out
}

function flushProof(
  sections: VisualSemanticsSection[],
  start: number,
  end: number,
  out: DiagnosticIssue[],
) {
  if (end - start + 1 >= 2) {
    const affected = sections.slice(start, end + 1).map((s) => s.id)
    out.push({
      category: 'proof-clustering',
      severity: end - start + 1 >= 3 ? 'critical' : 'warn',
      message:
        `${affected.length} adjacent sections show proof (${affected.join(' → ')}). ` +
        `Proof-fatigue risk — distribute proof across phases instead of clustering.`,
      affectedSectionIds: affected,
    })
  }
}

function detectVisualMonotony(sections: VisualSemanticsSection[]): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = []
  const axes: Array<{
    label: string
    pick: (s: VisualSemanticsSection) => string
  }> = [
    { label: 'eyeFlow', pick: (s) => s.visualSemantics.eyeFlow },
    { label: 'mobilePattern', pick: (s) => s.renderContract.mobilePattern },
    { label: 'visualEnergy', pick: (s) => s.renderContract.visualEnergy },
  ]
  for (const axis of axes) {
    let runStart = 0
    for (let i = 1; i <= sections.length; i++) {
      const cur = i < sections.length ? axis.pick(sections[i]) : null
      const prev = axis.pick(sections[i - 1])
      if (cur !== prev) {
        const runLen = i - runStart
        if (runLen >= 3) {
          const affected = sections.slice(runStart, i).map((s) => s.id)
          out.push({
            category: 'visual-monotony',
            severity: runLen >= 4 ? 'critical' : 'warn',
            message:
              `${runLen} adjacent sections share ${axis.label}='${prev}' ` +
              `(${affected.join(' → ')}). Visual rhythm monotony — alter one section.`,
            affectedSectionIds: affected,
          })
        }
        runStart = i
      }
    }
  }
  return out
}

function detectCtaOverexposure(sections: VisualSemanticsSection[]): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = []
  const visible = sections.filter(
    (s) => s.visualSemantics.ctaAggression !== 'hidden',
  )
  if (visible.length >= 4) {
    out.push({
      category: 'cta-overexposure',
      severity: visible.length >= 5 ? 'critical' : 'warn',
      message:
        `${visible.length} sections show visible CTAs (${visible.map((s) => s.id).join(', ')}). ` +
        `CTA fatigue — reader pressure. Reduce to 1-3 CTA-visible sections.`,
      affectedSectionIds: visible.map((s) => s.id),
    })
  }
  // adjacent CTA-visible run >= 2
  let runStart = -1
  for (let i = 0; i < sections.length; i++) {
    const v = sections[i].visualSemantics.ctaAggression !== 'hidden'
    if (v && runStart === -1) {
      runStart = i
    } else if (!v && runStart !== -1) {
      flushCta(sections, runStart, i - 1, out)
      runStart = -1
    }
  }
  if (runStart !== -1) flushCta(sections, runStart, sections.length - 1, out)
  return out
}

function flushCta(
  sections: VisualSemanticsSection[],
  start: number,
  end: number,
  out: DiagnosticIssue[],
) {
  if (end - start + 1 >= 2) {
    const affected = sections.slice(start, end + 1).map((s) => s.id)
    out.push({
      category: 'cta-overexposure',
      severity: 'warn',
      message:
        `${affected.length} adjacent sections push CTA (${affected.join(' → ')}). ` +
        `Back-to-back asks feel pushy — let one breathe.`,
      affectedSectionIds: affected,
    })
  }
}

function detectBreathingCollapse(sections: VisualSemanticsSection[]): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = []

  // any cramped → info
  for (const s of sections) {
    if (s.visualSemantics.sectionBreathing === 'cramped') {
      out.push({
        category: 'breathing-collapse',
        severity: 'info',
        message:
          `Section "${s.id}" is cramped — no breathing room. ` +
          `Consider giving readers a pause unless this is hero impact.`,
        affectedSectionIds: [s.id],
      })
    }
  }

  // 3+ adjacent without 'generous' or 'vast'
  let denseRun = 0
  let runStart = 0
  for (let i = 0; i < sections.length; i++) {
    const b = sections[i].visualSemantics.sectionBreathing
    if (b === 'cramped' || b === 'comfortable') {
      if (denseRun === 0) runStart = i
      denseRun++
    } else {
      if (denseRun >= 3) {
        const affected = sections.slice(runStart, runStart + denseRun).map((s) => s.id)
        out.push({
          category: 'breathing-collapse',
          severity: denseRun >= 4 ? 'critical' : 'warn',
          message:
            `${denseRun} adjacent sections with no generous breathing ` +
            `(${affected.join(' → ')}). Insert one airy/generous section as scroll relief.`,
          affectedSectionIds: affected,
        })
      }
      denseRun = 0
    }
  }
  if (denseRun >= 3) {
    const affected = sections.slice(runStart, runStart + denseRun).map((s) => s.id)
    out.push({
      category: 'breathing-collapse',
      severity: denseRun >= 4 ? 'critical' : 'warn',
      message:
        `${denseRun} adjacent sections with no generous breathing ` +
        `(${affected.join(' → ')}). Insert one airy/generous section as scroll relief.`,
      affectedSectionIds: affected,
    })
  }

  return out
}

function detectFatigueSpikes(sections: VisualSemanticsSection[]): DiagnosticIssue[] {
  const out: DiagnosticIssue[] = []
  let runStart = -1
  for (let i = 0; i < sections.length; i++) {
    const isSpike =
      sections[i].visualSemantics.emotionalCompression === 'compressed-tension'
    if (isSpike && runStart === -1) {
      runStart = i
    } else if (!isSpike && runStart !== -1) {
      flushSpike(sections, runStart, i - 1, out)
      runStart = -1
    }
  }
  if (runStart !== -1) flushSpike(sections, runStart, sections.length - 1, out)
  return out
}

function flushSpike(
  sections: VisualSemanticsSection[],
  start: number,
  end: number,
  out: DiagnosticIssue[],
) {
  if (end - start + 1 >= 2) {
    const affected = sections.slice(start, end + 1).map((s) => s.id)
    out.push({
      category: 'fatigue-spike',
      severity: end - start + 1 >= 3 ? 'critical' : 'warn',
      message:
        `${affected.length} consecutive compressed-tension sections ` +
        `(${affected.join(' → ')}). Reader emotional overload — needs release/building phase.`,
      affectedSectionIds: affected,
    })
  }
}

// ─── summarize ────────────────────────────────────────────────────

function summarize(issues: DiagnosticIssue[]): DiagnosticsReport {
  const countsByCategory: Record<DiagnosticCategory, number> = {
    'heavy-clustering': 0,
    'proof-clustering': 0,
    'visual-monotony': 0,
    'cta-overexposure': 0,
    'breathing-collapse': 0,
    'fatigue-spike': 0,
  }
  const countsBySeverity: Record<DiagnosticSeverity, number> = {
    info: 0,
    warn: 0,
    critical: 0,
  }
  for (const issue of issues) {
    countsByCategory[issue.category]++
    countsBySeverity[issue.severity]++
  }
  return {
    issues,
    countsByCategory,
    countsBySeverity,
    totalIssues: issues.length,
  }
}
