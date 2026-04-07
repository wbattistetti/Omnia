/**
 * Shared merge logic for backend SEND/RECEIVE when linking a variable (HTML5 drag or pointer drop from canvas).
 */

import type { MappingEntry } from './mappingTypes';
import { insertNewBackendParameter, type ParamDropPosition } from './backendParamInsert';
import { entriesInDepthFirstOrder, type MappingTreeSiblingOrder } from './mappingTreeUtils';
import { uniqueInternalPathFromLabel } from './flowInterfaceDragTypes';
import { computeInterfaceEntryLabels, ensureFlowVariableBindingForInterfaceRow } from './interfaceMappingLabels';

export type BackendMappingVariablePayload = {
  variableRefId: string;
  rowLabel?: string;
};

export type MergeBackendMappingVariableDropResult = {
  merged: MappingEntry[];
  newEntry: MappingEntry;
};

/**
 * Inserts a mapping row bound to `variableRefId`, with internal path slug from the variable label.
 * If `explicitPos` is omitted, appends after the last row (depth-first order).
 * Returns null if invalid or duplicate variable id.
 */
export function mergeBackendMappingVariableDrop(
  entries: MappingEntry[],
  payload: BackendMappingVariablePayload,
  projectId: string | undefined,
  flowCanvasId: string | undefined,
  siblingOrder: MappingTreeSiblingOrder,
  explicitPos?: ParamDropPosition
): MergeBackendMappingVariableDropResult | null {
  const vid = payload.variableRefId.trim();
  if (!vid) return null;
  if (entries.some((x) => x.variableRefId?.trim() === vid)) return null;

  const pos: ParamDropPosition =
    explicitPos ??
    (entries.length === 0
      ? { targetPathKey: '', placement: 'after' }
      : (() => {
          const ordered = entriesInDepthFirstOrder(entries, siblingOrder);
          const last = ordered[ordered.length - 1];
          return { targetPathKey: last.internalPath, placement: 'after' as const };
        })());

  const { next, newEntry } = insertNewBackendParameter(entries, pos, { siblingOrder });
  const rowText = (payload.rowLabel ?? '').trim();
  const { externalName, linkedVariable } = computeInterfaceEntryLabels(
    projectId,
    vid,
    rowText,
    newEntry.internalPath
  );
  const newInternalPath = uniqueInternalPathFromLabel(linkedVariable, next, newEntry.id);
  if (projectId && flowCanvasId) {
    ensureFlowVariableBindingForInterfaceRow(projectId, flowCanvasId, vid, rowText, newInternalPath);
  }
  const merged = next.map((entry) =>
    entry.id === newEntry.id
      ? {
          ...entry,
          internalPath: newInternalPath,
          variableRefId: vid,
          linkedVariable,
          externalName,
        }
      : entry
  );
  const patched = merged.find((e) => e.id === newEntry.id);
  if (!patched) return null;
  return { merged, newEntry: patched };
}
