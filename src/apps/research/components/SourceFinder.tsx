// SourceFinder — "Tìm Source" overlay cho Research.
// Pick SP (Kho) hoặc handoff từ ProductDetail → Gemini sinh: từ khóa tìm CHÍNH SP (zh/ms/en) +
// Scene Brief (nhóm cảnh B-roll + truy vấn theo nền tảng). Có ảnh SP → gửi Gemini vision ("quét ảnh").
// Clip Douyin lấy thật qua TikHub (/api/tikhub-search); Kuaishou/RED/TikTok = link search thủ công.
// Theme: dùng token app (bg-app-*, text-app-*, ui-accent-*) → tự theo dark/studio.
import { useState } from 'react'
import { X, Sparkles, Copy, ExternalLink, Image as ImageIcon, Film, Clapperboard, Download } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiText, directGeminiVision } from '../../../utils/gemini'

interface KwSet { zh: string[]; ms: string[]; en: string[] }
interface Scene { group: string; emoji: string; idea: string; queries: { zh: string; ms: string; en: string } }
interface Brief { productGuessVi: string; productKeywords: KwSet; scenes: Scene[] }
interface Clip { id: string; videoUrl: string; cover: string; desc: string; author: string; likes: number; durationSec: number; shareUrl: string; platform: string }
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))

const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    productGuessVi: { type: 'string' },
    productKeywords: {
      type: 'object',
      properties: { zh: { type: 'array', items: { type: 'string' } }, ms: { type: 'array', items: { type: 'string' } }, en: { type: 'array', items: { type: 'string' } } },
      required: ['zh', 'ms', 'en'],
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          group: { type: 'string' }, emoji: { type: 'string' }, idea: { type: 'string' },
          queries: { type: 'object', properties: { zh: { type: 'string' }, ms: { type: 'string' }, en: { type: 'string' } }, required: ['zh', 'ms', 'en'] },
        },
        required: ['group', 'emoji', 'idea', 'queries'],
      },
    },
  },
  required: ['productGuessVi', 'productKeywords', 'scenes'],
}

const searchLinks = (kw: string) => {
  const q = encodeURIComponent(kw)
  return [
    { label: 'Douyin', url: `https://www.douyin.com/search/${q}` },
    { label: 'Kuaishou', url: `https://www.kuaishou.com/search/video?searchKey=${q}` },
    { label: 'RED', url: `https://www.xiaohongshu.com/search_result?keyword=${q}` },
    { label: 'TikTok', url: `https://www.tiktok.com/search?q=${q}` },
  ]
}

async function urlToInline(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const r = await fetch(url)
    const blob = await r.blob()
    const buf = await blob.arrayBuffer()
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return { mimeType: blob.type || 'image/jpeg', data: btoa(bin) }
  } catch { return null }
}

