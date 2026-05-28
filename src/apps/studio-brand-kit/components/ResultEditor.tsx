import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Edit3,
  Loader2,
  RefreshCw,
  Save,
  Upload,
  X,
} from 'lucide-react'
import { useDraftStore } from '../draftStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useAppStore } from '../../../stores/appStore'
import { useBrandKitStore } from '../../../stores/brandKitStore'
import {
  FONT_WHITELIST,
  VOICE_TONE_LABELS,
  type BrandKit,
  type VoiceTone,
  type WhitelistedFont,
} from '../../../types/brandKit'
import {
  generateLogoConcepts,
  renderBadgePng,
  rerollField,
  type RerollField,
} from '../service'
import { getUrl, saveAsset, saveBase64Asset } from '../../../utils/assetStore'

interface Props {
  onCancel: () => void
  onSaved: (kitId: string) => void
}

export default function ResultEditor({ onCancel, onSaved }: Props) {
  const draft = useDraftStore((s) => s.draft)
  const patchInferred = useDraftStore((s) => s.patchInferred)
  const setLogoConcepts = useDraftStore((s) => s.setLogoConcepts)
  const pickLogo = useDraftStore((s) => s.pickLogo)
  const setUploadedLogo = useDraftStore((s) => s.setUploadedLogo)
  const resetDraft = useDraftStore((s) => s.reset)

  const getGeminiApiKey = useSettingsStore((s) => s.getGeminiApiKey)
  const addToast = useAppStore((s) => s.addToast)
  const createKit = useBrandKitStore((s) => s.create)

  const [rerolling, setRerolling] = useState<RerollField | null>(null)
  const [regenLogos, setRegenLogos] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!draft.inferred) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FAFAFA] text-sm text-gray-500">
        Không có dữ liệu draft. Vui lòng quay lại bước trước.
      </div>
    )
  }

  const inferred = draft.inferred

  const handleReroll = async (field: RerollField) => {
    setRerolling(field)
    try {
      const apiKey = getGeminiApiKey()
      const updated = await rerollField({
        apiKey,
        brandName: draft.brandName,
        category: draft.category,
        market: draft.market,
        field,
        current: inferred,
      })
      patchInferred(updated)
      addToast(`Đã làm mới ${labelForField(field)}.`, 'success')
    } catch (e) {
      addToast(`Re-roll thất bại: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setRerolling(null)
    }
  }

  const handleRegenLogos = async () => {
    setRegenLogos(true)
    try {
      const apiKey = getGeminiApiKey()
      const concepts = await generateLogoConcepts({
        apiKey,
        brandName: draft.brandName,
        category: draft.category,
        palette: inferred.palette,
        conceptPrompts: inferred.logoConceptPrompts,
        count: 3,
      })
      setLogoConcepts(concepts)
      addToast('Đã tạo lại logo concepts.', 'success')
    } catch (e) {
      addToast(`Vẽ logo thất bại: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setRegenLogos(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    try {
      const assetId = await saveAsset(file, file.type || 'image/png')
      const blobUrl = (await getUrl(assetId)) ?? URL.createObjectURL(file)
      setUploadedLogo(assetId, blobUrl)
      addToast('Đã upload logo.', 'success')
    } catch (e) {
      addToast(`Upload thất bại: ${e instanceof Error ? e.message : String(e)}`, 'error')
    }
  }

  const chosenLogoAssetId =
    draft.uploadedLogoAssetId ?? draft.pickedLogoAssetId ?? null
  const chosenLogoBlobUrl =
    draft.uploadedLogoBlobUrl ?? draft.pickedLogoBlobUrl ?? null

  const canSave = !!chosenLogoAssetId && !!inferred.tagline && !saving

  const handleSave = async () => {
    if (!chosenLogoAssetId) {
      addToast('Vui lòng chọn hoặc upload logo trước khi lưu.', 'error')
      return
    }
    setSaving(true)
    try {
      // Render placeholder PNG badges for each AI-suggested name
      // so the contract's `assetId` field is satisfied.
      const badgeAssets = await Promise.all(
        inferred.badgeNames.map(async (name) => {
          try {
            const png = await renderBadgePng({
              label: name,
              primaryColor: inferred.palette.primary,
            })
            const assetId = await saveBase64Asset(png.base64, png.mimeType)
            return { name, assetId }
          } catch (err) {
            console.warn('[StudioBrandKit] badge render failed for', name, err)
            return null
          }
        }),
      )

      const payload: Omit<BrandKit, 'id' | 'createdAt' | 'updatedAt' | 'version'> = {
        name: draft.brandName,
        category: draft.category,
        isExistingBrand: draft.isExistingBrand,
        logoAssetId: chosenLogoAssetId,
        palette: inferred.palette,
        typography: {
          display: inferred.typography.display,
          body: inferred.typography.body,
        },
        badges: badgeAssets.filter((b): b is { name: string; assetId: string } => !!b),
        flagOrigin: inferred.flagOrigin || undefined,
        storeName: inferred.storeName,
        tagline: inferred.tagline,
        voice: {
          tone: inferred.voiceTone,
          vocabulary: {
            preferred: inferred.preferredVocabulary,
            banned: inferred.bannedVocabulary,
          },
          samplePhrases: inferred.samplePhrases,
        },
        cta: { preferred: inferred.ctaPhrases },
        markets: [draft.market],
        allowSecondaryLanguage: null,
      }

      const saved = await createKit(payload)
      addToast(`Đã lưu Brand Kit "${saved.name}".`, 'success')
      resetDraft()
      onSaved(saved.id)
    } catch (e) {
      addToast(`Lưu thất bại: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Header — pr-* reserves space for the Gemini/KIE credit badges
          mounted by App.tsx at top-right (z-50). */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-black/8 bg-white px-6 py-4 pr-[180px] md:pr-[260px]">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-black/5 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Brand Kit: {draft.brandName}
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              AI đã suy luận — bạn có thể re-roll hoặc edit từng field.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Lưu vào ngân hàng
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {/* Logo card — full-width on its own row */}
          <FieldCard
            title="Logo"
            spanFull
            actions={
              !draft.isExistingBrand && (
                <ActionButton
                  icon={<RefreshCw className={`h-3 w-3 ${regenLogos ? 'animate-spin' : ''}`} />}
                  label="Vẽ lại concepts"
                  onClick={handleRegenLogos}
                  disabled={regenLogos}
                />
              )
            }
          >
            <div className="space-y-3">
              {/* Concepts row */}
              {draft.logoConcepts.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {draft.logoConcepts.map((c) => {
                    const selected = draft.pickedLogoAssetId === c.assetId
                    return (
                      <button
                        key={c.assetId}
                        onClick={() => pickLogo(c.assetId, c.blobUrl)}
                        className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-white transition-all ${
                          selected
                            ? 'border-gray-900 shadow-md'
                            : 'border-black/10 hover:border-black/30'
                        }`}
                      >
                        <img
                          src={c.blobUrl}
                          alt="Logo concept"
                          className="h-full w-full object-contain"
                        />
                        {selected && (
                          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Upload zone */}
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleLogoUpload(f)
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-black/15 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-black/30 hover:bg-gray-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {draft.isExistingBrand ? 'Upload logo brand (PNG trong suốt)' : 'Hoặc upload logo riêng'}
                </button>
                {draft.uploadedLogoBlobUrl && (
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 overflow-hidden rounded border border-black/10 bg-white">
                      <img
                        src={draft.uploadedLogoBlobUrl}
                        alt="Logo uploaded"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      Đã upload
                    </span>
                  </div>
                )}
              </div>

              {/* Empty fallback */}
              {draft.logoConcepts.length === 0 && !draft.uploadedLogoBlobUrl && (
                <p className="text-xs text-gray-500">
                  Chưa có logo concept. Nhấn "Vẽ lại concepts" hoặc upload logo của bạn.
                </p>
              )}
            </div>
          </FieldCard>

          {/* Palette */}
          <FieldCard
            title="Bảng màu"
            actions={
              <RerollButton
                busy={rerolling === 'palette'}
                onClick={() => handleReroll('palette')}
              />
            }
          >
            <PaletteEditor
              palette={inferred.palette}
              onChange={(p) => patchInferred({ palette: p })}
            />
          </FieldCard>

          {/* Typography */}
          <FieldCard
            title="Typography"
            actions={
              <RerollButton
                busy={rerolling === 'typography'}
                onClick={() => handleReroll('typography')}
              />
            }
          >
            <TypographyEditor
              display={inferred.typography.display}
              body={inferred.typography.body}
              onChange={(t) => patchInferred({ typography: t })}
            />
          </FieldCard>

          {/* Voice tone */}
          <FieldCard
            title="Voice tone"
            actions={
              <RerollButton
                busy={rerolling === 'voiceTone'}
                onClick={() => handleReroll('voiceTone')}
              />
            }
          >
            <VoiceToneEditor
              tone={inferred.voiceTone}
              onChange={(voiceTone) => patchInferred({ voiceTone })}
            />
          </FieldCard>

          {/* Tagline */}
          <FieldCard
            title="Tagline"
            actions={
              <RerollButton
                busy={rerolling === 'tagline'}
                onClick={() => handleReroll('tagline')}
              />
            }
          >
            <InlineEditableText
              value={inferred.tagline}
              onChange={(tagline) => patchInferred({ tagline })}
              placeholder="Tagline ngắn gọn (≤ 8 từ)"
              maxLength={80}
            />
          </FieldCard>

          {/* Store name */}
          <FieldCard
            title="Tên cửa hàng"
            actions={
              <RerollButton
                busy={rerolling === 'storeName'}
                onClick={() => handleReroll('storeName')}
              />
            }
          >
            <InlineEditableText
              value={inferred.storeName}
              onChange={(storeName) => patchInferred({ storeName })}
              placeholder="VD: Brand Official Store"
              maxLength={80}
            />
          </FieldCard>

          {/* Sample phrases */}
          <FieldCard
            title="Câu thoại mẫu"
            actions={
              <RerollButton
                busy={rerolling === 'samplePhrases'}
                onClick={() => handleReroll('samplePhrases')}
              />
            }
          >
            <ListEditor
              items={inferred.samplePhrases}
              onChange={(samplePhrases) => patchInferred({ samplePhrases })}
              placeholder="Thêm câu thoại UGC"
              max={6}
            />
          </FieldCard>

          {/* CTA phrases */}
          <FieldCard
            title="Câu CTA"
            actions={
              <RerollButton
                busy={rerolling === 'ctaPhrases'}
                onClick={() => handleReroll('ctaPhrases')}
              />
            }
          >
            <ListEditor
              items={inferred.ctaPhrases}
              onChange={(ctaPhrases) => patchInferred({ ctaPhrases })}
              placeholder="Thêm câu CTA"
              max={6}
            />
          </FieldCard>

          {/* Trust badges */}
          <FieldCard
            title="Trust badges"
            actions={
              <RerollButton
                busy={rerolling === 'badgeNames'}
                onClick={() => handleReroll('badgeNames')}
              />
            }
          >
            <ListEditor
              items={inferred.badgeNames}
              onChange={(badgeNames) => patchInferred({ badgeNames })}
              placeholder="VD: Halal JAKIM, SIRIM"
              max={8}
              chipStyle
            />
          </FieldCard>

          {/* Vocabulary preferred */}
          <FieldCard title="Từ ưu tiên">
            <ListEditor
              items={inferred.preferredVocabulary}
              onChange={(preferredVocabulary) => patchInferred({ preferredVocabulary })}
              placeholder="VD: an toàn, dịu nhẹ"
              max={12}
              chipStyle
            />
          </FieldCard>

          {/* Vocabulary banned */}
          <FieldCard title="Từ tránh">
            <ListEditor
              items={inferred.bannedVocabulary}
              onChange={(bannedVocabulary) => patchInferred({ bannedVocabulary })}
              placeholder="VD: rẻ tiền, hàng nhái"
              max={8}
              chipStyle
            />
          </FieldCard>
        </div>
      </div>

      {/* Sticky logo preview if not picked yet */}
      {!chosenLogoBlobUrl && (
        <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-800">
          ⚠️ Bạn cần chọn 1 logo concept hoặc upload logo trước khi lưu.
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────

function FieldCard({
  title,
  actions,
  spanFull,
  children,
}: {
  title: string
  actions?: React.ReactNode
  spanFull?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-xl border border-black/8 bg-white p-4 shadow-sm ${
        spanFull ? 'lg:col-span-2 xl:col-span-3' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </div>
  )
}

function RerollButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title="Làm mới bằng AI"
      className="flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
    >
      <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />
      Re-roll
    </button>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  )
}

function PaletteEditor({
  palette,
  onChange,
}: {
  palette: { primary: string; secondary: string; cta: string; neutral: string }
  onChange: (p: typeof palette) => void
}) {
  const slots: Array<{ key: keyof typeof palette; label: string }> = [
    { key: 'primary',   label: 'Chính' },
    { key: 'secondary', label: 'Phụ' },
    { key: 'cta',       label: 'CTA' },
    { key: 'neutral',   label: 'Nền' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {slots.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center gap-1.5">
          <label className="relative block h-14 w-full cursor-pointer overflow-hidden rounded-lg border border-black/10 shadow-sm">
            <div
              className="h-full w-full"
              style={{ backgroundColor: palette[key] }}
            />
            <input
              type="color"
              value={palette[key]}
              onChange={(e) =>
                onChange({ ...palette, [key]: e.target.value.toUpperCase() })
              }
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <span className="text-[10px] font-semibold uppercase text-gray-500">
            {label}
          </span>
          <span className="font-mono text-[10px] text-gray-600">
            {palette[key]}
          </span>
        </div>
      ))}
    </div>
  )
}

function TypographyEditor({
  display,
  body,
  onChange,
}: {
  display: string
  body: string
  onChange: (t: { display: string; body: string }) => void
}) {
  return (
    <div className="space-y-3">
      <FontPicker
        label="Display"
        value={display}
        onChange={(v) => onChange({ display: v, body })}
      />
      <FontPicker
        label="Body"
        value={body}
        onChange={(v) => onChange({ display, body: v })}
      />
    </div>
  )
}

function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: WhitelistedFont) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-600">{label}</span>
        <span
          className="text-base text-gray-900"
          style={{ fontFamily: `"${value}", sans-serif` }}
        >
          Aa Bb
        </span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as WhitelistedFont)}
        className="w-full rounded-md border border-black/10 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-gray-900"
      >
        {FONT_WHITELIST.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </div>
  )
}

function VoiceToneEditor({
  tone,
  onChange,
}: {
  tone: VoiceTone
  onChange: (t: VoiceTone) => void
}) {
  const TONES: VoiceTone[] = ['formal', 'casual', 'playful', 'premium', 'clinical', 'gen-z']
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {TONES.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-all ${
            tone === t
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-black/10 bg-white text-gray-700 hover:border-black/30'
          }`}
        >
          {VOICE_TONE_LABELS[t]}
        </button>
      ))}
    </div>
  )
}

function InlineEditableText({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (!editing) {
    return (
      <div className="group flex items-start justify-between gap-2">
        <p className="flex-1 text-sm text-gray-800">{value || <span className="text-gray-400">{placeholder}</span>}</p>
        <button
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          title="Chỉnh sửa"
        >
          <Edit3 className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={2}
        className="flex-1 resize-none rounded-md border border-gray-900 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none"
        autoFocus
      />
      <div className="flex flex-col gap-1">
        <button
          onClick={() => {
            onChange(draft)
            setEditing(false)
          }}
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
          title="Lưu"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100"
          title="Hủy"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function ListEditor({
  items,
  onChange,
  placeholder,
  max,
  chipStyle,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
  max: number
  chipStyle?: boolean
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (!v || items.length >= max) return
    onChange([...items, v])
    setInput('')
  }

  const remove = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      {chipStyle ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="group flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700"
            >
              {item}
              <button
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {items.length === 0 && (
            <span className="text-xs italic text-gray-400">Chưa có mục</span>
          )}
        </div>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="group flex items-start gap-2 rounded-md bg-gray-50 px-2.5 py-1.5"
            >
              <span className="mt-0.5 text-[10px] font-bold text-gray-400">{i + 1}.</span>
              <span className="flex-1 text-xs text-gray-800">{item}</span>
              <button
                onClick={() => remove(i)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-xs italic text-gray-400">Chưa có mục</li>
          )}
        </ul>
      )}
      {items.length < max && (
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-black/10 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-gray-900"
          />
          <button
            onClick={add}
            disabled={!input.trim()}
            className="rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-black disabled:opacity-40"
          >
            Thêm
          </button>
        </div>
      )}
    </div>
  )
}

function labelForField(field: RerollField): string {
  const map: Record<RerollField, string> = {
    palette:       'bảng màu',
    typography:    'typography',
    voiceTone:     'voice tone',
    tagline:       'tagline',
    storeName:     'tên cửa hàng',
    samplePhrases: 'câu thoại mẫu',
    ctaPhrases:    'câu CTA',
    badgeNames:    'trust badges',
  }
  return map[field]
}
