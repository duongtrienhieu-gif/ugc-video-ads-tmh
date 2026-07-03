// ── MKT Agent — store ────────────────────────────────────────────────────────
// Nhân viên Marketing AI bán-tự-động: Research(tìm SP win GENERIC sourceable) →
// Spy → content → Drive. Co-pilot, checkpoint cheap→expensive.
// Xem BaoCao/MKT_AGENT_SPEC.md. P1 = Mô hình A (tab trình duyệt).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CheckpointMode = 'every' | 'key' | 'auto'

export type AgentStage =
  | 'research' | 'spy' | 'brief' | 'scripts' | 'voice'
  | 'plan' | 'video' | 'landing' | 'spyHarvest' | 'export'

// Ứng viên SP — tiêu chí "test được" = generic (không brand) + có trên 1688 (ready)
// + có cầu (số bán / ads). Nguồn: tiktok (TikTok Shop) + fb (FB Ad Library).
// 1 ad spy thật gom được — nguồn để lọc chính xác SP + harvest tải video.
export interface SpyAd {
  id: string
  platform: 'fb' | 'tiktok'
  pageId?: string   // FB advertiser → đào hết ad của họ (pageId mode)
  page?: string
  cover: string
  videoUrl: string
  text: string
  days: number
  scale: number
  match?: boolean   // sau lọc ảnh: đúng SP?
  score?: number
}

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
  rawAds?: SpyAd[]       // ad thật gom được (cầu danh mục) — nguồn lọc + harvest
  exactCount?: number    // # spy ĐÚNG SP (sau lọc ảnh ≥75 + đào advertiser)
  exactChecked?: boolean
  exactAds?: SpyAd[]     // danh sách ad ĐÚNG SP (tải về được) — harvest output
}

// Video bán SP (rip-ready) — từ /api/research-videos, có downloadUrl no-watermark.
export interface VidItem {
  id: string
  platform?: 'tiktok' | 'fb'  // tiktok = play inline + tải; fb = mở link ad
  cover: string
  downloadUrl: string   // tải về chạy ads luôn (no watermark) — chỉ TikTok
  url: string           // link gốc (TikTok / video ad FB)
  views: number
  desc: string
  durationSec: number
  author: string
  days?: number         // FB: ad chạy bao lâu (winner signal)
  authorMatch?: boolean // author ≈ seller SP (video của chính người bán) → gần chắc ĐÚNG SP
  imgMatch?: boolean    // đã so ảnh cover vs ảnh SP: true=khớp · false=khác · undefined=chưa so
}
export interface VideoCheck {
  count: number         // # video bán SP tìm được
  maxViews: number      // view cao nhất (winner signal)
  list: VidItem[]       // top video (đã sort theo view), giữ link Tải
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
  tier?: 'generic' | 'oem' | 'brand'  // generic=clone tự do · oem=nhãn xưởng nhập-sẵn (giữ) · brand=bảo hộ (bỏ) · undefined=chưa lọc
  variantRisk?: 'high' | 'low'        // high=thời trang/giày nhiều biến thể (sai số/hoàn)
  brand?: string
  vids?: VideoCheck      // dò video bán SP (lite, sau quét) — rip-ready
  videoChecking?: boolean // đang dò video
  bankAdding?: boolean   // đang AI điền hồ sơ + thêm vào kho SP
  bankAddedId?: string   // id SP đã tạo trong bank (đã thêm)
  diving?: boolean       // đang Soi sâu
  filtering?: boolean    // đang lọc spy chính xác (vision)
  imgMatching?: boolean  // đang so ảnh video↔SP (nút "Lọc đúng ảnh")
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
  watchlist: SpCandidate[]      // SP đã ghim — lưu qua F5 + qua các lần quét
  showWatchlist: boolean
  seenIds: string[]             // SP đã từng thấy — để radar báo SP MỚI
  lastRadarDate: string         // YYYY-MM-DD lần radar gần nhất (auto quét 1 lần/ngày)
  autoRadar: boolean            // bật tự quét khi mở app (ngày mới)
  newIds: string[]              // SP mới ở lần quét hiện tại (transient, không lưu)
  autoDeep: boolean             // tự Soi sâu top-N SP điểm cao nhất sau quét
  setStage: (s: AgentStage) => void
  setCheckpointMode: (m: CheckpointMode) => void
  setNiches: (s: string) => void
  setAmount: (n: number) => void
  setScanning: (b: boolean) => void
  setClassifying: (b: boolean) => void
  setError: (s: string | null) => void
  setCandidates: (c: SpCandidate[]) => void
  setBranding: (map: Record<string, { tier: 'generic' | 'oem' | 'brand'; brand?: string; variantRisk?: 'high' | 'low' }>) => void
  patchCandidate: (id: string, patch: Partial<SpCandidate>) => void
  setOnlyGeneric: (b: boolean) => void
  selectSp: (p: SpCandidate | null) => void
  toggleWatch: (c: SpCandidate) => void
  setShowWatchlist: (b: boolean) => void
  setNewIds: (ids: string[]) => void
  markSeen: (ids: string[]) => void
  setLastRadarDate: (d: string) => void
  setAutoRadar: (b: boolean) => void
  setAutoDeep: (b: boolean) => void
}

export const useMktAgentStore = create<MktAgentState>()(persist((set) => ({
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
  watchlist: [],
  showWatchlist: false,
  seenIds: [],
  lastRadarDate: '',
  autoRadar: false,
  newIds: [],
  autoDeep: true,
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
      ? { ...c, tier: map[c.productId].tier, brand: map[c.productId].brand, variantRisk: map[c.productId].variantRisk }
      : c),
  })),
  patchCandidate: (id, patch) => set((s) => ({
    candidates: s.candidates.map((c) => c.productId === id ? { ...c, ...patch } : c),
  })),
  setOnlyGeneric: (onlyGeneric) => set({ onlyGeneric }),
  selectSp: (selectedSp) => set({ selectedSp }),
  toggleWatch: (c) => set((s) => {
    const exists = s.watchlist.some((w) => w.productId === c.productId)
    return { watchlist: exists ? s.watchlist.filter((w) => w.productId !== c.productId) : [{ ...c }, ...s.watchlist] }
  }),
  setShowWatchlist: (showWatchlist) => set({ showWatchlist }),
  setNewIds: (newIds) => set({ newIds }),
  markSeen: (ids) => set((s) => ({ seenIds: [...new Set([...ids, ...s.seenIds])].slice(0, 3000) })),
  setLastRadarDate: (lastRadarDate) => set({ lastRadarDate }),
  setAutoRadar: (autoRadar) => set({ autoRadar }),
  setAutoDeep: (autoDeep) => set({ autoDeep }),
}), {
  name: 'mkt-agent-store',
  // Lưu kết quả quét + watchlist + radar qua F5 (đỡ tốn call/credit quét lại). Bỏ cờ tạm + newIds.
  partialize: (s) => ({ candidates: s.candidates, niches: s.niches, amount: s.amount, onlyGeneric: s.onlyGeneric, watchlist: s.watchlist, seenIds: s.seenIds, lastRadarDate: s.lastRadarDate, autoRadar: s.autoRadar, autoDeep: s.autoDeep }),
}))
