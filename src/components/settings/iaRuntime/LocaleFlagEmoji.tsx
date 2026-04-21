/**
 * Renders a regional-indicator emoji from ISO 3166-1 alpha-2 (locale resolved upstream).
 */

import { localeToIso2 } from './localeFlag';

function iso2ToRegionalEmoji(iso2: string): string {
  const up = iso2.toUpperCase();
  if (up.length !== 2 || !/^[A-Z]{2}$/.test(up)) return '🌐';
  const base = 0x1f1e6;
  const a = base + (up.charCodeAt(0) - 65);
  const b = base + (up.charCodeAt(1) - 65);
  return String.fromCodePoint(a, b);
}

export function LocaleFlagEmoji({ locale }: { locale: string }) {
  const iso = localeToIso2(locale);
  if (!iso) return <span className="text-xs opacity-60">🌐</span>;
  return (
    <span className="inline-block text-sm leading-none" title={locale}>
      {iso2ToRegionalEmoji(iso)}
    </span>
  );
}
