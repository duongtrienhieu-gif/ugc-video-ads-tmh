// ── PRODUCT AI ───────────────────────────────────────────────────────────────
// Generate 4 UGC-style product photos (1:1 square) of a chosen model holding /
// using / reviewing a chosen product. Output is meant for website / landing
// page imagery — diverse shot angles + naturalistic scenes.
//
// Uses KIE.ai's GPT Image 2 with avatar + product passed as referenceImageUrls.
// Returns 4 variants in parallel, each with its own regenerate button.

import { useState, useRef } from 'react'
import { Sparkles, Loader2, RotateCcw, UserRound, Package, Upload, Check, Download, Save } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { generateImage, pollImageUntilDone } from '../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../utils/assetStore'
import BankPicker from '../../components/BankPicker'
import type { Product, Model } from '../../stores/types'

// ── 4 prompt variations — covers the most useful UGC product shots ──────────
// Each prompt explicitly references "the product shown in the reference image"
// + "the same person shown in the reference image" so KIE GPT Image 2 anchors
// identity AND product appearance from the referenceImageUrls.

interface ShotRecipe {
  label: string
  prompt: string
}

const PRODUCT_SHOTS: ShotRecipe[] = [
  {
    label: 'Cầm sản phẩm',
    prompt: 'The same person from the reference image is holding the product (matching the product reference image) at chest level with one or both hands, label fully facing the camera, gentle confident smile, looking directly at the lens. Natural soft daylight indoors, neutral home background (light wall / window light). Authentic UGC iPhone photo aesthetic: sharp focus across the entire frame, zero bokeh, zero depth of field, unedited natural skin and lighting, no artificial studio look, no AI artifacts. Square 1:1 framing, waist-up composition. The product must EXACTLY match the reference product image — same container shape, color, label, branding.',
  },
  {
    label: 'Review chỉ vào sản phẩm',
    prompt: 'The same person from the reference image is holding the product (matching the product reference image) with one hand while using the index finger of the other hand to point at a specific part of the label / packaging, looking down at it with a focused interested expression, as if explaining the product to a friend or reviewing it on camera. Soft natural daylight, neutral indoor background. Authentic UGC iPhone photo: sharp focus across the entire frame, zero bokeh, unedited skin, no studio look. Square 1:1 framing, medium close-up. Product must EXACTLY match the reference image.',
  },
  {
    label: 'Bàn nhiều sản phẩm',
    prompt: 'The same person from the reference image is sitting at a clean wooden or marble desk/table, with 3-5 units of the product (matching the product reference image — same shape, color, label) arranged in a tidy row or small cluster in front of them. They are leaning slightly forward, picking up one unit while smiling warmly at the camera. Cozy home or cafe background softly visible, soft natural window light from the side. UGC iPhone aesthetic: sharp focus across the entire frame, zero bokeh on the product row, unedited natural skin, no AI sheen. Square 1:1 framing.',
  },
  {
    label: 'Đang dùng sản phẩm',
    prompt: 'The same person from the reference image is naturally using or applying the product (matching the product reference image) — for example: opening a jar/bottle and dispensing a small amount onto their hand / a finger, OR taking a tablet/capsule from a blister pack, OR holding the product near their face/skin in a natural usage moment. Genuine engaged expression, looking down at the product or at the camera. Soft daylight, real home/bathroom/kitchen setting depending on product type. Authentic UGC iPhone photo: sharp focus across the entire frame, zero bokeh, unedited skin, no studio gloss. Square 1:1, waist-up composition. Product must EXACTLY match the reference image.',
  },
]

// ── Helper: take an unknown URL (asset:// / blob: / https:) and return a public URL ──
async function toPublicUrl(ref: string): Promise<string | null> {
  if (!ref) return null
  if (isAssetRef(ref)) return await getUrl(ref)
  if (ref.startsWith('blob:')) {
    // Upload local blob to asset store so KIE can fetch it
    const r = await fetch(ref)
    if (!r.ok) return null
    const blob = await r.blob()
    const assetId = await saveAsset(blob, blob.type || 'image/jpeg')
    return await getUrl(assetId)
  }
  return ref
}

// ── Image slot — one of 4 result tiles ──────────────────────────────────────
function ResultTile({
  url, label, isLoading, onRegen, onSave, saved,
}: {
  url: string | null
  label: string
  isLoading: boolean
  onRegen: () => void
  onSave: () => void
  saved: boolean
}) {
  const resolvedUrl = useAssetUrl(url ?? undefined)
  const displayUrl = url?.startsWith('http') || url?.startsWith('data:') ? url : resolvedUrl

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-gray-100">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : displayUrl ? (
        <>
          <img src={displayUrl} alt={label} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {label}
          </span>
          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onRegen}
              title="Tạo lại ảnh này"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-violet-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { if (!displayUrl) return; const a = document.createElement('a'); a.href = displayUrl; a.download = `product-ai-${label}-${Date.now()}.png`; a.click() }}
              title="Tải xuống"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onSave}
              title={saved ? 'Đã lưu vào Project' : 'Lưu vào Project → Product AI'}
              className={`flex h-7 w-7 items-center justify-center rounded-md backdrop-blur-sm ${saved ? 'bg-emerald-500 text-white' : 'bg-black/60 text-white hover:bg-emerald-600'}`}
            >
              {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            </button>
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px]">{label}</span>
        </div>
      )}
    </div>
  )
}

