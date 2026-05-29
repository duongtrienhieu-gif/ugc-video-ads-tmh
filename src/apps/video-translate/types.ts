export type TranslationStatus =
  | 'pending'
  | 'extracting'   // extracting frame + uploading source
  | 'dubbing'      // ElevenLabs dubbing in progress
  | 'lipsyncing'   // KIE.ai lip-sync generation in progress
  | 'dubbed'       // final video ready
  | 'failed'

/** Translation pipeline mode chosen by user per job.
 *  - 'lip-sync'   = ElevenLabs Dubbing + fal.ai LatentSync (matches mouth to new audio)
 *  - 'voice-only' = ElevenLabs Dubbing only — uses ElevenLabs' /video endpoint
 *    which already mixes dubbed audio into the original video. Faster + cheaper
 *    (no fal.ai credit) but lips won't match — suitable for voiceover, product
 *    demos, screen recordings where no face is on camera. */
export type TranslationMode = 'lip-sync' | 'voice-only'

export interface TranslationItem {
  id: string                   // local id (UUID)
  dubbingId: string            // ElevenLabs dubbing_id
  name: string                 // filename or user label
  sourceLang: string           // ISO-639-1 code (vi/en/ms/...). Phase 1: no more 'auto'
  targetLang: string           // ISO-639-1 code
  status: TranslationStatus
  /** Pipeline mode chosen at job creation. Optional for backward compat with
   *  history items created before this field existed — fallback to 'lip-sync'. */
  mode?: TranslationMode
  /** Phase B — voice mode chosen at job creation. true = used ElevenLabs Voice
   *  Library (native accent for target lang). false/undefined = voice cloning
   *  of original speaker (foreigner accent). Persisted so history can show
   *  which choice was made + future resume logic could re-trigger. */
  disableVoiceCloning?: boolean
  videoUrl: string | null      // transient signed URL (regenerated on load)
  assetId: string | null       // final video Supabase ref (permanent) — lip-synced (mode=lip-sync) or ElevenLabs-dubbed (mode=voice-only)
  audioAssetId?: string | null // dubbed audio Supabase ref (permanent) — only set for lip-sync mode (fed to fal.ai)
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
