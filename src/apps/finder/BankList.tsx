import { useState } from 'react'
import { Trash2, Package, UserRound, FileText, Mic, Film, Plus, Braces, Video, Download, Sparkles, Layers, ArrowLeft, Megaphone, Copy, Check, Pencil, Search } from 'lucide-react'
import type { Product, Model, Script, VoicePreset, BRoll, AvatarVariant } from '../../stores/types'
import type { BankType } from '../../utils/constants'
import { useBankStore } from '../../stores/bankStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { useAdsContentStore } from '../ads-content/store'
import type { SavedAdsContent } from '../ads-content/types'
import VariantsModal from './VariantsModal'

interface BankListProps {
  bankType: BankType
  onEdit: (id: string) => void
  onAdd: () => void
}

function ConfirmDelete({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); onConfirm() }}
        className="rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/30"
      >
        Xóa
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onCancel() }}
        className="text-[11px] text-gray-500 hover:text-gray-700"
      >
        Hủy
      </button>
    </div>
  )
}

function productCompleteness(p: Product): string {
  const fields = [p.productImage, p.productName, p.productDescription, p.targetMarket, p.painPoints, p.usps, p.benefits, p.offer, p.ingredients]
  const filled = fields.filter((f) => f && f.trim() !== '').length
  return `${filled}/9 trường`
}

