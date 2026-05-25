// ── Tìm Source Video — service functions ─────────────────────────────────────
// All Gemini / YouTube / TikTok / Web API calls. Each adapter throws ApiError
// with a stable code so the React layer's banner classifier can branch cleanly.
// Signal-aware: passing a fresh AbortController.signal lets the UI cancel
// in-flight requests via the Hủy button.

import { searchWithGrounding, classifyGemini429 } from '../../utils/gemini'
import {
  ApiError, CONFIG, ERR,
  type Scene, type Link, type SearchResult, type RankedLink,
  type TimestampResult, type SourceId,
} from './types'

// ── Gemini call wrapper: retry on transient 429/5xx, ApiError on failure ────
// Gemini's 429 has TWO distinct meanings:
//   • Per-minute rate-limit (free tier = 10 RPM) — RECOVERABLE, retry with
//     backoff. Response usually carries RetryInfo with a retryDelay hint.
//   • Per-day token / request quota — NOT recoverable until midnight PT.
// We MUST distinguish these by parsing error.details[].violations[].quotaId
// — see classifyGemini429() in utils/gemini.ts (shared with searchWithGrounding
// so per-minute rate-limits never get surfaced as daily-quota banners).
async function callGemini(apiKey: string, body: unknown, signal: AbortSignal, model = 'gemini-2.5-flash'): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const { maxAttempts, baseDelayMs, factor } = CONFIG.retry
  let lastErr = ''
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    if (signal.aborted) throw new ApiError(ERR.ABORTED, 'Đã hủy')
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw new ApiError(ERR.ABORTED, 'Đã hủy')
      throw err
    }
    if (res.ok) return res.json()
    lastErr = await res.text().catch(() => '')

    if (res.status === 429) {
      const { isDailyExhausted, retryDelayMs } = classifyGemini429(lastErr)
      if (isDailyExhausted) throw new ApiError(ERR.QUOTA_GEMINI, 'Gemini free tier (250 req/day) đã cạn')
      if (attempt === maxAttempts) {
        // Exhausted retries on a per-minute 429 — surface as generic fail (NOT QUOTA banner)
        throw new ApiError(ERR.GEMINI_FAIL, `Gemini rate-limit kéo dài (đã thử ${maxAttempts + 1} lần): ${lastErr.slice(0, 200)}`)
      }
      const delay = retryDelayMs ?? (baseDelayMs * Math.pow(factor, attempt) + Math.random() * 1000)
      await new Promise(r => setTimeout(r, delay))
      continue
    }

    const retryable = [500, 502, 503, 504].includes(res.status) || /UNAVAILABLE|overload/i.test(lastErr)
    if (!retryable || attempt === maxAttempts) {
      throw new ApiError(ERR.GEMINI_FAIL, `Gemini ${res.status}: ${lastErr.slice(0, 200)}`)
    }
    const delay = baseDelayMs * Math.pow(factor, attempt) + Math.random() * 1000
    await new Promise(r => setTimeout(r, delay))
  }
  throw new ApiError(ERR.GEMINI_FAIL, `Gemini failed after ${maxAttempts + 1} attempts: ${lastErr.slice(0, 200)}`)
}

// ── Step 1: Parse script → scenes ───────────────────────────────────────────
export async function parseScript(apiKey: string, script: string, signal: AbortSignal): Promise<Scene[]> {
  const prompt = `Bạn là chuyên gia phân tích kịch bản UGC bán hàng. Hãy tách kịch bản dưới đây thành các SCENE (mỗi câu thoại = 1 scene, trừ khi 2 câu liền cùng nói về 1 visual thì gộp lại).

Với mỗi scene, trả về object với các field:
- "line": câu thoại gốc tiếng Việt (giữ nguyên)
- "visualIntent": 1 câu tiếng Việt mô tả CỤ THỂ hình ảnh/video cần để minh họa. Focus vào visual concept, KHÔNG lặp lại nội dung text. Ví dụ tốt: "Cảnh 3D mạch máu được làm sạch, các phân tử cholesterol bị cuốn trôi". Ví dụ tệ: "Nói về tác dụng giảm cholesterol".
- "keywordVi": 2-4 từ khóa tiếng Việt để search (cách nhau dấu cách)
- "keywordEn": 2-4 từ khóa tiếng Anh để search YouTube/web (cách nhau dấu cách)

Trả về JSON array thuần, không kèm text khác.

Kịch bản:
${script}`

  const data = await callGemini(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            line:         { type: 'string' },
            visualIntent: { type: 'string' },
            keywordVi:    { type: 'string' },
            keywordEn:    { type: 'string' },
          },
          required: ['line', 'visualIntent', 'keywordVi', 'keywordEn'],
        },
      },
    },
  }, signal) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new ApiError(ERR.PARSE_FAIL, 'Gemini không trả về kết quả parse')
  try { return JSON.parse(text) as Scene[] }
  catch { throw new ApiError(ERR.PARSE_FAIL, 'Gemini trả về JSON không hợp lệ') }
}

