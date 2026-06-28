// ── Mode 3 — Thư viện video (P2e) ────────────────────────────────────────────
// Lưu video hoàn chỉnh (đã ghép) để không mất sau khi tải. Cache localStorage (nhanh,
// offline) + sync Supabase user_outputs (đa thiết bị, theo nhân viên). userOutputsAPI
// degrade an toàn (chưa login / chưa chạy migration → vẫn chạy localStorage).
// ─────────────────────────────────────────────────────────────────────────────

import { listOutputs, createOutput, deleteOutput } from '../../../services/userOutputsAPI'

export interface LibVideo {
  id: string
  title: string
  /** assetStore ref của file mp4 cuối (Supabase Storage) — getUrl() ra URL phát/tải. */
  videoRef: string
  market: 'VN' | 'MY'
  sceneCount: number
  totalSec: number
  createdAt: number
}

const LS_KEY = 'personified-library-v1'
const KIND = 'personified-video' as const

function readLocal(): LibVideo[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as LibVideo[] } catch { return [] }
}
function writeLocal(list: LibVideo[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)) } catch { /* quota — non-fatal */ }
}

/** Danh sách local (mới nhất trước) — dùng ngay khi mount. */
export function getLibraryLocal(): LibVideo[] {
  return readLocal().slice().sort((a, b) => b.createdAt - a.createdAt)
}

/** Kéo từ cloud (nếu được) → ghi đè cache → trả danh sách. Lỗi/chưa login → giữ local. */
export async function syncLibrary(): Promise<LibVideo[]> {
  const cloud = await listOutputs<LibVideo>(KIND)
  if (cloud) {
    writeLocal(cloud)
    return cloud.slice().sort((a, b) => b.createdAt - a.createdAt)
  }
  return getLibraryLocal()
}

/** Thêm 1 video vào thư viện (local trước cho nhanh, rồi đẩy cloud). */
export async function addToLibrary(item: LibVideo): Promise<void> {
  writeLocal([item, ...readLocal().filter((v) => v.id !== item.id)])
  await createOutput(KIND, item, item.title)
}

/** Xoá khỏi thư viện (local + cloud). */
export async function removeFromLibrary(id: string): Promise<void> {
  writeLocal(readLocal().filter((v) => v.id !== id))
  await deleteOutput(KIND, id)
}
