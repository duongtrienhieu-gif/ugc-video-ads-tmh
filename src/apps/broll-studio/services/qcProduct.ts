// ── Product QC ─────────────────────────────────────────────────────────────
// After a generation finishes, ask Gemini Vision whether the generated photo
// shows the SAME product as the original reference. If not, the caller can
// auto-regenerate. This is the strict-mode safety net that catches the most
// common failure mode: model invents new packaging / different label text.

import { directGeminiVision } from '../../../utils/gemini'

export interface ProductQC {
  labelSimilarity: number     // 0-100
  logoSimilarity: number      // 0-100
  bottleSimilarity: number    // 0-100
  overall: number             // 0-100
  pass: boolean
  issues: string[]
}

// ── Convert any URL (https / data: / blob:) to { base64, mimeType } ───────
async function urlToInlineData(url: string): Promise<{ base64: string; mimeType: string }> {
  // Pull data: URLs apart without a network round-trip
  if (url.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(url)
    if (!match) throw new Error('Invalid data URL')
    return { base64: match[2], mimeType: match[1] }
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${res.status}`)
  const blob = await res.blob()
  const buf = await blob.arrayBuffer()
  const uint8 = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
  return { base64: btoa(binary), mimeType: blob.type || 'image/jpeg' }
}

const SYSTEM_INSTRUCTION = `You are a strict product QC inspector for an e-commerce photography pipeline. You compare a REFERENCE product photo against an AI-GENERATED lifestyle photo and decide whether the same product is shown.

Be harsh. Common failure modes you must catch:
- The label text was rewritten or garbled
- The brand mark / logo was redrawn
- The bottle / jar / tube silhouette changed shape
- The packaging colors shifted
- A different product was substituted entirely

Return STRICT JSON only — no prose, no markdown fences.`

const QC_SCHEMA = {
  type: 'object',
  properties: {
    labelSimilarity:  { type: 'integer', minimum: 0, maximum: 100 },
    logoSimilarity:   { type: 'integer', minimum: 0, maximum: 100 },
    bottleSimilarity: { type: 'integer', minimum: 0, maximum: 100 },
    overall:          { type: 'integer', minimum: 0, maximum: 100 },
    pass:             { type: 'boolean' },
    issues:           { type: 'array', items: { type: 'string' } },
  },
  required: ['labelSimilarity', 'logoSimilarity', 'bottleSimilarity', 'overall', 'pass', 'issues'],
} as const

export async function qcProduct(params: {
  apiKey: string
  productUrl: string
  generatedUrl: string
}): Promise<ProductQC> {
  const [product, generated] = await Promise.all([
    urlToInlineData(params.productUrl),
    urlToInlineData(params.generatedUrl),
  ])

  const text = await directGeminiVision({
    apiKey: params.apiKey,
    systemInstruction: SYSTEM_INSTRUCTION,
    parts: [
      { text: 'IMAGE A — the REFERENCE product:' },
      { inlineData: { mimeType: product.mimeType, data: product.base64 } },
      { text: 'IMAGE B — the AI-GENERATED lifestyle photo (must contain the SAME product):' },
      { inlineData: { mimeType: generated.mimeType, data: generated.base64 } },
      {
        text: `Compare A and B. Score the match strictly:
- labelSimilarity  — does the printed label text & typography match? (0=garbled/different, 100=identical)
- logoSimilarity   — does the brand mark / logo match? (0=redrawn, 100=identical)
- bottleSimilarity — does the bottle/jar/tube shape & color match? (0=different shape, 100=identical)
- overall          — overall confidence this is the SAME product

Set "pass" = true ONLY IF overall >= 70 AND every individual field >= 50.
List concrete issues (max 3, short, in Vietnamese) when pass is false.

Reply with JSON matching the schema. No other text.`,
      },
    ],
    responseMimeType: 'application/json',
    responseSchema: QC_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: 512,
  })

  try {
    const parsed = JSON.parse(text) as ProductQC
    return {
      labelSimilarity:  Math.max(0, Math.min(100, Number(parsed.labelSimilarity)  || 0)),
      logoSimilarity:   Math.max(0, Math.min(100, Number(parsed.logoSimilarity)   || 0)),
      bottleSimilarity: Math.max(0, Math.min(100, Number(parsed.bottleSimilarity) || 0)),
      overall:          Math.max(0, Math.min(100, Number(parsed.overall)          || 0)),
      pass:             Boolean(parsed.pass),
      issues:           Array.isArray(parsed.issues) ? parsed.issues.slice(0, 3).map(String) : [],
    }
  } catch {
    return {
      labelSimilarity: 0,
      logoSimilarity: 0,
      bottleSimilarity: 0,
      overall: 0,
      pass: false,
      issues: ['QC trả về JSON không hợp lệ'],
    }
  }
}