// ── Step 2a: YouTube Data API ───────────────────────────────────────────────
export async function searchYouTube(apiKey: string, query: string, signal: AbortSignal): Promise<SearchResult> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${CONFIG.search.ytMaxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new ApiError(ERR.ABORTED, 'Đã hủy')
    throw err
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string; errors?: Array<{ reason?: string }> } } | null
    const msg = body?.error?.message || `YouTube API ${res.status}`
    const reasons = (body?.error?.errors || []).map(e => e.reason)
    const isQuota = res.status === 403 && reasons.some(r => r === 'quotaExceeded' || r === 'dailyLimitExceeded' || r === 'rateLimitExceeded')
    throw new ApiError(isQuota ? ERR.QUOTA_YOUTUBE : ERR.YOUTUBE_FAIL, msg)
  }
  const data = await res.json() as {
    items?: Array<{
      id?: { videoId?: string }
      snippet?: {
        title?: string
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
        channelTitle?: string
      }
    }>
  }
  const links: Link[] = (data.items || []).map(item => ({
    url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    title: item.snippet?.title || '',
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
    domain: 'youtube.com',
    meta: item.snippet?.channelTitle,
  }))
  return { source: 'youtube', links }
}

// ── Step 2b: TikTok via tikwm.com (direct + corsproxy fallback) ─────────────
async function fetchTikwm(keyword: string, signal: AbortSignal): Promise<unknown> {
  const target = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(keyword)}&count=8&cursor=0&web=1`
  try {
    const res = await fetch(target, { signal })
    if (res.ok) {
      const data = await res.json() as { code?: number; data?: unknown }
      if (data && (data.code === 0 || data.data)) return data
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new ApiError(ERR.ABORTED, 'Đã hủy')
  }
  const proxy = `https://corsproxy.io/?${encodeURIComponent(target)}`
  const res = await fetch(proxy, { signal })
  if (!res.ok) throw new Error(`tikwm proxy ${res.status}`)
  return res.json()
}

export async function searchTikTok(query: string, signal: AbortSignal): Promise<SearchResult> {
  // ONLY tikwm.com — no Gemini fallback (returns garbage data otherwise).
  try {
    const data = await fetchTikwm(query, signal) as { data?: { videos?: Array<{
      author?: { unique_id?: string; nickname?: string }
      video_id?: string; aweme_id?: string
      title?: string
      cover?: string; origin_cover?: string; ai_dynamic_cover?: string
    }> } }
    const videos = data?.data?.videos || []
    const links: Link[] = videos.slice(0, CONFIG.search.tiktokCount).map((v): Link | null => {
      const uniqueId = v.author?.unique_id
      const videoId = v.video_id || v.aweme_id
      if (!uniqueId || !videoId) return null  // skip entries without valid identity
      return {
        url: `https://www.tiktok.com/@${uniqueId}/video/${videoId}`,
        title: (v.title || v.author?.nickname || 'TikTok video').slice(0, 120),
        thumbnail: v.cover || v.origin_cover || v.ai_dynamic_cover,
        domain: 'tiktok.com',
        meta: `@${uniqueId}`,
      }
    }).filter((l): l is Link => l !== null)
    return { source: 'tiktok', links }
  } catch (err) {
    if ((err as ApiError)?.code === ERR.ABORTED) throw err
    console.warn('tikwm failed (returning empty TikTok results):', (err as Error)?.message)
    return { source: 'tiktok', links: [] }
  }
}

