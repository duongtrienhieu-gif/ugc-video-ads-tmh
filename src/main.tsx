import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  HostedPreviewPage,
  extractPreviewSessionId,
} from './apps/super-ladipage/hostedPreview'

// ─── Hosted-preview detection (INT) ────────────────────────────────
// If URL hash matches '#preview=<sessionId>', mount the hosted-preview
// shell standalone (bypasses Sidebar + Auth + app shell). The preview
// reads session data from local IndexedDB only — no backend dependency,
// no data leak across users.
//
// Limitation: works cross-tab same-browser only. Cross-device share
// requires backend infrastructure (P17+).

const previewSessionId = extractPreviewSessionId()

const root = createRoot(document.getElementById('root')!)

if (previewSessionId) {
  root.render(
    <StrictMode>
      <HostedPreviewPage sessionId={previewSessionId} />
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
