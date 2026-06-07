// Chạy trong ISOLATED world — cầu nối: nhận message từ inject.js (MAIN) rồi
// chuyển cho background (service worker) qua chrome.runtime.
window.addEventListener('message', function (ev) {
  if (ev.source !== window) return
  const d = ev.data
  if (!d || !d.__kaloSync) return
  try {
    chrome.runtime.sendMessage({
      type: 'kalo-capture',
      target: d.target,
      reqBody: d.reqBody,
      respText: d.respText,
    })
  } catch (e) { /* service worker có thể đang ngủ — Chrome tự đánh thức ở lần sau */ }
})
