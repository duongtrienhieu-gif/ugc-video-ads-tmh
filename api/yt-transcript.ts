// ── Vercel serverless function — YouTube transcript proxy ──────────────────
// Browser cannot fetch YouTube captions directly (CORS + auth on private
// endpoints). This function runs server-side via Vercel, uses the
// youtube-transcript npm package (scrapes the public timedtext endpoint),
// and returns a clean JSON payload to the client-side app.
//
// Query params:
//   videoId   — YouTube videoId (required)
//   langs     — comma-separated lang priority list (e.g. "vi,en,ms").
//               First lang that has a transcript wins; falls back to any
//               available auto-caption if none match.
//
// Response (200):
//   { lang: string, snippets: Array<{ start, duration, text }> }
//
// Response (404 / 500):
//   { error: string }
//
// Edge-caches 1 day per (videoId, langs) — captions for a given video rarely
// change, and client-side cache layer adds another 7 days on top.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { YoutubeTranscript } from 'youtube-transcript'

interface Snippet {
  text: string
  duration: number
  offset: number
  lang?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const videoId = typeof req.query.videoId === 'string' ? req.query.videoId : ''
  const langsParam = typeof req.query.langs === 'string' ? req.query.langs : 'en'

  if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
    return res.status(400).json({ error: 'videoId required (alphanumeric, dashes, underscores)' })
  }

  const langs = langsParam.split(',').map(l => l.trim()).filter(Boolean)

  // Try requested langs in priority order; last attempt fetches default
  // (whatever YouTube has — usually English or original-audio language).
  const attempts: string[] = [...langs, '']  // '' = no lang filter
  let lastError = ''
  for (const lang of attempts) {
    try {
      const opts = lang ? { lang } : undefined
      const snippets = await YoutubeTranscript.fetchTranscript(videoId, opts) as Snippet[]
      if (snippets && snippets.length > 0) {
        const normalized = snippets.map(s => ({
          // youtube-transcript uses `offset` (ms) + `duration` (ms) — convert to seconds
          start: typeof s.offset === 'number' ? s.offset / 1000 : 0,
          duration: typeof s.duration === 'number' ? s.duration / 1000 : 0,
          text: (s.text || '').replace(/&amp;#39;/g, "'").replace(/&amp;quot;/g, '"').replace(/\n/g, ' ').trim(),
        }))
        // Cache 1 day at the edge — same videoId+lang query stays free
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200')
        return res.status(200).json({
          lang: lang || (snippets[0]?.lang ?? 'unknown'),
          snippets: normalized,
        })
      }
    } catch (err) {
      lastError = (err as Error)?.message || String(err)
      // Continue to next lang on transient errors
    }
  }

  return res.status(404).json({ error: `No transcript available for ${videoId}: ${lastError.slice(0, 200)}` })
}
