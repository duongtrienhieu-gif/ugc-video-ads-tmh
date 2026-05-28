import { useEffect, useState } from 'react'
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import {
  BRAND_CATEGORY_LABELS,
  MARKET_LABELS,
  VOICE_TONE_LABELS,
  type BrandKit,
} from '../../../types/brandKit'
import { isBrandKitReady } from '../../../stores/brandKitStore'
import { getUrl } from '../../../utils/assetStore'

interface Props {
  kit: BrandKit
  onBack: () => void
}

export default function KitDetail({ kit, onBack }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [badgeUrls, setBadgeUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const url = await getUrl(kit.logoAssetId)
      if (!cancelled) setLogoUrl(url)
      const entries = await Promise.all(
        kit.badges.map(async (b) => [b.assetId, (await getUrl(b.assetId)) ?? ''] as const),
      )
      if (!cancelled) setBadgeUrls(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [kit.id, kit.logoAssetId, kit.badges])

  const validity = isBrandKitReady(kit)

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      <div className="flex shrink-0 items-center gap-3 border-b border-black/8 bg-white px-6 py-4">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-black/5"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-gray-900">
            {kit.name}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {BRAND_CATEGORY_LABELS[kit.category]} ·{' '}
            {kit.markets.map((m) => MARKET_LABELS[m]).join(', ')}
          </p>
        </div>
        {validity.ready ? (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Sẵn sàng cho TikTok Shop
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <AlertCircle className="h-3 w-3" />
            Thiếu: {validity.missing.join(', ')}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-5xl space-y-4">
          {/* Hero — palette + logo */}
          <div
            className="overflow-hidden rounded-xl shadow-md"
            style={{
              background: `linear-gradient(135deg, ${kit.palette.primary} 0%, ${kit.palette.secondary} 100%)`,
            }}
          >
            <div className="grid gap-6 p-8 md:grid-cols-[200px_1fr] md:items-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-white/95 p-4 shadow-lg">
                {logoUrl ? (
                  <img src={logoUrl} alt={kit.name} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-xs text-gray-400">Đang tải logo…</div>
                )}
              </div>
              <div>
                <p
                  className="text-3xl font-bold tracking-tight"
                  style={{
                    color: kit.palette.neutral ?? '#FFFFFF',
                    fontFamily: `"${kit.typography.display}", sans-serif`,
                  }}
                >
                  {kit.name}
                </p>
                {kit.tagline && (
                  <p
                    className="mt-2 text-base italic"
                    style={{
                      color: kit.palette.neutral ?? '#FFFFFF',
                      opacity: 0.9,
                      fontFamily: `"${kit.typography.body}", sans-serif`,
                    }}
                  >
                    "{kit.tagline}"
                  </p>
                )}
                <p
                  className="mt-3 text-xs"
                  style={{ color: kit.palette.neutral ?? '#FFFFFF', opacity: 0.75 }}
                >
                  {kit.storeName}
                </p>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Bảng màu">
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(kit.palette).map(([k, v]) => (
                  <div key={k} className="flex flex-col items-center gap-1">
                    <div
                      className="h-14 w-full rounded-md border border-black/10 shadow-sm"
                      style={{ backgroundColor: v }}
                    />
                    <span className="text-[10px] font-semibold uppercase text-gray-500">{k}</span>
                    <span className="font-mono text-[10px] text-gray-600">{v}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Typography">
              <div className="space-y-2">
                <Row label="Display">
                  <span style={{ fontFamily: `"${kit.typography.display}", sans-serif` }}>
                    {kit.typography.display}
                  </span>
                </Row>
                <Row label="Body">
                  <span style={{ fontFamily: `"${kit.typography.body}", sans-serif` }}>
                    {kit.typography.body}
                  </span>
                </Row>
              </div>
            </Card>

            <Card title="Voice tone">
              <p className="text-sm text-gray-800">
                {kit.voice.tone ? VOICE_TONE_LABELS[kit.voice.tone] : '—'}
              </p>
            </Card>

            <Card title="Country of Origin">
              <p className="text-sm text-gray-800">
                {kit.flagOrigin || <span className="text-gray-400">Chưa xác định</span>}
              </p>
            </Card>

            <Card title="Câu thoại mẫu">
              <ul className="space-y-1.5">
                {(kit.voice.samplePhrases ?? []).map((p, i) => (
                  <li key={i} className="rounded bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800">
                    {p}
                  </li>
                ))}
                {(kit.voice.samplePhrases ?? []).length === 0 && (
                  <li className="text-xs italic text-gray-400">Chưa có</li>
                )}
              </ul>
            </Card>

            <Card title="Câu CTA">
              <ul className="space-y-1.5">
                {(kit.cta?.preferred ?? []).map((p, i) => (
                  <li key={i} className="rounded bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800">
                    {p}
                  </li>
                ))}
                {(kit.cta?.preferred ?? []).length === 0 && (
                  <li className="text-xs italic text-gray-400">Chưa có</li>
                )}
              </ul>
            </Card>

            <Card title="Trust badges" spanFull>
              <div className="flex flex-wrap items-center gap-2">
                {kit.badges.map((b) => (
                  <div
                    key={b.assetId}
                    className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5"
                  >
                    {badgeUrls[b.assetId] && (
                      <img
                        src={badgeUrls[b.assetId]}
                        alt={b.name}
                        className="h-5 object-contain"
                      />
                    )}
                    <span className="text-xs font-semibold text-gray-700">{b.name}</span>
                  </div>
                ))}
                {kit.badges.length === 0 && (
                  <span className="text-xs italic text-gray-400">Chưa có badge</span>
                )}
              </div>
            </Card>

            <Card title="Từ ưu tiên">
              <Chips items={kit.voice.vocabulary?.preferred ?? []} tone="positive" />
            </Card>

            <Card title="Từ tránh">
              <Chips items={kit.voice.vocabulary?.banned ?? []} tone="negative" />
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({
  title,
  spanFull,
  children,
}: {
  title: string
  spanFull?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border border-black/8 bg-white p-4 shadow-sm ${spanFull ? 'md:col-span-2' : ''}`}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-2.5 py-1.5">
      <span className="text-[11px] font-semibold uppercase text-gray-500">{label}</span>
      <span className="text-sm text-gray-800">{children}</span>
    </div>
  )
}

function Chips({ items, tone }: { items: string[]; tone: 'positive' | 'negative' }) {
  if (items.length === 0) return <span className="text-xs italic text-gray-400">Chưa có</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span
          key={i}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            tone === 'positive'
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
        >
          {i}
        </span>
      ))}
    </div>
  )
}
