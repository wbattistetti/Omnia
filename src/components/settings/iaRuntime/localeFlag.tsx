/**
 * Maps BCP-47 locale string to ISO 3166-1 alpha-2 for emoji flags / labels.
 */

const ISO2_OVERRIDES: Record<string, string> = {
  'en-US': 'US',
  'en-GB': 'GB',
  'pt-BR': 'BR',
  'pt-PT': 'PT',
  'zh-CN': 'CN',
  'zh-TW': 'TW',
  'ja-JP': 'JP',
  'ko-KR': 'KR',
  'ar-SA': 'SA',
  'hi-IN': 'IN',
  'nl-NL': 'NL',
  'sv-SE': 'SE',
  'da-DK': 'DK',
  'fi-FI': 'FI',
  'no-NO': 'NO',
  'pl-PL': 'PL',
  'ru-RU': 'RU',
  'tr-TR': 'TR',
  'uk-UA': 'UA',
  'cs-CZ': 'CZ',
  'el-GR': 'GR',
  'he-IL': 'IL',
  'id-ID': 'ID',
  'ms-MY': 'MY',
  'th-TH': 'TH',
  'vi-VN': 'VN',
  'it-IT': 'IT',
  'fr-FR': 'FR',
  'de-DE': 'DE',
  'es-ES': 'ES',
};

export function localeToIso2(locale: string): string | null {
  const n = locale.trim();
  if (!n) return null;
  const direct = ISO2_OVERRIDES[n];
  if (direct) return direct;
  const parts = n.split(/[-_]/);
  if (parts.length >= 2 && parts[1].length === 2) return parts[1].toUpperCase();
  if (parts[0].length === 2) return parts[0].toUpperCase();
  return null;
}