// ── Step 2c: Web search via Gemini Google Search grounding ──────────────────
const BAD_DOMAIN_RE = /^(shutterstock|gettyimages|istockphoto|envato|vecteezy|123rf|dreamstime|fotolia|stockfresh|alamy|depositphotos|adobe\.stock|ebay|walmart|amazon|aliexpress|alibaba|shopee|temu|target|bestbuy|reddit|quora|pinterest)\.[a-z.]+$/i
const BARE_DOMAIN_RE = /^[a-z0-9-]+\.[a-z]{2,}(\.[a-z]{2,})?$/i

export async function searchWeb(apiKey: string, intent: string, signal: AbortSignal): Promise<SearchResult> {
  const prompt = `Bạn cần TÌM TRÊN INTERNET các video / clip / animation phù hợp để MINH HỌA cho concept hình ảnh sau:

"${intent}"

Yêu cầu QUAN TRỌNG:
1. CHỈ tìm trang có VIDEO play được — TikTok video, Vimeo, Pinterest video pin, YouTube Shorts, stock video sites (videvo, mixkit, coverr, motionarray, storyblocks free preview), blog có embed video. TUYỆT ĐỐI KHÔNG tìm article text / Wikipedia / Quora.
2. ĐA DẠNG NGUỒN — không chỉ YouTube. Cố tìm ít nhất 2 platform khác YouTube (ưu tiên TikTok, Vimeo, stock sites).
3. URL phải là TRANG CHI TIẾT của 1 video cụ thể, không phải homepage hay search results.
4. Tìm CHỈ ${CONFIG.search.webMaxLinks} link chất lượng cao (ưu tiên relevance hơn số lượng).`

  let result: { narrative: string; chunks: Array<{ uri: string; title?: string }> }
  try {
    result = await searchWithGrounding({ apiKey, prompt, signal })
  } catch (err) {
    // searchWithGrounding now throws Error with `.code` indicating intent.
    // 'ABORTED' → cancel; 'QUOTA_DAILY' → daily exhausted (fatal banner);
    // anything else → generic fail (post-retry rate-limit, parse errors, etc).
    const code = (err as { code?: string })?.code
    if (code === 'ABORTED' || (err as Error)?.name === 'AbortError') throw new ApiError(ERR.ABORTED, 'Đã hủy')
    if (code === 'QUOTA_DAILY') throw new ApiError(ERR.QUOTA_GEMINI, 'Gemini free tier (250 req/day) đã cạn')
    throw new ApiError(ERR.GEMINI_FAIL, (err as Error)?.message || 'Web search failed')
  }

  const seen = new Set<string>()
  const links: Link[] = []
  for (const c of result.chunks) {
    if (!c.uri || seen.has(c.uri)) continue
    if (links.length >= CONFIG.search.webMaxLinks) break
    seen.add(c.uri)
    let domain = ''
    try { domain = new URL(c.uri).hostname.replace(/^www\./, '') } catch { /* ignore */ }
    const title = (c.title || domain || c.uri).trim()
    if (/^youtube\.com$|^youtu\.be$/i.test(title)) continue   // already covered by YT API
    if (BAD_DOMAIN_RE.test(title)) continue
    if (BARE_DOMAIN_RE.test(title)) continue
    links.push({ url: c.uri, title, domain })
  }
  return { source: 'web', links }
}

