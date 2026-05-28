// DescriptionEditor — right column. Block-based 11-section editor that
// aligns 1-to-1 with the 9-slot arc + opening hook + closing CTA.
// Phase 4: inline edit per block + "regen full description" button.
// Per-block re-roll is Phase 5 polish.

import { useState } from 'react'
import { FileText, Copy, RefreshCw, Loader2, Check, X } from 'lucide-react'
import { useTikTokShopStore, buildMockListing } from '../store'
import { useAppStore } from '../../../stores/appStore'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useResolvedBrandKit } from '../canvas/useResolvedBrandKit'
import { DESCRIPTION_BLOCK_LABELS } from '../constants'
import type { DescriptionBlock } from '../types'
import { generateDescription, assembleFullText } from '../services/generateDescription'

export default function DescriptionEditor() {
  const draft = useTikTokShopStore((s) => s.draft)
  const showMock = useTikTokShopStore((s) => s.showMockPreview)
  const updateBlock = useTikTokShopStore((s) => s.updateDescriptionBlock)
  const setDescription = useTikTokShopStore((s) => s.setDescription)
  const addToast = useAppStore((s) => s.addToast)
  const getProductById = useBankStore((s) => s.getProductById)
  const kieApiKey = useSettingsStore((s) => s.kieApiKey)
  const resolvedBrandKit = useResolvedBrandKit(draft.brandKitId, draft.market)

  const [regenerating, setRegenerating] = useState(false)
  const isReal = !!draft.output  // we have a real output (not mock)
  const output = draft.output ?? (showMock ? buildMockListing() : null)

  function handleCopy() {
    if (!output) return
    const text = assembleFullText(output.description.blocks)
    navigator.clipboard.writeText(text)
      .then(() => addToast('Đã sao chép mô tả', 'success'))
      .catch(() => addToast('Không sao chép được', 'error'))
  }

  async function handleRegenAll() {
    if (!draft.productId || !draft.brandKitId) {
      addToast('Cần chọn Brand Kit + Sản phẩm trước', 'error')
      return
    }
    const product = getProductById(draft.productId)
    if (!product) { addToast('Không tìm thấy sản phẩm', 'error'); return }

    setRegenerating(true)
    try {
      const desc = await generateDescription({
        apiKey: kieApiKey,
        brandKit: resolvedBrandKit,
        product,
        language: draft.market,
      })
      setDescription(desc)
      addToast('Đã tạo lại mô tả', 'success')
    } catch (err) {
      addToast(`Lỗi tạo mô tả: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-[#FAFAFA]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">Mô tả chi tiết</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRegenAll}
            disabled={!isReal || regenerating}
            title="Tạo lại toàn bộ mô tả"
            className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {regenerating
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            Tạo lại
          </button>
          <button
            onClick={handleCopy}
            disabled={!output}
            className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Copy className="h-3 w-3" />
            Sao chép
          </button>
        </div>
      </div>

      {/* Blocks */}
      <div className="flex-1 overflow-y-auto p-4">
        {output ? (
          <div className="space-y-2">
            {output.description.blocks.map((block, i) => (
              <BlockCard
                key={i}
                block={block}
                editable={isReal}
                onSave={(nextBlock) => updateBlock(i, nextBlock)}
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

// ── Block card with inline edit ──────────────────────────────────────────

function BlockCard({
  block,
  editable,
  onSave,
}: {
  block: DescriptionBlock
  editable: boolean
  onSave: (next: DescriptionBlock) => void
}) {
  const [editing, setEditing] = useState(false)
  const meta = DESCRIPTION_BLOCK_LABELS[block.kind]

  return (
    <div className={`group rounded-lg border bg-white p-3 transition-colors ${
      editing ? 'border-violet-400 ring-1 ring-violet-200' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>
        {editable && !editing && (
          <button
            onClick={() => setEditing(true)}
            title="Chỉnh sửa block"
            className="rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
          >
            <RefreshCw className="h-3 w-3 rotate-90" />
          </button>
        )}
      </div>

      {editing ? (
        <BlockEditor
          block={block}
          onCancel={() => setEditing(false)}
          onSave={(next) => { onSave(next); setEditing(false) }}
        />
      ) : (
        <BlockBody block={block} />
      )}
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

// ── Block editor (textarea-based) ────────────────────────────────────────

function BlockEditor({
  block,
  onCancel,
  onSave,
}: {
  block: DescriptionBlock
  onCancel: () => void
  onSave: (next: DescriptionBlock) => void
}) {
  // Serialize block to editable text → user edits → parse back on save.
  // Simple plain-text format; not bulletproof but lets user edit fast.
  const [text, setText] = useState(() => serializeBlock(block))

  function handleSave() {
    try {
      const next = parseBlock(block.kind, text)
      onSave(next)
    } catch (err) {
      // Bad parse — keep editing open so user sees their text
      console.warn('[BlockEditor] parse failed:', err)
      alert('Format không đúng. Kiểm tra lại theo gợi ý.')
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(10, Math.max(3, text.split('\n').length + 1))}
        className="w-full resize-y rounded border border-gray-300 px-2 py-1 font-mono text-[11px] text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-200"
        placeholder={editorPlaceholder(block.kind)}
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{editorHelp(block.kind)}</span>
        <div className="flex gap-1">
          <button
            onClick={onCancel}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Huỷ"
          >
            <X className="h-3 w-3" />
          </button>
          <button
            onClick={handleSave}
            className="rounded p-1 text-green-500 hover:bg-green-50"
            title="Lưu"
          >
            <Check className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Serialize / parse helpers ────────────────────────────────────────────

function serializeBlock(block: DescriptionBlock): string {
  switch (block.kind) {
    case 'hook':
    case 'solution':
    case 'offer':
    case 'cta':
      return block.text
    case 'pain':
    case 'benefits':
    case 'promise':
      return block.bullets.join('\n')
    case 'specs':
      return block.rows.map(([k, v]) => `${k} | ${v}`).join('\n')
    case 'reviews':
      return block.quotes.map((q) => `${q.text} || ${q.author}`).join('\n')
    case 'usage':
      return block.steps.join('\n')
    case 'faq':
      return block.items.map((it) => `Q: ${it.q}\nA: ${it.a}`).join('\n\n')
  }
}

function parseBlock(kind: DescriptionBlock['kind'], text: string): DescriptionBlock {
  const trimmed = text.trim()
  switch (kind) {
    case 'hook':
    case 'solution':
    case 'offer':
    case 'cta':
      if (!trimmed) throw new Error('empty')
      return { kind, text: trimmed }
    case 'pain':
    case 'benefits':
    case 'promise':
      return { kind, bullets: trimmed.split('\n').map((s) => s.trim()).filter(Boolean) }
    case 'specs':
      return {
        kind,
        rows: trimmed
          .split('\n')
          .map((line) => line.split('|').map((p) => p.trim()))
          .filter((parts) => parts.length === 2 && parts[0] && parts[1])
          .map((parts) => [parts[0], parts[1]] as [string, string]),
      }
    case 'reviews':
      return {
        kind,
        quotes: trimmed
          .split('\n')
          .map((line) => {
            const idx = line.indexOf('||')
            if (idx === -1) return null
            return { text: line.slice(0, idx).trim(), author: line.slice(idx + 2).trim() }
          })
          .filter((q): q is { text: string; author: string } => q !== null && !!q.text && !!q.author),
      }
    case 'usage':
      return { kind, steps: trimmed.split('\n').map((s) => s.trim()).filter(Boolean) }
    case 'faq': {
      const items: Array<{ q: string; a: string }> = []
      const lines = trimmed.split('\n').map((l) => l.trim())
      let currentQ: string | null = null
      for (const line of lines) {
        if (line.startsWith('Q:')) currentQ = line.slice(2).trim()
        else if (line.startsWith('A:') && currentQ) {
          items.push({ q: currentQ, a: line.slice(2).trim() })
          currentQ = null
        }
      }
      return { kind, items }
    }
  }
}

function editorPlaceholder(kind: DescriptionBlock['kind']): string {
  switch (kind) {
    case 'pain':
    case 'benefits':
    case 'promise':
    case 'usage':
      return 'Mỗi dòng = 1 bullet'
    case 'specs':
      return 'Mỗi dòng:  Tên thành phần | Tỷ lệ'
    case 'reviews':
      return 'Mỗi dòng:  Nội dung quote || Tên tác giả'
    case 'faq':
      return 'Q: Câu hỏi\nA: Trả lời\n\nQ: Câu hỏi 2\nA: ...'
    default:
      return ''
  }
}

function editorHelp(kind: DescriptionBlock['kind']): string {
  switch (kind) {
    case 'specs': return 'Format: key | value'
    case 'reviews': return 'Format: quote || author'
    case 'faq': return 'Q:/A: trên các dòng riêng'
    case 'pain':
    case 'benefits':
    case 'promise':
    case 'usage':
      return 'Mỗi dòng 1 mục'
    default:
      return ''
  }
}