// ── Picker tile (avatar / product) ───────────────────────────────────────────
function PickerTile({
  imageUrl, label, hint, onSelectFromBank, onUpload, onClear,
}: {
  imageUrl: string | null
  label: string
  hint: string
  onSelectFromBank: () => void
  onUpload: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const resolvedUrl = useAssetUrl(imageUrl ?? undefined)
  const display = imageUrl?.startsWith('http') || imageUrl?.startsWith('data:') || imageUrl?.startsWith('blob:') ? imageUrl : resolvedUrl

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-black/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
        {imageUrl && (
          <button onClick={onClear} className="text-[10px] text-gray-400 hover:text-red-500">Bỏ chọn</button>
        )}
      </div>
      <div className="aspect-square w-full overflow-hidden rounded-lg border border-dashed border-black/10 bg-white">
        {display ? (
          <img src={display} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            {label.toLowerCase().includes('avatar') ? <UserRound className="h-10 w-10" strokeWidth={1.2} /> : <Package className="h-10 w-10" strokeWidth={1.2} />}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-400">{hint}</p>
      <div className="flex gap-2">
        <button
          onClick={onSelectFromBank}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
        >
          Từ Project
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-black/[0.04]"
        >
          <Upload className="h-3.5 w-3.5" /> Tải lên
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
      />
    </div>
  )
}

export default function ProductAI() {
  const [selectedAvatar, setSelectedAvatar] = useState<Model | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null)
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(null)
  const [pickerMode, setPickerMode] = useState<'avatar' | 'product' | null>(null)

  // Results: 4 image URLs (null = not yet generated / loading)
  const [results, setResults] = useState<(string | null)[]>([null, null, null, null])
  const [isGenerating, setIsGenerating] = useState(false)
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set())

  const kieApiKey = useSettingsStore((s) => s.kieApiKey)
  const addToast = useAppStore((s) => s.addToast)
  const addBRoll = useBankStore((s) => s.addBRoll)

  const avatarImageRef = selectedAvatar?.characterImage ?? uploadedAvatarUrl
  const productImageRef = selectedProduct?.productImage ?? uploadedProductUrl
  const canGenerate = !!avatarImageRef && !!productImageRef && !!kieApiKey

  const handleSelectAvatar = (item: unknown) => {
    setSelectedAvatar(item as Model)
    setUploadedAvatarUrl(null)
    setPickerMode(null)
  }
  const handleSelectProduct = (item: unknown) => {
    setSelectedProduct(item as Product)
    setUploadedProductUrl(null)
    setPickerMode(null)
  }

  const handleUploadAvatar = (file: File) => {
    const url = URL.createObjectURL(file)
    setUploadedAvatarUrl(url)
    setSelectedAvatar(null)
  }
  const handleUploadProduct = (file: File) => {
    const url = URL.createObjectURL(file)
    setUploadedProductUrl(url)
    setSelectedProduct(null)
  }

  // Generate ONE shot via KIE GPT Image 2 — avatar + product passed as references
  const genOneShot = async (recipe: ShotRecipe, avatarPublicUrl: string, productPublicUrl: string): Promise<string | null> => {
    try {
      const { taskId } = await generateImage({
        apiKey: kieApiKey,
        model: 'gpt-image-2-text-to-image',
        prompt: recipe.prompt,
        resolution: '1K',
        aspectRatio: '1:1',
        // Pass product twice for stronger product identity weight
        referenceImageUrls: [avatarPublicUrl, productPublicUrl, productPublicUrl],
      })
      const url = await pollImageUntilDone({ apiKey: kieApiKey, taskId, timeoutMs: 4 * 60 * 1000 })
      // Persist to asset store (URL might be temporary)
      let stored: string
      if (isAssetRef(url)) stored = url
      else {
        const r = await fetch(url)
        const b = await r.blob()
        stored = await saveAsset(b, b.type || 'image/png')
      }
      return stored
    } catch (err) {
      console.error(`[ProductAI] ${recipe.label} failed:`, err)
      return null
    }
  }

  const handleGenerate = async () => {
    if (!canGenerate || !avatarImageRef || !productImageRef) return

    setIsGenerating(true)
    setResults([null, null, null, null])
    setSavedIdx(new Set())
    setProgress({ done: 0, total: 4 })

    try {
      // Resolve both references to public URLs that KIE backend can fetch
      const [avatarUrl, productUrl] = await Promise.all([
        toPublicUrl(avatarImageRef),
        toPublicUrl(productImageRef),
      ])
      if (!avatarUrl || !productUrl) {
        addToast('Không tải được ảnh tham chiếu — thử lại', 'error')
        setIsGenerating(false)
        return
      }

      // Fire all 4 in parallel
      const next: (string | null)[] = [null, null, null, null]
      await Promise.all(PRODUCT_SHOTS.map(async (recipe, i) => {
        const result = await genOneShot(recipe, avatarUrl, productUrl)
        next[i] = result
        setResults([...next])
        setProgress((p) => ({ ...p, done: p.done + 1 }))
      }))

      const ok = next.filter(Boolean).length
      if (ok === 0) addToast('Tạo ảnh thất bại — kiểm tra KIE credit', 'error')
      else addToast(`✓ Đã tạo ${ok}/4 ảnh`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegen = async (idx: number) => {
    if (!avatarImageRef || !productImageRef) return
    setRegenIdx(idx)
    try {
      const [avatarUrl, productUrl] = await Promise.all([
        toPublicUrl(avatarImageRef),
        toPublicUrl(productImageRef),
      ])
      if (!avatarUrl || !productUrl) {
        addToast('Không tải được ảnh tham chiếu', 'error')
        return
      }
      const newUrl = await genOneShot(PRODUCT_SHOTS[idx], avatarUrl, productUrl)
      if (newUrl) {
        setResults((prev) => { const next = [...prev]; next[idx] = newUrl; return next })
        setSavedIdx((prev) => { const next = new Set(prev); next.delete(idx); return next })
      } else {
        addToast(`Tạo lại ảnh #${idx + 1} thất bại`, 'error')
      }
    } finally {
      setRegenIdx(null)
    }
  }

  const handleSaveToProject = async (idx: number) => {
    const url = results[idx]
    if (!url) return
    try {
      await addBRoll({
        imageUrl: url,
        prompt: `Product AI — ${PRODUCT_SHOTS[idx].label}`,
        productId: selectedProduct?.id,
        modelId: selectedAvatar?.id,
      })
      setSavedIdx((prev) => new Set(prev).add(idx))
      addToast(`✓ Đã lưu ảnh #${idx + 1} vào Project → Product AI`)
    } catch (err) {
      addToast(`Lưu thất bại: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`, 'error')
    }
  }

  const handleSaveAll = async () => {
    const indices = results.map((u, i) => u && !savedIdx.has(i) ? i : -1).filter((i) => i >= 0)
    if (indices.length === 0) return
    for (const i of indices) await handleSaveToProject(i)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Product AI</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          Tạo 4 ảnh người mẫu cầm / dùng / review sản phẩm — tỉ lệ vuông 1:1 — để dùng cho website / landing page
        </p>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 lg:flex-row">
        {/* Left: input pickers + generate button */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
          <PickerTile
            label="Avatar AI"
            hint="Chọn avatar đã lưu hoặc tải ảnh lên"
            imageUrl={avatarImageRef}
            onSelectFromBank={() => setPickerMode('avatar')}
            onUpload={handleUploadAvatar}
            onClear={() => { setSelectedAvatar(null); setUploadedAvatarUrl(null) }}
          />
          <PickerTile
            label="Sản phẩm"
            hint="Chọn sản phẩm đã lưu hoặc tải ảnh sản phẩm lên"
            imageUrl={productImageRef}
            onSelectFromBank={() => setPickerMode('product')}
            onUpload={handleUploadProduct}
            onClear={() => { setSelectedProduct(null); setUploadedProductUrl(null) }}
          />

          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo {progress.done}/{progress.total}...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Tạo 4 ảnh (24 KIE credit)</>
            )}
          </button>

          {!kieApiKey && (
            <p className="text-center text-[10px] text-red-500">Cần KIE.ai API key trong Cài đặt</p>
          )}

          {/* Save all */}
          {results.some(Boolean) && !isGenerating && (
            <button
              onClick={handleSaveAll}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Save className="h-4 w-4" /> Lưu tất cả vào Project → Product AI
            </button>
          )}
        </div>

        {/* Right: 4-image grid */}
        <div className="flex-1">
          {results.every((r) => r === null) && !isGenerating ? (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-white">
              <div className="flex flex-col items-center gap-3 text-center">
                <Sparkles className="h-10 w-10 text-gray-200" />
                <p className="text-sm text-gray-400">Chọn Avatar + Sản phẩm rồi nhấn "Tạo 4 ảnh"</p>
                <p className="text-xs text-gray-300">4 góc khác nhau: cầm sản phẩm · chỉ vào · bàn nhiều SP · đang dùng</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.map((url, i) => (
                <ResultTile
                  key={i}
                  url={url}
                  label={PRODUCT_SHOTS[i].label}
                  isLoading={isGenerating ? url === null : regenIdx === i}
                  onRegen={() => handleRegen(i)}
                  onSave={() => handleSaveToProject(i)}
                  saved={savedIdx.has(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bank Pickers */}
      <BankPicker
        bankType="models"
        isOpen={pickerMode === 'avatar'}
        onSelect={handleSelectAvatar}
        onClose={() => setPickerMode(null)}
      />
      <BankPicker
        bankType="products"
        isOpen={pickerMode === 'product'}
        onSelect={handleSelectProduct}
        onClose={() => setPickerMode(null)}
      />
    </div>
  )
}
