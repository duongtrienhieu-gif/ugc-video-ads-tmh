// Research module — DATA MẪU (giả lập) để test UX trên app khi chưa nối Kalodata thật.
// Sau này thay bằng data từ Supabase (research_products). Giữ shape giống hệt.
import type { ResearchProduct } from './types'

const trend = (a: number[]) => a

export const SAMPLE_PRODUCTS: ResearchProduct[] = [
  // ── Chăm sóc da/tóc (Hà) ──
  {
    productId: 'sk-1', market: 'MY', title: 'Máy massage da đầu chống rụng tóc',
    revenue: 28400, growthRate: 142, sale: 980, unitPrice: 35, commissionRate: 22, rating: 4.8,
    creatorNum: 9, competitionShops: 4, videoRevenue: 18000, nicheKey: 'skincare',
    skuVarianceRisk: 'low', hotIn: ['TH', 'ID'], revenueTrend: trend([5, 7, 6, 9, 14, 20, 28]), launchDate: '2025-12-01',
  },
  {
    productId: 'sk-2', market: 'MY', title: 'Lược điện sấy tạo kiểu 2 trong 1',
    revenue: 15200, growthRate: 38, sale: 410, unitPrice: 49, commissionRate: 12, rating: 4.4,
    creatorNum: 3, competitionShops: 18, videoRevenue: 9000, nicheKey: 'skincare',
    skuVarianceRisk: 'low', revenueTrend: trend([12, 13, 14, 13, 15, 15, 15]),
  },
  {
    productId: 'sk-3', market: 'MY', title: 'Serum trắng da cấp tốc 7 ngày',
    revenue: 9100, growthRate: -22, sale: 320, unitPrice: 59, commissionRate: 10, rating: 4.1,
    creatorNum: 2, competitionShops: 31, videoRevenue: 0, nicheKey: 'skincare',
    skuVarianceRisk: 'mid', revenueTrend: trend([16, 15, 13, 12, 10, 9, 9]),
  },

  // ── Gia dụng & sửa chữa (Tuấn) ──
  {
    productId: 'hr-1', market: 'MY', title: 'Đèn cảm biến chuyển động không dây',
    revenue: 33200, growthRate: 96, sale: 1450, unitPrice: 29, commissionRate: 18, rating: 4.7,
    creatorNum: 7, competitionShops: 8, videoRevenue: 22000, nicheKey: 'home-repair',
    skuVarianceRisk: 'low', hotIn: ['VN'], revenueTrend: trend([10, 12, 15, 19, 24, 29, 33]),
  },
  {
    productId: 'hr-2', market: 'MY', title: 'Máy bắt vít mini sạc USB',
    revenue: 18700, growthRate: 54, sale: 620, unitPrice: 45, commissionRate: 20, rating: 4.6,
    creatorNum: 5, competitionShops: 11, videoRevenue: 12000, nicheKey: 'home-repair',
    skuVarianceRisk: 'low', revenueTrend: trend([10, 11, 13, 14, 16, 17, 19]),
  },

  // ── Phụ kiện ô tô (Anh) ──
  {
    productId: 'car-1', market: 'MY', title: 'Dung dịch phủ nano kính chống bám nước',
    revenue: 41000, growthRate: 188, sale: 2100, unitPrice: 27, commissionRate: 25, rating: 4.9,
    creatorNum: 12, competitionShops: 5, videoRevenue: 31000, nicheKey: 'car-acc',
    skuVarianceRisk: 'low', hotIn: ['TH', 'VN'], revenueTrend: trend([6, 9, 13, 20, 28, 35, 41]),
  },
  {
    productId: 'car-2', market: 'MY', title: 'Sáp khử mùi xe hương cao cấp',
    revenue: 12400, growthRate: 31, sale: 530, unitPrice: 23, commissionRate: 17, rating: 4.5,
    creatorNum: 4, competitionShops: 14, videoRevenue: 7000, nicheKey: 'car-acc',
    skuVarianceRisk: 'low', revenueTrend: trend([9, 10, 10, 11, 12, 12, 12]),
  },

  // ── Sức khỏe không uống (Duy) ──
  {
    productId: 'hn-1', market: 'MY', title: 'Đai lưng hỗ trợ cột sống định hình',
    revenue: 22600, growthRate: 73, sale: 540, unitPrice: 39, commissionRate: 21, rating: 4.6,
    creatorNum: 6, competitionShops: 9, videoRevenue: 14000, nicheKey: 'health-nonfood',
    skuVarianceRisk: 'mid', hotIn: ['ID'], revenueTrend: trend([9, 11, 13, 15, 18, 20, 22]),
  },
  {
    productId: 'hn-2', market: 'MY', title: 'Súng massage cầm tay mini 4 đầu',
    revenue: 16800, growthRate: 12, sale: 280, unitPrice: 55, commissionRate: 15, rating: 4.3,
    creatorNum: 8, competitionShops: 22, videoRevenue: 11000, nicheKey: 'health-nonfood',
    skuVarianceRisk: 'low', revenueTrend: trend([15, 16, 16, 17, 16, 17, 17]),
  },

  // ── Đồ dùng nhà bếp (Khánh) ──
  {
    productId: 'kt-1', market: 'MY', title: 'Dụng cụ cắt rau củ đa năng 8 lưỡi',
    revenue: 26900, growthRate: 118, sale: 1320, unitPrice: 31, commissionRate: 19, rating: 4.7,
    creatorNum: 10, competitionShops: 7, videoRevenue: 19000, nicheKey: 'kitchen',
    skuVarianceRisk: 'low', hotIn: ['TH'], revenueTrend: trend([7, 9, 12, 16, 20, 24, 27]),
  },
  {
    productId: 'kt-2', market: 'MY', title: 'Hộp bảo quản hút chân không',
    revenue: 8800, growthRate: 5, sale: 240, unitPrice: 42, commissionRate: 13, rating: 4.2,
    creatorNum: 2, competitionShops: 26, videoRevenue: 0, nicheKey: 'kitchen',
    skuVarianceRisk: 'mid', revenueTrend: trend([9, 9, 8, 9, 8, 9, 8]),
  },

  // ── Gia dụng giải quyết vấn đề (Phy) ──
  {
    productId: 'hp-1', market: 'MY', title: 'Xịt diệt côn trùng thảo mộc an toàn',
    revenue: 37500, growthRate: 205, sale: 1980, unitPrice: 25, commissionRate: 24, rating: 4.8,
    creatorNum: 11, competitionShops: 6, videoRevenue: 27000, nicheKey: 'home-problem',
    skuVarianceRisk: 'low', hotIn: ['ID', 'VN'], revenueTrend: trend([5, 8, 12, 18, 26, 32, 37]),
  },
  {
    productId: 'hp-2', market: 'MY', title: 'Gel tẩy mốc nhà tắm cực mạnh',
    revenue: 14100, growthRate: 44, sale: 690, unitPrice: 21, commissionRate: 18, rating: 4.5,
    creatorNum: 5, competitionShops: 12, videoRevenue: 8000, nicheKey: 'home-problem',
    skuVarianceRisk: 'low', revenueTrend: trend([9, 10, 11, 12, 13, 13, 14]),
  },

  // ── Đồ vệ sinh cá nhân (Uyn) ──
  {
    productId: 'pc-1', market: 'MY', title: 'Máy lấy ráy tai có camera nội soi',
    revenue: 31800, growthRate: 134, sale: 1180, unitPrice: 33, commissionRate: 23, rating: 4.7,
    creatorNum: 9, competitionShops: 7, videoRevenue: 24000, nicheKey: 'personal-care',
    skuVarianceRisk: 'low', hotIn: ['TH', 'ID'], revenueTrend: trend([6, 9, 13, 18, 23, 28, 31]),
  },
  {
    productId: 'pc-2', market: 'MY', title: 'Bàn chải điện sóng âm sạc nhanh',
    revenue: 11200, growthRate: 8, sale: 190, unitPrice: 58, commissionRate: 14, rating: 4.4,
    creatorNum: 4, competitionShops: 20, videoRevenue: 6000, nicheKey: 'personal-care',
    skuVarianceRisk: 'low', revenueTrend: trend([10, 11, 11, 11, 11, 11, 11]),
  },

  // ── Một món SKU cao (để thấy bộ lọc "ẩn ngách nhiều SKU" hoạt động) ──
  {
    productId: 'sk-hi', market: 'MY', title: 'Set 12 màu son lì theo tông da',
    revenue: 19000, growthRate: 60, sale: 700, unitPrice: 39, commissionRate: 20, rating: 4.5,
    creatorNum: 6, competitionShops: 15, videoRevenue: 10000, nicheKey: 'skincare',
    skuVarianceRisk: 'high', revenueTrend: trend([12, 13, 14, 15, 16, 18, 19]),
  },
]
