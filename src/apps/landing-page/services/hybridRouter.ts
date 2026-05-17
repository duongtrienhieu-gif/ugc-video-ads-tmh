// hybridRouter.ts — Phase 5+6 routing layer.
//
// Sits between generateImages.ts and the rendering execution. When the flag
// ENABLE_HYBRID_RENDER is OFF, every job routes straight to KIE GPT-4o
// (legacy behavior, byte-identical to stable-render-v1). When ON:
//   1. renderPlanner classifies the asset → strategy
//   2. dispatches to KIE / composer / pool / derived as appropriate
//   3. caches reusable_render outputs in productRenderPool
//   4. derived_asset jobs wait for / pull from pool before composing
//
// Failure semantics: if a composer throws or returns unusable output, we
// fall back to legacy AI render so user never sees a broken card.

import type {
  ImagePrompt, LandingPagePack, LandingSection, RenderStrategy,
} from '../types'
import { isHybridRenderEnabled } from '../lib/featureFlags'
import { classifyImagePrompt } from './renderPlanner'
import { getComposer } from './composers'
import {
  getPooledAsset, setPooledAsset, makePoolKey, hashPrompt,
} from './productRenderPool'
import { composeAndStore } from './templateEngine'
import { resolveImageRef } from './templateEngine'

// ── Job shape — duplicated from generateImages.ts to avoid circular import ─

export interface RouterJob {
  sectionIdx: number
  imageIdx: number
  prompt: ImagePrompt
  section: LandingSection
}

export interface RouterContext {
  pack: LandingPagePack
  kieApiKey: string
  /** Updates the matching ImagePrompt in the pack (status/error/asset/etc). */
  onTaskUpdate: (patch: Partial<ImagePrompt>) => void
  /** Caller signal — abort propagates to KIE polling + composer rejection. */
  signal?: AbortSignal
  /** Legacy AI path callback — used when strategy=ai_full_render OR composer
   *  fails / hybrid disabled. Returns { assetRef, retries }. */
  legacyRunner: () => Promise<{ assetRef: string; retries: number }>
}

export interface RouterResult {
  assetRef: string
  retries: number
  /** Which path actually executed — used by metrics chip. */
  strategy: RenderStrategy
  /** True when route returned from pool (saved a KIE call). */
  fromPool?: boolean
}

// ── Main entry point ──────────────────────────────────────────────────────

export async function routeAndExecuteJob(
  job: RouterJob,
  ctx: RouterContext,
): Promise<RouterResult> {
  // ── Hybrid OFF: behave identically to stable-render-v1 ─────────────────
  if (!isHybridRenderEnabled()) {
    const result = await ctx.legacyRunner()
    return { ...result, strategy: 'ai_full_render' }
  }

  // ── Hybrid ON: classify + route ────────────────────────────────────────
  const plan = classifyImagePrompt(job.section, job.prompt, job.imageIdx)
  ctx.onTaskUpdate({
    renderStrategy: plan.strategy,
    renderReason: plan.reason,
    derivedFrom: plan.derivedFrom,
    compositionConfig: plan.compositionConfig,
  })

  try {
    switch (plan.strategy) {
      case 'ai_full_render':
        return await runAi(ctx, plan.strategy)

      case 'reusable_render':
        return await runReusable(job, ctx)

      case 'template_composed':
        return await runComposer(job, ctx, plan.strategy, plan.compositionConfig?.composer)

      case 'derived_asset':
        return await runDerived(job, ctx, plan.derivedFrom, plan.compositionConfig?.composer)
    }
  } catch (err) {
    // ANY composer / pool failure → fall back to AI render. User never sees broken card.
    console.warn(`[hybridRouter] strategy=${plan.strategy} failed → falling back to AI render:`, err)
    return await runAi(ctx, 'ai_full_render')
  }
}

// ── Path implementations ──────────────────────────────────────────────────

async function runAi(ctx: RouterContext, strategy: RenderStrategy): Promise<RouterResult> {
  const r = await ctx.legacyRunner()
  return { ...r, strategy }
}

