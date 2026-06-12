export type TabId = 'physical' | 'scene' | 'pose' | 'camera'

export interface FieldConfig {
  key: string
  label: string
  chips: string[]
  placeholder?: string
}

export interface TabConfig {
  id: TabId
  label: string
  fields: FieldConfig[]
}

export type CharacterProfile = Record<string, string>

export const TABS: TabConfig[] = [
  {
    id: 'physical',
    label: 'Ngoại hình',
    fields: [
      {
        key: 'gender',
        label: 'Giới tính',
        chips: ['Nữ', 'Nam', 'Phi nhị giới'],
      },
      {
        key: 'age',
        label: 'Độ tuổi',
        chips: ['18-24', '20s', '25-30', '30-40', '40-50', '50+'],
      },
      // 'ethnicity' is intentionally NOT a visible field — it is set behind the
      // scenes by the Country selector (COUNTRY_OPTIONS) so "chọn Việt Nam" can
      // never drift to another nationality. The key still exists in the profile.
      {
        key: 'bodyType',
        label: 'Vóc dáng',
        chips: ['Mảnh mai', 'Cân đối', 'Trung bình', 'Đầy đặn', 'Đẫy đà', 'Cơ bắp'],
      },
      {
        key: 'skinTone',
        label: 'Màu da',
        chips: ['Trắng', 'Sáng', 'Trung bình', 'Ô liu', 'Rám nắng', 'Hơi rám nắng', 'Nâu', 'Ngăm đen'],
      },
      {
        key: 'skinTexture',
        label: 'Kết cấu da',
        chips: [
          'Da căng mịn, lỗ chân lông nhỏ, lông tơ mịn, vài tàn nhang nhẹ trên sống mũi',
          'Da căng mịn (glass skin)',
          'Lỗ chân lông tự nhiên',
          'Sẹo mụn nhẹ',
          'Có tàn nhang',
          'Da có kết cấu',
          'Nếp nhăn tuổi trung niên',
          'Lỗ chân lông tự nhiên, hơi không hoàn hảo',
        ],
        placeholder: 'vd: "Da căng mịn, lỗ chân lông nhỏ"',
      },
      {
        key: 'eyeColor',
        label: 'Màu mắt',
        chips: ['Nâu', 'Xanh dương', 'Xanh lá', 'Nâu hạt dẻ', 'Xám', 'Hổ phách', 'Nâu sẫm'],
      },
      {
        key: 'eyeShape',
        label: 'Hình dạng mắt',
        chips: ['Hạnh nhân', 'Tròn', 'Mí mọng', 'Một mí', 'Đuôi mắt hếch', 'Đuôi mắt cụp', 'Mắt sâu', 'Mắt xa nhau'],
      },
      {
        key: 'hairColor',
        label: 'Màu tóc',
        chips: ['Vàng', 'Nâu', 'Đen', 'Đỏ', 'Nâu đỏ', 'Xám', 'Bạch kim'],
      },
      {
        key: 'hairStyle',
        label: 'Kiểu tóc',
        chips: ['Tóc dài thẳng', 'Tóc dài gợn sóng', 'Tóc ngang vai', 'Tóc bob', 'Tóc tém', 'Buộc đuôi ngựa', 'Búi rối', 'Tết bím', 'Mái rèm + layer', 'Tóc ngắn cá tính', 'Cạo sát'],
      },
      {
        key: 'hairTexture',
        label: 'Kết cấu tóc',
        chips: ['Thẳng', 'Gợn sóng', 'Xoăn', 'Xoăn lọn nhỏ', 'Xoăn tít', 'Sợi mảnh', 'Dày'],
      },
      {
        key: 'facialFeatures',
        label: 'Đặc điểm khuôn mặt',
        chips: ['Tàn nhang', 'Quai hàm sắc nét', 'Nét mặt dịu dàng', 'Gò má cao', 'Môi đầy đặn', 'Đeo kính'],
        placeholder: 'vd: "Tàn nhang nhẹ, nụ cười dịu"',
      },
      {
        key: 'facialHair',
        label: 'Râu/ria',
        chips: ['Không', 'Cạo nhẵn', 'Râu lún phún', 'Râu ngắn', 'Râu rậm', 'Râu dê', 'Ria mép'],
      },
      {
        key: 'distinguishingMarks',
        label: 'Dấu hiệu đặc biệt',
        chips: ['Không', 'Nốt ruồi duyên', 'Má lúm', 'Sẹo', 'Vết bớt', 'Hình xăm', 'Khuyên'],
        placeholder: 'vd: "Nốt ruồi duyên má trái"',
      },
    ],
  },
  {
    id: 'scene',
    label: 'Bối cảnh',
    fields: [
      {
        key: 'location',
        label: 'Địa điểm',
        chips: ['Phòng ngủ', 'Phòng khách', 'Nhà bếp', 'Phòng tắm', 'Trong xe hơi', 'Phòng gym', 'Quán cà phê', 'Văn phòng', 'Công viên ngoài trời', 'Bãi biển', 'Phông nền studio'],
      },
      {
        key: 'background',
        label: 'Chi tiết phông nền',
        chips: ['Tường trơn', 'Kệ sách', 'Cây xanh', 'Giường có gối', 'Bàn bếp', 'Trong xe hơi', 'Nền mờ', 'Cửa sổ ánh sáng tự nhiên', 'Tối giản'],
        placeholder: 'vd: "Tường trắng trơn, cây monstera nhỏ"',
      },
      {
        key: 'lighting',
        label: 'Ánh sáng',
        chips: [
          'Ánh sáng cửa sổ tự nhiên dịu, đổ nhẹ lên gò má, da chân thật',
          'Ánh sáng tự nhiên dịu',
          'Giờ vàng',
          'Đèn ring light (influencer)',
          'Đèn flash gắt',
          'Phòng ngủ ánh sáng mờ',
          'Ánh sáng cửa sổ tự nhiên',
          'Đèn huỳnh quang văn phòng',
        ],
      },
      {
        key: 'weather',
        label: 'Thời tiết',
        chips: ['Nắng', 'Nhiều mây', 'Mưa', 'Âm u', 'Giờ vàng', 'Giờ xanh', 'Trong nhà'],
      },
      {
        key: 'timeOfDay',
        label: 'Thời điểm trong ngày',
        chips: ['Buổi sáng', 'Buổi trưa', 'Buổi chiều', 'Giờ vàng', 'Chạng vạng', 'Ban đêm'],
      },
    ],
  },
  {
    id: 'pose',
    label: 'Tư thế & Hành động',
    fields: [
      {
        key: 'pose',
        label: 'Tư thế',
        chips: ['Ngồi trên giường', 'Ngồi trên ghế sofa', 'Đứng', 'Tựa vào quầy', 'Đang đi bộ', 'Ngồi trong xe', 'Chính diện hướng camera', 'Nằm', 'Ngồi xếp bằng dưới sàn'],
      },
      {
        key: 'action',
        label: 'Hành động',
        chips: ['Nói với camera', 'Cầm sản phẩm', 'Thoa sản phẩm', 'Mở hộp', 'Chỉ vào thứ gì đó', 'Gõ điện thoại', 'Ngồi ghế lái xe', 'Uống từ chai', 'Khoe trước/sau'],
        placeholder: 'vd: "Cầm sản phẩm cạnh mặt, khoe nhãn"',
      },
      {
        key: 'expression',
        label: 'Biểu cảm',
        chips: ['Cười tự nhiên', 'Cười tươi chân thật', 'Hào hứng', 'Hoài nghi', 'Ngạc nhiên', 'Đang suy nghĩ', 'Cười lớn', 'Nghiêm túc/tập trung', 'Đang nói dở câu'],
      },
    ],
  },
  {
    id: 'camera',
    label: 'Máy quay',
    fields: [
      {
        key: 'shotType',
        label: 'Kiểu cảnh',
        chips: ['Cận mặt', 'Trung cảnh (từ eo lên)', 'Góc người thứ ba', 'Toàn thân', 'Qua vai', 'Ngang tầm mắt', 'Góc thấp', 'Góc cao', 'Góc nghiêng (Dutch)'],
      },
      {
        key: 'cameraAngle',
        label: 'Góc máy',
        chips: ['Ngang tầm mắt', 'Góc thấp', 'Góc cao', 'Góc từ trên xuống', 'Góc từ dưới lên', 'Nghiêng (Dutch tilt)', 'Qua vai'],
      },
      {
        key: 'cameraDevice',
        label: 'Thiết bị quay',
        chips: [
          'iPhone 15 Pro, thẩm mỹ UGC tự nhiên',
          'iPhone 14 Pro',
          'Camera trước iPhone',
          'Cam selfie iPhone',
          'Camera sau iPhone',
          'DSLR xóa phông',
          'Webcam',
          'GoPro góc rộng',
          'Ring light + điện thoại',
        ],
      },
      {
        // aspectRatio is a STRUCTURAL value (parsed by OutputPanel + generateCharacter
        // for the image size) — keep these chips in the exact logic format.
        key: 'aspectRatio',
        label: 'Tỷ lệ khung hình',
        chips: ['Portrait (9:16)', 'Landscape (16:9)'],
      },
    ],
  },
]

