// ── Script Memory ────────────────────────────────────────────────────────────
// Z31 §12 — reusable hooks / CTAs / winning structures saved across
// projects. Builds AD INTELLIGENCE over time: when the user finds a hook
// that works, they save it; next project, it's one click to reuse.
//
// Storage: separate localStorage key from the active project so memory
// survives "Tạo lại từ đầu" resets. Capped at 100 entries per type to
// keep payloads small.
// ─────────────────────────────────────────────────────────────────────────────

import type { AdStructure, AdAngle, HookStyle } from '../types'

const STORAGE_KEY = 'ugc-lab-v3-script-memory'
const MAX_ENTRIES_PER_TYPE = 100

export interface SavedHook {
  id: string
  text: string
  style: HookStyle
  /** Source project — which structure + angle produced this hook */
  fromStructure?: AdStructure
  fromAngle?: AdAngle
  /** Optional tag the user added when saving */
  tag?: string
  savedAt: number
  /** Times this hook was reused in another project */
  reuseCount: number
}

export interface SavedCta {
  id: string
  text: string
  fromStructure?: AdStructure
  tag?: string
  savedAt: number
  reuseCount: number
}

export interface SavedStructure {
  /** A "winning" combination — user marks an entire project as a win
   *  and we remember the structure + angle + voice category combo. */
  id: string
  structure: AdStructure
  angle: AdAngle
  /** Free-text description of why this won */
  description: string
  savedAt: number
  reuseCount: number
}

export interface ScriptMemory {
  hooks: SavedHook[]
  ctas: SavedCta[]
  structures: SavedStructure[]
}

function loadMemory(): ScriptMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { hooks: [], ctas: [], structures: [] }
    const parsed = JSON.parse(raw) as ScriptMemory
    return {
      hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
      ctas: Array.isArray(parsed.ctas) ? parsed.ctas : [],
      structures: Array.isArray(parsed.structures) ? parsed.structures : [],
    }
  } catch {
    return { hooks: [], ctas: [], structures: [] }
  }
}

function saveMemory(m: ScriptMemory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
  } catch (err) {
    console.warn('[SCRIPT_MEMORY] save failed (quota?)', err)
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getAllSavedHooks(): SavedHook[] {
  return loadMemory().hooks.sort((a, b) => b.savedAt - a.savedAt)
}

export function getAllSavedCtas(): SavedCta[] {
  return loadMemory().ctas.sort((a, b) => b.savedAt - a.savedAt)
}

export function getAllSavedStructures(): SavedStructure[] {
  return loadMemory().structures.sort((a, b) => b.savedAt - a.savedAt)
}

export function saveHook(
  hook: Omit<SavedHook, 'id' | 'savedAt' | 'reuseCount'>,
): SavedHook {
  const memory = loadMemory()
  const saved: SavedHook = {
    ...hook,
    id: makeId('hook'),
    savedAt: Date.now(),
    reuseCount: 0,
  }
  memory.hooks = [saved, ...memory.hooks].slice(0, MAX_ENTRIES_PER_TYPE)
  saveMemory(memory)
  return saved
}

export function saveCta(
  cta: Omit<SavedCta, 'id' | 'savedAt' | 'reuseCount'>,
): SavedCta {
  const memory = loadMemory()
  const saved: SavedCta = {
    ...cta,
    id: makeId('cta'),
    savedAt: Date.now(),
    reuseCount: 0,
  }
  memory.ctas = [saved, ...memory.ctas].slice(0, MAX_ENTRIES_PER_TYPE)
  saveMemory(memory)
  return saved
}

export function saveStructure(
  structure: Omit<SavedStructure, 'id' | 'savedAt' | 'reuseCount'>,
): SavedStructure {
  const memory = loadMemory()
  const saved: SavedStructure = {
    ...structure,
    id: makeId('struct'),
    savedAt: Date.now(),
    reuseCount: 0,
  }
  memory.structures = [saved, ...memory.structures].slice(0, MAX_ENTRIES_PER_TYPE)
  saveMemory(memory)
  return saved
}

/** Increment reuse counter when a memory item is pulled into a new project. */
export function bumpHookReuse(id: string): void {
  const memory = loadMemory()
  const idx = memory.hooks.findIndex((h) => h.id === id)
  if (idx === -1) return
  memory.hooks[idx] = { ...memory.hooks[idx], reuseCount: memory.hooks[idx].reuseCount + 1 }
  saveMemory(memory)
}

export function bumpCtaReuse(id: string): void {
  const memory = loadMemory()
  const idx = memory.ctas.findIndex((c) => c.id === id)
  if (idx === -1) return
  memory.ctas[idx] = { ...memory.ctas[idx], reuseCount: memory.ctas[idx].reuseCount + 1 }
  saveMemory(memory)
}

export function deleteHook(id: string): void {
  const memory = loadMemory()
  memory.hooks = memory.hooks.filter((h) => h.id !== id)
  saveMemory(memory)
}

export function deleteCta(id: string): void {
  const memory = loadMemory()
  memory.ctas = memory.ctas.filter((c) => c.id !== id)
  saveMemory(memory)
}

export function deleteStructure(id: string): void {
  const memory = loadMemory()
  memory.structures = memory.structures.filter((s) => s.id !== id)
  saveMemory(memory)
}

/** Reset entire script memory — only the "Reset memory" button calls this. */
export function clearAllMemory(): void {
  saveMemory({ hooks: [], ctas: [], structures: [] })
}
