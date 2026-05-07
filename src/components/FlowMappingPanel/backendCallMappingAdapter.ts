/**
 * Converts Backend Call task rows (flat inputs/outputs) to MappingEntry[] for the unified tree UI and back.
 * Task stores `variable` as string: GUID di variabile nota nel progetto, oppure valore costante (euristica con `knownVariableIds`).
 */

import { createMappingEntry, type MappingEntry } from './mappingTypes';
import { unwrapSessionTreeWireKey } from './bookFromAgendaSessionTree';

export type BackendCallInputRow = {
  internalName: string;
  apiParam?: string;
  variable?: string;
  fieldDescription?: string;
  sampleValues?: string[];
  sendBindingOptional?: boolean;
  sendBindingDesignTimeRequired?: boolean;
  sendBindingBindingPhase?: 'design' | 'runtime';
  sendConstraintGroupId?: string;
  sendConstraintGroupLabel?: string;
};

export type BackendCallOutputRow = {
  internalName: string;
  apiField?: string;
  variable?: string;
  fieldDescription?: string;
  sampleValues?: string[];
};

/**
 * Se `knownVariableIds` è definito: `raw` è variabile solo se è nell’insieme (tipicamente GUID del flow).
 * Se omesso: comportamento legacy — ogni stringa non vuota diventa `variableRefId` (nessun literal separato).
 */
export function splitTaskVariableField(
  raw: string | undefined,
  knownVariableIds?: ReadonlySet<string>
): { variableRefId?: string; literalConstant?: string } {
  const v = String(raw ?? '').trim();
  if (!v) return {};
  if (knownVariableIds === undefined) {
    return { variableRefId: v };
  }
  if (knownVariableIds.has(v)) {
    return { variableRefId: v };
  }
  return { literalConstant: v };
}

/** Task rows → tree entries (skips empty internal names). */
export function backendInputsToMappingEntries(
  inputs: BackendCallInputRow[] | undefined,
  knownVariableIds?: ReadonlySet<string>
): MappingEntry[] {
  const list = inputs ?? [];
  return list
    .filter((row) => row.internalName?.trim())
    .map((row) => {
      const { variableRefId, literalConstant } = splitTaskVariableField(row.variable, knownVariableIds);
      return createMappingEntry({
        wireKey: unwrapSessionTreeWireKey(row.internalName.trim()),
        apiField: row.apiParam?.trim() ?? '',
        ...(variableRefId ? { variableRefId } : {}),
        ...(literalConstant ? { literalConstant } : {}),
        ...(row.fieldDescription !== undefined ? { fieldDescription: row.fieldDescription } : {}),
        ...(row.sampleValues !== undefined ? { sampleValues: row.sampleValues } : {}),
        ...(row.sendBindingOptional !== undefined ? { sendBindingOptional: row.sendBindingOptional } : {}),
        ...(row.sendBindingDesignTimeRequired !== undefined
          ? { sendBindingDesignTimeRequired: row.sendBindingDesignTimeRequired }
          : {}),
        ...(row.sendBindingBindingPhase !== undefined ? { sendBindingBindingPhase: row.sendBindingBindingPhase } : {}),
        ...(row.sendConstraintGroupId !== undefined ? { sendConstraintGroupId: row.sendConstraintGroupId } : {}),
        ...(row.sendConstraintGroupLabel !== undefined
          ? { sendConstraintGroupLabel: row.sendConstraintGroupLabel }
          : {}),
      });
    });
}

export function backendOutputsToMappingEntries(
  outputs: BackendCallOutputRow[] | undefined,
  knownVariableIds?: ReadonlySet<string>
): MappingEntry[] {
  const list = outputs ?? [];
  return list
    .filter((row) => row.internalName?.trim())
    .map((row) => {
      const { variableRefId, literalConstant } = splitTaskVariableField(row.variable, knownVariableIds);
      return createMappingEntry({
        wireKey: row.internalName.trim(),
        apiField: row.apiField?.trim() ?? '',
        ...(variableRefId ? { variableRefId } : {}),
        ...(literalConstant ? { literalConstant } : {}),
        ...(row.fieldDescription !== undefined ? { fieldDescription: row.fieldDescription } : {}),
        ...(row.sampleValues !== undefined ? { sampleValues: row.sampleValues } : {}),
      });
    });
}

export function mappingEntriesToBackendInputs(entries: MappingEntry[]): BackendCallInputRow[] {
  return entries
    .filter((e) => e.wireKey.trim())
    .map((e) => ({
      internalName: unwrapSessionTreeWireKey(e.wireKey.trim()),
      apiParam: e.apiField.trim(),
      variable: e.variableRefId?.trim() || e.literalConstant?.trim() || '',
      ...(e.fieldDescription !== undefined ? { fieldDescription: e.fieldDescription } : {}),
      ...(e.sampleValues !== undefined ? { sampleValues: e.sampleValues } : {}),
      ...(e.sendBindingOptional !== undefined ? { sendBindingOptional: e.sendBindingOptional } : {}),
      ...(e.sendBindingDesignTimeRequired !== undefined
        ? { sendBindingDesignTimeRequired: e.sendBindingDesignTimeRequired }
        : {}),
      ...(e.sendBindingBindingPhase !== undefined ? { sendBindingBindingPhase: e.sendBindingBindingPhase } : {}),
      ...(e.sendConstraintGroupId !== undefined ? { sendConstraintGroupId: e.sendConstraintGroupId } : {}),
      ...(e.sendConstraintGroupLabel !== undefined
        ? { sendConstraintGroupLabel: e.sendConstraintGroupLabel }
        : {}),
    }));
}

export function mappingEntriesToBackendOutputs(entries: MappingEntry[]): BackendCallOutputRow[] {
  return entries
    .filter((e) => e.wireKey.trim())
    .map((e) => ({
      internalName: e.wireKey.trim(),
      apiField: e.apiField.trim(),
      variable: e.variableRefId?.trim() || e.literalConstant?.trim() || '',
      ...(e.fieldDescription !== undefined ? { fieldDescription: e.fieldDescription } : {}),
      ...(e.sampleValues !== undefined ? { sampleValues: e.sampleValues } : {}),
    }));
}
