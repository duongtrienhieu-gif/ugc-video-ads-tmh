// Composer registry — single source mapping CompositionConfig.composer → impl.
//
// generateImages.ts (Phase 6) looks up the composer for each non-AI asset
// by its id, then calls composeAndStore() to produce the Supabase asset ref.
//
// Side-effect: registers DevTools test helpers on window so user can preview
// each composer in isolation before approving downstream wiring.

import type { Composer } from '../templateEngine'
import { composeToBlob } from '../templateEngine'

import { whatsappComposer } from './whatsappComposer'
import { shopeeReviewComposer } from './shopeeReviewComposer'
import type { ShopeeReviewParams } from './shopeeReviewComposer'
import { tiktokReviewComposer } from './tiktokReviewComposer'
import type { TiktokReviewParams } from './tiktokReviewComposer'
import { fbCommentComposer } from './fbCommentComposer'
import type { FbCommentParams } from './fbCommentComposer'
import { newsArticleComposer } from './newsArticleComposer'
import type { NewsArticleParams } from './newsArticleComposer'
import { promoBannerComposer } from './promoBannerComposer'
import type { PromoBannerParams } from './promoBannerComposer'
import { beforeAfterCollageComposer } from './beforeAfterCollageComposer'
import type { BeforeAfterParams } from './beforeAfterCollageComposer'
import { infographicComposer } from './infographicComposer'
import type { InfographicParams } from './infographicComposer'

// ── Registry ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComposer = Composer<any>

export const COMPOSER_REGISTRY: Record<string, AnyComposer> = {
  // WhatsApp section
  'whatsapp-chat':         whatsappComposer,
  'whatsapp-testimonials': whatsappComposer,  // alias so section type works
  // Screenshots
  'shopee-review':         shopeeReviewComposer,
  'tiktok-review':         tiktokReviewComposer,
  'fb-comment':            fbCommentComposer,
  // social-screenshot is the generic id used in renderPlanner for the first
  // 3 images of the social-proof section. Resolution happens by index:
  //   idx 0 = fb-comment, idx 1 = tiktok-review, idx 2 = shopee-review
  // generateImages.ts handles the dispatch when it sees 'social-screenshot'.
  'social-screenshot':     fbCommentComposer, // default — overridden by dispatcher
  // News
  'news-article':          newsArticleComposer,
  'news-proof':            newsArticleComposer,
  // Promo banners
  'promo-banner':          promoBannerComposer,
  // Before/after
  'before-after-collage':  beforeAfterCollageComposer,
  // Infographic (subType selects layout)
  'why-happens-infographic': infographicComposer,
  'ingredients-infographic': infographicComposer,
  'mechanism-infographic':   infographicComposer,
  'benefits-infographic':    infographicComposer,
  'comparison-infographic':  infographicComposer,
}

/** Look up a composer by id. Returns null when no match (caller falls back to AI). */
export function getComposer(id: string): AnyComposer | null {
  return COMPOSER_REGISTRY[id] ?? null
}

