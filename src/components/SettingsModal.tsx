import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Key, Check, HardDrive, RefreshCw, ChevronDown, ExternalLink, Sun, Moon } from 'lucide-react'
import { useSettingsStore, flushPendingCloudPush } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'
import { useBankStore } from '../stores/bankStore'
import { getAllAssetIds, deleteAsset, isAssetRef } from '../utils/assetStore'
import { getKieCredits } from '../utils/kieai'
import { directGeminiVision } from '../utils/gemini'
import { getSubscription } from '../utils/elevenlabs'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionId = 'kie' | 'gemini' | 'eleven' | 'fal' | 'shotstack'

interface ServiceConfig {
  id: SectionId
  label: string
  sublabel: string
  color: string        // dot + accent color class
  borderColor: string
  bgColor: string
  keyHint: string
  placeholder: string
  getKeyUrl: string
  getKeyLabel: string
}

const SERVICES: ServiceConfig[] = [
  {
    id: 'kie',
    label: 'KIE.AI',
    sublabel: 'Tạo ảnh · Video · Kịch bản',
    color: 'indigo',
    borderColor: 'border-indigo-200',
    bgColor: 'bg-indigo-50',
    keyHint: 'Định dạng: SK-...',
    placeholder: 'SK-...',
    getKeyUrl: 'https://kie.ai',
    getKeyLabel: 'Lấy key →',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    sublabel: 'Phân tích QC · Image DNA · Kịch bản AI',
    color: 'emerald',
    borderColor: 'border-emerald-200',
    bgColor: 'bg-emerald-50',
    keyHint: 'Miễn phí · Dùng để phân tích ảnh và tạo kịch bản',
    placeholder: 'AIza...',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    getKeyLabel: 'Lấy key miễn phí →',
  },
  {
    id: 'eleven',
    label: 'ElevenLabs',
    sublabel: 'Giọng đọc · Voice Cloning · Dịch video',
    color: 'violet',
    borderColor: 'border-violet-200',
    bgColor: 'bg-violet-50',
    keyHint: 'Hỗ trợ clone giọng · model eleven_multilingual_v2',
    placeholder: 'sk_...',
    getKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    getKeyLabel: 'Lấy key →',
  },
  {
    id: 'fal',
    label: 'fal.ai',
    sublabel: 'Lip-sync video · Xóa nền · Auto captions',
    color: 'pink',
    borderColor: 'border-pink-200',
    bgColor: 'bg-pink-50',
    keyHint: '~$0.005/s · Video-to-video lip-sync giữ nguyên cảnh gốc',
    placeholder: 'fal-...',
    getKeyUrl: 'https://fal.ai/dashboard/keys',
    getKeyLabel: 'Lấy key →',
  },
  {
    id: 'shotstack',
    label: 'Shotstack',
    sublabel: 'Ghép video · Overlay avatar · Auto assembly',
    color: 'orange',
    borderColor: 'border-orange-200',
    bgColor: 'bg-orange-50',
    keyHint: '$29/mo · 200 renders · Dùng cho UGC Video Builder',
    placeholder: 'your_api_key...',
    getKeyUrl: 'https://dashboard.shotstack.io/register',
    getKeyLabel: 'Đăng ký →',
  },
]

// ── Color maps ─────────────────────────────────────────────────────────────────

