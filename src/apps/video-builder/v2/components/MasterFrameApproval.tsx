// ── MasterFrameApproval — UI for reviewing & approving the master frame ────
// User can:
//   - See the generated master frame(s) at large size
//   - Generate additional candidates (re-roll)
//   - Approve one to lock it for downstream scene generation
//   - Reject all and go back to input step
// ─────────────────────────────────────────────────────────────────────────────

import { Check, Loader2, RotateCcw, ArrowLeft, ArrowRight, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAssetUrl } from '../../../../hooks/useAssetUrl'
import type { MasterFrame, MasterFrameStepState, IdentityPack } from '../types'
import { QcBadge, QcScorePanel } from './QcScorePanel'
import ConsistencySlider from './ConsistencySlider'

interface Props {
  state: MasterFrameStepState
  identity: IdentityPack | null
  /** Trigger an additional master frame generation */
  onGenerateMore: () => void
  /** User picks candidate idx as the approved master frame */
  onApprove: (idx: number) => void
  /** Reject all + go back to input step */
  onReject: () => void
  /** Continue to next phase (blueprint) after approval */
  onContinue: () => void
  /** Module 4: QC auto-loop toggle (auto-retry on fail) */
  qcEnabled: boolean
  onQcEnabledChange: (enabled: boolean) => void
  /** Optional progress message from inside the QC loop (e.g. "đang tạo lại để khớp sản phẩm...") */
  qcProgress?: { attempt: number; status: string; elapsedSec?: number } | null
  /** Cancel the in-flight gen */
  onCancel: () => void
  /** Module 5: consistency strength + handler */
  consistencyStrength: number
  onConsistencyChange: (strength: number) => void
}

