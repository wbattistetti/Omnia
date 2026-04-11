/**
 * Converts Backend Call task rows (flat inputs/outputs) to MappingEntry[] for the unified tree UI and back.
 * Task stores variable as GUID only; labels are never duplicated in task rows.
 */

import { createMappingEntry, type MappingEntry } from './mappingTypes';

export type BackendCallInputRow = {
  internalName: string;
  apiParam?: string;
  variable?: string;
  fieldDescription?: string;
  sampleValues?: string[];
};

export type BackendCallOutputRow = {
  internalName: string;
  apiField?: string;
  variable?: string;
  fieldDescription?: string;
  sampleValues?: string[];
};

/** Task rows → tree entries (skips empty internal names). */
export function backendInputsToMappingEntries(inputs: BackendCallInputRow[] | undefined): MappingEntry[] {
  const list = inputs ?? [];
  return list
    .filter((row) => row.internalName?.trim())
    .map((row) => {
      const vid = row.variable?.trim();
      return createMappingEntry({
        wireKey: row.internalName.trim(),
        apiField: row.apiParam?.trim() ?? '',
        ...(vid ? { variableRefId: vid } : {}),
        ...(row.fieldDescription !== undefined ? { fieldDescription: row.fieldDescription } : {}),
        ...(row.sampleValues !== undefined ? { sampleValues: row.sampleValues } : {}),
      });
    });
}

export function backendOutputsToMappingEntries(outputs: BackendCallOutputRow[] | undefined): MappingEntry[] {
  const list = outputs ?? [];
  return list
    .filter((row) => row.internalName?.trim())
    .map((row) => {
      const vid = row.variable?.trim();
      return createMappingEntry({
        wireKey: row.internalName.trim(),
        apiField: row.apiField?.trim() ?? '',
        ...(vid ? { variableRefId: vid } : {}),
        ...(row.fieldDescription !== undefined ? { fieldDescription: row.fieldDescription } : {}),
        ...(row.sampleValues !== undefined ? { sampleValues: row.sampleValues } : {}),
      });
    });
}

export function mappingEntriesToBackendInputs(entries: MappingEntry[]): BackendCallInputRow[] {
  return entries
    .filter((e) => e.wireKey.trim())
    .map((e) => ({
      internalName: e.wireKey.trim(),
      apiParam: e.apiField.trim(),
      variable: e.variableRefId?.trim() ?? '',
      ...(e.fieldDescription !== undefined ? { fieldDescription: e.fieldDescription } : {}),
      ...(e.sampleValues !== undefined ? { sampleValues: e.sampleValues } : {}),
    }));
}

export function mappingEntriesToBackendOutputs(entries: MappingEntry[]): BackendCallOutputRow[] {
  return entries
    .filter((e) => e.wireKey.trim())
    .map((e) => ({
      internalName: e.wireKey.trim(),
      apiField: e.apiField.trim(),
      variable: e.variableRefId?.trim() ?? '',
      ...(e.fieldDescription !== undefined ? { fieldDescription: e.fieldDescription } : {}),
      ...(e.sampleValues !== undefined ? { sampleValues: e.sampleValues } : {}),
    }));
}
