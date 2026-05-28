// TikTok Shop — main app component.
// 3-panel layout: InputPanel (left) | ImageGrid (middle) | DescriptionEditor (right).
// Phase 5 additions:
//   • On mount, restore the most-recently-saved listing as the current draft
//     so refresh doesn't lose work
//   • Debounced auto-save of draft.output to Supabase (2s after last change)

import { useEffect, useRef } from 'react'
import InputPanel from './components/InputPanel'
import ImageGrid from './components/ImageGrid'
import DescriptionEditor from './components/DescriptionEditor'
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

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      <InputPanel />
      <ImageGrid />
      <DescriptionEditor />
    </div>
  )
}
