// SourceFinder — "Tìm Source" overlay cho Research.
// Tab 1 "Clip có SP": ảnh SP → reverse-image 1688 (khớp hình) → SP khớp → clip theo tên thật + ảnh/video gốc.
// Tab 2 "Cảnh B-roll": Scene Brief (Gemini) → mỗi cảnh "Lấy clip" → clip riêng cho cảnh đó (inline).
// Nguồn clip: Douyin · RED · Kuaishou · TikTok — đổi nền tảng KHÔNG mất kết quả (cache theo lane "${key}::${platform}").
//   • Douyin/RED/Kuaishou tìm bằng tiếng Trung (zhQuery). TikTok (MY/global) tìm bằng EN/Malay.
//   • Scene/concept đã có sẵn ms/en (khớp nghĩa) → TikTok dùng thẳng. Clip SP (1688 chỉ có tên Hoa) → sinh
//     từ khóa EN/Malay bằng toMsTerms (suy luận theo nghĩa, không dịch máy).
// Xem video: popup phát tại chỗ (qua proxy inline). Tải thêm: phân trang cursor. Theme token app (dark/studio).
import { useState, useEffect, type ChangeEvent } from 'react'
import { X, Sparkles, Copy, ExternalLink, Image as ImageIcon, Film, Clapperboard, Download, Play } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { directGeminiText, directGeminiVision } from '../../../utils/gemini'
import { isAssetRef, getAsBase64 } from '../../../utils/assetStore'

interface Concept { zh: string; ms: string; en: string }
interface Scene { group: string; emoji: string; idea: string; queries: { zh: string; ms: string; en: string } }
interface Brief { productGuessVi: string; productConcepts: Concept[]; scenes: Scene[] }
interface Clip { id: string; videoUrl: string; cover: string; desc: string; author: string; likes: number; durationSec: number; shareUrl: string; platform: string }
interface ImgProduct { itemId: string; title: string; titleVi: string; image: string; price: string; priceHigh: string; sold: string; score: string }
interface Detail { videos: string[]; images: string[]; shop: string; title: string }
// Source = thứ đang tìm clip. Mang truy vấn đa ngôn ngữ để đổi nền tảng dùng đúng ngôn ngữ cho CÙNG ý niệm.
//   zhQuery     — truy vấn tiếng Trung (Douyin/RED/Kuaishou).
//   tiktokSeed  — gốc để có truy vấn TikTok (EN/Malay).
//   tiktokReady — true: tiktokSeed ĐÃ là EN/Malay dùng thẳng (scene/concept). false: phải sinh qua toMsTerms (tên 1688).
interface ClipFor { kind: 'product' | 'scene'; key: string; label: string; zhQuery: string; tiktokSeed: string; tiktokReady: boolean }
interface PlayVid { url: string; download: string; share: string }
interface Lane { clips: Clip[]; cursor: string | null; hasMore: boolean }
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))
const proxyInline = (url: string) => `/api/dl-video?url=${encodeURIComponent(url)}&inline=1`

// Nền tảng nguồn clip (1 key TikHub dùng chung). Douyin/RED/Kuaishou = tiếng Trung; TikTok = EN/Malay.
type Platform = 'douyin' | 'xhs' | 'kuaishou' | 'tiktok'
const TIKTOK: Platform = 'tiktok'
const PLATS: { id: Platform; label: string; emoji: string }[] = [
  { id: 'douyin', label: 'Douyin', emoji: '🎵' },
  { id: 'xhs', label: 'RED', emoji: '📕' },
  { id: 'kuaishou', label: 'Kuaishou', emoji: '⚡' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎶' },
]
const platLabel = (p: Platform) => PLATS.find((x) => x.id === p)?.label ?? 'Douyin'
const platSlug = (p: Platform) => (p === 'xhs' ? 'red' : p)
const laneId = (key: string, plat: Platform) => `${key}::${plat}`

const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    productGuessVi: { type: 'string' },
    productConcepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { zh: { type: 'string' }, ms: { type: 'string' }, en: { type: 'string' } },
        required: ['zh', 'ms', 'en'],
      },
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
  required: ['productGuessVi', 'productConcepts', 'scenes'],
}

