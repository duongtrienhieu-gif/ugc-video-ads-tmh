// ── Tìm Source Video — service functions (V3.2) ─────────────────────────────
// V3.2 changes vs V3.1:
//   • DROPPED TikTok scraper entirely (tikwm fragile, user doesn't need
//     platform-specific — any web source is fine)
//   • RESTORED searchWeb via Gemini Google Search grounding (covers any
//     indexed web page — Pinterest, Vimeo, TikTok via Google, blogs, etc.)
//   • Toggle `includeYouTube` controls whether to call YouTube Data API +
//     transcript fetch (production mode) OR rely 100% on web grounding
//     (exploration mode, more diversity, no YT quota burn)
//   • Enforced per-source mix: 3 YT + 5 Web when YT on; 8 Web when YT off
//
// Pipeline cost per fresh run:
//   • With YT:    1 Flash + 10 grounding + 2-3 embedding = ~14 Gemini calls
//                 + 2K YouTube units + ~40 Vercel transcript fetches
//   • Without YT: same Gemini cost; 0 YouTube quota; 0 Vercel calls

import { searchWithGrounding, classifyGemini429, geminiEmbedBatch, cosineSimilarity } from '../../utils/gemini'
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

function mapGroundingError(err: unknown): never {
  const code = (err as { code?: string })?.code
  if (code === 'QUOTA_DAILY') throw new ApiError(ERR.QUOTA_GEMINI, 'Gemini free tier quota đã cạn')
  if (code === 'ABORTED' || (err as Error)?.name === 'AbortError') throw new ApiError(ERR.ABORTED, 'Đã hủy')
  throw new ApiError(ERR.GEMINI_FAIL, (err as Error)?.message || 'Web search failed')
}

