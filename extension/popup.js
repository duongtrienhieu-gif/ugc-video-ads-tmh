const $ = (id) => document.getElementById(id)
const app = $('app')
let pollTimer = null

async function getState() {
  const o = await chrome.storage.local.get(['kaloSession', 'enabled', 'status', 'totalIngested', 'crawlStatus'])
  return {
    session: o.kaloSession || null,
    enabled: o.enabled !== false,
    status: o.status || {},
    total: o.totalIngested || 0,
    crawl: o.crawlStatus || null,
  }
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) }
function fmtTime(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('vi-VN') } catch (e) { return iso } }

function renderCrawl(c) {
  if (!c) return ''
  const pct = c.maxPages ? Math.min(100, Math.round(((c.page || 0) / c.maxPages) * 100)) : (c.done ? 100 : 0)
  const headLine = c.error ? `<div class="err">⚠ ${esc(c.text)}</div>` :
    c.done ? `<div class="progDone">${esc(c.text)}</div>` :
    `<div><b>${esc(c.text)}</b></div>`
  return `
    ${headLine}
    <div class="bar"><div style="width:${pct}%"></div></div>
    <div class="progRow">
      <span>${pct}%${c.market ? ' · ' + esc(c.market) : ''}</span>
      <span>📦 ${c.captured || 0} sản phẩm đã đẩy</span>
    </div>
  `
}

async function render() {
  const st = await getState()
  if (!st.session) {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    app.innerHTML = `
      <label>Email UGC Lab</label>
      <input id="email" type="email" placeholder="email@..." autocomplete="username" />
      <label>Mật khẩu</label>
      <input id="pw" type="password" placeholder="••••••" autocomplete="current-password" />
      <button id="login" class="primary">Đăng nhập</button>
      <div id="msg" class="status err" style="display:none"></div>
    `
    $('login').onclick = doLogin
    $('pw').onkeydown = (e) => { if (e.key === 'Enter') doLogin() }
    return
  }

  const s = st.status
  const crawling = st.crawl && !st.crawl.done
  app.innerHTML = `
    <div class="row">
      <span class="muted">Đã đăng nhập</span>
      <span class="pill">${esc(st.session.email || 'UGC Lab')}</span>
    </div>
    <div class="row" style="margin-top:8px">
      <span class="switch"><input type="checkbox" id="enabled" ${st.enabled ? 'checked' : ''}/> Bật đồng bộ</span>
    </div>

    <button id="crawl" class="primary" style="margin-top:10px" ${crawling ? 'disabled' : ''}>
      ${crawling ? '⏳ Đang thu thập...' : '🔄 Tự động thu thập'}
    </button>
    <div id="crawlBox" class="status" style="${st.crawl ? '' : 'display:none'}">${renderCrawl(st.crawl)}</div>

    <div class="status">
      <div>Lần cuối đẩy: <b>${fmtTime(s.lastSync)}</b></div>
      <div>Thị trường: <b>${esc(s.lastMarket || '—')}</b> · +<b>${s.lastCount || 0}</b>${s.lastEntity ? ' ' + esc(s.lastEntity) : ''}</div>
      <div>Tổng đã đẩy: <b>${st.total}</b></div>
      ${s.error ? `<div class="err">⚠ ${esc(s.error)}</div>` : `<div class="ok">✓ Sẵn sàng</div>`}
    </div>
    <button id="logout" class="ghost">Đăng xuất</button>
  `
  $('enabled').onchange = (e) => chrome.storage.local.set({ enabled: e.target.checked })
  $('logout').onclick = async () => { await chrome.storage.local.remove('kaloSession'); render() }
  $('crawl').onclick = startCrawl
  if (crawling && !pollTimer) startPoll()
}

