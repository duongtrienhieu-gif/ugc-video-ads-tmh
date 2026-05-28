// TikTok Shop — main app component.
// 3-panel layout: InputPanel (left) | ImageGrid (middle) | DescriptionEditor (right).
// Phase 1: UI skeleton with mock preview. Phase 3+ wires real generation.

import InputPanel from './components/InputPanel'
import ImageGrid from './components/ImageGrid'
import DescriptionEditor from './components/DescriptionEditor'

export default function TikTokShop() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      <InputPanel />
      <ImageGrid />
      <DescriptionEditor />
    </div>
  )
}
