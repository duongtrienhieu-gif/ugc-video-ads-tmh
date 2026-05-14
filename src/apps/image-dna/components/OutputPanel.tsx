import { useState } from 'react'
import { Copy, Check, Save, ChevronDown, ChevronUp, Dna, ArrowUpRight, User, Shirt, Move, MapPin, Camera } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import type { VisualDNA, DNASectionName } from '../types'

const SECTION_CONFIG: Record<DNASectionName, { label: string; icon: React.ElementType }> = {
  model: { label: 'Nhân vật', icon: User },
  style: { label: 'Phong cách', icon: Shirt },
  pose: { label: 'Tư thế & Hành động', icon: Move },
  location: { label: 'Địa điểm & Bối cảnh', icon: MapPin },
  camera: { label: 'Máy quay', icon: Camera },
}

// Human-readable labels for camelCase field keys
const FIELD_LABELS: Record<string, string> = {
  gender: 'Giới tính',
  age: 'Độ tuổi',
  ethnicity: 'Dân tộc',
  bodyType: 'Vóc dáng',
  skinTone: 'Màu da',
  skinTexture: 'Kết cấu da',
  eyeColor: 'Màu mắt',
  eyeShape: 'Hình dạng mắt',
  hairColor: 'Màu tóc',
  hairStyle: 'Kiểu tóc',
  hairTexture: 'Kết cấu tóc',
  facialFeatures: 'Đặc điểm khuôn mặt',
  facialHair: 'Râu/ria',
  distinguishingMarks: 'Dấu hiệu đặc biệt',
  clothingStyle: 'Phong cách trang phục',
  accessories: 'Phụ kiện',
  makeup: 'Trang điểm',
  pose: 'Tư thế',
  action: 'Hành động',
  expression: 'Biểu cảm',
  location: 'Địa điểm',
  background: 'Phông nền',
  lighting: 'Ánh sáng',
  weather: 'Thời tiết',
  timeOfDay: 'Thời điểm trong ngày',
  shotType: 'Kiểu cảnh',
  cameraAngle: 'Góc máy',
  cameraDevice: 'Thiết bị quay',
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

interface OutputPanelProps {
  dna: VisualDNA | null
  imageUrl: string | null
}

export default function OutputPanel({ dna, imageUrl }: OutputPanelProps) {
  const [copied, setCopied] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['model']))
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saved, setSaved] = useState(false)
  const [sentToStudio, setSentToStudio] = useState(false)

  const addModel = useBankStore((s) => s.addModel)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const openApp = useAppStore((s) => s.openApp)
  const addToast = useAppStore((s) => s.addToast)

  if (!dna) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <Dna className="h-10 w-10 text-gray-200" strokeWidth={1.5} />
        <p className="text-sm text-gray-300">Tải ảnh lên để trích xuất DNA nhân vật</p>
        <p className="text-xs text-gray-200">Kết quả JSON có cấu trúc sẽ hiện ở đây</p>
      </div>
    )
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  // Flatten DNA into UGC Character Studio's flat profile format
  const flattenDna = (): Record<string, string> => {
    const flat: Record<string, string> = {}
    for (const fields of Object.values(dna)) {
      for (const [key, value] of Object.entries(fields as Record<string, string>)) {
        flat[key] = value
      }
    }
    return flat
  }

  // Build flat prompt string for copying
  const buildPromptString = (): string => {
    const lines: string[] = []
    for (const [sectionKey, fields] of Object.entries(dna)) {
      const config = SECTION_CONFIG[sectionKey as DNASectionName]
      lines.push(`[${config?.label ?? sectionKey}]`)
      for (const [key, value] of Object.entries(fields as Record<string, string>)) {
        lines.push(`  ${fieldLabel(key)}: ${value}`)
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(buildPromptString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    if (!saveName.trim()) return
    addModel({
      characterImage: imageUrl ?? '',
      name: saveName.trim(),
      notes: '',
      jsonProfile: dna as unknown as Record<string, unknown>,
      source: 'image-dna-extractor',
    })
    setShowSaveForm(false)
    setSaveName('')
    setSaved(true)
    addToast('Đã lưu nhân vật vào PROJECT')
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSendToCharacterStudio = () => {
    sendToApp({
      targetApp: 'character-studio',
      targetField: 'profile',
      data: flattenDna(),
    })
    openApp('character-studio')
    addToast('Đã gửi DNA tới Studio Nhân Vật')
    setSentToStudio(true)
    setTimeout(() => setSentToStudio(false), 3000)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-gray-800">DNA Ảnh</h3>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Đã sao chép' : 'Sao chép prompt'}
        </button>
      </div>

      {/* Collapsible JSON sections */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-black/8 bg-black/20">
        {(Object.keys(dna) as DNASectionName[]).map((sectionKey) => {
          const fields = dna[sectionKey]
          const isExpanded = expandedSections.has(sectionKey)
          const config = SECTION_CONFIG[sectionKey]
          const Icon = config.icon
          return (
            <div key={sectionKey} className="border-b border-white/[0.03] last:border-0">
              <button
                onClick={() => toggleSection(sectionKey)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-green-400/60" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-gray-600">
                    {config.label}
                  </span>
                  <span className="text-[10px] tabular-nums text-gray-300">
                    {Object.keys(fields).length} trường
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-3">
                  {Object.entries(fields).map(([key, value]) => (
                    <div key={key} className="flex items-baseline gap-2 py-1">
                      <span className="shrink-0 text-[10px] font-medium text-gray-400">{fieldLabel(key)}</span>
                      <span className="text-xs text-gray-600">{value as string}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-col gap-2">
        {/* Save to Model Bank */}
        {showSaveForm ? (
          <div className="flex gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              placeholder='e.g. "Sarah — Golden Hour"'
              autoFocus
              className="flex-1 rounded-full border border-black/10 bg-transparent px-4 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-green-500/30"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="rounded-full bg-green-500/15 px-4 py-2 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/25 disabled:opacity-40"
            >
              Lưu
            </button>
            <button
              onClick={() => { setShowSaveForm(false); setSaveName('') }}
              className="rounded-full px-4 py-2 text-xs text-gray-500 transition-colors hover:text-gray-700"
            >
              Hủy
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveForm(true)}
            className={`flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3.5 text-[13px] font-medium tracking-tight transition-colors ${saved
              ? 'border-green-500/20 bg-green-500/10 text-green-400'
              : 'border-black/12 text-gray-700 hover:bg-black/[0.05] hover:text-gray-900'
              }`}
          >
            {saved ? (
              <><Check className="h-4 w-4" /> Đã lưu vào PROJECT nhân vật</>
            ) : (
              <><Save className="h-4 w-4" /> Lưu vào PROJECT nhân vật</>
            )}
          </button>
        )}

        {/* Use in UGC Character Studio */}
        <button
          onClick={handleSendToCharacterStudio}
          className={`flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3.5 text-[13px] font-medium tracking-tight transition-colors ${sentToStudio
            ? 'border-green-500/20 bg-green-500/10 text-green-400'
            : 'border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20'
            }`}
        >
          {sentToStudio ? (
            <><Check className="h-4 w-4" /> Đã gửi tới Studio Nhân Vật</>
          ) : (
            <>Gửi tới Studio Nhân Vật <ArrowUpRight className="h-3.5 w-3.5" /></>
          )}
        </button>
      </div>
    </div>
  )
}
