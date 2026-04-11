/**
 * Resolves flow.meta.translations values: plain string or per-locale object (var labels).
 */

/** Active project locale (matches ProjectTranslationsContext / API). */
export function getProjectLocale(): string {
  try {
    return String(localStorage.getItem('project.lang') || 'pt').trim() || 'pt';
  } catch {
    return 'pt';
  }
}

export type TranslationEntryValue = string | Record<string, string>;

/**
 * Returns the visible string for one translation entry (flat or `{ [locale]: text }`).
 */
export function resolveTranslationEntryValue(
  entry: TranslationEntryValue | undefined | null,
  locale?: string
): string {
  const loc = locale ?? getProjectLocale();
  if (entry == null) return '';
  if (typeof entry === 'string') return String(entry).trim();
  if (typeof entry === 'object' && !Array.isArray(entry)) {
    const o = entry as Record<string, string>;
    if (Object.prototype.hasOwnProperty.call(o, loc)) {
      return String(o[loc] ?? '').trim();
    }
    const first = Object.values(o).find((v) => v != null && String(v).trim() !== '');
    return first != null ? String(first).trim() : '';
  }
  return '';
}
