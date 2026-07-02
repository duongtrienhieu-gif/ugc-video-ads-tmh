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
import FormBgStudio from '../form-bg-studio/FormBgStudio'
import RebrandStudio from '../rebrand-studio/RebrandStudio'
import AppHeader from '../../components/shell/AppHeader'
import SegmentTabs from '../../components/shell/SegmentTabs'
import ImageModelPicker from '../../components/ImageModelPicker'
import { useSettingsStore } from '../../stores/settingsStore'
import { imageModelCredits } from '../../utils/imageModelInfo'
import { GIFT_TOTAL_IMAGES } from '../gift-studio/types'
import { FORM_BG_VARIANTS } from '../form-bg-studio/types'
import { REBRAND_AI_IMAGES } from '../rebrand-studio/types'

type Mode = 'gift' | 'form' | 'rebrand'
const MODE_KEY = 'image-studio-mode-v1'

function loadMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY)
    return m === 'form' || m === 'rebrand' ? m : 'gift'
  } catch {
    return 'gift'
  }
}

export default function ImageStudio() {
  const [mode, setMode] = useState<Mode>(loadMode)
  const imageModel = useSettingsStore((s) => s.imageModel)

  function pick(m: Mode) {
    setMode(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ }
  }

  const count = mode === 'gift' ? GIFT_TOTAL_IMAGES : mode === 'form' ? FORM_BG_VARIANTS : REBRAND_AI_IMAGES
  const credit = imageModelCredits(imageModel, count)

  return (
    <div className="flex h-full flex-col bg-app-base">
      <AppHeader
        icon={Images}
        eyebrow="IMAGE STUDIO · AI"
        title="Xưởng Ảnh"
        actions={
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
          >
            <Zap className="h-3 w-3" /> ~{credit} credit / lần
          </span>
        }
      />

      {/* Mode switcher — the 3 sub-studios */}
      <div className="shrink-0 border-b border-app-border px-3 py-2">
        <div className="mx-auto max-w-xl space-y-2">
          <SegmentTabs
            value={mode}
            onChange={pick}
            options={[
              { value: 'gift', label: '🎁 Quà tặng' },
              { value: 'form', label: '🖼 Form Sale' },
              { value: 'rebrand', label: '🏷 Re-Brand' },
            ]}
          />
          {/* Chọn model tạo ảnh TRƯỚC khi tạo — credit hiện theo số ảnh mode này */}
          <ImageModelPicker count={count} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {mode === 'gift' ? <GiftStudio embedded /> : mode === 'form' ? <FormBgStudio embedded /> : <RebrandStudio embedded />}
      </div>
    </div>
  )
}
