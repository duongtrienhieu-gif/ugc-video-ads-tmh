// ─────────────────────────────────────────────────────────────────────
// Xưởng Ảnh — gộp 3 mode vào 1 app (dọn sidebar):
//   • Quà tặng kèm     → GiftStudio
//   • Thiết kế Form Sale → FormBgStudio
//   • Re-Brand          → RebrandStudio
// Wrapper thêm thanh chọn mode + PICKER model tạo ảnh (nano ↔ gpt-1.5) với
// credit CHÍNH XÁC theo số ảnh mỗi mode. Logic 2 mode giữ nguyên trong app gốc.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Images, Zap } from 'lucide-react'
import GiftStudio from '../gift-studio/GiftStudio'
import PriceComboStudio from '../gift-studio/PriceComboStudio'
import FormBgStudio from '../form-bg-studio/FormBgStudio'
import RebrandStudio from '../rebrand-studio/RebrandStudio'
import SegmentTabs from '../../components/shell/SegmentTabs'
import { imageModelCredits } from '../../utils/imageModelInfo'
import { GIFT_TOTAL_IMAGES } from '../gift-studio/types'
import { FORM_BG_VARIANTS } from '../form-bg-studio/types'
import { REBRAND_AI_IMAGES } from '../rebrand-studio/types'

type Mode = 'gift' | 'combo' | 'form' | 'rebrand'
const MODE_KEY = 'image-studio-mode-v1'

function loadMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY)
    return m === 'form' || m === 'rebrand' || m === 'combo' ? m : 'gift'
  } catch {
    return 'gift'
  }
}

export default function ImageStudio() {
  const [mode, setMode] = useState<Mode>(loadMode)

  function pick(m: Mode) {
    setMode(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ }
  }

  const count = mode === 'gift' ? GIFT_TOTAL_IMAGES : mode === 'combo' ? 1 : mode === 'form' ? FORM_BG_VARIANTS : REBRAND_AI_IMAGES
  const credit = imageModelCredits('nano', count)   // nano là model duy nhất

  return (
    <div className="flex h-full flex-col bg-app-base">
      {/* Ô tiêu đề GÓC NHỎ gộp vào hàng chọn mode (thay dải header full-width). */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-app-border px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: 'var(--color-accent-dim)' }}>
          <Images className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} strokeWidth={2} />
        </span>
        <span className="truncate text-sm font-bold text-app-text">Xưởng Ảnh</span>
        <SegmentTabs
          className="min-w-[260px] flex-1 sm:max-w-md"
          value={mode}
          onChange={pick}
          options={[
            { value: 'gift', label: '🎁 Quà tặng' },
            { value: 'combo', label: '📊 Combo giá' },
            { value: 'form', label: '🖼 Form Sale' },
            { value: 'rebrand', label: '🏷 Re-Brand' },
          ]}
        />
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
        >
          <Zap className="h-3 w-3" /> ~{credit} credit / lần
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {mode === 'gift' ? <GiftStudio embedded /> : mode === 'combo' ? <PriceComboStudio /> : mode === 'form' ? <FormBgStudio embedded /> : <RebrandStudio embedded />}
      </div>
    </div>
  )
}
