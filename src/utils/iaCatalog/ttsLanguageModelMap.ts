/**
 * Resolve TTS allowed `model_id` list by locale from runtime-scoped per-language map.
 */

function primaryLang(locale: string): string {
  return String(locale || '')
    .trim()
    .toLowerCase()
    .split('-')[0];
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
}

/**
 * Returns `null` when no scoped rule exists for the locale (caller should not filter).
 * Returns `string[]` when a scoped rule exists (empty array means explicit deny-all).
 */
export function resolveScopedTtsModelIds(
  perLanguage: Record<string, string[]> | undefined,
  locale: string | undefined
): string[] | null {
  if (!perLanguage || typeof perLanguage !== 'object') return null;
  const full = String(locale || '').trim();
  if (!full) return null;

  if (Object.prototype.hasOwnProperty.call(perLanguage, full)) {
    return normalizeList(perLanguage[full]);
  }

  const p = primaryLang(full);
  if (Object.prototype.hasOwnProperty.call(perLanguage, p)) {
    return normalizeList(perLanguage[p]);
  }

  const samePrimary = Object.keys(perLanguage).filter((k) => primaryLang(k) === p);
  if (samePrimary.length > 0) {
    samePrimary.sort((a, b) => {
      const ra = a.split('-').filter(Boolean).length;
      const rb = b.split('-').filter(Boolean).length;
      if (rb !== ra) return rb - ra;
      return b.length - a.length;
    });
    return normalizeList(perLanguage[samePrimary[0]]);
  }

  return null;
}
