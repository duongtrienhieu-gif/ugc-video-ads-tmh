// Service worker — nhận data Kalodata đã bắt, map sang research_products, upsert lên Supabase.
importScripts('./config.js')

// ── helpers map kiểu dữ liệu ──
// Kalodata trả số dạng STRING đã format ("RM37.5k", "11.6k", "1.36tr", "2,278")
// → tự parse về number raw. Cũng nhận number thuần.
function n(v) {
  if (v == null) return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  let str = v.trim().replace(/^RM\s*/i, '').replace(/,/g, '').replace(/\s+/g, '')
  if (!str) return null
  let mult = 1
  if (/tr$/i.test(str)) { mult = 1_000_000; str = str.slice(0, -2) }
  else if (/k$/i.test(str)) { mult = 1_000; str = str.slice(0, -1) }
  else if (/M$/.test(str)) { mult = 1_000_000; str = str.slice(0, -1) }
  else if (/B$/i.test(str)) { mult = 1_000_000_000; str = str.slice(0, -1) }
  if (/%$/.test(str)) str = str.slice(0, -1)
  const num = Number(str)
  return isFinite(num) ? num * mult : null
}
function s(v) { return v == null ? null : String(v) }
function b(v) { return v == null ? null : !!v }
function dateOnly(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return null
}
// Tìm ảnh sản phẩm: nhiều ứng viên + đào sâu raw nếu cần.
function findImage(item) {
  const direct = ['cover','image','image_url','main_image','product_image',
    'product_image_url','img','img_url','pic','pic_url','thumbnail',
    'cover_url','product_pic','product_cover']
  for (const k of direct) if (item[k]) return String(item[k])
  // Đào sâu: bất kỳ URL trông như CDN ảnh sản phẩm.
  const seen = new Set()
  function dig(o, depth) {
    if (!o || depth > 3 || seen.has(o)) return null
    if (typeof o === 'string') {
      if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(o) &&
          /(kalocdn|tiktokcdn|alisg|tos-|byteimg)/i.test(o)) return o
      return null
    }
    if (typeof o !== 'object') return null
    seen.add(o)
    if (Array.isArray(o)) {
      for (const v of o) { const r = dig(v, depth + 1); if (r) return r }
    } else {
      for (const v of Object.values(o)) { const r = dig(v, depth + 1); if (r) return r }
    }
    return null
  }
  return dig(item, 0)
}

function mapRow(item, country, userId, nowIso) {
  return {
    product_id: String(item.id),
    market: country,
    product_title: item.product_title ?? null,
    image_url: findImage(item),
    revenue: n(item.revenue),
    revenue_grouping_rate: n(item.revenue_grouping_rate),
    sale: n(item.sale),
    unit_price: n(item.unit_price),
    min_real_price: n(item.min_real_price),
    max_real_price: n(item.max_real_price),
    commission_rate: n(item.commission_rate),
    product_rating: n(item.product_rating),
    creator_num: n(item.creator_num),
    creator_conversion_ratio: n(item.creator_conversion_ratio),
    video_revenue: n(item.video_revenue),
    live_revenue: n(item.live_revenue),
    showcase_revenue: n(item.showcase_revenue),
    gmv_a: n(item.gmv_A),
    gmv_b: n(item.gmv_B),
    pri_cate_id: s(item.pri_cate_id),
    sec_cate_id: s(item.sec_cate_id),
    ter_cate_id: s(item.ter_cate_id),
    delivery_type: s(item.delivery_type),
    is_overseas: b(item.is_overseas),
    is_full_service: b(item.is_full_service),
    is_tokopedia: b(item.is_tokopedia),
    launch_date: dateOnly(item.launch_date),
    revenue_trend: item.revenue_trend ?? null,
    raw: item,
    ingested_by: userId,
    captured_at: nowIso,
  }
}

// ── session (đăng nhập UGC Lab) — tự refresh khi token hết hạn ──
async function getValidSession() {
  const { kaloSession } = await chrome.storage.local.get('kaloSession')
  if (!kaloSession || !kaloSession.refresh_token) return null
  const now = Math.floor(Date.now() / 1000)
  if (kaloSession.expires_at && kaloSession.expires_at - 60 > now) return kaloSession
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPA_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: kaloSession.refresh_token }),
    })
    if (!r.ok) return null
    const j = await r.json()
    const sess = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      user_id: (j.user && j.user.id) || kaloSession.user_id,
      email: (j.user && j.user.email) || kaloSession.email,
      expires_at: j.expires_at || (now + (j.expires_in || 3600)),
    }
    await chrome.storage.local.set({ kaloSession: sess })
    return sess
  } catch (e) { return null }
}

async function patchStatus(patch) {
  const cur = (await chrome.storage.local.get('status')).status || {}
  await chrome.storage.local.set({ status: { ...cur, ...patch } })
}

// ── xử lý mỗi lần bắt được /product/queryList ──
async function handleCapture(msg) {
  const { enabled } = await chrome.storage.local.get('enabled')
  if (enabled === false) return

  let req = {}, resp = {}
  try { req = JSON.parse(msg.reqBody || '{}') } catch (e) { /* */ }
  try { resp = JSON.parse(msg.respText || '{}') } catch (e) { return }

  const country = req.country || 'MY'
  const list = Array.isArray(resp.data)
    ? resp.data
    : (resp.data && Array.isArray(resp.data.list) ? resp.data.list : [])
  if (!list.length) return

  const session = await getValidSession()
  if (!session) { await patchStatus({ error: 'Chưa đăng nhập UGC Lab trong extension' }); return }

  const nowIso = new Date().toISOString()
  const rows = list.filter((it) => it && it.id != null).map((it) => mapRow(it, country, session.user_id, nowIso))
  if (!rows.length) return

  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/research_products?on_conflict=product_id,market`, {
      method: 'POST',
      headers: {
        apikey: SUPA_ANON,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    })
    if (!r.ok) {
      const t = await r.text()
      await patchStatus({ error: `Lỗi đẩy ${r.status}: ${t.slice(0, 140)}` })
      return
    }
  } catch (e) {
    await patchStatus({ error: 'Lỗi mạng khi đẩy: ' + (e && e.message) })
    return
  }

  // ghi log (best-effort)
  fetch(`${SUPA_URL}/rest/v1/research_ingest_log`, {
    method: 'POST',
    headers: {
      apikey: SUPA_ANON,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{ ingested_by: session.user_id, market: country, entity_type: 'product', row_count: rows.length, source_url: msg.target }]),
  }).catch(() => {})

  const total = ((await chrome.storage.local.get('totalIngested')).totalIngested || 0) + rows.length
  await chrome.storage.local.set({ totalIngested: total })
  await patchStatus({ lastSync: nowIso, lastMarket: country, lastCount: rows.length, error: null })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'kalo-capture') {
    handleCapture(msg).catch((e) => console.error('[kalo-sync]', e))
  } else if (msg && msg.type === 'kalo-crawl-status') {
    chrome.storage.local.set({ crawlStatus: {
      text: msg.text, done: !!msg.done, error: !!msg.error,
      page: msg.page || 0, maxPages: msg.maxPages || 0,
      market: msg.market || '', captured: msg.captured || 0, at: Date.now(),
    } })
  }
})
