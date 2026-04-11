/**
 * Converts between persisted interface rows (FlowDocument) and UI MappingEntry rows.
 */

import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { FlowInterfaceRowPersisted } from './FlowDocument';
import { isUuidString, makeTranslationKey } from '@utils/translationKeys';

function entryLabel(row: FlowInterfaceRowPersisted, translations: Record<string, string>): string {
  const t = translations[row.labelKey];
  if (t != null && String(t).trim()) return String(t).trim();
  return row.labelKey;
}

/** UI → persist (when saving FlowDocument). */
export function mappingEntriesToPersistedInput(rows: MappingEntry[]): FlowInterfaceRowPersisted[] {
  return rows.map((m) => {
    const vid = String(m.variableRefId || '').trim();
    const labelKey =
      (m as MappingEntry & { labelKey?: string }).labelKey?.trim() ||
      (vid && isUuidString(vid) ? makeTranslationKey('var', vid) : m.id);
    return {
      id: m.id,
      variableRefId: vid || m.id,
      labelKey,
      direction: 'input' as const,
    };
  });
}

export function mappingEntriesToPersistedOutput(rows: MappingEntry[]): FlowInterfaceRowPersisted[] {
  return rows.map((m) => {
    const vid = String(m.variableRefId || '').trim();
    const labelKey =
      (m as MappingEntry & { labelKey?: string }).labelKey?.trim() ||
      (vid && isUuidString(vid) ? makeTranslationKey('var', vid) : m.id);
    return {
      id: m.id,
      variableRefId: vid || m.id,
      labelKey,
      direction: 'output' as const,
    };
  });
}

/** Persist → UI (labels from flow-local translations only at render time). */
export function persistedRowsToMappingEntries(
  rows: FlowInterfaceRowPersisted[],
  translations: Record<string, string>
): MappingEntry[] {
  return rows.map((row) => {
    const label = entryLabel(row, translations);
    return {
      id: row.id,
      wireKey: label,
      variableRefId: row.variableRefId,
      apiField: '',
      labelKey: row.labelKey,
    } as MappingEntry & { labelKey: string };
  });
}
