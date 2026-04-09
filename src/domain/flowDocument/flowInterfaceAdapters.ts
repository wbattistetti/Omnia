/**
 * Converts between persisted interface rows (FlowDocument) and UI MappingEntry rows.
 */

import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { FlowInterfaceRowPersisted } from './FlowDocument';

function entryLabel(row: FlowInterfaceRowPersisted, translations: Record<string, string>): string {
  const t = translations[row.labelKey];
  if (t != null && String(t).trim()) return String(t).trim();
  return row.labelKey;
}

/** UI → persist (when saving FlowDocument). */
export function mappingEntriesToPersistedInput(rows: MappingEntry[]): FlowInterfaceRowPersisted[] {
  return rows.map((m) => {
    const labelKey = (m as MappingEntry & { labelKey?: string }).labelKey?.trim() || m.externalName?.trim() || m.id;
    return {
      id: m.id,
      variableRefId: String(m.variableRefId || '').trim() || m.id,
      labelKey,
      direction: 'input' as const,
    };
  });
}

export function mappingEntriesToPersistedOutput(rows: MappingEntry[]): FlowInterfaceRowPersisted[] {
  return rows.map((m) => {
    const labelKey = (m as MappingEntry & { labelKey?: string }).labelKey?.trim() || m.externalName?.trim() || m.id;
    return {
      id: m.id,
      variableRefId: String(m.variableRefId || '').trim() || m.id,
      labelKey,
      direction: 'output' as const,
    };
  });
}

/** Persist → UI (labels from flow-local translations). */
export function persistedRowsToMappingEntries(
  rows: FlowInterfaceRowPersisted[],
  translations: Record<string, string>
): MappingEntry[] {
  return rows.map((row) => {
    const label = entryLabel(row, translations);
    return {
      id: row.id,
      internalPath: label,
      variableRefId: row.variableRefId,
      externalName: label,
      linkedVariable: label,
      apiField: '',
      labelKey: row.labelKey,
    } as MappingEntry & { labelKey: string };
  });
}
