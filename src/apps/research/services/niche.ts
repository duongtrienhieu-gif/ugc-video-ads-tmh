// Phân loại sản phẩm vào 7 ngách săn của công ty (+ "other" cho ngách không thuộc nhóm).
// Khớp theo từ khóa trong tên sản phẩm (Kalodata dịch sang tiếng Việt khi lang=vi-VN,
// cũng giữ một số keyword tiếng Mã/Anh phòng khi product_title chưa dịch).
import type { NicheKey, SkuRisk } from '../types'

// Thứ tự CÓ Ý NGHĨA: ngách hẹp đứng trước ngách rộng để khớp chính xác hơn.
const RULES: { key: NicheKey; kw: string[] }[] = [
  {
    key: 'car-acc',
    kw: [
      'xe hơi', 'ô tô', 'ôtô', 'kereta', 'mobil', 'auto', 'car ',
      'khử mùi xe', 'nano kính', 'tẩy ố kính', 'phủ nano', 'gương xe',
      'kính xe', 'dầu xe', 'lốp', 'bumper', 'dashboard',
    ],
  },
  {
    key: 'kitchen',
    kw: [
      'bếp', 'kitchen', 'dao bếp', 'thớt', 'nồi', 'chảo', 'nồi cơm', 'air fryer',
      'pisau', 'penggorengan', 'cup', 'mug ', 'ly thủy tinh',
      'hộp đựng', 'hộp bảo quản', 'cắt thái', 'dụng cụ làm bánh',
      'máy xay sinh tố', 'máy ép', 'khuôn bánh', 'bộ dao',
    ],
  },
  {
    key: 'home-problem',
    kw: [
      'diệt côn trùng', 'diệt muỗi', 'serangga', 'racun', 'pest',
      'tẩy mốc', 'tẩy cặn', 'gel tẩy', 'chống thấm', 'khử mùi nhà',
      'làm sạch nhà', 'tẩy bồn cầu', 'thông tắc', 'thông cống',
      'pemberish', 'pembersih', 'cleaner', 'cleaning', 'antibakteria',
    ],
  },
  {
    key: 'home-repair',
    kw: [
      'đèn led', 'đèn cảm biến', 'đèn pin', 'lamp', 'sensor', 'cảm biến',
      'súng bắn vít', 'tua vít', 'tô vít', 'kìm', 'búa', 'keo dán', 'keo silicone',
      'keo hàn', 'lem ', 'pin cr', 'pin aa', 'pin aaa', 'screws ', 'bộ dụng cụ',
      'đồng hồ tường', 'wall clock', 'jam dinding',
    ],
  },
  {
    key: 'health-nonfood',
    kw: [
      'đai lưng', 'đai bụng', 'đai cột sống', 'đai nâng', 'gối tựa',
      'massage', 'pijat', 'súng massage', 'tập cơ', 'tập gym', 'gym',
      'dụng cụ tập', 'yoga', 'pelvic', 'olahraga', 'fitness',
      'tạ tay', 'dây nhảy', 'chỉnh dáng',
    ],
  },
  {
    key: 'personal-care',
    kw: [
      'ráy tai', 'lông mũi', 'bàn chải điện', 'sikat gigi', 'oral b',
      'điện sóng âm', 'razor', 'cạo râu', 'shaver', 'epilator',
      'mặt nạ ngủ', 'sleep mask', 'khẩu trang', 'tăm bông',
      'mi giả', 'lông mi', 'eyelash', 'kéo mi', 'cọ trang điểm',
      'kính bơi', 'mũ bơi',
    ],
  },
  {
    key: 'skincare',
    kw: [
      'kem ', 'serum', 'toner', 'sữa rửa mặt', 'mặt nạ giấy', 'face mask',
      'collagen', 'mụn', 'thâm', 'whitening', 'trắng da', 'dưỡng da',
      'body lotion', 'body wash', 'shower gel', 'krim', 'cuci muka',
      'tóc', 'rambut', 'shampoo', 'dầu gội', 'gội đầu', 'kondisioner',
      'hair', 'serum tóc', 'thuốc nhuộm', 'son ', 'lipstick', 'son môi',
      'mỹ phẩm', 'kosmetik', 'lăn khử mùi', 'nước hoa', 'parfum',
      'dưỡng môi', 'lip balm', 'kem chống nắng', 'sunscreen', 'sunblock',
    ],
  },
]

export function classifyNiche(title: string | null | undefined): NicheKey {
  if (!title) return 'other'
  const t = title.toLowerCase()
  for (const rule of RULES) {
    for (const kw of rule.kw) {
      if (t.includes(kw)) return rule.key
    }
  }
  return 'other'
}

// Phân loại rủi ro tồn kho theo từ khóa size/màu/biến thể.
const HIGH_SKU_KW = [
  // thời trang, giày, phụ kiện thời trang
  'áo', 'quần', 'váy', 'đầm', 'giày', 'dép', 'sandal', 'sneaker', 'thun',
  'baju', 'seluar', 'kasut', 'shirt', 'jeans', 'tudung', 'shawl',
  'túi', 'ví', 'tas', 'beg', 'jam tangan', 'đồng hồ', 'watch',
  // theo size
  ' size ', ' s/m/l', ' xl ', ' xxl ',
  // theo nhiều màu
  '5 màu', '6 màu', '7 màu', '8 màu', '12 màu', 'multi color',
  // điện thoại theo dòng máy
  'ốp lưng', 'case iphone', 'case samsung',
  // trang sức (mỗi mẫu là biến thể)
  'nhẫn', 'vòng', 'dây chuyền', 'gelang', 'rantai', 'jewelry', 'necklace',
]

export function classifySkuRisk(title: string | null | undefined): SkuRisk {
  if (!title) return 'low'
  const t = title.toLowerCase()
  for (const kw of HIGH_SKU_KW) if (t.includes(kw)) return 'high'
  return 'low'
}