// Tên SP 1688 (tiếng Trung) → 1-3 từ khóa EN/Malay cho TikTok MY. Suy luận theo NGHĨA (người MY gõ gì để ra
// footage SP đó), KHÔNG dịch chữ. Inline để Research tự đủ (không phụ thuộc app khác).
const TO_MS_SYSTEM = `You convert a product name / footage keyword into SHORT English-or-Malay (Bahasa Malaysia) keywords for searching TikTok (audience = Malaysia / global).
RULES:
- Output 1-3 SHORT keywords (1-3 words each). NEVER a whole sentence.
- Input may be Chinese, Vietnamese or English — REASON about what a real person in Malaysia would type on TikTok to find that product/footage. Do NOT translate literally.
- Prefer common English search words; use Malay when it is the more natural search term. Mixing is fine.
- NO Chinese characters in the output. No brand names.
Return JSON: {"terms": ["…","…"]}.`
const TO_MS_SCHEMA = { type: 'object', properties: { terms: { type: 'array', items: { type: 'string' } } }, required: ['terms'] }
async function toMsTerms(seed: string, apiKey: string): Promise<string[]> {
  const text = (seed || '').trim()
  if (!text) return []
  const raw = await directGeminiText({
    apiKey,
    prompt: `Product name / footage keyword: "${text}"`,
    systemInstruction: TO_MS_SYSTEM,
    responseMimeType: 'application/json',
    responseSchema: TO_MS_SCHEMA,
    thinkingBudget: 0,
    maxOutputTokens: 256,
    temperature: 0.5,
  })
  let parsed: { terms?: unknown }
  try { parsed = JSON.parse(raw) as { terms?: unknown } }
  catch { const m = raw.match(/\{[\s\S]*\}/); if (!m) return []; parsed = JSON.parse(m[0]) as { terms?: unknown } }
  const arr = Array.isArray(parsed.terms) ? parsed.terms : []
  const out: string[] = []
  for (const it of arr) {
    const t = typeof it === 'string' ? it.trim() : ''
    if (t && !/[一-鿿]/.test(t) && !out.includes(t)) out.push(t)
    if (out.length >= 3) break
  }
  return out
}

const searchLinks = (kw: string) => {
  const q = encodeURIComponent(kw)
  return [
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

// Resize ảnh bằng canvas → JPEG nhỏ (data URL) trước khi gửi 1688 (né "ảnh quá lớn").
function toResizedBase64(src: string, max = 1000, q = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let w = img.naturalWidth || img.width
      let h = img.naturalHeight || img.height
      const scale = Math.min(1, max / Math.max(w, h))
      w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) { reject(new Error('no canvas ctx')); return }
      ctx.drawImage(img, 0, 0, w, h)
      try { resolve(c.toDataURL('image/jpeg', q)) } catch (e) { reject(e as Error) }
    }
    img.onerror = () => reject(new Error('load image failed'))
    img.src = src
  })
}

