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
        chips: ['Nữ', 'Nam', 'Non-binary'],
      },
      {
        key: 'age',
        label: 'Độ tuổi',
        chips: ['18-24', '20s', '25-30', '30-40', '40-50', '50+'],
      },
      {
        key: 'ethnicity',
        label: 'Dân tộc',
        chips: ['Japanese', 'Norwegian', 'American', 'French mixed with Moroccan', 'South African', 'Caucasian', 'Black', 'Asian', 'Hispanic/Latino', 'Middle Eastern', 'South Asian', 'Mixed'],
      },
      {
        key: 'bodyType',
        label: 'Vóc dáng',
        chips: ['Slim', 'Athletic', 'Average', 'Curvy', 'Plus-size', 'Muscular'],
      },
      {
        key: 'skinTone',
        label: 'Màu da',
        chips: ['Fair', 'Light', 'Medium', 'Olive', 'Tan', 'Lightly sunkissed', 'Brown', 'Dark'],
      },
      {
        key: 'skinTexture',
        label: 'Kết cấu da',
        chips: [
          'Glass skin finish with ultra-detailed texture, including visible skin pores, fine peach fuzz, and a scattering of light freckles across the bridge of her nose',
          'Glass skin',
          'Natural pores',
          'Acne scarring',
          'Freckled',
          'Textured',
          'Mature lines',
          'Natural pores with slight imperfections',
        ],
        placeholder: 'e.g. "Glass skin with visible pores"',
      },
      {
        key: 'eyeColor',
        label: 'Màu mắt',
        chips: ['Brown', 'Blue', 'Green', 'Hazel', 'Gray', 'Amber', 'Dark brown'],
      },
      {
        key: 'eyeShape',
        label: 'Hình dạng mắt',
        chips: ['Almond', 'Round', 'Hooded', 'Monolid', 'Upturned', 'Downturned', 'Deep-set', 'Wide-set'],
      },
      {
        key: 'hairColor',
        label: 'Màu tóc',
        chips: ['Blonde', 'Brunette', 'Black', 'Red', 'Auburn', 'Gray', 'Platinum'],
      },
      {
        key: 'hairStyle',
        label: 'Kiểu tóc',
        chips: ['Long straight', 'Long wavy', 'Shoulder-length', 'Bob', 'Pixie cut', 'Ponytail', 'Messy bun', 'Braids', 'Curtain Bangs + Layers', 'Short textured', 'Buzz cut'],
      },
      {
        key: 'hairTexture',
        label: 'Kết cấu tóc',
        chips: ['Straight', 'Wavy', 'Curly', 'Coily', 'Kinky', 'Fine', 'Thick'],
      },
      {
        key: 'facialFeatures',
        label: 'Đặc điểm khuôn mặt',
        chips: ['Freckles', 'Sharp jawline', 'Soft features', 'High cheekbones', 'Full lips', 'Glasses'],
        placeholder: 'e.g. "Light freckles, soft smile"',
      },
      {
        key: 'facialHair',
        label: 'Râu/ria',
        chips: ['None', 'Clean-shaven', 'Stubble', 'Short beard', 'Full beard', 'Goatee', 'Mustache'],
      },
      {
        key: 'distinguishingMarks',
        label: 'Dấu hiệu đặc biệt',
        chips: ['None', 'Beauty mark', 'Dimples', 'Scar', 'Birthmark', 'Tattoo', 'Piercing'],
        placeholder: 'e.g. "Beauty mark on left cheek"',
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
        chips: ['Bedroom', 'Living room', 'Kitchen', 'Bathroom', 'Car interior', 'Gym', 'Coffee shop', 'Office', 'Outdoors park', 'Beach', 'Studio backdrop'],
      },
      {
        key: 'background',
        label: 'Chi tiết phông nền',
        chips: ['Neutral wall', 'Bookshelf', 'Plants', 'Bed with pillows', 'Kitchen counter', 'Car Interior', 'Blurred background', 'Window with natural light', 'Minimalist'],
        placeholder: 'e.g. "Clean white wall, small monstera plant"',
      },
      {
        key: 'lighting',
        label: 'Ánh sáng',
        chips: [
          'Soft, diffused natural window light, creating gentle highlights on the cheekbones and realistic subsurface scattering on the skin',
          'Soft natural light',
          'Golden Hour',
          'Ring Light (Influencer)',
          'Harsh Flash',
          'Dim Bedroom',
          'Natural Window Light',
          'Fluorescent office',
        ],
      },
      {
        key: 'weather',
        label: 'Thời tiết',
        chips: ['Sunny', 'Overcast', 'Rainy', 'Cloudy', 'Golden hour', 'Blue hour', 'Indoor (N/A)'],
      },
      {
        key: 'timeOfDay',
        label: 'Thời điểm trong ngày',
        chips: ['Morning', 'Midday', 'Afternoon', 'Golden hour', 'Evening', 'Night'],
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
        chips: ['Sitting on bed', 'Sitting on couch', 'Standing', 'Leaning on counter', 'Walking', 'Sitting in car', 'Front-on facing the camera', 'Laying down', 'Cross-legged on floor'],
      },
      {
        key: 'action',
        label: 'Hành động',
        chips: ['Speaking to camera', 'Holding product', 'Applying product', 'Unboxing', 'Pointing at something', 'Typing on phone', 'Sitting in drivers seat of car', 'Drinking from bottle', 'Showing before/after'],
        placeholder: 'e.g. "Holding product up next to face, showing label"',
      },
      {
        key: 'expression',
        label: 'Biểu cảm',
        chips: ['Natural smile', 'Genuine smile', 'Excited', 'Skeptical', 'Surprised', 'Thinking', 'Laughing', 'Serious/focused', 'Mid-sentence'],
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
        chips: ['Close-up face', 'Medium shot (waist up)', 'Third-Person Shot', 'Full body', 'Over-the-shoulder', 'Eye level', 'Low angle', 'High angle', 'Dutch angle'],
      },
      {
        key: 'cameraAngle',
        label: 'Góc máy',
        chips: ['Eye Level', 'Low angle', 'High angle', 'Bird\'s eye', 'Worm\'s eye', 'Dutch tilt', 'Over-the-shoulder'],
      },
      {
        key: 'cameraDevice',
        label: 'Thiết bị quay',
        chips: [
          'iPhone 15 Pro, casual UGC aesthetic',
          'iPhone 14 Pro',
          'iPhone Front Cam',
          'iPhone selfie cam',
          'iPhone rear camera',
          'DSLR shallow DOF',
          'Webcam',
          'GoPro wide',
          'Ring light + phone',
        ],
      },
      {
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

export function generateRandomUGCProfile(): CharacterProfile {
  const gender = pickRandom(['Female', 'Male'])
  const isFemale = gender === 'Female'
  const ethnicity = isFemale ? 'Malaysian female Islam' : 'Malaysian male Islam'

  const hairColor = isFemale ? '' : pickRandom(['Black', 'Dark brown', 'Brown', 'Auburn'])
  const hairStyle = isFemale
    ? pickRandom([
        'Islamic headscarf in coral pink',
        'Islamic headscarf in dusty rose',
        'Islamic headscarf in sage green',
        'Islamic headscarf in sky blue',
        'Islamic headscarf in ivory white',
        'Islamic headscarf in lavender',
        'Islamic headscarf in terracotta',
        'Islamic headscarf in soft beige',
      ])
    : pickRandom(['Short textured', 'Short curly', 'Buzz cut', 'Short wavy', 'Fade haircut'])
  const hairTexture = isFemale ? '' : pickRandom(['Straight', 'Wavy', 'Curly'])
  const facialHair = isFemale ? '' : pickRandom(['None', 'Clean-shaven', 'Stubble', 'Short beard', 'Light beard'])

  return {
    gender,
    age: pickRandom(['18-24', '20s', '25-30', '30-40']),
    ethnicity,
    bodyType: pickRandom(['Slim', 'Athletic', 'Average', 'Curvy']),
    skinTone: pickRandom(['Medium', 'Olive', 'Tan', 'Brown']),
    skinTexture: pickRandom([
      'Glass skin finish with ultra-detailed texture, including visible skin pores, fine peach fuzz, and a scattering of light freckles across the bridge of her nose',
      'Glass skin',
      'Natural pores',
      'Natural pores with slight imperfections',
      'Textured',
    ]),
    eyeColor: pickRandom(['Brown', 'Dark brown', 'Hazel', 'Amber']),
    eyeShape: pickRandom(['Almond', 'Round', 'Hooded', 'Monolid', 'Upturned']),
    hairColor,
    hairStyle,
    hairTexture,
    facialFeatures: pickRandom(['Soft features', 'High cheekbones', 'Full lips', 'Sharp jawline', 'Soft features, gentle eyes']),
    facialHair,
    distinguishingMarks: pickRandom(['None', 'Beauty mark', 'Dimples', 'None', 'None']),
    clothingStyle: isFemale
      ? pickRandom(['Modest casual', 'Traditional Islamic modest wear', 'Modest athleisure', 'Casual modest style'])
      : pickRandom(['Casual', 'Smart casual', 'Athleisure', 'Traditional Malay casual']),
    accessories: pickRandom(['None', 'Simple earrings', 'Watch', 'Glasses', 'None']),
    makeup: isFemale
      ? pickRandom(['Natural/minimal', 'Light natural makeup', 'No makeup', 'Soft everyday makeup'])
      : 'None',
    location: pickRandom(['Bedroom', 'Living room', 'Kitchen', 'Coffee shop', 'Outdoors park', 'Car interior']),
    background: pickRandom(['Neutral wall', 'Plants', 'Blurred background', 'Window with natural light', 'Minimalist', 'Bookshelf']),
    lighting: pickRandom([
      'Soft, diffused natural window light, creating gentle highlights on the cheekbones and realistic subsurface scattering on the skin',
      'Soft natural light',
      'Ring Light (Influencer)',
      'Natural Window Light',
      'Golden Hour',
    ]),
    weather: pickRandom(['Indoor (N/A)', 'Sunny', 'Overcast', 'Indoor (N/A)', 'Indoor (N/A)']),
    timeOfDay: pickRandom(['Morning', 'Midday', 'Afternoon', 'Evening']),
    pose: pickRandom(['Sitting on bed', 'Sitting on couch', 'Standing', 'Front-on facing the camera', 'Leaning on counter']),
    action: pickRandom(['Speaking to camera', 'Holding product', 'Applying product', 'Pointing at something', 'Speaking to camera']),
    expression: pickRandom(['Natural smile', 'Genuine smile', 'Excited', 'Thinking', 'Mid-sentence', 'Natural smile']),
    shotType: pickRandom(['Close-up face', 'Medium shot (waist up)', 'Medium shot (waist up)', 'Full body']),
    cameraAngle: pickRandom(['Eye Level', 'Low angle', 'High angle', 'Eye Level']),
    cameraDevice: pickRandom([
      'iPhone 15 Pro, casual UGC aesthetic',
      'iPhone Front Cam',
      'iPhone selfie cam',
      'Ring light + phone',
    ]),
    aspectRatio: 'Portrait (9:16)',
  }
}
