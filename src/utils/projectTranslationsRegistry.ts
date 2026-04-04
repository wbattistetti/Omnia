/**
 * Synchronous read access to the current project translation map for non-React code
 * (DSL converters, services, variable label resolution). Updated from ProjectTranslationsContext.
 */

import { isValidTranslationStoreKey } from './translationKeys';

let currentTable: Record<string, string> = {};

/**
 * Replace the registry contents (typically the merged project locale map).
 */
export function setProjectTranslationsRegistry(map: Record<string, string>): void {
  currentTable = map && typeof map === 'object' ? { ...map } : {};
}

/**
 * Merges one GUID → display label into the synchronous registry (used by services and DSL helpers).
 * React `ProjectTranslationsContext` may lag one frame; readers that merge with this registry
 * (e.g. TextMessageEditor) resolve labels immediately after domain updates.
 */
export function mergeProjectTranslationEntry(guid: string, text: string): void {
  const g = String(guid || '').trim();
  const t = String(text || '').trim();
  if (!g || !t) return;
  if (!isValidTranslationStoreKey(g)) {
    throw new Error(`[mergeProjectTranslationEntry] Invalid translation store key: ${g}`);
  }
  const tbl = getProjectTranslationsTable();
  setProjectTranslationsRegistry({ ...tbl, [g]: t });
}

/**
 * Returns a shallow copy of the current translation table for read-only use.
 */
export function getProjectTranslationsTable(): Record<string, string> {
  return { ...currentTable };
}
