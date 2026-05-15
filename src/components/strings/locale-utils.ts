/**
 * Locale name mappings for xcstrings files
 * xcstrings uses standard BCP 47 locale codes which differ from App Store Connect codes
 */

// Comprehensive mapping of BCP 47 locale codes to display names
// Includes all 40 App Store Connect locales plus common additional languages
export const XCSTRINGS_LOCALES: Record<string, string> = {
  // Base languages (alphabetical order)
  'af': 'Afrikaans',
  'am': 'Amharic',
  'ar': 'Arabic',
  'az': 'Azerbaijani',
  'bg': 'Bulgarian',
  'bn': 'Bengali',
  'bs': 'Bosnian',
  'ca': 'Catalan',
  'cs': 'Czech',
  'cy': 'Welsh',
  'da': 'Danish',
  'de': 'German',
  'el': 'Greek',
  'en': 'English',
  'es': 'Spanish',
  'et': 'Estonian',
  'eu': 'Basque',
  'fi': 'Finnish',
  'fil': 'Filipino',
  'fr': 'French',
  'ga': 'Irish',
  'gl': 'Galician',
  'gu': 'Gujarati',
  'he': 'Hebrew',
  'hi': 'Hindi',
  'hr': 'Croatian',
  'hu': 'Hungarian',
  'id': 'Indonesian',
  'is': 'Icelandic',
  'it': 'Italian',
  'ja': 'Japanese',
  'ka': 'Georgian',
  'kk': 'Kazakh',
  'km': 'Khmer',
  'kn': 'Kannada',
  'ko': 'Korean',
  'lo': 'Lao',
  'lt': 'Lithuanian',
  'lv': 'Latvian',
  'mk': 'Macedonian',
  'ml': 'Malayalam',
  'mr': 'Marathi',
  'ms': 'Malay',
  'my': 'Burmese',
  'nb': 'Norwegian Bokmål',
  'ne': 'Nepali',
  'nl': 'Dutch',
  'no': 'Norwegian',
  'pa': 'Punjabi',
  'pl': 'Polish',
  'pt': 'Portuguese',
  'ro': 'Romanian',
  'ru': 'Russian',
  'si': 'Sinhala',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'sq': 'Albanian',
  'sr': 'Serbian',
  'sv': 'Swedish',
  'sw': 'Swahili',
  'ta': 'Tamil',
  'te': 'Telugu',
  'th': 'Thai',
  'tr': 'Turkish',
  'uk': 'Ukrainian',
  'ur': 'Urdu',
  'uz': 'Uzbek',
  'vi': 'Vietnamese',
  'zh': 'Chinese',

  // Regional variants (App Store Connect codes + common extras)
  'ar-SA': 'Arabic (Saudi Arabia)',
  'de-AT': 'German (Austria)',
  'de-CH': 'German (Switzerland)',
  'de-DE': 'German (Germany)',
  'en-AU': 'English (Australia)',
  'en-CA': 'English (Canada)',
  'en-GB': 'English (UK)',
  'en-IN': 'English (India)',
  'en-US': 'English (US)',
  'es-419': 'Spanish (Latin America)',
  'es-ES': 'Spanish (Spain)',
  'es-MX': 'Spanish (Mexico)',
  'fr-CA': 'French (Canada)',
  'fr-FR': 'French (France)',
  'nl-BE': 'Dutch (Belgium)',
  'nl-NL': 'Dutch (Netherlands)',
  'pt-BR': 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  'zh-CN': 'Chinese (China)',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  'zh-HK': 'Chinese (Hong Kong)',
  'zh-TW': 'Chinese (Taiwan)',
}

/**
 * Get the display name for a locale code
 * Handles both full codes (en-US) and base codes (en)
 */
export function getXCStringsLocaleName(code: string): string {
  // Direct match
  if (XCSTRINGS_LOCALES[code]) {
    return XCSTRINGS_LOCALES[code]
  }

  // Try base language code (e.g., "en-US" -> "en")
  const baseCode = code.split('-')[0]
  if (XCSTRINGS_LOCALES[baseCode]) {
    // If we have a region code, append it
    if (code.includes('-')) {
      const region = code.split('-').slice(1).join('-')
      return `${XCSTRINGS_LOCALES[baseCode]} (${region})`
    }
    return XCSTRINGS_LOCALES[baseCode]
  }

  // Return the code itself as fallback
  return code
}
