// ── Tìm Source Video — main component ────────────────────────────────────────
// Port of the standalone prototype at /prototypes/source-video.html into the
// UGC Lab app shell. Reads Gemini + YouTube keys from settingsStore (Cài đặt
// modal), wraps the prototype's pipeline in React state, and routes banner /
// status / scenes into separate render regions so a quota banner can never
// overwrite already-rendered scene results.

import { useState, useRef } from 'react'
import { Search, Play, X, Loader2, FileText } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import {
  parseScript, searchYouTube, searchTikTok, searchWeb, rankLinks,
  analyzeYouTubeTimestamp, processWithConcurrency, parseTimeToSeconds,
} from './services'
import {
  CONFIG, ERR, ApiError, colorForScore,
  type SceneState, type BannerSpec, type RankedLink, type SourceId, type SearchResult,
} from './types'

const DEFAULT_SCRIPT = `Bạn có biết, sau tuổi 25, collagen trong cơ thể giảm 1.5% mỗi năm?
Đó là lý do tại sao da bắt đầu xuất hiện nếp nhăn, chảy xệ, mất đàn hồi.
Mình đã thử rất nhiều loại collagen nhưng hầu hết đều có vị tanh khó uống.
Cho đến khi mình tìm thấy Collagen Peptide thế hệ mới của hãng X.
Phân tử siêu nhỏ chỉ 2000 dalton, hấp thu trực tiếp vào lớp hạ bì.
Sau 4 tuần dùng, da mình mịn hơn rõ rệt, nếp nhăn vùng mắt mờ đi.`

