// ── Product Visual Brief (P4i) ───────────────────────────────────────────────
// Universal "give the director EYES" pass. The b-roll director plans from TEXT
// only (directGeminiText is text-only) — it never sees the product images, so it
// can't picture the real FORM / hero parts / size / how it's worn, and ends up
// planning bland or physically-wrong shots. This runs ONCE per product (cached on
// product.visualBrief): send the up-to-4 product photos to Gemini vision → a
// STRUCTURED, product-AGNOSTIC brief (formFactor / heroComponents / howUsed /
// sizeCue / colors / settings / shotIdeas). The brief is plain text appended into
// buildProductContextBlock, so the director (+ backfill + render suggester) all
// read it. NO niche hardcode — Gemini fills the SAME generic schema differently
// for a knee brace, a seasoning, a serum, a power bank… Graceful: any failure
// returns null and callers keep the existing text-only context (no regression).

import { directGeminiVision } from '../../../../utils/gemini'
import { getAsBase64, isAssetRef } from '../../../../utils/assetStore'
import type { Product } from '../../../../stores/types'

const VISION_SCHEMA = {
  type: 'object',
  properties: {
    formFactor:       { type: 'string' },
    heroComponents:   { type: 'array', items: { type: 'string' } },
    howUsed:          { type: 'string' },
    correctUsage:     { type: 'string' },
    sizeCue:          { type: 'string' },
    colors:           { type: 'array', items: { type: 'string' } },
    settings:         { type: 'array', items: { type: 'string' } },
    shotIdeas:        { type: 'array', items: { type: 'string' } },
  },
  required: ['formFactor', 'howUsed', 'shotIdeas'],
}

interface VisionBrief {
  formFactor?: string
  heroComponents?: string[]
  howUsed?: string
  correctUsage?: string
  sizeCue?: string
  colors?: string[]
  settings?: string[]
  shotIdeas?: string[]
}

// An image ref may be an asset-store id OR a raw data URL — handle both.
async function imgToInline(ref: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    if (isAssetRef(ref)) {
      const r = await getAsBase64(ref)
      return r ? { inlineData: { mimeType: r.mimeType, data: r.base64 } } : null
    }
    const m = ref.match(/^data:([^;]+);base64,(.+)$/)
    if (m) return { inlineData: { mimeType: m[1], data: m[2] } }
    return null
  } catch { return null }
}

/** Compute the universal visual brief from a product's photos. Returns a plain-
 *  text block to append into the product context, or null if it can't (no usable
 *  images / vision failed). Cache the result on product.visualBrief — call ONCE
 *  per product (the first time the director runs for it). */
export async function generateProductVisualBrief(
  product: Product | null | undefined, apiKey: string,
): Promise<string | null> {
  if (!product || !apiKey) return null
  const refs = (product.productImages?.length ? product.productImages : (product.productImage ? [product.productImage] : []))
    .filter((s) => !!s && s.trim() !== '')
    .slice(0, 4)
  if (refs.length === 0) return null
  const images = (await Promise.all(refs.map(imgToInline)))
    .filter(Boolean) as Array<{ inlineData: { mimeType: string; data: string } }>
  if (images.length === 0) return null

  const systemInstruction =
`You are a product analyst for a UGC ad video team. You are shown the real PHOTOS of
ONE product (multiple angles / packaging / in-use shots). Describe ONLY what you can
actually SEE — never guess a category. Your description lets a video director picture
the product and stage diverse, physically-correct shots.

Fill this JSON (all values in English, concise):
- formFactor: what the product physically IS + its overall shape, in one phrase.
- heroComponents: the visually distinctive PARTS worth filming (a mechanism, a
  texture, a closure, a nozzle, a hinge, a strap…). What the eye is drawn to.
- howUsed: how a person physically uses / wears / applies it, inferred from the shape
  and any in-use photo — concrete (wrap on the knee / sprinkle on food / drip on skin).
- correctUsage: the CORRECT ORIENTATION / placement for proper use, ONLY if the product
  has a right-vs-wrong way to wear/place/hold it (a brace, mask, strap, insole, device…).
  State exactly which part faces/sits where, what lines up with what — e.g. "the spring
  hinge sits on the SIDE of the knee joint with the kneecap exposed through the front
  opening; NEVER worn with the hinge over the front of the kneecap". Empty if orientation
  doesn't matter (e.g. a seasoning, a drink).
- sizeCue: a real-world size reference (fits in a palm / knee-sized / phone-sized…).
- colors: the visible color variants.
- settings: 3-6 real places this product is naturally used or shown.
- shotIdeas: 6-8 DISTINCT, filmable camera moments THIS exact product affords — each
  a varied angle + action (macro of <hero part> doing X, hands <using> it, a person in
  a <real moment> with it, top-down of the variants…). These are an ANGLE PALETTE for
  variety; each MUST be grounded in what you SEE, never a generic "product on a table".

UNIVERSAL: this works for ANY product — read THESE photos, never assume a niche.`

  const parts = [
    ...images,
    { text: `Product name (context only — trust the PHOTOS over the name): ${product.productName || '(unknown)'}\nReturn the JSON now.` },
  ]
  try {
    const raw = await directGeminiVision({
      apiKey,
      parts,
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: VISION_SCHEMA,
      maxOutputTokens: 1024,
      thinkingBudget: 0,
    })
    const brief = JSON.parse(raw) as VisionBrief
    return formatBrief(brief)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[VISION_BRIEF] lỗi (giữ text-only):', e)
    return null
  }
}

function formatBrief(b: VisionBrief): string | null {
  const lines: string[] = []
  if (b.formFactor) lines.push(`- Form factor (from photos): ${b.formFactor}`)
  if (b.heroComponents?.length) lines.push(`- Hero parts to film: ${b.heroComponents.join('; ')}`)
  if (b.howUsed) lines.push(`- How it is physically used (from photos): ${b.howUsed}`)
  if (b.correctUsage) lines.push(`- ⚠ CORRECT ORIENTATION (MUST follow in every wear/placement shot — getting this wrong shows the product used backwards): ${b.correctUsage}`)
  if (b.sizeCue) lines.push(`- Real-world size: ${b.sizeCue}`)
  if (b.colors?.length) lines.push(`- Color variants: ${b.colors.join(', ')}`)
  if (b.settings?.length) lines.push(`- Natural settings: ${b.settings.join(', ')}`)
  if (lines.length === 0 && !b.shotIdeas?.length) return null
  let out = `\n\nVISUAL BRIEF (the team LOOKED at the product photos — trust this for FORM, SIZE, parts, and how it is used):\n${lines.join('\n')}`
  if (b.shotIdeas?.length) {
    out += `\n- SHOT-IDEA PALETTE (grounded in the real photos — draw on these for VARIETY of angle/action; adapt, do not copy verbatim):\n`
      + b.shotIdeas.map((s) => `    · ${s}`).join('\n')
  }
  return `${out}\n`
}