// ── Step 2d: Rank all collected links by relevance ──────────────────────────
export async function rankLinks(apiKey: string, intent: string, links: Array<Link & { source: SourceId }>, signal: AbortSignal): Promise<RankedLink[]> {
  if (!links.length) return []
  const items = links.map((l, i) => `${i}. [${l.source}/${l.domain || ''}] ${l.title || ''}`).join('\n')
  const prompt = `Concept hình ảnh cần tìm: "${intent}"

Danh sách nguồn video tìm được (ID + nguồn + tiêu đề):
${items}

Chấm điểm MỖI link 0-100 theo độ phù hợp. ÁP DỤNG NGHIÊM NGẶT các rule sau:

PHẠT MẠNH (score 0-15):
- E-commerce listing: ebay, walmart, amazon, shopee, aliexpress, alibaba, temu, target, bestbuy → không phải video content, là trang bán hàng.
- Homepage / category / search result page: title chỉ là tên domain (vd "shutterstock.com", "vecteezy.com") hoặc generic ("Stock Photos & Videos", "Royalty-free images") — KHÔNG dẫn tới 1 video cụ thể.
- Anti-bot / verification pages: "Verification Required", "Robot or human", "Cloudflare", "Access denied".
- Link không liên quan rõ tới concept.

CHẤM CAO (70-100):
- Title nói RÕ về 1 video/clip CỤ THỂ liên quan tới concept.
- 90-100: chắc chắn chứa cảnh y hệt concept.
- 70-89: rất phù hợp, đa số match.

TRUNG BÌNH (30-69):
- Có liên quan đến chủ đề chung nhưng chưa chắc match cảnh.

Trả JSON array [{id, score, reason}]. Reason là 1 câu ngắn (< 15 từ) tiếng Việt giải thích vì sao score đó.`

  try {
    const data = await callGemini(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'integer' }, score: { type: 'integer' }, reason: { type: 'string' } },
            required: ['id', 'score'],
          },
        },
      },
    }, signal) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    const scores = JSON.parse(text || '[]') as Array<{ id: number; score: number; reason?: string }>
    const map = new Map(scores.map(s => [s.id, s]))
    return links
      .map((l, i): RankedLink => ({
        ...l,
        score: map.get(i)?.score ?? 50,
        reason: map.get(i)?.reason || '',
        _cardId: '',  // filled by caller
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
  } catch (err) {
    if ((err as ApiError)?.code === ERR.QUOTA_GEMINI || (err as ApiError)?.code === ERR.QUOTA_YOUTUBE || (err as ApiError)?.code === ERR.ABORTED) throw err
    // Fallback: source priority
    return links
      .map((l): RankedLink => ({
        ...l,
        score: CONFIG.rank.fallbackPriority[l.source] ?? 50,
        reason: '(rank fail — sort theo nguồn)',
        _cardId: '',
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
  }
}

// ── Step 3: Analyze YouTube video for timestamps matching the scene intent ──
export async function analyzeYouTubeTimestamp(apiKey: string, youtubeUrl: string, intent: string, signal: AbortSignal): Promise<TimestampResult> {
  const prompt = `Phân tích video YouTube này. Tôi cần tìm các ĐOẠN (timestamps) trong video có chứa cảnh sau:

"${intent}"

Yêu cầu:
- Nếu video CÓ chứa cảnh đó → liệt kê các đoạn timestamp (định dạng MM:SS hoặc HH:MM:SS) và mô tả ngắn (1 câu) mỗi đoạn.
- Nếu video KHÔNG chứa cảnh phù hợp → trả về found: false và summary giải thích video thật sự nói về gì.
- TUYỆT ĐỐI KHÔNG bịa timestamp. Chỉ liệt kê đoạn bạn thực sự thấy trong video.
- Mỗi đoạn nên 3-15 giây, đủ để dùng cho UGC edit.`

  const data = await callGemini(apiKey, {
    contents: [{
      parts: [
        { fileData: { fileUri: youtubeUrl } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          found: { type: 'boolean' },
          timestamps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start:       { type: 'string' },
                end:         { type: 'string' },
                description: { type: 'string' },
              },
              required: ['start', 'end', 'description'],
            },
          },
          summary: { type: 'string' },
        },
        required: ['found', 'summary'],
      },
    },
  }, signal) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new ApiError(ERR.PARSE_FAIL, 'Gemini không trả kết quả phân tích video')
  try { return JSON.parse(text) as TimestampResult }
  catch { throw new ApiError(ERR.PARSE_FAIL, 'Gemini trả JSON phân tích không hợp lệ') }
}

// ── Concurrency limiter ─────────────────────────────────────────────────────
export async function processWithConcurrency<T>(items: T[], fn: (item: T) => Promise<void>, limit: number): Promise<void> {
  const queue = [...items]
  const workers: Promise<void>[] = []
  const workerCount = Math.min(limit, queue.length)
  for (let i = 0; i < workerCount; i++) {
    workers.push((async () => {
      while (queue.length) {
        const item = queue.shift()
        if (item !== undefined) await fn(item)
      }
    })())
  }
  await Promise.all(workers)
}

// ── Helper: convert MM:SS or HH:MM:SS to seconds ────────────────────────────
export function parseTimeToSeconds(t: string): number {
  const parts = String(t).split(':').map(s => parseInt(s, 10) || 0)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}
