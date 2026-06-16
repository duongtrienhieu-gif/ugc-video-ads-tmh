import type { ActionPacket } from '../types'
import { STAGE_LABELS } from '../labels'

// Panel debug cạnh simulator: cho bạn thấy bot đang "nghĩ" gì + mức tiêu thụ Gemini.
export default function DebugSidebar({
  packet, callCount,
}: {
  packet: ActionPacket | null
  callCount: number
}) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col gap-3 border-l border-black/10 bg-black/[0.02] p-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Số lượt bot rep</div>
        <div className="text-2xl font-bold tabular-nums text-emerald-600">{callCount}</div>
        <div className="text-[10px] text-gray-400">≈ số call Gemini đã dùng</div>
      </div>

      {!packet ? (
        <p className="text-xs text-gray-400">Gửi tin để xem bot phân tích.</p>
      ) : (
        <div className="space-y-2.5 text-xs">
          <Row label="Bậc hiện tại" value={STAGE_LABELS[packet.nextStage]} />
          <Row label="Intent" value={packet.intent} />
          <Row label="Chờ khách rep" value={packet.awaitCustomer ? 'Có' : 'Không'} />
          <Row label="Nhường người" value={packet.handover ? '🔔 CÓ' : 'Không'} highlight={packet.handover} />
          {packet.suggestedFollowup && (
            <Row label="Gợi ý nhắc lại" value={`sau ${packet.suggestedFollowup.afterMinutes}' · ${packet.suggestedFollowup.note}`} />
          )}
          {packet.sessionSummary && (
            <div>
              <div className="mb-1 font-semibold text-gray-500">Bộ não nhớ (tóm tắt phiên)</div>
              <div className="rounded bg-violet-500/10 px-1.5 py-1 text-violet-700">{packet.sessionSummary}</div>
            </div>
          )}
          {Object.keys(packet.captured).length > 0 && (
            <div>
              <div className="mb-1 font-semibold text-gray-500">Đã moi được</div>
              <div className="space-y-0.5">
                {Object.entries(packet.captured).map(([k, v]) => (
                  <div key={k} className="flex gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700">
                    <span className="font-semibold">{k}:</span> <span className="truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-xs ${highlight ? 'font-bold text-amber-600' : 'text-gray-800'}`}>{value}</div>
    </div>
  )
}
