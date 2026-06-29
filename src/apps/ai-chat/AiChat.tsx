import { useState, useEffect, useRef } from 'react'
import { Bot, Plus, Send, Sparkles, X, Loader2, MessageSquarePlus, KeyRound, Download, Film, History, Trash2 } from 'lucide-react'
import AppHeader from '../../components/shell/AppHeader'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { geminiChatStream, openaiChatStream, genImage, type ChatMessage, type Attachment, type GptModel } from './service'

// Lịch sử RIÊNG theo email: nhiều cuộc trò chuyện, tự lưu; mở "Trò chuyện mới" thì cuộc cũ vào lịch sử.
interface Convo { id: string; title: string; messages: ChatMessage[]; updatedAt: number }
const convosKey = (email: string) => `ai-chat:convos:${email}`
const activeKey = (email: string) => `ai-chat:active:${email}`
const OPENAI_LS = 'ai-chat:openai-key'

// Lưu lịch sử: bỏ dataUrl nặng của file user upload (chỉ giữ ảnh AI tạo = URL remote) để khỏi tràn localStorage.
function stripForStore(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.map((m) => ({ ...m, atts: m.atts.map((a) => ({ ...a, dataUrl: a.dataUrl.startsWith('http') ? a.dataUrl : '' })) }))
}

