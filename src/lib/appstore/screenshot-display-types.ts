/**
 * Human-readable labels for App Store Connect `screenshotDisplayType` values.
 *
 * Apple adds new display types whenever a new device size ships, so this map is
 * expected to be incomplete. `displayTypeLabel` falls back to deriving a label
 * from the raw enum rather than rendering a blank, and every call site keeps
 * the raw value on screen next to the label so a derived guess is always
 * verifiable.
 */

const DISPLAY_TYPE_LABELS: Record<string, string> = {
  // iPhone
  APP_IPHONE_69: 'iPhone 6.9"',
  APP_IPHONE_67: 'iPhone 6.7"',
  APP_IPHONE_65: 'iPhone 6.5"',
  APP_IPHONE_61: 'iPhone 6.1"',
  APP_IPHONE_58: 'iPhone 5.8"',
  APP_IPHONE_55: 'iPhone 5.5"',
  APP_IPHONE_47: 'iPhone 4.7"',
  APP_IPHONE_40: 'iPhone 4"',
  APP_IPHONE_35: 'iPhone 3.5"',

  // iPad
  APP_IPAD_PRO_3GEN_129: 'iPad Pro 12.9" (3rd gen)',
  APP_IPAD_PRO_3GEN_11: 'iPad Pro 11" (3rd gen)',
  APP_IPAD_PRO_129: 'iPad Pro 12.9"',
  APP_IPAD_13: 'iPad 13"',
  APP_IPAD_11: 'iPad 11"',
  APP_IPAD_105: 'iPad 10.5"',
  APP_IPAD_97: 'iPad 9.7"',

  // Other platforms
  APP_DESKTOP: 'Mac',
  APP_APPLE_TV: 'Apple TV',
  APP_APPLE_VISION_PRO: 'Apple Vision Pro',
  APP_WATCH_ULTRA: 'Apple Watch Ultra',
  APP_WATCH_SERIES_10: 'Apple Watch Series 10',
  APP_WATCH_SERIES_7: 'Apple Watch Series 7',
  APP_WATCH_SERIES_4: 'Apple Watch Series 4',
  APP_WATCH_SERIES_3: 'Apple Watch Series 3',

  // iMessage app screenshots live in their own display types
  IMESSAGE_APP_IPHONE_67: 'iMessage — iPhone 6.7"',
  IMESSAGE_APP_IPHONE_65: 'iMessage — iPhone 6.5"',
  IMESSAGE_APP_IPHONE_61: 'iMessage — iPhone 6.1"',
  IMESSAGE_APP_IPHONE_58: 'iMessage — iPhone 5.8"',
  IMESSAGE_APP_IPHONE_55: 'iMessage — iPhone 5.5"',
  IMESSAGE_APP_IPHONE_47: 'iMessage — iPhone 4.7"',
  IMESSAGE_APP_IPHONE_40: 'iMessage — iPhone 4"',
  IMESSAGE_APP_IPAD_PRO_3GEN_129: 'iMessage — iPad Pro 12.9" (3rd gen)',
  IMESSAGE_APP_IPAD_PRO_3GEN_11: 'iMessage — iPad Pro 11" (3rd gen)',
  IMESSAGE_APP_IPAD_PRO_129: 'iMessage — iPad Pro 12.9"',
  IMESSAGE_APP_IPAD_105: 'iMessage — iPad 10.5"',
  IMESSAGE_APP_IPAD_97: 'iMessage — iPad 9.7"',
}

const DEVICE_WORDS: Record<string, string> = {
  IPHONE: 'iPhone',
  IPAD: 'iPad',
  IPOD: 'iPod',
  WATCH: 'Apple Watch',
  TV: 'Apple TV',
  DESKTOP: 'Mac',
  PRO: 'Pro',
  GEN: 'gen',
  APPLE: 'Apple',
  VISION: 'Vision',
  ULTRA: 'Ultra',
  SERIES: 'Series',
}

/**
 * Turn a size segment into inches. Apple encodes iPhone sizes as tenths
 * ("67" -> 6.7") and iPad sizes either as tenths ("129" -> 12.9") or whole
 * inches ("11" -> 11"), so three digits are always tenths and two digits are
 * tenths only when the device has no whole-inch sizes.
 */
function sizeLabel(digits: string, device: string | null): string | null {
  if (digits.length === 3) {
    return `${Number(digits) / 10}"`
  }
  if (digits.length === 2) {
    if (device === 'IPHONE' || device === 'IPOD') return `${Number(digits) / 10}"`
    return `${Number(digits)}"`
  }
  return null
}

/**
 * Label a `screenshotDisplayType`. Known values come from the map above;
 * anything else is derived from the enum (e.g. a future `APP_IPHONE_73`
 * becomes `iPhone 7.3"`). Returns the raw value unchanged if nothing can be
 * derived from it.
 */
export function displayTypeLabel(raw: string): string {
  const known = DISPLAY_TYPE_LABELS[raw]
  if (known) return known
  if (!raw) return 'Unknown display type'

  const isIMessage = raw.startsWith('IMESSAGE_APP_')
  const segments = raw.replace(/^IMESSAGE_APP_/, '').replace(/^APP_/, '').split('_')

  let device: string | null = null
  const words: string[] = []

  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      const size = sizeLabel(segment, device)
      words.push(size ?? segment)
      continue
    }
    const digitSuffix = segment.match(/^([A-Z]+)(\d+)$/)
    if (digitSuffix) {
      words.push(`${digitSuffix[1].charAt(0)}${digitSuffix[1].slice(1).toLowerCase()}${digitSuffix[2]}`)
      continue
    }
    if (!device) device = segment
    words.push(
      DEVICE_WORDS[segment] ??
        `${segment.charAt(0)}${segment.slice(1).toLowerCase()}`
    )
  }

  const label = words.join(' ').trim()
  if (!label) return raw
  return isIMessage ? `iMessage — ${label}` : label
}
