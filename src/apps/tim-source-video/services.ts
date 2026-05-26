// ── Tìm Source Video — service functions (V3.1) ─────────────────────────────
// V3.1 adds:
//   • Script language detection (vi/en/ms) in parseScript
//   • Multi-language keyword extraction (keywordVi + keywordEn + keywordMs)
//   • Dual-language YouTube search (English for global reach + native for
//     audience-aligned UGC) with videoId-based dedupe
//   • Transcript fetch via Vercel serverless function /api/yt-transcript
//   • Per-language transcript phrase matching (transcriptMatcher.ts)
//   • Embedding rerank now consumes (title + description + transcript hits)
//     for richer semantic signal — videos with matched spoken content rank
//     significantly higher
//
// Pipeline cost per fresh run unchanged: 1 Gemini Flash + 2-3 embedding batch.
// New: ~N transcript fetches via Vercel (free tier 100K/month).

import { classifyGemini429, geminiEmbedBatch, cosineSimilarity } from '../../utils/gemini'
import { cached, hash } from './cache'
import { matchTranscript } from './transcriptMatcher'
import {
  ApiError, CONFIG, ERR,
  type Scene, type Link, type SearchResult, type RankedLink,
  type SourceId, type ScriptLang, type ParseResult,
  type TranscriptSnippet, type TranscriptHit,
} from './types'

// ── Gemini call wrapper for STRUCTURED text (parseScript). ──────────────────
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

function mapEmbedError(err: unknown): never {
  const code = (err as { code?: string })?.code
  if (code === 'QUOTA_DAILY') throw new ApiError(ERR.QUOTA_GEMINI, 'Gemini free tier embedding quota đã cạn')
  if (code === 'RATE_LIMIT') throw new ApiError(ERR.GEMINI_FAIL, 'Embedding rate-limit')
  if (code === 'ABORTED' || (err as Error)?.name === 'AbortError') throw new ApiError(ERR.ABORTED, 'Đã hủy')
  throw new ApiError(ERR.GEMINI_FAIL, (err as Error)?.message || 'Embedding failed')
}

// ── Step 1: Parse script → scenes (multi-lang, CACHED) ──────────────────────
export async function parseScript(apiKey: string, script: string, signal: AbortSignal): Promise<ParseResult> {
  return cached(`parse:v2:${hash(script)}`, CONFIG.cache.parseScriptTtlMs, async () => {
    const prompt = `Bạn là chuyên gia phân tích kịch bản UGC bán hàng.

ĐẦU TIÊN: phát hiện ngôn ngữ của kịch bản. Chỉ trả về 1 trong: "vi" (Vietnamese), "en" (English), "ms" (Malay).

SAU ĐÓ: tách kịch bản thành các SCENE (mỗi câu thoại = 1 scene, trừ khi 2 câu liền cùng nói về 1 visual thì gộp lại).

Với mỗi scene, trả về object với các field:
- "line": câu thoại gốc (giữ nguyên ngôn ngữ kịch bản)
- "visualIntent": 1 câu tiếng Việt mô tả CỤ THỂ hình ảnh/video cần để minh họa. Focus vào visual concept, KHÔNG lặp lại nội dung text.
- "keywordVi": 2-4 từ khóa tiếng Việt để search content Việt
- "keywordEn": 2-4 từ khóa tiếng Anh để search content global
- "keywordMs": 2-4 từ khóa tiếng Malay để search content Malaysia

LƯU Ý: Mỗi keyword set phải là DỊCH NGHĨA TƯƠNG ĐƯƠNG, không phải dịch từ-từ. Ví dụ:
- Tiếng Việt: "mệt mỏi thiếu ngủ"
- Tiếng Anh: "tired sleep deprivation" (không phải "tired lack of sleep")
- Tiếng Malay: "letih kurang tidur"

Trả về JSON object với 2 field: scriptLang (string) + scenes (array).

Kịch bản:
${script}`

    const data = await callGemini(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            scriptLang: { type: 'string', enum: ['vi', 'en', 'ms'] },
            scenes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  line:         { type: 'string' },
                  visualIntent: { type: 'string' },
                  keywordVi:    { type: 'string' },
                  keywordEn:    { type: 'string' },
                  keywordMs:    { type: 'string' },
                },
                required: ['line', 'visualIntent', 'keywordVi', 'keywordEn', 'keywordMs'],
              },
            },
          },
          required: ['scriptLang', 'scenes'],
        },
      },
    }, signal) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new ApiError(ERR.PARSE_FAIL, 'Gemini không trả về kết quả parse')
    try { return JSON.parse(text) as ParseResult }
    catch { throw new ApiError(ERR.PARSE_FAIL, 'Gemini trả về JSON không hợp lệ') }
  })
}

