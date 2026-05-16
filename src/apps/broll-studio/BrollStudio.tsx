// ── PRODUCT AI — Product Lifestyle Generator ─────────────────────────────────
// Generate 4 UGC-style lifestyle / e-commerce / advertorial photos (1:1 square)
// derived from a single base image so the 4 variants stay cohesive instead of
// looking like 4 random shoots. NOT a cinematic pipeline — purely meant for
// website / landing page / Shopee / TikTok product photography.
//
// Architecture:
//   PRODUCT LOCK   (highest priority — exact packaging/logo/label preserved)
//   AVATAR REF     (loose — same approximate person is enough)
//   SCENE PRESET   (user picks 1 of 10)
//   STYLE          (user picks 1 of 6 modifiers)
//   NEGATIVE       (explicit no-no list — no re-designed packaging, no random
//                   different person, no text overlays)
//
// Generation:
//   Image #1 (base)     — filesUrl: [product, avatar]
//   Image #2/3/4 (vars) — filesUrl: [product, avatar, base]  + variation hint
//
// Each image runs through Gemini Vision QC: pass/fail badge with similarity
// scores. Strict mode auto-regens once on QC fail.

import { useState, useRef } from 'react'
import { Sparkles, Loader2, RotateCcw, UserRound, Package, Upload, Check, Download, Save, ShieldCheck, Trash2, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { useBankStore } from '../../stores/bankStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { generateGpt4oImage } from '../../utils/kieai'
import { saveAsset, getUrl, isAssetRef } from '../../utils/assetStore'
import BankPicker from '../../components/BankPicker'
import type { Product, Model } from '../../stores/types'
import { qcProduct, type ProductQC } from './services/qcProduct'

// ── Scene presets ────────────────────────────────────────────────────────────

interface ScenePreset {
  id: string
  label: string
  hint: string                  // short tooltip-style description
  scenePrompt: string           // injected into the SCENE block
}

const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'hold-camera',
    label: 'Cầm sản phẩm',
    hint: 'Cầm SP trước camera',
    scenePrompt: 'The person holds the product at chest level with both hands, label fully facing the camera at eye level, gentle confident smile, looking directly at the lens. Neutral indoor background with soft daylight.',
  },
  {
    id: 'selfie',
    label: 'Selfie cùng SP',
    hint: 'Selfie style cầm SP',
    scenePrompt: 'Smartphone-selfie composition from slightly above, the person holds the product right next to their cheek with one hand, faint genuine smile, soft window light. The product label faces the camera and is clearly readable.',
  },
  {
    id: 'point-at',
    label: 'Chỉ vào SP',
    hint: 'Review style — chỉ vào nhãn',
    scenePrompt: 'The person holds the product in one hand and uses the index finger of the other to point at a specific feature on the label, looking down at it with a focused interested expression, as if explaining to a friend on camera. Soft natural daylight.',
  },
  {
    id: 'desk-flat',
    label: 'Review trên bàn',
    hint: 'Flat-lay trên bàn gỗ',
    scenePrompt: 'The product is placed on a clean wooden desk with the person\'s hands visible holding or arranging it. Three-quarter overhead angle, soft daylight, no shadow obscuring the label.',
  },
  {
    id: 'using',
    label: 'Đang dùng SP',
    hint: 'Mid-action sử dụng',
    scenePrompt: 'The person is actively using the product in a way appropriate to its category — opening a jar and dispensing onto a finger, taking a capsule from a bottle, squeezing a tube onto the back of the hand, or holding it near the face/skin. Genuine engaged expression looking at the product. Soft daylight in a real home setting.',
  },
  {
    id: 'multi',
    label: 'Bàn nhiều SP',
    hint: '3-5 SP trên bàn',
    scenePrompt: 'The person sits at a clean wooden or marble table with 3 to 5 IDENTICAL units of this exact product arranged in a tidy row in front of them. They lean slightly forward picking up one unit while smiling at the camera. Soft side window light.',
  },
  {
    id: 'before-after',
    label: 'Before / After',
    hint: 'Split frame trước/sau',
    scenePrompt: 'Split-frame 1:1 composition. Left half: the person before using the product, looking tired or dull. Right half: the same person after using the product, looking glowing and refreshed, holding the product. Identical framing on both halves, neutral backdrop.',
  },
  {
    id: 'kitchen',
    label: 'Lifestyle kitchen',
    hint: 'Bếp sáng / morning',
    scenePrompt: 'The product placed on a bright modern kitchen counter, morning sunlight through a window. The person is in the background slightly out of focus pouring coffee or preparing breakfast. The product label is sharp and clearly readable in the foreground.',
  },
  {
    id: 'bathroom',
    label: 'Bathroom routine',
    hint: 'Skincare routine vibe',
    scenePrompt: 'The product on a white marble bathroom counter with neatly folded towels. The person softly out of focus in the background looking into a mirror. Morning skincare routine vibe, warm soft light.',
  },
  {
    id: 'cafe',
    label: 'Cafe lifestyle',
    hint: 'Bàn cafe có cappuccino',
    scenePrompt: 'The person seated at a cafe table holding the product, a cappuccino and a laptop on the table, warm bokeh-free background, candid lifestyle moment, product label rotated toward the camera.',
  },
  {
    id: 'tiktok',
    label: 'UGC TikTok',
    hint: 'Phone selfie review',
    scenePrompt: 'Phone-camera-style review shot, the person holds the product up to the camera in a bedroom or vanity setup, ring-light reflection visible in their eyes, raw smartphone aesthetic, looks like a real TikTok review still frame.',
  },
]

