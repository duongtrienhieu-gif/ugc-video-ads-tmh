// ── Hướng B — cắt clip THẬT bằng ffmpeg.wasm (chạy trong trình duyệt) ─────────
// Cắt 1 clip nguồn xuống đúng khúc [inSec, inSec+durSec] mà người dùng đã chấm
// điểm trong app, để bộ ZIP export ra đã là clip ngắn sẵn — khỏi cắt tay trong
// CapCut. Tái dùng singleton ffmpeg của video-builder (getFFmpeg/resetFFmpeg) —
// hạ tầng đã chạy production (same-origin core, COOP/COEP, serialize exec).
//
// 2 chế độ:
//   • 'fast'     : -c copy — chỉ cắt theo keyframe, rất nhanh (1-3s) nhưng điểm
//                  bắt đầu có thể lệch ~1-2s (nhảy về keyframe gần nhất).
//   • 'accurate' : re-encode libx264/aac — đúng từng frame; chậm hơn nhưng vì
//                  output chỉ ~4-5s nên vẫn nhanh (vài giây/clip).
// Lỗi codec (HEVC lạ, file hỏng) → trả {blob:null} để caller fallback clip gốc;
// đồng thời hard-reset worker để clip kế tiếp chạy trên worker sạch (tránh OOM
// làm hỏng toàn bộ phần export còn lại).

import { getFFmpeg, resetFFmpeg } from '../../video-builder/v3/services/ffmpegLoader'
import { fetchFile } from '@ffmpeg/util'

export type TrimMode = 'fast' | 'accurate'

export interface TrimResult {
  /** null → cắt thất bại, caller nên dùng clip gốc + ghi chú .CATLOI.txt. */
  blob: Blob | null
  error?: string
}

let seq = 0

export async function trimVideo(
  source: Blob,
  inSec: number,
  durSec: number,
  mode: TrimMode,
  onLog?: (msg: string) => void,
): Promise<TrimResult> {
  if (!(durSec > 0)) return { blob: null, error: 'Thời lượng cắt không hợp lệ' }
  const id = ++seq
  const inName = `trim_in_${id}.mp4`
  const outName = `trim_out_${id}.mp4`
  try {
    const ffmpeg = await getFFmpeg(onLog ? { onLog } : {})
    await ffmpeg.writeFile(inName, await fetchFile(source))

    const ss = Math.max(0, inSec).toFixed(2)
    const t = durSec.toFixed(2)
    // -ss trước -i = fast-seek (input seeking). Với -c copy: cắt theo keyframe.
    // Với re-encode: ffmpeg vẫn cho ra đúng frame (decode từ keyframe rồi bỏ).
    const args = mode === 'fast'
      ? ['-ss', ss, '-i', inName, '-t', t, '-c', 'copy', '-avoid_negative_ts', 'make_zero', outName]
      : ['-ss', ss, '-i', inName, '-t', t,
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-movflags', '+faststart', outName]

    await ffmpeg.exec(args)
    const data = await ffmpeg.readFile(outName)
    const u8 = data instanceof Uint8Array ? data : new Uint8Array()
    if (u8.byteLength === 0) throw new Error('Output rỗng (codec không hỗ trợ?)')
    // .slice() copies into a fresh (non-shared) ArrayBuffer → safe BlobPart even
    // when ffmpeg.wasm runs multi-thread (SharedArrayBuffer-backed views).
    const blob = new Blob([u8.slice().buffer as ArrayBuffer], { type: 'video/mp4' })

    try { await ffmpeg.deleteFile(inName) } catch { /* worker dọn sau cũng được */ }
    try { await ffmpeg.deleteFile(outName) } catch { /* */ }
    return { blob }
  } catch (e) {
    // Worker có thể đã chết (OOM / clip hỏng) → singleton vẫn loaded=true sẽ làm
    // mọi exec sau lỗi mãi. Hard-reset để clip kế chạy trên worker mới.
    await resetFFmpeg()
    return { blob: null, error: e instanceof Error ? e.message : String(e) }
  }
}
