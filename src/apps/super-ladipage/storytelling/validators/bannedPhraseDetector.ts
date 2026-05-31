// ─────────────────────────────────────────────────────────────────────
// bannedPhraseDetector
//
// Lists patterns mapped to anti-pattern tags (visual/text/vibe). Phase 5
// runtime injects "AVOID: <tag>" — but Gemini may still slip. Output-side
// detector catches drift.
// ─────────────────────────────────────────────────────────────────────

import type { ParsedSection } from '../runtime/parsePackResponse'
import type { ValidatorResult, ValidatorViolation } from './bioIntroDetector'

interface BannedPattern {
  pattern: RegExp | string
  reason: string
}

const BANNED_PHRASES: BannedPattern[] = [
  // ── Miracle / instant transformation ──
  { pattern: 'khỏi hẳn', reason: 'miracle transformation claim' },
  { pattern: 'khỏi hoàn toàn', reason: 'miracle transformation claim' },
  { pattern: 'hết hẳn', reason: 'miracle transformation claim' },
  { pattern: 'ngay lập tức', reason: 'instant-result claim' },
  { pattern: /(?:sau|trong)\s+\d+\s+ngày\s+(?:đã\s+)?(?:khỏi|hết)/, reason: 'specific-day miracle' },

  // ── Hard sell / urgency ──
  { pattern: 'đặt hàng ngay', reason: 'hard-sell CTA' },
  { pattern: 'đặt mua ngay', reason: 'hard-sell CTA' },
  { pattern: 'click ngay', reason: 'hard-sell CTA' },
  { pattern: 'mua ngay', reason: 'hard-sell CTA' },
  { pattern: 'chỉ còn', reason: 'fake urgency' },
  { pattern: 'cơ hội cuối', reason: 'fake urgency' },
  { pattern: 'ưu đãi sắp hết', reason: 'fake urgency' },

  // ── Guarantee / superlative ──
  { pattern: 'đảm bảo', reason: 'guarantee language' },
  { pattern: 'cam kết', reason: 'guarantee language' },
  { pattern: 'duy nhất', reason: 'exclusivity claim' },
  { pattern: 'tốt nhất', reason: 'superlative marketing' },
  { pattern: 'hiệu quả nhất', reason: 'superlative marketing' },

  // ── Doctor / expert authority injection ──
  { pattern: /\bbs\.\s+\w/i, reason: 'doctor abbreviation injection' },
  { pattern: 'bác sĩ khuyên', reason: 'doctor authority' },
  { pattern: 'dược sĩ khuyên', reason: 'pharmacist authority' },
  { pattern: 'chuyên gia khuyên', reason: 'expert authority' },

  // ── Statistics dump ──
  { pattern: /\d{2,3}%\s*(người dùng|khách hàng|phụ nữ|đàn ông)/, reason: 'statistics dump' },
  { pattern: /\d{1,3}\.?\d{3,}\s+(người|khách|case)/, reason: 'volume statistics dump' },

  // ── Shocking reveal / plot twist promise ──
  { pattern: 'bí mật kinh hoàng', reason: 'shocking-reveal trope' },
  { pattern: 'sẽ thay đổi tất cả', reason: 'plot-twist promise' },
  { pattern: 'điều ít ai biết', reason: 'secret-tease trope' },
  // 'tiết lộ' REMOVED — natural use in confession voice OK ("tôi tiết lộ với chồng")

  // ── Fake confession bait ──
  { pattern: 'cuộc đời tôi sụp đổ', reason: 'overdramatic trauma' },
  { pattern: 'không ai biết tôi đã', reason: 'manufactured confession' },
  // 'tôi đã từng nghĩ đến' REMOVED — natural confession context OK

  // ── Generic-wellness AI fingerprints (SPEC-FIX 2026-05-27 + 2026-05-29) ──
  // These phrases are explicitly in nicheMechanismVocab.bannedGenericPhrases
  // for EVERY niche but Gemini still drifts to them. Hard ban now.
  { pattern: 'phục hồi từ bên trong', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'từ bên trong ra ngoài', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'cân bằng cơ thể', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'nuôi dưỡng toàn diện', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'phục hồi tự nhiên', reason: 'generic wellness fingerprint — banned across all niches' },
  { pattern: 'gốc rễ vấn đề', reason: 'generic wellness fingerprint — banned across all niches' },
  // 2026-05-29 — User-reported drift (knee brace pack). The "root cause vs
  // mask symptoms" framing is wrong for mechanical-support products and is
  // the #1 sign of soft-recognition mode leaking when pain-driven-DR was
  // intended. Hard ban + variants.
  { pattern: 'nguyên nhân gốc rễ', reason: 'generic wellness fingerprint — root-cause framing leaks into wrong niches' },
  { pattern: 'tập trung vào nguyên nhân gốc rễ', reason: 'generic wellness fingerprint' },
  { pattern: 'che đậy triệu chứng', reason: 'generic wellness fingerprint — root-cause inverse' },
  { pattern: 'che đậy các triệu chứng', reason: 'generic wellness fingerprint — root-cause inverse' },
  { pattern: 'che đi triệu chứng', reason: 'generic wellness fingerprint — root-cause inverse' },
  { pattern: 'triệu chứng bên ngoài', reason: 'generic wellness fingerprint — root-cause framing' },
  { pattern: 'giải quyết tận gốc', reason: 'generic wellness fingerprint — root-cause framing' },
  { pattern: 'không phải là phép màu', reason: 'AI hedge cliche — overused dismissal that signals AI output' },
  // 2026-05-30 — User reported "từ bên trong cơ thể" + "tập trung vào gốc rễ
  // vấn đề từ bên trong" leaked through 10/10 test packs across niches. The
  // VN-only ban list was bypassed when MS/EN packs auto-translated to VN at
  // section copy build time — translation re-introduced banned phrases.
  // Plus the dental product output added "thẩm thấu sâu", "căn nguyên", and
  // "chăm sóc từ gốc rễ". Adding the missing variants.
  { pattern: 'từ bên trong cơ thể', reason: 'wellness AI fingerprint — user-reported leak across 10/10 test packs' },
  { pattern: 'tác động từ trong ra ngoài', reason: 'wellness AI fingerprint — internal/external dichotomy' },
  { pattern: 'thẩm thấu sâu', reason: 'wellness AI fingerprint — penetration metaphor cliche' },
  { pattern: 'ngấm sâu vào tận', reason: 'wellness AI fingerprint — same penetration metaphor variant' },
  { pattern: 'căn nguyên vấn đề', reason: 'wellness AI fingerprint — root-cause alt phrasing' },
  { pattern: 'căn nguyên', reason: 'wellness AI fingerprint — root-cause alt phrasing' },
  { pattern: 'chăm sóc từ gốc rễ', reason: 'wellness AI fingerprint — root-cause inverse phrasing' },
  { pattern: 'gốc rễ', reason: 'wellness AI fingerprint — root-cause framing leaks across niches' },
  { pattern: 'tận gốc', reason: 'wellness AI fingerprint — root-cause alt' },
  // ── Bahasa Melayu equivalents ──
  // Pack target=ms outputs in MS; translate-to-VN step inherits these
  // phrases when un-banned. Banning at source language prevents the leak
  // before translation happens.
  { pattern: 'akar masalah', reason: 'wellness AI fingerprint MS — equivalent of "gốc rễ vấn đề"' },
  { pattern: 'punca masalah', reason: 'wellness AI fingerprint MS — equivalent of "nguyên nhân vấn đề"' },
  { pattern: 'atasi punca', reason: 'wellness AI fingerprint MS — root-cause framing' },
  { pattern: 'dari dalam', reason: 'wellness AI fingerprint MS — "from within" equivalent' },
  { pattern: 'bukan sekadar gejala', reason: 'wellness AI fingerprint MS — symptoms inverse' },
  // ── English equivalents ──
  { pattern: 'root cause', reason: 'wellness AI fingerprint EN — root-cause framing' },
  { pattern: 'address the source', reason: 'wellness AI fingerprint EN — alt root-cause phrasing' },
  { pattern: 'from within', reason: 'wellness AI fingerprint EN — internal framing' },
  { pattern: 'not just symptoms', reason: 'wellness AI fingerprint EN — symptoms inverse' },
  { pattern: 'masking symptoms', reason: 'wellness AI fingerprint EN — root-cause inverse' },
]