// ── DevTools test helpers ──────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const open = async (blob: Blob, label: string): Promise<string> => {
    const url = URL.createObjectURL(blob)
    console.info(`[composer test] ${label} — opening preview:`, url)
    window.open(url, '_blank')
    return url
  }

  type GlobalTesters = {
    __testShopeeComposer?:    (p?: Partial<ShopeeReviewParams>)     => Promise<string>
    __testTiktokComposer?:    (p?: Partial<TiktokReviewParams>)     => Promise<string>
    __testFbComposer?:        (p?: Partial<FbCommentParams>)        => Promise<string>
    __testNewsComposer?:      (p?: Partial<NewsArticleParams>)      => Promise<string>
    __testPromoComposer?:     (p?: Partial<PromoBannerParams>)      => Promise<string>
    __testBeforeAfterComposer?: (p?: Partial<BeforeAfterParams>)    => Promise<string>
    __testInfographicComposer?: (p?: Partial<InfographicParams>)    => Promise<string>
    __testAllComposers?:      ()                                    => Promise<void>
  }

  const w = window as unknown as GlobalTesters

  w.__testShopeeComposer = async (p) => {
    const params: ShopeeReviewParams = {
      reviewerName: 'aisyah***h',
      rating: 5,
      reviewText: 'Memang berkesan! Dah cuba 3 minggu, hilang 5kg dan kulit lebih cerah. Mengantuk kurang banyak juga. Highly recommend untuk semua makcik2 dan kakak2!! 🔥🔥',
      productName: 'Slim Detox Capsule — 60 biji',
      productPrice: 'RM 89',
      variantLabel: '1 botol',
      timestamp: '2 minggu lalu',
      ...p,
    }
    const blob = await composeToBlob(shopeeReviewComposer, params, { format: 'jpeg', quality: 0.86, pixelRatio: 2 })
    return open(blob, 'Shopee review')
  }

  w.__testTiktokComposer = async (p) => {
    const params: TiktokReviewParams = {
      reviewerName: 'Aisyah R.',
      reviewerHandle: '@aisyahmy',
      rating: 5,
      reviewText: 'Korang fr try la produk ni. Sebulan je dah hilang 4kg + skin glow! Suka sangat!! 🤩',
      productName: 'Slim Detox Capsule — 60 biji',
      productPrice: 'RM 89',
      likeCount: 234,
      ...p,
    }
    const blob = await composeToBlob(tiktokReviewComposer, params, { format: 'jpeg', quality: 0.84, pixelRatio: 2 })
    return open(blob, 'TikTok review')
  }

  w.__testFbComposer = async (p) => {
    const params: FbCommentParams = {
      posterName: 'Faridah Hassan',
      postText: 'Akhirnya jumpa produk yang betul-betul work! Korang yang struggling dengan badan macam aku — try la 🙏',
      postLikes: 247,
      comments: [
        { name: 'Siti N.', text: 'Berapa harga sis? COD ada x?', timestamp: '1j' },
        { name: 'Aisyah Rahman', text: 'Aku dah cuba — memang power 🔥', timestamp: '2j' },
        { name: 'Norhayati', text: 'Boleh inbox details?', timestamp: '3j' },
        { name: 'Mahdi K.', text: 'Wife aku dah jadi addict produk ni 😂', timestamp: '4j' },
      ],
      ...p,
    }
    const blob = await composeToBlob(fbCommentComposer, params, { format: 'jpeg', quality: 0.85, pixelRatio: 2 })
    return open(blob, 'Facebook comment')
  }

  w.__testNewsComposer = async (p) => {
    const params: NewsArticleParams = {
      publication: 'mStar',
      publicationColor: '#C8102E',
      headline: 'Penyelidik Berjaya Cipta Formula Detox Halal Berkesan',
      subheadline: 'Kajian terkini buktikan kombinasi 8 ekstrak herbal dapat membantu menurunkan berat badan dengan selamat.',
      bylineAuthor: 'Oleh Dr. Nor Aini',
      bylineDate: '20 Mei 2026',
      bodyParagraphs: [
        'Penyelidik dari Universiti Tempatan baru-baru ini memperkenalkan formula detox baru yang menggunakan kombinasi 8 ekstrak herbal halal.',
        'Hasil kajian klinikal selama 12 minggu menunjukkan 87% peserta berjaya menurunkan berat badan tanpa kesan sampingan.',
        'Produk ini kini mendapat sambutan hangat di pasaran Malaysia dengan ribuan COD setiap minggu.',
      ],
      ...p,
    }
    const blob = await composeToBlob(newsArticleComposer, params, { format: 'jpeg', quality: 0.88, pixelRatio: 2 })
    return open(blob, 'News article')
  }

  w.__testPromoComposer = async (p) => {
    const params: PromoBannerParams = {
      variant: 'clean',
      mainHeadline: 'DISKAUN 50% HARI INI',
      subHeadline: 'COD SELURUH MALAYSIA',
      thirdLine: 'STOK TERHAD',
      productPrice: 'RM 89',
      badges: ['halal', 'kkm', 'cod'],
      ...p,
    }
    const blob = await composeToBlob(promoBannerComposer, params, { format: 'jpeg', quality: 0.87, pixelRatio: 2 })
    return open(blob, 'Promo banner')
  }

  w.__testBeforeAfterComposer = async (p) => {
    const params: BeforeAfterParams = {
      beforeImageRef: '',
      afterImageRef: '',
      layout: 'horizontal',
      caption: 'Sebelum vs Selepas — 30 hari guna produk',
      durationChip: '+30 HARI',
      ...p,
    }
    const blob = await composeToBlob(beforeAfterCollageComposer, params, { format: 'jpeg', quality: 0.86, pixelRatio: 2 })
    return open(blob, 'Before/after collage')
  }

  w.__testInfographicComposer = async (p) => {
    const params: InfographicParams = {
      subType: 'ingredient-cards',
      title: 'Bahan Utama Yang Berkesan',
      items: ['Garcinia Cambogia — bakar lemak', 'Kolagen — kulit cerah', 'Vitamin B6 — tenaga stabil', 'Probiotik — usus sihat'],
      icons: ['🍋', '✨', '⚡', '🌱'],
      ...p,
    }
    const blob = await composeToBlob(infographicComposer, params, { format: 'jpeg', quality: 0.92, pixelRatio: 2 })
    return open(blob, 'Infographic')
  }

  w.__testAllComposers = async () => {
    console.info('Testing ALL composers — 7 windows will open...')
    await w.__testShopeeComposer?.()
    await w.__testTiktokComposer?.()
    await w.__testFbComposer?.()
    await w.__testNewsComposer?.()
    await w.__testPromoComposer?.()
    await w.__testBeforeAfterComposer?.()
    await w.__testInfographicComposer?.()
    console.info('✅ All 7 composer previews opened.')
  }
}