async function runReusable(job: RouterJob, ctx: RouterContext): Promise<RouterResult> {
  const key = makePoolKey({
    productId: ctx.pack.productId,
    packshotStyle: 'hero',  // for Phase 6 we only pool hero_01 → reuse for promo
    aspect: job.section.imageAspectRatio ?? job.prompt.aspectRatio,
  })
  const promptHash = hashPrompt(job.prompt.prompt)

  // Pool hit?
  const hit = getPooledAsset({ key, expectedHash: promptHash })
  if (hit) {
    return { assetRef: hit.assetRef, retries: 0, strategy: 'reusable_render', fromPool: true }
  }

  // Pool miss → render via AI + cache
  const r = await ctx.legacyRunner()
  setPooledAsset({
    key, assetRef: r.assetRef,
    productId: ctx.pack.productId,
    packshotStyle: 'hero',
    aspect: job.section.imageAspectRatio ?? job.prompt.aspectRatio,
    promptHash,
  })
  return { ...r, strategy: 'reusable_render' }
}

async function runComposer(
  job: RouterJob,
  ctx: RouterContext,
  strategy: RenderStrategy,
  composerId: string | undefined,
): Promise<RouterResult> {
  if (!composerId) throw new Error('No composer id assigned')

  // Look up the right composer for this section. social-screenshot dispatches
  // to a specific composer based on which screenshot we're rendering.
  const resolvedId = resolveComposerForJob(composerId, job)
  const composer = getComposer(resolvedId)
  if (!composer) throw new Error(`No composer registered for id=${resolvedId}`)

  const params = buildComposerParams(resolvedId, job, ctx)
  const aspect = job.section.imageAspectRatio ?? job.prompt.aspectRatio
  const size = sizeForAspect(aspect)

  ctx.onTaskUpdate({ status: 'generating' })
  const assetRef = await composeAndStore(composer, params, {
    format: 'jpeg',
    quality: 0.86,
    pixelRatio: 2,
    width: size.width,
    height: size.height,
  })
  return { assetRef, retries: 0, strategy }
}

async function runDerived(
  job: RouterJob,
  ctx: RouterContext,
  derivedFrom: string | undefined,
  composerId: string | undefined,
): Promise<RouterResult> {
  // Find the upstream asset by filename in the same pack
  const upstreamRef = findUpstreamRef(ctx.pack, derivedFrom)

  // ── Promo banner — derives from hero_01 packshot ──────────────────────
  if (composerId === 'promo-banner') {
    const productRef = upstreamRef ?? (await getProductImageRef(ctx))
    const composer = getComposer('promo-banner')
    if (!composer) throw new Error('Promo composer missing')
    const isFirst = /(_01|finalcta_01)/i.test(job.prompt.filename)
    const isFinal = /finalcta/i.test(job.prompt.filename)
    const params = buildPromoBannerParams(job, ctx, productRef, isFirst, isFinal)
    const size = sizeForAspect(job.section.imageAspectRatio ?? '16:9')
    const assetRef = await composeAndStore(composer, params, {
      format: 'jpeg', quality: 0.86, pixelRatio: 2,
      width: size.width, height: size.height,
    })
    return { assetRef, retries: 0, strategy: 'derived_asset' }
  }

  // ── Before/after collage — derives from ba_01 + ba_02 ─────────────────
  if (composerId === 'before-after-collage') {
    const composer = getComposer('before-after-collage')
    if (!composer) throw new Error('Before/after composer missing')
    const ba1 = findUpstreamRef(ctx.pack, 'ba_01.jpg')
    const ba2 = findUpstreamRef(ctx.pack, 'ba_02.jpg')
    if (!ba1 || !ba2) {
      // Upstream not yet rendered — fall back to AI for THIS collage
      throw new Error('Before/after upstream portraits not ready yet')
    }
    const params = buildBeforeAfterParams(job, ba1, ba2)
    const size = sizeForAspect('4:5')
    const assetRef = await composeAndStore(composer, params, {
      format: 'jpeg', quality: 0.86, pixelRatio: 2,
      width: size.width, height: size.height,
    })
    return { assetRef, retries: 0, strategy: 'derived_asset' }
  }

  // Fallback: treat as template_composed
  return await runComposer(job, ctx, 'derived_asset', composerId)
}

// ── Helpers ───────────────────────────────────────────────────────────────

function sizeForAspect(aspect: string): { width: number; height: number } {
  if (aspect === '1:1')  return { width: 800,  height: 800  }
  if (aspect === '16:9') return { width: 1280, height: 720  }
  if (aspect === '4:5')  return { width: 800,  height: 1000 }
  return { width: 800, height: 1000 }
}

