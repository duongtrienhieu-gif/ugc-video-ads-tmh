/**
 * Ad Win Template store — saved analyses of winning UGC ads.
 *
 * Workflow:
 *   1) User uploads a winning ad to Phân tích QC → AI analyzes structure/style
 *   2) User clicks "Save as Ad Win Template" → analysis stored here with a name
 *   3) In UGC Builder, user picks a saved template instead of re-uploading
 *      a video — AI reads the saved analysis text to inform B-roll prompts
 *
 * Persistence (cross-device sync via Supabase):
 *   • zustand persist → localStorage `ugc-lab-ad-templates-v1` (offline cache)
 *   • Supabase `user_outputs` table with kind='ad-win-template' (source of truth)
 *
 * On login: hydrate() pulls from Supabase and reconciles with local cache.
 * If Supabase fetch fails (table missing / network), localStorage stays
 * authoritative and the app keeps working — same UX as pre-sync.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnalysisResult } from '../apps/ad-anatomy/types'
import {
  listOutputs, createOutput, updateOutput, deleteOutput,
} from '../services/userOutputsAPI'

export interface AdWinTemplate {
  id: string
  name: string                  // user-chosen label
  analysisText: string          // full Gemini analysis output (~500-1500 words)
  videoFileName?: string        // original file name for reference
  sourceTranscript?: string     // optional: actual transcript text from the ad
  /** Z6: full structured analysis result — enables benchmark + pattern stats */
  analysis?: AnalysisResult
  createdAt: number
}

// userOutputsAPI requires a `title` field; AdWinTemplate uses `name`.
// Map between them at the API boundary.
interface AdWinTemplateForCloud extends AdWinTemplate {
  title?: string
}

const KIND = 'ad-win-template' as const

interface AdTemplateState {
  templates: AdWinTemplate[]
  hydrated: boolean
  hydrating: boolean

  hydrate: () => Promise<void>
  addTemplate:    (name: string, analysisText: string, opts?: { videoFileName?: string; sourceTranscript?: string; analysis?: AnalysisResult }) => string  // returns id
  updateTemplate: (id: string, updates: Partial<AdWinTemplate>) => void
  deleteTemplate: (id: string) => void
  getById:        (id: string) => AdWinTemplate | undefined
}

export const useAdTemplateStore = create<AdTemplateState>()(
  persist(
    (set, get) => ({
      templates: [],
      hydrated: false,
      hydrating: false,

      hydrate: async () => {
        if (get().hydrating) return
        set({ hydrating: true })
        try {
          const remote = await listOutputs<AdWinTemplateForCloud>(KIND)
          if (remote === null) {
            set({ hydrating: false, hydrated: true })
            return
          }
          const local = get().templates
          const remoteIds = new Set(remote.map((r) => r.id))
          const localOnly = local.filter((l) => !remoteIds.has(l.id))

          if (localOnly.length > 0 && remote.length === 0) {
            console.info(`[adTemplateStore] first-sync: uploading ${localOnly.length} local items`)
            for (const item of localOnly) {
              await createOutput(KIND, { ...item, title: item.name }, item.name)
            }
            const refreshed = await listOutputs<AdWinTemplateForCloud>(KIND)
            set({
              templates: (refreshed ?? local).map(stripTitle),
              hydrating: false,
              hydrated: true,
            })
            return
          }

          set({
            templates: [...remote.map(stripTitle), ...localOnly],
            hydrating: false,
            hydrated: true,
          })
        } catch (err) {
          console.error('[adTemplateStore] hydrate failed:', err)
          set({ hydrating: false, hydrated: true })
        }
      },

      addTemplate: (name, analysisText, opts) => {
        const template: AdWinTemplate = {
          id: crypto.randomUUID(),
          name,
          analysisText,
          videoFileName: opts?.videoFileName,
          sourceTranscript: opts?.sourceTranscript,
          analysis: opts?.analysis,
          createdAt: Date.now(),
        }
        set((s) => ({ templates: [template, ...s.templates] }))
        void createOutput(KIND, { ...template, title: name }, name)
        return template.id
      },

      updateTemplate: (id, updates) => {
        set((s) => ({
          templates: s.templates.map((t) => t.id === id ? { ...t, ...updates } : t),
        }))
        const next = get().templates.find((t) => t.id === id)
        if (next) {
          void updateOutput(
            KIND,
            id,
            { ...next, title: next.name },
            updates.name ?? next.name,
          )
        }
      },

      deleteTemplate: (id) => {
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
        void deleteOutput(KIND, id)
      },

      getById: (id) => get().templates.find((t) => t.id === id),
    }),
    { name: 'ugc-lab-ad-templates-v1' },
  ),
)

/** Helper — userOutputsAPI overlays `title` into the payload; strip it
 *  back out so the store's items stay shaped exactly like AdWinTemplate. */
function stripTitle(t: AdWinTemplateForCloud): AdWinTemplate {
  const { title: _t, ...rest } = t
  void _t
  return rest as AdWinTemplate
}
