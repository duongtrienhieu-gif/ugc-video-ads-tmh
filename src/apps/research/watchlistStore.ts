// Danh sách Test — SP research được "ghim" để test sau. Lưu Supabase (đồng bộ đa thiết bị),
// mirror pattern bankStore: requireUserId + optimistic update + toast lỗi.
// Bảng: research_watchlist (xem migrations/research_watchlist.sql — chạy 1 lần trên Supabase).
import { create } from 'zustand'
import { supabase, requireUserId } from '../../lib/supabase'
import { useAppStore } from '../../stores/appStore'
import type { ScoredProduct } from './types'

export interface WatchItem {
  id: string            // id row DB
  productId: string     // productId research — khóa dedup
  market: string
  product: ScoredProduct
  createdAt: number
}

function toItem(row: Record<string, unknown>): WatchItem {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    market: (row.market as string) ?? '',
    product: row.product as ScoredProduct,
    createdAt: Number(row.created_at) || Date.now(),
  }
}

function toast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
  try { useAppStore.getState().addToast(msg, type) } catch { /* appStore chưa sẵn */ }
}

interface WatchState {
  items: WatchItem[]
  loaded: boolean
  loading: boolean
  load: () => Promise<void>
  add: (p: ScoredProduct) => Promise<void>
  remove: (id: string) => Promise<void>
  has: (productId: string) => boolean
}

let loadInFlight: Promise<void> | null = null

export const useWatchlistStore = create<WatchState>((set, get) => ({
  items: [],
  loaded: false,
  loading: false,

  has: (productId) => get().items.some((i) => i.productId === productId),

  load: async () => {
    if (get().loaded) return
    if (loadInFlight) return loadInFlight
    loadInFlight = (async () => {
      set({ loading: true })
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { set({ loading: false, loaded: true }); return }
        const { data, error } = await supabase
          .from('research_watchlist').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: false })
        if (error) {
          // Bảng chưa tạo → báo nhẹ, không vỡ app.
          console.warn('[watchlist] load error:', error.message)
          set({ loading: false, loaded: true })
          return
        }
        set({ items: (data ?? []).map((r) => toItem(r as Record<string, unknown>)), loaded: true, loading: false })
      } catch (e) {
        console.warn('[watchlist] load exception:', e)
        set({ loading: false, loaded: true })
      } finally {
        loadInFlight = null
      }
    })()
    return loadInFlight
  },

  add: async (p) => {
    if (get().has(p.productId)) { toast('SP đã có trong Danh sách Test', 'info'); return }
    const tempId = crypto.randomUUID()
    const temp: WatchItem = { id: tempId, productId: p.productId, market: p.market, product: p, createdAt: Date.now() }
    set((s) => ({ items: [temp, ...s.items] }))
    try {
      const user_id = await requireUserId()
      const { data: row, error } = await supabase.from('research_watchlist').insert({
        user_id, product_id: p.productId, market: p.market, product: p, created_at: Date.now(),
      }).select().single()
      if (error) {
        set((s) => ({ items: s.items.filter((i) => i.id !== tempId) }))
        toast(/relation .* does not exist|schema cache/i.test(error.message)
          ? 'Chưa tạo bảng research_watchlist trên Supabase (xem hướng dẫn SQL)'
          : 'Lưu Danh sách Test lỗi: ' + error.message.slice(0, 60), 'error')
      } else if (row) {
        set((s) => ({ items: s.items.map((i) => i.id === tempId ? toItem(row) : i) }))
        toast('📌 Đã thêm vào Danh sách Test', 'success')
      }
    } catch (e) {
      set((s) => ({ items: s.items.filter((i) => i.id !== tempId) }))
      toast('Lưu Danh sách Test lỗi: ' + ((e as Error).message || '').slice(0, 60), 'error')
    }
  },

  remove: async (id) => {
    const prev = get().items
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
    const { error } = await supabase.from('research_watchlist').delete().eq('id', id)
    if (error) { set({ items: prev }); toast('Xóa lỗi: ' + error.message.slice(0, 60), 'error') }
  },
}))
