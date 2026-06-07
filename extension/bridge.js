// ISOLATED world — cầu nối inject.js (MAIN) ↔ background (service worker).
window.addEventListener('message', function (ev) {
  if (ev.source !== window) return
  const d = ev.data
  if (!d) return
  try {
    if (d.__kaloSync) {
      chrome.runtime.sendMessage({ type: 'kalo-capture', target: d.target, reqBody: d.reqBody, respText: d.respText })
    } else if (d.__kaloCrawlStatus) {
      chrome.runtime.sendMessage({
        type: 'kalo-crawl-status',
        text: d.text, done: !!d.done, error: !!d.error,
        page: d.page, maxPages: d.maxPages, market: d.market, captured: d.captured,
      })
    }
  } catch (e) { /* service worker đang ngủ */ }
})

// Nhận lệnh "bắt đầu thu thập" từ popup → chuyển vào MAIN world cho inject.js chạy.
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg && msg.type === 'kalo-crawl-start') {
    window.postMessage({ __kaloCrawl: 'start', maxPages: msg.maxPages, delayMs: msg.delayMs }, '*')
  }
})