function ProductCard({ item, onEdit, onDelete }: { item: Product; onEdit: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const resolvedImage = useAssetUrl(item.productImage)
  return (
    <div onClick={onEdit} className="group cursor-pointer rounded-xl border border-black/8 bg-black/[0.03] transition-all hover:border-black/12 hover:bg-black/[0.04] hover:-translate-y-0.5">
      {/* Thumbnail */}
      <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-black/[0.04]">
        {resolvedImage ? (
          <img src={resolvedImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-gray-200" strokeWidth={1} />
          </div>
        )}
        {/* Delete button overlay */}
        <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
          {confirm ? (
            <ConfirmDelete onConfirm={onDelete} onCancel={() => setConfirm(false)} />
          ) : (
            <button onClick={() => setConfirm(true)} className="rounded-lg bg-black/50 p-1.5 text-gray-600 opacity-0 backdrop-blur-sm transition-all hover:text-red-400 group-hover:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* Info */}
      <div className="flex flex-col gap-0.5 p-3">
        <span className="truncate text-sm font-semibold tracking-tight text-gray-800">{item.productName}</span>
        <span className="truncate text-xs text-gray-500">{item.targetMarket || 'Chưa có khách hàng mục tiêu'}</span>
        <span className="text-[10px] text-gray-400">{productCompleteness(item)}</span>
      </div>
    </div>
  )
}

// Mini thumbnail for the 2x2 group preview tiles
function MiniTile({ assetRef }: { assetRef: string }) {
  const url = useAssetUrl(assetRef)
  return url ? (
    <img src={url} alt="" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <UserRound className="h-4 w-4 text-gray-300" />
    </div>
  )
}

function ModelCard({ item, onEdit, onDelete }: { item: Model; onEdit: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [variantsOpen, setVariantsOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const resolvedImage = useAssetUrl(item.characterImage)
  const sourceLabel = item.source === 'character-studio' ? 'Studio Avatar AI' : item.source === 'image-dna-extractor' ? 'DNA Ảnh' : 'Nhập thủ công'
  const hasJson = item.jsonProfile !== null
  const variants = item.variants ?? []
  const variantCount = variants.length
  const isGrouped = variantCount >= 3   // 1 main + 3 variants = preset group

  // Click handler: grouped → viewer; solo → edit form
  const handleClick = () => {
    if (isGrouped) setViewerOpen(true)
    else onEdit()
  }

  return (
    <>
      <div onClick={handleClick} className="group cursor-pointer rounded-xl border border-black/8 bg-black/[0.03] transition-all hover:border-black/12 hover:bg-black/[0.04] hover:-translate-y-0.5">
        {/* Thumbnail — 2x2 grid for grouped, single image otherwise */}
        <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-black/[0.04]">
          {isGrouped ? (
            // 2x2 grid of main + first 3 variants
            <div className="grid h-full w-full grid-cols-2 gap-0.5 bg-black/8 p-0.5">
              <div className="overflow-hidden rounded">
                {resolvedImage ? (
                  <img src={resolvedImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100">
                    <UserRound className="h-4 w-4 text-gray-300" />
                  </div>
                )}
              </div>
              {variants.slice(0, 3).map((v) => (
                <div key={v.id} className="overflow-hidden rounded">
                  <MiniTile assetRef={v.imageUrl} />
                </div>
              ))}
            </div>
          ) : resolvedImage ? (
            <img src={resolvedImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserRound className="h-10 w-10 text-gray-200" strokeWidth={1} />
            </div>
          )}

          {/* Badges overlay */}
          <div className="absolute left-2 top-2 flex items-center gap-1">
            {isGrouped && (
              <span className="flex items-center gap-1 rounded-md bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                <Layers className="h-2.5 w-2.5" />
                {variantCount + 1} ảnh
              </span>
            )}
            {hasJson && !isGrouped && (
              <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-sky-400 backdrop-blur-sm">
                <Braces className="h-2.5 w-2.5" />
                JSON
              </span>
            )}
          </div>

          {/* Top-right controls */}
          <div className="absolute right-2 top-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {confirm ? (
              <ConfirmDelete onConfirm={onDelete} onCancel={() => setConfirm(false)} />
            ) : (
              <>
                <button
                  onClick={() => setVariantsOpen(true)}
                  title={variantCount > 0 ? `Quản lý ${variantCount} góc mặt` : 'Thêm góc mặt cho identity lock'}
                  className="rounded-lg bg-black/50 p-1.5 text-violet-300 opacity-0 backdrop-blur-sm transition-all hover:text-violet-200 group-hover:opacity-100"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setConfirm(true)} className="rounded-lg bg-black/50 p-1.5 text-gray-600 opacity-0 backdrop-blur-sm transition-all hover:text-red-400 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 p-3">
          <span className="truncate text-sm font-semibold tracking-tight text-gray-800">{item.name}</span>
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-gray-500">{sourceLabel}</span>
            {variantCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setVariantsOpen(true) }}
                className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200"
                title="Click để quản lý variants"
              >
                ✨ {variantCount + 1} góc
              </button>
            )}
            {variantCount === 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setVariantsOpen(true) }}
                className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-600 hover:bg-violet-100"
                title="Tạo góc mặt để lock identity"
              >
                + góc mặt
              </button>
            )}
          </div>
        </div>
      </div>

      {variantsOpen && <VariantsModal model={item} onClose={() => setVariantsOpen(false)} />}
      {viewerOpen && <ModelGroupViewer model={item} onClose={() => setViewerOpen(false)} onEdit={() => { setViewerOpen(false); onEdit() }} />}
    </>
  )
}

// ── Model group viewer modal — shows all 4 images large + back button ─────
function GroupImageTile({ assetRef, label, badge }: { assetRef: string; label: string; badge?: string }) {
  const url = useAssetUrl(assetRef)
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-black/10 bg-black">
      {url ? (
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-300">...</div>
      )}
      {badge && (
        <span className="absolute left-2 top-2 rounded-md bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          {badge}
        </span>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {label}
      </span>
    </div>
  )
}

function ModelGroupViewer({ model, onClose, onEdit }: { model: Model; onClose: () => void; onEdit: () => void }) {
  const variants = model.variants ?? []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header with back button */}
        <div className="flex items-center justify-between border-b border-black/8 bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-3.5">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/30"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại thư viện
          </button>
          <div className="text-center">
            <h2 className="text-base font-bold text-white">{model.name}</h2>
            <p className="text-[11px] text-white/70">Preset {variants.length + 1} ảnh</p>
          </div>
          <button
            onClick={onEdit}
            className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/30"
            title="Chỉnh sửa info"
          >
            Sửa info
          </button>
        </div>

        {/* 2x2 grid of all 4 images at large size */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <GroupImageTile assetRef={model.characterImage} label="CHÍNH" badge="Ảnh gốc" />
            {variants.map((v: AvatarVariant) => (
              <GroupImageTile key={v.id} assetRef={v.imageUrl} label={v.label} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ScriptCard({ item, onEdit, onDelete }: { item: Script; onEdit: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const getProductById = useBankStore((s) => s.getProductById)
  const linked = item.linkedProductId ? getProductById(item.linkedProductId) : null
  const preview = item.scriptText.split('\n').slice(0, 2).join(' ').slice(0, 80)
  return (
    <div onClick={onEdit} className="group flex cursor-pointer gap-3 rounded-xl border border-black/8 bg-black/[0.03] p-3 transition-colors hover:border-black/10 hover:bg-black/[0.04]">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/5">
        <FileText className="h-5 w-5 text-gray-400" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold tracking-tight text-gray-800">{item.title}</span>
        <span className="truncate text-xs text-gray-500">{preview || 'Kịch bản trống'}</span>
        <div className="flex items-center gap-2">
          {linked && <span className="text-[10px] text-gray-400">{linked.productName}</span>}
          <span className="text-[10px] text-gray-300">{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
        {confirm ? (
          <ConfirmDelete onConfirm={onDelete} onCancel={() => setConfirm(false)} />
        ) : (
          <button onClick={() => setConfirm(true)} className="rounded p-1 text-gray-300 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function BRollCard({ item, onEdit, onDelete }: { item: BRoll; onEdit: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const resolvedImage = useAssetUrl(item.imageUrl)
  const promptPreview = item.prompt.length > 80 ? item.prompt.slice(0, 80) + '…' : item.prompt
  const videoCount = item.videos?.length ?? (item.videoUrl ? 1 : 0)

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!resolvedImage) return
    const a = document.createElement('a')
    a.href = resolvedImage
    a.download = `broll-${item.id.slice(0, 8)}.png`
    a.click()
  }

  return (
    <div onClick={onEdit} className="group cursor-pointer rounded-xl border border-black/8 bg-black/[0.03] transition-all hover:border-black/12 hover:bg-black/[0.04] hover:-translate-y-0.5">
      {/* Thumbnail — adapts to image's natural aspect ratio */}
      <div className="relative w-full overflow-hidden rounded-t-xl">
        {resolvedImage ? (
          <img src={resolvedImage} alt="" className="block w-full" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-black/[0.04]">
            <Film className="h-10 w-10 text-gray-200" strokeWidth={1} />
          </div>
        )}
        {/* Video badge */}
        {videoCount > 0 && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 backdrop-blur-sm">
            <Video className="h-2.5 w-2.5" />
            {videoCount} {videoCount === 1 ? 'video' : 'videos'}
          </span>
        )}
        {/* Action buttons overlay */}
        <div className="absolute right-2 top-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {confirm ? (
            <ConfirmDelete onConfirm={onDelete} onCancel={() => setConfirm(false)} />
          ) : (
            <>
              <button onClick={handleDownload} className="rounded-lg bg-black/50 p-1.5 text-gray-600 opacity-0 backdrop-blur-sm transition-all hover:text-gray-800 group-hover:opacity-100">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setConfirm(true)} className="rounded-lg bg-black/50 p-1.5 text-gray-600 opacity-0 backdrop-blur-sm transition-all hover:text-red-400 group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Info */}
      <div className="flex flex-col gap-0.5 p-3">
        <p className="text-[11px] leading-relaxed text-gray-500 line-clamp-2">{promptPreview}</p>
        <span className="text-[10px] text-gray-300">{new Date(item.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

function VoiceCard({ item, onEdit, onDelete }: { item: VoicePreset; onEdit: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div onClick={onEdit} className="group flex cursor-pointer gap-3 rounded-xl border border-black/8 bg-black/[0.03] p-3 transition-colors hover:border-black/10 hover:bg-black/[0.04]">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/5">
        <Mic className="h-5 w-5 text-gray-400" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold tracking-tight text-gray-800">{item.label}</span>
        <span className="text-xs text-gray-500">{item.voiceName} · {item.gender}</span>
        <span className="truncate text-[10px] text-gray-400">{item.styleInstructions.slice(0, 60)}</span>
      </div>
      <div className="shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
        {confirm ? (
          <ConfirmDelete onConfirm={onDelete} onCancel={() => setConfirm(false)} />
        ) : (
          <button onClick={() => setConfirm(true)} className="rounded p-1 text-gray-300 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function BankList({ bankType, onEdit, onAdd }: BankListProps) {
  const products = useBankStore((s) => s.products)
  const models = useBankStore((s) => s.models)
  const scripts = useBankStore((s) => s.scripts)
  const voices = useBankStore((s) => s.voices)
  const brolls = useBankStore((s) => s.brolls)
  const deleteProduct = useBankStore((s) => s.deleteProduct)
  const deleteModel = useBankStore((s) => s.deleteModel)
  const deleteScript = useBankStore((s) => s.deleteScript)
  const deleteVoice = useBankStore((s) => s.deleteVoice)
  const deleteBRoll = useBankStore((s) => s.deleteBRoll)

  if (bankType === 'products') {
    if (products.length === 0) return <EmptyState icon={Package} label="sản phẩm" onAdd={onAdd} />
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {products.map((p) => (
          <ProductCard key={p.id} item={p} onEdit={() => onEdit(p.id)} onDelete={() => deleteProduct(p.id)} />
        ))}
        <AddCard label="Sản phẩm mới" onAdd={onAdd} />
      </div>
    )
  }

  if (bankType === 'models') {
    if (models.length === 0) return <EmptyState icon={UserRound} label="Avatar AI" onAdd={onAdd} />
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {models.map((m) => (
          <ModelCard key={m.id} item={m} onEdit={() => onEdit(m.id)} onDelete={() => deleteModel(m.id)} />
        ))}
        <AddCard label="Avatar AI mới" onAdd={onAdd} />
      </div>
    )
  }

  if (bankType === 'scripts') {
    if (scripts.length === 0) return <EmptyState icon={FileText} label="kịch bản" onAdd={onAdd} />
    return (
      <div className="flex flex-col gap-2">
        {scripts.map((s) => (
          <ScriptCard key={s.id} item={s} onEdit={() => onEdit(s.id)} onDelete={() => deleteScript(s.id)} />
        ))}
      </div>
    )
  }

  if (bankType === 'voices') {
    if (voices.length === 0) return <EmptyState icon={Mic} label="giọng đọc" onAdd={onAdd} />
    return (
      <div className="flex flex-col gap-2">
        {voices.map((v) => (
          <VoiceCard key={v.id} item={v} onEdit={() => onEdit(v.id)} onDelete={() => deleteVoice(v.id)} />
        ))}
      </div>
    )
  }

  if (bankType === 'adsContent') {
    return <AdsContentBankList onAdd={onAdd} />
  }

  // brolls (default)
  if (brolls.length === 0) return <EmptyState icon={Film} label="Product AI" onAdd={onAdd} />
  return (
    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-6 xl:columns-7 gap-2.5">
      {brolls.map((b) => (
        <div key={b.id} className="mb-3 break-inside-avoid">
          <BRollCard item={b} onEdit={() => onEdit(b.id)} onDelete={() => deleteBRoll(b.id)} />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Ads Content bank — reads from local Zustand persist store (NOT bankStore).
// Items are created inside the Ads Content app via "Lưu vào Project".
// This view renders preview + copy + edit-title + delete + search.
// ─────────────────────────────────────────────────────────────────────────

function AdsContentBankList({ onAdd }: { onAdd: () => void }) {
  const items = useAdsContentStore((s) => s.items)
  const remove = useAdsContentStore((s) => s.remove)
  const updateTitle = useAdsContentStore((s) => s.updateTitle)
  const [query, setQuery] = useState('')

  const filtered = items.filter((it) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return (
      it.title.toLowerCase().includes(q) ||
      it.productName.toLowerCase().includes(q) ||
      it.presetLabel.toLowerCase().includes(q) ||
      it.platformLabel.toLowerCase().includes(q) ||
      it.vietnamese.toLowerCase().includes(q) ||
      it.malay.toLowerCase().includes(q)
    )
  })

  if (items.length === 0) return <EmptyState icon={Megaphone} label="Ads Content" onAdd={onAdd} />

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên, sản phẩm, preset, nội dung..."
          className="w-full rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-pink-500/40"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-xs text-gray-400">Không tìm thấy kết quả cho "{query}"</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((it) => (
            <AdsContentCard
              key={it.id}
              item={it}
              onRemove={() => remove(it.id)}
              onUpdateTitle={(newTitle) => updateTitle(it.id, newTitle)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AdsContentCard({
  item, onRemove, onUpdateTitle,
}: {
  item: SavedAdsContent
  onRemove: () => void
  onUpdateTitle: (t: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(item.title)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copiedField, setCopiedField] = useState<'vn' | 'my' | null>(null)

  const handleCopy = async (field: 'vn' | 'my') => {
    const text = field === 'vn' ? item.vietnamese : item.malay
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1600)
    } catch { /* silent */ }
  }

  const handleSaveTitle = () => {
    const t = draftTitle.trim()
    if (t && t !== item.title) onUpdateTitle(t.slice(0, 160))
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-black/[0.02]">
        <span className="text-base">{item.presetGlyph}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle()
                  if (e.key === 'Escape') { setEditing(false); setDraftTitle(item.title) }
                }}
                autoFocus
                className="flex-1 rounded border border-pink-300 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-pink-500"
              />
              <button onClick={handleSaveTitle} className="rounded bg-pink-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-pink-700">
                Lưu
              </button>
            </div>
          ) : (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="block w-full text-left"
            >
              <p className="truncate text-xs font-semibold text-gray-800">{item.title}</p>
              <p className="truncate text-[10px] text-gray-400">
                {item.platformLabel} · {item.presetLabel} · {new Date(item.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </button>
          )}
        </div>
        {!editing && (
          <>
            <button
              onClick={() => setEditing(true)}
              title="Đổi tên"
              className="rounded-md p-1 text-gray-400 hover:bg-black/[0.04] hover:text-gray-700"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {confirmDelete ? (
              <ConfirmDelete onConfirm={() => { onRemove(); setConfirmDelete(false) }} onCancel={() => setConfirmDelete(false)} />
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Xoá"
                className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Expanded preview */}
      {expanded && !editing && (
        <div className="grid grid-cols-1 gap-2 border-t border-black/8 bg-gray-50/40 p-3 lg:grid-cols-2">
          <PreviewBlock
            flag="🇻🇳"
            label="Vietnamese"
            text={item.vietnamese}
            copied={copiedField === 'vn'}
            onCopy={() => handleCopy('vn')}
          />
          <PreviewBlock
            flag="🇲🇾"
            label="Bahasa Melayu"
            text={item.malay}
            copied={copiedField === 'my'}
            onCopy={() => handleCopy('my')}
          />
        </div>
      )}
    </div>
  )
}

function PreviewBlock({
  flag, label, text, copied, onCopy,
}: {
  flag: string
  label: string
  text: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="rounded-lg border border-black/8 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-black/8 bg-gray-50/60 px-2.5 py-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
          {flag} {label}
        </span>
        <button
          onClick={onCopy}
          className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            copied
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
          }`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Đã chép' : 'Chép'}
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-2.5">
        <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-gray-800">{text}</p>
      </div>
    </div>
  )
}

function AddCard({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 bg-transparent aspect-square w-full transition-colors hover:border-black/25 hover:bg-black/[0.02]"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05]">
        <Plus className="h-4 w-4 text-gray-400" />
      </div>
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
    </button>
  )
}

function EmptyState({ icon: Icon, label, onAdd }: { icon: React.ElementType; label: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/[0.04]">
        <Icon className="h-7 w-7 text-gray-300" strokeWidth={1.5} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-gray-500">Chưa có {label} nào</p>
        <p className="text-xs text-gray-300">Nhấn nút bên trên để thêm mới.</p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 rounded-xl bg-black/[0.06] px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-black/8"
      >
        <Plus className="h-4 w-4" />
        Thêm {label}
      </button>
    </div>
  )
}
