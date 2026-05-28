// ─────────────────────────────────────────────────────────────────────
// Semantic Renderer — SectionExportActions (P14)
//
// Per-section action menu shown in Export view mode. Marketer can:
//   - Copy text (paragraphs joined)
//   - Copy proof quote
//   - Download image (when generatedAsset has outputImages)
//   - Trigger regenerate-image callback
//   - Trigger regenerate-section callback
//   - Trigger regenerate-proof callback (when section has proof)
//
// LOCKED: this component ONLY emits actions / clipboard / downloads.
// Regeneration is a CALLBACK — parent decides implementation. P14
// ships UI hooks only; real partial regen is consumer's responsibility.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Copy, Download, RefreshCcw, Check } from 'lucide-react'
import type { VisualSemanticsSection } from '../types'
import type { GeneratedAsset } from '../../generationOrchestration'

interface Props {
  section: VisualSemanticsSection & {
    generatedAsset?: GeneratedAsset
  }
  onRegenerateImage?: (sectionId: string) => void
  onRegenerateSection?: (sectionId: string) => void
  onRegenerateProof?: (sectionId: string) => void
}

type CopyState = null | 'text' | 'proof'

export function SectionExportActions({
  section,
  onRegenerateImage,
  onRegenerateSection,
  onRegenerateProof,
}: Props) {
  const [copied, setCopied] = useState<CopyState>(null)

  const flashCopy = (which: CopyState) => {
    setCopied(which)
    setTimeout(() => setCopied(null), 1500)
  }

  const copyText = async () => {
    const text = section.paragraphs.join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      flashCopy('text')
    } catch {
      // clipboard may be blocked — silent fail
    }
  }

  const copyProof = async () => {
    if (!section.inlineProof) return
    const proofText = section.inlineProof.author
      ? `"${section.inlineProof.quote}" — ${section.inlineProof.author}${section.inlineProof.meta ? `, ${section.inlineProof.meta}` : ''}`
      : `"${section.inlineProof.quote}"`
    try {
      await navigator.clipboard.writeText(proofText)
      flashCopy('proof')
    } catch {
      // silent
    }
  }

  const downloadImage = () => {
    const img = section.generatedAsset?.outputImages?.[0]
    if (!img) return
    const a = document.createElement('a')
    a.href = img.url
    a.download = `${section.id}.${guessExtension(img.url)}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const hasImage = Boolean(section.generatedAsset?.outputImages?.length)
  const hasProof = Boolean(section.inlineProof)

  return (
    <div className="mx-2 my-2 rounded border border-stone-200 bg-white px-2 py-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={copyText}
          className="flex items-center gap-1 rounded-sm border border-stone-300 bg-white px-2 py-1 font-mono text-[10px] text-stone-700 hover:bg-stone-100"
          title="Copy nội dung section vào clipboard"
        >
          {copied === 'text' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied === 'text' ? 'Đã copy' : 'Copy text'}
        </button>
        {hasProof && (
          <button
            onClick={copyProof}
            className="flex items-center gap-1 rounded-sm border border-stone-300 bg-white px-2 py-1 font-mono text-[10px] text-stone-700 hover:bg-stone-100"
            title="Copy quote proof"
          >
            {copied === 'proof' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            {copied === 'proof' ? 'Đã copy' : 'Copy proof'}
          </button>
        )}
        {hasImage && (
          <button
            onClick={downloadImage}
            className="flex items-center gap-1 rounded-sm border border-stone-300 bg-white px-2 py-1 font-mono text-[10px] text-stone-700 hover:bg-stone-100"
            title="Tải ảnh xuống máy"
          >
            <Download className="h-3 w-3" />
            Tải ảnh
          </button>
        )}
        {onRegenerateImage && section.imageRole !== 'none' && (
          <button
            onClick={() => onRegenerateImage(section.id)}
            className="flex items-center gap-1 rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 font-mono text-[10px] text-amber-800 hover:bg-amber-100"
            title="Tạo lại ảnh cho section này"
          >
            <RefreshCcw className="h-3 w-3" />
            Tạo lại ảnh
          </button>
        )}
        {onRegenerateProof && hasProof && (
          <button
            onClick={() => onRegenerateProof(section.id)}
            className="flex items-center gap-1 rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 font-mono text-[10px] text-amber-800 hover:bg-amber-100"
            title="Tạo lại proof quote"
          >
            <RefreshCcw className="h-3 w-3" />
            Tạo lại proof
          </button>
        )}
        {onRegenerateSection && (
          <button
            onClick={() => onRegenerateSection(section.id)}
            className="flex items-center gap-1 rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 font-mono text-[10px] text-amber-800 hover:bg-amber-100"
            title="Tạo lại toàn bộ section"
          >
            <RefreshCcw className="h-3 w-3" />
            Tạo lại section
          </button>
        )}
      </div>
    </div>
  )
}

function guessExtension(url: string): string {
  if (url.startsWith('data:image/svg')) return 'svg'
  if (url.startsWith('data:image/png')) return 'png'
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg'
  if (url.startsWith('data:image/webp')) return 'webp'
  return 'png'
}
