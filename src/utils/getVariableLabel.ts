/**
 * Single source of truth for variable display labels in the UI (GUID-centric migration).
 * Labels come from project translations keyed by variable id; never use varName/dataPath as label text.
 */

/**
 * Returns the display label for a variable GUID using the project translations map.
 *
 * @param id - Variable id (TaskTreeNode id or manual/subflow GUID).
 * @param translations - Project locale translation table `{ [guid]: text }`.
 * @param fallback - Optional debug/legacy fallback when the key is missing (omit in production paths).
 */
export function getVariableLabel(
  id: string,
  translations: Record<string, string> | null | undefined,
  fallback?: string
): string {
  const key = String(id || '').trim();
  if (!key) {
    return fallback ?? '';
  }
  const table = translations && typeof translations === 'object' ? translations : {};
  const raw = table[key];
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim();
  }
  if (fallback != null && String(fallback).trim() !== '') {
    return String(fallback).trim();
  }
  return '';
}
