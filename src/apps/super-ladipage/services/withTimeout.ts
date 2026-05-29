// ─────────────────────────────────────────────────────────────────────
// withTimeout — wrap any Promise with a hard timeout.
//
// Problem: directGeminiText / directGeminiVision không có fetch timeout.
// Khi Gemini overload, request treo → UI spinner mãi.
//
// Fix: wrap Promise + race với timeout. Sau Nms, reject với message rõ.
// ─────────────────────────────────────────────────────────────────────

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timeout sau ${Math.round(ms / 1000)}s — Gemini có thể đang quá tải, vui lòng thử lại.`))
    }, ms)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    if (timer) clearTimeout(timer)
    return result
  } catch (err) {
    if (timer) clearTimeout(timer)
    throw err
  }
}
