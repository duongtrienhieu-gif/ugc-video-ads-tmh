const $ = (id) => document.getElementById(id)
const app = $('app')

async function getState() {
  const o = await chrome.storage.local.get(['kaloSession', 'enabled', 'status', 'totalIngested'])
  return {
    session: o.kaloSession || null,
    enabled: o.enabled !== false,
    status: o.status || {},
    total: o.totalIngested || 0,
  }
}

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) }
function fmtTime(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('vi-VN') } catch (e) { return iso } }

async function render() {
  const st = await getState()
  if (!st.session) {
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
  app.innerHTML = `
    <div class="row">
      <span class="muted">Đã đăng nhập</span>
      <span class="pill">${esc(st.session.email || 'UGC Lab')}</span>
    </div>
    <div class="row" style="margin-top:10px">
      <span class="switch"><input type="checkbox" id="enabled" ${st.enabled ? 'checked' : ''}/> Bật đồng bộ</span>
    </div>
    <div class="status">
      <div>Lần cuối: <b>${fmtTime(s.lastSync)}</b></div>
      <div>Thị trường: <b>${esc(s.lastMarket || '—')}</b> · +<b>${s.lastCount || 0}</b> sản phẩm</div>
      <div>Tổng đã đẩy: <b>${st.total}</b></div>
      ${s.error ? `<div class="err">⚠ ${esc(s.error)}</div>` : `<div class="ok">✓ Sẵn sàng — vào Kalodata browse là tự đẩy</div>`}
    </div>
    <button id="logout" class="ghost">Đăng xuất</button>
  `
  $('enabled').onchange = (e) => chrome.storage.local.set({ enabled: e.target.checked })
  $('logout').onclick = async () => { await chrome.storage.local.remove('kaloSession'); render() }
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
