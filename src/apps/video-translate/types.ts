export type TranslationStatus =
  | 'pending'
  | 'extracting'   // extracting frame + uploading source
  | 'dubbing'      // ElevenLabs dubbing in progress
  | 'lipsyncing'   // KIE.ai lip-sync generation in progress
  | 'dubbed'       // final video ready
  | 'failed'

export interface TranslationItem {
  id: string                   // local id (UUID)
  dubbingId: string            // ElevenLabs dubbing_id
  name: string                 // filename or user label
  sourceLang: string           // ISO-639-1 code (vi/en/ms/...). Phase 1: no more 'auto'
  targetLang: string           // ISO-639-1 code
  status: TranslationStatus
  videoUrl: string | null      // transient signed URL (regenerated on load)
  assetId: string | null       // final lip-synced video Supabase ref (permanent)
  audioAssetId?: string | null // dubbed audio Supabase ref (permanent)
  imageAssetId?: string | null // extracted frame Supabase ref (permanent)
  /** Phase 5: persist fal.ai LatentSync request id so we can resume after F5 */
  lipSyncRequestId?: string
  errorMessage?: string
  /** Phase 4: full raw API error body for debugging (not truncated) */
  rawErrorBody?: string
  expectedDurationSec?: number
  createdAt: number
}

export interface Language {
  code: string
  label: string
  flag: string
}

// Phase 1: auto-detect removed — too unreliable with TikTok audio / mixed langs.
// User must pick source language explicitly. This dramatically reduces failed
// dubbing jobs (ElevenLabs auto-detect was returning wrong locale ~30% of time
// on mixed-language UGC clips).
export const SOURCE_LANGUAGES: Language[] = [
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

/** Whitelist of valid ISO-639-1 codes accepted by our pipeline. */
export const VALID_SOURCE_CODES = new Set<string>(SOURCE_LANGUAGES.map((l) => l.code))
export const VALID_TARGET_CODES = new Set<string>(['en', 'ms', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'id', 'hi', 'pt', 'ru', 'ar', 'vi'])

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