export function bannedPhraseDetector(sections: ParsedSection[]): ValidatorResult {
  const violations: ValidatorViolation[] = []

  for (const s of sections) {
    const lower = s.copy.toLowerCase()
    for (const { pattern, reason } of BANNED_PHRASES) {
      const hit = typeof pattern === 'string' ? lower.includes(pattern.toLowerCase()) : pattern.test(lower)
      if (hit) {
        const matched = typeof pattern === 'string' ? pattern : lower.match(pattern)?.[0] ?? '(regex match)'
        violations.push({
          sectionId: s.id,
          violation: `Banned phrase "${matched}" — ${reason}`,
        })
      }
    }
  }

  return { pass: violations.length === 0, violations }
}

// ─── 2026-05-30 — PI block banned phrase scanner ───────────────────────
//
// Storytelling main blocks pass through bannedPhraseDetector via
// runValidators. PI blocks (mechanism / ingredients / usage / social /
// pricing) were SILENT — they're generated by a separate Gemini call and
// interleaved into the pack after storytelling validation completes, so
// the validator never saw them.
//
// User reported "Hiểu Rõ Nguyên Nhân Gây Ra Vấn Đề Răng Miệng" — a PI
// mechanism block chapter title containing the banned "nguyên nhân"
// phrase. Plus body text "chăm sóc từ gốc rễ vấn đề". The storytelling
// validator wouldn't have caught these because PI sections aren't in
// parsed.sections — they're in the separate PIBlock[] structure.
//
// This helper takes ANY text (heading, paragraph, subtleCallout) and
// returns true if it contains a banned phrase, plus the matched phrase
// for telemetry. The caller decides what to do (retry the block, fall
// back to template, or just log).

export interface BannedPhraseHit {
  phrase: string
  reason: string
}

/** Scan a single string for banned phrases. Returns the first hit found
 *  or null when clean. Case-insensitive matching to mirror the section
 *  detector. */
export function findBannedPhrase(text: string | undefined | null): BannedPhraseHit | null {
  if (!text || typeof text !== 'string') return null
  const lower = text.toLowerCase()
  for (const { pattern, reason } of BANNED_PHRASES) {
    const hit = typeof pattern === 'string' ? lower.includes(pattern.toLowerCase()) : pattern.test(lower)
    if (hit) {
      const matched = typeof pattern === 'string'
        ? pattern
        : (lower.match(pattern)?.[0] ?? '(regex match)')
      return { phrase: matched, reason }
    }
  }
  return null
}

/** Scan an array of strings (e.g., PIBlock.paragraphs) and return all hits.
 *  Empty array means clean. */
export function findBannedPhrasesInTexts(texts: ReadonlyArray<string | undefined | null>): BannedPhraseHit[] {
  const hits: BannedPhraseHit[] = []
  for (const t of texts) {
    const h = findBannedPhrase(t)
    if (h) hits.push(h)
  }
  return hits
}