// All field keys across all tabs
export const ALL_FIELD_KEYS = TABS.flatMap((tab) => tab.fields.map((f) => f.key))

export const PRESET_DEFAULT: CharacterProfile = {
  gender: 'Female',
  age: '25-30',
  ethnicity: 'Caucasian',
  bodyType: 'Athletic',
  skinTone: 'Medium',
  skinTexture: '',
  eyeColor: '',
  eyeShape: '',
  hairColor: 'Brunette',
  hairStyle: 'Long wavy',
  hairTexture: '',
  facialFeatures: 'Soft features, natural smile',
  facialHair: '',
  distinguishingMarks: '',
  clothingStyle: 'Casual athleisure',
  accessories: 'None',
  makeup: 'Natural/minimal',
  location: 'Bedroom',
  background: 'Neutral wall',
  lighting: 'Soft natural light',
  weather: '',
  timeOfDay: 'Morning',
  pose: 'Sitting on bed',
  action: 'Speaking to camera',
  expression: 'Natural smile',
  shotType: 'Medium shot (waist up)',
  cameraAngle: 'Eye Level',
  cameraDevice: 'iPhone selfie cam',
  aspectRatio: 'Portrait (9:16)',
}

export const PRESET_CAR: CharacterProfile = {
  gender: 'Female',
  age: '25-30',
  ethnicity: 'Caucasian',
  bodyType: 'Slim',
  skinTone: 'Fair',
  skinTexture: '',
  eyeColor: '',
  eyeShape: '',
  hairColor: 'Blonde',
  hairStyle: 'Long straight',
  hairTexture: '',
  facialFeatures: 'Light makeup, high cheekbones',
  facialHair: '',
  distinguishingMarks: '',
  clothingStyle: 'Minimal chic',
  accessories: 'Sunglasses',
  makeup: 'Light glam',
  location: 'Car interior',
  background: 'Blurred background',
  lighting: 'Soft natural light',
  weather: 'Sunny',
  timeOfDay: 'Afternoon',
  pose: 'Sitting in car',
  action: 'Speaking to camera',
  expression: 'Natural smile',
  shotType: 'Close-up face',
  cameraAngle: 'Eye Level',
  cameraDevice: 'iPhone selfie cam',
  aspectRatio: 'Portrait (9:16)',
}

