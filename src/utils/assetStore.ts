import { supabase } from '../lib/supabase'

// Signed URL cache — reuse within session (signed URLs valid 1 hour)
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

// ── Save operations ───────────────────────────────────────────────────────────

export async function saveAsset(blob: Blob, mimeType?: string): Promise<string> {
  const userId = await getUserId()
  const assetId = `asset-${crypto.randomUUID()}`
  const mime = mimeType ?? blob.type ?? 'application/octet-stream'
  const ext = mimeToExt(mime)
  const path = `${userId}/${assetId}.${ext}`

  const { error } = await supabase.storage.from('assets').upload(path, blob, {
    contentType: mime,
    upsert: false,
  })
  if (error) throw error

  const map = getLocalMap()
  map[assetId] = path
  saveLocalMap(map)

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

// ── Read operations ───────────────────────────────────────────────────────────

async function resolvePath(assetId: string): Promise<string | null> {
  const map = getLocalMap()
  if (map[assetId]) return map[assetId]

  // Not in local map — search Storage (happens when user logs in on new device)
  try {
    const userId = await getUserId()
    const { data } = await supabase.storage.from('assets').list(userId, { search: assetId })
    if (data && data.length > 0) {
      const path = `${userId}/${data[0].name}`
      const m = getLocalMap()
      m[assetId] = path
      saveLocalMap(m)
      return path
    }
  } catch {
    // silent
  }
  return null
}

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
  return Object.keys(getLocalMap())
}

export async function deleteAsset(assetId: string): Promise<void> {
  urlCache.delete(assetId)

  const map = getLocalMap()
  const path = map[assetId]
  if (path) {
    await supabase.storage.from('assets').remove([path])
    delete map[assetId]
    saveLocalMap(map)
  }
}

// ── Local map helpers (assetId → storagePath) ────────────────────────────────

function getLocalMapKey(): string {
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

function getLocalMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(getLocalMapKey())
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalMap(map: Record<string, string>) {
  localStorage.setItem(getLocalMapKey(), JSON.stringify(map))
}
