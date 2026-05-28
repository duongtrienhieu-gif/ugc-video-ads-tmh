import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Eye, Loader2, AlertCircle } from 'lucide-react'
import { useBrandKitStore } from '../../stores/brandKitStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import {
  BRAND_CATEGORY_LABELS,
  MARKET_LABELS,
  type BrandKit,
} from '../../types/brandKit'
import CreateForm from './components/CreateForm'
import ResultEditor from './components/ResultEditor'
import KitDetail from './components/KitDetail'

type Stage =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'editor'; existingId?: string }
  | { kind: 'detail'; id: string }

export default function StudioBrandKit() {
  const [stage, setStage] = useState<Stage>({ kind: 'list' })
  const brandKits = useBrandKitStore((s) => s.brandKits)
  const deleteKit = useBrandKitStore((s) => s.delete)
  const addToast = useAppStore((s) => s.addToast)
  const hasGeminiKey = useSettingsStore((s) => s.hasGeminiKey())

  // Reset to list when leaving the app
  useEffect(() => {
    return () => setStage({ kind: 'list' })
  }, [])

  if (stage.kind === 'create') {
    return (
      <CreateForm
        onCancel={() => setStage({ kind: 'list' })}
        onReady={() => setStage({ kind: 'editor' })}
      />
    )
  }

  if (stage.kind === 'editor') {
    return (
      <ResultEditor
        onCancel={() => setStage({ kind: 'list' })}
        onSaved={(savedId) => setStage({ kind: 'detail', id: savedId })}
      />
    )
  }

  if (stage.kind === 'detail') {
    const kit = brandKits.find((k) => k.id === stage.id)
    if (!kit) {
      return (
        <EmptyState
          message="Không tìm thấy Brand Kit này."
          onBack={() => setStage({ kind: 'list' })}
        />
      )
    }
    return (
      <KitDetail
        kit={kit}
        onBack={() => setStage({ kind: 'list' })}
      />
    )
  }

  const openCreate = () => {
    if (!hasGeminiKey) {
      addToast('Vui lòng nhập Gemini API key trong Cài đặt trước khi tạo Brand Kit.', 'error')
      return
    }
    setStage({ kind: 'create' })
  }

  // List view
  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Header — pr-* reserves space for the absolute-positioned
          Gemini/KIE credit badges at top-right of the main panel
          (mounted by App.tsx with z-50). Without this, header buttons
          get hidden under those pills on every screen size. */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-black/8 bg-white px-6 py-4 pr-[180px] md:pr-[260px]">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-gray-900">
            Studio Brand Kit
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            AI suy luận trọn bộ nhận diện thương hiệu từ 2 trường — đồng bộ với TikTok Shop.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-black"
        >
          <Plus className="h-3.5 w-3.5" />
          Tạo Brand Kit mới
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {brandKits.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-2xl border border-dashed border-black/15 bg-white px-10 py-12">
              <h3 className="text-sm font-semibold text-gray-800">
                Chưa có Brand Kit nào
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-gray-500">
                AI dựng nhận diện trong vài giây — bạn chỉ cần nhập tên brand và chọn ngách.
              </p>
              <button
                onClick={openCreate}
                className="mx-auto mt-5 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-black"
              >
                <Plus className="h-3.5 w-3.5" />
                Tạo Brand Kit mới
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {brandKits.map((k) => (
              <KitCard
                key={k.id}
                kit={k}
                onOpen={() => setStage({ kind: 'detail', id: k.id })}
                onDelete={async () => {
                  if (!confirm(`Xóa Brand Kit "${k.name}"?`)) return
                  await deleteKit(k.id)
                  addToast('Đã xóa Brand Kit.', 'success')
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KitCard({
  kit,
  onOpen,
  onDelete,
}: {
  kit: BrandKit
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-black/8 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div
        className="flex h-28 items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${kit.palette.primary} 0%, ${kit.palette.secondary} 100%)`,
        }}
      >
        <span
          className="text-lg font-bold tracking-tight"
          style={{
            color: kit.palette.neutral ?? '#FFFFFF',
            fontFamily: `"${kit.typography.display}", sans-serif`,
          }}
        >
          {kit.name}
        </span>
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {kit.name}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-gray-500">
              {BRAND_CATEGORY_LABELS[kit.category]} ·{' '}
              {kit.markets.map((m) => MARKET_LABELS[m]).join(', ')}
            </p>
          </div>
        </div>
        {kit.tagline && (
          <p className="mt-2 line-clamp-2 text-xs italic text-gray-600">
            "{kit.tagline}"
          </p>
        )}
        <div className="mt-3 flex items-center gap-1.5">
          <button
            onClick={onOpen}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-gray-900 px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-black"
          >
            <Eye className="h-3 w-3" />
            Xem chi tiết
          </button>
          <button
            onClick={onDelete}
            title="Xóa"
            className="rounded-md border border-red-200 bg-white p-1.5 text-red-500 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#FAFAFA] text-center">
      <AlertCircle className="h-8 w-8 text-gray-400" />
      <p className="text-sm text-gray-600">{message}</p>
      <button
        onClick={onBack}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
      >
        Quay lại danh sách
      </button>
    </div>
  )
}

// ── Re-export inline icons used by sub-components (avoids duplicate imports) ──
export { Loader2, Pencil }
