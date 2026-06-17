// ── B-roll Studio (Mode 2) — single-scene renderer (P6, Phase 0) ─────────────
// Renders ONE standalone B-roll clip from a concept prompt + the product image.
// Phase 0 wires the CORE i2v path (the default + the anti-drift chain the user chose):
//   product-present → gpt-4o-image FAITHFUL first-frame (keeps the product EXACT) →
//   Seedance 1.5 Pro image-to-video animates it.
// Reuses the existing KIE helpers (same as mode-1 insertRenderer) — no new render tech.
// Talking-head (InfiniteTalk) + Veo premium paths land in a later phase (credit for them
// already computed by estimateSceneCredit). Dev helper __testStudioScene tests via console.
// ─────────────────────────────────────────────────────────────────────────────

import { generateGpt4oImageFast, generateVideoJob, pollVideoJobUntilDone } from '../../../../utils/kieai'
import { STUDIO_MODELS, type StudioResolution } from './brollStudioModels'

// ── Synthetic creator (Mode 2 freedom) ──────────────────────────────────────
// Spirit of the studio: the user is NEVER forced to pick an avatar. When a scene
// SHOWS A PERSON (product used on the body / a human beat) but no avatar was
// chosen, the app auto-builds ONE consistent creator portrait and reuses it across
// EVERY person scene — so identity stays the same (no random stranger per cut) and
// an on-body shot never renders a head-less deformed torso. Product-only scenes
// (3D / macro close-up / ingredient) stay person-free — they never call this.
// Cached by product+lang+gender so it's generated ONCE (~6cr) then free to reuse.
const _syntheticCreatorCache = new Map<string, Promise<string>>()
const LOCALE_PORTRAIT: Record<string, string> = {
  vi: 'a Vietnamese',
  ms: 'a Malaysian (cast Malay / Chinese / Indian naturally)',
  en: 'a',
}

/** Infer ONE creator gender from the product so the synthetic creator is consistent
 *  across the whole video. Heuristic (no extra call): men's / tools / auto / gym →
 *  male; everything else defaults female (the dominant UGC-creator gender). VN+MY+EN. */