function findUpstreamRef(pack: LandingPagePack, filename: string | undefined): string | null {
  if (!filename) return null
  for (const section of pack.sections) {
    for (const ip of section.imagePrompts) {
      if (ip.filename === filename && ip.generatedAssetRef) return ip.generatedAssetRef
    }
  }
  return null
}

async function getProductImageRef(ctx: RouterContext): Promise<string | null> {
  // Try the bank product image
  // (Inline to avoid bank store import — caller could pass it instead)
  try {
    const { useBankStore } = await import('../../../stores/bankStore')
    const product = useBankStore.getState().getProductById(ctx.pack.productId)
    if (product?.productImage) {
      const url = await resolveImageRef(product.productImage)
      if (url) return product.productImage
    }
  } catch {/* skip */}
  return null
}

function resolveComposerForJob(composerId: string, job: RouterJob): string {
  // Social-proof section uses 3 different screenshot composers based on index
  if (composerId === 'social-screenshot') {
    if (job.imageIdx === 0) return 'fb-comment'
    if (job.imageIdx === 1) return 'tiktok-review'
    if (job.imageIdx === 2) return 'shopee-review'
  }
  // Infographic — section type maps to subType, but composer id is generic
  if (composerId === 'why-happens')   return 'why-happens-infographic'
  if (composerId === 'ingredients')   return 'ingredients-infographic'
  if (composerId === 'mechanism')     return 'mechanism-infographic'
  if (composerId === 'benefits')      return 'benefits-infographic'
  if (composerId === 'comparison')    return 'comparison-infographic'
  return composerId
}

// ── Composer param builders ───────────────────────────────────────────────
//
// Translate from LandingSection content (reviews / bullets / faqs / copy)
// into composer-specific param shapes. Defensive defaults everywhere.

const MALAY_NAMES = [
  'Aisyah Rahman', 'Faridah Hassan', 'Siti Norhayati', 'Nor Aini',
  'Zara Aziz', 'Mawar Saleha', 'Maryam Yusof', 'Hanis Iskandar',
  'Aliya Karim', 'Diana Mohd Nor', 'Ainul Hannan', 'Wani Hashim',
]

const MALAY_HANDLES = [
  '@aisyah_my', '@faridah.h', '@sitixnor', '@noraini.kl',
  '@zaragloss', '@mawarmy', '@maryam.y', '@hanisss',
]

const NEWS_PUBS = [
  { name: 'mStar',           color: '#C8102E' },
  { name: 'Berita Harian',   color: '#003B7A' },
  { name: 'Health.com.my',   color: '#2E7D32' },
  { name: 'Hello Doktor',    color: '#FB8C00' },
]

function pickFromArray<T>(arr: T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}

function buildComposerParams(
  composerId: string,
  job: RouterJob,
  ctx: RouterContext,
): unknown {
  const { section, prompt } = job
  const seed = `${section.type}-${prompt.filename}`

  switch (composerId) {
    case 'whatsapp-chat':
    case 'whatsapp-testimonials':
      return buildWhatsappParams(job)

    case 'shopee-review':
      return buildShopeeParams(job, ctx, seed)
    case 'tiktok-review':
      return buildTiktokParams(job, ctx, seed)
    case 'fb-comment':
      return buildFbParams(job, ctx, seed)

    case 'news-article':
    case 'news-proof':
      return buildNewsParams(job, ctx, seed)

    case 'why-happens-infographic':
      return buildInfographicParams(section, 'why-happens')
    case 'ingredients-infographic':
      return buildInfographicParams(section, 'ingredient-cards')
    case 'mechanism-infographic':
      return buildInfographicParams(section, 'mechanism')
    case 'benefits-infographic':
      return buildInfographicParams(section, 'benefits')
    case 'comparison-infographic':
      return buildInfographicParams(section, 'comparison')
  }

  return {}
}

