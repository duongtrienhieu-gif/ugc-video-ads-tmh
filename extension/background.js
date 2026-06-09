// Service worker — nhận data Kalodata đã bắt, route theo entity, upsert lên Supabase.
importScripts('./config.js')

// ── helpers map kiểu ──
function n(v) {
  if (v == null) return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  let str = v.trim()
  str = str.replace(/^(RM|MYR|VND|IDR|THB|USD|\$)\s*/i, '')
  const dashIdx = str.indexOf('-')
  if (dashIdx > 0) str = str.slice(0, dashIdx).trim()
  str = str.replace(/\s+/g, '')
  let mult = 1
  const lower = str.toLowerCase()
  if (lower.endsWith('tr')) { mult = 1_000_000; str = str.slice(0, -2) }
  else if (lower.endsWith('k')) { mult = 1_000; str = str.slice(0, -1) }
  else if (str.endsWith('M')) { mult = 1_000_000; str = str.slice(0, -1) }
  else if (lower.endsWith('b')) { mult = 1_000_000_000; str = str.slice(0, -1) }
  if (str.endsWith('%')) str = str.slice(0, -1)
  const hasComma = str.indexOf(',') >= 0
  const hasDot = str.indexOf('.') >= 0
  if (hasComma && hasDot) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) str = str.replace(/\./g, '').replace(',', '.')
    else str = str.replace(/,/g, '')
  } else if (hasComma) str = str.replace(',', '.')
  const num = Number(str)
  return isFinite(num) ? num * mult : null
}
function s(v) { return v == null ? null : String(v) }
function b(v) { return v == null ? null : !!v }
function dateOnly(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return null
}
function findImage(item) {
  const direct = ['cover','image','image_url','main_image','product_image',
    'product_image_url','img','img_url','pic','pic_url','thumbnail',
    'cover_url','product_pic','product_cover','avatar','avatar_url','head','headPic']
  for (const k of direct) if (item[k]) return String(item[k])
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

// ── mappers per entity ──
function mapProduct(item, country, userId, nowIso) {
  return {
    product_id: String(item.id), market: country,
    product_title: item.product_title ?? null, image_url: findImage(item),
    revenue: n(item.revenue), revenue_grouping_rate: n(item.revenue_grouping_rate),
    sale: n(item.sale), unit_price: n(item.unit_price),
    min_real_price: n(item.min_real_price), max_real_price: n(item.max_real_price),
    commission_rate: n(item.commission_rate), product_rating: n(item.product_rating),
    creator_num: n(item.creator_num), creator_conversion_ratio: n(item.creator_conversion_ratio),
    video_revenue: n(item.video_revenue), live_revenue: n(item.live_revenue),
    showcase_revenue: n(item.showcase_revenue),
    gmv_a: n(item.gmv_A), gmv_b: n(item.gmv_B),
    pri_cate_id: s(item.pri_cate_id), sec_cate_id: s(item.sec_cate_id), ter_cate_id: s(item.ter_cate_id),
    delivery_type: s(item.delivery_type),
    is_overseas: b(item.is_overseas), is_full_service: b(item.is_full_service), is_tokopedia: b(item.is_tokopedia),
    launch_date: dateOnly(item.launch_date), revenue_trend: item.revenue_trend ?? null,
    raw: item, ingested_by: userId, captured_at: nowIso,
  }
}
function mapCreator(item, country, userId, nowIso) {
  return {
    creator_id: String(item.id), market: country,
    handle: s(item.handle), nickname: s(item.nickname), signature: s(item.signature),
    main_category: s(item.main_category),
    followers: n(item.followers), new_followers: n(item.new_followers),
    video_engagement_rate: n(item.video_engagement_rate),
    revenue: n(item.revenue), sale: n(item.sale), unit_price: n(item.unit_price),
    views: n(item.views), revenue_grouping_rate: n(item.revenue_grouping_rate),
    creator_debut: dateOnly(item.creatorDebut || item.creator_debut),
    contact: item.contact ?? null, raw: item,
    ingested_by: userId, captured_at: nowIso,
  }
}
function mapVideo(item, country, userId, nowIso) {
  return {
    video_id: String(item.id), market: country,
    description: s(item.description), handle: s(item.handle),
    duration: n(item.duration), publish_date: dateOnly(item.publish_date),
    views: n(item.views), gpm: n(item.gpm),
    revenue: n(item.revenue), sale: n(item.sale),
    ad: b(item.ad), ad_cpa: n(item.ad_cpa),
    ad2_roas: n(item.ad2Roas), ad2_cost: n(item.ad2Cost),
    ad_view_ratio: n(item.ad_view_ratio), ad_revenue_ratio: n(item.ad_revenue_ratio),
    revenue_grouping_rate: n(item.revenue_grouping_rate),
    product_id: s(item.product_id || item.productId || (item.product && item.product.id)),
    raw: item, ingested_by: userId, captured_at: nowIso,
  }
}
function mapShop(item, country, userId, nowIso) {
  return {
    shop_id: String(item.id), market: country,
    name: s(item.name), region: s(item.region),
    seller_type: s(item.seller_type), main_category: s(item.main_category),
    revenue: n(item.revenue), sale: n(item.sale), unit_price: n(item.unit_price),
    revenue_grouping_rate: n(item.revenue_grouping_rate),
    self_promotion_revenue: n(item.self_promotion_revenue),
    affiliate_revenue: n(item.affiliate_revenue),
    video_revenue: n(item.video_revenue), live_revenue: n(item.live_revenue),
    showcase_revenue: n(item.showcase_revenue), shopping_mall_revenue: n(item.shopping_mall_revenue),
    is_full_service: b(item.is_full_service), is_overseas: b(item.is_overseas), is_tokopedia: b(item.is_tokopedia),
    product_ids: item.product_ids ?? null, raw: item,
    ingested_by: userId, captured_at: nowIso,
  }
}

// Route theo URL: target → {table, mapper, entity_type, conflict_keys}
const ROUTES = [
  { match: '/product/queryList', table: 'research_products',  conflict: 'product_id,market',  mapper: mapProduct, entity: 'product' },
  { match: '/creator/queryList', table: 'research_creators',  conflict: 'creator_id,market',  mapper: mapCreator, entity: 'creator' },
  { match: '/video/queryList',   table: 'research_videos',    conflict: 'video_id,market',    mapper: mapVideo,   entity: 'video' },
  { match: '/shop/queryList',    table: 'research_shops',     conflict: 'shop_id,market',     mapper: mapShop,    entity: 'shop' },
]
function pickRoute(target) {
  if (!target) return null
  for (const r of ROUTES) if (target.indexOf(r.match) > -1) return r
  return null
}

// ── session ──
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
      access_token: j.access_token, refresh_token: j.refresh_token,
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

async function handleCapture(msg) {
  const { enabled } = await chrome.storage.local.get('enabled')
  if (enabled === false) return
  const route = pickRoute(msg.target)
  if (!route) return

  let req = {}, resp = {}
  try { req = JSON.parse(msg.reqBody || '{}') } catch (e) { /* */ }
  try { resp = JSON.parse(msg.respText || '{}') } catch (e) { return }

  const country = req.country || 'MY'
  const list = Array.isArray(resp.data) ? resp.data
    : (resp.data && Array.isArray(resp.data.list) ? resp.data.list : [])
  if (!list.length) return

  const session = await getValidSession()
  if (!session) { await patchStatus({ error: 'Chưa đăng nhập UGC Lab trong extension' }); return }

  const nowIso = new Date().toISOString()
  const rows = list.filter((it) => it && it.id != null)
    .map((it) => route.mapper(it, country, session.user_id, nowIso))
  if (!rows.length) return

  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${route.table}?on_conflict=${route.conflict}`, {
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
      await patchStatus({ error: `Lỗi đẩy ${route.entity} ${r.status}: ${t.slice(0, 140)}` })
      return
    }
  } catch (e) {
    await patchStatus({ error: 'Lỗi mạng khi đẩy: ' + (e && e.message) })
    return
  }

  fetch(`${SUPA_URL}/rest/v1/research_ingest_log`, {
    method: 'POST',
    headers: {
      apikey: SUPA_ANON,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([{
      ingested_by: session.user_id, market: country,
      entity_type: route.entity, row_count: rows.length, source_url: msg.target,
    }]),
  }).catch(() => {})

  const counterKey = `total_${route.entity}`
  const cur = await chrome.storage.local.get(['totalIngested', counterKey])
  const total = (cur.totalIngested || 0) + rows.length
  const totalEntity = (cur[counterKey] || 0) + rows.length
  await chrome.storage.local.set({ totalIngested: total, [counterKey]: totalEntity })
  await patchStatus({ lastSync: nowIso, lastMarket: country, lastCount: rows.length, lastEntity: route.entity, error: null })
}

// ── Full Crawl: tự mở 4 tab Kalodata ngầm, đợi mỗi cái crawl xong, đóng, sang cái tiếp ──
const FULL_CRAWL_ENTITIES = [
  { path: '/product', label: 'sản phẩm' },
  { path: '/creator', label: 'creator' },
  { path: '/video',   label: 'video' },
  { path: '/shop',    label: 'shop' },
]
const doneWaiters = new Map() // tabId → resolve()
let fullCrawlRunning = false

function waitForDoneFromTab(tabId, timeoutMs) {
  return new Promise((resolve) => {
    doneWaiters.set(tabId, resolve)
    setTimeout(() => {
      if (doneWaiters.has(tabId)) { doneWaiters.delete(tabId); resolve('timeout') }
    }, timeoutMs)
  })
}

async function startFullCrawl(reason) {
  if (fullCrawlRunning) return { skipped: true }
  fullCrawlRunning = true
  try {
    const startAt = Date.now()
    for (let i = 0; i < FULL_CRAWL_ENTITIES.length; i++) {
      const ent = FULL_CRAWL_ENTITIES[i]
      await chrome.storage.local.set({ fullCrawl: {
        running: true, idx: i, total: FULL_CRAWL_ENTITIES.length,
        label: ent.label, startAt, reason: reason || 'manual', at: Date.now(),
      } })
      const tab = await chrome.tabs.create({
        url: `https://www.kalodata.com${ent.path}?ugcAutoCrawl=1`,
        active: false,
      })
      await waitForDoneFromTab(tab.id, 4 * 60 * 1000) // 4 phút/entity tối đa
      try { await chrome.tabs.remove(tab.id) } catch (e) { /* */ }
    }
    await chrome.storage.local.set({ fullCrawl: {
      running: false, idx: FULL_CRAWL_ENTITIES.length, total: FULL_CRAWL_ENTITIES.length,
      done: true, at: Date.now(), reason: reason || 'manual', durationMs: Date.now() - startAt,
    } })
  } catch (e) {
    await chrome.storage.local.set({ fullCrawl: { running: false, error: String(e && e.message), at: Date.now() } })
  } finally {
    fullCrawlRunning = false
  }
  return { ok: true }
}