const proxyDownload = (url: string, name: string) => {
  const href = `/api/dl-video?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
  const el = document.createElement('a'); el.href = href; el.download = name
  document.body.appendChild(el); el.click(); el.remove()
}

export default function SourceFinder({ initial, onClose }: { initial?: { name: string; imageUrl?: string } | null; onClose: () => void }) {
  const products = useBankStore((s) => s.products)
  const addToast = useAppStore((s) => s.addToast)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const [name, setName] = useState(initial?.name ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '')
  const [pickId, setPickId] = useState('')
  const [tab, setTab] = useState<'product' | 'scenes'>('product')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [brief, setBrief] = useState<Brief | null>(null)
  // Clip Douyin (TikHub) cho 1 từ khóa
  const [clipQuery, setClipQuery] = useState<string | null>(null)
  const [clips, setClips] = useState<Clip[] | null>(null)
  const [clipsBusy, setClipsBusy] = useState(false)
  const [clipsErr, setClipsErr] = useState<string | null>(null)

  const pickProduct = (id: string) => {
    setPickId(id)
    const p = products.find((x) => x.id === id)
    if (p) { setName(p.productName || ''); setImageUrl(p.productImages?.[0] || ''); setBrief(null) }
  }
  const copy = (t: string) => { navigator.clipboard?.writeText(t); addToast('Đã copy', 'success') }
  const safe = (s: string) => (s || 'sp').replace(/[^\w]+/g, '-').slice(0, 24)

  const findClips = async (kw: string) => {
    setClipQuery(kw); setClips(null); setClipsErr(null); setClipsBusy(true)
    try {
      const d = await fetch(`/api/tikhub-search?q=${encodeURIComponent(kw)}&platform=douyin&sort=like`).then((r) => r.json())
      if (d.error) { setClipsErr(d.error); setClipsBusy(false); return }
      setClips(Array.isArray(d.clips) ? d.clips : [])
      if (!d.clips?.length) setClipsErr(d.note || 'Không có clip — đổi từ khóa')
    } catch (e) { setClipsErr((e as Error).message) } finally { setClipsBusy(false) }
  }

  const genBrief = async () => {
    if (!name.trim()) { setErr('Chọn SP từ Kho hoặc gõ tên SP'); return }
    if (!geminiApiKey) { setErr('Cần Gemini API key trong Cài đặt'); return }
    setBusy(true); setErr(null); setBrief(null)
    try {
      const prompt = `Bạn là đạo diễn B-roll cho quảng cáo COD bán ở Malaysia. Sản phẩm: "${name}".${imageUrl ? ' (Có ảnh sản phẩm kèm theo — NHÌN ẢNH để hiểu đúng sản phẩm.)' : ''}
Mục tiêu: giúp marketer tìm NGUYÊN LIỆU VIDEO NGẮN để cắt ghép quảng cáo.
Trả JSON tiếng Việt:
- "productGuessVi": đoán sản phẩm này là gì (ngắn gọn).
- "productKeywords": từ khóa để tìm CHÍNH sản phẩm này (clip người cầm/demo SP) — zh=tiếng Trung (cho Douyin/Kuaishou), ms=tiếng Malay, en=tiếng Anh; mỗi mảng 3-5 từ khóa NGẮN.
- "scenes": 6-9 cảnh B-roll LIÊN QUAN, phủ các nhóm: "Vấn đề", "Cơ chế/thành phần", "Hành động/sử dụng", "Kết quả", "Cảm xúc", "3D/giải phẫu" (nếu hợp). Mỗi cảnh: group, emoji, idea (mô tả cảnh tiếng Việt), queries{zh,ms,en} (truy vấn search NGẮN 2-5 từ cho từng nền tảng).
Cảnh phải THẬT/ĐỜI (kiểu UGC), không cảnh điện ảnh lung linh. CHỈ trả JSON.`
      let raw: string
      const inline = imageUrl ? await urlToInline(imageUrl) : null
      if (inline) {
        raw = await directGeminiVision({
          apiKey: geminiApiKey,
          parts: [{ inlineData: inline }, { text: prompt }],
          responseMimeType: 'application/json', responseSchema: BRIEF_SCHEMA, temperature: 0.6, maxOutputTokens: 4096,
        })
      } else {
        raw = await directGeminiText({
          apiKey: geminiApiKey, prompt, responseMimeType: 'application/json', responseSchema: BRIEF_SCHEMA, temperature: 0.6, maxOutputTokens: 4096,
        })
      }
      let parsed: Brief
      try { parsed = JSON.parse(raw) as Brief } catch { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as Brief }
      setBrief(parsed)
    } catch (e) {
      setErr('AI lỗi: ' + ((e as Error).message || '').slice(0, 140))
    } finally { setBusy(false) }
  }

  const KwRow = ({ kw }: { kw: string }) => (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-app-border bg-app-card px-2 py-1.5">
      <span className="text-[12px] font-semibold text-app-text">{kw}</span>
      <button onClick={() => copy(kw)} className="rounded p-0.5 text-app-muted hover:bg-app-card-elevated" title="Copy"><Copy className="h-3 w-3" /></button>
      <button onClick={() => void findClips(kw)} className="ui-accent-solid rounded px-2 py-0.5 text-[10px] font-bold" title="Lấy clip Douyin">▶ Clip</button>
      <span className="ml-auto flex items-center gap-1">
        {searchLinks(kw).map((l) => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
            className="rounded border border-app-border px-1.5 py-0.5 text-[10px] font-medium text-app-muted hover:bg-app-card-elevated">{l.label}</a>
        ))}
      </span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-base" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-app-border bg-app-card px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dim"><Clapperboard className="h-4 w-4 text-accent" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-app-text">Tìm Source — nguyên liệu video cho SP</h2>
            <p className="truncate text-[11px] text-app-muted">Clip có sản phẩm + cảnh B-roll liên quan (Douyin/Kuaishou/TikTok) để cắt ghép</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full p-1 text-app-muted hover:bg-app-card-elevated"><X className="h-5 w-5" /></button>
        </div>

        {/* Chọn SP */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-app-border bg-app-card px-4 py-2.5">
          {imageUrl ? <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-card-elevated"><ImageIcon className="h-4 w-4 text-app-subtle" /></div>}
          <select value={pickId} onChange={(e) => pickProduct(e.target.value)} className="rounded-lg border border-app-border bg-app-card px-2 py-1.5 text-xs text-app-text">
            <option value="">— Chọn SP từ Kho —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
          </select>
          <input value={name} onChange={(e) => { setName(e.target.value); setPickId('') }} placeholder="…hoặc gõ tên SP"
            className="min-w-[180px] flex-1 rounded-lg border border-app-border bg-app-card px-3 py-1.5 text-sm text-app-text placeholder:text-app-subtle" />
          <button onClick={() => void genBrief()} disabled={busy}
            className="ui-accent-solid flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {busy ? 'AI đang nghĩ…' : (imageUrl ? '🔍 Quét ảnh + Scene Brief' : '🧠 Tạo Scene Brief')}
          </button>
          {err && <span className="w-full text-[11px] text-rose-400">{err}</span>}
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-2 border-b border-app-border bg-app-card px-4 py-2">
          <button onClick={() => setTab('product')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'product' ? 'ui-accent-soft' : 'text-app-muted'}`}><Film className="h-3.5 w-3.5" /> Clip có SP</button>
          <button onClick={() => setTab('scenes')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'scenes' ? 'ui-accent-soft' : 'text-app-muted'}`}><Clapperboard className="h-3.5 w-3.5" /> Cảnh B-roll liên quan</button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {clipQuery !== null ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button onClick={() => { setClipQuery(null); setClips(null); setClipsErr(null) }}
                  className="rounded-lg border border-app-border bg-app-card px-2.5 py-1 text-xs font-semibold text-app-muted hover:bg-app-card-elevated">← Brief</button>
                <span className="text-xs font-semibold text-app-text">Clip Douyin: <b>{clipQuery}</b></span>
                {clips ? <span className="text-[11px] text-app-muted">· {clips.length} clip</span> : null}
              </div>
              {clipsBusy && <div className="py-10 text-center text-sm text-app-muted">🤖 Đang lấy clip Douyin…</div>}
              {clipsErr && !clipsBusy && <p className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-xs text-app-muted">{clipsErr}</p>}
              {clips && clips.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                  {clips.map((c, i) => (
                    <div key={c.id} className="flex flex-col overflow-hidden rounded-xl border border-app-border bg-app-card">
                      <a href={c.shareUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-[3/4] bg-black">
                        {c.cover ? <img src={c.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">{c.durationSec}s</span>
                      </a>
                      <div className="flex flex-1 flex-col gap-1 p-2">
                        <p className="line-clamp-2 text-[10px] text-app-muted">{c.desc}</p>
                        <div className="flex items-center gap-2 text-[10px] text-app-subtle">
                          <span>❤️ {fmtK(c.likes)}</span>
                          {c.author ? <span className="line-clamp-1">@{c.author}</span> : null}
                        </div>
                        <div className="mt-auto flex gap-1 pt-1">
                          <button onClick={() => proxyDownload(c.videoUrl, `${safe(name)}-douyin-${i + 1}.mp4`)} className="ui-accent-solid flex-1 rounded py-1 text-[10px] font-semibold">⬇ Video</button>
                          {c.cover && <button onClick={() => proxyDownload(c.cover, `${safe(name)}-douyin-${i + 1}.jpg`)} className="rounded border border-app-border py-1 px-1.5 text-[10px] font-semibold text-app-muted hover:bg-app-card-elevated" title="Tải ảnh cover"><Download className="h-3 w-3" /></button>}
                          <a href={c.shareUrl} target="_blank" rel="noopener noreferrer" className="rounded border border-app-border px-1.5 py-1 text-[10px] font-semibold text-app-muted hover:bg-app-card-elevated" title="Mở trên Douyin"><ExternalLink className="h-3 w-3" /></a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (<>
          {!brief && !busy && (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-app-muted">
              <Clapperboard className="h-8 w-8" />
              <p className="text-sm">Chọn SP rồi bấm <b>Tạo Scene Brief</b>.</p>
              <p className="text-xs">AI sẽ ra từ khóa tìm clip có SP + các nhóm cảnh B-roll liên quan.</p>
            </div>
          )}
          {busy && <div className="py-12 text-center text-sm text-app-muted">🤖 AI đang phân tích sản phẩm & dựng Scene Brief…</div>}

          {brief && (
            <>
              <div className="mb-3 rounded-xl border border-app-border bg-accent-dim px-3 py-2 text-[12px] text-app-text">
                <b>AI hiểu SP:</b> {brief.productGuessVi}
              </div>

              {tab === 'product' ? (
                <div className="flex flex-col gap-3">
                  {([['🇨🇳 Tiếng Trung (Douyin/Kuaishou)', brief.productKeywords.zh], ['🇲🇾 Malay', brief.productKeywords.ms], ['🇬🇧 English', brief.productKeywords.en]] as [string, string[]][]).map(([label, kws]) => (
                    <div key={label}>
                      <div className="mb-1 text-[11px] font-bold text-app-muted">{label}</div>
                      <div className="flex flex-col gap-1.5">
                        {kws?.length ? kws.map((kw, i) => <KwRow key={i} kw={kw} />) : <span className="text-[11px] text-app-subtle">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {brief.scenes.map((s, i) => (
                    <div key={i} className="rounded-xl border border-app-border bg-app-card p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-base">{s.emoji}</span>
                        <span className="ui-accent-soft rounded-full px-2 py-0.5 text-[10px] font-bold">{s.group}</span>
                        <span className="text-[12px] text-app-muted">{s.idea}</span>
                      </div>
                      <div className="flex flex-col gap-1.5 rounded-lg bg-app-card-elevated p-1.5">
                        {([['中', s.queries.zh], ['MY', s.queries.ms], ['EN', s.queries.en]] as [string, string][]).map(([tag, q]) => q ? (
                          <div key={tag} className="flex flex-wrap items-center gap-1.5">
                            <span className="w-7 shrink-0 text-[10px] font-bold text-app-subtle">{tag}</span>
                            <span className="text-[12px] text-app-text">{q}</span>
                            <button onClick={() => copy(q)} className="rounded p-0.5 text-app-muted hover:bg-app-card" title="Copy"><Copy className="h-3 w-3" /></button>
                            <button onClick={() => void findClips(q)} className="ui-accent-solid rounded px-2 py-0.5 text-[10px] font-bold" title="Lấy clip Douyin">▶ Clip</button>
                            <span className="ml-auto flex items-center gap-1">
                              {searchLinks(q).map((l) => (
                                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-0.5 rounded border border-app-border px-1.5 py-0.5 text-[10px] font-medium text-app-muted hover:bg-app-card">{l.label}<ExternalLink className="h-2.5 w-2.5" /></a>
                              ))}
                            </span>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          </>)}
        </div>
      </div>
    </div>
  )
}