// ── Style modifiers ──────────────────────────────────────────────────────────

interface StyleOption {
  id: string
  label: string
  swatch: string
  stylePrompt: string
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'realistic',
    label: 'Realistic',
    swatch: '#94a3b8',
    stylePrompt: 'Photorealistic, natural skin texture with pores and minor imperfections, real human, candid feel, no AI-rendered look, no plastic skin. Sharp focus across the entire frame, zero bokeh.',
  },
  {
    id: 'iphone',
    label: 'iPhone',
    swatch: '#60a5fa',
    stylePrompt: 'Authentic iPhone photo, slight digital grain, real consumer smartphone aesthetic, natural color science, unedited skin, no studio look.',
  },
  {
    id: 'ecommerce',
    label: 'Ecommerce',
    swatch: '#e2e8f0',
    stylePrompt: 'Clean e-commerce product photography, seamless near-white background, even studio softbox light, product hero centered, very sharp focus on the label, no harsh shadows.',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    swatch: '#d4b483',
    stylePrompt: 'High-end luxury beauty editorial, marble surface or muted neutrals, soft moody key light, premium magazine quality, refined and elegant.',
  },
  {
    id: 'beauty',
    label: 'Beauty',
    swatch: '#f9a8d4',
    stylePrompt: 'Beauty campaign aesthetic, glowing dewy skin, soft pink and peach color palette, dreamy diffuse light, subtle glow.',
  },
  {
    id: 'clinical',
    label: 'Clinical',
    swatch: '#67e8f9',
    stylePrompt: 'Clinical pharmaceutical aesthetic, cool white and pale blue tones, sterile uncluttered background, scientific authority feel, crisp and sharp.',
  },
]

// ── Variation hints ──────────────────────────────────────────────────────────
// Index 0 is the base (no extra hint). Variants 1-3 derive from the base.

interface VariationDef {
  label: string
  hint: string | null
}

