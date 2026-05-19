// ── Project Library ──────────────────────────────────────────────────────────
// Z35 §8/§9 — save / load / duplicate v3 projects. Each saved project is
// a snapshot of the reusable parts of V3PipelineState (no transient render
// flags, no errors). Storage: separate localStorage key from the active
// project so saves SURVIVE the "Tạo lại từ đầu" wipe.
//
// Z35 §9 — Fast Duplicate flow: duplicate a project + selectively reset
// fields the user wants to re-generate (hook / CTA / creator energy / etc).
// Everything else REUSES across copies — massive cost saving.
//
// Z35 §7 — Winning Asset Memory: isWinner flag bumps a project to the
// top of the library. Future commit can extend with per-asset memory
// (best hooks across projects, best creator styles, etc).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  V3PipelineState, SavedProject,
  ScriptBrain, CreatorVideoConfig, CreatorVideoClip,
  ActionInsertClip, AutoEditState,
} from '../types'
import { createEmptyScriptBrain, createEmptyAutoEditState } from '../types'

const STORAGE_KEY = 'ugc-lab-v3-project-library'
const SCHEMA_VERSION = 1

interface PersistedLibrary {
  schemaVersion: number
  projects: SavedProject[]
}

function loadLibrary(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersistedLibrary
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`[PROJECT_LIBRARY] discarding stale payload (schema ${parsed.schemaVersion})`)
      return []
    }
    return Array.isArray(parsed.projects) ? parsed.projects : []
  } catch (err) {
    console.warn('[PROJECT_LIBRARY] load failed', err)
    return []
  }
}

function saveLibrary(projects: SavedProject[]): void {
  try {
    const payload: PersistedLibrary = { schemaVersion: SCHEMA_VERSION, projects }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[PROJECT_LIBRARY] save failed (quota?)', err)
  }
}

function makeId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Get ALL saved projects. Winners first, then newest. */
export function getAllProjects(): SavedProject[] {
  const projects = loadLibrary()
  return projects.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1
    return b.lastEditedAt - a.lastEditedAt
  })
}

export function getProjectById(id: string): SavedProject | null {
  return loadLibrary().find((p) => p.id === id) ?? null
}

/**
 * Z35 §8 — Save the current V3 pipeline state as a project in the library.
 * Returns the saved record (with assigned id).
 */
export function saveCurrentAsProject(
  state: V3PipelineState,
  opts?: { name?: string; tags?: string[]; thumbRef?: string },
): SavedProject {
  const now = Date.now()
  const productName = state.inputs.product?.productName ?? 'Sản phẩm'
  const avatarName = state.inputs.avatar?.name ?? 'Creator'
  const defaultName = `${productName} — ${new Date(now).toLocaleDateString('vi-VN')}`

  const project: SavedProject = {
    id: makeId(),
    name: opts?.name ?? defaultName,
    productName,
    avatarName,
    snapshot: {
      inputs: { ...state.inputs },
      scriptBrain: { ...state.scriptBrain },
      creatorVideoConfig: { ...state.creatorVideoConfig },
      creatorVideo: state.creatorVideo ? { ...state.creatorVideo } : null,
      inserts: state.inserts.map((it) => ({ ...it })),
      autoEdit: { ...state.autoEdit },
    },
    thumbRef: opts?.thumbRef,
    tags: opts?.tags ?? [],
    isWinner: false,
    createdAt: now,
    lastEditedAt: now,
  }

  const projects = loadLibrary()
  projects.push(project)
  saveLibrary(projects)
  console.log(`[PROJECT_LIBRARY] saved "${project.name}" (id=${project.id})`)
  return project
}

/** Update an existing project (overwrites snapshot). */
export function updateProject(id: string, state: V3PipelineState): SavedProject | null {
  const projects = loadLibrary()
  const idx = projects.findIndex((p) => p.id === id)
  if (idx === -1) return null
  const updated: SavedProject = {
    ...projects[idx],
    productName: state.inputs.product?.productName ?? projects[idx].productName,
    avatarName: state.inputs.avatar?.name ?? projects[idx].avatarName,
    snapshot: {
      inputs: { ...state.inputs },
      scriptBrain: { ...state.scriptBrain },
      creatorVideoConfig: { ...state.creatorVideoConfig },
      creatorVideo: state.creatorVideo ? { ...state.creatorVideo } : null,
      inserts: state.inserts.map((it) => ({ ...it })),
      autoEdit: { ...state.autoEdit },
    },
    lastEditedAt: Date.now(),
  }
  projects[idx] = updated
  saveLibrary(projects)
  return updated
}

export function deleteProject(id: string): void {
  const projects = loadLibrary().filter((p) => p.id !== id)
  saveLibrary(projects)
}

