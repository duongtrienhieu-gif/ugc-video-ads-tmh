import { supabase } from '../lib/supabase'

// In-session signed URL cache (signed URLs valid 1 hour)
const urlCache = new Map<string, string>()

export function isAssetRef(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith('asset-')
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  }
  return map[mimeType] ?? mimeType.split('/')[1]?.split(';')[0] ?? 'bin'
}

// ── Local path cache (in-memory, per session) ─────────────────────────────────
// Avoids repeated DB queries for the same assetId within a session
const pathCache = new Map<string, string>()

// ── Save operations ───────────────────────────────────────────────────────────

export async function saveAsset(blob: Blob, mimeType?: string): Promise<string> {
  const userId = await getUserId()
  const assetId = `asset-${crypto.randomUUID()}`
  const mime = mimeType ?? blob.type ?? 'application/octet-stream'
  const ext = mimeToExt(mime)
  const path = `${userId}/${assetId}.${ext}`

  // 1. Upload binary to Supabase Storage
  const { error } = await supabase.storage.from('assets').upload(path, blob, {
    contentType: mime,
    upsert: false,
  })
  if (error) throw error

  // 2. Persist the assetId→path mapping to Supabase DB. P45: surface the
  //    error if the upsert fails — previously it was silently swallowed,
  //    which masked an "asset_paths table missing" misconfiguration: saves
  //    appeared to succeed (binary was uploaded), but the path mapping was
  //    never persisted, so cross-origin / cross-device path resolution
  //    silently fell back to the storage-list scan (Tier 4) on every read.
  //    We still don't THROW — the storage upload already landed and the
  //    save is technically complete — but a warn surfaces the issue so the
  //    user can fix the migration.
  const upsertResult = await supabase.from('asset_paths').upsert({ asset_id: assetId, user_id: userId, path })
  if (upsertResult.error) {
    console.warn('[assetStore.saveAsset] asset_paths upsert failed — path mapping not persisted; reads will fall back to storage-list scan. Likely cause: asset_paths table missing or RLS denies INSERT.', upsertResult.error)
  }

  // 3. Also cache locally for fast same-session lookups
  pathCache.set(assetId, path)
  saveLocalMap(assetId, path)

  return assetId
}

export async function saveFromDataUrl(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL')
  const mimeType = match[1]
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return saveAsset(blob, mimeType)
}

export async function saveBase64Asset(base64: string, mimeType: string): Promise<string> {
  const res = await fetch(`data:${mimeType};base64,${base64}`)
  const blob = await res.blob()
  return saveAsset(blob, mimeType)
}

export async function saveFromBlobUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl)
  const blob = await res.blob()
  return saveAsset(blob)
}

// ── Path resolution (3-tier: memory → localStorage → Supabase DB) ─────────────

