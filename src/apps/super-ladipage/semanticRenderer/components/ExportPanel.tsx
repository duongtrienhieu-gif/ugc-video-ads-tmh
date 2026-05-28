// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — ExportPanel (P14)
//
// Page-level export bar shown in Export view mode. Provides:
//   - Copy whole pack as markdown
//   - Download JSON
//   - Copy Ladipage assembly guidance (Vietnamese marketer text)
//   - Download markdown
//
// All actions are SYNC — serializers run pure in-browser. No API calls,
// no auto-publish.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Copy, Download, FileText, Check, BookOpen, Code2, Layers, ExternalLink, Link as LinkIcon } from 'lucide-react'
import type { ExportablePage } from '../../exportPipeline'
import {
  serializeToMarkdown,
  serializeToJsonString,
  serializeToLadipageGuidance,
} from '../../exportPipeline'
import {
  adaptToLadipage,
  serializeBundleHtml,
  serializeBundleJson,
} from '../../ladipageAdapter'
import { buildPreviewUrl } from '../../hostedPreview'

interface Props {
  page: ExportablePage
  /** Optional sessionId — when provided, enables hosted preview share buttons. */
  sessionId?: string
}

type Toast =
  | null
  | 'markdown'
  | 'json'
  | 'ladipage'
  | 'ladipage-html'
  | 'ladipage-json'
  | 'preview-url'

export function ExportPanel({ page, sessionId }: Props) {
  const [toast, setToast] = useState<Toast>(null)

  const flash = (which: Toast) => {
    setToast(which)
    setTimeout(() => setToast(null), 1500)
  }

  const copyMarkdown = async () => {
    const md = serializeToMarkdown(page)
    await navigator.clipboard.writeText(md).catch(() => {})
    flash('markdown')
  }

  const copyLadipageGuide = async () => {
    const guide = serializeToLadipageGuidance(page)
    await navigator.clipboard.writeText(guide).catch(() => {})
    flash('ladipage')
  }

  const downloadJson = () => {
    const json = serializeToJsonString(page)
    triggerDownload(json, 'storytelling-pack.json', 'application/json')
    flash('json')
  }

  const downloadMarkdown = () => {
    const md = serializeToMarkdown(page)
    triggerDownload(md, 'storytelling-pack.md', 'text/markdown')
  }

  // ── P16A — Ladipage bundle exports ─────────────────────────────
  const copyLadipageHtml = async () => {
    const bundle = adaptToLadipage(page)
    const html = serializeBundleHtml(bundle)
    await navigator.clipboard.writeText(html).catch(() => {})
    flash('ladipage-html')
  }

  const downloadLadipageJson = () => {
    const bundle = adaptToLadipage(page)
    const json = serializeBundleJson(bundle)
    triggerDownload(json, `${bundle.bundleId}.json`, 'application/json')
    flash('ladipage-json')
  }

  // ── INT — Hosted preview share ─────────────────────────────────
  const openHostedPreview = () => {
    if (!sessionId) return
    const url = buildPreviewUrl(sessionId)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const copyPreviewUrl = async () => {
    if (!sessionId) return
    const url = buildPreviewUrl(sessionId)
    await navigator.clipboard.writeText(url).catch(() => {})
    flash('preview-url')
  }

  return (
    <div className="px-6 py-4 border-t border-stone-200 bg-stone-100 space-y-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-stone-700">
          Export — sẵn sàng paste vào Ladipage
        </p>
        <p className="mt-1 font-mono text-[10px] text-stone-500">
          {page.sections.length} section · {page.totalWordCount} từ · {page.estimatedScrollTimeSec}s scroll
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <p className="mb-1 font-mono text-[10px] font-medium text-stone-600">Copy clipboard</p>
          <div className="flex flex-wrap gap-1.5">
            <ExportButton onClick={copyMarkdown} icon={Copy} label="Markdown" success={toast === 'markdown' ? 'Đã copy' : null} />
            <ExportButton onClick={copyLadipageGuide} icon={BookOpen} label="Hướng dẫn Ladipage" success={toast === 'ladipage' ? 'Đã copy' : null} />
            <ExportButton onClick={copyLadipageHtml} icon={Code2} label="Ladipage HTML" success={toast === 'ladipage-html' ? 'Đã copy' : null} />
          </div>
        </div>

        <div>
          <p className="mb-1 font-mono text-[10px] font-medium text-stone-600">Tải xuống</p>
          <div className="flex flex-wrap gap-1.5">
            <ExportButton onClick={downloadJson} icon={Download} label="JSON" success={toast === 'json' ? 'Đã tải' : null} />
            <ExportButton onClick={downloadMarkdown} icon={FileText} label="Markdown" />
            <ExportButton onClick={downloadLadipageJson} icon={Layers} label="Ladipage bundle" success={toast === 'ladipage-json' ? 'Đã tải' : null} />
          </div>
        </div>

        {sessionId && (
          <div>
            <p className="mb-1 font-mono text-[10px] font-medium text-stone-600">
              Hosted preview (local-only)
            </p>
            <div className="flex flex-wrap gap-1.5">
              <ExportButton onClick={openHostedPreview} icon={ExternalLink} label="Mở preview" />
              <ExportButton onClick={copyPreviewUrl} icon={LinkIcon} label="Copy URL" success={toast === 'preview-url' ? 'Đã copy' : null} />
            </div>
            <p className="mt-1 font-mono text-[9px] italic text-stone-500">
              Preview chỉ work cùng trình duyệt + cùng máy (local IndexedDB).
              Cross-device share cần backend (P17+).
            </p>
          </div>
        )}
      </div>

      <p className="font-mono text-[9px] italic leading-snug text-stone-500">
        Hệ thống KHÔNG auto-publish, KHÔNG auto-build HTML. Bạn là final layout controller —
        paste copy + apply layout theo "Hướng dẫn Ladipage" trong khối Ladipage thật.
        Ladipage HTML / bundle là gợi ý cấu trúc — Ladipage block editor luôn quyết định cuối cùng.
      </p>
    </div>
  )
}

// ─── ExportButton ───────────────────────────────────────────────

interface ExportButtonProps {
  onClick: () => void
  icon: typeof Copy
  label: string
  success?: string | null
}

function ExportButton({ onClick, icon: Icon, label, success }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      className={
        success
          ? 'flex items-center gap-1 rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 font-mono text-[10px] text-emerald-800'
          : 'flex items-center gap-1 rounded-sm border border-stone-300 bg-white px-2 py-1 font-mono text-[10px] text-stone-700 hover:bg-stone-50'
      }
    >
      {success ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
      {success ?? label}
    </button>
  )
}

// ─── helpers ────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