// ── Hẹn giờ tự kéo (chrome.alarms) ──
const ALARM_NAME = 'ugc-lab-daily-crawl'

async function applySchedule() {
  const { schedule } = await chrome.storage.local.get('schedule')
  try { await chrome.alarms.clear(ALARM_NAME) } catch (e) { /* */ }
  if (!schedule || !schedule.enabled) return
  const [hh, mm] = String(schedule.time || '07:00').split(':').map(Number)
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 7, mm || 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  chrome.alarms.create(ALARM_NAME, { when: next.getTime(), periodInMinutes: 24 * 60 })
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    startFullCrawl('schedule').catch((e) => console.error('[kalo-sync] schedule', e))
  }
})

// Setup khi extension khởi động lại (browser restart, extension update).
chrome.runtime.onStartup.addListener(() => { applySchedule() })
chrome.runtime.onInstalled.addListener(() => { applySchedule() })

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'kalo-capture') {
    handleCapture(msg).catch((e) => console.error('[kalo-sync]', e))
  } else if (msg && msg.type === 'kalo-crawl-status') {
    chrome.storage.local.set({ crawlStatus: {
      text: msg.text, done: !!msg.done, error: !!msg.error,
      page: msg.page || 0, maxPages: msg.maxPages || 0,
      market: msg.market || '', captured: msg.captured || 0, at: Date.now(),
    } })
    // Full Crawl: resolve khi tab này báo done
    if (msg.done && sender && sender.tab) {
      const w = doneWaiters.get(sender.tab.id)
      if (w) { doneWaiters.delete(sender.tab.id); w('done') }
    }
  } else if (msg && msg.type === 'kalo-full-crawl-start') {
    startFullCrawl('manual').then((r) => sendResponse(r)).catch((e) => sendResponse({ error: String(e) }))
    return true // async
  } else if (msg && msg.type === 'kalo-apply-schedule') {
    applySchedule().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ error: String(e) }))
    return true
  }
})
