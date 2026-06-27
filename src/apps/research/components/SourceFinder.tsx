// SourceFinder — "Tìm Source" overlay cho Research (Phase 1: khung + Scene Brief).
// Pick SP (từ Kho) hoặc nhận handoff từ ProductDetail → AI (Gemini) sinh:
//   • từ khóa tìm CHÍNH sản phẩm (zh/ms/en) — Tab "Clip có SP"
//   • Scene Brief: các nhóm cảnh B-roll liên quan + truy vấn theo nền tảng — Tab "Cảnh B-roll"
// Nếu có ẢNH SP → gửi kèm cho Gemini (vision) để đoán đúng SP + từ khóa sát hơn ("quét ảnh").
// Clip tự động (Douyin/Kuaishou/TikTok) = CHỜ TIKHUB_KEY → tạm thời mỗi query có link search thủ công.
import { useState } from 'react'
import { X, Sparkles, Copy, ExternalLink, Image as ImageIcon, Film, Clapperboard } from 'lucide-react'
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

// Link search thủ công theo nền tảng (dùng tạm khi chưa wire TikHub).
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

  const findClips = async (kw: string) => {
    setClipQuery(kw); setClips(null); setClipsErr(null); setClipsBusy(true)
    try {
      const d = await fetch(`/api/tikhub-search?q=${encodeURIComponent(kw)}&platform=douyin&sort=like`).then((r) => r.json())
      if (d.error) { setClipsErr(d.error); setClipsBusy(false); return }
      setClips(Array.isArray(d.clips) ? d.clips : [])
      if (!d.clips?.length) setClipsErr(d.note || 'Không có clip — đổi từ khóa')
    } catch (e) { setClipsErr((e as Error).message) } finally { setClipsBusy(false) }
  }
  const dlClip = (c: Clip, i: number) => {
    const nm = `${(name || 'sp').replace(/[^\w]+/g, '-').slice(0, 24)}-douyin-${i + 1}.mp4`
    const href = `/api/dl-video?url=${encodeURIComponent(c.videoUrl)}&name=${encodeURIComponent(nm)}`
    const el = document.createElement('a'); el.href = href; el.download = nm
    document.body.appendChild(el); el.click(); el.remove()
  }

  const pickProduct = (id: string) => {
    setPickId(id)
    const p = products.find((x) => x.id === id)
    if (p) { setName(p.productName || ''); setImageUrl(p.productImages?.[0] || ''); setBrief(null) }
  }

  const copy = (t: string) => { navigator.clipboard?.writeText(t); addToast('Đã copy', 'success') }

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

  // 1 dòng từ khóa: text + copy + link search nền tảng.
  const KwRow = ({ kw }: { kw: string }) => (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">
      <span className="text-[12px] font-semibold text-slate-700">{kw}</span>
      <button onClick={() => copy(kw)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" title="Copy"><Copy className="h-3 w-3" /></button>
      <button onClick={() => void findClips(kw)} className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-violet-700" title="Lấy clip Douyin">▶ Clip</button>
      <span className="ml-auto flex items-center gap-1">
        {searchLinks(kw).map((l) => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
            className="rounded border border-black/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50">{l.label}</a>
        ))}
      </span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#F4F4F7]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-black/10 bg-white px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100"><Clapperboard className="h-4 w-4 text-violet-600" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800">Tìm Source — nguyên liệu video cho SP</h2>
            <p className="truncate text-[11px] text-slate-400">Clip có sản phẩm + cảnh B-roll liên quan (Douyin/Kuaishou/TikTok) để cắt ghép</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {/* Chọn SP */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-black/10 bg-white px-4 py-2.5">
          {imageUrl ? <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><ImageIcon className="h-4 w-4 text-slate-300" /></div>}
          <select value={pickId} onChange={(e) => pickProduct(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs">
            <option value="">— Chọn SP từ Kho —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
          </select>
          <input value={name} onChange={(e) => { setName(e.target.value); setPickId('') }} placeholder="…hoặc gõ tên SP"
            className="min-w-[180px] flex-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm" />
          <button onClick={() => void genBrief()} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {busy ? 'AI đang nghĩ…' : (imageUrl ? '🔍 Quét ảnh + Scene Brief' : '🧠 Tạo Scene Brief')}
          </button>
          {err && <span className="w-full text-[11px] text-red-500">{err}</span>}
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-white px-4 py-2">
          <button onClick={() => setTab('product')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'product' ? 'bg-violet-100 text-violet-700' : 'text-slate-500'}`}><Film className="h-3.5 w-3.5" /> Clip có SP</button>
          <button onClick={() => setTab('scenes')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'scenes' ? 'bg-violet-100 text-violet-700' : 'text-slate-500'}`}><Clapperboard className="h-3.5 w-3.5" /> Cảnh B-roll liên quan</button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {clipQuery !== null ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button onClick={() => { setClipQuery(null); setClips(null); setClipsErr(null) }}
                  className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">← Brief</button>
                <span className="text-xs font-semibold text-slate-600">Clip Douyin: <b>{clipQuery}</b></span>
                {clips ? <span className="text-[11px] text-slate-400">· {clips.length} clip</span> : null}
              </div>
              {clipsBusy && <div className="py-10 text-center text-sm text-slate-400">🤖 Đang lấy clip Douyin…</div>}
              {clipsErr && !clipsBusy && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{clipsErr}</p>}
              {clips && clips.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                  {clips.map((c, i) => (
                    <div key={c.id} className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white">
                      <a href={c.shareUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-[3/4] bg-slate-900">
                        {c.cover ? <img src={c.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">{c.durationSec}s</span>
                      </a>
                      <div className="flex flex-1 flex-col gap-1 p-2">
                        <p className="line-clamp-2 text-[10px] text-slate-500">{c.desc}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>❤️ {fmtK(c.likes)}</span>
                          {c.author ? <span className="line-clamp-1">@{c.author}</span> : null}
                        </div>
                        <div className="mt-auto flex gap-1 pt-1">
                          <a href={c.shareUrl} target="_blank" rel="noopener noreferrer" className="flex-1 rounded border border-black/10 py-1 text-center text-[10px] font-semibold text-slate-600 hover:bg-slate-50">▶ Mở</a>
                          <button onClick={() => dlClip(c, i)} className="flex-1 rounded bg-violet-600 py-1 text-[10px] font-semibold text-white hover:bg-violet-700">⬇ Tải</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (<>
          {!brief && !busy && (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-slate-400">
              <Clapperboard className="h-8 w-8" />
              <p className="text-sm">Chọn SP rồi bấm <b>Tạo Scene Brief</b>.</p>
              <p className="text-xs">AI sẽ ra từ khóa tìm clip có SP + các nhóm cảnh B-roll liên quan.</p>
            </div>
          )}
          {busy && <div className="py-12 text-center text-sm text-slate-400">🤖 AI đang phân tích sản phẩm & dựng Scene Brief…</div>}

          {brief && (
            <>
              <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-800">
                <b>AI hiểu SP:</b> {brief.productGuessVi}
              </div>

              {/* Nguồn tự động: Douyin LIVE; Kuaishou/RED/TikTok mở thủ công */}
              <div className="mb-3 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-3 py-2 text-[11px] text-violet-700">
                ▶ Bấm <b>Clip</b> ở mỗi từ khóa để lấy <b>video Douyin</b> (xem/tải). Kuaishou/RED/TikTok dùng nút <b>link search</b> để mở thủ công (đang thêm vào sau).
              </div>

              {tab === 'product' ? (
                <div className="flex flex-col gap-3">
                  {([['🇨🇳 Tiếng Trung (Douyin/Kuaishou)', brief.productKeywords.zh], ['🇲🇾 Malay', brief.productKeywords.ms], ['🇬🇧 English', brief.productKeywords.en]] as [string, string[]][]).map(([label, kws]) => (
                    <div key={label}>
                      <div className="mb-1 text-[11px] font-bold text-slate-500">{label}</div>
                      <div className="flex flex-col gap-1.5">
                        {kws?.length ? kws.map((kw, i) => <KwRow key={i} kw={kw} />) : <span className="text-[11px] text-slate-400">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {brief.scenes.map((s, i) => (
                    <div key={i} className="rounded-xl border border-black/10 bg-white p-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-base">{s.emoji}</span>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">{s.group}</span>
                        <span className="text-[12px] text-slate-600">{s.idea}</span>
                      </div>
                      <div className="flex flex-col gap-1.5 rounded-lg bg-slate-50 p-1.5">
                        {([['中', s.queries.zh], ['MY', s.queries.ms], ['EN', s.queries.en]] as [string, string][]).map(([tag, q]) => q ? (
                          <div key={tag} className="flex flex-wrap items-center gap-1.5">
                            <span className="w-7 shrink-0 text-[10px] font-bold text-slate-400">{tag}</span>
                            <span className="text-[12px] text-slate-700">{q}</span>
                            <button onClick={() => copy(q)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" title="Copy"><Copy className="h-3 w-3" /></button>
                            <button onClick={() => void findClips(q)} className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-violet-700" title="Lấy clip Douyin">▶ Clip</button>
                            <span className="ml-auto flex items-center gap-1">
                              {searchLinks(q).map((l) => (
                                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-0.5 rounded border border-black/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-white">{l.label}<ExternalLink className="h-2.5 w-2.5" /></a>
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