function buildWhatsappParams(job: RouterJob): unknown {
  const idx = job.imageIdx
  const reviews = job.section.reviews ?? []
  const review = reviews[idx] ?? reviews[idx % Math.max(reviews.length, 1)] ?? {
    author: pickFromArray(MALAY_NAMES, `${job.section.type}-${idx}`),
    quote: 'Memang berkesan! Dah cuba sebulan, hasilnya luar biasa 🔥',
  }
  const chatName = review.author ?? pickFromArray(MALAY_NAMES, `wa-${idx}`)
  // Synthesize 4-6 messages from the quote text (split sentences) + add a
  // confirm message from the chat owner to make it feel like real convo.
  const sentences = (review.quote ?? '').split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 4)
  type Msg = { side: 'incoming' | 'outgoing'; text: string; timestamp: string }
  const messages: Msg[] = sentences.map((text, i) => ({
    side: 'incoming',
    text,
    timestamp: `21:${String(2 + i).padStart(2, '0')}`,
  }))
  messages.push({
    side: 'outgoing',
    text: 'Aku nak try jugak — boleh share link?',
    timestamp: `21:${String(2 + messages.length).padStart(2, '0')}`,
  })
  messages.push({
    side: 'incoming',
    text: 'Ada COD seluruh Malaysia 🚚🇲🇾',
    timestamp: `21:${String(3 + messages.length).padStart(2, '0')}`,
  })
  return {
    chatName,
    subtitle: 'dalam talian',
    chatType: idx === 2 ? 'group' : 'private',
    messages,
  }
}

function buildShopeeParams(job: RouterJob, ctx: RouterContext, seed: string): unknown {
  const review = job.section.reviews?.[2] ?? job.section.reviews?.[0]
  const productImageRef = ctx.pack.visualMemory[0]?.ref
  return {
    reviewerName: review?.author ?? pickFromArray(MALAY_NAMES, seed),
    rating: review?.rating ?? 5,
    reviewText: review?.quote ?? 'Berkesan banget! Highly recommend untuk semua ibu-ibu Malaysia 🔥',
    productName: ctx.pack.productName,
    productPrice: extractPrice(ctx.pack) ?? 'RM 89',
    productImageRef,
    timestamp: '2 minggu lalu',
    variantLabel: '1 botol',
  }
}

function buildTiktokParams(job: RouterJob, ctx: RouterContext, seed: string): unknown {
  const review = job.section.reviews?.[1] ?? job.section.reviews?.[0]
  const productImageRef = ctx.pack.visualMemory[0]?.ref
  return {
    reviewerName: review?.author ?? pickFromArray(MALAY_NAMES, seed),
    reviewerHandle: pickFromArray(MALAY_HANDLES, seed),
    rating: review?.rating ?? 5,
    reviewText: review?.quote ?? 'Korang fr try la produk ni — sebulan dah nampak hasil 🤩',
    productName: ctx.pack.productName,
    productPrice: extractPrice(ctx.pack) ?? 'RM 89',
    productImageRef,
    likeCount: 234,
  }
}

function buildFbParams(job: RouterJob, ctx: RouterContext, seed: string): unknown {
  const reviews = job.section.reviews ?? []
  const productImageRef = ctx.pack.visualMemory[0]?.ref
  return {
    posterName: reviews[0]?.author ?? pickFromArray(MALAY_NAMES, seed),
    postText: reviews[0]?.quote ?? 'Akhirnya jumpa produk yang betul-betul work! Korang yang struggling — try la 🙏',
    productImageRef,
    postLikes: 247,
    comments: (reviews.slice(1, 5).length > 0 ? reviews.slice(1, 5) : [
      { author: pickFromArray(MALAY_NAMES, seed + 'a'), quote: 'Berapa harga sis? COD ada?' },
      { author: pickFromArray(MALAY_NAMES, seed + 'b'), quote: 'Aku dah cuba — memang power 🔥' },
      { author: pickFromArray(MALAY_NAMES, seed + 'c'), quote: 'Inbox details please' },
      { author: pickFromArray(MALAY_NAMES, seed + 'd'), quote: 'Wife aku dah jadi addict 😂' },
    ]).map((r, i) => ({
      name: r.author ?? pickFromArray(MALAY_NAMES, seed + i),
      text: r.quote ?? 'Memang best!',
      timestamp: `${i + 1}j`,
    })),
  }
}

