// ── MKT Agent — store ────────────────────────────────────────────────────────
// Nhân viên Marketing AI bán-tự-động: Research(tìm SP win GENERIC sourceable) →
// Spy → content → Drive. Co-pilot, checkpoint cheap→expensive.
// Xem BaoCao/MKT_AGENT_SPEC.md. P1 = Mô hình A (tab trình duyệt).
import { create } from 'zustand'

export type CheckpointMode = 'every' | 'key' | 'auto'

export type AgentStage =
  | 'research' | 'spy' | 'brief' | 'scripts' | 'voice'
  | 'plan' | 'video' | 'landing' | 'spyHarvest' | 'export'

// Ứng viên SP — tiêu chí "test được" = generic (không brand) + có trên 1688 (ready)
// + có cầu (số bán / ads). Nguồn: tiktok (TikTok Shop) + fb (FB Ad Library).
// Số liệu kiểm chứng kéo on-demand ("Soi sâu") — feed cho cả người + bot.
export interface DeepDive {
  videoCount: number     // # video TikTok đang đẩy SP
  maxViews: number       // view cao nhất
  adCount: number        // # ad đối thủ đang chạy (FB)
  adTopDays: number      // ad chạy lâu nhất (ngày) — win signal
  adTopScale: number     // advertiser có nhiều ad nhất — đang scale
  on1688: boolean        // có khớp trên 1688?
  count1688: number
  cost1688: string       // giá thấp nhất trên 1688 (¥ CNY)
  link1688: string
  terms?: string[]       // rổ từ khóa đã bung (Gemini) — search FB+TikTok đa góc
}

// Giám khảo Gemini — phân tích sâu tổng hợp hồ sơ SP.
export interface JudgeResult {
  verdict: string        // NÊN TEST | CÂN NHẮC | BỎ
  score: number          // 0-100 (Gemini tự chấm)
  reasons: string[]
  risks: string[]
}

export interface SpCandidate {
  productId: string
  title: string
  imageUrl?: string
  seller?: string
  url?: string
  sale: number
  price: number          // 0 = chưa rõ
  revenue: number        // sale*price (0 nếu price chưa rõ)
  rating?: number        // 0-5 (free, từ API)
  niche?: string         // ngách khớp lúc quét — dùng làm từ khóa search ad (generic)
  shipFrom?: string      // local vs cross-border (hint hoàn)
  source: 'tiktok' | 'fb'
  isBranded?: boolean    // undefined = chưa lọc
  brand?: string
  diving?: boolean       // đang Soi sâu
  deep?: DeepDive        // kết quả Soi sâu
  judge?: JudgeResult    // giám khảo Gemini (sau Soi sâu)
  deepError?: string
}

interface MktAgentState {
  stage: AgentStage
  checkpointMode: CheckpointMode
  niches: string
  amount: number
  scanning: boolean
  classifying: boolean
  error: string | null
  candidates: SpCandidate[]
  onlyGeneric: boolean
  selectedSp: SpCandidate | null
  setStage: (s: AgentStage) => void
  setCheckpointMode: (m: CheckpointMode) => void
  setNiches: (s: string) => void
  setAmount: (n: number) => void
  setScanning: (b: boolean) => void
  setClassifying: (b: boolean) => void
  setError: (s: string | null) => void
  setCandidates: (c: SpCandidate[]) => void
  setBranding: (map: Record<string, { isBranded: boolean; brand?: string }>) => void
  patchCandidate: (id: string, patch: Partial<SpCandidate>) => void
  setOnlyGeneric: (b: boolean) => void
  selectSp: (p: SpCandidate | null) => void
}

export const useMktAgentStore = create<MktAgentState>((set) => ({
  stage: 'research',
  checkpointMode: 'every',
  niches: 'minyak urut, sakit sendi lutut, jerawat, kurus cepat, sakit gigi',
  amount: 30,
  scanning: false,
  classifying: false,
  error: null,
  candidates: [],
  onlyGeneric: true,
  selectedSp: null,
  setStage: (stage) => set({ stage }),
  setCheckpointMode: (checkpointMode) => set({ checkpointMode }),
  setNiches: (niches) => set({ niches }),
  setAmount: (amount) => set({ amount }),
  setScanning: (scanning) => set({ scanning }),
  setClassifying: (classifying) => set({ classifying }),
  setError: (error) => set({ error }),
  setCandidates: (candidates) => set({ candidates }),
  setBranding: (map) => set((s) => ({
    candidates: s.candidates.map((c) => map[c.productId]
      ? { ...c, isBranded: map[c.productId].isBranded, brand: map[c.productId].brand }
      : c),
  })),
  patchCandidate: (id, patch) => set((s) => ({
    candidates: s.candidates.map((c) => c.productId === id ? { ...c, ...patch } : c),
  })),
  setOnlyGeneric: (onlyGeneric) => set({ onlyGeneric }),
  selectSp: (selectedSp) => set({ selectedSp }),
}))