const VARIATIONS: VariationDef[] = [
  { label: 'Base',  hint: null },
  { label: 'Var A', hint: 'Shift the camera angle by roughly 20 degrees, change the head tilt slightly and let the facial expression soften. Keep the product, person, outfit, and background identical to the previous shot.' },
  { label: 'Var B', hint: 'Crop tighter — closer to the subject and product, with a slightly different head tilt. Same outfit, same background, same product label orientation.' },
  { label: 'Var C', hint: 'Wider framing showing more of the surrounding scene. The person looks at the product instead of the camera. Same product, same outfit, same setting.' },
]

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(opts: {
  scene: ScenePreset
  style: StyleOption
  hasAvatar: boolean
  hasBaseRef: boolean
  variationHint: string | null
}): string {
  const { scene, style, hasAvatar, hasBaseRef, variationHint } = opts

  const refMap = hasBaseRef
    ? hasAvatar
      ? 'The FIRST reference image is the product. The SECOND reference image is the person (avatar). The THIRD reference image is the previously generated photo from this same shoot — use it as a cohesion anchor for outfit, background, and overall look.'
      : 'The FIRST reference image is the product. The SECOND reference image is the previously generated photo from this same shoot — use it as a cohesion anchor.'
    : hasAvatar
      ? 'The FIRST reference image is the product. The SECOND reference image is the person (avatar).'
      : 'The FIRST reference image is the product.'

  const productLock = `[PRODUCT LOCK — HIGHEST PRIORITY]
The product in the FIRST reference image must be reproduced EXACTLY:
- Same container shape (jar / bottle / tube / box / pouch as shown)
- Same colors on the packaging
- Same logo / brand mark — do not redraw
- Same label text, same typography, same wording — do not rewrite or invent text
- Same proportions and silhouette
This product MUST be recognizable as the SAME real-world item. Do NOT substitute a similar product, do NOT redesign the packaging, do NOT invent new label copy.`

  const avatarLock = hasAvatar
    ? `\n\n[AVATAR REFERENCE — RELAXED]
Generate a person who resembles the SECOND reference image:
- Same approximate age, gender, ethnicity, skin tone
- Similar hair / hijab color and overall hairstyle
- Similar body type
An approximate resemblance is enough — a perfect face match is NOT required, but do NOT generate an obviously different random person.`
    : ''

  const sceneBlock = `\n\n[SCENE]\n${scene.scenePrompt}`
  const styleBlock = `\n\n[STYLE]\n${style.stylePrompt}`

  const variationBlock = variationHint
    ? `\n\n[VARIATION]\n${variationHint}\nThe product must remain pixel-faithful to the FIRST reference. The person must remain the same individual as in the previous shot.`
    : ''

  const formatBlock = `\n\n[FORMAT]
1:1 square composition. The product label must be fully readable and unobstructed. Exactly one product instance unless the scene explicitly calls for multiple. ${hasAvatar ? 'Exactly one person.' : ''}`

  const negativeBlock = `\n\n[NEGATIVE — DO NOT]
- Do NOT modify the product packaging in any way.
- Do NOT invent new packaging, new label text, new colors, new logo.
- Do NOT add captions, callouts, price tags, sale badges, or any text overlay.
- Do NOT add watermarks or other brand logos.
- Do NOT duplicate the product unless the scene explicitly says multi-product.
${hasAvatar ? '- Do NOT generate a different random person — the person must resemble the avatar reference.\n' : ''}- No extra hands, no deformed fingers, no warped bottles, no melted labels, no garbled letters.`

  return `IMAGE-EDITING TASK: ${refMap}

${productLock}${avatarLock}${sceneBlock}${styleBlock}${variationBlock}${formatBlock}${negativeBlock}`
}

// ── Helper: take any URL (asset:// / blob: / data: / https:) and return one
//    KIE backend can actually fetch. ────────────────────────────────────────
async function toPublicUrl(ref: string): Promise<string | null> {
  if (!ref) return null
  if (isAssetRef(ref)) return await getUrl(ref)
  if (ref.startsWith('blob:') || ref.startsWith('data:')) {
    const r = await fetch(ref)
    if (!r.ok) return null
    const blob = await r.blob()
    const assetId = await saveAsset(blob, blob.type || 'image/jpeg')
    return await getUrl(assetId)
  }
  return ref
}

// ── State per result tile ───────────────────────────────────────────────────
//
// Each tile snapshots its scene / style / product / avatar at the moment of
// generation. Regenerate ALWAYS uses these locked values — never the current
// global selection — so changing the scene chip after generating does NOT
// secretly mutate the regen behaviour of existing tiles. This is the same
// design principle as identity-lock: the original generation params travel
// with the image card.

interface TileLock {
  sceneId: string
  styleId: string
  productUrl: string
  avatarUrl: string | null
}

interface TileState {
  url: string | null
  qc: ProductQC | null
  status: 'idle' | 'generating' | 'qc' | 'done' | 'error'
  error?: string
  /** Snapshot of generation params taken at generate-time. Regen reuses these. */
  lock?: TileLock
}

const EMPTY_TILES: TileState[] = VARIATIONS.map(() => ({ url: null, qc: null, status: 'idle' }))

// ── Result tile ─────────────────────────────────────────────────────────────
// Each tile manages its own lifecycle independently. One tile's failure must
// NEVER cascade into another tile's UI — that's why the parent uses
// Promise.allSettled and each generateTile call has internal try/catch.

interface ResultTileProps {
  state: TileState
  label: string
  /** Re-run generation for THIS tile only (same product / avatar / scene / style). */
  onRegen: () => void
  /** Clear this tile back to the empty placeholder. Does NOT affect other tiles. */
  onDelete: () => void
  /** Persist this tile's image into the Project bank. */
  onSave: () => void
  saved: boolean
  /** Whether this slot can be filled from the idle state (product is selected). */
  canGenerate: boolean
  /** Human-readable scene label resolved from the tile's lock (e.g. "Review trên bàn"). */
  lockedSceneLabel?: string
}