function buildNewsParams(job: RouterJob, ctx: RouterContext, seed: string): unknown {
  const pub = pickFromArray(NEWS_PUBS, seed)
  const headlinePool = [
    `Penyelidik ${pub.name} Buktikan Formula Baru Berkesan`,
    `Produk Halal Tempatan Diiktiraf untuk Kesihatan Wanita`,
    `Trend Detox Semula Jadi Melanda Malaysia — Ramai Berebut Stok`,
    `Vitamin Lengkap dalam Satu Botol — Pakar Kongsi Pengalaman`,
  ]
  const productImageRef = ctx.pack.visualMemory[0]?.ref
  return {
    publication: pub.name,
    publicationColor: pub.color,
    headline: pickFromArray(headlinePool, seed),
    subheadline: `Kajian klinikal menunjukkan ${ctx.pack.productName} memberi hasil dalam tempoh singkat tanpa kesan sampingan.`,
    bylineAuthor: `Oleh ${pickFromArray(MALAY_NAMES, seed + '-auth')}`,
    bylineDate: '20 Mei 2026',
    bodyParagraphs: (job.section.copy ?? '').split(/\n+/).slice(0, 3).filter(Boolean).concat([
      'Hasil kajian menunjukkan keberkesanan tinggi dengan tahap kepuasan pengguna mencecah 87%.',
    ]).slice(0, 3),
    heroImageRef: productImageRef,
  }
}

function buildPromoBannerParams(
  job: RouterJob, ctx: RouterContext, productRef: string | null,
  isFirst: boolean, isFinal: boolean,
): unknown {
  const section = job.section
  const variant: 'clean' | 'urgency' = isFirst ? 'clean' : 'urgency'
  const headlines = isFinal
    ? {
        clean:   { main: 'KESIHATAN ANDA BERMULA HARI INI', sub: 'CUBA SEKARANG', third: 'DISKAUN 50%' },
        urgency: { main: 'JANGAN TUNGGU SEHINGGA MAKIN TERUK', sub: 'BERTINDAK HARI INI', third: 'PROMOSI TERHAD' },
      }
    : {
        clean:   { main: section.headline ?? 'DISKAUN 50% HARI INI', sub: section.offerStrip ?? 'COD SELURUH MALAYSIA', third: section.urgencyText ?? 'STOK TERHAD' },
        urgency: { main: section.urgencyText ?? 'PROMOSI TAMAT MALAM INI', sub: 'JANGAN LEPASKAN PELUANG', third: 'RAMAI DAH CUBA' },
      }
  const hd = headlines[variant]
  return {
    variant,
    productImageRef: productRef ?? ctx.pack.visualMemory[0]?.ref,
    mainHeadline: hd.main,
    subHeadline: hd.sub,
    thirdLine: hd.third,
    productPrice: extractPrice(ctx.pack) ?? 'RM 89',
    badges: ['halal', 'kkm', 'cod'] as const,
  }
}

function buildBeforeAfterParams(job: RouterJob, ba1: string, ba2: string): unknown {
  const variantIdx = job.imageIdx - 2  // ba_03, ba_04 use 0, 1
  const layouts: Array<'horizontal' | 'vertical'> = ['horizontal', 'vertical']
  return {
    beforeImageRef: variantIdx === 0 ? ba1 : ba2,
    afterImageRef:  variantIdx === 0 ? ba2 : ba1,  // swap for variety
    layout: layouts[variantIdx % 2],
    caption: 'Sebelum vs Selepas — 30 hari guna produk',
    durationChip: '+30 HARI',
    beforeLabel: 'SEBELUM',
    afterLabel: 'SELEPAS',
  }
}

function buildInfographicParams(
  section: LandingSection,
  subType: 'why-happens' | 'ingredient-cards' | 'mechanism' | 'benefits' | 'comparison',
): unknown {
  const bullets = section.bullets ?? []
  const items = bullets.length > 0
    ? bullets
    : section.copy.split(/[.\n]/).map((s) => s.trim()).filter((s) => s.length > 4 && s.length < 80).slice(0, 6)
  const icons = items.map(() => '✅')
  return {
    subType,
    title: section.headline ?? section.title,
    items,
    icons,
    accentColor: '#FB8C00',
    competitorItems: subType === 'comparison'
      ? items.map(() => 'Tidak ditemui')
      : undefined,
  }
}

function extractPrice(pack: LandingPagePack): string | null {
  // Look in any section's offerStrip or section copy for the price pattern
  for (const s of pack.sections) {
    const candidate = s.offerStrip ?? s.copy ?? ''
    const m = candidate.match(/RM\s*\d+(?:\.\d{1,2})?/i)
    if (m) return m[0].replace(/\s+/, ' ')
  }
  return null
}
