// ──────────────────────────────────────────────────────────────────────────
// Z7 — Generated script output card.
// Rendered inline below the module that produced it. Shows:
//   • header chip (mode + tone + lang + product)
//   • Hook / Body / CTA / Scene / B-roll / Emotion / Voice tone blocks
//   • "Xem bản dịch tiếng Việt" collapse (hidden by default)
//   • actions: Copy / Save vào PROJECT / Duplicate / Send to Avatar / Voice / UGC
// ──────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Copy, Check, Save, ChevronDown, X, Bot, Mic, Film, Languages, Trash2, FilesIcon as Files, Send,
} from 'lucide-react'
import type { GeneratedScript } from '../types'
import {
  SCRIPT_TONE_LABEL_VI, SCRIPT_LANG_LABEL, PIPELINE_MODE_LABEL_VI,
} from '../types'
import { buildPlainScriptText, buildSaveableScriptText } from '../services/generateScriptFromAd'
import { useBankStore } from '../../../stores/bankStore'
import { useAppStore } from '../../../stores/appStore'

interface Props {
  script: GeneratedScript
  onRemove: () => void
  onDuplicate: () => void
}

export default function GeneratedScriptCard({ script, onRemove, onDuplicate }: Props) {
  const [showTranslation, setShowTranslation] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savingTitle, setSavingTitle] = useState<string | null>(null)

  const addScript = useBankStore((s) => s.addScript)
  const addToast = useAppStore((s) => s.addToast)
  const sendToApp = useAppStore((s) => s.sendToApp)
  const openApp = useAppStore((s) => s.openApp)

  const copyAll = () => {
    const text = buildPlainScriptText(script)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const startSave = () => {
    if (savingTitle !== null) return
    const defaultName = script.hook
      ? script.hook.slice(0, 50)
      : `${PIPELINE_MODE_LABEL_VI[script.mode]} · ${script.productName}`
    setSavingTitle(defaultName)
  }

  const confirmSave = async (openAfter: boolean) => {
    if (savingTitle === null) return
    const title = savingTitle.trim()
    if (!title) {
      addToast('Đặt tên cho kịch bản trước khi lưu', 'error')
      return
    }
    const scriptText = buildSaveableScriptText(script)
    await addScript({
      title,
      scriptText,
      linkedProductId: script.productId,
      source: 'manual',
    })
    addToast(`✓ Đã lưu "${title}" vào PROJECT > Kịch bản`)
    setSavingTitle(null)
    if (openAfter) {
      sendToApp({ targetApp: 'finder', targetField: 'activeBank', data: 'scripts' })
      openApp('finder')
    }
  }

  const sendToVoice = () => {
    const text = buildPlainScriptText(script)
    sendToApp({ targetApp: 'voice-studio', targetField: 'scriptText', data: text })
    addToast('🎙 Đã gửi script sang Giọng đọc')
    openApp('voice-studio')
  }

  const sendToAvatar = () => {
    // Avatar/character-studio doesn't have a scriptText receiver — copy + navigate
    const text = buildPlainScriptText(script)
    navigator.clipboard.writeText(text).catch(() => {})
    addToast('🤖 Đã copy script — paste vào Avatar AI để gen ảnh diễn xuất theo script')
    openApp('character-studio')
  }

  const sendToUgc = () => {
    const text = buildSaveableScriptText(script)
    navigator.clipboard.writeText(text).catch(() => {})
    addToast('🎬 Đã copy script — paste vào "Kịch bản" trong UGC Builder')
    openApp('video-builder')
  }

  const lang = SCRIPT_LANG_LABEL[script.language]

  return (
    <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/40 to-pink-50/30 p-3 shadow-sm">

      {/* Header chips */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
          {PIPELINE_MODE_LABEL_VI[script.mode]}
        </span>
        <span className="rounded-full border border-pink-300 bg-white px-2 py-0.5 text-[9px] font-bold text-pink-700">
          {SCRIPT_TONE_LABEL_VI[script.tone]}
        </span>
        <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[9px] font-bold text-amber-700">
          {lang.flag} {lang.label.split(' · ')[0]}
        </span>
        <span className="truncate rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[9px] font-bold text-emerald-700 max-w-[40%]">
          → {script.productName}
        </span>
        <button
          onClick={onRemove}
          title="Xoá card này (chỉ ẩn khỏi UI — nếu chưa lưu vào PROJECT, output sẽ mất)"
          className="ml-auto rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Output blocks */}
      <div className="space-y-2.5">
        {script.hook && <Block label="Hook" body={script.hook} accent="emerald" italic />}
        {script.body && <Block label={mainBodyLabel(script.mode)} body={script.body} accent="violet" />}
        {script.cta && <Block label="CTA" body={script.cta} accent="rose" />}
        {script.sceneSuggestion && <Block label="Scene suggestion" body={script.sceneSuggestion} accent="cyan" />}
        {script.brollSuggestion && <Block label="B-roll suggestion" body={script.brollSuggestion} accent="amber" />}
        {script.emotionNote && <Block label="Emotion note" body={script.emotionNote} accent="pink" />}
        {script.voiceTone && <Block label="Voice tone" body={script.voiceTone} accent="indigo" />}
      </div>

      {/* Vietnamese translation collapse */}
      {script.viTranslation && (
        <div className="mt-3">
          <button
            onClick={() => setShowTranslation((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
          >
            <span className="flex items-center gap-1.5">
              <Languages className="h-3 w-3" />
              {showTranslation ? 'Ẩn bản dịch tiếng Việt' : 'Xem bản dịch tiếng Việt'}
            </span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showTranslation ? 'rotate-180' : ''}`} />
          </button>
          {showTranslation && (
            <div className="mt-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap">
              {script.viTranslation}
            </div>
          )}
        </div>
      )}

      {/* Save name input */}
      {savingTitle !== null && (
        <div className="mt-3 space-y-2 rounded-lg border border-violet-300 bg-violet-50 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Đặt tên kịch bản</p>
          <input
            value={savingTitle}
            onChange={(e) => setSavingTitle(e.target.value)}
            autoFocus
            placeholder="VD: BPC-157 Pain → Solution v2..."
            className="w-full rounded-md border border-violet-200 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-violet-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmSave(false)
              if (e.key === 'Escape') setSavingTitle(null)
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => confirmSave(false)}
              disabled={!savingTitle.trim()}
              className="flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              <Save className="h-3 w-3" /> Lưu
            </button>
            <button
              onClick={() => confirmSave(true)}
              disabled={!savingTitle.trim()}
              className="flex items-center gap-1 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-40"
            >
              <Save className="h-3 w-3" /> Lưu & mở trong Kịch bản
            </button>
            <button
              onClick={() => setSavingTitle(null)}
              className="rounded-md border border-black/10 bg-white px-3 py-1.5 text-[11px] text-gray-600 hover:bg-gray-50"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-violet-100 pt-2.5">
        <ActionBtn icon={copied ? Check : Copy} label={copied ? 'Đã copy' : 'Copy'} onClick={copyAll} active={copied} />
        <ActionBtn icon={Save} label="Lưu vào PROJECT" onClick={startSave} primary />
        <ActionBtn icon={Files} label="Duplicate" onClick={onDuplicate} />
        <span className="mx-1 text-[10px] text-gray-300">|</span>
        <ActionBtn icon={Mic} label="→ Giọng đọc" onClick={sendToVoice} />
        <ActionBtn icon={Bot} label="→ Avatar" onClick={sendToAvatar} />
        <ActionBtn icon={Film} label="→ UGC Builder" onClick={sendToUgc} />
      </div>
    </div>
  )
}

function mainBodyLabel(mode: GeneratedScript['mode']): string {
  switch (mode) {
    case 'hook-variants':  return '5 hook variants'
    case 'cta-variants':   return '5 CTA variants'
    case 'storyboard':     return 'Storyboard text'
    case 'landing-page':   return 'Landing page outline'
    case 'product-scenes': return '4 product scene briefs'
    default:               return 'Body'
  }
}

function Block({
  label, body, accent, italic,
}: {
  label: string
  body: string
  accent: 'emerald' | 'violet' | 'rose' | 'cyan' | 'amber' | 'pink' | 'indigo'
  italic?: boolean
}) {
  const COLORS: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
    violet:  'border-violet-200 bg-white text-violet-700',
    rose:    'border-rose-200 bg-rose-50/40 text-rose-700',
    cyan:    'border-cyan-200 bg-cyan-50/40 text-cyan-700',
    amber:   'border-amber-200 bg-amber-50/40 text-amber-700',
    pink:    'border-pink-200 bg-pink-50/40 text-pink-700',
    indigo:  'border-indigo-200 bg-indigo-50/40 text-indigo-700',
  }
  const headerColor = COLORS[accent].split(' ').pop()
  return (
    <div className={`rounded-lg border ${COLORS[accent].split(' ').slice(0, 2).join(' ')} px-3 py-2`}>
      <p className={`text-[9px] font-bold uppercase tracking-widest ${headerColor}`}>{label}</p>
      <p className={`mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-800 ${italic ? 'italic' : ''}`}
         style={italic ? { fontFamily: 'Georgia, serif' } : undefined}>
        {body}
      </p>
    </div>
  )
}

function ActionBtn({
  icon: Icon, label, onClick, primary, active,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  primary?: boolean
  active?: boolean
}) {
  const cls = primary
    ? 'bg-violet-600 text-white hover:bg-violet-700'
    : active
    ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border border-black/10 bg-white text-gray-600 hover:bg-black/[0.03]'
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

// Trash2 imported but unused → silence lint
void Trash2
void Send
