// ── Reference Picker (P13) ──────────────────────────────────────────────────
//
// Optional reference image input shown when the selected creative type
// declares requireReference: true. Multi-upload (up to 3 references —
// arbitrary cap to keep KIE refs[] under a sensible size).
//
// Stored as asset:xxx refs (same persistence channel as product/avatar)
// — survives F5 + flows through the registry as options.referenceRefs.

import { useRef } from 'react'
import { Upload, X } from 'lucide-react'
import { useAssetUrl } from '../../../hooks/useAssetUrl'
import { saveAsset } from '../../../utils/assetStore'

interface ReferencePickerProps {
  refs: string[]
  onAdd: (ref: string) => void
  onRemove: (ref: string) => void
  maxRefs?: number
}

export default function ReferencePicker({ refs, onAdd, onRemove, maxRefs = 3 }: ReferencePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const canAdd = refs.length < maxRefs

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      if (refs.length >= maxRefs) break
      try {
        const ref = await saveAsset(file, file.type || 'image/jpeg')
        onAdd(ref)
      } catch (err) {
        console.error('[ReferencePicker.upload]', err)
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-black/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Reference (tuỳ chọn)
        </p>
        <p className="text-[10px] text-gray-400">{refs.length}/{maxRefs}</p>
      </div>
      <p className="text-[10px] text-gray-400">Mood board / brand reference — KIE dùng làm style anchor</p>

      <div className="grid grid-cols-3 gap-2">
        {refs.map((ref) => (
          <ReferenceThumb key={ref} assetRef={ref} onRemove={() => onRemove(ref)} />
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-black/15 bg-white text-gray-400 transition-colors hover:border-violet-300 hover:text-violet-600"
          >
            <Upload className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}

function ReferenceThumb({ assetRef, onRemove }: { assetRef: string; onRemove: () => void }) {
  const url = useAssetUrl(assetRef)
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-black/10 bg-white">
      {url ? (
        <img src={url} alt="reference" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-gray-100" />
      )}
      <button
        type="button"
        onClick={onRemove}
        title="Bỏ reference này"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
      {/* Always show close button on touch — no hover state */}
      <button
        type="button"
        onClick={onRemove}
        title="Bỏ reference này"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white md:hidden"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