// ── One candidate tile ──────────────────────────────────────────────────────
function CandidateTile({
  candidate, index, isApproved, onClick,
}: {
  candidate: MasterFrame
  index: number
  isApproved: boolean
  onClick: () => void
}) {
  const url = useAssetUrl(candidate.imageUrl)
  const displayUrl = candidate.imageUrl.startsWith('http') ? candidate.imageUrl : url

  return (
    <button
      onClick={onClick}
      className={`group relative aspect-[2/3] overflow-hidden rounded-xl border-2 transition-all ${
        isApproved
          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
          : 'border-black/10 hover:border-violet-400'
      }`}
    >
      {displayUrl ? (
        <img src={displayUrl} alt={`Master frame #${index + 1}`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center bg-gray-100">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Frame number */}
      <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
        Bản #{index + 1}
      </span>

      {/* QC badge (top-right when QC was run) */}
      {candidate.qc && !isApproved && (
        <div className="absolute right-2 top-2">
          <QcBadge qc={candidate.qc} />
        </div>
      )}

      {/* Approved badge */}
      {isApproved && (
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* QC retry count chip (bottom-left if any) */}
      {candidate.qc && candidate.qc.retryCount > 0 && (
        <span className="absolute bottom-2 left-2 rounded-md bg-violet-600/90 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          retry {candidate.qc.retryCount}
        </span>
      )}
    </button>
  )
}

export default function MasterFrameApproval({
  state, identity, onGenerateMore, onApprove, onReject, onContinue,
  qcEnabled, onQcEnabledChange, qcProgress, onCancel,
  consistencyStrength, onConsistencyChange,
}: Props) {
  const hasApproved = state.approvedIdx >= 0
  const isFirstGen = state.candidates.length === 0 && state.isGenerating
  const approvedCandidate = state.approvedIdx >= 0 ? state.candidates[state.approvedIdx] : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-black/8 bg-gradient-to-r from-violet-50 to-pink-50 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Bước 1: Khung Master (Master Frame)</h2>
              <p className="text-xs text-gray-500">
                Tạo 1 ảnh chuẩn của avatar + sản phẩm. Tất cả B-Roll sau này sẽ "kế thừa" từ ảnh này → giữ identity nhất quán.
              </p>
            </div>
          </div>
          {/* QC quality check — OPTIONAL, default off (speed-first) */}
          <label
            title="Bật để AI tự kiểm tra và tạo lại nếu phát hiện sai sản phẩm/khuôn mặt. Tăng thời gian chờ ~30-90s. Mặc định TẮT cho tốc độ media-buying."
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-violet-300 bg-white px-3 py-1.5 shadow-sm"
          >
            <input
              type="checkbox"
              checked={qcEnabled}
              onChange={(e) => onQcEnabledChange(e.target.checked)}
              className="h-3.5 w-3.5 accent-violet-600"
            />
            <ShieldCheck className="h-3.5 w-3.5 text-violet-600" />
            <div className="leading-tight">
              <p className="text-[11px] font-bold text-violet-700">Kiểm tra chất lượng AI</p>
              <p className="text-[9px] text-gray-500">{qcEnabled ? '(BẬT — chậm hơn ~30-90s)' : '(TẮT — tốc độ ưu tiên)'}</p>
            </div>
          </label>
        </div>
      </div>

      {/* Module 5: Consistency slider — compact mode below header */}
      <div className="shrink-0 border-b border-black/8 bg-white px-6 py-2.5">
        <ConsistencySlider
          strength={consistencyStrength}
          onChange={onConsistencyChange}
          variant="compact"
        />
      </div>

      {/* Identity locks preview */}
      {identity && (
        <div className="shrink-0 border-b border-black/8 bg-black/[0.015] px-6 py-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Identity locks đã trích xuất</p>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="rounded-lg border border-black/8 bg-white p-2.5">
              <p className="mb-0.5 text-[10px] font-semibold text-violet-600">👤 Avatar</p>
              <p className="text-[11px] leading-relaxed text-gray-600 line-clamp-3">{identity.avatarDescription}</p>
            </div>
            <div className="rounded-lg border border-black/8 bg-white p-2.5">
              <p className="mb-0.5 text-[10px] font-semibold text-pink-600">📦 Sản phẩm</p>
              <p className="text-[11px] leading-relaxed text-gray-600 line-clamp-3">{identity.productDescription}</p>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Empty/first-gen state — show QC progress + elapsed + cancel */}
        {isFirstGen && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-sm font-semibold text-gray-700">
              {qcProgress?.status ?? 'Đang tạo Master Frame...'}
            </p>
            {qcProgress?.elapsedSec !== undefined && (
              <p className={`tabular-nums text-xs font-bold ${qcProgress.elapsedSec > 90 ? 'text-red-600' : qcProgress.elapsedSec > 60 ? 'text-amber-600' : 'text-gray-500'}`}>
                {qcProgress.elapsedSec}s
                {qcProgress.elapsedSec > 90 && ' — có thể bị stuck queue KIE, thử hủy + retry'}
                {qcProgress.elapsedSec <= 90 && qcProgress.elapsedSec > 60 && ' — gen lâu hơn bình thường'}
              </p>
            )}
            <p className="max-w-md text-xs text-gray-500">
              {qcEnabled
                ? 'AI sẽ tự kiểm tra & tạo lại nếu sai sản phẩm/khuôn mặt. Mỗi lần ~30-60s, có thể chạy tối đa 4 lần.'
                : 'AI đang ghép avatar + sản phẩm thành 1 ảnh chuẩn. Bước này mất ~30-60 giây.'}
            </p>
            <button
              onClick={onCancel}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              <AlertCircle className="h-3.5 w-3.5" /> Hủy task này
            </button>
            <p className="text-[10px] text-gray-400">
              Mở DevTools (F12) → Console xem log <code className="rounded bg-black/[0.05] px-1">[gpt4o-poll]</code> để debug status thật từ KIE.
            </p>
          </div>
        )}

        {/* QC progress banner (when generating subsequent attempts) */}
        {qcProgress && !isFirstGen && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-semibold">{qcProgress.status}</span>
          </div>
        )}

        {/* Error state */}
        {state.error && !state.isGenerating && state.candidates.length === 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">Tạo Master Frame thất bại</p>
                <p className="mt-1 text-xs text-red-600">{state.error}</p>
                <button
                  onClick={onGenerateMore}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Thử lại
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Candidates grid */}
        {state.candidates.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">
                {state.candidates.length} bản đã tạo · Chọn 1 bản đẹp nhất để duyệt
              </p>
              <p className="text-[11px] text-gray-400">Bấm vào bản bạn thích để duyệt</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {state.candidates.map((c, i) => (
                <CandidateTile
                  key={i}
                  candidate={c}
                  index={i}
                  isApproved={state.approvedIdx === i}
                  onClick={() => onApprove(i)}
                />
              ))}

              {/* "Generate more" slot */}
              {state.candidates.length < 4 && (
                <button
                  onClick={onGenerateMore}
                  disabled={state.isGenerating}
                  className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 text-violet-600 transition-colors hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50"
                >
                  {state.isGenerating ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-[11px] font-semibold">Đang tạo bản #{state.candidates.length + 1}...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-6 w-6" />
                      <span className="text-[11px] font-semibold">Tạo bản khác</span>
                      <span className="text-[10px] text-violet-500">~6 KIE credit</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* QC detail panel for approved candidate */}
            {approvedCandidate?.qc && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Báo cáo QC cho bản đã duyệt
                </p>
                <QcScorePanel qc={approvedCandidate.qc} />
              </div>
            )}

            {/* Tip */}
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
              <p className="text-[11px] text-amber-700">
                💡 <strong>Mẹo:</strong> Chọn bản có khuôn mặt + sản phẩm rõ nét + ánh sáng tự nhiên nhất. Bản này sẽ làm "khuôn mẫu" cho toàn bộ 9 ảnh B-Roll → quyết định độ nhất quán của video.
                {qcEnabled && ' QC tự động đã chạy — bản nào có badge 🟢 là đã đạt full QC.'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-black/8 bg-white px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/[0.04]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại chọn input
          </button>

          <div className="flex items-center gap-2">
            {hasApproved && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                <Check className="h-3.5 w-3.5" /> Đã duyệt bản #{state.approvedIdx + 1}
              </span>
            )}
            <button
              onClick={onContinue}
              disabled={!hasApproved}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tiếp theo: Storyboard <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
