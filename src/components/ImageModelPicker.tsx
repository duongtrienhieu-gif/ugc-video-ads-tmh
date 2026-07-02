// ─────────────────────────────────────────────────────────────────────────
// ImageModelPicker — chọn 1 trong 2 model tạo ảnh (Nano Banana 2 ↔ GPT Image 1.5)
// TRƯỚC khi bấm Tạo. Hiển thị credit CHÍNH XÁC (×số ảnh) + note để user tự pick.
//
// State là GLOBAL (settingsStore.imageModel) — chọn ở 1 app thì mọi app theo,
// nhưng picker hiện ở mọi app để đổi ngay trước khi tạo. Đặt `count` = số ảnh
// app sắp tạo để hiện tổng credit đúng.
// ─────────────────────────────────────────────────────────────────────────
import { useSettingsStore } from '../stores/settingsStore'
import { IMAGE_MODEL_INFO, IMAGE_MODEL_KEYS, imageModelCredits } from '../utils/imageModelInfo'

interface Props {
  /** Số ảnh app sắp tạo → hiện tổng credit đúng. Mặc định 1. */
  count?: number
  /** Ẩn dòng note (khi chỗ hẹp). */
  compact?: boolean
  className?: string
}

export default function ImageModelPicker({ count = 1, compact = false, className = '' }: Props) {
  const imageModel = useSettingsStore((s) => s.imageModel)
  const setImageModel = useSettingsStore((s) => s.setImageModel)

  return (
    <div className={`rounded-xl border border-black/10 bg-black/[0.015] p-2 ${className}`}>
      <p className="mb-1.5 px-0.5 text-[11px] font-semibold text-gray-500">
        🎨 Model tạo ảnh{count > 1 ? ` · ${count} ảnh` : ''}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {IMAGE_MODEL_KEYS.map((k) => {
          const m = IMAGE_MODEL_INFO[k]
          const active = imageModel === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => setImageModel(k)}
              aria-pressed={active}
              title={m.note}
              className={`rounded-lg border p-2 text-left transition-colors ${
                active
                  ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300'
                  : 'border-black/10 bg-white hover:bg-black/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-gray-800">{m.label}</span>
                <span className={`shrink-0 text-[10px] font-bold ${active ? 'text-violet-600' : 'text-gray-400'}`}>
                  {imageModelCredits(k, count)} cr
                </span>
              </div>
              <p className="text-[9px] text-gray-400">{m.provider} · {m.speed}</p>
              {!compact && <p className="mt-1 text-[10px] leading-snug text-gray-500">{m.note}</p>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