const DOT_COLOR: Record<string, string> = {
  indigo:  'bg-indigo-400',
  emerald: 'bg-emerald-400',
  violet:  'bg-violet-400',
  pink:    'bg-pink-400',
  orange:  'bg-orange-400',
  sky:     'bg-sky-400',
}
const TEXT_COLOR: Record<string, string> = {
  indigo:  'text-indigo-600',
  emerald: 'text-emerald-600',
  violet:  'text-violet-600',
  pink:    'text-pink-600',
  orange:  'text-orange-600',
  sky:     'text-sky-600',
}
const FOCUS_BORDER: Record<string, string> = {
  indigo:  'focus:border-indigo-300',
  emerald: 'focus:border-emerald-300',
  violet:  'focus:border-violet-300',
  pink:    'focus:border-pink-300',
  orange:  'focus:border-orange-300',
  sky:     'focus:border-sky-300',
}
const BTN_CLASS: Record<string, string> = {
  indigo:  'border-indigo-200 text-indigo-700 hover:bg-indigo-50',
  emerald: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  violet:  'border-violet-200 text-violet-700 hover:bg-violet-50',
  pink:    'border-pink-200 text-pink-700 hover:bg-pink-50',
  orange:  'border-orange-200 text-orange-700 hover:bg-orange-50',
  sky:     'border-sky-200 text-sky-700 hover:bg-sky-50',
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const {
    kieApiKey, geminiApiKey, elevenLabsApiKey, falApiKey, shotstackApiKey,
    kieCredits, theme,
    setKieApiKey, setGeminiApiKey, setElevenLabsApiKey, setFalApiKey, setShotstackApiKey,
    setKieCredits, setTheme,
  } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)

  // Draft values
  const [drafts, setDrafts] = useState({
    kie: kieApiKey,
    gemini: geminiApiKey,
    eleven: elevenLabsApiKey,
    fal: falApiKey,
    shotstack: shotstackApiKey,
  })
  const [shows, setShows] = useState<Record<SectionId, boolean>>({
    kie: false, gemini: false, eleven: false, fal: false, shotstack: false,
  })
  const [openSection, setOpenSection] = useState<SectionId | null>(null)
  const [saved, setSaved] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  // Test states per service
  const [testing, setTesting] = useState<Partial<Record<SectionId, boolean>>>({})
  const [testResults, setTestResults] = useState<Partial<Record<SectionId, { ok: boolean; message: string }>>>({})

  useEffect(() => {
    if (open) {
      setDrafts({ kie: kieApiKey, gemini: geminiApiKey, eleven: elevenLabsApiKey, fal: falApiKey, shotstack: shotstackApiKey })
      setSaved(false)
      setTestResults({})
      setOpenSection(null)
    }
  }, [open, kieApiKey, geminiApiKey, elevenLabsApiKey, falApiKey, shotstackApiKey])

  if (!open) return null

  const setDraft = (id: SectionId, val: string) => {
    setDrafts((d) => ({ ...d, [id]: val }))
    setTestResults((r) => ({ ...r, [id]: undefined }))
  }
  const toggleShow = (id: SectionId) => setShows((s) => ({ ...s, [id]: !s[id] }))
  const toggleSection = (id: SectionId) => setOpenSection((cur) => cur === id ? null : id)

  const isSaved = (id: SectionId): boolean => {
    const map: Record<SectionId, string> = {
      kie: kieApiKey, gemini: geminiApiKey, eleven: elevenLabsApiKey,
      fal: falApiKey, shotstack: shotstackApiKey,
    }
    return map[id].length > 0
  }

  // ── Test handlers ────────────────────────────────────────────────────────────

  async function handleTest(id: SectionId) {
    const key = drafts[id].trim()
    if (!key) { addToast('Vui lòng nhập API key trước', 'error'); return }
    setTesting((t) => ({ ...t, [id]: true }))
    setTestResults((r) => ({ ...r, [id]: undefined }))

    try {
      if (id === 'kie') {
        const credits = await getKieCredits(key)
        setKieCredits(credits)
        setTestResults((r) => ({ ...r, kie: { ok: true, message: `Kết nối thành công — còn ${credits.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Credit` } }))
      } else if (id === 'gemini') {
        await directGeminiVision({ apiKey: key, parts: [{ text: 'Reply with the single word: ok' }] })
        setTestResults((r) => ({ ...r, gemini: { ok: true, message: 'Kết nối thành công — API key hợp lệ' } }))
      } else if (id === 'eleven') {
        const sub = await getSubscription(key)
        setTestResults((r) => ({ ...r, eleven: { ok: true, message: `Gói ${sub.tier} — còn ${sub.remaining?.toLocaleString('vi-VN')} ký tự` } }))
      } else if (id === 'fal') {
        const res = await fetch('https://rest.alpha.fal.ai/tokens/', {
          method: 'POST',
          headers: { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowed_apps: ['fal-ai/latentsync'], expire_at: null }),
        })
        if (res.status === 401 || res.status === 403) {
          setTestResults((r) => ({ ...r, fal: { ok: false, message: 'API key không hợp lệ hoặc không có quyền truy cập' } }))
        } else {
          setTestResults((r) => ({ ...r, fal: { ok: true, message: 'Kết nối thành công — API key hợp lệ' } }))
        }
      } else if (id === 'shotstack') {
        const res = await fetch('https://api.shotstack.io/edit/v1/render?limit=1', {
          headers: { 'x-api-key': key },
        })
        if (res.status === 401 || res.status === 403) {
          setTestResults((r) => ({ ...r, shotstack: { ok: false, message: 'API key không hợp lệ' } }))
        } else {
          setTestResults((r) => ({ ...r, shotstack: { ok: true, message: 'Kết nối thành công — Shotstack sẵn sàng' } }))
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kết nối thất bại'
      setTestResults((r) => ({ ...r, [id]: { ok: false, message: msg } }))
    } finally {
      setTesting((t) => ({ ...t, [id]: false }))
    }
  }

  async function handleSave() {
    setKieApiKey(drafts.kie.trim())
    setGeminiApiKey(drafts.gemini.trim())
    setElevenLabsApiKey(drafts.eleven.trim())
    setFalApiKey(drafts.fal.trim())
    setShotstackApiKey(drafts.shotstack.trim())

    // RACE FIX (2026-05-20): setters schedule a 1.5s debounced cloud
    // push. If the user clicked Lưu then F5'd within 1.5s, the new keys
    // never reached Supabase + the next hydrateFromCloud would
    // OVERWRITE localStorage with the stale cloud value, silently
    // reverting the save. Bypass the debounce by flushing immediately
    // BEFORE we tell the user "Đã lưu" so the toast is honest.
    try {
      await flushPendingCloudPush()
    } catch { /* logged in flush fn */ }

    setSaved(true)
    addToast('Đã lưu cài đặt thành công')
    if (drafts.kie.trim()) {
      try {
        const credits = await getKieCredits(drafts.kie.trim())
        setKieCredits(credits)
      } catch { /* silent */ }
    }
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleCleanup() {
    setCleaning(true)
    try {
      const { products, models, voiceHistory, brolls } = useBankStore.getState()
      const referenced = new Set<string>()
      products.forEach((p) => { if (isAssetRef(p.productImage)) referenced.add(p.productImage) })
      models.forEach((m) => { if (isAssetRef(m.characterImage)) referenced.add(m.characterImage) })
      voiceHistory.forEach((v) => { if (isAssetRef(v.audioUrl)) referenced.add(v.audioUrl) })
      brolls.forEach((b) => {
        if (isAssetRef(b.imageUrl)) referenced.add(b.imageUrl)
        if (b.videoUrl && isAssetRef(b.videoUrl)) referenced.add(b.videoUrl)
        b.videos?.forEach((v) => { if (isAssetRef(v.url)) referenced.add(v.url) })
      })
      const allIds = await getAllAssetIds()
      const toDelete = allIds.filter((id) => !referenced.has(id))
      await Promise.all(toDelete.map((id) => deleteAsset(id)))
      addToast(`Đã xóa ${toDelete.length} file không dùng`)
    } catch {
      addToast('Dọn dẹp thất bại', 'error')
    } finally {
      setCleaning(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-black/10 bg-white shadow-2xl lg:mx-0 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-black/8">
          <div>
            <h2 className="text-base font-bold text-gray-900">Cài đặt</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {[kieApiKey, geminiApiKey, elevenLabsApiKey, falApiKey, shotstackApiKey].filter(Boolean).length}/5 dịch vụ đã kết nối
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Accordion list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-black/6">
            {SERVICES.map((svc) => {
              const isOpen = openSection === svc.id
              const connected = isSaved(svc.id)
              const isTesting = testing[svc.id] ?? false
              const result = testResults[svc.id]

              return (
                <div key={svc.id}>
                  {/* Row header — always visible */}
                  <button
                    onClick={() => toggleSection(svc.id)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-black/[0.02]"
                  >
                    {/* Status dot */}
                    <div className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${connected ? DOT_COLOR[svc.color] : 'bg-gray-200'}`} />

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${TEXT_COLOR[svc.color]}`}>{svc.label}</p>
                      <p className="text-[11px] text-gray-400 truncate">{svc.sublabel}</p>
                    </div>

                    {/* Status text */}
                    <span className={`shrink-0 text-[11px] font-medium ${connected ? 'text-emerald-500' : 'text-gray-300'}`}>
                      {connected ? 'Đã kết nối' : 'Chưa cài'}
                    </span>

                    {/* Chevron */}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className={`px-5 pb-4 pt-3 space-y-3 border-t border-black/6 ${svc.bgColor}/30`}>
                      {/* Get key link */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                          <Key className="h-3 w-3 text-gray-400" />
                          API Key
                        </label>
                        <a
                          href={svc.getKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1 text-[11px] font-medium ${TEXT_COLOR[svc.color]} hover:opacity-70`}
                        >
                          {svc.getKeyLabel}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>

                      {/* Input */}
                      <div className="relative">
                        <input
                          type={shows[svc.id] ? 'text' : 'password'}
                          value={drafts[svc.id]}
                          onChange={(e) => setDraft(svc.id, e.target.value)}
                          placeholder={svc.placeholder}
                          className={`w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-300 outline-none transition-colors ${FOCUS_BORDER[svc.color]}`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleShow(svc.id)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-500"
                        >
                          {shows[svc.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      {/* Hint */}
                      <p className="text-[11px] text-gray-400">{svc.keyHint}</p>

                      {/* Test button */}
                      <button
                        onClick={() => handleTest(svc.id)}
                        disabled={isTesting || !drafts[svc.id].trim()}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${BTN_CLASS[svc.color]}`}
                      >
                        <RefreshCw className={`h-3 w-3 ${isTesting ? 'animate-spin' : ''}`} />
                        {isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                      </button>

                      {/* Test result */}
                      {result && (
                        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
                          result.ok
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-600 border border-red-500/20'
                        }`}>
                          {result.ok
                            ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            : <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          }
                          <span>{result.message}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Giao diện (Theme) — Sáng / Tối */}
          <div className="border-t border-black/6 px-5 py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <Sun className="h-3.5 w-3.5 text-gray-400" />
                  Giao diện
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {theme === 'dark'
                    ? 'Đang dùng giao diện tối — đỡ mỏi mắt khi làm khuya'
                    : 'Đang dùng giao diện sáng'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-black/[0.02] p-1">
                <button
                  onClick={() => setTheme('light')}
                  title="Giao diện sáng"
                  aria-pressed={theme === 'light'}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    theme === 'light'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" /> Sáng
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  title="Giao diện tối"
                  aria-pressed={theme === 'dark'}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    theme === 'dark'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" /> Tối
                </button>
              </div>
            </div>
          </div>

          {/* Storage section */}
          <div className="border-t border-black/6 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <HardDrive className="h-3.5 w-3.5 text-gray-400" />
                  Lưu trữ
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">Xóa file media không còn được tham chiếu</p>
              </div>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="shrink-0 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 disabled:opacity-40"
              >
                {cleaning ? 'Đang dọn...' : 'Dọn dẹp'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer — Save button */}
        <div className="shrink-0 border-t border-black/8 px-5 py-4">
          <button
            onClick={handleSave}
            disabled={saved}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-black/8 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-black/12 disabled:opacity-60"
          >
            {saved ? (
              <><Check className="h-4 w-4 text-emerald-500" /><span className="text-emerald-500">Đã lưu</span></>
            ) : (
              'Lưu cài đặt'
            )}
          </button>
          {kieCredits !== null && (
            <p className="mt-2 text-center text-[11px] text-gray-400">
              KIE Credits: <span className="font-bold text-gray-600">{kieCredits.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
