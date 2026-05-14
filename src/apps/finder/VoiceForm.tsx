import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { VoicePreset } from '../../stores/types'

interface VoiceFormProps {
  item?: VoicePreset | null
  onSave: (data: Omit<VoicePreset, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

export default function VoiceForm({ item, onSave, onCancel }: VoiceFormProps) {
  const [label, setLabel] = useState(item?.label ?? '')
  const [voiceName, setVoiceName] = useState(item?.voiceName ?? '')
  const [gender, setGender] = useState<VoicePreset['gender']>(item?.gender ?? 'Female')
  const [styleInstructions, setStyleInstructions] = useState(item?.styleInstructions ?? '')
  const [creativity, setCreativity] = useState(item?.creativity ?? 1.3)
  const [ambience, setAmbience] = useState<VoicePreset['ambience']>(item?.ambience ?? 'Studio')
  const [linkedModelId] = useState(item?.linkedModelId ?? '')

  useEffect(() => {
    if (item) {
      setLabel(item.label)
      setVoiceName(item.voiceName)
      setGender(item.gender)
      setStyleInstructions(item.styleInstructions)
      setCreativity(item.creativity)
      setAmbience(item.ambience)
    }
  }, [item])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !voiceName.trim() || !styleInstructions.trim()) return
    onSave({ label, voiceName, gender, styleInstructions, creativity, ambience, linkedModelId })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-gray-800">
          {item ? 'Chỉnh sửa giọng đọc' : 'Giọng đọc mới'}
        </h3>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Nhãn *</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={`e.g. "Sarah's chill voice"`}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Tên giọng *</span>
        <input
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          placeholder='e.g. "Leda"'
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Giới tính *</span>
        <div className="flex gap-2">
          {(['Female', 'Male'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${
                gender === g
                  ? 'border-black/15 bg-black/8 text-gray-800'
                  : 'border-black/8 text-gray-500 hover:text-gray-700'
              }`}
            >
              {g === 'Female' ? 'Nữ' : 'Nam'}
            </button>
          ))}
        </div>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Phong cách diễn đạt *</span>
        <textarea
          value={styleInstructions}
          onChange={(e) => setStyleInstructions(e.target.value)}
          rows={3}
          placeholder="Trò chuyện, như nói chuyện với bạn bè"
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/15 resize-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
          Độ sáng tạo ({creativity.toFixed(1)})
        </span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={creativity}
          onChange={(e) => setCreativity(parseFloat(e.target.value))}
          className="accent-zinc-400"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">Âm thanh môi trường *</span>
        <div className="flex gap-2">
          {(['Studio', 'Small Room'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmbience(a)}
              className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${
                ambience === a
                  ? 'border-black/15 bg-black/8 text-gray-800'
                  : 'border-black/8 text-gray-500 hover:text-gray-700'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </label>

      <button
        type="submit"
        className="mt-1 rounded-full bg-black/8 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-black/10"
      >
        {item ? 'Lưu thay đổi' : 'Thêm giọng đọc'}
      </button>
    </form>
  )
}
