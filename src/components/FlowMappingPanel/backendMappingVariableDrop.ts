/**
 * Shared merge logic for backend SEND/RECEIVE when linking a variable (HTML5 drag or pointer drop from canvas).
 */

import type { MappingEntry } from './mappingTypes';
import { insertNewBackendParameter, type ParamDropPosition } from './backendParamInsert';
import { entriesInDepthFirstOrder, type MappingTreeSiblingOrder } from './mappingTreeUtils';
import { stableInterfacePathForVariable, uniqueWireKeyFromLabel } from './flowInterfaceDragTypes';
import { ensureFlowVariableBindingForInterfaceRow } from './interfaceMappingLabels';

export type BackendMappingVariablePayload = {
  variableRefId: string;
  rowLabel?: string;
};

export type MergeBackendMappingVariableDropResult = {
  merged: MappingEntry[];
  newEntry: MappingEntry;
};

/**
 * Inserts a mapping row bound to `variableRefId`, with a stable wire key derived from the variable GUID.
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
          return { targetPathKey: last.wireKey, placement: 'after' as const };
        })());

  const { next, newEntry } = insertNewBackendParameter(entries, pos, { siblingOrder });
  const newWireKey = uniqueWireKeyFromLabel(stableInterfacePathForVariable(vid), next, newEntry.id);
  if (projectId && flowCanvasId) {
    ensureFlowVariableBindingForInterfaceRow(projectId, flowCanvasId, vid);
  }
  const merged = next.map((entry) => {
    if (entry.id !== newEntry.id) return entry;
    const { literalConstant: _omitLit, ...rest } = entry as MappingEntry & { literalConstant?: string };
    return {
      ...rest,
      wireKey: newWireKey,
      variableRefId: vid,
    };
  });
  const patched = merged.find((e) => e.id === newEntry.id);
  if (!patched) return null;
  return { merged, newEntry: patched };
}