export const PRESET_UGC_CAR: CharacterProfile = {
  gender: 'Female',
  age: '20s',
  ethnicity: 'American',
  bodyType: 'Athletic',
  skinTone: 'Lightly sunkissed',
  skinTexture: 'Glass skin finish with ultra-detailed texture, including visible skin pores, fine peach fuzz, and a scattering of light freckles across the bridge of her nose',
  eyeColor: 'Hazel',
  eyeShape: 'Hooded',
  hairColor: 'Blonde',
  hairStyle: 'Curtain Bangs + Layers',
  hairTexture: 'Straight',
  facialFeatures: '',
  facialHair: 'None',
  distinguishingMarks: 'Beauty mark',
  clothingStyle: 'Minimalist',
  accessories: 'Gold hoops',
  makeup: 'E-girl makeup',
  location: 'Car interior',
  background: 'Car Interior',
  lighting: 'Soft, diffused natural window light, creating gentle highlights on the cheekbones and realistic subsurface scattering on the skin',
  weather: 'Sunny',
  timeOfDay: '',
  pose: 'Front-on facing the camera',
  action: 'Sitting in drivers seat of car',
  expression: 'Genuine smile',
  shotType: 'Third-Person Shot',
  cameraAngle: 'Eye Level',
  cameraDevice: 'iPhone 15 Pro, casual UGC aesthetic',
  aspectRatio: 'Portrait (9:16)',
}

