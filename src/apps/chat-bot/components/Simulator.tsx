import { useMemo, useRef, useState } from 'react'
import { Send, Loader2, RotateCcw, AlertTriangle } from 'lucide-react'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useChatBotStore } from '../store'
import type { ActionPacket, ChatTurn } from '../types'
import { runSalesBrain } from '../services/salesBrainEngine'
import { HARD_SCENARIOS, SILENCE_PROMPT, scenarioText } from '../services/hardScenarios'
import ChatBubble from './ChatBubble'
import DebugSidebar from './DebugSidebar'

let turnSeq = 0
const nextId = () => `t${turnSeq++}`

// Mô phỏng: bạn đóng vai khách → bot rep thật (1 call Gemini/lượt, chỉ khi bấm Gửi).
// Có nút "ca khó" để stress-test nhanh + nút "khách im" để test follow-up.
export default function Simulator({ productId }: { productId: string }) {
  const config = useChatBotStore((s) => s.configs.find((c) => c.productId === productId))
  const product = useBankStore((s) => s.getProductById(productId))
  const geminiKey = useSettingsStore((s) => s.geminiApiKey)
  const addToast = useAppStore((s) => s.addToast)

  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const lastPacket: ActionPacket | null = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === 'bot' && turns[i].packet) return turns[i].packet!
    }
    return null
  }, [turns])

  const callCount = turns.filter((t) => t.role === 'bot').length

  const scrollDown = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  const sendMessage = async (text: string, silence = false) => {
    if (sending || !config) return
    if (!geminiKey) { addToast('Chưa có Gemini key — vào Cài đặt nhập key', 'error'); return }
    if (!silence && !text.trim()) return

    const history = turns
    setTurns((t) => [
      ...t,
      silence
        ? { id: nextId(), role: 'system', customerText: '⏳ khách đã xem, không trả lời', at: Date.now() }
        : { id: nextId(), role: 'customer', customerText: text, at: Date.now() },
    ])
    setSending(true)
    scrollDown()

    try {
      const customerText = silence ? SILENCE_PROMPT : text
      const packet = await runSalesBrain({ config, product, history, customerText, apiKey: geminiKey })
      setTurns((t) => [...t, { id: nextId(), role: 'bot', packet, at: Date.now() }])
    } catch (err) {
      addToast(`Bot lỗi: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSending(false)
      scrollDown()
    }
  }

  const sendFromInput = () => {
    const t = input.trim()
    if (!t) return
    setInput('')
    void sendMessage(t)
  }

  const reset = () => setTurns([])

  if (!config) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <AlertTriangle className="h-7 w-7 text-amber-400" />
        <p className="text-sm text-gray-500">Sản phẩm này chưa có cấu hình bot.</p>
        <p className="text-xs text-gray-400">Sang tab <span className="font-semibold">Cấu hình</span> nhập giá chat + lưu, rồi quay lại mô phỏng.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-black/8 px-4 py-2">
          <span className="text-xs text-gray-500">
            Đóng vai khách — gõ như khách thật ({config.market === 'MY' ? 'Manglish/Malay' : 'tiếng Việt'})
          </span>
          <button
            onClick={reset}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-500 transition-colors hover:bg-black/5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Làm lại
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {turns.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Gõ tin đầu tiên như khách (vd: {config.market === 'MY' ? '"harga? boleh COD?"' : '"giá nhiêu shop ơi"'})
              <br />hoặc bấm 1 nút <span className="font-semibold">ca khó</span> bên dưới để test nhanh.
            </div>
          ) : (
            turns.map((t) => <ChatBubble key={t.id} turn={t} />)
          )}
          {sending && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Bot đang soạn…
            </div>
          )}
        </div>

        {/* Nút ca khó */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-black/8 px-3 pt-2">
          <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Ca khó</span>
          {HARD_SCENARIOS.map((s) => (
            <button
              key={s.id}
              disabled={sending}
              onClick={() => (s.silence ? void sendMessage('', true) : void sendMessage(scenarioText(s, config.market)))}
              className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-emerald-300 hover:bg-emerald-500/[0.06] hover:text-emerald-700 disabled:opacity-40"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-end gap-2 border-t border-black/10 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFromInput() }
            }}
            placeholder="Nhắn như khách… (Enter để gửi)"
            rows={1}
            className="max-h-28 flex-1 resize-none rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <button
            onClick={sendFromInput}
            disabled={sending || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Debug sidebar — ẩn trên mobile */}
      <div className="hidden md:block">
        <DebugSidebar packet={lastPacket} callCount={callCount} />
      </div>
    </div>
  )
}