const proxyDownload = (url: string, name: string) => {
  const href = `/api/dl-video?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
  const el = document.createElement('a'); el.href = href; el.download = name
  document.body.appendChild(el); el.click(); el.remove()
}

// ── Lưu state để F5 không mất (localStorage) ──
const SAVE_KEY = 'source-finder-state-v2'
interface Saved { name?: string; imageUrl?: string; pickId?: string; tab?: 'product' | 'scenes'; brief?: Brief | null; imgProducts?: ImgProduct[] | null; clipFor?: ClipFor | null; lanes?: Record<string, Lane>; msQ?: Record<string, string>; onlyShort?: boolean; platform?: Platform }
function readSaved(): Saved | null { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Saved | null } catch { return null } }
function clearSaved() { try { localStorage.removeItem(SAVE_KEY) } catch { /* */ } }

// ── Cache reverse-image trong phiên → tra lại cùng ảnh KHÔNG tốn quota RapidAPI ──
const imgCache = new Map<string, ImgProduct[]>()
const hashStr = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h) }

export default function SourceFinder({ initial, onClose }: { initial?: { name: string; imageUrl?: string } | null; onClose: () => void }) {
  const products = useBankStore((s) => s.products)
  const addToast = useAppStore((s) => s.addToast)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const [saved] = useState(() => readSaved())
  const [name, setName] = useState(saved?.name ?? initial?.name ?? '')
  const [imageUrl, setImageUrl] = useState(saved?.imageUrl ?? initial?.imageUrl ?? '')
  const [pickId, setPickId] = useState(saved?.pickId ?? '')
  const [pickOpen, setPickOpen] = useState(false)
  const [tab, setTab] = useState<'product' | 'scenes'>(saved?.tab ?? 'product')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [brief, setBrief] = useState<Brief | null>(saved?.brief ?? null)
  // Reverse-image 1688 (Tab 1)
  const [imgProducts, setImgProducts] = useState<ImgProduct[] | null>(saved?.imgProducts ?? null)
  const [imgBusy, setImgBusy] = useState(false)
  const [imgErr, setImgErr] = useState<string | null>(null)
  // Clip (gắn ngữ cảnh: product/scene) — render inline đúng chỗ. Lanes cache theo "${key}::${platform}" nên
  // đổi nền tảng KHÔNG mất kết quả: lane đã có thì hiện lại ngay, lane trống mới fetch.
  const [clipFor, setClipFor] = useState<ClipFor | null>(saved?.clipFor ?? null)
  const [lanes, setLanes] = useState<Record<string, Lane>>(saved?.lanes ?? {})
  const [msQ, setMsQ] = useState<Record<string, string>>(saved?.msQ ?? {})   // từ khóa TikTok đã sinh (theo source key)
  const [clipsBusy, setClipsBusy] = useState(false)
  const [clipsErr, setClipsErr] = useState<string | null>(null)
  const [moreBusy, setMoreBusy] = useState(false)
  const [msBusy, setMsBusy] = useState(false)   // đang sinh từ khóa EN/Malay cho clip SP trên TikTok
  const [onlyShort, setOnlyShort] = useState(saved?.onlyShort ?? true)   // chỉ clip <60s (hợp cắt B-roll)
  const [platform, setPlatform] = useState<Platform>(saved?.platform ?? 'douyin')   // nguồn clip
  // Popup phát video + popup ảnh/video gốc 1688
  const [playVid, setPlayVid] = useState<PlayVid | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)

  // Lưu state để F5 không mất (bỏ qua nếu quá quota → bỏ ảnh data URL nặng, rồi bỏ lanes nếu vẫn quá).
  useEffect(() => {
    const snap: Saved = { name, imageUrl, pickId, tab, brief, imgProducts, clipFor, lanes, msQ, onlyShort, platform }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(snap)) }
    catch {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...snap, imageUrl: imageUrl.startsWith('data:') ? '' : imageUrl })) }
      catch { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...snap, imageUrl: imageUrl.startsWith('data:') ? '' : imageUrl, lanes: {} })) } catch { /* */ } }
    }
  }, [name, imageUrl, pickId, tab, brief, imgProducts, clipFor, lanes, msQ, onlyShort, platform])

  const close = () => { clearSaved(); onClose() }
  const copy = (t: string) => { navigator.clipboard?.writeText(t); addToast('Đã copy', 'success') }
  const safe = (s: string) => (s || 'sp').replace(/[^\w]+/g, '-').slice(0, 24)

  // Lane hiện tại (theo clipFor + nền tảng đang chọn).
  const curLane: Lane | undefined = clipFor ? lanes[laneId(clipFor.key, platform)] : undefined

  // Truy vấn cho 1 nền tảng: TikTok → EN/Malay (sẵn từ scene/concept, hoặc sinh qua toMsTerms cho tên 1688).
  const queryForPlat = async (cf: ClipFor, plat: Platform): Promise<string> => {
    if (plat !== TIKTOK) return cf.zhQuery
    if (cf.tiktokReady) return cf.tiktokSeed
    const cached = msQ[cf.key]
    if (cached) return cached
    if (!geminiApiKey) return cf.tiktokSeed   // không có key → thử tìm thẳng bằng seed
    setMsBusy(true)
    try {
      const terms = await toMsTerms(cf.tiktokSeed, geminiApiKey)
      const q = terms[0] || cf.tiktokSeed
      setMsQ((m) => ({ ...m, [cf.key]: q }))
      return q
    } catch { return cf.tiktokSeed } finally { setMsBusy(false) }
  }

  // Fetch (hoặc tải thêm) clip cho 1 lane = (source × nền tảng). append=true → nối thêm theo cursor.
  const fetchLane = async (cf: ClipFor, plat: Platform, append: boolean) => {
    const id = laneId(cf.key, plat)
    setClipsErr(null)
    if (append) setMoreBusy(true); else setClipsBusy(true)
    try {
      const q = await queryForPlat(cf, plat)
      if (!q) { setClipsErr('Chưa có từ khóa cho nền tảng này'); return }
      const cur = append ? (lanes[id]?.cursor ?? null) : null
      const curParam = cur ? `&cursor=${encodeURIComponent(cur)}` : ''
      const d = await fetch(`/api/tikhub-search?q=${encodeURIComponent(q)}&platform=${plat}&sort=like&maxSec=${onlyShort ? 60 : 0}${curParam}`).then((r) => r.json())
      if (d.error) {
        setClipsErr(d.error + (d.detail ? ` — ${String(d.detail).slice(0, 160)}` : ''))
        if (!append) setLanes((L) => ({ ...L, [id]: { clips: [], cursor: null, hasMore: false } }))
        return
      }
      const incoming: Clip[] = Array.isArray(d.clips) ? d.clips : []
      setLanes((L) => {
        const prev = append ? (L[id]?.clips ?? []) : []
        const seen = new Set(prev.map((c) => c.id))
        const merged = [...prev, ...incoming.filter((c) => !seen.has(c.id))]
        return { ...L, [id]: { clips: merged, cursor: d.cursor ?? null, hasMore: !!d.hasMore } }
      })
      if (!append && incoming.length === 0) setClipsErr(d.note || 'Không có clip — đổi từ khóa hoặc nền tảng khác')
    } catch (e) { setClipsErr((e as Error).message) } finally { setClipsBusy(false); setMoreBusy(false) }
  }

  // Mở 1 source → set context + fetch nền tảng đang chọn nếu lane chưa có.
  const openSource = (cf: ClipFor) => {
    setClipFor(cf); setClipsErr(null)
    if (!lanes[laneId(cf.key, platform)]) void fetchLane(cf, platform, false)
  }
  // Đổi nền tảng: chỉ đổi view; lane đã cache thì giữ nguyên (không mất kết quả), trống mới fetch.
  const switchPlat = (next: Platform) => {
    if (next === platform) return
    setPlatform(next); setClipsErr(null)
    if (clipFor && !lanes[laneId(clipFor.key, next)]) void fetchLane(clipFor, next, false)
  }
  const loadMoreClips = () => { if (clipFor && curLane?.hasMore && !moreBusy) void fetchLane(clipFor, platform, true) }
  // Đổi lọc độ dài → maxSec đổi → mọi lane cũ vô nghĩa → xoá hết, fetch lại nền hiện tại.
  const changeOnlyShort = (v: boolean) => {
    setOnlyShort(v); setLanes({})
    if (clipFor) void fetchLane(clipFor, platform, false)
  }

  const findByImage = async () => {
    if (!imageUrl) { setImgErr('Cần ảnh SP (chọn từ Kho hoặc 📁 Tải ảnh) để khớp hình'); return }
    // Cache: cùng ảnh đã tra → dùng lại, KHỎI tốn quota RapidAPI.
    const ckey = hashStr(imageUrl)
    const cached = imgCache.get(ckey)
    if (cached) { setImgProducts(cached); if (cached.length) openSource(productSource(cached[0])); return }
    setImgBusy(true); setImgErr(null); setImgProducts(null)
    try {
      let body: { base64?: string; imageUrl?: string }
      try { body = { base64: await toResizedBase64(imageUrl, 800, 0.72) } }   // nhỏ gọn → 1688 không trả 400 "ảnh quá lớn"
      catch { body = imageUrl.startsWith('data:') ? { base64: imageUrl } : { imageUrl } }
      const d = await fetch('/api/rapid-1688?action=search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
      if (d.error) { setImgErr(d.error + (d.detail ? ` — ${String(d.detail).slice(0, 120)}` : '')); setImgBusy(false); return }
      const list: ImgProduct[] = Array.isArray(d.products) ? d.products : []
      if (list.length) imgCache.set(ckey, list)
      setImgProducts(list)
      if (!list.length) setImgErr(d.note || 'Không tìm thấy SP khớp ảnh — thử ảnh nền sạch hơn')
      else openSource(productSource(list[0]))   // khớp ảnh → ra VIDEO luôn
    } catch (e) { setImgErr((e as Error).message) } finally { setImgBusy(false) }
  }
  // Source cho 1 SP khớp 1688: zh = tên Hoa thật; TikTok seed = tên Việt (sinh EN/Malay qua AI).
  const productSource = (p: ImgProduct): ClipFor => ({ kind: 'product', key: p.itemId, label: p.titleVi || p.title, zhQuery: p.title, tiktokSeed: p.titleVi || p.title, tiktokReady: false })

  const openDetail = async (itemId: string) => {
    setDetailOpen(true); setDetail(null); setDetailBusy(true)
    try { const d = await fetch(`/api/rapid-1688?action=detail&itemId=${encodeURIComponent(itemId)}`).then((r) => r.json()); setDetail(d as Detail) }
    catch { /* */ } finally { setDetailBusy(false) }
  }

  const pickProduct = async (id: string) => {
    setPickId(id)
    const p = products.find((x) => x.id === id)
    if (!p) return
    setName(p.productName || ''); setBrief(null); setImgProducts(null); setClipFor(null); setLanes({})
    const raw = p.productImages?.[0] || ''
    if (isAssetRef(raw)) { const a = await getAsBase64(raw); setImageUrl(a ? `data:${a.mimeType};base64,${a.base64}` : '') }
    else setImageUrl(raw)
  }
  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const rd = new FileReader()
    rd.onload = () => { setImageUrl(String(rd.result || '')); setPickId(''); setBrief(null); setImgProducts(null); setClipFor(null); setLanes({}) }
    rd.readAsDataURL(f)
  }

  const genBrief = async () => {
    if (!name.trim() && !imageUrl) { setErr('Chọn SP từ Kho, gõ tên, hoặc tải ảnh lên'); return }
    if (!geminiApiKey) { setErr('Cần Gemini API key trong Cài đặt'); return }
    setBusy(true); setErr(null); setBrief(null); setClipFor(null); setLanes({})
    try {
      const label = name.trim() || '(không cho tên — TỰ NHẬN DIỆN sản phẩm từ ảnh)'
      const prompt = `Bạn là đạo diễn B-roll cho quảng cáo COD bán ở Malaysia. Sản phẩm: "${label}".${imageUrl ? ' (Có ảnh sản phẩm kèm theo — NHÌN ẢNH để nhận diện đúng sản phẩm; nếu không có tên thì dựa hoàn toàn vào ảnh.)' : ''}
Mục tiêu: giúp marketer tìm NGUYÊN LIỆU VIDEO NGẮN để cắt ghép quảng cáo.
Trả JSON tiếng Việt:
- "productGuessVi": đoán sản phẩm này là gì (ngắn gọn).
- "productConcepts": 3-5 Ý NIỆM tìm kiếm để ra clip CHÍNH sản phẩm này (clip người cầm/demo/khui hộp SP). MỖI ý niệm cho ĐỦ 3 ngôn ngữ KHỚP NGHĨA với nhau: "zh" tiếng Trung (Douyin/Kuaishou/RED), "ms" tiếng Malay, "en" tiếng Anh — mỗi cái là từ khóa NGẮN 1-4 từ.
  ⚠️ "ms"/"en" KHÔNG dịch chữ máy móc từ "zh" — hãy SUY LUẬN người Malaysia THẬT sẽ gõ gì trên TikTok để ra footage sản phẩm đó (từ khóa search bản địa). Phải BÁM SÁT đúng sản phẩm này, không chung chung.
- "scenes": 6-9 cảnh B-roll minh hoạ TÌNH HUỐNG, phủ nhóm: "Vấn đề", "Cơ chế/thành phần", "Hành động/sử dụng", "Kết quả", "Cảm xúc", "3D/giải phẫu" (nếu hợp). Mỗi cảnh: group, emoji, idea (mô tả cảnh tiếng Việt), queries{zh,ms,en} (truy vấn search NGẮN 2-5 từ, 3 ngôn ngữ KHỚP NGHĨA; ms/en suy luận theo cách người MY gõ TikTok, không dịch máy).
  ⚠️ CỰC QUAN TRỌNG: cảnh B-roll **KHÔNG chứa sản phẩm, KHÔNG kèm tên/brand SP trong truy vấn** — chỉ mô tả VẤN ĐỀ / CẢM XÚC / HÀNH ĐỘNG / BỐI CẢNH. Nhưng phải SUY từ ĐÚNG triệu chứng/cơ chế/bối cảnh CỤ THỂ của sản phẩm ở trên (đừng bê nguyên ví dụ mẫu nếu SP khác, đừng chung chung kiểu "wellness").
  Ví dụ tư duy (chỉ là MẪU cách nghĩ, áp cho mọi ngách):
   • đai gối → Vấn đề: zh"膝盖痛"/ms"sakit lutut"/en"knee pain" · Hành động: zh"爬楼梯"/ms"naik tangga"/en"climbing stairs".
   • kem trị mụn → Vấn đề: zh"满脸痘痘"/ms"jerawat"/en"acne face" · Cơ chế: zh"毛孔特写"/ms"pori-pori"/en"clogged pores".
   • collagen → Vấn đề: zh"皱纹"/ms"kerutan"/en"wrinkles" · Cảm xúc: zh"自信女人"/ms"wanita yakin"/en"confident woman".
Cảnh phải THẬT/ĐỜI (kiểu UGC), không lung linh điện ảnh. CHỈ trả JSON.`
      let raw: string
      const inline = imageUrl ? await urlToInline(imageUrl) : null
      if (inline) {
        raw = await directGeminiVision({ apiKey: geminiApiKey, parts: [{ inlineData: inline }, { text: prompt }], responseMimeType: 'application/json', responseSchema: BRIEF_SCHEMA, temperature: 0.6, maxOutputTokens: 4096 })
      } else {
        raw = await directGeminiText({ apiKey: geminiApiKey, prompt, responseMimeType: 'application/json', responseSchema: BRIEF_SCHEMA, temperature: 0.6, maxOutputTokens: 4096 })
      }
      let parsed: Brief
      try { parsed = JSON.parse(raw) as Brief } catch { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as Brief }
      setBrief(parsed)
    } catch (e) {
      setErr('AI lỗi: ' + ((e as Error).message || '').slice(0, 140))
    } finally { setBusy(false) }
  }

  // ── Lưới clip + nút play/tải + tải thêm (dùng cho cả Tab1 & Tab2) ──
  const clipGrid = () => {
    const clips = curLane?.clips ?? []
    return (
      <div className="mt-2">
        {/* Nền tảng nguồn — đổi nền tảng KHÔNG mất kết quả (cache theo lane). */}
        {clipFor && (
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold text-app-subtle">Nguồn:</span>
            {PLATS.map((p) => {
              const n = lanes[laneId(clipFor.key, p.id)]?.clips.length ?? 0
              return (
                <button key={p.id} onClick={() => switchPlat(p.id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${platform === p.id ? 'ui-accent-soft' : 'border border-app-border bg-app-card text-app-muted hover:bg-app-card-elevated'}`}
                  title={`Tìm trên ${p.label}`}>
                  {p.emoji} {p.label}{n > 0 && <span className="opacity-60">· {n}</span>}
                </button>
              )
            })}
          </div>
        )}
        {(clipsBusy || msBusy) && <div className="py-8 text-center text-sm text-app-muted">🤖 {msBusy ? 'Đang tạo từ khóa EN/Malay cho TikTok…' : `Đang lấy clip ${platLabel(platform)}…`}</div>}
        {clipsErr && !clipsBusy && !msBusy && <p className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-xs text-app-muted">{clipsErr}</p>}
        {clips.length > 0 && (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {clips.map((c, i) => (
                <div key={`${c.platform}_${c.id}`} className="flex flex-col overflow-hidden rounded-xl border border-app-border bg-app-card">
                  <button onClick={() => setPlayVid({ url: c.videoUrl, download: `${safe(name)}-${platSlug(platform)}-${i + 1}.mp4`, share: c.shareUrl })}
                    className="group relative block aspect-[3/4] bg-black" title="Phát video">
                    {c.cover ? <img src={c.platform === 'douyin' ? c.cover : proxyInline(c.cover)} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
                    <span className="absolute inset-0 flex items-center justify-center"><Play className="h-9 w-9 text-white/90 drop-shadow group-hover:scale-110" /></span>
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">{c.durationSec}s</span>
                  </button>
                  <div className="flex flex-1 flex-col gap-1 p-2">
                    <p className="line-clamp-2 text-[10px] text-app-muted">{c.desc}</p>
                    <div className="flex items-center gap-2 text-[10px] text-app-subtle">
                      <span>❤️ {fmtK(c.likes)}</span>
                      {c.author ? <span className="line-clamp-1">@{c.author}</span> : null}
                    </div>
                    <div className="mt-auto flex gap-1 pt-1">
                      <button onClick={() => proxyDownload(c.videoUrl, `${safe(name)}-${platSlug(platform)}-${i + 1}.mp4`)} className="ui-accent-solid flex-1 rounded py-1 text-[10px] font-semibold">⬇ Video</button>
                      {c.cover && <button onClick={() => proxyDownload(c.cover, `${safe(name)}-${platSlug(platform)}-${i + 1}.jpg`)} className="rounded border border-app-border px-1.5 py-1 text-[10px] font-semibold text-app-muted hover:bg-app-card-elevated" title="Tải ảnh cover"><Download className="h-3 w-3" /></button>}
                      <a href={c.shareUrl} target="_blank" rel="noopener noreferrer" className="rounded border border-app-border px-1.5 py-1 text-[10px] font-semibold text-app-muted hover:bg-app-card-elevated" title={`Mở trên ${platLabel(platform)}`}><ExternalLink className="h-3 w-3" /></a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {curLane?.hasMore && (
              <button onClick={() => loadMoreClips()} disabled={moreBusy}
                className="mt-3 w-full rounded-xl border border-app-border bg-app-card py-2 text-xs font-semibold text-app-muted hover:bg-app-card-elevated disabled:opacity-50">
                {moreBusy ? 'Đang tải…' : '↻ Tải thêm video'}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-base">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-app-border bg-app-card px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dim"><Clapperboard className="h-4 w-4 text-accent" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-app-text">Tìm Source — nguyên liệu video cho SP</h2>
            <p className="truncate text-[11px] text-app-muted">Clip có sản phẩm + cảnh B-roll liên quan (Douyin · RED · Kuaishou · TikTok) — xem & tải trực tiếp để cắt ghép</p>
          </div>
          <button onClick={close} className="ml-auto rounded-full p-1 text-app-muted hover:bg-app-card-elevated"><X className="h-5 w-5" /></button>
        </div>

        {/* Chọn SP */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-app-border bg-app-card px-4 py-2.5">
          <label className="group relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-app-border bg-app-card-elevated" title="Tải ảnh SP lên">
            {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-4 w-4 text-app-subtle" /></span>}
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[8px] font-semibold text-white opacity-0 group-hover:opacity-100">Đổi ảnh</span>
            <input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          </label>
          <div className="relative">
            <button onClick={() => setPickOpen((v) => !v)} className="flex min-w-[220px] items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-1.5 text-xs text-app-text">
              <span className="truncate">{pickId ? (products.find((p) => p.id === pickId)?.productName || '') : '— Chọn SP từ Kho —'}</span>
              <span className="ml-auto text-app-muted">▾</span>
            </button>
            {pickOpen && (
              <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[260px] overflow-y-auto rounded-lg border border-app-border bg-app-card shadow-xl">
                <button onClick={() => { setPickId(''); setPickOpen(false) }} className="block w-full px-3 py-1.5 text-left text-xs text-app-muted hover:bg-app-card-elevated">— Chọn SP từ Kho —</button>
                {products.map((p) => (
                  <button key={p.id} onClick={() => { void pickProduct(p.id); setPickOpen(false) }} className="block w-full truncate px-3 py-1.5 text-left text-xs text-app-text hover:bg-app-card-elevated">{p.productName}</button>
                ))}
              </div>
            )}
          </div>
          <input value={name} onChange={(e) => { setName(e.target.value); setPickId('') }} placeholder="…hoặc gõ tên SP (ngoài app)"
            className="min-w-[180px] flex-1 rounded-lg border border-app-border bg-app-card px-3 py-1.5 text-sm text-app-text placeholder:text-app-subtle" />
          <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-app-border bg-app-card px-3 py-1.5 text-xs font-semibold text-app-muted hover:bg-app-card-elevated" title="Tải ảnh SP từ máy">
            📁 Tải ảnh<input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          </label>
          <button onClick={() => void genBrief()} disabled={busy} className="ui-accent-solid flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {busy ? 'AI đang nghĩ…' : (imageUrl ? '🔍 Quét ảnh + Scene Brief' : '🧠 Tạo Scene Brief')}
          </button>
          {err && <span className="w-full text-[11px] text-rose-400">{err}</span>}
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-app-border bg-app-card px-4 py-2">
          <button onClick={() => setTab('product')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'product' ? 'ui-accent-soft' : 'text-app-muted'}`}><Film className="h-3.5 w-3.5" /> Clip có SP</button>
          <button onClick={() => setTab('scenes')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === 'scenes' ? 'ui-accent-soft' : 'text-app-muted'}`}><Clapperboard className="h-3.5 w-3.5" /> Cảnh B-roll liên quan</button>
          <label className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-app-muted" title="Chỉ lấy clip ngắn để cắt B-roll">
            <input type="checkbox" checked={onlyShort} onChange={(e) => changeOnlyShort(e.target.checked)} /> ⏱ Chỉ clip &lt;60s
          </label>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!brief && !busy && (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-app-muted">
              <Clapperboard className="h-8 w-8" />
              <p className="text-sm">Chọn SP rồi bấm <b>Tạo Scene Brief</b>.</p>
              <p className="text-xs">AI ra từ khóa tìm clip có SP + các nhóm cảnh B-roll liên quan.</p>
            </div>
          )}
          {busy && <div className="py-12 text-center text-sm text-app-muted">🤖 AI đang phân tích sản phẩm & dựng Scene Brief…</div>}

          {brief && (
            <>
              <div className="mb-3 rounded-xl border border-app-border bg-accent-dim px-3 py-2 text-[12px] text-app-text"><b>AI hiểu SP:</b> {brief.productGuessVi}</div>

              {/* ── TAB 1: Clip có SP ── */}
              {tab === 'product' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => void findByImage()} disabled={imgBusy || !imageUrl} className="ui-accent-solid flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                      🔍 {imgBusy ? 'Đang khớp ảnh…' : 'Tìm SP khớp ảnh (1688)'}
                    </button>
                    {!imageUrl && <span className="text-[11px] text-app-subtle">Cần ảnh SP (chọn Kho / 📁 Tải ảnh) để khớp hình</span>}
                    {imgErr && <span className="text-[11px] text-rose-400">{imgErr}</span>}
                  </div>

                  {/* SP khớp ảnh — bấm để xem clip / mở ảnh-video gốc */}
                  {imgProducts && imgProducts.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {imgProducts.map((p) => (
                        <div key={p.itemId} className={`flex w-[150px] shrink-0 flex-col overflow-hidden rounded-xl border bg-app-card ${clipFor?.kind === 'product' && clipFor.key === p.itemId ? 'border-app-border-strong ring-1 ring-accent' : 'border-app-border'}`}>
                          <button onClick={() => openSource(productSource(p))} className="relative block aspect-square bg-black" title="Xem clip SP này">
                            {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : null}
                            {p.sold ? <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">🔥 {p.sold}/90d</span> : null}
                          </button>
                          <div className="flex flex-1 flex-col gap-1 p-1.5">
                            <p className="line-clamp-2 text-[10px] text-app-muted">{p.titleVi || p.title}</p>
                            <div className="text-[10px] text-app-subtle">{p.price ? `¥${p.price}` : ''}{p.score ? ` ⭐${p.score}` : ''}</div>
                            <div className="mt-auto flex gap-1 pt-0.5">
                              <button onClick={() => openSource(productSource(p))} className="ui-accent-solid flex-1 rounded py-0.5 text-[10px] font-semibold">▶ Clip</button>
                              <button onClick={() => void openDetail(p.itemId)} className="rounded border border-app-border px-1.5 py-0.5 text-[10px] font-semibold text-app-muted hover:bg-app-card-elevated" title="Ảnh/video gốc nhà bán">🎬</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Clip của SP đang chọn */}
                  {clipFor?.kind === 'product' && (
                    <div>
                      <div className="mb-1 text-[11px] font-bold text-app-muted">🎬 Clip {platLabel(platform)}: {clipFor.label}{curLane ? ` · ${curLane.clips.length}` : ''}</div>
                      {clipGrid()}
                    </div>
                  )}

                  {/* Fallback từ khóa (concept khớp 3 ngôn ngữ) */}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-app-muted">Hoặc tìm theo từ khóa (gần đúng) ▾</summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {brief.productConcepts?.length ? brief.productConcepts.map((c, i) => (
                        <button key={i} onClick={() => openSource({ kind: 'product', key: `kw-${c.zh}`, label: c.zh, zhQuery: c.zh, tiktokSeed: c.ms || c.en || c.zh, tiktokReady: true })}
                          className="rounded-full border border-app-border bg-app-card px-2.5 py-1 text-[11px] font-semibold text-app-text hover:bg-app-card-elevated">
                          ▶ {c.zh}{(c.ms || c.en) ? <span className="opacity-60"> / {c.ms || c.en}</span> : null}
                        </button>
                      )) : <span className="text-[11px] text-app-subtle">—</span>}
                    </div>
                  </details>
                </div>
              )}

              {/* ── TAB 2: Cảnh B-roll ── */}
              {tab === 'scenes' && (
                <div className="flex flex-col gap-3">
                  {brief.scenes.map((s, i) => {
                    const key = `scene-${i}`
                    const open = clipFor?.kind === 'scene' && clipFor.key === key
                    return (
                      <div key={i} className="rounded-xl border border-app-border bg-app-card p-3">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-base">{s.emoji}</span>
                          <span className="ui-accent-soft rounded-full px-2 py-0.5 text-[10px] font-bold">{s.group}</span>
                          <span className="text-[12px] text-app-muted">{s.idea}</span>
                          <button onClick={() => openSource({ kind: 'scene', key, label: s.queries.zh || s.idea, zhQuery: s.queries.zh || s.queries.en || s.idea, tiktokSeed: s.queries.ms || s.queries.en || s.idea, tiktokReady: true })}
                            className="ui-accent-solid ml-auto rounded px-2.5 py-1 text-[10px] font-bold" title="Lấy clip cảnh này">▶ Lấy clip</button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-app-subtle">
                          <span>Từ khóa: <b className="text-app-text">{s.queries.zh}</b>{(s.queries.ms || s.queries.en) ? <span className="opacity-70"> · 🇲🇾/EN {s.queries.ms || s.queries.en}</span> : null}</span>
                          <button onClick={() => copy(s.queries.zh)} className="rounded p-0.5 hover:bg-app-card-elevated"><Copy className="h-3 w-3" /></button>
                          {searchLinks(s.queries.zh).map((l) => (
                            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded border border-app-border px-1.5 py-0.5 hover:bg-app-card-elevated">{l.label}</a>
                          ))}
                        </div>
                        {open && clipGrid()}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Popup PHÁT VIDEO (cả clip nguồn lẫn video gốc 1688) ── */}
      {playVid && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3" onClick={() => setPlayVid(null)}>
          <div className="flex max-h-[92vh] w-full max-w-md flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <video src={proxyInline(playVid.url)} controls autoPlay playsInline className="max-h-[78vh] w-full rounded-xl bg-black" />
            <div className="flex gap-2">
              <button onClick={() => proxyDownload(playVid.url, playVid.download)} className="ui-accent-solid flex-1 rounded-lg py-2 text-sm font-semibold">⬇ Tải video</button>
              {playVid.share && <a href={playVid.share} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">↗ Mở gốc</a>}
              <button onClick={() => setPlayVid(null)} className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup ẢNH + VIDEO GỐC 1688 ── */}
      {detailOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3" onClick={() => { setDetailOpen(false); setDetail(null) }}>
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-base" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center gap-2 border-b border-app-border bg-app-card px-4 py-2.5">
              <span className="text-sm font-bold text-app-text">Ảnh + Video gốc nhà bán (1688)</span>
              {detail?.shop ? <span className="text-[11px] text-app-muted">· 🏪 {detail.shop}</span> : null}
              <button onClick={() => { setDetailOpen(false); setDetail(null) }} className="ml-auto rounded-full p-1 text-app-muted hover:bg-app-card-elevated"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {detailBusy && <div className="py-10 text-center text-sm text-app-muted">🤖 Đang lấy ảnh/video gốc…</div>}
              {detail && (
                <>
                  {detail.videos?.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-1 text-[11px] font-bold text-app-muted">🎬 Video gốc ({detail.videos.length})</div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
                        {detail.videos.map((v, i) => (
                          <div key={i} className="flex flex-col gap-1 rounded-lg border border-app-border bg-app-card p-2">
                            <button onClick={() => setPlayVid({ url: v, download: `${safe(name)}-1688-${i + 1}.mp4`, share: '' })} className="relative flex aspect-video items-center justify-center rounded bg-black"><Play className="h-8 w-8 text-white/90" /></button>
                            <button onClick={() => proxyDownload(v, `${safe(name)}-1688-${i + 1}.mp4`)} className="ui-accent-solid rounded py-1 text-[10px] font-semibold">⬇ Tải video</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {detail.images?.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-bold text-app-muted">🖼 Ảnh gốc ({detail.images.length})</div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                        {detail.images.map((im, i) => (
                          <div key={i} className="relative overflow-hidden rounded-lg border border-app-border bg-app-card">
                            <img src={`https://images.weserv.nl/?url=${encodeURIComponent(im.replace(/^https?:\/\//, ''))}&w=300`} alt="" className="aspect-square w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                            <button onClick={() => proxyDownload(im, `${safe(name)}-1688-${i + 1}.jpg`)} className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">⬇</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!detail.videos?.length && !detail.images?.length && <p className="text-xs text-app-muted">Không lấy được media của SP này (thử SP khác).</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