export function inferCreatorGender(productName?: string, visualBrief?: string): 'female' | 'male' {
  const t = `${productName ?? ''} ${visualBrief ?? ''}`.toLowerCase()
  if (/\b(men'?s|male|gym|barber|shav(e|ing)|beard|drill|tools?|tyre|tire|car|auto|engine|lelaki|jantan|alat|kereta|bor)\b/.test(t)
    || /đàn ông|nam gi[ơo]i|c[ạa]o r[âa]u|r[âa]u|máy khoan|máy bơm|ô ?tô|xe máy|d[uụ]ng c[uụ]/.test(t)) {
    return 'male'
  }
  return 'female'
}

/** Get (or generate once + cache) a consistent synthetic creator portrait URL.
 *  Reused as the avatar reference for every person scene of this product so the
 *  same face appears throughout. On failure the cache entry is dropped so a later
 *  scene can retry. Returns a remote KIE image URL. */
export function getSyntheticCreatorUrl(args: {
  kieApiKey: string; productKey: string; lang: 'vi' | 'ms' | 'en'; gender: 'female' | 'male'
}): Promise<string> {
  const key = `${args.productKey}|${args.lang}|${args.gender}`
  const hit = _syntheticCreatorCache.get(key)
  if (hit) return hit
  const locale = LOCALE_PORTRAIT[args.lang] ?? 'a'
  const who = args.gender === 'male' ? 'a man' : 'a woman'
  const p = generateGpt4oImageFast({
    apiKey: args.kieApiKey,
    prompt: `A photorealistic vertical portrait of ${who}, ${locale} everyday UGC TikTok creator in their early 30s, warm friendly natural expression, plain home background, soft natural daylight, authentic phone-shot look, upper body facing camera. No text, no logos, no product in frame.`,
    size: '2:3',
    softTimeoutMs: 100_000,
    attemptTimeoutMs: 150_000,
    maxAttempts: 3,
  })
  _syntheticCreatorCache.set(key, p)
  p.catch(() => _syntheticCreatorCache.delete(key))
  return p
}

export interface RenderStudioSceneParams {
  kieApiKey: string
  /** The i2v concept prompt (English) — what to animate. */
  conceptPromptEn: string
  /** Scene role (from resolveSceneSpec). 'lips' → InfiniteTalk; else → Seedance. */
  role?: 'broll' | 'lips' | 'mechanism3d' | 'social_proof'
  /** Product image URLs (refs) — used for the faithful first-frame + i2v grounding. */
  productImageUrls?: string[]
  /** Chosen avatar image URL (creator scenes / lips) — locks the SAME person. */
  avatarImageUrl?: string
  /** Resolved TTS audio URL — REQUIRED for lips (InfiniteTalk). */
  audioUrl?: string
  /** Product/avatar-present scene → gpt-4o-image faithful frame first (anti-drift). */
  withFaithfulFrame: boolean
  resolution: StudioResolution
  durationSec: number
  onStage?: (stage: string) => void
}

/** Render one studio scene → returns the remote video URL (caller saves it as an asset). */
export async function renderStudioScene(params: RenderStudioSceneParams): Promise<string> {
  const role = params.role ?? 'broll'
  // Refs that lock identity/product into the faithful first-frame (avatar first so the
  // creator's face is preserved, then the product so packaging stays exact).
  const refs = [params.avatarImageUrl, ...(params.productImageUrls ?? [])].filter(Boolean) as string[]
  let startFrameUrl: string | undefined

  // Anti-drift: build a faithful still first (gpt-4o-image keeps the product AND the chosen
  // person EXACT), then animate THAT — so the model only adds motion, never re-invents them.
  // Lips always needs a still (the talking-head image), so force a frame when refs exist.
  const wantFrame = (params.withFaithfulFrame || role === 'lips') && refs.length > 0
  if (wantFrame) {
    params.onStage?.('Tạo khung hình chuẩn (gpt-4o)…')
    const hasProductRef = !!params.productImageUrls?.length
    const lock = params.avatarImageUrl
      ? `Keep the SAME person as the avatar reference (same face, hair, identity).${hasProductRef ? ' AND, if shown, the SAME product as the product reference (same colour, shape, label).' : ' Do NOT add any product or packaging into the frame.'}`
      : hasProductRef
        ? 'The product must look EXACTLY like the reference (same colour, shape, label).'
        : 'Do NOT add any product or packaging into the frame.'
    startFrameUrl = await generateGpt4oImageFast({
      apiKey: params.kieApiKey,
      prompt: `${params.conceptPromptEn} — ONE clean still frame, vertical 9:16. ${lock} Do NOT redesign anything. No text overlays.`,
      filesUrl: refs.slice(0, 4),
      size: '2:3',
      softTimeoutMs: 100_000,
      attemptTimeoutMs: 150_000,
      maxAttempts: 3,
    })
  }

  // ── Talking-head (avatar + voice) → InfiniteTalk lipsync ────────────────────
  if (role === 'lips') {
    if (!params.audioUrl) throw new Error('Cảnh lipsync thiếu audio (TTS) — bật giọng + điền câu thoại.')
    params.onStage?.('Render lipsync (InfiniteTalk)…')
    const { taskId } = await generateVideoJob({
      apiKey: params.kieApiKey,
      jobModelId: STUDIO_MODELS.infinitalk.jobModelId,
      prompt: params.conceptPromptEn,
      aspectRatio: '9:16',
      resolution: params.resolution,
      duration: params.durationSec,
      startFrameUrl: startFrameUrl ?? params.avatarImageUrl,   // → input.image_url
      audioUrl: params.audioUrl,                               // → input.audio_url
    })
    return await pollVideoJobUntilDone({ apiKey: params.kieApiKey, taskId, logTag: 'STUDIO-LIPS' })
  }

  // ── B-roll / 3D mechanism → Seedance i2v ────────────────────────────────────
  params.onStage?.('Render cảnh (Seedance i2v)…')
  const { taskId } = await generateVideoJob({
    apiKey: params.kieApiKey,
    jobModelId: STUDIO_MODELS.seedance.jobModelId,
    prompt: params.conceptPromptEn,
    aspectRatio: '9:16',
    resolution: params.resolution,
    duration: params.durationSec,
    // i2v: animate the faithful frame if we made one; else seed from the first ref (if any).
    startFrameUrl,
    referenceImageUrls: startFrameUrl ? undefined : (refs.length ? refs.slice(0, 1) : undefined),
  })
  return await pollVideoJobUntilDone({ apiKey: params.kieApiKey, taskId, logTag: 'STUDIO' })
}

// ── Dev helper — test ONE scene from the console, FREE of UI (Phase 0 sanity) ──
//   __testStudioScene("hands strapping a knee brace, velcro pull, home setting", 6, '720p', '<productImageUrl>')
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__testStudioScene = async (
    conceptPromptEn: string, durationSec = 6, resolution: StudioResolution = '720p', productImageUrl?: string,
  ) => {
    const mod = await import('../../../../stores/settingsStore')
    const kieApiKey = mod.useSettingsStore.getState().kieApiKey
    if (!kieApiKey) { console.error('[STUDIO_TEST] thiếu KIE key trong Settings'); return }
    console.log('[STUDIO_TEST] render…', { conceptPromptEn, durationSec, resolution, withFrame: !!productImageUrl })
    const url = await renderStudioScene({
      kieApiKey,
      conceptPromptEn,
      productImageUrls: productImageUrl ? [productImageUrl] : undefined,
      withFaithfulFrame: !!productImageUrl,
      resolution,
      durationSec,
      onStage: (s) => console.log('[STUDIO_TEST]', s),
    })
    console.log('[STUDIO_TEST] xong:', url)
    window.open(url, '_blank')
    return url
  }
}
