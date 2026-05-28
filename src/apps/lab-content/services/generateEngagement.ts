import type {
  BaitType, BaitTypeOption, EngagementOutput, EngagementPost, LabBriefResult, PainPoint,
} from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useBankStore } from '../../../stores/bankStore'
import { directGeminiVision } from '../../../utils/gemini'
import { getToneById } from './presets'

// ─────────────────────────────────────────────────────────────────────────
// Engagement Post Generator — posts engineered to EARN COMMENTS.
// Comments are the strongest algo signal on Meta/TikTok (above likes/shares).
// Each post uses a specific bait mechanic to trigger the comment behavior.
// ─────────────────────────────────────────────────────────────────────────

export const BAIT_TYPE_OPTIONS: BaitTypeOption[] = [
  {
    id: 'controversial',
    label: 'Controversial Opinion',
    glyph: '💥',
    hint: 'Quan điểm trái chiều — chia phe',
    briefEn: 'CONTROVERSIAL OPINION post. Take a stance the majority might disagree with, but that the brand can defend. The comment-bait mechanism: people who disagree feel COMPELLED to comment "no, actually..." — and that\'s the win. Format: bold thesis statement (1-2 lines) → 2-3 supporting paragraphs → invite challenge ("Đồng ý hay không? Comment lý do dưới"). Bilingual VI + MY.',
  },
  {
    id: 'this-or-that',
    label: 'This or That Poll',
    glyph: '🆎',
    hint: 'A hay B — chọn 1 phe',
    briefEn: 'THIS-OR-THAT post. Present TWO clear options and force the reader to pick one. Make both options seem reasonable. The mechanism: low-friction comment — just type "A" or "B" — but every comment is a comment. Format: setup (1 line) → A: [option 1] / B: [option 2] → CTA "Comment A hay B?". Bilingual VI + MY.',
  },
  {
    id: 'rate-scale',
    label: 'Rate 1-10',
    glyph: '🌡️',
    hint: 'Đánh giá tình trạng từ 1-10',
    briefEn: 'RATE 1-10 post. Ask the reader to rate something about themselves on a scale of 1-10 (their current pain level, satisfaction, energy, etc.). The mechanism: numbers are easy to type, and self-evaluation invites reflection + comment. Format: question framing the rate → why the number matters → "Comment số của bạn — mình reply hết". Bilingual VI + MY.',
  },
  {
    id: 'open-question',
    label: 'Open Question',
    glyph: '❓',
    hint: 'Hỏi câu mở — KH share kinh nghiệm',
    briefEn: 'OPEN QUESTION post. Ask a genuinely curious, open-ended question that invites the audience to share their experience. NOT a sales question — a community question. Mechanism: people love being asked their opinion. Format: brief context (1-2 lines) → the question → "Mình hóng câu trả lời của các bạn 👀". Bilingual VI + MY.',
  },
  {
    id: 'tag-friend',
    label: 'Tag a Friend',
    glyph: '🏷️',
    hint: 'Tag bạn bè liên quan',
    briefEn: 'TAG-A-FRIEND post. Describe a specific situation/persona that maps to a relatable friend type ("bạn nào hay đau lưng", "đứa bạn nghiện cà phê"...). Mechanism: tagging is a public signal of "this matters to you" + the tagged friend often comments back. Format: vivid persona scene → "Tag đứa bạn của bạn ở đây 👇". Bilingual VI + MY. NOT begging — must feel earned.',
  },
  {
    id: 'fill-blank',
    label: 'Fill in the Blank',
    glyph: '✏️',
    hint: 'Câu chưa hoàn thành — KH điền',
    briefEn: 'FILL-IN-THE-BLANK post. Present a sentence with ONE missing word/phrase. The audience completes it in comments. Mechanism: low cognitive load + creative freedom → many comments. Format: setup (1 line context) → "Hồi ___ tuổi mình từng ___" or "Nếu được quay lại ___" → CTA "Điền vào chỗ trống cho mình với 👇". Bilingual VI + MY.',
  },
  {
    id: 'unpopular-opinion',
    label: 'Unpopular Opinion',
    glyph: '🤔',
    hint: 'Quan điểm ít người nói',
    briefEn: 'UNPOPULAR OPINION post. Take a contrarian-but-defensible stance — softer than "controversial" because it acknowledges "I know this is unpopular but...". Mechanism: signals self-awareness + invites both agreement (rare → emotional reward) and disagreement (debate). Format: "Unpopular opinion: ..." → 2-3 supporting paragraphs → "Bạn nghĩ sao? Mình sai hay đúng?". Bilingual VI + MY.',
  },
  {
    id: 'spot-the',
    label: 'Spot the / Tag the',
    glyph: '🔍',
    hint: 'Nhận diện kiểu người',
    briefEn: 'SPOT-THE post. Describe 3-5 very specific micro-behaviors / habits / situations and ask "Có bạn nào từng làm thế này không?". Mechanism: hyper-specific scenes trigger "ôi đúng tôi" reaction → low-friction comment ("mình nè", "tôi đây"...). Format: numbered list of 3-5 micro-scenes → "Comment số mà bạn từng / hay làm 👇". Bilingual VI + MY.',
  },
]

// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite community manager + paid-media buyer who has built over 100 viral Facebook + TikTok posts in the Vietnamese + Malaysian SEA market. You understand that the strongest algorithm signal is NOT likes or shares — it's COMMENTS.

═══════════════════════════════════════════════════════════════
YOUR JOB — engineer posts that EARN comments
═══════════════════════════════════════════════════════════════
Given a strategic brief (product + pains + tone + goal), generate EXACTLY 12 engagement posts distributed across the 8 bait types listed below. Each post is engineered around a specific mechanic that triggers the comment behavior.

The product is ALWAYS the eventual goal of the warm-up — but these posts are NOT direct sales. They warm the audience + lower CPM for paid ads later. Mention the product only when natural (or not at all on some posts).

═══════════════════════════════════════════════════════════════
THE 8 BAIT MECHANICS — distribute the 12 posts across these
═══════════════════════════════════════════════════════════════
${BAIT_TYPE_OPTIONS.map((b) => `${b.glyph} ${b.label} (id: ${b.id})\n${b.briefEn}`).join('\n\n')}

Distribution rule: cover AT LEAST 6 of the 8 bait types across the 12 posts. Heavy mechanics (controversial / this-or-that / rate-scale) can have 2 posts each.

═══════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════
1. EVERY POST ends with a clear COMMENT INVITATION (not sale, not link, not "DM us") — the CTA = "comment X".
2. Use customer's RAW LANGUAGE from mined pains — NEVER brand-speak.
3. NEVER claim cure / treatment / guaranteed results.
4. Posts should feel like a HUMAN wrote them in 30 seconds — not a corporate post.
5. Mobile-first formatting: 1-3 line paragraphs, blank line breaks, occasional emoji at paragraph starts.
6. Each post 50-150 words VN, same range MY.

═══════════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════════
Vietnamese: native VN voice, mình/bạn register, customer raw vocabulary, Vietnamese punctuation (…).
Malaysian Malay: native colloquial Bahasa Melayu (NOT formal), mix English naturally ("memang struggle", "tau tak"), keep product + ingredient names in English.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — exact markers, nothing else
═══════════════════════════════════════════════════════════════
<<<POST 1>>>
<<<BAIT>>>controversial
<<<SIGNAL>>>[Vietnamese 1-line description of what algo signal this triggers — e.g. "Comment phản biện cao + share quan điểm"]
<<<VI>>>[Vietnamese post 50-150 words]
<<<MY>>>[Malay post 50-150 words]

<<<POST 2>>>
<<<BAIT>>>this-or-that
<<<SIGNAL>>>...
<<<VI>>>...
<<<MY>>>...

