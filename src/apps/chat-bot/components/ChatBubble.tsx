import type { ChatTurn } from '../types'
import MediaThumb from './MediaThumb'

// Render 1 lượt chat trong simulator.
//  • Khách: bóng phải.
//  • Bot: bóng trái — mỗi BotMessage là 1 bóng (text song ngữ, hoặc ảnh/video).
//    contentVi (gloss VN) hiện mờ dưới contentTarget khi khác nhau (thị trường MY).
export default function ChatBubble({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-black/[0.05] px-3 py-1 text-[11px] font-medium text-gray-400">
          {turn.customerText}
        </span>
      </div>
    )
  }

  if (turn.role === 'customer') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-emerald-500 px-3.5 py-2 text-sm text-white shadow-sm">
          {turn.customerText}
        </div>
      </div>
    )
  }

  const messages = turn.packet?.messages ?? []
  return (
    <div className="flex flex-col items-start gap-1.5">
      {messages.map((m, i) => {
        if (m.type === 'image' || m.type === 'video') {
          return (
            <div key={i} className="overflow-hidden rounded-2xl rounded-bl-sm border border-black/10 bg-white shadow-sm">
              <MediaThumb assetRef={m.assetRef ?? ''} mediaType={m.type} className="h-44 w-44" />
              {m.contentTarget && (
                <div className="px-3 py-2 text-sm text-gray-800">{m.contentTarget}</div>
              )}
            </div>
          )
        }
        const showGloss = m.contentVi && m.contentVi.trim() && m.contentVi.trim() !== (m.contentTarget ?? '').trim()
        return (
          <div key={i} className="max-w-[78%] rounded-2xl rounded-bl-sm border border-black/10 bg-white px-3.5 py-2 shadow-sm">
            <p className="text-sm text-gray-900">{m.contentTarget}</p>
            {showGloss && (
              <p className="mt-1 border-t border-dashed border-black/10 pt-1 text-xs italic text-gray-400">
                🇻🇳 {m.contentVi}
              </p>
            )}
          </div>
        )
      })}
      {turn.packet?.handover && (
        <div className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          🔔 Bot nhường người — cần bạn vào chat tay
        </div>
      )}
    </div>
  )
}
