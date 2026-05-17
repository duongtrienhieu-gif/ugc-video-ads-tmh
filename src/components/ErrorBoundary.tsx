// ── ErrorBoundary.tsx ─────────────────────────────────────────────────────
//
// Top-level safety net so a runtime crash inside any app (e.g. stale cache
// hitting a renamed field, undefined chart data, missing optional prop) no
// longer whites out the entire UGC Lab shell. The boundary catches the throw,
// logs it to console with the offending appId, and renders a graceful VN
// fallback with reload + reset-cache actions.
//
// React error boundaries MUST be class components — there is no hook
// equivalent for componentDidCatch / getDerivedStateFromError.

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RefreshCw, AlertTriangle, Eraser } from 'lucide-react'

interface ErrorBoundaryProps {
  /** Short label of the area being protected — surfaced in the fallback UI + console. */
  appName?: string
  /** localStorage keys to nuke when user clicks "xoá cache" — usually the cache key the app reads on mount. */
  resetKeys?: string[]
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary] crash in "${this.props.appName ?? 'unknown'}":`, error, info)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleClearCache = () => {
    const keys = this.props.resetKeys ?? []
    keys.forEach((k) => {
      try { localStorage.removeItem(k) } catch { /* silent */ }
    })
    this.setState({ hasError: false, error: null })
    // Force fresh mount of children
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const message = this.state.error?.message ?? 'Lỗi không xác định'
    const stack = this.state.error?.stack ?? ''

    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-semibold tracking-tight">Không thể tải trang</h2>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Có lỗi khi hiển thị mục <strong>{this.props.appName ?? 'này'}</strong>.
            Bạn có thể tải lại trang hoặc xoá cache cục bộ rồi thử lại.
          </p>
          <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-red-50 p-2 text-[11px] leading-tight text-red-700">
            {message}
            {stack ? `\n\n${stack.split('\n').slice(0, 4).join('\n')}` : ''}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tải lại
            </button>
            {(this.props.resetKeys?.length ?? 0) > 0 && (
              <button
                onClick={this.handleClearCache}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Eraser className="h-3.5 w-3.5" /> Xoá cache & tải lại
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
