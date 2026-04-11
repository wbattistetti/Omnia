/**
 * Synchronous read access to the current project translation map for non-React code
 * (DSL converters, services, variable label resolution, TaskContentResolver).
 *
 * The table is the **compiled** map: global project locale rows merged with every flow slice's
 * `meta.translations` (same as `compiledTranslations` in ProjectTranslationsContext). Always read
 * through `getProjectTranslationsTable` for domain checks (e.g. SayMessage "has content").
 */

import { isValidTranslationStoreKey } from './translationKeys';

let currentTable: Record<string, string> = {};

/**
 * Replace the registry contents (typically output of `compileWorkspaceTranslations`).
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
 * Shallow copy of the merged global + flow-slice translation map (authoring/runtime consistent).
 */
export function getProjectTranslationsTable(): Record<string, string> {
  return { ...currentTable };
}
