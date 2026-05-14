import { useState, useEffect, useRef } from 'react'
import { Package, Loader2, PenLine, Upload, X } from 'lucide-react'
import type { Product, Script } from '../../../stores/types'
import type { EditableProductContext } from '../types'
import { useBankStore } from '../../../stores/bankStore'
import BankPicker from '../../../components/BankPicker'
import { useAppStore } from '../../../stores/appStore'
import { useAssetUrl } from '../../../hooks/useAssetUrl'

function createEditableContext(product: Product): EditableProductContext {
  return {
    productDescription: product.productDescription,
    targetMarket: product.targetMarket,
    painPoints: product.painPoints,
    usps: product.usps,
    benefits: product.benefits,
    offer: product.offer,
    cta: product.cta,
  }
}

interface InputPanelProps {
  winningTranscript: string
  onTranscriptChange: (value: string) => void
  selectedProduct: Product | null
  onProductSelect: (product: Product) => void
  attachedImage: { file: File; preview: string; base64: string; mimeType: string } | null
  onAttachedImageChange: (img: { file: File; preview: string; base64: string; mimeType: string } | null) => void
  onGenerate: (context: EditableProductContext | null) => void
  isGenerating: boolean
  highlightField?: string | null
}

export default function InputPanel({
  winningTranscript,
  onTranscriptChange,
  selectedProduct,
  onProductSelect,
  attachedImage,
  onAttachedImageChange,
  onGenerate,
  isGenerating,
  highlightField,
}: InputPanelProps) {
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [scriptPickerOpen, setScriptPickerOpen] = useState(false)
  const [editableContext, setEditableContext] = useState<EditableProductContext | null>(null)
  const [imgDragOver, setImgDragOver] = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)

  const products = useBankStore((s) => s.products)
  const openApp = useAppStore((s) => s.openApp)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const resolvedProductImage = useAssetUrl(selectedProduct?.productImage)

  useEffect(() => {
    if (selectedProduct) {
      setEditableContext(createEditableContext(selectedProduct))
    }
  }, [selectedProduct])

  const canGenerate = winningTranscript.trim().length > 0 && selectedProduct !== null

  const handleOpenFinder = () => {
    sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'products' })
    openApp('finder')
  }

  const updateField = (field: keyof EditableProductContext, value: string) => {
    if (!editableContext) return
    setEditableContext({ ...editableContext, [field]: value })
  }

  const handleScriptSelect = (item: Script) => {
    onTranscriptChange(item.scriptText)
  }

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) return
    const preview = URL.createObjectURL(file)
    const { base64, mimeType } = await fileToBase64(file)
    onAttachedImageChange({ file, preview, base64, mimeType })
  }

  const clearImage = () => {
    if (attachedImage?.preview) URL.revokeObjectURL(attachedImage.preview)
    onAttachedImageChange(null)
    if (imgInputRef.current) imgInputRef.current.value = ''
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-5">

        {/* ── Bước 1: Kịch bản ── */}
        <div className="mb-6">
          <StepLabel step={1} label="Chọn kịch bản mẫu" />

          <button
            onClick={() => setScriptPickerOpen(true)}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-black/10 bg-black/[0.02] p-4 text-left transition-colors hover:border-blue-500/30 hover:bg-blue-500/5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <PenLine className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700">Kịch bản từ Project</span>
              <span className="text-xs text-gray-400">Nhấn để chọn</span>
            </div>
          </button>

          <div className="my-3 flex items-center gap-3">
            <div className="flex-1 border-t border-black/8" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-300">Hoặc</span>
            <div className="flex-1 border-t border-black/8" />
          </div>

          <textarea
            value={winningTranscript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            rows={6}
            placeholder="Dán transcript quảng cáo thắng vào đây, hoặc gửi từ Phân tích QC..."
            className={`w-full rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm leading-relaxed text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-blue-500/30 resize-none ${highlightField === 'transcript' ? 'animate-field-flash' : ''}`}
          />
        </div>

        {/* ── Bước 2: Sản phẩm ── */}
        <div className="mb-6">
          <StepLabel step={2} label="Chọn sản phẩm" />

          {selectedProduct ? (
            <div className="mt-2">
              <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/5">
                    {resolvedProductImage ? (
                      <img src={resolvedProductImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold tracking-tight text-gray-800">
                      {selectedProduct.productName}
                    </span>
                    <span className="truncate text-xs text-gray-500">
                      {selectedProduct.targetMarket || 'Chưa có thị trường mục tiêu'}
                    </span>
                  </div>
                  <button
                    onClick={() => setProductPickerOpen(true)}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium text-blue-400 transition-colors hover:bg-blue-500/10"
                  >
                    Thay đổi
                  </button>
                </div>
              </div>

              {editableContext && (
                <div className="mt-3 flex flex-col gap-3">
                  <p className="text-[10px] text-gray-400">Chỉnh sửa ở đây sẽ không thay đổi sản phẩm đã lưu</p>
                  <EditableField label="Mô tả" value={editableContext.productDescription} onChange={(v) => updateField('productDescription', v)} />
                  <EditableField label="Thị trường mục tiêu" value={editableContext.targetMarket} onChange={(v) => updateField('targetMarket', v)} />
                  <EditableField label="Điểm đau" value={editableContext.painPoints} onChange={(v) => updateField('painPoints', v)} />
                  <EditableField label="USP" value={editableContext.usps} onChange={(v) => updateField('usps', v)} />
                  <EditableField label="Lợi ích" value={editableContext.benefits} onChange={(v) => updateField('benefits', v)} />
                  <EditableField label="Ưu đãi" value={editableContext.offer} onChange={(v) => updateField('offer', v)} />
                  <EditableField label="CTA" value={editableContext.cta} onChange={(v) => updateField('cta', v)} />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2">
              {products.length > 0 ? (
                <button
                  onClick={() => setProductPickerOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-black/10 bg-black/[0.02] p-4 text-left transition-colors hover:border-blue-500/30 hover:bg-blue-500/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Package className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">Chọn sản phẩm</span>
                    <span className="text-xs text-gray-400">Chọn từ Project sản phẩm</span>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-black/10 bg-black/[0.02] p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/5">
                    <Package className="h-5 w-5 text-gray-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Chưa có sản phẩm — Thêm vào Project</span>
                    <button
                      onClick={handleOpenFinder}
                      className="text-left text-xs text-blue-400 transition-colors hover:text-blue-300"
                    >
                      Thêm vào Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bước 3: Ảnh đính kèm ── */}
        <div className="mb-6">
          <StepLabel step={3} label="Tải ảnh đính kèm (tùy chọn)" />
          <p className="mt-1 mb-2 text-[10px] text-gray-400">Ảnh chụp màn hình trang sản phẩm để Gemini trích xuất thêm ngữ cảnh</p>

          {attachedImage ? (
            <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-black/10">
                <img src={attachedImage.preview} alt="" className="h-full w-full object-cover" />
              </div>
              <span className="flex-1 truncate text-xs text-gray-500">{attachedImage.file.name}</span>
              <button
                onClick={clearImage}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imgInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); setImgDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f) }}
              onDragOver={(e) => { e.preventDefault(); setImgDragOver(true) }}
              onDragLeave={() => setImgDragOver(false)}
              className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-all ${imgDragOver ? 'border-blue-500/40 bg-blue-500/5' : 'border-black/10 bg-black/[0.02] hover:border-black/15 hover:bg-black/[0.03]'}`}
            >
              <Upload className={`h-4 w-4 shrink-0 transition-colors ${imgDragOver ? 'text-blue-400' : 'text-gray-400'}`} />
              <span className="text-xs text-gray-400">Thả ảnh vào đây — JPG, PNG, WebP — tối đa 10MB hoặc nhấn để duyệt</span>
            </button>
          )}

          <input
            ref={imgInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
          />
        </div>
      </div>

      {/* Sticky generate button */}
      <div className="shrink-0 border-t border-black/8 px-5 py-4">
        <button
          onClick={() => onGenerate(editableContext)}
          disabled={!canGenerate || isGenerating}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-black/12 bg-blue-500 px-6 py-3.5 text-[13px] font-medium tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tạo 3 kịch bản...</span>
            </>
          ) : (
            <span>✏️ Tạo 3 kịch bản</span>
          )}
        </button>

        {!canGenerate && !isGenerating && (
          <p className="mt-2 text-center text-[11px] text-gray-300">
            {!winningTranscript.trim() && !selectedProduct
              ? 'Chọn kịch bản và sản phẩm để tạo'
              : !winningTranscript.trim()
                ? 'Chọn hoặc dán kịch bản mẫu'
                : 'Chọn sản phẩm từ Project'}
          </p>
        )}
      </div>

      <BankPicker
        bankType="products"
        isOpen={productPickerOpen}
        onSelect={(item) => onProductSelect(item as Product)}
        onClose={() => setProductPickerOpen(false)}
      />
      <BankPicker
        bankType="scripts"
        isOpen={scriptPickerOpen}
        onSelect={(item) => handleScriptSelect(item as Script)}
        onClose={() => setScriptPickerOpen(false)}
      />
    </div>
  )
}

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold tabular-nums text-blue-400">
        {step}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">{label}</span>
    </div>
  )
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-widest text-gray-300">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs leading-relaxed text-gray-600 placeholder-zinc-700 outline-none transition-colors focus:border-blue-500/30 focus:text-gray-800 resize-none"
      />
    </label>
  )
}

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve({ base64, mimeType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
