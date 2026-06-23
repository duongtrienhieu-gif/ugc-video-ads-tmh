// TikTok Shop — main app component.
// 3-panel layout: InputPanel (left) | ImageGrid (middle) | DescriptionEditor (right).
// Phase 5 additions:
//   • On mount, restore the most-recently-saved listing as the current draft
//     so refresh doesn't lose work
//   • Debounced auto-save of draft.output to Supabase (2s after last change)

import { useEffect, useRef, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import InputPanel from './components/InputPanel'
import ImageGrid from './components/ImageGrid'
import DescriptionEditor from './components/DescriptionEditor'
import AppHeader from '../../components/shell/AppHeader'
import SegmentTabs from '../../components/shell/SegmentTabs'
import { useTikTokShopStore } from './store'
import { useTikTokShopListingsStore } from './listingsStore'

const AUTOSAVE_DEBOUNCE_MS = 2000

export default function TikTokShop() {
  const draftOutput = useTikTokShopStore((s) => s.draft.output)
  const loadSavedOutput = useTikTokShopStore((s) => s.loadSavedOutput)

  const listingsHydrated = useTikTokShopListingsStore((s) => s.hydrated)
  const getMostRecent = useTikTokShopListingsStore((s) => s.getMostRecent)
  const saveListing = useTikTokShopListingsStore((s) => s.save)

  // ── One-time restore on mount: load most-recent saved listing if the
  //    current draft is empty. Avoids forcing user to "Tạo Listing" again
  //    after a refresh.
  const didRestoreRef = useRef(false)
  useEffect(() => {
    if (didRestoreRef.current) return
    if (!listingsHydrated) return
    if (draftOutput) {
      // Already have a draft (just generated this session) — don't overwrite
      didRestoreRef.current = true
      return
    }
    const latest = getMostRecent()
    if (latest) {
      loadSavedOutput(latest)
    }
    didRestoreRef.current = true
  }, [listingsHydrated, draftOutput, getMostRecent, loadSavedOutput])

  // ── Debounced auto-save when draft.output mutates. Skip the very first
  //    "restore" tick (which is just hydrating from saved, not a new edit).
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!draftOutput) return
    // Don't save the freshly-restored listing as if it were a fresh edit
    if (lastSavedIdRef.current === null && draftOutput.id === getMostRecent()?.id) {
      lastSavedIdRef.current = draftOutput.id
      return
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveListing(draftOutput)
      lastSavedIdRef.current = draftOutput.id
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [draftOutput, saveListing, getMostRecent])

  // Mobile: 3 panes can't sit side-by-side on a phone → a [Thiết lập · 9 Ảnh ·
  // Mô tả] segmented shows one at a time. Auto-jump to "9 Ảnh" the moment a
  // listing output appears (initializeListingOutput creates the 9 stubs at gen
  // start) so the user watches the grid fill. Desktop keeps all 3 side-by-side.
  const [mobileTab, setMobileTab] = useState<'input' | 'images' | 'desc'>('input')
  const prevOutRef = useRef(false)
  useEffect(() => {
    const has = !!draftOutput
    if (!prevOutRef.current && has) setMobileTab('images')
    prevOutRef.current = has
  }, [draftOutput])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-app-card">
      <AppHeader icon={ShoppingBag} eyebrow="TIKTOK SHOP · LISTING" title="Listing 9 ảnh + mô tả" />

      <div className="shrink-0 border-b border-app-border px-3 py-2 lg:hidden">
        <SegmentTabs
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'input', label: 'Thiết lập' },
            { value: 'images', label: '9 Ảnh' },
            { value: 'desc', label: 'Mô tả' },
          ]}
        />
      </div>

      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <div className={`${mobileTab === 'input' ? 'flex' : 'hidden'} min-h-0 w-full lg:flex lg:w-[320px] lg:shrink-0`}>
          <InputPanel />
        </div>
        <div className={`${mobileTab === 'images' ? 'flex' : 'hidden'} min-h-0 w-full min-w-0 lg:flex lg:flex-1`}>
          <ImageGrid />
        </div>
        <div className={`${mobileTab === 'desc' ? 'flex' : 'hidden'} min-h-0 w-full lg:flex lg:w-[360px] lg:shrink-0`}>
          <DescriptionEditor />
        </div>
      </div>
    </div>
  )
}
