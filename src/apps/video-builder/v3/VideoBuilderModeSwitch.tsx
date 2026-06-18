// ── Video Builder — Mode Switch (entry layer above the TWO separate modes) ───
// The user requires Mode 1 and Mode 2 to be 100% separate — no shared state,
// no shared usage. This thin wrapper is the ONLY place that knows both exist;
// it picks which one to mount and otherwise stays out of their way.
//
//   • Mode 1  = AdsVideoEngine  → the hybrid "script → finished video" engine.
//               UNTOUCHED. This file never reaches into its state.
//   • Mode 2  = BrollStudioPhase → "Xưởng B-roll", a standalone creative tool
//               (product → individual scene clips → download). Its own store.
//
// Keeping the entry OUT of AdsVideoEngine means switching modes can never
// collide with the mode-1 stepper/flow.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import AdsVideoEngine from './AdsVideoEngine'
import BrollStudioPhase from './components/BrollStudioPhase'
import Personified from '../../personified/Personified'   // Mode 3 — Xưởng Nhân Vật Hoá 3D
import './services/brollStudioRenderer'   // registers dev helper __testStudioScene (mode-2)

interface Props {
  /** Switch to legacy v2 (cinematic coverage pipeline). */
  onSwitchToV2: () => void
  /** Switch to legacy v1 (stable). */
  onSwitchToV1: () => void
}

// Mode 3 'personified' is fully standalone (its own state) — same isolation rule as Mode 2.
type BuilderMode = 'engine' | 'studio' | 'personified'

export default function VideoBuilderModeSwitch({ onSwitchToV2, onSwitchToV1 }: Props) {
  const [mode, setMode] = useState<BuilderMode>('engine')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Mode switch bar — the single entry point for both modes ───────── */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-black/10 bg-gray-900 px-4 py-1.5">
        <span className="mr-2 text-[11px] font-bold uppercase tracking-widest text-white/40">Chế độ</span>
        <button
          type="button"
          onClick={() => setMode('engine')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'engine' ? 'bg-white text-gray-900' : 'text-white/70 hover:bg-white/10'
          }`}
        >
          🎬 Tạo Video (Kịch bản → Video)
        </button>
        <button
          type="button"
          onClick={() => setMode('studio')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'studio' ? 'bg-white text-gray-900' : 'text-white/70 hover:bg-white/10'
          }`}
        >
          🎞️ Xưởng B-roll
        </button>
        <button
          type="button"
          onClick={() => setMode('personified')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'personified' ? 'bg-white text-gray-900' : 'text-white/70 hover:bg-white/10'
          }`}
        >
          👹 Nhân Vật Hoá
        </button>
      </div>

      {/* ── Body — exactly one mode is mounted at a time ─────────────────── */}
      <div className="flex-1 overflow-hidden">
        {mode === 'engine' ? (
          <AdsVideoEngine onSwitchToV2={onSwitchToV2} onSwitchToV1={onSwitchToV1} />
        ) : mode === 'studio' ? (
          <BrollStudioPhase onBack={() => setMode('engine')} />
        ) : (
          <Personified />
        )}
      </div>
    </div>
  )
}
