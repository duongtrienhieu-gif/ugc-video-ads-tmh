// ── Tìm Source Video — service functions (V3) ───────────────────────────────
// V3 pivot: dropped Gemini fileData verify entirely (single video analysis
// burned 75-150K tokens — wiped daily quota in ~3 clicks). Source mix
// retargeted at UGC-native short content via YouTube `videoDuration=short`
// filter + TikTok. User self-filters by clicking cards in a new tab; AI
// ranks semantically, no claim of "verified content".
//
//   parseScript     ← 1 Gemini call (cached by script hash)
//   searchYouTube   ← 0 Gemini, shorts-biased (videoDuration=short, < 4min)
//   searchTikTok    ← 0 Gemini (tikwm + corsproxy fallback)
//   embeddingRank   ← 2 batched embedding calls TOTAL (cheap, 1500 RPM tier)
//
// Per fresh run: 1 Gemini Flash + 2 embedding. Cached re-run: 0 calls.
// Free tier 250 RPD → ~80 fresh runs/day, or unlimited cached re-runs.

import { classifyGemini429, geminiEmbedBatch, cosineSimilarity } from '../../utils/gemini'
import { cached, hash } from './cache'
import {
  ApiError, CONFIG, ERR,
  type Scene, type Link, type SearchResult, type RankedLink,
  type SourceId,
} from './types'

// ── Gemini call wrapper for STRUCTURED text (parseScript / verify). ─────────
// Embedding has its own retry / classify in geminiEmbedBatch.
async function callGemini(apiKey: string, body: unknown, signal: AbortSignal, model = 'gemini-2.5-flash'): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const MAX_ATTEMPTS = 6
  const BASE_DELAY_MS = 2000
  const FACTOR = 1.7
  let lastErr = ''
  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
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
      if (attempt === MAX_ATTEMPTS) {
        throw new ApiError(ERR.GEMINI_FAIL, `Gemini rate-limit kéo dài (đã thử ${MAX_ATTEMPTS + 1} lần)`)
      }
      const delay = retryDelayMs ?? (BASE_DELAY_MS * Math.pow(FACTOR, attempt) + Math.random() * 1000)
      await new Promise(r => setTimeout(r, delay))
      continue
    }

    const retryable = [500, 502, 503, 504].includes(res.status) || /UNAVAILABLE|overload/i.test(lastErr)
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new ApiError(ERR.GEMINI_FAIL, `Gemini ${res.status}: ${lastErr.slice(0, 200)}`)
    }
    const delay = BASE_DELAY_MS * Math.pow(FACTOR, attempt) + Math.random() * 1000
    await new Promise(r => setTimeout(r, delay))
  }
  throw new ApiError(ERR.GEMINI_FAIL, `Gemini failed after ${MAX_ATTEMPTS + 1} attempts: ${lastErr.slice(0, 200)}`)
}

// ── Map error code from utils/gemini.ts shape → app's ApiError taxonomy. ────
function mapEmbedError(err: unknown): never {
  const code = (err as { code?: string })?.code
  if (code === 'QUOTA_DAILY') throw new ApiError(ERR.QUOTA_GEMINI, 'Gemini free tier embedding quota đã cạn')
  if (code === 'RATE_LIMIT') throw new ApiError(ERR.GEMINI_FAIL, 'Embedding rate-limit')
  if ((err as Error)?.name === 'AbortError') throw new ApiError(ERR.ABORTED, 'Đã hủy')
  throw new ApiError(ERR.GEMINI_FAIL, (err as Error)?.message || 'Embedding failed')
}

// ── Step 1: Parse script → scenes (CACHED) ──────────────────────────────────
export async function parseScript(apiKey: string, script: string, signal: AbortSignal): Promise<Scene[]> {
  return cached(`parse:${hash(script)}`, CONFIG.cache.parseScriptTtlMs, async () => {
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
  })
}

