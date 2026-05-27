// ─────────────────────────────────────────────────────────────────────
// Hosted Preview — HostedPreviewPage (INT)
//
// Full-screen, chrome-less preview that loads a LandingSession from
// IndexedDB by sessionId, then renders the SemanticMobilePage in the
// 'clean' view mode for marketer share / screenshot.
//
// LOCKED: read-only. No regen, no tuning, no review actions. Pure
// presentation. Bypasses auth gate (data is local-only IDB — no leak).
//
// LIMITATIONS (known):
//   - Cross-tab same-browser only — IndexedDB is per-origin per-browser
//   - Cross-device share requires backend (P17+)
// ─────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { loadSession, type LandingSession } from '../sessionRuntime'
import { SemanticMobilePage } from '../semanticRenderer'

interface Props {
  sessionId: string
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; session: LandingSession }
  | { kind: 'not-found' }
  | { kind: 'incompatible' }

export function HostedPreviewPage({ sessionId }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const session = await loadSession(sessionId)
      if (cancelled) return
      if (!session) {
        setState({ kind: 'not-found' })
        return
      }
      // Validate session shape (defensive — IDB schema could drift)
      if (!session.sessionId || !session.sections) {
        setState({ kind: 'incompatible' })
        return
      }
      setState({ kind: 'ok', session })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (state.kind === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-stone-500" />
          <p className="font-mono text-[11px] text-stone-600">
            Đang tải preview · {sessionId.slice(0, 16)}…
          </p>
        </div>
      </div>
    )
  }

  if (state.kind === 'not-found') {
    return (
      <ErrorScreen
        title="Không tìm thấy preview"
        body={`Session ID '${sessionId}' không có trong IndexedDB của trình duyệt này. Preview chỉ work cùng trình duyệt + cùng máy đã generate pack. Cross-device share chưa khả dụng (cần backend, P17+).`}
      />
    )
  }

  if (state.kind === 'incompatible') {
    return (
      <ErrorScreen
        title="Session không tương thích"
        body="Session này được tạo trên phiên bản app cũ và không tương thích với schema hiện tại. Tạo lại pack để có preview mới."
      />
    )
  }

  // ── HOSTED PREVIEW — chrome-less rendering ─────────────────────
  // We have a session. Reconstruct the page from session if needed.
  // Note: the session itself carries only state, not the page. To render
  // we need the original ExportablePage — but the session is created
  // from the page, so we cannot reconstruct it from session alone in
  // hosted-preview mode unless we cached the page too.
  //
  // For NOW: render a minimal preview confirming session loaded.
  // TODO INT.5: also persist exportablePage alongside session in IDB
  // so hosted preview can render the actual page.
  return <RenderReady session={state.session} />
}

// ─── RenderReady ─────────────────────────────────────────────────
//
// Renders confirmation of session load + metrics + status overview.
// Full page render lands when we persist ExportablePage alongside session.

function RenderReady({ session }: { session: LandingSession }) {
  const sectionCount = Object.keys(session.sections).length
  const completedCount = Object.values(session.sections).filter(
    (s) => s.regenStatus === 'completed',
  ).length
  const failedCount = Object.values(session.sections).filter(
    (s) => s.regenStatus === 'failed',
  ).length

  return (
    <div className="min-h-screen w-full bg-stone-50">
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="font-serif text-xl italic text-stone-800">
            Hosted preview
          </h1>
          <p className="mt-2 font-mono text-[11px] text-stone-500">
            session: <span className="text-stone-700">{session.sessionId.slice(0, 24)}…</span>
          </p>
          {session.packIdentity.productName && (
            <p className="mt-1 font-mono text-[11px] text-stone-500">
              product: <span className="text-stone-700">{session.packIdentity.productName}</span>
            </p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Sections" value={sectionCount} />
            <Stat label="Completed" value={completedCount} tone="emerald" />
            <Stat label="Failed" value={failedCount} tone={failedCount > 0 ? 'red' : 'stone'} />
          </div>
          <p className="mt-6 font-mono text-[10px] leading-relaxed text-stone-500">
            Preview shell loaded session từ IndexedDB. Để render full mobile preview,
            mở pack gốc trong Super Ladipage app — hosted preview hiện chỉ verify
            session integrity. Full page render sẽ available sau khi tích hợp
            exportablePage cache (INT follow-up).
          </p>
        </div>

        <p className="mt-4 text-center font-mono text-[9px] italic text-stone-400">
          Hosted preview · local IndexedDB only · không cross-device share
        </p>
      </div>
    </div>
  )

  // Silence the unused-import lint warning — SemanticMobilePage will be
  // wired in INT follow-up when exportablePage gets persisted.
  void SemanticMobilePage
}

// ─── presentational helpers ─────────────────────────────────────

function Stat({ label, value, tone = 'stone' }: { label: string; value: number; tone?: 'stone' | 'emerald' | 'red' }) {
  const toneClass =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
    tone === 'red' ? 'bg-red-50 text-red-700' :
    'bg-stone-100 text-stone-700'
  return (
    <div className={`rounded-md py-2 ${toneClass}`}>
      <div className="font-mono text-lg font-medium">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-wider opacity-75">{label}</div>
    </div>
  )
}

function ErrorScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-stone-50 px-6">
      <div className="max-w-md rounded-lg border border-amber-300 bg-amber-50 p-6 shadow-sm">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h1 className="font-mono text-sm font-semibold text-amber-900">{title}</h1>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-amber-800">
              {body}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