export default function AiChat() {
  const addToast = useAppStore((s) => s.addToast)
  const email = useAuthStore((s) => s.user?.email) || 'guest'
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const kieApiKey = useSettingsStore((s) => s.kieApiKey)

  const [model, setModel] = useState<'gemini' | 'gpt'>('gemini')
  const [gptModel, setGptModel] = useState<GptModel>('gpt-4o-mini')   // mặc định mini (rẻ)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<Attachment[]>([])
  const [imageMode, setImageMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openaiKey, setOpenaiKey] = useState('')
  const [keyModalOpen, setKeyModalOpen] = useState(false)
  const [convos, setConvos] = useState<Convo[]>([])
  const [activeId, setActiveId] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // OpenAI key (local, riêng app này — không vào settings chung)
  useEffect(() => { setOpenaiKey(localStorage.getItem(OPENAI_LS) || '') }, [])
  // Nạp lịch sử theo email → cuộc đang mở (hoặc cuộc mới nếu chưa có).
  useEffect(() => {
    try {
      const cs = JSON.parse(localStorage.getItem(convosKey(email)) || '[]') as Convo[]
      const list = Array.isArray(cs) ? cs : []
      setConvos(list)
      const act = list.find((c) => c.id === localStorage.getItem(activeKey(email)))
      if (act) { setActiveId(act.id); setMessages(act.messages) }
      else { setActiveId(crypto.randomUUID()); setMessages([]) }
    } catch { setConvos([]); setActiveId(crypto.randomUUID()); setMessages([]) }
  }, [email])
  // Đồng bộ cuộc đang mở vào danh sách (bỏ cuộc rỗng) — auto-save liên tục.
  useEffect(() => {
    if (!activeId) return
    setConvos((prev) => {
      const others = prev.filter((c) => c.id !== activeId)
      if (messages.length === 0) return others
      const title = (messages.find((m) => m.role === 'user')?.text || 'Cuộc trò chuyện').slice(0, 50)
      return [{ id: activeId, title, messages: stripForStore(messages), updatedAt: Date.now() }, ...others]
    })
  }, [messages, activeId])
  useEffect(() => { try { localStorage.setItem(convosKey(email), JSON.stringify(convos)) } catch { /* quota */ } }, [convos, email])
  useEffect(() => { if (activeId) localStorage.setItem(activeKey(email), activeId) }, [activeId, email])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  const openConvo = (c: Convo) => { setActiveId(c.id); setMessages(c.messages); setHistoryOpen(false) }
  const deleteConvo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConvos((prev) => prev.filter((c) => c.id !== id))
    if (id === activeId) { setActiveId(crypto.randomUUID()); setMessages([]) }
  }

  const onFiles = (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      const isVideo = f.type.startsWith('video/')
      const isImage = f.type.startsWith('image/')
      if (!isVideo && !isImage) { addToast('Chỉ nhận ảnh hoặc video', 'error'); continue }
      if (isVideo && model === 'gpt') { addToast('GPT không đọc video — chuyển sang Gemini để đọc video', 'error'); continue }
      if (isVideo && f.size > 15 * 1024 * 1024) { addToast('Video > 15MB — cắt ngắn lại (Gemini inline giới hạn)', 'error'); continue }
      if (isImage && f.size > 8 * 1024 * 1024) { addToast('Ảnh > 8MB — nén nhỏ lại', 'error'); continue }
      const rd = new FileReader()
      rd.onload = () => setPending((p) => [...p, { kind: isVideo ? 'video' : 'image', mime: f.type, dataUrl: String(rd.result || ''), name: f.name }])
      rd.readAsDataURL(f)
    }
  }

  const newChat = () => { setActiveId(crypto.randomUUID()); setMessages([]); setInput(''); setPending([]); setHistoryOpen(false) }

  const send = async () => {
    const text = input.trim()
    if (busy || (!text && pending.length === 0)) return
    if (model === 'gpt' && !imageMode && !openaiKey) { setKeyModalOpen(true); return }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text, atts: pending, imageUrls: [], model }
    const next = [...messages, userMsg]
    setMessages(next); setInput(''); setPending([]); setBusy(true)

    // Tạo ảnh — one-shot (không stream).
    if (imageMode) {
      try {
        if (!kieApiKey) throw new Error('Cần kie.ai API key trong Cài đặt để tạo ảnh')
        const url = await genImage(kieApiKey, text || 'photo')
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: '', atts: [], imageUrls: [url], model }])
      } catch (e) {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: '⚠️ ' + ((e as Error).message || 'Lỗi'), atts: [], imageUrls: [], model, error: true }])
      } finally { setBusy(false) }
      return
    }

    // Chat — STREAMING: thêm 1 tin assistant rỗng rồi đổ chữ dần vào.
    const asstId = crypto.randomUUID()
    setMessages((m) => [...m, { id: asstId, role: 'assistant', text: '', atts: [], imageUrls: [], model: model === 'gpt' ? 'gpt' : 'gemini' }])
    const onDelta = (chunk: string) => setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, text: x.text + chunk } : x)))
    try {
      let full = ''
      if (model === 'gpt') {
        if (userMsg.atts.some((a) => a.kind === 'video')) addToast('GPT bỏ qua video — dùng Gemini cho video', 'error')
        full = await openaiChatStream(openaiKey, gptModel, next, onDelta)
      } else {
        if (!geminiApiKey) throw new Error('Cần Gemini API key trong Cài đặt')
        full = await geminiChatStream(geminiApiKey, next, onDelta)
      }
      setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, text: full || x.text || '(không có nội dung)' } : x)))
    } catch (e) {
      const msg = (e as Error).message || 'Lỗi'
      setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, text: (x.text ? x.text + '\n\n' : '') + '⚠️ ' + msg, error: !x.text } : x)))
    } finally { setBusy(false) }
  }

  const saveOpenaiKey = (k: string) => { setOpenaiKey(k); localStorage.setItem(OPENAI_LS, k); setKeyModalOpen(false) }

  return (
    <div className="flex h-full flex-col">
      <AppHeader icon={Bot} eyebrow="TRỢ LÝ AI · NỘI BỘ" title="Trợ lý AI" />

      {/* Toolbar: chọn model + trò chuyện mới */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-app-border px-4 py-2">
        <button onClick={() => setHistoryOpen(true)} title="Lịch sử trò chuyện"
          className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-card px-3 py-1.5 text-xs font-bold text-app-muted hover:text-app-text">
          <History className="h-3.5 w-3.5" /> Lịch sử{convos.length > 0 ? ` (${convos.length})` : ''}
        </button>
        <div className="inline-flex rounded-xl border border-app-border bg-app-card p-0.5">
          {(['gemini', 'gpt'] as const).map((mm) => (
            <button key={mm} onClick={() => setModel(mm)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${model === mm ? 'ui-accent-solid shadow' : 'text-app-muted hover:text-app-text'}`}>
              {mm === 'gemini' ? '✦ Gemini' : '⬡ GPT'}
            </button>
          ))}
        </div>
        {model === 'gpt' && (
          <div className="inline-flex rounded-lg border border-app-border bg-app-card p-0.5 text-[11px] font-bold" title="Chọn model GPT: mini rẻ hơn ~15× cho việc thường, 4o đỉnh hơn cho việc khó">
            {([['gpt-4o-mini', 'mini · rẻ'], ['gpt-4o', '4o · đỉnh']] as const).map(([g, lbl]) => (
              <button key={g} onClick={() => setGptModel(g)} className={`rounded-md px-2 py-1 ${gptModel === g ? 'ui-accent-soft' : 'text-app-muted hover:text-app-text'}`}>{lbl}</button>
            ))}
          </div>
        )}
        {model === 'gpt' && (
          <button onClick={() => setKeyModalOpen(true)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${openaiKey ? 'border-emerald-300 text-emerald-600' : 'border-amber-300 text-amber-600'}`}>
            <KeyRound className="h-3 w-3" /> {openaiKey ? 'OpenAI key đã có' : 'Nhập OpenAI key'}
          </button>
        )}
        <button onClick={newChat} className="ml-auto flex items-center gap-1.5 rounded-lg border border-app-border bg-app-card px-3 py-1.5 text-xs font-bold text-app-muted hover:text-app-text">
          <MessageSquarePlus className="h-3.5 w-3.5" /> Trò chuyện mới
        </button>
      </div>

      {/* Khung chat */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--color-accent-dim)' }}>
              <Bot className="h-7 w-7" style={{ color: 'var(--color-accent)' }} />
            </span>
            <h2 className="text-lg font-bold text-app-text">Sẵn sàng khi bạn cần.</h2>
            <p className="max-w-sm text-xs text-app-subtle">
              Chat với <b>Gemini</b> / <b>GPT</b>, gửi ảnh để AI đọc, đọc video (Gemini), hoặc bật <b>🎨 Tạo ảnh</b>.
              Lịch sử lưu riêng theo email <b>{email}</b>.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {['Viết caption bán hàng', 'Đọc ảnh sản phẩm này', 'Tóm tắt video tôi gửi'].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="rounded-full border border-app-border bg-app-card px-3 py-1.5 text-[11px] text-app-muted hover:text-app-text">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
            {busy && imageMode && (
              <div className="flex items-center gap-2 text-xs text-app-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo ảnh…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ô nhập */}
      <div className="shrink-0 border-t border-app-border bg-app-surface p-3">
        <div className="mx-auto max-w-3xl">
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((a, i) => (
                <div key={i} className="relative">
                  {a.kind === 'image'
                    ? <img src={a.dataUrl} alt="" className="h-14 w-14 rounded-lg border border-app-border object-cover" />
                    : <div className="flex h-14 w-20 items-center justify-center gap-1 rounded-lg border border-app-border bg-app-card text-[10px] text-app-muted"><Film className="h-3.5 w-3.5" /> video</div>}
                  <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-2.5 w-2.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-app-border bg-app-card p-2">
            <button onClick={() => fileRef.current?.click()} title="Gửi ảnh / video" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-app-muted hover:bg-app-card-elevated hover:text-app-text">
              <Plus className="h-5 w-5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
            <textarea
              value={input} onChange={(e) => setInput(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              placeholder={imageMode ? 'Mô tả ảnh muốn tạo…' : 'Hỏi bất cứ điều gì…'}
              className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-app-text outline-none placeholder:text-app-faint"
            />
            <button onClick={() => setImageMode((v) => !v)} title="Chế độ tạo ảnh"
              className={`flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors ${imageMode ? 'ui-accent-solid' : 'text-app-muted hover:bg-app-card-elevated'}`}>
              <Sparkles className="h-3.5 w-3.5" /> Tạo ảnh
            </button>
            <button onClick={() => void send()} disabled={busy || (!input.trim() && pending.length === 0)}
              className="ui-accent-solid flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 px-1 text-[10px] text-app-faint">
            {imageMode ? 'Tạo ảnh qua kie.ai (tốn credit).' : model === 'gpt' ? `GPT ${gptModel === 'gpt-4o-mini' ? '(mini · rẻ)' : '(4o · đỉnh)'} đọc ảnh, không video. Cần OpenAI API key (≠ gói ChatGPT Go).` : 'Gemini đọc ảnh + video ngắn (<15MB).'}
          </p>
        </div>
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-[110] flex bg-black/30" onClick={() => setHistoryOpen(false)}>
          <div className="flex h-full w-72 max-w-[82vw] flex-col border-r border-app-border bg-app-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-app-border px-3 py-2.5">
              <span className="truncate text-sm font-bold text-app-text">🕘 Lịch sử</span>
              <button onClick={() => setHistoryOpen(false)} className="text-app-muted hover:text-app-text"><X className="h-4 w-4" /></button>
            </div>
            <button onClick={newChat} className="ui-accent-soft m-2 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold">
              <MessageSquarePlus className="h-3.5 w-3.5" /> Trò chuyện mới
            </button>
            <p className="px-3 pb-1 text-[10px] text-app-faint">Của {email}</p>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {convos.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-app-subtle">Chưa có cuộc trò chuyện nào.</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {convos.map((c) => (
                    <div key={c.id} onClick={() => openConvo(c)}
                      className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 ${c.id === activeId ? 'ui-accent-soft' : 'hover:bg-app-card-elevated'}`}>
                      <span className="min-w-0 flex-1 truncate text-xs text-app-text">{c.title || 'Cuộc trò chuyện'}</span>
                      <button onClick={(e) => deleteConvo(c.id, e)} title="Xóa"
                        className="shrink-0 text-app-faint opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {keyModalOpen && <OpenAiKeyModal current={openaiKey} onSave={saveOpenaiKey} onClose={() => setKeyModalOpen(false)} />}
    </div>
  )
}

function MessageBubble({ m }: { m: ChatMessage }) {
  const isUser = m.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${isUser ? 'ui-accent-soft' : m.error ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-app-border bg-app-card text-app-text'}`}>
        {m.atts.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {m.atts.map((a, i) => (
              a.kind === 'image' && a.dataUrl
                ? <img key={i} src={a.dataUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                : <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-[10px]"><Film className="h-3 w-3" /> {a.kind === 'video' ? 'video' : 'ảnh'} đã gửi</span>
            ))}
          </div>
        )}
        {m.text && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
        {!m.text && m.role === 'assistant' && m.imageUrls.length === 0 && <span className="animate-pulse text-app-faint">▍</span>}
        {m.imageUrls.map((u) => (
          <div key={u} className="relative mt-1">
            <img src={u} alt="generated" className="max-h-96 rounded-xl" />
            <a href={u} download target="_blank" rel="noopener noreferrer" className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><Download className="h-4 w-4" /></a>
          </div>
        ))}
        {!isUser && m.model && !m.error && <p className="mt-1 text-[9px] uppercase tracking-wider text-app-faint">{m.model === 'gpt' ? 'GPT-4o' : 'Gemini'}</p>}
      </div>
    </div>
  )
}

function OpenAiKeyModal({ current, onSave, onClose }: { current: string; onSave: (k: string) => void; onClose: () => void }) {
  const [val, setVal] = useState(current)
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2"><KeyRound className="h-4 w-4" style={{ color: 'var(--color-accent)' }} /><h3 className="text-sm font-bold text-app-text">OpenAI API key (cho GPT)</h3></div>
        <p className="mb-3 text-[11px] leading-relaxed text-app-subtle">
          Đây là <b>API key</b> tạo ở <b>platform.openai.com</b> (tính tiền theo token) — <b>KHÁC</b> gói ChatGPT Go.
          Gói Go không dùng được để nhúng vào app. Key lưu trên máy này.
        </p>
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="sk-..." type="password"
          className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text outline-none" />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-bold text-app-muted">Hủy</button>
          <button onClick={() => onSave(val.trim())} disabled={!val.trim()} className="ui-accent-solid rounded-lg px-4 py-1.5 text-xs font-bold disabled:opacity-40">Lưu</button>
        </div>
      </div>
    </div>
  )
}
