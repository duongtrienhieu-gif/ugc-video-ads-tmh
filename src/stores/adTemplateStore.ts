/**
 * Ad Win Template store — saved analyses of winning UGC ads.
 *
 * Workflow:
 *   1) User uploads a winning ad to Phân tích QC → AI analyzes structure/style
 *   2) User clicks "Save as Ad Win Template" → analysis stored here with a name
 *   3) In UGC Builder, user picks a saved template instead of re-uploading
 *      a video — AI reads the saved analysis text to inform B-roll prompts
 *
 * Persisted in localStorage (Zustand persist middleware) — survives F5 + logout.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AdWinTemplate {
  id: string
  name: string                  // user-chosen label
  analysisText: string          // full Gemini analysis output (~500-1500 words)
  videoFileName?: string        // original file name for reference
  sourceTranscript?: string     // optional: actual transcript text from the ad
  createdAt: number
}

interface AdTemplateState {
  templates: AdWinTemplate[]
  addTemplate:    (name: string, analysisText: string, opts?: { videoFileName?: string; sourceTranscript?: string }) => string  // returns id
  updateTemplate: (id: string, updates: Partial<AdWinTemplate>) => void
  deleteTemplate: (id: string) => void
  getById:        (id: string) => AdWinTemplate | undefined
}

export const useAdTemplateStore = create<AdTemplateState>()(
  persist(
    (set, get) => ({
      templates: [],
      addTemplate: (name, analysisText, opts) => {
        const template: AdWinTemplate = {
          id: crypto.randomUUID(),
          name,
          analysisText,
          videoFileName: opts?.videoFileName,
          sourceTranscript: opts?.sourceTranscript,
          createdAt: Date.now(),
        }
        set((s) => ({ templates: [template, ...s.templates] }))
        return template.id
      },
      updateTemplate: (id, updates) => set((s) => ({
        templates: s.templates.map((t) => t.id === id ? { ...t, ...updates } : t),
      })),
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
      getById: (id) => get().templates.find((t) => t.id === id),
    }),
    { name: 'ugc-lab-ad-templates-v1' },
  ),
)