// ── Step 2a: YouTube Data API — dual-language search ────────────────────────
// Strategy: search both English (broadest content pool) and native-lang
// (audience-aligned UGC) in parallel, then dedupe by videoId. videoDuration
// stays "short" to bias toward Shorts + UGC creator content.

function extractVideoId(url: string): string {
  const m = url.match(/[?&]v=([A-Za-z0-9_-]{6,20})/)
  return m?.[1] ?? ''
}

async function searchYouTubeOneLang(apiKey: string, query: string, signal: AbortSignal): Promise<Link[]> {
  if (!query.trim()) return []
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
    return (data.items || []).map((item): Link => ({
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      videoId: item.id?.videoId,
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      domain: 'youtube.com',
      meta: item.snippet?.channelTitle,
    }))
  })
}

export async function searchYouTube(apiKey: string, scene: Scene, scriptLang: ScriptLang, signal: AbortSignal): Promise<SearchResult> {
  // Always search English (largest content pool).
  // Also search native if scriptLang ≠ 'en' for audience-aligned UGC content.
  const queries: string[] = [scene.keywordEn]
  if (scriptLang === 'vi' && scene.keywordVi) queries.push(scene.keywordVi)
  else if (scriptLang === 'ms' && scene.keywordMs) queries.push(scene.keywordMs)
  // For 'en' input, English alone is enough.

  const linkArrays = await Promise.all(
    queries.map(q => searchYouTubeOneLang(apiKey, q, signal).catch(() => [] as Link[]))
  )
  // Flatten + dedupe by videoId
  const seen = new Set<string>()
  const links: Link[] = []
  for (const arr of linkArrays) {
    for (const l of arr) {
      const id = l.videoId || extractVideoId(l.url)
      if (!id || seen.has(id)) continue
      seen.add(id)
      links.push({ ...l, videoId: id })
    }
  }
  return { source: 'youtube', links }
}

// ── Step 2b: TikTok via tikwm.com (CACHED, native-lang for audience fit) ────
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