function ResultTile({ state, label, onRegen, onDelete, onSave, saved, canGenerate, lockedSceneLabel }: ResultTileProps) {
  const resolvedUrl = useAssetUrl(state.url ?? undefined)
  const displayUrl = state.url?.startsWith('http') || state.url?.startsWith('data:') ? state.url : resolvedUrl

  const handleDownload = () => {
    if (!displayUrl) return
    const a = document.createElement('a')
    a.href = displayUrl
    a.download = `product-ai-${label}-${Date.now()}.png`
    a.click()
  }

  // ── Border + background reflect status so failure is visually distinct ───
  const containerClass =
    state.status === 'error'
      ? 'border-red-300 bg-red-50/40'
      : state.status === 'done'
        ? 'border-black/10 bg-gray-100'
        : 'border-dashed border-black/10 bg-gradient-to-br from-gray-50 to-gray-100'

  return (
    <div className={`relative aspect-square overflow-hidden rounded-xl border ${containerClass}`}>
      {/* ── Variant + scene badges — always visible top-left ──────────── */}
      <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
            state.status === 'done' ? 'bg-black/60 text-white' : 'bg-white/80 text-gray-600'
          }`}
        >
          {label}
        </span>
        {lockedSceneLabel && state.status !== 'idle' && (
          <span
            className={`max-w-[160px] truncate rounded px-1.5 py-0.5 text-[9px] font-medium backdrop-blur-sm ${
              state.status === 'done' ? 'bg-violet-500/85 text-white' : 'bg-violet-100 text-violet-700'
            }`}
            title={`Scene đã lock: ${lockedSceneLabel}`}
          >
            🎬 {lockedSceneLabel}
          </span>
        )}
      </div>

      {/* ── IDLE STATE (initial placeholder OR after delete) ──────────── */}
      {state.status === 'idle' && (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <Sparkles className="h-6 w-6 text-gray-300" />
          <p className="text-[11px] text-gray-400">Chưa có ảnh</p>
          {canGenerate && (
            <button
              onClick={onRegen}
              className="rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700"
            >
              ▶ Tạo ảnh này
            </button>
          )}
        </div>
      )}

      {/* ── LOADING STATE (generating or running QC) ──────────────────── */}
      {(state.status === 'generating' || state.status === 'qc') && (
        <div className="relative flex h-full flex-col items-center justify-center gap-2">
          {/* Skeleton shimmer behind the spinner */}
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-violet-50 via-gray-100 to-violet-50" />
          <Loader2 className="relative h-7 w-7 animate-spin text-violet-500" />
          <span className="relative text-[11px] font-medium text-violet-700">
            {state.status === 'qc' ? 'Đang QC sản phẩm…' : 'Đang render…'}
          </span>
        </div>
      )}

      {/* ── ERROR STATE — gray placeholder + prominent retry ──────────── */}
      {state.status === 'error' && (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <AlertTriangle className="h-7 w-7 text-red-400" />
          <div>
            <p className="text-xs font-semibold text-red-700">Tạo ảnh thất bại</p>
            {state.error && (
              <p className="mt-0.5 line-clamp-3 text-[10px] text-red-500/80">
                {state.error.slice(0, 120)}
              </p>
            )}
          </div>
          <button
            onClick={onRegen}
            className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600"
          >
            <RotateCcw className="h-3 w-3" />
            Thử lại
          </button>
        </div>
      )}

      {/* ── DONE STATE — image + always-visible action buttons ────────── */}
      {state.status === 'done' && displayUrl && (
        <>
          <img src={displayUrl} alt={label} className="h-full w-full object-cover" />

          {/* QC badge — bottom-left so it never clashes with the top-right action bar */}
          {state.qc && (
            <span
              title={
                state.qc.issues.length > 0
                  ? state.qc.issues.join(' · ')
                  : `Label ${state.qc.labelSimilarity} · Logo ${state.qc.logoSimilarity} · Bottle ${state.qc.bottleSimilarity}`
              }
              className="absolute bottom-12 left-2 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm"
              style={{ background: state.qc.pass ? 'rgba(16,185,129,0.85)' : 'rgba(239,68,68,0.85)' }}
            >
              {state.qc.pass ? `✓ QC ${state.qc.overall}` : `✗ QC ${state.qc.overall}`}
            </span>
          )}

          {/* Always-visible top-right action bar */}
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            <button
              onClick={onRegen}
              title="Tạo lại ảnh này (giữ nguyên người + sản phẩm)"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white shadow-sm backdrop-blur-sm hover:bg-violet-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDownload}
              title="Tải ảnh xuống"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white shadow-sm backdrop-blur-sm hover:bg-black/80"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              title="Xoá ảnh này"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white shadow-sm backdrop-blur-sm hover:bg-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Bottom row: Save into Project */}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-2">
            <button
              onClick={onSave}
              title={saved ? 'Đã lưu vào Project' : 'Lưu vào Project → Product AI'}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold backdrop-blur-sm transition-colors ${
                saved ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white hover:bg-emerald-600'
              }`}
            >
              {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              {saved ? 'Đã lưu' : 'Lưu vào Project'}
            </button>
            {state.qc?.issues && state.qc.issues.length > 0 && !state.qc.pass && (
              <span className="ml-auto truncate text-[9px] text-rose-200" title={state.qc.issues.join(' · ')}>
                ⚠ {state.qc.issues[0]}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Picker tile ─────────────────────────────────────────────────────────────

function PickerTile({
  imageUrl, label, hint, accent, onSelectFromBank, onUpload, onClear,
}: {
  imageUrl: string | null
  label: string
  hint: string
  accent: 'product' | 'avatar'
  onSelectFromBank: () => void
  onUpload: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const resolvedUrl = useAssetUrl(imageUrl ?? undefined)
  const display = imageUrl?.startsWith('http') || imageUrl?.startsWith('data:') || imageUrl?.startsWith('blob:') ? imageUrl : resolvedUrl
  const isAvatar = accent === 'avatar'
  const accentBorder = accent === 'product' ? 'border-rose-200' : 'border-violet-200'
  const accentBg     = accent === 'product' ? 'bg-rose-50'      : 'bg-violet-50'
  const accentText   = accent === 'product' ? 'text-rose-700'   : 'text-violet-700'

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
          <img src={display} alt={label} className={`h-full w-full ${accent === 'product' ? 'object-contain p-2' : 'object-cover'}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            {isAvatar ? <UserRound className="h-10 w-10" strokeWidth={1.2} /> : <Package className="h-10 w-10" strokeWidth={1.2} />}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-400">{hint}</p>
      <div className="flex gap-2">
        <button
          onClick={onSelectFromBank}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border ${accentBorder} ${accentBg} px-3 py-2 text-xs font-semibold ${accentText} hover:opacity-80`}
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

// ── Main component ──────────────────────────────────────────────────────────

export default function ProductAI() {
  const [selectedAvatar, setSelectedAvatar] = useState<Model | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null)
  const [uploadedProductUrl, setUploadedProductUrl] = useState<string | null>(null)
  const [pickerMode, setPickerMode] = useState<'avatar' | 'product' | null>(null)

  const [sceneId, setSceneId] = useState<string>('hold-camera')
  const [styleId, setStyleId] = useState<string>('realistic')
  const [strictQC, setStrictQC] = useState(true)

  const [tiles, setTiles] = useState<TileState[]>(EMPTY_TILES)
  const [isBatch, setIsBatch] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set())

  const kieApiKey    = useSettingsStore((s) => s.kieApiKey)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast     = useAppStore((s) => s.addToast)
  const addBRoll     = useBankStore((s) => s.addBRoll)

  const avatarImageRef  = selectedAvatar?.characterImage  ?? uploadedAvatarUrl
  const productImageRef = selectedProduct?.productImage ?? uploadedProductUrl
  const canGenerate     = !!productImageRef && !!kieApiKey
  const canQC           = !!geminiApiKey

  const scene = SCENE_PRESETS.find((p) => p.id === sceneId) ?? SCENE_PRESETS[0]
  const style = STYLE_OPTIONS.find((s) => s.id === styleId) ?? STYLE_OPTIONS[0]

  const updateTile = (i: number, patch: Partial<TileState>) => {
    setTiles((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }

  // ── Single shot ───────────────────────────────────────────────────────────
  // Scene/style are passed explicitly (not read from outer closure) so callers
  // can lock them at generation time and reuse them on regen even if the user
  // has since changed the global selection.
  const genOneShot = async (args: {
    sceneId: string
    styleId: string
    productUrl: string
    avatarUrl: string | null
    baseUrl: string | null
    variationHint: string | null
  }): Promise<string | null> => {
    const scenePreset = SCENE_PRESETS.find((p) => p.id === args.sceneId) ?? SCENE_PRESETS[0]
    const styleOpt    = STYLE_OPTIONS.find((s) => s.id === args.styleId) ?? STYLE_OPTIONS[0]

    const prompt = buildPrompt({
      scene: scenePreset,
      style: styleOpt,
      hasAvatar: !!args.avatarUrl,
      hasBaseRef: !!args.baseUrl,
      variationHint: args.variationHint,
    })

    // Order matters — product FIRST (priority anchor), then avatar, then base
    const filesUrl = [args.productUrl]
    if (args.avatarUrl) filesUrl.push(args.avatarUrl)
    if (args.baseUrl)   filesUrl.push(args.baseUrl)

    const url = await generateGpt4oImage({
      apiKey: kieApiKey,
      prompt,
      filesUrl,
      size: '1:1',
      timeoutMs: 4 * 60 * 1000,
    })

    if (isAssetRef(url)) return url
    const r = await fetch(url)
    const b = await r.blob()
    return await saveAsset(b, b.type || 'image/png')
  }

  // ── QC + optional auto-regen ──────────────────────────────────────────────
  const runQC = async (idx: number, productUrl: string, generatedAssetUrl: string): Promise<ProductQC | null> => {
    if (!canQC) return null
    updateTile(idx, { status: 'qc' })
    try {
      const generatedPublic = await toPublicUrl(generatedAssetUrl)
      if (!generatedPublic) return null
      return await qcProduct({
        apiKey: geminiApiKey,
        productUrl,
        generatedUrl: generatedPublic,
      })
    } catch (err) {
      console.error('[ProductAI] QC failed:', err)
      return null
    }
  }

  // ── Generate one tile (handles strict-mode retry) ─────────────────────────
  // `lock` is the snapshot we persist into TileState.lock — it lets regen
  // reuse exactly the same scene / style / product / avatar later.
  const generateTile = async (idx: number, args: {
    lock: TileLock
    baseUrl: string | null
    variationHint: string | null
  }): Promise<string | null> => {
    // Snapshot the lock into the tile state IMMEDIATELY so even a failed gen
    // leaves enough metadata to regen with the right scene later.
    updateTile(idx, {
      status: 'generating',
      error: undefined,
      qc: null,
      url: null,
      lock: args.lock,
    })

    const shotArgs = {
      sceneId: args.lock.sceneId,
      styleId: args.lock.styleId,
      productUrl: args.lock.productUrl,
      avatarUrl: args.lock.avatarUrl,
      baseUrl: args.baseUrl,
      variationHint: args.variationHint,
    }

    console.log('[ProductAI] generateTile', { idx, ...args.lock, variation: VARIATIONS[idx].label })

    try {
      const url = await genOneShot(shotArgs)
      if (!url) {
        updateTile(idx, { status: 'error', error: 'Không trả về ảnh' })
        return null
      }
      updateTile(idx, { url })
      const qc = await runQC(idx, args.lock.productUrl, url)
      updateTile(idx, { qc, status: 'done' })

      // Strict mode: one auto-retry only for the BASE tile.
      if (strictQC && qc && !qc.pass && idx === 0) {
        updateTile(idx, { status: 'generating', error: undefined })
        const retry = await genOneShot({
          ...shotArgs,
          variationHint: 'The product label and packaging must be preserved with pixel-level fidelity. Triple-check that every letter of the label text is correct and that the bottle shape exactly matches the reference.',
        })
        if (retry) {
          updateTile(idx, { url: retry })
          const qc2 = await runQC(idx, args.lock.productUrl, retry)
          updateTile(idx, { qc: qc2, status: 'done' })
          return retry
        }
      }

      return url
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error(`[ProductAI] tile ${idx} failed:`, err)
      updateTile(idx, { status: 'error', error: msg })
      return null
    }
  }

  // ── Main flow: base → 3 derived variations ────────────────────────────────
  const handleGenerate = async () => {
    if (!canGenerate || !productImageRef) return
    setIsBatch(true)
    setTiles(EMPTY_TILES)
    setSavedIdx(new Set())
    setProgress({ done: 0, total: 4 })

    try {
      const [avatarUrl, productUrl] = await Promise.all([
        avatarImageRef ? toPublicUrl(avatarImageRef) : Promise.resolve(null),
        toPublicUrl(productImageRef),
      ])
      if (!productUrl) {
        addToast('Không tải được ảnh sản phẩm — thử lại', 'error')
        setIsBatch(false)
        return
      }

      // Snapshot the CURRENT global scene/style/refs into a single lock object.
      // Every tile generated in this batch keeps a copy. Subsequent regen
      // calls read from each tile's own lock so they don't drift if the user
      // changes the global selection afterwards.
      const batchLock: TileLock = {
        sceneId,
        styleId,
        productUrl,
        avatarUrl,
      }
      console.log('[ProductAI] handleGenerate batch lock', batchLock)

      // 1. Base shot
      const baseAssetUrl = await generateTile(0, {
        lock: batchLock,
        baseUrl: null,
        variationHint: VARIATIONS[0].hint,
      })
      setProgress((p) => ({ ...p, done: p.done + 1 }))

      if (!baseAssetUrl) {
        addToast('Tạo ảnh gốc thất bại — không thể derive variations', 'error')
        setIsBatch(false)
        return
      }

      // 2. Resolve base to a public URL so KIE can fetch it as the 3rd ref
      const basePublicUrl = await toPublicUrl(baseAssetUrl)
      if (!basePublicUrl) {
        addToast('Không upload được ảnh gốc cho variations', 'error')
        setIsBatch(false)
        return
      }

      // 3. Three variations in parallel — Promise.allSettled so one slot's
      //    failure can never break the others. All four tiles share the same
      //    batchLock (same scene / style / product / avatar).
      const variationResults = await Promise.allSettled(
        [1, 2, 3].map(async (i) => {
          const url = await generateTile(i, {
            lock: batchLock,
            baseUrl: basePublicUrl,
            variationHint: VARIATIONS[i].hint,
          })
          setProgress((p) => ({ ...p, done: p.done + 1 }))
          return url
        }),
      )

      // Count successes from the actual generateTile return values — the tiles
      // state at this point is stale because React batches updates.
      const variationOk = variationResults.filter(
        (r) => r.status === 'fulfilled' && r.value !== null,
      ).length
      const ok = (baseAssetUrl ? 1 : 0) + variationOk

      if (ok === 0) addToast('Tạo ảnh thất bại — kiểm tra KIE credit', 'error')
      else if (ok < 4) addToast(`Đã tạo ${ok}/4 ảnh — slot lỗi có nút "Thử lại" trên ảnh`)
      else addToast('✓ Đã tạo 4/4 ảnh')
    } finally {
      setIsBatch(false)
    }
  }

  // ── Manual regen for a single tile ─────────────────────────────────────────
  // Regen ALWAYS uses the tile's locked snapshot (scene + style + refs taken
  // at original generation time). The current global scene/style selection
  // is intentionally ignored — changing the chip after generating must not
  // silently mutate what regen produces. To switch scenes, the user re-runs
  // the full "Tạo 4 ảnh" batch.
  //
  // For a tile that has never been generated (idle slot after delete), there
  // is no lock yet, so we fall back to the current global selection — that's
  // the "▶ Tạo ảnh này" first-fill case.
  const handleRegen = async (idx: number) => {
    const tile = tiles[idx]
    let lock = tile.lock

    if (!lock) {
      // First-fill (idle slot) — capture current global selection as the lock.
      if (!productImageRef || !canGenerate) return
      const [avatarUrl, productUrl] = await Promise.all([
        avatarImageRef ? toPublicUrl(avatarImageRef) : Promise.resolve(null),
        toPublicUrl(productImageRef),
      ])
      if (!productUrl) {
        addToast('Không tải được ảnh sản phẩm', 'error')
        return
      }
      lock = { sceneId, styleId, productUrl, avatarUrl }
    }

    console.log('[ProductAI] handleRegen', {
      idx,
      variation: VARIATIONS[idx].label,
      tileLock: lock,
      currentGlobal: { sceneId, styleId },
      preservingScene: lock.sceneId,
    })

    if (idx === 0) {
      // Regenerating the base — variations still reference the OLD base URL
      // via their own filesUrl ref (we don't cascade). User can manually
      // regen variations after if they want to re-bind to the new base.
      await generateTile(0, {
        lock,
        baseUrl: null,
        variationHint: VARIATIONS[0].hint,
      })
    } else {
      const baseAssetUrl = tiles[0]?.url
      const basePublicUrl = baseAssetUrl ? await toPublicUrl(baseAssetUrl) : null
      await generateTile(idx, {
        lock,
        baseUrl: basePublicUrl,
        variationHint: VARIATIONS[idx].hint,
      })
    }
    setSavedIdx((prev) => { const next = new Set(prev); next.delete(idx); return next })
  }

  // ── Delete a single tile — clears it back to idle so the user can decide
  //    whether to re-fill the slot. Does NOT touch the other tiles. ────────
  const handleDelete = (idx: number) => {
    updateTile(idx, { url: null, qc: null, status: 'idle', error: undefined })
    setSavedIdx((prev) => { const next = new Set(prev); next.delete(idx); return next })
  }

  // ── File handlers ──────────────────────────────────────────────────────────
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
    setUploadedAvatarUrl(URL.createObjectURL(file))
    setSelectedAvatar(null)
  }
  const handleUploadProduct = (file: File) => {
    setUploadedProductUrl(URL.createObjectURL(file))
    setSelectedProduct(null)
  }

  // ── Save handlers ──────────────────────────────────────────────────────────
  const handleSaveToProject = async (idx: number) => {
    const tile = tiles[idx]
    if (!tile.url) return
    // Resolve labels from the tile's OWN lock so the saved note reflects what
    // was actually used to generate this image — not whatever chip the user
    // has selected now.
    const lockedScene = tile.lock
      ? SCENE_PRESETS.find((p) => p.id === tile.lock!.sceneId) ?? scene
      : scene
    const lockedStyle = tile.lock
      ? STYLE_OPTIONS.find((s) => s.id === tile.lock!.styleId) ?? style
      : style
    try {
      await addBRoll({
        imageUrl: tile.url,
        prompt: `Product AI — ${lockedScene.label} / ${lockedStyle.label}${VARIATIONS[idx].hint ? ` / ${VARIATIONS[idx].label}` : ''}`,
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
    const indices = tiles.map((t, i) => t.url && !savedIdx.has(i) ? i : -1).filter((i) => i >= 0)
    for (const i of indices) await handleSaveToProject(i)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Product AI</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          Tạo 4 ảnh lifestyle vuông 1:1 cho website / landing / advertorial / Shopee / TikTok — không phải cinematic video pipeline.
        </p>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 lg:flex-row">
        {/* Left: inputs */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
          <PickerTile
            label="Sản phẩm (bắt buộc)"
            hint="Ảnh sản phẩm rõ packaging / logo / label"
            accent="product"
            imageUrl={productImageRef}
            onSelectFromBank={() => setPickerMode('product')}
            onUpload={handleUploadProduct}
            onClear={() => { setSelectedProduct(null); setUploadedProductUrl(null) }}
          />
          <PickerTile
            label="Avatar AI (tuỳ chọn)"
            hint="Có thể bỏ trống — không cần người"
            accent="avatar"
            imageUrl={avatarImageRef}
            onSelectFromBank={() => setPickerMode('avatar')}
            onUpload={handleUploadAvatar}
            onClear={() => { setSelectedAvatar(null); setUploadedAvatarUrl(null) }}
          />

          {/* Scene presets */}
          <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">Scene</p>
            <div className="grid grid-cols-2 gap-1.5">
              {SCENE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSceneId(p.id)}
                  title={p.hint}
                  className={`rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors ${sceneId === p.id ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-black/10 bg-white text-gray-700 hover:bg-black/[0.03]'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style chips */}
          <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">Style</p>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${styleId === s.id ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-black/10 bg-white text-gray-700 hover:bg-black/[0.03]'}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: s.swatch }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strict QC */}
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs text-gray-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Strict QC <span className="text-[10px] text-gray-400">(tự retry nếu product sai)</span>
            </span>
            <input
              type="checkbox"
              checked={strictQC}
              onChange={(e) => setStrictQC(e.target.checked)}
              className="accent-violet-600"
              disabled={!canQC}
            />
          </label>
          {!canQC && (
            <p className="text-[10px] text-amber-600">QC cần Gemini API key — thêm trong Cài đặt</p>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isBatch}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isBatch ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo {progress.done}/{progress.total}…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Tạo 4 ảnh (24 KIE credit)</>
            )}
          </button>

          {!kieApiKey && (
            <p className="text-center text-[10px] text-red-500">Cần KIE.ai API key trong Cài đặt</p>
          )}

          {/* Save all */}
          {tiles.some((t) => t.url) && !isBatch && (
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
          {tiles.every((t) => t.status === 'idle') ? (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-white">
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <Sparkles className="h-10 w-10 text-gray-200" />
                <p className="text-sm text-gray-400">Chọn Sản phẩm + Scene + Style rồi nhấn "Tạo 4 ảnh"</p>
                <p className="text-xs text-gray-300">1 ảnh gốc + 3 variations derived from base — sản phẩm được lock pixel-faithful</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tiles.map((t, i) => {
                const lockedScene = t.lock ? SCENE_PRESETS.find((p) => p.id === t.lock!.sceneId) : undefined
                return (
                  <ResultTile
                    key={i}
                    state={t}
                    label={VARIATIONS[i].label}
                    onRegen={() => handleRegen(i)}
                    onDelete={() => handleDelete(i)}
                    onSave={() => handleSaveToProject(i)}
                    saved={savedIdx.has(i)}
                    canGenerate={canGenerate}
                    lockedSceneLabel={lockedScene?.label}
                  />
                )
              })}
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
