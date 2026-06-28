// ── Phase B fix — per-shot source resolving helpers ──────────────────────────
// Mirrors the Research SourceFinder gold standard so the Script Architect's
// per-shot picker behaves the same way:
//   • viToZhTerms    — operator types a Vietnamese keyword → SHORT Chinese search
//                      terms (NOT a literal sentence translation). The source
//                      platforms (Douyin/RED/Kuaishou) are Chinese, so the query
//                      MUST be Chinese — this is the mandatory VN→ZH bridge.
//   • productImageDataUrl — resolve a product's first image (asset ref or URL) to
//                      a data URL usable as the 1688 reverse-image input.
//   • toResizedBase64 — canvas-shrink an image to a small JPEG so 1688 doesn't 400
//                      on a large payload (same 800px/0.72 as SourceFinder).
//   • searchProduct1688 — POST the image to /api/rapid-1688?action=search → the
//                      matched products (operator picks the correct one to LOCK).
//   • fetch1688Media — action=detail → the seller's own videos/images (the most
//                      exact footage of THE product).
import type { Product } from '../../../stores/types'
import type { ProductLock1688 } from '../types'
import { isAssetRef, getAsBase64 } from '../../../utils/assetStore'
import { directGeminiText } from '../../../utils/gemini'

// ── VN → ZH short search terms ───────────────────────────────────────────────
const VI_TO_ZH_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: { terms: { type: 'array', items: { type: 'string' } } },
  required: ['terms'],
}

const VI_TO_ZH_SYSTEM = `You convert a Vietnamese footage idea into SHORT Simplified-Chinese (简体中文) SEARCH KEYWORDS for Douyin / RED (小红书) / Kuaishou.
RULES:
- Output 1-3 SHORT keywords (each 2-4 Chinese characters). NEVER a whole sentence.
- Do NOT translate the sentence literally. REASON about the underlying symptom / situation / object a real person would type to find that footage.
- Examples of the THINKING (apply to any niche):
    "tai bị ngứa, đau" → ["耳朵痒","耳朵痛"]
    "đau đầu gối, khó đi lại" → ["膝盖痛","走路困难"]
    "răng bị cao răng, sâu răng" → ["牙结石","蛀牙"]
    "bụng đầy hơi khó tiêu" → ["肚子胀气","消化不良"]
    "vitamin E" → ["维生素E"]
- Never include a brand name or a Malay/English word. Chinese only.
Return JSON: {"terms": ["…","…"]}.`

/** Detect Han characters — if the operator already typed Chinese, use it verbatim. */
export function hasHan(s: string): boolean {
  return /[一-鿿]/.test(s)
}

/** Vietnamese keyword → 1-3 SHORT Chinese search terms. If the input already
 *  contains Han characters, it's returned as-is (no round-trip). */
export async function viToZhTerms(viText: string, apiKey: string): Promise<string[]> {
  const text = (viText || '').trim()
  if (!text) return []
  if (hasHan(text)) return [text]
  const raw = await directGeminiText({
    apiKey,
    prompt: `Vietnamese footage idea: "${text}"`,
    systemInstruction: VI_TO_ZH_SYSTEM,
    responseMimeType: 'application/json',
    responseSchema: VI_TO_ZH_SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 256,
    temperature: 0.5,
  })
  let parsed: { terms?: unknown }
  try { parsed = JSON.parse(raw) as { terms?: unknown } }
  catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return []
    parsed = JSON.parse(m[0]) as { terms?: unknown }
  }
  const arr = Array.isArray(parsed.terms) ? parsed.terms : []
  const out: string[] = []
  for (const it of arr) {
    const t = typeof it === 'string' ? it.trim() : ''
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= 3) break
  }
  return out
}

// ── Source terms → SHORT EN/Malay terms (cho tab TikTok) ─────────────────────
// TikTok thị trường MY/global tìm bằng tiếng Anh/Malay — KHÔNG dùng từ khóa tiếng
// Trung như Douyin/RED/Kuaishou. Nhận đầu vào là bộ từ khóa nguồn (thường là zhTerms
// tiếng Trung, hoặc dòng tiếng Việt) → suy luận ra 1-3 từ khóa ngắn EN/Malay.
const TO_MS_SYSTEM = `You convert footage SEARCH KEYWORDS into SHORT English-or-Malay (Bahasa Malaysia) keywords for searching TikTok (audience = Malaysia / global).
RULES:
- Output 1-3 SHORT keywords (1-3 words each). NEVER a whole sentence.
- Input may be Chinese, Vietnamese or English — REASON about the underlying symptom / situation / object a real person in Malaysia would type on TikTok to find that footage. Do NOT translate literally.
- Prefer common English search words; use Malay when it is the more natural search term. Mixing is fine — pick what surfaces the most footage.
- Examples of the THINKING (apply to any niche):
    ["耳朵痒","耳朵痛"] → ["itchy ear","ear pain"]
    ["膝盖痛","走路困难"] → ["knee pain","sakit lutut"]
    ["肚子胀气","消化不良"] → ["bloating","perut buncit"]
    ["牙结石"] → ["tartar teeth"]
    ["维生素E"] → ["vitamin E"]
- NO Chinese characters in the output. No brand names.
Return JSON: {"terms": ["…","…"]}.`

