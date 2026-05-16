import { Package, UserRound, FileText, RefreshCw, Loader2, Film } from 'lucide-react'
import type { Product, Model, Script } from '../../../stores/types'
import { useAssetUrl } from '../../../hooks/useAssetUrl'

interface InputPanelProps {
  selectedProduct: Product | null
  selectedModel: Model | null
  selectedScript: Script | null
  scriptText: string
  additionalContext: string
  onSelectProduct: () => void
  onSelectModel: () => void
  onSelectScript: () => void
  onScriptTextChange: (value: string) => void
  onAdditionalContextChange: (value: string) => void
  onGenerate: () => void
  isGenerating: boolean
  highlightField?: string | null
}

function BankCard({
  icon: Icon,
  label,
  accentClass,
  isEmpty,
  children,
  onSelect,
  className,
}: {
  icon: React.ElementType
  label: string
  accentClass: string
  isEmpty: boolean
  children?: React.ReactNode
  onSelect: () => void
  className?: string
}) {
  if (isEmpty) {
    return (
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-3 rounded-xl border border-dashed border-black/10 p-4 text-left transition-colors hover:border-black/15 hover:bg-black/[0.02] ${className ?? ''}`}
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-[11px] text-gray-400">Nhấn để chọn từ PROJECT</p>
        </div>
      </button>
    )
  }

  return (
    <div className={`rounded-xl border border-black/10 bg-black/[0.02] p-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accentClass}`}>
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">{label}</span>
        </div>
        <button
          onClick={onSelect}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Thay đổi
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const resolvedImage = useAssetUrl(product.productImage)
  return (
    <div className="flex items-center gap-3">
      {resolvedImage ? (
        <img
          src={resolvedImage}
          alt={product.productName}
          className="h-10 w-10 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/5">
          <Package className="h-4 w-4 text-gray-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{product.productName}</p>
        {product.targetMarket && (
          <p className="truncate text-[10px] text-gray-400">{product.targetMarket}</p>
        )}
      </div>
    </div>
  )
}

function ModelCard({ model }: { model: Model }) {
  const resolvedImage = useAssetUrl(model.characterImage)
  return (
    <div className="flex items-center gap-3">
      {resolvedImage ? (
        <img
          src={resolvedImage}
          alt={model.name}
          className="h-10 w-10 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/5">
          <UserRound className="h-4 w-4 text-gray-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{model.name}</p>
        <p className="truncate text-[10px] text-gray-400">{model.source}</p>
      </div>
    </div>
  )
}

function ScriptCard({ script, scriptText }: { script: Script | null; scriptText: string }) {
  const preview = script
    ? script.scriptText.slice(0, 80) + (script.scriptText.length > 80 ? '...' : '')
    : scriptText.slice(0, 80) + (scriptText.length > 80 ? '...' : '')
  const title = script?.title ?? 'Kịch bản đã nhập'

  return (
    <div>
      <p className="text-xs font-medium text-gray-700">{title}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-gray-400 line-clamp-2">{preview}</p>
    </div>
  )
}

export default function InputPanel({
  selectedProduct,
  selectedModel,
  selectedScript,
  scriptText,
  additionalContext,
  onSelectProduct,
  onSelectModel,
  onSelectScript,
  onScriptTextChange,
  onAdditionalContextChange,
  onGenerate,
  isGenerating,
  highlightField,
}: InputPanelProps) {
  const hasScript = scriptText.trim().length > 0
  const canGenerate = hasScript

  return (
    <div className="flex h-full flex-col">
      {/* Bank selections */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex flex-col gap-3">
          {/* Product */}
          <BankCard
            icon={Package}
            label="Sản phẩm"
            accentClass="bg-amber-500/15 text-amber-400"
            isEmpty={!selectedProduct}
            onSelect={onSelectProduct}
          >
            {selectedProduct && <ProductCard product={selectedProduct} />}
          </BankCard>

          {/* Model */}
          <BankCard
            icon={UserRound}
            label="Avatar AI"
            accentClass="bg-sky-500/15 text-sky-400"
            isEmpty={!selectedModel}
            onSelect={onSelectModel}
          >
            {selectedModel && <ModelCard model={selectedModel} />}
          </BankCard>

          {/* Script from bank */}
          <BankCard
            icon={FileText}
            label="Kịch bản"
            accentClass="bg-violet-500/15 text-violet-400"
            isEmpty={!selectedScript}
            onSelect={onSelectScript}
            className={highlightField === 'script' ? 'animate-field-flash' : ''}
          >
            {selectedScript && <ScriptCard script={selectedScript} scriptText={scriptText} />}
          </BankCard>

          {/* "or" divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-black/5" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-gray-300">hoặc</span>
            <div className="h-px flex-1 bg-black/5" />
          </div>

          {/* Manual script textarea */}
          <div>
            <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">
              Dán kịch bản thủ công
            </span>
            <textarea
              value={selectedScript ? '' : scriptText}
              onChange={(e) => onScriptTextChange(e.target.value)}
              disabled={!!selectedScript}
              rows={4}
              placeholder="Dán kịch bản B-roll..."
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-zinc-700 outline-none transition-colors focus:border-black/15 resize-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>

          {/* Additional context */}
          <div className="mt-2">
            <span className="text-[11px] font-medium uppercase tracking-widest text-gray-400">
              Bối cảnh bổ sung
            </span>
            <textarea
              value={additionalContext}
              onChange={(e) => onAdditionalContextChange(e.target.value)}
              rows={3}
              placeholder="Ghi chú tùy chọn (tâm trạng, phong cách, góc quay...)"
              className="mt-1.5 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-zinc-700 outline-none transition-colors focus:border-black/15 resize-none"
            />
          </div>

        </div>
      </div>

      {/* Generate button */}
      <div className="border-t border-black/8 p-4">
        <button
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-black/12 bg-orange-500 px-6 py-3.5 text-[13px] font-medium tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tạo...</span>
            </>
          ) : (
            <>
              <Film className="h-4 w-4" />
              <span>Tạo prompt B-Roll</span>
            </>
          )}
        </button>
        {!canGenerate && !isGenerating && (
          <p className="mt-2 text-center text-[10px] text-gray-300">
            Chọn hoặc dán kịch bản để bắt đầu
          </p>
        )}
      </div>
    </div>
  )
}
