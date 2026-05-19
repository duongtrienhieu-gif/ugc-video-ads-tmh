import { create } from 'zustand'
import type { SuperLadipagePack } from './types'

// Super Ladipage store — Phase 1 skeleton.
// Pha sau sẽ port shape state từ UI cũ + thêm action gọi service mới.

interface SuperLadipageState {
  /** Danh sách pack đã lưu. */
  items: SuperLadipagePack[]
  /** Pack đang được edit (null = đang ở wizard input). */
  activePackId: string | null

  setActivePack: (id: string | null) => void
}

export const useSuperLadipageStore = create<SuperLadipageState>((set) => ({
  items: [],
  activePackId: null,

  setActivePack: (id) => set({ activePackId: id }),
}))
