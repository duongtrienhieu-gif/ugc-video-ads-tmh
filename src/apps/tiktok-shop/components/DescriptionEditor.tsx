// DescriptionEditor — right column. Block-based 11-section editor that
// aligns 1-to-1 with the 9-slot arc + opening hook + closing CTA.
// Phase 1: read-only mock blocks. Phase 4 wires inline edit + per-block re-roll.

import { FileText, Copy, RefreshCw } from 'lucide-react'
import { useTikTokShopStore, buildMockListing } from '../store'
import { useAppStore } from '../../../stores/appStore'
import type { DescriptionBlock } from '../types'
import { DESCRIPTION_BLOCK_LABELS } from '../constants'

export default function DescriptionEditor() {
  const draft = useTikTokShopStore((s) => s.draft)
  const showMock = useTikTokShopStore((s) => s.showMockPreview)
  const addToast = useAppStore((s) => s.addToast)

  const output = draft.output ?? (showMock ? buildMockListing() : null)

  function handleCopy() {
    if (!output) return
    const text = assembleDescriptionText(output.description.blocks)
    navigator.clipboard.writeText(text)
      .then(() => addToast('Đã sao chép mô tả', 'success'))
      .catch(() => addToast('Không sao chép được', 'error'))
  }

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-[#FAFAFA]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">Mô tả chi tiết</h2>
        </div>
        <button
          onClick={handleCopy}
          disabled={!output}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <Copy className="h-3 w-3" />
          Sao chép
        </button>
      </div>

      {/* Blocks */}
      <div className="flex-1 overflow-y-auto p-4">
        {output ? (
          <div className="space-y-2">
            {output.description.blocks.map((block, i) => (
              <BlockCard
                key={i}
                block={block}
                onRegenerate={() => addToast('Re-gen block — wire ở Phase 4', 'info')}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-[200px] text-center text-xs text-gray-500">
              Mô tả sẽ hiện sau khi tạo listing.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Block card ───────────────────────────────────────────────────────────

function BlockCard({ block, onRegenerate }: { block: DescriptionBlock; onRegenerate: () => void }) {
  const meta = DESCRIPTION_BLOCK_LABELS[block.kind]
  return (
    <div className="group rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>
        <button
          onClick={onRegenerate}
          title="Tạo lại block này"
          className="rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <BlockBody block={block} />
    </div>
  )
}

function BlockBody({ block }: { block: DescriptionBlock }) {
  switch (block.kind) {
    case 'hook':
    case 'solution':
    case 'offer':
    case 'cta':
      return <p className="text-xs leading-relaxed text-gray-700">{block.text}</p>

    case 'pain':
    case 'benefits':
    case 'promise':
      return (
        <ul className="space-y-0.5 text-xs text-gray-700">
          {block.bullets.map((b, i) => <li key={i}>• {b}</li>)}
        </ul>
      )

    case 'specs':
      return (
        <table className="w-full text-xs text-gray-700">
          <tbody>
            {block.rows.map(([key, val], i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="py-0.5 pr-2 text-gray-500">{key}</td>
                <td className="py-0.5 text-right font-semibold">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )

    case 'reviews':
      return (
        <div className="space-y-1.5">
          {block.quotes.map((q, i) => (
            <div key={i} className="rounded bg-gray-50 p-2">
              <p className="text-[11px] italic text-gray-700">"{q.text}"</p>
              <p className="mt-0.5 text-[10px] font-semibold text-gray-500">— {q.author}</p>
            </div>
          ))}
        </div>
      )

    case 'usage':
      return (
        <ol className="space-y-0.5 text-xs text-gray-700">
          {block.steps.map((s, i) => (
            <li key={i}>{i + 1}. {s}</li>
          ))}
        </ol>
      )

    case 'faq':
      return (
        <div className="space-y-1.5">
          {block.items.map((item, i) => (
            <div key={i}>
              <p className="text-[11px] font-semibold text-gray-700">Q: {item.q}</p>
              <p className="text-[11px] text-gray-600">A: {item.a}</p>
            </div>
          ))}
        </div>
      )
  }
}

// ── Description assembly for clipboard ───────────────────────────────────
// Phase 4 will move this into service.ts as the canonical assembler.

function assembleDescriptionText(blocks: DescriptionBlock[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    const meta = DESCRIPTION_BLOCK_LABELS[b.kind]
    switch (b.kind) {
      case 'hook':
      case 'solution':
      case 'offer':
      case 'cta':
        parts.push(`${meta.icon} ${b.text}`)
        break
      case 'pain':
      case 'benefits':
      case 'promise':
        parts.push(`${meta.icon} ${meta.label.toUpperCase()}\n` + b.bullets.map((x) => `• ${x}`).join('\n'))
        break
      case 'specs':
        parts.push(`${meta.icon} ${meta.label.toUpperCase()}\n` + b.rows.map(([k, v]) => `• ${k}: ${v}`).join('\n'))
        break
      case 'reviews':
        parts.push(`${meta.icon} ${meta.label.toUpperCase()}\n` + b.quotes.map((q) => `⭐⭐⭐⭐⭐ "${q.text}" — ${q.author}`).join('\n'))
        break
      case 'usage':
        parts.push(`${meta.icon} ${meta.label.toUpperCase()}\n` + b.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
        break
      case 'faq':
        parts.push(`${meta.icon} ${meta.label.toUpperCase()}\n` + b.items.map((it) => `Q: ${it.q}\nA: ${it.a}`).join('\n\n'))
        break
    }
  }
  return parts.join('\n\n')
}
