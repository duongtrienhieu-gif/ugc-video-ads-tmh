// ── Exported-video library (P6y) ─────────────────────────────────────────────
// A persisted list of FINAL assembled videos ONLY — never the individual broll / lips
// scene clips. Lives in its OWN localStorage key (NOT the pipeline STORAGE_KEY), so it
// SURVIVES "Tạo lại từ đầu" (which wipes the pipeline). The video binary itself stays in
// Supabase Storage (assetStore); this only keeps the asset ref + metadata so a forgotten
// download is always one click away — re-download is 0 credit.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportedVideo {
  id: string
  /** assetStore ref of the assembled MP4 (asset-…). */
  assetRef: string
  productName: string
  lang: string
  resolution: string
  createdAt: number
}

const KEY = 'v3_exported_videos'
const CAP = 60   // keep the most recent 60; older drop off (file stays in Storage regardless)

function load(): ExportedVideo[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? (arr as ExportedVideo[]) : []
  } catch { return [] }
}

function save(list: ExportedVideo[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))) } catch { /* quota — ignore */ }
}

/** Newest first. */
export function getExportedVideos(): ExportedVideo[] {
  return load().sort((a, b) => b.createdAt - a.createdAt)
}

/** Record a freshly-assembled FINAL video. De-dupes by assetRef so a re-assemble of the
 *  SAME ref (e.g. "Ghép lại" producing an identical ref) never doubles the entry. */
export function addExportedVideo(v: Omit<ExportedVideo, 'id' | 'createdAt'>): void {
  if (!v.assetRef) return
  const list = load()
  if (list.some((x) => x.assetRef === v.assetRef)) return
  list.unshift({
    ...v,
    productName: v.productName?.trim() || 'Sản phẩm',
    id: `exv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  })
  save(list)
}

/** Remove an entry from the library list (does NOT delete the file in Storage). */
export function deleteExportedVideo(id: string): void {
  save(load().filter((x) => x.id !== id))
}