export async function searchTikTok(scene: Scene, scriptLang: ScriptLang, signal: AbortSignal): Promise<SearchResult> {
  // TikTok content is regional/native — search in the SCRIPT'S language
  // (creators speak the same lang as their audience).
  const query = scriptLang === 'vi' ? scene.keywordVi
              : scriptLang === 'ms' ? scene.keywordMs
              : scene.keywordEn
  if (!query.trim()) return { source: 'tiktok', links: [] }

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

// ── Step 2c: Transcript fetch via Vercel serverless function (CACHED) ───────
// Returns null if transcript not available — caller treats as "title-only"
// match for that video.

async function fetchTranscriptOne(videoId: string, scriptLang: ScriptLang, signal: AbortSignal): Promise<{ snippets: TranscriptSnippet[]; lang: ScriptLang | 'unknown' } | null> {
  return cached(`ts:${videoId}:${scriptLang}`, CONFIG.cache.transcriptTtlMs, async () => {
    // Priority: scriptLang first (best fidelity for audience match), then en
    // (broadest auto-caption coverage), then ms/vi (whichever wasn't tried).
    const langPriority: ScriptLang[] = [scriptLang, 'en', 'vi', 'ms']
    const langsUnique = Array.from(new Set(langPriority))

    try {
      const res = await fetch(`/api/yt-transcript?videoId=${encodeURIComponent(videoId)}&langs=${langsUnique.join(',')}`, { signal })
      if (!res.ok) return null
      const data = await res.json() as { lang: string; snippets: TranscriptSnippet[] }
      if (!data.snippets || data.snippets.length === 0) return null
      const lang = (['vi', 'en', 'ms'].includes(data.lang) ? data.lang : 'unknown') as ScriptLang | 'unknown'
      return { snippets: data.snippets, lang }
    } catch {
      return null
    }
  })
}

async function batchFetchTranscripts(
  links: Array<Link & { source: SourceId }>,
  scene: Scene,
  scriptLang: ScriptLang,
  signal: AbortSignal,
): Promise<Map<string, { hits: TranscriptHit[]; lang: ScriptLang | 'unknown' }>> {
  // Only YouTube has fetchable transcripts. Skip TikTok.
  const ytLinks = links.filter(l => l.source === 'youtube' && l.videoId)
  if (ytLinks.length === 0) return new Map()

  const result = new Map<string, { hits: TranscriptHit[]; lang: ScriptLang | 'unknown' }>()
  // Bounded concurrency to avoid Vercel cold-start thundering herd + YT IP rate-limit
  const queue = [...ytLinks]
  const workers: Promise<void>[] = []
  const limit = Math.min(CONFIG.transcript.concurrency, queue.length)
  for (let i = 0; i < limit; i++) {
    workers.push((async () => {
      while (queue.length) {
        const link = queue.shift()
        if (!link?.videoId) continue
        const data = await fetchTranscriptOne(link.videoId, scriptLang, signal)
        if (!data) continue
        const hits = matchTranscript(data.snippets, scene)
        if (hits.length > 0) result.set(link.videoId, { hits, lang: data.lang })
      }
    })())
  }
  await Promise.all(workers)
  return result
}

// ── Step 3: Embedding-based rank with transcript boost ──────────────────────
// V3.1 enhancement: transcript-matched videos get a configurable score boost.
// The embedding text now includes matched transcript excerpts when available
// — gives the embedding model concrete spoken-content evidence to align with
// visualIntent, on top of the title + description signals.

interface EmbedRankInput {
  scenes: Scene[]
  linksPerScene: Array<Array<Link & { source: SourceId }>>
  /** Per-scene → videoId → transcript match info */
  transcriptsPerScene: Array<Map<string, { hits: TranscriptHit[]; lang: ScriptLang | 'unknown' }>>
}

export async function embeddingRank(
  apiKey: string,
  input: EmbedRankInput,
  signal: AbortSignal,
): Promise<RankedLink[][]> {
  const { scenes, linksPerScene, transcriptsPerScene } = input

  // Build doc strings — include matched transcript excerpts when present.
  const docTexts: string[] = []
  const docIndex: Array<{ sceneIdx: number; linkIdx: number; transcriptHits: TranscriptHit[]; transcriptLang: ScriptLang | 'unknown' | undefined }> = []
  linksPerScene.forEach((links, sceneIdx) => {
    const transcripts = transcriptsPerScene[sceneIdx]
    links.forEach((link, linkIdx) => {
      const tData = link.source === 'youtube' && link.videoId ? transcripts.get(link.videoId) : undefined
      let text: string
      if (link.source === 'youtube' && tData && tData.hits.length > 0) {
        // Strongest signal: transcript excerpts of matched cues
        const excerpts = tData.hits.slice(0, 3).map(h => h.excerpt).join(' / ')
        text = `${link.title}\n\n${link.description?.slice(0, 300) || ''}\n\nSPOKEN: ${excerpts}`
      } else if (link.source === 'youtube' && link.description) {
        text = `${link.title}\n\n${link.description.slice(0, 600)}`
      } else {
        text = link.title
      }
      docTexts.push(text)
      docIndex.push({
        sceneIdx, linkIdx,
        transcriptHits: tData?.hits ?? [],
        transcriptLang: tData?.lang,
      })
    })
  })

  if (docTexts.length === 0) return scenes.map(() => [])

  const queryTexts = scenes.map(s => s.visualIntent)
  const queryCacheKeys = queryTexts.map(t => `emb:q:v2:${hash(t)}`)
  const docCacheKeys = docTexts.map(t => `emb:d:v2:${hash(t)}`)

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

  const result: RankedLink[][] = scenes.map(() => [])
  docIndex.forEach((idx, docPos) => {
    const qv = queryVecs[idx.sceneIdx] || []
    const dv = docVecs[docPos] || []
    const sim = cosineSimilarity(qv, dv)
    const baseScore = Math.max(0, Math.min(1, sim))
    // Apply transcript hit boost — videos where speaker actually mentions
    // scene's concept get bumped above pure-title matches.
    const boost = idx.transcriptHits.length > 0 ? CONFIG.transcript.hitScoreBoost : 1
    const score = Math.round(Math.min(1, baseScore * boost) * 100)
    const link = linksPerScene[idx.sceneIdx][idx.linkIdx]
    result[idx.sceneIdx].push({
      ...link,
      score,
      reason: idx.transcriptHits.length > 0 ? '✓ Transcript match' : '',
      transcriptHits: idx.transcriptHits,
      transcriptLang: idx.transcriptLang,
      _cardId: `s${idx.sceneIdx}_${docPos}`,
    })
  })

  return result.map(arr =>
    arr
      .filter(l => l.score >= CONFIG.rank.minScoreShow)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.rank.maxCardsPerScene),
  )
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

// Re-export internal helpers so component layer can dispatch transcript
// fetches per-scene alongside search calls.
export { batchFetchTranscripts }
