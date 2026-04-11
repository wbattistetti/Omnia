/**
 * Display label for a variable GUID: only `var:<uuid>` in the provided translations map (active flow UI).
 * Missing key → returns the GUID. No other fallbacks.
 */

import { isUuidString, makeTranslationKey } from './translationKeys';
import { resolveTranslationEntryValue, type TranslationEntryValue } from './resolveTranslationEntry';

export function getVariableLabel(
  id: string,
  translations: Record<string, TranslationEntryValue> | null | undefined
): string {
  const rawId = String(id || '').trim();
  if (!rawId) {
    return '';
  }
  if (!isUuidString(rawId)) {
    return '';
  }
  const translationKey = makeTranslationKey('var', rawId);
  const table = translations && typeof translations === 'object' ? translations : {};
  const raw = table[translationKey];
  const resolved = resolveTranslationEntryValue(raw);
  if (resolved !== '') {
    return resolved;
  }
  return rawId;
}
