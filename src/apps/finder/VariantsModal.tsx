import { useState, useRef } from 'react'
import { X, Sparkles, Upload, Loader2, Trash2, Check, AlertTriangle } from 'lucide-react'
import { useBankStore } from '../../stores/bankStore'
import { useAppStore } from '../../stores/appStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { generateAllVariants, addManualVariant } from '../character-studio/services/generateVariants'
import type { Model, AvatarVariant } from '../../stores/types'

/**
 * Modal for managing alternate angle/expression variants of an avatar.
 * Variants are used as ADDITIONAL reference images during B-roll generation
 * to lock identity across multiple shots (single-reference is unreliable).
 *
 * Two ways to add variants:
 *   - Generate 4 angles via Nano Banana 2 (~$0.16, AI-generated)
 *   - Upload real photos manually (free, 100% identity-perfect)
 */

interface Props {
  model: Model
  onClose: () => void
}

function VariantThumb({ variant, onDelete }: { variant: AvatarVariant; onDelete: () => void }) {
  const url = useAssetUrl(variant.imageUrl)
  return (
    <div className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-emerald-200 bg-gray-900">
      {url ? (
        <img src={url} alt={variant.label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
        <p className="truncate text-[10px] font-semibold text-white">{variant.label}</p>
        <p className="text-[9px] text-emerald-300">
          {variant.source === 'ai-generated' ? '✨ AI gen' : '📷 Upload'}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
        title="Xóa variant"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

export default function VariantsModal({ model, onClose }: Props) {
  const updateModel = useBankStore((s) => s.updateModel)
  const addToast = useAppStore((s) => s.addToast)
  const openaiApiKey = useSettingsStore((s) => s.openaiApiKey)

  const originalImageUrl = useAssetUrl(model.characterImage)
  const variants = model.variants ?? []

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string }>({ done: 0, total: 0, label: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGen4Angles = async () => {
    if (!openaiApiKey) { addToast('Cần OpenAI API key trong Cài đặt (gen 4 góc dùng gpt-image-1 edits)', 'error'); return }
    if (!originalImageUrl) { addToast('Avatar gốc chưa load — thử lại sau giây', 'error'); return }

    setGenerating(true)
    setProgress({ done: 0, total: 4, label: 'Khởi tạo...' })

    try {
      const newVariants = await generateAllVariants({
        apiKey: openaiApiKey,
        originalImageUrl,
        avatarDescription: undefined,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      })

      if (newVariants.length === 0) {
        addToast('Gen 4 góc thất bại — kiểm tra credit KIE', 'error')
      } else {
        const merged = [...variants, ...newVariants]
        await updateModel(model.id, { variants: merged })
        addToast(`✓ Đã tạo ${newVariants.length}/4 góc mặt`)
      }
    } catch (err) {
      console.error('[gen4Angles] failed:', err)
      addToast(`Lỗi: ${err instanceof Error ? err.message.slice(0, 80) : 'unknown'}`, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      addToast('File phải là ảnh', 'error')
      return
    }

    try {
      const newVariants: AvatarVariant[] = []
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const label = file.name.replace(/\.[^.]+$/, '') || `góc ${variants.length + i + 1}`
        const v = await addManualVariant(file, label)
        newVariants.push(v)
      }
      await updateModel(model.id, { variants: [...variants, ...newVariants] })
      addToast(`✓ Đã upload ${newVariants.length} góc mặt`)
    } catch (err) {
      addToast(`Upload thất bại: ${err instanceof Error ? err.message.slice(0, 80) : 'unknown'}`, 'error')
    }
    e.target.value = ''
  }

  const handleDeleteVariant = async (variantId: string) => {
    const filtered = variants.filter((v) => v.id !== variantId)
    await updateModel(model.id, { variants: filtered })
    addToast('Đã xóa góc mặt')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/8 bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Quản lý góc mặt — {model.name}</h2>
            <p className="text-xs text-white/70">
              Thêm nhiều góc khác nhau của cùng avatar để lock identity khi gen B-roll (UGC Builder)
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Original avatar */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Ảnh gốc (góc chính)</h3>
            <div className="grid grid-cols-5 gap-3">
              <div className="aspect-[9/16] overflow-hidden rounded-lg border-2 border-violet-300 bg-gray-900">
                {originalImageUrl ? (
                  <img src={originalImageUrl} alt={model.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {variants.map((v) => (
                <VariantThumb key={v.id} variant={v} onDelete={() => handleDeleteVariant(v.id)} />
              ))}
              {variants.length < 8 && (
                <div className="flex aspect-[9/16] items-center justify-center rounded-lg border-2 border-dashed border-black/12 text-gray-300">
                  <Sparkles className="h-5 w-5" />
                </div>
              )}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              Tổng cộng: <strong className="text-emerald-600">{variants.length + 1} góc</strong> (1 ảnh gốc + {variants.length} variants).
              Khuyến nghị 3-5 góc để identity lock tốt nhất khi gen B-roll.
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Auto-gen 4 angles */}
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <h4 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-violet-700">
                <Sparkles className="h-4 w-4" /> Auto-gen 4 góc
              </h4>
              <p className="mb-3 text-xs text-violet-600">
                AI tự gen 4 angles: 3/4 trái, 3/4 phải, smile, side profile. Nano Banana 2 + identity lock prompt.
              </p>
              <p className="mb-3 rounded bg-violet-100 px-2 py-1 text-[11px] text-violet-700">
                Cost: <strong>~$0.28 (OpenAI gpt-image-1)</strong> · Thời gian: ~40-80s
              </p>
              <button
                onClick={handleGen4Angles}
                disabled={generating || !openaiApiKey}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gen {progress.done}/{progress.total} ({progress.label})...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Tạo 4 góc auto</>
                )}
              </button>
            </div>

            {/* Manual upload */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h4 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                <Upload className="h-4 w-4" /> Upload góc mặt thực
              </h4>
              <p className="mb-3 text-xs text-emerald-600">
                Có ảnh real-life avatar nhiều góc? Upload trực tiếp — identity 100% chính xác, không drift.
              </p>
              <p className="mb-3 rounded bg-emerald-100 px-2 py-1 text-[11px] text-emerald-700">
                Cost: <strong>Miễn phí</strong> · Nhiều file cùng lúc
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={generating}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40"
              >
                <Upload className="h-4 w-4" /> Chọn ảnh từ máy
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={handleManualUpload}
              />
            </div>
          </div>

          {/* Info card */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-xs text-amber-700">
              <p className="font-semibold">Vì sao cần nhiều góc?</p>
              <p className="mt-0.5">
                Khi gen B-roll trong UGC Builder, AI cần phải vẽ avatar ở nhiều tư thế (ăn, cầm sản phẩm, ngồi, đứng).
                Với chỉ 1 ảnh gốc chính diện, AI phải "tưởng tượng" các góc khác → drift identity. Với 3-5 ảnh nhiều góc,
                AI có anchor đầy đủ → giữ mặt nhất quán xuyên 9 ảnh B-roll.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/8 bg-gray-50/60 px-5 py-3">
          <span className="text-xs text-gray-500">
            {variants.length === 0 ? (
              'Chưa có variant nào — gen hoặc upload để cải thiện B-roll'
            ) : (
              <><Check className="inline h-3.5 w-3.5 text-emerald-500" /> Sẽ tự dùng làm reference trong UGC Builder</>
            )}
          </span>
          <button onClick={onClose} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
            Xong
          </button>
        </div>
      </div>
    </div>
  )
}
