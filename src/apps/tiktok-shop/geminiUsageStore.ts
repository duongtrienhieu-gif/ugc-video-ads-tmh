// geminiUsageStore — tracks Gemini API calls today to warn user before
// hitting free tier daily limit (1500 RPD for gemini-2.5-flash).
//
// Counter persists in localStorage with date key. Auto-resets at midnight
// (when getCallsToday() runs and detects date change).
//
// NOT 100% accurate (only tracks calls our app initiates) but good enough
// for warning UI: "Gemini: 23/1500" + toast when remaining < 100.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Conservative limit — free tier gemini-2.5-flash is 1500 RPD.
// Other models in cascade have similar limits. We treat this as a soft cap.
const FREE_TIER_DAILY_LIMIT = 1500

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
}

interface GeminiUsageState {
  callsToday: number
  date: string

  /** Call after every successful Gemini API call. */
  increment: () => void
  /** Reset counter (also called automatically when date changes). */
  reset: () => void
  /** Number of calls remaining in free tier (approximate). */
  getRemaining: () => number
  /** Returns true when usage is high (warning UI should highlight). */
  isHigh: () => boolean
  /** Returns true when very few calls left — toast warning. */
  isCritical: () => boolean
}

export const useGeminiUsageStore = create<GeminiUsageState>()(
  persist(
    (set, get) => ({
      callsToday: 0,
      date: todayStr(),

      increment: () => set((s) => {
        const today = todayStr()
        // Auto-reset on day change
        if (s.date !== today) return { callsToday: 1, date: today }
        return { callsToday: s.callsToday + 1, date: today }
      }),

      reset: () => set({ callsToday: 0, date: todayStr() }),

      getRemaining: () => {
        const s = get()
        const today = todayStr()
        if (s.date !== today) return FREE_TIER_DAILY_LIMIT  // new day, full quota
        return Math.max(0, FREE_TIER_DAILY_LIMIT - s.callsToday)
      },

      isHigh: () => get().getRemaining() < 200,
      isCritical: () => get().getRemaining() < 50,
    }),
    {
      name: 'ugc-lab:gemini-usage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/** Daily limit constant — exported for UI display ("X / 1500"). */
export const GEMINI_DAILY_LIMIT = FREE_TIER_DAILY_LIMIT
