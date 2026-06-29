// ── MKT Agent — store ────────────────────────────────────────────────────────
// Nhân viên Marketing AI bán-tự-động: Research(tìm SP win) → Spy → content →
// xả Drive/Sheet. Co-pilot, checkpoint cheap→expensive (xem BaoCao/MKT_AGENT_SPEC.md).
// P1: Mô hình A (chạy trong tab trình duyệt, render nặng ở cloud KIE/ElevenLabs).
import { create } from 'zustand'
import type { ScoredProduct } from '../research/types'

// 3 nấc duyệt: every (debug, dừng mọi stage) → key (3 chốt) → auto (chạy thẳng).
export type CheckpointMode = 'every' | 'key' | 'auto'

// Các giai đoạn theo đúng luồng thật (sản phẩm là khởi đầu).
export type AgentStage =
  | 'research'   // Stage 0 — quét MY tìm SP win
  | 'spy'        // Stage 0.7 — soi ads đối thủ (chưa build)
  | 'brief'      // Stage 1
  | 'scripts'    // Stage 2
  | 'voice'      // Stage 3
  | 'plan'       // Stage 4
  | 'video'      // Stage 5-6
  | 'landing'    // Stage 7
  | 'spyHarvest' // Stage 8
  | 'export'     // Stage 9

interface MktAgentState {
  stage: AgentStage
  checkpointMode: CheckpointMode
  // Stage 0 — research input + kết quả
  niches: string            // ngách MY, phân tách bằng dấu phẩy
  amount: number            // số SP quét/ngách
  scanning: boolean
  error: string | null
  candidates: ScoredProduct[]
  selectedSp: ScoredProduct | null
  // actions
  setStage: (s: AgentStage) => void
  setCheckpointMode: (m: CheckpointMode) => void
  setNiches: (s: string) => void
  setAmount: (n: number) => void
  setScanning: (b: boolean) => void
  setError: (s: string | null) => void
  setCandidates: (c: ScoredProduct[]) => void
  selectSp: (p: ScoredProduct | null) => void
}

export const useMktAgentStore = create<MktAgentState>((set) => ({
  stage: 'research',
  checkpointMode: 'every',
  niches: 'minyak urut, sakit sendi lutut, jerawat, kurus cepat, sakit gigi',
  amount: 30,
  scanning: false,
  error: null,
  candidates: [],
  selectedSp: null,
  setStage: (stage) => set({ stage }),
  setCheckpointMode: (checkpointMode) => set({ checkpointMode }),
  setNiches: (niches) => set({ niches }),
  setAmount: (amount) => set({ amount }),
  setScanning: (scanning) => set({ scanning }),
  setError: (error) => set({ error }),
  setCandidates: (candidates) => set({ candidates }),
  selectSp: (selectedSp) => set({ selectedSp }),
}))
