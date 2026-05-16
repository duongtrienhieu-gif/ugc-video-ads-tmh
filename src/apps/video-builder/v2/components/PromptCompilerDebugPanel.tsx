// ── PromptCompilerDebugPanel — dev/debug view of compiled prompt sections ──
// Shown as a collapsible right-side overlay when user toggles debug mode.
// Renders each of the 5 sections separately so it's easy to see what
// language tier (creative/balanced/strict) is being used + the exact text
// sent to the image API. Useful for QA-ing consistency strength + prompts.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { X, Copy, Check, Code2, ChevronRight } from 'lucide-react'
import type { CompiledPrompt } from '../types'

interface Props {
  compiled: CompiledPrompt | null
  onClose: () => void
}

function Section({ title, body, color }: { title: string; body: string; color: string }) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`rounded-lg border ${color}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy() }}
            className="rounded-md p-1 text-gray-400 hover:bg-white/50 hover:text-gray-700"
            title="Copy section"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && (
        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-b-lg border-t border-current/10 bg-white/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-gray-700">
          {body}
        </pre>
      )}
    </div>
  )
}

export default function PromptCompilerDebugPanel({ compiled, onClose }: Props) {
  if (!compiled) return null

  return (
    <div className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-black/12 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-bold">Prompt Compiler v2</h3>
            <p className="text-[10px] text-white/60">5-section structure · debug view</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 hover:bg-white/25"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700">
          💡 Mở panel này để xem prompt cuối được gửi lên KIE GPT-4o. Mỗi block có thể copy riêng.
          Reference order: <strong>{compiled.filesUrlOrder.join(' → ')}</strong>
        </div>

        <Section
          title="[1] Identity Lock (avatar)"
          body={compiled.identityLock}
          color="border-sky-200 bg-sky-50/40 text-sky-700"
        />
        <Section
          title="[2] Product Lock (always strict)"
          body={compiled.productLock}
          color="border-pink-200 bg-pink-50/40 text-pink-700"
        />
        <Section
          title="[3] Scene Blueprint"
          body={compiled.sceneBlueprint}
          color="border-violet-200 bg-violet-50/40 text-violet-700"
        />
        <Section
          title="[4] Visual DNA"
          body={compiled.visualDna}
          color="border-emerald-200 bg-emerald-50/40 text-emerald-700"
        />
        <Section
          title="[5] Negative Prompt"
          body={compiled.negativePrompt}
          color="border-red-200 bg-red-50/40 text-red-700"
        />

        <details className="rounded-lg border border-black/10 bg-black/[0.02]">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-gray-700">
            Full compiled prompt ({compiled.final.length} chars) — gửi lên API
          </summary>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap border-t border-black/8 bg-white px-3 py-2 font-mono text-[10px] leading-relaxed text-gray-600">
            {compiled.final}
          </pre>
        </details>
      </div>
    </div>
  )
}
