// Chạy trong MAIN world (cùng ngữ cảnh trang Kalodata) — monkey-patch fetch + XHR
// để bắt response của /product/queryList. Gửi ra ISOLATED qua window.postMessage.
(function () {
  const TARGETS = ['/product/queryList']
  function isTarget(url) {
    return typeof url === 'string' && TARGETS.some((t) => url.indexOf(t) > -1)
  }
  function emit(target, reqBody, respText) {
    try {
      window.postMessage({ __kaloSync: true, target, reqBody, respText }, '*')
    } catch (e) { /* ignore */ }
  }

  const origFetch = window.fetch
  window.fetch = function (input, init) {
    const url = input && input.url ? input.url : input
    const hit = isTarget(url)
    const reqBody = hit && init && init.body ? String(init.body) : null
    const p = origFetch.apply(this, arguments)
    if (hit) {
      p.then((res) => {
        try { res.clone().text().then((t) => emit(url, reqBody, t)) } catch (e) { /* */ }
      }).catch(() => {})
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
      self.addEventListener('load', function () {
        try { emit(self.__kaloUrl, body ? String(body) : null, self.responseText) } catch (e) { /* */ }
      })
    }
    return origSend.apply(this, arguments)
  }
})();
