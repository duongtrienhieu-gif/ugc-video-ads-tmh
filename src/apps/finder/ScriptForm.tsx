import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Script } from '../../stores/types'
import { useBankStore } from '../../stores/bankStore'

interface ScriptFormProps {
  item?: Script | null
  onSave: (data: Omit<Script, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

export default function ScriptForm({ item, onSave, onCancel }: ScriptFormProps) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [scriptText, setScriptText] = useState(item?.scriptText ?? '')
  const [linkedProductId, setLinkedProductId] = useState(item?.linkedProductId ?? '')
  const products = useBankStore((s) => s.products)

  useEffect(() => {
    if (item) {
      setTitle(item.title)
      setScriptText(item.scriptText)
      setLinkedProductId(item.linkedProductId)
    }
  }, [item])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !scriptText.trim()) return
    onSave({
      title,
      scriptText,
      linkedProductId,
      source: item?.source ?? 'manual',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-gray-800">
          {item ? 'Chỉnh sửa kịch bản' : 'Kịch bản mới'}
        </h3>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Tiêu đề *</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "LARQ - Lazy Girl Hook"'
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Nội dung kịch bản *</span>
        <textarea
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          rows={6}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15 resize-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Sản phẩm liên kết</span>
        <select
          value={linkedProductId}
          onChange={(e) => setLinkedProductId(e.target.value)}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-black/15"
        >
          <option value="">Không có</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.productName}</option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="mt-1 rounded-full bg-black/8 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-black/10"
      >
        {item ? 'Lưu thay đổi' : 'Thêm kịch bản'}
      </button>
    </form>
  )
}