export default function TimSourceVideo() {
  const geminiKey = useSettingsStore((s) => s.geminiApiKey)
  const youtubeKey = useSettingsStore((s) => s.youtubeApiKey)
  const addToast = useAppStore((s) => s.addToast)
  const savedScripts = useBankStore((s) => s.scripts)

  const [script, setScript] = useState(DEFAULT_SCRIPT)
  const [pickedScriptId, setPickedScriptId] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [banners, setBanners] = useState<BannerSpec[]>([])
  const [sceneStates, setSceneStates] = useState<SceneState[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const missingKeys: string[] = []
  if (!geminiKey) missingKeys.push('Gemini')
  if (!youtubeKey) missingKeys.push('YouTube Data API')

  function addBanner(b: BannerSpec) {
    setBanners((prev) => [...prev, b])
  }

  function classifyError(err: unknown): BannerSpec {
    const e = err as ApiError
    if (e?.code === ERR.QUOTA_GEMINI)  return { kind: 'quota_gemini' }
    if (e?.code === ERR.QUOTA_YOUTUBE) return { kind: 'quota_youtube' }
    if (e?.code === ERR.ABORTED)       return { kind: 'aborted' }
    return { kind: 'generic', message: (err as Error)?.message || String(err) }
  }

  function cancel() {
    abortRef.current?.abort()
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
    setStatus('⏳ Đang phân tích kịch bản thành scene...')

    const controller = new AbortController()
    abortRef.current = controller
    const startTime = Date.now()

    try {
      const scenes = await parseScript(geminiKey, script, controller.signal)
      if (!scenes.length) {
        addBanner({ kind: 'generic', message: 'Gemini không tách được scene nào từ kịch bản này.' })
        return
      }

      // Render skeletons
      const skeletons: SceneState[] = scenes.map((scene) => ({
        scene, ranked: [], analyzingIds: new Set(), timestamps: {}, errors: {},
      }))
      setSceneStates(skeletons)
      setStatus(`✅ Tách được ${scenes.length} scene. Đang tìm video song song...`)

      // Phase 1: per-scene search + rank (parallel).
      // Adapter failures localize to per-source inline error; quota / abort
      // codes bubble up to the outer catch which routes to a banner.
      type SearchOrErr = SearchResult & { __error?: string }
      const wrapErr = (source: SourceId) => (e: unknown): SearchOrErr => {
        const code = (e as ApiError)?.code
        if (code === ERR.QUOTA_GEMINI || code === ERR.QUOTA_YOUTUBE || code === ERR.ABORTED) throw e
        return { source, links: [], __error: (e as Error).message }
      }
      const phase2Tasks: Array<{ link: RankedLink; sceneIdx: number; intent: string }> = []
      await Promise.all(scenes.map(async (scene, i) => {
        const results: SearchOrErr[] = await Promise.all([
          searchYouTube(youtubeKey, scene.keywordEn, controller.signal).catch(wrapErr('youtube')),
          searchTikTok(scene.keywordEn, controller.signal).catch(wrapErr('tiktok')),
          searchWeb(geminiKey, scene.visualIntent, controller.signal).catch(wrapErr('web')),
        ])
        const allLinks = results.flatMap((r) =>
          r.links.map((l) => ({ ...l, source: r.source }))
        )
        let ranked = await rankLinks(geminiKey, scene.visualIntent, allLinks, controller.signal)
        ranked = ranked
          .filter((l) => (l.score ?? 0) >= CONFIG.rank.minScoreShow)
          .slice(0, CONFIG.rank.maxCardsPerScene)
          .map((l, j) => ({ ...l, _cardId: `s${i}_${j}` }))

        const toAnalyze = ranked
          .filter((l) => l.source === 'youtube' && (l.score ?? 0) >= CONFIG.rank.minScoreAnalyzeTs)
          .slice(0, CONFIG.timestamp.maxVideosPerScene)
        toAnalyze.forEach((link) => phase2Tasks.push({ link, sceneIdx: i, intent: scene.visualIntent }))
        const analyzingIds = new Set(toAnalyze.map((l) => l._cardId))
        const errorsBySource = Object.fromEntries(
          results.filter((r) => '__error' in r && (r as { __error?: string }).__error).map((r) => [r.source, (r as { __error: string }).__error])
        ) as Partial<Record<SourceId, string>>

        // Initialize timestamps for analyzing cards as 'loading'
        const initialTimestamps: SceneState['timestamps'] = {}
        toAnalyze.forEach((l) => { initialTimestamps[l._cardId] = 'loading' })

        setSceneStates((prev) => {
          const next = [...prev]
          next[i] = { scene, ranked, analyzingIds, timestamps: initialTimestamps, errors: errorsBySource }
          return next
        })
      }))

      // Phase 2: analyze top YouTube videos for timestamps
      const phase1Elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      if (phase2Tasks.length === 0) {
        setStatus(`✅ Hoàn tất ${scenes.length} scene trong ${phase1Elapsed}s. Không có YouTube video nào đạt score ≥ ${CONFIG.rank.minScoreAnalyzeTs} để phân tích timestamp.`)
      } else {
        setStatus(`🎬 Phase 1 xong (${phase1Elapsed}s). Đang phân tích timestamp ${phase2Tasks.length} YouTube video (0 / ${phase2Tasks.length})...`)
        let done = 0
        await processWithConcurrency(phase2Tasks, async ({ link, sceneIdx, intent }) => {
          try {
            const result = await analyzeYouTubeTimestamp(geminiKey, link.url, intent, controller.signal)
            setSceneStates((prev) => {
              const next = [...prev]
              if (next[sceneIdx]) {
                next[sceneIdx] = { ...next[sceneIdx], timestamps: { ...next[sceneIdx].timestamps, [link._cardId]: result } }
              }
              return next
            })
          } catch (err) {
            const code = (err as ApiError)?.code
            if (code === ERR.QUOTA_GEMINI || code === ERR.QUOTA_YOUTUBE || code === ERR.ABORTED) throw err
            setSceneStates((prev) => {
              const next = [...prev]
              if (next[sceneIdx]) {
                next[sceneIdx] = { ...next[sceneIdx], timestamps: { ...next[sceneIdx].timestamps, [link._cardId]: { error: (err as Error).message.slice(0, 100) } } }
              }
              return next
            })
          }
          done++
          setStatus(`🎬 Đang phân tích timestamp YouTube videos (${done} / ${phase2Tasks.length})...`)
        }, CONFIG.timestamp.concurrency)
        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        setStatus(`✅ Hoàn tất ${scenes.length} scene + ${phase2Tasks.length} video phân tích trong ${totalElapsed}s.`)
      }
    } catch (err) {
      const spec = classifyError(err)
      addBanner(spec)
      if (spec.kind === 'aborted') setStatus('')
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Search className="h-6 w-6 text-violet-500" />
          Tìm Source Video
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Nhập kịch bản UGC → AI tách scene → tìm link YouTube / TikTok / Web phù hợp + timestamp đoạn cảnh trong video YouTube.
        </p>
      </div>

      {missingKeys.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Cần điền <strong>{missingKeys.join(' + ')}</strong> key trong <strong>Cài đặt</strong> trước khi chạy.
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-gray-600">Kịch bản UGC</label>
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
            if (pickedScriptId) setPickedScriptId('')  // user edited → unlink from saved script
          }}
          disabled={running}
          className="h-64 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm leading-relaxed text-gray-800 focus:border-violet-300 focus:outline-none disabled:opacity-60"
          placeholder="Paste kịch bản UGC vào đây..."
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

      {/* Banners */}
      {banners.map((b, i) => <Banner key={i} spec={b} />)}

      {/* Status */}
      {status && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700">
          {status}
        </div>
      )}

      {/* Scenes */}
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
          Free tier giới hạn <strong>250 requests/ngày</strong>. Đã chạy quá nhiều iteration hôm nay.<br /><br />
          <strong>Giải pháp:</strong><br />
          • <strong>Đợi đến nửa đêm Pacific Time</strong> (~15:00 ICT) để quota reset, hoặc<br />
          • <strong>Upgrade paid tier</strong> tại <a className="font-semibold underline" href="https://aistudio.google.com/billing" target="_blank" rel="noreferrer">aistudio.google.com/billing</a>
        </div>
      </div>
    )
  }
  if (spec.kind === 'quota_youtube') {
    return (
      <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-5">
        <div className="mb-2 text-base font-bold text-amber-900">⛔ Quota YouTube Data API đã cạn</div>
        <div className="text-sm leading-relaxed text-amber-800">
          Mặc định <strong>10,000 units/ngày</strong>, mỗi search = 100 units → tối đa ~100 search/ngày.<br /><br />
          <strong>Giải pháp:</strong> đợi đến nửa đêm Pacific Time hoặc{' '}
          <a className="font-semibold underline" href="https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas" target="_blank" rel="noreferrer">request tăng quota</a>.
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
  const { scene, ranked, errors, timestamps } = state
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="rounded-full bg-violet-500 px-2 py-0.5 text-xs font-semibold text-white">Scene {idx + 1}</span>
        <span className="text-base font-medium text-gray-900">{scene.line}</span>
      </div>
      <div className="mb-2 rounded border-l-4 border-violet-400 bg-violet-50 px-3 py-1.5 text-sm text-violet-900">
        💡 {scene.visualIntent}
      </div>
      <div className="mb-3 text-xs text-gray-500">
        <strong>Keywords:</strong> {scene.keywordVi} ·{' '}
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{scene.keywordEn}</code>
      </div>

      {ranked.length === 0 && Object.keys(errors).length === 0 && (
        <div className="rounded bg-gray-50 py-3 text-center text-xs text-gray-400">⏳ Đang tìm YouTube + TikTok + Web...</div>
      )}

      {ranked.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((r) => <ResultCard key={r._cardId} link={r} ts={timestamps[r._cardId]} />)}
        </div>
      )}

      {Object.entries(errors).map(([source, msg]) => (
        <div key={source} className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
          {source === 'youtube' ? 'YouTube' : source === 'tiktok' ? 'TikTok' : 'Web'}: {msg}
        </div>
      ))}
    </div>
  )
}

