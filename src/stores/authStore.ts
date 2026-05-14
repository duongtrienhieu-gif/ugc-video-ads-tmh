import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useBankStore } from './bankStore'

interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (v: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    await supabase.auth.signOut()
    // Clear all bank data so next user doesn't see previous user's data
    useBankStore.setState({
      products: [], models: [], scripts: [], voices: [], voiceHistory: [], brolls: [],
    })
    set({ user: null })
  },
}))
