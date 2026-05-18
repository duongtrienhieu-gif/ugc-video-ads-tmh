// ─────────────────────────────────────────────────────────────────────
// Product thumbnail generator — single KIE GPT-image-1 call producing a
// small realistic crop of the product on a clean surface. This pixel
// data is what gets injected as the chat product card's thumbnail area.
//
// We ask KIE for a SINGLE focused product shot — no person, no busy
// background — so the result composites cleanly into the small card
// area without competing with the chat UI.
// ─────────────────────────────────────────────────────────────────────

import { submitGpt4oImage, pollGpt4oUntilDone } from '../../../../utils/kieai'
import { saveAsset, isAssetRef } from '../../../../utils/assetStore'

interface GenerateThumbArgs {
  productName: string
  productRefUrls: string[]
  kieApiKey: string
  variationSeed?: string
}

const PROMPT_TEMPLATE = (productName: string, seed: string) =>
  `Generate a small realistic phone-camera snapshot of the EXACT product shown in the reference image(s) — pixel-for-pixel same brand name, label, bottle/jar/sachet shape, cap, colors. The product sits on a casual home surface (kitchen counter, wooden table, marble bathroom shelf). Natural soft daylight. Centered composition with breathing room. NO person, NO hands, NO text overlay, NO branding outside the product, NO box, NO additional bottles. Just the single product on the surface. Look like a customer's casual phone snap — slightly imperfect lighting, real home depth-of-field. PRODUCT: ${productName}. SEED: ${seed}.

ABSOLUTE PRODUCT IDENTITY LOCK: match every detail of the uploaded reference. NEVER invent a different brand, NEVER swap to a similar-looking product. If the reference is unclear, render a clean product still-life with neutral colors instead of hallucinating packaging.`

export async function generateProductThumb(args: GenerateThumbArgs): Promise<string> {
  // Resolve all input refs to absolute URLs (KIE expects URLs)
  const filesUrl: string[] = []
  for (const ref of args.productRefUrls) {
    if (!ref) continue
    if (ref.startsWith('http')) {
      filesUrl.push(ref)
    } else if (isAssetRef(ref)) {
      // Caller should pre-resolve; tolerate as-is and let KIE error if needed.
      continue
    }
  }

  const seed = args.variationSeed ?? Math.random().toString(36).slice(2, 8)
  const prompt = PROMPT_TEMPLATE(args.productName, seed)

  const { taskId } = await submitGpt4oImage({
    apiKey: args.kieApiKey,
    prompt,
    filesUrl: filesUrl.length > 0 ? filesUrl : undefined,
    size: '1:1',
  })

  const remoteUrl = await pollGpt4oUntilDone({
    apiKey: args.kieApiKey,
    taskId,
    timeoutMs: 90_000,
  })

  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`Fetch thumb image failed: ${resp.status}`)
  const blob = await resp.blob()
  if (blob.size < 800) throw new Error('Thumb response too small — possibly corrupt')

  return await saveAsset(blob, blob.type || 'image/png')
}
