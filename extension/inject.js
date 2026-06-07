// MAIN world — monkey-patch fetch + XHR để bắt response của 4 queryList endpoint
// của Kalodata, đồng thời hỗ trợ auto-crawl replay nhiều trang.
(function () {
  const TARGETS = [
    '/product/queryList',
    '/creator/queryList',
    '/video/queryList',
    '/shop/queryList',
  ]
  // lastReq lưu PER endpoint — anh đứng ở /creator thì auto-crawl creator, /shop thì shop...
  const lastReq = {} // { '/product/queryList': {url,body}, ... }
  console.log('[UGC-Lab Sync] inject.js loaded (MAIN world)')

  function matchTarget(url) {
    if (typeof url !== 'string') return null
    for (const t of TARGETS) if (url.indexOf(t) > -1) return t
    return null
  }
  function emit(target, reqBody, respText) {
    try { window.postMessage({ __kaloSync: true, target, reqBody, respText }, '*') } catch (e) { /* */ }
  }

  const origFetch = window.fetch
  window.fetch = function (input, init) {
    const url = input && input.url ? input.url : input
    const tgt = matchTarget(url)
    const reqBody = tgt && init && init.body ? String(init.body) : null
    if (tgt && reqBody) lastReq[tgt] = { url: String(url), body: reqBody }
    const p = origFetch.apply(this, arguments)
    if (tgt) {
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
    const tgt = matchTarget(self.__kaloUrl)
    if (tgt) {
      if (body) lastReq[tgt] = { url: String(self.__kaloUrl), body: String(body) }
      self.addEventListener('load', function () {
        try { emit(String(self.__kaloUrl), body ? String(body) : null, self.responseText) } catch (e) { /* */ }
      })
    }
    return origSend.apply(this, arguments)
  }

  function crawlStatus(payload) {
    try { window.postMessage(Object.assign({ __kaloCrawlStatus: true }, payload), '*') } catch (e) { /* */ }
  }
  function findPageKey(obj) {
    if (!obj || typeof obj !== 'object') return null
    const cands = ['pageNo', 'pageNum', 'page', 'current', 'pageIndex', 'page_no', 'page_num']
    for (const k of cands) if (k in obj) return k
    return null
  }
  // Tự chọn endpoint theo URL anh đang đứng ở Kalodata.
  function pickTargetFromPath() {
    const p = location.pathname
    if (p.indexOf('/creator') === 0) return '/creator/queryList'
    if (p.indexOf('/video') === 0) return '/video/queryList'
    if (p.indexOf('/shop') === 0) return '/shop/queryList'
    return '/product/queryList'
  }
  const ENTITY_LABEL = {
    '/product/queryList': 'sản phẩm',
    '/creator/queryList': 'creator',
    '/video/queryList': 'video',
    '/shop/queryList': 'shop',
  }

  async function runCrawl(maxPages, delayMs) {
    const tgt = pickTargetFromPath()
    const req = lastReq[tgt]
    const label = ENTITY_LABEL[tgt] || 'mục'
    console.log('[UGC-Lab Sync] runCrawl', { target: tgt, hasReq: !!req })
    if (!req || !req.body) {
      crawlStatus({ done: true, error: true,
        text: `Chưa bắt được query ${label}. Hãy:\n1) Cuộn xuống bảng ${label}\n2) Bấm sort 1 cột hoặc sang trang 2\nRồi bấm lại nút này.` })
      return
    }
    let base, url
    try { base = JSON.parse(req.body); url = req.url } catch (e) {
      crawlStatus({ done: true, error: true, text: 'Không đọc được query mẫu.' }); return
    }
    const pageKey = findPageKey(base) || 'pageNo'
    const market = base.country || ''
    let captured = 0
    const seenIds = new Set()
    let duplicateStreak = 0
    crawlStatus({ done: false, page: 0, maxPages, market, captured,
      text: `Bắt đầu kéo ${label}` + (market ? ' ' + market : '') + '...' })
    for (let page = 1; page <= maxPages; page++) {
      const body = Object.assign({}, base, { [pageKey]: page })
      let pageCount = 0, newCount = 0, stop = false
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
          for (const it of list) {
            const id = String(it && it.id)
            if (!seenIds.has(id)) { seenIds.add(id); newCount++ }
          }
          if (!pageCount) stop = true
        } catch (e) { /* */ }
        captured += pageCount
      } catch (e) {
        crawlStatus({ done: true, error: true, text: 'Lỗi kéo trang ' + page + ': ' + (e && e.message) })
        return
      }
      if (page > 1 && pageCount > 0 && newCount === 0) duplicateStreak++
      else duplicateStreak = 0
      crawlStatus({ done: false, page, maxPages, market, captured: seenIds.size,
        text: `[${label}] Trang ${page}/${maxPages} · +${pageCount} (mới: ${newCount})` })
      if (duplicateStreak >= 2) {
        crawlStatus({ done: true, page, maxPages, market, captured: seenIds.size,
          text: `Pagination không hoạt động (trùng lặp).\nThử trên Kalodata: bấm sort cột "Doanh thu" rồi crawl lại.` })
        return
      }
      if (stop) {
        crawlStatus({ done: true, page, maxPages, market, captured: seenIds.size,
          text: `Đã kéo hết ${seenIds.size} ${label} ✓` })
        return
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
    crawlStatus({ done: true, page: maxPages, maxPages, market, captured: seenIds.size,
      text: `Xong ✓ — ${seenIds.size} ${label}` + (market ? ' · ' + market : '') })
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
