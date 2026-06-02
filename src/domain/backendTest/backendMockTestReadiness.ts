/**
 * Criteri «Test API» / bulk mock: solo parametri SEND obbligatori a design-time devono essere valorizzati.
 */

import type { MappingEntry } from '../../components/FlowMappingPanel/mappingTypes';
import type { BackendMockTableRow } from './backendTestRowTypes';
import { isBackendMockInputCellFilled } from './backendMockRowCompletion';

export function isSendMappingEntryBound(
  entry: Pick<MappingEntry, 'variableRefId' | 'literalConstant'>
): boolean {
  return Boolean(entry.variableRefId?.trim() || entry.literalConstant?.trim());
}

/** WireKey SEND obbligatori a design-time per Test API (mock table). */
export function listDesignRequiredSendWireKeys(entries: readonly MappingEntry[]): string[] {
  return entries
    .filter((e) => {
      const wk = e.wireKey?.trim();
      if (!wk) return false;
      /** Nodi firma OpenAPI annidati: solo UI Signature, non parametri HTTP del test. */
      if (e.schemaOutlineOnly) return false;
      if (e.sendBindingBindingPhase === 'runtime') return false;
      if (e.sendBindingOptional) return false;
      if (e.sendBindingDesignTimeRequired) return true;
      if (e.sendBindingOptional === false) return true;
      /** Senza flag esplicito: opzionale in test (body POST può omettere il campo). */
      return false;
    })
    .map((e) => e.wireKey.trim());
}

function isWireKeySatisfiedForMockTest(
  wireKey: string,
  row: BackendMockTableRow | undefined,
  literalFallback: Record<string, string>,
  entryByWire: Map<string, MappingEntry>
): boolean {
  if (row && isBackendMockInputCellFilled(row.inputs?.[wireKey])) return true;
  if (isBackendMockInputCellFilled(literalFallback[wireKey])) return true;
  const entry = entryByWire.get(wireKey);
  return entry ? isSendMappingEntryBound(entry) : false;
}

/**
 * True se la mock table può eseguire Test API: nessun obbligatorio mancante su mapping o su almeno una riga.
 * Se tutti i SEND sono opzionali, basta avere colonne input definite.
 */
export function isBackendMockTableReadyForBulkTest(
  sendEntries: readonly MappingEntry[],
  table: readonly BackendMockTableRow[],
  literalFallback: Record<string, string>
): boolean {
  if (sendEntries.length === 0) return false;

  const required = listDesignRequiredSendWireKeys(sendEntries);
  if (required.length === 0) return true;

  const entryByWire = new Map(sendEntries.map((e) => [e.wireKey.trim(), e]));

  if (required.every((wk) => isWireKeySatisfiedForMockTest(wk, undefined, literalFallback, entryByWire))) {
    return true;
  }

  return table.some((row) =>
    required.every((wk) => isWireKeySatisfiedForMockTest(wk, row, literalFallback, entryByWire))
  );
}

/** Evidenziazione riga mock: manca almeno un obbligatorio (opzionali vuoti non contano). */
export function isBackendMockRowIncompleteForBulkTest(
  row: BackendMockTableRow,
  sendEntries: readonly MappingEntry[],
  literalFallback: Record<string, string>
): boolean {
  const required = listDesignRequiredSendWireKeys(sendEntries);
  if (required.length === 0) return false;
  const entryByWire = new Map(sendEntries.map((e) => [e.wireKey.trim(), e]));
  return !required.every((wk) => isWireKeySatisfiedForMockTest(wk, row, literalFallback, entryByWire));
}

/** Obbligatori SEND ancora vuoti su mapping + riga mock (per messaggi UI Test API). */
export function listMissingDesignRequiredSendWireKeysForMockTest(
  sendEntries: readonly MappingEntry[],
  table: readonly BackendMockTableRow[],
  literalFallback: Record<string, string>
): string[] {
  const required = listDesignRequiredSendWireKeys(sendEntries);
  if (required.length === 0) return [];
  const entryByWire = new Map(sendEntries.map((e) => [e.wireKey.trim(), e]));
  const missing: string[] = [];
  for (const wk of required) {
    const globalOk = isWireKeySatisfiedForMockTest(wk, undefined, literalFallback, entryByWire);
    const anyRowOk = table.some((row) =>
      isWireKeySatisfiedForMockTest(wk, row, literalFallback, entryByWire)
    );
    if (!globalOk && !anyRowOk) missing.push(wk);
  }
  return missing;
}
