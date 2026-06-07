// Chạy trong MAIN world (cùng ngữ cảnh trang Kalodata) — monkey-patch fetch + XHR
// để bắt response /product/queryList. Đồng thời hỗ trợ "tự động thu thập" (replay
// query nhiều trang bằng fetch gốc + cookie của trang).
(function () {
  const TARGETS = ['/product/queryList']
  let lastReq = null // { url, body } — query mẫu gần nhất để auto-crawl dựa vào

  function isTarget(url) {
    return typeof url === 'string' && TARGETS.some((t) => url.indexOf(t) > -1)
  }
  function emit(target, reqBody, respText) {
    try { window.postMessage({ __kaloSync: true, target, reqBody, respText }, '*') } catch (e) { /* */ }
  }

  const origFetch = window.fetch
  window.fetch = function (input, init) {
    const url = input && input.url ? input.url : input
    const hit = isTarget(url)
    const reqBody = hit && init && init.body ? String(init.body) : null
    if (hit && reqBody) lastReq = { url: String(url), body: reqBody }
    const p = origFetch.apply(this, arguments)
    if (hit) {
      p.then((res) => { try { res.clone().text().then((t) => emit(String(url), reqBody, t)) } catch (e) { /* */ } }).catch(() => {})
    }
    return p
  }

  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__kaloUrl = url
    return origOpen.apply(this, arguments)
  }
  XMLHttpRequest.prototype.send = function (body) {
    const self = this
    if (isTarget(self.__kaloUrl)) {
      if (body) lastReq = { url: String(self.__kaloUrl), body: String(body) }
      self.addEventListener('load', function () {
        try { emit(String(self.__kaloUrl), body ? String(body) : null, self.responseText) } catch (e) { /* */ }
      })
    }
    return origSend.apply(this, arguments)
  }

  // ── Auto-crawl: replay query mẫu với pageNo tăng dần ──
  function crawlStatus(text, done) {
    try { window.postMessage({ __kaloCrawlStatus: true, text, done: !!done }, '*') } catch (e) { /* */ }
  }
  async function runCrawl(maxPages, delayMs) {
    if (!lastReq || !lastReq.body) {
      crawlStatus('Mở mục "Sản phẩm" trên Kalodata 1 lần (cuộn/đổi filter) rồi bấm lại.', true)
      return
    }
    let base
    try { base = JSON.parse(lastReq.body) } catch (e) { crawlStatus('Không đọc được query mẫu.', true); return }
    const url = lastReq.url
    const market = base.country || ''
    for (let page = 1; page <= maxPages; page++) {
      const body = Object.assign({}, base, { pageNo: page })
      let stop = false
      try {
        const res = await origFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        })
        const t = await res.text()
        emit(url, JSON.stringify(body), t) // đẩy thủ công (gọi origFetch nên patch không tự bắt)
        try {
          const j = JSON.parse(t)
          const list = Array.isArray(j.data) ? j.data : (j.data && j.data.list) || []
          if (!list.length) stop = true
        } catch (e) { /* */ }
      } catch (e) {
        crawlStatus('Lỗi kéo trang ' + page + ': ' + (e && e.message), true)
        return
      }
      crawlStatus('Đã kéo trang ' + page + '/' + maxPages + (market ? ' · ' + market : ''))
      if (stop) { crawlStatus('Hết sản phẩm (trang ' + page + '). Xong ✓', true); return }
      await new Promise((r) => setTimeout(r, delayMs))
    }
    crawlStatus('Xong ✓ — đã kéo ' + maxPages + ' trang' + (market ? ' · ' + market : ''), true)
  }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return
    const d = ev.data
    if (d && d.__kaloCrawl === 'start') runCrawl(d.maxPages || 25, d.delayMs || 1800)
  })
})();