export function toggleWinner(id: string): SavedProject | null {
  const projects = loadLibrary()
  const idx = projects.findIndex((p) => p.id === id)
  if (idx === -1) return null
  projects[idx] = { ...projects[idx], isWinner: !projects[idx].isWinner }
  saveLibrary(projects)
  return projects[idx]
}

export function renameProject(id: string, name: string): SavedProject | null {
  const projects = loadLibrary()
  const idx = projects.findIndex((p) => p.id === id)
  if (idx === -1) return null
  projects[idx] = { ...projects[idx], name, lastEditedAt: Date.now() }
  saveLibrary(projects)
  return projects[idx]
}

// ── Z35 §9 — Duplicate + remix ─────────────────────────────────────────────

export interface DuplicateOptions {
  /** New name. Defaults to "<original> — copy" */
  name?: string
  /** Reset script (forces re-roll on next entry). Default false. */
  resetScript?: boolean
  /** Reset creator video render (keeps config + resets render output). Default false. */
  resetCreatorVideo?: boolean
  /** Reset all inserts. Default false. */
  resetInserts?: boolean
  /** Reset auto-edit plan. Default false. */
  resetAutoEdit?: boolean
  /** Reset hook variants (keeps script, drops variants — forces a fresh hook re-roll). */
  resetHookVariants?: boolean
  /** Reset CTA variations (kept on export-state side; this is just a copy-friendly hint). */
  resetCtaVariations?: boolean
}

/**
 * Z35 §9 — Duplicate a saved project. Optionally reset selected sections
 * to force re-generation while reusing everything else.
 *
 * Example: User picks "Vitamin B winner", duplicates with
 *   { resetCreatorVideo: true, resetInserts: false, resetScript: false }
 * → new project starts from the same script + same inserts, but the
 *   creator video is null so the user re-renders (different energy / setting).
 */
export function duplicateProject(
  sourceId: string,
  opts: DuplicateOptions = {},
): SavedProject | null {
  const src = getProjectById(sourceId)
  if (!src) return null
  const now = Date.now()

  // Deep-clone the snapshot
  const cloneSnapshot = {
    inputs: { ...src.snapshot.inputs },
    scriptBrain: opts.resetScript
      ? createEmptyScriptBrain()
      : opts.resetHookVariants
        ? { ...src.snapshot.scriptBrain, hookVariants: [], pickedHookIdx: -1 } as ScriptBrain
        : { ...src.snapshot.scriptBrain } as ScriptBrain,
    creatorVideoConfig: { ...src.snapshot.creatorVideoConfig } as CreatorVideoConfig,
    creatorVideo: opts.resetCreatorVideo
      ? null
      : src.snapshot.creatorVideo
        ? { ...src.snapshot.creatorVideo } as CreatorVideoClip
        : null,
    inserts: opts.resetInserts
      ? [] as ActionInsertClip[]
      : src.snapshot.inserts.map((it) => ({ ...it })) as ActionInsertClip[],
    autoEdit: opts.resetAutoEdit
      ? createEmptyAutoEditState()
      : { ...src.snapshot.autoEdit } as AutoEditState,
  }

  const dup: SavedProject = {
    id: makeId(),
    name: opts.name ?? `${src.name} — copy`,
    productName: src.productName,
    avatarName: src.avatarName,
    snapshot: cloneSnapshot,
    thumbRef: src.thumbRef,
    tags: [...src.tags],
    isWinner: false,
    createdAt: now,
    lastEditedAt: now,
  }

  const projects = loadLibrary()
  projects.push(dup)
  saveLibrary(projects)
  console.log(`[PROJECT_LIBRARY] duplicated "${src.name}" → "${dup.name}" (reset: ${JSON.stringify(opts)})`)
  return dup
}

/**
 * Z35 — Hydrate a SavedProject snapshot into a V3PipelineState shape.
 * Caller uses this to "load" a library project as the active project.
 */
export function hydrateProjectAsState(project: SavedProject): Partial<V3PipelineState> {
  return {
    inputs: { ...project.snapshot.inputs },
    scriptBrain: { ...project.snapshot.scriptBrain },
    creatorVideoConfig: { ...project.snapshot.creatorVideoConfig },
    creatorVideo: project.snapshot.creatorVideo ? { ...project.snapshot.creatorVideo } : null,
    inserts: project.snapshot.inserts.map((it) => ({ ...it })),
    autoEdit: { ...project.snapshot.autoEdit },
  }
}

/** Wipe the entire library. Only the dedicated "clear library" button calls this. */
export function clearAllProjects(): void {
  saveLibrary([])
}