/** Bộ từ khóa nguồn (Hoa/Việt) → 1-3 từ khóa ngắn EN/Malay cho TikTok. */
export async function toMsTerms(sourceTerms: string[], apiKey: string): Promise<string[]> {
  const src = sourceTerms.map((t) => (t || '').trim()).filter(Boolean)
  if (!src.length) return []
  const raw = await directGeminiText({
    apiKey,
    prompt: `Footage search keywords: ${src.map((t) => `"${t}"`).join(', ')}`,
    systemInstruction: TO_MS_SYSTEM,
    responseMimeType: 'application/json',
    responseSchema: VI_TO_ZH_SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 256,
    temperature: 0.5,
  })
  let parsed: { terms?: unknown }
  try { parsed = JSON.parse(raw) as { terms?: unknown } }
  catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return []
    parsed = JSON.parse(m[0]) as { terms?: unknown }
  }
  const arr = Array.isArray(parsed.terms) ? parsed.terms : []
  const out: string[] = []
  for (const it of arr) {
    const t = typeof it === 'string' ? it.trim() : ''
    if (t && !hasHan(t) && !out.includes(t)) out.push(t)
    if (out.length >= 3) break
  }
  return out
}

// ── Product image → data URL ─────────────────────────────────────────────────
/** Resolve a product's first image to a usable src: asset refs become a data URL
 *  via the asset store; plain URLs pass through. Empty string if none. */
export async function productImageDataUrl(product: Product | null): Promise<string> {
  const raw = product?.productImages?.[0] || ''
  if (!raw) return ''
  if (isAssetRef(raw)) {
    const a = await getAsBase64(raw)
    return a ? `data:${a.mimeType};base64,${a.base64}` : ''
  }
  return raw
}

/** Canvas-shrink an image to a small JPEG data URL (default 800px / q0.72) so the
 *  1688 endpoint doesn't reject a large payload. Same params as SourceFinder. */
export function toResizedBase64(src: string, max = 800, q = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let w = img.naturalWidth || img.width
      let h = img.naturalHeight || img.height
      const scale = Math.min(1, max / Math.max(w, h))
      w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) { reject(new Error('no canvas ctx')); return }
      ctx.drawImage(img, 0, 0, w, h)
      try { resolve(c.toDataURL('image/jpeg', q)) } catch (e) { reject(e as Error) }
    }
    img.onerror = () => reject(new Error('load image failed'))
    img.src = src
  })
}

// ── 1688 reverse-image search → lockable matches ─────────────────────────────
interface Rapid1688Product {
  itemId?: string
  title?: string
  titleVi?: string
  image?: string
}

/** Reverse-image search a product image on 1688. Returns the matched products as
 *  lock candidates — the operator picks the correct one to LOCK as productZh, so
 *  every product shot then searches by the REAL Chinese title (not a guess). */
export async function searchProduct1688(imageDataUrl: string): Promise<ProductLock1688[]> {
  if (!imageDataUrl) throw new Error('Cần ảnh sản phẩm để khớp hình trên 1688.')
  let body: { base64?: string; imageUrl?: string }
  try { body = { base64: await toResizedBase64(imageDataUrl, 800, 0.72) } }
  catch { body = imageDataUrl.startsWith('data:') ? { base64: imageDataUrl } : { imageUrl: imageDataUrl } }

  const d = await fetch('/api/rapid-1688?action=search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json())

  if (d.error) throw new Error(d.error + (d.detail ? ` — ${String(d.detail).slice(0, 120)}` : ''))
  const list: Rapid1688Product[] = Array.isArray(d.products) ? d.products : []
  return list
    .filter((p) => p.itemId && p.title)
    .map((p): ProductLock1688 => ({
      itemId: String(p.itemId),
      name: String(p.title),
      nameVi: p.titleVi ? String(p.titleVi) : undefined,
      image: p.image ? String(p.image) : undefined,
    }))
}

// ── 1688 detail → seller's own media (most exact product footage) ────────────
export interface Media1688 { videos: string[]; images: string[]; shop: string; title: string }

/** Fetch the seller's original videos/images for a locked 1688 item — the most
 *  exact footage of THE product (central to fixing the product-shot drift). */
export async function fetch1688Media(itemId: string): Promise<Media1688> {
  const d = await fetch(`/api/rapid-1688?action=detail&itemId=${encodeURIComponent(itemId)}`).then((r) => r.json())
  return {
    videos: Array.isArray(d.videos) ? d.videos : [],
    images: Array.isArray(d.images) ? d.images : [],
    shop: typeof d.shop === 'string' ? d.shop : '',
    title: typeof d.title === 'string' ? d.title : '',
  }
}
