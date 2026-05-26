// ── Tìm Source Video — main component (V3.2) ────────────────────────────────
// V3.2 toggle architecture:
//   • Default: includeYouTube=true → YT Data API + transcript verify + 40/60
//     mix with web grounding (production mode, best accuracy)
//   • Toggle off: web-only via Gemini grounding (exploration mode, max
//     diversity, no YouTube quota burn, 3.4x more runs/day on free tier)
//
// TikTok dropped — fragile scraper, user doesn't need platform-specific.
// Web grounding can still return TikTok URLs naturally via Google index.

import { useState, useRef } from 'react'
import { Search, Play, X, Loader2, FileText, Database, ExternalLink, Captions, Youtube } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import {
  parseScript, searchYouTube, searchWeb, embeddingRank,
  batchFetchTranscripts, processWithConcurrency,
} from './services'
import { cacheClear } from './cache'
import {
  CONFIG, ERR, ApiError, colorForScore,
  type Link, type SceneState, type BannerSpec,
  type SourceId, type SearchResult, type ScriptLang,
  type RankedLink, type TranscriptHit,
} from './types'

const DEFAULT_SCRIPT = `Bạn có biết, sau tuổi 25, collagen trong cơ thể giảm 1.5% mỗi năm?
Đó là lý do tại sao da bắt đầu xuất hiện nếp nhăn, chảy xệ, mất đàn hồi.
Mình đã thử rất nhiều loại collagen nhưng hầu hết đều có vị tanh khó uống.
Cho đến khi mình tìm thấy Collagen Peptide thế hệ mới của hãng X.
Phân tử siêu nhỏ chỉ 2000 dalton, hấp thu trực tiếp vào lớp hạ bì.
Sau 4 tuần dùng, da mình mịn hơn rõ rệt, nếp nhăn vùng mắt mờ đi.`

const LANG_LABEL: Record<ScriptLang, string> = { vi: '🇻🇳 Tiếng Việt', en: '🇺🇸 English', ms: '🇲🇾 Bahasa Melayu' }
const INCLUDE_YT_LS_KEY = 'tim-source-video:include-youtube'

