export type TranslationStatus =
  | 'pending'
  | 'extracting'   // extracting frame / audio from source video
  | 'transcribing' // Gemini transcribing source audio
  | 'translating'  // Gemini translating + condensing text
  | 'synthesizing' // ElevenLabs TTS rendering target audio
  | 'dubbing'      // legacy ElevenLabs Dubbing path (lip-sync mode)
  | 'lipsyncing'   // KIE.ai lip-sync generation in progress
  | 'muxing'       // ffmpeg.wasm muxing audio into video
  | 'dubbed'       // final video ready
  | 'failed'

/** Translation pipeline mode chosen by user per job.
 *  - 'lip-sync'   = ElevenLabs Dubbing + fal.ai LatentSync (matches mouth to new audio)
 *  - 'voice-only' = Smart-condense pipeline: Gemini transcribe → Gemini translate
 *    (condensed to fit duration) → ElevenLabs TTS with user-picked voice →
 *    ffmpeg mux into video. Natural-speed audio, no auto-compression artifacts,
 *    no end-of-content cut. Lips won't match — suitable for voiceover, product
 *    demos, screen recordings where face isn't the focus. */
export type TranslationMode = 'lip-sync' | 'voice-only'

/** How aggressively Gemini condenses the translation to fit video duration.
 *  - 'verbatim'   = no condense; full translation, video extends (hold last frame)
 *  - 'light'      = drop filler ('uh', 'you know'); default, balanced
 *  - 'aggressive' = strict fit, may drop nuance to guarantee duration match */
export type CondenseLevel = 'verbatim' | 'light' | 'aggressive'

export interface TranslationItem {
  id: string                   // local id (UUID)
  dubbingId: string            // ElevenLabs dubbing_id (lip-sync mode only)
  name: string                 // filename or user label
  sourceLang: string           // ISO-639-1 code (vi/en/ms/...). Phase 1: no more 'auto'
  targetLang: string           // ISO-639-1 code
  status: TranslationStatus
  /** Pipeline mode chosen at job creation. Optional for backward compat with
   *  history items created before this field existed — fallback to 'lip-sync'. */
  mode?: TranslationMode
  /** Voice-only (smart-condense) — voice picked for TTS. Holds ElevenLabs
   *  voice_id (user's cloned voice OR library voice for target lang). */
  voiceId?: string
  voiceName?: string           // display name for UI badge
  /** Voice-only — condense aggressiveness. Defaults to 'light' if undefined. */
  condenseLevel?: CondenseLevel
  /** Legacy lip-sync / old voice-only flag — kept for backward-compat reads of
   *  history items from before the smart-condense pipeline. */
  disableVoiceCloning?: boolean
  videoUrl: string | null      // transient signed URL (regenerated on load)
  assetId: string | null       // final video Supabase ref (permanent) — lip-synced (mode=lip-sync) or muxed (mode=voice-only)
  audioAssetId?: string | null // dubbed/synthesized audio Supabase ref (permanent)
  imageAssetId?: string | null // extracted frame Supabase ref (permanent)
  /** Phase 5: persist fal.ai LatentSync request id so we can resume after F5 */
  lipSyncRequestId?: string
  errorMessage?: string
  /** Phase 4: full raw API error body for debugging (not truncated) */
  rawErrorBody?: string
  expectedDurationSec?: number
  /** Voice-only — final translated text Gemini produced (what TTS spoke). */
  translatedText?: string
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
