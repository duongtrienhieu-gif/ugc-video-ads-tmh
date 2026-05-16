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

// UGC scenario: guarantees subject always faces camera directly
interface UGCScenario {
  location: string
  background: string
  lighting: string
  weather: string
  timeOfDay: string
  pose: string
  action: string
  shotType: string
  cameraDevice: string
}

// All scenarios are explicitly PROP-FREE — the avatar must never be holding a
// phone, cup, glass, product, or any other object. UGC Creator generates a
// CLEAN avatar that downstream tools (Product AI, B-Roll) compose with the
// actual product later. Props in the avatar would conflict with that pipeline.
const UGC_SCENARIOS: UGCScenario[] = [
  // 1. Classic talking-head — face-to-camera, hands out of frame
  {
    location: pickRandom(['Bedroom', 'Living room', 'Kitchen']),
    background: pickRandom(['Neutral wall', 'Blurred background', 'Minimalist']),
    lighting: 'Soft, diffused natural window light, creating gentle highlights on the cheekbones and realistic subsurface scattering on the skin',
    weather: 'Indoor (N/A)',
    timeOfDay: pickRandom(['Morning', 'Afternoon']),
    pose: 'Front-on, sitting upright, face directed straight at camera lens, hands relaxed below frame',
    action: 'Speaking directly to camera, genuine direct eye contact with viewer. EMPTY HANDS — no phone, no cup, no objects in hands',
    shotType: 'Medium close-up (chest up)',
    cameraDevice: pickRandom(['iPhone selfie cam on tripod', 'iPhone Front Cam']),
  },
  // 2. Window-side soft-light portrait — replaces the old "mirror selfie" so
  //    the model has no excuse to render a phone in hand
  {
    location: pickRandom(['Bedroom', 'Living room']),
    background: 'Soft blurred home interior, window visible to one side',
    lighting: pickRandom(['Soft natural light', 'Natural Window Light']),
    weather: 'Indoor (N/A)',
    timeOfDay: pickRandom(['Morning', 'Afternoon']),
    pose: 'Standing or sitting near a window, body slightly angled toward the light, face front-on to camera, hands relaxed at sides',
    action: 'Looking directly at the camera with a natural friendly expression. EMPTY HANDS — no phone, no cup, no objects in hands',
    shotType: 'Medium close-up (chest up)',
    cameraDevice: 'iPhone Front Cam on tripod',
  },
  // 3. Ring-light creator setup — phone on tripod (not in hand)
  {
    location: pickRandom(['Bedroom', 'Living room']),
    background: pickRandom(['Neutral wall', 'Minimalist', 'Blurred background']),
    lighting: 'Ring Light (Influencer)',
    weather: 'Indoor (N/A)',
    timeOfDay: 'Evening',
    pose: 'Front-on, sitting at desk, face directed straight at camera, hands relaxed below frame',
    action: 'Speaking to camera with confident direct eye contact, ring light reflected in eyes. EMPTY HANDS — no phone, no cup, no objects in hands',
    shotType: 'Close-up face',
    cameraDevice: 'Ring light with phone on tripod',
  },
  // 4. Outdoor casual portrait — replaces the old "holding phone for selfie"
  {
    location: pickRandom(['Outdoors park', 'Coffee shop']),
    background: pickRandom(['Blurred background', 'Plants', 'Window with natural light']),
    lighting: pickRandom(['Soft natural light', 'Golden Hour']),
    weather: pickRandom(['Sunny', 'Overcast']),
    timeOfDay: pickRandom(['Morning', 'Midday', 'Afternoon']),
    pose: 'Standing or seated, body and face front-on, looking directly at camera, hands relaxed at sides',
    action: 'Speaking to camera with a natural confident smile. EMPTY HANDS — no phone, no cup, no glass, no products or objects in hands',
    shotType: 'Medium close-up (chest up)',
    cameraDevice: 'iPhone Front Cam on tripod',
  },
]

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

  // Pick one scenario — all guarantee face-to-camera
  const scene = pickRandom(UGC_SCENARIOS)

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
    ...scene,
    expression: pickRandom(['Natural smile', 'Genuine smile', 'Excited', 'Mid-sentence', 'Natural smile']),
    cameraAngle: 'Eye Level',
    aspectRatio: 'Portrait (9:16)',
  }
}
