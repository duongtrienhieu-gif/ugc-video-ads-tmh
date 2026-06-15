// ─────────────────────────────────────────────────────────────────────────
// CHAT BOT store — Supabase-backed CRUD cho cấu hình bán-qua-chat.
//
// Persistence (giống ads-content/store.ts):
//   1. zustand persist → localStorage 'chat-bot-configs-v1' (cache offline)
//   2. Supabase user_outputs, kind='chat-bot-config' (nguồn sự thật)
//
// hydrate() gọi onLogin (App.tsx). Mọi write fire-and-forget, fallback
// localStorage khi Supabase lỗi/chưa migrate. KHÔNG cần tạo bảng mới —
// user_outputs đã tồn tại.
// ─────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SalesConfig } from './types'
import {
  listOutputs, createOutput, updateOutput, deleteOutput,
} from '../../services/userOutputsAPI'

const KIND = 'chat-bot-config' as const

interface ChatBotStore {
  configs: SalesConfig[]
  /** Sản phẩm đang chọn ở tab Cấu hình/Mô phỏng — persist để F5 không mất chỗ. */
  selectedProductId: string | null
  hydrated: boolean
  hydrating: boolean

  hydrate: () => Promise<void>
  setSelectedProductId: (id: string | null) => void
  /** Insert hoặc update (theo id). Trả về config đã lưu. */
  upsert: (config: SalesConfig) => SalesConfig
  remove: (id: string) => void
  getById: (id: string) => SalesConfig | undefined
  /** Cấu hình của 1 sản phẩm (mỗi sản phẩm 1 config — lấy bản mới nhất). */
  getByProductId: (productId: string) => SalesConfig | undefined
}

export const useChatBotStore = create<ChatBotStore>()(
  persist(
    (set, get) => ({
      configs: [],
      selectedProductId: null,
      hydrated: false,
      hydrating: false,

      setSelectedProductId: (id) => set({ selectedProductId: id }),

      hydrate: async () => {
        if (get().hydrating) return
        set({ hydrating: true })
        try {
          const remote = await listOutputs<SalesConfig>(KIND)
          if (remote === null) {
            // Supabase không với tới được → giữ cache localStorage
            set({ hydrating: false, hydrated: true })
            return
          }
          const local = get().configs
          const remoteIds = new Set(remote.map((r) => r.id))
          const localOnly = local.filter((l) => !remoteIds.has(l.id))

          // Lần đồng bộ đầu: đẩy item chỉ-có-local lên cloud
          if (localOnly.length > 0 && remote.length === 0) {
            console.info(`[chatBotStore] first-sync: uploading ${localOnly.length} local configs`)
            for (const cfg of localOnly) {
              await createOutput(KIND, cfg, cfg.title)
            }
            const refreshed = await listOutputs<SalesConfig>(KIND)
            set({ configs: refreshed ?? local, hydrating: false, hydrated: true })
            return
          }

          set({ configs: [...remote, ...localOnly], hydrating: false, hydrated: true })
        } catch (err) {
          console.error('[chatBotStore] hydrate failed:', err)
          set({ hydrating: false, hydrated: true })
        }
      },

      upsert: (config) => {
        const exists = !!get().configs.find((c) => c.id === config.id)
        const saved: SalesConfig = { ...config, updatedAt: Date.now() }
        set((s) => ({
          configs: exists
            ? s.configs.map((c) => (c.id === saved.id ? saved : c))
            : [saved, ...s.configs],
        }))
        if (exists) void updateOutput(KIND, saved.id, saved, saved.title)
        else void createOutput(KIND, saved, saved.title)
        return saved
      },

      remove: (id) => {
        set((s) => ({ configs: s.configs.filter((c) => c.id !== id) }))
        void deleteOutput(KIND, id)
      },

      getById: (id) => get().configs.find((c) => c.id === id),

      getByProductId: (productId) =>
        get().configs.find((c) => c.productId === productId),
    }),
    {
      name: 'chat-bot-configs-v1',
      // Chỉ persist dữ liệu thật + sản phẩm đang chọn (không persist cờ hydrating).
      partialize: (s) => ({ configs: s.configs, selectedProductId: s.selectedProductId }),
    },
  ),
)
