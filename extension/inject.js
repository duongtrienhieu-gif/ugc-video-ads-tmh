// Chạy trong MAIN world (cùng ngữ cảnh trang Kalodata) — monkey-patch fetch + XHR
// để bắt response /product/queryList. Đồng thời hỗ trợ "tự động thu thập" (replay
// query nhiều trang bằng fetch gốc + cookie của trang).
(function () {
  const TARGETS = ['/product/queryList']
  let lastReq = null // { url, body } — query mẫu gần nhất để auto-crawl dựa vào
  console.log('[UGC-Lab Sync] inject.js loaded (MAIN world)')

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
  function crawlStatus(payload) {
    try { window.postMessage(Object.assign({ __kaloCrawlStatus: true }, payload), '*') } catch (e) { /* */ }
  }
  function buildDefaultBody() {
    // Fallback khi chưa bắt được query mẫu (Kalodata dùng cache, chưa gọi /product/queryList).
    // Body khớp recon: country/startDate/endDate/cateIds/showCateIds/pageNo/pageSize/sort.
    const today = new Date(); const end = today.toISOString().slice(0, 10)
    const start = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10)
    return { country: 'MY', startDate: start, endDate: end, cateIds: [], showCateIds: [], pageNo: 1, pageSize: 10, sort: 'revenue,desc' }
  }
  async function runCrawl(maxPages, delayMs) {
    console.log('[UGC-Lab Sync] runCrawl start, lastReq:', lastReq)
    let base, url
    if (lastReq && lastReq.body) {
      try { base = JSON.parse(lastReq.body); url = lastReq.url } catch (e) {
        crawlStatus({ done: true, error: true, text: 'Không đọc được query mẫu.' }); return
      }
    } else {
      // Fallback: gửi 1 query default cho MY để khởi động (Kalodata dùng cache → chưa có query mẫu).
      url = 'https://www.kalodata.com/product/queryList'
      base = buildDefaultBody()
      console.log('[UGC-Lab Sync] dùng query mặc định:', base)
    }
    const market = base.country || ''
    let captured = 0
    crawlStatus({ done: false, page: 0, maxPages, market, captured, text: 'Bắt đầu kéo' + (market ? ' ' + market : '') + '...' })
    for (let page = 1; page <= maxPages; page++) {
      const body = Object.assign({}, base, { pageNo: page })
      let pageCount = 0, stop = false
      try {
        const res = await origFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        })
        const t = await res.text()
        emit(url, JSON.stringify(body), t)
        try {
          const j = JSON.parse(t)
          const list = Array.isArray(j.data) ? j.data : (j.data && j.data.list) || []
          pageCount = list.length
          if (!pageCount) stop = true
        } catch (e) { /* */ }
        captured += pageCount
      } catch (e) {
        crawlStatus({ done: true, error: true, text: 'Lỗi kéo trang ' + page + ': ' + (e && e.message) })
        return
      }
      crawlStatus({
        done: false, page, maxPages, market, captured,
        text: 'Trang ' + page + '/' + maxPages + ' · +' + pageCount + ' sản phẩm',
      })
      if (stop) {
        crawlStatus({ done: true, page, maxPages, market, captured, text: 'Đã kéo hết (' + captured + ' sản phẩm) ✓' })
        return
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
    crawlStatus({ done: true, page: maxPages, maxPages, market, captured, text: 'Xong ✓ — tổng ' + captured + ' sản phẩm' + (market ? ' · ' + market : '') })
  }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return
    const d = ev.data
    if (d && d.__kaloCrawl === 'start') {
      console.log('[UGC-Lab Sync] nhận lệnh crawl')
      runCrawl(d.maxPages || 25, d.delayMs || 1500)
    }
  })
})();