async function resolvePath(assetId: string): Promise<string | null> {
  // Tier 1: in-memory cache (fastest, same session)
  const cached = pathCache.get(assetId)
  if (cached) return cached

  // Tier 2: localStorage (survives F5 but not cross-device, and NOT
  // cross-origin — switching from project A's vercel URL to project B's
  // resets this cache to empty)
  const local = getLocalPath(assetId)
  if (local) {
    pathCache.set(assetId, local)
    return local
  }

  // Tier 3: Supabase DB asset_paths table (survives anything — different
  // browser, device, after logout, cross-origin). Authoritative.
  try {
    const { data, error } = await supabase
      .from('asset_paths')
      .select('path')
      .eq('asset_id', assetId)
      .maybeSingle()

    if (error) {
      // P45 — surface the error instead of swallowing it silently. The
      // previous "table might not exist yet" comment masked an actual
      // misconfiguration (asset_paths schema missing on the new origin's
      // Supabase project, or RLS deny). With a warn, the user sees it in
      // F12 console and can fix the migration.
      console.warn('[assetStore.resolvePath] tier-3 (asset_paths) query failed for', assetId, '— falling back to storage-list scan. Likely cause: asset_paths table missing or RLS denies SELECT.', error)
    } else if (data?.path) {
      pathCache.set(assetId, data.path)
      saveLocalMap(assetId, data.path)
      return data.path
    }
  } catch (err) {
    console.warn('[assetStore.resolvePath] tier-3 (asset_paths) threw for', assetId, err)
  }

  // Tier 4: Storage list fallback (legacy: finds assets saved before
  // asset_paths was populated). Scans `<userId>/` folder for any file
  // whose name contains the assetId.
  try {
    const userId = await getUserId()
    const { data, error } = await supabase.storage.from('assets').list(userId, { search: assetId })
    if (error) {
      console.warn('[assetStore.resolvePath] tier-4 (storage.list) failed for', assetId, '— returning null; image will not load.', error)
    } else if (data && data.length > 0) {
      const path = `${userId}/${data[0].name}`
      // Backfill into DB so next lookup is instant
      const backfill = await supabase.from('asset_paths').upsert({ asset_id: assetId, user_id: userId, path })
      if (backfill.error) {
        console.warn('[assetStore.resolvePath] tier-4 backfill to asset_paths failed; cache will live in localStorage only.', backfill.error)
      }
      pathCache.set(assetId, path)
      saveLocalMap(assetId, path)
      return path
    } else {
      console.warn('[assetStore.resolvePath] tier-4 (storage.list) returned 0 results for', assetId, 'in folder', userId, '— the asset file is missing from Supabase Storage, OR you are signed in as a different user than the one who created this asset.')
    }
  } catch (err) {
    console.warn('[assetStore.resolvePath] tier-4 (storage.list) threw for', assetId, '— likely cause: not authenticated. supabase.auth.getUser() returned null.', err)
  }

  return null
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getBlob(assetId: string): Promise<Blob | null> {
  const path = await resolvePath(assetId)
  if (!path) return null
  const { data, error } = await supabase.storage.from('assets').download(path)
  if (error || !data) return null
  return data
}

export async function getUrl(assetId: string): Promise<string | null> {
  if (!isAssetRef(assetId)) return assetId

  const cached = urlCache.get(assetId)
  if (cached) return cached

  const path = await resolvePath(assetId)
  if (!path) return null

  const { data } = await supabase.storage.from('assets').createSignedUrl(path, 3600)
  if (data?.signedUrl) {
    urlCache.set(assetId, data.signedUrl)
    return data.signedUrl
  }
  return null
}

export async function getAsBase64(assetId: string): Promise<{ base64: string; mimeType: string } | null> {
  const blob = await getBlob(assetId)
  if (!blob) return null

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve({ base64, mimeType: blob.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ── List & Delete ─────────────────────────────────────────────────────────────

export async function getAllAssetIds(): Promise<string[]> {
  return Array.from(pathCache.keys())
}

export async function deleteAsset(assetId: string): Promise<void> {
  urlCache.delete(assetId)
  pathCache.delete(assetId)

  const path = getLocalPath(assetId) ?? pathCache.get(assetId)
  if (path) {
    await supabase.storage.from('assets').remove([path])
  }

  removeLocalPath(assetId)
  await supabase.from('asset_paths').delete().eq('asset_id', assetId)
}

// ── localStorage helpers (assetId → storagePath, per user) ───────────────────

function getMapKey(): string {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        const stored = localStorage.getItem(key)
        if (stored) {
          const parsed = JSON.parse(stored)
          const uid = parsed?.user?.id
          if (uid) return `asset-map-${uid}`
        }
      }
    }
  } catch { /* silent */ }
  return 'asset-map'
}

function getLocalPath(assetId: string): string | null {
  try {
    const raw = localStorage.getItem(getMapKey())
    const map: Record<string, string> = raw ? JSON.parse(raw) : {}
    return map[assetId] ?? null
  } catch {
    return null
  }
}

function saveLocalMap(assetId: string, path: string): void {
  try {
    const key = getMapKey()
    const raw = localStorage.getItem(key)
    const map: Record<string, string> = raw ? JSON.parse(raw) : {}
    map[assetId] = path
    localStorage.setItem(key, JSON.stringify(map))
  } catch { /* silent */ }
}

function removeLocalPath(assetId: string): void {
  try {
    const key = getMapKey()
    const raw = localStorage.getItem(key)
    if (!raw) return
    const map: Record<string, string> = JSON.parse(raw)
    delete map[assetId]
    localStorage.setItem(key, JSON.stringify(map))
  } catch { /* silent */ }
}