// ── Step 1: Parse script → scenes (multi-lang, CACHED) ──────────────────────
// Cache key v3 — Scene shape gained `lineVi` field. Old v2 cached entries
// won't have it; bumping the key invalidates them safely without a migration.
export async function parseScript(apiKey: string, script: string, signal: AbortSignal): Promise<ParseResult> {
  return cached(`parse:v3:${hash(script)}`, CONFIG.cache.parseScriptTtlMs, async () => {
    const prompt = `Bạn là chuyên gia phân tích kịch bản UGC bán hàng.

ĐẦU TIÊN: phát hiện ngôn ngữ của kịch bản. Chỉ trả về 1 trong: "vi" (Vietnamese), "en" (English), "ms" (Malay).

SAU ĐÓ: tách kịch bản thành các SCENE (mỗi câu thoại = 1 scene, trừ khi 2 câu liền cùng nói về 1 visual thì gộp lại).

Với mỗi scene, trả về object với các field:
- "line": câu thoại gốc (giữ nguyên ngôn ngữ kịch bản)
- "lineVi": bản DỊCH SANG TIẾNG VIỆT của câu thoại trên. Nếu kịch bản đã là tiếng Việt, copy y nguyên "line". Nếu là English hoặc Malay, dịch sang Việt TỰ NHIÊN (không word-by-word, dịch nghĩa) để người Việt đọc hiểu.
- "visualIntent": 1 câu tiếng Việt mô tả CỤ THỂ hình ảnh/video cần để minh họa. Focus vào visual concept, KHÔNG lặp lại nội dung text.
- "keywordVi": 2-4 từ khóa tiếng Việt
- "keywordEn": 2-4 từ khóa tiếng Anh
- "keywordMs": 2-4 từ khóa tiếng Malay

Mỗi keyword set phải là DỊCH NGHĨA TƯƠNG ĐƯƠNG, không phải dịch từ-từ.

Trả về JSON object với 2 field: scriptLang + scenes.

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
                  lineVi:       { type: 'string' },
                  visualIntent: { type: 'string' },
                  keywordVi:    { type: 'string' },
                  keywordEn:    { type: 'string' },
                  keywordMs:    { type: 'string' },
                },
                required: ['line', 'lineVi', 'visualIntent', 'keywordVi', 'keywordEn', 'keywordMs'],
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
  const queries: string[] = [scene.keywordEn]
  if (scriptLang === 'vi' && scene.keywordVi) queries.push(scene.keywordVi)
  else if (scriptLang === 'ms' && scene.keywordMs) queries.push(scene.keywordMs)

  const linkArrays = await Promise.all(
    queries.map(q => searchYouTubeOneLang(apiKey, q, signal).catch(() => [] as Link[]))
  )
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

// ── Step 2b: Web search via Gemini Google Search grounding ──────────────────
// Targets ANY indexed web page — TikTok (via Google), Pinterest, Vimeo, blogs,
// stock sites, news articles with embedded video, etc. Strict domain filter
// drops obvious garbage (e-commerce listings, stock library homepages,
// wikipedia generic pages, anti-bot pages).

const BAD_DOMAIN_RE = /^(shutterstock|gettyimages|istockphoto|envato|vecteezy|123rf|dreamstime|fotolia|stockfresh|alamy|depositphotos|adobe\.stock|ebay|walmart|amazon|aliexpress|alibaba|shopee|temu|target|bestbuy|wikipedia|wikia|quora)\.[a-z.]+$/i
const BARE_DOMAIN_RE = /^[a-z0-9-]+\.[a-z]{2,}(\.[a-z]{2,})?$/i

export async function searchWeb(apiKey: string, scene: Scene, scriptLang: ScriptLang, excludeYouTube: boolean, signal: AbortSignal): Promise<SearchResult> {
  // Cache key includes excludeYouTube flag — different prompt → different results
  const cacheKey = `web:v2:${excludeYouTube ? 'noyt' : 'all'}:${hash(scene.visualIntent + scriptLang)}`

  return cached(cacheKey, CONFIG.cache.searchTtlMs, async () => {
    const ytClause = excludeYouTube
      ? '6. ❌ KHÔNG TRẢ về URL youtube.com / youtu.be (đã có nguồn riêng).'
      : '6. ✓ Bao gồm cả YouTube URLs nếu phù hợp.'

    const prompt = `Bạn cần TÌM TRÊN INTERNET các trang web có nội dung phù hợp để MINH HỌA cho concept hình ảnh sau:

"${scene.visualIntent}"

Ngôn ngữ kịch bản: ${scriptLang} → ưu tiên trang phục vụ audience cùng ngôn ngữ nếu có.

YÊU CẦU:
1. Trang có VIDEO play được HOẶC bài viết substantive với hình ảnh/animation minh họa cụ thể cho concept
2. ĐA DẠNG NGUỒN: TikTok pages, Vimeo, Pinterest pins, Instagram public posts, Dailymotion, blog posts, news articles có embed video, stock sites (Pexels/Pixabay deep links), creator personal websites
3. URL phải là TRANG CHI TIẾT của 1 video/article cụ thể, KHÔNG phải homepage hay search results
4. TUYỆT ĐỐI KHÔNG trả về:
   - E-commerce listings (Amazon, Shopee, Walmart, Alibaba, eBay...)
   - Stock library homepages (shutterstock.com, gettyimages.com root)
   - Wikipedia generic article pages
   - Quora, Yahoo Answers listing pages
   - Anti-bot / CAPTCHA pages
   - Homepage / category page với title chỉ là tên domain
5. Tìm 5-8 link chất lượng cao, ưu tiên relevance + visual content thực sự
${ytClause}`

    let result: { narrative: string; chunks: Array<{ uri: string; title?: string }> }
    try {
      result = await searchWithGrounding({ apiKey, prompt, signal })
    } catch (err) {
      mapGroundingError(err)
    }

    const seen = new Set<string>()
    const links: Link[] = []
    for (const c of result.chunks) {
      if (!c.uri || seen.has(c.uri)) continue
      if (links.length >= CONFIG.search.webMaxResults) break
      seen.add(c.uri)
      let domain = ''
      try { domain = new URL(c.uri).hostname.replace(/^www\./, '') } catch { /* ignore */ }
      const title = (c.title || domain || c.uri).trim()
      // Filter youtube when excludeYouTube=true to avoid dup with YT Data API
      if (excludeYouTube && /^(youtube\.com|youtu\.be)$/i.test(domain)) continue
      // Drop obvious noise
      if (BAD_DOMAIN_RE.test(domain)) continue
      if (BARE_DOMAIN_RE.test(title)) continue
      if (/verification required|access denied|cloudflare|robot or human/i.test(title)) continue
      links.push({ url: c.uri, title, domain })
    }
    return { source: 'web', links }
  })
}

// ── Step 2c: Transcript fetch (only when YouTube source is enabled) ─────────
async function fetchTranscriptOne(videoId: string, scriptLang: ScriptLang, signal: AbortSignal): Promise<{ snippets: TranscriptSnippet[]; lang: ScriptLang | 'unknown' } | null> {
  return cached(`ts:${videoId}:${scriptLang}`, CONFIG.cache.transcriptTtlMs, async () => {
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

export async function batchFetchTranscripts(
  links: Array<Link & { source: SourceId }>,
  scene: Scene,
  scriptLang: ScriptLang,
  signal: AbortSignal,
): Promise<Map<string, { hits: TranscriptHit[]; lang: ScriptLang | 'unknown' }>> {
  const ytLinks = links.filter(l => l.source === 'youtube' && l.videoId)
  if (ytLinks.length === 0) return new Map()
  const result = new Map<string, { hits: TranscriptHit[]; lang: ScriptLang | 'unknown' }>()
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

// ── Step 3: Embedding rerank with source-mix enforcement ────────────────────
interface EmbedRankInput {
  scenes: Scene[]
  linksPerScene: Array<Array<Link & { source: SourceId }>>
  transcriptsPerScene: Array<Map<string, { hits: TranscriptHit[]; lang: ScriptLang | 'unknown' }>>
  /** When true, final mix enforces YT-cap (3 YT + 5 Web). When false, take
   *  top N by score regardless of source (only relevant when YT disabled). */
  enforceSourceMix: boolean
}

export async function embeddingRank(
  apiKey: string,
  input: EmbedRankInput,
  signal: AbortSignal,
): Promise<RankedLink[][]> {
  const { scenes, linksPerScene, transcriptsPerScene, enforceSourceMix } = input

  const docTexts: string[] = []
  const docIndex: Array<{ sceneIdx: number; linkIdx: number; transcriptHits: TranscriptHit[]; transcriptLang: ScriptLang | 'unknown' | undefined }> = []
  linksPerScene.forEach((links, sceneIdx) => {
    const transcripts = transcriptsPerScene[sceneIdx]
    links.forEach((link, linkIdx) => {
      const tData = link.source === 'youtube' && link.videoId ? transcripts.get(link.videoId) : undefined
      let text: string
      if (link.source === 'youtube' && tData && tData.hits.length > 0) {
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

  // Score all (scene, link) pairs
  const allRanked: RankedLink[][] = scenes.map(() => [])
  docIndex.forEach((idx, docPos) => {
    const qv = queryVecs[idx.sceneIdx] || []
    const dv = docVecs[docPos] || []
    const sim = cosineSimilarity(qv, dv)
    const baseScore = Math.max(0, Math.min(1, sim))
    const boost = idx.transcriptHits.length > 0 ? CONFIG.transcript.hitScoreBoost : 1
    const score = Math.round(Math.min(1, baseScore * boost) * 100)
    const link = linksPerScene[idx.sceneIdx][idx.linkIdx]
    allRanked[idx.sceneIdx].push({
      ...link,
      score,
      reason: idx.transcriptHits.length > 0 ? '✓ Transcript match' : '',
      transcriptHits: idx.transcriptHits,
      transcriptLang: idx.transcriptLang,
      _cardId: `s${idx.sceneIdx}_${docPos}`,
    })
  })

  // Apply source-mix enforcement OR plain top-N
  return allRanked.map(arr => {
    const filtered = arr.filter(l => l.score >= CONFIG.rank.minScoreShow).sort((a, b) => b.score - a.score)
    if (!enforceSourceMix) {
      return filtered.slice(0, CONFIG.rank.maxCardsPerScene)
    }
    // Bucket by source, take per-source caps, then merge by score
    const yts = filtered.filter(l => l.source === 'youtube').slice(0, CONFIG.rank.mixYouTubeMax)
    const webs = filtered.filter(l => l.source === 'web').slice(0, CONFIG.rank.mixWebMax)
    return [...yts, ...webs].sort((a, b) => b.score - a.score)
  })
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