// ── Step 2a: YouTube Data API (CACHED, includes description, SHORTS-biased) ─
// videoDuration=short → filters to videos < 4 minutes. Biases results toward
// YouTube Shorts + short-form UGC content where actual scene-specific B-roll
// lives, instead of 15-min explainer videos that match topic but not scene.
export async function searchYouTube(apiKey: string, query: string, signal: AbortSignal): Promise<SearchResult> {
  return cached(`yt:short:${hash(query)}`, CONFIG.cache.searchTtlMs, async () => {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&maxResults=${CONFIG.search.ytMaxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`
    let res: Response
    try {
      res = await fetch(url, { signal })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw new ApiError(ERR.ABORTED, 'Đã hủy')
      throw err
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => null) as { error?: { message?: string; errors?: Array<{ reason?: string }> } } | null
      const msg = errBody?.error?.message || `YouTube API ${res.status}`
      const reasons = (errBody?.error?.errors || []).map(e => e.reason)
      const isQuota = res.status === 403 && reasons.some(r => r === 'quotaExceeded' || r === 'dailyLimitExceeded' || r === 'rateLimitExceeded')
      throw new ApiError(isQuota ? ERR.QUOTA_YOUTUBE : ERR.YOUTUBE_FAIL, msg)
    }
    const data = await res.json() as {
      items?: Array<{
        id?: { videoId?: string }
        snippet?: {
          title?: string
          description?: string
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
          channelTitle?: string
        }
      }>
    }
    const links: Link[] = (data.items || []).map(item => ({
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      domain: 'youtube.com',
      meta: item.snippet?.channelTitle,
    }))
    return { source: 'youtube', links }
  })
}

// ── Step 2b: TikTok via tikwm.com (CACHED) ──────────────────────────────────
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
  return cached(`tt:${hash(query)}`, CONFIG.cache.searchTtlMs, async () => {
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
        if (!uniqueId || !videoId) return null
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
  })
}

// ── Step 3: Embedding-based rank (REPLACES old Gemini rankLinks call) ───────
// For each scene, embed the visualIntent ONCE and the link signals ONCE.
// Cosine similarity → 0-100 score. YouTube cards get title+description (richer
// signal); TikTok cards only have title.
//
// This whole step uses TWO batched embedding calls TOTAL for the entire run
// (regardless of scene/link count), versus 10 Gemini calls in the old design.

interface EmbedRankInput {
  scenes: Scene[]
  /** Map sceneIdx → links collected for that scene */
  linksPerScene: Array<Array<Link & { source: SourceId }>>
}

export async function embeddingRank(
  apiKey: string,
  input: EmbedRankInput,
  signal: AbortSignal,
): Promise<RankedLink[][]> {
  const { scenes, linksPerScene } = input

  // Build doc strings — YouTube includes description, TikTok title only.
  const docTexts: string[] = []
  const docIndex: Array<{ sceneIdx: number; linkIdx: number }> = []
  linksPerScene.forEach((links, sceneIdx) => {
    links.forEach((link, linkIdx) => {
      const text = link.source === 'youtube' && link.description
        ? `${link.title}\n\n${link.description.slice(0, 600)}`
        : link.title
      docTexts.push(text)
      docIndex.push({ sceneIdx, linkIdx })
    })
  })

  if (docTexts.length === 0) return scenes.map(() => [])

  // Cache embeddings by hashed text — same title across scenes only embed once,
  // and re-runs of the same script hit the cache fully.
  const queryTexts = scenes.map(s => s.visualIntent)
  const queryCacheKeys = queryTexts.map(t => `emb:q:${hash(t)}`)
  const docCacheKeys = docTexts.map(t => `emb:d:${hash(t)}`)

  // Try to satisfy from cache; collect uncached texts for one batch call each.
  const queryVecs: (number[] | null)[] = queryCacheKeys.map(k => {
    try { return JSON.parse(localStorage.getItem('ugc-lab:tim-source-video:cache:v1:' + k) || 'null')?.v ?? null }
    catch { return null }
  })
  const docVecs: (number[] | null)[] = docCacheKeys.map(k => {
    try { return JSON.parse(localStorage.getItem('ugc-lab:tim-source-video:cache:v1:' + k) || 'null')?.v ?? null }
    catch { return null }
  })

  const missingQueries = queryTexts.map((t, i) => ({ t, i })).filter(x => queryVecs[x.i] === null)
  const missingDocs = docTexts.map((t, i) => ({ t, i })).filter(x => docVecs[x.i] === null)

  try {
    if (missingQueries.length > 0) {
      const vecs = await geminiEmbedBatch({
        apiKey,
        texts: missingQueries.map(x => x.t),
        taskType: 'RETRIEVAL_QUERY',
        signal,
      })
      missingQueries.forEach((x, j) => {
        queryVecs[x.i] = vecs[j] || []
        try {
          localStorage.setItem(
            'ugc-lab:tim-source-video:cache:v1:' + queryCacheKeys[x.i],
            JSON.stringify({ v: vecs[j] || [], exp: Date.now() + CONFIG.cache.embeddingTtlMs }),
          )
        } catch { /* ignore */ }
      })
    }
    if (missingDocs.length > 0) {
      const vecs = await geminiEmbedBatch({
        apiKey,
        texts: missingDocs.map(x => x.t),
        taskType: 'RETRIEVAL_DOCUMENT',
        signal,
      })
      missingDocs.forEach((x, j) => {
        docVecs[x.i] = vecs[j] || []
        try {
          localStorage.setItem(
            'ugc-lab:tim-source-video:cache:v1:' + docCacheKeys[x.i],
            JSON.stringify({ v: vecs[j] || [], exp: Date.now() + CONFIG.cache.embeddingTtlMs }),
          )
        } catch { /* ignore */ }
      })
    }
  } catch (err) {
    mapEmbedError(err)
  }

  // Score per (scene, link) by cosine similarity. Scale 0-100 (cosine 0.0-1.0).
  const result: RankedLink[][] = scenes.map(() => [])
  docIndex.forEach((idx, docPos) => {
    const qv = queryVecs[idx.sceneIdx] || []
    const dv = docVecs[docPos] || []
    const sim = cosineSimilarity(qv, dv)
    const score = Math.round(Math.max(0, Math.min(1, sim)) * 100)
    const link = linksPerScene[idx.sceneIdx][idx.linkIdx]
    result[idx.sceneIdx].push({
      ...link,
      score,
      reason: '',
      _cardId: `s${idx.sceneIdx}_${docPos}`,
    })
  })

  // Filter + sort per scene
  return result.map(arr =>
    arr
      .filter(l => l.score >= CONFIG.rank.minScoreShow)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.rank.maxCardsPerScene),
  )
}

// ── Concurrency limiter (still useful for parallel adapter dispatch) ────────
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
