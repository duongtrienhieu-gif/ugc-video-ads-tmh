// Map ISO-639-1 → English label used when prompting Gemini (English labels
// are more reliable than ISO codes for the LLM to interpret correctly).
const LABELS: Record<string, string> = {
  en: 'English',
  vi: 'Vietnamese',
  ms: 'Malay',
  id: 'Indonesian',
  zh: 'Chinese (Mandarin)',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
}

export function getLangLabel(code: string): string {
  return LABELS[code] ?? code.toUpperCase()
}
