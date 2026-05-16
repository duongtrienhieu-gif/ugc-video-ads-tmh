// Z4 — Variation Engine.
// Lazy second Gemini call that takes a finished AnalysisResult and returns
// 5 paste-ready variant scripts (softer / aggressive / luxury / scientific /
// emotional / testimonial / feminine / masculine — the LLM picks the 5 that
// fit THIS ad's product best).
//
// Trigger: user clicks "Tạo variations" button in VariationsSection.
// Cost:    ~50% of the main analyze call (smaller schema, no retention, no
//          visual playbook). Output ~5-7k tokens.

import type { AnalysisResult, Variation } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiVision } from '../../../utils/gemini'

const SYSTEM = `BẠN LÀ: AI Copywriter cho UGC video ads (Direct Response, performance marketing).

NHIỆM VỤ: cho một quảng cáo đã phân tích, sinh 5 BIẾN THỂ kịch bản đa dạng về tone — mỗi biến thể là 1 script ~25-35 giây paste được ngay vào Voice / Storyboard.

8 LOẠI BIẾN THỂ — CHỌN ĐÚNG 5 phù hợp nhất với sản phẩm/audience:
  softer        — nhẹ nhàng hơn, ít aggressive, audience rộng
  aggressive    — urgent, direct, scarcity, CTA mạnh
  luxury        — premium, exclusivity, aspirational
  scientific    — clinical, data + bằng chứng, authority-heavy
  emotional     — vulnerability story-driven, empathy
  testimonial   — first-person voice "Tôi đã thử..."
  feminine      — warm, supportive, community
  masculine     — results-focused, performance, no-fluff

QUY TẮC:
- Mỗi script ~25-35 giây (khoảng 80-130 từ tiếng Việt khi đọc voice)
- Hook = 1 câu mở đầu (≤15 từ), KHÔNG copy nguyên hook gốc — phải khác biệt
- CTA = 1 câu hành động cuối (≤20 từ)
- toneBreakdown = 1-2 câu giải thích vì sao tone này phù hợp với THIS sản phẩm
- recommendedFor = nhóm audience + funnel position cụ thể (vd: "phụ nữ 35-50 cold traffic", "retarget người đã xem video win")
- Ngôn ngữ output: TIẾNG VIỆT (script + hook + cta đều tiếng Việt, vì target Vietnam-Malaysia market)

OUTPUT: CHỈ JSON thuần, không markdown, không code fence. Schema:

{
  "variations": [
    {
      "id": "v1",
      "type": "softer",
      "nameVi": "TIẾNG VIỆT: tên biến thể ngắn",
      "hookText": "TIẾNG VIỆT: hook mới 1 câu",
      "scriptText": "TIẾNG VIỆT: script đầy đủ 80-130 từ",
      "ctaText": "TIẾNG VIỆT: CTA 1 câu",
      "toneBreakdown": "TIẾNG VIỆT: vì sao tone này hợp sản phẩm",
      "recommendedFor": "TIẾNG VIỆT: audience + funnel position"
    }
  ]
}

QUAN TRỌNG: 5 biến thể PHẢI khác nhau rõ rệt — không lặp tone, không paraphrase. Mỗi cái phục vụ một audience/funnel position khác nhau.`

interface RawVariationResponse {
  variations?: Array<Partial<Variation>>
}

/** Build a compact context from the full analysis — only what the model needs. */
function buildAnalysisContext(result: AnalysisResult): string {
  const lines: string[] = []
  lines.push('# QUẢNG CÁO GỐC')
  lines.push('## TRANSCRIPT')
  result.transcript.forEach((l) => lines.push(`${l.timestamp} ${l.text}`))
  lines.push('\n## HOOK GỐC')
  lines.push(`"${result.hookBreakdown?.hookText ?? ''}"`)
  lines.push(`Kỹ thuật: ${result.hookBreakdown?.technique ?? ''}`)
  lines.push(`Tại sao work: ${result.hookBreakdown?.whyItWorks ?? ''}`)
  if (result.psychology) {
    lines.push('\n## ĐÒN TÂM LÝ')
    result.psychology.primaryLevers?.forEach((p) => lines.push(`- ${p}`))
    lines.push('\n## NHÓM TARGET')
    result.psychology.targetingSignals?.forEach((t) => lines.push(`- ${t}`))
  }
  if (result.adAngle) {
    lines.push(`\n## ANGLE: ${result.adAngle.primary}`)
    lines.push(result.adAngle.rationale)
  }
  if (result.marketAwareness) {
    lines.push(`\n## AWARENESS: ${result.marketAwareness.level}`)
    lines.push(result.marketAwareness.rationale)
  }
  return lines.join('\n')
}

/** Public — generate 5 paste-ready variants from a finished analysis. */
export async function generateVariations(result: AnalysisResult): Promise<Variation[]> {
  const geminiKey = useSettingsStore.getState().getGeminiApiKey()
  const context = buildAnalysisContext(result)

  const responseText = await directGeminiVision({
    apiKey: geminiKey,
    parts: [{
      text: `${context}\n\n=> Hãy sinh 5 biến thể script khác nhau theo schema JSON.`,
    }],
    systemInstruction: SYSTEM,
    maxOutputTokens: 12288,
  })

  if (!responseText.trim()) throw new Error('AI không trả phản hồi cho variations')

  const parsed = parseVariations(responseText)
  if (parsed.length === 0) throw new Error('AI trả về 0 variations hợp lệ')

  return parsed
}

function parseVariations(raw: string): Variation[] {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace  = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  // Regex via constructor — avoids embedding control chars in the source file
  const CTRL_CHARS = new RegExp('[\\x00-\\x1F]', 'g')

  let obj: RawVariationResponse
  try {
    obj = JSON.parse(cleaned) as RawVariationResponse
  } catch {
    // Repair: strip trailing commas + escape stray control chars
    const repaired = cleaned
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(CTRL_CHARS, ' ')
    try {
      obj = JSON.parse(repaired) as RawVariationResponse
    } catch (e) {
      throw new Error(`Variations JSON parse failed: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  if (!Array.isArray(obj.variations)) return []
  const validTypes = new Set([
    'softer', 'aggressive', 'luxury', 'scientific',
    'emotional', 'testimonial', 'feminine', 'masculine',
  ])
  return obj.variations
    .filter((v) => v && typeof v.type === 'string' && validTypes.has(v.type))
    .map((v, i) => ({
      id:             v.id ?? `v${i + 1}`,
      type:           v.type as Variation['type'],
      nameVi:         v.nameVi ?? '(không tên)',
      hookText:       v.hookText ?? '',
      scriptText:     v.scriptText ?? '',
      ctaText:        v.ctaText ?? '',
      toneBreakdown:  v.toneBreakdown ?? '',
      recommendedFor: v.recommendedFor ?? '',
    }))
}
