// DescriptionEditor — right column. Block-based 11-section editor that
// aligns 1-to-1 with the 9-slot arc + opening hook + closing CTA.
// Phase 4: inline edit per block + "regen full description" button.
// Per-block re-roll is Phase 5 polish.

import { useMemo, useState } from 'react'
import { FileText, Copy, RefreshCw, Loader2, Check, X, Languages, LayoutList, AlignLeft } from 'lucide-react'
import { useTikTokShopStore, buildMockListing } from '../store'
import { useAppStore } from '../../../stores/appStore'
import { useBankStore } from '../../../stores/bankStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useResolvedBrandKit } from '../hooks/useResolvedBrandKit'
import { DESCRIPTION_BLOCK_LABELS } from '../constants'
import type { DescriptionBlock } from '../types'
import type { Market } from '../../../types/brandKit'
import { generateDescription, assembleFullText } from '../services/generateDescription'
import { translateDescriptionText } from '../services/translateDescription'
import { MARKET_LABELS } from '../../../types/brandKit'

type ViewMode = 'blocks' | 'fulltext'

export default function DescriptionEditor() {
  const draft = useTikTokShopStore((s) => s.draft)
  const showMock = useTikTokShopStore((s) => s.showMockPreview)
  const updateBlock = useTikTokShopStore((s) => s.updateDescriptionBlock)
  const setDescription = useTikTokShopStore((s) => s.setDescription)
  const addToast = useAppStore((s) => s.addToast)
  const getProductById = useBankStore((s) => s.getProductById)
  const kieApiKey = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const resolvedBrandKit = useResolvedBrandKit(draft.brandKitId, draft.market)

  const [regenerating, setRegenerating] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('blocks')
  const [translateState, setTranslateState] = useState<{
    open: boolean
    loading: boolean
    text: string
    targetLang: Market
  }>({ open: false, loading: false, text: '', targetLang: 'vi' })

  const isReal = !!draft.output  // we have a real output (not mock)
  const output = draft.output ?? (showMock ? buildMockListing() : null)

  // Assemble full text once per blocks change — used in both fulltext view + copy + translate
  const fullText = useMemo(
    () => (output ? assembleFullText(output.description.blocks) : ''),
    [output],
  )

  function handleCopy() {
    if (!fullText) return
    navigator.clipboard.writeText(fullText)
      .then(() => addToast('Đã sao chép mô tả', 'success'))
      .catch(() => addToast('Không sao chép được', 'error'))
  }

  async function handleTranslate() {
    if (!fullText) { addToast('Chưa có mô tả để dịch', 'error'); return }
    // Translate to the OTHER language than what the listing is currently in
    const targetLang: Market = draft.market === 'ms' ? 'vi' : 'ms'
    setTranslateState({ open: true, loading: true, text: '', targetLang })
    try {
      const translated = await translateDescriptionText({
        apiKey: kieApiKey,
        sourceText: fullText,
        sourceLang: draft.market,
        targetLang,
      })
      setTranslateState({ open: true, loading: false, text: translated, targetLang })
    } catch (err) {
      setTranslateState({ open: false, loading: false, text: '', targetLang })
      addToast(`Dịch lỗi: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  function handleCopyTranslation() {
    if (!translateState.text) return
    navigator.clipboard.writeText(translateState.text)
      .then(() => addToast(`Đã sao chép bản ${MARKET_LABELS[translateState.targetLang]}`, 'success'))
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
        geminiApiKey,
        brandKit: resolvedBrandKit,
        product,
        language: draft.market,
        brief: draft.productBrief ?? undefined,
      })
      setDescription(desc)
      addToast('Đã tạo lại mô tả', 'success')
    } catch (err) {
      addToast(`Lỗi tạo mô tả: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setRegenerating(false)
    }
  }

  const otherLangLabel = draft.market === 'ms' ? 'Tiếng Việt' : 'Bahasa Malaysia'

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-[#FAFAFA]">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">Mô tả chi tiết</h2>
          </div>
          {/* View mode toggle */}
          <div className="flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => setViewMode('blocks')}
              title="Xem theo từng block — sửa inline được"
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                viewMode === 'blocks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList className="h-2.5 w-2.5" />
              Block
            </button>
            <button
              onClick={() => setViewMode('fulltext')}
              title="Xem toàn bộ text — dễ copy 1 phát"
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                viewMode === 'fulltext' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlignLeft className="h-2.5 w-2.5" />
              Full text
            </button>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleRegenAll}
            disabled={!isReal || regenerating}
            title="Tạo lại toàn bộ mô tả"
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {regenerating
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            Tạo lại
          </button>
          <button
            onClick={handleCopy}
            disabled={!output}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Copy className="h-3 w-3" />
            Sao chép
          </button>
          <button
            onClick={handleTranslate}
            disabled={!output || translateState.loading}
            title={`Dịch sang ${otherLangLabel} (~1 credit)`}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
          >
            {translateState.loading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Languages className="h-3 w-3" />}
            {draft.market === 'ms' ? 'Vietsub' : 'Dịch BM'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {output ? (
          viewMode === 'blocks' ? (
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
            <FullTextView text={fullText} />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-[200px] text-center text-xs text-gray-500">
              Mô tả sẽ hiện sau khi tạo listing.
            </p>
          </div>
        )}
      </div>

      {/* Translate modal */}
      <TranslateModal
        open={translateState.open}
        loading={translateState.loading}
        text={translateState.text}
        targetLang={translateState.targetLang}
        onClose={() => setTranslateState((s) => ({ ...s, open: false }))}
        onCopy={handleCopyTranslation}
      />
    </div>
  )
}

// ── Full-text view (read-only assembled text for easy copy) ──────────────

function FullTextView({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-[10px] text-gray-500">
        Read-only — sửa text trong tab Block, full text auto cập nhật. <strong>** markdown</strong> sẽ render bold khi paste vào TikTok Shop.
      </p>
      <textarea
        readOnly
        value={text}
        className="flex-1 w-full resize-none rounded-md border border-gray-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-gray-800"
        spellCheck={false}
      />
    </div>
  )
}

// ── Translate modal ──────────────────────────────────────────────────────

function TranslateModal({
  open,
  loading,
  text,
  targetLang,
  onClose,
  onCopy,
}: {
  open: boolean
  loading: boolean
  text: string
  targetLang: Market
  onClose: () => void
  onCopy: () => void
}) {
  if (!open) return null
  const targetName = MARKET_LABELS[targetLang]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Bản dịch — {targetName}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              <span className="text-xs">Đang dịch sang {targetName}...</span>
            </div>
          ) : (
            <textarea
              readOnly
              value={text}
              className="h-[60vh] w-full resize-none rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800"
              spellCheck={false}
            />
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Đóng
            </button>
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
            >
              <Copy className="h-3 w-3" />
              Sao chép bản dịch
            </button>
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

// Inline markdown bold renderer — supports the `**text**` syntax that
// Gemini emits and that TikTok Shop's description editor renders. Keeps
// the ** markers preserved in the underlying string (copy-to-clipboard
// uses the raw text), only the React preview converts to <strong>.
function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function BlockBody({ block }: { block: DescriptionBlock }) {
  switch (block.kind) {
    case 'hook':
    case 'solution':
    case 'offer':
    case 'cta':
      return <p className="text-xs leading-relaxed text-gray-700">{renderInlineBold(block.text)}</p>

    case 'pain':
    case 'benefits':
    case 'promise':
      return (
        <ul className="space-y-0.5 text-xs text-gray-700">
          {block.bullets.map((b, i) => <li key={i}>• {renderInlineBold(b)}</li>)}
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
              <p className="text-[11px] italic text-gray-700">"{renderInlineBold(q.text)}"</p>
              <p className="mt-0.5 text-[10px] font-semibold text-gray-500">— {q.author}</p>
            </div>
          ))}
        </div>
      )

    case 'usage':
      return (
        <ol className="space-y-0.5 text-xs text-gray-700">
          {block.steps.map((s, i) => (
            <li key={i}>{i + 1}. {renderInlineBold(s)}</li>
          ))}
        </ol>
      )

    case 'faq':
      return (
        <div className="space-y-1.5">
          {block.items.map((item, i) => (
            <div key={i}>
              <p className="text-[11px] font-semibold text-gray-700">Q: {renderInlineBold(item.q)}</p>
              <p className="text-[11px] text-gray-600">A: {renderInlineBold(item.a)}</p>
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