// ── ResultCard ──────────────────────────────────────────────────────────────
const SOURCE_TAG_STYLE: Record<SourceId, string> = {
  youtube: 'bg-red-100 text-red-700',
  tiktok:  'bg-gray-900 text-white',
  web:     'bg-blue-100 text-blue-700',
}
const SOURCE_TAG_LABEL: Record<SourceId, string> = {
  youtube: 'YT', tiktok: 'TT', web: 'WEB',
}

function ResultCard({ link, ts }: { link: RankedLink; ts: SceneState['timestamps'][string] | undefined }) {
  const thumbUrl = link.thumbnail ?? `https://image.thum.io/get/width/400/crop/225/noanimate/${link.url}`
  const scoreColor = colorForScore(link.score)
  return (
    <div className="relative flex flex-col rounded-lg border border-gray-200 bg-gray-50 p-2 transition-all hover:-translate-y-0.5 hover:border-violet-400">
      {typeof link.score === 'number' && (
        <div
          className="absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-sm"
          style={{ backgroundColor: scoreColor }}
          title={link.reason}
        >
          ⭐ {link.score}
        </div>
      )}
      <a href={link.url} target="_blank" rel="noreferrer" className="block flex-1">
        <div className="aspect-video w-full overflow-hidden rounded bg-gray-200">
          <img src={thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        </div>
        <div className="mt-2 text-sm font-medium leading-snug text-gray-800">
          <span className={`mr-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_TAG_STYLE[link.source]}`}>
            {SOURCE_TAG_LABEL[link.source]}
          </span>
          {link.title || link.url}
        </div>
        {link.reason && <div className="mt-1 text-xs italic text-gray-500">💡 {link.reason}</div>}
        {link.meta && <div className="mt-0.5 truncate text-xs text-gray-400">{link.meta}</div>}
      </a>
      {ts !== undefined && <TimestampSection url={link.url} ts={ts} />}
    </div>
  )
}

// ── TimestampSection ────────────────────────────────────────────────────────
function TimestampSection({ url, ts }: { url: string; ts: SceneState['timestamps'][string] }) {
  if (ts === 'loading') {
    return <div className="mt-2 border-t border-dashed border-gray-200 pt-2 text-xs italic text-gray-500">⏳ Đang xem video tìm timestamp...</div>
  }
  if ('error' in ts) {
    return <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">⚠️ Lỗi phân tích: {ts.error}</div>
  }
  return (
    <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
      {ts.found && ts.timestamps && ts.timestamps.length > 0 ? (
        <>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">⏱️ Đoạn phù hợp</div>
          <div className="flex flex-col gap-1">
            {ts.timestamps.map((t, j) => {
              const sep = url.includes('?') ? '&' : '?'
              const deepLink = `${url}${sep}t=${parseTimeToSeconds(t.start)}s`
              return (
                <a key={j} href={deepLink} target="_blank" rel="noreferrer" className="flex gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-gray-800 transition-colors hover:bg-amber-100">
                  <span className="whitespace-nowrap font-mono font-bold text-amber-700">{t.start}–{t.end}</span>
                  <span className="flex-1 leading-snug">{t.description}</span>
                </a>
              )
            })}
          </div>
        </>
      ) : (
        <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">❌ Video này không chứa cảnh phù hợp</div>
      )}
      {ts.summary && <div className="mt-1 text-[11px] italic leading-snug text-gray-500">📝 {ts.summary}</div>}
    </div>
  )
}