[continue through POST 12]`

// ─────────────────────────────────────────────────────────────────────────

function getGeminiKey(): string {
  const s = useSettingsStore.getState()
  if (!s.hasGeminiKey()) {
    throw new Error('Chưa có Google Gemini API key. Vào Cài đặt → Google Gemini → nhập key miễn phí từ aistudio.google.com')
  }
  return s.getGeminiApiKey()
}

function formatPains(pains: PainPoint[]): string {
  return pains
    .map((p, i) => `${i + 1}. [intensity ${p.intensity}/5 · ${p.type}] ${p.textVi}`)
    .join('\n')
}

function buildUserPrompt(brief: LabBriefResult): string {
  const product = useBankStore.getState().getProductById(brief.productId)
  if (!product) throw new Error('Không tìm thấy sản phẩm trong bank')

  const tone = getToneById(brief.toneId)

  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('PRODUCT (for context — these posts warm up the audience, not direct sell)')
  lines.push('═══════════════════════════════════════════════════════════════')
  if (product.productName)        lines.push(`Name: ${product.productName}`)
  if (product.productDescription) lines.push(`Description: ${product.productDescription}`)
  if (product.targetMarket)       lines.push(`Target market: ${product.targetMarket}`)
  if (product.benefits)           lines.push(`Benefits: ${product.benefits}`)

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('MINED PAIN POINTS (the conversation territory)')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(formatPains(brief.painPoints))

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`TONE OF VOICE — ${tone?.label ?? brief.toneId}`)
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(tone?.promptHint ?? '')
  if (brief.toneId === 'custom' && brief.customToneNote?.trim()) {
    lines.push('')
    lines.push('Custom tone note from user:')
    lines.push(brief.customToneNote.trim())
  }

  lines.push('')
  lines.push('Generate EXACTLY 12 engagement posts across at least 6 different bait mechanics. Use EXACT marker format.')

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────
// Marker extraction
// ─────────────────────────────────────────────────────────────────────────

function extractMarkerBlock(text: string, marker: string, nextMarkers: string[]): string {
  const safeMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const startRe = new RegExp(`<<<\\s*${safeMarker}\\s*>>>`, 'i')
  const startMatch = startRe.exec(text)
  if (!startMatch) return ''

  const after = text.slice(startMatch.index + startMatch[0].length)
  let nearest = after.length
  for (const m of nextMarkers) {
    const safeNext = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`<<<\\s*${safeNext}\\s*>>>`, 'i')
    const found = re.exec(after)
    if (found && found.index < nearest) nearest = found.index
  }
  return after.slice(0, nearest).trim()
}

const VALID_BAIT_TYPES: BaitType[] = BAIT_TYPE_OPTIONS.map((b) => b.id)

function parseBaitType(s: string): BaitType {
  const lower = s.trim().toLowerCase()
  const match = VALID_BAIT_TYPES.find((t) => t === lower)
  return match ?? 'open-question'
}

function parsePosts(raw: string): EngagementPost[] {
  const out: EngagementPost[] = []
  const chunkRe = /<<<\s*POST\s+(\d+)\s*>>>/gi
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = chunkRe.exec(raw))) indices.push(m.index)

  if (indices.length === 0) return out

  const nextMarkers = ['BAIT', 'SIGNAL', 'VI', 'MY', 'POST']

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]
    const end = i + 1 < indices.length ? indices[i + 1] : raw.length
    const chunk = raw.slice(start, end)

    const baitRaw = extractMarkerBlock(chunk, 'BAIT',   nextMarkers.filter((m) => m !== 'BAIT'))
    const signal  = extractMarkerBlock(chunk, 'SIGNAL', nextMarkers.filter((m) => m !== 'SIGNAL'))
    const vi      = extractMarkerBlock(chunk, 'VI',     nextMarkers.filter((m) => m !== 'VI'))
    const my      = extractMarkerBlock(chunk, 'MY',     nextMarkers.filter((m) => m !== 'MY'))

    if (vi && my) {
      const baitType = parseBaitType(baitRaw)
      const baitOpt = BAIT_TYPE_OPTIONS.find((b) => b.id === baitType)
      out.push({
        id: crypto.randomUUID(),
        baitType,
        baitLabelVi: baitOpt?.label ?? 'Engagement',
        vietnamese: vi,
        malay: my,
        expectedSignalVi: signal,
      })
    }
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Main export.
// ─────────────────────────────────────────────────────────────────────────

export async function generateEngagement(brief: LabBriefResult): Promise<EngagementOutput> {
  const apiKey = getGeminiKey()
  const userPrompt = buildUserPrompt(brief)

  const raw = await directGeminiVision({
    apiKey,
    parts: [{ text: userPrompt }],
    systemInstruction: SYSTEM_PROMPT,
    // 12 posts × ~100 words × 2 lang + markers
    maxOutputTokens: 14336,
  })

  const posts = parsePosts(raw)
  if (posts.length === 0) {
    throw new Error('Gemini không trả về engagement post hợp lệ — thử lại')
  }

  return {
    posts,
    generatedAt: Date.now(),
  }
}