export default function TimSourceVideo() {
  const geminiKey = useSettingsStore((s) => s.geminiApiKey)
  const youtubeKey = useSettingsStore((s) => s.youtubeApiKey)
  const addToast = useAppStore((s) => s.addToast)
  const savedScripts = useBankStore((s) => s.scripts)

  const [script, setScript] = useState(DEFAULT_SCRIPT)
  const [pickedScriptId, setPickedScriptId] = useState<string>('')
  const [scriptLang, setScriptLang] = useState<ScriptLang | null>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [banners, setBanners] = useState<BannerSpec[]>([])
  const [sceneStates, setSceneStates] = useState<SceneState[]>([])
  // Persist toggle across reloads
  const [includeYouTube, setIncludeYouTube] = useState<boolean>(() => {
    try { return localStorage.getItem(INCLUDE_YT_LS_KEY) !== 'false' }
    catch { return true }
  })
  const abortRef = useRef<AbortController | null>(null)

  function toggleIncludeYouTube() {
    const next = !includeYouTube
    setIncludeYouTube(next)
    try { localStorage.setItem(INCLUDE_YT_LS_KEY, next ? 'true' : 'false') } catch { /* ignore */ }
  }

  const missingKeys: string[] = []
  if (!geminiKey) missingKeys.push('Gemini')
  if (includeYouTube && !youtubeKey) missingKeys.push('YouTube Data API')

  function addBanner(b: BannerSpec) { setBanners((prev) => [...prev, b]) }

  function classifyError(err: unknown): BannerSpec {
    const e = err as ApiError
    if (e?.code === ERR.QUOTA_GEMINI)  return { kind: 'quota_gemini' }
    if (e?.code === ERR.QUOTA_YOUTUBE) return { kind: 'quota_youtube' }
    if (e?.code === ERR.ABORTED)       return { kind: 'aborted' }
    return { kind: 'generic', message: (err as Error)?.message || String(err) }
  }

  function cancel() { abortRef.current?.abort() }
  function handleClearCache() {
    const n = cacheClear()
    addToast(`Đã xóa ${n} entry cache`)
  }

  async function run() {
    if (running) return
    if (missingKeys.length > 0) {
      addToast(`Cần điền ${missingKeys.join(' + ')} key trong Cài đặt`, 'error')
      return
    }
    if (!script.trim()) {
      addToast('Vui lòng nhập kịch bản', 'error')
      return
    }

    setRunning(true)
    setBanners([])
    setSceneStates([])
    setScriptLang(null)
    setStatus('⏳ Đang phát hiện ngôn ngữ + tách scene...')

    const controller = new AbortController()
    abortRef.current = controller
    const startTime = Date.now()

    try {
      const parsed = await parseScript(geminiKey, script, controller.signal)
      const { scriptLang: detectedLang, scenes } = parsed
      setScriptLang(detectedLang)
      if (!scenes.length) {
        addBanner({ kind: 'generic', message: 'Gemini không tách được scene nào từ kịch bản này.' })
        return
      }

      const skeletons: SceneState[] = scenes.map((scene) => ({ scene, ranked: [], errors: {} }))
      setSceneStates(skeletons)
      const modeMsg = includeYouTube ? 'YouTube + Web' : 'Web (no YouTube)'
      setStatus(`✅ Ngôn ngữ: ${LANG_LABEL[detectedLang]} · ${scenes.length} scene · Mode: ${modeMsg}. Đang tìm video...`)

      // ── Phase 2: parallel search per scene ───────────────────────────────
      type SearchOrErr = SearchResult & { __error?: string }
      const wrapErr = (source: SourceId) => (e: unknown): SearchOrErr => {
        const code = (e as ApiError)?.code
        if (code === ERR.QUOTA_GEMINI || code === ERR.QUOTA_YOUTUBE || code === ERR.ABORTED) throw e
        return { source, links: [], __error: (e as Error).message }
      }

      const linksPerScene: Array<Array<Link & { source: SourceId }>> = scenes.map(() => [])
      const errorsPerScene: Array<Partial<Record<SourceId, string>>> = scenes.map(() => ({}))

      const sceneJobs = scenes.map((scene, i) => ({ scene, i }))
      await processWithConcurrency(sceneJobs, async ({ scene, i }) => {
        // Build adapter list based on toggle
        const adapters: Array<Promise<SearchOrErr>> = []
        if (includeYouTube) {
          adapters.push(searchYouTube(youtubeKey, scene, detectedLang, controller.signal).catch(wrapErr('youtube')))
        }
        // searchWeb always runs; excludeYouTube param tells it whether to filter out YT URLs
        adapters.push(searchWeb(geminiKey, scene, detectedLang, /* excludeYouTube */ includeYouTube, controller.signal).catch(wrapErr('web')))

        const results = await Promise.all(adapters)
        linksPerScene[i] = results.flatMap((r) =>
          r.links.map((l) => ({ ...l, source: r.source }))
        )
        errorsPerScene[i] = Object.fromEntries(
          results.filter((r) => r.__error).map((r) => [r.source, r.__error!])
        ) as Partial<Record<SourceId, string>>
      }, CONFIG.search.sceneConcurrency)

      // ── Phase 3: fetch transcripts (YT only — skip if toggle off) ───────
      const transcriptsPerScene = includeYouTube
        ? await (async () => {
            setStatus(`📜 Đang đọc transcript YouTube...`)
            return Promise.all(scenes.map((scene, i) =>
              batchFetchTranscripts(linksPerScene[i], scene, detectedLang, controller.signal)
            ))
          })()
        : scenes.map(() => new Map<string, { hits: TranscriptHit[]; lang: ScriptLang | 'unknown' }>())

      // ── Phase 4: embedding rerank with optional source-mix enforcement ──
      setStatus('🧮 Đang chấm điểm bằng embedding similarity...')
      const rankedPerScene = await embeddingRank(geminiKey, {
        scenes,
        linksPerScene,
        transcriptsPerScene,
        enforceSourceMix: includeYouTube,  // only enforce mix when YT is on
      }, controller.signal)

      const finalStates: SceneState[] = scenes.map((scene, i) => ({
        scene,
        ranked: rankedPerScene[i],
        errors: errorsPerScene[i],
      }))
      setSceneStates(finalStates)

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const totalCards = finalStates.reduce((sum, s) => sum + s.ranked.length, 0)
      const ytCount = finalStates.flatMap(s => s.ranked).filter(l => l.source === 'youtube').length
      const webCount = totalCards - ytCount
      setStatus(`✅ Hoàn tất ${scenes.length} scene trong ${elapsed}s · ${totalCards} card (${ytCount} YouTube / ${webCount} Web). Click thumbnail để mở video tab mới — bạn tự xem thử.`)
    } catch (err) {
      const spec = classifyError(err)
      addBanner(spec)
      setStatus('')
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Search className="h-6 w-6 text-violet-500" />
            Tìm Source Video
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Nhập kịch bản (Việt / Anh / Malay) → AI tách scene → tìm video + bài viết khớp ý từ <strong>{includeYouTube ? 'YouTube + Web' : 'Web (mọi domain)'}</strong>. {includeYouTube ? 'YouTube transcript verify nội dung; Web grounding cho diversity.' : 'Gemini Google Search trả về mọi domain (TikTok, Pinterest, Vimeo, blog, v.v.) — không qua YouTube Data API.'}
          </p>
          {scriptLang && (
            <div className="mt-2 inline-block rounded bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
              Ngôn ngữ phát hiện: {LANG_LABEL[scriptLang]}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={toggleIncludeYouTube}
            title={includeYouTube ? 'Đang dùng YouTube — click để tắt' : 'YouTube đang tắt — click để bật'}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              includeYouTube
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Youtube className="h-3.5 w-3.5" />
            YouTube: {includeYouTube ? 'ON (40%)' : 'OFF'}
          </button>
          <button
            onClick={handleClearCache}
            title="Xóa cache"
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            <Database className="h-3.5 w-3.5" />
            Xóa cache
          </button>
        </div>
      </div>

      {missingKeys.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Cần điền <strong>{missingKeys.join(' + ')}</strong> key trong <strong>Cài đặt</strong> trước khi chạy.
          {!includeYouTube && (
            <div className="mt-1 text-xs">Tip: YouTube đang OFF nên không cần YouTube key.</div>
          )}
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-gray-600">Kịch bản UGC (Việt / Anh / Malay)</label>
          {savedScripts.length > 0 && (
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={pickedScriptId}
                onChange={(e) => {
                  const id = e.target.value
                  setPickedScriptId(id)
                  if (id) {
                    const found = savedScripts.find((s) => s.id === id)
                    if (found) {
                      setScript(found.scriptText)
                      addToast(`Đã nạp kịch bản: ${found.title}`)
                    }
                  }
                }}
                disabled={running}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-violet-300 focus:outline-none disabled:opacity-60"
              >
                <option value="">📂 Nạp từ Kịch bản đã lưu ({savedScripts.length})</option>
                {savedScripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}{s.source === 'script-architect' ? ' · AI' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <textarea
          value={script}
          onChange={(e) => {
            setScript(e.target.value)
            if (pickedScriptId) setPickedScriptId('')
          }}
          disabled={running}
          className="h-64 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm leading-relaxed text-gray-800 focus:border-violet-300 focus:outline-none disabled:opacity-60"
          placeholder="Paste kịch bản UGC vào đây (tiếng Việt, Anh, hoặc Malay)..."
        />
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={run}
          disabled={running || missingKeys.length > 0}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Đang chạy...' : 'Phân tích & Tìm video'}
        </button>
        {running && (
          <button
            onClick={cancel}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
          >
            <X className="h-4 w-4" />
            Hủy
          </button>
        )}
      </div>

      {banners.map((b, i) => <Banner key={i} spec={b} />)}

      {status && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700">
          {status}
        </div>
      )}

      {sceneStates.map((s, i) => <SceneCard key={i} idx={i} state={s} />)}
    </div>
  )
}

// ── Banner ──────────────────────────────────────────────────────────────────
function Banner({ spec }: { spec: BannerSpec }) {
  if (spec.kind === 'quota_gemini') {
    return (
      <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-5">
        <div className="mb-2 text-base font-bold text-amber-900">⛔ Quota Gemini Free Tier đã cạn</div>
        <div className="text-sm leading-relaxed text-amber-800">
          Free tier 250 requests/ngày. Đợi nửa đêm Pacific Time (~15:00 ICT) hoặc upgrade tại{' '}
          <a className="font-semibold underline" href="https://aistudio.google.com/billing" target="_blank" rel="noreferrer">aistudio.google.com/billing</a>.
        </div>
      </div>
    )
  }
  if (spec.kind === 'quota_youtube') {
    return (
      <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-5">
        <div className="mb-2 text-base font-bold text-amber-900">⛔ Quota YouTube Data API đã cạn</div>
        <div className="text-sm leading-relaxed text-amber-800">
          Tip: tắt toggle <strong>YouTube ON/OFF</strong> ở góc trên để chuyển sang web-only mode (không tốn YT quota).
        </div>
      </div>
    )
  }
  if (spec.kind === 'aborted') {
    return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">⛔ Đã hủy theo yêu cầu.</div>
  }
  return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">❌ {spec.message}</div>
}

// ── SceneCard ───────────────────────────────────────────────────────────────
function SceneCard({ idx, state }: { idx: number; state: SceneState }) {
  const { scene, ranked, errors } = state
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="rounded-full bg-violet-500 px-2 py-0.5 text-xs font-semibold text-white">Scene {idx + 1}</span>
        <span className="text-base font-medium text-gray-900">{scene.line}</span>
      </div>
      <div className="mb-2 rounded border-l-4 border-violet-400 bg-violet-50 px-3 py-1.5 text-sm text-violet-900">
        💡 {scene.visualIntent}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-gray-500">
        <strong>Keywords:</strong>
        <code className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">VI: {scene.keywordVi}</code>
        <code className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">EN: {scene.keywordEn}</code>
        <code className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">MS: {scene.keywordMs}</code>
      </div>

      {ranked.length === 0 && Object.keys(errors).length === 0 && (
        <div className="rounded bg-gray-50 py-3 text-center text-xs text-gray-400">⏳ Đang tìm...</div>
      )}

      {ranked.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((r) => <ResultCard key={r._cardId} link={r} />)}
        </div>
      )}

      {Object.entries(errors).map(([source, msg]) => (
        <div key={source} className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
          {source === 'youtube' ? 'YouTube' : 'Web'}: {msg}
        </div>
      ))}
    </div>
  )
}

// ── ResultCard ──────────────────────────────────────────────────────────────
const SOURCE_TAG_STYLE: Record<SourceId, string> = {
  youtube: 'bg-red-100 text-red-700',
  web:     'bg-violet-100 text-violet-700',
}

function getSourceLabel(link: RankedLink): string {
  if (link.source === 'youtube') return 'YT Shorts'
  // Web — show domain for context
  return link.domain || 'Web'
}

function ResultCard({ link }: { link: RankedLink }) {
  const thumbUrl = link.thumbnail ?? `https://image.thum.io/get/width/400/crop/225/noanimate/${link.url}`
  const scoreColor = colorForScore(link.score)
  const hasTranscript = link.transcriptHits && link.transcriptHits.length > 0

  const bestHit = hasTranscript ? link.transcriptHits![0] : null
  const deepLinkUrl = bestHit
    ? `${link.url}${link.url.includes('?') ? '&' : '?'}t=${Math.floor(bestHit.start)}s`
    : link.url

  return (
    <div className="relative flex flex-col rounded-lg border border-gray-200 bg-gray-50 p-2 transition-all hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md">
      <div
        className="absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-sm"
        style={{ backgroundColor: scoreColor }}
        title={hasTranscript ? `Score ${link.score} (+${Math.round((CONFIG.transcript.hitScoreBoost - 1) * 100)}% transcript boost)` : `Score ${link.score} (title+desc only)`}
      >
        ⭐ {link.score}
      </div>
      <a href={deepLinkUrl} target="_blank" rel="noreferrer" className="group block">
        <div className="aspect-video w-full overflow-hidden rounded bg-gray-200">
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <div className="mt-2 flex items-start gap-1 text-sm font-medium leading-snug text-gray-800">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_TAG_STYLE[link.source]}`}>
            {getSourceLabel(link)}
          </span>
          <span className="flex-1">{link.title || link.url}</span>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        {link.meta && <div className="mt-0.5 truncate text-xs text-gray-400">{link.meta}</div>}
      </a>

      {hasTranscript && <TranscriptHits hits={link.transcriptHits!} url={link.url} transcriptLang={link.transcriptLang} />}
      {!hasTranscript && link.source === 'youtube' && (
        <div className="mt-2 rounded bg-gray-100 px-2 py-1 text-center text-[10px] italic text-gray-500">
          Không có transcript hoặc không match
        </div>
      )}
      {link.source === 'web' && (
        <div className="mt-2 rounded bg-violet-50 px-2 py-1 text-center text-[10px] italic text-violet-600">
          Web grounding — bạn tự xem nội dung
        </div>
      )}
    </div>
  )
}

// ── TranscriptHits ──────────────────────────────────────────────────────────
function fmtTime(s: number): string {
  const total = Math.floor(s)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function TranscriptHits({ hits, url, transcriptLang }: { hits: TranscriptHit[]; url: string; transcriptLang: string | undefined }) {
  return (
    <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        <Captions className="h-3 w-3" />
        Đoạn nói khớp
        {transcriptLang && transcriptLang !== 'unknown' && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">{transcriptLang.toUpperCase()}</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {hits.slice(0, 3).map((h, j) => {
          const sep = url.includes('?') ? '&' : '?'
          const deepLink = `${url}${sep}t=${Math.floor(h.start)}s`
          return (
            <a
              key={j}
              href={deepLink}
              target="_blank"
              rel="noreferrer"
              className="flex gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-gray-800 transition-colors hover:bg-emerald-100"
              title={`Match: "${h.matchedTerm}" (${h.matchedLang})`}
            >
              <span className="whitespace-nowrap font-mono font-bold text-emerald-700">
                {fmtTime(h.start)}–{fmtTime(h.end)}
              </span>
              <span className="flex-1 leading-snug">"{h.excerpt}"</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
