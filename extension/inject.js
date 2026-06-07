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
  // Tìm key chứa số trang (Kalodata có thể dùng pageNo / page / pageNum / current ...).
  function findPageKey(obj) {
    if (!obj || typeof obj !== 'object') return null
    const cands = ['pageNo', 'pageNum', 'page', 'current', 'pageIndex', 'page_no', 'page_num']
    for (const k of cands) if (k in obj) return k
    return null
  }
  async function runCrawl(maxPages, delayMs) {
    console.log('[UGC-Lab Sync] runCrawl start, lastReq:', lastReq)
    if (!lastReq || !lastReq.body) {
      crawlStatus({ done: true, error: true,
        text: 'Chưa bắt được query Kalodata. Thử:\n1) Cuộn xuống bảng sản phẩm\n2) Bấm sang trang 2 hoặc đổi sort cột\nRồi bấm lại nút này.' })
      return
    }
    let base, url
    try { base = JSON.parse(lastReq.body); url = lastReq.url } catch (e) {
      crawlStatus({ done: true, error: true, text: 'Không đọc được query mẫu.' }); return
    }
    const pageKey = findPageKey(base) || 'pageNo'
    console.log('[UGC-Lab Sync] page key:', pageKey, 'base:', base)
    const market = base.country || ''
    let captured = 0
    let seenIds = new Set()
    let duplicateStreak = 0
    crawlStatus({ done: false, page: 0, maxPages, market, captured, text: 'Bắt đầu kéo' + (market ? ' ' + market : '') + '...' })
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
      // Trang trùng lặp 100% → pagination không hoạt động. Dừng sớm + báo.
      if (page > 1 && pageCount > 0 && newCount === 0) duplicateStreak++
      else duplicateStreak = 0
      crawlStatus({
        done: false, page, maxPages, market, captured,
        text: 'Trang ' + page + '/' + maxPages + ' · +' + pageCount + ' SP (mới: ' + newCount + ')',
      })
      if (duplicateStreak >= 2) {
        crawlStatus({ done: true, page, maxPages, market, captured: seenIds.size,
          text: 'Pagination không hoạt động (trùng lặp).\nThử trên Kalodata: bấm sort cột "Doanh thu" (tăng dần / giảm dần) rồi crawl lại.' })
        return
      }
      if (stop) {
        crawlStatus({ done: true, page, maxPages, market, captured: seenIds.size,
          text: 'Đã kéo hết (' + seenIds.size + ' SP duy nhất, từ ' + captured + ' lượt) ✓' })
        return
      }
      await new Promise((r) => setTimeout(r, delayMs))
    }
    crawlStatus({ done: true, page: maxPages, maxPages, market, captured: seenIds.size,
      text: 'Xong ✓ — ' + seenIds.size + ' SP duy nhất' + (market ? ' · ' + market : '') })
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
