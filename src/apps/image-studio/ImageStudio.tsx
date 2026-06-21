// ─────────────────────────────────────────────────────────────────────
// Xưởng Ảnh — gộp 2 mode vào 1 app (dọn sidebar):
//   • Quà tặng kèm     → GiftStudio
//   • Thiết kế Form Sale → FormBgStudio
// Wrapper chỉ thêm thanh chọn mode + ẩn header con (truyền embedded). Logic
// 2 mode giữ nguyên trong app gốc.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Images, Gift, LayoutTemplate, Tags } from 'lucide-react'
import GiftStudio from '../gift-studio/GiftStudio'
import FormBgStudio from '../form-bg-studio/FormBgStudio'
import RebrandStudio from '../rebrand-studio/RebrandStudio'
import { GIFT_TOTAL_CREDITS } from '../gift-studio/types'
import { FORM_BG_TOTAL_CREDITS } from '../form-bg-studio/types'
import { REBRAND_TOTAL_CREDITS } from '../rebrand-studio/types'

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

  function pick(m: Mode) {
    setMode(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ }
  }

  const tabCls = (active: boolean) =>
    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
    }`

  const credit = mode === 'gift' ? GIFT_TOTAL_CREDITS : mode === 'form' ? FORM_BG_TOTAL_CREDITS : REBRAND_TOTAL_CREDITS

  return (
    <div className="flex h-full flex-col bg-[#F6F6F8]">
      <div className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <Images className="h-5 w-5 text-indigo-500" />
          <h1 className="text-base font-bold text-gray-900">Xưởng Ảnh</h1>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button onClick={() => pick('gift')} className={tabCls(mode === 'gift')}>
            <Gift className="h-3.5 w-3.5" /> Quà tặng kèm
          </button>
          <button onClick={() => pick('form')} className={tabCls(mode === 'form')}>
            <LayoutTemplate className="h-3.5 w-3.5" /> Thiết kế Form Sale
          </button>
          <button onClick={() => pick('rebrand')} className={tabCls(mode === 'rebrand')}>
            <Tags className="h-3.5 w-3.5" /> Re-Branding Sản phẩm
          </button>
        </div>
        <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
          ~{credit} credit / lần
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {mode === 'gift' ? <GiftStudio embedded /> : mode === 'form' ? <FormBgStudio embedded /> : <RebrandStudio embedded />}
      </div>
    </div>
  )
}
