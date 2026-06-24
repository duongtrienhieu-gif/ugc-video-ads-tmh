// ── replyCommentForVideo (Reply-Comment mode, P1) ────────────────────────────
// The "brain" of the TikTok reply-comment ad format. It writes the ON-SCREEN
// COMMENT the creator is "replying to" — the card shown top-of-frame in scene #1
// (the standard TikTok "Reply to @username's comment" bubble).
//
// In this format the COMMENT itself IS the hook (no separate scripted hook):
//   • it is written from a VIEWER's POV — a real person voicing the product's
//     biggest PAIN / struggle / burning question (NEVER naming the product — the
//     commenter doesn't know it yet; that's what the creator's reply reveals),
//   • it must be SHOCK / curiosity-loaded so a cold paid-ads viewer stops to see
//     "what's the answer", AND give the body real FUEL to flow into smoothly.
//
// Reads the FULL product brief (painPoints / benefits / insight) so the comment is
// grounded in the real customer pain, not generic. temp 0.9 (per spec) for variety
// across re-rolls. Native MY / VN register. Graceful: returns '' on any failure
// (the caller can fall back to a user-typed comment).
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../../utils/gemini'
import { SCRIPT_LANG_GEMINI_NAME, type ScriptLang } from '../types'

export interface ReplyCommentParams {
  apiKey: string
  /** Product name — TEXT context only (the comment must NOT name it). */
  productName: string
  /** Rich product brief (painPoints / benefits / USPs / ingredients / offer). */
  productPitch: string
  lang: ScriptLang
  /** Prior comments to avoid repeating on a re-roll (the "✨ AI gợi ý" button). */
  previous?: string[]
}

const stripWrap = (s: string): string =>
  String(s ?? '').trim().replace(/^["'“”\-•\s]+|["'“”\s]+$/g, '').replace(/\s+/g, ' ')

/** Generate ONE viral on-screen comment for the reply-comment format.
 *  Returns '' on any failure so the caller can fall back to a typed comment. */
export async function replyCommentForVideo(params: ReplyCommentParams): Promise<string> {
  const { apiKey, productName, productPitch, lang } = params
  if (!apiKey) return ''
  const langName = SCRIPT_LANG_GEMINI_NAME[lang] ?? 'Vietnamese'
  const avoid = (params.previous ?? []).filter(Boolean).slice(0, 8)

  const systemInstruction =
`You write the ON-SCREEN COMMENT for a TikTok "Reply to comment" AD (the bubble shown top of frame
in the first 2-3s). The creator will then personally REPLY to it — so this comment IS the hook.
Write in ${langName} ONLY — the casual, native voice of a REAL ${langName} TikTok commenter` +
(lang === 'ms' ? ' (everyday Bahasa Malaysia: korang/aku/eh/weh/je, code-switch ok).' : lang === 'vi' ? ' (đời thường: tui/mình, "ủa", "trời", tự nhiên).' : '.') + `

READ + DEEPLY UNDERSTAND the product brief below: its customers, their REAL pains, the standout
problem it solves. The comment voices the SINGLE most relatable / burning PAIN or QUESTION of that
buyer — the one that makes a scroller think "ơ giống mình" / "eh ni macam aku" and STOP.

HARD RULES:
- POV = a VIEWER / commenter, NOT the seller. They describe THEIR struggle or ASK for help.
- NEVER name or hint the product / brand (the commenter doesn't know it — the reply reveals it).
- SHOCK / curiosity-loaded: a vivid, specific, slightly raw real-life pain or a "is there really a
  way to…?" question — strong enough that a COLD paid-ads viewer is curious about the ANSWER.
- Must give the reply real FUEL: it sets up the exact problem the body will then solve (smooth bridge).
- ONE line, ≤ ~18 words, spoken-casual. 0-1 emoji MAX (like a real comment), never more.
- NO price, NO medical/anatomical clinical terms, NO @handle, NO hashtags, NO quotes.` +
(avoid.length ? `\n- DIFFERENT from these already-shown comments (new angle/pain): ${avoid.map((c) => `"${c}"`).join(' · ')}` : '') + `

OUTPUT: the comment text ONLY — one line, nothing else.`

  const prompt =
`PRODUCT (context — do NOT name it in the comment): "${(productName ?? '').trim() || 'the product'}"
BRIEF:
${productPitch}

Write ONE scroll-stopping ${langName} viewer comment now.`

  try {
    const raw = await directGeminiText({
      apiKey, systemInstruction, prompt,
      maxOutputTokens: 256, temperature: 0.9, thinkingBudget: 0,   // 0.9 — lively + varied per spec
    })
    // Model may return multiple lines / a stray label — take the first non-empty content line.
    const line = raw.split('\n').map(stripWrap).find((l) => l.length > 0) ?? ''
    return line
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[replyCommentForVideo] lỗi — để caller fallback:', e)
    return ''
  }
}

// ── VN gloss of the on-screen comment (P5b) ──────────────────────────────────
// A short, spirit-translation of the comment into Vietnamese so a VN user understands an MS/EN
// comment in the editor. DISPLAY-ONLY — never burned on the video (the card shows the original).
// Cached by source text; '' on any failure.
const glossCache = new Map<string, string>()
export async function glossReplyCommentToVietnamese(comment: string, apiKey: string): Promise<string> {
  const src = (comment ?? '').trim()
  if (!src || !apiKey) return ''
  const hit = glossCache.get(src)
  if (hit !== undefined) return hit
  try {
    const out = await directGeminiText({
      apiKey,
      systemInstruction:
        'Dịch câu comment mạng xã hội sau sang tiếng Việt ĐỜI THƯỜNG, ĐÚNG TINH THẦN (giữ giọng + cảm xúc, ' +
        'KHÔNG dịch word-by-word). CHỈ xuất bản dịch tiếng Việt, không thêm gì.',
      prompt: src,
      maxOutputTokens: 120, temperature: 0.3, thinkingBudget: 0,
    })
    const cleaned = (out ?? '').split('\n').map((l) => l.trim()).find((l) => l.length > 0)?.slice(0, 180) ?? ''
    glossCache.set(src, cleaned)
    return cleaned
  } catch { return '' }
}

// ── Dev helper — test from the console (Phase 1 sanity), FREE of UI ──────────
//   __testReplyComment("Vitamin B Complex", "Pain points: mệt mỏi, mất tập trung…", "ms")
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testReplyComment = async (
    productName: string, productPitch: string, lang: ScriptLang = 'vi',
  ) => {
    const mod = await import('../../../../stores/settingsStore')
    const apiKey = mod.useSettingsStore.getState().geminiApiKey
    if (!apiKey) { console.error('[REPLY_CMT_TEST] thiếu Gemini key trong Settings'); return }
    const prev: string[] = []
    for (let i = 0; i < 5; i++) {
      const c = await replyCommentForVideo({ apiKey, productName, productPitch, lang, previous: prev })
      console.log(`[REPLY_CMT_TEST] #${i + 1}:`, c)
      if (c) prev.push(c)
    }
  }
}
