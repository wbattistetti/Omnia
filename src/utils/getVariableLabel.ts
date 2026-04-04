/**
 * Single source of truth for variable display labels in the UI.
 * Labels come from project translations keyed by `variable:<uuid>`; never use varName/dataPath as label text.
 */

import { isUuidString, makeTranslationKey } from './translationKeys';

/**
 * Returns the display label for a variable GUID using the project translations map.
 *
 * @param id - Variable id (UUID).
 * @param translations - Project locale translation table `{ [variable:uuid]: text }`.
 * @param fallback - Optional debug/legacy fallback when the key is missing (omit in production paths).
 */
export function getVariableLabel(
  id: string,
  translations: Record<string, string> | null | undefined,
  fallback?: string
): string {
  const rawId = String(id || '').trim();
  if (!rawId) {
    return fallback ?? '';
  }
  if (!isUuidString(rawId)) {
    if (fallback != null && String(fallback).trim() !== '') {
      return String(fallback).trim();
    }
    return '';
  }
  const translationKey = makeTranslationKey('variable', rawId);
  const table = translations && typeof translations === 'object' ? translations : {};
  const raw = table[translationKey];
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim();
  }
  if (fallback != null && String(fallback).trim() !== '') {
    return String(fallback).trim();
  }
  return '';
}
