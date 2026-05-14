import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Key, Check, HardDrive, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'
import { useBankStore } from '../stores/bankStore'
import { getAllAssetIds, deleteAsset, isAssetRef } from '../utils/assetStore'
import { getKieCredits } from '../utils/kieai'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { kieApiKey, kieCredits, setKieApiKey, setKieCredits } = useSettingsStore()
  const addToast = useAppStore((s) => s.addToast)

  const [draftKie, setDraftKie] = useState(kieApiKey)
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; credits?: number; error?: string } | null>(null)

  useEffect(() => {
    if (open) {
      setDraftKie(kieApiKey)
      setSaved(false)
      setTestResult(null)
    }
  }, [open, kieApiKey])

  if (!open) return null

  async function handleTest() {
    const key = draftKie.trim()
    if (!key) { addToast('Vui lòng nhập API key trước', 'error'); return }
    setTesting(true)
    setTestResult(null)
    try {
      const credits = await getKieCredits(key)
      setTestResult({ ok: true, credits })
      setKieCredits(credits)
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Kết nối thất bại' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    const key = draftKie.trim()
    setKieApiKey(key)
    setSaved(true)
    addToast('Đã lưu cài đặt thành công')
    // Auto-test after save to refresh credits
    if (key) {
      try {
        const credits = await getKieCredits(key)
        setKieCredits(credits)
        setTestResult({ ok: true, credits })
      } catch {
        // silent — don't override the "saved" toast
      }
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-black/10 bg-white p-5 shadow-2xl lg:mx-0 lg:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">Cài đặt</h2>
            <p className="mt-0.5 text-sm text-gray-500">API key và cài đặt hệ thống</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {/* kie.ai API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Key className="h-3.5 w-3.5 text-gray-500" />
                kie.ai API Key
              </label>
              <a
                href="https://kie.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-500 transition-colors hover:text-indigo-400"
              >
                Lấy key →
              </a>
            </div>

            {/* Input */}
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={draftKie}
                onChange={(e) => { setDraftKie(e.target.value); setTestResult(null) }}
                placeholder="SK-..."
                className="w-full rounded-lg border border-black/10 bg-black/5 px-3 py-2.5 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-black/20 focus:bg-black/[0.06]"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <p className="text-[11px] text-gray-400">
              Dùng cho tất cả tính năng: tạo ảnh, video, giọng đọc và văn bản
            </p>

            {/* Test connection button */}
            <button
              onClick={handleTest}
              disabled={testing || !draftKie.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-black/5 hover:text-gray-800 disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
            </button>

            {/* Test result banner */}
            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  testResult.ok
                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                }`}
              >
                {testResult.ok ? (
                  <>
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>Kết nối thành công — còn <strong>{testResult.credits?.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</strong> credits</span>
                  </>
                ) : (
                  <>
                    <X className="h-3.5 w-3.5 shrink-0" />
                    <span>{testResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Storage */}
          <div className="rounded-lg border border-black/8 bg-black/[0.02] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <HardDrive className="h-3.5 w-3.5 text-gray-500" />
                  Lưu trữ
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                  Xóa các file media không còn được tham chiếu bởi Project dữ liệu.
                </p>
              </div>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="shrink-0 rounded-lg border border-black/10 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-black/5 hover:text-gray-800 disabled:opacity-40"
              >
                {cleaning ? 'Đang dọn...' : 'Dọn dẹp bộ nhớ'}
              </button>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saved}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-black/8 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-black/10 disabled:opacity-60"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-500">Đã lưu</span>
            </>
          ) : (
            'Lưu cài đặt'
          )}
        </button>

        {/* Credits display below save (shown if known) */}
        {kieCredits !== null && (
          <p className="mt-3 text-center text-[11px] text-gray-400">
            Credits hiện tại: <span className="font-semibold text-gray-600">{kieCredits.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</span>
          </p>
        )}
      </div>
    </div>
  )
}