function startPoll(startedAt) {
  if (pollTimer) clearInterval(pollTimer)
  const start = startedAt || Date.now()
  pollTimer = setInterval(async () => {
    const { crawlStatus } = await chrome.storage.local.get('crawlStatus')
    const box = $('crawlBox'); const btn = $('crawl')
    if (box && crawlStatus) { box.style.display = ''; box.innerHTML = renderCrawl(crawlStatus) }
    // Phát hiện script trên Kalodata không phản hồi: sau 5s mà page vẫn = 0 → cảnh báo F5.
    if (!crawlStatus || (!crawlStatus.done && (crawlStatus.page || 0) === 0 && Date.now() - start > 12000)) {
      const stale = '⚠ Trang Kalodata không phản hồi.\nMở DevTools (F12) tab Kalodata → Console, xem có lỗi đỏ không, chụp cho mình.'
      await chrome.storage.local.set({ crawlStatus: { text: stale, done: true, error: true, at: Date.now() } })
      clearInterval(pollTimer); pollTimer = null
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Tự động thu thập' }
      setTimeout(render, 200)
      return
    }
    if (crawlStatus && crawlStatus.done) {
      clearInterval(pollTimer); pollTimer = null
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Tự động thu thập' }
      setTimeout(render, 200)
    }
  }, 600)
}

function sendMessageWithTimeout(tabId, msg, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    try {
      chrome.tabs.sendMessage(tabId, msg, (resp) => {
        clearTimeout(t)
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        resolve(resp)
      })
    } catch (e) { clearTimeout(t); reject(e) }
  })
}

async function startCrawl() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  const box = $('crawlBox'); const btn = $('crawl')
  if (!tab || !/kalodata\.com/.test(tab.url || '')) {
    if (box) { box.style.display = ''; box.innerHTML = '<div class="err">⚠ Mở tab Kalodata (mục Sản phẩm) rồi bấm lại.</div>' }
    return
  }
  // PING trước: xác định content script (bridge.js) đã load chưa.
  try {
    await sendMessageWithTimeout(tab.id, { type: 'kalo-ping' }, 2000)
  } catch (e) {
    const msg = '⚠ Script trong trang Kalodata chưa hoạt động.\n\nLàm theo thứ tự:\n1) chrome://extensions → bấm ⟳ trên card extension\n2) Sang tab Kalodata → F5\n3) Đợi trang load xong → bấm lại nút này'
    await chrome.storage.local.set({ crawlStatus: { text: msg, done: true, error: true, at: Date.now() } })
    render()
    return
  }
  const startedAt = Date.now()
  await chrome.storage.local.set({ crawlStatus: { text: 'Đang gửi lệnh tới Kalodata...', done: false, at: startedAt, page: 0, maxPages: 25, captured: 0 } })
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang thu thập...' }
  try {
    await sendMessageWithTimeout(tab.id, { type: 'kalo-crawl-start', maxPages: 25, delayMs: 1500 }, 3000)
  } catch (e) {
    const msg = '⚠ Không gửi được lệnh tới Kalodata.\nF5 lại tab Kalodata rồi thử lại.'
    await chrome.storage.local.set({ crawlStatus: { text: msg, done: true, error: true, at: Date.now() } })
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Tự động thu thập' }
    render()
    return
  }
  startPoll(startedAt)
}

async function doLogin() {
  const email = $('email').value.trim()
  const password = $('pw').value
  const msg = $('msg')
  if (!email || !password) { msg.style.display = 'block'; msg.textContent = 'Nhập email + mật khẩu'; return }
  $('login').textContent = 'Đang đăng nhập...'
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPA_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const j = await r.json()
    if (!r.ok) { throw new Error(j.error_description || j.msg || j.error || 'Đăng nhập thất bại') }
    const now = Math.floor(Date.now() / 1000)
    await chrome.storage.local.set({
      kaloSession: {
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        user_id: j.user && j.user.id,
        email: j.user && j.user.email,
        expires_at: j.expires_at || (now + (j.expires_in || 3600)),
      },
      enabled: true,
    })
    render()
  } catch (e) {
    msg.style.display = 'block'; msg.textContent = '⚠ ' + (e.message || 'Lỗi')
    $('login').textContent = 'Đăng nhập'
  }
}

render()
