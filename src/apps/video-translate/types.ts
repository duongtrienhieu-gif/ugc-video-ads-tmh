export type TranslationStatus = 'pending' | 'processing' | 'dubbed' | 'failed'

export interface TranslationItem {
  id: string                   // local id (UUID)
  dubbingId: string            // ElevenLabs dubbing_id
  name: string                 // filename or user label
  sourceLang: string           // 'auto' or ISO-639-1 code
  targetLang: string           // ISO-639-1 code
  status: TranslationStatus
  videoUrl: string | null      // local blob URL after download
  assetId: string | null       // saved Supabase asset ref
  errorMessage?: string
  expectedDurationSec?: number
  createdAt: number
}

export interface Language {
  code: string
  label: string
  flag: string
}

export const SOURCE_LANGUAGES: Language[] = [
  { code: 'auto', label: 'Tự động nhận diện', flag: '🔍' },
  { code: 'en',   label: 'Tiếng Anh',         flag: '🇺🇸' },
  { code: 'vi',   label: 'Tiếng Việt',         flag: '🇻🇳' },
  { code: 'ms',   label: 'Tiếng Malay',        flag: '🇲🇾' },
  { code: 'zh',   label: 'Tiếng Trung',        flag: '🇨🇳' },
  { code: 'ja',   label: 'Tiếng Nhật',         flag: '🇯🇵' },
  { code: 'ko',   label: 'Tiếng Hàn',          flag: '🇰🇷' },
  { code: 'es',   label: 'Tiếng Tây Ban Nha',  flag: '🇪🇸' },
  { code: 'fr',   label: 'Tiếng Pháp',         flag: '🇫🇷' },
  { code: 'de',   label: 'Tiếng Đức',          flag: '🇩🇪' },
  { code: 'id',   label: 'Tiếng Indonesia',    flag: '🇮🇩' },
]

export const TARGET_LANGUAGES: Language[] = [
  { code: 'en',   label: 'Tiếng Anh',         flag: '🇺🇸' },
  { code: 'ms',   label: 'Tiếng Malay',        flag: '🇲🇾' },
  { code: 'zh',   label: 'Tiếng Trung',        flag: '🇨🇳' },
  { code: 'ja',   label: 'Tiếng Nhật',         flag: '🇯🇵' },
  { code: 'ko',   label: 'Tiếng Hàn',          flag: '🇰🇷' },
  { code: 'es',   label: 'Tiếng Tây Ban Nha',  flag: '🇪🇸' },
  { code: 'fr',   label: 'Tiếng Pháp',         flag: '🇫🇷' },
  { code: 'de',   label: 'Tiếng Đức',          flag: '🇩🇪' },
  { code: 'id',   label: 'Tiếng Indonesia',    flag: '🇮🇩' },
  { code: 'hi',   label: 'Tiếng Hindi',        flag: '🇮🇳' },
  { code: 'pt',   label: 'Tiếng Bồ Đào Nha',  flag: '🇧🇷' },
  { code: 'ru',   label: 'Tiếng Nga',          flag: '🇷🇺' },
  { code: 'ar',   label: 'Tiếng Ả Rập',        flag: '🇸🇦' },
  { code: 'vi',   label: 'Tiếng Việt ⚠️',      flag: '🇻🇳' },
]