export function createEmptyProfile(): CharacterProfile {
  const profile: CharacterProfile = {}
  for (const key of ALL_FIELD_KEYS) {
    profile[key] = ''
  }
  return profile
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Country / nationality presets ───────────────────────────────────────────
// UGC Creator builds a culturally-coherent random avatar for the SELECTED
// country (ethnicity + typical hair / skin / clothing). All field VALUES are
// Vietnamese (operator's language); generateCharacter translates the profile to
// English for the image model at generation time — so prompt quality is
// unchanged AND the chosen nationality is preserved (no "Việt Nam → Malaysia"
// drift). Scene fields stay generic; buildImagePrompt re-asserts the prop-free
// "empty hands" rule in English, so it survives translation.
export interface CountryOption { key: string; label: string }
export const COUNTRY_OPTIONS: CountryOption[] = [
  { key: 'vn', label: 'Việt Nam' },
  { key: 'ph', label: 'Philippines' },
  { key: 'id', label: 'Indonesia' },
  { key: 'th', label: 'Thái Lan' },
  { key: 'my', label: 'Malaysia' },
  { key: 'us', label: 'Mỹ' },
  { key: 'cn', label: 'Trung Quốc' },
  { key: 'eu', label: 'Châu Âu (chung)' },
]

interface CulturePool {
  ethnicityFemale: string
  ethnicityMale: string
  femaleHasHijab: boolean   // true → women wear a headscarf, hair colour hidden
  femaleHair: string[]
  maleHair: string[]
  hairColor: string[]
  skinTone: string[]
  eyeShape: string[]
  clothingFemale: string[]
  clothingMale: string[]
  makeup: string[]
  facialFeatures: string[]
}

const HIJAB_COLORS = ['Khăn trùm đầu Hồi giáo màu hồng san hô', 'Khăn trùm đầu Hồi giáo màu hồng phấn', 'Khăn trùm đầu Hồi giáo màu xanh sage', 'Khăn trùm đầu Hồi giáo màu xanh da trời', 'Khăn trùm đầu Hồi giáo màu trắng ngà', 'Khăn trùm đầu Hồi giáo màu tím lavender', 'Khăn trùm đầu Hồi giáo màu nâu đất', 'Khăn trùm đầu Hồi giáo màu be']

const COUNTRY_CULTURE: Record<string, CulturePool> = {
  vn: {
    ethnicityFemale: 'Phụ nữ Việt Nam', ethnicityMale: 'Nam giới Việt Nam', femaleHasHijab: false,
    femaleHair: ['Tóc đen dài thẳng', 'Tóc đen dài gợn sóng nhẹ', 'Tóc ngang vai', 'Tóc bob', 'Tóc buộc đuôi ngựa', 'Tóc layer mái thưa'],
    maleHair: ['Tóc ngắn gọn gàng', 'Tóc ngắn vuốt nhẹ', 'Undercut', 'Tóc ngắn tự nhiên'],
    hairColor: ['Đen', 'Nâu đen', 'Nâu hạt dẻ'],
    skinTone: ['Trắng', 'Trắng hồng', 'Da trung bình', 'Ngăm nhẹ'],
    eyeShape: ['Mắt hạnh nhân', 'Mắt một mí', 'Mắt to tròn', 'Mắt hơi xếch'],
    clothingFemale: ['Áo thun trắng phối quần jean', 'Sơ mi công sở nhẹ nhàng', 'Áo len dệt kim ấm', 'Set đồ tối giản', 'Váy mùa hè nhẹ nhàng'],
    clothingMale: ['Áo thun basic', 'Sơ mi smart casual', 'Áo polo lịch sự', 'Hoodie streetwear'],
    makeup: ['Trang điểm tự nhiên', 'Makeup nhẹ trong veo', 'Không trang điểm', 'Makeup hằng ngày nhẹ'],
    facialFeatures: ['Nét mặt dịu dàng', 'Gò má cao', 'Môi đầy đặn', 'Khuôn mặt thanh tú'],
  },
  ph: {
    ethnicityFemale: 'Phụ nữ Philippines (Filipina)', ethnicityMale: 'Nam giới Philippines', femaleHasHijab: false,
    femaleHair: ['Tóc nâu sẫm dài gợn sóng', 'Tóc đen dài thẳng', 'Tóc layer dài', 'Tóc búi rối tự nhiên'],
    maleHair: ['Tóc ngắn gọn', 'Tóc ngắn vuốt', 'Fade haircut', 'Tóc xoăn ngắn'],
    hairColor: ['Đen', 'Nâu sẫm', 'Nâu'],
    skinTone: ['Nâu vàng (morena)', 'Ngăm khỏe khoắn', 'Da trung bình', 'Nâu'],
    eyeShape: ['Mắt to tròn', 'Mắt hạnh nhân', 'Mắt hơi xếch'],
    clothingFemale: ['Áo phông casual nhiệt đới', 'Đầm hoa nhẹ nhàng', 'Áo croptop + quần jean', 'Set đồ tươi mát'],
    clothingMale: ['Áo thun nhiệt đới', 'Sơ mi vải mỏng', 'Áo polo', 'Hoodie casual'],
    makeup: ['Trang điểm tự nhiên', 'Makeup nâu khỏe khoắn', 'Không trang điểm', 'Makeup nhẹ'],
    facialFeatures: ['Nét mặt rạng rỡ', 'Gò má cao', 'Môi đầy đặn', 'Khuôn mặt tươi tắn'],
  },
  id: {
    ethnicityFemale: 'Phụ nữ Indonesia', ethnicityMale: 'Nam giới Indonesia', femaleHasHijab: true,
    femaleHair: [...HIJAB_COLORS, 'Tóc đen dài thẳng (không khăn)', 'Tóc nâu sẫm gợn sóng (không khăn)'],
    maleHair: ['Tóc ngắn gọn', 'Tóc ngắn xoăn nhẹ', 'Fade haircut', 'Tóc đen ngắn tự nhiên'],
    hairColor: ['Đen', 'Nâu sẫm'],
    skinTone: ['Nâu vàng', 'Ngăm', 'Da trung bình', 'Nâu'],
    eyeShape: ['Mắt hạnh nhân', 'Mắt to tròn', 'Mắt hơi xếch'],
    clothingFemale: ['Trang phục kín đáo lịch sự', 'Áo dài tay phối váy maxi', 'Đồ Hồi giáo modest hằng ngày', 'Set đồ kín đáo trẻ trung'],
    clothingMale: ['Áo thun casual', 'Sơ mi batik nhẹ', 'Áo polo', 'Hoodie casual'],
    makeup: ['Trang điểm tự nhiên', 'Makeup nhẹ', 'Không trang điểm', 'Makeup hằng ngày'],
    facialFeatures: ['Nét mặt hiền hòa', 'Gò má cao', 'Khuôn mặt phúc hậu', 'Nét mặt dịu dàng'],
  },
  th: {
    ethnicityFemale: 'Phụ nữ Thái Lan', ethnicityMale: 'Nam giới Thái Lan', femaleHasHijab: false,
    femaleHair: ['Tóc đen dài thẳng', 'Tóc nâu dài gợn sóng', 'Tóc ngang vai', 'Tóc layer dài'],
    maleHair: ['Tóc ngắn gọn', 'Undercut', 'Tóc ngắn vuốt nhẹ', 'Fade haircut'],
    hairColor: ['Đen', 'Nâu đen', 'Nâu'],
    skinTone: ['Da sáng', 'Ngăm vàng', 'Da trung bình', 'Nâu nhẹ'],
    eyeShape: ['Mắt hạnh nhân', 'Mắt to tròn', 'Mắt hơi xếch'],
    clothingFemale: ['Áo thun casual', 'Đầm nhẹ nhàng', 'Sơ mi mỏng + chân váy', 'Set đồ tươi mát'],
    clothingMale: ['Áo thun basic', 'Sơ mi vải mỏng', 'Áo polo', 'Hoodie casual'],
    makeup: ['Trang điểm tự nhiên', 'Makeup nhẹ trong trẻo', 'Không trang điểm', 'Makeup hằng ngày'],
    facialFeatures: ['Nét mặt tươi tắn', 'Gò má cao', 'Môi đầy đặn', 'Khuôn mặt thanh tú'],
  },
  my: {
    ethnicityFemale: 'Phụ nữ Malaysia theo đạo Hồi', ethnicityMale: 'Nam giới Malaysia (người Mã Lai)', femaleHasHijab: true,
    femaleHair: [...HIJAB_COLORS],
    maleHair: ['Tóc ngắn gọn', 'Tóc ngắn xoăn nhẹ', 'Fade haircut', 'Tóc đen ngắn tự nhiên', 'Cạo gọn'],
    hairColor: ['Đen', 'Nâu sẫm'],
    skinTone: ['Nâu vàng', 'Ngăm', 'Da trung bình', 'Nâu'],
    eyeShape: ['Mắt hạnh nhân', 'Mắt to tròn', 'Mắt một mí'],
    clothingFemale: ['Trang phục kín đáo lịch sự', 'Đồ Hồi giáo modest hằng ngày', 'Áo dài tay phối váy', 'Modest athleisure'],
    clothingMale: ['Áo thun casual', 'Sơ mi batik nhẹ', 'Áo polo', 'Trang phục Mã Lai truyền thống nhẹ nhàng'],
    makeup: ['Trang điểm tự nhiên', 'Makeup nhẹ', 'Không trang điểm', 'Makeup hằng ngày'],
    facialFeatures: ['Nét mặt hiền hòa', 'Gò má cao', 'Khuôn mặt phúc hậu', 'Nét mặt dịu dàng'],
  },
  us: {
    ethnicityFemale: 'Phụ nữ Mỹ', ethnicityMale: 'Nam giới Mỹ', femaleHasHijab: false,
    femaleHair: ['Tóc vàng dài gợn sóng', 'Tóc nâu dài thẳng', 'Tóc bob', 'Tóc xoăn tự nhiên', 'Tóc búi rối', 'Tóc layer mái rèm'],
    maleHair: ['Tóc ngắn gọn', 'Undercut', 'Tóc xoăn ngắn', 'Buzz cut', 'Fade haircut'],
    hairColor: ['Vàng', 'Nâu', 'Đen', 'Nâu đỏ (auburn)', 'Bạch kim'],
    skinTone: ['Trắng', 'Da sáng', 'Ngăm rám nắng', 'Nâu', 'Da đen'],
    eyeShape: ['Mắt hạnh nhân', 'Mắt to tròn', 'Mắt hơi cụp', 'Mắt sâu'],
    clothingFemale: ['Áo thun + quần jean', 'Set đồ tối giản', 'Áo len dệt kim', 'Đầm casual', 'Áo blazer smart casual'],
    clothingMale: ['Áo thun basic', 'Sơ mi flannel', 'Áo hoodie', 'Áo polo'],
    makeup: ['Trang điểm tự nhiên', 'Makeup nhẹ', 'Không trang điểm', 'Makeup hằng ngày'],
    facialFeatures: ['Tàn nhang nhẹ', 'Gò má cao', 'Quai hàm thanh', 'Nét mặt tự nhiên'],
  },
  cn: {
    ethnicityFemale: 'Phụ nữ Trung Quốc', ethnicityMale: 'Nam giới Trung Quốc', femaleHasHijab: false,
    femaleHair: ['Tóc đen dài thẳng', 'Tóc đen ngang vai', 'Tóc bob', 'Tóc buộc nửa đầu', 'Tóc layer mái thưa'],
    maleHair: ['Tóc ngắn gọn', 'Undercut', 'Tóc ngắn vuốt nhẹ', 'Tóc đen ngắn tự nhiên'],
    hairColor: ['Đen', 'Nâu đen'],
    skinTone: ['Trắng', 'Trắng sáng', 'Da trung bình'],
    eyeShape: ['Mắt một mí', 'Mắt hạnh nhân', 'Mắt hơi xếch', 'Mắt to tròn'],
    clothingFemale: ['Áo thun tối giản', 'Sơ mi thanh lịch', 'Áo len dệt kim', 'Set đồ trẻ trung', 'Váy nhẹ nhàng'],
    clothingMale: ['Áo thun basic', 'Sơ mi smart casual', 'Áo polo', 'Hoodie tối giản'],
    makeup: ['Trang điểm tự nhiên', 'Makeup trong veo kiểu Đông Á', 'Không trang điểm', 'Makeup nhẹ'],
    facialFeatures: ['Nét mặt thanh tú', 'Gò má cao', 'Da trắng mịn', 'Nét mặt dịu dàng'],
  },
  eu: {
    ethnicityFemale: 'Phụ nữ châu Âu', ethnicityMale: 'Nam giới châu Âu', femaleHasHijab: false,
    femaleHair: ['Tóc vàng dài thẳng', 'Tóc nâu dài gợn sóng', 'Tóc bob', 'Tóc layer mái rèm', 'Tóc búi rối tự nhiên'],
    maleHair: ['Tóc ngắn gọn', 'Undercut', 'Tóc nâu ngắn vuốt', 'Tóc xoăn nhẹ'],
    hairColor: ['Vàng', 'Nâu', 'Nâu sẫm', 'Nâu đỏ (auburn)'],
    skinTone: ['Trắng', 'Da sáng', 'Trắng hồng', 'Ngăm nhẹ'],
    eyeShape: ['Mắt to tròn', 'Mắt hạnh nhân', 'Mắt sâu', 'Mắt hơi cụp'],
    clothingFemale: ['Áo thun + quần jean', 'Set đồ tối giản kiểu Âu', 'Áo len dệt kim', 'Đầm casual thanh lịch', 'Blazer smart casual'],
    clothingMale: ['Áo thun basic', 'Sơ mi linen', 'Áo hoodie', 'Áo polo'],
    makeup: ['Trang điểm tự nhiên', 'Makeup nhẹ', 'Không trang điểm', 'Makeup hằng ngày'],
    facialFeatures: ['Tàn nhang nhẹ', 'Gò má cao', 'Quai hàm thanh', 'Nét mặt tự nhiên'],
  },
}

// Prop-free UGC scenes (Vietnamese). buildImagePrompt re-adds the hard English
// "EMPTY HANDS / no props" rule, so the avatar stays clean for downstream tools.
interface UGCScenario {
  location: string; background: string; lighting: string; weather: string
  timeOfDay: string; pose: string; action: string; shotType: string; cameraDevice: string
}
const UGC_SCENARIOS: UGCScenario[] = [
  {
    location: 'Phòng ngủ', background: 'Tường trơn / nền mờ tối giản',
    lighting: 'Ánh sáng cửa sổ tự nhiên, dịu, đổ nhẹ lên gò má, da chân thật',
    weather: 'Trong nhà', timeOfDay: 'Buổi sáng',
    pose: 'Ngồi thẳng, chính diện, mặt hướng thẳng vào ống kính',
    action: 'Nói chuyện trực tiếp với camera, giao tiếp mắt chân thật',
    shotType: 'Cận trung (từ ngực lên)', cameraDevice: 'iPhone Front Cam đặt trên tripod',
  },
  {
    location: 'Phòng khách', background: 'Nội thất nhà mờ ảo, có cửa sổ một bên',
    lighting: 'Ánh sáng cửa sổ tự nhiên dịu nhẹ',
    weather: 'Trong nhà', timeOfDay: 'Buổi chiều',
    pose: 'Đứng hoặc ngồi cạnh cửa sổ, người hơi nghiêng về phía ánh sáng, mặt chính diện camera',
    action: 'Nhìn thẳng vào camera với biểu cảm thân thiện tự nhiên',
    shotType: 'Cận trung (từ ngực lên)', cameraDevice: 'iPhone Front Cam đặt trên tripod',
  },
  {
    location: 'Bàn làm việc', background: 'Tường trơn / nền tối giản',
    lighting: 'Đèn ring light (kiểu influencer), phản chiếu nhẹ trong mắt',
    weather: 'Trong nhà', timeOfDay: 'Buổi tối',
    pose: 'Ngồi ở bàn, chính diện, mặt hướng thẳng vào ống kính',
    action: 'Nói chuyện với camera, giao tiếp mắt tự tin',
    shotType: 'Cận mặt', cameraDevice: 'Đèn ring light kèm điện thoại trên tripod',
  },
  {
    location: 'Công viên ngoài trời / quán cà phê', background: 'Nền mờ, cây xanh / ánh sáng cửa sổ',
    lighting: 'Ánh sáng tự nhiên dịu / giờ vàng',
    weather: 'Nắng nhẹ', timeOfDay: 'Buổi sáng',
    pose: 'Đứng hoặc ngồi, người và mặt chính diện, nhìn thẳng camera',
    action: 'Nói chuyện với camera, nụ cười tự tin tự nhiên',
    shotType: 'Cận trung (từ ngực lên)', cameraDevice: 'iPhone Front Cam đặt trên tripod',
  },
]

/** Build a random, culturally-coherent UGC avatar profile for the given country.
 *  Values are Vietnamese; generateCharacter translates to English at gen time. */
export function generateRandomUGCProfile(countryKey = 'vn'): CharacterProfile {
  const c = COUNTRY_CULTURE[countryKey] ?? COUNTRY_CULTURE.vn
  const gender = pickRandom(['Nữ', 'Nam'])
  const isFemale = gender === 'Nữ'

  const hairStyle = pickRandom(isFemale ? c.femaleHair : c.maleHair)
  const wearsHijab = isFemale && c.femaleHasHijab && hairStyle.includes('Khăn')
  const hairColor = wearsHijab ? '' : pickRandom(c.hairColor)
  const hairTexture = wearsHijab ? '' : pickRandom(['Thẳng', 'Gợn sóng', 'Xoăn'])
  const facialHair = isFemale ? '' : pickRandom(['Không', 'Cạo nhẵn', 'Râu lún phún', 'Râu ngắn'])

  const scene = pickRandom(UGC_SCENARIOS)

  return {
    gender,
    age: pickRandom(['18-24', '20s', '25-30', '30-40']),
    ethnicity: isFemale ? c.ethnicityFemale : c.ethnicityMale,
    bodyType: pickRandom(['Mảnh mai', 'Cân đối', 'Trung bình', 'Đầy đặn']),
    skinTone: pickRandom(c.skinTone),
    skinTexture: pickRandom(['Da căng mịn, lỗ chân lông nhỏ tự nhiên', 'Da tự nhiên có lỗ chân lông', 'Da mịn tự nhiên', 'Da có kết cấu thật, hơi không hoàn hảo']),
    eyeColor: pickRandom(['Nâu', 'Nâu đen', 'Nâu hạt dẻ', 'Đen']),
    eyeShape: pickRandom(c.eyeShape),
    hairColor,
    hairStyle,
    hairTexture,
    facialFeatures: pickRandom(c.facialFeatures),
    facialHair,
    distinguishingMarks: pickRandom(['Không', 'Nốt ruồi duyên', 'Má lúm', 'Không', 'Không']),
    clothingStyle: pickRandom(isFemale ? c.clothingFemale : c.clothingMale),
    accessories: pickRandom(['Không', 'Bông tai nhỏ', 'Đồng hồ', 'Kính', 'Không']),
    makeup: isFemale ? pickRandom(c.makeup) : 'Không',
    ...scene,
    expression: pickRandom(['Cười tự nhiên', 'Cười tươi chân thật', 'Hào hứng', 'Đang nói dở câu', 'Cười tự nhiên']),
    cameraAngle: 'Ngang tầm mắt',
    aspectRatio: 'Portrait (9:16)',  // structural value — kept English for the size logic
  }
}
