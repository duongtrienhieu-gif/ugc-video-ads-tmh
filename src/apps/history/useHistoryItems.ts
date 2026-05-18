// ─────────────────────────────────────────────────────────────────────
// useHistoryItems — aggregates COMPLETED creative outputs across all
// modules into a single chronological feed.
//
// This is the read-only sibling to RestoreSessionModal (which lists
// IN-FLIGHT drafts). History shows the permanent record of what the
// user has produced.
//
// Sources:
//   • Landing Pages  — useLandingPageStore.items (local Zustand persist)
//   • Ads Content    — useAdsContentStore.items   (local Zustand persist)
//   • Scripts        — useBankStore.scripts       (Supabase-backed bank)
//   • Product AI / B-Roll — useBankStore.brolls   (Supabase-backed bank)
//   • Avatar AI      — useBankStore.models        (Supabase-backed bank)
//
// Items render as cards in a unified grid; the type tag tells the user
// which module produced it, and clicking the card opens the source module.
// ─────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import { useLandingPageStore } from '../landing-page/store'
import { useAdsContentStore } from '../ads-content/store'
import { useLabContentStore } from '../lab-content/store'
import { useBankStore } from '../../stores/bankStore'

export type HistoryType = 'landing-page' | 'ads-content' | 'lab-content' | 'script' | 'broll' | 'model'

export interface HistoryItem {
  id: string
  type: HistoryType
  /** Vietnamese label shown on the type badge. */
  typeLabel: string
  /** Emoji glyph. */
  typeIcon: string
  /** Tailwind accent colour token ("violet", "pink", etc.) for the badge. */
  typeAccent: 'violet' | 'pink' | 'blue' | 'orange' | 'sky' | 'emerald' | 'purple'
  title: string
  productName?: string
  language?: string  // "vi" / "ms" / "en" etc.
  /** asset:xxx ref OR http(s) URL — pass to useAssetUrl in the card. */
  thumbnail?: string
  createdAt: number
  /** Sidebar app id to navigate to when the card is clicked. */
  sourceAppId: string
  /** Optional product link for productId-based inter-app handoff. */
  sourceProductId?: string
  /** Short preview text shown beneath the title. */
  previewText?: string
  /** Item count (e.g. "14 sections", "3 variations") for the meta line. */
  countLabel?: string
}

export function useHistoryItems(): HistoryItem[] {
  const landingItems = useLandingPageStore((s) => s.items)
  const adsItems     = useAdsContentStore((s) => s.items)
  const labItems     = useLabContentStore((s) => s.items)
  const scripts      = useBankStore((s) => s.scripts)
  const brolls       = useBankStore((s) => s.brolls)
  const models       = useBankStore((s) => s.models)
  const products     = useBankStore((s) => s.products)

  return useMemo(() => {
    const items: HistoryItem[] = []

    // Helper — lookup product name from id
    const productName = (id?: string) =>
      id ? products.find((p) => p.id === id)?.productName : undefined

    // ── Landing Pages ─────────────────────────────────────────────────
    for (const lp of landingItems) {
      items.push({
        id: `lp-${lp.id}`,
        type: 'landing-page',
        typeLabel: 'Landing Page',
        typeIcon: '📄',
        typeAccent: 'violet',
        title: lp.title,
        productName: lp.productName,
        language: lp.language,
        thumbnail: lp.sections[0]?.imagePrompts?.[0]?.generatedAssetRef,
        createdAt: lp.createdAt,
        sourceAppId: 'landing-page',
        sourceProductId: lp.productId,
        countLabel: `${lp.sections.length} sections`,
      })
    }

    // ── Lab Content ───────────────────────────────────────────────────
    for (const lab of labItems) {
      const angleCount = Array.isArray(lab.angles) ? lab.angles.length : 0
      const hookCount  = Array.isArray(lab.hooks) ? lab.hooks.length : 0
      items.push({
        id: `lab-${lab.id}`,
        type: 'lab-content',
        typeLabel: 'Lab Content',
        typeIcon: '🧠',
        typeAccent: 'purple',
        title: lab.title,
        productName: lab.productName,
        thumbnail: undefined,
        createdAt: lab.createdAt,
        sourceAppId: 'lab-content',
        sourceProductId: lab.productId,
        previewText: lab.strategySummaryVi?.slice(0, 80),
        countLabel: `${angleCount} góc · ${hookCount} hook`,
      })
    }

    // ── Ads Content ───────────────────────────────────────────────────
    for (const ad of adsItems) {
      items.push({
        id: `ad-${ad.id}`,
        type: 'ads-content',
        typeLabel: 'Ads Content',
        typeIcon: '📣',
        typeAccent: 'pink',
        title: ad.title,
        productName: ad.productName,
        thumbnail: undefined,  // captions have no thumbnail
        createdAt: ad.createdAt,
        sourceAppId: 'ads-content',
        sourceProductId: ad.productId,
        previewText: ad.vietnamese?.slice(0, 80),
        countLabel: ad.platformLabel,
      })
    }

    // ── Scripts ───────────────────────────────────────────────────────
    for (const s of scripts) {
      items.push({
        id: `script-${s.id}`,
        type: 'script',
        typeLabel: 'Kịch bản UGC',
        typeIcon: '✍️',
        typeAccent: 'blue',
        title: s.title,
        productName: productName(s.linkedProductId),
        createdAt: s.createdAt,
        sourceAppId: 'script-architect',
        sourceProductId: s.linkedProductId,
        previewText: s.scriptText?.slice(0, 80),
      })
    }

    // ── Product AI / B-Roll images ────────────────────────────────────
    for (const b of brolls) {
      items.push({
        id: `broll-${b.id}`,
        type: 'broll',
        typeLabel: 'Product AI',
        typeIcon: '🛍️',
        typeAccent: 'orange',
        title: b.prompt?.slice(0, 60) || `B-Roll ${b.id.slice(0, 6)}`,
        productName: productName(b.productId),
        thumbnail: b.imageUrl,
        createdAt: b.createdAt,
        sourceAppId: 'creative-studio',
        sourceProductId: b.productId,
      })
    }

    // ── Avatar models ─────────────────────────────────────────────────
    for (const m of models) {
      items.push({
        id: `model-${m.id}`,
        type: 'model',
        typeLabel: 'Avatar AI',
        typeIcon: '🧑‍🎤',
        typeAccent: 'sky',
        title: m.name,
        thumbnail: m.characterImage,
        createdAt: m.createdAt,
        sourceAppId: 'character-studio',
        countLabel: m.variants?.length ? `${m.variants.length} biến thể` : undefined,
      })
    }

    // Sort newest first
    items.sort((a, b) => b.createdAt - a.createdAt)
    return items
  }, [landingItems, adsItems, labItems, scripts, brolls, models, products])
}
