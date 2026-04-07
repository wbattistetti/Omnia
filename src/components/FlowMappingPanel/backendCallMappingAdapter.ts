/**
 * Converts Backend Call task rows (flat inputs/outputs) to MappingEntry[] for the unified tree UI and back.
 * Task stores variable as varId; MappingEntry uses linkedVariable as display name (label).
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
export function backendInputsToMappingEntries(
  inputs: BackendCallInputRow[] | undefined,
  getVarNameFromVarId: (varId: string | undefined) => string | null
): MappingEntry[] {
  const list = inputs ?? [];
  return list
    .filter((row) => row.internalName?.trim())
    .map((row) => {
      const vid = row.variable?.trim();
      return createMappingEntry({
        internalPath: row.internalName.trim(),
        apiField: row.apiParam?.trim() ?? '',
        linkedVariable: getVarNameFromVarId(row.variable) ?? '',
        externalName: row.internalName.trim(),
        ...(vid ? { variableRefId: vid } : {}),
        ...(row.fieldDescription !== undefined ? { fieldDescription: row.fieldDescription } : {}),
        ...(row.sampleValues !== undefined ? { sampleValues: row.sampleValues } : {}),
      });
    });
}

export function backendOutputsToMappingEntries(
  outputs: BackendCallOutputRow[] | undefined,
  getVarNameFromVarId: (varId: string | undefined) => string | null
): MappingEntry[] {
  const list = outputs ?? [];
  return list
    .filter((row) => row.internalName?.trim())
    .map((row) => {
      const vid = row.variable?.trim();
      return createMappingEntry({
        internalPath: row.internalName.trim(),
        apiField: row.apiField?.trim() ?? '',
        linkedVariable: getVarNameFromVarId(row.variable) ?? '',
        externalName: row.internalName.trim(),
        ...(vid ? { variableRefId: vid } : {}),
        ...(row.fieldDescription !== undefined ? { fieldDescription: row.fieldDescription } : {}),
        ...(row.sampleValues !== undefined ? { sampleValues: row.sampleValues } : {}),
      });
    });
}

export function mappingEntriesToBackendInputs(
  entries: MappingEntry[],
  resolveVarId: (varName: string) => string
): BackendCallInputRow[] {
  return entries
    .filter((e) => e.internalPath.trim())
    .map((e) => ({
      internalName: e.internalPath.trim(),
      apiParam: e.apiField.trim(),
      variable: e.variableRefId?.trim() || resolveVarId(e.linkedVariable),
      ...(e.fieldDescription !== undefined ? { fieldDescription: e.fieldDescription } : {}),
      ...(e.sampleValues !== undefined ? { sampleValues: e.sampleValues } : {}),
    }));
}

export function mappingEntriesToBackendOutputs(
  entries: MappingEntry[],
  resolveVarId: (varName: string) => string
): BackendCallOutputRow[] {
  return entries
    .filter((e) => e.internalPath.trim())
    .map((e) => ({
      internalName: e.internalPath.trim(),
      apiField: e.apiField.trim(),
      variable: e.variableRefId?.trim() || resolveVarId(e.linkedVariable),
      ...(e.fieldDescription !== undefined ? { fieldDescription: e.fieldDescription } : {}),
      ...(e.sampleValues !== undefined ? { sampleValues: e.sampleValues } : {}),
    }));
}
